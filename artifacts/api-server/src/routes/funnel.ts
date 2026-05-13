import { Router } from "express";
import { db, leadsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leadsTable);

  const byStatus = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.status);

  const statusMap: Record<string, number> = Object.fromEntries(byStatus.map((r) => [r.status, r.count]));
  const total = totals.total || 1;

  const stages = [
    { name: "Leads Recebidos", count: total, percentage: 100 },
    {
      name: "Em Análise",
      count: (statusMap["analyzing"] ?? 0) + (statusMap["in_progress"] ?? 0),
      percentage: Math.round((((statusMap["analyzing"] ?? 0) + (statusMap["in_progress"] ?? 0)) / total) * 100),
    },
    {
      name: "Pré-Aprovados",
      count: statusMap["in_progress"] ?? 0,
      percentage: Math.round(((statusMap["in_progress"] ?? 0) / total) * 100),
    },
    {
      name: "Aprovados",
      count: statusMap["approved"] ?? 0,
      percentage: Math.round(((statusMap["approved"] ?? 0) / total) * 100),
    },
  ];

  res.json({ stages });
});

export default router;
