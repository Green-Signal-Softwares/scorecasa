import { Router } from "express";
import { db, usersTable, leadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";
import { z } from "zod";

const RegisterBody = z.object({
  name: z.string().min(2),
  cpf: z.string().min(11),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(6),
  income: z.number().positive(),
  propertyValue: z.number().positive(),
});

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "scorecasa_salt").digest("hex");
}

declare module "express-serve-static-core" {
  interface Request {
    session?: { userId?: number };
  }
}

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, cpf, email, phone, password, income, propertyValue } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const ratio = propertyValue / (income * 12);
  const maxRatio = 4.5;
  const baseChance = Math.max(0, Math.min(100, 100 - (ratio / maxRatio) * 60));
  const approvalChance = Math.round(Math.max(0, Math.min(100, baseChance + (Math.random() * 20 - 10))));
  const scoreCaixa = Math.round(300 + (approvalChance / 100) * 550 + (Math.random() * 80 - 40));
  const scoreMCMV = income <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);
  let recommendation = "";
  if (approvalChance >= 70) recommendation = "Perfil com alta chance de aprovação. Recomendamos prosseguir com a análise completa.";
  else if (approvalChance >= 50) recommendation = "Perfil com chances moderadas. Ajustando o comprometimento de renda, a aprovação pode ser garantida.";
  else recommendation = "Perfil com chances baixas. Sugerimos rever o valor do imóvel ou aumentar a renda comprovada.";

  const [lead] = await db.insert(leadsTable).values({
    name,
    cpf,
    email,
    phone,
    income,
    propertyValue,
    status: "pending",
    approvalChance,
    scoreCaixa,
    scoreMCMV,
    aiRecommendation: recommendation,
  }).returning();

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashPassword(password),
    role: "client",
    leadId: lead.id,
  }).returning();

  (req as any).session = (req as any).session ?? {};
  (req as any).session.userId = user.id;

  res.status(201).json({
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
      brokerName: null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  (req as any).session = (req as any).session ?? {};
  (req as any).session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
    },
  });
});

router.post("/logout", (req, res) => {
  if ((req as any).session) {
    (req as any).session.destroy?.();
  }
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const sessionUserId = (req as any).session?.userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  });
});

export default router;
