import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// Conexões Open Finance por lead. Cada itemId representa uma instituição
// conectada no Pluggy, permitindo múltiplos bancos simultâneos por cliente.
export const openFinanceConnectionsTable = pgTable(
  "open_finance_connections",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    provider: text("provider").notNull().default("pluggy"),
    itemId: text("item_id").notNull(),
    connectorId: integer("connector_id"),
    connectorName: text("connector_name"),
    status: text("status"),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("open_finance_connections_lead_idx").on(t.leadId),
    leadItemUnique: uniqueIndex("open_finance_connections_lead_item_unique").on(t.leadId, t.itemId),
  }),
);

export type OpenFinanceConnection = typeof openFinanceConnectionsTable.$inferSelect;
export type NewOpenFinanceConnection = typeof openFinanceConnectionsTable.$inferInsert;
