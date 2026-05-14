import { Router } from "express";
import { db, subscriptionsTable, PLAN_TIERS, MARKETPLACE_ADDONS } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

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

const ALL_PLANS = [
  "individual",
  "corretor_50", "corretor_200", "corretor_enterprise",
  "correspondent_50", "correspondent_200", "correspondent_enterprise",
  // legacy
  "client", "corretor", "correspondent",
] as const;

const CreateSubBody = z.object({
  userId: z.number().int(),
  userName: z.string(),
  userEmail: z.string().email(),
  userRole: z.string(),
  plan: z.enum(ALL_PLANS),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  marketplaceAddon: z.boolean().optional(),
  marketplacePropertyLimit: z.number().int().optional(),
  marketplaceAddonPrice: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateSubBody = z.object({
  plan: z.enum(ALL_PLANS).optional(),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  marketplaceAddon: z.boolean().optional(),
  marketplacePropertyLimit: z.number().int().optional(),
  marketplaceAddonPrice: z.number().optional(),
  lastPaymentAt: z.string().optional(),
  nextDueAt: z.string().optional(),
  notes: z.string().optional(),
});

function getPlanPrice(planId: string): number {
  const tier = PLAN_TIERS[planId as keyof typeof PLAN_TIERS];
  if (tier) return tier.priceMonthly;
  // legacy fallback
  const legacy: Record<string, number> = { client: 29.90, corretor: 199, correspondent: 299 };
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
  const nextDue = new Date();
  nextDue.setMonth(nextDue.getMonth() + 1);

  let priceMonthly = getPlanPrice(parsed.data.plan);
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

  const updateData: any = { ...parsed.data, updatedAt: new Date() };

  if (parsed.data.plan) {
    updateData.priceMonthly = getPlanPrice(parsed.data.plan);
  }
  if (parsed.data.lastPaymentAt) updateData.lastPaymentAt = new Date(parsed.data.lastPaymentAt);
  if (parsed.data.nextDueAt) updateData.nextDueAt = new Date(parsed.data.nextDueAt);
  if (parsed.data.status === "cancelled") updateData.cancelledAt = new Date();

  const [updated] = await db.update(subscriptionsTable)
    .set(updateData)
    .where(eq(subscriptionsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatSub(updated));
});

export default router;
