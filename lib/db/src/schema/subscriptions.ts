import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Tiers de plano ────────────────────────────────────────────────────────────
export const PLAN_TIERS = {
  individual: {
    id: "individual",
    label: "Plano Individual",
    role: "client" as const,
    priceMonthly: 29.90,
    leadLimit: null,
    enterprise: false,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    description: "Acesso ao portal do cliente, análise de crédito e GPS de aprovação",
    features: [
      "Portal do cliente completo",
      "Análise de crédito com IA",
      "GPS de aprovação personalizado",
      "Catálogo de imóveis",
      "Acompanhamento do processo",
      "Relatório PDF de crédito",
    ],
  },
  corretor_50: {
    id: "corretor_50",
    label: "Corretor — até 50 leads",
    role: "broker" as const,
    priceMonthly: 199.00,
    leadLimit: 50,
    enterprise: false,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    description: "Gestão de até 50 leads em andamento, análise de crédito e ranking",
    features: [
      "Até 50 leads em andamento",
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Dashboard de performance",
      "Exportação de relatórios PDF",
      "Histórico de vendas efetivas",
      "Avaliações de clientes",
    ],
  },
  corretor_200: {
    id: "corretor_200",
    label: "Corretor — até 200 leads",
    role: "broker" as const,
    priceMonthly: 499.00,
    leadLimit: 200,
    enterprise: false,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    description: "Gestão de até 200 leads em andamento com todos os recursos",
    features: [
      "Até 200 leads em andamento",
      "Tudo do plano Corretor 50",
      "Relatórios avançados de performance",
      "Suporte prioritário",
      "Notificações em tempo real",
    ],
  },
  corretor_enterprise: {
    id: "corretor_enterprise",
    label: "Corretor — Empresarial",
    role: "broker" as const,
    priceMonthly: 0,
    leadLimit: null,
    enterprise: true,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    description: "Acima de 200 leads em andamento — necessário análise",
    features: [
      "Leads ilimitados",
      "Tudo do plano Corretor 200",
      "Gerente de conta dedicado",
      "Integração personalizada",
      "Contrato sob medida",
    ],
  },
  correspondent_50: {
    id: "correspondent_50",
    label: "Correspondente — até 50 leads",
    role: "correspondent" as const,
    priceMonthly: 299.00,
    leadLimit: 50,
    enterprise: false,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    description: "Gestão completa do processo bancário para até 50 operações",
    features: [
      "Até 50 leads em andamento",
      "Gestão de documentação bancária",
      "Acompanhamento aprovação→chaves",
      "Etapas: aprovação, engenharia, conformidade, contrato",
      "Histórico de contratos assinados",
      "Avaliações de clientes",
      "Análise de crédito avançada",
    ],
  },
  correspondent_200: {
    id: "correspondent_200",
    label: "Correspondente — até 200 leads",
    role: "correspondent" as const,
    priceMonthly: 599.00,
    leadLimit: 200,
    enterprise: false,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    description: "Gestão completa para até 200 operações com suporte prioritário",
    features: [
      "Até 200 leads em andamento",
      "Tudo do plano Correspondente 50",
      "Relatórios financeiros avançados",
      "Painel multi-corretores",
      "Suporte prioritário",
    ],
  },
  correspondent_enterprise: {
    id: "correspondent_enterprise",
    label: "Correspondente — Empresarial",
    role: "correspondent" as const,
    priceMonthly: 0,
    leadLimit: null,
    enterprise: true,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    description: "Acima de 200 leads em andamento — necessário análise",
    features: [
      "Operações ilimitadas",
      "Tudo do plano Correspondente 200",
      "Gerente de conta dedicado",
      "Integração personalizada com bancos",
      "Contrato sob medida",
    ],
  },
} as const;

export type PlanTierId = keyof typeof PLAN_TIERS;

// ── Add-ons marketplace (para corretores) ─────────────────────────────────────
export const MARKETPLACE_ADDONS = {
  marketplace_10: {
    id: "marketplace_10",
    label: "Marketplace — até 10 imóveis",
    priceMonthly: 99.00,
    propertyLimit: 10,
    description: "Divulgue até 10 imóveis no marketplace ScoreCasa",
  },
  marketplace_50: {
    id: "marketplace_50",
    label: "Marketplace — até 50 imóveis",
    priceMonthly: 199.00,
    propertyLimit: 50,
    description: "Divulgue até 50 imóveis no marketplace ScoreCasa",
  },
} as const;

export type MarketplaceAddonId = keyof typeof MARKETPLACE_ADDONS;

// ── Tabela de assinaturas ─────────────────────────────────────────────────────
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull(),

  plan: text("plan", {
    enum: [
      "individual",
      "corretor_50", "corretor_200", "corretor_enterprise",
      "correspondent_50", "correspondent_200", "correspondent_enterprise",
      // legacy values kept for backward compat
      "client", "corretor", "correspondent",
    ],
  }).notNull(),

  status: text("status", {
    enum: ["trial", "active", "overdue", "cancelled", "inactive"],
  }).notNull().default("trial"),

  priceMonthly: real("price_monthly").notNull(),
  billingDay: integer("billing_day").notNull().default(1),

  // Marketplace add-on
  marketplaceAddon: boolean("marketplace_addon").default(false),
  marketplacePropertyLimit: integer("marketplace_property_limit"),
  marketplaceAddonPrice: real("marketplace_addon_price"),

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
