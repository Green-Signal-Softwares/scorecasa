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
// Campos preenchidos pelo cliente que o staff NUNCA pode escrever via /enrich.
// Os 8 campos BCB ficam ocultos para staff (igual Open Finance); os 4 campos
// de dívidas gerais (parcelas/cartão) ficam visíveis em modo somente-leitura
// para análise de crédito imobiliário.
const STAFF_VISIBLE_DEBT_FIELDS = [
  "vehicleLoanMonthly",
  "otherLoansMonthly",
  "creditCardLimit",
  "creditCardUsage",
] as const;
const BCB_PRIVATE_FIELDS = [
  "bcbTotalDebt",
  "bcbMonthlyCommitment",
  "bcbOperationsCount",
  "bcbQueryDate",
  "bcbDebtsCurrent",
  "bcbDebtsOverdue",
  "bcbCreditLimits",
  "bcbOperationsJson",
] as const;
// Conjunto bloqueado para escrita por staff via /enrich — soma os dois grupos.
const CLIENT_PRIVATE_FIELDS = [
  ...STAFF_VISIBLE_DEBT_FIELDS,
  ...BCB_PRIVATE_FIELDS,
] as const;

// Remove campos privados de um lead a menos que o solicitante seja o próprio
// dono daquele lead (perfil "client" com leadId batendo). Para staff, apenas
// os 8 campos BCB são zerados; as dívidas gerais permanecem visíveis.
function redactPrivateForViewer<T extends { id: number } & Record<string, any>>(
  lead: T,
  viewer: { role: string; leadId: number | null } | null,
): T {
  const isOwner = viewer?.role === "client" && viewer.leadId === lead.id;
  if (isOwner) return lead;
  const copy: any = { ...lead };
  for (const f of BCB_PRIVATE_FIELDS) copy[f] = null;
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
  bcbMonthlyCommitment?: number | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  openFinanceConnected?: boolean | null;
  openFinanceAvgBalance?: number | null;
  openFinanceRecurringIncome?: number | null;
  openFinanceCardUsage?: number | null;
  openFinanceNoLatePayments?: boolean | null;
  openFinanceCpfClear?: boolean | null;
}

// ── Fórmula ScoreCasa v1 — Índice de Aprovação Caixa ─────────────────────
//
// Pontuação total = 100, dividida em 6 blocos:
//   1. Comprometimento de renda          (30)
//   2. Entrada + FGTS + subsídio         (20)
//   3. Score de crédito (Serasa/SPC)     (15)
//   4. Renda elegível                    (15)
//   5. Imóvel elegível                   (10)
//   6. Histórico financeiro / Open Fin.  (10)
//
// Cada bloco é exposto separadamente no GET /leads/:id/score como um fator
// com o nome, peso máximo e pontuação obtida — assim a UI consegue mostrar
// "Comprometimento: 25/30" etc.

