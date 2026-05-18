import { useState } from "react";
import { useGetMe, useGetAllSubscriptions, useCreateSubscription, useUpdateSubscription, useGetMySubscription } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getGetAllSubscriptionsQueryKey, getGetMySubscriptionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard, CheckCircle, Clock, AlertCircle, XCircle,
  TrendingUp, Users, DollarSign, Crown, Shield, Zap, Store,
  ChevronDown, ChevronUp, Phone, Sparkles, Building2, Landmark, Briefcase, User,
} from "lucide-react";

// ── Tiers de planos (estrutura oficial 2026) ──────────────────────────────────
const PLAN_TIERS = {
  // ── Cliente final ──
  free: {
    id: "free", label: "Free", group: "individual",
    role: "client", priceMonthly: 0, leadLimit: null, enterprise: false,
    color: "#6B7280", bg: "#F3F4F6", icon: User,
    description: "Entrada gratuita ao ecossistema ScoreCasa",
    features: [
      "Simulação básica de financiamento",
      "Score básico ScoreCasa",
      "Até 3 análises de crédito por mês",
      "Visualização limitada do marketplace",
    ],
  },
  individual: {
    id: "individual", label: "Individual", group: "individual",
    role: "client", priceMonthly: 29.90, leadLimit: null, enterprise: false,
    color: "#10A65A", bg: "#F0FDF4", icon: Shield,
    description: "IA completa, Open Finance e marketplace ilimitado",
    features: [
      "IA completa de previsão de aprovação",
      "Monitoramento contínuo do score",
      "Imóveis ilimitados no marketplace",
      "Open Finance integrado",
      "Score avançado ScoreCasa",
      "Notificações em tempo real",
      "Prioridade na análise",
    ],
  },
  plus: {
    id: "plus", label: "Plus", group: "individual",
    role: "client", priceMonthly: 59.90, leadLimit: null, enterprise: false,
    color: "#0D9488", bg: "#F0FDFA", icon: Sparkles,
    description: "Personal financeiro imobiliário — para quem quer realmente aprovar",
    features: [
      "Tudo do plano Individual",
      "Consultoria com IA dedicada",
      "Plano de aprovação personalizado",
      "Acompanhamento da evolução do score",
      "Metas financeiras inteligentes",
      "Suporte prioritário",
      "Recomendações automáticas",
      "Alertas de crédito em tempo real",
    ],
  },
  // ── Corretor / Imobiliária ──
  corretor: {
    id: "corretor", label: "Corretor", group: "corretor",
    role: "broker", priceMonthly: 297.00, leadLimit: null, enterprise: false,
    color: "#0D1B8C", bg: "#EEF2FF", icon: Briefcase,
    description: "Gestão profissional de leads e comparativo entre bancos",
    features: [
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Dashboard de performance",
      "Exportação de relatórios PDF",
      "Histórico de vendas efetivas",
      "Avaliações de clientes ⭐",
    ],
  },
  imobiliaria: {
    id: "imobiliaria", label: "Imobiliária", group: "corretor",
    role: "broker", priceMonthly: 697.00, leadLimit: null, enterprise: false,
    color: "#4338CA", bg: "#EEF2FF", icon: Building2,
    description: "Gestão multi-corretores com painel completo da imobiliária",
    features: [
      "Tudo do plano Corretor",
      "Painel multi-corretores",
      "Gestão de equipe e permissões",
      "Relatórios consolidados da imobiliária",
      "Vitrine de imóveis incluída",
      "Suporte prioritário",
      "Notificações em tempo real",
    ],
  },
  enterprise: {
    id: "enterprise", label: "Enterprise", group: "corretor",
    role: "broker", priceMonthly: 1497.00, leadLimit: null, enterprise: false,
    color: "#6D28D9", bg: "#F5F3FF", icon: Crown,
    description: "Operação em escala com SLA dedicado e integração customizada",
    features: [
      "Tudo do plano Imobiliária",
      "Operações ilimitadas",
      "Gerente de conta dedicado",
      "API e integração personalizada",
      "Onboarding com time ScoreCasa",
      "SLA dedicado",
      "White-label parcial",
    ],
  },
  // ── Correspondente / Banking ──
  correspondente_individual: {
    id: "correspondente_individual", label: "Correspondente Individual", group: "correspondent",
    role: "correspondent", priceMonthly: 297.00, leadLimit: 30, enterprise: false,
    color: "#7C3AED", bg: "#F5F3FF", icon: Landmark,
    description: "Para o correspondente autônomo que opera sozinho",
    features: [
      "Painel individual de processos",
      "Até 30 operações ativas por mês",
      "Esteira CCA padrão: aprovação → contrato",
      "Gestão de documentação bancária",
      "Templates de contrato Caixa",
      "Suporte por e-mail",
    ],
  },
  correspondente_sucesso: {
    id: "correspondente_sucesso", label: "Correspondente de Sucesso", group: "correspondent",
    role: "correspondent", priceMonthly: 997.00, leadLimit: 150, enterprise: false,
    color: "#7C3AED", bg: "#F5F3FF", icon: Crown,
    description: "Para correspondentes que querem escalar com comissão de sucesso",
    features: [
      "Tudo do Correspondente Individual",
      "Até 150 operações ativas por mês",
      "Comissão de sucesso por contrato fechado",
      "Painel multi-analistas (até 5 usuários)",
      "Relatórios de performance e funil",
      "Integração com Caixa Aqui (espelhamento)",
      "Suporte prioritário",
    ],
  },
  bank_connect: {
    id: "bank_connect", label: "Correspondente Connect", group: "correspondent",
    role: "correspondent", priceMonthly: 2497.00, leadLimit: null, enterprise: false,
    color: "#7C3AED", bg: "#F5F3FF", icon: Landmark,
    description: "Integração direta com Caixa, bancos privados e originação completa",
    features: [
      "Tudo do Correspondente de Sucesso",
      "Operações ilimitadas",
      "ScoreCasa Conectado (extensão Chrome)",
      "Espelhamento Caixa Aqui + bancos privados",
      "Esteira completa: aprovação → engenharia → conformidade → contrato",
      "Originação de financiamento (múltiplos bancos)",
      "Painel multi-correspondentes (ilimitado)",
      "Gerente de conta bancária dedicado",
      "Contrato sob medida",
    ],
  },
  // ── Legacy (mantidos para compat com assinaturas antigas) ──
  client:                   { id: "client",                   label: "Individual (legado)",      group: "individual",   role: "client",        priceMonthly: 29.90,  leadLimit: null, enterprise: false, color: "#10A65A", bg: "#F0FDF4", icon: Shield,     description: "", features: [] },
  corretor_50:              { id: "corretor_50",              label: "Corretor 50 (legado)",     group: "corretor",     role: "broker",        priceMonthly: 199.00, leadLimit: 50,   enterprise: false, color: "#0D1B8C", bg: "#EEF2FF", icon: TrendingUp, description: "", features: [] },
  corretor_200:             { id: "corretor_200",             label: "Corretor 200 (legado)",    group: "corretor",     role: "broker",        priceMonthly: 499.00, leadLimit: 200,  enterprise: false, color: "#0D1B8C", bg: "#EEF2FF", icon: TrendingUp, description: "", features: [] },
  corretor_enterprise:      { id: "corretor_enterprise",      label: "Corretor Emp. (legado)",   group: "corretor",     role: "broker",        priceMonthly: 0,      leadLimit: null, enterprise: true,  color: "#0D1B8C", bg: "#EEF2FF", icon: TrendingUp, description: "", features: [] },
  correspondent:            { id: "correspondent",            label: "Correspondente (legado)",  group: "correspondent",role: "correspondent", priceMonthly: 299.00, leadLimit: 50,   enterprise: false, color: "#7C3AED", bg: "#F5F3FF", icon: Crown,      description: "", features: [] },
  correspondent_50:         { id: "correspondent_50",         label: "Corresp. 50 (legado)",     group: "correspondent",role: "correspondent", priceMonthly: 299.00, leadLimit: 50,   enterprise: false, color: "#7C3AED", bg: "#F5F3FF", icon: Crown,      description: "", features: [] },
  correspondent_200:        { id: "correspondent_200",        label: "Corresp. 200 (legado)",    group: "correspondent",role: "correspondent", priceMonthly: 599.00, leadLimit: 200,  enterprise: false, color: "#7C3AED", bg: "#F5F3FF", icon: Crown,      description: "", features: [] },
  correspondent_enterprise: { id: "correspondent_enterprise", label: "Corresp. Emp. (legado)",   group: "correspondent",role: "correspondent", priceMonthly: 0,      leadLimit: null, enterprise: true,  color: "#7C3AED", bg: "#F5F3FF", icon: Crown,      description: "", features: [] },
} as const;

