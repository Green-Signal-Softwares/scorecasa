import { Router } from "express";
import { db, leadsTable, brokersTable, notificationsTable, usersTable, propertiesTable, correspondentsTable } from "@workspace/db";
import { eq, sql, ilike, or, and, desc, inArray } from "drizzle-orm";

async function getSessionUser(req: any) {
  const userId = req.session?.userId as number | undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

// Middleware: exige sessão autenticada em todas as rotas /api/leads
async function requireAuth(req: any, res: any, next: any) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.sessionUser = user;
  next();
}

async function getUserBrokerOrCorrespondentId(user: any) {
  if (user.role === "broker") {
    let [broker] = await db
      .select({ id: brokersTable.id, correspondentId: brokersTable.correspondentId })
      .from(brokersTable)
      .where(sql`lower(${brokersTable.email}) = lower(${user.email})`)
      .limit(1);
    if (!broker) {
      const [newBroker] = await db
        .insert(brokersTable)
        .values({
          name: user.name,
          email: user.email.toLowerCase(),
          phone: "(11) 99999-9999",
          creci: user.creci || "000000",
          status: "active",
        })
        .returning({ id: brokersTable.id, correspondentId: brokersTable.correspondentId });
      broker = newBroker;
    }
    return { brokerId: broker.id, correspondentId: broker.correspondentId ?? null };
  }
  if (user.role === "correspondent") {
    let [correspondent] = await db
      .select({ id: correspondentsTable.id })
      .from(correspondentsTable)
      .where(
        or(
          eq(correspondentsTable.userId, user.id),
          sql`lower(${correspondentsTable.email}) = lower(${user.email})`
        )
      )
      .limit(1);
    if (!correspondent) {
      const [newCorr] = await db
        .insert(correspondentsTable)
        .values({
          name: user.name,
          bank: "caixa",
          code: user.ccaCode || "000000",
          email: user.email.toLowerCase(),
          phone: "(11) 99999-9999",
          userId: user.id,
          status: "active",
        })
        .returning({ id: correspondentsTable.id });
      correspondent = newCorr;
    }
    return { correspondentId: correspondent.id, brokerId: null };
  }
  return { brokerId: null, correspondentId: null };
}

