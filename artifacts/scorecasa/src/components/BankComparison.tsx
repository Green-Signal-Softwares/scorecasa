import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Star, Info, ArrowRightLeft } from "lucide-react";
import {
  BankAndCorrespondentPicker,
  useBanksAndCorrespondents,
} from "@/components/BankAndCorrespondentPicker";
import {
  computeOffers,
  type LeadInput,
  type BankOffer,
  type EligibilityStatus,
  type Program,
} from "@workspace/bank-offers";


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

const BANK_NAME_TO_SLUG: Record<string, string> = {
  "Caixa Econômica Federal": "caixa",
  "Caixa Econômica": "caixa",
  "Caixa": "caixa",
  "Banco do Brasil": "bb",
  "Bradesco": "bradesco",
  "Itaú": "itau",
  "Itau": "itau",
  "Santander": "santander",
  "Inter": "inter",
  "Banco Inter": "inter",
};

function offerToBankSlug(bank: string): string | null {
  if (BANK_NAME_TO_SLUG[bank]) return BANK_NAME_TO_SLUG[bank];
  // fallback: tenta achar por substring case-insensitive.
  const lower = bank.toLowerCase();
  for (const [name, slug] of Object.entries(BANK_NAME_TO_SLUG)) {
    if (lower.includes(name.toLowerCase())) return slug;
  }
  return null;
}

function BankRow({
  offer,
  selected,
  onSelect,
  disabled,
}: {
  offer: BankOffer;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const stUI = STATUS_UI[offer.status];
  const StatusIcon = stUI.icon;
  const progUI = PROGRAM_UI[offer.program];

  const canPick =
    !disabled && (offer.status === "eligible" || offer.status === "analysis");

  return (
    <div
      role={canPick ? "button" : undefined}
      tabIndex={canPick ? 0 : undefined}
      onClick={canPick ? onSelect : undefined}
      onKeyDown={
        canPick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      data-testid={`bankrow-${offerToBankSlug(offer.bank) ?? "x"}`}
      className={`rounded-xl border transition-all ${
        canPick ? "cursor-pointer hover:shadow-md" : "cursor-default"
      }`}
      style={{
        borderColor: selected
          ? "#10A65A"
          : offer.isBest
          ? offer.color
          : "hsl(var(--border))",
        borderWidth: selected || offer.isBest ? 2 : 1,
        background: selected ? "#ECFDF5" : undefined,
      }}
    >
      {selected && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-t-xl"
          style={{ background: "#10A65A", color: "#fff" }}
        >
          <CheckCircle className="w-3 h-3" /> Banco escolhido para o seu financiamento
        </div>
      )}
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

export type SbpePivotFocus = {
  termYears: number;
  maxFinancedPct: number;
  bestMonthlyInstallment: number;
  rateRange: { min: number; max: number };
};

export function BankComparison({
  lead,
  focusBankSlug,
  sbpePivot,
  onFocusConsumed,
}: {
  lead: LeadInput;
  // Slug do banco vindo do pivot SBPE — quando presente, a comparação faz
  // scroll automático até a linha desse banco e destaca os parâmetros SBPE
  // pré-aplicados (prazo, LTV, parcela). `onFocusConsumed` é disparado depois
  // do scroll para o pai poder limpar o foco e evitar re-aplicar a cada render.
  focusBankSlug?: string | null;
  sbpePivot?: SbpePivotFocus | null;
  onFocusConsumed?: () => void;
}) {
  const [pickerBank, setPickerBank] = useState<string | null>(null);
  const { query: banksQuery, mutation } = useBanksAndCorrespondents();
  const chosenBank = banksQuery.data?.chosenBank ?? null;
  const focusRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusBankSlug) return;
    const el = focusRowRef.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Mantém o foco visual por alguns segundos; depois libera o estado no pai.
    const t = window.setTimeout(() => onFocusConsumed?.(), 4000);
    return () => window.clearTimeout(t);
  }, [focusBankSlug, onFocusConsumed]);

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

      {/* Resumo do vínculo atual (banco + correspondente) */}
      <BankAndCorrespondentPicker variant="summary" />

      {/* Banner do pivot SBPE — só aparece quando o broker abriu a comparação
          a partir de um chip do bloco "Pivot SBPE". Mostra os parâmetros já
          aplicados para o broker conferir antes de fechar com o cliente. */}
      {focusBankSlug && sbpePivot && (
        <div
          className="rounded-xl border p-3 flex items-start gap-3"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          data-testid="sbpe-focus-banner"
        >
          <ArrowRightLeft className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#0D1B8C" }} />
          <div className="flex-1 text-xs" style={{ color: "#1E3A8A" }}>
            <div className="font-bold mb-0.5">
              Parâmetros SBPE pré-aplicados ao simulador
            </div>
            Prazo <strong>{sbpePivot.termYears} anos</strong> · LTV máx.{" "}
            <strong>{Math.round(sbpePivot.maxFinancedPct * 100)}%</strong> · parcela
            indicativa <strong>{fmtBRL(sbpePivot.bestMonthlyInstallment)}</strong> ·
            taxa{" "}
            <strong>
              {sbpePivot.rateRange.min === sbpePivot.rateRange.max
                ? `${sbpePivot.rateRange.min.toFixed(2)}%`
                : `${sbpePivot.rateRange.min.toFixed(2)}–${sbpePivot.rateRange.max.toFixed(2)}%`}{" "}
              a.a.
            </strong>
          </div>
        </div>
      )}

      {/* Offers — cards clicáveis abrem o picker já no banco escolhido */}
      <div className="space-y-3">
        {offers.map((offer, i) => {
          const slug = offerToBankSlug(offer.bank);
          const isSelected = !!slug && chosenBank === slug;
          const isFocused = !!slug && slug === focusBankSlug;
          return (
            <div
              key={`${offer.bank}-${offer.program}-${i}`}
              ref={isFocused ? focusRowRef : undefined}
              className={isFocused ? "rounded-xl ring-2 ring-offset-2" : undefined}
              style={isFocused ? { boxShadow: "0 0 0 2px #0D1B8C" } : undefined}
              data-testid={isFocused ? `bankrow-focus-${slug}` : undefined}
            >
              <BankRow
                offer={offer}
                selected={isSelected}
                disabled={mutation.isPending}
                onSelect={() => {
                  if (!slug) return;
                  // Se já é o escolhido E já tem correspondente, abre o modal direto.
                  // Se ainda não tem correspondente, persiste a escolha de banco
                  // e abre o modal (picker faz isso internamente).
                  setPickerBank(slug);
                }}
              />
            </div>
          );
        })}
      </div>

      {pickerBank && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPickerBank(null)}
          data-testid="bank-picker-overlay"
        >
          <div
            className="bg-[#F4F6FB] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <BankAndCorrespondentPicker initialBank={pickerBank} onOpened={() => setPickerBank(null)} />
            <div className="text-right mt-3">
              <button
                onClick={() => setPickerBank(null)}
                className="text-xs font-semibold text-gray-600 underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
