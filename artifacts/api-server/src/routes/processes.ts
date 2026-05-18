import { Router } from "express";
import {
  db,
  leadsTable,
  usersTable,
  brokersTable,
  processDocumentsTable,
  processStageHistoryTable,
} from "@workspace/db";
import { eq, and, or, isNotNull, desc, asc, inArray } from "drizzle-orm";
import {
  ChangeProcessStageBody as ChangeStageRequest,
  RegisterProcessDocumentBody as RegisterDocumentRequest,
  UpdateProcessDocumentBody as UpdateDocumentRequest,
  ListProcessesQueryParams as ListProcessesParams,
} from "@workspace/api-zod";

const router = Router();

const STAFF_ROLES = ["admin", "analyst", "correspondent"] as const;

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

async function requireStaff(req: any, res: any, next: any) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!STAFF_ROLES.includes(user.role as any)) {
    res.status(403).json({ error: "Acesso restrito a equipe interna." });
    return;
  }
  req.sessionUser = user;
  next();
}

router.use(requireStaff);

// ── Document checklist per stage (RAUZEE-style) ─────────────────────────────
const CHECKLIST = [
  { stage: "aprovacao", slug: "rg_cnh", label: "RG ou CNH (frente e verso)", required: true },
  { stage: "aprovacao", slug: "cpf", label: "CPF", required: true },
  { stage: "aprovacao", slug: "comp_residencia", label: "Comprovante de residência (últimos 3 meses)", required: true },
  { stage: "aprovacao", slug: "estado_civil", label: "Certidão de nascimento ou casamento", required: true },
  { stage: "aprovacao", slug: "contracheque", label: "Contracheques (3 últimos)", required: true },
  { stage: "aprovacao", slug: "irpf", label: "Declaração de IRPF + recibo", required: true },
  { stage: "aprovacao", slug: "extrato_bancario", label: "Extrato bancário (3 meses)", required: true },
  { stage: "aprovacao", slug: "fgts", label: "Extrato do FGTS", required: false },

  { stage: "engenharia", slug: "matricula_imovel", label: "Matrícula atualizada do imóvel", required: true },
  { stage: "engenharia", slug: "iptu", label: "IPTU (último carnê)", required: true },
  { stage: "engenharia", slug: "habite_se", label: "Habite-se / averbação de construção", required: false },
  { stage: "engenharia", slug: "laudo_caixa", label: "Laudo de avaliação de engenharia (Caixa)", required: true },

  { stage: "conformidade", slug: "cnd_vendedor", label: "Certidões negativas do vendedor", required: true },
  { stage: "conformidade", slug: "cnd_comprador", label: "Certidões negativas do comprador", required: true },
  { stage: "conformidade", slug: "analise_juridica", label: "Análise jurídica aprovada", required: true },
  { stage: "conformidade", slug: "iti_vendedor", label: "Certidão de inteiro teor do imóvel", required: false },

  { stage: "assinatura", slug: "contrato", label: "Contrato de financiamento assinado", required: true },
  { stage: "assinatura", slug: "registro_imovel", label: "Registro do contrato no cartório", required: true },
  { stage: "assinatura", slug: "comprovante_pgto", label: "Comprovante de pagamento ITBI/registro", required: true },
] as const;

const STAGE_ORDER = ["aprovacao", "engenharia", "conformidade", "assinatura", "concluido"] as const;
type Stage = (typeof STAGE_ORDER)[number];

function isStage(s: string): s is Stage {
  return (STAGE_ORDER as readonly string[]).includes(s);
}

function effectiveStage(lead: { processStage: string | null; status: string }): Stage {
  if (lead.processStage && isStage(lead.processStage)) return lead.processStage;
  if (lead.status === "in_progress") return "engenharia";
  return "aprovacao";
}

