import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  asaasPaymentId: text("asaas_payment_id").unique(),
  status: text("status").notNull(), // 'PENDING', 'CONFIRMED', 'FAILED'
  amountCents: integer("amount_cents").notNull(),
  billingType: text("billing_type").notNull().default("CREDIT_CARD"),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;
