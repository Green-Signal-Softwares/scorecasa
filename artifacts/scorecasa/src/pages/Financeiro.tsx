import { useState } from "react";
import {
  useGetMe, useGetAllSubscriptions, useCreateSubscription,
  useUpdateSubscription, useGetMySubscription, useGetPlans,
  useCreatePlan, useUpdatePlan, useDeletePlan,
  type Plan,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getGetAllSubscriptionsQueryKey, getGetMySubscriptionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard, CheckCircle, Clock, AlertCircle, XCircle,
  Users, DollarSign, Store,
  ChevronDown, ChevronUp, Phone,
} from "lucide-react";

// ── Helpers de cor/ícone baseados no grupo (sem dados hard-coded) ────────────
function groupColor(group: string) {
  if (group === "corretor") return "#0D1B8C";
  if (group === "correspondent") return "#7C3AED";
  return "#10A65A";
}
function groupBg(group: string) {
  if (group === "corretor") return "#EEF2FF";
  if (group === "correspondent") return "#F5F3FF";
  return "#F0FDF4";
}
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  trial: { label: "Período Trial", color: "#0D1B8C", bg: "#EEF2FF", icon: Clock },
  active: { label: "Ativo", color: "#10A65A", bg: "#F0FDF4", icon: CheckCircle },
  overdue: { label: "Em atraso", color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  cancelled: { label: "Cancelado", color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
  inactive: { label: "Inativo", color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
};

const MARKETPLACE_ADDONS_STATIC = [
  { id: "marketplace_10", label: "Até 10 imóveis", priceMonthly: 99.00, propertyLimit: 10 },
  { id: "marketplace_50", label: "Até 50 imóveis", priceMonthly: 199.00, propertyLimit: 50 },
];

function formatBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d?: string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("pt-BR"); }

// ── Componente de plano individual ────────────────────────────────────────────
function TierCard({ tier, isCurrent }: { tier: Plan; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const color = tier.color ?? groupColor(tier.group);
  const bg = tier.bgLight ?? groupBg(tier.group);
  const features: string[] = tier.features ?? [];
  return (
    <div
      className={`relative rounded-2xl border-2 p-5 transition-all ${isCurrent ? "shadow-lg" : "opacity-75"}`}
      style={{ borderColor: isCurrent ? tier.color : "#E5E7EB", background: isCurrent ? bg : "white" }}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: tier.color }}>
          Seu plano atual
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <div className="w-4 h-4 rounded-full" style={{ background: color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[#07113A] text-sm leading-tight">{tier.label}</div>
          {tier.description && <div className="text-xs text-gray-400 mt-0.5 leading-snug">{tier.description}</div>}
        </div>
      </div>

      <div className="mb-3">
        {tier.enterprise ? (
          <div>
            <div className="text-lg font-bold text-[#07113A]">Sob consulta</div>
            <a href="tel:+55" className="inline-flex items-center gap-1 text-xs mt-1 font-medium" style={{ color: tier.color }}>
              <Phone className="w-3 h-3" /> Solicitar análise
            </a>
          </div>
        ) : (
          <div>
            <span className="text-2xl font-bold" style={{ color: tier.color }}>{formatBRL(tier.priceMonthly)}</span>
            <span className="text-gray-400 text-xs">/mês</span>
          </div>
        )}
      </div>

      {features.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-semibold mb-2"
      style={{ color: color }}
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? "Menos detalhes" : "Ver recursos"}
        </button>
      )}

      {open && (
        <ul className="space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: color }} />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Seção add-on marketplace ───────────────────────────────────────────────────
function MarketplaceAddonSection({ sub }: { sub: any }) {
  const planId = sub?.plan;
  const isVitrineIncluded = planId === "imobiliaria" || planId === "enterprise";
  const hasAddon = sub?.marketplaceAddon || isVitrineIncluded;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const updateSub = useUpdateSubscription();

  function handleContract(addon: { propertyLimit: number; priceMonthly: number; label: string }) {
    if (!sub?.id) {
      toast({ title: "Ative seu plano antes de contratar a Vitrine.", variant: "destructive" });
      return;
    }
    updateSub.mutate({
      id: sub.id,
      data: {
        marketplaceAddon: true,
        marketplacePropertyLimit: addon.propertyLimit,
        marketplaceAddonPrice: addon.priceMonthly,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
        toast({ title: "Vitrine de Imóveis contratada!", description: `${addon.label} · ${formatBRL(addon.priceMonthly)}/mês. Aba Imóveis liberada.` });
        setTimeout(() => setLocation("/imoveis"), 800);
      },
      onError: () => toast({ title: "Erro ao contratar add-on", variant: "destructive" }),
    });
  }

  function handleCancel() {
    if (!sub?.id) return;
    if (!confirm("Cancelar o add-on de Vitrine? Seus imóveis cadastrados deixarão de ser editáveis.")) return;
    updateSub.mutate({
      id: sub.id,
      data: { marketplaceAddon: false, marketplacePropertyLimit: undefined as any, marketplaceAddonPrice: undefined as any },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
        toast({ title: "Add-on cancelado." });
      },
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Store className="w-4 h-4 text-[#0D1B8C]" />
        <div className="text-sm font-semibold text-[#07113A]">Vitrine de Imóveis</div>
      </div>

      {isVitrineIncluded ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[#F0FDF4] flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-[#10A65A]" />
            <div>
              <div className="font-semibold text-sm text-[#10A65A]">Vitrine Inclusa</div>
              <div className="text-xs text-gray-500">
                Imóveis ilimitados · Incluso no seu plano
              </div>
            </div>
          </div>
        </div>
      ) : hasAddon ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-[#EEF2FF] flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-[#0D1B8C]" />
            <div>
              <div className="font-semibold text-sm text-[#0D1B8C]">Vitrine ativa</div>
              <div className="text-xs text-gray-500">
                Até {sub.marketplacePropertyLimit} imóveis · {formatBRL(sub.marketplaceAddonPrice ?? 0)}/mês
              </div>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={updateSub.isPending}
            className="w-full text-xs text-gray-400 hover:text-red-500 underline-offset-2 hover:underline"
          >
            Cancelar add-on
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Divulgue seu portfólio de imóveis para clientes verificados da plataforma. Sem o add-on, a aba <strong>Imóveis</strong> não fica disponível.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MARKETPLACE_ADDONS_STATIC.map((addon) => (
              <button
                key={addon.id}
                onClick={() => handleContract(addon)}
                disabled={updateSub.isPending}
                data-testid={`button-contract-${addon.id}`}
                className="border-2 border-[#0D1B8C]/20 hover:border-[#0D1B8C] rounded-xl p-3 text-center transition-all disabled:opacity-60 group"
              >
                <div className="text-xs font-semibold text-gray-500 mb-1">{addon.label}</div>
                <div className="text-lg font-bold text-[#0D1B8C]">{formatBRL(addon.priceMonthly)}</div>
                <div className="text-[10px] text-gray-400 mb-2">/mês</div>
                <div className="text-[10px] font-bold text-white py-1 rounded-md group-hover:bg-[#10A65A] bg-[#0D1B8C] transition-colors">
                  {updateSub.isPending ? "..." : "Contratar"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabela de planos: Individual / Corretor / Correspondente ──────────────────
const LEGACY_PLAN_IDS = new Set([
  "client", "corretor_50", "corretor_200", "corretor_enterprise",
  "correspondent", "correspondent_50", "correspondent_200", "correspondent_enterprise",
]);

function PartnerPlansTable({ group, currentPlanId }: { group: string; currentPlanId?: string }) {
  const { data: allPlans = [], isLoading } = useGetPlans({ role: group === "individual" ? "client" : group === "corretor" ? "broker" : "correspondent" } as any);
  const tiers = (allPlans as Plan[]).filter((t) => !t.isLegacy);
  const color = groupColor(group);
  const bgLight = groupBg(group);
  const title = group === "corretor" ? "Planos Corretor / Imobiliária" : group === "correspondent" ? "Planos Correspondente" : "Planos Individuais";

  if (isLoading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color }} /></div>;

  return (
    <div>
      <div className="text-sm font-bold mb-3" style={{ color }}>{title}</div>
      <div className="space-y-3">
        {tiers.map((tier) => (
          <TierCard key={tier.id} tier={tier} isCurrent={tier.id === currentPlanId} />
        ))}
      </div>
      {group === "correspondent" && (
        <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: bgLight, color }}>
          <strong>Incluso no Bank Connect:</strong> gestão completa de documentação exigida pelo banco, acompanhamento de todas as etapas do financiamento habitacional até a entrega das chaves.
        </div>
      )}
      {group === "corretor" && (
        <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: bgLight, color }}>
          <strong>Add-on opcional:</strong> marketplace de imóveis para divulgar seu portfólio.
        </div>
      )}
      {group !== "individual" && (
        <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed border" style={{ borderColor: color, color }}>
          <strong>Implantação / setup do sistema</strong> a partir de <strong>R$ 590,00</strong> (obrigatório na contratação).
        </div>
      )}
    </div>
  );
}

// ── View usuário individual ────────────────────────────────────────────────────
function IndividualView({ role }: { role: string }) {
  const { data: sub, isLoading } = useGetMySubscription({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSub = useCreateSubscription();
  const { data: me } = useGetMe({});

  const defaultPlanId: Record<string, string> = {
    client: "free", broker: "corretor", correspondent: "bank_connect",
  };
  const myDefaultPlan = defaultPlanId[role] ?? "free";
  const currentPlanId = (sub as any)?.plan as string | undefined;
  const { data: planData } = useGetPlans({ role: role === "client" ? "client" : role === "broker" ? "broker" : "correspondent" } as any);
  const allPlans = (planData ?? []) as Plan[];
  const displayPlan = allPlans.find((p) => p.id === (currentPlanId ?? myDefaultPlan)) ?? allPlans[0];
  const displayColor = displayPlan?.color ?? groupColor(role === "broker" ? "corretor" : role === "correspondent" ? "correspondent" : "individual");
  const displayBg = displayPlan?.bgLight ?? groupBg(role === "broker" ? "corretor" : role === "correspondent" ? "correspondent" : "individual");

  function handleActivateTrial() {
    const user = me as any;
    if (!user) return;
    createSub.mutate({
      data: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        plan: myDefaultPlan as any,
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

  const groupMap: Record<string, "individual" | "corretor" | "correspondent"> = {
    client: "individual", broker: "corretor", correspondent: "correspondent",
  };
  const partnerGroup = groupMap[role];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Seu plano e informações de cobrança</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — status */}
        <div className="lg:col-span-1 space-y-4">
          {sub ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Status da assinatura</div>
                {(() => {
                  const sc = STATUS_CONFIG[(sub as any).status] ?? STATUS_CONFIG.inactive;
                  const SIcon = sc.icon;
                  return (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg }}>
                        <SIcon className="w-5 h-5" style={{ color: sc.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-[#07113A]">{sc.label}</div>
                        <div className="text-xs text-gray-400">{displayPlan?.label ?? currentPlanId ?? "—"}</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor mensal</span>
                    <span className="font-semibold text-[#07113A]">{formatBRL((sub as any).priceMonthly)}</span>
                  </div>
                  {(sub as any).marketplaceAddon && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Add-on marketplace</span>
                      <span className="font-semibold text-[#0D1B8C]">+ {formatBRL((sub as any).marketplaceAddonPrice ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fim do trial</span>
                    <span className="font-medium">{formatDate((sub as any).trialEndsAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Próximo vencimento</span>
                    <span className="font-medium">{formatDate((sub as any).nextDueAt)}</span>
                  </div>
                </div>
                {(sub as any).status === "trial" && (
                  <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "#EEF2FF", color: "#0D1B8C" }}>
                    Trial gratuito por 30 dias. Após o período, a cobrança de {formatBRL((sub as any).priceMonthly)}/mês será iniciada.
                  </div>
                )}
                {(sub as any).status === "overdue" && (
                  <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#EF4444" }}>
                    ⚠️ Pagamento em atraso. Regularize para continuar com acesso completo.
                  </div>
                )}
              </div>

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

              {/* Add-on marketplace (apenas corretor) */}
              {role === "broker" && <MarketplaceAddonSection sub={sub} />}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: displayBg }}>
                <div className="w-6 h-6 rounded-full" style={{ background: displayColor }} />
              </div>
              <div className="font-semibold text-[#07113A] mb-1">Nenhuma assinatura ativa</div>
              <div className="text-xs text-gray-400 mb-5">Ative seu trial gratuito de 30 dias</div>
              <button
                onClick={handleActivateTrial}
                disabled={createSub.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: displayColor }}
              >
                {createSub.isPending ? "Ativando..." : "Ativar trial gratuito"}
              </button>
            </div>
          )}
        </div>

        {/* Right — plan comparison */}
        <div className="lg:col-span-2">
          {partnerGroup && (
            <PartnerPlansTable group={partnerGroup} currentPlanId={currentPlanId} />
          )}
          <div className="mt-4 p-4 rounded-xl bg-[#F2F4F7] text-sm text-gray-500">
            Para mudar de plano, contratar add-ons ou solicitar suporte financeiro, entre em contato em{" "}
            <span className="font-semibold text-[#0D1B8C]">financeiro@scorecasa.com.br</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── View admin ─────────────────────────────────────────────────────────────────
function AdminView() {
  const { data: subs = [], isLoading } = useGetAllSubscriptions({});
  const { data: plans = [] } = useGetPlans({ includeInactive: "true", includeLegacy: "true" } as any);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateSub = useUpdateSubscription();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [planForm, setPlanForm] = useState({
    id: "",
    label: "",
    role: "client",
    group: "individual",
    priceMonthly: "0",
    leadLimit: "",
    enterprise: false,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    description: "",
    featuresText: "",
    sortOrder: "0",
    isActive: true,
  });

  const plansById = new Map((plans as Plan[]).map((p) => [p.id, p]));
  const inferGroupFromRole = (role?: string) => {
    if (role === "broker") return "corretor";
    if (role === "correspondent") return "correspondent";
    return "individual";
  };
  const getSubscriptionGroup = (s: any) => {
    const plan = plansById.get(s.plan);
    return plan?.group ?? inferGroupFromRole(s.userRole);
  };

  const list = (subs as any[]).filter((s) => {
    if (search && !s.userName.toLowerCase().includes(search.toLowerCase()) &&
      !s.userEmail.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterGroup) {
      const group = getSubscriptionGroup(s);
      if (group !== filterGroup) return false;
    }
    return true;
  });

  const activeSubs = (subs as any[]).filter((s) => s.status === "active");
  const totalMRR = activeSubs.reduce((acc: number, s: any) => acc + s.priceMonthly, 0);
  const trialCount = (subs as any[]).filter((s) => s.status === "trial").length;
  const overdueCount = (subs as any[]).filter((s) => s.status === "overdue").length;
  const addonCount = (subs as any[]).filter((s) => s.marketplaceAddon).length;

  function handleStatusChange(id: number, status: string) {
    updateSub.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAllSubscriptionsQueryKey() });
        toast({ title: "Status atualizado" });
      },
    });
  }

  // MRR by group
  const groups = [
    { key: "individual", label: "Individual", color: "#10A65A", bg: "#F0FDF4" },
    { key: "corretor", label: "Corretor", color: "#0D1B8C", bg: "#EEF2FF" },
    { key: "correspondent", label: "Correspondente", color: "#7C3AED", bg: "#F5F3FF" },
  ];

  const planList = plans as Plan[];
  const sortedPlans = [...planList].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
    queryClient.invalidateQueries({ queryKey: getGetAllSubscriptionsQueryKey() });
  };

  const resetPlanForm = () => {
    setFormMode("create");
    setEditingPlanId(null);
    setPlanForm({
      id: "",
      label: "",
      role: "client",
      group: "individual",
      priceMonthly: "0",
      leadLimit: "",
      enterprise: false,
      color: "#10A65A",
      bgLight: "#F0FDF4",
      description: "",
      featuresText: "",
      sortOrder: "0",
      isActive: true,
    });
  };

  const startEditPlan = (plan: Plan) => {
    setFormMode("edit");
    setEditingPlanId(plan.id);
    setPlanForm({
      id: plan.id,
      label: plan.label,
      role: plan.role,
      group: plan.group,
      priceMonthly: String(plan.priceMonthly),
      leadLimit: plan.leadLimit == null ? "" : String(plan.leadLimit),
      enterprise: !!plan.enterprise,
      color: plan.color,
      bgLight: plan.bgLight,
      description: plan.description ?? "",
      featuresText: (plan.features ?? []).join("\n"),
      sortOrder: String(plan.sortOrder ?? 0),
      isActive: !!plan.isActive,
    });
  };

  const featuresArray = planForm.featuresText
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const submitPlan = () => {
    const payload = {
      label: planForm.label.trim(),
      role: planForm.role as any,
      group: planForm.group as any,
      priceMonthly: Number(planForm.priceMonthly),
      leadLimit: planForm.leadLimit === "" ? null : Number(planForm.leadLimit),
      enterprise: planForm.enterprise,
      color: planForm.color,
      bgLight: planForm.bgLight,
      description: planForm.description.trim(),
      features: featuresArray,
      sortOrder: Number(planForm.sortOrder),
      isActive: planForm.isActive,
    } as const;

    if (!planForm.label.trim()) {
      toast({ title: "Nome do plano é obrigatório", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(payload.priceMonthly) || payload.priceMonthly < 0) {
      toast({ title: "Preço mensal inválido", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(payload.sortOrder)) {
      toast({ title: "Ordem inválida", variant: "destructive" });
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(payload.color) || !/^#[0-9A-Fa-f]{6}$/.test(payload.bgLight)) {
      toast({ title: "Cores devem estar no formato #RRGGBB", variant: "destructive" });
      return;
    }
    if (planForm.leadLimit !== "" && (!Number.isInteger(payload.leadLimit) || (payload.leadLimit as number) <= 0)) {
      toast({ title: "Limite de leads deve ser inteiro positivo", variant: "destructive" });
      return;
    }

    if (formMode === "create") {
      const id = planForm.id.trim();
      if (!/^[a-z0-9_]+$/.test(id) || id.length < 2) {
        toast({ title: "ID deve ser snake_case com ao menos 2 caracteres", variant: "destructive" });
        return;
      }
      createPlan.mutate({
        data: {
          id,
          ...payload,
        },
      }, {
        onSuccess: () => {
          invalidatePlans();
          resetPlanForm();
          toast({ title: "Plano criado com sucesso" });
        },
        onError: (err: any) => {
          const msg = err?.message ?? "Não foi possível criar o plano";
          toast({ title: msg, variant: "destructive" });
        },
      });
      return;
    }

    if (!editingPlanId) return;
    updatePlan.mutate({
      id: editingPlanId,
      data: {
        label: payload.label,
        priceMonthly: payload.priceMonthly,
        leadLimit: payload.leadLimit,
        enterprise: payload.enterprise,
        color: payload.color,
        bgLight: payload.bgLight,
        description: payload.description,
        features: payload.features,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
      },
    }, {
      onSuccess: () => {
        invalidatePlans();
        resetPlanForm();
        toast({ title: "Plano atualizado com sucesso" });
      },
      onError: (err: any) => {
        const msg = err?.message ?? "Não foi possível atualizar o plano";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const togglePlanActive = (plan: Plan) => {
    if (plan.isActive) {
      if (!confirm(`Desativar o plano ${plan.label}?`)) return;
      deletePlan.mutate({ id: plan.id }, {
        onSuccess: () => {
          invalidatePlans();
          toast({ title: "Plano desativado" });
        },
        onError: (err: any) => {
          const msg = err?.message ?? "Não foi possível desativar o plano";
          toast({ title: msg, variant: "destructive" });
        },
      });
      return;
    }

    updatePlan.mutate({ id: plan.id, data: { isActive: true } }, {
      onSuccess: () => {
        invalidatePlans();
        toast({ title: "Plano ativado" });
      },
      onError: (err: any) => {
        const msg = err?.message ?? "Não foi possível ativar o plano";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const isPlanMutating = createPlan.isPending || updatePlan.isPending || deletePlan.isPending;

  return (
    <div className="space-y-6">
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

      {/* MRR por grupo + add-on */}
      <div className="grid lg:grid-cols-4 gap-4">
        {groups.map((g) => {
          const groupSubs = (subs as any[]).filter((s) => {
            return getSubscriptionGroup(s) === g.key && s.status === "active";
          });
          const groupMRR = groupSubs.reduce((acc: number, s: any) => acc + s.priceMonthly, 0);
          return (
            <div key={g.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs font-semibold mb-2" style={{ color: g.color }}>{g.label}</div>
              <div className="text-xl font-bold text-[#07113A]">{groupSubs.length} assinantes</div>
              <div className="text-sm text-gray-500">{formatBRL(groupMRR)}/mês</div>
            </div>
          );
        })}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Store className="w-3.5 h-3.5 text-[#D97706]" />
            <div className="text-xs font-semibold text-[#D97706]">Add-on Marketplace</div>
          </div>
          <div className="text-xl font-bold text-[#07113A]">{addonCount} ativos</div>
          <div className="text-sm text-gray-500">
            {formatBRL((subs as any[]).filter((s) => s.marketplaceAddon).reduce((acc: number, s: any) => acc + (s.marketplaceAddonPrice ?? 0), 0))}/mês
          </div>
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
          <Select value={filterGroup || "__all__"} onValueChange={(v) => setFilterGroup(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
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
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhuma assinatura encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Usuário</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Plano</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Valor/mês</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Add-on</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Próx. venc.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map((s: any) => {
                  const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.inactive;
                  const SIcon = sc.icon;
                  const tier = plansById.get(s.plan);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#07113A]">{s.userName}</div>
                        <div className="text-xs text-gray-400">{s.userEmail}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {tier ? (
                          <span className="text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: tier.bgLight, color: tier.color }}>
                            {tier.label}
                          </span>
                        ) : <span className="text-gray-400 text-xs">{s.plan}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <SIcon className="w-3.5 h-3.5" style={{ color: sc.color }} />
                          <span className="text-xs font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#07113A]">{formatBRL(s.priceMonthly)}</td>
                      <td className="px-5 py-3.5">
                        {s.marketplaceAddon ? (
                          <span className="text-xs px-2 py-1 rounded-full font-semibold bg-amber-50 text-amber-700">
                            Marketplace {s.marketplacePropertyLimit} imóveis
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(s.nextDueAt)}</td>
                      <td className="px-5 py-3.5">
                        <Select value={s.status} onValueChange={(v) => handleStatusChange(s.id, v)}>
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

      {/* Gestão de planos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#07113A]">Gestão de Planos</h2>
            <p className="text-xs text-gray-500">Criar, editar e ativar/desativar planos dinâmicos.</p>
          </div>
          {formMode === "edit" && (
            <button
              onClick={resetPlanForm}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Novo plano
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">ID (slug)</label>
            <input
              value={planForm.id}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, id: e.target.value.toLowerCase() }))}
              disabled={formMode === "edit"}
              placeholder="ex: premium_plus"
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Nome</label>
            <input
              value={planForm.label}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Nome exibido do plano"
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Perfil</label>
            <Select value={planForm.role} onValueChange={(v) => setPlanForm((prev) => ({ ...prev, role: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="broker">Corretor</SelectItem>
                <SelectItem value="correspondent">Correspondente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Grupo</label>
            <Select value={planForm.group} onValueChange={(v) => setPlanForm((prev) => ({ ...prev, group: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="correspondent">Correspondente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Preço mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={planForm.priceMonthly}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, priceMonthly: e.target.value }))}
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Ordem</label>
            <input
              type="number"
              step="1"
              value={planForm.sortOrder}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Limite de leads</label>
            <input
              type="number"
              step="1"
              min="1"
              value={planForm.leadLimit}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, leadLimit: e.target.value }))}
              placeholder="vazio = ilimitado"
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Cor (#RRGGBB)</label>
            <input
              value={planForm.color}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, color: e.target.value }))}
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Fundo claro (#RRGGBB)</label>
            <input
              value={planForm.bgLight}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, bgLight: e.target.value }))}
              className="w-full mt-1 px-3 h-10 rounded-lg border border-input text-sm"
            />
          </div>
          <div className="flex items-end gap-5 pb-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={planForm.enterprise}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, enterprise: e.target.checked }))}
              />
              Enterprise
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Ativo
            </label>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Descrição</label>
            <textarea
              value={planForm.description}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-input text-sm"
              placeholder="Resumo comercial do plano"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Features (1 por linha)</label>
            <textarea
              value={planForm.featuresText}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, featuresText: e.target.value }))}
              rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-input text-sm"
              placeholder="Ex.:\nAcompanhamento em tempo real\nSuporte prioritário"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {formMode === "edit" && (
            <button
              onClick={resetPlanForm}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancelar edição
            </button>
          )}
          <button
            onClick={submitPlan}
            disabled={isPlanMutating}
            className="px-4 py-2 text-sm rounded-lg text-white bg-[#0D1B8C] hover:bg-[#0B1770] disabled:opacity-60"
          >
            {isPlanMutating ? "Salvando..." : formMode === "create" ? "Criar plano" : "Salvar alterações"}
          </button>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Plano</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Perfil/Grupo</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Preço</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPlans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#07113A]">{plan.label}</div>
                    <div className="text-xs text-gray-400">{plan.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-600">{plan.role} · {plan.group}</div>
                    <div className="text-xs text-gray-400">ordem {plan.sortOrder}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[#07113A]">{formatBRL(plan.priceMonthly)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${plan.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {plan.isActive ? "ativo" : "inativo"}
                      </span>
                      {plan.isLegacy && (
                        <span className="text-[11px] px-2 py-1 rounded-full font-semibold bg-amber-50 text-amber-700">
                          legado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditPlan(plan)}
                        className="px-2.5 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => togglePlanActive(plan)}
                        className={`px-2.5 py-1 text-xs rounded-md border ${plan.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                      >
                        {plan.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedPlans.length === 0 && (
                <tr>
                  <td className="px-3 py-5 text-center text-gray-400" colSpan={5}>Nenhum plano encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function Financeiro() {
  const { data: me } = useGetMe({});
  const role = (me as any)?.role ?? "client";
  if (role === "admin") return <AdminView />;
  return <IndividualView role={role} />;
}
