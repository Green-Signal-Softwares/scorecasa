import { Router } from "express";
import { db, leadsTable, brokersTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, sql, ilike, or, and, desc } from "drizzle-orm";

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

// Middleware: exige sessão autenticada em todas as rotas /api/leads
async function requireAuth(req: any, res: any, next: any) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.sessionUser = user;
  next();
}
import {
  CreateLeadBody,
  UpdateLeadBody,
  EnrichLeadBody,
  GetLeadsQueryParams,
  GetLeadParams,
  UpdateLeadParams,
  DeleteLeadParams,
  GetLeadScoreParams,
  EnrichLeadParams,
} from "@workspace/api-zod";

const router = Router();

// Todas as rotas de leads exigem autenticação
router.use(requireAuth);

// ── Privacidade: campos de dívida/BCB são privados do cliente ────────────────
// Igual ao Open Finance: corretor/correspondente/admin NAO recebem esses
// valores brutos do lead. Eles são preenchidos pelo cliente no portal e
// influenciam apenas o score agregado (que sim é visível ao corretor).
const CLIENT_PRIVATE_FIELDS = [
  "vehicleLoanMonthly",
  "otherLoansMonthly",
  "creditCardLimit",
  "creditCardUsage",
  "bcbTotalDebt",
  "bcbMonthlyCommitment",
  "bcbOperationsCount",
  "bcbQueryDate",
  "bcbDebtsCurrent",
  "bcbDebtsOverdue",
  "bcbCreditLimits",
  "bcbOperationsJson",
] as const;

// Remove campos privados de um lead a menos que o solicitante seja o próprio
// dono daquele lead (perfil "client" com leadId batendo).
function redactPrivateForViewer<T extends { id: number } & Record<string, any>>(
  lead: T,
  viewer: { role: string; leadId: number | null } | null,
): T {
  const isOwner = viewer?.role === "client" && viewer.leadId === lead.id;
  if (isOwner) return lead;
  const copy: any = { ...lead };
  for (const f of CLIENT_PRIVATE_FIELDS) copy[f] = null;
  return copy as T;
}

interface ScoreInput {
  income: number;
  propertyValue: number;
  informalIncome?: number | null;
  spouseIncome?: number | null;
  hasFgts?: boolean | null;
  fgtsBalance?: number | null;
  employmentType?: string | null;
  employmentMonths?: number | null;
  maritalStatus?: string | null;
  propertyType?: string | null;
  birthDate?: string | null;
  // Bureau / Caixa real data
  serasaScore?: number | null;
  hasNegativations?: boolean | null;
  hasProtests?: boolean | null;
  siricStatus?: string | null;
  fgtsMonths?: number | null;
  caixaScoreReal?: number | null;
  // Comprometimento financeiro ativo
  vehicleLoanMonthly?: number | null;
  creditCardUsage?: number | null;
  otherLoansMonthly?: number | null;
}

