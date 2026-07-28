import { useState } from "react";
import {
  useGetPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  getGetPlansQueryKey,
  type Plan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Store, Building2, Plus, Edit3, CheckCircle, XCircle,
  Sparkles, Layers, Check
} from "lucide-react";

// ── Definição de Categorias de Planos ─────────────────────────────────────────
export type PlanCategoryKey = "client" | "correspondent" | "broker";

export interface CategoryConfig {
  id: PlanCategoryKey;
  label: string;
  singularLabel: string;
  role: "client" | "correspondent" | "broker";
  group: "individual" | "correspondent" | "corretor";
  color: string;
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: any;
  description: string;
}

export const CATEGORIES: Record<PlanCategoryKey, CategoryConfig> = {
  client: {
    id: "client",
    label: "Clientes",
    singularLabel: "Cliente",
    role: "client",
    group: "individual",
    color: "#10A65A",
    bgLight: "#F0FDF4",
    badgeBg: "#DCFCE7",
    badgeText: "#15803D",
    borderColor: "#bbf7d0",
    icon: User,
    description: "Planos voltados para pessoas físicas, compradores e simuladores de crédito.",
  },
  correspondent: {
    id: "correspondent",
    label: "Correspondentes",
    singularLabel: "Correspondente",
    role: "correspondent",
    group: "correspondent",
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
    borderColor: "#ddd6fe",
    icon: Building2,
    description: "Planos para correspondentes bancários, operação de crédito e gestão documental.",
  },
  broker: {
    id: "broker",
    label: "Corretores",
    singularLabel: "Corretor",
    role: "broker",
    group: "corretor",
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    badgeBg: "#E0E7FF",
    badgeText: "#3730A3",
    borderColor: "#c7d2fe",
    icon: Store,
    description: "Planos para corretores autônomos, imobiliárias e vitrine de imóveis.",
  },
};

