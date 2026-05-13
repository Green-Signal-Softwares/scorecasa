import { Router } from "express";
import { db, leadsTable, brokersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const [stats] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      approvedLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'approved')::int`,
      pendingLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'pending')::int`,
      rejectedLeads: sql<number>`count(*) filter (where ${leadsTable.status} = 'rejected')::int`,
      averageApprovalChance: sql<number>`coalesce(avg(${leadsTable.approvalChance}), 0)`,
      averageScore: sql<number>`coalesce(avg(${leadsTable.scoreCaixa}), 0)`,
    })
    .from(leadsTable);

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
