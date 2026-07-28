import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDbSchema() {
  try {
    await pool.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_limit integer;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS lead_limit integer;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id integer;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[];
    `);
  } catch (err) {
    console.error("[db] Error auto-migrating DB columns:", err);
  }
}

ensureDbSchema();

export * from "./schema";
