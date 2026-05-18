import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),

  // ── Identificação ───────────────────────────────────────────
  name: text("name").notNull(),
  cpf: text("cpf").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),

  // ── Dados pessoais (Caixa) ──────────────────────────────────
  birthDate: text("birth_date"),
  maritalStatus: text("marital_status", {
    enum: ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
  }),
  profession: text("profession"),
  employmentType: text("employment_type", {
    enum: ["clt", "autonomo", "servidor_publico", "empresario", "aposentado", "liberal", "desempregado"],
  }),
  employmentMonths: integer("employment_months"),

  // ── Renda ────────────────────────────────────────────────────
  income: real("income").notNull(),
  informalIncome: real("informal_income"),

  // ── FGTS ─────────────────────────────────────────────────────
  hasFgts: boolean("has_fgts"),
  fgtsBalance: real("fgts_balance"),

  // ── Imóvel ───────────────────────────────────────────────────
  propertyValue: real("property_value").notNull(),
  propertyType: text("property_type", {
    enum: ["novo", "usado", "construcao", "terreno"],
  }),
  propertyCity: text("property_city"),
  propertyState: text("property_state"),

  // ── Cônjuge / composição familiar ────────────────────────────
  spouseName: text("spouse_name"),
  spouseCpf: text("spouse_cpf"),
  spouseBirthDate: text("spouse_birth_date"),
  spouseProfession: text("spouse_profession"),
  spouseIncome: real("spouse_income"),

  // ── Score / status ───────────────────────────────────────────
  status: text("status", {
    enum: ["pending", "analyzing", "approved", "rejected", "in_progress"],
  }).notNull().default("pending"),
  approvalChance: real("approval_chance").notNull().default(0),
  scoreCaixa: integer("score_caixa").notNull().default(0),
  scoreMCMV: integer("score_mcmv").notNull().default(0),
  brokerId: integer("broker_id"),
  correspondentId: integer("correspondent_id"),
  processStage: text("process_stage", {
    enum: ["analise", "aprovacao", "engenharia", "conformidade", "assinatura", "concluido"],
  }),
  aiRecommendation: text("ai_recommendation"),

  // ── Enriquecimento bureaus & Caixa ───────────────────────────
  serasaScore: integer("serasa_score"),
  hasNegativations: boolean("has_negativations"),
  negativationsValue: real("negativations_value"),
  hasProtests: boolean("has_protests"),
  protestsValue: real("protests_value"),
  siricStatus: text("siric_status", {
    enum: ["regular", "irregular", "pendente"],
  }),
  siricObservation: text("siric_observation"),
  fgtsMonths: integer("fgts_months"),
  fgtsMonthlyAvg: real("fgts_monthly_avg"),
  caixaScoreReal: integer("caixa_score_real"),
  enrichedAt: timestamp("enriched_at"),
  enrichedBy: text("enriched_by"),

  // ── Comprometimento financeiro (dívidas ativas) ───────────────
  vehicleLoanMonthly: real("vehicle_loan_monthly"),
  creditCardLimit: real("credit_card_limit"),
  creditCardUsage: real("credit_card_usage"),
  otherLoansMonthly: real("other_loans_monthly"),

  // ── Banco Central do Brasil (Registrato / SCR) ────────────────
  bcbTotalDebt: real("bcb_total_debt"),
  bcbMonthlyCommitment: real("bcb_monthly_commitment"),
  bcbOperationsCount: integer("bcb_operations_count"),
  bcbQueryDate: text("bcb_query_date"),
  bcbDebtsCurrent: real("bcb_debts_current"),
  bcbDebtsOverdue: real("bcb_debts_overdue"),
  bcbCreditLimits: real("bcb_credit_limits"),
  bcbOperationsJson: text("bcb_operations_json"),

  // ── Open Finance (simulado por enquanto) ─────────────────────
  openFinanceConnected: boolean("open_finance_connected"),
  openFinanceConnectedAt: timestamp("open_finance_connected_at"),
  openFinanceBank: text("open_finance_bank"),
  openFinanceAvgBalance: real("open_finance_avg_balance"),
  openFinanceRecurringIncome: real("open_finance_recurring_income"),
  openFinanceCardUsage: real("open_finance_card_usage"),
  openFinanceNoLatePayments: boolean("open_finance_no_late_payments"),
  openFinanceCpfClear: boolean("open_finance_cpf_clear"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvalChance: true,
  scoreCaixa: true,
  scoreMCMV: true,
  aiRecommendation: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
