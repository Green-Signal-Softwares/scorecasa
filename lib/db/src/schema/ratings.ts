import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Avaliações (cliente avalia corretor ou correspondente) ────────────────────
export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),

  // Quem avaliou (sempre o cliente)
  fromUserId: integer("from_user_id").notNull(),
  fromUserName: text("from_user_name").notNull(),

  // Quem foi avaliado (corretor ou correspondente)
  toUserId: integer("to_user_id").notNull(),
  toUserName: text("to_user_name").notNull(),
  toUserRole: text("to_user_role", { enum: ["broker", "correspondent"] }).notNull(),

  // Contexto
  leadId: integer("lead_id"),
  propertyTitle: text("property_title"),

  // Avaliação
  stars: integer("stars").notNull(), // 1–5
  comment: text("comment"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