export interface ScoreBlock {
  key:
    | "comprometimento"
    | "entrada_fgts"
    | "score_credito"
    | "renda_elegivel"
    | "imovel"
    | "historico";
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface ScoreBreakdown {
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation: string;
  blocks: ScoreBlock[];
}

/** Estima a parcela mensal alvo do financiamento (Tabela Price aproximada,
 *  360 meses, 10,49% a.a. + TR). Usado para calcular comprometimento e
 *  renda mínima necessária. */
function estimateMonthlyInstallment(financedAmount: number): number {
  if (financedAmount <= 0) return 0;
  const monthlyRate = (1 + 0.1049) ** (1 / 12) - 1 + 0.0162 / 12;
  const n = 360;
  return (financedAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -n);
}

function computeScore(input: ScoreInput): ScoreBreakdown {
  const {
    income,
    propertyValue,
    informalIncome = 0,
    spouseIncome = 0,
    hasFgts = false,
    fgtsBalance = 0,
    propertyType,
    propertyCity,
    propertyState,
  } = input;

  const {
    serasaScore,
    hasNegativations,
    hasProtests,
    siricStatus,
    caixaScoreReal,
    vehicleLoanMonthly,
    creditCardUsage,
    otherLoansMonthly,
    bcbMonthlyCommitment,
    openFinanceConnected,
    openFinanceAvgBalance,
    openFinanceRecurringIncome,
    openFinanceCardUsage,
    openFinanceNoLatePayments,
    openFinanceCpfClear,
  } = input;

  // ── Renda comprovada (formal + 70% informal + cônjuge) ─────────────────
  const rendaComprovada =
    income + (informalIncome ?? 0) * 0.7 + (spouseIncome ?? 0);

  // Assumimos 80% LTV padrão Caixa. O componente de entrada é o que sobra.
  const entradaEstimadaCash = Math.max(0, propertyValue * 0.2);
  const valorFinanciado = Math.max(0, propertyValue - entradaEstimadaCash);
  const parcelaAlvo = estimateMonthlyInstallment(valorFinanciado);
  const rendaNecessaria = parcelaAlvo / 0.3; // teto Caixa: parcela ≤ 30% da renda
  const monthlyDebt =
    (vehicleLoanMonthly ?? 0) +
    (otherLoansMonthly ?? 0) +
    (bcbMonthlyCommitment ?? 0);
  const margemDisponivel = Math.max(0, rendaComprovada * 0.3 - monthlyDebt);
  const indiceComprometimento =
    margemDisponivel > 0 ? parcelaAlvo / margemDisponivel : 999;

  // ── 1. Comprometimento de renda (até 30 pts) ───────────────────────────
  let comprometimentoScore = 0;
  if (indiceComprometimento <= 0.8) comprometimentoScore = 30;
  else if (indiceComprometimento <= 0.9) comprometimentoScore = 25;
  else if (indiceComprometimento <= 1.0) comprometimentoScore = 18;
  else if (indiceComprometimento <= 1.1) comprometimentoScore = 8;
  else comprometimentoScore = 0;

  // ── 2. Entrada + FGTS + subsídio (até 20 pts) ──────────────────────────
  const entradaTotal =
    entradaEstimadaCash + (hasFgts ? fgtsBalance ?? 0 : 0);
  const entradaPercentual =
    propertyValue > 0 ? entradaTotal / propertyValue : 0;
  let entradaScore = 0;
  if (entradaPercentual >= 0.3) entradaScore = 20;
  else if (entradaPercentual >= 0.2) entradaScore = 16;
  else if (entradaPercentual >= 0.15) entradaScore = 10;
  else if (entradaPercentual >= 0.1) entradaScore = 6;

  // ── 3. Score de crédito (até 15 pts) ───────────────────────────────────
  let creditoScore = 8; // neutro quando não há Serasa
  if (serasaScore != null) {
    if (serasaScore >= 750) creditoScore = 15;
    else if (serasaScore >= 650) creditoScore = 12;
    else if (serasaScore >= 550) creditoScore = 8;
    else if (serasaScore >= 450) creditoScore = 4;
    else creditoScore = 0;
  }

  // ── 4. Renda elegível (até 15 pts) ─────────────────────────────────────
  const razaoRenda =
    rendaNecessaria > 0 ? rendaComprovada / rendaNecessaria : 0;
  let rendaScore = 0;
  if (razaoRenda >= 1.2) rendaScore = 15;
  else if (razaoRenda >= 1.0) rendaScore = 12;
  else if (razaoRenda >= 0.9) rendaScore = 7;
  else rendaScore = 0;

  // ── 5. Imóvel elegível (até 10 pts) ────────────────────────────────────
  let imovelScore = 0;
  const isMcmv = rendaComprovada <= 8000 && propertyValue <= 350_000;
  const valorDentroTeto = propertyValue <= 1_500_000 || isMcmv;
  if (propertyType) imovelScore += 4; // tipo definido = regularizado
  if (valorDentroTeto) imovelScore += 3;
  if (propertyCity && propertyState) imovelScore += 2;
  if (propertyType && propertyType !== "terreno") imovelScore += 1;
  imovelScore = Math.min(10, imovelScore);

  // ── 6. Histórico financeiro / Open Finance (até 10 pts) ────────────────
  let historicoScore = 0;
  if (openFinanceConnected) {
    if (openFinanceNoLatePayments) historicoScore += 3;
    if ((openFinanceAvgBalance ?? 0) > 500) historicoScore += 2;
    if ((openFinanceRecurringIncome ?? 0) > 0) historicoScore += 2;
    if ((openFinanceCardUsage ?? 100) < 50) historicoScore += 2;
    if (openFinanceCpfClear) historicoScore += 1;
  } else {
    // Sem Open Finance: usa sinais existentes como proxy parcial.
    if (!hasNegativations) historicoScore += 3;
    if (!hasProtests) historicoScore += 2;
    if ((creditCardUsage ?? 100) < 50) historicoScore += 2;
    if (siricStatus === "regular") historicoScore += 1;
    if (serasaScore != null && serasaScore >= 600) historicoScore += 1;
  }
  historicoScore = Math.min(10, historicoScore);

  const approvalChance = Math.round(
    comprometimentoScore +
      entradaScore +
      creditoScore +
      rendaScore +
      imovelScore +
      historicoScore,
  );

  // Score Caixa (0–1000): usa real se disponível, senão deriva.
  const scoreCaixa =
    caixaScoreReal != null
      ? Math.min(1000, Math.max(0, caixaScoreReal))
      : Math.min(1000, Math.round(300 + (approvalChance / 100) * 600));

  const scoreMCMV = isMcmv
    ? Math.min(1000, 550 + Math.round(approvalChance * 3))
    : Math.min(500, 250 + Math.round(approvalChance * 1.5));

  // ── Recomendação ─────────────────────────────────────────────────────
  let classificacao = "";
  if (approvalChance >= 90) classificacao = "Muito alta chance de aprovação";
  else if (approvalChance >= 75) classificacao = "Alta chance de aprovação";
  else if (approvalChance >= 60) classificacao = "Boa chance de aprovação";
  else if (approvalChance >= 40) classificacao = "Chance moderada";
  else classificacao = "Baixa chance no momento";

  const fraquezas: string[] = [];
  if (comprometimentoScore < 18) fraquezas.push("reduzir parcelas ativas ou o valor financiado");
  if (entradaScore < 10) fraquezas.push("aumentar a entrada (incluindo FGTS)");
  if (creditoScore < 8) fraquezas.push("subir o score Serasa antes de pedir o crédito");
  if (rendaScore < 7) fraquezas.push("aumentar a renda comprovada (cônjuge, informal)");
  if (historicoScore < 5 && !openFinanceConnected)
    fraquezas.push("conectar o Open Finance para mostrar histórico positivo");

  const recommendation = fraquezas.length
    ? `${classificacao}. Para melhorar: ${fraquezas.join("; ")}.`
    : `${classificacao}. Perfil pronto para avançar com a Caixa.`;

  const blocks: ScoreBlock[] = [
    {
      key: "comprometimento",
      label: "Comprometimento de renda",
      weight: 30,
      score: comprometimentoScore,
      detail:
        indiceComprometimento === 999
          ? "Margem de 30% comprometida com parcelas atuais"
          : `Parcela estimada usa ${(indiceComprometimento * 100).toFixed(0)}% da margem de 30% da renda`,
    },
    {
      key: "entrada_fgts",
      label: "Entrada + FGTS",
      weight: 20,
      score: entradaScore,
      detail: `Estimativa: entrada mínima de 20% + FGTS = ${(entradaPercentual * 100).toFixed(0)}% do imóvel`,
    },
    {
      key: "score_credito",
      label: "Score Serasa/SPC",
      weight: 15,
      score: creditoScore,
      detail:
        serasaScore != null
          ? `Score atual: ${serasaScore}`
          : "Score Serasa não informado",
    },
    {
      key: "renda_elegivel",
      label: "Renda familiar compatível",
      weight: 15,
      score: rendaScore,
      detail: `Renda comprovada R$ ${Math.round(rendaComprovada).toLocaleString("pt-BR")} vs necessária R$ ${Math.round(rendaNecessaria).toLocaleString("pt-BR")}`,
    },
    {
      key: "imovel",
      label: "Imóvel dentro das regras",
      weight: 10,
      score: imovelScore,
      detail: isMcmv
        ? "Elegível ao Minha Casa Minha Vida"
        : valorDentroTeto
          ? "Imóvel dentro do teto SBPE"
          : "Valor do imóvel acima do teto SBPE",
    },
    {
      key: "historico",
      label: openFinanceConnected
        ? "Histórico via Open Finance"
        : "Histórico financeiro",
      weight: 10,
      score: historicoScore,
      detail: openFinanceConnected
        ? "Dados bancários conectados via Open Finance"
        : "Conecte o Open Finance para ganhar mais pontos neste bloco",
    },
  ];

  return {
    approvalChance: Math.max(0, Math.min(100, approvalChance)),
    scoreCaixa,
    scoreMCMV,
    aiRecommendation: recommendation,
    blocks,
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

  const { blocks: _initBlocks, ...scores } = computeScore(parsed.data);

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
    const breakdown = computeScore({
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
      propertyCity: existing.propertyCity,
      propertyState: existing.propertyState,
      birthDate: existing.birthDate,
      serasaScore: existing.serasaScore,
      hasNegativations: existing.hasNegativations,
      hasProtests: existing.hasProtests,
      siricStatus: existing.siricStatus,
      caixaScoreReal: existing.caixaScoreReal,
      vehicleLoanMonthly: existing.vehicleLoanMonthly,
      creditCardUsage: existing.creditCardUsage,
      otherLoansMonthly: existing.otherLoansMonthly,
      bcbMonthlyCommitment: existing.bcbMonthlyCommitment,
      openFinanceConnected: existing.openFinanceConnected,
      openFinanceAvgBalance: existing.openFinanceAvgBalance,
      openFinanceRecurringIncome: existing.openFinanceRecurringIncome,
      openFinanceCardUsage: existing.openFinanceCardUsage,
      openFinanceNoLatePayments: existing.openFinanceNoLatePayments,
      openFinanceCpfClear: existing.openFinanceCpfClear,
    });
    const { blocks: _b, ...scoreFields } = breakdown;
    Object.assign(updateData, scoreFields);
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

  const breakdown = computeScore({
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
    propertyCity: existing.propertyCity,
    propertyState: existing.propertyState,
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
    bcbMonthlyCommitment: existing.bcbMonthlyCommitment,
    openFinanceConnected: existing.openFinanceConnected,
    openFinanceAvgBalance: existing.openFinanceAvgBalance,
    openFinanceRecurringIncome: existing.openFinanceRecurringIncome,
    openFinanceCardUsage: existing.openFinanceCardUsage,
    openFinanceNoLatePayments: existing.openFinanceNoLatePayments,
    openFinanceCpfClear: existing.openFinanceCpfClear,
  });
  const { blocks: _enrichBlocks, ...scores } = breakdown;

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

  // Recalcula os 6 blocos a partir dos dados atuais do lead para retornar
  // o detalhamento ao cliente (UI mostra "Comprometimento: 25/30" etc).
  const breakdown = computeScore({
    income: lead.income,
    propertyValue: lead.propertyValue,
    informalIncome: lead.informalIncome,
    spouseIncome: lead.spouseIncome,
    hasFgts: lead.hasFgts,
    fgtsBalance: lead.fgtsBalance,
    employmentType: lead.employmentType,
    employmentMonths: lead.employmentMonths,
    maritalStatus: lead.maritalStatus,
    propertyType: lead.propertyType,
    propertyCity: lead.propertyCity,
    propertyState: lead.propertyState,
    birthDate: lead.birthDate,
    serasaScore: lead.serasaScore,
    hasNegativations: lead.hasNegativations,
    hasProtests: lead.hasProtests,
    siricStatus: lead.siricStatus,
    fgtsMonths: lead.fgtsMonths,
    caixaScoreReal: lead.caixaScoreReal,
    vehicleLoanMonthly: lead.vehicleLoanMonthly,
    creditCardUsage: lead.creditCardUsage,
    otherLoansMonthly: lead.otherLoansMonthly,
    bcbMonthlyCommitment: lead.bcbMonthlyCommitment,
    openFinanceConnected: lead.openFinanceConnected,
    openFinanceAvgBalance: lead.openFinanceAvgBalance,
    openFinanceRecurringIncome: lead.openFinanceRecurringIncome,
    openFinanceCardUsage: lead.openFinanceCardUsage,
    openFinanceNoLatePayments: lead.openFinanceNoLatePayments,
    openFinanceCpfClear: lead.openFinanceCpfClear,
  });

  // Mapeia cada bloco da fórmula para a estrutura de "factor" que a UI consome.
  const factors = breakdown.blocks.map((b) => {
    const pct = b.score / b.weight;
    const impact = pct >= 0.7 ? "positive" : pct >= 0.4 ? "neutral" : "negative";
    return {
      name: b.label,
      impact,
      description: b.detail,
      value: `${b.score}/${b.weight} pts`,
    };
  });

  const eligibleBanks = [];
  if (breakdown.scoreCaixa >= 600) eligibleBanks.push("Caixa Econômica Federal");
  if (breakdown.scoreCaixa >= 650) eligibleBanks.push("Banco do Brasil");
  if (breakdown.scoreCaixa >= 700) eligibleBanks.push("Bradesco");
  if (breakdown.scoreCaixa >= 720) eligibleBanks.push("Itaú Unibanco");
  if (breakdown.scoreCaixa >= 680) eligibleBanks.push("Santander");

  res.json({
    leadId: lead.id,
    overallScore: breakdown.scoreCaixa,
    approvalChance: breakdown.approvalChance,
    scoreCaixa: breakdown.scoreCaixa,
    scoreMCMV: breakdown.scoreMCMV,
    factors,
    blocks: breakdown.blocks,
    recommendation: breakdown.aiRecommendation,
    eligibleBanks,
  });
});

export default router;
