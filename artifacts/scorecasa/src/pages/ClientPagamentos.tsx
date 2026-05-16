import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import {
  CreditCard, Home, Lightbulb, Wifi, Smartphone, Tv, ShieldCheck, FileText,
  Check, AlertTriangle, Calendar, TrendingUp, RotateCcw, Bell,
} from "lucide-react";

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
  };
  items: PaymentItem[];
}

const ICONS: Record<Category, typeof CreditCard> = {
  cartao: CreditCard,
  financiamento: Home,
  conta: Lightbulb,
  boleto: FileText,
  emprestimo: ShieldCheck,
  assinatura: Tv,
};
const ICON_HINTS: Partial<Record<string, typeof CreditCard>> = {
  Vivo: Wifi, "Vivo Fibra": Wifi, Claro: Smartphone, TIM: Smartphone,
};
function pickIcon(p: PaymentItem) {
  if (p.issuer && ICON_HINTS[p.issuer]) return ICON_HINTS[p.issuer]!;
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

export function ClientPagamentos() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && !me) setLocation("/login");
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
  }, [loadingMe, me, setLocation]);

  const BASE = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);

  async function reload() {
    const r = await fetch(`${BASE}/api/client/payments`, { credentials: "include" });
    if (!r.ok) return;
    setData((await r.json()) as PaymentsResponse);
  }

  useEffect(() => {
    (async () => {
      try { await reload(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function togglePaid(p: PaymentItem) {
    setUpdating(p.id);
    try {
      const action = p.paidAt ? "unpay" : "pay";
      await fetch(`${BASE}/api/client/payments/${p.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      await reload();
    } finally {
      setUpdating(null);
    }
  }

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<Bucket, PaymentItem[]>();
    for (const it of data.items) {
      if (!map.has(it.bucket)) map.set(it.bucket, []);
      map.get(it.bucket)!.push(it);
    }
    return [...map.entries()].sort((a, b) => BUCKET_META[a[0]].order - BUCKET_META[b[0]].order);
  }, [data]);

  if (loadingMe || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="pagamentos">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Assistente de Pagamentos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe suas próximas contas e mantenha o ScoreCasa em dia. Marcar pagamentos em dia ajuda no seu histórico.
        </p>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-5">
          {/* ── Cards de resumo ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Próximos 7 dias"
              value={brl(data.summary.next7TotalCents)}
              hint={`${data.summary.next7Count} pagamento${data.summary.next7Count === 1 ? "" : "s"}`}
              color="#0D1B8C"
              icon={Calendar}
            />
            <SummaryCard
              label="Em atraso"
              value={brl(data.summary.overdueTotalCents)}
              hint={`${data.summary.overdueCount} pendência${data.summary.overdueCount === 1 ? "" : "s"}`}
              color={data.summary.overdueCount > 0 ? "#EF4444" : "#10A65A"}
              icon={AlertTriangle}
            />
            <SummaryCard
              label="Total do mês"
              value={brl(data.summary.monthOpenTotalCents)}
              hint="em aberto"
              color="#07113A"
              icon={TrendingUp}
            />
            <SummaryCard
              label="Pago no mês"
              value={brl(data.summary.monthPaidTotalCents)}
              hint="já quitado"
              color="#10A65A"
              icon={Check}
            />
          </div>

          {/* ── Aviso de impacto no score ── */}
          <div className="rounded-xl p-4 flex items-start gap-3"
               style={{ background: data.summary.overdueCount > 0 ? "#FEF2F2" : "rgba(16,166,90,0.08)", border: `1px solid ${data.summary.overdueCount > 0 ? "#FCA5A5" : "#10A65A33"}` }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: data.summary.overdueCount > 0 ? "#FEE2E2" : "#D1FAE5" }}>
              <Bell className="w-4 h-4" style={{ color: data.summary.overdueCount > 0 ? "#EF4444" : "#10A65A" }} />
            </div>
            <div className="flex-1 text-sm leading-relaxed" style={{ color: "#07113A" }}>
              <strong>Impacto no seu ScoreCasa:</strong>{" "}
              <span className="text-gray-700">{data.summary.scoreImpactNote}</span>
            </div>
          </div>

          {/* ── Lista agrupada por urgência ── */}
          {grouped.map(([bucket, items]) => {
            const meta = BUCKET_META[bucket];
            return (
              <div key={bucket} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold"
                          style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "#07113A" }}>
                    {brl(items.reduce((a, b) => a + b.amountCents, 0))}
                  </div>
                </div>
                <div>
                  {items.map((p) => {
                    const Icon = pickIcon(p);
                    const isPaid = !!p.paidAt;
                    const isOverdue = p.bucket === "atrasado";
                    return (
                      <div key={p.id}
                           className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100"
                           data-testid={`payment-${p.id}`}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{
                               background: isPaid ? "#D1FAE5" : isOverdue ? "#FEE2E2" : "rgba(13,27,140,0.06)",
                               color: isPaid ? "#10A65A" : isOverdue ? "#EF4444" : "#0D1B8C",
                             }}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className={`text-sm font-semibold truncate ${isPaid ? "line-through text-gray-400" : ""}`}
                                 style={{ color: isPaid ? undefined : "#07113A" }}>
                              {p.description}
                            </div>
                            {p.recurring && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5" title="Recorrente">
                                <RotateCcw className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {p.issuer ? `${p.issuer} · ` : ""}
                            {isPaid
                              ? `Pago em ${fmtDate(p.paidAt!)}`
                              : isOverdue
                                ? `Venceu há ${Math.abs(p.daysToDue)} ${Math.abs(p.daysToDue) === 1 ? "dia" : "dias"}`
                                : `Vence ${fmtDate(p.dueDate)}${p.daysToDue > 0 ? ` · em ${p.daysToDue}d` : ""}`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-sm font-bold ${isPaid ? "text-gray-400 line-through" : ""}`}
                               style={{ color: isPaid ? undefined : "#07113A" }}>
                            {brl(p.amountCents)}
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePaid(p)}
                            disabled={updating === p.id}
                            data-testid={`button-toggle-${p.id}`}
                            className="mt-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all disabled:opacity-50"
                            style={
                              isPaid
                                ? { color: "#6B7280", background: "transparent", border: "1px solid #E5E7EB" }
                                : { color: "white", background: "#10A65A" }
                            }
                          >
                            {updating === p.id ? "..." : isPaid ? "Desfazer" : "Marcar pago"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Rodapé / origem dos dados ── */}
          <div className="rounded-xl p-4 bg-gray-50 border border-gray-200 text-xs text-gray-500 leading-relaxed">
            <strong style={{ color: "#07113A" }}>De onde vêm esses pagamentos?</strong>{" "}
            Quando você conectar suas contas via <strong>Open Finance</strong>, suas obrigações reais
            serão sincronizadas automaticamente. Por enquanto, exibimos uma simulação baseada no seu
            perfil de renda para você testar o assistente.
          </div>
        </div>
      )}
    </ClientLayout>
  );
}

function SummaryCard({
  label, value, hint, color, icon: Icon,
}: { label: string; value: string; hint: string; color: string; icon: typeof Calendar }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</div>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="text-lg font-bold mt-1.5 leading-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>
    </div>
  );
}
