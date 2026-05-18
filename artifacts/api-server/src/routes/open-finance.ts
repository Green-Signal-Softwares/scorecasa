import { Router } from "express";
import { db, usersTable, leadsTable, clientPaymentsTable, subscriptionsTable } from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";

// Planos do cliente que liberam Open Finance automático (snapshot sintético).
// Free preenche manualmente — só os planos pagos têm a coleta automatizada.
const AUTO_OPEN_FINANCE_PLANS = new Set(["individual", "plus"]);

async function getClientPlanId(userId: number): Promise<string> {
  const [sub] = await db
    .select({ plan: subscriptionsTable.plan })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return sub?.plan ?? "free";
}

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

  const planId = await getClientPlanId(userId);
  const autoEligible = AUTO_OPEN_FINANCE_PLANS.has(planId);
  const rawMode = req.body?.mode;
  let requestedMode: "auto" | "manual";
  if (rawMode === undefined || rawMode === null) {
    requestedMode = autoEligible ? "auto" : "manual";
  } else if (rawMode === "auto" || rawMode === "manual") {
    requestedMode = rawMode;
  } else {
    res.status(400).json({ error: "mode inválido. Use 'auto' ou 'manual'." });
    return;
  }

  // Free → bloqueia auto e exige manual. Pagos → aceitam auto (default) ou manual se quiserem editar.
  if (requestedMode === "auto" && !autoEligible) {
    res.status(403).json({
      error: "Open Finance automático está disponível apenas nos planos Individual e Plus. No plano Free, preencha seus dados manualmente.",
      requiresUpgrade: true,
    });
    return;
  }

  let bank: string;
  let avgBalance: number;
  let recurringIncome: number;
  let cardUsage: number;
  let noLatePayments: boolean;
  let cpfClear: boolean;
  let source: "auto" | "manual";

  if (requestedMode === "manual") {
    // Plano Free preenche tudo na mão. Validamos os 5 indicadores.
    const b = req.body ?? {};
    const num = (v: any, min: number, max: number): number | null => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) return null;
      return n;
    };
    const _avg = num(b.avgBalance, 0, 10_000_000);
    const _inc = num(b.recurringIncome, 0, 10_000_000);
    const _card = num(b.cardUsage, 0, 100);
    if (_avg == null || _inc == null || _card == null || typeof b.noLatePayments !== "boolean" || typeof b.cpfClear !== "boolean") {
      res.status(400).json({
        error: "Preencha todos os campos: saldo médio, renda recorrente, uso do cartão (%), pontualidade e CPF.",
        fields: ["avgBalance", "recurringIncome", "cardUsage", "noLatePayments", "cpfClear"],
      });
      return;
    }
    bank = typeof b.bank === "string" && b.bank.trim() ? b.bank.trim().slice(0, 80) : "Preenchido manualmente";
    avgBalance = Math.round(_avg);
    recurringIncome = Math.round(_inc);
    cardUsage = Math.round(_card);
    noLatePayments = b.noLatePayments;
    cpfClear = b.cpfClear;
    source = "manual";
  } else {
    const bankFromBody = typeof req.body?.bank === "string" ? req.body.bank.trim() : "";
    bank = SIMULATED_BANKS.includes(bankFromBody)
      ? bankFromBody
      : SIMULATED_BANKS[Math.floor(Math.random() * SIMULATED_BANKS.length)];

    // Snapshot derivado da renda informada — mantém o cenário plausível.
    const baseIncome = lead.income || 3000;
    avgBalance = Math.round(baseIncome * (0.4 + Math.random() * 0.6));
    recurringIncome = Math.round(baseIncome * (0.85 + Math.random() * 0.2));
    cardUsage = Math.round(15 + Math.random() * 55); // 15-70%
    noLatePayments = Math.random() > 0.18;
    cpfClear = Math.random() > 0.1;
    source = "auto";
  }

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
      openFinanceSource: source,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, lead.id))
    .returning();

  // No modo automático sincronizamos a aba "Pagamentos" com o snapshot do banco.
  // No modo manual mantemos os pagamentos como o cliente já cadastrou.
  if (source === "auto") {
    await syncPaymentsFromOpenFinance(lead.id, {
      income: lead.income || 3000,
      cardUsagePct: cardUsage,
      noLatePayments,
    });
  }

  res.json({
    connected: true,
    connectedAt: updated.openFinanceConnectedAt?.toISOString() ?? null,
    bank: updated.openFinanceBank,
    avgBalance: updated.openFinanceAvgBalance,
    recurringIncome: updated.openFinanceRecurringIncome,
    cardUsage: updated.openFinanceCardUsage,
    noLatePayments: updated.openFinanceNoLatePayments,
    cpfClear: updated.openFinanceCpfClear,
    source: updated.openFinanceSource,
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
  const planId = await getClientPlanId(userId);
  const autoEligible = AUTO_OPEN_FINANCE_PLANS.has(planId);
  res.json({
    connected: !!lead.openFinanceConnected,
    connectedAt: lead.openFinanceConnectedAt?.toISOString() ?? null,
    bank: lead.openFinanceBank,
    avgBalance: lead.openFinanceAvgBalance,
    recurringIncome: lead.openFinanceRecurringIncome,
    cardUsage: lead.openFinanceCardUsage,
    noLatePayments: lead.openFinanceNoLatePayments,
    cpfClear: lead.openFinanceCpfClear,
    source: lead.openFinanceSource,
    availableBanks: SIMULATED_BANKS,
    mode: autoEligible ? "auto" : "manual",
    plan: planId,
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
      openFinanceSource: null,
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
