import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import {
  Car, Wallet, CreditCard, Landmark, ExternalLink, Save, ShieldCheck,
  AlertTriangle, CheckCircle2, Info,
} from "lucide-react";

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
  }, [BASE]);

  async function handleSave() {
    setSaving(true);
    setErr(null);
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
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Não foi possível salvar.");
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
                onChange={(v) => setForm((f) => ({ ...f, vehicleLoanMonthly: v }))}
                testId="input-vehicle-loan"
              />
              <Field
                icon={Wallet}
                label="Outras parcelas (R$/mês)"
                placeholder="CDC, consignado, empréstimo"
                value={form.otherLoansMonthly}
                onChange={(v) => setForm((f) => ({ ...f, otherLoansMonthly: v }))}
                testId="input-other-loans"
              />
              <Field
                icon={CreditCard}
                label="Limite total dos cartões (R$)"
                placeholder="Ex: 15.000"
                value={form.creditCardLimit}
                onChange={(v) => setForm((f) => ({ ...f, creditCardLimit: v }))}
                testId="input-credit-card-limit"
              />
              <Field
                icon={CreditCard}
                label="Utilização do cartão (%)"
                placeholder="0 a 100"
                value={form.creditCardUsage}
                onChange={(v) => setForm((f) => ({ ...f, creditCardUsage: v }))}
                max={100}
                testId="input-credit-card-usage"
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
                onChange={(v) => setForm((f) => ({ ...f, bcbTotalDebt: v }))}
                testId="input-bcb-total-debt"
              />
              <Field
                label="Parcelas mensais BCB (R$/mês)"
                placeholder="Ex: 1.200"
                value={form.bcbMonthlyCommitment}
                onChange={(v) => setForm((f) => ({ ...f, bcbMonthlyCommitment: v }))}
                testId="input-bcb-monthly"
              />
              <Field
                label="Qtd. operações ativas"
                placeholder="Ex: 3"
                value={form.bcbOperationsCount}
                onChange={(v) => setForm((f) => ({ ...f, bcbOperationsCount: v }))}
                testId="input-bcb-ops"
              />
              <Field
                type="text"
                label="Data de referência"
                placeholder="Ex: 05/2026"
                value={form.bcbQueryDate}
                onChange={(v) => setForm((f) => ({ ...f, bcbQueryDate: v }))}
                testId="input-bcb-date"
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

function Field({
  icon: Icon, label, placeholder, value, onChange, max, type = "number", testId,
}: {
  icon?: typeof Car;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  type?: "number" | "text";
  testId?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-600 block mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B8C]/30 focus:border-[#0D1B8C]"
      />
    </div>
  );
}
