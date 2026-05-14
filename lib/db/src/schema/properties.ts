import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),

  // ── Identificação ───────────────────────────────────────────
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["apartamento", "casa", "comercial", "terreno", "cobertura", "studio"] }).notNull().default("apartamento"),

  // ── Valores ─────────────────────────────────────────────────
  price: real("price").notNull(),
  condominiumFee: real("condominium_fee"),
  iptu: real("iptu"),

  // ── Localização ──────────────────────────────────────────────
  address: text("address"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code"),

  // ── Características ──────────────────────────────────────────
  areaSqm: real("area_sqm").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parkingSpots: integer("parking_spots"),
  hasFurnished: boolean("has_furnished").default(false),
  hasPool: boolean("has_pool").default(false),
  hasGym: boolean("has_gym").default(false),
  hasBalcony: boolean("has_balcony").default(false),

  // ── Imagens ─────────────────────────────────────────────────
  imageUrl: text("image_url"),
  imageUrl2: text("image_url_2"),
  imageUrl3: text("image_url_3"),

  // ── Financiamento ────────────────────────────────────────────
  acceptsFgts: boolean("accepts_fgts").default(true),
  acceptsMcmv: boolean("accepts_mcmv").default(false),
  acceptsSbpe: boolean("accepts_sbpe").default(true),

  // ── Status / relacionamento ──────────────────────────────────
  status: text("status", { enum: ["available", "reserved", "sold", "inactive"] }).notNull().default("available"),
  brokerId: integer("broker_id"),
  brokerName: text("broker_name"),
  brokerPhone: text("broker_phone"),

  // ── Timestamps ───────────────────────────────────────────────
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;

// ── Tabela de interesses (cliente × imóvel) ──────────────────────────────────
export const propertyInterestsTable = pgTable("property_interests", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  userId: integer("user_id").notNull(),
  leadId: integer("lead_id"),
  status: text("status", { enum: ["interested", "scheduled", "visited", "financing"] }).notNull().default("interested"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PropertyInterest = typeof propertyInterestsTable.$inferSelect;
