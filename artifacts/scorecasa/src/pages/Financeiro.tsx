import { useState } from "react";
import { useGetMe, useGetAllSubscriptions, useCreateSubscription, useUpdateSubscription, useGetMySubscription } from "@workspace/api-client-react";
import { getGetAllSubscriptionsQueryKey, getGetMySubscriptionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard, CheckCircle, Clock, AlertCircle, XCircle,
  TrendingUp, Users, DollarSign, BarChart3, Crown, Shield, Zap, X,
} from "lucide-react";

// ── Planos ─────────────────────────────────────────────────────────────────────
const PLANS = {
  client: {
    id: "client",
    name: "Plano Cliente",
    priceMonthly: 29.90,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    icon: Shield,
    description: "Acesso ao portal, análise de crédito e catálogo de imóveis",
    features: [
      "Portal do cliente completo",
      "Análise de crédito com IA",
      "GPS de aprovação personalizado",
      "Catálogo de imóveis",
      "Acompanhamento do processo",
      "Relatório PDF de crédito",
    ],
  },
  corretor: {
    id: "corretor",
    name: "Plano Corretor",
    priceMonthly: 99.90,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    icon: TrendingUp,
    description: "Gestão completa de leads, catálogo de imóveis e análise avançada",
    features: [
      "Gestão ilimitada de leads",
      "Cadastro de imóveis no catálogo",
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Dashboard de performance",
      "Exportação de relatórios PDF",
      "Notificações em tempo real",
    ],
  },
  correspondent: {
    id: "correspondent",
    name: "Plano Correspondente",
    priceMonthly: 199.90,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    icon: Crown,
    description: "Solução completa para correspondentes bancários",
    features: [
      "Tudo do Plano Corretor",
      "Gerenciamento de múltiplos corretores",
      "Relatórios financeiros avançados",
      "Painel de correspondente bancário",
      "Suporte prioritário",
      "Integração Open Finance",
      "Análise de portfólio",
      "Acesso à API (breve)",
    ],
  },
};

