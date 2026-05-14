import { Router } from "express";
import { db, subscriptionsTable, usersTable, PLANS } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

function formatSub(s: any) {
  return {
    ...s,
    trialEndsAt: s.trialEndsAt instanceof Date ? s.trialEndsAt.toISOString() : s.trialEndsAt,
    lastPaymentAt: s.lastPaymentAt instanceof Date ? s.lastPaymentAt.toISOString() : s.lastPaymentAt,
    nextDueAt: s.nextDueAt instanceof Date ? s.nextDueAt.toISOString() : s.nextDueAt,
    cancelledAt: s.cancelledAt instanceof Date ? s.cancelledAt.toISOString() : s.cancelledAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

const CreateSubBody = z.object({
  userId: z.number().int(),
  userName: z.string(),
  userEmail: z.string().email(),
  userRole: z.string(),
  plan: z.enum(["client", "corretor", "correspondent"]),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  notes: z.string().optional(),
});

const UpdateSubBody = z.object({
  plan: z.enum(["client", "corretor", "correspondent"]).optional(),
  status: z.enum(["trial", "active", "overdue", "cancelled", "inactive"]).optional(),
  billingDay: z.number().int().optional(),
  lastPaymentAt: z.string().optional(),
  nextDueAt: z.string().optional(),
  notes: z.string().optional(),
});

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

  const plan = PLANS[parsed.data.plan];
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const nextDue = new Date();
  nextDue.setMonth(nextDue.getMonth() + 1);

  const [created] = await db.insert(subscriptionsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "trial",
    priceMonthly: plan.priceMonthly,
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
    updateData.priceMonthly = PLANS[parsed.data.plan].priceMonthly;
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
