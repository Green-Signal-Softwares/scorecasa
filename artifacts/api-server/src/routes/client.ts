import { Router } from "express";
import { db, usersTable, leadsTable, brokersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireClient(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function getClientProfile(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) return null;

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) return null;

  let brokerName: string | null = null;
  if (lead.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      leadId: user.leadId,
    },
    lead: {
      ...lead,
      brokerName,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
  };
}

router.get("/profile", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const profile = await getClientProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.put("/profile", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { income, propertyValue, phone, name } = req.body as {
    income?: number;
    propertyValue?: number;
    phone?: string;
    name?: string;
  };

  const leadUpdate: Record<string, any> = { updatedAt: new Date() };
  if (typeof income === "number") leadUpdate.income = income;
  if (typeof propertyValue === "number") leadUpdate.propertyValue = propertyValue;
  if (typeof phone === "string") leadUpdate.phone = phone;
  if (typeof name === "string") leadUpdate.name = name;

  if (typeof income === "number" || typeof propertyValue === "number") {
    const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
    if (existing) {
      const inc = typeof income === "number" ? income : existing.income;
      const pv = typeof propertyValue === "number" ? propertyValue : existing.propertyValue;
      const ratio = pv / (inc * 12);
      const maxRatio = 4.5;
      const baseChance = Math.max(0, Math.min(100, 100 - (ratio / maxRatio) * 60));
      const approvalChance = Math.round(Math.max(0, Math.min(100, baseChance + (Math.random() * 20 - 10))));
      const scoreCaixa = Math.round(300 + (approvalChance / 100) * 550 + (Math.random() * 80 - 40));
      const scoreMCMV = inc <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);
      const clampedChance = Math.max(0, Math.min(100, approvalChance));
      let recommendation = "";
      if (clampedChance >= 70) recommendation = "Perfil com alta chance de aprovação. Recomendamos prosseguir com a análise completa.";
      else if (clampedChance >= 50) recommendation = "Perfil com chances moderadas. Ajustando o comprometimento de renda, a aprovação pode ser garantida.";
      else recommendation = "Perfil com chances baixas. Sugerimos rever o valor do imóvel ou aumentar a renda comprovada.";
      Object.assign(leadUpdate, { approvalChance, scoreCaixa, scoreMCMV, aiRecommendation: recommendation });
    }
  }

  if (typeof name === "string") {
    await db.update(usersTable).set({ name }).where(eq(usersTable.id, userId));
  }

  await db.update(leadsTable).set(leadUpdate).where(eq(leadsTable.id, user.leadId));

  const profile = await getClientProfile(userId);
  res.json(profile);
});

export default router;
