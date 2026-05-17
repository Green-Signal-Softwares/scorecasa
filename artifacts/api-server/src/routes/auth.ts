import { Router } from "express";
import { db, usersTable, leadsTable, subscriptionsTable, passwordResetsTable, PLAN_TIERS, type PlanTierId } from "@workspace/db";
import { and, eq, isNull, gt } from "drizzle-orm";
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
    res.status(409).json({ error: "Email já cadastrado. Faça login ou recupere sua senha." });
    return;
  }

  // CPF unique pre-check (evita 500 por violação de unique constraint).
  // Só aplica quando enviamos cpf para a tabela users (role=client).
  if (role === "client" && cpf) {
    const cpfDigits = cpf.replace(/\D/g, "");
    const [byCpf] = await db.select().from(usersTable).where(eq(usersTable.cpf, cpfDigits)).limit(1);
    if (byCpf) {
      res.status(409).json({
        error: "Este CPF já tem uma conta na ScoreCasa. Faça login com seu CPF e senha, ou recupere sua senha.",
      });
      return;
    }
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

      // Só persistimos CPF em users quando o perfil exige (cliente PF).
      // Corretores/correspondentes não devem ocupar o índice único de CPF.
      const userCpf = role === "client" && cpf ? cpf.replace(/\D/g, "") : null;
      const [createdUser] = await tx.insert(usersTable).values({
        name,
        email,
        cpf: userCpf,
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
  } catch (err: any) {
    // Fallback para corridas que escapem do pré-check (dois requests no mesmo
    // milissegundo com mesmo email/cpf). PostgreSQL retorna SQLSTATE 23505.
    const code = err?.code ?? err?.cause?.code;
    const constraint = (err?.constraint ?? err?.cause?.constraint ?? "").toString();
    if (code === "23505") {
      if (constraint.includes("cpf")) {
        res.status(409).json({
          error: "Este CPF já tem uma conta na ScoreCasa. Faça login com seu CPF e senha, ou recupere sua senha.",
        });
        return;
      }
      if (constraint.includes("email")) {
        res.status(409).json({ error: "Email já cadastrado. Faça login ou recupere sua senha." });
        return;
      }
    }
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

  // Aceita e-mail OU CPF (11 dígitos numéricos)
  const identifier = email.trim();
  const cpfDigits = identifier.replace(/\D/g, "");
  const isCpf = cpfDigits.length === 11 && /^\d+$/.test(cpfDigits);

  const [user] = isCpf
    ? await db.select().from(usersTable).where(eq(usersTable.cpf, cpfDigits)).limit(1)
    : await db.select().from(usersTable).where(eq(usersTable.email, identifier.toLowerCase())).limit(1);

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

const ForgotBody = z.object({
  identifier: z.string().min(1),
});

const ResetBody = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(req: any, token: string): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host;
  return `${proto}://${host}/redefinir-senha?token=${token}`;
}

router.post("/forgot-password", async (req, res) => {
  const parsed = ForgotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um email ou CPF." });
    return;
  }

  const raw = parsed.data.identifier.trim();
  const cpfDigits = raw.replace(/\D/g, "");
  const isCpf = cpfDigits.length === 11 && /^\d+$/.test(cpfDigits);

  const [user] = isCpf
    ? await db.select().from(usersTable).where(eq(usersTable.cpf, cpfDigits)).limit(1)
    : await db.select().from(usersTable).where(eq(usersTable.email, raw.toLowerCase())).limit(1);

  // Resposta neutra para evitar enumeração — sempre 200 com a mesma mensagem,
  // mudando apenas se há resetUrl (em modo DEV) ou não.
  if (!user) {
    res.json({
      ok: true,
      message: "Se a conta existir, um link de redefinição foi gerado.",
      resetUrl: null,
      emailDelivered: false,
    });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.insert(passwordResetsTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = buildResetUrl(req, token);
  // Não logamos a URL/token em texto puro (credencial-equivalente).
  req.log.info({ userId: user.id }, "password reset token generated");

  // ATENÇÃO: modo DEV (sem provedor de email conectado).
  // Devolvemos o resetUrl na resposta porque o usuário escolheu este modo
  // explicitamente para testes. ISSO PERMITE TAKEOVER DE CONTA se ficar em
  // produção com usuários reais. Antes de liberar para usuários reais:
  //   1. Conecte SendGrid/Resend.
  //   2. Envie `resetUrl` por email.
  //   3. Remova os campos `resetUrl`/`expiresAt`/`emailDelivered` desta resposta
  //      e devolva apenas a mensagem genérica usada acima para usuário não encontrado.
  res.json({
    ok: true,
    message: "Se a conta existir, um link de redefinição foi gerado.",
    resetUrl,
    expiresAt: expiresAt.toISOString(),
    emailDelivered: false,
  });
});

router.post("/reset-password", async (req, res) => {
  const parsed = ResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Token ou senha inválidos. A senha precisa ter ao menos 6 caracteres." });
    return;
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);
  const now = new Date();

  // Consumo atômico: só "ganha" o token quem conseguir marcá-lo como usado
  // numa única operação. Evita corrida onde dois requests reaproveitam o
  // mesmo token.
  const claimed = await db
    .update(passwordResetsTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetsTable.tokenHash, tokenHash),
        isNull(passwordResetsTable.usedAt),
        gt(passwordResetsTable.expiresAt, now),
      ),
    )
    .returning();

  const reset = claimed[0];
  if (!reset) {
    res.status(400).json({ error: "Link inválido ou expirado. Solicite um novo." });
    return;
  }

  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(usersTable.id, reset.userId));

  req.log.info({ userId: reset.userId }, "password reset completed");

  res.json({ ok: true, message: "Senha redefinida com sucesso. Faça login com a nova senha." });
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
