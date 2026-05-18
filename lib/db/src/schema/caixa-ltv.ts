import { pgTable, integer, real, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tabela singleton (id = 1) com os percentuais máximos de financiamento
 * praticados pela Caixa para cada tipo de imóvel. Atualizada por scraping
 * periódico de caixa.gov.br/habitacao.
 */
export const caixaLtvTable = pgTable("caixa_ltv", {
  id: integer("id").primaryKey().default(1),
  empreendimentoLtv: real("empreendimento_ltv").notNull().default(90),
  novoIndividualLtv: real("novo_individual_ltv").notNull().default(80),
  usadoLtv: real("usado_ltv").notNull().default(70),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("fallback"),
});

export type CaixaLtv = typeof caixaLtvTable.$inferSelect;
