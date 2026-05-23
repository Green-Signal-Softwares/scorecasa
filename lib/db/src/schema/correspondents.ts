import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tabela de correspondentes bancários cadastrados. Cada correspondente
// trabalha com um banco específico e possui um código de identificação
// (ex.: CCA para Caixa, código MCI para Bradesco, etc.). Um cliente
// "linka" o seu lead a um correspondente para tocar o processo.
export const correspondentsTable = pgTable("correspondents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bank: text("bank").notNull(), // slug do banco (caixa, bb, bradesco, itau, santander, inter)
  code: text("code").notNull(), // CCA / matrícula / código interno do banco
  email: text("email"),
  phone: text("phone"),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  // Usuário (login) associado a este correspondente — opcional.
  // Quando preenchido, esse usuário consegue ver no painel apenas os
  // leads em que ele esteja linkado.
  userId: integer("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCorrespondentSchema = createInsertSchema(correspondentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCorrespondent = z.infer<typeof insertCorrespondentSchema>;
export type Correspondent = typeof correspondentsTable.$inferSelect;
