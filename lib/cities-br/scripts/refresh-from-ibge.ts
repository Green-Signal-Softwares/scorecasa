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

async function download(source: Source): Promise<void> {
  const res = await fetch(source.url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET ${source.url} → HTTP ${res.status} ${res.statusText}`);
  }
  const raw = await res.text();
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(raw)) + "\n";
  } catch (err) {
    throw new Error(`Resposta inválida (não-JSON) de ${source.url}: ${String(err)}`);
  }
  writeFileSync(source.file, pretty);
}

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
    await download(s);
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
