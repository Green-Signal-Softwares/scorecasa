import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { correspondentsTable } from "./correspondents";

export const brokersTable = pgTable("brokers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  creci: text("creci").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  totalLeads: integer("total_leads").notNull().default(0),
  approvedLeads: integer("approved_leads").notNull().default(0),
  approvalRate: real("approval_rate").notNull().default(0),
  correspondentId: integer("correspondent_id").references(() => correspondentsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBrokerSchema = createInsertSchema(brokersTable).omit({ id: true, createdAt: true, totalLeads: true, approvedLeads: true, approvalRate: true });
export type InsertBroker = z.infer<typeof insertBrokerSchema>;
export type Broker = typeof brokersTable.$inferSelect;
