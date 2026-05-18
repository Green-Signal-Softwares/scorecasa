import {
  useGetClientProfile, getGetClientProfileQueryKey,
  useGetLeadScore, getGetLeadScoreQueryKey,
  useGetMe, getGetMeQueryKey,
} from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { BankComparison } from "@/components/BankComparison";
import { CreditGPS } from "@/components/CreditGPS";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  CheckCircle, TrendingUp, TrendingDown, Minus,
  BarChart3, SlidersHorizontal, Navigation,
  UserCheck, Wallet, ArrowRight, Lock,
} from "lucide-react";

// ── Onboarding ───────────────────────────────────────────────────────────────
// Determina em qual passo o cliente está. Os scores só ficam visíveis quando
// (1) os dados básicos do perfil estão preenchidos e (2) o cliente conectou
// Bacen (SCR) + Open Finance. Antes disso, mostramos um balão guiando o
// próximo passo, pois sem esses dados o cálculo do score não é confiável.

type OnboardingStage = "profile" | "debts" | "complete";

function getOnboardingStage(lead: any): OnboardingStage {
  const hasBasics =
    !!lead?.birthDate &&
    !!lead?.profession &&
    (lead?.income ?? 0) > 0 &&
    (lead?.propertyValue ?? 0) > 0 &&
    !!lead?.propertyState &&
    !!lead?.propertyCity &&
    !!lead?.maritalStatus;
  const needsSpouse =
    lead?.maritalStatus === "casado" || lead?.maritalStatus === "uniao_estavel";
  const hasSpouse =
    !needsSpouse ||
    (!!lead?.spouseName && !!lead?.spouseCpf && !!lead?.spouseBirthDate);
  if (!hasBasics || !hasSpouse) return "profile";
  const hasOpenFinance = !!lead?.openFinanceConnected;
  const hasBacen = !!lead?.bcbQueryDate;
  if (!hasOpenFinance || !hasBacen) return "debts";
  return "complete";
}

