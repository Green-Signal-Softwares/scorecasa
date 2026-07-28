import { Router } from "express";
import { db, usersTable, subscriptionsTable, plansTable, pool } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "scorecasa_salt").digest("hex");
}

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

async function requireAuth(req: any, res: any, next: () => void) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.sessionUser = user;
  next();
}

/**
 * Retorna os limites e o plano ativo da conta principal (Owner) do usuário logado
 */
export async function getAccountPlanLimits(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return { user, ownerId: userId, subscription: null, plan: null, userLimit: null, leadLimit: null };

  const mainOwnerId = (user as any).ownerId ?? user.id;

  const [sub] = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, mainOwnerId))
    .limit(1);

  let plan: any = null;
  if (sub) {
    const [p] = await db.select().from(plansTable).where(eq(plansTable.id, sub.plan)).limit(1);
    plan = p ?? null;
  }

  const userLimit = plan?.userLimit !== undefined ? plan.userLimit : null;
  const leadLimit = plan?.leadLimit !== undefined ? plan.leadLimit : null;

  return {
    user,
    mainOwnerId,
    subscription: sub ?? null,
    plan,
    userLimit,
    leadLimit,
  };
}

const InviteMemberBody = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha mínima de 6 caracteres"),
  title: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  creci: z.string().optional(),
  ccaCode: z.string().optional(),
});

const UpdatePermissionsBody = z.object({
  title: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

async function ensureUserColumns() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id integer;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[];
    `);
  } catch {}
}

// GET /api/team — Lista membros da equipe e status da cota do plano
router.get("/", requireAuth, async (req: any, res) => {
  try {
    await ensureUserColumns();
    const sessionUser = req.sessionUser;
    const limits = await getAccountPlanLimits(sessionUser.id);
    const mainOwnerId = limits.mainOwnerId;

    const ownerCol = (usersTable as any).ownerId ?? usersTable.id;
    const members = await db.select().from(usersTable)
      .where(or(eq(usersTable.id, mainOwnerId), eq(ownerCol, mainOwnerId)));

    const teamSubUsers = members.filter((m) => m.id !== mainOwnerId);
    const totalTeamSize = members.length;

    const userLimit = limits.userLimit;
    const hasTeamSupport = typeof userLimit === "number" && userLimit > 1;
    const canInvite = hasTeamSupport && (userLimit == null || totalTeamSize < userLimit);

    res.json({
      mainOwnerId,
      userRole: sessionUser.role,
      userLimit,
      leadLimit: limits.leadLimit,
      usedCount: totalTeamSize,
      subUsersCount: teamSubUsers.length,
      canInvite,
      planLabel: limits.plan?.label ?? "Plano Padrão",
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        title: (m as any).title ?? (m.id === mainOwnerId ? "Proprietário da Conta" : "Membro da Equipe"),
        permissions: (m as any).permissions ?? ["leads_view", "leads_create", "simulations", "properties"],
        isOwner: m.id === mainOwnerId,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/team/invite — Convida/cadastra um novo membro respeitando o limite do plano
router.post("/invite", requireAuth, async (req: any, res) => {
  try {
    await ensureUserColumns();
    const sessionUser = req.sessionUser;
    const parsed = InviteMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos para convite", details: parsed.error.issues });
      return;
    }

    const { name, email, password, title, permissions, creci, ccaCode } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificar se o e-mail já existe
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, cleanEmail)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado no sistema." });
      return;
    }

    // 2. Verificar os limites do plano da conta principal
    const limits = await getAccountPlanLimits(sessionUser.id);
    const mainOwnerId = limits.mainOwnerId;

    const ownerCol = (usersTable as any).ownerId ?? usersTable.id;
    const currentMembers = await db.select().from(usersTable)
      .where(or(eq(usersTable.id, mainOwnerId), eq(ownerCol, mainOwnerId)));

    const currentTeamSize = currentMembers.length;
    const userLimit = limits.userLimit;

    // RESPEITA O LIMITE MÁXIMO DO PLANO
    if (userLimit != null && currentTeamSize >= userLimit) {
      res.status(403).json({
        error: `Limite de usuários do seu plano atingido. Seu plano (${limits.plan?.label ?? "Atual"}) permite no máximo ${userLimit} usuário(s). Faça um upgrade para adicionar mais membros à sua equipe.`,
        userLimit,
        usedCount: currentTeamSize,
        upgradeRequired: true,
      });
      return;
    }

    // 3. Cadastrar o novo membro vinculado à conta principal (ownerId)
    const defaultPerms = permissions ?? ["leads_view", "leads_create", "simulations", "properties"];
    const memberTitle = title?.trim() || (sessionUser.role === "correspondent" ? "Assistente CCA" : "Corretor da Equipe");

    const insertPayload: any = {
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: sessionUser.role,
      ownerId: mainOwnerId,
      title: memberTitle,
      permissions: defaultPerms,
      creci: creci?.trim() || sessionUser.creci || undefined,
      ccaCode: ccaCode?.trim() || sessionUser.ccaCode || undefined,
    };

    const [newMember] = await db.insert(usersTable).values(insertPayload).returning();

    res.status(201).json({
      message: "Membro da equipe cadastrado com sucesso!",
      member: {
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        title: memberTitle,
        permissions: defaultPerms,
        isOwner: false,
        createdAt: newMember.createdAt.toISOString(),
      },
      usedCount: currentTeamSize + 1,
      userLimit,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/team/:id — Atualiza cargo e permissões de um membro
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    await ensureUserColumns();
    const sessionUser = req.sessionUser;
    const memberId = Number(req.params.id);
    const parsed = UpdatePermissionsBody.safeParse(req.body);

    if (!parsed.success || !Number.isInteger(memberId)) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }

    const limits = await getAccountPlanLimits(sessionUser.id);
    const mainOwnerId = limits.mainOwnerId;

    const ownerCol = (usersTable as any).ownerId ?? usersTable.id;
    const [member] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, memberId), eq(ownerCol, mainOwnerId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Membro não encontrado nesta equipe." });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (parsed.data.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(parsed.data.title);
    }
    if (parsed.data.permissions !== undefined) {
      updates.push(`permissions = $${idx++}`);
      values.push(parsed.data.permissions);
    }

    if (updates.length > 0) {
      values.push(memberId);
      await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`, values);
    }

    res.json({ message: "Permissões atualizadas com sucesso." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/team/:id — Remove um membro da equipe
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const sessionUser = req.sessionUser;
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId)) {
      res.status(400).json({ error: "ID de membro inválido." });
      return;
    }

    const limits = await getAccountPlanLimits(sessionUser.id);
    const mainOwnerId = limits.mainOwnerId;

    if (memberId === mainOwnerId) {
      res.status(400).json({ error: "Não é possível remover a conta proprietária da equipe." });
      return;
    }

    const ownerCol = (usersTable as any).ownerId ?? usersTable.id;
    const [member] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, memberId), eq(ownerCol, mainOwnerId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Membro da equipe não encontrado." });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, memberId));

    res.json({ message: "Membro removido da equipe com sucesso." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
