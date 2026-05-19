import { Router } from "express";
import {
  db,
  leadsTable,
  usersTable,
  processDocumentsTable,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

const router = Router();

// ── Categorias de documentos do cliente ─────────────────────────────────────
// Mesma lista do checklist de aprovação do correspondente (artifacts/api-server/
// src/routes/processes.ts CHECKLIST stage="aprovacao"). Compartilhamos os
// slugs para que tudo que o cliente subir aqui apareça automaticamente no
// checklist da aba "Processos" do correspondente, sem duplicação.

const CLIENT_DOC_CATEGORIES = [
  { slug: "rg_cnh",           name: "RG ou CNH (frente e verso)",                  required: true  },
  { slug: "cpf",              name: "CPF",                                         required: true  },
  { slug: "comp_residencia",  name: "Comprovante de residência (últimos 3 meses)", required: true  },
  { slug: "estado_civil",     name: "Certidão de nascimento ou casamento",         required: true  },
  { slug: "contracheque",     name: "Contracheques (3 últimos)",                   required: true  },
  { slug: "irpf",             name: "Declaração de IRPF + recibo",                 required: true  },
  { slug: "extrato_bancario", name: "Extrato bancário (3 meses)",                  required: true  },
  { slug: "fgts",             name: "Extrato do FGTS",                             required: false },
] as const;

function requireClient(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function getClientLead(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) return null;
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) return null;
  return { user, lead };
}

function serializeDoc(d: typeof processDocumentsTable.$inferSelect) {
  return {
    id: d.id,
    leadId: d.leadId,
    stage: d.stage,
    slug: d.slug,
    name: d.name,
    fileUrl: d.fileUrl,
    contentType: d.contentType ?? null,
    status: d.status,
    notes: d.notes ?? null,
    uploadedByName: d.uploadedByName ?? null,
    visibleToClient: d.visibleToClient,
    signatureRequired: d.signatureRequired,
    signedAt: d.signedAt ? d.signedAt.toISOString() : null,
    signatureProvider: d.signatureProvider ?? null,
    signatureRef: d.signatureRef ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

// ── GET /api/client/documents ───────────────────────────────────────────────
// Lista (a) docs que o próprio cliente subiu e (b) docs compartilhados pelo
// CCA marcados como visibleToClient (formulários Caixa pra assinar, por ex).
// O laudo de engenharia NUNCA aparece aqui — fica só no perfil CCA.
router.get("/", requireClient, async (req: any, res) => {
  const ctx = await getClientLead(req.session.userId);
  if (!ctx) {
    res.status(403).json({ error: "Apenas clientes podem acessar seus documentos." });
    return;
  }
  const docs = await db
    .select()
    .from(processDocumentsTable)
    .where(eq(processDocumentsTable.leadId, ctx.lead.id))
    .orderBy(desc(processDocumentsTable.createdAt));

  // Filtra: doc do próprio cliente (uploadedBy === userId) OU visibleToClient.
  const visibleDocs = docs.filter(
    (d) => d.uploadedBy === ctx.user.id || d.visibleToClient,
  );

  res.json({
    categories: CLIENT_DOC_CATEGORIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      required: c.required,
      uploaded: visibleDocs.some((d) => d.slug === c.slug),
    })),
    documents: visibleDocs.map(serializeDoc),
    proceedWithBank: ctx.lead.proceedWithBank ?? null,
  });
});

// ── POST /api/client/documents ──────────────────────────────────────────────
// Persiste um documento que o cliente subiu via presigned URL.
router.post("/", requireClient, async (req: any, res) => {
  const ctx = await getClientLead(req.session.userId);
  if (!ctx) {
    res.status(403).json({ error: "Apenas clientes podem subir documentos." });
    return;
  }

  const { slug, fileUrl, contentType, name } = req.body as Record<string, unknown>;
  if (typeof slug !== "string" || typeof fileUrl !== "string") {
    res.status(400).json({ error: "slug e fileUrl são obrigatórios." });
    return;
  }
  const category = CLIENT_DOC_CATEGORIES.find((c) => c.slug === slug);
  if (!category) {
    res.status(400).json({ error: `Categoria desconhecida: ${slug}` });
    return;
  }

  // Atômico: apaga a versão anterior do mesmo slug + insere a nova em
  // uma transação. Se o insert falhar o cliente não perde o doc antigo.
  const doc = await db.transaction(async (tx) => {
    await tx
      .delete(processDocumentsTable)
      .where(
        and(
          eq(processDocumentsTable.leadId, ctx.lead.id),
          eq(processDocumentsTable.slug, slug),
          eq(processDocumentsTable.uploadedBy, ctx.user.id),
        ),
      );
    const [inserted] = await tx
      .insert(processDocumentsTable)
      .values({
        leadId: ctx.lead.id,
        stage: "aprovacao",
        slug,
        name: typeof name === "string" && name.trim() ? name.trim() : category.name,
        fileUrl,
        contentType: typeof contentType === "string" ? contentType : null,
        uploadedBy: ctx.user.id,
        uploadedByName: ctx.user.name,
        visibleToClient: true, // sempre visível para quem subiu
      })
      .returning();
    return inserted;
  });

  res.status(201).json(serializeDoc(doc));
});

