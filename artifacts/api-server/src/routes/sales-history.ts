import { Router } from "express";
import { db, salesHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

function fmtSale(s: any) {
  const dateFields = ["approvedAt", "engineeringAt", "complianceAt", "contractSignedAt", "keysDeliveredAt", "createdAt", "updatedAt"];
  const out: any = { ...s };
  for (const f of dateFields) if (out[f] instanceof Date) out[f] = out[f].toISOString();
  return out;
}

const STAGES = ["approved", "engineering", "compliance", "contract_signed", "keys_delivered"] as const;

const CreateSaleBody = z.object({
  clientName: z.string(),
  clientId: z.number().int().optional(),
  leadId: z.number().int().optional(),
  propertyTitle: z.string(),
  propertyValue: z.number(),
  propertyCity: z.string().optional(),
  bankName: z.string().optional(),
  financedValue: z.number().optional(),
  stage: z.enum(STAGES).optional(),
  notes: z.string().optional(),
});

const UpdateSaleBody = z.object({
  stage: z.enum(STAGES).optional(),
  bankName: z.string().optional(),
  financedValue: z.number().optional(),
  approvedAt: z.string().optional(),
  engineeringAt: z.string().optional(),
  complianceAt: z.string().optional(),
  contractSignedAt: z.string().optional(),
  keysDeliveredAt: z.string().optional(),
  notes: z.string().optional(),
});

// GET /sales-history/me
router.get("/me", requireAuth, async (req, res) => {
  const userId = (req as any).session!.userId!;
  const rows = await db.select().from(salesHistoryTable)
    .where(eq(salesHistoryTable.userId, userId))
    .orderBy(desc(salesHistoryTable.createdAt));
  res.json(rows.map(fmtSale));
});

// GET /sales-history/user/:userId
router.get("/user/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const rows = await db.select().from(salesHistoryTable)
    .where(eq(salesHistoryTable.userId, userId))
    .orderBy(desc(salesHistoryTable.createdAt));
  res.json(rows.map(fmtSale));
});

// GET /sales-history (admin — all)
router.get("/", requireAuth, async (req, res) => {
  const rows = await db.select().from(salesHistoryTable)
    .orderBy(desc(salesHistoryTable.createdAt));
  res.json(rows.map(fmtSale));
});

// POST /sales-history
router.post("/", requireAuth, async (req, res) => {
  const session = (req as any).session!;
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const now = new Date();
  const stageDate: any = {};
  const stage = parsed.data.stage ?? "approved";
  if (stage === "approved") stageDate.approvedAt = now;

  const [created] = await db.insert(salesHistoryTable).values({
    userId: session.userId!,
    userName: session.userName ?? "Usuário",
    userRole: session.userRole ?? "broker",
    stage,
    ...stageDate,
    ...parsed.data,
  }).returning();

  res.status(201).json(fmtSale(created));
});

// PATCH /sales-history/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  const dateFields = ["approvedAt", "engineeringAt", "complianceAt", "contractSignedAt", "keysDeliveredAt"];
  for (const f of dateFields) if (updateData[f]) updateData[f] = new Date(updateData[f]);

  // Auto-set stage date if advancing stage
  if (parsed.data.stage) {
    const stageMap: Record<string, string> = {
      approved: "approvedAt", engineering: "engineeringAt", compliance: "complianceAt",
      contract_signed: "contractSignedAt", keys_delivered: "keysDeliveredAt",
    };
    const field = stageMap[parsed.data.stage];
    if (field && !updateData[field]) updateData[field] = new Date();
  }

  const [updated] = await db.update(salesHistoryTable)
    .set(updateData).where(eq(salesHistoryTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtSale(updated));
});

export default router;
