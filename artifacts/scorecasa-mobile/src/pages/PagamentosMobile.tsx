import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Home as HomeIcon,
  Lightbulb,
  Wifi,
  Smartphone,
  Tv,
  ShieldCheck,
  FileText,
  Check,
  AlertTriangle,
  Calendar,
  TrendingUp,
  RotateCcw,
  Bell,
  Link2,
  RefreshCw,
  XCircle,
  Building2,
  SlidersHorizontal,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Calculator,
  Landmark,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = "cartao" | "financiamento" | "conta" | "boleto" | "emprestimo" | "assinatura";
type Bucket = "atrasado" | "hoje" | "semana" | "proximos" | "pago";

interface PaymentItem {
  id: number;
  category: Category;
  description: string;
  issuer: string | null;
  amountCents: number;
  dueDate: string;
  recurring: boolean;
  paidAt: string | null;
  paidAmountCents: number | null;
  bucket: Bucket;
  daysToDue: number;
}

interface PaymentsResponse {
  summary: {
    next7Count: number;
    next7TotalCents: number;
    overdueCount: number;
    overdueTotalCents: number;
    monthOpenTotalCents: number;
    monthPaidTotalCents: number;
    scoreImpactNote: string;
    source: "manual" | "open_finance";
    openFinanceBank: string | null;
    lastSyncedAt: string | null;
  };
  items: PaymentItem[];
}

const ICONS: Record<Category, any> = {
  cartao: CreditCard,
  financiamento: HomeIcon,
  conta: Lightbulb,
  boleto: FileText,
  emprestimo: ShieldCheck,
  assinatura: Tv,
};

const ICON_HINTS: Record<string, any> = {
  Vivo: Wifi,
  "Vivo Fibra": Wifi,
  Claro: Smartphone,
  TIM: Smartphone,
};

