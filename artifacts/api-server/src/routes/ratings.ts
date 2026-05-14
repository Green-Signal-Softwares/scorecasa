import { Router } from "express";
import { db, ratingsTable } from "@workspace/db";
import { eq, desc, avg, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

function fmtRating(r: any) {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt };
}

const CreateRatingBody = z.object({
  toUserId: z.number().int(),
  toUserName: z.string(),
  toUserRole: z.enum(["broker", "correspondent"]),
  leadId: z.number().int().optional(),
  propertyTitle: z.string().optional(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// GET /ratings/user/:userId — ratings recebidas por um usuário
router.get("/user/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  const rows = await db.select().from(ratingsTable)
    .where(eq(ratingsTable.toUserId, userId))
    .orderBy(desc(ratingsTable.createdAt));

  const avgResult = await db.select({ avg: avg(ratingsTable.stars), total: count() })
    .from(ratingsTable).where(eq(ratingsTable.toUserId, userId));

  res.json({
    ratings: rows.map(fmtRating),
    average: Number(avgResult[0]?.avg ?? 0),
    total: Number(avgResult[0]?.total ?? 0),
  });
});

// GET /ratings/me — ratings que eu recebi
router.get("/me", requireAuth, async (req, res) => {
  const userId = (req as any).session!.userId!;
  const rows = await db.select().from(ratingsTable)
    .where(eq(ratingsTable.toUserId, userId))
    .orderBy(desc(ratingsTable.createdAt));

  const avgResult = await db.select({ avg: avg(ratingsTable.stars), total: count() })
    .from(ratingsTable).where(eq(ratingsTable.toUserId, userId));

  res.json({
    ratings: rows.map(fmtRating),
    average: Number(avgResult[0]?.avg ?? 0),
    total: Number(avgResult[0]?.total ?? 0),
  });
});

// POST /ratings — criar avaliação
router.post("/", requireAuth, async (req, res) => {
  const session = (req as any).session!;
  const parsed = CreateRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [created] = await db.insert(ratingsTable).values({
    fromUserId: session.userId!,
    fromUserName: session.userName ?? "Usuário",
    ...parsed.data,
  }).returning();

  res.status(201).json(fmtRating(created));
});

export default router;
