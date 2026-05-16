import { pgTable, serial, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";

// Contas a pagar do cliente. Geradas inicialmente a partir do perfil/CPF
// (lista sintética determinística por enquanto; futuro: Open Finance / SCR
// puxa as obrigações reais). O cliente pode marcar como pago — isso só
// atualiza paidAt/paidAmount, sem alterar o restante.
export const clientPaymentsTable = pgTable(
  "client_payments",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    // Categoria: cartao | financiamento | conta | boleto | emprestimo | assinatura
    category: text("category").notNull(),
    description: text("description").notNull(),
    // Origem/instituição que emitiu o pagamento (Nubank, Caixa, Enel, etc).
    issuer: text("issuer"),
    // Valor em centavos para evitar problemas de float.
    amountCents: integer("amount_cents").notNull(),
    dueDate: timestamp("due_date").notNull(),
    recurring: boolean("recurring").notNull().default(false),
    // Quando paidAt != NULL, o pagamento está quitado.
    paidAt: timestamp("paid_at"),
    paidAmountCents: integer("paid_amount_cents"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("client_payments_lead_idx").on(t.leadId),
    dueIdx: index("client_payments_due_idx").on(t.dueDate),
  }),
);

export type ClientPayment = typeof clientPaymentsTable.$inferSelect;
export type NewClientPayment = typeof clientPaymentsTable.$inferInsert;
