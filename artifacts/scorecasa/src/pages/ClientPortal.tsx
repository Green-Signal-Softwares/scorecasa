import {
  useGetClientProfile, getGetClientProfileQueryKey,
  useGetLeadScore, getGetLeadScoreQueryKey,
  useGetMe, getGetMeQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { SessionExpiredBanner } from "@/components/SessionExpiredBanner";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { BankComparison } from "@/components/BankComparison";
import { CreditGPS } from "@/components/CreditGPS";
import { SbpeAlternativeCard } from "@/components/portal/SbpeAlternativeCard";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  CheckCircle, TrendingUp, TrendingDown, Minus,
  BarChart3, SlidersHorizontal, Navigation,
  UserCheck, Wallet, ArrowRight, Lock, FileText,
  LayoutDashboard,
} from "lucide-react";

// ── Onboarding ───────────────────────────────────────────────────────────────
// Determina em qual passo o cliente está. Os scores só ficam visíveis quando
// (1) os dados básicos do perfil estão preenchidos e (2) o cliente conectou
// Bacen (SCR) + Open Finance. Antes disso, mostramos um balão guiando o
// próximo passo, pois sem esses dados o cálculo do score não é confiável.

type OnboardingStage = "profile" | "debts" | "docs" | "complete";

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
  // Score aprovado + sem escolha de banco → convida a confirmar Caixa e
  // enviar documentos para iniciar o processo.
  const scoreApproved =
    (lead?.scoreCaixa ?? 0) >= 650 && (lead?.approvalChance ?? 0) >= 60;
  if (scoreApproved && !lead?.proceedWithBank) return "docs";
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
  const Icon = stage === "profile" ? UserCheck : stage === "debts" ? Wallet : FileText;
  const title =
    stage === "profile"
      ? "Vamos completar seus dados primeiro"
      : stage === "debts"
        ? "Falta conectar Bacen e Open Finance"
        : "Seu score foi aprovado — vamos finalizar com a Caixa";
  const description =
    stage === "profile"
      ? "Para calcularmos o Score Caixa, Score MCMV e o Índice de Aprovação, precisamos das suas informações básicas (renda, imóvel desejado, estado civil)."
      : stage === "debts"
        ? "Agora vincule seu relatório do Banco Central (SCR) e conecte um banco via Open Finance em Minhas dívidas. Sem esses dados, o cálculo do score não fica confiável."
        : "Sua análise foi aprovada (Score Caixa ≥ 650 e Índice de Aprovação ≥ 60%). Para iniciar o financiamento, confirme que quer prosseguir com a Caixa e envie seus documentos pessoais em Meus dados → Meus documentos.";
  const buttonLabel =
    stage === "profile"
      ? "Ir para Meus dados"
      : stage === "debts"
        ? "Ir para Minhas dívidas"
        : "Ir para Meus documentos";
  const checklist: { label: string; done: boolean }[] =
    stage === "profile"
      ? [
        { label: "Data de nascimento", done: !!lead?.birthDate },
        { label: "Profissão", done: !!lead?.profession },
        { label: "Renda formal", done: (lead?.income ?? 0) > 0 },
        { label: "Valor e UF do imóvel", done: (lead?.propertyValue ?? 0) > 0 && !!lead?.propertyState },
        { label: "Estado civil", done: !!lead?.maritalStatus },
      ]
      : stage === "debts"
        ? [
          { label: "Relatório do Banco Central (SCR)", done: !!lead?.bcbQueryDate },
          { label: "Conexão Open Finance", done: !!lead?.openFinanceConnected },
        ]
        : [
          { label: "Confirmar Caixa como banco do financiamento", done: lead?.proceedWithBank === "caixa" },
          { label: "Enviar documentos pessoais", done: false },
          { label: "Assinar formulários CEF via gov.br", done: false },
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
  // No stage "docs" os scores JÁ estão prontos — mostramos eles normalmente
  // junto com o banner. Esta tela só bloqueia em "profile" e "debts".
  if (stage === "docs") return null;
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
  const [location, setLocation] = useLocation();
  const activeTab =
    location === "/portal/gps"
      ? "gps"
      : location === "/portal/bancos"
      ? "comparativo"
      : location === "/portal/analise"
      ? "analise"
      : "resumo";

  const { data: me, isLoading: loadingMe, error: meError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  const guard = useSessionGuard();
  const meUnauthorized = meError instanceof ApiError && meError.status === 401;

  useEffect(() => {
    if (loadingMe) return;
    if (meUnauthorized) {
      guard.handleAuthFailure();
      return;
    }
    if (me && me.role !== "client") setLocation("/dashboard");
    if (!me && !meError) setLocation("/login");
  }, [loadingMe, me, meError, meUnauthorized, setLocation, guard]);

  const { data: profile, isLoading, error: profileError } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000, retry: false },
  });

  useEffect(() => {
    if (profileError instanceof ApiError && profileError.status === 401) {
      guard.handleAuthFailure();
    }
  }, [profileError, guard]);

  const leadId = profile?.lead?.id ?? 0;
  const { data: score, isLoading: scoreLoading, error: scoreError } = useGetLeadScore(leadId, {
    query: { queryKey: getGetLeadScoreQueryKey(leadId), enabled: leadId > 0, staleTime: 30_000, retry: false },
  });

  useEffect(() => {
    if (scoreError instanceof ApiError && scoreError.status === 401) {
      guard.handleAuthFailure();
    }
  }, [scoreError, guard]);

  if (guard.sessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#07113A" }}>
        <div className="max-w-md w-full">
          <SessionExpiredBanner
            expired
            description="Sua sessão expirou. Faça login novamente para ver sua análise de crédito atualizada."
            loginLabel="Fazer login"
            onLogin={() => guard.goToLogin()}
          />
        </div>
      </div>
    );
  }

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
      {/* Welcome / Page Header */}
      {activeTab === "resumo" && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
            Olá, {me.name.split(" ")[0]}.
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Bem-vindo ao seu portal. Acompanhe sua análise de crédito, próximos passos e bancos elegíveis.
          </p>
        </div>
      )}

      {activeTab === "analise" && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
              Análise de Score
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Veja em detalhes sua nota de crédito e os fatores que impactam seu perfil de financiamento.
            </p>
          </div>
          {(!showOnboarding || onboardingStage === "docs") && (
            <div className="flex gap-3 bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm self-start sm:self-center">
              <div className="text-center px-3 border-r border-gray-100">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Score Caixa</span>
                <span className="text-base font-extrabold text-[#0D1B8C]">{lead.scoreCaixa}</span>
              </div>
              <div className="text-center px-3">
                <span className="text-[10px] text-gray-400 block uppercase font-bold">Aprovação</span>
                <span className="text-base font-extrabold text-[#10A65A]">{lead.approvalChance}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "gps" && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
            GPS de Aprovação
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Seu roteiro personalizado de ações recomendadas para otimizar suas chances e obter aprovação imobiliária.
          </p>
        </div>
      )}

      {activeTab === "comparativo" && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
            Comparativo de Bancos
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Compare as taxas de juros, parcelas e condições estimadas de financiamento para cada banco parceiro.
          </p>
        </div>
      )}

      {activeTab === "comparativo" ? (
        <BankComparison lead={lead as any} />
      ) : activeTab === "gps" ? (
        <CreditGPS lead={lead as any} />
      ) : activeTab === "analise" ? (
        showOnboarding && onboardingStage !== "docs" ? (
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
            {onboardingStage === "docs" && (
              <OnboardingBanner
                stage="docs"
                lead={lead}
                onGo={() => setLocation("/portal/meus-dados?tab=documentos")}
              />
            )}
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

            {/* Alternativa SBPE — quando o MCMV está bloqueado por já possuir
                imóvel no município, mostramos ao cliente o caminho alternativo
                (parcela, entrada, LTV e bancos elegíveis) sem dados internos
                de aprovação. */}
            {lead.alreadyOwnsPropertyInPropertyCity === true &&
              score?.sbpeRecommendation && (
                <SbpeAlternativeCard rec={score.sbpeRecommendation} />
              )}

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
        )
      ) : (
        /* beautiful new Resumo (Dashboard) view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/Main Column: Welcome & Overview cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome banner card */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#07113A] to-[#0D1B8C] rounded-2xl p-6 text-white border border-white/10 shadow-lg">
              <div className="relative z-10">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-1 rounded-full">
                  Visão Geral do Financiamento
                </span>
                <h2 className="text-xl font-bold mt-3">Status do seu Perfil</h2>
                <p className="text-xs text-blue-100/80 mt-1.5 max-w-md">
                  Aqui está o resumo integrado da sua análise de crédito, chance de aprovação bancária e bancos recomendados.
                </p>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] text-blue-200 uppercase font-semibold">Score Principal</div>
                    <div className="text-2xl font-bold mt-1">
                      {showOnboarding && onboardingStage !== "docs" ? "🔒 Bloqueado" : lead.scoreCaixa ?? "—"}
                    </div>
                    <div className="text-[10px] text-blue-100/70 mt-1">Pontos Caixa Econômica</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] text-blue-200 uppercase font-semibold">Chance de Aprovação</div>
                    <div className="text-2xl font-bold mt-1">
                      {showOnboarding && onboardingStage !== "docs" ? "🔒 Bloqueado" : `${lead.approvalChance ?? 0}%`}
                    </div>
                    <div className="text-[10px] text-blue-100/70 mt-1">Probabilidade Estimada</div>
                  </div>
                </div>
              </div>
              {/* Decorative glowing gradient sphere in bg */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Grid summarizing the three pages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Card 1: Análise de Score */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0D1B8C]/10 flex items-center justify-center text-[#0D1B8C]">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-[#07113A]">Análise de Score</h3>
                  </div>
                  {showOnboarding && onboardingStage !== "docs" ? (
                    <div className="py-4 text-center">
                      <Lock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Complete seus dados e dívidas para liberar os scores.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Seu score está em <strong>{lead.scoreCaixa}</strong>. MCMV pontuou em <strong>{lead.scoreMCMV}</strong>. Fator de impacto destacado:
                      </p>
                      {score?.factors && score.factors[0] ? (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs flex gap-2 mb-4">
                          <span className="text-red-500 font-bold">⚠️</span>
                          <div>
                            <div className="font-bold text-red-800">{score.factors[0].name}</div>
                            <div className="text-red-700/80 mt-0.5">{score.factors[0].description}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-xs flex gap-2 mb-4">
                          <span className="text-[#10A65A] font-bold">✅</span>
                          <div>
                            <div className="font-bold text-green-800 font-medium">Sem fatores negativos</div>
                            <div className="text-green-700/80 mt-0.5">Seu histórico está saudável e regularizado.</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={() => setLocation("/portal/analise")}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-[#07113A] border border-gray-200/80 transition-all mt-4"
                >
                  Ver detalhes da Análise
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card 2: Comparativo Bancos */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10A65A]/10 flex items-center justify-center text-[#10A65A]">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-[#07113A]">Bancos Recomendados</h3>
                  </div>
                  {showOnboarding && onboardingStage !== "docs" ? (
                    <div className="py-4 text-center">
                      <Lock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Conecte o Open Finance para comparar taxas de bancos.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Baseado na renda de <strong>{lead.income ? (lead.income).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}</strong>, veja os bancos recomendados:
                      </p>
                      <div className="space-y-2 mb-4">
                        {score?.eligibleBanks && score.eligibleBanks.length > 0 ? (
                          score.eligibleBanks.slice(0, 3).map((bank) => (
                            <div key={bank} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                              <span className="font-semibold text-gray-700">{bank}</span>
                              <span className="text-[10px] font-bold text-[#10A65A] bg-[#10A65A]/10 px-2.5 py-0.5 rounded-full">Elegível</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded-lg text-center">Nenhum banco elegível encontrado</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setLocation("/portal/bancos")}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-[#07113A] border border-gray-200/80 transition-all mt-4"
                >
                  Comparar taxas de Bancos
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: GPS Progress & AI Recommendation */}
          <div className="space-y-6">
            {/* Card 3: GPS de Aprovação */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#07113A]">GPS de Aprovação</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                  Você está na fase <strong>{onboardingStage === "complete" ? "Análise Aprovada" : onboardingStage === "docs" ? "Documentação" : onboardingStage === "debts" ? "Histórico Financeiro" : "Perfil Básico"}</strong> da sua aprovação imobiliária.
                </p>

                {/* Visual progress stepper */}
                <div className="relative pl-6 space-y-4 mb-5 border-l-2 border-gray-100 ml-2">
                  <div className="relative">
                    <div className={`absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${onboardingStage !== "profile" ? "bg-[#10A65A] border-[#10A65A] text-white" : "bg-white border-blue-600 text-blue-600"}`}>
                      {onboardingStage !== "profile" ? "✓" : "1"}
                    </div>
                    <div className="text-xs font-bold text-gray-700 -mt-0.5">Perfil Básico</div>
                    <div className="text-[10px] text-gray-400">Dados cadastrais e de renda</div>
                  </div>
                  <div className="relative">
                    <div className={`absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${onboardingStage === "complete" || onboardingStage === "docs" ? "bg-[#10A65A] border-[#10A65A] text-white" : onboardingStage === "debts" ? "bg-white border-blue-600 text-blue-600" : "bg-white border-gray-300 text-gray-400"}`}>
                      {onboardingStage === "complete" || onboardingStage === "docs" ? "✓" : "2"}
                    </div>
                    <div className="text-xs font-bold text-gray-700 -mt-0.5">Histórico Financeiro</div>
                    <div className="text-[10px] text-gray-400">Open Finance e Registrato</div>
                  </div>
                  <div className="relative">
                    <div className={`absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${onboardingStage === "complete" ? "bg-[#10A65A] border-[#10A65A] text-white" : onboardingStage === "docs" ? "bg-white border-blue-600 text-blue-600" : "bg-white border-gray-300 text-gray-400"}`}>
                      {onboardingStage === "complete" ? "✓" : "3"}
                    </div>
                    <div className="text-xs font-bold text-gray-700 -mt-0.5">Aprovação / Documentação</div>
                    <div className="text-[10px] text-gray-400">Validação e assinatura gov.br</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setLocation("/portal/gps")}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-[#07113A] border border-gray-200/80 transition-all mt-4"
              >
                Acompanhar GPS de Aprovação
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 4: AI Recommendation block */}
            {lead.aiRecommendation && (
              <div className="bg-gradient-to-br from-[#07113A] to-[#0D1B8C] text-white rounded-2xl p-5 shadow-sm border border-white/10 relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold text-[10px] uppercase tracking-wider text-blue-200 mb-2">Recomendação da IA</h4>
                  <p className="text-xs text-blue-100/90 leading-relaxed italic">
                    "{lead.aiRecommendation}"
                  </p>
                </div>
                <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      )}
    </ClientLayout>
  );
}
