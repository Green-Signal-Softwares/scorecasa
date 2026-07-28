import { Router } from "express";
import { db, subscriptionsTable, plansTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { getNextDueDate } from "../lib/billing";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

function formatSub(s: any) {
  const dateFields = ["trialEndsAt", "lastPaymentAt", "nextDueAt", "cancelledAt", "createdAt", "updatedAt"];
  const out: any = { ...s };
  for (const f of dateFields) if (out[f] instanceof Date) out[f] = out[f].toISOString();
  return out;
}

const CreateSubBody = z.object({
  userId: z.number().int(),
  userName: z.string(),
  userEmail: z.string().email(),
  userRole: z.string(),
  plan: z.string().min(1),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  marketplaceAddon: z.boolean().optional(),
  marketplacePropertyLimit: z.number().int().optional(),
  marketplaceAddonPrice: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateSubBody = z.object({
  plan: z.string().min(1).optional(),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  marketplaceAddon: z.boolean().optional(),
  marketplacePropertyLimit: z.number().int().optional(),
  marketplaceAddonPrice: z.number().optional(),
  lastPaymentAt: z.string().optional(),
  nextDueAt: z.string().optional(),
  notes: z.string().optional(),
});

async function getPlanPrice(planId: string): Promise<number> {
  const [plan] = await db.select().from(plansTable)
    .where(eq(plansTable.id, planId)).limit(1);
  if (plan) return plan.priceMonthly;

  // Fallback para planos legados que não foram migrados para a tabela plans
  const legacy: Record<string, number> = {
    client: 29.90,
    corretor_50: 199.00, corretor_200: 499.00, corretor_enterprise: 0,
    correspondent: 299.00,
    correspondent_50: 299.00, correspondent_200: 599.00, correspondent_enterprise: 0,
  };
  return legacy[planId] ?? 0;
}

// GET /subscriptions/me
router.get("/me", requireAuth, async (req, res) => {
  const userId = (req as any).session!.userId!;
  const [sub] = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId)).limit(1);
  if (!sub) { res.status(404).json({ error: "No subscription" }); return; }
  res.json(formatSub(sub));
});

// GET /subscriptions (admin)
router.get("/", requireAuth, async (req, res) => {
  const subs = await db.select().from(subscriptionsTable)
    .orderBy(sql`${subscriptionsTable.createdAt} DESC`);
  res.json(subs.map(formatSub));
});

// POST /subscriptions
router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateSubBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);
  const nextDue = getNextDueDate("monthly");

  let priceMonthly = await getPlanPrice(parsed.data.plan);
  if (parsed.data.marketplaceAddon && parsed.data.marketplaceAddonPrice) {
    priceMonthly += parsed.data.marketplaceAddonPrice;
  }

  const [created] = await db.insert(subscriptionsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "trial",
    priceMonthly,
    billingDay: parsed.data.billingDay ?? 1,
    trialEndsAt: trialEnd,
    nextDueAt: nextDue,
  }).returning();

  res.status(201).json(formatSub(created));
});

// PATCH /subscriptions/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSubBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updateData: any = { ...parsed.data, updatedAt: new Date() };

  // Recalcular priceMonthly consultando o banco para o plano final
  const finalPlan = parsed.data.plan !== undefined ? parsed.data.plan : existing.plan;
  const finalMarketplaceAddon = parsed.data.marketplaceAddon !== undefined ? parsed.data.marketplaceAddon : existing.marketplaceAddon;
  const finalMarketplaceAddonPrice = parsed.data.marketplaceAddonPrice !== undefined ? parsed.data.marketplaceAddonPrice : (existing.marketplaceAddonPrice ?? 0);

  let priceMonthly = await getPlanPrice(finalPlan);
  if (finalMarketplaceAddon && finalMarketplaceAddonPrice) {
    priceMonthly += finalMarketplaceAddonPrice;
  }
  updateData.priceMonthly = priceMonthly;

  if (parsed.data.lastPaymentAt) updateData.lastPaymentAt = new Date(parsed.data.lastPaymentAt);
  if (parsed.data.nextDueAt) updateData.nextDueAt = new Date(parsed.data.nextDueAt);
  if (parsed.data.status === "cancelled") updateData.cancelledAt = new Date();

  const [updated] = await db.update(subscriptionsTable)
    .set(updateData)
    .where(eq(subscriptionsTable.id, id))
    .returning();
  res.json(formatSub(updated));
});

export default router;
