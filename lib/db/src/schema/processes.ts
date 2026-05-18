import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const PROCESS_STAGES = [
  "analise",
  "aprovacao",
  "engenharia",
  "conformidade",
  "assinatura",
  "concluido",
] as const;

export type ProcessStage = (typeof PROCESS_STAGES)[number];

export const processDocumentsTable = pgTable("process_documents", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  stage: text("stage", { enum: PROCESS_STAGES }).notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  contentType: text("content_type"),
  uploadedBy: integer("uploaded_by").notNull(),
  uploadedByName: text("uploaded_by_name"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  notes: text("notes"),
  // Visível para o cliente (formulários compartilhados pelo CCA; docs
  // que o próprio cliente subiu são sempre visíveis para ele).
  visibleToClient: boolean("visible_to_client").notNull().default(false),
  // Formulários que exigem assinatura via gov.br (Proposta CEF, DPS etc).
  signatureRequired: boolean("signature_required").notNull().default(false),
  signedAt: timestamp("signed_at"),
  signatureProvider: text("signature_provider"),
  signatureRef: text("signature_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const processStageHistoryTable = pgTable("process_stage_history", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  fromStage: text("from_stage", { enum: PROCESS_STAGES }),
  toStage: text("to_stage", { enum: PROCESS_STAGES }).notNull(),
  changedBy: integer("changed_by").notNull(),
  changedByName: text("changed_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProcessDocument = typeof processDocumentsTable.$inferSelect;
export type ProcessStageHistory = typeof processStageHistoryTable.$inferSelect;