// ── GET /api/correspondent/processes ────────────────────────────────────────
router.get("/", async (req, res) => {
  const parsed = ListProcessesParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const stageFilter = parsed.data.stage;

  // Only leads que foram aprovados (ou já estão na esteira de processos) entram aqui.
  const leads = await db
    .select()
    .from(leadsTable)
    .where(
      or(
        eq(leadsTable.status, "approved"),
        eq(leadsTable.status, "in_progress"),
        isNotNull(leadsTable.processStage),
      ),
    );
  if (leads.length === 0) {
    res.json([]);
    return;
  }

  const leadIds = leads.map((l) => l.id);
  const docs = await db.select().from(processDocumentsTable).where(inArray(processDocumentsTable.leadId, leadIds));

  // Index brokers and correspondents
  const brokerIds = leads.map((l) => l.brokerId).filter((x): x is number => typeof x === "number");
  const brokers = brokerIds.length
    ? await db.select().from(brokersTable).where(inArray(brokersTable.id, brokerIds))
    : [];
  const brokerById = new Map(brokers.map((b) => [b.id, b.name]));

  const corrIds = leads.map((l) => l.correspondentId).filter((x): x is number => typeof x === "number");
  const corrs = corrIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, corrIds))
    : [];
  const corrById = new Map(corrs.map((c) => [c.id, c.name]));

  const summaries = leads.map((lead) => {
    const stage = effectiveStage(lead);
    const myDocs = docs.filter((d) => d.leadId === lead.id);
    return {
      leadId: lead.id,
      leadName: lead.name,
      leadCpf: lead.cpf,
      propertyValue: lead.propertyValue,
      propertyCity: lead.propertyCity ?? undefined,
      propertyState: lead.propertyState ?? undefined,
      stage,
      brokerName: lead.brokerId ? brokerById.get(lead.brokerId) ?? undefined : undefined,
      correspondentName: lead.correspondentId ? corrById.get(lead.correspondentId) ?? undefined : undefined,
      documentsCount: myDocs.length,
      documentsApproved: myDocs.filter((d) => d.status === "approved").length,
      documentsPending: myDocs.filter((d) => d.status === "pending").length,
      lastUpdate: lead.updatedAt.toISOString(),
    };
  });

  const filtered = stageFilter ? summaries.filter((s) => s.stage === stageFilter) : summaries;
  res.json(filtered);
});

