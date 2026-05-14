import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

export const BCB_PROMPT = [
  "Voce e um extrator de dados do Relatorio SCR (Sistema de Informacoes de Credito) do Banco Central do Brasil,",
  "tambem chamado 'Relatorio de Emprestimos e Financiamentos' obtido via Registrato/gov.br.",
  "Analise esta imagem ou PDF e extraia as informacoes em formato JSON estrito.",
  "",
  "Retorne APENAS um JSON valido com este formato (sem markdown, sem texto extra):",
  "{",
  '  "nomeCliente": "string ou null",',
  '  "cpf": "string ou null",',
  '  "dataReferencia": "string ou null (mes de referencia, ex: 03/2026)",',
  '  "totalDividasEmDia": number ou 0,',
  '  "totalDividasVencidas": number ou 0,',
  '  "totalCreditoLiberar": number ou 0,',
  '  "totalCoobrigacoes": number ou 0,',
  '  "totalLimitesCredito": number ou 0,',
  '  "totalDividaAtiva": number ou 0,',
  '  "parcelaMensalTotal": number ou 0,',
  '  "quantidadeOperacoes": number ou 0,',
  '  "operacoes": [',
  '    {"instituicao":"string","modalidade":"string","categoria":"string","emDia":number ou 0,"vencida":number ou 0,"saldoDevedor":number ou 0,"parcelaMensal":number ou null,"limiteCredito":number ou 0,"vencimento":"string ou null"}',
  "  ],",
  '  "limiteCartaoCredito": number ou null,',
  '  "utilizacaoCartaoCredito": number ou null,',
  '  "emprestimoPessoalMensal": number ou null,',
  '  "financiamentoVeiculoMensal": number ou null,',
  '  "financiamentoImobiliarioSaldo": number ou null,',
  '  "outrosMensal": number ou null,',
  '  "inadimplencia": true ou false,',
  '  "valorInadimplente": number ou 0',
  "}",
  "",
  "Regras importantes:",
  "- totalDividasEmDia = soma da coluna 'Em dia' de todas as instituicoes (operacoes nao vencidas ou vencidas ate 14 dias).",
  "- totalDividasVencidas = soma da coluna 'Vencida' de todas as instituicoes (operacoes vencidas ha mais de 14 dias).",
  "- totalLimitesCredito = soma de todos os 'Limites de credito' (cheque especial, rotativo cartao).",
  "- totalDividaAtiva = totalDividasEmDia + totalDividasVencidas (apenas o que esta efetivamente devido).",
  "- categoria deve ser uma de: 'Financiamento imobiliario', 'Financiamento veiculo', 'Cartao de credito', 'Emprestimo pessoal', 'Cheque especial', 'Outros'.",
  "- Para cada operacao, preencha 'emDia' e 'vencida' separadamente conforme aparecem no relatorio.",
  "- Se a operacao for 'Financiamento habitacional' ou 'imobiliario', categorize como 'Financiamento imobiliario' e tente preencher financiamentoImobiliarioSaldo.",
  "- inadimplencia = true se totalDividasVencidas > 0.",
  "- valorInadimplente = totalDividasVencidas.",
  "- Para valores monetarios, extraia apenas o numero (ex: R$ 1.234,56 vira 1234.56). Use ponto como separador decimal.",
  "- Se um campo nao aparecer no documento, use null ou 0 conforme o tipo.",
  "- Extraia TODAS as operacoes/instituicoes visiveis em todas as paginas.",
].join("\n");

export type BcbOperacao = {
  instituicao: string;
  modalidade?: string;
  categoria?: string;
  emDia?: number;
  vencida?: number;
  saldoDevedor?: number;
  parcelaMensal?: number | null;
  limiteCredito?: number;
};

export type BcbExtraction = {
  parsed: Record<string, unknown> & {
    nomeCliente?: string | null;
    cpf?: string | null;
    dataReferencia?: string | null;
  };
  enrichFields: {
    bcbTotalDebt: number | null;
    bcbMonthlyCommitment: number | null;
    bcbOperationsCount: number | null;
    bcbQueryDate: string | null;
    bcbDebtsCurrent: number | null;
    bcbDebtsOverdue: number | null;
    bcbCreditLimits: number | null;
    bcbOperationsJson: string | null;
    creditCardLimit: number | null;
    creditCardUsage: number | null;
    vehicleLoanMonthly: number | null;
    otherLoansMonthly: number | null;
    hasNegativations: boolean;
  };
  summary: {
    nomeCliente?: string | null;
    cpf?: string | null;
    dataReferencia?: string | null;
    totalDividasEmDia: number;
    totalDividasVencidas: number;
    totalLimitesCredito: number;
    totalDividaAtiva: number;
    parcelaMensalTotal: number;
    quantidadeOperacoes: number;
    inadimplencia: boolean;
    valorInadimplente: number;
    operacoes: BcbOperacao[];
  };
};

