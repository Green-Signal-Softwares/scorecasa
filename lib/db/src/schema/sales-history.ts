import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Histórico de vendas / contratos ───────────────────────────────────────────
// Registra cada venda efetiva (corretor) ou contrato assinado (correspondente)
export const salesHistoryTable = pgTable("sales_history", {
  id: serial("id").primaryKey(),

  // Quem realizou (corretor ou correspondente)
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role", { enum: ["broker", "correspondent"] }).notNull(),

  // Cliente
  clientId: integer("client_id"),
  clientName: text("client_name").notNull(),

  // Lead relacionado
  leadId: integer("lead_id"),

  // Imóvel
  propertyTitle: text("property_title").notNull(),
  propertyValue: real("property_value").notNull(),
  propertyCity: text("property_city"),

  // Financiamento
  bankName: text("bank_name"),
  financedValue: real("financed_value"),

  // Etapas do financiamento habitacional
  stage: text("stage", {
    enum: ["approved", "engineering", "compliance", "contract_signed", "keys_delivered"],
  }).notNull().default("approved"),

  // Datas de cada etapa
  approvedAt: timestamp("approved_at"),
  engineeringAt: timestamp("engineering_at"),
  complianceAt: timestamp("compliance_at"),
  contractSignedAt: timestamp("contract_signed_at"),
  keysDeliveredAt: timestamp("keys_delivered_at"),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSaleSchema = createInsertSchema(salesHistoryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleHistory = typeof salesHistoryTable.$inferSelect;
