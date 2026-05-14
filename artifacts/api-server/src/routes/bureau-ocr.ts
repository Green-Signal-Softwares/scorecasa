import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

const CCA_PROMPT = `Você é um extrator de dados de documentos bancários brasileiros. Analise esta imagem de "Pesquisa Cadastral Simplificada" do sistema CCA Caixa Aqui e extraia as informações em formato JSON estrito.

Retorne APENAS um JSON válido com este formato (sem markdown, sem texto extra):
{
  "nomeCliente": "string ou null",
  "cpf": "string ou null",
  "codigoCorrespondente": "string ou null",
  "dataConsulta": "string ou null",
  "nadaConsta": true/false,
  "serasa": {
    "temOcorrencia": true/false,
    "quantidadeOcorrencias": number ou 0,
    "dataPrimeiraOcorrencia": "string ou null",
    "dataUltimaOcorrencia": "string ou null",
    "refin": [{ "data": "string", "tipoFinanc": "string", "valor": number, "contrato": "string", "origem": "string", "cidade": "string" }],
    "protestos": [{ "data": "string", "valorProtesto": number, "cartorio": "string", "cidade": "string", "uf": "string" }]
  },
  "scpc": {
    "temOcorrencia": true/false,
    "registros": [{ "dtOcorr": "string", "tpDevedor": "string", "nome": "string", "vrDivida": number, "cidade": "string", "uf": "string", "contrato": "string", "dtDisp": "string" }]
  },
  "cadin": {
    "temOcorrencia": true/false,
    "contratosAte30Dias": number ou 0,
    "contratosApos30Dias": number ou 0,
    "credores": [{ "sigla": "string", "nome": "string" }]
  }
}

Regras:
- Se aparecer "NADA CONSTA" na página, defina nadaConsta=true e todos os campos de ocorrência como false/0/[].
- Para valores monetários, extraia apenas o número (ex: "R$ 101,34" → 101.34).
- Se um campo não estiver presente no documento, use null ou [] conforme o tipo.
- Extraia TODOS os registros visíveis, não apenas o primeiro.`;

const BCB_PROMPT = `Você é um extrator de dados de documentos do Banco Central do Brasil. Analise esta imagem do relatório "Registrato" ou "Resumo de Empréstimos e Financiamentos" do Banco Central do Brasil (BCB) e extraia as informações em formato JSON estrito.

Retorne APENAS um JSON válido com este formato (sem markdown, sem texto extra):
{
  "nomeCliente": "string ou null",
  "cpf": "string ou null",
  "dataReferencia": "string ou null",
  "totalDividaAtiva": number ou 0,
  "parcelaMensalTotal": number ou 0,
  "quantidadeOperacoes": number ou 0,
  "operacoes": [
    {
      "instituicao": "string",
      "modalidade": "string",
      "saldoDevedor": number,
      "parcelaMensal": number ou null,
      "vencimento": "string ou null",
      "situacao": "string"
    }
  ],
  "limiteCartaoCredito": number ou null,
  "utilizacaoCartaoCredito": number ou null,
  "emprestimoPessoalMensal": number ou null,
  "financiamentoVeiculoMensal": number ou null,
  "outrosMensal": number ou null,
  "inadimplencia": true/false,
  "valorInadimplente": number ou 0
}

Regras importantes:
- totalDividaAtiva = soma de todos os saldos devedores de operações ativas.
- parcelaMensalTotal = soma de todas as parcelas mensais comprometidas.
- quantidadeOperacoes = número total de operações de crédito ativas encontradas.
- Para valores monetários, extraia apenas o número (ex: "R$ 1.234,56" → 1234.56).
- Se um campo não aparecer no documento, use null ou 0 conforme o tipo.
- inadimplencia = true se houver qualquer operação vencida/inadimplente.
- Extraia TODAS as operações visíveis, não apenas a primeira.`;

