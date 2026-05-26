// Baixa os três JSONs brutos do IBGE em `lib/cities-br/data/` e regenera o
// dataset `cities-data.generated.ts` chamando `build-dataset.ts`.
//
// Como rodar (a partir da raiz do monorepo):
//   pnpm --filter @workspace/cities-br run refresh:ibge
//
// O script é idempotente: se os JSONs do IBGE não mudaram, o dataset gerado
// também não muda e o working tree fica limpo. Use o exit code para decidir
// se um PR/commit precisa ser aberto:
//   0 → sucesso, sem mudanças
//   10 → sucesso, dataset (ou JSONs brutos) mudaram
//   1 → erro de download/build
//
// Esse exit code é consumido pelo workflow agendado em
// `.github/workflows/refresh-cities-br.yml`, que abre um PR quando há
// diferenças.

import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA = resolve(ROOT, "data");
const GENERATED = resolve(ROOT, "src/cities-data.generated.ts");

interface Source {
  url: string;
  file: string;
}

const SOURCES: Source[] = [
  {
    url: "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    file: resolve(DATA, "ibge-municipios.json"),
  },
  {
    url: "https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6%5Ball%5D",
    file: resolve(DATA, "ibge-populacao-2022.json"),
  },
  {
    url: "https://servicodados.ibge.gov.br/api/v1/localidades/regioes-metropolitanas",
    file: resolve(DATA, "ibge-regioes-metropolitanas.json"),
  },
];

async function download(source: Source): Promise<unknown> {
  const res = await fetch(source.url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET ${source.url} → HTTP ${res.status} ${res.statusText}`);
  }
  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Resposta inválida (não-JSON) de ${source.url}: ${String(err)}`);
  }
  writeFileSync(source.file, JSON.stringify(parsed) + "\n");
  return parsed;
}

// Número mínimo de municípios esperado. O Brasil tem 5.570 municípios; usamos
// 5.500 como piso defensivo para tolerar pequenas variações sem deixar passar
// um payload claramente quebrado/parcial.
const MIN_MUNICIPIOS = 5500;
// Número mínimo de regiões metropolitanas oficialmente reconhecidas pelo IBGE
// (atualmente são ~70). Usamos um piso conservador.
const MIN_REGIOES_METROPOLITANAS = 50;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Sanity-checks defensivos: se o IBGE renomear campos, descontinuar o agregado
// 4709 ou trocar o formato dos endpoints, o script falha alto e cedo em vez de
// gerar um dataset silenciosamente quebrado. Falhas aqui também disparam a
// notificação configurada em `.github/workflows/refresh-cities-br.yml`.
function validateMunicipios(data: unknown): void {
  if (!Array.isArray(data)) {
    throw new Error("ibge-municipios: payload não é um array (formato mudou?)");
  }
  if (data.length < MIN_MUNICIPIOS) {
    throw new Error(
      `ibge-municipios: apenas ${data.length} municípios (esperado ≥ ${MIN_MUNICIPIOS}); fonte do IBGE pode ter mudado.`,
    );
  }
  const sample = data[0];
  if (!isObject(sample) || typeof sample.id !== "number" || typeof sample.nome !== "string") {
    throw new Error("ibge-municipios: campos esperados ausentes (id:number, nome:string).");
  }
  const microrregiao = sample.microrregiao;
  if (!isObject(microrregiao) || !isObject(microrregiao.mesorregiao)) {
    throw new Error("ibge-municipios: hierarquia microrregiao/mesorregiao ausente.");
  }
}

function validatePopulacao(data: unknown): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("ibge-populacao-2022: payload vazio (agregado 4709 descontinuado?).");
  }
  const head = data[0];
  if (!isObject(head) || head.id !== "93") {
    throw new Error(
      "ibge-populacao-2022: variável 93 (População residente) ausente; agregado pode ter mudado.",
    );
  }
  const resultados = head.resultados;
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new Error("ibge-populacao-2022: bloco `resultados` ausente.");
  }
  const first = resultados[0];
  if (!isObject(first) || !Array.isArray(first.series)) {
    throw new Error("ibge-populacao-2022: bloco `series` ausente.");
  }
  if (first.series.length < MIN_MUNICIPIOS) {
    throw new Error(
      `ibge-populacao-2022: apenas ${first.series.length} séries (esperado ≥ ${MIN_MUNICIPIOS}).`,
    );
  }
  const serie = first.series[0];
  if (
    !isObject(serie) ||
    !isObject(serie.localidade) ||
    !isObject(serie.serie) ||
    typeof (serie.serie as Record<string, unknown>)["2022"] !== "string"
  ) {
    throw new Error(
      "ibge-populacao-2022: shape de `series[].serie['2022']` mudou (campo renomeado?).",
    );
  }
}

function validateRegioesMetropolitanas(data: unknown): void {
  if (!Array.isArray(data)) {
    throw new Error("ibge-regioes-metropolitanas: payload não é um array.");
  }
  if (data.length < MIN_REGIOES_METROPOLITANAS) {
    throw new Error(
      `ibge-regioes-metropolitanas: apenas ${data.length} regiões (esperado ≥ ${MIN_REGIOES_METROPOLITANAS}).`,
    );
  }
  const sample = data[0];
  if (!isObject(sample) || typeof sample.nome !== "string" || !Array.isArray(sample.municipios)) {
    throw new Error(
      "ibge-regioes-metropolitanas: campos esperados ausentes (nome:string, municipios:array).",
    );
  }
}

const VALIDATORS: Record<string, (data: unknown) => void> = {
  "ibge-municipios.json": validateMunicipios,
  "ibge-populacao-2022.json": validatePopulacao,
  "ibge-regioes-metropolitanas.json": validateRegioesMetropolitanas,
};

function snapshot(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const before = new Map<string, string>();
  for (const s of SOURCES) before.set(s.file, snapshot(s.file));
  before.set(GENERATED, snapshot(GENERATED));

  console.log(`[refresh-ibge] baixando ${SOURCES.length} arquivos do IBGE…`);
  for (const s of SOURCES) {
    process.stdout.write(`  · ${s.url}\n`);
    const parsed = await download(s);
    const fileName = s.file.split("/").pop() ?? "";
    const validator = VALIDATORS[fileName];
    if (!validator) {
      throw new Error(`[refresh-ibge] sem validador para ${fileName} (bug interno).`);
    }
    validator(parsed);
  }

  console.log("[refresh-ibge] regenerando dataset…");
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", resolve(ROOT, "scripts/build-dataset.ts")],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`build-dataset.ts saiu com código ${result.status}`);
  }

  let changedFiles = 0;
  for (const [file, prev] of before) {
    if (snapshot(file) !== prev) changedFiles++;
  }

  if (changedFiles === 0) {
    console.log("[refresh-ibge] nenhuma mudança detectada · dataset em dia.");
    process.exit(0);
  }

  console.log(`[refresh-ibge] ${changedFiles} arquivo(s) modificado(s).`);
  // Imprime um resumo amigável (útil para o corpo do PR).
  try {
    const diff = execFileSync(
      "git",
      ["--no-pager", "diff", "--stat", "--", "lib/cities-br/data", "lib/cities-br/src/cities-data.generated.ts"],
      { encoding: "utf8" },
    );
    if (diff.trim()) {
      console.log("\n[refresh-ibge] git diff --stat:\n" + diff);
    }
  } catch {
    // git pode não estar disponível em todos os ambientes; ignore.
  }
  process.exit(10);
}

main().catch((err) => {
  console.error("[refresh-ibge] FALHOU:", err);
  process.exit(1);
});
