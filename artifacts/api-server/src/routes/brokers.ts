import { Router } from "express";
import { db, brokersTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import {
  CreateBrokerBody,
  UpdateBrokerBody,
  GetBrokersQueryParams,
  GetBrokerParams,
  UpdateBrokerParams,
} from "@workspace/api-zod";

const router = Router();

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
