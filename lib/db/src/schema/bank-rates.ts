import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  date,
  uniqueIndex,
  index,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Taxa atual de cada (banco, produto). Uma linha por par.
 * - source = "bcb": atualizada automaticamente pela rotina diária (Caixa).
 * - source = "manual": cadastrada por admin (Inter, Santander, C6, BB, Itaú, Bradesco).
 *
 * `bcbReferenceRate` armazena a média BCB do mesmo segmento (referência) para
 * detectar divergência em taxas manuais.
 */
export const bankRatesTable = pgTable(
  "bank_rates",
  {
    id: serial("id").primaryKey(),
    bankSlug: text("bank_slug").notNull(),
    bankName: text("bank_name").notNull(),
    product: text("product").notNull(), // sbpe | pro_cotista | mcmv_f1 | mcmv_f2 | mcmv_f3 | mcmv_f4
    productLabel: text("product_label").notNull(),
    rateAA: numeric("rate_aa", { precision: 7, scale: 4 }).notNull(),
    previousRateAA: numeric("previous_rate_aa", { precision: 7, scale: 4 }),
    bcbReferenceRate: numeric("bcb_reference_rate", { precision: 7, scale: 4 }),
    source: text("source").notNull(), // bcb | manual
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bankProductUq: uniqueIndex("bank_rates_bank_product_uq").on(t.bankSlug, t.product),
  }),
);

/**
 * Histórico dia a dia. Uma linha por (banco, produto, dia).
 * Alimentado pela rotina diária + qualquer mutação manual.
 */
export const bankRateHistoryTable = pgTable(
  "bank_rate_history",
  {
    id: serial("id").primaryKey(),
    bankSlug: text("bank_slug").notNull(),
    product: text("product").notNull(),
    observedOn: date("observed_on").notNull(),
    rateAA: numeric("rate_aa", { precision: 7, scale: 4 }).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("bank_rate_history_uq").on(t.bankSlug, t.product, t.observedOn),
    byDay: index("bank_rate_history_observed_idx").on(t.observedOn),
  }),
);

/**
 * Registro de cada execução do job de sincronização BCB. Permite detectar
 * falhas consecutivas para gerar alerta.
 */
export const rateSyncRunsTable = pgTable("rate_sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  success: boolean("success").notNull().default(false),
  source: text("source").notNull().default("bcb"),
  trigger: text("trigger").notNull().default("scheduled"), // scheduled | manual
  rowsProcessed: integer("rows_processed").notNull().default(0),
  rowsChanged: integer("rows_changed").notNull().default(0),
  error: text("error"),
});

export type BankRate = typeof bankRatesTable.$inferSelect;
export type BankRateInsert = typeof bankRatesTable.$inferInsert;
export type BankRateHistory = typeof bankRateHistoryTable.$inferSelect;
export type RateSyncRun = typeof rateSyncRunsTable.$inferSelect;