const CLIENT_MODULES = [
  "Simulação básica de financiamento",
  "Score básico ScoreCasa",
  "Até 3 análises por mês",
  "Marketplace limitado",
  "IA completa de previsão de aprovação",
  "Monitoramento contínuo do score",
  "Imóveis ilimitados",
  "Open Finance integrado",
  "Tudo do Individual",
  "Consultoria com IA dedicada",
  "Plano de aprovação personalizado",
  "Alertas de crédito em tempo real",
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminPlanos() {
  const { data: plans = [], isLoading } = useGetPlans(
    {
      includeInactive: "true",
      includeLegacy: "true",
    } as any,
    {
      query: {
        queryKey: getGetPlansQueryKey({ includeInactive: "true", includeLegacy: "true" }),
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
      },
    }
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | PlanCategoryKey>("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState({
    id: "",
    label: "",
    category: "client" as PlanCategoryKey,
    priceMonthly: "0",
    priceYearly: "0",
    highlight: false,
    leadLimit: "",
    userLimit: "",
    enterprise: false,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    description: "",
    featuresText: "",
    sortOrder: "0",
    isActive: true,
  });

  const planList = plans as Plan[];

  // Helper para identificar a categoria de um plano
  const getPlanCategory = (plan: Plan): PlanCategoryKey => {
    if (plan.role === "correspondent" || plan.group === "correspondent") return "correspondent";
    if (plan.role === "broker" || plan.group === "corretor") return "broker";
    return "client";
  };

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
    queryClient.invalidateQueries({ queryKey: getGetPlansQueryKey({ includeInactive: "true", includeLegacy: "true" }) });
    queryClient.resetQueries({ queryKey: ["/api/plans"] });
    queryClient.refetchQueries({ queryKey: ["/api/plans"] });
  };

  const handleCategoryChangeInForm = (catKey: PlanCategoryKey) => {
    const config = CATEGORIES[catKey];
    setPlanForm((prev) => ({
      ...prev,
      category: catKey,
      color: prev.color === "#10A65A" || prev.color === "#7C3AED" || prev.color === "#0D1B8C" ? config.color : prev.color,
      bgLight: prev.bgLight === "#F0FDF4" || prev.bgLight === "#F5F3FF" || prev.bgLight === "#EEF2FF" ? config.bgLight : prev.bgLight,
    }));
  };

  const resetPlanForm = (defaultCat: PlanCategoryKey = "client") => {
    setFormMode("create");
    setEditingPlanId(null);
    const catConfig = CATEGORIES[defaultCat];
    setPlanForm({
      id: "",
      label: "",
      category: defaultCat,
      priceMonthly: "0",
      priceYearly: "0",
      highlight: false,
      leadLimit: "",
      userLimit: "",
      enterprise: false,
      color: catConfig.color,
      bgLight: catConfig.bgLight,
      description: "",
      featuresText: "",
      sortOrder: "0",
      isActive: true,
    });
  };

  const openCreateModal = (category?: PlanCategoryKey) => {
    resetPlanForm(category ?? (activeCategoryTab === "all" ? "client" : activeCategoryTab));
    setShowFormModal(true);
  };

  const startEditPlan = (plan: Plan) => {
    const cat = getPlanCategory(plan);
    setFormMode("edit");
    setEditingPlanId(plan.id);
    setPlanForm({
      id: plan.id,
      label: plan.label,
      category: cat,
      priceMonthly: String(plan.priceMonthly),
      priceYearly: String((plan as any).priceYearly ?? 0),
      highlight: !!(plan as any).highlight,
      leadLimit: plan.leadLimit == null ? "" : String(plan.leadLimit),
      userLimit: (plan as any).userLimit == null ? "" : String((plan as any).userLimit),
      enterprise: !!plan.enterprise,
      color: plan.color ?? CATEGORIES[cat].color,
      bgLight: plan.bgLight ?? CATEGORIES[cat].bgLight,
      description: plan.description ?? "",
      featuresText: (plan.features ?? []).join("\n"),
      sortOrder: String(plan.sortOrder ?? 0),
      isActive: !!plan.isActive,
    });
    setShowFormModal(true);
  };

  const submitPlan = () => {
    const categoryConfig = CATEGORIES[planForm.category];
    const featuresArray = planForm.featuresText
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);

    const userLimitValue = (planForm.userLimit === "" || planForm.userLimit == null || isNaN(Number(planForm.userLimit)))
      ? null
      : Math.floor(Number(planForm.userLimit));

    const leadLimitValue = (planForm.leadLimit === "" || planForm.leadLimit == null || isNaN(Number(planForm.leadLimit)))
      ? null
      : Math.floor(Number(planForm.leadLimit));

    const payload = {
      label: planForm.label.trim(),
      role: categoryConfig.role,
      group: categoryConfig.group,
      priceMonthly: Number(planForm.priceMonthly),
      priceYearly: Number(planForm.priceYearly),
      highlight: planForm.highlight,
      leadLimit: leadLimitValue,
      userLimit: userLimitValue,
      enterprise: planForm.enterprise,
      color: planForm.color,
      bgLight: planForm.bgLight,
      description: planForm.description.trim(),
      features: featuresArray,
      sortOrder: Number(planForm.sortOrder),
      isActive: planForm.isActive,
    };

    if (!planForm.label.trim()) {
      toast({ title: "Nome do plano é obrigatório", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(payload.priceMonthly) || payload.priceMonthly < 0) {
      toast({ title: "Preço mensal inválido", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(payload.priceYearly) || payload.priceYearly < 0) {
      toast({ title: "Preço anual inválido", variant: "destructive" });
      return;
    }

    if (formMode === "create") {
      const id = planForm.id.trim().toLowerCase();
      if (!/^[a-z0-9_]+$/.test(id) || id.length < 2) {
        toast({ title: "ID deve ser snake_case com ao menos 2 caracteres (ex: cliente_pro)", variant: "destructive" });
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
          setShowFormModal(false);
          toast({ title: "Plano criado com sucesso!" });
        },
        onError: (err: any) => {
          const msg = err?.message ?? "Não foi possível criar o plano";
          toast({ title: msg, variant: "destructive" });
        },
      });
      return;
    }

    if (!editingPlanId) return;
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${BASE}/api/plans/${editingPlanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? "Erro ao atualizar plano");
        }
        invalidatePlans();
        setShowFormModal(false);
        toast({ title: "Plano atualizado com sucesso!" });
      })
      .catch((err) => {
        toast({ title: err.message ?? "Não foi possível atualizar o plano", variant: "destructive" });
      });
  };

  const togglePlanActive = (plan: Plan) => {
    if (plan.isActive) {
      if (!confirm(`Desativar o plano "${plan.label}"?`)) return;
      deletePlan.mutate({ id: plan.id }, {
        onSuccess: () => {
          invalidatePlans();
          toast({ title: "Plano desativado" });
        },
        onError: (err: any) => {
          const msg = err?.message ?? "Erro ao desativar plano";
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
        const msg = err?.message ?? "Erro ao ativar plano";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  // Filtragem de planos
  const filteredPlans = planList.filter((plan) => {
    if (activeCategoryTab === "all") return true;
    return getPlanCategory(plan) === activeCategoryTab;
  }).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  // Estatísticas de planos por categoria
  const categoryCounts = {
    client: planList.filter((p) => getPlanCategory(p) === "client").length,
    correspondent: planList.filter((p) => getPlanCategory(p) === "correspondent").length,
    broker: planList.filter((p) => getPlanCategory(p) === "broker").length,
  };

  const isMutating = createPlan.isPending || updatePlan.isPending || deletePlan.isPending;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#0D1B8C]" />
            <h1 className="text-2xl font-bold text-[#07113A]">Gestão de Planos por Categoria</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure e administre os pacotes oferecidos para Clientes, Correspondentes e Corretores.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-[#0D1B8C] hover:bg-[#0B1770] shadow-sm transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Plano
        </button>
      </div>

      {/* Cards resumo das categorias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(CATEGORIES) as PlanCategoryKey[]).map((catKey) => {
          const cat = CATEGORIES[catKey];
          const Icon = cat.icon;
          const count = categoryCounts[catKey];
          const isActiveTab = activeCategoryTab === catKey;

          return (
            <div
              key={catKey}
              onClick={() => setActiveCategoryTab(catKey)}
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-all bg-white relative overflow-hidden group ${
                isActiveTab ? "shadow-md ring-2 ring-[#0D1B8C]/20" : "hover:border-gray-300"
              }`}
              style={{ borderColor: isActiveTab ? cat.color : "#F3F4F6" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: cat.bgLight }}>
                  <Icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: cat.badgeBg, color: cat.badgeText }}
                >
                  {count} {count === 1 ? "plano" : "planos"}
                </span>
              </div>
              <h3 className="font-bold text-base text-[#07113A]">{cat.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{cat.description}</p>
            </div>
          );
        })}
      </div>

      {/* Abas de Navegação por Categoria */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveCategoryTab("all")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeCategoryTab === "all"
              ? "bg-[#07113A] text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Todas as Categorias ({planList.length})
        </button>

        {(Object.keys(CATEGORIES) as PlanCategoryKey[]).map((catKey) => {
          const cat = CATEGORIES[catKey];
          const Icon = cat.icon;
          const isActive = activeCategoryTab === catKey;

          return (
            <button
              key={catKey}
              onClick={() => setActiveCategoryTab(catKey)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
                isActive
                  ? "text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
              }`}
              style={isActive ? { background: cat.color, borderColor: cat.color } : {}}
            >
              <Icon className="w-4 h-4" />
              {cat.label} ({categoryCounts[catKey]})
            </button>
          );
        })}
      </div>

      {/* Lista de Planos por Categoria */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#0D1B8C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#07113A]">Nenhum plano encontrado</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Não há planos cadastrados nesta categoria. Clique no botão abaixo para adicionar.
          </p>
          <button
            onClick={() => openCreateModal(activeCategoryTab === "all" ? "client" : activeCategoryTab)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0D1B8C]"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Plano
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const catKey = getPlanCategory(plan);
            const cat = CATEGORIES[catKey];
            const CatIcon = cat.icon;
            const features = plan.features ?? [];

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-5 flex flex-col justify-between transition-all relative ${
                  plan.isActive ? "shadow-sm hover:shadow-md" : "opacity-60 bg-gray-50/70"
                }`}
                style={{ borderColor: plan.isActive ? (plan.color ?? cat.color) : "#E5E7EB" }}
              >
                {/* Header do Card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: plan.bgLight ?? cat.bgLight }}
                      >
                        <CatIcon className="w-5 h-5" style={{ color: plan.color ?? cat.color }} />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-[#07113A] leading-tight">{plan.label}</h4>
                        <span className="text-[11px] font-medium text-gray-400 font-mono">{plan.id}</span>
                      </div>
                    </div>

                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ background: cat.badgeBg, color: cat.badgeText }}
                    >
                      {cat.singularLabel}
                    </span>
                  </div>

                  {/* Badges de Status */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        plan.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {plan.isActive ? "Ativo" : "Inativo"}
                    </span>
                    {(plan as any).highlight && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Destaque
                      </span>
                    )}
                    {plan.enterprise && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800">
                        Enterprise
                      </span>
                    )}
                    {plan.isLegacy && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                        Legado
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      Ordem: {plan.sortOrder}
                    </span>
                  </div>

                  {/* Preços */}
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    {plan.enterprise ? (
                      <div className="text-lg font-bold text-[#07113A]">Sob Consulta</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black" style={{ color: plan.color ?? cat.color }}>
                          {formatBRL(plan.priceMonthly)}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">/mês</span>
                      </div>
                    )}
                    {(plan as any).priceYearly > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        ou {formatBRL((plan as any).priceYearly)} / ano
                      </div>
                    )}
                    {plan.leadLimit != null && (
                      <div className="text-xs font-semibold text-gray-600 mt-1">
                        Leads: {plan.leadLimit} /mês
                      </div>
                    )}
                    {(plan as any).userLimit != null && (
                      <div className="text-xs font-semibold text-gray-600 mt-0.5">
                        Equipe: até {(plan as any).userLimit} usuário(s)
                      </div>
                    )}
                  </div>

                  {/* Descrição Comercial */}
                  {plan.description && (
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      {plan.description}
                    </p>
                  )}

                  {/* Features / Módulos */}
                  {features.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Recursos inclusos</div>
                      <ul className="space-y-1">
                        {features.slice(0, 5).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: plan.color ?? cat.color }} />
                            <span className="line-clamp-1">{f}</span>
                          </li>
                        ))}
                        {features.length > 5 && (
                          <li className="text-[11px] font-semibold text-gray-400 pt-0.5">
                            + {features.length - 5} outros recursos
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => startEditPlan(plan)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar
                  </button>

                  <button
                    onClick={() => togglePlanActive(plan)}
                    className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      plan.isActive
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {plan.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {plan.isActive ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Formulário de Criação e Edição */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#07113A]">
                  {formMode === "create" ? "Criar Novo Plano" : `Editar Plano: ${planForm.label}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Preencha os detalhes e a categoria comercial do plano.
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Seleção de Categoria */}
            <div>
              <label className="text-xs font-bold text-[#07113A] uppercase tracking-wider block mb-2">
                Categoria do Plano *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(CATEGORIES) as PlanCategoryKey[]).map((catKey) => {
                  const cat = CATEGORIES[catKey];
                  const Icon = cat.icon;
                  const isSelected = planForm.category === catKey;

                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => handleCategoryChangeInForm(catKey)}
                      className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all text-center ${
                        isSelected
                          ? "border-[#0D1B8C] bg-[#EEF2FF]"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1" style={{ color: cat.color }} />
                      <span className="text-xs font-bold text-[#07113A]">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dados Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">ID Único (slug) *</label>
                <input
                  value={planForm.id}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, id: e.target.value.toLowerCase() }))}
                  disabled={formMode === "edit"}
                  placeholder="ex: cliente_pro"
                  className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Nome Exibido do Plano *</label>
                <input
                  value={planForm.label}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="ex: SCORECASA Individual"
                  className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm"
                />
              </div>
            </div>

            {/* Preços e Ordem */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Preço Mensal (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, priceMonthly: e.target.value }))}
                  className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Preço Anual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.priceYearly}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, priceYearly: e.target.value }))}
                  className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Ordem de Exibição</label>
                <input
                  type="number"
                  step="1"
                  value={planForm.sortOrder}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm"
                />
              </div>
            </div>

            {/* Limites para Corretores e Correspondentes */}
            {planForm.category !== "client" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-100">
                <div>
                  <label className="text-xs font-medium text-gray-600">Limite de Leads/Mês</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={planForm.leadLimit}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, leadLimit: e.target.value }))}
                    placeholder="Vazio = ilimitado"
                    className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Quantidade de Usuários (Equipe)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={planForm.userLimit}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, userLimit: e.target.value }))}
                    placeholder="Vazio = ilimitado"
                    className="w-full mt-1 px-3.5 h-10 rounded-xl border border-input text-sm bg-white"
                  />
                </div>
              </div>
            )}

            {/* Cores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Cor Principal (#RRGGBB)</label>
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="color"
                    value={planForm.color}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-input p-0.5"
                  />
                  <input
                    value={planForm.color}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-full px-3 h-10 rounded-xl border border-input text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Cor Fundo Claro (#RRGGBB)</label>
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="color"
                    value={planForm.bgLight}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, bgLight: e.target.value }))}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-input p-0.5"
                  />
                  <input
                    value={planForm.bgLight}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, bgLight: e.target.value }))}
                    className="w-full px-3 h-10 rounded-xl border border-input text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Checkboxes de Atributos */}
            <div className="flex items-center gap-6 py-2 border-y border-gray-100">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-[#0D1B8C] focus:ring-[#0D1B8C]"
                />
                Plano Ativo
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.highlight}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, highlight: e.target.checked }))}
                  className="rounded border-gray-300 text-[#0D1B8C] focus:ring-[#0D1B8C]"
                />
                Destaque (Recomendado)
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.enterprise}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, enterprise: e.target.checked }))}
                  className="rounded border-gray-300 text-[#0D1B8C] focus:ring-[#0D1B8C]"
                />
                Sob Consulta (Enterprise)
              </label>
            </div>

            {/* Descrição Comercial */}
            <div>
              <label className="text-xs font-medium text-gray-600">Descrição Comercial</label>
              <textarea
                value={planForm.description}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full mt-1 px-3.5 py-2 rounded-xl border border-input text-sm"
                placeholder="Resumo comercial das vantagens do plano"
              />
            </div>

            {/* Features e Módulos */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {planForm.category === "client" ? "Módulos de Cliente (Seleção)" : "Recursos Inclusos (1 por linha)"}
              </label>

              {planForm.category === "client" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto border border-input rounded-xl p-3 bg-gray-50/50">
                  {CLIENT_MODULES.map((module) => {
                    const currentFeatures = planForm.featuresText.split("\n").map((f) => f.trim()).filter(Boolean);
                    const isChecked = currentFeatures.includes(module);
                    return (
                      <label key={module} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextFeatures;
                            if (e.target.checked) {
                              nextFeatures = [...currentFeatures, module];
                            } else {
                              nextFeatures = currentFeatures.filter((f) => f !== module);
                            }
                            setPlanForm((prev) => ({ ...prev, featuresText: nextFeatures.join("\n") }));
                          }}
                          className="rounded border-gray-300 text-[#10A65A]"
                        />
                        {module}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, featuresText: e.target.value }))}
                  rows={4}
                  className="w-full px-3.5 py-2 rounded-xl border border-input text-sm"
                  placeholder="Ex.:&#10;Gestão completa de documentação&#10;Acompanhamento até a entrega das chaves"
                />
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={submitPlan}
                disabled={isMutating}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl text-white bg-[#0D1B8C] hover:bg-[#0B1770] disabled:opacity-60 shadow-sm"
              >
                {isMutating ? "Salvando..." : formMode === "create" ? "Criar Plano" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPlanos;
