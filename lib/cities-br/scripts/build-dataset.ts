// Script de regeneração do dataset completo de municípios.
//
// Lê os arquivos brutos do IBGE em `lib/cities-br/data/`:
//   • ibge-municipios.json            (lista oficial de 5570 municípios + UF)
//   • ibge-populacao-2022.json        (Censo 2022, variável 93 – população)
//   • ibge-regioes-metropolitanas.json (composição oficial das RMs)
//
// e gera `lib/cities-br/src/cities-data.generated.ts` contendo o dataset
// `ALL_CITIES_BY_UF` (Record<UF, [name, tier][]>) cobrindo TODOS os
// municípios brasileiros, com classificação MCMV 2026 (A/B/C/D/E) baseada
// em população + região metropolitana oficial, e respeitando o conjunto
// curado de overrides (tiers atribuídos manualmente em CURATED_OVERRIDES).
//
// Como rodar (a partir da raiz do monorepo):
//   pnpm --filter @workspace/cities-br run build:dataset
//
// Para atualizar os dados-base, baixe novamente:
//   curl 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios' \
//     -o lib/cities-br/data/ibge-municipios.json
//   curl 'https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6%5Ball%5D' \
//     -o lib/cities-br/data/ibge-populacao-2022.json
//   curl 'https://servicodados.ibge.gov.br/api/v1/localidades/regioes-metropolitanas' \
//     -o lib/cities-br/data/ibge-regioes-metropolitanas.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CURATED_OVERRIDES,
  RIDE_DF_MUNICIPIOS,
  type MCMVTier,
  type UF,
  UFS,
  normalizeCity,
} from "../src/curated-overrides.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA = resolve(ROOT, "data");
const OUT = resolve(ROOT, "src/cities-data.generated.ts");

// ── RMs cujos integrantes recebem upgrade de tier ───────────────────────────
// Tier A: grandes metrópoles – SP, RJ e DF (RIDE).
const RM_TIER_A_NAMES = new Set<string>([
  "Região Metropolitana de São Paulo",
  "Região Metropolitana do Rio de Janeiro",
]);
// Tier B: demais metrópoles e RMs > 1M.
const RM_TIER_B_NAMES = new Set<string>([
  "Região Metropolitana de Belo Horizonte",
  "Região Metropolitana de Salvador",
  "Região Metropolitana de Fortaleza",
  "Região Metropolitana de Recife",
  "Região Metropolitana de Porto Alegre",
  "Região Metropolitana de Curitiba",
  "Região Metropolitana de Manaus",
  "Região Metropolitana de Belém",
  "Região Metropolitana de Goiânia",
  "Região Metropolitana da Grande Vitória",
  "Região Metropolitana de Campinas",
  "Região Metropolitana da Baixada Santista",
]);

// ── Carga dos arquivos brutos ───────────────────────────────────────────────
interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string } } } | null;
  "regiao-imediata"?: {
    "regiao-intermediaria": { UF: { sigla: string } };
  };
}

function ufOf(m: IbgeMunicipio): string {
  return (
    m.microrregiao?.mesorregiao.UF.sigla ??
    m["regiao-imediata"]?.["regiao-intermediaria"].UF.sigla ??
    ""
  );
}

interface IbgeRm {
  nome: string;
  municipios: { id: number; nome: string }[];
}

interface IbgePopulacao {
  resultados: {
    series: {
      localidade: { id: string };
      serie: Record<string, string>;
    }[];
  }[];
}

const municipios: IbgeMunicipio[] = JSON.parse(
  readFileSync(resolve(DATA, "ibge-municipios.json"), "utf8"),
);
const rms: IbgeRm[] = JSON.parse(
  readFileSync(resolve(DATA, "ibge-regioes-metropolitanas.json"), "utf8"),
);
const popRaw: IbgePopulacao[] = JSON.parse(
  readFileSync(resolve(DATA, "ibge-populacao-2022.json"), "utf8"),
);

// Mapeia id IBGE → população 2022.
const populationById = new Map<number, number>();
for (const series of popRaw[0]?.resultados[0]?.series ?? []) {
  const pop = Number(series.serie["2022"]);
  if (Number.isFinite(pop)) {
    populationById.set(Number(series.localidade.id), pop);
  }
}

