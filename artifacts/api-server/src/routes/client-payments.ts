import { Router } from "express";
import { db, usersTable, leadsTable, clientPaymentsTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";

const router = Router();

function requireClient(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Seed determinístico de pagamentos ────────────────────────────────────────
// Gera 8 obrigações típicas a partir do CPF/leadId. Datas distribuídas no
// mês atual e no próximo. Quando Open Finance estiver plugado, esta função
// é substituída por sync real das contas conectadas.
interface PaymentSeed {
  category: "cartao" | "financiamento" | "conta" | "boleto" | "emprestimo" | "assinatura";
  description: string;
  issuer: string;
  amountCents: number;
  dueDayOffset: number; // dias a partir de hoje
  recurring: boolean;
}

function makeSeed(leadId: number, monthlyIncomeCents: number): PaymentSeed[] {
  const seed = leadId * 31;
  const r = (n: number) => Math.abs((seed + n * 7) % 100);
  // Valores proporcionais à renda, com tetos sensatos para parecer real.
  const income = Math.max(150000, monthlyIncomeCents || 300000); // mín R$ 1.500
  const card = Math.round(income * 0.18) + r(1) * 1000;
  const rent = Math.round(income * 0.22);
  const energy = 8500 + r(2) * 200;
  const internet = 9990;
  const phone = 5990;
  const stream = 3990;
  const insurance = 12000 + r(3) * 300;
  const loan = Math.round(income * 0.08);

  return [
    { category: "cartao",       description: "Fatura Cartão Nubank",         issuer: "Nubank",         amountCents: card,      dueDayOffset: 3,  recurring: true },
    { category: "cartao",       description: "Fatura Cartão Itaú",           issuer: "Itaú",           amountCents: Math.round(card * 0.6), dueDayOffset: 11, recurring: true },
    { category: "financiamento",description: "Parcela financiamento imóvel", issuer: "Caixa",          amountCents: rent,      dueDayOffset: 7,  recurring: true },
    { category: "conta",        description: "Conta de energia",             issuer: "Enel",           amountCents: energy,    dueDayOffset: 1,  recurring: true },
    { category: "conta",        description: "Internet residencial",         issuer: "Vivo Fibra",     amountCents: internet,  dueDayOffset: 5,  recurring: true },
    { category: "conta",        description: "Telefone móvel",               issuer: "Claro",          amountCents: phone,     dueDayOffset: 15, recurring: true },
    { category: "assinatura",   description: "Streaming + apps",             issuer: "Diversos",      amountCents: stream,    dueDayOffset: 20, recurring: true },
    { category: "boleto",       description: "Seguro residencial",           issuer: "Porto Seguro",  amountCents: insurance, dueDayOffset: 25, recurring: false },
    { category: "emprestimo",   description: "Empréstimo pessoal",           issuer: "Banco do Brasil", amountCents: loan,    dueDayOffset: 18, recurring: true },
  ];
}

async function ensureSeeded(leadId: number, monthlyIncomeCents: number) {
  const existing = await db
    .select({ id: clientPaymentsTable.id })
    .from(clientPaymentsTable)
    .where(eq(clientPaymentsTable.leadId, leadId))
    .limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const rows = makeSeed(leadId, monthlyIncomeCents).map((s) => {
    const due = new Date(now);
    due.setDate(due.getDate() + s.dueDayOffset);
    due.setHours(12, 0, 0, 0);
    return {
      leadId,
      category: s.category,
      description: s.description,
      issuer: s.issuer,
      amountCents: s.amountCents,
      dueDate: due,
      recurring: s.recurring,
    };
  });
  await db.insert(clientPaymentsTable).values(rows);
}

function classifyUrgency(dueDate: Date, paidAt: Date | null): {
  bucket: "atrasado" | "hoje" | "semana" | "proximos" | "pago";
  daysToDue: number;
} {
  if (paidAt) return { bucket: "pago", daysToDue: 0 };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { bucket: "atrasado", daysToDue: diff };
  if (diff === 0) return { bucket: "hoje", daysToDue: 0 };
  if (diff <= 7) return { bucket: "semana", daysToDue: diff };
  return { bucket: "proximos", daysToDue: diff };
}

// ── GET /api/client/payments ─────────────────────────────────────────────────
router.get("/", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes podem acessar pagamentos." });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }

  const monthlyIncomeCents = Math.round((Number(lead.income) || 3000) * 100);
  await ensureSeeded(lead.id, monthlyIncomeCents);

  const rows = await db
    .select()
    .from(clientPaymentsTable)
    .where(eq(clientPaymentsTable.leadId, lead.id))
    .orderBy(asc(clientPaymentsTable.dueDate));

  const items = rows.map((r) => {
    const urg = classifyUrgency(r.dueDate, r.paidAt);
    return {
      id: r.id,
      category: r.category,
      description: r.description,
      issuer: r.issuer,
      amountCents: r.amountCents,
      dueDate: r.dueDate.toISOString(),
      recurring: r.recurring,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      paidAmountCents: r.paidAmountCents,
      bucket: urg.bucket,
      daysToDue: urg.daysToDue,
    };
  });

  // Resumo
  const next7 = items.filter((i) => !i.paidAt && i.daysToDue >= 0 && i.daysToDue <= 7);
  const overdue = items.filter((i) => i.bucket === "atrasado");
  const monthTotal = items
    .filter((i) => !i.paidAt && new Date(i.dueDate).getMonth() === new Date().getMonth())
    .reduce((a, b) => a + b.amountCents, 0);
  const paidThisMonth = items
    .filter((i) => i.paidAt && new Date(i.paidAt).getMonth() === new Date().getMonth())
    .reduce((a, b) => a + (b.paidAmountCents ?? b.amountCents), 0);

  res.json({
    summary: {
      next7Count: next7.length,
      next7TotalCents: next7.reduce((a, b) => a + b.amountCents, 0),
      overdueCount: overdue.length,
      overdueTotalCents: overdue.reduce((a, b) => a + b.amountCents, 0),
      monthOpenTotalCents: monthTotal,
      monthPaidTotalCents: paidThisMonth,
      scoreImpactNote:
        overdue.length > 0
          ? `Você tem ${overdue.length} pagamento(s) em atraso. Cada atraso acima de 5 dias pode reduzir até 30 pontos no seu ScoreCasa.`
          : next7.length > 0
            ? `Mantenha esses ${next7.length} pagamento(s) em dia — pagamentos pontuais somam até 40 pontos no seu ScoreCasa por trimestre.`
            : "Sem pagamentos urgentes. Seu ScoreCasa agradece!",
    },
    items,
  });
});

// ── POST /api/client/payments/:id/pay ────────────────────────────────────────
router.post("/:id/pay", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes podem marcar pagamentos." });
    return;
  }
  const [payment] = await db
    .select()
    .from(clientPaymentsTable)
    .where(and(eq(clientPaymentsTable.id, id), eq(clientPaymentsTable.leadId, user.leadId)))
    .limit(1);
  if (!payment) {
    res.status(404).json({ error: "Pagamento não encontrado." });
    return;
  }
  const paidAmountCents = typeof req.body?.paidAmountCents === "number" ? req.body.paidAmountCents : payment.amountCents;
  await db
    .update(clientPaymentsTable)
    .set({ paidAt: new Date(), paidAmountCents, updatedAt: new Date() })
    .where(eq(clientPaymentsTable.id, id));
  res.json({ ok: true });
});

// ── POST /api/client/payments/:id/unpay ──────────────────────────────────────
router.post("/:id/unpay", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db
    .update(clientPaymentsTable)
    .set({ paidAt: null, paidAmountCents: null, updatedAt: new Date() })
    .where(and(eq(clientPaymentsTable.id, id), eq(clientPaymentsTable.leadId, user.leadId)));
  res.json({ ok: true });
});

export default router;