router.post("/", async (req, res) => {
  const sessionUserId = (req as any).session?.userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { imageBase64, mimeType, docType } = req.body as {
    imageBase64?: string;
    mimeType?: string;
    docType?: "cca" | "bcb";
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const mime = mimeType ?? "image/png";
  const dataUrl = `data:${mime};base64,${imageBase64}`;
  const isBcb = docType === "bcb";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: isBcb ? BCB_PROMPT : CCA_PROMPT,
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ raw }, "bureau-ocr: failed to parse LLM JSON");
      res.status(422).json({ error: "Não foi possível extrair os dados da imagem. Verifique se é um documento válido." });
      return;
    }

    if (isBcb) {
      const ops: { instituicao: string; modalidade: string; saldoDevedor: number; parcelaMensal: number | null }[] = parsed.operacoes ?? [];

      const vehicleMensal =
        parsed.financiamentoVeiculoMensal ??
        ops.filter((o) => /veiculo|veículo|auto|carro/i.test(o.modalidade))
           .reduce((s, o) => s + (o.parcelaMensal ?? 0), 0) || null;

      const outrosMensal =
        parsed.outrosMensal ??
        parsed.emprestimoPessoalMensal ??
        ops.filter((o) => !/veiculo|veículo|auto|carro|cartao|cartão/i.test(o.modalidade))
           .reduce((s, o) => s + (o.parcelaMensal ?? 0), 0) || null;

      const operacoesCount = parsed.quantidadeOperacoes > 0
        ? parsed.quantidadeOperacoes
        : ops.length || null;

      res.json({
        docType: "bcb",
        raw: parsed,
        enrichFields: {
          bcbTotalDebt: parsed.totalDividaAtiva > 0 ? parsed.totalDividaAtiva : undefined,
          bcbMonthlyCommitment: parsed.parcelaMensalTotal > 0 ? parsed.parcelaMensalTotal : undefined,
          bcbOperationsCount: operacoesCount ?? undefined,
          bcbQueryDate: parsed.dataReferencia ?? undefined,
          creditCardLimit: parsed.limiteCartaoCredito ?? undefined,
          creditCardUsage: parsed.utilizacaoCartaoCredito ?? undefined,
          vehicleLoanMonthly: vehicleMensal ?? undefined,
          otherLoansMonthly: outrosMensal ?? undefined,
        },
        summary: {
          nomeCliente: parsed.nomeCliente,
          cpf: parsed.cpf,
          dataReferencia: parsed.dataReferencia,
          totalDividaAtiva: parsed.totalDividaAtiva ?? 0,
          parcelaMensalTotal: parsed.parcelaMensalTotal ?? 0,
          quantidadeOperacoes: operacoesCount ?? 0,
          inadimplencia: parsed.inadimplencia ?? false,
          valorInadimplente: parsed.valorInadimplente ?? 0,
        },
      });
      return;
    }

    // ── CCA Caixa path ────────────────────────────────────────────────────────
    const serasaRefin: { valor: number }[] = parsed.serasa?.refin ?? [];
    const serasaProtestos: { valorProtesto: number }[] = parsed.serasa?.protestos ?? [];
    const scpcRegistros: { vrDivida: number }[] = parsed.scpc?.registros ?? [];

    const totalNegativacoes =
      serasaRefin.reduce((s: number, r: { valor: number }) => s + (r.valor ?? 0), 0) +
      scpcRegistros.reduce((s: number, r: { vrDivida: number }) => s + (r.vrDivida ?? 0), 0);

    const totalProtestos = serasaProtestos.reduce(
      (s: number, p: { valorProtesto: number }) => s + (p.valorProtesto ?? 0),
      0
    );

    const credoresList = (parsed.cadin?.credores ?? [])
      .map((c: { sigla: string; nome: string }) => c.sigla + " - " + c.nome)
      .join("; ") || "N/A";
    const cadinText = parsed.cadin?.temOcorrencia
      ? "CADIN: " + (parsed.cadin.contratosApos30Dias ?? 0) + " contrato(s) em atraso acima de 30 dias. Credor(es): " + credoresList
      : null;

    res.json({
      docType: "cca",
      raw: parsed,
      enrichFields: {
        hasNegativations: !parsed.nadaConsta && (parsed.serasa?.temOcorrencia || parsed.scpc?.temOcorrencia),
        negativationsValue: totalNegativacoes > 0 ? totalNegativacoes : undefined,
        hasProtests: !parsed.nadaConsta && serasaProtestos.length > 0,
        protestsValue: totalProtestos > 0 ? totalProtestos : undefined,
        siricStatus: parsed.cadin?.temOcorrencia ? "irregular" : undefined,
        siricObservation: cadinText ?? undefined,
      },
      summary: {
        nomeCliente: parsed.nomeCliente,
        cpf: parsed.cpf,
        nadaConsta: parsed.nadaConsta,
        serasaOcorrencias: parsed.serasa?.quantidadeOcorrencias ?? 0,
        protestosCount: serasaProtestos.length,
        scpcCount: scpcRegistros.length,
        cadinContratos: parsed.cadin?.contratosApos30Dias ?? 0,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "bureau-ocr error");
    res.status(500).json({ error: "Erro ao processar imagem com IA. Tente novamente." });
  }
});

