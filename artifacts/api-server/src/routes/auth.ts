import { Router } from "express";
import { db, usersTable, leadsTable, subscriptionsTable, PLAN_TIERS, type PlanTierId } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";
import { z } from "zod";

const PLAN_IDS = Object.keys(PLAN_TIERS) as [PlanTierId, ...PlanTierId[]];

const RegisterBody = z.object({
  role: z.enum(["client", "broker", "correspondent"]).default("client"),
  plan: z.enum(PLAN_IDS).optional(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(6),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  creci: z.string().optional(),
  income: z.number().positive().optional(),
  propertyValue: z.number().positive().optional(),
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
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { role, plan, name, email, phone, password, cpf, cnpj, creci, income, propertyValue } = parsed.data;

  // Resolve and validate plan against role
  const planId: PlanTierId = (plan ??
    (role === "client" ? "free" : role === "broker" ? "corretor" : "bank_connect")) as PlanTierId;
  const planTier = PLAN_TIERS[planId];
  if (!planTier || planTier.role !== role) {
    res.status(400).json({ error: "Plan does not match the selected profile" });
    return;
  }

  // Profile-specific validation
  if (role === "client") {
    if (!cpf || cpf.length !== 11) {
      res.status(400).json({ error: "CPF é obrigatório (11 dígitos) para conta cliente." });
      return;
    }
    if (!income || !propertyValue) {
      res.status(400).json({ error: "Renda e valor do imóvel são obrigatórios para conta cliente." });
      return;
    }
  } else if (cpf && cpf.length !== 11) {
    res.status(400).json({ error: "CPF inválido (deve ter 11 dígitos)." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email já cadastrado." });
    return;
  }

  // Build pro-account metadata note
  const noteParts: string[] = [];
  if (planTier.enterprise) noteParts.push("Plano empresarial — equipe comercial entrará em contato.");
  if (cnpj) noteParts.push("CNPJ: " + cnpj);
  if (creci) noteParts.push("CRECI: " + creci);

  // Atomic write: lead (client only) + user + subscription
  let user: typeof usersTable.$inferSelect;
  let trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + 14);

  try {
    user = await db.transaction(async (tx) => {
      let leadId: number | null = null;

      if (role === "client" && income && propertyValue && cpf) {
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

        const [lead] = await tx.insert(leadsTable).values({
          name, cpf, email, phone, income, propertyValue,
          status: "pending",
          approvalChance, scoreCaixa, scoreMCMV,
          aiRecommendation: recommendation,
        }).returning();
        leadId = lead.id;
      }

      const [createdUser] = await tx.insert(usersTable).values({
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        leadId,
      }).returning();

      await tx.insert(subscriptionsTable).values({
        userId: createdUser.id,
        userName: createdUser.name,
        userEmail: createdUser.email,
        userRole: createdUser.role,
        plan: planId,
        status: "trial",
        priceMonthly: planTier.priceMonthly,
        billingDay: 1,
        trialEndsAt: trialEnd,
        nextDueAt: nextDue,
        notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
      });

      return createdUser;
    });
  } catch (err) {
    req.log.error({ err }, "registration transaction failed");
    res.status(500).json({ error: "Erro ao criar conta. Tente novamente." });
    return;
  }

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
    plan: {
      id: planId,
      label: planTier.label,
      priceMonthly: planTier.priceMonthly,
      enterprise: planTier.enterprise,
      trialEndsAt: trialEnd.toISOString(),
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
