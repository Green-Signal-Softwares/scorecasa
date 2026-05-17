import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetLead,
  useGetLeadScore,
  useUpdateLead,
  useEnrichLead,
  useGetBrokers,
  getGetLeadQueryKey,
  getGetLeadScoreQueryKey,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, CheckCircle, TrendingUp, TrendingDown, Minus,
  Building2, Phone, Mail, DollarSign, Pencil, X, Save, RefreshCw,
  FileDown, ShieldCheck, ShieldX, AlertTriangle, Landmark, Clock,
  BadgeCheck, ChevronDown, ChevronUp, BarChart3, SlidersHorizontal,
  Navigation, Upload, Sparkles, FileImage,
  XCircle, CheckCircle2,
} from "lucide-react";
import { BankComparison } from "@/components/BankComparison";
import { CreditGPS, computeGpsSteps } from "@/components/CreditGPS";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7" },
  analyzing: { label: "Em Analise", color: "#1E40AF", bg: "#DBEAFE" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE" },
};

const IMPACT_CONFIG = {
  positive: { icon: TrendingUp, color: "#10A65A", bg: "#D1FAE5" },
  negative: { icon: TrendingDown, color: "#EF4444", bg: "#FEE2E2" },
  neutral: { icon: Minus, color: "#6B7280", bg: "#F3F4F6" },
};

