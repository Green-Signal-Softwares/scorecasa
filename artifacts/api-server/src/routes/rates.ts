import { Router } from "express";
import {
  db,
  usersTable,
  bankRatesTable,
  bankRateHistoryTable,
  rateSyncRunsTable,
} from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { runRatesSync } from "../lib/rates-sync";

const router = Router();

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return user ?? null;
}

async function requireAuth(req: any, res: any, next: any) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.sessionUser = user;
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  const user = req.sessionUser;
  if (!user || !["admin", "analyst"].includes(user.role)) {
    res.status(403).json({ error: "Acesso restrito ao staff." });
    return;
  }
  next();
}

const DIVERGENCE_THRESHOLD = 0.25;

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function serializeRate(r: any) {
  const rate = toNum(r.rateAA);
  const prev = r.previousRateAA != null ? toNum(r.previousRateAA) : null;
  const ref = r.bcbReferenceRate != null ? toNum(r.bcbReferenceRate) : null;
  const divergence =
    r.source === "manual" && ref != null ? Math.abs(rate - ref) : 0;
  const staleDays = r.reviewedAt
    ? Math.floor((Date.now() - new Date(r.reviewedAt).getTime()) / 86_400_000)
    : Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / 86_400_000);
  return {
    id: r.id,
    bankSlug: r.bankSlug,
    bankName: r.bankName,
    product: r.product,
    productLabel: r.productLabel,
    rateAA: rate,
    previousRateAA: prev,
    bcbReferenceRate: ref,
    source: r.source,
    notes: r.notes,
    updatedAt: r.updatedAt,
    reviewedAt: r.reviewedAt,
    staleDays,
    divergence,
    hasDivergence:
      r.source === "manual" && divergence >= DIVERGENCE_THRESHOLD,
    needsReview: staleDays >= 7 && r.source === "manual",
  };
}

// ── Público (uso interno do app): taxa atual por (bank,product) ───────────
router.get("/current", async (_req, res) => {
  const rows = await db.select().from(bankRatesTable);
  res.json(rows.map(serializeRate));
});

// ── Admin: histórico ───────────────────────────────────────────────────────
router.get("/history", requireAuth, requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 90), 7), 730);
  const cutoff = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rows = await db
    .select()
    .from(bankRateHistoryTable)
    .where(gte(bankRateHistoryTable.observedOn, cutoff))
    .orderBy(bankRateHistoryTable.observedOn);
  res.json(
    rows.map((r) => ({
      bankSlug: r.bankSlug,
      product: r.product,
      observedOn: r.observedOn,
      rateAA: toNum(r.rateAA),
      source: r.source,
    })),
  );
});

// ── Admin: últimas execuções da rotina BCB ────────────────────────────────
router.get("/runs", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(rateSyncRunsTable)
    .orderBy(desc(rateSyncRunsTable.startedAt))
    .limit(30);
  res.json(rows);
});

// ── Admin: disparar rotina manualmente ────────────────────────────────────
router.post("/refresh", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await runRatesSync("manual");
    res.json({
      ok: true,
      rowsProcessed: result.rowsProcessed,
      rowsChanged: result.rowsChanged,
      changes: result.changes,
      divergences: result.divergences,
      bcbReference: result.bcbReference,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: message });
  }
});

// ── Admin: editar taxa cadastrada manualmente ─────────────────────────────
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const [existing] = await db
    .select()
    .from(bankRatesTable)
    .where(eq(bankRatesTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Taxa não encontrada" });
    return;
  }
  if (existing.source !== "manual") {
    res
      .status(400)
      .json({ error: "Taxas com fonte BCB são atualizadas automaticamente." });
    return;
  }
  const body = req.body ?? {};
  const newRate = Number(body.rateAA);
  if (!Number.isFinite(newRate) || newRate <= 0 || newRate > 100) {
    res.status(400).json({ error: "rateAA inválido" });
    return;
  }
  const notes = typeof body.notes === "string" ? body.notes : existing.notes;
  const userId = (req as any).sessionUser?.id as number | undefined;

  const currentRate = toNum(existing.rateAA);
  const changed = Math.abs(newRate - currentRate) >= 0.005;

  const [updated] = await db
    .update(bankRatesTable)
    .set({
      rateAA: String(newRate),
      previousRateAA: changed ? existing.rateAA : existing.previousRateAA,
      notes,
      updatedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: userId,
    })
    .where(eq(bankRatesTable.id, id))
    .returning();

  if (changed && updated) {
    const today = new Date().toISOString().slice(0, 10);
    await db
      .insert(bankRateHistoryTable)
      .values({
        bankSlug: updated.bankSlug,
        product: updated.product,
        observedOn: today,
        rateAA: String(newRate),
        source: "manual",
      })
      .onConflictDoUpdate({
        target: [
          bankRateHistoryTable.bankSlug,
          bankRateHistoryTable.product,
          bankRateHistoryTable.observedOn,
        ],
        set: { rateAA: String(newRate), source: "manual" },
      });
  }

  res.json(serializeRate(updated));
});

// ── Admin: marcar como revisada (sem alterar valor) ───────────────────────
router.post("/:id/acknowledge", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const userId = (req as any).sessionUser?.id as number | undefined;
  const [updated] = await db
    .update(bankRatesTable)
    .set({ reviewedAt: new Date(), reviewedBy: userId })
    .where(eq(bankRatesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Taxa não encontrada" });
    return;
  }
  res.json(serializeRate(updated));
});

export default router;
