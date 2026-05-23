// SSOT de municípios brasileiros + classificação MCMV 2026.
//
// Cobertura: todos os ~5570 municípios brasileiros listados pelo IBGE,
// classificados em tiers A/B/C/D/E para o cálculo do teto do imóvel no
// Programa Minha Casa Minha Vida 2026.
//
// Pipeline:
//   1. `curated-overrides.ts` — tiers atribuídos manualmente (capitais,
//      principais municípios de RM, exceções da portaria MCID).
//   2. `cities-data.generated.ts` — dataset completo derivado do IBGE
//      (Censo 2022) + RMs oficiais, aplicando os overrides curados como
//      precedência máxima. Regenerável via `pnpm --filter
//      @workspace/cities-br run build:dataset`.
//
// Classificação MCMV 2026:
//   A — Grandes metrópoles: São Paulo, Rio de Janeiro, Distrito Federal e
//       integrantes das RMs SP/RJ e RIDE-DF (teto R$ 275.000 — Faixas 1 e 2).
//   B — Demais metrópoles e municípios em RM > 1M (Grande BH, Recife,
//       Salvador, Fortaleza, Porto Alegre, Curitiba, Manaus, Belém,
//       Goiânia, Vitória, Campinas, Baixada Santista): teto R$ 270.000.
//   C — Capitais regionais e municípios entre 250k e 1M de habitantes:
//       teto R$ 260.000.
//   D — Cidades médias (100k a 250k de habitantes): teto R$ 255.000.
//   E — Pequenas (< 100k) e municípios sem cadastro: teto R$ 230.000.
//
// Faixas de renda MCMV 2026 (familiar bruta mensal):
//   F1: até R$  3.200
//   F2: até R$  5.000
//   F3: até R$  9.600 (Faixa Urbano 3 — teto R$ 400.000)
//   F4: até R$ 13.000 (Faixa Urbano 4 — teto R$ 600.000)

import { ALL_CITIES_BY_UF } from "./cities-data.generated.js";
import {
  type MCMVTier,
  type UF,
  UFS,
  UF_NAMES,
  isValidUf,
  normalizeCity,
} from "./curated-overrides.js";

export type { MCMVTier, UF };
export { UFS, UF_NAMES, isValidUf, normalizeCity };

export interface MCMV2026Limits {
  /** Teto do valor do imóvel para Faixas 1 e 2 (R$). */
  capFaixa12: number;
  /** Teto Faixa 3 (R$). */
  capFaixa3: number;
  /** Teto Faixa 4 (R$). */
  capFaixa4: number;
}

export const MCMV_2026_BY_TIER: Record<MCMVTier, MCMV2026Limits> = {
  A: { capFaixa12: 275_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  B: { capFaixa12: 270_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  C: { capFaixa12: 260_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  D: { capFaixa12: 255_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  E: { capFaixa12: 230_000, capFaixa3: 400_000, capFaixa4: 600_000 },
};

export type IncomeFaixa = "F1" | "F2" | "F3" | "F4" | "OUT";

export const FAIXA_LIMITS = {
  F1: 3_200,
  F2: 5_000,
  F3: 9_600,
  F4: 13_000,
} as const;

export function classifyFaixa(monthlyHouseholdIncome: number): IncomeFaixa {
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F1) return "F1";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F2) return "F2";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F3) return "F3";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F4) return "F4";
  return "OUT";
}

export interface MCMVEligibility {
  faixa: IncomeFaixa;
  tier: MCMVTier;
  /** Teto aplicável à combinação (faixa × município). */
  cap: number;
  /** propertyValue <= cap. */
  fitsCap: boolean;
  /** Faixa MCMV (F1..F4). */
  fitsFaixa: boolean;
  /** true quando ambos os critérios passam. */
  eligible: boolean;
}

export function evaluateMcmv2026({
  monthlyHouseholdIncome,
  propertyValue,
  tier,
}: {
  monthlyHouseholdIncome: number;
  propertyValue: number;
  tier: MCMVTier;
}): MCMVEligibility {
  const faixa = classifyFaixa(monthlyHouseholdIncome);
  const limits = MCMV_2026_BY_TIER[tier];
  let cap = 0;
  if (faixa === "F1" || faixa === "F2") cap = limits.capFaixa12;
  else if (faixa === "F3") cap = limits.capFaixa3;
  else if (faixa === "F4") cap = limits.capFaixa4;
  const fitsFaixa = faixa !== "OUT";
  const fitsCap = fitsFaixa && propertyValue > 0 && propertyValue <= cap;
  return {
    faixa,
    tier,
    cap,
    fitsCap,
    fitsFaixa,
    eligible: fitsFaixa && fitsCap,
  };
}

// ── Lookups por UF ──────────────────────────────────────────────────────────
// Mapa derivado (sem duplicatas) para busca O(1) de tier por nome.
const CITY_TIER_INDEX: Record<UF, Map<string, MCMVTier>> = (() => {
  const out: Record<string, Map<string, MCMVTier>> = {};
  for (const uf of UFS) {
    const m = new Map<string, MCMVTier>();
    for (const [name, tier] of ALL_CITIES_BY_UF[uf]) {
      const key = normalizeCity(name);
      if (!m.has(key)) m.set(key, tier);
    }
    out[uf] = m;
  }
  return out as Record<UF, Map<string, MCMVTier>>;
})();

/** Lista ordenada (com tier) das cidades de uma UF. */
export function citiesOf(
  uf: UF | null | undefined,
): readonly { name: string; tier: MCMVTier }[] {
  if (!uf || !isValidUf(uf)) return [];
  const unique = new Map<string, { name: string; tier: MCMVTier }>();
  for (const [name, tier] of ALL_CITIES_BY_UF[uf]) {
    const key = normalizeCity(name);
    if (!unique.has(key)) unique.set(key, { name, tier });
  }
  return Array.from(unique.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Resolve o tier MCMV para a combinação UF + cidade. Default "E"
 *  (município sem cadastro → teto mais restrito, R$ 230.000). */
export function cityTier(
  uf: string | null | undefined,
  city: string | null | undefined,
): MCMVTier {
  if (!isValidUf(uf) || !city) return "E";
  const tier = CITY_TIER_INDEX[uf].get(normalizeCity(city));
  return tier ?? "E";
}
