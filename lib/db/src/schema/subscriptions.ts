import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Tabela de assinaturas ─────────────────────────────────────────────────────
// O campo `plan` agora é um text livre — os slugs válidos vivem na tabela `plans`.
// Não usamos mais enum fixo no PostgreSQL para permitir que o admin crie novos planos
// sem migrations de schema.
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull(),

  plan: text("plan").notNull(), // referencia plans.id (sem FK, suporta legados)

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
