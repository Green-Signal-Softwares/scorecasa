import { Router } from "express";
import { db, leadsTable, brokersTable, usersTable, correspondentsTable } from "@workspace/db";
import { eq, sql, desc, and, or } from "drizzle-orm";

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
      res.json({
        totalLeads: 0,
        approvedLeads: 0,
        pendingLeads: 0,
        rejectedLeads: 0,
        averageApprovalChance: 0,
        averageScore: 0,
        monthlyApprovals: [],
        conversionRate: 0,
      });
      return;
    }
    conditions.push(eq(leadsTable.id, sessionUser.leadId));
  } else if (sessionUser.role === "broker") {
    const { brokerId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!brokerId) {
      res.json({
        totalLeads: 0,
        approvedLeads: 0,
        pendingLeads: 0,
        rejectedLeads: 0,
        averageApprovalChance: 0,
        averageScore: 0,
        monthlyApprovals: [],
        conversionRate: 0,
      });
      return;
    }
    conditions.push(eq(leadsTable.brokerId, brokerId));
  } else if (sessionUser.role === "correspondent") {
    const { correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!correspondentId) {
      res.json({
        totalLeads: 0,
        approvedLeads: 0,
        pendingLeads: 0,
        rejectedLeads: 0,
        averageApprovalChance: 0,
        averageScore: 0,
        monthlyApprovals: [],
        conversionRate: 0,
      });
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

  const [stats] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      approvedLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'approved')::int`,
      pendingLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'pending')::int`,
      rejectedLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'rejected')::int`,
      averageApprovalChance: sql<number>`coalesce(avg(${leadsTable.approvalChance}), 0)`,
      averageScore: sql<number>`coalesce(avg(${leadsTable.scoreCaixa}), 0)`,
    })
    .from(leadsTable)
    .where(where);

  const totalLeads = stats.totalLeads ?? 0;
  const approvedLeads = stats.approvedLeads ?? 0;
  const conversionRate = totalLeads > 0 ? (approvedLeads / totalLeads) * 100 : 0;

  const monthlyData = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${leadsTable.createdAt}), 'Mon/YYYY')`,
      leads: sql<number>`count(*)::int`,
      approvals: sql<number>`count(*) filter (where ${leadsTable.status} = 'approved')::int`,
    })
    .from(leadsTable)
    .where(where)
    .groupBy(sql`date_trunc('month', ${leadsTable.createdAt})`)
    .orderBy(sql`date_trunc('month', ${leadsTable.createdAt})`);

  res.json({
    totalLeads,
    approvedLeads,
    pendingLeads: stats.pendingLeads ?? 0,
    rejectedLeads: stats.rejectedLeads ?? 0,
    averageApprovalChance: Math.round((stats.averageApprovalChance ?? 0) * 10) / 10,
    averageScore: Math.round(stats.averageScore ?? 0),
    monthlyApprovals: monthlyData,
    conversionRate: Math.round(conversionRate * 10) / 10,
  });
});

export default router;
