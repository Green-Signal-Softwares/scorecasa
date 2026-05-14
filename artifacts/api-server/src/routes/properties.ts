import { Router } from "express";
import { db, propertiesTable, propertyInterestsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

const CreatePropertyBody = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(["apartamento", "casa", "comercial", "terreno", "cobertura", "studio"]),
  price: z.number().positive(),
  condominiumFee: z.number().optional(),
  iptu: z.number().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2),
  zipCode: z.string().optional(),
  areaSqm: z.number().positive(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  parkingSpots: z.number().int().optional(),
  hasFurnished: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  imageUrl: z.string().optional(),
  imageUrl2: z.string().optional(),
  imageUrl3: z.string().optional(),
  acceptsFgts: z.boolean().optional(),
  acceptsMcmv: z.boolean().optional(),
  acceptsSbpe: z.boolean().optional(),
  brokerId: z.number().int().optional(),
  brokerName: z.string().optional(),
  brokerPhone: z.string().optional(),
});

const UpdatePropertyBody = CreatePropertyBody.partial().extend({
  status: z.enum(["available", "reserved", "sold", "inactive"]).optional(),
});

function formatProperty(p: any) {
  return {
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

// GET /properties
router.get("/", async (req, res) => {
  let rows = await db.select().from(propertiesTable).orderBy(sql`${propertiesTable.createdAt} DESC`);

  const { city, type, minPrice, maxPrice, status, brokerId } = req.query as any;
  if (city) rows = rows.filter((r) => r.city.toLowerCase().includes(String(city).toLowerCase()));
  if (type) rows = rows.filter((r) => r.type === type);
  if (minPrice) rows = rows.filter((r) => r.price >= Number(minPrice));
  if (maxPrice) rows = rows.filter((r) => r.price <= Number(maxPrice));
  if (status) rows = rows.filter((r) => r.status === status);
  if (brokerId) rows = rows.filter((r) => r.brokerId === Number(brokerId));

  res.json(rows.map(formatProperty));
});

// POST /properties
router.post("/", requireAuth, async (req, res) => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const [created] = await db.insert(propertiesTable).values(parsed.data).returning();
  res.status(201).json(formatProperty(created));
});

// GET /properties/interests/me
router.get("/interests/me", requireAuth, async (req, res) => {
  const userId = (req as any).session!.userId!;
  const interests = await db.select().from(propertyInterestsTable)
    .where(eq(propertyInterestsTable.userId, userId));
  res.json(interests.map((i) => i.propertyId));
});

// GET /properties/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProperty(row));
});

// PATCH /properties/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const [updated] = await db.update(propertiesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProperty(updated));
});

// DELETE /properties/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(propertiesTable).where(eq(propertiesTable.id, id));
  res.json({ ok: true });
});

// POST /properties/:id/interest
router.post("/:id/interest", requireAuth, async (req, res) => {
  const propertyId = Number(req.params.id);
  const userId = (req as any).session!.userId!;

  const [existing] = await db.select().from(propertyInterestsTable)
    .where(and(eq(propertyInterestsTable.propertyId, propertyId), eq(propertyInterestsTable.userId, userId)))
    .limit(1);

  if (existing) {
    await db.delete(propertyInterestsTable).where(eq(propertyInterestsTable.id, existing.id));
    res.json({ interested: false });
  } else {
    await db.insert(propertyInterestsTable).values({ propertyId, userId, status: "interested" });
    res.json({ interested: true });
  }
});

export default router;
