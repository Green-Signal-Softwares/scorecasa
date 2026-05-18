import { Router } from "express";
import { db, usersTable, leadsTable, clientPaymentsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

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

  // Sincroniza a aba "Pagamentos" com os dados do Open Finance:
  // - Recalcula a fatura do cartão proporcional ao uso real (cardUsage %)
  // - Se o cliente estiver "em dia" segundo OF, move pagamentos atrasados
  //   recorrentes para a próxima janela (simula que já foram quitados na origem).
  // - Marca todos os pagamentos como source='open_finance' + syncedAt=now.
  await syncPaymentsFromOpenFinance(lead.id, {
    income: baseIncome,
    cardUsagePct: cardUsage,
    noLatePayments,
  });

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

  // Pagamentos voltam a ser marcados como origem manual (mantém os registros
  // para não perder o histórico de quitação que o cliente já marcou).
  await db
    .update(clientPaymentsTable)
    .set({ source: "manual", syncedAt: null, updatedAt: new Date() })
    .where(eq(clientPaymentsTable.leadId, user.leadId));

  res.json({ connected: false });
});

/**
 * Sincroniza a aba "Pagamentos" a partir do snapshot Open Finance.
 * Atualiza apenas pagamentos NÃO pagos para não sobrescrever o histórico
 * que o cliente já marcou como quitado.
 */
async function syncPaymentsFromOpenFinance(
  leadId: number,
  of: { income: number; cardUsagePct: number; noLatePayments: boolean },
): Promise<void> {
  // Recalcula fatura(s) de cartão com base no uso real reportado pelo OF.
  // cardUsage = 15-70%. Convertemos para um valor de fatura proporcional à renda.
  const incomeCents = Math.round((of.income || 3000) * 100);
  const monthlyCardCents = Math.round(incomeCents * (of.cardUsagePct / 100));

  // Buscar todos os cartões não pagos do lead.
  const cards = await db
    .select()
    .from(clientPaymentsTable)
    .where(
      and(
        eq(clientPaymentsTable.leadId, leadId),
        eq(clientPaymentsTable.category, "cartao"),
        isNull(clientPaymentsTable.paidAt),
      ),
    );

  if (cards.length > 0) {
    // Distribui o uso total entre as faturas existentes preservando a proporção
    // original (mantém o "peso" relativo entre cartões diferentes).
    const totalOriginal = cards.reduce((a, c) => a + c.amountCents, 0) || 1;
    for (const c of cards) {
      const share = c.amountCents / totalOriginal;
      const newAmount = Math.max(1000, Math.round(monthlyCardCents * share));
      await db
        .update(clientPaymentsTable)
        .set({ amountCents: newAmount, updatedAt: new Date() })
        .where(eq(clientPaymentsTable.id, c.id));
    }
  }

  // Se OF reporta histórico em dia, joga atrasos recorrentes para o próximo
  // ciclo (assume que o banco já regularizou — pagamento existe mas não está
  // mais "no vermelho" do ponto de vista do cliente).
  if (of.noLatePayments) {
    const now = new Date();
    const overdue = await db
      .select()
      .from(clientPaymentsTable)
      .where(
        and(
          eq(clientPaymentsTable.leadId, leadId),
          eq(clientPaymentsTable.recurring, true),
          isNull(clientPaymentsTable.paidAt),
        ),
      );
    for (const p of overdue) {
      if (p.dueDate.getTime() < now.getTime()) {
        const next = new Date(p.dueDate);
        // Empurra 30 dias.
        next.setDate(next.getDate() + 30);
        await db
          .update(clientPaymentsTable)
          .set({ dueDate: next, updatedAt: new Date() })
          .where(eq(clientPaymentsTable.id, p.id));
      }
    }
  }

  // Marca todos como sincronizados via OF.
  await db
    .update(clientPaymentsTable)
    .set({ source: "open_finance", syncedAt: new Date(), updatedAt: new Date() })
    .where(eq(clientPaymentsTable.leadId, leadId));
}

export default router;
