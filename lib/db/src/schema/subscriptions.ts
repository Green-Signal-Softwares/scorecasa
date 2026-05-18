import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Tiers de plano (estrutura oficial 2026) ──────────────────────────────────
export const PLAN_TIERS = {
  // ── Cliente final (B2C) ──
  free: {
    id: "free",
    label: "Free",
    role: "client" as const,
    group: "individual" as const,
    priceMonthly: 0,
    leadLimit: null,
    enterprise: false,
    color: "#6B7280",
    bgLight: "#F3F4F6",
    description: "Capte seu volume — entrada gratuita ao ecossistema ScoreCasa",
    features: [
      "Simulação básica de financiamento",
      "Score básico ScoreCasa",
      "Até 3 análises de crédito por mês",
      "Visualização limitada do marketplace",
    ],
  },
  individual: {
    id: "individual",
    label: "Individual",
    role: "client" as const,
    group: "individual" as const,
    priceMonthly: 29.90,
    leadLimit: null,
    enterprise: false,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    description: "Análise completa com IA, Open Finance e marketplace ilimitado",
    features: [
      "IA completa de previsão de aprovação",
      "Monitoramento contínuo do score",
      "Imóveis ilimitados no marketplace",
      "Open Finance integrado",
      "Score avançado ScoreCasa",
      "Notificações em tempo real",
      "Prioridade na análise",
    ],
  },
  plus: {
    id: "plus",
    label: "Plus",
    role: "client" as const,
    group: "individual" as const,
    priceMonthly: 59.90,
    leadLimit: null,
    enterprise: false,
    color: "#0D9488",
    bgLight: "#F0FDFA",
    description: "Personal financeiro imobiliário — para quem quer realmente aprovar",
    features: [
      "Tudo do plano Individual",
      "Consultoria com IA dedicada",
      "Plano de aprovação personalizado",
      "Acompanhamento da evolução do score",
      "Metas financeiras inteligentes",
      "Suporte prioritário",
      "Recomendações automáticas",
      "Alertas de crédito em tempo real",
    ],
  },
  // ── Corretor / Imobiliária (B2B) ──
  corretor: {
    id: "corretor",
    label: "Corretor",
    role: "broker" as const,
    group: "corretor" as const,
    priceMonthly: 297.00,
    leadLimit: null,
    enterprise: false,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    description: "Gestão profissional de leads e comparativo entre bancos",
    features: [
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Dashboard de performance",
      "Exportação de relatórios PDF",
      "Histórico de vendas efetivas",
      "Avaliações de clientes",
    ],
  },
  imobiliaria: {
    id: "imobiliaria",
    label: "Imobiliária",
    role: "broker" as const,
    group: "corretor" as const,
    priceMonthly: 697.00,
    leadLimit: null,
    enterprise: false,
    color: "#4338CA",
    bgLight: "#EEF2FF",
    description: "Gestão multi-corretores com painel completo da imobiliária",
    features: [
      "Tudo do plano Corretor",
      "Painel multi-corretores",
      "Gestão de equipe e permissões",
      "Relatórios consolidados da imobiliária",
      "Vitrine de imóveis incluída",
      "Suporte prioritário",
      "Notificações em tempo real",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    role: "broker" as const,
    group: "corretor" as const,
    priceMonthly: 1497.00,
    leadLimit: null,
    enterprise: false,
    color: "#6D28D9",
    bgLight: "#F5F3FF",
    description: "Operação em escala com SLA dedicado e integração customizada",
    features: [
      "Tudo do plano Imobiliária",
      "Operações ilimitadas",
      "Gerente de conta dedicado",
      "API e integração personalizada",
      "Onboarding com time ScoreCasa",
      "SLA dedicado",
      "White-label parcial",
    ],
  },
  // ── Correspondente / Banking ──
  bank_connect: {
    id: "bank_connect",
    label: "Bank Connect",
    role: "correspondent" as const,
    group: "correspondent" as const,
    priceMonthly: 2497.00,
    leadLimit: null,
    enterprise: false,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    description: "Integração direta com Caixa, bancos privados e originação completa",
    features: [
      "ScoreCasa Conectado (extensão Chrome)",
      "Espelhamento Caixa Aqui + bancos privados",
      "Esteira completa: aprovação → engenharia → conformidade → contrato",
      "Gestão de documentação bancária",
      "Originação de financiamento",
      "Painel multi-correspondentes",
      "Gerente de conta bancária dedicado",
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
      // Estrutura atual
      "free", "individual", "plus",
      "corretor", "imobiliaria", "enterprise",
      "bank_connect",
      // Legacy (mantidos para back-compat com assinaturas antigas)
      "corretor_50", "corretor_200", "corretor_enterprise",
      "correspondent_50", "correspondent_200", "correspondent_enterprise",
      "client", "correspondent",
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
