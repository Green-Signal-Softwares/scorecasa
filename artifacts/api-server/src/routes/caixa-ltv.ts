import { Router } from "express";
import { db, caixaLtvTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const CAIXA_URL = "https://www.caixa.gov.br/voce/habitacao/credito-imobiliario/Paginas/default.aspx";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

/** Tenta extrair os percentuais de LTV da página da Caixa.
 *  Como o site da Caixa muda frequentemente e usa SharePoint dinâmico,
 *  buscamos por padrões conhecidos ("até 90%", "até 80%", etc.) no HTML
 *  bruto. Se nada bater, retorna null (cai para o fallback armazenado). */
async function scrapeCaixaLtv(): Promise<{
  empreendimentoLtv: number;
  novoIndividualLtv: number;
  usadoLtv: number;
} | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(CAIXA_URL, {
      signal: controller.signal,
      headers: {
        // user-agent realista para evitar bloqueio simples
        "User-Agent":
          "Mozilla/5.0 (compatible; ScoreCasaBot/1.0; +https://scorecasa.replit.app)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const html = (await r.text()).toLowerCase();

    // Heurística: a página em geral lista os percentuais em sequência.
    // Procuramos padrões "até NN%" próximos das palavras "empreendimento",
    // "novo" e "usado".
    function findPercentNear(keyword: string): number | null {
      const idx = html.indexOf(keyword);
      if (idx < 0) return null;
      // Janela de 400 chars ao redor.
      const slice = html.slice(Math.max(0, idx - 200), idx + 400);
      const m = slice.match(/at[eé]\s*(\d{2})\s*%/);
      if (!m) return null;
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n < 30 || n > 100) return null;
      return n;
    }

    const emp = findPercentNear("empreendimento") ?? findPercentNear("apoio à produção") ?? findPercentNear("spe");
    const novo = findPercentNear("imóvel novo") ?? findPercentNear("novo");
    const usado = findPercentNear("imóvel usado") ?? findPercentNear("usado");

    if (emp == null && novo == null && usado == null) return null;

    return {
      empreendimentoLtv: emp ?? 90,
      novoIndividualLtv: novo ?? 80,
      usadoLtv: usado ?? 70,
    };
  } catch {
    return null;
  }
}

async function refreshIfStale(): Promise<typeof caixaLtvTable.$inferSelect> {
  let [row] = await db.select().from(caixaLtvTable).where(eq(caixaLtvTable.id, 1)).limit(1);
  if (!row) {
    const [inserted] = await db
      .insert(caixaLtvTable)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning();
    row = inserted ?? (await db.select().from(caixaLtvTable).where(eq(caixaLtvTable.id, 1)).limit(1))[0];
  }

  const age = Date.now() - new Date(row.fetchedAt).getTime();
  if (age < REFRESH_INTERVAL_MS && row.status === "scraped") {
    return row;
  }

  const scraped = await scrapeCaixaLtv();
  if (scraped) {
    const [updated] = await db
      .update(caixaLtvTable)
      .set({
        ...scraped,
        fetchedAt: new Date(),
        sourceUrl: CAIXA_URL,
        status: "scraped",
      })
      .where(eq(caixaLtvTable.id, 1))
      .returning();
    return updated;
  }

  // Scraping falhou: registra a tentativa, mas mantém os valores existentes.
  const [touched] = await db
    .update(caixaLtvTable)
    .set({
      fetchedAt: new Date(),
      sourceUrl: CAIXA_URL,
      status: row.status === "scraped" ? "stale" : "fallback",
    })
    .where(eq(caixaLtvTable.id, 1))
    .returning();
  return touched;
}

router.get("/", async (_req, res) => {
  const row = await refreshIfStale();
  res.json({
    empreendimentoLtv: row.empreendimentoLtv,
    novoIndividualLtv: row.novoIndividualLtv,
    usadoLtv: row.usadoLtv,
    fetchedAt: row.fetchedAt.toISOString(),
    sourceUrl: row.sourceUrl,
    status: row.status, // "scraped" | "stale" | "fallback"
  });
});

export default router;