const editSchema = z.object({
  name: z.string().min(3, "Nome obrigatorio"),
  email: z.string().email("Email invalido"),
  phone: z.string().min(10, "Telefone invalido"),
  income: z.coerce.number().min(500, "Renda minima R$ 500"),
  propertyValue: z.coerce.number().min(50000, "Valor minimo R$ 50.000"),
  brokerId: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function ScoreGauge({ value, max = 1000, label }: { value: number; max?: number; label: string }) {
  const pct = (value / max) * 100;
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;
  const color = pct >= 65 ? "#10A65A" : pct >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round"
        />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash + circ * 0.25}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="60" y="58" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700 }} className="fill-foreground">{value}</text>
        <text x="60" y="72" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">de {max}</text>
      </svg>
      <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function LeadDetails({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rightTab, setRightTab] = useState<"analise" | "comparativo" | "gps">("analise");

  const { data: lead, isLoading } = useGetLead(id, {
    query: { enabled: !!id, queryKey: getGetLeadQueryKey(id) },
  });
  const { data: score, isLoading: scoreLoading } = useGetLeadScore(id, {
    query: { enabled: !!id, queryKey: getGetLeadScoreQueryKey(id) },
  });
  const { data: brokers } = useGetBrokers({});
  const updateLead = useUpdateLead();
  const enrichLead = useEnrichLead();
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<null | { ok: boolean; message: string; details?: string }>(null);
  // Dados de dívida (parcelas, cartão) e BCB/Registrato/gov.br são exclusivos do
  // cliente — staff não edita aqui. Mantemos no form apenas os campos que o staff
  // pode enriquecer (bureaus, SIRIC, FGTS, score Caixa).
  const [enrichForm, setEnrichForm] = useState({
    serasaScore: "",
    hasNegativations: false,
    negativationsValue: "",
    hasProtests: false,
    protestsValue: "",
    siricStatus: "" as "" | "regular" | "irregular" | "pendente",
    siricObservation: "",
    fgtsMonths: "",
    fgtsMonthlyAvg: "",
    caixaScoreReal: "",
    enrichedBy: "",
  });

  useEffect(() => {
    if (lead && lead.enrichedAt) {
      setEnrichForm({
        serasaScore: lead.serasaScore != null ? String(lead.serasaScore) : "",
        hasNegativations: lead.hasNegativations ?? false,
        negativationsValue: lead.negativationsValue != null ? String(lead.negativationsValue) : "",
        hasProtests: lead.hasProtests ?? false,
        protestsValue: lead.protestsValue != null ? String(lead.protestsValue) : "",
        siricStatus: (lead.siricStatus as "" | "regular" | "irregular" | "pendente") ?? "",
        siricObservation: lead.siricObservation ?? "",
        fgtsMonths: lead.fgtsMonths != null ? String(lead.fgtsMonths) : "",
        fgtsMonthlyAvg: lead.fgtsMonthlyAvg != null ? String(lead.fgtsMonthlyAvg) : "",
        caixaScoreReal: lead.caixaScoreReal != null ? String(lead.caixaScoreReal) : "",
        enrichedBy: lead.enrichedBy ?? "",
      });
    }
  }, [lead?.enrichedAt]);

  const handleOcrUpload = async (file: File) => {
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);

      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${BASE}/api/bureau-ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64, mimeType: file.type, docType: "cca" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao processar documento");
      }

      const data = await resp.json() as {
        docType: "cca" | "bcb";
        enrichFields: Record<string, any>;
        summary: Record<string, any>;
      };

      const ef = data.enrichFields;

      // Staff só importa CCA Caixa (bureaus). Dados de dívida/BCB são exclusivos
      // do cliente, mesmo quando o servidor responde com outros campos.
      setEnrichForm((f) => ({
        ...f,
        hasNegativations: ef.hasNegativations ?? f.hasNegativations,
        negativationsValue: ef.negativationsValue != null ? String((ef.negativationsValue as number).toFixed(2)) : f.negativationsValue,
        hasProtests: ef.hasProtests ?? f.hasProtests,
        protestsValue: ef.protestsValue != null ? String((ef.protestsValue as number).toFixed(2)) : f.protestsValue,
        siricStatus: (ef.siricStatus as any) ?? f.siricStatus,
        siricObservation: ef.siricObservation ?? f.siricObservation,
      }));

      const s = data.summary;
      const details = s.nadaConsta
        ? "Nada consta — cliente sem restrições."
        : [
            s.serasaOcorrencias ? `Serasa: ${s.serasaOcorrencias} ocorrência(s)` : null,
            s.protestosCount ? `Protestos: ${s.protestosCount}` : null,
            s.scpcCount ? `SCPC: ${s.scpcCount} registro(s)` : null,
            s.cadinContratos ? `CADIN: ${s.cadinContratos} contrato(s) em atraso` : null,
          ].filter(Boolean).join(" · ") || "Sem pendências identificadas";

      setOcrResult({
        ok: true,
        message: s.nomeCliente ? `Dados de ${s.nomeCliente} extraídos com sucesso` : "Dados extraídos com sucesso",
        details,
      });
      toast({ title: "CCA Caixa importado", description: "Campos preenchidos automaticamente pela IA." });
    } catch (err: any) {
      setOcrResult({ ok: false, message: err.message ?? "Erro ao processar imagem" });
      toast({ title: "Erro na leitura", description: err.message ?? "Tente novamente com outra imagem." });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleEnrichSave = () => {
    // Staff só envia campos de bureaus/SIRIC/FGTS/Caixa. Dívidas e BCB são
    // exclusivos do cliente — o backend também filtra esses campos por segurança.
    const payload = {
      serasaScore: enrichForm.serasaScore ? Number(enrichForm.serasaScore) : undefined,
      hasNegativations: enrichForm.hasNegativations,
      negativationsValue: enrichForm.hasNegativations && enrichForm.negativationsValue ? Number(enrichForm.negativationsValue) : undefined,
      hasProtests: enrichForm.hasProtests,
      protestsValue: enrichForm.hasProtests && enrichForm.protestsValue ? Number(enrichForm.protestsValue) : undefined,
      siricStatus: enrichForm.siricStatus || undefined,
      siricObservation: enrichForm.siricObservation || undefined,
      fgtsMonths: enrichForm.fgtsMonths ? Number(enrichForm.fgtsMonths) : undefined,
      fgtsMonthlyAvg: enrichForm.fgtsMonthlyAvg ? Number(enrichForm.fgtsMonthlyAvg) : undefined,
      caixaScoreReal: enrichForm.caixaScoreReal ? Number(enrichForm.caixaScoreReal) : undefined,
      enrichedBy: enrichForm.enrichedBy || undefined,
    } as any;
    enrichLead.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetLeadScoreQueryKey(id) });
          toast({ title: "Enriquecimento salvo", description: "Scores recalculados com dados reais." });
        },
        onError: () => toast({ title: "Erro ao salvar", description: "Verifique os dados e tente novamente." }),
      }
    );
  };

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      income: 0,
      propertyValue: 0,
      brokerId: "",
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        income: lead.income,
        propertyValue: lead.propertyValue,
        brokerId: lead.brokerId ? String(lead.brokerId) : "",
      });
    }
  }, [lead, form]);

  const handleExportPDF = async () => {
    if (!lead) return;
    setExporting(true);
    try {
      const [{ pdf }, { LeadReport }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/LeadReport"),
      ]);
      const gpsSteps = computeGpsSteps(lead).filter((s) => s.status !== "done");
      const blob = await pdf(
        <LeadReport lead={lead} score={score ?? null} gpsSteps={gpsSteps} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ScoreCasa_${lead.name.replace(/\s+/g, "_")}_Relatorio.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF exportado com sucesso" });
    } catch {
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente." });
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = (status: string) => {
    updateLead.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
          toast({ title: "Status atualizado" });
        },
      }
    );
  };

  const handleCancelEdit = () => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        income: lead.income,
        propertyValue: lead.propertyValue,
        brokerId: lead.brokerId ? String(lead.brokerId) : "",
      });
    }
    setEditing(false);
  };

  const onSubmit = (data: EditForm) => {
    const financialChanged =
      data.income !== lead?.income || data.propertyValue !== lead?.propertyValue;

    updateLead.mutate(
      {
        id,
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          income: data.income,
          propertyValue: data.propertyValue,
          brokerId: data.brokerId ? Number(data.brokerId) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
          if (financialChanged) {
            queryClient.invalidateQueries({ queryKey: getGetLeadScoreQueryKey(id) });
          }
          setEditing(false);
          toast({
            title: "Lead atualizado",
            description: financialChanged
              ? "Dados financeiros alterados — scores recalculados."
              : "Dados salvos com sucesso.",
          });
        },
        onError: () => {
          toast({ title: "Erro ao salvar", description: "Tente novamente." });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl lg:col-span-1" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <div className="text-muted-foreground">Lead nao encontrado</div>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/leads")}>
          Voltar
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[lead.status];
  const approvalColor =
    (lead.approvalChance ?? 0) >= 70 ? "#10A65A" : (lead.approvalChance ?? 0) >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setLocation("/leads")}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{lead.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm text-muted-foreground">{formatCPF(lead.cpf)}</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ color: statusCfg?.color, background: statusCfg?.bg }}
            >
              {statusCfg?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            data-testid="button-export-pdf"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50 text-foreground"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? "Gerando..." : "Exportar PDF"}
          </button>
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-44" data-testid="select-lead-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4 items-start">

        {/* ── Data card ── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Dados do Cliente</span>
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                    data-testid="button-edit-lead"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                    data-testid="button-cancel-edit"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                )}
              </div>

              {/* Card body */}
              <div className="p-5 space-y-4">
                {editing ? (
                  /* ── Edit mode ── */
                  <>
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Nome completo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input {...field} className="pl-9 h-9 text-sm" data-testid="input-edit-name" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input {...field} type="email" className="pl-9 h-9 text-sm" data-testid="input-edit-email" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Telefone</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input {...field} className="pl-9 h-9 text-sm" data-testid="input-edit-phone" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="income" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Renda (R$)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input {...field} type="number" className="pl-8 h-9 text-sm" data-testid="input-edit-income" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="propertyValue" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Imovel (R$)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input {...field} type="number" className="pl-8 h-9 text-sm" data-testid="input-edit-property-value" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="brokerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Corretor responsavel</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm" data-testid="select-edit-broker">
                              <SelectValue placeholder="Sem corretor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sem corretor</SelectItem>
                            {(brokers ?? []).map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Financial change notice */}
                    {(form.watch("income") !== lead.income || form.watch("propertyValue") !== lead.propertyValue) && (
                      <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#EFF6FF", color: "#1E40AF" }}>
                        <RefreshCw className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>Dados financeiros alterados — os scores serao recalculados ao salvar.</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={updateLead.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                      style={{ background: "#0D1B8C" }}
                      data-testid="button-save-lead-edit"
                    >
                      <Save className="w-4 h-4" />
                      {updateLead.isPending ? "Salvando..." : "Salvar alteracoes"}
                    </button>
                  </>
                ) : (
                  /* ── Read mode ── */
                  <>
                    {[
                      { icon: Mail, label: "Email", value: lead.email },
                      { icon: Phone, label: "Telefone", value: lead.phone },
                      { icon: DollarSign, label: "Renda mensal", value: formatBRL(lead.income) },
                      { icon: Building2, label: "Valor do imovel", value: formatBRL(lead.propertyValue) },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "#EFF6FF" }}
                        >
                          <Icon className="w-4 h-4" style={{ color: "#0D1B8C" }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="text-sm font-medium text-foreground truncate">{value}</div>
                        </div>
                      </div>
                    ))}
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Corretor responsavel</div>
                      <div className="text-sm font-medium text-foreground">
                        {lead.brokerName ?? <span className="text-muted-foreground italic">Nao atribuido</span>}
                      </div>
                    </div>

                    {/* Comprometimento de renda indicator */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Comprometimento de renda</span>
                        <span className="text-xs font-semibold text-foreground">
                          {((lead.propertyValue / (lead.income * 12)) * 100).toFixed(0)}% do salario anual
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (lead.propertyValue / (lead.income * 12 * 4.5)) * 100)}%`,
                            background:
                              lead.propertyValue / (lead.income * 12) <= 3
                                ? "#10A65A"
                                : lead.propertyValue / (lead.income * 12) <= 4.5
                                ? "#F59E0B"
                                : "#EF4444",
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Limite recomendado: 4.5× renda anual
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>

        {/* ── Score panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── Tab bar ── */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border">
            {(
              [
                { key: "analise", label: "Análise", icon: SlidersHorizontal },
                { key: "gps", label: "GPS de Aprovação", icon: Navigation },
                { key: "comparativo", label: "Bancos", icon: BarChart3 },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRightTab(key)}
                data-testid={`tab-${key}`}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-medium transition-all"
                style={
                  rightTab === key
                    ? { background: "#0D1B8C", color: "#fff", boxShadow: "0 1px 4px rgba(13,27,140,.25)" }
                    : { color: "hsl(var(--muted-foreground))" }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {rightTab === "comparativo" ? (
            <BankComparison lead={lead} />
          ) : rightTab === "gps" ? (
            <CreditGPS lead={lead} />
          ) : (
          <>
          {/* Scores */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground mb-4">Analise de Credito</div>
            <div className="flex flex-wrap justify-around gap-6">
              {/* Approval chance gauge */}
              <div className="flex flex-col items-center">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48 * 0.25}`}
                    strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                  />
                  <circle cx="60" cy="60" r="48" fill="none" stroke={approvalColor} strokeWidth="8"
                    strokeDasharray={`${(lead.approvalChance / 100) * 2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48}`}
                    strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  />
                  <text x="60" y="57" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700 }} className="fill-foreground">
                    {lead.approvalChance}%
                  </text>
                  <text x="60" y="70" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">
                    aprovacao
                  </text>
                </svg>
                <div className="text-xs font-medium text-muted-foreground mt-1">Chance IA</div>
              </div>
              <ScoreGauge value={lead.scoreCaixa} max={1000} label="Score Caixa" />
              <ScoreGauge value={lead.scoreMCMV} max={1000} label="Score MCMV" />
            </div>
          </div>

          {/* AI Recommendation */}
          {lead.aiRecommendation && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-2">Recomendação Índice de Aprovação</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.aiRecommendation}</p>
            </div>
          )}

          {/* Score factors */}
          {!scoreLoading && score && score.factors.length > 0 && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-3">Fatores de Score</div>
              <div className="space-y-2.5">
                {score.factors.map((factor) => {
                  const cfg = IMPACT_CONFIG[factor.impact as keyof typeof IMPACT_CONFIG];
                  const Icon = cfg.icon;
                  return (
                    <div key={factor.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: cfg.bg }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold" style={{ color: cfg.color }}>{factor.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{factor.description}</div>
                      </div>
                      {factor.value && (
                        <div className="text-xs font-bold flex-shrink-0" style={{ color: cfg.color }}>{factor.value}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Eligible banks */}
          {!scoreLoading && score?.eligibleBanks && score.eligibleBanks.length > 0 && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-3">Bancos Elegiveis</div>
              <div className="flex flex-wrap gap-2">
                {score.eligibleBanks.map((bank) => (
                  <div
                    key={bank}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                    style={{ background: "#0D1B8C" }}
                    data-testid={`bank-${bank}`}
                  >
                    <CheckCircle className="w-3 h-3" />
                    {bank}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Compromissos financeiros do cliente (somente leitura) ──
              Sempre visível para staff (corretor/correspondente) ao abrir o lead.
              Edição é exclusiva do cliente (via portal). Dados BCB/Registrato/gov.br
              ficam restritos ao dono do lead e não aparecem aqui. */}
          <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                <Landmark className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Compromissos financeiros do cliente</div>
                <div className="text-xs text-muted-foreground mt-0.5">Informado pelo cliente no portal — somente leitura</div>
              </div>
            </div>
            <div className="p-5">
              {(() => {
                const vehicle = lead.vehicleLoanMonthly ?? null;
                const others = lead.otherLoansMonthly ?? null;
                const ccLimit = lead.creditCardLimit ?? null;
                const ccUsagePct = lead.creditCardUsage ?? null;
                const allEmpty = vehicle == null && others == null && ccLimit == null && ccUsagePct == null;

                if (allEmpty) {
                  return (
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground" data-testid="text-debts-empty">
                      Cliente ainda não informou seus compromissos financeiros.
                    </div>
                  );
                }

                const ccUsageBRL = ccUsagePct != null && ccLimit != null ? (ccUsagePct / 100) * ccLimit : null;
                const totalMonthly = (vehicle ?? 0) + (others ?? 0) + (ccUsageBRL ?? 0);
                const fmt = (v: number | null) => v == null ? "—" : formatBRL(v);

                const rows: Array<{ label: string; value: string }> = [
                  { label: "Parcela de veículo", value: fmt(vehicle) },
                  { label: "Outras parcelas", value: fmt(others) },
                  { label: "Limite de cartão de crédito", value: fmt(ccLimit) },
                  {
                    label: "Uso do cartão",
                    value: ccUsagePct == null
                      ? "—"
                      : ccUsageBRL != null
                        ? `${fmt(ccUsageBRL)} (${ccUsagePct.toFixed(0)}%)`
                        : `${ccUsagePct.toFixed(0)}%`,
                  },
                ];

                return (
                  <div className="rounded-lg border border-border overflow-hidden" data-testid="table-debts">
                    <table className="w-full text-xs">
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.label} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                            <td className="px-3 py-2 text-right font-medium text-foreground">{r.value}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/40">
                          <td className="px-3 py-2 font-semibold text-foreground">Total mensal</td>
                          <td className="px-3 py-2 text-right font-bold text-foreground" data-testid="text-debts-total">
                            {formatBRL(totalMonthly)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="px-3 py-2 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/60">
                      Apenas o cliente pode editar estes valores.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Enrichment panel ── */}
          <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => setEnrichOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                  <Landmark className="w-4 h-4" style={{ color: "#0D1B8C" }} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Dados Caixa & Bureaus</div>
                  {lead.enrichedAt ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <BadgeCheck className="w-3 h-3" style={{ color: "#10A65A" }} />
                      <span className="text-xs" style={{ color: "#10A65A" }}>
                        Enriquecido em {new Date(lead.enrichedAt).toLocaleDateString("pt-BR")}
                        {lead.enrichedBy ? ` por ${lead.enrichedBy}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Nao enriquecido — insira dados da consulta Caixa</span>
                    </div>
                  )}
                </div>
              </div>
              {enrichOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {enrichOpen && (
              <div className="px-5 pb-5 space-y-5 border-t border-border">

                {/* ── OCR Import (CCA Caixa) ──
                    Staff só pode importar CCA Caixa (bureaus). Dados de dívida
                    e Registrato/BCB são exclusivos do cliente. */}
                <div className="pt-4 space-y-3">
                  <div className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2FF" }}>
                        <Sparkles className="w-4 h-4" style={{ color: "#0D1B8C" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold mb-0.5" style={{ color: "#07113A" }}>Importar CCA Caixa com IA</div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Envie a imagem ou PDF da Pesquisa Cadastral Simplificada (Caixa Aqui). Extrai Serasa, SCPC, Protestos e CADIN automaticamente.
                        </p>

                        {/* Result feedback */}
                        {ocrResult && (
                          <div
                            className="mt-3 p-3 rounded-lg flex items-start gap-2 text-xs"
                            style={{
                              background: ocrResult.ok ? "#F0FDF4" : "#FEF2F2",
                              color: ocrResult.ok ? "#065F46" : "#991B1B",
                            }}
                          >
                            {ocrResult.ok
                              ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            }
                            <div>
                              <div className="font-semibold">{ocrResult.message}</div>
                              {ocrResult.details && <div className="mt-0.5 opacity-80">{ocrResult.details}</div>}
                            </div>
                          </div>
                        )}

                        <label className="mt-3 flex items-center justify-center gap-2 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            disabled={ocrLoading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleOcrUpload(file);
                              e.target.value = "";
                            }}
                          />
                          <div
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            style={{
                              background: ocrLoading ? "#E2E8F0" : "#0D1B8C",
                              color: ocrLoading ? "#94A3B8" : "#fff",
                              cursor: ocrLoading ? "not-allowed" : "pointer",
                            }}
                          >
                            {ocrLoading ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Analisando com IA...
                              </>
                            ) : (
                              <>
                                <FileImage className="w-3.5 h-3.5" />
                                Selecionar arquivo
                                <Upload className="w-3.5 h-3.5" />
                              </>
                            )}
                          </div>
                        </label>
                        <p className="text-[10px] text-gray-400 text-center mt-1.5">
                          PNG, JPG ou PDF · máx. 10 MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Preencha com os dados consultados no sistema Caixa e nos bureaus (Serasa, SPC). Os scores serao recalculados automaticamente ao salvar.
                </p>

                {/* SIRIC */}
                <div>
                  <div className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide" style={{ color: "#0D1B8C" }}>SIRIC — Sistema Caixa</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Status SIRIC</label>
                      <Select
                        value={enrichForm.siricStatus}
                        onValueChange={(v) => setEnrichForm((f) => ({ ...f, siricStatus: v as any }))}
                      >
                        <SelectTrigger className="h-9 text-sm" data-testid="select-siric-status">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">
                            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Regular</span>
                          </SelectItem>
                          <SelectItem value="irregular">
                            <span className="flex items-center gap-1.5"><ShieldX className="w-3.5 h-3.5 text-red-500" /> Irregular</span>
                          </SelectItem>
                          <SelectItem value="pendente">
                            <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Pendente</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Score Caixa Real</label>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        placeholder="Ex: 720"
                        className="h-9 text-sm"
                        value={enrichForm.caixaScoreReal}
                        onChange={(e) => setEnrichForm((f) => ({ ...f, caixaScoreReal: e.target.value }))}
                        data-testid="input-caixa-score-real"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground block mb-1">Observacao SIRIC</label>
                    <Input
                      placeholder="Ex: Financiamento ativo no SIRIC..."
                      className="h-9 text-sm"
                      value={enrichForm.siricObservation}
                      onChange={(e) => setEnrichForm((f) => ({ ...f, siricObservation: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Serasa / bureaus */}
                <div>
                  <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "#0D1B8C" }}>Serasa / SPC</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Score Serasa (0–1000)</label>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        placeholder="Ex: 680"
                        className="h-9 text-sm"
                        value={enrichForm.serasaScore}
                        onChange={(e) => setEnrichForm((f) => ({ ...f, serasaScore: e.target.value }))}
                        data-testid="input-serasa-score"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-muted-foreground">Restricoes</label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enrichForm.hasNegativations}
                            onChange={(e) => setEnrichForm((f) => ({ ...f, hasNegativations: e.target.checked }))}
                            className="w-4 h-4 rounded"
                            data-testid="check-has-negativations"
                          />
                          <span className="text-xs text-foreground">Negativacoes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enrichForm.hasProtests}
                            onChange={(e) => setEnrichForm((f) => ({ ...f, hasProtests: e.target.checked }))}
                            className="w-4 h-4 rounded"
                            data-testid="check-has-protests"
                          />
                          <span className="text-xs text-foreground">Protestos</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  {(enrichForm.hasNegativations || enrichForm.hasProtests) && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {enrichForm.hasNegativations && (
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Valor negativacoes (R$)</label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Ex: 3500"
                            className="h-9 text-sm"
                            value={enrichForm.negativationsValue}
                            onChange={(e) => setEnrichForm((f) => ({ ...f, negativationsValue: e.target.value }))}
                          />
                        </div>
                      )}
                      {enrichForm.hasProtests && (
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Valor protestos (R$)</label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Ex: 8000"
                            className="h-9 text-sm"
                            value={enrichForm.protestsValue}
                            onChange={(e) => setEnrichForm((f) => ({ ...f, protestsValue: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* FGTS real */}
                <div>
                  <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "#0D1B8C" }}>FGTS — Dados Reais</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Meses de contribuicao</label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 48"
                        className="h-9 text-sm"
                        value={enrichForm.fgtsMonths}
                        onChange={(e) => setEnrichForm((f) => ({ ...f, fgtsMonths: e.target.value }))}
                        data-testid="input-fgts-months"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Deposito medio mensal (R$)</label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 400"
                        className="h-9 text-sm"
                        value={enrichForm.fgtsMonthlyAvg}
                        onChange={(e) => setEnrichForm((f) => ({ ...f, fgtsMonthlyAvg: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Responsavel */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Responsavel pela consulta</label>
                  <Input
                    placeholder="Seu nome ou codigo de corretor"
                    className="h-9 text-sm"
                    value={enrichForm.enrichedBy}
                    onChange={(e) => setEnrichForm((f) => ({ ...f, enrichedBy: e.target.value }))}
                    data-testid="input-enriched-by"
                  />
                </div>

                {/* Warnings */}
                {(enrichForm.hasNegativations || enrichForm.hasProtests || enrichForm.siricStatus === "irregular") && (
                  <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#991B1B" }}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      {[
                        enrichForm.siricStatus === "irregular" && "SIRIC irregular reduz drasticamente a chance de aprovacao Caixa.",
                        enrichForm.hasProtests && "Protestos em cartorio sao critério eliminatorio na maioria dos programas habitacionais.",
                        enrichForm.hasNegativations && "Negativacoes impactam negativamente o score e a analise de credito.",
                      ].filter(Boolean).join(" ")}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEnrichSave}
                  disabled={enrichLead.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-save-enrichment"
                >
                  <Save className="w-4 h-4" />
                  {enrichLead.isPending ? "Recalculando scores..." : "Salvar e recalcular scores"}
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
