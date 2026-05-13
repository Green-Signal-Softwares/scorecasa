import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetLead,
  useGetLeadScore,
  useUpdateLead,
  useGetBrokers,
  getGetLeadQueryKey,
  getGetLeadScoreQueryKey,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { pdf } from "@react-pdf/renderer";
import { LeadReport } from "@/components/pdf/LeadReport";
import {
  ArrowLeft, CheckCircle, TrendingUp, TrendingDown, Minus,
  Building2, Phone, Mail, DollarSign, Pencil, X, Save, RefreshCw,
  FileDown,
} from "lucide-react";
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

export function LeadDetails() {
  const [, params] = useRoute("/leads/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: lead, isLoading } = useGetLead(id, {
    query: { enabled: !!id, queryKey: getGetLeadQueryKey(id) },
  });
  const { data: score, isLoading: scoreLoading } = useGetLeadScore(id, {
    query: { enabled: !!id, queryKey: getGetLeadScoreQueryKey(id) },
  });
  const { data: brokers } = useGetBrokers({});
  const updateLead = useUpdateLead();

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
      const blob = await pdf(
        <LeadReport lead={lead} score={score ?? null} />
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
              <div className="text-sm font-semibold text-foreground mb-2">Recomendacao IA</div>
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
        </div>
      </div>
    </div>
  );
}
