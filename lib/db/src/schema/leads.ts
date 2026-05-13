import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cpf: text("cpf").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  income: real("income").notNull(),
  propertyValue: real("property_value").notNull(),
  status: text("status", {
    enum: ["pending", "analyzing", "approved", "rejected", "in_progress"],
  }).notNull().default("pending"),
  approvalChance: real("approval_chance").notNull().default(0),
  scoreCaixa: integer("score_caixa").notNull().default(0),
  scoreMCMV: integer("score_mcmv").notNull().default(0),
  brokerId: integer("broker_id"),
  aiRecommendation: text("ai_recommendation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true, approvalChance: true, scoreCaixa: true, scoreMCMV: true, aiRecommendation: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
