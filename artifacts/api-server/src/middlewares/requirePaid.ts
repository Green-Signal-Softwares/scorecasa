import { Request, Response, NextFunction } from "express";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requirePaid(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Admins bypass payment checks
    if (user.role === "admin") {
      return next();
    }

    // Get subscription details
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
    if (!sub) {
      res.status(403).json({ error: "Assinatura pendente ou vencida", code: "PAYMENT_REQUIRED" });
      return;
    }

    // Bypass free or enterprise plans
    if (sub.plan === "free" || sub.plan === "enterprise") {
      return next();
    }

    const nextDueAt = sub.nextDueAt ? new Date(sub.nextDueAt) : null;
    const now = new Date();
    const isRecurringValid = nextDueAt ? nextDueAt.getTime() >= now.getTime() : false;

    // Allow only active or trial subscriptions with a valid upcoming billing date
    if ((sub.status === "active" || sub.status === "trial") && isRecurringValid) {
      return next();
    }

    res.status(403).json({ error: "Assinatura pendente ou vencida", code: "PAYMENT_REQUIRED" });
  } catch (error) {
    next(error);
  }
}
