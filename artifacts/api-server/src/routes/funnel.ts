import { Router } from "express";
import { db, leadsTable, brokersTable, usersTable, correspondentsTable } from "@workspace/db";
import { eq, sql, and, or } from "drizzle-orm";

const router = Router();

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

async function getUserBrokerOrCorrespondentId(user: any) {
  if (user.role === "broker") {
    let [broker] = await db
      .select({ id: brokersTable.id, correspondentId: brokersTable.correspondentId })
      .from(brokersTable)
      .where(sql`lower(${brokersTable.email}) = lower(${user.email})`)
      .limit(1);
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
        .returning({ id: brokersTable.id, correspondentId: brokersTable.correspondentId });
      broker = newBroker;
    }
    return { brokerId: broker.id, correspondentId: broker.correspondentId ?? null };
  }
  if (user.role === "correspondent") {
    let [correspondent] = await db
      .select({ id: correspondentsTable.id })
      .from(correspondentsTable)
      .where(
        or(
          eq(correspondentsTable.userId, user.id),
          sql`lower(${correspondentsTable.email}) = lower(${user.email})`
        )
      )
      .limit(1);
    if (!correspondent) {
      const [newCorr] = await db
        .insert(correspondentsTable)
        .values({
          name: user.name,
          bank: "caixa",
          code: user.ccaCode || "000000",
          email: user.email.toLowerCase(),
          phone: "(11) 99999-9999",
          userId: user.id,
          status: "active",
        })
        .returning({ id: correspondentsTable.id });
      correspondent = newCorr;
    }
    return { correspondentId: correspondent.id, brokerId: null };
  }
  return { brokerId: null, correspondentId: null };
}

router.get("/", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const conditions = [];

  if (sessionUser.role === "client") {
    if (!sessionUser.leadId) {
      res.json({ stages: [] });
      return;
    }
    conditions.push(eq(leadsTable.id, sessionUser.leadId));
  } else if (sessionUser.role === "broker") {
    const { brokerId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!brokerId) {
      res.json({ stages: [] });
      return;
    }
    conditions.push(eq(leadsTable.brokerId, brokerId));
  } else if (sessionUser.role === "correspondent") {
    const { correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!correspondentId) {
      res.json({ stages: [] });
      return;
    }
    conditions.push(
      or(
        eq(leadsTable.correspondentId, correspondentId),
        eq(leadsTable.linkedCorrespondentId, correspondentId)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(where);

  const byStatus = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .where(where)
    .groupBy(leadsTable.status);

  const statusMap: Record<string, number> = Object.fromEntries(byStatus.map((r) => [r.status, r.count]));
  const total = totals.total || 0;

  const stages = [
    { name: "Leads Recebidos", count: total, percentage: 100 },
    {
      name: "Em Análise",
      count: (statusMap["analyzing"] ?? 0) + (statusMap["in_progress"] ?? 0),
      percentage: total ? Math.round((((statusMap["analyzing"] ?? 0) + (statusMap["in_progress"] ?? 0)) / total) * 100) : 0,
    },
    {
      name: "Pré-Aprovados",
      count: statusMap["in_progress"] ?? 0,
      percentage: total ? Math.round(((statusMap["in_progress"] ?? 0) / total) * 100) : 0,
    },
    {
      name: "Aprovados",
      count: statusMap["approved"] ?? 0,
      percentage: total ? Math.round(((statusMap["approved"] ?? 0) / total) * 100) : 0,
    },
  ];

  res.json({ stages });
});

export default router;
