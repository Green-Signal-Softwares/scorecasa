import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import {
  ChevronRight, ChevronDown, Frown, Meh, Smile, HelpCircle,
  TrendingUp, ShieldCheck,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type StatusKey = "atencao" | "regular" | "bom" | "otimo";
interface Status {
  key: StatusKey;
  label: string;
  color: string;
}
interface MonthPoint {
  monthKey: string;
  monthLabel: string;
  year: number;
  score: number;
  delta: number;
  deltaLabel: string;
  updatedAt: string;
  status: Status;
}
interface Factor { title: string; description: string }
interface ScoreHistoryResponse {
  current: {
    score: number;
    max: number;
    status: Status;
    monthlyDelta: number;
    deltaLabel: string;
    previousScore: number;
    updatedAt: string;
  };
  months: MonthPoint[];
  factors: { atencao: Factor[]; bom: Factor[]; otimo: Factor[] };
  counts: { atencao: number; bom: number; otimo: number };
}

// ── Score Gauge (semicircular) ───────────────────────────────────────────────
function HistoryGauge({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.min(1, score / max);
  const w = 240, h = 130, cx = w / 2, cy = h - 10, r = 100;
  const start = Math.PI, end = 0;
  const angle = start + (end - start) * pct;
  const arcPath = (a0: number, a1: number) =>
    `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={arcPath(start, end)} fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round" />
        <path d={arcPath(start, angle)} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
              style={{ transition: "all 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
        <div className="text-5xl font-bold" style={{ color: "#07113A", fontFamily: "Poppins, sans-serif" }}>{score}</div>
        <div className="text-xs text-gray-500 mt-0.5">de {max}</div>
      </div>
    </div>
  );
}

// ── Card de status (Frown/Meh/Smile) ─────────────────────────────────────────
function StatusRow({
  icon: Icon, color, bg, label, count, expanded, onToggle, items,
}: {
  icon: typeof Frown; color: string; bg: string; label: string;
  count: number; expanded: boolean; onToggle: () => void; items: Factor[];
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 hover:opacity-80 transition-opacity"
        data-testid={`row-status-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
               style={{ background: bg }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold"
                style={{ background: bg, color }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{count} {count === 1 ? "item" : "itens"}</span>
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="pb-4 pl-11 pr-2 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="text-sm">
              <div className="font-semibold" style={{ color: "#07113A" }}>{it.title}</div>
              <div className="text-gray-600 text-xs mt-0.5 leading-relaxed">{it.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bars chart (6 meses) ─────────────────────────────────────────────────────
function MonthsBars({ months }: { months: MonthPoint[] }) {
  const max = Math.max(...months.map((m) => m.score), 1000);
  const min = Math.max(0, Math.min(...months.map((m) => m.score)) - 50);
  const range = max - min || 1;

  return (
    <div className="grid grid-cols-6 gap-1 sm:gap-2 items-end px-1" style={{ height: 160 }}>
      {months.map((m, idx) => {
        const isLast = idx === months.length - 1;
        const h = 30 + ((m.score - min) / range) * 110;
        const isPositive = m.status.key === "otimo" || m.status.key === "bom";
        const fill = isLast
          ? isPositive ? "#10A65A" : "#0D1B8C"
          : isPositive ? "rgba(16,166,90,0.18)" : "rgba(13,27,140,0.18)";
        const textColor = isLast ? "#FFFFFF" : isPositive ? "#10A65A" : "#0D1B8C";
        return (
          <div key={m.monthKey} className="flex flex-col items-center gap-2">
            <div
              className="w-full rounded-lg sm:rounded-xl flex items-end justify-center pb-1.5 sm:pb-2"
              style={{ height: h, background: fill }}
              data-testid={`bar-${m.monthKey}`}
            >
              <span className="text-[10px] sm:text-xs font-bold" style={{ color: textColor }}>{m.score}</span>
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 tracking-wide sm:tracking-wider">{m.monthLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export function ClientHistoricoScore() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<ScoreHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStatus, setExpandedStatus] = useState<StatusKey | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && !me) setLocation("/login");
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
  }, [loadingMe, me, setLocation]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        const r = await fetch(`${BASE}/api/client/score-history`, { credentials: "include" });
        if (!r.ok) return;
        const j = (await r.json()) as ScoreHistoryResponse;
        if (active) {
          setData(j);
          setExpandedMonth(j.months[j.months.length - 1]?.monthKey ?? null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loadingMe || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="score">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Histórico ScoreCasa</h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe a evolução do seu score mês a mês e entenda o que está pesando na sua aprovação.
        </p>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          {/* ── Card principal ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col items-center">
              <HistoryGauge score={data.current.score} max={data.current.max} color={data.current.status.color} />
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                style={{ background: "rgba(13,27,140,0.06)", color: "#0D1B8C" }}
                data-testid="badge-status-current"
              >
                {data.current.status.label}
              </button>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                <span>Atualizado em {data.current.updatedAt}</span>
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* O que está pesando */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="text-lg font-bold mb-1" style={{ color: "#07113A" }}>
                O que está pesando no seu ScoreCasa?
              </div>
              <div className="text-xs text-gray-500 mb-3">
                Toque em cada categoria para ver os fatores em detalhe.
              </div>
              <StatusRow
                icon={Frown} color="#EF4444" bg="#FEE2E2"
                label="Precisa de atenção"
                count={data.counts.atencao}
                expanded={expandedStatus === "atencao"}
                onToggle={() => setExpandedStatus((p) => p === "atencao" ? null : "atencao")}
                items={data.factors.atencao}
              />
              <StatusRow
                icon={Meh} color="#0D9488" bg="#CCFBF1"
                label="Bom"
                count={data.counts.bom}
                expanded={expandedStatus === "bom"}
                onToggle={() => setExpandedStatus((p) => p === "bom" ? null : "bom")}
                items={data.factors.bom}
              />
              <StatusRow
                icon={Smile} color="#10A65A" bg="#D1FAE5"
                label="Ótimo"
                count={data.counts.otimo}
                expanded={expandedStatus === "otimo"}
                onToggle={() => setExpandedStatus((p) => p === "otimo" ? null : "otimo")}
                items={data.factors.otimo}
              />
            </div>
          </div>

          {/* ── Evolução mês a mês ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-lg font-bold" style={{ color: "#07113A" }}>
                  Evolução mês a mês
                </div>
                <div className="text-sm mt-0.5"
                     style={{ color: data.current.monthlyDelta >= 0 ? "#10A65A" : "#EF4444" }}>
                  <strong>{data.current.deltaLabel}</strong>{" "}
                  <span className="text-gray-500">no último mês</span>
                </div>
              </div>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>

            <MonthsBars months={data.months} />

            {/* Lista por mês */}
            <div className="mt-6 -mx-2">
              {[...data.months].reverse().map((m) => {
                const expanded = expandedMonth === m.monthKey;
                const deltaColor = m.delta === 0 ? "#6B7280" : m.delta > 0 ? "#10A65A" : "#EF4444";
                return (
                  <div key={m.monthKey} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setExpandedMonth((p) => p === m.monthKey ? null : m.monthKey)}
                      className="w-full flex items-center justify-between py-4 px-2 hover:bg-gray-50 transition-colors text-left"
                      data-testid={`row-month-${m.monthKey}`}
                    >
                      <div>
                        <div className="font-semibold text-base" style={{ color: "#07113A" }}>
                          {monthFullName(m.monthLabel)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Atualizado em {m.updatedAt}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: "#07113A" }}>{m.score}</div>
                          <div className="text-xs font-semibold" style={{ color: deltaColor }}>
                            {m.deltaLabel}
                          </div>
                        </div>
                        {expanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-2 pb-4 -mt-1">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold mb-3"
                             style={{ background: bgForStatus(m.status.key), color: m.status.color }}>
                          {m.status.label}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Seu score em {monthFullName(m.monthLabel).toLowerCase()} ficou em <strong>{m.score}</strong>.{" "}
                          {m.delta === 0
                            ? "Sem alterações em relação ao mês anterior."
                            : m.delta > 0
                              ? `Subiu ${m.delta} pontos — continue com pagamentos em dia e mantendo a conta conectada via Open Finance.`
                              : `Caiu ${Math.abs(m.delta)} pontos — verifique compromissos financeiros recentes e contas em atraso.`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Card final: o que mais influencia ── */}
          <div className="rounded-2xl p-6"
               style={{ background: "linear-gradient(135deg, #0D1B8C 0%, #07113A 100%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: "rgba(16,166,90,0.2)" }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "#10A65A" }} />
              </div>
              <div className="flex-1">
                <div className="text-white font-bold text-base mb-1">
                  Outras coisas que influenciam seu ScoreCasa
                </div>
                <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Seu comportamento financeiro completo é avaliado: histórico do Banco Central (SCR),
                  conexões Open Finance, valor do imóvel desejado, comprometimento de renda e
                  consultas a bureaus de crédito.
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/portal/meus-dados")}
                  className="mt-4 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "#10A65A", color: "white" }}
                  data-testid="button-saiba-mais"
                >
                  Atualizar meus dados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}

function monthFullName(abbr: string): string {
  const map: Record<string, string> = {
    JAN: "Janeiro", FEV: "Fevereiro", MAR: "Março", ABR: "Abril",
    MAI: "Maio", JUN: "Junho", JUL: "Julho", AGO: "Agosto",
    SET: "Setembro", OUT: "Outubro", NOV: "Novembro", DEZ: "Dezembro",
  };
  return map[abbr] ?? abbr;
}

function bgForStatus(key: StatusKey): string {
  switch (key) {
    case "otimo": return "#D1FAE5";
    case "bom": return "#CCFBF1";
    case "regular": return "#FEF3C7";
    case "atencao": return "#FEE2E2";
  }
}
