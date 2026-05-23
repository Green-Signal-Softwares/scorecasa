import { logger } from "./logger";

/**
 * Cliente para a API pública do Banco Central (Olinda) — Taxas de Juros das
 * Operações de Crédito - Pessoa Física, Financiamento Imobiliário.
 *
 *   Modalidade regulada (SBPE/MCMV/Pró-cotista): "Financiamento imobiliário
 *     com taxas reguladas - Prefixado"
 *   Modalidade mercado (referência geral):       "Financiamento imobiliário
 *     com taxas de mercado - Prefixado"
 *
 * Endpoint OData v2:
 *   https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosMensalPorMes
 */

const OLINDA_BASE =
  "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosMensalPorMes";

const MOD_REGULADO =
  "Financiamento imobiliário com taxas reguladas - Prefixado";
const MOD_MERCADO =
  "Financiamento imobiliário com taxas de mercado - Prefixado";

export interface BcbRateRow {
  modalidade: string;
  posicao: number;
  instituicao: string;
  taxaJurosAoMes: number;
  taxaJurosAoAno: number;
  mes: string; // ex: "Abr-2026"
  anoMes: string; // ex: "2026-04"
  cnpj8: string;
}

interface OlindaResponse {
  value?: Array<{
    Mes?: string;
    Modalidade?: string;
    Posicao?: number;
    InstituicaoFinanceira?: string;
    TaxaJurosAoMes?: number;
    TaxaJurosAoAno?: number;
    cnpj8?: string;
    anoMes?: string;
  }>;
}

async function fetchModalidade(modalidade: string): Promise<BcbRateRow[]> {
  const filter = `Modalidade eq '${modalidade.replace(/'/g, "''")}'`;
  const url = `${OLINDA_BASE}?$top=200&$format=json&$filter=${encodeURIComponent(
    filter,
  )}&$orderby=${encodeURIComponent("anoMes desc")}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ScoreCasa/1.0 (+contato@scorecasa.com.br)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`BCB Olinda HTTP ${res.status} (${modalidade})`);
  }
  const json = (await res.json()) as OlindaResponse;
  const rows = json.value ?? [];
  if (rows.length === 0) return [];
  // Filtra apenas o mês mais recente disponível.
  const latestAnoMes = rows.reduce(
    (acc, r) => (r.anoMes && r.anoMes > acc ? r.anoMes : acc),
    "",
  );
  return rows
    .filter((r) => r.anoMes === latestAnoMes)
    .map((r) => ({
      modalidade: r.Modalidade ?? modalidade,
      posicao: Number(r.Posicao ?? 0),
      instituicao: r.InstituicaoFinanceira ?? "",
      taxaJurosAoMes: Number(r.TaxaJurosAoMes ?? 0),
      taxaJurosAoAno: Number(r.TaxaJurosAoAno ?? 0),
      mes: r.Mes ?? "",
      anoMes: r.anoMes ?? "",
      cnpj8: r.cnpj8 ?? "",
    }));
}

export interface BcbSnapshot {
  fetchedAt: Date;
  referenceMonth: string | null; // "2026-04"
  avgRegulado?: number;
  avgMercado?: number;
  caixaRegulado?: number;
  caixaMercado?: number;
  rawCount: number;
}

function avg(values: number[]): number | undefined {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return undefined;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function pickCaixa(rows: BcbRateRow[]): number | undefined {
  // CNPJ 00360305 = Caixa Econômica Federal.
  const caixa = rows.find(
    (r) =>
      r.cnpj8 === "00360305" || r.instituicao.toUpperCase().includes("CAIXA"),
  );
  return caixa ? caixa.taxaJurosAoAno : undefined;
}

export async function fetchBcbSnapshot(): Promise<BcbSnapshot> {
  const [regulado, mercado] = await Promise.allSettled([
    fetchModalidade(MOD_REGULADO),
    fetchModalidade(MOD_MERCADO),
  ]);

  const reguladoRows = regulado.status === "fulfilled" ? regulado.value : [];
  const mercadoRows = mercado.status === "fulfilled" ? mercado.value : [];

  if (regulado.status === "rejected" && mercado.status === "rejected") {
    throw new Error(
      `Falha ao consultar BCB: ${(regulado.reason as Error)?.message} / ${(mercado.reason as Error)?.message}`,
    );
  }

  const referenceMonth =
    reguladoRows[0]?.anoMes ?? mercadoRows[0]?.anoMes ?? null;

  const snap: BcbSnapshot = {
    fetchedAt: new Date(),
    referenceMonth,
    avgRegulado: avg(reguladoRows.map((r) => r.taxaJurosAoAno)),
    avgMercado: avg(mercadoRows.map((r) => r.taxaJurosAoAno)),
    caixaRegulado: pickCaixa(reguladoRows),
    caixaMercado: pickCaixa(mercadoRows),
    rawCount: reguladoRows.length + mercadoRows.length,
  };

  logger.info({ snap }, "BCB rates snapshot");
  return snap;
}

/**
 * Mapeia o snapshot BCB para a taxa que cada produto Caixa deve adotar.
 * Retorna `null` quando o BCB não fornece valor utilizável.
 */
export function mapCaixaProductsFromBcb(
  snap: BcbSnapshot,
): Record<string, number | null> {
  const reg = snap.caixaRegulado ?? null;
  const mkt = snap.caixaMercado ?? null;
  return {
    sbpe: reg ?? mkt,
    pro_cotista: reg,
    // MCMV F1/F2 têm taxas subsidiadas por lei — não rastreadas no BCB.
    mcmv_f1: null,
    mcmv_f2: null,
    mcmv_f3: reg,
    mcmv_f4: reg ?? mkt,
  };
}

/**
 * Referência BCB para detectar divergência em taxas manuais de outros bancos.
 */
export function bcbReferenceFor(
  snap: BcbSnapshot,
  _product: string,
): number | null {
  return snap.avgMercado ?? snap.avgRegulado ?? null;
}
