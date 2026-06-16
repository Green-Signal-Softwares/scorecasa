import { Router } from "express";
import { db, leadsTable, brokersTable, usersTable, correspondentsTable } from "@workspace/db";
import { sql, desc, eq, and, or } from "drizzle-orm";

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

router.get("/brokers", async (req, res) => {
  const brokers = await db
    .select({
      id: brokersTable.id,
      name: brokersTable.name,
      approvedLeads: brokersTable.approvedLeads,
      totalLeads: brokersTable.totalLeads,
      approvalRate: brokersTable.approvalRate,
    })
    .from(brokersTable)
    .where(sql`${brokersTable.totalLeads} > 0`)
    .orderBy(desc(brokersTable.approvedLeads));

  const withVolume = await Promise.all(
    brokers.map(async (b, idx) => {
      const [vol] = await db
        .select({ volume: sql<number>`coalesce(sum(${leadsTable.propertyValue}), 0)` })
        .from(leadsTable)
        .where(sql`${leadsTable.brokerId} = ${b.id} and ${leadsTable.status} = 'approved'`);

      return {
        rank: idx + 1,
        brokerId: b.id,
        brokerName: b.name,
        approvedLeads: b.approvedLeads,
        totalLeads: b.totalLeads,
        approvalRate: Math.round(b.approvalRate * 10) / 10,
        volume: vol.volume ?? 0,
      };
    })
  );

  res.json(withVolume);
});

router.get("/leads", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const conditions = [];

  if (sessionUser.role === "client") {
    if (!sessionUser.leadId) {
      res.json([]);
      return;
    }
    conditions.push(eq(leadsTable.id, sessionUser.leadId));
  } else if (sessionUser.role === "broker") {
    const { brokerId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!brokerId) {
      res.json([]);
      return;
    }
    conditions.push(eq(leadsTable.brokerId, brokerId));
  } else if (sessionUser.role === "correspondent") {
    const { correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!correspondentId) {
      res.json([]);
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

  const leads = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      approvalChance: leadsTable.approvalChance,
      scoreCaixa: leadsTable.scoreCaixa,
      status: leadsTable.status,
    })
    .from(leadsTable)
    .where(where)
    .orderBy(desc(leadsTable.approvalChance))
    .limit(10);

  const ranked = leads.map((l, idx) => ({
    rank: idx + 1,
    leadId: l.id,
    leadName: l.name,
    approvalChance: l.approvalChance,
    scoreCaixa: l.scoreCaixa,
    status: l.status,
  }));

  res.json(ranked);
});

export default router;
