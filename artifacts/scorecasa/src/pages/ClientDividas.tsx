import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useGetMySubscription } from "@workspace/api-client-react";
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
  source?: "auto" | "manual" | null;
  availableBanks: string[];
  mode?: "auto" | "manual";
  plan?: string;
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
  const { data: sub } = useGetMySubscription({ query: { retry: false } } as any);
  const planId = (sub as any)?.plan as string | undefined;
  const autoOpenFinance = planId === "individual" || planId === "plus";

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

  function updateField(name: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
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
  const [ofManual, setOfManual] = useState({
    avgBalance: "",
    recurringIncome: "",
    cardUsage: "",
    noLatePayments: "true",
    cpfClear: "true",
  });

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
        if (!r.ok) {
          setErr("Não foi possível carregar seus dados. Tente recarregar a página.");
          return;
        }
        const p = (await r.json()) as ClientProfile;
        setProfile(p);
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
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/client/open-finance`, { credentials: "include" });
        if (r.ok) setOf(await r.json());
      } catch { /* ignore */ }
    })();
  }, [BASE]);

  async function handleConnectOF(bank: string) {
    setOfLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${BASE}/api/client/open-finance/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto", bank }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        throw new Error(j?.error ?? "Falha ao conectar.");
      }
      const data = await r.json();
      setOf((prev) => ({
        ...(prev ?? { availableBanks: [] }),
        ...data,
      }));
      setOfConsent(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e.message ?? "Não foi possível conectar ao Open Finance.");
    } finally {
      setOfLoading(false);
    }
  }

  async function handleSaveManualOF() {
    setOfLoading(true);
    setErr(null);
    try {
      const body = {
        mode: "manual",
        avgBalance: Number(ofManual.avgBalance || 0),
        recurringIncome: Number(ofManual.recurringIncome || 0),
        cardUsage: Number(ofManual.cardUsage || 0),
        noLatePayments: ofManual.noLatePayments === "true",
        cpfClear: ofManual.cpfClear === "true",
      };
      const r = await fetch(`${BASE}/api/client/open-finance/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        throw new Error(j?.error ?? "Não foi possível salvar.");
      }
      const data = await r.json();
      setOf((prev) => ({ ...(prev ?? { availableBanks: [] }), ...data }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e.message ?? "Erro ao salvar.");
    } finally {
      setOfLoading(false);
    }
  }

  async function handleDisconnectOF() {
    if (!confirm("Desconectar o Open Finance? Os indicadores deixarão de alimentar seu Índice de Aprovação.")) return;
    setOfLoading(true);
    try {
      await fetch(`${BASE}/api/client/open-finance`, {
        method: "DELETE",
        credentials: "include",
      });
      setOf((prev) => prev ? { ...prev, connected: false, connectedAt: null, bank: null, avgBalance: null, recurringIncome: null, cardUsage: null, noLatePayments: null, cpfClear: null } : prev);
    } finally {
      setOfLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    setErrFields(new Set());
    setSaved(false);
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
        <div className="max-w-3xl space-y-5">
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
                invalid={errFields.has("vehicleLoanMonthly")}
              />
              <Field
                icon={Wallet}
                label="Outras parcelas (R$/mês)"
                placeholder="CDC, consignado, empréstimo"
                value={form.otherLoansMonthly}
                onChange={(v) => updateField("otherLoansMonthly", v)}
                testId="input-other-loans"
                invalid={errFields.has("otherLoansMonthly")}
              />
              <Field
                icon={CreditCard}
                label="Limite total dos cartões (R$)"
                placeholder="Ex: 15.000"
                value={form.creditCardLimit}
                onChange={(v) => updateField("creditCardLimit", v)}
                testId="input-credit-card-limit"
                invalid={errFields.has("creditCardLimit")}
              />
              <Field
                icon={CreditCard}
                label="Utilização do cartão (%)"
                placeholder="0 a 100"
                value={form.creditCardUsage}
                onChange={(v) => updateField("creditCardUsage", v)}
                max={100}
                testId="input-credit-card-usage"
                invalid={errFields.has("creditCardUsage")}
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
                invalid={errFields.has("bcbTotalDebt")}
              />
              <Field
                label="Parcelas mensais BCB (R$/mês)"
                placeholder="Ex: 1.200"
                value={form.bcbMonthlyCommitment}
                onChange={(v) => updateField("bcbMonthlyCommitment", v)}
                testId="input-bcb-monthly"
                invalid={errFields.has("bcbMonthlyCommitment")}
              />
              <Field
                label="Qtd. operações ativas"
                placeholder="Ex: 3"
                value={form.bcbOperationsCount}
                onChange={(v) => updateField("bcbOperationsCount", v)}
                testId="input-bcb-ops"
                invalid={errFields.has("bcbOperationsCount")}
              />
              <Field
                type="text"
                label="Data de referência"
                placeholder="Ex: 05/2026"
                value={form.bcbQueryDate}
                onChange={(v) => updateField("bcbQueryDate", v)}
                testId="input-bcb-date"
                invalid={errFields.has("bcbQueryDate")}
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
                      Conectado a {of.bank}
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
            ) : autoOpenFinance ? (
              <div>
                <p className="text-xs text-gray-600 mb-2">Escolha seu banco principal:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(of?.availableBanks ?? []).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setOfConsent(b)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-[#0D1B8C] hover:bg-blue-50 transition-colors"
                      data-testid={`button-of-bank-${b.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{b}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 italic">
                  Fluxo simulado para demonstração. Em produção, redireciona ao consentimento oficial do Open Finance Brasil.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg p-3 flex items-start gap-2 text-xs" style={{ background: "#FFFBEB", border: "1px solid #F59E0B33", color: "#92400E" }}>
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Plano Free: preenchimento manual</div>
                    <div>
                      A conexão automática com o seu banco está disponível nos planos <strong>Individual</strong> e <strong>Plus</strong>. No plano Free, informe os dados abaixo para que o bloco <strong>Histórico Financeiro</strong> seja calculado.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ManualField
                    label="Saldo médio dos últimos 6 meses (R$)"
                    placeholder="Ex: 2.500"
                    value={ofManual.avgBalance}
                    onChange={(v) => setOfManual((s) => ({ ...s, avgBalance: v }))}
                    testId="input-of-manual-avg-balance"
                  />
                  <ManualField
                    label="Renda recorrente mensal (R$)"
                    placeholder="Ex: 4.800"
                    value={ofManual.recurringIncome}
                    onChange={(v) => setOfManual((s) => ({ ...s, recurringIncome: v }))}
                    testId="input-of-manual-recurring-income"
                  />
                  <ManualField
                    label="Uso médio do cartão (%)"
                    placeholder="0 a 100"
                    value={ofManual.cardUsage}
                    onChange={(v) => setOfManual((s) => ({ ...s, cardUsage: v }))}
                    testId="input-of-manual-card-usage"
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pontualidade nos últimos 6 meses</label>
                    <select
                      value={ofManual.noLatePayments}
                      onChange={(e) => setOfManual((s) => ({ ...s, noLatePayments: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#0D1B8C] focus:outline-none"
                      data-testid="select-of-manual-no-late"
                    >
                      <option value="true">Sem atrasos</option>
                      <option value="false">Houve atrasos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Situação do CPF</label>
                    <select
                      value={ofManual.cpfClear}
                      onChange={(e) => setOfManual((s) => ({ ...s, cpfClear: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#0D1B8C] focus:outline-none"
                      data-testid="select-of-manual-cpf-clear"
                    >
                      <option value="true">Sem restrições</option>
                      <option value="false">Com restrições</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveManualOF}
                  disabled={ofLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "#0D1B8C" }}
                  data-testid="button-save-of-manual"
                >
                  {ofLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar dados financeiros
                </button>
              </div>
            )}
          </section>

          {/* Feedback */}
          {err && (
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
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#10A65A" }}
            data-testid="button-save-debts"
          >
            <Save className="w-4 h-4" />
            {saving ? "Recalculando score..." : "Salvar e recalcular score"}
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

function ManualField({ label, placeholder, value, onChange, testId }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#0D1B8C] focus:outline-none"
        data-testid={testId}
      />
    </div>
  );
}

function Field(props: Omit<FormFieldProps, "size" | "type"> & { type?: "number" | "text" }) {
  return <FormField {...props} type={props.type ?? "number"} size="compact" />;
}