type PlanKey = keyof typeof PLANS;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  trial:     { label: "Período Trial",    color: "#0D1B8C", bg: "#EEF2FF", icon: Clock },
  active:    { label: "Ativo",            color: "#10A65A", bg: "#F0FDF4", icon: CheckCircle },
  overdue:   { label: "Em atraso",        color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  cancelled: { label: "Cancelado",        color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
  inactive:  { label: "Inativo",          color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function PlanCard({ planKey, current }: { planKey: PlanKey; current?: boolean }) {
  const plan = PLANS[planKey];
  const Icon = plan.icon;
  return (
    <div
      className={`relative rounded-2xl border-2 p-6 ${current ? "shadow-lg" : "opacity-80"}`}
      style={{ borderColor: current ? plan.color : "#E5E7EB", background: current ? plan.bgLight : "white" }}
    >
      {current && (
        <div
          className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: plan.color }}
        >
          Seu plano atual
        </div>
      )}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: plan.bgLight }}>
          <Icon className="w-5 h-5" style={{ color: plan.color }} />
        </div>
        <div>
          <div className="font-bold text-[#07113A]">{plan.name}</div>
          <div className="text-xs text-gray-500">{plan.description}</div>
        </div>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-bold" style={{ color: plan.color }}>
          {formatBRL(plan.priceMonthly)}
        </span>
        <span className="text-gray-400 text-sm">/mês</span>
      </div>
      <ul className="space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── View para usuário individual ─────────────────────────────────────────────
function IndividualView({ role }: { role: string }) {
  const { data: sub, isLoading } = useGetMySubscription({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSub = useCreateSubscription();
  const { data: me } = useGetMe({});

  const planMap: Record<string, PlanKey> = {
    client: "client",
    broker: "corretor",
    correspondent: "correspondent",
  };
  const myPlanKey = planMap[role] ?? "client";

  function handleActivateTrial() {
    const user = me as any;
    if (!user) return;
    createSub.mutate({
      data: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        plan: myPlanKey,
        status: "trial",
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
        toast({ title: "Trial ativado! Aproveite 30 dias grátis." });
      },
    });
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" /></div>;
  }

  const plan = PLANS[myPlanKey];
  const Icon = plan.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Seu plano e informações de cobrança</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — subscription status */}
        <div className="lg:col-span-1 space-y-4">
          {sub ? (
            <>
              {/* Status card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Status da assinatura</div>
                {(() => {
                  const sc = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.inactive;
                  const SIcon = sc.icon;
                  return (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg }}>
                        <SIcon className="w-5 h-5" style={{ color: sc.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-[#07113A]">{sc.label}</div>
                        <div className="text-xs text-gray-400">{PLANS[(sub as any).plan as PlanKey]?.name}</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor mensal</span>
                    <span className="font-semibold text-[#07113A]">{formatBRL(sub.priceMonthly)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vencimento trial</span>
                    <span className="font-medium">{formatDate(sub.trialEndsAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Próximo vencimento</span>
                    <span className="font-medium">{formatDate(sub.nextDueAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Último pagamento</span>
                    <span className="font-medium">{formatDate(sub.lastPaymentAt)}</span>
                  </div>
                </div>
                {sub.status === "trial" && (
                  <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "#EEF2FF", color: "#0D1B8C" }}>
                    🎉 Você está no período de trial gratuito de 30 dias. Após o trial, a cobrança de {formatBRL(sub.priceMonthly)}/mês será iniciada.
                  </div>
                )}
                {sub.status === "overdue" && (
                  <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#EF4444" }}>
                    ⚠️ Pagamento em atraso. Regularize para continuar com acesso completo.
                  </div>
                )}
              </div>

              {/* Payment method placeholder */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Forma de pagamento</div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-600">Boleto / PIX</div>
                    <div className="text-xs text-gray-400">Entre em contato para configurar</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: plan.bgLight }}>
                <Icon className="w-6 h-6" style={{ color: plan.color }} />
              </div>
              <div className="font-semibold text-[#07113A] mb-1">Nenhuma assinatura ativa</div>
              <div className="text-xs text-gray-400 mb-5">Ative seu trial gratuito de 30 dias</div>
              <button
                onClick={handleActivateTrial}
                disabled={createSub.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: plan.color }}
              >
                {createSub.isPending ? "Ativando..." : "Ativar trial gratuito"}
              </button>
            </div>
          )}
        </div>

        {/* Right — plan comparison */}
        <div className="lg:col-span-2">
          <div className="text-sm font-semibold text-[#07113A] mb-4">Planos disponíveis</div>
          <div className="grid sm:grid-cols-3 gap-4">
            {(Object.keys(PLANS) as PlanKey[]).map((k) => (
              <PlanCard key={k} planKey={k} current={k === myPlanKey} />
            ))}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-[#F2F4F7] text-sm text-gray-500">
            Para alterar seu plano ou solicitar suporte financeiro, entre em contato com nossa equipe em{" "}
            <span className="font-semibold text-[#0D1B8C]">financeiro@scorecasa.com.br</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── View admin ────────────────────────────────────────────────────────────────
function AdminView() {
  const { data: subs = [], isLoading } = useGetAllSubscriptions({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateSub = useUpdateSubscription();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan, setFilterPlan] = useState("");

  const list = (subs as any[]).filter((s) => {
    if (search && !s.userName.toLowerCase().includes(search.toLowerCase()) &&
        !s.userEmail.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterPlan && s.plan !== filterPlan) return false;
    return true;
  });

  const totalMRR = (subs as any[]).filter((s) => s.status === "active").reduce((acc, s) => acc + s.priceMonthly, 0);
  const trialCount = (subs as any[]).filter((s) => s.status === "trial").length;
  const overdueCount = (subs as any[]).filter((s) => s.status === "overdue").length;

  function handleStatusChange(id: number, status: string) {
    updateSub.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAllSubscriptionsQueryKey() });
        toast({ title: "Status atualizado" });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Financeiro — Visão Geral</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestão de assinaturas e pagamentos de todos os perfis</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MRR Total", value: formatBRL(totalMRR), icon: DollarSign, color: "#10A65A", bg: "#F0FDF4" },
          { label: "Total assinaturas", value: String((subs as any[]).length), icon: Users, color: "#0D1B8C", bg: "#EEF2FF" },
          { label: "Em trial", value: String(trialCount), icon: Clock, color: "#D97706", bg: "#FFFBEB" },
          { label: "Em atraso", value: String(overdueCount), icon: AlertCircle, color: "#EF4444", bg: "#FEF2F2" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400">{kpi.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: "#07113A" }}>{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* MRR by plan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="text-sm font-semibold text-[#07113A] mb-4">Receita por plano</div>
        <div className="grid grid-cols-3 gap-4">
          {(Object.values(PLANS) as typeof PLANS[PlanKey][]).map((p) => {
            const planSubs = (subs as any[]).filter((s) => s.plan === p.id && s.status === "active");
            const Icon = p.icon;
            return (
              <div key={p.id} className="p-4 rounded-xl" style={{ background: p.bgLight }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                  <span className="text-xs font-semibold" style={{ color: p.color }}>{p.name}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: "#07113A" }}>{planSubs.length} assinantes</div>
                <div className="text-sm text-gray-500">{formatBRL(planSubs.length * p.priceMonthly)}/mês</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-4 pr-4 h-10 rounded-lg border border-input text-sm"
            />
          </div>
          <Select value={filterPlan || "__all__"} onValueChange={(v) => setFilterPlan(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os planos</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="corretor">Corretor</SelectItem>
              <SelectItem value="correspondent">Correspondente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos status</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="overdue">Em atraso</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhuma assinatura encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Plano</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor/mês</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Próx. venc.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map((s: any) => {
                  const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.inactive;
                  const SIcon = sc.icon;
                  const p = PLANS[s.plan as PlanKey];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#07113A]">{s.userName}</div>
                        <div className="text-xs text-gray-400">{s.userEmail}</div>
                        <div className="text-[10px] text-gray-300 uppercase">{s.userRole}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {p ? (
                          <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: p.bgLight, color: p.color }}>
                            {p.name}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <SIcon className="w-3.5 h-3.5" style={{ color: sc.color }} />
                          <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#07113A]">
                        {formatBRL(s.priceMonthly)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {formatDate(s.nextDueAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Select
                          value={s.status}
                          onValueChange={(v) => handleStatusChange(s.id, v)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="active">Marcar ativo</SelectItem>
                            <SelectItem value="overdue">Marcar em atraso</SelectItem>
                            <SelectItem value="cancelled">Cancelar</SelectItem>
                            <SelectItem value="inactive">Inativar</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Financeiro() {
  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "client";

  if (role === "admin") return <AdminView />;
  return <IndividualView role={role} />;
}
