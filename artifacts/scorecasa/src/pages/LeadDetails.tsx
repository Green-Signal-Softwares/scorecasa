import { useRoute, useLocation } from "wouter";
import {
  useGetLead,
  useGetLeadScore,
  useUpdateLead,
  useGetBrokers,
  getGetLeadQueryKey,
  getGetLeadScoreQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, Building2, Phone, Mail, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7" },
  analyzing: { label: "Em Analise", color: "#1E40AF", bg: "#DBEAFE" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE" },
};

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
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
        />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash + circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
        />
        <text x="60" y="58" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700 }} className="fill-foreground">{value}</text>
        <text x="60" y="72" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">de {max}</text>
      </svg>
      <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

const IMPACT_CONFIG = {
  positive: { icon: TrendingUp, color: "#10A65A", bg: "#D1FAE5", label: "Positivo" },
  negative: { icon: TrendingDown, color: "#EF4444", bg: "#FEE2E2", label: "Negativo" },
  neutral: { icon: Minus, color: "#6B7280", bg: "#F3F4F6", label: "Neutro" },
};

export function LeadDetails() {
  const [, params] = useRoute("/leads/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useGetLead(id, {
    query: { enabled: !!id, queryKey: getGetLeadQueryKey(id) },
  });
  const { data: score } = useGetLeadScore(id, {
    query: { enabled: !!id, queryKey: getGetLeadScoreQueryKey(id) },
  });
  const { data: brokers } = useGetBrokers({});
  const updateLead = useUpdateLead();

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

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl lg:col-span-1" />
          <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <div className="text-muted-foreground">Lead nao encontrado</div>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/leads")}>Voltar</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[lead.status];
  const approvalColor = (lead.approvalChance ?? 0) >= 70 ? "#10A65A" : (lead.approvalChance ?? 0) >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/leads")} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{lead.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground">{formatCPF(lead.cpf)}</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ color: statusCfg?.color, background: statusCfg?.bg }}
            >
              {statusCfg?.label}
            </span>
          </div>
        </div>
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

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Info card */}
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm space-y-4">
          <div className="text-sm font-semibold text-foreground">Dados do Cliente</div>
          {[
            { icon: Mail, label: "Email", value: lead.email },
            { icon: Phone, label: "Telefone", value: lead.phone },
            { icon: DollarSign, label: "Renda mensal", value: formatBRL(lead.income) },
            { icon: Building2, label: "Valor do imovel", value: formatBRL(lead.propertyValue) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                <Icon className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-medium text-foreground">{value}</div>
              </div>
            </div>
          ))}
          {lead.brokerName && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Corretor responsavel</div>
              <div className="text-sm font-medium text-foreground">{lead.brokerName}</div>
            </div>
          )}
        </div>

        {/* Score panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Scores */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground mb-4">Analise de Credito</div>
            <div className="flex flex-wrap justify-around gap-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48 * 0.25}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                    />
                    <circle cx="60" cy="60" r="48" fill="none" stroke={approvalColor} strokeWidth="8"
                      strokeDasharray={`${(lead.approvalChance / 100) * 2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                    />
                    <text x="60" y="57" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700 }} className="fill-foreground">{lead.approvalChance}%</text>
                    <text x="60" y="70" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">aprovacao</text>
                  </svg>
                </div>
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
          {score && score.factors.length > 0 && (
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
          {score && score.eligibleBanks && score.eligibleBanks.length > 0 && (
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
