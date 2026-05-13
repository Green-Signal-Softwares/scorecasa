import { useMemo } from "react";
import { CheckCircle, XCircle, AlertCircle, Star, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadInput {
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

type Program = "MCMV" | "SBPE";
type EligibilityStatus = "eligible" | "analysis" | "restricted" | "ineligible";

interface BankOffer {
  bank: string;
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

// ─── Calculations ─────────────────────────────────────────────────────────────

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

function computeOffers(lead: LeadInput): BankOffer[] {
  const totalIncome =
    lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const fgts = lead.hasFgts ? (lead.fgtsBalance ?? 0) : 0;
  const isClT =
    lead.employmentType === "clt" || lead.employmentType === "servidor_publico";
  const siricOk = lead.siricStatus !== "irregular";
  const hasNeg = lead.hasNegativations ?? false;
  const hasProt = lead.hasProtests ?? false;
  const serasa = lead.serasaScore ?? null;

  // Serasa modifier (applied to all private bank approvals)
  const serasaMod =
    serasa != null
      ? serasa >= 800
        ? +12
        : serasa >= 700
        ? +8
        : serasa >= 600
        ? +3
        : serasa >= 500
        ? -5
        : serasa >= 400
        ? -15
        : -25
      : 0;

  // Serasa rate adjustment for private banks
  const serasaRateAdj =
    serasa != null
      ? serasa >= 750
        ? 0
        : serasa >= 650
        ? 0.3
        : serasa >= 550
        ? 0.7
        : 1.2
      : 0.5;

  // MCMV eligibility
  const mcmvPropertyOk = lead.propertyValue <= 350000;
  const mcmvIncomeOk = totalIncome <= 8000;
  const mcmvEligible = mcmvIncomeOk && mcmvPropertyOk;

  // MCMV rate by faixa
  let mcmvRate: number;
  if (isClT) {
    mcmvRate =
      totalIncome <= 2640 ? 4.75 : totalIncome <= 4400 ? 5.25 : 6.5;
  } else {
    mcmvRate =
      totalIncome <= 2640 ? 5.25 : totalIncome <= 4400 ? 6.0 : 7.66;
  }

  const baseApproval = lead.approvalChance;

  // ─── Bank configs ────────────────────────────────────────────────────────
  // Each entry: one row = one program per bank
  interface BankConfig {
    bank: string;
    shortName: string;
    color: string;
    bgColor: string;
    program: Program;
    baseRate: number;
    maxTermYears: number;
    maxLTV: number;
    minDownPct: number;
    approvalMod: number; // relative to baseApproval
    rateAdjustable: boolean; // whether Serasa adjusts rate
    requireSiric: boolean;
    mcmvOnly?: boolean;
    minSerasa?: number;
    highlights: string[];
    skipIf?: () => boolean;
  }

  const configs: BankConfig[] = [
    // ── Caixa MCMV ───────────────────────────────────────────────────────────
    {
      bank: "Caixa Econômica Federal",
      shortName: "CEF",
      color: "#003DA5",
      bgColor: "#EFF6FF",
      program: "MCMV",
      baseRate: mcmvRate,
      maxTermYears: 35,
      maxLTV: 0.9,
      minDownPct: 0.1,
      approvalMod: lead.scoreMCMV >= 700 ? +10 : lead.scoreMCMV >= 500 ? 0 : -15,
      rateAdjustable: false,
      requireSiric: true,
      highlights: ["Menor taxa do mercado", "Prazo até 35 anos", "Usar FGTS na entrada"],
      skipIf: () => !mcmvEligible,
    },
    // ── Caixa SBPE ───────────────────────────────────────────────────────────
    {
      bank: "Caixa Econômica Federal",
      shortName: "CEF",
      color: "#003DA5",
      bgColor: "#EFF6FF",
      program: "SBPE",
      baseRate: 11.49,
      maxTermYears: 35,
      maxLTV: 0.8,
      minDownPct: 0.2,
      approvalMod: lead.scoreCaixa >= 700 ? +5 : lead.scoreCaixa >= 500 ? 0 : -10,
      rateAdjustable: false,
      requireSiric: false,
      highlights: ["Prazo até 35 anos", "Sem limite de renda", "Aceita FGTS complementar"],
      skipIf: () => false,
    },
    // ── Banco do Brasil MCMV ─────────────────────────────────────────────────
    {
      bank: "Banco do Brasil",
      shortName: "BB",
      color: "#F5A623",
      bgColor: "#FFFBEB",
      program: "MCMV",
      baseRate: mcmvRate + 0.1,
      maxTermYears: 35,
      maxLTV: 0.9,
      minDownPct: 0.1,
      approvalMod: +2,
      rateAdjustable: false,
      requireSiric: false,
      highlights: ["Participante MCMV oficial", "Condições equiparadas à Caixa"],
      skipIf: () => !mcmvEligible,
    },
    // ── Banco do Brasil SBPE ─────────────────────────────────────────────────
    {
      bank: "Banco do Brasil",
      shortName: "BB",
      color: "#F5A623",
      bgColor: "#FFFBEB",
      program: "SBPE",
      baseRate: 10.69,
      maxTermYears: 30,
      maxLTV: 0.8,
      minDownPct: 0.2,
      approvalMod: +3,
      rateAdjustable: true,
      requireSiric: false,
      minSerasa: 500,
      highlights: ["Taxa competitive no SBPE", "Prazo 30 anos"],
      skipIf: () => false,
    },
    // ── Bradesco ─────────────────────────────────────────────────────────────
    {
      bank: "Bradesco",
      shortName: "BDC",
      color: "#CC0000",
      bgColor: "#FFF1F2",
      program: "SBPE",
      baseRate: 10.89,
      maxTermYears: 30,
      maxLTV: 0.8,
      minDownPct: 0.2,
      approvalMod: 0,
      rateAdjustable: true,
      requireSiric: false,
      minSerasa: 550,
      highlights: ["Relacionamento via conta corrente", "Desconto para correntistas"],
      skipIf: () => false,
    },
    // ── Itaú ─────────────────────────────────────────────────────────────────
    {
      bank: "Itaú Unibanco",
      shortName: "ITÁ",
      color: "#EC7000",
      bgColor: "#FFF7ED",
      program: "SBPE",
      baseRate: 10.79,
      maxTermYears: 30,
      maxLTV: 0.82,
      minDownPct: 0.18,
      approvalMod: -2,
      rateAdjustable: true,
      requireSiric: false,
      minSerasa: 600,
      highlights: ["Maior banco privado", "LTV de até 82%", "Análise rápida"],
      skipIf: () => false,
    },
    // ── Santander ────────────────────────────────────────────────────────────
    {
      bank: "Santander",
      shortName: "SAN",
      color: "#EC0000",
      bgColor: "#FFF1F2",
      program: "SBPE",
      baseRate: 10.89,
      maxTermYears: 30,
      maxLTV: 0.8,
      minDownPct: 0.2,
      approvalMod: +1,
      rateAdjustable: true,
      requireSiric: false,
      minSerasa: 550,
      highlights: ["Aceita renda informal até 30%", "Resposta em 48h"],
      skipIf: () => false,
    },
    // ── Inter ────────────────────────────────────────────────────────────────
    {
      bank: "Banco Inter",
      shortName: "INT",
      color: "#FF7A00",
      bgColor: "#FFF7ED",
      program: "SBPE",
      baseRate: 10.49,
      maxTermYears: 30,
      maxLTV: 0.8,
      minDownPct: 0.2,
      approvalMod: +5,
      rateAdjustable: true,
      requireSiric: false,
      minSerasa: 500,
      highlights: ["100% digital", "Menor burocracia", "Sem tarifas de abertura"],
      skipIf: () => false,
    },
  ];

  const offers: BankOffer[] = [];

  for (const cfg of configs) {
    if (cfg.skipIf?.()) continue;

    // ── Approval probability ─────────────────────────────────────────────
    let approvalPct = clamp(baseApproval + cfg.approvalMod + serasaMod, 0, 98);
    if (hasNeg) approvalPct -= 20;
    if (hasProt) approvalPct -= 30;
    if (cfg.requireSiric && !siricOk) approvalPct = Math.min(approvalPct, 10);
    if (!cfg.requireSiric && !siricOk) approvalPct -= 15;
    approvalPct = clamp(Math.round(approvalPct), 0, 98);

    // ── Eligibility status ───────────────────────────────────────────────
    const hardBlock =
      hasProt ||
      (cfg.requireSiric && !siricOk) ||
      (cfg.minSerasa != null && serasa != null && serasa < cfg.minSerasa - 100);

    let status: EligibilityStatus;
    let statusLabel: string;
    if (approvalPct >= 65 && !hardBlock) {
      status = "eligible";
      statusLabel = "Elegível";
    } else if (approvalPct >= 35 && !hardBlock) {
      status = "analysis";
      statusLabel = "Análise Necessária";
    } else if (hardBlock) {
      status = "ineligible";
      statusLabel = "Inapto";
    } else {
      status = "restricted";
      statusLabel = "Restrições";
    }

    // ── Restrictions list ────────────────────────────────────────────────
    const restrictions: string[] = [];
    if (hasProt) restrictions.push("Protestos em cartório (eliminatório)");
    if (hasNeg) restrictions.push("Negativações ativas no Serasa/SPC");
    if (cfg.requireSiric && !siricOk) restrictions.push("SIRIC irregular — bloqueio Caixa");
    else if (!cfg.requireSiric && !siricOk) restrictions.push("SIRIC irregular impacta análise");
    if (cfg.minSerasa && serasa != null && serasa < cfg.minSerasa)
      restrictions.push(`Serasa abaixo do mínimo (${serasa} < ${cfg.minSerasa})`);

    // ── Loan calculation ─────────────────────────────────────────────────
    const actualLTV = Math.min(cfg.maxLTV, 0.9);
    const minDownPct = 1 - actualLTV;
    const rawDownPayment = lead.propertyValue * minDownPct;
    const downPayment = Math.max(0, rawDownPayment - fgts);
    const loanAmount = Math.min(
      lead.propertyValue * actualLTV,
      lead.propertyValue - downPayment
    );

    // Adjust rate by Serasa (private banks only)
    const effectiveRate = cfg.rateAdjustable
      ? cfg.baseRate + serasaRateAdj
      : cfg.baseRate;

    const monthlyInstallment = calcPMT(loanAmount, effectiveRate, cfg.maxTermYears);
    const totalFinanced = monthlyInstallment * cfg.maxTermYears * 12;

    offers.push({
      bank: cfg.bank,
      shortName: cfg.shortName,
      color: cfg.color,
      bgColor: cfg.bgColor,
      program: cfg.program,
      annualRate: effectiveRate,
      termYears: cfg.maxTermYears,
      maxLTV: actualLTV,
      minDownPaymentPct: minDownPct,
      loanAmount,
      downPayment,
      monthlyInstallment,
      totalFinanced,
      approvalPct,
      status,
      statusLabel,
      restrictions,
      highlights: cfg.highlights,
      isBest: false,
    });
  }

  // Mark best: highest approval among eligible
  const eligibles = offers.filter((o) => o.status === "eligible" || o.status === "analysis");
  if (eligibles.length > 0) {
    const best = eligibles.reduce((a, b) =>
      b.approvalPct > a.approvalPct || (b.approvalPct === a.approvalPct && b.annualRate < a.annualRate)
        ? b
        : a
    );
    best.isBest = true;
  }

  return offers;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtRate(r: number) {
  return r.toFixed(2).replace(".", ",") + "% a.a.";
}

const STATUS_UI: Record<EligibilityStatus, { color: string; bg: string; icon: typeof CheckCircle }> = {
  eligible: { color: "#065F46", bg: "#D1FAE5", icon: CheckCircle },
  analysis: { color: "#1E40AF", bg: "#DBEAFE", icon: AlertCircle },
  restricted: { color: "#92400E", bg: "#FEF3C7", icon: AlertCircle },
  ineligible: { color: "#991B1B", bg: "#FEE2E2", icon: XCircle },
};

const PROGRAM_UI: Record<Program, { color: string; bg: string }> = {
  MCMV: { color: "#065F46", bg: "#D1FAE5" },
  SBPE: { color: "#1E40AF", bg: "#DBEAFE" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ApprovalBar({ pct, status }: { pct: number; status: EligibilityStatus }) {
  const color =
    status === "eligible"
      ? "#10A65A"
      : status === "analysis"
      ? "#F59E0B"
      : status === "restricted"
      ? "#EF4444"
      : "#9CA3AF";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function BankRow({ offer }: { offer: BankOffer }) {
  const stUI = STATUS_UI[offer.status];
  const StatusIcon = stUI.icon;
  const progUI = PROGRAM_UI[offer.program];

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        borderColor: offer.isBest ? offer.color : "hsl(var(--border))",
        borderWidth: offer.isBest ? 2 : 1,
      }}
    >
      {/* Best badge */}
      {offer.isBest && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-t-xl"
          style={{ background: offer.color, color: "#fff" }}
        >
          <Star className="w-3 h-3 fill-white" />
          Melhor opção para este perfil
        </div>
      )}

      <div className="p-4">
        {/* Bank header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            {/* Color avatar */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
              style={{ background: offer.color }}
            >
              {offer.shortName}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-tight">
                {offer.bank}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ color: progUI.color, background: progUI.bg }}
                >
                  {offer.program}
                </span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ color: stUI.color, background: stUI.bg }}
          >
            <StatusIcon className="w-3 h-3" />
            {offer.statusLabel}
          </div>
        </div>

        {/* Approval bar */}
        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-1">Probabilidade de aprovação</div>
          <ApprovalBar pct={offer.approvalPct} status={offer.status} />
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MetricCell
            label="Juros efetivos"
            value={fmtRate(offer.annualRate)}
            bold
            highlight={offer.program === "MCMV"}
          />
          <MetricCell label="Prazo máximo" value={`${offer.termYears} anos`} />
          <MetricCell label="Entrada mínima" value={fmtBRL(offer.downPayment)} sub={`${(offer.minDownPaymentPct * 100).toFixed(0)}% do imóvel`} />
          <MetricCell
            label="Parcela estimada"
            value={fmtBRL(offer.monthlyInstallment)}
            sub="sistema Price"
            bold
          />
          <MetricCell label="Valor financiado" value={fmtBRL(offer.loanAmount)} />
          <MetricCell label="Custo total" value={fmtBRL(offer.totalFinanced)} sub="sem correção monetária" />
        </div>

        {/* Highlights */}
        {offer.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {offer.highlights.map((h) => (
              <span
                key={h}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: offer.bgColor, color: offer.color }}
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Restrictions */}
        {offer.restrictions.length > 0 && (
          <div className="mt-2 space-y-1">
            {offer.restrictions.map((r) => (
              <div key={r} className="flex items-center gap-1.5 text-xs" style={{ color: "#991B1B" }}>
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: highlight ? "#D1FAE5" : "hsl(var(--muted))" }}
    >
      <div className="text-xs text-muted-foreground leading-tight mb-0.5">{label}</div>
      <div
        className={`text-sm leading-tight ${bold ? "font-bold" : "font-semibold"} text-foreground`}
        style={highlight ? { color: "#065F46" } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BankComparison({ lead }: { lead: LeadInput }) {
  const offers = useMemo(() => computeOffers(lead), [
    lead.income,
    lead.propertyValue,
    lead.hasFgts,
    lead.fgtsBalance,
    lead.employmentType,
    lead.spouseIncome,
    lead.informalIncome,
    lead.scoreCaixa,
    lead.scoreMCMV,
    lead.approvalChance,
    lead.serasaScore,
    lead.hasNegativations,
    lead.hasProtests,
    lead.siricStatus,
  ]);

  const totalIncome =
    lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const mcmvEligible = totalIncome <= 8000 && lead.propertyValue <= 350000;
  const eligibleCount = offers.filter(
    (o) => o.status === "eligible" || o.status === "analysis"
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="rounded-xl p-4 border border-card-border" style={{ background: "hsl(var(--muted))" }}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Análise baseada nos dados do lead e taxas de mercado de maio/2026.{" "}
              <strong className="text-foreground">
                {eligibleCount} {eligibleCount === 1 ? "opção" : "opções"} de crédito
              </strong>{" "}
              com perfil favorável.
            </p>
            <p>
              Renda composta:{" "}
              <strong className="text-foreground">{fmtBRL(totalIncome)}/mês</strong> ·
              Imóvel:{" "}
              <strong className="text-foreground">{fmtBRL(lead.propertyValue)}</strong> ·
              MCMV:{" "}
              <strong style={{ color: mcmvEligible ? "#065F46" : "#991B1B" }}>
                {mcmvEligible ? "Elegível" : "Fora do perfil"}
              </strong>
            </p>
            <p className="italic">
              Parcelas calculadas pelo sistema Price (tabela de amortização constante). Valores
              estimados — sujeitos à análise de crédito de cada instituição.
            </p>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="space-y-3">
        {offers.map((offer, i) => (
          <BankRow key={`${offer.bank}-${offer.program}-${i}`} offer={offer} />
        ))}
      </div>
    </div>
  );
}