type PlanId = keyof typeof PLAN_TIERS;

const MARKETPLACE_ADDONS = [
  { id: "marketplace_10", label: "Até 10 imóveis", priceMonthly: 99.00, propertyLimit: 10 },
  { id: "marketplace_50", label: "Até 50 imóveis", priceMonthly: 199.00, propertyLimit: 50 },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  trial:     { label: "Período Trial",  color: "#0D1B8C", bg: "#EEF2FF", icon: Clock },
  active:    { label: "Ativo",          color: "#10A65A", bg: "#F0FDF4", icon: CheckCircle },
  overdue:   { label: "Em atraso",      color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
  cancelled: { label: "Cancelado",      color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
  inactive:  { label: "Inativo",        color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
};

function formatBRL(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(d?: string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("pt-BR"); }

// ── Componente de plano individual ────────────────────────────────────────────
function TierCard({ tier, isCurrent }: { tier: (typeof PLAN_TIERS)[PlanId]; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = tier.icon;
  return (
    <div
      className={`relative rounded-2xl border-2 p-5 transition-all ${isCurrent ? "shadow-lg" : "opacity-75"}`}
      style={{ borderColor: isCurrent ? tier.color : "#E5E7EB", background: isCurrent ? tier.bg : "white" }}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-5 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: tier.color }}>
          Seu plano atual
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tier.bg }}>
          <Icon className="w-4 h-4" style={{ color: tier.color }} />
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

      {tier.features.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-semibold mb-2"
          style={{ color: tier.color }}
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? "Menos detalhes" : "Ver recursos"}
        </button>
      )}

      {open && (
        <ul className="space-y-1.5">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: tier.color }} />
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
  const hasAddon = sub?.marketplaceAddon;
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

      {hasAddon ? (
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
            {MARKETPLACE_ADDONS.map((addon) => (
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

function PartnerPlansTable({ group, currentPlanId }: { group: "individual" | "corretor" | "correspondent"; currentPlanId?: string }) {
  const tiers = Object.values(PLAN_TIERS).filter((t) => t.group === group && !LEGACY_PLAN_IDS.has(t.id));
  const color = group === "corretor" ? "#0D1B8C" : group === "correspondent" ? "#7C3AED" : "#10A65A";
  const bgLight = group === "corretor" ? "#EEF2FF" : group === "correspondent" ? "#F5F3FF" : "#F0FDF4";
  const title = group === "corretor" ? "Planos Corretor / Imobiliária" : group === "correspondent" ? "Planos Correspondente" : "Planos Individuais";

  const correspondentNote = group === "correspondent" ? (
    <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: bgLight, color }}>
      <strong>Incluso no Bank Connect:</strong> gestão completa de documentação exigida pelo banco, acompanhamento de todas as etapas do financiamento habitacional (aprovação de crédito, vistoria de engenharia, análise de conformidade e assinatura de contrato) até a entrega das chaves ao cliente.
    </div>
  ) : null;

  const corretorNote = group === "corretor" ? (
    <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{ background: bgLight, color }}>
      <strong>Add-on opcional:</strong> marketplace de imóveis para divulgar seu portfólio — até 10 imóveis por R$ 99/mês ou até 50 imóveis por R$ 199/mês.
    </div>
  ) : null;

  const setupFeeNote = group !== "individual" ? (
    <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed border" style={{ borderColor: color, color }}>
      <strong>Implantação / setup do sistema</strong> a partir de <strong>R$ 590,00</strong> (obrigatório na contratação). Valores ajustados de acordo com o projeto. Consulte nossa equipe comercial.
    </div>
  ) : null;

  return (
    <div>
      <div className="text-sm font-bold mb-3" style={{ color }}>{title}</div>
      <div className="space-y-3">
        {(tiers as (typeof PLAN_TIERS)[PlanId][]).map((tier) => (
          <TierCard key={tier.id} tier={tier} isCurrent={tier.id === currentPlanId} />
        ))}
      </div>
      {correspondentNote}
      {corretorNote}
      {setupFeeNote}
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

  const defaultPlanMap: Record<string, PlanId> = {
    client: "free", broker: "corretor", correspondent: "bank_connect",
  };
  const myDefaultPlan = defaultPlanMap[role] ?? "free";
  const currentPlanId = (sub as any)?.plan as PlanId | undefined;
  const displayPlan = PLAN_TIERS[currentPlanId ?? myDefaultPlan] ?? PLAN_TIERS.individual;
  const Icon = displayPlan.icon;

  function handleActivateTrial() {
    const user = me as any;
    if (!user) return;
    createSub.mutate({
      data: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        plan: myDefaultPlan,
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
                        <div className="text-xs text-gray-400">{displayPlan.label}</div>
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
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: displayPlan.bg }}>
                <Icon className="w-6 h-6" style={{ color: displayPlan.color }} />
              </div>
              <div className="font-semibold text-[#07113A] mb-1">Nenhuma assinatura ativa</div>
              <div className="text-xs text-gray-400 mb-5">Ative seu trial gratuito de 30 dias</div>
              <button
                onClick={handleActivateTrial}
                disabled={createSub.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: displayPlan.color }}
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateSub = useUpdateSubscription();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGroup, setFilterGroup] = useState("");

  const list = (subs as any[]).filter((s) => {
    if (search && !s.userName.toLowerCase().includes(search.toLowerCase()) &&
        !s.userEmail.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterGroup) {
      const tier = PLAN_TIERS[s.plan as PlanId];
      if (tier && tier.group !== filterGroup) return false;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Financeiro — Visão Geral</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestão de assinaturas e pagamentos de todos os perfis</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MRR Total",        value: formatBRL(totalMRR),              icon: DollarSign, color: "#10A65A", bg: "#F0FDF4" },
          { label: "Total assinaturas",value: String((subs as any[]).length),    icon: Users,      color: "#0D1B8C", bg: "#EEF2FF" },
          { label: "Em trial",         value: String(trialCount),               icon: Clock,      color: "#D97706", bg: "#FFFBEB" },
          { label: "Em atraso",        value: String(overdueCount),             icon: AlertCircle,color: "#EF4444", bg: "#FEF2F2" },
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
            const t = PLAN_TIERS[s.plan as PlanId];
            return t?.group === g.key && s.status === "active";
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
                  const tier = PLAN_TIERS[s.plan as PlanId];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#07113A]">{s.userName}</div>
                        <div className="text-xs text-gray-400">{s.userEmail}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {tier ? (
                          <span className="text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: tier.bg, color: tier.color }}>
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
