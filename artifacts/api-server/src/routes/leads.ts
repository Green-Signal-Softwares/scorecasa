import { Router } from "express";
import { db, leadsTable, brokersTable } from "@workspace/db";
import { eq, sql, ilike, or, and, desc } from "drizzle-orm";
import {
  CreateLeadBody,
  UpdateLeadBody,
  GetLeadsQueryParams,
  GetLeadParams,
  UpdateLeadParams,
  DeleteLeadParams,
  GetLeadScoreParams,
} from "@workspace/api-zod";

const router = Router();

function computeScore(income: number, propertyValue: number): {
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation: string;
} {
  const ratio = propertyValue / (income * 12);
  const maxRatio = 4.5;
  const baseChance = Math.max(0, Math.min(100, 100 - (ratio / maxRatio) * 60));
  const approvalChance = Math.round(baseChance + (Math.random() * 20 - 10));
  const scoreCaixa = Math.round(300 + (approvalChance / 100) * 550 + (Math.random() * 80 - 40));
  const scoreMCMV = income <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);

  const clampedChance = Math.max(0, Math.min(100, approvalChance));
  let recommendation = "";
  if (clampedChance >= 75) {
    recommendation = "Perfil com alta chance de aprovação. Recomendamos avançar com o processo imediatamente.";
  } else if (clampedChance >= 50) {
    recommendation = "Perfil com chances moderadas. Ajustando o comprometimento de renda, a aprovação pode ser garantida.";
  } else if (clampedChance >= 30) {
    recommendation = "Perfil em análise. Sugerimos aumentar a renda comprovada ou reduzir o valor do imóvel.";
  } else {
    recommendation = "Perfil com baixa chance no momento. Recomendamos trabalhar o score Caixa por pelo menos 3 meses antes de nova tentativa.";
  }

  return {
    approvalChance: clampedChance,
    scoreCaixa: Math.min(1000, Math.max(300, scoreCaixa)),
    scoreMCMV: Math.min(1000, Math.max(0, scoreMCMV)),
    aiRecommendation: recommendation,
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

  const data = leads.map((l) => ({
    ...l,
    brokerName: l.brokerId ? (brokerMap[l.brokerId] ?? null) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  res.json({ data, total: countResult[0]?.count ?? 0, page, limit });
});

router.post("/", async (req, res) => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const scores = computeScore(parsed.data.income, parsed.data.propertyValue);

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

  res.json({
    ...lead,
    brokerName,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
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
    const scores = computeScore(
      bodyParsed.data.income ?? existing.income,
      bodyParsed.data.propertyValue ?? existing.propertyValue,
    );
    Object.assign(updateData, scores);
  }

  if (bodyParsed.data.status === "approved" && existing.status !== "approved" && existing.brokerId) {
    await db
      .update(brokersTable)
      .set({ approvedLeads: sql`${brokersTable.approvedLeads} + 1` })
      .where(eq(brokersTable.id, existing.brokerId));
  }

  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, paramsParsed.data.id)).returning();

  let brokerName: string | null = null;
  if (updated.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, updated.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json({
    ...updated,
    brokerName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const parsed = DeleteLeadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  res.status(204).send();
});

router.get("/:id/score", async (req, res) => {
  const parsed = GetLeadScoreParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
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
