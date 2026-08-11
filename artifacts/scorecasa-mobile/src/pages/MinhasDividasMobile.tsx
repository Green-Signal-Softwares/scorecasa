import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  getGetMeQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Car,
  Wallet,
  CreditCard,
  Landmark,
  ExternalLink,
  Save,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Building2,
  Link2,
  Unlink,
  Loader2,
  Calculator,
  DollarSign,
  SlidersHorizontal,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OpenFinanceState {
  connected: boolean;
  connectedAt: string | null;
  bank: string | null;
  avgBalance: number | null;
  recurringIncome: number | null;
  cardUsage: number | null;
  noLatePayments: boolean | null;
  cpfClear: boolean | null;
  connectedBanks: string[];
  availableBanks?: string[];
}

interface LeadData {
  id: number;
  income: number;
  vehicleLoanMonthly: number | null;
  otherLoansMonthly: number | null;
  creditCardLimit: number | null;
  creditCardUsage: number | null;
  bcbTotalDebt: number | null;
  bcbMonthlyCommitment: number | null;
  bcbOperationsCount: number | null;
  bcbQueryDate: string | null;
  scoreCaixa: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function brl(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav() {
  const [, setLocation] = useLocation();
  const tabs = [
    { label: "Score",      icon: CheckCircle2,      href: "/portal/score",       key: "score" },
    { label: "Imóveis",    icon: Building2,          href: "/portal/imoveis",     key: "imoveis" },
    { label: "Simulador",  icon: Calculator,          href: "/portal/simulador",   key: "simulador" },
    { label: "Pagamentos", icon: DollarSign,          href: "/portal/pagamentos",  key: "pagamentos" },
    { label: "Dívidas",    icon: Landmark,            href: "/portal/dividas",     key: "dividas" },
    { label: "Dados",      icon: SlidersHorizontal,   href: "/portal/meus-dados",  key: "dados" },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around pt-3"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 50,
      }}
    >
      {tabs.map(({ label, icon: Icon, href, key }) => {
        const active = key === "dividas";
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

// ── Input field ───────────────────────────────────────────────────────────────
function MobileInput({
  label, value, onChange, placeholder, inputMode = "numeric", icon: Icon, hint, invalid, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "numeric" | "text" | "decimal";
  icon?: any; hint?: string; invalid?: boolean; error?: string;
}) {
  const isInvalid = !!(invalid || error);
  return (
    <div>
      <label className={`block text-xs font-medium mb-1.5 ${isInvalid ? "text-red-500" : "text-gray-700"}`}>{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icon className={`w-4 h-4 ${isInvalid ? "text-red-400" : "text-gray-400"}`} />
          </div>
        )}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 rounded-xl border text-sm font-semibold outline-none transition-colors"
          style={{
            paddingLeft: Icon ? "2.25rem" : "1rem",
            paddingRight: "1rem",
            color: isInvalid ? "#B91C1C" : "#07113A",
            borderColor: isInvalid ? "#EF4444" : "#E2E8F0",
            background: isInvalid ? "#FEF2F2" : "white",
          }}
        />
      </div>
      {hint && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── DTI bar ───────────────────────────────────────────────────────────────────
function DtiBar({ ratio, label }: { ratio: number; label: string }) {
  const color = ratio > 30 ? "#EF4444" : ratio > 15 ? "#F59E0B" : "#10A65A";
  const bg    = ratio > 30 ? "#FEF2F2" : ratio > 15 ? "#FFFBEB" : "#F0FDF4";
  const msg   = ratio > 30
    ? "Acima do limite dos bancos. Reduz bastante a margem de crédito imobiliário."
    : ratio > 15
    ? "Atenção: pode impactar a análise de crédito."
    : "Dentro do limite aceitável pelos bancos.";
  return (
    <div className="mt-4 p-3 rounded-xl" style={{ background: bg }}>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="font-medium" style={{ color }}>{label}</span>
        <span className="font-bold" style={{ color }}>{ratio.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.6)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, ratio)}%`, background: color }}
        />
      </div>
      <p className="text-xs mt-1.5" style={{ color }}>{msg}</p>
    </div>
  );
}

function sanitizeNumeric(val: string): string {
  return val.replace(/\D/g, "");
}

function validateField(name: string, value: string): string | null {
  if (value === "") return null;

  const moneyFields = [
    "vehicleLoanMonthly",
    "otherLoansMonthly",
    "creditCardLimit",
    "bcbTotalDebt",
    "bcbMonthlyCommitment"
  ];

  if (moneyFields.includes(name)) {
    const cleanVal = value.trim();
    if (/\D/.test(cleanVal)) {
      return "Por favor, digite apenas números, sem pontos, vírgulas ou símbolos.";
    }
    const num = Number(cleanVal);
    if (Number.isNaN(num)) {
      return "Ops! O valor digitado não parece um número válido. Tente novamente.";
    }
    if (num < 0) {
      return "O valor não pode ser menor que zero.";
    }
    if (num > 1000000000) {
      return "O valor digitado está muito alto. Por favor, verifique se o número está correto.";
    }
  }

  if (name === "creditCardUsage") {
    const cleanVal = value.trim();
    if (/\D/.test(cleanVal)) {
      return "Por favor, digite apenas números inteiros de 0 a 100.";
    }
    const num = Number(cleanVal);
    if (Number.isNaN(num)) {
      return "Ops! O percentual digitado não é válido. Tente novamente.";
    }
    if (num < 0) {
      return "A utilização do cartão não pode ser menor que 0%.";
    }
    if (num > 100) {
      return "O percentual de utilização não pode ser maior que 100%.";
    }
  }

  if (name === "bcbOperationsCount") {
    const cleanVal = value.trim();
    if (/\D/.test(cleanVal)) {
      return "Por favor, digite apenas números inteiros para a quantidade.";
    }
    const num = Number(cleanVal);
    if (num < 0) {
      return "A quantidade não pode ser menor que zero.";
    }
    if (num > 1000) {
      return "A quantidade máxima permitida é de 1000 operações.";
    }
  }

  if (name === "bcbQueryDate") {
    const val = value.trim();
    if (val && !/^\d{2}\/\d{4}$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return "Por favor, insira a data no formato MM/AAAA (ex: 05/2026).";
    }
    if (val && /^\d{2}\/\d{4}$/.test(val)) {
      const [m, y] = val.split("/").map(Number);
      if (m < 1 || m > 12) {
        return "O mês digitado é inválido. Escolha um mês entre 01 e 12.";
      }
      if (y < 1900 || y > 2100) {
        return "O ano digitado é inválido. Digite um ano entre 1900 e 2100.";
      }
    }
  }

  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function MinhasDividasMobile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const BASE = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errFields, setErrFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [of, setOf] = useState<OpenFinanceState | null>(null);
  const [ofLoading, setOfLoading] = useState(false);
  const [ofConsent, setOfConsent] = useState<string | null>(null);

  const [form, setForm] = useState({
    vehicleLoanMonthly: "",
    otherLoansMonthly: "",
    creditCardLimit: "",
    creditCardUsage: "",
    bcbTotalDebt: "",
    bcbMonthlyCommitment: "",
    bcbOperationsCount: "",
    bcbQueryDate: "",
  });

  // Load profile + Open Finance
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await customFetch<{ lead: LeadData }>("/api/client/profile");
        if (!active) return;
        setLead(p.lead);
        setForm({
          vehicleLoanMonthly: p.lead.vehicleLoanMonthly?.toString() ?? "",
          otherLoansMonthly:  p.lead.otherLoansMonthly?.toString()  ?? "",
          creditCardLimit:    p.lead.creditCardLimit?.toString()     ?? "",
          creditCardUsage:    p.lead.creditCardUsage?.toString()     ?? "",
          bcbTotalDebt:       p.lead.bcbTotalDebt?.toString()        ?? "",
          bcbMonthlyCommitment: p.lead.bcbMonthlyCommitment?.toString() ?? "",
          bcbOperationsCount: p.lead.bcbOperationsCount?.toString()  ?? "",
          bcbQueryDate:       p.lead.bcbQueryDate                    ?? "",
        });
      } catch (e: any) {
        if (e?.status === 401) setLocation("/login");
      } finally {
        if (active) setLoading(false);
      }
    })();
    (async () => {
      try {
        const o = await customFetch<OpenFinanceState>("/api/client/open-finance");
        if (active) setOf(o);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [setLocation]);

  function update(field: keyof typeof form, value: string) {
    let cleaned = value;
    if (field !== "bcbQueryDate") {
      cleaned = sanitizeNumeric(value);
    }

    setForm((f) => ({ ...f, [field]: cleaned }));

    // Validação em tempo real
    const errorText = validateField(field, cleaned);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (errorText) {
        next[field] = errorText;
      } else {
        delete next[field];
      }
      return next;
    });

    setErrFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setErrFields(new Set());
    setSaved(false);

    // Validar localmente antes de enviar
    const errorsMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      const errText = validateField(k, v);
      if (errText) {
        errorsMap[k] = errText;
      }
    }

    if (Object.keys(errorsMap).length > 0) {
      setFieldErrors(errorsMap);
      setErr("Por favor, corrija os erros nos campos destacados antes de salvar.");
      setSaving(false);
      return;
    }

    setFieldErrors({});

    try {
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v === "" ? null : v;
      }
      const p = await customFetch<{ lead: LeadData }>("/api/client/debts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLead(p.lead);
      setForm({
        vehicleLoanMonthly: p.lead.vehicleLoanMonthly?.toString() ?? "",
        otherLoansMonthly:  p.lead.otherLoansMonthly?.toString()  ?? "",
        creditCardLimit:    p.lead.creditCardLimit?.toString()     ?? "",
        creditCardUsage:    p.lead.creditCardUsage?.toString()     ?? "",
        bcbTotalDebt:       p.lead.bcbTotalDebt?.toString()        ?? "",
        bcbMonthlyCommitment: p.lead.bcbMonthlyCommitment?.toString() ?? "",
        bcbOperationsCount: p.lead.bcbOperationsCount?.toString()  ?? "",
        bcbQueryDate:       p.lead.bcbQueryDate                    ?? "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (e: any) {
      if (e?.status === 401) { setLocation("/login"); return; }
      if (e?.status === 400 && e?.data?.fields) {
        setErrFields(new Set(e.data.fields));
      }
      setErr(e?.data?.error ?? e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function loadPluggySDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).PluggyConnect) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.5.0/pluggy-connect.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar o widget da Pluggy."));
      document.body.appendChild(script);
    });
  }

  async function handleConnectOF(preselectedBank?: string) {
    setOfLoading(true);
    try {
      const tokenRes = await fetch(`${BASE}/api/client/open-finance/connect-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (tokenRes.status === 401) {
        setLocation("/login");
        return;
      }
      if (!tokenRes.ok) throw new Error("Não foi possível iniciar a sessão do Pluggy Open Finance.");

      const { accessToken } = await tokenRes.json();
      await loadPluggySDK();

      const PluggyConnect = (window as any).PluggyConnect;
      if (!PluggyConnect) {
        throw new Error("SDK da Pluggy indisponível no navegador.");
      }

      const pluggyConnect = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: true,
        onSuccess: async (itemData: any) => {
          const resolvedItemId =
            typeof itemData?.id === "string"
              ? itemData.id
              : typeof itemData?.item?.id === "string"
                ? itemData.item.id
                : typeof itemData?.itemId === "string"
                  ? itemData.itemId
                  : null;
          const institution =
            itemData?.connector?.name ||
            itemData?.item?.connector?.name ||
            preselectedBank ||
            undefined;

          if (!resolvedItemId) {
            setErr("Conexão concluída, mas a Pluggy não retornou itemId.");
            return;
          }

          setOfLoading(true);
          try {
            const data = await customFetch<OpenFinanceState>("/api/client/open-finance/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: resolvedItemId, institution }),
            });
            setOf((prev) => ({ ...(prev ?? { availableBanks: [] }), ...data }));
            setOfConsent(null);
            setErr(null);
          } catch (e: any) {
            setErr(e?.message ?? "Não foi possível sincronizar após a conexão.");
          } finally {
            setOfLoading(false);
          }
        },
        onError: (error: any) => {
          setErr(error?.message ?? "Não foi possível iniciar o fluxo da Pluggy.");
          setOfLoading(false);
        },
      });

      pluggyConnect.init();
    } catch (e: any) {
      setErr(e?.message ?? "Não foi possível conectar.");
    } finally {
      setOfLoading(false);
    }
  }

  async function handleDisconnectOF() {
    setOfLoading(true);
    try {
      await customFetch("/api/client/open-finance", { method: "DELETE" });
      setOf((prev) => prev
        ? { ...prev, connected: false, connectedAt: null, bank: null, avgBalance: null, recurringIncome: null, cardUsage: null, noLatePayments: null, cpfClear: null, connectedBanks: [] }
        : prev);
    } finally {
      setOfLoading(false);
    }
  }

  // Derived metrics
  const income    = lead?.income ?? 0;
  const connectedBanksList = (of?.connectedBanks ?? []).filter((name): name is string => !!name && name.trim().length > 0);
  const primaryBankName = connectedBanksList[0] || of?.bank || "banco conectado";
  const veh       = Number(form.vehicleLoanMonthly || 0);
  const other     = Number(form.otherLoansMonthly   || 0);
  const totalParc = veh + other;
  const dti       = income > 0 ? (totalParc / income) * 100 : 0;
  const bcbMensal = Number(form.bcbMonthlyCommitment || 0);
  const bcbRatio  = income > 0 ? (bcbMensal / income) * 100 : 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>Olá,</div>
            <div className="text-base font-bold text-white">{me?.name ?? "Cliente"}</div>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
            style={{ background: "rgba(16,166,90,0.2)", color: "#10A65A", border: "1px solid rgba(16,166,90,0.3)" }}
          >
            <Landmark className="w-3.5 h-3.5" />
            Minhas Dívidas
          </div>
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          Dados privados usados para calcular seu score real. O corretor vê apenas o resultado.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 px-4 pt-4">

          {/* Privacy notice */}
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#F0FDF4", border: "1px solid rgba(16,166,90,0.2)" }}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#10A65A" }} />
            <div>
              <div className="text-xs font-bold" style={{ color: "#07113A" }}>Dados privados — só você vê</div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                O corretor recebe apenas o score e o índice de aprovação — nunca os valores que você informar aqui.
              </div>
            </div>
          </div>

          {/* ── Parcelas mensais ativas ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#0D1B8C15" }}>
                <Wallet className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#07113A" }}>Parcelas mensais ativas</p>
                <p className="text-[11px] text-gray-400">Veículo, empréstimos, consignados, CDC</p>
              </div>
            </div>

            <MobileInput
              label="Parcela do veículo (R$/mês)"
              icon={Car}
              value={form.vehicleLoanMonthly}
              onChange={(v) => update("vehicleLoanMonthly", v)}
              placeholder="Ex: 850"
              invalid={errFields.has("vehicleLoanMonthly") || !!fieldErrors.vehicleLoanMonthly}
              error={fieldErrors.vehicleLoanMonthly}
            />
            <MobileInput
              label="Outras parcelas (R$/mês)"
              icon={Wallet}
              value={form.otherLoansMonthly}
              onChange={(v) => update("otherLoansMonthly", v)}
              placeholder="CDC, consignado, empréstimo"
              invalid={errFields.has("otherLoansMonthly") || !!fieldErrors.otherLoansMonthly}
              error={fieldErrors.otherLoansMonthly}
            />

            <div className="grid grid-cols-2 gap-3">
              <MobileInput
                label="Limite total dos cartões (R$)"
                icon={CreditCard}
                value={form.creditCardLimit}
                onChange={(v) => update("creditCardLimit", v)}
                placeholder="Ex: 15000"
                invalid={errFields.has("creditCardLimit") || !!fieldErrors.creditCardLimit}
                error={fieldErrors.creditCardLimit}
              />
              <MobileInput
                label="Utilização do cartão (%)"
                icon={CreditCard}
                value={form.creditCardUsage}
                onChange={(v) => update("creditCardUsage", v)}
                placeholder="0 a 100"
                invalid={errFields.has("creditCardUsage") || !!fieldErrors.creditCardUsage}
                error={fieldErrors.creditCardUsage}
              />
            </div>

            {totalParc > 0 && income > 0 && (
              <DtiBar ratio={dti} label="Comprometimento com parcelas" />
            )}
          </div>

          {/* ── Banco Central — Registrato ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#0D1B8C15" }}>
                <Landmark className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#07113A" }}>Banco Central — Registrato</p>
                <p className="text-[11px] text-gray-400">Consulte gratuitamente no gov.br</p>
              </div>
            </div>

            <a
              href="https://www.bcb.gov.br/meubc/registrato"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#0D1B8C" }}
            >
              <ExternalLink className="w-4 h-4" />
              Acessar Registrato gov.br
            </a>

            <MobileInput
              label="Total de dívidas ativas (R$)"
              value={form.bcbTotalDebt}
              onChange={(v) => update("bcbTotalDebt", v)}
              placeholder="Ex: 45.000"
              invalid={errFields.has("bcbTotalDebt") || !!fieldErrors.bcbTotalDebt}
              error={fieldErrors.bcbTotalDebt}
            />
            <MobileInput
              label="Parcelas mensais BCB (R$/mês)"
              value={form.bcbMonthlyCommitment}
              onChange={(v) => update("bcbMonthlyCommitment", v)}
              placeholder="Ex: 1.200"
              invalid={errFields.has("bcbMonthlyCommitment") || !!fieldErrors.bcbMonthlyCommitment}
              error={fieldErrors.bcbMonthlyCommitment}
            />
            <div className="grid grid-cols-2 gap-3">
              <MobileInput
                label="Qtd. operações ativas"
                value={form.bcbOperationsCount}
                onChange={(v) => update("bcbOperationsCount", v)}
                placeholder="Ex: 3"
                invalid={errFields.has("bcbOperationsCount") || !!fieldErrors.bcbOperationsCount}
                error={fieldErrors.bcbOperationsCount}
              />
              <MobileInput
                label="Data referência"
                value={form.bcbQueryDate}
                onChange={(v) => update("bcbQueryDate", v)}
                placeholder="05/2026"
                inputMode="text"
                invalid={errFields.has("bcbQueryDate") || !!fieldErrors.bcbQueryDate}
                error={fieldErrors.bcbQueryDate}
              />
            </div>

            {bcbMensal > 0 && income > 0 && (
              <DtiBar ratio={bcbRatio} label="Comprometimento total (BCB)" />
            )}

            <div className="flex items-start gap-2 text-xs text-gray-400">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Tem o PDF do Registrato? Em <strong>Meus Dados</strong> você pode importar automaticamente via OCR.</span>
            </div>
          </div>

          {/* ── Open Finance ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0D1B8C15" }}>
                <Building2 className="w-5 h-5" style={{ color: "#0D1B8C" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#07113A" }}>Open Finance</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                  Conecte seu banco para alimentar automaticamente seu Índice de Aprovação com movimentação real.
                </p>
              </div>
            </div>

            {of?.connected ? (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "#F0FDF4", border: "1px solid rgba(16,166,90,0.3)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "#065F46" }} />
                    <span className="text-sm font-semibold" style={{ color: "#065F46" }}>
                      {connectedBanksList.length > 1
                        ? `${connectedBanksList.length} bancos conectados`
                        : `Conectado a ${primaryBankName}`}
                    </span>
                  </div>
                  <button
                    type="button" onClick={handleDisconnectOF} disabled={ofLoading}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 disabled:opacity-50"
                  >
                    <Unlink className="w-3.5 h-3.5" /> Desconectar
                  </button>
                </div>
                {connectedBanksList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {connectedBanksList.map((bankName) => (
                      <span key={bankName} className="rounded-full border border-green-200 bg-white px-2.5 py-1 text-[11px] font-medium text-green-800">
                        {bankName}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleConnectOF()}
                  disabled={ofLoading}
                  className="flex items-center justify-center gap-2 h-10 w-full rounded-xl text-sm font-semibold text-[#0D1B8C] border border-[#0D1B8C] bg-white disabled:opacity-60"
                >
                  <Link2 className="w-4 h-4" />
                  Conectar outro banco
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Saldo médio (6m)", value: brl(of.avgBalance) },
                    { label: "Renda recorrente", value: brl(of.recurringIncome) },
                    { label: "Uso do cartão",    value: of.cardUsage != null ? `${of.cardUsage}%` : "—" },
                    { label: "Pontualidade",     value: of.noLatePayments ? "Sem atrasos" : "Houve atrasos" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl p-2.5 border border-green-100">
                      <div className="text-[9px] uppercase font-bold text-gray-400">{label}</div>
                      <div className="text-xs font-extrabold text-gray-800 mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : ofConsent ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#0D1B8C" }} />
                  <p className="text-xs text-gray-700 leading-relaxed">
                    Ao conectar com <strong>{ofConsent}</strong>, você autoriza a ScoreCasa a consultar de forma <strong>somente leitura</strong> saldo médio, renda recorrente e histórico dos últimos 6 meses. Você pode revogar a qualquer momento.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => handleConnectOF(ofConsent)} disabled={ofLoading}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#0D1B8C" }}
                  >
                    {ofLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Autorizar
                  </button>
                  <button
                    type="button" onClick={() => setOfConsent(null)}
                    className="px-4 rounded-xl text-sm text-gray-600 bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Conecte seu banco para alimentar automaticamente seu score com movimentação real e dados de pontualidade.
                </p>
                <button
                  type="button"
                  onClick={() => handleConnectOF()}
                  disabled={ofLoading}
                  className="flex items-center justify-center gap-2 h-11 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "#0D1B8C" }}
                >
                  {ofLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Conectar banco
                </button>
                <p className="text-[11px] text-gray-400 italic">
                  Integração oficial Pluggy ativa. O widget abre diretamente para autenticar com segurança.
                </p>
              </div>
            )}
          </div>

          {/* Feedback */}
          {err && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#FEF2F2", border: "1px solid #FEE2E2" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
              <p className="text-xs" style={{ color: "#991B1B" }}>{err}</p>
            </div>
          )}
          {saved && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#10A65A" }} />
              <p className="text-xs" style={{ color: "#065F46" }}>
                Dados salvos. Seu score foi recalculado
                {lead?.scoreCaixa != null && <> — agora está em <strong>{lead.scoreCaixa}</strong>.</>}
              </p>
            </div>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-13 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-white shadow-sm active:scale-95 transition-all disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #10A65A 0%, #059669 100%)", height: 52 }}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? "Recalculando score..." : "Salvar e recalcular score"}
          </button>

          <p className="text-[10px] text-gray-400 text-center pb-2">
            Ao salvar, seu score é recalculado automaticamente com os novos dados.
          </p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
