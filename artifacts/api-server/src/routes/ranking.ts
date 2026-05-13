import { Router } from "express";
import { db, leadsTable, brokersTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";

const router = Router();

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
  const leads = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      approvalChance: leadsTable.approvalChance,
      scoreCaixa: leadsTable.scoreCaixa,
      status: leadsTable.status,
    })
    .from(leadsTable)
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