function computeScore(input: ScoreInput): {
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation: string;
} {
  const {
    income,
    propertyValue,
    informalIncome = 0,
    spouseIncome = 0,
    hasFgts = false,
    fgtsBalance = 0,
    employmentType,
    employmentMonths = 0,
    maritalStatus,
    propertyType,
    birthDate,
  } = input;

  const {
    serasaScore,
    hasNegativations,
    hasProtests,
    siricStatus,
    fgtsMonths,
    caixaScoreReal,
    vehicleLoanMonthly,
    creditCardUsage,
    otherLoansMonthly,
  } = input;

  // ── Renda total composta ───────────────────────────────────────────────────
  const totalIncome = income + (informalIncome ?? 0) * 0.7 + (spouseIncome ?? 0);

  // ── Comprometimento (relação imóvel / renda anual) ─────────────────────────
  const ratio = propertyValue / (totalIncome * 12);
  const maxRatio = 4.5;
  let baseChance = Math.max(0, Math.min(100, 100 - (ratio / maxRatio) * 60));

  // ── Bônus: FGTS ───────────────────────────────────────────────────────────
  if (hasFgts && (fgtsBalance ?? 0) > 0) {
    const fgtsRatio = (fgtsBalance ?? 0) / propertyValue;
    baseChance += Math.min(10, fgtsRatio * 100);
  }
  // FGTS real: tempo de contribuição adiciona estabilidade
  if ((fgtsMonths ?? 0) >= 36) baseChance += 5;
  else if ((fgtsMonths ?? 0) >= 12) baseChance += 2;

  // ── Bônus: estabilidade empregatícia ─────────────────────────────────────
  if (employmentType === "clt" || employmentType === "servidor_publico") {
    baseChance += 8;
  } else if (employmentType === "autonomo" || employmentType === "liberal") {
    baseChance -= 5;
    if ((employmentMonths ?? 0) >= 24) baseChance += 6;
  } else if (employmentType === "aposentado") {
    baseChance += 5;
  }

  // ── Bônus: tempo no emprego ───────────────────────────────────────────────
  if ((employmentMonths ?? 0) >= 36) baseChance += 5;
  else if ((employmentMonths ?? 0) >= 12) baseChance += 2;

  // ── Bônus: composição familiar ────────────────────────────────────────────
  if ((maritalStatus === "casado" || maritalStatus === "uniao_estavel") && (spouseIncome ?? 0) > 0) {
    baseChance += 4;
  }

  // ── Bônus: imóvel novo tem aprovação mais fácil na Caixa ──────────────────
  if (propertyType === "novo") baseChance += 3;
  else if (propertyType === "construcao") baseChance -= 3;

  // ── Idade mínima Caixa (18 anos) ─────────────────────────────────────────
  if (birthDate) {
    const age = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) baseChance = 0;
    else if (age > 70) baseChance -= 10;
  }

  // ── Dados reais dos bureaus (alta prioridade) ─────────────────────────────
  if (serasaScore != null) {
    if (serasaScore >= 800) baseChance += 12;
    else if (serasaScore >= 700) baseChance += 8;
    else if (serasaScore >= 600) baseChance += 3;
    else if (serasaScore >= 500) baseChance -= 5;
    else if (serasaScore >= 400) baseChance -= 12;
    else baseChance -= 20;
  }
  if (hasNegativations) baseChance -= 25;
  if (hasProtests) baseChance -= 30;
  if (siricStatus === "irregular") baseChance -= 40;
  else if (siricStatus === "regular") baseChance += 5;

  // ── Comprometimento financeiro ativo (veículo, empréstimos, cartão) ────────
  const monthlyDebt = (vehicleLoanMonthly ?? 0) + (otherLoansMonthly ?? 0);
  const debtRatio = totalIncome > 0 ? monthlyDebt / totalIncome : 0;
  if (debtRatio > 0.30) baseChance -= 18;
  else if (debtRatio > 0.20) baseChance -= 10;
  else if (debtRatio > 0.10) baseChance -= 4;

  // Utilização de cartão de crédito > 80% indica stress financeiro
  if ((creditCardUsage ?? 0) > 80) baseChance -= 10;
  else if ((creditCardUsage ?? 0) > 50) baseChance -= 5;

  const approvalChance = Math.round(Math.max(0, Math.min(100, baseChance)));

  // ── Score Caixa: usa real se disponível, senão calcula ───────────────────
  const scoreCaixa = caixaScoreReal != null
    ? Math.min(1000, Math.max(0, caixaScoreReal))
    : Math.min(1000, Math.max(300, Math.round(300 + (approvalChance / 100) * 550 + (Math.random() * 80 - 40))));

  const scoreMCMV = totalIncome <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);

  // ── Recomendação ─────────────────────────────────────────────────────────
  const issues: string[] = [];
  if (ratio > 4) issues.push("comprometimento de renda elevado");
  if (employmentType === "autonomo" && (employmentMonths ?? 0) < 24) issues.push("renda autônoma com menos de 2 anos de histórico");
  if (!hasFgts) issues.push("ausência de FGTS para abater entrada");
  if ((maritalStatus === "casado" || maritalStatus === "uniao_estavel") && !(spouseIncome ?? 0)) issues.push("renda do cônjuge não informada");
  if (hasNegativations) issues.push("negativações ativas no Serasa/SPC");
  if (hasProtests) issues.push("protestos em cartório");
  if (siricStatus === "irregular") issues.push("situação irregular no SIRIC Caixa");

  let recommendation = "";
  if (approvalChance >= 75) {
    recommendation = `Perfil com alta chance de aprovação. Recomendamos avançar com o processo imediatamente.${issues.length ? ` Pontos de atenção: ${issues.join("; ")}.` : ""}`;
  } else if (approvalChance >= 50) {
    recommendation = `Perfil com chances moderadas.${issues.length ? ` Melhorias sugeridas: ${issues.join("; ")}.` : " Ajustando o comprometimento de renda, a aprovação pode ser garantida."}`;
  } else if (approvalChance >= 30) {
    recommendation = `Perfil em análise. ${issues.length ? `Principais obstáculos: ${issues.join("; ")}.` : "Sugerimos aumentar a renda comprovada ou reduzir o valor do imóvel."}`;
  } else {
    recommendation = `Perfil com baixa chance no momento. ${issues.length ? `Pontos críticos: ${issues.join("; ")}.` : ""} Recomendamos trabalhar o score Caixa por pelo menos 3 meses antes de nova tentativa.`;
  }

  return {
    approvalChance,
    scoreCaixa,
    scoreMCMV: Math.min(1000, Math.max(0, scoreMCMV)),
    aiRecommendation: recommendation.trim(),
  };
}

