// Shared bank-offers engine. SSOT usado por:
//   • artifacts/scorecasa BankComparison (UI de comparação de bancos)
//   • artifacts/api-server (eligibilidade para o seletor "Meu Financiamento")
// Manter aqui evita que as duas superfícies divirjam.

export interface LeadInput {
  income: number;
  propertyValue: number;
  hasFgts?: boolean | null;
  fgtsBalance?: number | null;
  employmentType?: string | null;
  maritalStatus?: string | null;
  spouseIncome?: number | null;
  informalIncome?: number | null;
  scoreCaixa: number;
  scoreMCMV: number;
  approvalChance: number;
  serasaScore?: number | null;
  hasNegativations?: boolean | null;
  hasProtests?: boolean | null;
  siricStatus?: string | null;
  propertyType?: string | null;
}

export type Program = "MCMV" | "SBPE";
export type EligibilityStatus = "eligible" | "analysis" | "restricted" | "ineligible";

export interface BankOffer {
  bank: string;
  bankSlug: string;
  shortName: string;
  color: string;
  bgColor: string;
  program: Program;
  annualRate: number;
  termYears: number;
  maxLTV: number;
  minDownPaymentPct: number;
  loanAmount: number;
  downPayment: number;
  monthlyInstallment: number;
  totalFinanced: number;
  approvalPct: number;
  status: EligibilityStatus;
  statusLabel: string;
  restrictions: string[];
  highlights: string[];
  isBest: boolean;
}

