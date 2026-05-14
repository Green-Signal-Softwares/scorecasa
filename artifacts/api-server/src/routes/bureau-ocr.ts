import { Router } from "express";
import OpenAI from "openai";
import { extractBcbFromPdf } from "./bcb-ocr-helper";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

const CCA_PROMPT = [
  "Voce e um extrator de dados de documentos bancarios brasileiros.",
  "Analise esta imagem de Pesquisa Cadastral Simplificada do sistema CCA Caixa Aqui",
  "e extraia as informacoes em formato JSON estrito.",
  "",
  "Retorne APENAS um JSON valido com este formato (sem markdown, sem texto extra):",
  "{",
  '  "nomeCliente": "string ou null",',
  '  "cpf": "string ou null",',
  '  "codigoCorrespondente": "string ou null",',
  '  "dataConsulta": "string ou null",',
  '  "nadaConsta": true ou false,',
  '  "serasa": {',
  '    "temOcorrencia": true ou false,',
  '    "quantidadeOcorrencias": number ou 0,',
  '    "dataPrimeiraOcorrencia": "string ou null",',
  '    "dataUltimaOcorrencia": "string ou null",',
  '    "refin": [{"data":"string","tipoFinanc":"string","valor":number,"contrato":"string","origem":"string","cidade":"string"}],',
  '    "protestos": [{"data":"string","valorProtesto":number,"cartorio":"string","cidade":"string","uf":"string"}]',
  "  },",
  '  "scpc": {',
  '    "temOcorrencia": true ou false,',
  '    "registros": [{"dtOcorr":"string","tpDevedor":"string","nome":"string","vrDivida":number,"cidade":"string","uf":"string","contrato":"string","dtDisp":"string"}]',
  "  },",
  '  "cadin": {',
  '    "temOcorrencia": true ou false,',
  '    "contratosAte30Dias": number ou 0,',
  '    "contratosApos30Dias": number ou 0,',
  '    "credores": [{"sigla":"string","nome":"string"}]',
  "  }",
  "}",
  "",
  "Regras:",
  "- Se aparecer NADA CONSTA na pagina, defina nadaConsta=true e todos os campos de ocorrencia como false/0/[].",
  "- Para valores monetarios, extraia apenas o numero (ex: R$ 101,34 vira 101.34).",
  "- Se um campo nao estiver presente no documento, use null ou [] conforme o tipo.",
  "- Extraia TODOS os registros visiveis, nao apenas o primeiro.",
].join("\n");

// (BCB_PROMPT and extraction logic are in ./bcb-ocr-helper.ts and shared with /api/client/scr-import.)

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
  const isBcb = docType === "bcb";

  if (isBcb) {
    try {
      const result = await extractBcbFromPdf(imageBase64, mime);
      if ("error" in result) {
        req.log.warn({ err: result.error }, "bureau-ocr: BCB extraction failed");
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        docType: "bcb",
        raw: result.parsed,
        enrichFields: result.enrichFields,
        summary: result.summary,
      });
    } catch (err: any) {
      req.log.error({ err }, "bureau-ocr BCB error");
      res.status(500).json({ error: "Erro ao processar PDF do SCR. Tente novamente." });
    }
    return;
  }

  const isPdf = mime === "application/pdf" || mime === "application/x-pdf";
  const dataUrl = "data:" + (isPdf ? "application/pdf" : mime) + ";base64," + imageBase64;

  // PDFs use the OpenAI `file` content type; images use `image_url`.
  const docPart: any = isPdf
    ? {
        type: "file",
        file: {
          filename: "cca-caixa.pdf",
          file_data: dataUrl,
        },
      }
    : {
        type: "image_url",
        image_url: { url: dataUrl, detail: "high" },
      };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: CCA_PROMPT }, docPart],
        },
      ] as any,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      req.log.warn({ raw }, "bureau-ocr: failed to parse LLM JSON");
      res.status(422).json({ error: "Nao foi possivel extrair os dados da imagem. Verifique se e um documento valido." });
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
