import { useGetClientProfile, getGetClientProfileQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { CheckCircle, Clock, XCircle, AlertCircle, TrendingUp, Building2, FileText, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  pending:     { label: "Aguardando Análise", icon: Clock,        color: "#92400e", bg: "#fef3c7" },
  analyzing:   { label: "Em Análise",         icon: RefreshCw,    color: "#1e40af", bg: "#dbeafe" },
  in_progress: { label: "Em Andamento",       icon: AlertCircle,  color: "#6d28d9", bg: "#ede9fe" },
  approved:    { label: "Aprovado",           icon: CheckCircle,  color: "#065f46", bg: "#d1fae5" },
  rejected:    { label: "Reprovado",          icon: XCircle,      color: "#991b1b", bg: "#fee2e2" },
};

function ScoreGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.round((value / max) * 100);
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
          <span className="text-xs text-gray-400">/{max}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
    </div>
  );
}

function BankChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ background: "#F0FDF9", color: "#065f46", borderColor: "#A7F3D0" }}>
      <Building2 className="w-3 h-3" />
      {name}
    </span>
  );
}

const BANK_NAMES: Record<string, string[]> = {
  approved: ["Caixa Econômica Federal", "Banco do Brasil", "Itaú", "Bradesco", "Santander"],
  in_progress: ["Caixa Econômica Federal", "Banco do Brasil"],
  analyzing: ["Caixa Econômica Federal"],
  pending: [],
  rejected: [],
};

export function ClientPortal() {
  const [, setLocation] = useLocation();

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && me && me.role !== "client") {
      setLocation("/dashboard");
    }
    if (!loadingMe && !me) {
      setLocation("/login");
    }
  }, [loadingMe, me, setLocation]);

  const { data: profile, isLoading } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000 },
  });

  if (loadingMe || isLoading || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <ClientLayout userName={me.name}>
        <div className="text-center py-20 text-gray-500">Perfil não encontrado.</div>
      </ClientLayout>
    );
  }

  const { lead } = profile;
  const statusCfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const comprometimento = Math.round((lead.propertyValue / (lead.income * 12)) * 100);
  const banks = BANK_NAMES[lead.status] ?? [];

  const chanceColor = lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 50 ? "#f59e0b" : "#ef4444";
  const scoreCaixaColor = lead.scoreCaixa >= 700 ? "#10A65A" : lead.scoreCaixa >= 500 ? "#f59e0b" : "#ef4444";

  return (
    <ClientLayout userName={me.name}>
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Olá, {me.name.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Aqui está a análise de crédito do seu perfil imobiliário.</p>
      </div>

      {/* Status banner */}
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-6 border"
        style={{ background: statusCfg.bg, borderColor: statusCfg.color + "40" }}
      >
        <StatusIcon className="w-5 h-5 flex-shrink-0" style={{ color: statusCfg.color }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: statusCfg.color }}>Status: {statusCfg.label}</p>
          <p className="text-xs mt-0.5" style={{ color: statusCfg.color + "cc" }}>
            {lead.status === "pending" && "Seu perfil está aguardando análise de um correspondente bancário."}
            {lead.status === "analyzing" && "Um especialista está analisando seu perfil. Em breve você receberá retorno."}
            {lead.status === "in_progress" && "Sua análise está em andamento. Acompanhe as atualizações aqui."}
            {lead.status === "approved" && "Parabéns! Seu perfil foi aprovado. Entre em contato com seu corretor."}
            {lead.status === "rejected" && "Infelizmente seu perfil não foi aprovado neste momento. Veja as recomendações abaixo."}
          </p>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
          <ScoreGauge value={lead.approvalChance} max={100} label="Chance de Aprovação (%)" color={chanceColor} />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
          <ScoreGauge value={lead.scoreCaixa} max={1000} label="Score Caixa" color={scoreCaixaColor} />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
          <ScoreGauge value={lead.scoreMCMV} max={1000} label="Score MCMV" color="#0D1B8C" />
        </div>
      </div>

      {/* Comprometimento de renda */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "#0D1B8C" }} />
            <span className="font-semibold text-sm text-gray-800">Comprometimento de Renda</span>
          </div>
          <span className={`text-sm font-bold ${comprometimento > 100 ? "text-red-500" : comprometimento > 80 ? "text-amber-500" : "text-green-600"}`}>
            {comprometimento}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, comprometimento)}%`,
              background: comprometimento > 100 ? "#ef4444" : comprometimento > 80 ? "#f59e0b" : "#10A65A",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>Imóvel: {lead.propertyValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
          <span>Renda anual: {(lead.income * 12).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Limite Caixa: 4,5× a renda anual</p>
      </div>

      {/* AI Recommendation */}
      {lead.aiRecommendation && (
        <div className="rounded-2xl p-5 mb-4 border" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#0D1B8C" }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "#0D1B8C" }}>Recomendação da IA</p>
              <p className="text-sm text-gray-700 leading-relaxed">{lead.aiRecommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Eligible banks */}
      {banks.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Bancos Elegíveis</p>
          <div className="flex flex-wrap gap-2">
            {banks.map((b) => <BankChip key={b} name={b} />)}
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-4">Seu Perfil Financeiro</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: "Renda Mensal", value: lead.income.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
            { label: "Valor do Imóvel", value: lead.propertyValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
            { label: "CPF", value: lead.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") },
            { label: "Telefone", value: lead.phone },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">{label}</span>
              <span className="text-sm font-medium text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </ClientLayout>
  );
}