router.get("/", async (req, res) => {
  const parsed = GetLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { status, search, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  // Cliente individual: só vê o próprio lead
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    if (!sessionUser.leadId) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, sessionUser.leadId)).limit(1);
    if (!lead) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    let brokerName: string | null = null;
    if (lead.brokerId) {
      const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
      brokerName = broker?.name ?? null;
    }
    res.json({
      data: [{ ...lead, brokerName, createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString() }],
      total: 1,
      page,
      limit,
    });
    return;
  }

  const conditions = [];
  if (status) conditions.push(eq(leadsTable.status, status as any));
  if (search) {
    conditions.push(
      or(
        ilike(leadsTable.name, `%${search}%`),
        ilike(leadsTable.email, `%${search}%`),
        ilike(leadsTable.cpf, `%${search}%`),
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [leads, countResult] = await Promise.all([
    db.select().from(leadsTable).where(where).orderBy(desc(leadsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(leadsTable).where(where),
  ]);

  const brokerIds = [...new Set(leads.map((l) => l.brokerId).filter(Boolean))] as number[];
  let brokerMap: Record<number, string> = {};
  if (brokerIds.length > 0) {
    const brokers = await db.select({ id: brokersTable.id, name: brokersTable.name }).from(brokersTable).where(
      sql`${brokersTable.id} = ANY(${sql.raw(`ARRAY[${brokerIds.join(",")}]::int[]`)})`,
    );
    brokerMap = Object.fromEntries(brokers.map((b) => [b.id, b.name]));
  }

  const viewer = sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null;
  const data = leads.map((l) => redactPrivateForViewer({
    ...l,
    brokerName: l.brokerId ? (brokerMap[l.brokerId] ?? null) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }, viewer));

  res.json({ data, total: countResult[0]?.count ?? 0, page, limit });
});

router.post("/", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem criar leads de terceiros." });
    return;
  }
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const scores = computeScore(parsed.data);

  const [lead] = await db
    .insert(leadsTable)
    .values({
      ...parsed.data,
      ...scores,
      status: "pending",
    })
    .returning();

  if (lead.brokerId) {
    await db
      .update(brokersTable)
      .set({ totalLeads: sql`${brokersTable.totalLeads} + 1` })
      .where(eq(brokersTable.id, lead.brokerId));
  }

  res.status(201).json({
    ...lead,
    brokerName: null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const parsed = GetLeadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client" && sessionUser.leadId !== parsed.data.id) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  let brokerName: string | null = null;
  if (lead.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...lead,
    brokerName,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.put("/:id", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Use /api/client/profile para editar seus dados." });
    return;
  }
  const paramsParsed = UpdateLeadParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateLeadBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const updateData: Record<string, any> = { ...bodyParsed.data, updatedAt: new Date() };
  if (bodyParsed.data.income !== undefined || bodyParsed.data.propertyValue !== undefined) {
    const scores = computeScore({
      income: bodyParsed.data.income ?? existing.income,
      propertyValue: bodyParsed.data.propertyValue ?? existing.propertyValue,
      informalIncome: existing.informalIncome,
      spouseIncome: existing.spouseIncome,
      hasFgts: existing.hasFgts,
      fgtsBalance: existing.fgtsBalance,
      employmentType: existing.employmentType,
      employmentMonths: existing.employmentMonths,
      maritalStatus: existing.maritalStatus,
      propertyType: existing.propertyType,
      birthDate: existing.birthDate,
    });
    Object.assign(updateData, scores);
  }

  if (bodyParsed.data.status === "approved" && existing.status !== "approved" && existing.brokerId) {
    await db
      .update(brokersTable)
      .set({ approvedLeads: sql`${brokersTable.approvedLeads} + 1` })
      .where(eq(brokersTable.id, existing.brokerId));
  }

  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, paramsParsed.data.id)).returning();

  if (bodyParsed.data.status && bodyParsed.data.status !== existing.status) {
    const statusLabels: Record<string, string> = {
      pending: "Pendente",
      analyzing: "Em Análise",
      approved: "Aprovado",
      rejected: "Reprovado",
      in_progress: "Em Andamento",
    };
    const fromLabel = statusLabels[existing.status] ?? existing.status;
    const toLabel = statusLabels[bodyParsed.data.status] ?? bodyParsed.data.status;
    await db.insert(notificationsTable).values({
      leadId: updated.id,
      leadName: updated.name,
      previousStatus: existing.status,
      newStatus: bodyParsed.data.status,
      message: `${updated.name} mudou de ${fromLabel} para ${toLabel}`,
    });
  }

  let brokerName: string | null = null;
  if (updated.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, updated.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...updated,
    brokerName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.delete("/:id", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem excluir leads." });
    return;
  }
  const parsed = DeleteLeadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  res.status(204).send();
});

router.put("/:id/enrich", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem enriquecer dados de leads." });
    return;
  }
  const paramsParsed = EnrichLeadParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = EnrichLeadBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  // Bloqueia campos privados do cliente: corretor não pode escrever dívidas/BCB
  // do lead. Esses dados pertencem ao cliente (igual Open Finance) e são
  // enviados via /api/client/debts ou /api/client/scr-import pelo próprio dono.
  const rawEnrich = bodyParsed.data as Record<string, any>;
  const enrichData: Record<string, any> = { ...rawEnrich };
  for (const f of CLIENT_PRIVATE_FIELDS) {
    if (f in enrichData) delete enrichData[f];
  }

  const scores = computeScore({
    income: existing.income,
    propertyValue: existing.propertyValue,
    informalIncome: existing.informalIncome,
    spouseIncome: existing.spouseIncome,
    hasFgts: existing.hasFgts,
    fgtsBalance: existing.fgtsBalance,
    employmentType: existing.employmentType,
    employmentMonths: existing.employmentMonths,
    maritalStatus: existing.maritalStatus,
    propertyType: existing.propertyType,
    birthDate: existing.birthDate,
    serasaScore: enrichData.serasaScore ?? existing.serasaScore,
    hasNegativations: enrichData.hasNegativations ?? existing.hasNegativations,
    hasProtests: enrichData.hasProtests ?? existing.hasProtests,
    siricStatus: enrichData.siricStatus ?? existing.siricStatus,
    fgtsMonths: enrichData.fgtsMonths ?? existing.fgtsMonths,
    caixaScoreReal: enrichData.caixaScoreReal ?? existing.caixaScoreReal,
    // Mantém o efeito dos campos privados no score (preservados pelo cliente).
    vehicleLoanMonthly: existing.vehicleLoanMonthly,
    creditCardUsage: existing.creditCardUsage,
    otherLoansMonthly: existing.otherLoansMonthly,
  });

  const [updated] = await db
    .update(leadsTable)
    .set({
      ...enrichData,
      ...scores,
      enrichedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, paramsParsed.data.id))
    .returning();

  let brokerName: string | null = null;
  if (updated.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, updated.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...updated,
    brokerName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    enrichedAt: updated.enrichedAt ? updated.enrichedAt.toISOString() : null,
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.get("/:id/score", async (req, res) => {
  const parsed = GetLeadScoreParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client" && sessionUser.leadId !== parsed.data.id) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const factors = [];

  if (lead.income >= 5000) {
    factors.push({ name: "Renda Mensal", impact: "positive", description: "Renda compatível com o financiamento solicitado", value: `R$ ${lead.income.toLocaleString("pt-BR")}` });
  } else {
    factors.push({ name: "Renda Mensal", impact: "negative", description: "Renda abaixo do recomendado para o valor do imóvel", value: `R$ ${lead.income.toLocaleString("pt-BR")}` });
  }

  const comprometimento = (lead.propertyValue / (lead.income * 12)) * 100;
  if (comprometimento <= 30) {
    factors.push({ name: "Comprometimento de Renda", impact: "positive", description: "Excelente relação entre renda e valor do imóvel", value: `${comprometimento.toFixed(1)}%` });
  } else if (comprometimento <= 50) {
    factors.push({ name: "Comprometimento de Renda", impact: "neutral", description: "Comprometimento dentro do limite aceitável", value: `${comprometimento.toFixed(1)}%` });
  } else {
    factors.push({ name: "Comprometimento de Renda", impact: "negative", description: "Alto comprometimento de renda. Considere reduzir o valor do imóvel.", value: `${comprometimento.toFixed(1)}%` });
  }

  factors.push({ name: "Score Caixa", impact: lead.scoreCaixa >= 600 ? "positive" : "negative", description: lead.scoreCaixa >= 600 ? "Score dentro do range de aprovação Caixa" : "Score abaixo do mínimo para aprovação Caixa", value: String(lead.scoreCaixa) });
  factors.push({ name: "Elegibilidade MCMV", impact: lead.scoreMCMV >= 500 ? "positive" : "neutral", description: lead.scoreMCMV >= 500 ? "Elegível para Minha Casa Minha Vida" : "Não elegível para MCMV no momento", value: String(lead.scoreMCMV) });

  const eligibleBanks = [];
  if (lead.scoreCaixa >= 600) eligibleBanks.push("Caixa Econômica Federal");
  if (lead.scoreCaixa >= 650) eligibleBanks.push("Banco do Brasil");
  if (lead.scoreCaixa >= 700) eligibleBanks.push("Bradesco");
  if (lead.scoreCaixa >= 720) eligibleBanks.push("Itaú Unibanco");
  if (lead.scoreCaixa >= 680) eligibleBanks.push("Santander");

  res.json({
    leadId: lead.id,
    overallScore: lead.scoreCaixa,
    approvalChance: lead.approvalChance,
    scoreCaixa: lead.scoreCaixa,
    scoreMCMV: lead.scoreMCMV,
    factors,
    recommendation: lead.aiRecommendation ?? "Análise em andamento.",
    eligibleBanks,
  });
});

export default router;
