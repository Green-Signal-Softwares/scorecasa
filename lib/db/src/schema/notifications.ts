import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  // Tipo da notificação. Define como o cliente deve renderizar.
  type: text("type").notNull().default("lead_status"),
  // Usuário-alvo. Quando NULL, a notificação é broadcast (visível para staff: admin/analyst).
  userId: integer("user_id"),
  // Campos específicos de status de lead (legado/lead_status).
  leadId: integer("lead_id"),
  leadName: text("lead_name"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  // Campos para notificações relacionadas a imóvel (property_interest).
  propertyId: integer("property_id"),
  propertyTitle: text("property_title"),
  // Mensagem renderizável.
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