function pickIcon(p: PaymentItem) {
  if (p.issuer && ICON_HINTS[p.issuer]) return ICON_HINTS[p.issuer];
  return ICONS[p.category] ?? FileText;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

const BUCKET_META: Record<Bucket, { label: string; color: string; bg: string; order: number }> = {
  atrasado:  { label: "Em atraso",        color: "#EF4444", bg: "#FEE2E2", order: 0 },
  hoje:      { label: "Vence hoje",       color: "#F59E0B", bg: "#FEF3C7", order: 1 },
  semana:    { label: "Próximos 7 dias",  color: "#0D1B8C", bg: "rgba(13,27,140,0.08)", order: 2 },
  proximos:  { label: "Próximos",         color: "#6B7280", bg: "#F3F4F6", order: 3 },
  pago:      { label: "Pagos",            color: "#10A65A", bg: "#D1FAE5", order: 4 },
};

// ── Bottom Navigation ────────────────────────────────────────────────────────
function BottomNav({ activePage, onLogout }: { activePage: string; onLogout: () => void }) {
  const [, setLocation] = useLocation();
  const tabs = [
    { label: "Score",      icon: CheckCircle2,     href: "/portal/score",      key: "score" },
    { label: "Imóveis",    icon: Building2,         href: "/portal/imoveis",    key: "imoveis" },
    { label: "Simulador",  icon: Calculator,        href: "/portal/simulador",  key: "simulador" },
    { label: "Pagamentos", icon: DollarSign,        href: "/portal/pagamentos", key: "pagamentos" },
    { label: "Dívidas",    icon: Landmark,         href: "/portal/dividas",    key: "dividas" },
    { label: "Dados",      icon: SlidersHorizontal, href: "/portal/meus-dados", key: "dados" },
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
      {tabs.map(({ label, icon: Icon, href, key }) => {
        const active = activePage === key;
        return (
          <button key={key} type="button" onClick={() => setLocation(href)} className="flex flex-col items-center gap-1">
            <Icon className="w-5 h-5" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }} />
            <span className="text-[10px] font-semibold" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── PagamentosMobile Page ─────────────────────────────────────────────────────
export function PagamentosMobile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Group collapses
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const reload = async () => {
    try {
      const response = await customFetch<PaymentsResponse>("/api/client/payments");
      setData(response);
    } catch (err: any) {
      if (err?.status === 401) {
        setLocation("/login");
      }
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await reload();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const togglePaid = async (p: PaymentItem) => {
    setUpdatingId(p.id);
    try {
      const action = p.paidAt ? "unpay" : "pay";
      await customFetch(`/api/client/payments/${p.id}/${action}`, {
        method: "POST",
      });
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<Bucket, PaymentItem[]>();
    for (const it of data.items) {
      if (!map.has(it.bucket)) map.set(it.bucket, []);
      map.get(it.bucket)!.push(it);
    }
    return [...map.entries()].sort((a, b) => BUCKET_META[a[0]].order - BUCKET_META[b[0]].order);
  }, [data]);

  const handleLogout = async () => {
    try {
      await customFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    }
    queryClient.clear();
    setLocation("/login");
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2F4F7" }}>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
      </div>
    );
  }

  const overdue = data.summary.overdueCount > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* Header Banner */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              Assistente de
            </div>
            <div className="text-base font-bold text-white">
              Pagamentos
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[#10A65A] bg-[#10A65A]/10 border border-[#10A65A]/25 px-2.5 py-0.5 rounded-full">
            Contas em Dia
          </span>
        </div>
      </div>

      {/* Main Content Scroll */}
      <div className="flex-1 px-4 pt-4 space-y-4">
        {/* Horizontal scroll cards */}
        <div className="flex gap-3 overflow-x-auto pb-1.5">
          <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex-shrink-0 w-36">
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400">Em Atraso</span>
            <div className={`text-sm font-extrabold mt-1 ${data.summary.overdueCount > 0 ? "text-red-500" : "text-[#10A65A]"}`}>
              {brl(data.summary.overdueTotalCents)}
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5 block">{data.summary.overdueCount} pendência(s)</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex-shrink-0 w-36">
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400">Próx. 7 dias</span>
            <div className="text-sm font-extrabold text-[#0D1B8C] mt-1">
              {brl(data.summary.next7TotalCents)}
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5 block">{data.summary.next7Count} faturas</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex-shrink-0 w-36">
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400">Aberto no Mês</span>
            <div className="text-sm font-extrabold text-gray-800 mt-1">
              {brl(data.summary.monthOpenTotalCents)}
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5 block">Total não pago</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex-shrink-0 w-36">
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-400">Pago no Mês</span>
            <div className="text-sm font-extrabold text-emerald-600 mt-1">
              {brl(data.summary.monthPaidTotalCents)}
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5 block">Já liquidado</span>
          </div>
        </div>

        {/* Score impact note banner */}
        <div
          className="rounded-2xl p-4 flex gap-3 border shadow-xs"
          style={{
            background: overdue ? "#FEF2F2" : "#F0FDF4",
            borderColor: overdue ? "#FEE2E2" : "#DCFCE7",
          }}
        >
          <Bell className={`w-5 h-5 flex-shrink-0 mt-0.5 ${overdue ? "text-red-500" : "text-emerald-600"}`} />
          <div className="text-xs leading-relaxed text-gray-700">
            <strong className="text-gray-800">Impacto no Score:</strong> {data.summary.scoreImpactNote}
          </div>
        </div>

        {/* Grouped Buckets */}
        <div className="space-y-4">
          {grouped.map(([bucket, items]) => {
            const meta = BUCKET_META[bucket];
            const isCollapsed = collapsedBuckets[bucket] ?? false;
            const toggleCollapse = () => {
              setCollapsedBuckets((p) => ({ ...p, [bucket]: !p[bucket] }));
            };

            return (
              <div key={bucket} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header of bucket */}
                <div
                  onClick={toggleCollapse}
                  className="flex items-center justify-between p-4 bg-gray-50/50 cursor-pointer active:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{items.length} item(ns)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-[#07113A]">
                      {brl(items.reduce((a, b) => a + b.amountCents, 0))}
                    </span>
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Items List */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {items.map((p) => {
                      const Icon = pickIcon(p);
                      const isPaid = !!p.paidAt;
                      const isOverdue = p.bucket === "atrasado";

                      return (
                        <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                          {/* Left icon wrapper */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs"
                            style={{
                              background: isPaid ? "#F0FDF4" : isOverdue ? "#FEF2F2" : "#EFF6FF",
                              color: isPaid ? "#10A65A" : isOverdue ? "#EF4444" : "#0D1B8C",
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Detail info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold text-gray-800 truncate ${isPaid ? "line-through text-gray-400" : ""}`}>
                                {p.description}
                              </span>
                              {p.recurring && <RotateCcw className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />}
                            </div>

                            <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">
                              {p.issuer ? `${p.issuer} · ` : ""}
                              {isPaid
                                ? `Pago em ${fmtDate(p.paidAt!)}`
                                : isOverdue
                                ? `Venceu há ${Math.abs(p.daysToDue)}d`
                                : `Vence ${fmtDate(p.dueDate)}${p.daysToDue > 0 ? ` · em ${p.daysToDue}d` : ""}`}
                            </span>
                          </div>

                          {/* Right action / amount */}
                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                            <span className={`text-xs font-extrabold text-gray-800 ${isPaid ? "line-through text-gray-400" : ""}`}>
                              {brl(p.amountCents)}
                            </span>
                            <button
                              onClick={() => togglePaid(p)}
                              disabled={updatingId === p.id}
                              className={`px-3 py-1 rounded-full text-[9px] font-bold transition-all ${
                                isPaid
                                  ? "bg-gray-100 text-gray-500 border border-gray-200"
                                  : "bg-[#10A65A] text-white shadow-xs active:scale-95"
                              } disabled:opacity-50`}
                            >
                              {updatingId === p.id ? "..." : isPaid ? "Desfazer" : "Pago"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sync Info Footer */}
        {data.summary.source === "open_finance" ? (
          <div className="rounded-2xl p-4 bg-emerald-50/50 border border-emerald-100 flex gap-3 text-[10px] leading-relaxed text-gray-600">
            <RefreshCw className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-800">Sincronizado via Open Finance {data.summary.openFinanceBank && `· ${data.summary.openFinanceBank}`}</strong>
              <p className="mt-0.5">
                Última atualização: {data.summary.lastSyncedAt ? new Date(data.summary.lastSyncedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "agora"}.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 bg-gray-50 border border-gray-200 flex gap-3 text-[10px] leading-relaxed text-gray-500">
            <Link2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-700">De onde vêm esses pagamentos?</strong>
              <p className="mt-0.5">Simulação baseada no perfil. Conecte no Open Finance pelo portal web para integrar contas reais.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <BottomNav activePage="pagamentos" onLogout={handleLogout} />
    </div>
  );
}
