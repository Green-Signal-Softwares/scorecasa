import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetClientProfile,
  getGetClientProfileQueryKey,
  useGetLeadScore,
  getGetLeadScoreQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronDown,
  Frown,
  Meh,
  Smile,
  TrendingUp,
  ShieldCheck,
  HelpCircle,
  LogOut,
  SlidersHorizontal,
  Landmark,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Info,
  Building2,
  Phone,
  Mail,
  DollarSign,
  Calculator,
  Loader2,
} from "lucide-react";
import {
  computeOffers,
  type LeadInput as BankLeadInput,
  type BankOffer,
  type EligibilityStatus,
  type Program,
} from "@workspace/bank-offers";
import { BankAndCorrespondentPicker } from "@/components/BankAndCorrespondentPicker";

// ── Types ─────────────────────────────────────────────────────────────────────
type StatusKey = "atencao" | "regular" | "bom" | "otimo";
interface Status { key: StatusKey; label: string; color: string }
interface MonthPoint {
  monthKey: string; monthLabel: string; year: number;
  score: number; delta: number; deltaLabel: string;
  updatedAt: string; status: Status;
}
interface Factor { title: string; description: string }
interface ScoreHistoryResponse {
  current: {
    score: number; max: number; status: Status;
    monthlyDelta: number; deltaLabel: string;
    previousScore: number; updatedAt: string;
  };
  months: MonthPoint[];
  factors: { atencao: Factor[]; bom: Factor[]; otimo: Factor[] };
  counts: { atencao: number; bom: number; otimo: number };
}

// ── GPS Logic ────────────────────────────────────────────────────────────────
export type GpsStatus = "done" | "warning" | "critical" | "pending";
export interface GpsStep {
  id: string; priority: number; status: GpsStatus; title: string;
  description: string; action: string; timeEstimate: string; impactPct: number;
}
interface GPSLeadInput {
  income: number; propertyValue: number; hasFgts?: boolean | null;
  fgtsBalance?: number | null; fgtsMonths?: number | null; employmentType?: string | null;
  employmentMonths?: number | null; maritalStatus?: string | null; spouseIncome?: number | null;
  informalIncome?: number | null; approvalChance: number; scoreCaixa: number;
  serasaScore?: number | null; hasNegativations?: boolean | null; negativationsValue?: number | null;
  hasProtests?: boolean | null; protestsValue?: number | null; siricStatus?: string | null;
  vehicleLoanMonthly?: number | null; creditCardLimit?: number | null; creditCardUsage?: number | null;
  otherLoansMonthly?: number | null;
}

const GPS_STATUS_UI: Record<GpsStatus, { icon: any; color: string; bg: string; border: string; label: string }> = {
  done: { icon: CheckCircle2, color: "#065F46", bg: "#F0FDF4", border: "#10A65A", label: "Concluído" },
  warning: { icon: AlertTriangle, color: "#92400E", bg: "#FFFBEB", border: "#F59E0B", label: "Atenção" },
  critical: { icon: XCircle, color: "#991B1B", bg: "#FEF2F2", border: "#EF4444", label: "Crítico" },
  pending: { icon: Clock, color: "#1E40AF", bg: "#EFF6FF", border: "#3B82F6", label: "Pendente" },
};

