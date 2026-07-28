import { Router } from "express";
import { db, plansTable, pool } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function formatPlan(p: any) {
  const out: any = { ...p };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  return out;
}

const CreatePlanBody = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.enum(["client", "broker", "correspondent"]),
  group: z.enum(["individual", "corretor", "correspondent"]),
  priceMonthly: z.number(),
  priceYearly: z.number().optional(),
  highlight: z.boolean().optional(),
  leadLimit: z.number().nullable().optional(),
  userLimit: z.number().nullable().optional(),
  enterprise: z.boolean().optional(),
  color: z.string().optional(),
  bgLight: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
});

const UpdatePlanBody = z.object({
  label: z.string().optional(),
  role: z.enum(["client", "broker", "correspondent"]).optional(),
  group: z.enum(["individual", "corretor", "correspondent"]).optional(),
  priceMonthly: z.number().optional(),
  priceYearly: z.number().optional(),
  highlight: z.boolean().optional(),
  leadLimit: z.number().nullable().optional(),
  userLimit: z.number().nullable().optional(),
  enterprise: z.boolean().optional(),
  color: z.string().optional(),
  bgLight: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
  isLegacy: z.boolean().optional(),
});

// Helper para garantir a existência das colunas no Postgres
async function ensurePlanColumns() {
  try {
    await pool.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS user_limit integer;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS lead_limit integer;
    `);
  } catch {}
}

// GET /plans
router.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  await ensurePlanColumns();

  const { role, includeInactive, includeLegacy } = req.query;

  // Busca do Postgres com mapeamento explícito das colunas user_limit e lead_limit
  const rawDbRes = await pool.query(`
    SELECT
      id,
      label,
      role,
      "group",
      price_monthly AS "priceMonthly",
      price_yearly AS "priceYearly",
      highlight,
      lead_limit AS "leadLimit",
      user_limit AS "userLimit",
      enterprise,
      color,
      bg_light AS "bgLight",
      description,
      features,
      is_active AS "isActive",
      is_legacy AS "isLegacy",
      sort_order AS "sortOrder",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM plans
    ORDER BY sort_order ASC, label ASC;
  `);

  let plans = rawDbRes.rows;

  if (role) {
    plans = plans.filter((p: any) => p.role === role);
  }
  if (includeInactive !== "true") {
    plans = plans.filter((p: any) => p.isActive !== false);
  }
  if (includeLegacy !== "true") {
    plans = plans.filter((p: any) => p.isLegacy !== true);
  }

  res.json(plans.map(formatPlan));
});

// GET /plans/:id
router.get("/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  const { id } = req.params;
  await ensurePlanColumns();

  const rawDbRes = await pool.query(`
    SELECT
      id, label, role, "group", price_monthly AS "priceMonthly", price_yearly AS "priceYearly",
      highlight, lead_limit AS "leadLimit", user_limit AS "userLimit", enterprise, color,
      bg_light AS "bgLight", description, features, is_active AS "isActive", is_legacy AS "isLegacy",
      sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM plans WHERE id = $1 LIMIT 1;
  `, [id]);

  const plan = rawDbRes.rows[0];
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(formatPlan(plan));
});

// POST /plans
router.post("/", requireAuth, async (req, res) => {
  await ensurePlanColumns();
  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, parsed.data.id)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Plan ID already exists" });
    return;
  }

  const data = parsed.data;
  await pool.query(`
    INSERT INTO plans (id, label, role, "group", price_monthly, price_yearly, highlight, lead_limit, user_limit, enterprise, color, bg_light, description, features, sort_order, is_active, is_legacy)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, false);
  `, [
    data.id,
    data.label,
    data.role,
    data.group,
    data.priceMonthly,
    data.priceYearly ?? 0,
    data.highlight ?? false,
    data.leadLimit ?? null,
    data.userLimit ?? null,
    data.enterprise ?? false,
    data.color ?? "#10A65A",
    data.bgLight ?? "#F0FDF4",
    data.description ?? "",
    data.features ?? [],
    data.sortOrder ?? 0,
  ]);

  const rawRes = await pool.query(`
    SELECT id, label, role, "group", price_monthly AS "priceMonthly", price_yearly AS "priceYearly",
      highlight, lead_limit AS "leadLimit", user_limit AS "userLimit", enterprise, color,
      bg_light AS "bgLight", description, features, is_active AS "isActive", is_legacy AS "isLegacy",
      sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM plans WHERE id = $1;
  `, [data.id]);

  res.status(201).json(formatPlan(rawRes.rows[0]));
});

const handleUpdatePlan = async (req: any, res: any) => {
  const { id } = req.params;
  await ensurePlanColumns();

  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const check = await pool.query(`SELECT id FROM plans WHERE id = $1;`, [id]);
  if (check.rows.length === 0) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const data = parsed.data;

  // Atualização direta via SQL do PostgreSQL para garantir persistência dos campos
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.label !== undefined) { updates.push(`label = $${paramIdx++}`); values.push(data.label); }
  if (data.role !== undefined) { updates.push(`role = $${paramIdx++}`); values.push(data.role); }
  if (data.group !== undefined) { updates.push(`"group" = $${paramIdx++}`); values.push(data.group); }
  if (data.priceMonthly !== undefined) { updates.push(`price_monthly = $${paramIdx++}`); values.push(data.priceMonthly); }
  if (data.priceYearly !== undefined) { updates.push(`price_yearly = $${paramIdx++}`); values.push(data.priceYearly); }
  if (data.highlight !== undefined) { updates.push(`highlight = $${paramIdx++}`); values.push(data.highlight); }
  if (data.leadLimit !== undefined) { updates.push(`lead_limit = $${paramIdx++}`); values.push(data.leadLimit); }
  if (data.userLimit !== undefined) { updates.push(`user_limit = $${paramIdx++}`); values.push(data.userLimit); }
  if (data.enterprise !== undefined) { updates.push(`enterprise = $${paramIdx++}`); values.push(data.enterprise); }
  if (data.color !== undefined) { updates.push(`color = $${paramIdx++}`); values.push(data.color); }
  if (data.bgLight !== undefined) { updates.push(`bg_light = $${paramIdx++}`); values.push(data.bgLight); }
  if (data.description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(data.description); }
  if (data.features !== undefined) { updates.push(`features = $${paramIdx++}`); values.push(data.features); }
  if (data.sortOrder !== undefined) { updates.push(`sort_order = $${paramIdx++}`); values.push(data.sortOrder); }
  if (data.isActive !== undefined) { updates.push(`is_active = $${paramIdx++}`); values.push(data.isActive); }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const queryText = `
    UPDATE plans
    SET ${updates.join(", ")}
    WHERE id = $${paramIdx}
    RETURNING id, label, role, "group", price_monthly AS "priceMonthly", price_yearly AS "priceYearly",
      highlight, lead_limit AS "leadLimit", user_limit AS "userLimit", enterprise, color,
      bg_light AS "bgLight", description, features, is_active AS "isActive", is_legacy AS "isLegacy",
      sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt";
  `;

  const updatedRes = await pool.query(queryText, values);
  res.json(formatPlan(updatedRes.rows[0]));
};

// PATCH & PUT /plans/:id
router.patch("/:id", requireAuth, handleUpdatePlan);
router.put("/:id", requireAuth, handleUpdatePlan);

// DELETE /plans/:id (soft delete)
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE plans SET is_active = false, updated_at = NOW() WHERE id = $1;`, [id]);
  res.json({ id, isActive: false });
});

export default router;
