import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Building2, User, Briefcase,
  Landmark, ShieldCheck, Check, Lock, Sparkles, Search,
  CreditCard, Calendar, Shield,
} from "lucide-react";
import { ScoreCasaLogo, ScoreCasaWordmark } from "@/components/ScoreCasaLogo";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetPlans, getGetMeQueryKey, type Plan } from "@workspace/api-client-react";

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
  userLimit?: number | null;
  leadLimit?: number | null;
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
    id: "correspondente_individual",
    label: "Correspondente Individual",
    role: "correspondent",
    priceMonthly: 297,
    description: "Para o correspondente autônomo que opera sozinho.",
    features: [
      "Painel individual de processos",
      "Até 30 operações ativas por mês",
      "Esteira CCA padrão: aprovação → contrato",
      "Gestão de documentação bancária",
      "Templates de contrato Caixa",
      "Suporte por e-mail",
    ],
    enterprise: false,
  },
  {
    id: "correspondente_sucesso",
    label: "Correspondente de Sucesso",
    role: "correspondent",
    priceMonthly: 997,
    description: "Para correspondentes que querem escalar com comissão de sucesso.",
    features: [
      "Tudo do Correspondente Individual",
      "Até 150 operações ativas por mês",
      "Comissão por contrato fechado",
      "Painel multi-analistas (até 5)",
      "Relatórios de performance",
      "Integração Caixa Aqui (espelhamento)",
      "Suporte prioritário",
    ],
    enterprise: false,
  },
  {
    id: "bank_connect",
    label: "Correspondente Connect",
    role: "correspondent",
    priceMonthly: 2497,
    description: "Integração direta com Caixa, bancos privados e originação completa.",
    features: [
      "Tudo do Correspondente de Sucesso",
      "Operações ilimitadas",
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
function maskCEP(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
}

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
function maskCardNumber(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // ── Card form ───────────────────────────────────────────────────────────────
  const [cardForm, setCardForm] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
    cpfCnpj: "",
    postalCode: "",
    addressNumber: "",
  });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    cnpj: "",
    creci: "",
    ccaCode: "",
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

  const { data: dbPlans = [] } = useGetPlans({
    includeInactive: "false",
    includeLegacy: "false",
  } as any);

  const activeDbPlans = (dbPlans as Plan[]).filter((p) => p.isActive !== false && !p.isLegacy);

  const availablePlans = activeDbPlans.length > 0
    ? activeDbPlans.map((p) => {
        const catRole: ProfileId = (p.role === "correspondent" || p.group === "correspondent")
          ? "correspondent"
          : (p.role === "broker" || p.group === "corretor")
          ? "broker"
          : "client";
        return {
          id: p.id,
          label: p.label,
          role: catRole,
          priceMonthly: p.priceMonthly,
          description: p.description ?? "",
          features: p.features ?? [],
          enterprise: !!p.enterprise,
          highlight: !!(p as any).highlight,
          userLimit: (p as any).userLimit,
          leadLimit: p.leadLimit,
        };
      })
    : PLANS;

  const profilePlans = profile ? availablePlans.filter((p) => p.role === profile) : [];

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
    const pPlans = availablePlans.filter((item) => item.role === p);
    const highlighted = pPlans.find((item) => item.highlight);
    const defaultPlanId = highlighted?.id ?? pPlans[0]?.id ?? (p === "client" ? "free" : p === "broker" ? "corretor" : "correspondent_individual");
    setPlanId(defaultPlanId);
    setStep(2);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Plans that do NOT need a payment step (free or enterprise) */
  const needsPayment = (plan: PlanInfo | undefined) => {
    if (!plan) return false;
    if (plan.priceMonthly === 0) return false;  // Free
    if (plan.enterprise) return false;           // Enterprise / sob consulta
    return true;
  };

  // ── Card validation ──────────────────────────────────────────────────────
  const validateCard = () => {
    const errs: Record<string, string> = {};
    if (!cardForm.holderName.trim() || cardForm.holderName.trim().length < 2)
      errs.holderName = "Nome do titular obrigatório";
    const cardDigits = cardForm.number.replace(/\D/g, "");
    if (cardDigits.length < 13 || cardDigits.length > 19)
      errs.number = "Número do cartão inválido";
    if (!/^\d{2}$/.test(cardForm.expiryMonth) || Number(cardForm.expiryMonth) < 1 || Number(cardForm.expiryMonth) > 12)
      errs.expiryMonth = "Mês inválido";
    const year = Number(cardForm.expiryYear);
    const currentYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(cardForm.expiryYear) || year < currentYear || year > currentYear + 20)
      errs.expiryYear = "Ano inválido";
    if (!/^\d{3,4}$/.test(cardForm.ccv))
      errs.ccv = "CVV inválido";
    const cpfDigits = cardForm.cpfCnpj.replace(/\D/g, "");
    if (cpfDigits.length === 11 && !isValidCPF(cpfDigits)) {
      errs.cpfCnpj = "CPF inválido (dígitos verificadores incorretos)";
    } else if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      errs.cpfCnpj = "CPF ou CNPJ inválido";
    }
    const cepDigits = cardForm.postalCode.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      errs.postalCode = "CEP inválido (deve ter 8 dígitos)";
    }
    if (!cardForm.addressNumber.trim()) {
      errs.addressNumber = "Número obrigatório";
    }
    return errs;
  };

  const setCard = (key: keyof typeof cardForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (key === "number") val = maskCardNumber(val);
    else if (key === "cpfCnpj") {
      const d = val.replace(/\D/g, "");
      val = d.length <= 11 ? maskCPF(val) : maskCNPJ(val);
    } else if (key === "postalCode") {
      val = maskCEP(val);
    }
    setCardForm((f) => ({ ...f, [key]: val }));
    setCardErrors((e) => ({ ...e, [key]: "" }));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardForm((f) => ({
      ...f,
      expiryMonth: raw.slice(0, 2),
      expiryYear: raw.length >= 3 ? `20${raw.slice(2, 4)}` : "",
    }));
    setCardErrors((e) => ({ ...e, expiryMonth: "", expiryYear: "" }));
  };

  const expiryDisplay = `${cardForm.expiryMonth}${cardForm.expiryYear ? `/${cardForm.expiryYear.slice(2)}` : ""}`;

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
      if (!isValidCPF(cpfDigits)) errs.cpf = "CPF inválido (dígitos verificadores incorretos)";
      if (parseCurrency(form.income) <= 0) errs.income = "Informe sua renda mensal";
      if (parseCurrency(form.propertyValue) <= 0) errs.propertyValue = "Informe o valor do imóvel";
    } else if (profile === "broker") {
      const cpfDigits = form.cpf.replace(/\D/g, "");
      if (!isValidCPF(cpfDigits)) errs.cpf = "CPF inválido (dígitos verificadores incorretos)";
      if (!form.creci.trim()) errs.creci = "CRECI obrigatório";
    } else if (profile === "correspondent") {
      // Correspondente: identidade jurídica (CNPJ) + CCA são suficientes.
      const cnpjDigits = form.cnpj.replace(/\D/g, "");
      if (cnpjDigits.length !== 14) errs.cnpj = "CNPJ inválido (14 dígitos)";
      if (!form.ccaCode.trim()) errs.ccaCode = "Código CCA obrigatório";
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
        ccaCode: "Código CCA",
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
      if (form.ccaCode) body.ccaCode = form.ccaCode.trim();
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
        description: selectedPlan && needsPayment(selectedPlan)
          ? "Conta criada! Processando pagamento..."
          : "Você ganhou 14 dias de avaliação gratuita.",
      });
      setLocation(profile === "client" ? "/portal" : "/dashboard");
    } catch {
      toast({ title: "Erro ao criar conta", description: "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 4: card submit ──────────────────────────────────────────────────
  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    const errs = validateCard();
    if (Object.keys(errs).length > 0) {
      setCardErrors(errs);
      return;
    }
    // Re-use the account creation + charge together
    const accountErrs = validate();
    if (Object.keys(accountErrs).length > 0) {
      setErrors(accountErrs);
      setStep(3);
      toast({ title: "Corrija os dados da conta", description: "Volte ao passo anterior." });
      return;
    }
    if (!profile || !planId || !selectedPlan) {
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

      const cardDigits = cardForm.number.replace(/\D/g, "");
      const cpfDigits = cardForm.cpfCnpj.replace(/\D/g, "");

      // Create unified body including user info and credit card info
      const body: Record<string, unknown> = {
        role: profile,
        plan: planId,
        billingInterval: "monthly",
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
        cpf: form.cpf.replace(/\D/g, "") || undefined,
        creditCard: {
          holderName: cardForm.holderName.trim(),
          number: cardDigits,
          expiryMonth: cardForm.expiryMonth,
          expiryYear: cardForm.expiryYear,
          ccv: cardForm.ccv,
        },
        creditCardHolderInfo: {
          name: cardForm.holderName.trim(),
          email: form.email.trim().toLowerCase(),
          cpfCnpj: cpfDigits,
          mobilePhone: form.phone.replace(/\D/g, ""),
          postalCode: cardForm.postalCode.replace(/\D/g, ""),
          addressNumber: cardForm.addressNumber.trim(),
        },
      };

      if (form.cnpj) body.cnpj = form.cnpj.replace(/\D/g, "");
      if (form.creci) body.creci = form.creci.trim();
      if (form.ccaCode) body.ccaCode = form.ccaCode.trim();
      if (profile === "client") {
        body.income = parseCurrency(form.income);
        body.propertyValue = parseCurrency(form.propertyValue);
      }

      const regResp = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (regResp.status === 409) {
        setErrors({ email: "Este email já está cadastrado" });
        setStep(3);
        return;
      }

      const data = await regResp.json().catch(() => ({}));
      if (!regResp.ok) {
        const msg = (data as { error?: string }).error ?? "Erro ao cadastrar e processar pagamento.";
        setPaymentError(msg);
        toast({ title: "Não foi possível criar a conta", description: msg });
        return;
      }

      toast({
        title: "Conta criada e pagamento confirmado!",
        description: `Plano ${selectedPlan.label} ativado com sucesso.`,
      });

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation(profile === "client" ? "/portal" : "/dashboard");
    } catch {
      const genericMsg = "Erro de conexão ao criar conta. Tente novamente.";
      setPaymentError(genericMsg);
      toast({ title: "Erro ao criar conta", description: genericMsg });
    } finally {
      setLoading(false);
    }
  };


  const selectedPlan = availablePlans.find((p) => p.id === planId);
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
            {([
              { n: 1, label: "Escolha seu perfil" },
              { n: 2, label: "Selecione o plano" },
              { n: 3, label: "Crie sua conta" },
              ...(selectedPlan && needsPayment(selectedPlan) ? [{ n: 4, label: "Dados de pagamento" }] : []),
            ] as { n: number; label: string }[]).map((s) => (
              <div key={s.n} className="flex items-center gap-3 text-sm">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{
                    background: step >= s.n ? "#10A65A" : "rgba(255,255,255,0.1)",
                    color: step >= s.n ? "white" : "#94A3B8",
                  }}
                >
                  {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className={step >= s.n ? "text-white font-medium" : "text-blue-300"}>
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
                  Passo {step} de {selectedPlan && needsPayment(selectedPlan) ? 4 : 3}
                </p>
                <h2 className="text-2xl font-bold" style={{ color: "#07113A" }}>
                  {step === 1 && "Qual o seu perfil?"}
                  {step === 2 && "Escolha seu plano"}
                  {step === 3 && "Quase lá! Seus dados"}
                  {step === 4 && "Dados de pagamento"}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {step === 1 && "Selecione como deseja usar a ScoreCasa."}
                  {step === 2 && "Você terá 14 dias de avaliação gratuita em qualquer plano."}
                  {step === 3 && "Preencha os dados para criar sua conta."}
                  {step === 4 && "Informe os dados do cartão de crédito para a assinatura."}
                </p>
              </div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 4) setStep(3);
                    else if (step === 3) setStep(2);
                    else setStep(1);
                  }}
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
                        {p.userLimit != null && (
                          <div className="flex items-start gap-1.5 text-[11px] font-semibold text-indigo-700 col-span-2">
                            <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: selectedProfile.color }} />
                            <span>Equipe: até {p.userLimit} usuário(s)</span>
                          </div>
                        )}
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
                  {selectedPlan && needsPayment(selectedPlan)
                    ? "14 dias grátis · Cartão cobrado só após o trial · Cancele quando quiser"
                    : "Sem compromisso · 14 dias grátis · Cancele quando quiser"}
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

                  {/* Profissional: campos obrigatórios para o login multi-perfil */}
                  {profile === "broker" && (
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
                      <FieldRow label="CRECI" error={errors.creci}>
                        <input
                          type="text"
                          value={form.creci}
                          onChange={set("creci")}
                          placeholder="Ex: SP-123456"
                          className={inputCls(!!errors.creci)}
                          data-testid="input-creci"
                        />
                      </FieldRow>
                    </div>
                  )}
                  {profile === "correspondent" && (
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow label="CNPJ" error={errors.cnpj}>
                        <input
                          type="text"
                          value={form.cnpj}
                          onChange={set("cnpj")}
                          placeholder="00.000.000/0000-00"
                          className={inputCls(!!errors.cnpj)}
                          data-testid="input-cnpj"
                        />
                      </FieldRow>
                      <FieldRow label="Código CCA (Caixa)" error={errors.ccaCode}>
                        <input
                          type="text"
                          value={form.ccaCode}
                          onChange={set("ccaCode")}
                          placeholder="Ex: CCA-12345"
                          className={inputCls(!!errors.ccaCode)}
                          data-testid="input-cca"
                        />
                      </FieldRow>
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
                    onClick={needsPayment(selectedPlan) ? (e) => {
                      e.preventDefault();
                      const errs = validate();
                      if (Object.keys(errs).length > 0) {
                        setErrors(errs);
                        const labels: Record<string, string> = {
                          name: "Nome completo", cpf: "CPF", cnpj: "CNPJ", creci: "CRECI",
                          ccaCode: "Código CCA", email: "Email", phone: "Telefone",
                          password: "Senha", income: "Renda mensal", propertyValue: "Valor do imóvel",
                          terms: "Aceite dos Termos de Uso",
                        };
                        const missing = Object.keys(errs).map((k) => labels[k] ?? k).join(", ");
                        toast({ title: "Preencha os campos obrigatórios", description: missing });
                        return;
                      }
                      setStep(4);
                    } : undefined}
                  >
                    {loading
                      ? "Criando sua conta..."
                      : selectedPlan.enterprise
                      ? "Solicitar contato comercial"
                      : needsPayment(selectedPlan)
                      ? "Continuar para pagamento"
                      : "Criar conta e iniciar trial de 14 dias"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 4: credit card ──────────────────────────────────── */}
            {step === 4 && selectedProfile && selectedPlan && (
              <>
                {/* Plan summary */}
                <div
                  className="rounded-lg border p-3 mb-5 flex items-center gap-3"
                  style={{ background: selectedProfile.bgLight, borderColor: `${selectedProfile.color}33` }}
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
                      {brl(selectedPlan.priceMonthly)}/mês após os 14 dias gratuitos
                    </div>
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

                {/* Trial notice */}
                <div
                  className="flex items-start gap-3 p-3 rounded-xl mb-5"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
                >
                  <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#10A65A" }} />
                  <div className="text-xs leading-relaxed" style={{ color: "#166534" }}>
                    <div className="font-bold mb-0.5">Seu trial de 14 dias é gratuito</div>
                    O cartão <strong>só será cobrado após o período de avaliação</strong>. Cancele
                    a qualquer momento antes disso sem custo.
                  </div>
                </div>

                <form onSubmit={handleCardSubmit} className="space-y-4">
                  {/* Card number */}
                  <FieldRow label="Número do cartão" error={cardErrors.number}>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardForm.number}
                        onChange={setCard("number")}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        className={`pl-10 ${inputCls(!!cardErrors.number)}`}
                        data-testid="input-card-number"
                      />
                    </div>
                  </FieldRow>

                  {/* Holder name */}
                  <FieldRow label="Nome do titular (como no cartão)" error={cardErrors.holderName}>
                    <input
                      type="text"
                      value={cardForm.holderName}
                      onChange={setCard("holderName")}
                      placeholder="NOME SOBRENOME"
                      className={inputCls(!!cardErrors.holderName)}
                      style={{ textTransform: "uppercase" }}
                      data-testid="input-card-holder"
                    />
                  </FieldRow>

                  {/* Expiry + CVV */}
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Validade" error={cardErrors.expiryMonth || cardErrors.expiryYear}>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={expiryDisplay}
                          onChange={handleExpiryChange}
                          placeholder="MM/AA"
                          maxLength={5}
                          className={`pl-10 ${inputCls(!!(cardErrors.expiryMonth || cardErrors.expiryYear))}`}
                          data-testid="input-card-expiry"
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label="CVV" error={cardErrors.ccv}>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cardForm.ccv}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setCardForm((f) => ({ ...f, ccv: v }));
                            setCardErrors((err) => ({ ...err, ccv: "" }));
                          }}
                          placeholder="123"
                          maxLength={4}
                          className={`pl-10 ${inputCls(!!cardErrors.ccv)}`}
                          data-testid="input-card-cvv"
                        />
                      </div>
                    </FieldRow>
                  </div>

                  {/* CPF/CNPJ do titular */}
                  <FieldRow label="CPF do titular" error={cardErrors.cpfCnpj}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardForm.cpfCnpj}
                      onChange={setCard("cpfCnpj")}
                      placeholder="000.000.000-00"
                      className={inputCls(!!cardErrors.cpfCnpj)}
                      data-testid="input-card-cpf"
                    />
                  </FieldRow>

                  {/* CEP + Número do endereço */}
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="CEP" error={cardErrors.postalCode}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardForm.postalCode}
                        onChange={setCard("postalCode")}
                        placeholder="00000-000"
                        maxLength={9}
                        className={inputCls(!!cardErrors.postalCode)}
                        data-testid="input-card-cep"
                      />
                    </FieldRow>
                    <FieldRow label="Número" error={cardErrors.addressNumber}>
                      <input
                        type="text"
                        value={cardForm.addressNumber}
                        onChange={setCard("addressNumber")}
                        placeholder="123"
                        className={inputCls(!!cardErrors.addressNumber)}
                        data-testid="input-card-number"
                      />
                    </FieldRow>
                  </div>

                  {/* Security badges */}
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Shield className="w-3.5 h-3.5" style={{ color: "#10A65A" }} />
                      SSL 256-bit
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Lock className="w-3.5 h-3.5" style={{ color: "#0D1B8C" }} />
                      Dados protegidos pela Asaas
                    </div>
                  </div>

                  {paymentError && (
                    <div className="p-3 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2.5 mt-3">
                      <Shield className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                      <div className="text-xs leading-relaxed text-red-800">
                        <div className="font-bold mb-0.5">Erro no pagamento</div>
                        {paymentError}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm mt-4 transition-all disabled:opacity-60"
                    style={{ background: selectedProfile.color }}
                    data-testid="button-submit-card"
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Criando conta...</>
                    ) : (
                      <>Criar conta e ativar plano <ArrowRight className="w-4 h-4" /></>
                    )}
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