async function hasAccessToLead(sessionUser: any, lead: any): Promise<boolean> {
  if (!sessionUser) return false;
  if (sessionUser.role === "admin" || sessionUser.role === "analyst") return true;
  if (sessionUser.role === "client") {
    return sessionUser.leadId === lead.id;
  }
  if (sessionUser.role === "broker") {
    const { brokerId } = await getUserBrokerOrCorrespondentId(sessionUser);
    return brokerId !== null && lead.brokerId === brokerId;
  }
  if (sessionUser.role === "correspondent") {
    const { correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (correspondentId === null) return false;
    if (lead.correspondentId === correspondentId || lead.linkedCorrespondentId === correspondentId) {
      return true;
    }
    if (lead.brokerId) {
      const [broker] = await db
        .select({ correspondentId: brokersTable.correspondentId })
        .from(brokersTable)
        .where(eq(brokersTable.id, lead.brokerId))
        .limit(1);
      if (broker && broker.correspondentId === correspondentId) {
        return true;
      }
    }
    return false;
  }
  return false;
}
import { cityTier, evaluateMcmv2026, FAIXA_LIMITS } from "@workspace/cities-br";
import {
  computeSbpeRecommendation,
  type LeadInput as OffersLeadInput,
  type SbpeRecommendation,
} from "@workspace/bank-offers";
import {
  CreateLeadBody,
  UpdateLeadBody,
  EnrichLeadBody,
  GetLeadsQueryParams,
  GetLeadParams,
  UpdateLeadParams,
  DeleteLeadParams,
  GetLeadScoreParams,
  EnrichLeadParams,
} from "@workspace/api-zod";

const router = Router();

// Todas as rotas de leads exigem autenticação
router.use(requireAuth);

// ── Privacidade: campos de dívida/BCB são privados do cliente ────────────────
// Campos preenchidos pelo cliente que o staff NUNCA pode escrever via /enrich.
// Os 8 campos BCB ficam ocultos para staff (igual Open Finance); os 4 campos
// de dívidas gerais (parcelas/cartão) ficam visíveis em modo somente-leitura
// para análise de crédito imobiliário.
const STAFF_VISIBLE_DEBT_FIELDS = [
  "vehicleLoanMonthly",
  "otherLoansMonthly",
  "creditCardLimit",
  "creditCardUsage",
] as const;
const BCB_PRIVATE_FIELDS = [
  "bcbTotalDebt",
  "bcbMonthlyCommitment",
  "bcbOperationsCount",
  "bcbQueryDate",
  "bcbDebtsCurrent",
  "bcbDebtsOverdue",
  "bcbCreditLimits",
  "bcbOperationsJson",
] as const;
// Conjunto bloqueado para escrita por staff via /enrich — soma os dois grupos.
const CLIENT_PRIVATE_FIELDS = [
  ...STAFF_VISIBLE_DEBT_FIELDS,
  ...BCB_PRIVATE_FIELDS,
] as const;

// Remove campos privados de um lead a menos que o solicitante seja o próprio
// dono daquele lead (perfil "client" com leadId batendo). Para staff, apenas
// os 8 campos BCB são zerados; as dívidas gerais permanecem visíveis.
function redactPrivateForViewer<T extends { id: number } & Record<string, any>>(
  lead: T,
  viewer: { role: string; leadId: number | null } | null,
): T {
  const isOwner = viewer?.role === "client" && viewer.leadId === lead.id;
  if (isOwner) return lead;
  const copy: any = { ...lead };
  for (const f of BCB_PRIVATE_FIELDS) copy[f] = null;
  return copy as T;
}

interface ScoreInput {
  income: number;
  propertyValue: number;
  informalIncome?: number | null;
  spouseIncome?: number | null;
  hasFgts?: boolean | null;
  fgtsBalance?: number | null;
  employmentType?: string | null;
  employmentMonths?: number | null;
  maritalStatus?: string | null;
  propertyType?: string | null;
  birthDate?: string | null;
  // Bureau / Caixa real data
  serasaScore?: number | null;
  hasNegativations?: boolean | null;
  hasProtests?: boolean | null;
  siricStatus?: string | null;
  fgtsMonths?: number | null;
  caixaScoreReal?: number | null;
  // Comprometimento financeiro ativo
  vehicleLoanMonthly?: number | null;
  creditCardUsage?: number | null;
  otherLoansMonthly?: number | null;
  bcbMonthlyCommitment?: number | null;
  propertyCity?: string | null;
  propertyState?: string | null;
  alreadyOwnsPropertyInPropertyCity?: boolean | null;
  openFinanceConnected?: boolean | null;
  openFinanceAvgBalance?: number | null;
  openFinanceRecurringIncome?: number | null;
  openFinanceCardUsage?: number | null;
  openFinanceNoLatePayments?: boolean | null;
  openFinanceCpfClear?: boolean | null;
}

// ── Fórmula ScoreCasa v1 — Índice de Aprovação Caixa ─────────────────────
//
// Pontuação total = 100, dividida em 6 blocos:
//   1. Comprometimento de renda          (30)
//   2. Entrada + FGTS + subsídio         (20)
//   3. Score de crédito (Serasa/SPC)     (15)
//   4. Renda elegível                    (15)
//   5. Imóvel elegível                   (10)
//   6. Histórico financeiro / Open Fin.  (10)
//
// Cada bloco é exposto separadamente no GET /leads/:id/score como um fator
// com o nome, peso máximo e pontuação obtida — assim a UI consegue mostrar
// "Comprometimento: 25/30" etc.

export interface ScoreBlock {
  key:
    | "comprometimento"
    | "entrada_fgts"
    | "score_credito"
    | "renda_elegivel"
    | "imovel"
    | "historico";
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface ScoreBreakdown {
  approvalChance: number;
  scoreCaixa: number;
  scoreMCMV: number;
  aiRecommendation: string;
  blocks: ScoreBlock[];
  sbpeRecommendation: SbpeRecommendation | null;
}

// Constrói o LeadInput esperado pelo motor de bank-offers a partir do mesmo
// payload usado em computeScore + os 3 scores já calculados na rodada atual.
// Mantido próximo da função do `routes/client.ts` para SSOT.
function buildOffersInput(
  input: ScoreInput,
  scoreCaixa: number,
  scoreMCMV: number,
  approvalChance: number,
): OffersLeadInput {
  return {
    income: input.income,
    propertyValue: input.propertyValue,
    hasFgts: input.hasFgts,
    fgtsBalance: input.fgtsBalance,
    employmentType: input.employmentType,
    maritalStatus: input.maritalStatus,
    spouseIncome: input.spouseIncome,
    informalIncome: input.informalIncome,
    scoreCaixa,
    scoreMCMV,
    approvalChance,
    serasaScore: input.serasaScore,
    hasNegativations: input.hasNegativations,
    hasProtests: input.hasProtests,
    siricStatus: input.siricStatus,
    propertyType: input.propertyType,
  };
}

/** Estima a parcela mensal alvo do financiamento (Tabela Price aproximada,
 *  360 meses, 10,49% a.a. + TR). Usado para calcular comprometimento e
 *  renda mínima necessária. */
function estimateMonthlyInstallment(financedAmount: number): number {
  if (financedAmount <= 0) return 0;
  const monthlyRate = (1 + 0.1049) ** (1 / 12) - 1 + 0.0162 / 12;
  const n = 360;
  return (financedAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -n);
}

function computeScore(input: ScoreInput): ScoreBreakdown {
  const {
    income,
    propertyValue,
    informalIncome = 0,
    spouseIncome = 0,
    hasFgts = false,
    fgtsBalance = 0,
    propertyType,
    propertyCity,
    propertyState,
    alreadyOwnsPropertyInPropertyCity,
  } = input;

  const {
    serasaScore,
    hasNegativations,
    hasProtests,
    siricStatus,
    caixaScoreReal,
    vehicleLoanMonthly,
    creditCardUsage,
    otherLoansMonthly,
    bcbMonthlyCommitment,
    openFinanceConnected,
    openFinanceAvgBalance,
    openFinanceRecurringIncome,
    openFinanceCardUsage,
    openFinanceNoLatePayments,
    openFinanceCpfClear,
  } = input;

  // ── Renda comprovada (formal + 70% informal + cônjuge) ─────────────────
  const rendaComprovada =
    income + (informalIncome ?? 0) * 0.7 + (spouseIncome ?? 0);

  // Assumimos 80% LTV padrão Caixa. O componente de entrada é o que sobra.
  const entradaEstimadaCash = Math.max(0, propertyValue * 0.2);
  const valorFinanciado = Math.max(0, propertyValue - entradaEstimadaCash);
  const parcelaAlvo = estimateMonthlyInstallment(valorFinanciado);
  const rendaNecessaria = parcelaAlvo / 0.3; // teto Caixa: parcela ≤ 30% da renda
  const monthlyDebt =
    (vehicleLoanMonthly ?? 0) +
    (otherLoansMonthly ?? 0) +
    (bcbMonthlyCommitment ?? 0);
  const margemDisponivel = Math.max(0, rendaComprovada * 0.3 - monthlyDebt);
  const indiceComprometimento =
    margemDisponivel > 0 ? parcelaAlvo / margemDisponivel : 999;

  // ── 1. Comprometimento de renda (até 30 pts) ───────────────────────────
  let comprometimentoScore = 0;
  if (indiceComprometimento <= 0.8) comprometimentoScore = 30;
  else if (indiceComprometimento <= 0.9) comprometimentoScore = 25;
  else if (indiceComprometimento <= 1.0) comprometimentoScore = 18;
  else if (indiceComprometimento <= 1.1) comprometimentoScore = 8;
  else comprometimentoScore = 0;

  // ── 2. Entrada + FGTS + subsídio (até 20 pts) ──────────────────────────
  const entradaTotal =
    entradaEstimadaCash + (hasFgts ? fgtsBalance ?? 0 : 0);
  const entradaPercentual =
    propertyValue > 0 ? entradaTotal / propertyValue : 0;
  let entradaScore = 0;
  if (entradaPercentual >= 0.3) entradaScore = 20;
  else if (entradaPercentual >= 0.2) entradaScore = 16;
  else if (entradaPercentual >= 0.15) entradaScore = 10;
  else if (entradaPercentual >= 0.1) entradaScore = 6;

  // ── 3. Score de crédito (até 15 pts) ───────────────────────────────────
  let creditoScore = 8; // neutro quando não há Serasa
  if (serasaScore != null) {
    if (serasaScore >= 750) creditoScore = 15;
    else if (serasaScore >= 650) creditoScore = 12;
    else if (serasaScore >= 550) creditoScore = 8;
    else if (serasaScore >= 450) creditoScore = 4;
    else creditoScore = 0;
  }

  // ── 4. Renda elegível (até 15 pts) ─────────────────────────────────────
  const razaoRenda =
    rendaNecessaria > 0 ? rendaComprovada / rendaNecessaria : 0;
  let rendaScore = 0;
  if (razaoRenda >= 1.2) rendaScore = 15;
  else if (razaoRenda >= 1.0) rendaScore = 12;
  else if (razaoRenda >= 0.9) rendaScore = 7;
  else rendaScore = 0;

  // ── 5. Imóvel elegível (até 10 pts) ────────────────────────────────────
  //
  // Elegibilidade MCMV 2026 agora considera classificação A/B/C/D/E do
  // município (lib `@workspace/cities-br`) e a faixa de renda familiar.
  // Tetos F1/F2:  A 275k · B 270k · C 260k · D 255k · E 230k
  // Tetos F3 = 400k, F4 = 600k (independentes do tier)
  // Quando `alreadyOwnsPropertyInPropertyCity` = true, MCMV (FAR/PMCMV)
  // está bloqueado por regra do programa: titular não pode possuir outro
  // imóvel urbano no mesmo município. Nesse caso o scoreMCMV é zerado.
  const tier = cityTier(propertyState, propertyCity);
  const mcmvEval = evaluateMcmv2026({
    monthlyHouseholdIncome: rendaComprovada,
    propertyValue,
    tier,
  });
  const ownsBlocker = alreadyOwnsPropertyInPropertyCity === true;
  const isMcmv = mcmvEval.eligible && !ownsBlocker;
  const valorDentroTeto = propertyValue <= 1_500_000 || isMcmv;
  let imovelScore = 0;
  if (propertyType) imovelScore += 4; // tipo definido = regularizado
  if (valorDentroTeto) imovelScore += 3;
  if (propertyCity && propertyState) imovelScore += 2;
  if (propertyType && propertyType !== "terreno") imovelScore += 1;
  imovelScore = Math.min(10, imovelScore);

  // ── 6. Histórico financeiro / Open Finance (até 10 pts) ────────────────
  let historicoScore = 0;
  if (openFinanceConnected) {
    if (openFinanceNoLatePayments) historicoScore += 3;
    if ((openFinanceAvgBalance ?? 0) > 500) historicoScore += 2;
    if ((openFinanceRecurringIncome ?? 0) > 0) historicoScore += 2;
    if ((openFinanceCardUsage ?? 100) < 50) historicoScore += 2;
    if (openFinanceCpfClear) historicoScore += 1;
  } else {
    // Sem Open Finance: usa sinais existentes como proxy parcial.
    if (!hasNegativations) historicoScore += 3;
    if (!hasProtests) historicoScore += 2;
    if ((creditCardUsage ?? 100) < 50) historicoScore += 2;
    if (siricStatus === "regular") historicoScore += 1;
    if (serasaScore != null && serasaScore >= 600) historicoScore += 1;
  }
  historicoScore = Math.min(10, historicoScore);

  const approvalChance = Math.round(
    comprometimentoScore +
      entradaScore +
      creditoScore +
      rendaScore +
      imovelScore +
      historicoScore,
  );

  // Score Caixa (0–1000): usa real se disponível, senão deriva.
  const scoreCaixa =
    caixaScoreReal != null
      ? Math.min(1000, Math.max(0, caixaScoreReal))
      : Math.min(1000, Math.round(300 + (approvalChance / 100) * 600));

  // scoreMCMV: 1000 quando elegível pelas regras 2026 (faixa+teto+tier) e
  // sem bloqueio de "já possui imóvel no município". Caso contrário, o
  // score cai conforme o motivo: bloqueio explícito → 0; só fora da faixa
  // → ≤300; só fora do teto do tier → ≤500.
  let scoreMCMV: number;
  if (ownsBlocker) {
    scoreMCMV = 0;
  } else if (mcmvEval.eligible) {
    scoreMCMV = Math.min(1000, 550 + Math.round(approvalChance * 3));
  } else if (!mcmvEval.fitsFaixa) {
    // Renda fora das 4 faixas → não atende MCMV de jeito nenhum.
    scoreMCMV = Math.min(300, 100 + Math.round(approvalChance * 1.2));
  } else {
    // Renda OK mas valor do imóvel acima do teto do município.
    scoreMCMV = Math.min(500, 250 + Math.round(approvalChance * 1.5));
  }

  // ── Recomendação ─────────────────────────────────────────────────────
  let classificacao = "";
  if (approvalChance >= 90) classificacao = "Muito alta chance de aprovação";
  else if (approvalChance >= 75) classificacao = "Alta chance de aprovação";
  else if (approvalChance >= 60) classificacao = "Boa chance de aprovação";
  else if (approvalChance >= 40) classificacao = "Chance moderada";
  else classificacao = "Baixa chance no momento";

  // ── SBPE recommendation (pivot quando MCMV está bloqueado) ───────────
  // Reaproveita o motor de bank-offers para gerar uma lista de bancos SBPE
  // elegíveis, faixa de taxa e parcela indicativa. Só preenchido quando o
  // bloqueador "já possui imóvel no município" está ativo, pois é o caso em
  // que o broker precisa de uma alternativa imediata.
  const sbpeRecommendation: SbpeRecommendation | null = ownsBlocker
    ? computeSbpeRecommendation(
        buildOffersInput(input, scoreCaixa, scoreMCMV, approvalChance),
      )
    : null;

  const improvements: string[] = [];
  if (comprometimentoScore < 18) improvements.push("reduzir parcelas ativas ou o valor financiado");
  if (entradaScore < 10) improvements.push("aumentar a entrada (incluindo FGTS)");
  if (creditoScore < 8) improvements.push("subir o score Serasa antes de pedir o crédito");
  if (rendaScore < 7) improvements.push("aumentar a renda comprovada (cônjuge, informal)");
  if (historicoScore < 5 && !openFinanceConnected)
    improvements.push("conectar o Open Finance para mostrar histórico positivo");

  let recommendation: string;
  if (ownsBlocker) {
    // Em vez de só dizer "MCMV bloqueado, avaliar SBPE", traduz o pivot em
    // números concretos (bancos, faixa de taxa, parcela, LTV, entrada).
    const cityLabel = propertyCity ? ` em ${propertyCity}${propertyState ? `/${propertyState}` : ""}` : "";
    if (sbpeRecommendation) {
      const banksList = sbpeRecommendation.banks
        .slice(0, 3)
        .map((b) => b.shortName)
        .join(", ");
      const { min, max } = sbpeRecommendation.rateRange;
      const rateLabel = min === max ? `${min.toFixed(2)}% a.a.` : `${min.toFixed(2)}–${max.toFixed(2)}% a.a.`;
      const parcela = Math.round(sbpeRecommendation.bestMonthlyInstallment).toLocaleString("pt-BR");
      const entrada = Math.round(sbpeRecommendation.estimatedDownPayment).toLocaleString("pt-BR");
      const ltvPct = Math.round(sbpeRecommendation.maxFinancedPct * 100);
      const parts = [
        `${classificacao}`,
        `MCMV bloqueado: cliente já possui imóvel${cityLabel} (regra FAR/PMCMV). Pivote para SBPE: ${banksList} com taxa ${rateLabel}, parcela estimada R$ ${parcela} em ${sbpeRecommendation.termYears} anos (LTV até ${ltvPct}%, entrada ~R$ ${entrada})`,
      ];
      if (improvements.length) {
        parts.push(`Para fortalecer a análise: ${improvements.join("; ")}`);
      }
      recommendation = `${parts.join(". ")}.`;
    } else {
      // Sem nenhuma oferta SBPE elegível: explicita os pontos a corrigir.
      const parts = [
        `${classificacao}`,
        `MCMV bloqueado: cliente já possui imóvel${cityLabel} (regra FAR/PMCMV). Nenhum banco SBPE elegível com os dados atuais`,
      ];
      if (improvements.length) parts.push(`Resolver antes: ${improvements.join("; ")}`);
      recommendation = `${parts.join(". ")}.`;
    }
  } else {
    const fraquezas: string[] = [];
    if (mcmvEval.fitsFaixa && !mcmvEval.fitsCap) {
      fraquezas.push(
        `MCMV indisponível: valor do imóvel (R$ ${propertyValue.toLocaleString("pt-BR")}) acima do teto de R$ ${mcmvEval.cap.toLocaleString("pt-BR")} para tier ${tier} na faixa ${mcmvEval.faixa}`,
      );
    } else if (!mcmvEval.fitsFaixa) {
      fraquezas.push(
        `MCMV indisponível: renda familiar (R$ ${Math.round(rendaComprovada).toLocaleString("pt-BR")}) acima do teto da Faixa 4 (R$ ${FAIXA_LIMITS.F4.toLocaleString("pt-BR")})`,
      );
    }
    fraquezas.push(...improvements);
    recommendation = fraquezas.length
      ? `${classificacao}. Para melhorar: ${fraquezas.join("; ")}.`
      : `${classificacao}. Perfil pronto para avançar com a Caixa.`;
  }

  const blocks: ScoreBlock[] = [
    {
      key: "comprometimento",
      label: "Comprometimento de renda",
      weight: 30,
      score: comprometimentoScore,
      detail:
        indiceComprometimento === 999
          ? "Margem de 30% comprometida com parcelas atuais"
          : `Parcela estimada usa ${(indiceComprometimento * 100).toFixed(0)}% da margem de 30% da renda`,
    },
    {
      key: "entrada_fgts",
      label: "Entrada + FGTS",
      weight: 20,
      score: entradaScore,
      detail: `Estimativa: entrada mínima de 20% + FGTS = ${(entradaPercentual * 100).toFixed(0)}% do imóvel`,
    },
    {
      key: "score_credito",
      label: "Score Serasa/SPC",
      weight: 15,
      score: creditoScore,
      detail:
        serasaScore != null
          ? `Score atual: ${serasaScore}`
          : "Score Serasa não informado",
    },
    {
      key: "renda_elegivel",
      label: "Renda familiar compatível",
      weight: 15,
      score: rendaScore,
      detail: `Renda comprovada R$ ${Math.round(rendaComprovada).toLocaleString("pt-BR")} vs necessária R$ ${Math.round(rendaNecessaria).toLocaleString("pt-BR")}`,
    },
    // O bloco "imovel" recebe um detalhe mais rico explicando o motivo
    // exato de o MCMV estar ou não disponível (tier, faixa, teto, blocker).
    {
      key: "imovel",
      label: "Imóvel dentro das regras",
      weight: 10,
      score: imovelScore,
      detail: ownsBlocker
        ? "MCMV bloqueado: já possui imóvel no município"
        : isMcmv
          ? `Elegível MCMV ${mcmvEval.faixa} · tier ${tier} · teto R$ ${mcmvEval.cap.toLocaleString("pt-BR")}`
          : mcmvEval.fitsFaixa && !mcmvEval.fitsCap
            ? `Acima do teto MCMV ${mcmvEval.faixa} para tier ${tier} (R$ ${mcmvEval.cap.toLocaleString("pt-BR")})`
            : !mcmvEval.fitsFaixa
              ? "Renda fora da Faixa 4 do MCMV"
              : valorDentroTeto
                ? "Imóvel dentro do teto SBPE"
                : "Valor do imóvel acima do teto SBPE",
    },
    {
      key: "historico",
      label: openFinanceConnected
        ? "Histórico via Open Finance"
        : "Histórico financeiro",
      weight: 10,
      score: historicoScore,
      detail: openFinanceConnected
        ? "Dados bancários conectados via Open Finance"
        : "Conecte o Open Finance para ganhar mais pontos neste bloco",
    },
  ];

  return {
    approvalChance: Math.max(0, Math.min(100, approvalChance)),
    scoreCaixa,
    scoreMCMV,
    aiRecommendation: recommendation,
    blocks,
    sbpeRecommendation,
  };
}

router.get("/", async (req, res) => {
  const parsed = GetLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { status, search, page = 1, limit = 20 } = parsed.data;
  const offset = (page - 1) * limit;

  // Cliente individual: só vê o próprio lead
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    if (!sessionUser.leadId) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, sessionUser.leadId)).limit(1);
    if (!lead) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    let brokerName: string | null = null;
    if (lead.brokerId) {
      const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
      brokerName = broker?.name ?? null;
    }
    res.json({
      data: [{ ...lead, brokerName, createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString() }],
      total: 1,
      page,
      limit,
    });
    return;
  }

  const conditions = [];
  if (status) conditions.push(eq(leadsTable.status, status as any));
  if (search) {
    conditions.push(
      or(
        ilike(leadsTable.name, `%${search}%`),
        ilike(leadsTable.email, `%${search}%`),
        ilike(leadsTable.cpf, `%${search}%`),
      )!
    );
  }

  if (sessionUser?.role === "broker") {
    const { brokerId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!brokerId) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    conditions.push(eq(leadsTable.brokerId, brokerId));
  } else if (sessionUser?.role === "correspondent") {
    const { correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (!correspondentId) {
      res.json({ data: [], total: 0, page, limit });
      return;
    }
    const linkedBrokers = await db
      .select({ id: brokersTable.id })
      .from(brokersTable)
      .where(eq(brokersTable.correspondentId, correspondentId));
    const brokerIds = linkedBrokers.map((b) => b.id);
    const orConditions = [
      eq(leadsTable.correspondentId, correspondentId),
      eq(leadsTable.linkedCorrespondentId, correspondentId),
    ];
    if (brokerIds.length > 0) {
      orConditions.push(inArray(leadsTable.brokerId, brokerIds));
    }
    conditions.push(or(...orConditions)!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [leads, countResult] = await Promise.all([
    db.select().from(leadsTable).where(where).orderBy(desc(leadsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(leadsTable).where(where),
  ]);

  const brokerIds = [...new Set(leads.map((l) => l.brokerId).filter(Boolean))] as number[];
  let brokerMap: Record<number, string> = {};
  if (brokerIds.length > 0) {
    const brokers = await db.select({ id: brokersTable.id, name: brokersTable.name }).from(brokersTable).where(
      sql`${brokersTable.id} = ANY(${sql.raw(`ARRAY[${brokerIds.join(",")}]::int[]`)})`,
    );
    brokerMap = Object.fromEntries(brokers.map((b) => [b.id, b.name]));
  }

  const viewer = sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null;
  const data = leads.map((l) => redactPrivateForViewer({
    ...l,
    brokerName: l.brokerId ? (brokerMap[l.brokerId] ?? null) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }, viewer));

  res.json({ data, total: countResult[0]?.count ?? 0, page, limit });
});

router.post("/", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem criar leads de terceiros." });
    return;
  }
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { blocks: _initBlocks, sbpeRecommendation: _initSbpe, ...scores } = computeScore(parsed.data);

  // Validar imóvel vinculado quando informado: precisa existir em properties.id
  // para garantir consistência referencial (FK) e evitar 500 do banco.
  if (parsed.data.linkedPropertyId != null) {
    const [prop] = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, parsed.data.linkedPropertyId))
      .limit(1);
    if (!prop) {
      res.status(400).json({ error: "Imóvel vinculado não encontrado.", fields: ["linkedPropertyId"] });
      return;
    }
  }

  let additionalValues: Record<string, any> = {};
  if (sessionUser?.role === "broker") {
    const { brokerId, correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
    if (brokerId) {
      additionalValues.brokerId = brokerId;
    }
    if (correspondentId) {
      additionalValues.correspondentId = correspondentId;
      additionalValues.linkedCorrespondentId = correspondentId;
    }
    // Delete any brokerId from request payload to guarantee the lead is assigned only to the logged-in broker
    delete (parsed.data as any).brokerId;
  }

  const [lead] = await db
    .insert(leadsTable)
    .values({
      ...parsed.data,
      ...scores,
      ...additionalValues,
      status: "pending",
    })
    .returning();

  if (lead.brokerId) {
    await db
      .update(brokersTable)
      .set({ totalLeads: sql`${brokersTable.totalLeads} + 1` })
      .where(eq(brokersTable.id, lead.brokerId));
  }

  res.status(201).json({
    ...lead,
    brokerName: null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  });
});

router.post("/link-client", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role !== "broker") {
    res.status(403).json({ error: "Apenas corretores podem vincular clientes pelo CPF." });
    return;
  }

  const { cpf } = req.body;
  if (!cpf) {
    res.status(400).json({ error: "CPF é obrigatório." });
    return;
  }

  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) {
    res.status(400).json({ error: "CPF inválido." });
    return;
  }

  // 1. Procurar o cliente/usuário na plataforma com esse CPF
  const [clientUser] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.cpf, cleanCpf), eq(usersTable.role, "client")))
    .limit(1);

  if (!clientUser) {
    res.status(404).json({ error: "Cliente não cadastrado na plataforma com este CPF." });
    return;
  }

  let leadId = clientUser.leadId;
  if (!leadId) {
    const [existingLead] = await db
      .select({ id: leadsTable.id })
      .from(leadsTable)
      .where(eq(leadsTable.cpf, cleanCpf))
      .limit(1);
    
    if (existingLead) {
      leadId = existingLead.id;
      await db.update(usersTable).set({ leadId }).where(eq(usersTable.id, clientUser.id));
    }
  }

  if (!leadId) {
    res.status(404).json({ error: "Cadastro do cliente incompleto (Lead não encontrado)." });
    return;
  }

  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, leadId))
    .limit(1);

  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }

  const { brokerId, correspondentId } = await getUserBrokerOrCorrespondentId(sessionUser);
  if (!brokerId) {
    res.status(400).json({ error: "Corretor sem cadastro ativo." });
    return;
  }

  if (lead.brokerId) {
    if (lead.brokerId === brokerId) {
      res.status(400).json({ error: "Você já está vinculado a este cliente." });
      return;
    } else {
      res.status(400).json({ error: "Este cliente já está vinculado a outro corretor." });
      return;
    }
  }

  // 2. Atualizar o lead
  const updates: Record<string, any> = {
    brokerId,
  };
  if (correspondentId) {
    updates.correspondentId = correspondentId;
    updates.linkedCorrespondentId = correspondentId;
  }

  await db.update(leadsTable).set(updates).where(eq(leadsTable.id, leadId));

  // 3. Incrementar totalLeads do corretor
  await db
    .update(brokersTable)
    .set({ totalLeads: sql`${brokersTable.totalLeads} + 1` })
    .where(eq(brokersTable.id, brokerId));

  // 4. Criar notificação para o cliente
  await db.insert(notificationsTable).values({
    userId: clientUser.id,
    type: "lead_status",
    leadId: lead.id,
    leadName: lead.name,
    message: `Você foi vinculado ao corretor ${sessionUser.name}.`,
    isRead: false,
  });

  res.json({ ok: true, leadId });
});

