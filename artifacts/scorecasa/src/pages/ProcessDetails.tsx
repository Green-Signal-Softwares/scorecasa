import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  useGetProcess,
  useChangeProcessStage,
  useRegisterProcessDocument,
  useUpdateProcessDocument,
  useDeleteProcessDocument,
  getGetProcessQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
function useUpload(opts: { onError?: (err: Error) => void } = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao gerar URL");
      const data = await res.json() as { uploadURL: string; objectPath: string };
      const put = await fetch(data.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error("Falha ao enviar arquivo");
      return data;
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error("Upload falhou"));
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  return { uploadFile, isUploading };
}
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, FileText, Upload, Check, X, Trash2, Download,
  CheckCircle2, Clock, AlertCircle, History, ArrowRight,
  ShieldX, Home, Building2, MapPin,
} from "lucide-react";
import { SbpeRecommendationBlock } from "@/components/SbpeRecommendationBlock";

const STAGES = [
  { id: "aprovacao",    label: "Aprovação",    color: "#0D1B8C", bg: "#EEF2FF" },
  { id: "engenharia",   label: "Engenharia",   color: "#D97706", bg: "#FFFBEB" },
  { id: "conformidade", label: "Conformidade", color: "#0891B2", bg: "#ECFEFF" },
  { id: "assinatura",   label: "Contrato",     color: "#10A65A", bg: "#F0FDF4" },
  { id: "concluido",    label: "Concluído",    color: "#047857", bg: "#ECFDF5" },
] as const;

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ProcessDetails({ leadId }: { leadId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useGetProcess(leadId);
  const changeStage = useChangeProcessStage();
  const registerDoc = useRegisterProcessDocument();
  const updateDoc = useUpdateProcessDocument();
  const deleteDoc = useDeleteProcessDocument();

  const [activeStage, setActiveStage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCtx, setUploadCtx] = useState<{ stage: string; slug: string; label: string } | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: (err) => toast({ title: "Erro no upload", description: err.message }),
  });

  if (isLoading || !data) {
    return (
      <div className="p-8 text-center text-muted-foreground">Carregando processo…</div>
    );
  }

  const { summary, documents, history, checklist } = data as any;
  const currentStage = activeStage ?? summary.stage;
  const stageInfo = STAGES.find((s) => s.id === currentStage) ?? STAGES[0];
  const currentChecklist = checklist.filter((c: any) => c.stage === currentStage);
  const currentDocs = documents.filter((d: any) => d.stage === currentStage);

  const stageIdx = STAGES.findIndex((s) => s.id === summary.stage);
  const nextStage = stageIdx >= 0 && stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetProcessQueryKey(leadId) });

  const handleAdvance = (stageId: string) => {
    changeStage.mutate(
      { leadId, data: { stage: stageId as any } },
      {
        onSuccess: () => {
          toast({ title: "Etapa atualizada", description: `Processo movido para ${STAGES.find((s) => s.id === stageId)?.label ?? stageId}.` });
          invalidate();
        },
      },
    );
  };

  const handleSelectFile = (stage: string, slug: string, label: string) => {
    setUploadCtx({ stage, slug, label });
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadCtx) return;
    const result = await uploadFile(file);
    if (!result) return;
    registerDoc.mutate(
      {
        leadId,
        data: {
          stage: uploadCtx.stage as any,
          slug: uploadCtx.slug,
          name: uploadCtx.label || file.name,
          fileUrl: result.objectPath,
          contentType: file.type || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Documento enviado", description: uploadCtx.label });
          setUploadCtx(null);
          invalidate();
        },
      },
    );
  };

  const handleStatus = (docId: number, status: "approved" | "rejected") => {
    updateDoc.mutate(
      { leadId, docId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: status === "approved" ? "Documento aprovado" : "Documento rejeitado" });
          invalidate();
        },
      },
    );
  };

  const handleDelete = (docId: number) => {
    if (!confirm("Remover este documento do processo?")) return;
    deleteDoc.mutate(
      { leadId, docId },
      { onSuccess: () => { toast({ title: "Documento removido" }); invalidate(); } },
    );
  };

  // Stats per stage
  const statsByStage = (stageId: string) => {
    const reqs = checklist.filter((c: any) => c.stage === stageId && c.required);
    const docsForStage = documents.filter((d: any) => d.stage === stageId);
    const approved = reqs.filter((r: any) =>
      docsForStage.some((d: any) => d.slug === r.slug && d.status === "approved"),
    ).length;
    return { required: reqs.length, approved, uploaded: docsForStage.length };
  };

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/processos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#07113A" }}>
              {summary.leadName}
            </h1>
            <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              <span>CPF {summary.leadCpf}</span>
              {summary.residentCity && (
                <span className="inline-flex items-center gap-1">
                  · <Home className="w-3 h-3" /> Mora em {summary.residentCity}/{summary.residentState}
                </span>
              )}
              {summary.propertyCity && (
                <span className="inline-flex items-center gap-1">
                  · <Building2 className="w-3 h-3" /> Imóvel em {summary.propertyCity}/{summary.propertyState}
                </span>
              )}
              <span>
                · <span className="font-semibold" style={{ color: "#10A65A" }}>
                  {fmtCurrency(Number(summary.propertyValue) || 0)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {nextStage && (
          <Button
            onClick={() => handleAdvance(nextStage.id)}
            disabled={changeStage.isPending}
            style={{ background: "#10A65A", color: "white" }}
            data-testid="button-advance-stage"
          >
            Avançar para {nextStage.label}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        )}
      </div>

      {/* MCMV blocker + linked property */}
      {(summary.alreadyOwnsPropertyInPropertyCity || summary.linkedProperty) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.alreadyOwnsPropertyInPropertyCity && (
            <Card className="p-3 flex items-start gap-3" style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }} data-testid="alert-mcmv-blocked">
              <ShieldX className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#991B1B" }} />
              <div className="text-xs" style={{ color: "#991B1B" }}>
                <div className="font-bold text-sm mb-0.5">MCMV bloqueado</div>
                Cliente já possui imóvel no município{summary.propertyCity ? ` de ${summary.propertyCity}/${summary.propertyState}` : ""}. Avaliar SBPE como alternativa.
              </div>
            </Card>
          )}
          {/* Pivot SBPE — aparece logo abaixo (ou ao lado em md+) do bloqueador
              MCMV para o broker já enxergar bancos elegíveis e parcela
              indicativa sem precisar abrir o detalhe do lead. */}
          {summary.alreadyOwnsPropertyInPropertyCity && summary.sbpeRecommendation && (
            <div className="md:col-span-2">
              <SbpeRecommendationBlock rec={summary.sbpeRecommendation} />
            </div>
          )}
          {summary.linkedProperty && (
            <Card className="p-3 flex items-center gap-3" data-testid="card-linked-property">
              {summary.linkedProperty.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={summary.linkedProperty.imageUrl}
                  alt={summary.linkedProperty.title}
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2FF" }}>
                  <Building2 className="w-6 h-6" style={{ color: "#0D1B8C" }} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#0D1B8C" }}>
                  Imóvel vinculado (ScoreCasa Imóveis)
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: "#07113A" }}>
                  {summary.linkedProperty.title}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {summary.linkedProperty.city}/{summary.linkedProperty.state}
                  <span>· </span>
                  <span className="font-semibold" style={{ color: "#10A65A" }}>
                    {fmtCurrency(Number(summary.linkedProperty.price) || 0)}
                  </span>
                </div>
              </div>
              <Link href={`/imoveis/${summary.linkedProperty.id}`}>
                <Button variant="outline" size="sm" className="flex-shrink-0" data-testid="link-linked-property">
                  Ver imóvel
                </Button>
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* Stage progress */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {STAGES.map((s, idx) => {
            const stats = statsByStage(s.id);
            const isCurrent = s.id === summary.stage;
            const isPast = idx < stageIdx;
            const isActiveTab = s.id === currentStage;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStage(s.id)}
                data-testid={`stage-tab-${s.id}`}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  isActiveTab ? "shadow-md" : "border-transparent hover:bg-muted/40"
                }`}
                style={{
                  borderColor: isActiveTab ? s.color : "transparent",
                  background: isActiveTab ? s.bg : isPast ? "#F0FDF4" : "transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: isPast ? "#10A65A" : s.color }}>
                    {isPast ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: s.color }}>
                    {s.label}
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {stats.approved}/{stats.required} obrigatórios
                  {isCurrent && <span className="ml-1.5 text-[10px] font-bold" style={{ color: s.color }}>· ATUAL</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Stage content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm" style={{ color: stageInfo.color }}>
                Checklist · {stageInfo.label}
              </h2>
              <Badge variant="outline" style={{ background: stageInfo.bg, color: stageInfo.color, borderColor: stageInfo.color }}>
                {currentDocs.length} enviado{currentDocs.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="space-y-2">
              {currentChecklist.map((item: any) => {
                const doc = currentDocs.find((d: any) => d.slug === item.slug);
                return (
                  <div
                    key={item.slug}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors"
                    data-testid={`checklist-${item.slug}`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {doc ? (
                        doc.status === "approved" ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#10A65A" }} />
                        ) : doc.status === "rejected" ? (
                          <X className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#DC2626" }} />
                        ) : (
                          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#D97706" }} />
                        )
                      ) : item.required ? (
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: "#07113A" }}>
                          {item.label}
                          {item.required && <span className="ml-1 text-[10px] text-red-600">*</span>}
                        </div>
                        {doc && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            Enviado por {doc.uploadedByName ?? "—"} · {fmtDate(doc.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {doc ? (
                        <>
                          <a href={`/api/storage${doc.fileUrl.startsWith("/") ? doc.fileUrl : `/${doc.fileUrl}`}`} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          {doc.status !== "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleStatus(doc.id, "approved")}
                              style={{ color: "#10A65A" }}
                              data-testid={`approve-${item.slug}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {doc.status !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleStatus(doc.id, "rejected")}
                              style={{ color: "#DC2626" }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleSelectFile(item.stage, item.slug, item.label)}
                          disabled={isUploading}
                          data-testid={`upload-${item.slug}`}
                        >
                          <Upload className="w-3 h-3 mr-1" /> Enviar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Extra docs (uploaded outside checklist) */}
            {currentDocs.filter((d: any) => !currentChecklist.some((c: any) => c.slug === d.slug)).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Outros documentos</div>
                {currentDocs
                  .filter((d: any) => !currentChecklist.some((c: any) => c.slug === d.slug))
                  .map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span>{doc.name}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        {/* History sidebar */}
        <Card className="p-4 h-fit">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5" style={{ color: "#07113A" }}>
            <History className="w-4 h-4" /> Histórico
          </h3>
          {history.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Nenhuma mudança registrada.
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice().reverse().map((h: any) => {
                const to = STAGES.find((s) => s.id === h.toStage);
                const from = h.fromStage ? STAGES.find((s) => s.id === h.fromStage) : null;
                return (
                  <div key={h.id} className="text-xs border-l-2 pl-3 pb-1" style={{ borderColor: to?.color ?? "#0D1B8C" }}>
                    <div className="font-semibold" style={{ color: to?.color ?? "#0D1B8C" }}>
                      {from ? `${from.label} → ${to?.label}` : `Iniciado em ${to?.label}`}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {h.changedByName ?? "—"} · {fmtDate(h.createdAt)}
                    </div>
                    {h.notes && <div className="mt-1 text-muted-foreground italic">"{h.notes}"</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
