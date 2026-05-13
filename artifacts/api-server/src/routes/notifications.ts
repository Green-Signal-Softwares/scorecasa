import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => !r.isRead).length;

  res.json({
    notifications: rows.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
});

router.post("/read-all", async (_req, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.isRead, false));
  res.json({ ok: true });
});

router.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id));
  res.json({ ok: true });
});

export default router;