router.get("/:id", async (req, res) => {
  const parsed = GetLeadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const sessionUser = await getSessionUser(req);
  if (!await hasAccessToLead(sessionUser, lead)) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  let brokerName: string | null = null;
  if (lead.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...lead,
    brokerName,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.put("/:id", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Use /api/client/profile para editar seus dados." });
    return;
  }
  const paramsParsed = UpdateLeadParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateLeadBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (!await hasAccessToLead(sessionUser, existing)) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  const updateData: Record<string, any> = { ...bodyParsed.data, updatedAt: new Date() };
  if (sessionUser?.role === "broker") {
    delete updateData.brokerId;
  }
  if (bodyParsed.data.income !== undefined || bodyParsed.data.propertyValue !== undefined) {
    const breakdown = computeScore({
      income: bodyParsed.data.income ?? existing.income,
      propertyValue: bodyParsed.data.propertyValue ?? existing.propertyValue,
      informalIncome: existing.informalIncome,
      spouseIncome: existing.spouseIncome,
      hasFgts: existing.hasFgts,
      fgtsBalance: existing.fgtsBalance,
      employmentType: existing.employmentType,
      employmentMonths: existing.employmentMonths,
      maritalStatus: existing.maritalStatus,
      propertyType: existing.propertyType,
      propertyCity: existing.propertyCity,
      propertyState: existing.propertyState,
      alreadyOwnsPropertyInPropertyCity: existing.alreadyOwnsPropertyInPropertyCity,
      birthDate: existing.birthDate,
      serasaScore: existing.serasaScore,
      hasNegativations: existing.hasNegativations,
      hasProtests: existing.hasProtests,
      siricStatus: existing.siricStatus,
      caixaScoreReal: existing.caixaScoreReal,
      vehicleLoanMonthly: existing.vehicleLoanMonthly,
      creditCardUsage: existing.creditCardUsage,
      otherLoansMonthly: existing.otherLoansMonthly,
      bcbMonthlyCommitment: existing.bcbMonthlyCommitment,
      openFinanceConnected: existing.openFinanceConnected,
      openFinanceAvgBalance: existing.openFinanceAvgBalance,
      openFinanceRecurringIncome: existing.openFinanceRecurringIncome,
      openFinanceCardUsage: existing.openFinanceCardUsage,
      openFinanceNoLatePayments: existing.openFinanceNoLatePayments,
      openFinanceCpfClear: existing.openFinanceCpfClear,
    });
    const { blocks: _b, sbpeRecommendation: _sbpe, ...scoreFields } = breakdown;
    Object.assign(updateData, scoreFields);
  }

  if (bodyParsed.data.status === "approved" && existing.status !== "approved" && existing.brokerId) {
    await db
      .update(brokersTable)
      .set({ approvedLeads: sql`${brokersTable.approvedLeads} + 1` })
      .where(eq(brokersTable.id, existing.brokerId));
  }

  const [updated] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, paramsParsed.data.id)).returning();

  if (bodyParsed.data.status && bodyParsed.data.status !== existing.status) {
    const statusLabels: Record<string, string> = {
      pending: "Pendente",
      analyzing: "Em Análise",
      approved: "Aprovado",
      rejected: "Reprovado",
      in_progress: "Em Andamento",
    };
    const fromLabel = statusLabels[existing.status] ?? existing.status;
    const toLabel = statusLabels[bodyParsed.data.status] ?? bodyParsed.data.status;
    await db.insert(notificationsTable).values({
      leadId: updated.id,
      leadName: updated.name,
      previousStatus: existing.status,
      newStatus: bodyParsed.data.status,
      message: `${updated.name} mudou de ${fromLabel} para ${toLabel}`,
    });
  }

  let brokerName: string | null = null;
  if (updated.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, updated.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...updated,
    brokerName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.delete("/:id", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem excluir leads." });
    return;
  }
  const parsed = DeleteLeadParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (!await hasAccessToLead(sessionUser, existing)) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, parsed.data.id));
  res.status(204).send();
});