// ── GET /api/correspondent/processes/:leadId ────────────────────────────────
async function buildDetail(leadId: number) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead) return null;

  const docs = await db
    .select()
    .from(processDocumentsTable)
    .where(eq(processDocumentsTable.leadId, leadId))
    .orderBy(desc(processDocumentsTable.createdAt));

  const history = await db
    .select()
    .from(processStageHistoryTable)
    .where(eq(processStageHistoryTable.leadId, leadId))
    .orderBy(asc(processStageHistoryTable.createdAt));

  let brokerName: string | undefined;
  if (lead.brokerId) {
    const [b] = await db.select().from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
    brokerName = b?.name;
  }
  let correspondentName: string | undefined;
  if (lead.correspondentId) {
    const [c] = await db.select().from(usersTable).where(eq(usersTable.id, lead.correspondentId)).limit(1);
    correspondentName = c?.name;
  }

  const stage = effectiveStage(lead);
  return {
    summary: {
      leadId: lead.id,
      leadName: lead.name,
      leadCpf: lead.cpf,
      propertyValue: lead.propertyValue,
      propertyCity: lead.propertyCity ?? undefined,
      propertyState: lead.propertyState ?? undefined,
      stage,
      brokerName,
      correspondentName,
      documentsCount: docs.length,
      documentsApproved: docs.filter((d) => d.status === "approved").length,
      documentsPending: docs.filter((d) => d.status === "pending").length,
      lastUpdate: lead.updatedAt.toISOString(),
    },
    documents: docs.map((d) => ({
      id: d.id,
      leadId: d.leadId,
      stage: d.stage,
      slug: d.slug,
      name: d.name,
      fileUrl: d.fileUrl,
      contentType: d.contentType ?? undefined,
      status: d.status,
      notes: d.notes ?? undefined,
      uploadedByName: d.uploadedByName ?? undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    history: history.map((h) => ({
      id: h.id,
      leadId: h.leadId,
      fromStage: h.fromStage ?? undefined,
      toStage: h.toStage,
      changedByName: h.changedByName ?? undefined,
      notes: h.notes ?? undefined,
      createdAt: h.createdAt.toISOString(),
    })),
    checklist: CHECKLIST.map((c) => ({ ...c })),
  };
}

router.get("/:leadId", async (req, res) => {
  const leadId = Number(req.params.leadId);
  if (!Number.isFinite(leadId)) {
    res.status(400).json({ error: "Invalid leadId" });
    return;
  }
  const detail = await buildDetail(leadId);
  if (!detail) {
    res.status(404).json({ error: "Process not found" });
    return;
  }
  res.json(detail);
});

// ── PUT /api/correspondent/processes/:leadId/stage ──────────────────────────
router.put("/:leadId/stage", async (req, res) => {
  const leadId = Number(req.params.leadId);
  if (!Number.isFinite(leadId)) {
    res.status(400).json({ error: "Invalid leadId" });
    return;
  }
  const parsed = ChangeStageRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const fromStage = effectiveStage(lead);
  const toStage = parsed.data.stage as Stage;
  const sessionUser = (req as any).sessionUser as { id: number; name: string };

  await db.update(leadsTable).set({ processStage: toStage, updatedAt: new Date() }).where(eq(leadsTable.id, leadId));
  await db.insert(processStageHistoryTable).values({
    leadId,
    fromStage,
    toStage,
    changedBy: sessionUser.id,
    changedByName: sessionUser.name,
    notes: parsed.data.notes ?? null,
  });

  const detail = await buildDetail(leadId);
  res.json(detail);
});

// ── POST /api/correspondent/processes/:leadId/documents ─────────────────────
router.post("/:leadId/documents", async (req, res) => {
  const leadId = Number(req.params.leadId);
  if (!Number.isFinite(leadId)) {
    res.status(400).json({ error: "Invalid leadId" });
    return;
  }
  const parsed = RegisterDocumentRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const sessionUser = (req as any).sessionUser as { id: number; name: string };

  const [doc] = await db
    .insert(processDocumentsTable)
    .values({
      leadId,
      stage: parsed.data.stage as Stage,
      slug: parsed.data.slug,
      name: parsed.data.name,
      fileUrl: parsed.data.fileUrl,
      contentType: parsed.data.contentType ?? null,
      notes: parsed.data.notes ?? null,
      uploadedBy: sessionUser.id,
      uploadedByName: sessionUser.name,
      // Flags opcionais usadas pelo CCA para compartilhar formulários CEF
      // já preenchidos com o cliente (que assina via gov.br).
      visibleToClient: parsed.data.visibleToClient ?? false,
      signatureRequired: parsed.data.signatureRequired ?? false,
    })
    .returning();

  res.status(201).json({
    id: doc.id,
    leadId: doc.leadId,
    stage: doc.stage,
    slug: doc.slug,
    name: doc.name,
    fileUrl: doc.fileUrl,
    contentType: doc.contentType ?? undefined,
    status: doc.status,
    notes: doc.notes ?? undefined,
    uploadedByName: doc.uploadedByName ?? undefined,
    visibleToClient: doc.visibleToClient,
    signatureRequired: doc.signatureRequired,
    signedAt: doc.signedAt ? doc.signedAt.toISOString() : null,
    signatureProvider: doc.signatureProvider ?? undefined,
    signatureRef: doc.signatureRef ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
});

// ── PUT /api/correspondent/processes/:leadId/documents/:docId ───────────────
router.put("/:leadId/documents/:docId", async (req, res) => {
  const leadId = Number(req.params.leadId);
  const docId = Number(req.params.docId);
  if (!Number.isFinite(leadId) || !Number.isFinite(docId)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const parsed = UpdateDocumentRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const update: any = { updatedAt: new Date() };
  if (parsed.data.status) update.status = parsed.data.status;
  if (typeof parsed.data.notes === "string") update.notes = parsed.data.notes;
  if (typeof parsed.data.name === "string") update.name = parsed.data.name;

  const [doc] = await db
    .update(processDocumentsTable)
    .set(update)
    .where(and(eq(processDocumentsTable.id, docId), eq(processDocumentsTable.leadId, leadId)))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json({
    id: doc.id,
    leadId: doc.leadId,
    stage: doc.stage,
    slug: doc.slug,
    name: doc.name,
    fileUrl: doc.fileUrl,
    contentType: doc.contentType ?? undefined,
    status: doc.status,
    notes: doc.notes ?? undefined,
    uploadedByName: doc.uploadedByName ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
});

// ── DELETE /api/correspondent/processes/:leadId/documents/:docId ────────────
router.delete("/:leadId/documents/:docId", async (req, res) => {
  const leadId = Number(req.params.leadId);
  const docId = Number(req.params.docId);
  if (!Number.isFinite(leadId) || !Number.isFinite(docId)) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  await db
    .delete(processDocumentsTable)
    .where(and(eq(processDocumentsTable.id, docId), eq(processDocumentsTable.leadId, leadId)));
  res.status(204).end();
});

export default router;