export default router;

Retorne APENAS um JSON válido com este formato (sem markdown, sem texto extra):
{
  "nomeCliente": "string ou null",
  "cpf": "string ou null",
  "codigoCorrespondente": "string ou null",
  "dataConsulta": "string ou null",
  "nadaConsta": true/false,
  "serasa": {
    "temOcorrencia": true/false,
    "quantidadeOcorrencias": number ou 0,
    "dataPrimeiraOcorrencia": "string ou null",
    "dataUltimaOcorrencia": "string ou null",
    "refin": [{ "data": "string", "tipoFinanc": "string", "valor": number, "contrato": "string", "origem": "string", "cidade": "string" }],
    "protestos": [{ "data": "string", "valorProtesto": number, "cartorio": "string", "cidade": "string", "uf": "string" }]
  },
  "scpc": {
    "temOcorrencia": true/false,
    "registros": [{ "dtOcorr": "string", "tpDevedor": "string", "nome": "string", "vrDivida": number, "cidade": "string", "uf": "string", "contrato": "string", "dtDisp": "string" }]
  },
  "cadin": {
    "temOcorrencia": true/false,
    "contratosAte30Dias": number ou 0,
    "contratosApos30Dias": number ou 0,
    "credores": [{ "sigla": "string", "nome": "string" }]
  }
}

Regras:
- Se aparecer "NADA CONSTA" na página, defina nadaConsta=true e todos os campos de ocorrência como false/0/[].
- Para valores monetários, extraia apenas o número (ex: "R$ 101,34" → 101.34).
- Se um campo não estiver presente no documento, use null ou [] conforme o tipo.
- Extraia TODOS os registros visíveis, não apenas o primeiro.`,
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ raw }, "bureau-ocr: failed to parse LLM JSON");
      res.status(422).json({ error: "Não foi possível extrair os dados da imagem. Verifique se é um documento CCA Caixa válido." });
      return;
    }

    const serasaRefin: { valor: number }[] = parsed.serasa?.refin ?? [];
    const serasaProtestos: { valorProtesto: number }[] = parsed.serasa?.protestos ?? [];
    const scpcRegistros: { vrDivida: number }[] = parsed.scpc?.registros ?? [];

    const totalNegativacoes =
      serasaRefin.reduce((s: number, r: { valor: number }) => s + (r.valor ?? 0), 0) +
      scpcRegistros.reduce((s: number, r: { vrDivida: number }) => s + (r.vrDivida ?? 0), 0);

    const totalProtestos = serasaProtestos.reduce(
      (s: number, p: { valorProtesto: number }) => s + (p.valorProtesto ?? 0),
      0
    );

    const credoresList = (parsed.cadin?.credores ?? [])
      .map((c: { sigla: string; nome: string }) => c.sigla + " - " + c.nome)
      .join("; ") || "N/A";
    const cadinText = parsed.cadin?.temOcorrencia
      ? "CADIN: " + (parsed.cadin.contratosApos30Dias ?? 0) + " contrato(s) em atraso acima de 30 dias. Credor(es): " + credoresList
      : null;

    res.json({
      raw: parsed,
      enrichFields: {
        hasNegativations: !parsed.nadaConsta && (parsed.serasa?.temOcorrencia || parsed.scpc?.temOcorrencia),
        negativationsValue: totalNegativacoes > 0 ? totalNegativacoes : undefined,
        hasProtests: !parsed.nadaConsta && serasaProtestos.length > 0,
        protestsValue: totalProtestos > 0 ? totalProtestos : undefined,
        siricStatus: parsed.cadin?.temOcorrencia ? "irregular" : undefined,
        siricObservation: cadinText ?? undefined,
      },
      summary: {
        nomeCliente: parsed.nomeCliente,
        cpf: parsed.cpf,
        nadaConsta: parsed.nadaConsta,
        serasaOcorrencias: parsed.serasa?.quantidadeOcorrencias ?? 0,
        protestosCount: serasaProtestos.length,
        scpcCount: scpcRegistros.length,
        cadinContratos: parsed.cadin?.contratosApos30Dias ?? 0,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "bureau-ocr error");
    res.status(500).json({ error: "Erro ao processar imagem com IA. Tente novamente." });
  }
});

export default router;