export async function extractBcbFromPdf(
  imageBase64: string,
  mimeType: string,
): Promise<BcbExtraction | { error: string; status: number }> {
  const isPdf = mimeType === "application/pdf" || mimeType === "application/x-pdf";
  const dataUrl = "data:" + (isPdf ? "application/pdf" : mimeType) + ";base64," + imageBase64;

  const docPart: any = isPdf
    ? { type: "file", file: { filename: "bcb-registrato.pdf", file_data: dataUrl } }
    : { type: "image_url", image_url: { url: dataUrl, detail: "high" } };

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: BCB_PROMPT }, docPart],
      },
    ] as any,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { error: "Nao foi possivel extrair os dados do PDF. Verifique se e um relatorio SCR valido.", status: 422 };
  }

  const ops: BcbOperacao[] = Array.isArray(parsed.operacoes) ? parsed.operacoes : [];

  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const totalEmDia = num(parsed.totalDividasEmDia) ?? ops.reduce((s, o) => s + (o.emDia ?? 0), 0);
  const totalVencidas = num(parsed.totalDividasVencidas) ?? ops.reduce((s, o) => s + (o.vencida ?? 0), 0);
  const totalLimites = num(parsed.totalLimitesCredito) ?? ops.reduce((s, o) => s + (o.limiteCredito ?? 0), 0);
  const totalAtivoRaw = num(parsed.totalDividaAtiva);
  const totalAtivo = totalAtivoRaw && totalAtivoRaw > 0 ? totalAtivoRaw : totalEmDia + totalVencidas;

  const vehicleMensal =
    num(parsed.financiamentoVeiculoMensal) ??
    (ops.filter((o) => /veiculo|veículo|auto|carro/i.test((o.modalidade ?? "") + " " + (o.categoria ?? "")))
       .reduce((s, o) => s + (o.parcelaMensal ?? 0), 0) || null);

  const outrosMensal =
    num(parsed.outrosMensal) ??
    num(parsed.emprestimoPessoalMensal) ??
    (ops.filter((o) => !/veiculo|veículo|auto|carro|cartao|cartão|imobili|habitac/i.test((o.modalidade ?? "") + " " + (o.categoria ?? "")))
       .reduce((s, o) => s + (o.parcelaMensal ?? 0), 0) || null);

  const operacoesCount = num(parsed.quantidadeOperacoes) && (num(parsed.quantidadeOperacoes) as number) > 0
    ? (num(parsed.quantidadeOperacoes) as number)
    : (ops.length || null);

  return {
    parsed,
    enrichFields: {
      bcbTotalDebt: totalAtivo,
      bcbMonthlyCommitment: num(parsed.parcelaMensalTotal) ?? 0,
      bcbOperationsCount: operacoesCount,
      bcbQueryDate: typeof parsed.dataReferencia === "string" && parsed.dataReferencia.length > 0 ? parsed.dataReferencia : null,
      bcbDebtsCurrent: totalEmDia,
      bcbDebtsOverdue: totalVencidas,
      bcbCreditLimits: totalLimites,
      bcbOperationsJson: ops.length > 0 ? JSON.stringify(ops) : null,
      creditCardLimit: num(parsed.limiteCartaoCredito),
      creditCardUsage: num(parsed.utilizacaoCartaoCredito),
      vehicleLoanMonthly: vehicleMensal,
      otherLoansMonthly: outrosMensal,
      hasNegativations: totalVencidas > 0,
    },
    summary: {
      nomeCliente: parsed.nomeCliente ?? null,
      cpf: parsed.cpf ?? null,
      dataReferencia: parsed.dataReferencia ?? null,
      totalDividasEmDia: totalEmDia,
      totalDividasVencidas: totalVencidas,
      totalLimitesCredito: totalLimites,
      totalDividaAtiva: totalAtivo,
      parcelaMensalTotal: num(parsed.parcelaMensalTotal) ?? 0,
      quantidadeOperacoes: operacoesCount ?? 0,
      inadimplencia: parsed.inadimplencia ?? totalVencidas > 0,
      valorInadimplente: num(parsed.valorInadimplente) ?? totalVencidas,
      operacoes: ops,
    },
  };
}

export function normalizeCpf(cpf: string | null | undefined): string {
  return (cpf ?? "").replace(/\D/g, "");
}
