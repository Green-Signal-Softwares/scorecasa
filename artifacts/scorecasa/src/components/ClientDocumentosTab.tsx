import { useEffect, useRef, useState } from "react";
import {
  Upload, FileText, CheckCircle2, Clock, Trash2,
  ShieldCheck, Loader2, AlertCircle, PenLine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BankAndCorrespondentPicker } from "@/components/BankAndCorrespondentPicker";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Category = {
  slug: string;
  name: string;
  required: boolean;
  uploaded: boolean;
};

type Doc = {
  id: number;
  leadId: number;
  stage: string;
  slug: string;
  name: string;
  fileUrl: string;
  contentType: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  uploadedByName: string | null;
  visibleToClient: boolean;
  signatureRequired: boolean;
  signedAt: string | null;
  signatureProvider: string | null;
  signatureRef: string | null;
  createdAt: string;
  updatedAt: string;
};

type DocsPayload = {
  categories: Category[];
  documents: Doc[];
  proceedWithBank: string | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch {
    return iso;
  }
}

async function presignAndUpload(file: File): Promise<string> {
  const r = await fetch(`${BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!r.ok) throw new Error("Falha ao solicitar URL de upload");
  const { uploadURL, objectPath } = (await r.json()) as {
    uploadURL: string; objectPath: string;
  };
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("Falha ao enviar o arquivo");
  return objectPath;
}

// ── Upload card por categoria ───────────────────────────────────────────────

function UploadCard({
  category,
  doc,
  onUploaded,
  onDelete,
}: {
  category: Category;
  doc: Doc | undefined;
  onUploaded: () => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 15 MB." });
      return;
    }
    setBusy(true);
    try {
      const objectPath = await presignAndUpload(file);
      const r = await fetch(`${BASE}/api/client/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: category.slug,
          fileUrl: objectPath,
          contentType: file.type || null,
          name: category.name,
        }),
      });
      if (!r.ok) throw new Error("Falha ao registrar documento");
      toast({ title: "Documento enviado", description: category.name });
      onUploaded();
    } catch (err: any) {
      toast({ title: "Erro no envio", description: err?.message ?? "Tente novamente." });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirm(`Remover "${category.name}"?`)) return;
    setBusy(true);
    try {
      await onDelete(doc.id);
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = doc
    ? doc.status === "approved"
      ? { label: "Aprovado pelo correspondente", icon: CheckCircle2, color: "#065F46", bg: "#D1FAE5" }
      : doc.status === "rejected"
      ? { label: `Rejeitado${doc.notes ? `: ${doc.notes}` : ""}`, icon: AlertCircle, color: "#991B1B", bg: "#FEE2E2" }
      : { label: "Aguardando análise", icon: Clock, color: "#92400E", bg: "#FEF3C7" }
    : null;

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white" data-testid={`docs-card-${category.slug}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={handleFile}
        className="hidden"
      />
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: doc ? "#D1FAE5" : "#EEF1FF" }}
        >
          {doc ? (
            <FileText className="w-5 h-5" style={{ color: "#065F46" }} />
          ) : (
            <Upload className="w-5 h-5" style={{ color: "#0D1B8C" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{category.name}</span>
            {category.required && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">
                Obrigatório
              </span>
            )}
          </div>
          {doc ? (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs text-gray-500">Enviado em {fmtDate(doc.createdAt)}</div>
              {statusBadge && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
                  style={{ color: statusBadge.color, background: statusBadge.bg }}
                >
                  <statusBadge.icon className="w-3.5 h-3.5" />
                  {statusBadge.label}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">PDF, PNG ou JPG até 15 MB.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handlePick}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: "#0D1B8C" }}
          data-testid={`docs-upload-btn-${category.slug}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {doc ? "Substituir" : "Enviar arquivo"}
        </button>
        {doc && doc.status !== "approved" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            data-testid={`docs-delete-btn-${category.slug}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Card de formulário CCA para assinatura gov.br ───────────────────────────

function SignatureCard({
  doc,
  onSigned,
}: {
  doc: Doc;
  onSigned: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const signed = !!doc.signedAt;

  const handleSign = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/client/documents/${doc.id}/sign`, {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 503) {
        toast({
          title: "Assinatura gov.br em homologação",
          description: body?.message ?? "Integração ainda não habilitada.",
        });
        return;
      }
      if (!r.ok) throw new Error(body?.error ?? "Falha ao iniciar assinatura");
      toast({ title: "Documento assinado", description: doc.name });
      onSigned();
    } catch (err: any) {
      toast({ title: "Erro na assinatura", description: err?.message ?? "Tente novamente." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white" data-testid={`sign-card-${doc.id}`}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: signed ? "#D1FAE5" : "#FEF3C7" }}
        >
          {signed ? (
            <ShieldCheck className="w-5 h-5" style={{ color: "#065F46" }} />
          ) : (
            <PenLine className="w-5 h-5" style={{ color: "#92400E" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{doc.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Compartilhado por {doc.uploadedByName ?? "correspondente"} · {fmtDate(doc.createdAt)}
          </div>
          {signed ? (
            <div className="mt-2 text-xs text-emerald-700 font-medium">
              Assinado em {fmtDate(doc.signedAt!)}
              {doc.signatureRef ? ` · protocolo ${doc.signatureRef}` : ""}
            </div>
          ) : (
            <p className="text-xs text-gray-600 mt-1.5">
              Este formulário precisa ser assinado digitalmente via gov.br para prosseguir com a Caixa.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`${BASE}/api/storage/objects/${doc.fileUrl.replace(/^\/?objects\//, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
          data-testid={`sign-preview-${doc.id}`}
        >
          <FileText className="w-3.5 h-3.5" /> Ver documento
        </a>
        {!signed && (
          <button
            type="button"
            onClick={handleSign}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: "#0D1B8C" }}
            data-testid={`sign-btn-${doc.id}`}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Assinar via gov.br
          </button>
        )}
      </div>
    </div>
  );
}

// ── Banner: prosseguir com Caixa ────────────────────────────────────────────

function ProceedBankBanner({
  proceedWithBank,
  scoreApproved,
  onSet,
}: {
  proceedWithBank: string | null;
  scoreApproved: boolean;
  onSet: (bank: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!scoreApproved) return null;

  if (proceedWithBank === "caixa") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-emerald-900">Prosseguindo com a Caixa</div>
          <div className="text-xs text-emerald-800">
            Você optou por seguir com o financiamento pela Caixa. Os formulários CEF aparecerão abaixo assim que o correspondente compartilhar.
          </div>
        </div>
        <button
          type="button"
          onClick={async () => { setBusy(true); try { await onSet(null); } finally { setBusy(false); } }}
          disabled={busy}
          className="text-xs font-semibold text-emerald-900 underline hover:no-underline disabled:opacity-50"
        >
          Desfazer
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4" style={{ background: "#EEF1FF", borderColor: "#0D1B8C33" }}>
      <div className="text-sm font-semibold text-[#07113A]">Seu score Caixa está aprovado!</div>
      <p className="text-xs text-gray-700 mt-1">
        Para iniciar o processo de financiamento pela Caixa, confirme abaixo. O correspondente receberá os formulários CEF preenchidos e você assinará via gov.br.
      </p>
      <button
        type="button"
        onClick={async () => { setBusy(true); try { await onSet("caixa"); } finally { setBusy(false); } }}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        style={{ background: "#0D1B8C" }}
        data-testid="docs-proceed-caixa-btn"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Quero prosseguir com a Caixa
      </button>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export function ClientDocumentosTab({ lead }: { lead: any }) {
  const { toast } = useToast();
  const [data, setData] = useState<DocsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const scoreApproved =
    (lead?.scoreCaixa ?? 0) >= 650 && (lead?.approvalChance ?? 0) >= 60;

  const load = async () => {
    try {
      const r = await fetch(`${BASE}/api/client/documents`, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar documentos");
      setData((await r.json()) as DocsPayload);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: number) => {
    const r = await fetch(`${BASE}/api/client/documents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      toast({ title: "Não foi possível remover", description: body?.error ?? "" });
      return;
    }
    toast({ title: "Documento removido" });
    await load();
  };

  const handleSetBank = async (bank: string | null) => {
    const r = await fetch(`${BASE}/api/client/documents/proceed-with-bank`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bank }),
    });
    if (!r.ok) {
      toast({ title: "Erro", description: "Não foi possível salvar sua escolha." });
      return;
    }
    toast({
      title: bank === "caixa" ? "Optou por prosseguir com a Caixa" : "Escolha desfeita",
    });
    await load();
  };

  if (loading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const docsBySlug = new Map<string, Doc>();
  for (const d of data.documents) {
    // pega o mais recente por slug
    const cur = docsBySlug.get(d.slug);
    if (!cur || new Date(d.createdAt) > new Date(cur.createdAt)) docsBySlug.set(d.slug, d);
  }

  // Formulários CEF compartilhados pelo CCA (signatureRequired + visibleToClient)
  const ccaForms = data.documents.filter((d) => d.signatureRequired && d.visibleToClient);

  const showBalloon =
    scoreApproved &&
    data.categories
      .filter((c) => c.required)
      .some((c) => !docsBySlug.has(c.slug));

  return (
    <div className="space-y-5">
      {showBalloon && (
        <div
          className="rounded-2xl border p-5 shadow-sm flex items-start gap-4"
          style={{ background: "#FEF3C7", borderColor: "#F59E0B66" }}
          data-testid="docs-balloon-pending"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#F59E0B" }}
          >
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-[#92400E]">
              Seu score foi aprovado — falta enviar seus documentos
            </h3>
            <p className="text-sm text-[#7C2D12] mt-1 leading-relaxed">
              Como sua análise está aprovada (Score Caixa ≥ 650 e Índice de Aprovação ≥ 60%),
              o próximo passo é enviar os documentos pessoais abaixo para que o correspondente
              monte sua proposta junto à Caixa.
            </p>
          </div>
        </div>
      )}

      {/* Bloco "Meu Financiamento": escolha de banco + correspondente.
          Mesma fonte (useBanksAndCorrespondents) que o subtab Bancos do
          Resumo — qualquer mudança aqui reflete lá e vice-versa. */}
      {scoreApproved && (
        <section data-testid="meu-financiamento-section">
          <BankAndCorrespondentPicker />
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-[#07113A] mb-1">Documentos pessoais</h2>
        <p className="text-xs text-gray-500 mb-4">
          Envie cada documento abaixo. Eles ficam disponíveis para o correspondente Caixa autorizado.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {data.categories.map((c) => (
            <UploadCard
              key={c.slug}
              category={c}
              doc={docsBySlug.get(c.slug)}
              onUploaded={load}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-[#07113A]">Formulários para assinar</h2>
          {ccaForms.length > 0 && (
            <span className="text-xs font-semibold text-[#0D1B8C] bg-[#EEF1FF] px-2 py-0.5 rounded">
              {ccaForms.filter((d) => !d.signedAt).length} pendente(s)
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Formulários CEF (proposta, DPS etc.) compartilhados pelo correspondente. A assinatura é digital, via gov.br.
        </p>
        {ccaForms.length === 0 ? (
          <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
            Nenhum formulário compartilhado ainda. Quando o correspondente enviar, eles aparecerão aqui.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {ccaForms.map((doc) => (
              <SignatureCard key={doc.id} doc={doc} onSigned={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
