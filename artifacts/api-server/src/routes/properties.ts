import { Router } from "express";
import { db, propertiesTable, propertyInterestsTable, usersTable, subscriptionsTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// Apenas admin/analista e corretor com add-on de Vitrine ativo podem
// cadastrar/editar/remover imóveis. Cliente e correspondente são view-only.
async function requireCanManageProperty(req: any, res: any, next: () => void) {
  const userId = (req as any).session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (user.role === "admin" || user.role === "analyst") { next(); return; }

  if (user.role === "broker") {
    const [sub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId)).limit(1);
    if (sub?.marketplaceAddon) { next(); return; }
    res.status(403).json({
      error: "Você precisa contratar o add-on de Vitrine de Imóveis na página Financeiro para divulgar imóveis.",
    });
    return;
  }

  // cliente, correspondente etc.
  res.status(403).json({ error: "Seu perfil não permite cadastrar imóveis." });
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
router.post("/", requireCanManageProperty, async (req, res) => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const userId = (req as any).session!.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  let data: any = parsed.data;

  if (user?.role === "broker") {
    // Anti-IDOR: brokerId é SEMPRE o próprio corretor, ignorando o input.
    data = { ...parsed.data, brokerId: userId };

    // Enforcement do limite do add-on contra o próprio brokerId.
    const [sub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId)).limit(1);
    if (sub?.marketplacePropertyLimit) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
        .from(propertiesTable).where(eq(propertiesTable.brokerId, userId));
      if (count >= sub.marketplacePropertyLimit) {
        res.status(403).json({
          error: `Limite de ${sub.marketplacePropertyLimit} imóveis atingido. Faça upgrade do add-on de Vitrine.`,
        });
        return;
      }
    }
  }

  const [created] = await db.insert(propertiesTable).values(data).returning();
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
router.patch("/:id", requireCanManageProperty, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const userId = (req as any).session!.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  // Para broker: bloqueia alteração de brokerId (não pode transferir imóvel)
  // e restringe a operação aos imóveis dele (anti-IDOR).
  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  let whereClause = eq(propertiesTable.id, id);
  if (user?.role === "broker") {
    delete updateData.brokerId;
    whereClause = and(eq(propertiesTable.id, id), eq(propertiesTable.brokerId, userId))!;
  }

  const [updated] = await db.update(propertiesTable)
    .set(updateData)
    .where(whereClause)
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProperty(updated));
});

// DELETE /properties/:id
router.delete("/:id", requireCanManageProperty, async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req as any).session!.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  // Broker só pode deletar imóvel próprio.
  const whereClause = user?.role === "broker"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.brokerId, userId))!
    : eq(propertiesTable.id, id);

  const deleted = await db.delete(propertiesTable).where(whereClause).returning();
  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }
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
    return;
  }

  await db.insert(propertyInterestsTable).values({ propertyId, userId, status: "interested" });

  // Notificar o corretor dono do imóvel.
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId)).limit(1);
  const [interestedUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (property?.brokerId && interestedUser) {
    const propTitle = property.title ?? "imóvel";
    const where = [property.neighborhood, property.city].filter(Boolean).join(", ");
    const locationSuffix = where ? ` em ${where}` : "";
    await db.insert(notificationsTable).values({
      type: "property_interest",
      userId: property.brokerId,
      propertyId: property.id,
      propertyTitle: propTitle,
      message: `${interestedUser.name} demonstrou interesse no imóvel "${propTitle}"${locationSuffix}.`,
    });
  }

  res.json({ interested: true });
});

export default router;