router.put("/:id/enrich", async (req, res) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser?.role === "client") {
    res.status(403).json({ error: "Clientes não podem enriquecer dados de leads." });
    return;
  }
  const paramsParsed = EnrichLeadParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = EnrichLeadBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, paramsParsed.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (!await hasAccessToLead(sessionUser, existing)) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  // Bloqueia campos privados do cliente: corretor não pode escrever dívidas/BCB
  // do lead. Esses dados pertencem ao cliente (igual Open Finance) e são
  // enviados via /api/client/debts ou /api/client/scr-import pelo próprio dono.
  const rawEnrich = bodyParsed.data as Record<string, any>;
  const enrichData: Record<string, any> = { ...rawEnrich };
  for (const f of CLIENT_PRIVATE_FIELDS) {
    if (f in enrichData) delete enrichData[f];
  }

  const breakdown = computeScore({
    income: existing.income,
    propertyValue: existing.propertyValue,
    informalIncome: existing.informalIncome,
    spouseIncome: existing.spouseIncome,
    hasFgts: existing.hasFgts,
    fgtsBalance: existing.fgtsBalance,
    employmentType: existing.employmentType,
    employmentMonths: existing.employmentMonths,
    maritalStatus: existing.maritalStatus,
    propertyType: existing.propertyType,
    propertyCity: existing.propertyCity,
    propertyState: existing.propertyState,
    alreadyOwnsPropertyInPropertyCity: existing.alreadyOwnsPropertyInPropertyCity,
    birthDate: existing.birthDate,
    serasaScore: enrichData.serasaScore ?? existing.serasaScore,
    hasNegativations: enrichData.hasNegativations ?? existing.hasNegativations,
    hasProtests: enrichData.hasProtests ?? existing.hasProtests,
    siricStatus: enrichData.siricStatus ?? existing.siricStatus,
    fgtsMonths: enrichData.fgtsMonths ?? existing.fgtsMonths,
    caixaScoreReal: enrichData.caixaScoreReal ?? existing.caixaScoreReal,
    // Mantém o efeito dos campos privados no score (preservados pelo cliente).
    vehicleLoanMonthly: existing.vehicleLoanMonthly,
    creditCardUsage: existing.creditCardUsage,
    otherLoansMonthly: existing.otherLoansMonthly,
    bcbMonthlyCommitment: existing.bcbMonthlyCommitment,
    openFinanceConnected: existing.openFinanceConnected,
    openFinanceAvgBalance: existing.openFinanceAvgBalance,
    openFinanceRecurringIncome: existing.openFinanceRecurringIncome,
    openFinanceCardUsage: existing.openFinanceCardUsage,
    openFinanceNoLatePayments: existing.openFinanceNoLatePayments,
    openFinanceCpfClear: existing.openFinanceCpfClear,
  });
  const { blocks: _enrichBlocks, sbpeRecommendation: _enrichSbpe, ...scores } = breakdown;

  const [updated] = await db
    .update(leadsTable)
    .set({
      ...enrichData,
      ...scores,
      enrichedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, paramsParsed.data.id))
    .returning();

  let brokerName: string | null = null;
  if (updated.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, updated.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  res.json(redactPrivateForViewer({
    ...updated,
    brokerName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    enrichedAt: updated.enrichedAt ? updated.enrichedAt.toISOString() : null,
  }, sessionUser ? { role: sessionUser.role, leadId: sessionUser.leadId ?? null } : null));
});

