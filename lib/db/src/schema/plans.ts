import { pgTable, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  role: text("role", { enum: ["client", "broker", "correspondent"] }).notNull(),
  group: text("group", { enum: ["individual", "corretor", "correspondent"] }).notNull(),
  priceMonthly: real("price_monthly").notNull(),
  priceYearly: real("price_yearly").notNull().default(0),
  highlight: boolean("highlight").notNull().default(false),
  leadLimit: integer("lead_limit"),
  userLimit: integer("user_limit"),
  enterprise: boolean("enterprise").notNull().default(false),
  color: text("color").notNull().default("#10A65A"),
  bgLight: text("bg_light").notNull().default("#F0FDF4"),
  description: text("description").notNull().default(""),
  features: text("features").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isLegacy: boolean("is_legacy").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
