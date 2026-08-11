import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { FormField, type FormFieldProps } from "@/components/FormField";
import {
  Car, Wallet, CreditCard, Landmark, ExternalLink, Save, ShieldCheck,
  AlertTriangle, CheckCircle2, Info, Building2, Link2, Unlink, Loader2,
} from "lucide-react";

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

interface ClientProfile {
  user: { id: number; name: string; email: string; role: string; leadId: number };
  lead: {
    id: number;
    income: number;
    propertyValue: number;
    vehicleLoanMonthly: number | null;
    otherLoansMonthly: number | null;
    creditCardLimit: number | null;
    creditCardUsage: number | null;
    bcbTotalDebt: number | null;
    bcbMonthlyCommitment: number | null;
    bcbOperationsCount: number | null;
    bcbQueryDate: string | null;
    scoreCaixa: number | null;
    approvalChance: number | null;
  };
}

function brl(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function ClientDividas() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && !me) setLocation("/login");
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
  }, [loadingMe, me, setLocation]);

  const BASE = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errFields, setErrFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sessionExpired, setSessionExpired] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const DRAFT_KEY = "scorecasa:dividas:draft";

  function snapshotForm(currentForm: typeof form) {
    const hasData = Object.values(currentForm).some((v) => v !== "");
    if (!hasData) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(currentForm));
    } catch {
      /* sessionStorage indisponível — segue sem snapshot */
    }
  }

  function handleAuthFailure(currentForm: typeof form) {
    snapshotForm(currentForm);
    setErr(null);
    setErrFields(new Set());
    setSessionExpired(true);
  }

  function goToLogin() {
    snapshotForm(form);
    setLocation("/login");
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

  function updateField(name: keyof typeof form, value: string) {
    let cleaned = value;
    if (name !== "bcbQueryDate") {
      cleaned = sanitizeNumeric(value);
    }

    setForm((f) => ({ ...f, [name]: cleaned }));
    if (draftRestored) setDraftRestored(false);

    // Validação em tempo real
    const errorText = validateField(name, cleaned);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (errorText) {
        next[name] = errorText;
      } else {
        delete next[name];
      }
      return next;
    });

    setErrFields((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  const [of, setOf] = useState<OpenFinanceState | null>(null);
  const [ofLoading, setOfLoading] = useState(false);
  const [ofConsent, setOfConsent] = useState<string | null>(null); // null = fechado, string = banco selecionado

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

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/client/profile`, { credentials: "include" });
        if (r.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!r.ok) {
          setErr("Não foi possível carregar seus dados. Tente recarregar a página.");
          return;
        }
        const p = (await r.json()) as ClientProfile;
        setProfile(p);
        const fromProfile = {
          vehicleLoanMonthly: p.lead.vehicleLoanMonthly?.toString() ?? "",
          otherLoansMonthly: p.lead.otherLoansMonthly?.toString() ?? "",
          creditCardLimit: p.lead.creditCardLimit?.toString() ?? "",
          creditCardUsage: p.lead.creditCardUsage?.toString() ?? "",
          bcbTotalDebt: p.lead.bcbTotalDebt?.toString() ?? "",
          bcbMonthlyCommitment: p.lead.bcbMonthlyCommitment?.toString() ?? "",
          bcbOperationsCount: p.lead.bcbOperationsCount?.toString() ?? "",
          bcbQueryDate: p.lead.bcbQueryDate ?? "",
        };
        // Restaura rascunho de uma sessão anterior (ex.: usuário acabou de relogar).
        let restored = false;
        try {
          const saved = sessionStorage.getItem(DRAFT_KEY);
          if (saved) {
            const draft = JSON.parse(saved);
            if (draft && typeof draft === "object") {
              setForm({ ...fromProfile, ...draft });
              restored = true;
              setDraftRestored(true);
            }
            sessionStorage.removeItem(DRAFT_KEY);
          }
        } catch {
          /* ignore */
        }
        if (!restored) setForm(fromProfile);
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/client/open-finance`, { credentials: "include" });
        if (r.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (r.ok) setOf(await r.json());
      } catch { /* ignore */ }
    })();
  }, [BASE]);

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

  async function handleOpenPluggyConnect() {
    setOfLoading(true);
    setErr(null);
    try {
      const tokenRes = await fetch(`${BASE}/api/client/open-finance/connect-token`, {
        method: "POST",
        credentials: "include",
      });
      if (tokenRes.status === 401) {
        handleAuthFailure(form);
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
        onSuccess: (itemData: any) => {
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
            undefined;

          if (!resolvedItemId) {
            setErr("Conexão concluída, mas a Pluggy não retornou itemId.");
            return;
          }
          handleConnectOF(resolvedItemId, institution);
        },
        onError: (error: any) => {
          const message = error?.message || "Não foi possível iniciar o fluxo da Pluggy.";
          setErr(message);
          setOfLoading(false);
        },
      });

      pluggyConnect.init();
    } catch (e: any) {
      setErr(e.message ?? "Erro ao abrir o Pluggy Open Finance.");
    } finally {
      setOfLoading(false);
    }
  }

  async function handleConnectOF(itemId: string, institution?: string) {
    setOfLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${BASE}/api/client/open-finance/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, institution }),
      });
      if (r.status === 401) {
        handleAuthFailure(form);
        return;
      }
      if (!r.ok) throw new Error("Falha ao sincronizar com a Pluggy.");
      const data = await r.json();
      setOf((prev) => ({
        ...(prev ?? { availableBanks: [] }),
        ...data,
      }));
      setOfConsent(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e.message ?? "Não foi possível conectar ao Pluggy Open Finance.");
    } finally {
      setOfLoading(false);
    }
  }

  async function handleDisconnectOF() {
    if (!confirm("Desconectar o Open Finance? Os indicadores deixarão de alimentar seu Índice de Aprovação.")) return;
    setOfLoading(true);
    try {
      const r = await fetch(`${BASE}/api/client/open-finance`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.status === 401) {
        handleAuthFailure(form);
        return;
      }
      setOf((prev) => prev ? { ...prev, connected: false, connectedAt: null, bank: null, avgBalance: null, recurringIncome: null, cardUsage: null, noLatePayments: null, cpfClear: null, connectedBanks: [] } : prev);
    } finally {
      setOfLoading(false);
    }
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
      const r = await fetch(`${BASE}/api/client/debts`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.status === 401) {
        handleAuthFailure(form);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        if (Array.isArray(j?.fields)) {
          setErrFields(new Set(j.fields.filter((f: any) => typeof f === "string")));
        }
        setErr(typeof j?.error === "string" && j.error ? j.error : "Não foi possível salvar.");
        return;
      }
      const p = (await r.json()) as ClientProfile;
      setProfile(p);
      // Rehidrata o form com o que o servidor normalizou (ex.: clamp de %).
      setForm({
        vehicleLoanMonthly: p.lead.vehicleLoanMonthly?.toString() ?? "",
        otherLoansMonthly: p.lead.otherLoansMonthly?.toString() ?? "",
        creditCardLimit: p.lead.creditCardLimit?.toString() ?? "",
        creditCardUsage: p.lead.creditCardUsage?.toString() ?? "",
        bcbTotalDebt: p.lead.bcbTotalDebt?.toString() ?? "",
        bcbMonthlyCommitment: p.lead.bcbMonthlyCommitment?.toString() ?? "",
        bcbOperationsCount: p.lead.bcbOperationsCount?.toString() ?? "",
        bcbQueryDate: p.lead.bcbQueryDate ?? "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingMe || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const income = profile?.lead.income ?? 0;
  const connectedBanksList = (of?.connectedBanks ?? []).filter((name): name is string => !!name && name.trim().length > 0);
  const primaryBankName = connectedBanksList[0] || of?.bank || "banco conectado";
  const vehNum = Number(form.vehicleLoanMonthly || 0);
  const othNum = Number(form.otherLoansMonthly || 0);
  const totalParcelas = vehNum + othNum;
  const dti = income > 0 ? (totalParcelas / income) * 100 : 0;
  const dtiColor = dti > 30 ? "#EF4444" : dti > 15 ? "#F59E0B" : "#10A65A";
  const dtiBg = dti > 30 ? "#FEF2F2" : dti > 15 ? "#FFFBEB" : "#F0FDF4";

  const bcbMensal = Number(form.bcbMonthlyCommitment || 0);
  const bcbRatio = income > 0 ? (bcbMensal / income) * 100 : 0;
  const bcbColor = bcbRatio > 35 ? "#EF4444" : bcbRatio > 20 ? "#F59E0B" : "#10A65A";
  const bcbBg = bcbRatio > 35 ? "#FEF2F2" : bcbRatio > 20 ? "#FFFBEB" : "#F0FDF4";

  return (
    <ClientLayout userName={me.name} activePage="dividas">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Minhas dívidas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Essas informações são pessoais e ficam apenas com você. Servem para calcular seu score real
          e nunca aparecem para o corretor sem a sua autorização.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#0D1B8C] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="w-full space-y-5">
          {/* Aviso de privacidade */}
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "#F0FDF4", border: "1px solid #10A65A33" }}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#10A65A" }} />
            <div className="text-sm" style={{ color: "#07113A" }}>
              <div className="font-semibold mb-0.5">Dados privados — só você vê</div>
              <div className="text-gray-600 text-xs">
                Igual ao Open Finance: o corretor recebe somente o resultado do score e da chance
                de aprovação. Os valores que você informar aqui não são exibidos no painel dele.
              </div>
            </div>
          </div>

          {/* ── Parcelas mensais ativas ── */}
          <section className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              <h2 className="font-semibold text-sm" style={{ color: "#07113A" }}>
                Parcelas mensais ativas
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Some o que sai todo mês com financiamento de veículo, empréstimos, consignados e CDC.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                icon={Car}
                label="Parcela do veículo (R$/mês)"
                placeholder="Ex: 850"
                value={form.vehicleLoanMonthly}
                onChange={(v) => updateField("vehicleLoanMonthly", v)}
                testId="input-vehicle-loan"
                invalid={errFields.has("vehicleLoanMonthly") || !!fieldErrors.vehicleLoanMonthly}
                error={fieldErrors.vehicleLoanMonthly}
              />
              <Field
                icon={Wallet}
                label="Outras parcelas (R$/mês)"
                placeholder="CDC, consignado, empréstimo"
                value={form.otherLoansMonthly}
                onChange={(v) => updateField("otherLoansMonthly", v)}
                testId="input-other-loans"
                invalid={errFields.has("otherLoansMonthly") || !!fieldErrors.otherLoansMonthly}
                error={fieldErrors.otherLoansMonthly}
              />
              <Field
                icon={CreditCard}
                label="Limite total dos cartões (R$)"
                placeholder="Ex: 15.000"
                value={form.creditCardLimit}
                onChange={(v) => updateField("creditCardLimit", v)}
                testId="input-credit-card-limit"
                invalid={errFields.has("creditCardLimit") || !!fieldErrors.creditCardLimit}
                error={fieldErrors.creditCardLimit}
              />
              <Field
                icon={CreditCard}
                label="Utilização do cartão (%)"
                placeholder="0 a 100"
                value={form.creditCardUsage}
                onChange={(v) => updateField("creditCardUsage", v)}
                max={100}
                testId="input-credit-card-usage"
                invalid={errFields.has("creditCardUsage") || !!fieldErrors.creditCardUsage}
                error={fieldErrors.creditCardUsage}
              />
            </div>

            {totalParcelas > 0 && income > 0 && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: dtiBg }}>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium" style={{ color: dtiColor }}>
                    Comprometimento com parcelas
                  </span>
                  <span className="font-bold" style={{ color: dtiColor }}>
                    {dti.toFixed(1)}% da sua renda
                  </span>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dti)}%`, background: dtiColor }}
                  />
                </div>
                <div className="text-xs mt-1.5" style={{ color: dtiColor }}>
                  {dti > 30
                    ? "Acima do limite usado pelos bancos. Reduz bastante a margem de crédito imobiliário."
                    : dti > 15
                    ? "Atenção: pode impactar a análise de crédito."
                    : "Dentro do limite aceitável pelos bancos."}
                </div>
              </div>
            )}
          </section>

          {/* ── Registrato BCB ── */}
          <section className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4" style={{ color: "#0D1B8C" }} />
              <h2 className="font-semibold text-sm" style={{ color: "#07113A" }}>
                Banco Central — Registrato
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Consulta o relatório oficial do Banco Central (SCR/Registrato) e copia os totais aqui.
              É gratuito e leva menos de 2 minutos pelo gov.br.
            </p>

            <a
              href="https://www.bcb.gov.br/meubc/registrato"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 mb-4"
              style={{ backgroundColor: "#0D1B8C" }}
              data-testid="link-bcb-registrato"
            >
              <ExternalLink className="w-3 h-3" />
              Acessar Registrato gov.br
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Total de dívidas ativas (R$)"
                placeholder="Ex: 45.000"
                value={form.bcbTotalDebt}
                onChange={(v) => updateField("bcbTotalDebt", v)}
                testId="input-bcb-total-debt"
                invalid={errFields.has("bcbTotalDebt") || !!fieldErrors.bcbTotalDebt}
                error={fieldErrors.bcbTotalDebt}
              />
              <Field
                label="Parcelas mensais BCB (R$/mês)"
                placeholder="Ex: 1.200"
                value={form.bcbMonthlyCommitment}
                onChange={(v) => updateField("bcbMonthlyCommitment", v)}
                testId="input-bcb-monthly"
                invalid={errFields.has("bcbMonthlyCommitment") || !!fieldErrors.bcbMonthlyCommitment}
                error={fieldErrors.bcbMonthlyCommitment}
              />
              <Field
                label="Qtd. operações ativas"
                placeholder="Ex: 3"
                value={form.bcbOperationsCount}
                onChange={(v) => updateField("bcbOperationsCount", v)}
                testId="input-bcb-ops"
                invalid={errFields.has("bcbOperationsCount") || !!fieldErrors.bcbOperationsCount}
                error={fieldErrors.bcbOperationsCount}
              />
              <Field
                type="text"
                label="Data de referência"
                placeholder="Ex: 05/2026"
                value={form.bcbQueryDate}
                onChange={(v) => updateField("bcbQueryDate", v)}
                testId="input-bcb-date"
                invalid={errFields.has("bcbQueryDate") || !!fieldErrors.bcbQueryDate}
                error={fieldErrors.bcbQueryDate}
              />
            </div>

            {bcbMensal > 0 && income > 0 && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: bcbBg }}>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-medium" style={{ color: bcbColor }}>
                    Comprometimento total (BCB)
                  </span>
                  <span className="font-bold" style={{ color: bcbColor }}>
                    {bcbRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, bcbRatio)}%`, background: bcbColor }}
                  />
                </div>
                <div className="text-xs mt-1.5" style={{ color: bcbColor }}>
                  {bcbRatio > 35
                    ? "Comprometimento elevado — pode inviabilizar a operação imobiliária."
                    : bcbRatio > 20
                    ? "Atenção: margem de crédito reduzida."
                    : "Comprometimento aceitável para análise de crédito."}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Tem o PDF do Registrato? Vá em <strong>Meus dados</strong> e use o importador
                automático para preencher tudo de uma vez via OCR.
              </span>
            </div>
          </section>

          {/* ── Open Finance (simulado) ── */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0D1B8C15" }}>
                <Building2 className="w-5 h-5" style={{ color: "#0D1B8C" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900">Open Finance</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Conecte seu banco para que sua movimentação real (saldo médio, salário, pontualidade) alimente automaticamente o bloco <strong>Histórico Financeiro</strong> do seu Índice de Aprovação.
                </p>
              </div>
            </div>

            {of?.connected ? (
              <div className="rounded-xl border p-4" style={{ background: "#F0FDF4", borderColor: "#10A65A55" }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: "#065F46" }} />
                    <span className="text-sm font-semibold" style={{ color: "#065F46" }}>
                      {connectedBanksList.length > 1
                        ? `${connectedBanksList.length} bancos conectados`
                        : `Conectado a ${primaryBankName}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectOF}
                    disabled={ofLoading}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-red-600 disabled:opacity-50"
                    data-testid="button-disconnect-of"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Desconectar
                  </button>
                </div>
                {connectedBanksList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {connectedBanksList.map((bankName) => (
                      <span key={bankName} className="rounded-full border border-green-200 bg-white px-2.5 py-1 text-[11px] font-medium text-green-800">
                        {bankName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleOpenPluggyConnect}
                    disabled={ofLoading}
                    className="flex items-center gap-2 rounded-lg border border-[#0D1B8C] px-3 py-2 text-[11px] font-semibold text-[#0D1B8C] disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Conectar outro banco
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <OFStat label="Saldo médio (6m)" value={brl(of.avgBalance)} />
                  <OFStat label="Renda recorrente" value={brl(of.recurringIncome)} />
                  <OFStat label="Uso do cartão" value={of.cardUsage != null ? `${of.cardUsage}%` : "—"} />
                  <OFStat
                    label="Pontualidade"
                    value={of.noLatePayments ? "Sem atrasos" : "Houve atrasos"}
                    good={of.noLatePayments === true}
                    bad={of.noLatePayments === false}
                  />
                  <OFStat
                    label="CPF"
                    value={of.cpfClear ? "Sem restrições" : "Com restrições"}
                    good={of.cpfClear === true}
                    bad={of.cpfClear === false}
                  />
                  {of.connectedAt && (
                    <OFStat label="Conectado em" value={new Date(of.connectedAt).toLocaleDateString("pt-BR")} />
                  )}
                </div>
              </div>
            ) : ofConsent ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#0D1B8C" }} />
                  <div className="text-xs text-gray-700 leading-relaxed">
                    Ao conectar com <strong>{ofConsent}</strong>, você autoriza a ScoreCasa a consultar de forma <strong>somente leitura</strong>:
                    saldo médio, renda recorrente, uso do cartão e histórico de pontualidade dos últimos 6 meses. Os dados são usados exclusivamente para calcular seu Índice de Aprovação. Você pode revogar a qualquer momento.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleConnectOF(ofConsent)}
                    disabled={ofLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#0D1B8C" }}
                    data-testid="button-confirm-consent"
                  >
                    {ofLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Autorizar e conectar
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfConsent(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Conecte com segurança sua conta bancária via <strong>Pluggy Open Finance</strong>. O sistema consulta de forma criptografada seu saldo médio, extrato e lançamentos dos próximos dias para calcular seu Índice de Aprovação.
                </p>
                
                <button
                  type="button"
                  onClick={handleOpenPluggyConnect}
                  disabled={ofLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-[#0D1B8C]-pluggy"
                >
                  {ofLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Conectar Banco (Pluggy Open Finance)
                </button>

                <p className="text-[11px] text-gray-400 mt-3 italic">
                  Integração oficial Pluggy ativa. Selecione seu banco no widget para autenticar com segurança.
                </p>
              </div>
            )}
          </section>

          {/* Feedback */}
          {sessionExpired && (
            <div
              className="rounded-lg p-4 flex items-start gap-3 text-sm"
              style={{ background: "#FFFBEB", border: "1px solid #F59E0B66", color: "#92400E" }}
              role="alert"
              data-testid="banner-session-expired"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#B45309" }} />
              <div className="flex-1">
                <div className="font-semibold mb-1">Sua sessão expirou</div>
                <div className="text-xs mb-3" style={{ color: "#78350F" }}>
                  Para salvar o que você digitou, faça login novamente. Seus valores ficam guardados aqui e voltam automaticamente assim que você entrar.
                </div>
                <button
                  type="button"
                  onClick={goToLogin}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-relogin"
                >
                  Fazer login para salvar
                </button>
              </div>
            </div>
          )}
          {draftRestored && !sessionExpired && (
            <div
              className="rounded-lg p-3 flex items-start gap-2 text-xs"
              style={{ background: "#EFF6FF", color: "#1E40AF" }}
              data-testid="banner-draft-restored"
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Recuperamos os valores que você tinha digitado antes da sessão expirar. Confira e clique em <strong>Salvar e recalcular score</strong>.
              </span>
            </div>
          )}
          {err && !sessionExpired && (
            <div className="rounded-lg p-3 flex items-start gap-2 text-xs" style={{ background: "#FEF2F2", color: "#991B1B" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
          {saved && (
            <div className="rounded-lg p-3 flex items-start gap-2 text-xs" style={{ background: "#F0FDF4", color: "#065F46" }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Dados salvos. Seu score foi recalculado
                {profile?.lead.scoreCaixa != null && (
                  <> — agora está em <strong>{profile.lead.scoreCaixa}</strong>.</>
                )}
              </span>
            </div>
          )}

          {/* Salvar */}
          <button
            type="button"
            onClick={sessionExpired ? goToLogin : handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: sessionExpired ? "#0D1B8C" : "#10A65A" }}
            data-testid="button-save-debts"
          >
            <Save className="w-4 h-4" />
            {sessionExpired
              ? "Fazer login para salvar"
              : saving
              ? "Recalculando score..."
              : "Salvar e recalcular score"}
          </button>
        </div>
      )}
    </ClientLayout>
  );
}

function OFStat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? "#065F46" : bad ? "#991B1B" : "#0F172A";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function Field(props: Omit<FormFieldProps, "size" | "type" | "inputMode"> & { type?: "number" | "text" }) {
  const isDate = props.label === "Data de referência";
  return (
    <FormField
      {...props}
      type="text"
      inputMode={isDate ? undefined : "numeric"}
      size="compact"
    />
  );
}