function calcPMT(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const i = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  if (i === 0) return principal / n;
  return (principal * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface BankConfig {
  bank: string;
  bankSlug: string;
  shortName: string;
  color: string;
  bgColor: string;
  program: Program;
  baseRate: number;
  maxTermYears: number;
  maxLTV: number;
  minDownPct: number;
  approvalMod: number;
  rateAdjustable: boolean;
  requireSiric: boolean;
  minSerasa?: number;
  highlights: string[];
  skipIf?: () => boolean;
}

export function computeOffers(lead: LeadInput): BankOffer[] {
  const totalIncome =
    lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const fgts = lead.hasFgts ? (lead.fgtsBalance ?? 0) : 0;
  const isClT =
    lead.employmentType === "clt" || lead.employmentType === "servidor_publico";
  const siricOk = lead.siricStatus !== "irregular";
  const hasNeg = lead.hasNegativations ?? false;
  const hasProt = lead.hasProtests ?? false;
  const serasa = lead.serasaScore ?? null;

  const serasaMod =
    serasa != null
      ? serasa >= 800 ? +12
      : serasa >= 700 ? +8
      : serasa >= 600 ? +3
      : serasa >= 500 ? -5
      : serasa >= 400 ? -15
      : -25
      : 0;

  const serasaRateAdj =
    serasa != null
      ? serasa >= 750 ? 0
      : serasa >= 650 ? 0.3
      : serasa >= 550 ? 0.7
      : 1.2
      : 0.5;

  const mcmvPropertyOk = lead.propertyValue <= 350000;
  const mcmvIncomeOk = totalIncome <= 8000;
  const mcmvEligible = mcmvIncomeOk && mcmvPropertyOk;

  const mcmvRate = isClT
    ? (totalIncome <= 2640 ? 4.75 : totalIncome <= 4400 ? 5.25 : 6.5)
    : (totalIncome <= 2640 ? 5.25 : totalIncome <= 4400 ? 6.0 : 7.66);

  const baseApproval = lead.approvalChance;

  const configs: BankConfig[] = [
    { bank: "Caixa Econômica Federal", bankSlug: "caixa", shortName: "CEF", color: "#003DA5", bgColor: "#EFF6FF",
      program: "MCMV", baseRate: mcmvRate, maxTermYears: 35, maxLTV: 0.9, minDownPct: 0.1,
      approvalMod: lead.scoreMCMV >= 700 ? +10 : lead.scoreMCMV >= 500 ? 0 : -15,
      rateAdjustable: false, requireSiric: true,
      highlights: ["Menor taxa do mercado", "Prazo até 35 anos", "Usar FGTS na entrada"],
      skipIf: () => !mcmvEligible },
    { bank: "Caixa Econômica Federal", bankSlug: "caixa", shortName: "CEF", color: "#003DA5", bgColor: "#EFF6FF",
      program: "SBPE", baseRate: 11.49, maxTermYears: 35, maxLTV: 0.8, minDownPct: 0.2,
      approvalMod: lead.scoreCaixa >= 700 ? +5 : lead.scoreCaixa >= 500 ? 0 : -10,
      rateAdjustable: false, requireSiric: false,
      highlights: ["Prazo até 35 anos", "Sem limite de renda", "Aceita FGTS complementar"] },
    { bank: "Banco do Brasil", bankSlug: "bb", shortName: "BB", color: "#F5A623", bgColor: "#FFFBEB",
      program: "MCMV", baseRate: mcmvRate + 0.1, maxTermYears: 35, maxLTV: 0.9, minDownPct: 0.1,
      approvalMod: +2, rateAdjustable: false, requireSiric: false,
      highlights: ["Participante MCMV oficial", "Condições equiparadas à Caixa"],
      skipIf: () => !mcmvEligible },
    { bank: "Banco do Brasil", bankSlug: "bb", shortName: "BB", color: "#F5A623", bgColor: "#FFFBEB",
      program: "SBPE", baseRate: 10.69, maxTermYears: 30, maxLTV: 0.8, minDownPct: 0.2,
      approvalMod: +3, rateAdjustable: true, requireSiric: false, minSerasa: 500,
      highlights: ["Taxa competitive no SBPE", "Prazo 30 anos"] },
    { bank: "Bradesco", bankSlug: "bradesco", shortName: "BDC", color: "#CC0000", bgColor: "#FFF1F2",
      program: "SBPE", baseRate: 10.89, maxTermYears: 30, maxLTV: 0.8, minDownPct: 0.2,
      approvalMod: 0, rateAdjustable: true, requireSiric: false, minSerasa: 550,
      highlights: ["Relacionamento via conta corrente", "Desconto para correntistas"] },
    { bank: "Itaú Unibanco", bankSlug: "itau", shortName: "ITÁ", color: "#EC7000", bgColor: "#FFF7ED",
      program: "SBPE", baseRate: 10.79, maxTermYears: 30, maxLTV: 0.82, minDownPct: 0.18,
      approvalMod: -2, rateAdjustable: true, requireSiric: false, minSerasa: 600,
      highlights: ["Maior banco privado", "LTV de até 82%", "Análise rápida"] },
    { bank: "Santander", bankSlug: "santander", shortName: "SAN", color: "#EC0000", bgColor: "#FFF1F2",
      program: "SBPE", baseRate: 10.89, maxTermYears: 30, maxLTV: 0.8, minDownPct: 0.2,
      approvalMod: +1, rateAdjustable: true, requireSiric: false, minSerasa: 550,
      highlights: ["Aceita renda informal até 30%", "Resposta em 48h"] },
    { bank: "Banco Inter", bankSlug: "inter", shortName: "INT", color: "#FF7A00", bgColor: "#FFF7ED",
      program: "SBPE", baseRate: 10.49, maxTermYears: 30, maxLTV: 0.8, minDownPct: 0.2,
      approvalMod: +5, rateAdjustable: true, requireSiric: false, minSerasa: 500,
      highlights: ["100% digital", "Menor burocracia", "Sem tarifas de abertura"] },
  ];

  const offers: BankOffer[] = [];
  for (const cfg of configs) {
    if (cfg.skipIf?.()) continue;
    let approvalPct = clamp(baseApproval + cfg.approvalMod + serasaMod, 0, 98);
    if (hasNeg) approvalPct -= 20;
    if (hasProt) approvalPct -= 30;
    if (cfg.requireSiric && !siricOk) approvalPct = Math.min(approvalPct, 10);
    if (!cfg.requireSiric && !siricOk) approvalPct -= 15;
    approvalPct = clamp(Math.round(approvalPct), 0, 98);

    const hardBlock =
      hasProt ||
      (cfg.requireSiric && !siricOk) ||
      (cfg.minSerasa != null && serasa != null && serasa < cfg.minSerasa - 100);

    let status: EligibilityStatus;
    let statusLabel: string;
    if (approvalPct >= 65 && !hardBlock) { status = "eligible"; statusLabel = "Elegível"; }
    else if (approvalPct >= 35 && !hardBlock) { status = "analysis"; statusLabel = "Análise Necessária"; }
    else if (hardBlock) { status = "ineligible"; statusLabel = "Inapto"; }
    else { status = "restricted"; statusLabel = "Restrições"; }

    const restrictions: string[] = [];
    if (hasProt) restrictions.push("Protestos em cartório (eliminatório)");
    if (hasNeg) restrictions.push("Negativações ativas no Serasa/SPC");
    if (cfg.requireSiric && !siricOk) restrictions.push("SIRIC irregular — bloqueio Caixa");
    else if (!cfg.requireSiric && !siricOk) restrictions.push("SIRIC irregular impacta análise");
    if (cfg.minSerasa && serasa != null && serasa < cfg.minSerasa)
      restrictions.push(`Serasa abaixo do mínimo (${serasa} < ${cfg.minSerasa})`);

    const actualLTV = Math.min(cfg.maxLTV, 0.9);
    const minDownPct = 1 - actualLTV;
    const rawDownPayment = lead.propertyValue * minDownPct;
    const downPayment = Math.max(0, rawDownPayment - fgts);
    const loanAmount = Math.min(lead.propertyValue * actualLTV, lead.propertyValue - downPayment);
    const effectiveRate = cfg.rateAdjustable ? cfg.baseRate + serasaRateAdj : cfg.baseRate;
    const monthlyInstallment = calcPMT(loanAmount, effectiveRate, cfg.maxTermYears);
    const totalFinanced = monthlyInstallment * cfg.maxTermYears * 12;

    offers.push({
      bank: cfg.bank, bankSlug: cfg.bankSlug, shortName: cfg.shortName, color: cfg.color, bgColor: cfg.bgColor,
      program: cfg.program, annualRate: effectiveRate, termYears: cfg.maxTermYears,
      maxLTV: actualLTV, minDownPaymentPct: minDownPct, loanAmount, downPayment,
      monthlyInstallment, totalFinanced, approvalPct, status, statusLabel,
      restrictions, highlights: cfg.highlights, isBest: false,
    });
  }

  const eligibles = offers.filter((o) => o.status === "eligible" || o.status === "analysis");
  if (eligibles.length > 0) {
    const best = eligibles.reduce((a, b) =>
      b.approvalPct > a.approvalPct || (b.approvalPct === a.approvalPct && b.annualRate < a.annualRate) ? b : a
    );
    best.isBest = true;
  }
  return offers;
}

// Devolve o slug dos bancos com pelo menos uma oferta elegível/em análise
// (status que o front considera tocáveis). Espelha exatamente computeOffers.
export function eligibleBankSlugs(lead: LeadInput): Set<string> {
  const offers = computeOffers(lead);
  const set = new Set<string>();
  for (const o of offers) {
    if (o.status === "eligible" || o.status === "analysis") set.add(o.bankSlug);
  }
  return set;
}
