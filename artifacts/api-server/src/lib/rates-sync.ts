import {
  db,
  pool,
  bankRatesTable,
  bankRateHistoryTable,
  rateSyncRunsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  fetchBcbSnapshot,
  mapCaixaProductsFromBcb,
  bcbReferenceFor,
  type BcbSnapshot,
} from "./bcb-rates";
import { logger } from "./logger";

const ADVISORY_LOCK_KEY = 91923471; // chave fixa para pg_advisory_lock
const DIVERGENCE_THRESHOLD = 0.25; // p.p.

function round4(n: number) {
  return Math.round(n * 10_000) / 10_000;
}

function todayISO() {
  // Data corrente em BRT (UTC-3, sem horário de verão desde 2019).
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

async function notifyAdmins(message: string, type: string) {
  // Broadcast: userId NULL → visível no painel de notificações para staff.
  await db.insert(notificationsTable).values({
    type,
    userId: null,
    message,
  });
}

interface SyncResult {
  rowsProcessed: number;
  rowsChanged: number;
  changes: Array<{ bankSlug: string; product: string; from: number; to: number }>;
  divergences: Array<{ bankSlug: string; product: string; rate: number; reference: number }>;
  bcbReference: number | null;
}

/**
 * Executa um ciclo de sincronização BCB:
 *   1. Busca snapshot do BCB.
 *   2. Atualiza linhas Caixa cujo source = "bcb" quando a taxa muda.
 *   3. Anota referência BCB nas linhas manuais e marca divergência ≥ 0.25 p.p.
 *   4. Insere/atualiza histórico do dia para todas as linhas.
 *   5. Registra a execução em rate_sync_runs e gera notificações.
 *
 * É protegida por pg_try_advisory_lock para que múltiplas instâncias não rodem
 * simultaneamente.
 */
export async function runRatesSync(
  trigger: "scheduled" | "manual" = "scheduled",
): Promise<SyncResult> {
  // Advisory lock precisa rodar e ser liberado na MESMA conexão; usamos o pool
  // diretamente para garantir isso (db.execute pode pegar conexões distintas).
  const lockClient = await pool.connect();
  let locked = false;
  try {
    const lockRes = await lockClient.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [ADVISORY_LOCK_KEY],
    );
    locked = lockRes.rows[0]?.locked === true;
    if (!locked) {
      logger.warn("rates-sync: advisory lock busy — skipping");
      throw new Error("Outra execução de sincronização já está em andamento.");
    }
    return await runWithLock(trigger);
  } finally {
    try {
      if (locked) {
        await lockClient.query("SELECT pg_advisory_unlock($1)", [
          ADVISORY_LOCK_KEY,
        ]);
      }
    } catch (e) {
      logger.warn({ err: e }, "rates-sync: falha ao liberar advisory lock");
    }
    lockClient.release();
  }
}