// ── DELETE /api/client/documents/:id ────────────────────────────────────────
// Só permite apagar docs que o próprio cliente subiu E que ainda estão
// pendentes (não aprovados pelo CCA).
router.delete("/:id", requireClient, async (req: any, res) => {
  const ctx = await getClientLead(req.session.userId);
  if (!ctx) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const [doc] = await db
    .select()
    .from(processDocumentsTable)
    .where(eq(processDocumentsTable.id, id))
    .limit(1);
  if (!doc || doc.leadId !== ctx.lead.id) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  if (doc.uploadedBy !== ctx.user.id) {
    res.status(403).json({ error: "Este documento foi enviado pelo correspondente." });
    return;
  }
  if (doc.status === "approved") {
    res.status(409).json({ error: "Documento já aprovado — não pode ser apagado." });
    return;
  }
  if (doc.signedAt) {
    res.status(409).json({ error: "Documento já assinado." });
    return;
  }
  await db.delete(processDocumentsTable).where(eq(processDocumentsTable.id, id));
  res.status(204).end();
});

// ── POST /api/client/documents/:id/sign ─────────────────────────────────────
// Inicia assinatura via gov.br Assinador.
//
// STUB: a integração real exige contrato com o governo, certificado
// ICP-Brasil e cadastro CNPJ no Assinador. Hoje devolvemos 503 com a
// mensagem clara, e quando as credenciais estiverem disponíveis basta
// trocar o corpo desta função pela chamada à API real, persistindo
// signedAt, signatureProvider="gov_br" e signatureRef com o protocolo.
router.post("/:id/sign", requireClient, async (req: any, res) => {
  const ctx = await getClientLead(req.session.userId);
  if (!ctx) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const [doc] = await db
    .select()
    .from(processDocumentsTable)
    .where(eq(processDocumentsTable.id, id))
    .limit(1);
  if (!doc || doc.leadId !== ctx.lead.id) {
    res.status(404).json({ error: "Documento não encontrado." });
    return;
  }
  if (!doc.visibleToClient) {
    res.status(403).json({ error: "Documento não está disponível para o cliente." });
    return;
  }
  if (!doc.signatureRequired) {
    res.status(400).json({ error: "Este documento não requer assinatura." });
    return;
  }
  if (doc.signedAt) {
    res.status(409).json({ error: "Documento já assinado." });
    return;
  }

  // TODO: trocar pelo endpoint real do Assinador gov.br quando o contrato
  // estiver vigente. Hoje devolvemos 503 (Service Unavailable) com mensagem
  // explícita para o cliente saber que a integração está em homologação.
  const GOV_BR_INTEGRATION_AVAILABLE = false;
  if (!GOV_BR_INTEGRATION_AVAILABLE) {
    res.status(503).json({
      error: "gov.br Assinador em homologação",
      message:
        "A assinatura digital via gov.br está em processo de habilitação junto ao governo federal " +
        "(cadastro CNPJ + certificado ICP-Brasil). Por enquanto, o documento ficará marcado como " +
        "aguardando assinatura — assim que a integração for liberada, você receberá uma notificação " +
        "para concluir a assinatura.",
      pendingSince: new Date().toISOString(),
    });
    return;
  }

  // Quando habilitarmos a integração real, este bloco roda:
  // const ref = await govbrSign({ userCpf: ctx.lead.cpf, fileUrl: doc.fileUrl, ... });
  // await db.update(processDocumentsTable).set({
  //   signedAt: new Date(),
  //   signatureProvider: "gov_br",
  //   signatureRef: ref.protocolo,
  //   updatedAt: new Date(),
  // }).where(eq(processDocumentsTable.id, id));
  res.json({ ok: true });
});

// ── PUT /api/client/proceed-with-bank ───────────────────────────────────────
// Cliente sinaliza com qual banco quer prosseguir após ver os scores.
// "caixa" libera o fluxo de assinatura dos formulários CEF compartilhados
// pelo correspondente.
router.put("/proceed-with-bank", requireClient, async (req: any, res) => {
  const ctx = await getClientLead(req.session.userId);
  if (!ctx) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const ALLOWED_BANKS = new Set(["caixa"]);
  const { bank } = req.body as Record<string, unknown>;
  if (bank !== null && (typeof bank !== "string" || !ALLOWED_BANKS.has(bank))) {
    res.status(400).json({
      error: `bank deve ser null ou um de: ${[...ALLOWED_BANKS].join(", ")}.`,
    });
    return;
  }
  await db
    .update(leadsTable)
    .set({ proceedWithBank: (bank as string) ?? null, updatedAt: new Date() })
    .where(eq(leadsTable.id, ctx.lead.id));
  res.json({ proceedWithBank: bank ?? null });
});

export default router;