function computeGpsSteps(lead: GPSLeadInput): GpsStep[] {
  const steps: GpsStep[] = [];
  const totalIncome = lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const totalMonthlyDebt = (lead.vehicleLoanMonthly ?? 0) + (lead.otherLoansMonthly ?? 0);
  const debtRatioPct = totalIncome > 0 ? (totalMonthlyDebt / totalIncome) * 100 : 0;
  const propertyIncomeRatio = lead.propertyValue / (totalIncome * 12);

  // Protests
  if (lead.hasProtests) {
    steps.push({
      id: "protests", priority: 1, status: "critical", title: "Regularizar protestos em cartório",
      description: `Existem protestos em cartório registrados — este é critério eliminatório na Caixa, BB e todos os bancos privados.` +
        (lead.protestsValue ? ` Valor identificado: R$ ${lead.protestsValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` : "") +
        " Procure o cartório responsável e solicite o cancelamento após o pagamento.",
      action: "Ir ao cartório de protesto e quitar o débito", timeEstimate: "1 a 4 semanas", impactPct: 30,
    });
  }

  // SIRIC
  if (lead.siricStatus === "irregular") {
    steps.push({
      id: "siric", priority: 2, status: "critical", title: "Regularizar situação no SIRIC (Caixa)",
      description: "Situação irregular no SIRIC bloqueia completamente o crédito habitacional na Caixa Econômica Federal. Pode indicar financiamento ativo não quitado.",
      action: "Ir a uma agência Caixa e solicitar consulta ao SIRIC", timeEstimate: "2 a 8 semanas", impactPct: 40,
    });
  }

  // Negativations
  if (lead.hasNegativations) {
    steps.push({
      id: "negativations", priority: 3, status: "critical", title: "Quitar negativações no Serasa/SPC",
      description: `Negativações ativas reduzem significativamente a chance de aprovação.` +
        (lead.negativationsValue ? ` Valor total: R$ ${lead.negativationsValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` : "") +
        " Acesse serasa.com.br para negociar.",
      action: "Acessar Serasa Limpa Nome ou SPC Consumidor e negociar", timeEstimate: "1 a 4 semanas", impactPct: 25,
    });
  }

  // Serasa score
  if (lead.serasaScore != null && lead.serasaScore < 600) {
    const gap = 600 - lead.serasaScore;
    steps.push({
      id: "serasa_score", priority: 4, status: lead.serasaScore < 400 ? "critical" : "warning", title: "Melhorar Score Serasa",
      description: `Score atual: ${lead.serasaScore}/1000. Precisa de +${gap} pontos. Pague contas em dia, mantenha CPF ativo e evite consultas excessivas.`,
      action: "Cadastrar no Serasa Premium e ativar Cadastro Positivo", timeEstimate: "3 a 9 meses", impactPct: 15,
    });
  }

  // Debt ratio
  if (debtRatioPct > 30) {
    steps.push({
      id: "debt_ratio", priority: 5, status: "critical", title: "Reduzir comprometimento com dívidas ativas",
      description: `${debtRatioPct.toFixed(1)}% da renda mensal comprometida com financiamentos — acima do limite de 30% aceito pelos bancos.`,
      action: "Quitar ou refinanciar dívidas para reduzir parcela mensal", timeEstimate: "3 a 12 meses", impactPct: 18,
    });
  } else if (debtRatioPct > 15) {
    steps.push({
      id: "debt_ratio_warn", priority: 5, status: "warning", title: "Atenção ao comprometimento de dívidas",
      description: `${debtRatioPct.toFixed(1)}% da renda mensal em parcelas de dívidas ativas. Ainda dentro do limite mas reduz margem.`,
      action: "Avaliar antecipação de parcelas do veículo", timeEstimate: "1 a 6 meses", impactPct: 8,
    });
  }

  // Credit card usage
  if (lead.creditCardUsage != null && lead.creditCardUsage > 50) {
    steps.push({
      id: "credit_card", priority: 6, status: lead.creditCardUsage > 80 ? "critical" : "warning", title: "Reduzir utilização do cartão de crédito",
      description: `Utilização atual: ${lead.creditCardUsage.toFixed(0)}% do limite total. Mantenha abaixo de 30% do limite total.`,
      action: `Pagar fatura e reduzir utilização para abaixo de 30%`, timeEstimate: "1 a 3 meses", impactPct: 10,
    });
  }

  // Property ratio
  if (propertyIncomeRatio > 4.5) {
    const maxProperty = totalIncome * 12 * 4.5;
    steps.push({
      id: "property_ratio", priority: 7, status: "critical", title: "Adequar valor do imóvel à renda",
      description: `Relação imóvel/renda anual: ${propertyIncomeRatio.toFixed(2)}x — acima do limite máximo de 4,5x da Caixa. Renda de R$ ${totalIncome.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês limita imóvel a R$ ${maxProperty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
      action: `Buscar imóvel até R$ ${maxProperty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ou aumentar renda`, timeEstimate: "Imediato", impactPct: 20,
    });
  }

  // FGTS
  if (!lead.hasFgts || (lead.fgtsBalance ?? 0) === 0) {
    steps.push({
      id: "fgts", priority: 8, status: "warning", title: "Verificar e mobilizar FGTS",
      description: "FGTS não informado ou sem saldo. O FGTS pode ser usado como entrada (reduz financiamento e parcela).",
      action: "Baixar app FGTS e verificar saldo disponível", timeEstimate: "Imediato", impactPct: 8,
    });
  }

  // SIRIC Regular
  if (lead.siricStatus === "regular") {
    steps.push({
      id: "siric_ok", priority: 11, status: "done", title: "SIRIC Caixa regular",
      description: "Situação regular no sistema SIRIC da Caixa. Não há pendências de financiamento habitacional anterior.",
      action: "Manter situação regular", timeEstimate: "Concluído", impactPct: 0,
    });
  }

  // Credit clean
  if (!lead.hasNegativations && !lead.hasProtests && (lead.serasaScore == null || lead.serasaScore >= 700)) {
    steps.push({
      id: "credit_clean", priority: 12, status: "done", title: "Cadastro de crédito limpo",
      description: "Sem negativações ou protestos registrados.",
      action: "Manter pagamentos em dia", timeEstimate: "Concluído", impactPct: 0,
    });
  }

  return steps.sort((a, b) => {
    const order: Record<GpsStatus, number> = { critical: 0, warning: 1, pending: 2, done: 3 };
    return order[a.status] - order[b.status] || a.priority - b.priority;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function bgForStatus(key: StatusKey): string {
  const map: Record<StatusKey, string> = {
    otimo: "#D1FAE5", bom: "#CCFBF1", regular: "#FEF3C7", atencao: "#FEE2E2",
  };
  return map[key];
}

function monthFullName(abbr: string): string {
  const map: Record<string, string> = {
    JAN: "Janeiro", FEV: "Fevereiro", MAR: "Março", ABR: "Abril",
    MAI: "Maio", JUN: "Junho", JUL: "Julho", AGO: "Agosto",
    SET: "Setembro", OUT: "Outubro", NOV: "Novembro", DEZ: "Dezembro",
  };
  return map[abbr] ?? abbr;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const IMPACT_CONFIG = {
  positive: { icon: Smile, color: "#10A65A", bg: "#F0FDF4" },
  negative: { icon: Frown, color: "#EF4444", bg: "#FEF2F2" },
  neutral: { icon: Meh, color: "#6B7280", bg: "#F3F4F6" },
};

const BANK_STATUS_UI: Record<EligibilityStatus, { color: string; bg: string; icon: any }> = {
  eligible: { color: "#065F46", bg: "#D1FAE5", icon: CheckCircle2 },
  analysis: { color: "#1E40AF", bg: "#DBEAFE", icon: Clock },
  restricted: { color: "#92400E", bg: "#FEF3C7", icon: AlertTriangle },
  ineligible: { color: "#991B1B", bg: "#FEE2E2", icon: XCircle },
};

const PROGRAM_UI: Record<Program, { color: string; bg: string }> = {
  MCMV: { color: "#065F46", bg: "#D1FAE5" },
  SBPE: { color: "#1E40AF", bg: "#DBEAFE" },
};

// ── Score Gauge semicircular ───────────────────────────────────────────────────
function ScoreGauge({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.min(1, score / max);
  const w = 260, h = 145, cx = w / 2, cy = h - 8, r = 108;

  const point = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  const [sx, sy] = point(Math.PI);
  const [ex, ey] = point(0);
  const angle = Math.PI + (Math.PI) * pct;
  const [px, py] = point(angle > 2 * Math.PI ? 2 * Math.PI : angle);

  const trackPath = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
  const activePath = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${px} ${py}`;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="sgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <path d={trackPath} fill="none" stroke="#E5E7EB" strokeWidth="16" strokeLinecap="round" />
        <path d={activePath} fill="none" stroke="url(#sgGrad)" strokeWidth="16" strokeLinecap="round"
          style={{ transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
        <div className="text-5xl font-bold" style={{ color: "#07113A" }}>
          {score}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>de {max} pontos</div>
      </div>
    </div>
  );
}

// ── Mini Circular Gauge ────────────────────────────────────────────────────────
function CircularProgress({ pct, size = 68, strokeWidth = 5, label, color = "#10A65A" }: { pct: number; size?: number; strokeWidth?: number; label: string; color?: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1 bg-white border border-gray-100 p-3 rounded-2xl flex-1 shadow-xs">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease", transform: "rotate(-90deg)", transformOrigin: `${size/2}px ${size/2}px` }}
          />
        </svg>
        <span className="absolute text-xs font-bold text-gray-800">{Math.round(pct * 100)}%</span>
      </div>
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

function MiniScoreCard({ value, label, max = 1000 }: { value: number; label: string; max?: number }) {
  const pct = value / max;
  const color = value >= 700 ? "#10A65A" : value >= 500 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center gap-1 bg-white border border-gray-100 p-3 rounded-2xl flex-1 shadow-xs">
      <span className="text-xl font-extrabold" style={{ color }}>{value}</span>
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

// ── Barras mensais ─────────────────────────────────────────────────────────────
function MonthBars({ months }: { months: MonthPoint[] }) {
  const scores = months.map((m) => m.score);
  const maxVal = Math.max(...scores, 1000);
  const minVal = Math.max(0, Math.min(...scores) - 80);
  const range = maxVal - minVal || 1;

  return (
    <div className="flex items-end justify-between gap-1.5 px-1" style={{ height: 130 }}>
      {months.map((m, i) => {
        const isLast = i === months.length - 1;
        const h = 28 + ((m.score - minVal) / range) * 90;
        const isGood = m.status.key === "otimo" || m.status.key === "bom";
        const fill = isLast
          ? (isGood ? "#10A65A" : "#0D1B8C")
          : (isGood ? "rgba(16,166,90,0.18)" : "rgba(13,27,140,0.12)");
        const textColor = isLast ? "#FFFFFF" : (isGood ? "#10A65A" : "#0D1B8C");
        return (
          <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full rounded-xl flex items-end justify-center pb-1.5"
              style={{ height: h, background: fill, transition: "height 0.5s ease" }}
              data-testid={`bar-${m.monthKey}`}
            >
              <span className="text-[9px] font-bold" style={{ color: textColor }}>{m.score}</span>
            </div>
            <div className="text-[9px] font-semibold" style={{ color: "#94A3B8" }}>{m.monthLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fator expandível ──────────────────────────────────────────────────────────
function StatusRow({
  icon: Icon, color, bg, label, count, expanded, onToggle, items,
}: {
  icon: any; color: string; bg: string; label: string;
  count: number; expanded: boolean; onToggle: () => void; items: Factor[];
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 text-left"
        data-testid={`row-status-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: bg }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: bg, color }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "#374151" }}>
            {count} {count === 1 ? "item" : "itens"}
          </span>
          {expanded
            ? <ChevronDown className="w-4 h-4" style={{ color: "#9CA3AF" }} />
            : <ChevronRight className="w-4 h-4" style={{ color: "#9CA3AF" }} />}
        </div>
      </button>
      {expanded && (
        <div className="pb-4 pl-12 pr-3 space-y-3">
          {items.map((it, i) => (
            <div key={i}>
              <div className="text-sm font-semibold" style={{ color: "#07113A" }}>{it.title}</div>
              <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6B7280" }}>{it.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bottom Navigation ────────────────────────────────────────────────────────
function BottomNav({ onLogout }: { onLogout: () => void }) {
  const [, setLocation] = useLocation();
  const tabs = [
    { label: "Score",      icon: CheckCircle2,    href: "/portal/score",      active: true },
    { label: "Imóveis",    icon: Building2,        href: "/portal/imoveis",    active: false },
    { label: "Simulador",  icon: Calculator,       href: "/portal/simulador",  active: false },
    { label: "Pagamentos", icon: DollarSign,       href: "/portal/pagamentos", active: false },
    { label: "Dívidas",    icon: Landmark,         href: "/portal/dividas",    active: false },
    { label: "Dados",      icon: SlidersHorizontal,href: "/portal/meus-dados", active: false },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around pt-3 pb-safe"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: `max(16px, env(safe-area-inset-bottom))`,
        zIndex: 50,
      }}
    >
      {tabs.map(({ label, icon: Icon, href, active }) => (
        <button key={label} type="button" onClick={() => setLocation(href)} className="flex flex-col items-center gap-1">
          <Icon className="w-5 h-5" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }} />
          <span className="text-[10px] font-semibold" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Página MeuScore ───────────────────────────────────────────────────────────
export function MeuScore() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [historyData, setHistoryData] = useState<ScoreHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedStatus, setExpandedStatus] = useState<StatusKey | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"resumo" | "analise" | "gps" | "bancos">("resumo");

  // Bank picker overlay state
  const [pickerBank, setPickerBank] = useState<string | null>(null);

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const { data: profile, isLoading: loadingProfile } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000, retry: false },
  });

  const lead = profile?.lead;
  const leadId = lead?.id ?? 0;

  const { data: score, isLoading: loadingScore } = useGetLeadScore(leadId, {
    query: { queryKey: getGetLeadScoreQueryKey(leadId), enabled: leadId > 0, staleTime: 30_000, retry: false },
  });

  // Fetch score history
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await customFetch<ScoreHistoryResponse>("/api/client/score-history");
        if (active) {
          setHistoryData(j);
          setExpandedMonth(j.months[j.months.length - 1]?.monthKey ?? null);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          setLocation("/login");
        }
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, [setLocation]);

  const handleLogout = async () => {
    try {
      await customFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    }
    queryClient.clear();
    setLocation("/login");
  };

  // Compute GPS steps if lead exists
  const gpsSteps = useMemo(() => {
    if (!lead) return [];
    return computeGpsSteps(lead as any);
  }, [lead]);

  // Compute GPS statistics
  const gpsStats = useMemo(() => {
    const critical = gpsSteps.filter((s) => s.status === "critical").length;
    const warning = gpsSteps.filter((s) => s.status === "warning").length;
    const done = gpsSteps.filter((s) => s.status === "done").length;
    const impact = gpsSteps.filter((s) => s.status !== "done").reduce((acc, s) => acc + s.impactPct, 0);
    const progress = gpsSteps.length > 0 ? Math.round((done / gpsSteps.length) * 100) : 0;
    return { critical, warning, done, impact, progress, total: gpsSteps.length };
  }, [gpsSteps]);

  // Compute bank offers if lead exists
  const bankOffers = useMemo(() => {
    if (!lead) return [];
    return computeOffers(lead as any);
  }, [lead]);

  const totalComposedIncome = lead
    ? lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0)
    : 0;

  const isMcmvEligible = lead
    ? totalComposedIncome <= 8000 && lead.propertyValue <= 350000
    : false;

  // Loading skeleton
  if (loadingHistory || loadingProfile || !historyData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2F4F7" }}>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
      </div>
    );
  }

  const { current, months, factors, counts } = historyData;
  const deltaColor = current.monthlyDelta >= 0 ? "#10A65A" : "#EF4444";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              Olá,
            </div>
            <div className="text-base font-bold text-white truncate max-w-[200px]">
              {me?.name ?? "Cliente"}
            </div>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(16,166,90,0.2)", color: "#10A65A", border: "1px solid rgba(16,166,90,0.3)" }}
          >
            ScoreCasa App
          </div>
        </div>

        {/* Top Segmented Sub-tabs */}
        <div className="mt-5 p-0.5 bg-white/10 backdrop-blur-md rounded-xl flex">
          {[
            { id: "resumo" as const, label: "Resumo" },
            { id: "analise" as const, label: "Análise" },
            { id: "gps" as const, label: "GPS" },
            { id: "bancos" as const, label: "Bancos" },
          ].map((t) => {
            const isTabActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveSubTab(t.id)}
                className="flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all"
                style={{
                  background: isTabActive ? "#FFFFFF" : "transparent",
                  color: isTabActive ? "#07113A" : "rgba(255, 255, 255, 0.75)",
                  boxShadow: isTabActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sub-tab Content Switch ── */}
      <div className="flex-1 flex flex-col gap-4 px-4 pt-4">

        {/* ── SUB-TAB: RESUMO ── */}
        {activeSubTab === "resumo" && (
          <div className="flex flex-col gap-4">
            {/* Semicircular score gauge */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col items-center animate-fade-up">
              <ScoreGauge score={current.score} max={current.max} color={current.status.color} />
              <div
                className="mt-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: "rgba(7,17,58,0.06)", color: "#07113A" }}
                data-testid="badge-status-current"
              >
                {current.status.label}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: deltaColor }}>{current.deltaLabel}</span>
                <span className="text-xs text-gray-400">no último mês</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">Atualizado em {current.updatedAt}</div>
            </div>

            {/* Fatores compactos */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-fade-up">
              <div className="text-sm font-bold mb-1 text-[#07113A]">Pesando no seu score</div>
              <div className="text-[11px] text-gray-400 mb-2">Toque em cada item para detalhes.</div>
              <StatusRow
                icon={Frown} color="#EF4444" bg="#FEE2E2"
                label="Precisa de atenção"
                count={counts.atencao}
                expanded={expandedStatus === "atencao"}
                onToggle={() => setExpandedStatus((p) => p === "atencao" ? null : "atencao")}
                items={factors.atencao}
              />
              <StatusRow
                icon={Meh} color="#0D9488" bg="#CCFBF1"
                label="Bom"
                count={counts.bom}
                expanded={expandedStatus === "bom"}
                onToggle={() => setExpandedStatus((p) => p === "bom" ? null : "bom")}
                items={factors.bom}
              />
              <StatusRow
                icon={Smile} color="#10A65A" bg="#D1FAE5"
                label="Ótimo"
                count={counts.otimo}
                expanded={expandedStatus === "otimo"}
                onToggle={() => setExpandedStatus((p) => p === "otimo" ? null : "otimo")}
                items={factors.otimo}
              />
            </div>

            {/* Evolução mensal */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#07113A]">Evolução mensal</span>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <MonthBars months={months} />
              <div className="mt-4 space-y-1">
                {[...months].reverse().map((m) => {
                  const expanded = expandedMonth === m.monthKey;
                  const dColor = m.delta === 0 ? "#6B7280" : m.delta > 0 ? "#10A65A" : "#EF4444";
                  return (
                    <div key={m.monthKey} className="border-b border-gray-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setExpandedMonth((p) => p === m.monthKey ? null : m.monthKey)}
                        className="w-full flex items-center justify-between py-3 text-left"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-800">{monthFullName(m.monthLabel)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Atualizado em {m.updatedAt}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-800">{m.score}</div>
                            <div className="text-[10px] font-semibold" style={{ color: dColor }}>{m.deltaLabel}</div>
                          </div>
                          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="pb-3 text-xs text-gray-500 leading-relaxed">
                          Seu score em {monthFullName(m.monthLabel).toLowerCase()} foi de <strong>{m.score}</strong>.{" "}
                          {m.delta === 0
                            ? "Não houve alteração."
                            : m.delta > 0
                            ? `Subiu ${m.delta} pontos.`
                            : `Caiu ${Math.abs(m.delta)} pontos.`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-[#0D1B8C] to-[#07113A] text-white flex gap-3 animate-fade-up">
              <ShieldCheck className="w-8 h-8 text-[#10A65A] flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Atualizar seus dados</h4>
                <p className="text-xs text-blue-100/70 mt-1 leading-relaxed">
                  Para analisar seu histórico de renda, banco central e garantir a melhor taxa, mantenha seu perfil atualizado.
                </p>
                <button
                  type="button"
                  onClick={() => setLocation("/portal/meus-dados")}
                  className="mt-3 px-4 py-2 bg-[#10A65A] rounded-full text-xs font-bold text-white active:scale-95 transition-all"
                >
                  Ir para Meus Dados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-TAB: ANÁLISE ── */}
        {activeSubTab === "analise" && (
          <div className="flex flex-col gap-4 animate-fade-up">
            {/* Três gauges circulares lado a lado */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#07113A] mb-3">Resumo da Análise</h3>
              <div className="flex gap-2.5">
                <CircularProgress pct={lead ? lead.approvalChance / 100 : 0} label="Aprovação" color="#10A65A" />
                <MiniScoreCard value={lead?.scoreCaixa ?? 0} label="Score Caixa" />
                <MiniScoreCard value={lead?.scoreMCMV ?? 0} label="Score MCMV" />
              </div>
            </div>

            {/* AI Recommendation */}
            {lead?.aiRecommendation && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Recomendação da I.A.</h3>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">{lead.aiRecommendation}</p>
              </div>
            )}

            {/* SBPE Recommendation Alternative */}
            {lead?.alreadyOwnsPropertyInPropertyCity === true && score?.sbpeRecommendation && (
              <div className="rounded-2xl border border-blue-200 bg-[#EFF6FF] p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-[#0D1B8C]">
                  <Landmark className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Alternativa SBPE</span>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed">
                  O programa MCMV não permite financiar caso você possua outro imóvel no município. A alternativa recomendada é o SBPE:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl p-2.5 border border-blue-100">
                    <span className="text-[9px] uppercase font-bold text-gray-400">Parcela Indicativa</span>
                    <div className="text-sm font-extrabold text-[#0D1B8C] mt-0.5">{fmtBRL(score.sbpeRecommendation.bestMonthlyInstallment)}</div>
                    <span className="text-[8px] text-gray-400 mt-0.5">Prazo: {score.sbpeRecommendation.termYears} anos</span>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 border border-blue-100">
                    <span className="text-[9px] uppercase font-bold text-gray-400">Entrada estimada</span>
                    <div className="text-sm font-extrabold text-[#0D1B8C] mt-0.5">{fmtBRL(score.sbpeRecommendation.estimatedDownPayment)}</div>
                    <span className="text-[8px] text-gray-400 mt-0.5">Até {Math.round(score.sbpeRecommendation.maxFinancedPct * 100)}% financiado</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fatores de Score detalhados */}
            {loadingScore ? (
              <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : score?.factors && score.factors.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-[#07113A]">Fatores Avaliados</h3>
                <div className="space-y-2">
                  {score.factors.map((factor) => {
                    const cfg = IMPACT_CONFIG[factor.impact as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.neutral;
                    const Icon = cfg.icon;
                    return (
                      <div key={factor.name} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: cfg.bg }}>
                        <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-xs">
                          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold" style={{ color: cfg.color }}>{factor.name}</div>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">{factor.description}</p>
                        </div>
                        {factor.value && <span className="text-xs font-bold flex-shrink-0" style={{ color: cfg.color }}>{factor.value}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Bancos recomendados */}
            {!loadingScore && score?.eligibleBanks && score.eligibleBanks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#07113A] mb-2.5">Bancos Recomendados</h3>
                <div className="flex flex-wrap gap-2">
                  {score.eligibleBanks.map((b) => (
                    <div key={b} className="flex items-center gap-1 bg-[#0D1B8C] text-white px-3 py-1 rounded-full text-xs font-semibold">
                      <Landmark className="w-3 h-3" />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB: GPS ── */}
        {activeSubTab === "gps" && (
          <div className="flex flex-col gap-4 animate-fade-up">
            {/* GPS progress circle + statistics */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#10A65A"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - gpsStats.progress / 100)}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.6s ease", transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-extrabold text-gray-800">{gpsStats.progress}%</span>
                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Concluído</span>
                </div>
              </div>

              <div className="w-full text-center">
                <h4 className="font-bold text-sm text-[#07113A]">GPS de Aprovação</h4>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-normal">Seu plano de ação recomendado para liberação de crédito</p>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-2 gap-2 w-full pt-2">
                {[
                  { label: "Críticos", value: gpsStats.critical, color: "#EF4444", bg: "#FEF2F2" },
                  { label: "Atenção", value: gpsStats.warning, color: "#D97706", bg: "#FFFBEB" },
                  { label: "Concluídos", value: gpsStats.done, color: "#10A65A", bg: "#F0FDF4" },
                  { label: "Ganho potencial", value: `+${Math.min(gpsStats.impact, 60)}%`, color: "#0D1B8C", bg: "#EEF2FF" },
                ].map((s) => (
                  <div key={s.label} className="p-2.5 rounded-xl border border-gray-50 text-center" style={{ background: s.bg }}>
                    <div className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</div>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* List of steps */}
            <div className="space-y-3">
              {gpsSteps.map((step, idx) => {
                const ui = GPS_STATUS_UI[step.status];
                const Icon = ui.icon;
                const stepNum = idx + 1;
                const isDone = step.status === "done";

                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border bg-white shadow-xs p-4 flex flex-col gap-3 relative transition-all ${
                      isDone ? "opacity-70" : "hover:border-gray-300"
                    }`}
                    style={{ borderLeftWidth: 5, borderLeftColor: ui.border }}
                  >
                    <div className="flex gap-2.5 items-start">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-extrabold text-[10px]"
                        style={{ background: ui.border }}
                      >
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : stepNum}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-800">{step.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ color: ui.color, background: ui.bg }}>
                            {ui.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{step.description}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-2">
                      <div className="flex items-start gap-1">
                        <ArrowRight className="w-3 h-3 text-[#0D1B8C] mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-gray-700 font-bold leading-normal">{step.action}</span>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium">
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {step.timeEstimate}</span>
                        {step.impactPct > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full">+{step.impactPct}% Chance</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUB-TAB: BANCOS ── */}
        {activeSubTab === "bancos" && (
          <div className="flex flex-col gap-4 animate-fade-up">
            {/* Parameters card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#0D1B8C] mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-xs text-[#07113A]">Parâmetros de Simulação</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-normal">Valores e estimativas baseados na sua renda e imóvel pretendido.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50/50 rounded-xl p-2.5 border border-gray-100">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Renda Composta</span>
                  <div className="text-xs font-extrabold text-gray-800 mt-0.5">{fmtBRL(totalComposedIncome)}/mês</div>
                </div>
                <div className="bg-gray-50/50 rounded-xl p-2.5 border border-gray-100">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Valor Imóvel</span>
                  <div className="text-xs font-extrabold text-gray-800 mt-0.5">{fmtBRL(lead?.propertyValue ?? 0)}</div>
                </div>
                <div className="bg-gray-50/50 rounded-xl p-2.5 border border-gray-100 col-span-2 text-center">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Minha Casa Minha Vida</span>
                  <div className={`text-xs font-extrabold mt-0.5 ${isMcmvEligible ? "text-[#10A65A]" : "text-gray-500"}`}>
                    {isMcmvEligible ? "Elegível" : "Não Elegível"}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Link / Correspondent Status */}
            <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <BankAndCorrespondentPicker variant="summary" onError={() => {}} />
            </section>

            {/* List of Offers */}
            <div className="space-y-3">
              {bankOffers.map((offer, idx) => {
                const ui = BANK_STATUS_UI[offer.status];
                const StatusIcon = ui.icon;
                const progUI = PROGRAM_UI[offer.program];
                const slug = offer.bank.toLowerCase().includes("caixa")
                  ? "caixa"
                  : offer.bank.toLowerCase().includes("brasil")
                  ? "bb"
                  : offer.bank.toLowerCase().includes("bradesco")
                  ? "bradesco"
                  : offer.bank.toLowerCase().includes("itau")
                  ? "itau"
                  : offer.bank.toLowerCase().includes("santander")
                  ? "santander"
                  : "inter";

                return (
                  <div
                    key={`${offer.bank}-${offer.program}-${idx}`}
                    onClick={() => {
                      if (offer.status === "eligible" || offer.status === "analysis") {
                        setPickerBank(slug);
                      }
                    }}
                    className={`rounded-2xl border bg-white shadow-xs p-4 flex flex-col gap-3.5 relative overflow-hidden transition-all ${
                      offer.status === "eligible" || offer.status === "analysis" ? "cursor-pointer active:scale-[0.99] border-gray-200" : "opacity-60 border-gray-100"
                    }`}
                    style={offer.isBest ? { borderWidth: 2, borderColor: offer.color } : {}}
                  >
                    {offer.isBest && (
                      <div className="absolute top-0 right-0 bg-[#10A65A] text-white px-3 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-bl-lg">
                        Melhor Opção
                      </div>
                    )}

                    {/* Offer Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2.5 items-center">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-[10px] shadow-xs flex-shrink-0"
                          style={{ background: offer.color }}
                        >
                          {offer.shortName}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-800 leading-tight">{offer.bank}</div>
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: progUI.color, background: progUI.bg }}>
                            {offer.program}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ color: ui.color, background: ui.bg }}>
                        <StatusIcon className="w-3 h-3" />
                        {offer.statusLabel}
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        <span className="text-[8px] uppercase font-bold text-gray-400">Juros Efetivos</span>
                        <div className="text-xs font-bold text-gray-700 mt-0.5">{offer.annualRate.toFixed(2).replace(".", ",")}% a.a.</div>
                      </div>
                      <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        <span className="text-[8px] uppercase font-bold text-gray-400">Parcela Estimada</span>
                        <div className="text-xs font-extrabold text-[#0D1B8C] mt-0.5">{fmtBRL(offer.monthlyInstallment)}</div>
                      </div>
                      <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        <span className="text-[8px] uppercase font-bold text-gray-400">Entrada Mínima</span>
                        <div className="text-xs font-bold text-gray-700 mt-0.5">{fmtBRL(offer.downPayment)}</div>
                      </div>
                      <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        <span className="text-[8px] uppercase font-bold text-gray-400">Financiado</span>
                        <div className="text-xs font-bold text-gray-700 mt-0.5">{fmtBRL(offer.loanAmount)}</div>
                      </div>
                    </div>

                    {offer.restrictions.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {offer.restrictions.map((r, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] font-semibold text-red-700">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            {r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Picker Modal Overlay */}
      {pickerBank && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPickerBank(null)}
          data-testid="bank-picker-overlay"
        >
          <div
            className="bg-[#F4F6FB] rounded-3xl max-w-lg w-full max-h-[85vh] overflow-auto p-4 flex flex-col animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4 px-1">
              <h3 className="font-bold text-sm text-[#07113A]">Vincular Financiamento</h3>
              <button onClick={() => setPickerBank(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <BankAndCorrespondentPicker initialBank={pickerBank} onOpened={() => setPickerBank(null)} />
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav onLogout={handleLogout} />
    </div>
  );
}
