import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Planos disponíveis ────────────────────────────────────────────────────────
export const PLANS = {
  client: {
    id: "client",
    name: "Plano Cliente",
    priceMonthly: 29.90,
    description: "Acesso ao portal do cliente, análise de crédito, GPS de aprovação e consulta de imóveis",
    features: [
      "Portal do cliente completo",
      "Análise de crédito com IA",
      "GPS de aprovação personalizado",
      "Catálogo de imóveis",
      "Acompanhamento de processo",
      "Relatório PDF de crédito",
    ],
  },
  corretor: {
    id: "corretor",
    name: "Plano Corretor",
    priceMonthly: 99.90,
    description: "Gestão completa de leads, cadastro de imóveis, análise de crédito e ranking",
    features: [
      "Gestão ilimitada de leads",
      "Cadastro de imóveis no catálogo",
      "Análise de crédito avançada",
      "Comparativo de bancos",
      "Ranking de aprovações",
      "Dashboard de performance",
      "Exportação de relatórios PDF",
      "Notificações em tempo real",
    ],
  },
  correspondent: {
    id: "correspondent",
    name: "Plano Correspondente",
    priceMonthly: 199.90,
    description: "Solução completa para correspondentes bancários com multi-corretores e relatórios avançados",
    features: [
      "Tudo do Plano Corretor",
      "Gerenciamento de múltiplos corretores",
      "Relatórios financeiros avançados",
      "Acesso à API (futuro)",
      "Painel de correspondente bancário",
      "Suporte prioritário",
      "Integração Open Finance",
      "Análise de portfólio",
    ],
  },
} as const;

// ── Tabela de assinaturas ─────────────────────────────────────────────────────
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull(),

  plan: text("plan", { enum: ["client", "corretor", "correspondent"] }).notNull(),
  status: text("status", {
    enum: ["trial", "active", "overdue", "cancelled", "inactive"],
  }).notNull().default("trial"),

  priceMonthly: real("price_monthly").notNull(),
  billingDay: integer("billing_day").notNull().default(1),

  trialEndsAt: timestamp("trial_ends_at"),
  lastPaymentAt: timestamp("last_payment_at"),
  nextDueAt: timestamp("next_due_at"),
  cancelledAt: timestamp("cancelled_at"),

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
