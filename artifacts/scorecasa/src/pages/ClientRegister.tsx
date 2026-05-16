import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Building2, User, Briefcase,
  Landmark, ShieldCheck, Check, Lock, Sparkles, Search,
} from "lucide-react";
import { ScoreCasaLogo, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@workspace/api-client-react";

// ── Profiles ────────────────────────────────────────────────────────────────
type ProfileId = "client" | "broker" | "correspondent" | "admin";

const PROFILES: {
  id: ProfileId;
  label: string;
  short: string;
  description: string;
  icon: typeof User;
  color: string;
  bgLight: string;
  available: boolean;
}[] = [
  {
    id: "client",
    label: "Sou cliente",
    short: "Individual",
    description: "Quero analisar minhas chances de aprovação de crédito imobiliário.",
    icon: User,
    color: "#10A65A",
    bgLight: "#F0FDF4",
    available: true,
  },
  {
    id: "broker",
    label: "Sou corretor",
    short: "Corretor de imóveis",
    description: "Quero gerenciar leads, comparar bancos e acompanhar aprovações.",
    icon: Briefcase,
    color: "#0D1B8C",
    bgLight: "#EEF2FF",
    available: true,
  },
  {
    id: "correspondent",
    label: "Sou correspondente bancário",
    short: "Correspondente",
    description: "Quero gerir documentação e acompanhamento bancário das operações.",
    icon: Landmark,
    color: "#7C3AED",
    bgLight: "#F5F3FF",
    available: true,
  },
  {
    id: "admin",
    label: "Sou administrador",
    short: "Administrador",
    description: "Acesso restrito — disponível somente sob convite ou via equipe ScoreCasa.",
    icon: ShieldCheck,
    color: "#64748B",
    bgLight: "#F1F5F9",
    available: false,
  },
];

// ── Plans (mirror of PLAN_TIERS in lib/db, kept in sync for UI) ─────────────
type PlanInfo = {
  id: string;
  label: string;
  role: ProfileId;
  priceMonthly: number;
  description: string;
  features: string[];
  enterprise: boolean;
  highlight?: boolean;
};

const PLANS: PlanInfo[] = [
  // ── Cliente ──
  {
    id: "free",
    label: "Free",
    role: "client",
    priceMonthly: 0,
    description: "Entrada gratuita ao ecossistema ScoreCasa.",
    features: [
      "Simulação básica de financiamento",
      "Score básico ScoreCasa",
      "Até 3 análises por mês",
      "Marketplace limitado",
    ],
    enterprise: false,
  },
  {
    id: "individual",
    label: "Individual",
    role: "client",
    priceMonthly: 29.9,
    description: "IA completa, Open Finance e marketplace ilimitado.",
    features: [
      "IA completa de previsão de aprovação",
      "Monitoramento contínuo do score",
      "Imóveis ilimitados",
      "Open Finance integrado",
    ],
    enterprise: false,
    highlight: true,
  },
  {
    id: "plus",
    label: "Plus",
    role: "client",
    priceMonthly: 59.9,
    description: "Personal financeiro imobiliário — para quem quer realmente aprovar.",
    features: [
      "Tudo do Individual",
      "Consultoria com IA dedicada",
      "Plano de aprovação personalizado",
      "Alertas de crédito em tempo real",
    ],
    enterprise: false,
  },
  // ── Corretor / Imobiliária ──
  {
    id: "corretor",
    label: "Corretor",
    role: "broker",
    priceMonthly: 297,
    description: "Gestão profissional de leads e comparativo entre bancos.",
    features: [
      "Análise de crédito avançada",
      "Comparativo de 8 bancos",
      "Ranking de aprovações",
      "Exportação de relatórios PDF",
    ],
    enterprise: false,
    highlight: true,
  },
  {
    id: "imobiliaria",
    label: "Imobiliária",
    role: "broker",
    priceMonthly: 697,
    description: "Painel multi-corretores e gestão de equipe completa.",
    features: [
      "Tudo do Corretor",
      "Painel multi-corretores",
      "Vitrine de imóveis incluída",
      "Suporte prioritário",
    ],
    enterprise: false,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    role: "broker",
    priceMonthly: 1497,
    description: "Operação em escala com SLA dedicado.",
    features: [
      "Tudo da Imobiliária",
      "Gerente de conta dedicado",
      "API e integração personalizada",
      "SLA dedicado",
    ],
    enterprise: false,
  },
  // ── Correspondente ──
  {
    id: "bank_connect",
    label: "Bank Connect",
    role: "correspondent",
    priceMonthly: 2497,
    description: "Integração direta com Caixa, bancos privados e originação completa.",
    features: [
      "ScoreCasa Conectado (extensão Chrome)",
      "Espelhamento Caixa Aqui + bancos privados",
      "Esteira completa: aprovação → contrato",
      "Originação de financiamento",
      "Painel multi-correspondentes",
      "Gerente de conta bancária",
    ],
    enterprise: false,
    highlight: true,
  },
];

// ── Masks ───────────────────────────────────────────────────────────────────
function maskCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCNPJ(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function formatCurrency(value: string) {
  const n = value.replace(/\D/g, "");
  if (!n) return "";
  return (parseInt(n, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10) / 100;
  return Number.isFinite(n) ? n : 0;
}
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ClientRegister() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    cnpj: "",
    creci: "",
    email: "",
    phone: "",
    password: "",
    income: "",
    propertyValue: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (key === "cpf") val = maskCPF(val);
    else if (key === "cnpj") val = maskCNPJ(val);
    else if (key === "phone") val = maskPhone(val);
    else if (key === "birthDate") {
      const d = val.replace(/\D/g, "").slice(0, 8);
      if (d.length <= 2) val = d;
      else if (d.length <= 4) val = `${d.slice(0, 2)}/${d.slice(2)}`;
      else val = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    }
    else if (key === "income" || key === "propertyValue") val = formatCurrency(val);
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const lookupCpf = async () => {
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setErrors((e) => ({ ...e, cpf: "Informe um CPF válido (11 dígitos)" }));
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.birthDate)) {
      setErrors((e) => ({ ...e, birthDate: "Informe a data de nascimento (DD/MM/AAAA)" }));
      return;
    }
    setLookupLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const resp = await fetch(`${BASE}/api/cpf/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpfDigits, birthDate: form.birthDate }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.found) {
        toast({
          title: "Não foi possível encontrar o cadastro",
          description: (data as { error?: string }).error ?? "Verifique CPF e data de nascimento.",
        });
        return;
      }
      setForm((f) => ({ ...f, name: data.name as string }));
      setErrors((e) => ({ ...e, name: "" }));
      toast({
        title: "Dados encontrados",
        description: `Nome preenchido automaticamente para ${data.name}.`,
      });
    } catch {
      toast({ title: "Erro na consulta", description: "Tente novamente em instantes." });
    } finally {
      setLookupLoading(false);
    }
  };

  const profilePlans = profile ? PLANS.filter((p) => p.role === profile) : [];

  // ── Step 1: choose profile ────────────────────────────────────────────────
  const selectProfile = (p: ProfileId) => {
    if (p === "admin") {
      toast({
        title: "Acesso administrador",
        description: "O acesso de administrador é criado sob convite. Fale com a equipe ScoreCasa.",
      });
      return;
    }
    setProfile(p);
    // Default plan suggestion
    const defaults: Record<Exclude<ProfileId, "admin">, string> = {
      client: "free",
      broker: "corretor",
      correspondent: "bank_connect",
    };
    setPlanId(defaults[p]);
    setStep(2);
  };

  // ── Step 3: validation ────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Nome obrigatório (mínimo 2 caracteres)";
    if (!form.email.includes("@")) errs.email = "Email inválido";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errs.phone = "Telefone inválido";
    if (form.password.length < 6) errs.password = "Senha mínima de 6 caracteres";

    if (profile === "client") {
      const cpfDigits = form.cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) errs.cpf = "CPF inválido";
      if (parseCurrency(form.income) <= 0) errs.income = "Informe sua renda mensal";
      if (parseCurrency(form.propertyValue) <= 0) errs.propertyValue = "Informe o valor do imóvel";
    } else {
      // Broker / Correspondent: CPF required for natural-person registration
      const cpfDigits = form.cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) errs.cpf = "CPF inválido";
    }

    if (!acceptedTerms) errs.terms = "Você precisa aceitar os Termos de Uso e a Política de Privacidade";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const labels: Record<string, string> = {
        name: "Nome completo",
        cpf: "CPF",
        cnpj: "CNPJ",
        creci: "CRECI",
        email: "Email",
        phone: "Telefone",
        password: "Senha",
        income: "Renda mensal",
        propertyValue: "Valor do imóvel",
        terms: "Aceite dos Termos de Uso",
      };
      const missing = Object.keys(errs).map((k) => labels[k] ?? k).join(", ");
      toast({
        title: "Preencha os campos obrigatórios",
        description: missing,
      });
      const firstKey = Object.keys(errs)[0];
      const firstEl = document.querySelector(`[data-testid="input-${firstKey === "propertyValue" ? "property" : firstKey}"]`) as HTMLElement | null;
      if (firstEl) {
        firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
        firstEl.focus?.();
      }
      return;
    }
    if (!profile || !planId) {
      setErrors({ form: "Selecione perfil e plano antes de continuar." });
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const body: Record<string, unknown> = {
        role: profile,
        plan: planId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
        cpf: form.cpf.replace(/\D/g, "") || undefined,
      };
      if (form.cnpj) body.cnpj = form.cnpj.replace(/\D/g, "");
      if (form.creci) body.creci = form.creci.trim();
      if (profile === "client") {
        body.income = parseCurrency(form.income);
        body.propertyValue = parseCurrency(form.propertyValue);
      }

      const resp = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (resp.status === 409) {
        setErrors({ email: "Este email já está cadastrado" });
        return;
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Erro ao cadastrar.";
        toast({ title: "Não foi possível criar a conta", description: msg });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({
        title: "Conta criada com sucesso!",
        description: "Você ganhou 14 dias de avaliação gratuita.",
      });
      setLocation(profile === "client" ? "/portal" : "/dashboard");
    } catch {
      toast({ title: "Erro ao criar conta", description: "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === planId);
  const selectedProfile = PROFILES.find((p) => p.id === profile);

  return (
    <div className="min-h-screen flex" style={{ background: "#07113A" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-10">
        <ScoreCasaLogo variant="light" size="md" />

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Crie sua conta<br />
            <span style={{ color: "#10A65A" }}>do seu jeito.</span>
          </h1>
          <p className="text-blue-200 text-base leading-relaxed mb-8">
            Escolha seu perfil, selecione o plano e comece a usar a inteligência da ScoreCasa em minutos.
          </p>

          {/* Steps indicator */}
          <div className="space-y-3">
            {[
              { n: 1, label: "Escolha seu perfil" },
              { n: 2, label: "Selecione o plano" },
              { n: 3, label: "Crie sua conta" },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3 text-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{
                    background: step >= (s.n as 1 | 2 | 3) ? "#10A65A" : "rgba(255,255,255,0.1)",
                    color: step >= (s.n as 1 | 2 | 3) ? "white" : "#94A3B8",
                  }}
                >
                  {step > (s.n as 1 | 2 | 3) ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className={step >= (s.n as 1 | 2 | 3) ? "text-white font-medium" : "text-blue-300"}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-blue-300 text-xs">
          <Building2 className="w-4 h-4" />
          Inteligência de Crédito Imobiliário
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto" style={{ background: "#F4F6FB" }}>
        <div className="w-full max-w-2xl py-6">
          <div className="lg:hidden flex justify-center mb-6">
            <ScoreCasaWordmark variant="dark" size="md" />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Step header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#10A65A" }}>
                  Passo {step} de 3
                </p>
                <h2 className="text-2xl font-bold" style={{ color: "#07113A" }}>
                  {step === 1 && "Qual o seu perfil?"}
                  {step === 2 && "Escolha seu plano"}
                  {step === 3 && "Quase lá! Seus dados"}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {step === 1 && "Selecione como deseja usar a ScoreCasa."}
                  {step === 2 && "Você terá 14 dias de avaliação gratuita em qualquer plano."}
                  {step === 3 && "Preencha os dados para criar sua conta."}
                </p>
              </div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </button>
              )}
            </div>

            {/* ── Step 1: profile ──────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-3">
                {PROFILES.map((p) => {
                  const Icon = p.icon;
                  const disabled = !p.available;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProfile(p.id)}
                      disabled={false}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        disabled
                          ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                          : "border-gray-200 hover:border-current hover:shadow-md"
                      }`}
                      style={{ color: disabled ? "#94A3B8" : p.color }}
                      data-testid={`button-profile-${p.id}`}
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: disabled ? "#E2E8F0" : p.bgLight }}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base" style={{ color: disabled ? "#64748B" : "#07113A" }}>
                            {p.label}
                          </span>
                          {disabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">
                              <Lock className="w-2.5 h-2.5" /> Sob convite
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.description}</p>
                      </div>
                      {!disabled && <ArrowRight className="w-5 h-5 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Step 2: plan ─────────────────────────────────────────── */}
            {step === 2 && selectedProfile && (
              <div className="space-y-3">
                {profilePlans.map((p) => {
                  const isSelected = planId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all relative ${
                        isSelected ? "shadow-md" : "border-gray-200 hover:border-gray-300"
                      }`}
                      style={{
                        borderColor: isSelected ? selectedProfile.color : undefined,
                        background: isSelected ? selectedProfile.bgLight : "white",
                      }}
                      data-testid={`button-plan-${p.id}`}
                    >
                      {p.highlight && (
                        <span
                          className="absolute -top-2 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-1"
                          style={{ background: "#10A65A" }}
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Recomendado
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-base" style={{ color: "#07113A" }}>
                            {p.label}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {p.enterprise ? (
                            <div className="text-sm font-bold" style={{ color: selectedProfile.color }}>
                              Sob consulta
                            </div>
                          ) : (
                            <>
                              <div className="text-xl font-bold" style={{ color: selectedProfile.color }}>
                                {brl(p.priceMonthly)}
                              </div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide">por mês</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                            <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: selectedProfile.color }} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!planId}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ background: selectedProfile.color }}
                  data-testid="button-next-plan"
                >
                  Continuar com {selectedPlan?.label} <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[11px] text-gray-500">
                  Sem compromisso · 14 dias grátis · Cancele quando quiser
                </p>
              </div>
            )}

            {/* ── Step 3: data ─────────────────────────────────────────── */}
            {step === 3 && selectedProfile && selectedPlan && (
              <>
                {/* Summary banner */}
                <div
                  className="rounded-lg border p-3 mb-5 flex items-center gap-3"
                  style={{
                    background: selectedProfile.bgLight,
                    borderColor: `${selectedProfile.color}33`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedProfile.color }}
                  >
                    <selectedProfile.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "#07113A" }}>
                      {selectedProfile.short} · {selectedPlan.label}
                    </div>
                    <div className="text-[11px] text-gray-600">
                      {selectedPlan.enterprise
                        ? "Plano sob consulta — equipe comercial entrará em contato."
                        : `${brl(selectedPlan.priceMonthly)}/mês após o trial de 14 dias`}
                    </div>
                    {(profile === "broker" || profile === "correspondent") && (
                      <div className="text-[10px] mt-1 font-medium" style={{ color: selectedProfile.color }}>
                        + Implantação a partir de R$ 590,00 (obrigatório na contratação). Valor ajustado conforme o projeto — consulte nossa equipe comercial.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-[11px] font-semibold underline"
                    style={{ color: selectedProfile.color }}
                  >
                    Trocar
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="CPF" error={errors.cpf}>
                      <input
                        type="text"
                        value={form.cpf}
                        onChange={set("cpf")}
                        placeholder="000.000.000-00"
                        className={inputCls(!!errors.cpf)}
                        data-testid="input-cpf"
                      />
                    </FieldRow>
                    <FieldRow label="Data de nascimento" error={errors.birthDate}>
                      <input
                        type="text"
                        value={form.birthDate}
                        onChange={set("birthDate")}
                        placeholder="DD/MM/AAAA"
                        inputMode="numeric"
                        className={inputCls(!!errors.birthDate)}
                        data-testid="input-birth-date"
                      />
                    </FieldRow>
                  </div>

                  <button
                    type="button"
                    onClick={lookupCpf}
                    disabled={lookupLoading}
                    className="w-full h-11 rounded-xl text-sm font-semibold border-2 transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ borderColor: "#10A65A", color: "#10A65A", background: "rgba(16, 166, 90, 0.06)" }}
                    data-testid="button-lookup-cpf"
                  >
                    {lookupLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Consultando Receita...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Buscar nome na Receita Federal
                      </>
                    )}
                  </button>

                  <FieldRow label="Nome completo" error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set("name")}
                      placeholder={profile === "client" ? "Preenchido pela Receita ao buscar" : "Seu nome"}
                      className={inputCls(!!errors.name)}
                      data-testid="input-name"
                    />
                  </FieldRow>

                  <FieldRow label="Telefone" error={errors.phone}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="(11) 99999-9999"
                      className={inputCls(!!errors.phone)}
                      data-testid="input-phone"
                    />
                  </FieldRow>

                  {/* Optional CNPJ/CRECI for pro profiles */}
                  {profile !== "client" && (
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow label="CNPJ (opcional)">
                        <input
                          type="text"
                          value={form.cnpj}
                          onChange={set("cnpj")}
                          placeholder="00.000.000/0000-00"
                          className={inputCls(false)}
                          data-testid="input-cnpj"
                        />
                      </FieldRow>
                      {profile === "broker" && (
                        <FieldRow label="CRECI (opcional)">
                          <input
                            type="text"
                            value={form.creci}
                            onChange={set("creci")}
                            placeholder="Ex: SP-123456"
                            className={inputCls(false)}
                            data-testid="input-creci"
                          />
                        </FieldRow>
                      )}
                    </div>
                  )}

                  <FieldRow label="Email" error={errors.email}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="seu@email.com"
                      className={inputCls(!!errors.email)}
                      data-testid="input-email"
                    />
                  </FieldRow>

                  <FieldRow label="Senha" error={errors.password}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={set("password")}
                        placeholder="Mínimo 6 caracteres"
                        className={inputCls(!!errors.password)}
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FieldRow>

                  {/* Client-only fields */}
                  {profile === "client" && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Dados financeiros
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldRow label="Renda mensal *" error={errors.income}>
                          <input
                            type="text"
                            value={form.income}
                            onChange={set("income")}
                            placeholder="R$ 0,00"
                            className={inputCls(!!errors.income)}
                            data-testid="input-income"
                          />
                        </FieldRow>
                        <FieldRow label="Valor do imóvel *" error={errors.propertyValue}>
                          <input
                            type="text"
                            value={form.propertyValue}
                            onChange={set("propertyValue")}
                            placeholder="R$ 0,00"
                            className={inputCls(!!errors.propertyValue)}
                            data-testid="input-property"
                          />
                        </FieldRow>
                      </div>
                    </div>
                  )}

                  {/* Terms acceptance */}
                  <div className="pt-2 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          setErrors((prev) => ({ ...prev, terms: "" }));
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#0D1B8C] cursor-pointer"
                        data-testid="checkbox-terms"
                      />
                      <span className="text-xs text-gray-600 leading-relaxed">
                        Li e aceito os{" "}
                        <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#0D1B8C" }}>
                          Termos de Uso
                        </a>{" "}
                        e a{" "}
                        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "#0D1B8C" }}>
                          Política de Privacidade
                        </a>{" "}
                        da ScoreCasa, incluindo o tratamento dos meus dados pessoais conforme a LGPD.
                      </span>
                    </label>
                    {errors.terms && <p className="text-red-500 text-xs">⚠ {errors.terms}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                    style={{ background: selectedProfile.color }}
                    data-testid="button-submit"
                  >
                    {loading
                      ? "Criando sua conta..."
                      : selectedPlan.enterprise
                      ? "Solicitar contato comercial"
                      : "Criar conta e iniciar trial de 14 dias"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              </>
            )}

            <p className="text-center text-sm text-gray-500 mt-5">
              Já tem conta?{" "}
              <Link href="/login">
                <span className="font-semibold cursor-pointer" style={{ color: "#0D1B8C" }}>
                  Entrar
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
    hasError ? "border-red-400 bg-red-50" : "border-gray-200 bg-white focus:border-[#0D1B8C]"
  }`;
}

function FieldRow({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