// Mapeia id IBGE → tier forçado por RM.
const rmTierById = new Map<number, MCMVTier>();
const upgrade = (id: number, tier: MCMVTier): void => {
  const prev = rmTierById.get(id);
  if (!prev || tierRank(tier) > tierRank(prev)) rmTierById.set(id, tier);
};
for (const rm of rms) {
  let tier: MCMVTier | null = null;
  if (RM_TIER_A_NAMES.has(rm.nome)) tier = "A";
  else if (RM_TIER_B_NAMES.has(rm.nome)) tier = "B";
  if (!tier) continue;
  for (const m of rm.municipios) upgrade(m.id, tier);
}
// RIDE-DF (Lei Complementar 94/1998 + atualizações): tratada como tier A.
// Resolve (UF, nome) → ID IBGE para aplicar o upgrade.
for (const m of municipios) {
  const uf = ufOf(m);
  const key = `${uf}:${normalizeCity(m.nome)}`;
  if (RIDE_DF_MUNICIPIOS.has(key)) upgrade(m.id, "A");
}

function tierRank(t: MCMVTier): number {
  return { A: 5, B: 4, C: 3, D: 2, E: 1 }[t];
}

// ── Classificação por população (fallback quando não há override/RM) ────────
function tierFromPopulation(pop: number | undefined): MCMVTier {
  if (pop === undefined) return "E";
  if (pop >= 1_000_000) return "A";
  if (pop >= 500_000) return "B";
  if (pop >= 250_000) return "C";
  if (pop >= 100_000) return "D";
  return "E";
}

// ── Combinação final ────────────────────────────────────────────────────────
// Para cada UF, lista todos os municípios com tier resolvido.
// Precedência (maior para menor):
//   1. Override curado em CURATED_OVERRIDES
//   2. Upgrade por RM
//   3. Classificação por população
const byUf = new Map<UF, { name: string; tier: MCMVTier }[]>();
for (const uf of UFS) byUf.set(uf, []);

const curatedByUf = new Map<UF, Map<string, MCMVTier>>();
for (const uf of UFS) {
  const m = new Map<string, MCMVTier>();
  for (const [name, tier] of CURATED_OVERRIDES[uf]) m.set(normalizeCity(name), tier);
  curatedByUf.set(uf, m);
}

let curatedHits = 0;
let rmHits = 0;
let popClassified = 0;

for (const m of municipios) {
  const uf = ufOf(m) as UF;
  if (!UFS.includes(uf)) continue;
  const key = normalizeCity(m.nome);
  const curated = curatedByUf.get(uf)!.get(key);
  const rm = rmTierById.get(m.id);
  const pop = populationById.get(m.id);
  let tier: MCMVTier;
  if (curated) {
    tier = curated;
    curatedHits++;
  } else if (rm) {
    tier = rm;
    rmHits++;
  } else {
    tier = tierFromPopulation(pop);
    popClassified++;
  }
  byUf.get(uf)!.push({ name: m.nome, tier });
}

// Ordena cada UF por nome.
for (const list of byUf.values()) {
  list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// ── Emissão do arquivo gerado ───────────────────────────────────────────────
const totalCount = Array.from(byUf.values()).reduce((s, l) => s + l.length, 0);

const lines: string[] = [];
lines.push("// AUTO-GERADO por lib/cities-br/scripts/build-dataset.ts.");
lines.push("// NÃO edite manualmente. Para regenerar:");
lines.push("//   pnpm --filter @workspace/cities-br run build:dataset");
lines.push("//");
lines.push(`// Total de municípios: ${totalCount}`);
lines.push(`// Resolvidos por override curado: ${curatedHits}`);
lines.push(`// Resolvidos por região metropolitana oficial: ${rmHits}`);
lines.push(`// Resolvidos por classificação por população (Censo IBGE 2022): ${popClassified}`);
lines.push("");
lines.push('import type { MCMVTier, UF } from "./curated-overrides.js";');
lines.push("");
lines.push(
  "export const ALL_CITIES_BY_UF: Record<UF, readonly (readonly [name: string, tier: MCMVTier])[]> = {",
);
for (const uf of UFS) {
  const list = byUf.get(uf)!;
  lines.push(`  ${uf}: [`);
  for (const { name, tier } of list) {
    lines.push(`    [${JSON.stringify(name)}, ${JSON.stringify(tier)}],`);
  }
  lines.push("  ],");
}
lines.push("};");
lines.push("");

writeFileSync(OUT, lines.join("\n"));

console.log(
  `[build-dataset] OK · ${totalCount} municípios · curated=${curatedHits} rm=${rmHits} pop=${popClassified}`,
);
console.log(`[build-dataset] escrito em ${OUT}`);