async function runWithLock(
  trigger: "scheduled" | "manual",
): Promise<SyncResult> {
  const [run] = await db
    .insert(rateSyncRunsTable)
    .values({ trigger, source: "bcb" })
    .returning();
  if (!run) throw new Error("Falha ao criar registro de execução");

  const result: SyncResult = {
    rowsProcessed: 0,
    rowsChanged: 0,
    changes: [],
    divergences: [],
    bcbReference: null,
  };

  try {
    const snap = await fetchBcbSnapshot();
    await applySnapshot(snap, result);

    await db
      .update(rateSyncRunsTable)
      .set({
        finishedAt: new Date(),
        success: true,
        rowsProcessed: result.rowsProcessed,
        rowsChanged: result.rowsChanged,
      })
      .where(eq(rateSyncRunsTable.id, run.id));

    // Notificações de mudanças
    for (const ch of result.changes) {
      await notifyAdmins(
        `Taxa ${ch.bankSlug.toUpperCase()} ${ch.product} atualizada via BCB: ${ch.from.toFixed(2)}% → ${ch.to.toFixed(2)}% a.a.`,
        "rate_auto_update",
      );
    }
    for (const d of result.divergences) {
      await notifyAdmins(
        `Divergência em ${d.bankSlug.toUpperCase()} ${d.product}: cadastrada ${d.rate.toFixed(2)}% vs BCB ${d.reference.toFixed(2)}% (≥ ${DIVERGENCE_THRESHOLD} p.p.).`,
        "rate_divergence",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "rates-sync failed");
    await db
      .update(rateSyncRunsTable)
      .set({ finishedAt: new Date(), success: false, error: message })
      .where(eq(rateSyncRunsTable.id, run.id));

    // Falha 2 dias seguidos? Notifica.
    const recent = await db
      .select()
      .from(rateSyncRunsTable)
      .orderBy(desc(rateSyncRunsTable.startedAt))
      .limit(3);
    const lastTwo = recent.slice(0, 2);
    if (lastTwo.length === 2 && lastTwo.every((r) => !r.success)) {
      await notifyAdmins(
        `Rotina de sincronização BCB falhou 2 execuções seguidas. Último erro: ${message}`,
        "rate_sync_failure",
      );
    }
    throw err;
  }

  return result;
}

async function applySnapshot(snap: BcbSnapshot, result: SyncResult) {
  const rows = await db.select().from(bankRatesTable);
  result.rowsProcessed = rows.length;

  const caixaMap = mapCaixaProductsFromBcb(snap);
  const reference = bcbReferenceFor(snap, "sbpe");
  result.bcbReference = reference;
  const today = todayISO();

  for (const row of rows) {
    const currentRate = Number(row.rateAA);
    let newRate: number | null = currentRate;

    if (row.source === "bcb" && row.bankSlug === "caixa") {
      const target = caixaMap[row.product];
      if (target != null && Number.isFinite(target)) {
        newRate = round4(target);
      }
    }

    const refRate = reference != null ? round4(reference) : null;
    const changed =
      newRate != null && Math.abs(newRate - currentRate) >= 0.005;

    if (changed) {
      await db
        .update(bankRatesTable)
        .set({
          previousRateAA: row.rateAA,
          rateAA: String(newRate),
          bcbReferenceRate: refRate != null ? String(refRate) : null,
          updatedAt: new Date(),
        })
        .where(eq(bankRatesTable.id, row.id));
      result.rowsChanged += 1;
      result.changes.push({
        bankSlug: row.bankSlug,
        product: row.product,
        from: currentRate,
        to: newRate!,
      });
    } else if (refRate != null) {
      await db
        .update(bankRatesTable)
        .set({ bcbReferenceRate: String(refRate) })
        .where(eq(bankRatesTable.id, row.id));
    }

    // Divergência: apenas taxas manuais comparadas contra referência BCB.
    if (row.source === "manual" && refRate != null) {
      const diff = Math.abs(currentRate - refRate);
      const isDivergent = diff >= DIVERGENCE_THRESHOLD;
      const priorRef = row.bcbReferenceRate != null
        ? Number(row.bcbReferenceRate)
        : null;
      const wasDivergent =
        priorRef != null &&
        Math.abs(currentRate - priorRef) >= DIVERGENCE_THRESHOLD;
      // Notifica apenas na transição (não-divergente → divergente) ou quando
      // não havia referência registrada ainda — evita spam diário.
      if (isDivergent && !wasDivergent) {
        result.divergences.push({
          bankSlug: row.bankSlug,
          product: row.product,
          rate: currentRate,
          reference: refRate,
        });
      }
    }

    // Histórico do dia (mantém o último valor observado se rodar 2x).
    const effectiveRate = newRate ?? currentRate;
    await db
      .insert(bankRateHistoryTable)
      .values({
        bankSlug: row.bankSlug,
        product: row.product,
        observedOn: today,
        rateAA: String(effectiveRate),
        source: row.source,
      })
      .onConflictDoUpdate({
        target: [
          bankRateHistoryTable.bankSlug,
          bankRateHistoryTable.product,
          bankRateHistoryTable.observedOn,
        ],
        set: { rateAA: String(effectiveRate), source: row.source },
      });
  }
}

// ── Scheduler ──────────────────────────────────────────────────────────────

let schedulerTimer: NodeJS.Timeout | null = null;

function msUntilNextMidnightBrt(): number {
  // BRT = UTC-3 (sem horário de verão desde 2019).
  const now = new Date();
  const utcMs = now.getTime();
  // Próxima meia-noite BRT = 03:00 UTC do dia seguinte BRT.
  const brtNow = new Date(utcMs - 3 * 60 * 60 * 1000);
  const brtNext = new Date(
    Date.UTC(
      brtNow.getUTCFullYear(),
      brtNow.getUTCMonth(),
      brtNow.getUTCDate() + 1,
      0,
      0,
      5, // 5s de margem
    ),
  );
  const nextUtc = brtNext.getTime() + 3 * 60 * 60 * 1000;
  return Math.max(60_000, nextUtc - utcMs);
}

export function startRatesScheduler() {
  if (schedulerTimer) return;
  const schedule = () => {
    const delay = msUntilNextMidnightBrt();
    logger.info({ delayMs: delay }, "rates-sync scheduled");
    schedulerTimer = setTimeout(async () => {
      try {
        await runRatesSync("scheduled");
      } catch (err) {
        logger.error({ err }, "scheduled rates-sync failed");
      } finally {
        schedule(); // reagenda
      }
    }, delay);
  };
  schedule();
}

export function stopRatesScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}