function OnboardingBanner({
  stage,
  lead,
  onGo,
}: {
  stage: Exclude<OnboardingStage, "complete">;
  lead: any;
  onGo: () => void;
}) {
  const isProfile = stage === "profile";
  const Icon = isProfile ? UserCheck : Wallet;
  const title = isProfile
    ? "Vamos completar seus dados primeiro"
    : "Falta conectar Bacen e Open Finance";
  const description = isProfile
    ? "Para calcularmos o Score Caixa, Score MCMV e o Índice de Aprovação, precisamos das suas informações básicas (renda, imóvel desejado, estado civil)."
    : "Agora vincule seu relatório do Banco Central (SCR) e conecte um banco via Open Finance em Minhas dívidas. Sem esses dados, o cálculo do score não fica confiável.";
  const buttonLabel = isProfile ? "Ir para Meus dados" : "Ir para Minhas dívidas";
  const checklist: { label: string; done: boolean }[] = isProfile
    ? [
        { label: "Data de nascimento", done: !!lead?.birthDate },
        { label: "Profissão", done: !!lead?.profession },
        { label: "Renda formal", done: (lead?.income ?? 0) > 0 },
        { label: "Valor e UF do imóvel", done: (lead?.propertyValue ?? 0) > 0 && !!lead?.propertyState },
        { label: "Estado civil", done: !!lead?.maritalStatus },
      ]
    : [
        { label: "Relatório do Banco Central (SCR)", done: !!lead?.bcbQueryDate },
        { label: "Conexão Open Finance", done: !!lead?.openFinanceConnected },
      ];
  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ background: "#EEF1FF", borderColor: "#0D1B8C33" }}
      data-testid={`onboarding-banner-${stage}`}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#0D1B8C" }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color: "#07113A" }}>{title}</h2>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{description}</p>
          <ul className="mt-3 space-y-1.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <CheckCircle
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: item.done ? "#10A65A" : "#CBD5E1" }}
                />
                <span style={{ color: item.done ? "#065F46" : "#475569" }}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onGo}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: "#0D1B8C" }}
            data-testid={`onboarding-cta-${stage}`}
          >
            {buttonLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoresLockedCard({ stage }: { stage: Exclude<OnboardingStage, "complete"> }) {
  return (
    <div className="bg-card rounded-xl border border-card-border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-gray-400" />
        <div className="text-sm font-semibold text-foreground">Análise de Crédito</div>
      </div>
      <p className="text-sm text-muted-foreground">
        {stage === "profile"
          ? "Os scores serão calculados assim que você completar seus dados."
          : "Os scores serão calculados quando você conectar Bacen e Open Finance em Minhas dívidas."}
      </p>
    </div>
  );
}

const IMPACT_CONFIG = {
  positive: { icon: TrendingUp, color: "#10A65A", bg: "#D1FAE5" },
  negative: { icon: TrendingDown, color: "#EF4444", bg: "#FEE2E2" },
  neutral: { icon: Minus, color: "#6B7280", bg: "#F3F4F6" },
};

function ScoreGauge({ value, max = 1000, label }: { value: number; max?: number; label: string }) {
  const pct = (value / max) * 100;
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;
  const color = pct >= 65 ? "#10A65A" : pct >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round"
        />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash + circ * 0.25}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="60" y="58" textAnchor="middle" style={{ fontSize: 18, fontWeight: 700 }} className="fill-foreground">{value}</text>
        <text x="60" y="72" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">de {max}</text>
      </svg>
      <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function ClientPortal() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"analise" | "gps" | "comparativo">("analise");

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
    if (!loadingMe && !me) setLocation("/login");
  }, [loadingMe, me, setLocation]);

  const { data: profile, isLoading } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000 },
  });

  const leadId = profile?.lead?.id ?? 0;
  const { data: score, isLoading: scoreLoading } = useGetLeadScore(leadId, {
    query: { queryKey: getGetLeadScoreQueryKey(leadId), enabled: leadId > 0, staleTime: 30_000 },
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
      <ClientLayout userName={me.name} activePage="dashboard">
        <div className="text-center py-20 text-gray-500">Perfil não encontrado.</div>
      </ClientLayout>
    );
  }

  const { lead } = profile;
  const approvalColor = lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 40 ? "#F59E0B" : "#EF4444";
  const onboardingStage = getOnboardingStage(lead);
  const showOnboarding = onboardingStage !== "complete";

  return (
    <ClientLayout userName={me.name} activePage="dashboard">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Olá, {me.name.split(" ")[0]}.
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe sua análise de crédito, próximos passos e bancos elegíveis.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border mb-4">
        {(
          [
            { key: "analise", label: "Análise", icon: SlidersHorizontal },
            { key: "gps", label: "GPS de Aprovação", icon: Navigation },
            { key: "comparativo", label: "Bancos", icon: BarChart3 },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-testid={`tab-${key}`}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-medium transition-all"
            style={
              tab === key
                ? { background: "#0D1B8C", color: "#fff", boxShadow: "0 1px 4px rgba(13,27,140,.25)" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "comparativo" ? (
        <BankComparison lead={lead as any} />
      ) : tab === "gps" ? (
        <CreditGPS lead={lead as any} />
      ) : showOnboarding ? (
        <div className="space-y-4">
          <OnboardingBanner
            stage={onboardingStage as Exclude<OnboardingStage, "complete">}
            lead={lead}
            onGo={() =>
              setLocation(onboardingStage === "profile" ? "/portal/meus-dados" : "/portal/dividas")
            }
          />
          <ScoresLockedCard stage={onboardingStage as Exclude<OnboardingStage, "complete">} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Scores */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground mb-4">Análise de Crédito</div>
            <div className="flex flex-wrap justify-around gap-6">
              {/* Approval chance gauge */}
              <div className="flex flex-col items-center">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48 * 0.25}`}
                    strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                  />
                  <circle cx="60" cy="60" r="48" fill="none" stroke={approvalColor} strokeWidth="8"
                    strokeDasharray={`${(lead.approvalChance / 100) * 2 * Math.PI * 48 * 0.75} ${2 * Math.PI * 48}`}
                    strokeDashoffset={2 * Math.PI * 48 * 0.125} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  />
                  <text x="60" y="57" textAnchor="middle" style={{ fontSize: 20, fontWeight: 700 }} className="fill-foreground">
                    {lead.approvalChance}%
                  </text>
                  <text x="60" y="70" textAnchor="middle" style={{ fontSize: 9 }} className="fill-muted-foreground">
                    aprovação
                  </text>
                </svg>
                <div className="text-xs font-medium text-muted-foreground mt-1">Índice de Aprovação</div>
              </div>
              <ScoreGauge value={lead.scoreCaixa} max={1000} label="Score Caixa" />
              <ScoreGauge value={lead.scoreMCMV} max={1000} label="Score MCMV" />
            </div>
          </div>

          {/* AI Recommendation */}
          {lead.aiRecommendation && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-2">Recomendação Índice de Aprovação</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.aiRecommendation}</p>
            </div>
          )}

          {/* Score factors */}
          {!scoreLoading && score && score.factors.length > 0 && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-3">Fatores de Score</div>
              <div className="space-y-2.5">
                {score.factors.map((factor) => {
                  const cfg = IMPACT_CONFIG[factor.impact as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.neutral;
                  const Icon = cfg.icon;
                  return (
                    <div key={factor.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: cfg.bg }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold" style={{ color: cfg.color }}>{factor.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{factor.description}</div>
                      </div>
                      {factor.value && (
                        <div className="text-xs font-bold flex-shrink-0" style={{ color: cfg.color }}>{factor.value}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Eligible banks */}
          {!scoreLoading && score?.eligibleBanks && score.eligibleBanks.length > 0 && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <div className="text-sm font-semibold text-foreground mb-3">Bancos Elegíveis</div>
              <div className="flex flex-wrap gap-2">
                {score.eligibleBanks.map((bank) => (
                  <div
                    key={bank}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                    style={{ background: "#0D1B8C" }}
                    data-testid={`bank-${bank}`}
                  >
                    <CheckCircle className="w-3 h-3" />
                    {bank}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ClientLayout>
  );
}
