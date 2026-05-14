import { Router } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, or, isNull, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Staff (admin/analyst) vê tudo: notificações broadcast (userId NULL) + as direcionadas a si.
  // Corretor/cliente/correspondente veem APENAS as direcionadas a eles.
  const isStaff = user.role === "admin" || user.role === "analyst";
  const filter = isStaff
    ? or(isNull(notificationsTable.userId), eq(notificationsTable.userId, userId))
    : eq(notificationsTable.userId, userId);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(filter)
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

router.post("/read-all", async (req, res) => {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const isStaff = user.role === "admin" || user.role === "analyst";
  const filter = isStaff
    ? and(eq(notificationsTable.isRead, false), or(isNull(notificationsTable.userId), eq(notificationsTable.userId, userId)))
    : and(eq(notificationsTable.isRead, false), eq(notificationsTable.userId, userId));

  await db.update(notificationsTable).set({ isRead: true }).where(filter);
  res.json({ ok: true });
});

router.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const isStaff = user.role === "admin" || user.role === "analyst";
  const filter = isStaff
    ? and(eq(notificationsTable.id, id), or(isNull(notificationsTable.userId), eq(notificationsTable.userId, userId)))
    : and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId));

  await db.update(notificationsTable).set({ isRead: true }).where(filter);
  res.json({ ok: true });
});

export default router;
