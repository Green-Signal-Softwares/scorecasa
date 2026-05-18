import { Router } from "express";
import { db, usersTable, leadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireClient(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const SIMULATED_BANKS = [
  "Itaú Unibanco",
  "Banco do Brasil",
  "Bradesco",
  "Santander",
  "Caixa Econômica Federal",
  "Nubank",
  "Inter",
];

/**
 * POST /api/client/open-finance/connect
 *
 * Fluxo simulado de Open Finance: o cliente "consente" e a plataforma
 * gera um snapshot realista (saldo médio, renda recorrente, uso de cartão,
 * pontualidade, CPF). Esses campos passam a alimentar o bloco "Histórico
 * financeiro" do Índice de Aprovação automaticamente.
 *
 * Estrutura pronta para ser trocada por integração real (Pluggy/Belvo/BTG)
 * sem mexer na UI ou no cálculo de score.
 */
const connectHandler = async (req: any, res: any) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes podem conectar Open Finance." });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }

  const bankFromBody = typeof req.body?.bank === "string" ? req.body.bank.trim() : "";
  const bank = SIMULATED_BANKS.includes(bankFromBody)
    ? bankFromBody
    : SIMULATED_BANKS[Math.floor(Math.random() * SIMULATED_BANKS.length)];

  // Snapshot derivado da renda informada — mantém o cenário plausível.
  const baseIncome = lead.income || 3000;
  const avgBalance = Math.round(baseIncome * (0.4 + Math.random() * 0.6));
  const recurringIncome = Math.round(baseIncome * (0.85 + Math.random() * 0.2));
  const cardUsage = Math.round(15 + Math.random() * 55); // 15-70%
  // Probabilidade alta de bons indicadores (Open Finance puxa dados reais
  // do banco, então a maior parte dos usuários conectando estará em dia).
  const noLatePayments = Math.random() > 0.18;
  const cpfClear = Math.random() > 0.1;

  const [updated] = await db
    .update(leadsTable)
    .set({
      openFinanceConnected: true,
      openFinanceConnectedAt: new Date(),
      openFinanceBank: bank,
      openFinanceAvgBalance: avgBalance,
      openFinanceRecurringIncome: recurringIncome,
      openFinanceCardUsage: cardUsage,
      openFinanceNoLatePayments: noLatePayments,
      openFinanceCpfClear: cpfClear,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, lead.id))
    .returning();

  res.json({
    connected: true,
    connectedAt: updated.openFinanceConnectedAt?.toISOString() ?? null,
    bank: updated.openFinanceBank,
    avgBalance: updated.openFinanceAvgBalance,
    recurringIncome: updated.openFinanceRecurringIncome,
    cardUsage: updated.openFinanceCardUsage,
    noLatePayments: updated.openFinanceNoLatePayments,
    cpfClear: updated.openFinanceCpfClear,
  });
};

// Aceita tanto POST / quanto POST /connect (o frontend usa /connect; a
// rota raiz casa com o contrato REST POST /api/client/open-finance).
router.post("/", requireClient, connectHandler);
router.post("/connect", requireClient, connectHandler);

/** Lê o estado atual da conexão Open Finance. */
router.get("/", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }
  res.json({
    connected: !!lead.openFinanceConnected,
    connectedAt: lead.openFinanceConnectedAt?.toISOString() ?? null,
    bank: lead.openFinanceBank,
    avgBalance: lead.openFinanceAvgBalance,
    recurringIncome: lead.openFinanceRecurringIncome,
    cardUsage: lead.openFinanceCardUsage,
    noLatePayments: lead.openFinanceNoLatePayments,
    cpfClear: lead.openFinanceCpfClear,
    availableBanks: SIMULATED_BANKS,
  });
});

/** Desconecta o Open Finance e zera os campos. */
router.delete("/", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  await db
    .update(leadsTable)
    .set({
      openFinanceConnected: false,
      openFinanceConnectedAt: null,
      openFinanceBank: null,
      openFinanceAvgBalance: null,
      openFinanceRecurringIncome: null,
      openFinanceCardUsage: null,
      openFinanceNoLatePayments: null,
      openFinanceCpfClear: null,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, user.leadId));
  res.json({ connected: false });
});

export default router;
