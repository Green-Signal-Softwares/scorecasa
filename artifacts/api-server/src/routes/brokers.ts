import { Router } from "express";
import { db, brokersTable, correspondentsTable, usersTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import {
  CreateBrokerBody,
  UpdateBrokerBody,
  GetBrokersQueryParams,
  GetBrokerParams,
  UpdateBrokerParams,
} from "@workspace/api-zod";

const router = Router();

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

async function requireBroker(req: any, res: any, next: any) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "broker") {
    res.status(403).json({ error: "Apenas corretores podem acessar esta rota." });
    return;
  }
  req.sessionUser = user;
  next();
}

async function getBrokerProfile(email: string) {
  let [broker] = await db
    .select()
    .from(brokersTable)
    .where(sql`lower(${brokersTable.email}) = lower(${email})`)
    .limit(1);
  return broker ?? null;
}

async function getOrCreateBrokerProfile(user: any) {
  let broker = await getBrokerProfile(user.email);
  if (!broker) {
    const [newBroker] = await db
      .insert(brokersTable)
      .values({
        name: user.name,
        email: user.email.toLowerCase(),
        phone: "(11) 99999-9999",
        creci: user.creci || "000000",
        status: "active",
      })
      .returning();
    broker = newBroker;
  }
  return broker;
}

router.get("/", async (req, res) => {
  const parsed = GetBrokersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const { search } = parsed.data;
  let query = db.select().from(brokersTable).$dynamic();
  if (search) {
    query = query.where(ilike(brokersTable.name, `%${search}%`));
  }

  const brokers = await query;
  res.json(
    brokers.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const parsed = CreateBrokerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [broker] = await db.insert(brokersTable).values(parsed.data).returning();
  res.status(201).json({ ...broker, createdAt: broker.createdAt.toISOString() });
});

router.get("/my-correspondent", requireBroker, async (req: any, res) => {
  try {
    const user = req.sessionUser;
    const broker = await getOrCreateBrokerProfile(user);

    let linkedCorrespondent = null;
    if (broker.correspondentId) {
      const [corr] = await db
        .select()
        .from(correspondentsTable)
        .where(eq(correspondentsTable.id, broker.correspondentId))
        .limit(1);
      if (corr) {
        linkedCorrespondent = {
          ...corr,
          createdAt: corr.createdAt?.toISOString(),
        };
      }
    }

    const activeCorrs = await db
      .select()
      .from(correspondentsTable)
      .where(eq(correspondentsTable.status, "active"));

    res.json({
      linkedCorrespondent,
      availableCorrespondents: activeCorrs.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/link-correspondent", requireBroker, async (req: any, res) => {
  try {
    const user = req.sessionUser;
    const { correspondentId, code } = req.body;

    const broker = await getOrCreateBrokerProfile(user);
    let targetCorrespondentId = correspondentId;

    if (code) {
      const cleanDigits = code.replace(/\D/g, "");
      const activeCorrs = await db
        .select()
        .from(correspondentsTable)
        .where(eq(correspondentsTable.status, "active"));

      const found = activeCorrs.find((c) => {
        const cDigits = c.code.replace(/\D/g, "");
        return cDigits === cleanDigits;
      });

      if (!found) {
        res.status(400).json({ error: "Correspondente com o CCA/Código informado não foi encontrado." });
        return;
      }
      targetCorrespondentId = found.id;
    }

    if (targetCorrespondentId !== null && targetCorrespondentId !== undefined) {
      const [corr] = await db
        .select()
        .from(correspondentsTable)
        .where(eq(correspondentsTable.id, targetCorrespondentId))
        .limit(1);
      if (!corr || corr.status !== "active") {
        res.status(400).json({ error: "Correspondente não encontrado ou inativo." });
        return;
      }
    }

    await db
      .update(brokersTable)
      .set({ correspondentId: targetCorrespondentId ?? null })
      .where(eq(brokersTable.id, broker.id));

    let linkedCorrespondent = null;
    if (targetCorrespondentId) {
      const [corr] = await db
        .select()
        .from(correspondentsTable)
        .where(eq(correspondentsTable.id, targetCorrespondentId))
        .limit(1);
      if (corr) {
        linkedCorrespondent = {
          ...corr,
          createdAt: corr.createdAt?.toISOString(),
        };
      }
    }

    const activeCorrs = await db
      .select()
      .from(correspondentsTable)
      .where(eq(correspondentsTable.status, "active"));

    res.json({
      linkedCorrespondent,
      availableCorrespondents: activeCorrs.map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {

  const parsed = GetBrokerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [broker] = await db.select().from(brokersTable).where(eq(brokersTable.id, parsed.data.id)).limit(1);
  if (!broker) {
    res.status(404).json({ error: "Broker not found" });
    return;
  }

  res.json({ ...broker, createdAt: broker.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const paramsParsed = UpdateBrokerParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateBrokerBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(brokersTable).where(eq(brokersTable.id, paramsParsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Broker not found" });
    return;
  }

  const updateData: Record<string, any> = { ...bodyParsed.data };
  if (bodyParsed.data.status !== undefined) {
    const totalLeads = existing.totalLeads;
    const approvedLeads = existing.approvedLeads;
    updateData.approvalRate = totalLeads > 0 ? (approvedLeads / totalLeads) * 100 : 0;
  }

  const [updated] = await db.update(brokersTable).set(updateData).where(eq(brokersTable.id, paramsParsed.data.id)).returning();
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

export default router;