router.get("/:id/score", async (req, res) => {
  const parsed = GetLeadScoreParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.id)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const sessionUser = await getSessionUser(req);
  if (!await hasAccessToLead(sessionUser, lead)) {
    res.status(403).json({ error: "Acesso negado a este lead." });
    return;
  }

  // Recalcula os 6 blocos a partir dos dados atuais do lead para retornar
  // o detalhamento ao cliente (UI mostra "Comprometimento: 25/30" etc).
  const breakdown = computeScore({
    income: lead.income,
    propertyValue: lead.propertyValue,
    informalIncome: lead.informalIncome,
    spouseIncome: lead.spouseIncome,
    hasFgts: lead.hasFgts,
    fgtsBalance: lead.fgtsBalance,
    employmentType: lead.employmentType,
    employmentMonths: lead.employmentMonths,
    maritalStatus: lead.maritalStatus,
    propertyType: lead.propertyType,
    propertyCity: lead.propertyCity,
    propertyState: lead.propertyState,
    birthDate: lead.birthDate,
    serasaScore: lead.serasaScore,
    hasNegativations: lead.hasNegativations,
    hasProtests: lead.hasProtests,
    siricStatus: lead.siricStatus,
    fgtsMonths: lead.fgtsMonths,
    caixaScoreReal: lead.caixaScoreReal,
    alreadyOwnsPropertyInPropertyCity: lead.alreadyOwnsPropertyInPropertyCity,
    vehicleLoanMonthly: lead.vehicleLoanMonthly,
    creditCardUsage: lead.creditCardUsage,
    otherLoansMonthly: lead.otherLoansMonthly,
    bcbMonthlyCommitment: lead.bcbMonthlyCommitment,
    openFinanceConnected: lead.openFinanceConnected,
    openFinanceAvgBalance: lead.openFinanceAvgBalance,
    openFinanceRecurringIncome: lead.openFinanceRecurringIncome,
    openFinanceCardUsage: lead.openFinanceCardUsage,
    openFinanceNoLatePayments: lead.openFinanceNoLatePayments,
    openFinanceCpfClear: lead.openFinanceCpfClear,
  });

  // Mapeia cada bloco da fórmula para a estrutura de "factor" que a UI consome.
  const factors = breakdown.blocks.map((b) => {
    const pct = b.score / b.weight;
    const impact = pct >= 0.7 ? "positive" : pct >= 0.4 ? "neutral" : "negative";
    return {
      name: b.label,
      impact,
      description: b.detail,
      value: `${b.score}/${b.weight} pts`,
    };
  });

  // ── Comprometimento mensal informado pelo cliente (parcelas + cartão) ──
  // Soma os 4 campos visíveis para staff: parcela de veículo, outras parcelas
  // e o uso estimado do cartão (limite × % utilização). Aparece sempre que pelo
  // menos um campo foi preenchido pelo cliente; caso contrário, omitido.
  const _vehicle = lead.vehicleLoanMonthly ?? 0;
  const _others = lead.otherLoansMonthly ?? 0;
  const _ccLimit = lead.creditCardLimit;
  const _ccUsage = lead.creditCardUsage;
  const _ccMonthly = _ccLimit != null && _ccUsage != null && _ccLimit > 0 && _ccUsage > 0
    ? (_ccLimit * _ccUsage) / 100
    : 0;
  // Cartão considerado "incompleto" quando o cliente preencheu só um dos dois
  // campos (limite OU utilização). Nesse caso a estimativa em R$ fica imprecisa.
  const _ccPartial =
    (_ccLimit != null && _ccUsage == null) || (_ccLimit == null && _ccUsage != null);
  const _hasAnyDebtField =
    lead.vehicleLoanMonthly != null ||
    lead.otherLoansMonthly != null ||
    lead.creditCardLimit != null ||
    lead.creditCardUsage != null;
  if (_hasAnyDebtField) {
    const monthlyDebtTotal = _vehicle + _others + _ccMonthly;
    const incomePct = lead.income > 0 ? (monthlyDebtTotal / lead.income) * 100 : 0;
    let impact: "positive" | "neutral" | "negative" = "positive";
    let description = "";
    if (monthlyDebtTotal === 0 && _ccPartial) {
      impact = "neutral";
      description = "Cliente preencheu só parte dos dados do cartão — estimativa parcial. Peça que complete limite e % de uso.";
    } else if (monthlyDebtTotal === 0) {
      impact = "positive";
      description = "Cliente declarou não ter parcelas ou uso de cartão — não derruba o score.";
    } else if (incomePct > 30) {
      impact = "negative";
      description = `Comprometimento elevado (${incomePct.toFixed(1)}% da renda) derruba a chance de aprovação.`;
    } else if (incomePct > 15) {
      impact = "neutral";
      description = `Comprometimento moderado (${incomePct.toFixed(1)}% da renda) — atenção ao orçamento.`;
    } else {
      impact = "positive";
      description = `Comprometimento baixo (${incomePct.toFixed(1)}% da renda) — folga para a nova parcela.`;
    }
    factors.push({
      name: "Comprometimento mensal informado pelo cliente",
      impact,
      description,
      value: `R$ ${monthlyDebtTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    });
  }

  const eligibleBanks = [];
  if (breakdown.scoreCaixa >= 600) eligibleBanks.push("Caixa Econômica Federal");
  if (breakdown.scoreCaixa >= 650) eligibleBanks.push("Banco do Brasil");
  if (breakdown.scoreCaixa >= 700) eligibleBanks.push("Bradesco");
  if (breakdown.scoreCaixa >= 720) eligibleBanks.push("Itaú Unibanco");
  if (breakdown.scoreCaixa >= 680) eligibleBanks.push("Santander");

  res.json({
    leadId: lead.id,
    overallScore: breakdown.scoreCaixa,
    approvalChance: breakdown.approvalChance,
    scoreCaixa: breakdown.scoreCaixa,
    scoreMCMV: breakdown.scoreMCMV,
    factors,
    blocks: breakdown.blocks,
    recommendation: breakdown.aiRecommendation,
    eligibleBanks,
    sbpeRecommendation: breakdown.sbpeRecommendation,
  });
});

export default router;
