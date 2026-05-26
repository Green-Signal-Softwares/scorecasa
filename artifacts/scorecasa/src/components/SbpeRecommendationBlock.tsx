import { Landmark, ArrowRightLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { SbpeRecommendation } from "@workspace/api-client-react";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

// Bloco "Pivot SBPE" exibido logo abaixo do bloqueador MCMV quando o cliente
// já possui imóvel no município. Resume bancos elegíveis, faixa de taxa,
// LTV máximo e parcela indicativa para o broker conduzir a conversa sem ter
// que recalcular manualmente.
//
// Quando `onSelectBank` é passado, cada chip vira clicável e dispara o callback
// (broker abre a aba de comparação focada naquele banco com os parâmetros SBPE
// pré-aplicados). Quando `onChooseBank` é passado, uma CTA "Selecionar" aparece
// em cada chip e persiste a escolha no `lead.chosenBank`. `chosenBank` marca
// visualmente o banco já escolhido.
export function SbpeRecommendationBlock({
  rec,
  onSelectBank,
  onChooseBank,
  chosenBank,
  chooseBankPending,
}: {
  rec: SbpeRecommendation;
  onSelectBank?: (bankSlug: string) => void;
  onChooseBank?: (bankSlug: string) => void;
  chosenBank?: string | null;
  chooseBankPending?: boolean;
}) {
  const { min, max } = rec.rateRange;
  const rateLabel =
    min === max
      ? `${min.toFixed(2)}% a.a.`
      : `${min.toFixed(2)}–${max.toFixed(2)}% a.a.`;
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "#BFDBFE", background: "#EFF6FF" }}
      data-testid="block-sbpe-recommendation"
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "#DBEAFE", color: "#0D1B8C" }}
      >
        <ArrowRightLeft className="w-3.5 h-3.5" />
        <div className="text-[11px] font-bold uppercase tracking-wide">
          Pivot SBPE — alternativa ao MCMV bloqueado
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="text-xs leading-relaxed" style={{ color: "#1E3A8A" }}>
          {rec.reason}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded p-2 bg-white border" style={{ borderColor: "#BFDBFE" }}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Taxa</div>
            <div className="text-sm font-semibold" style={{ color: "#0D1B8C" }} data-testid="sbpe-rate-range">
              {rateLabel}
            </div>
          </div>
          <div className="rounded p-2 bg-white border" style={{ borderColor: "#BFDBFE" }}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">LTV máx.</div>
            <div className="text-sm font-semibold" style={{ color: "#0D1B8C" }} data-testid="sbpe-max-ltv">
              {Math.round(rec.maxFinancedPct * 100)}%
            </div>
          </div>
          <div className="rounded p-2 bg-white border" style={{ borderColor: "#BFDBFE" }}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Parcela ({rec.termYears} anos)
            </div>
            <div className="text-sm font-semibold" style={{ color: "#0D1B8C" }} data-testid="sbpe-installment">
              {formatBRL(rec.bestMonthlyInstallment)}
            </div>
          </div>
          <div className="rounded p-2 bg-white border" style={{ borderColor: "#BFDBFE" }}>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entrada estimada</div>
            <div className="text-sm font-semibold" style={{ color: "#0D1B8C" }} data-testid="sbpe-down-payment">
              {formatBRL(rec.estimatedDownPayment)}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Bancos elegíveis ({rec.banks.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rec.banks.map((b) => {
              const isChosen = chosenBank === b.bankSlug;
              const clickable = !!onSelectBank;
              const title = `${b.bank} — ${b.annualRate.toFixed(2)}% a.a. · ${Math.round(
                b.maxLTV * 100,
              )}% LTV · ${formatBRL(b.monthlyInstallment)}/mês · ${b.approvalPct}% aprovação${
                clickable ? " · clique para abrir a comparação" : ""
              }`;
              return (
                <div
                  key={`${b.bankSlug}-${b.shortName}`}
                  className="flex items-center gap-1 rounded-full overflow-hidden text-[11px] font-medium"
                  style={{
                    background: b.status === "eligible" ? "#0D1B8C" : "#F59E0B",
                    color: "white",
                  }}
                  data-testid={`sbpe-bank-${b.bankSlug}`}
                >
                  <button
                    type="button"
                    onClick={clickable ? () => onSelectBank!(b.bankSlug) : undefined}
                    disabled={!clickable}
                    title={title}
                    className={`flex items-center gap-1.5 px-2 py-1 ${
                      clickable ? "hover:brightness-110 cursor-pointer" : "cursor-default"
                    }`}
                    data-testid={`sbpe-bank-open-${b.bankSlug}`}
                  >
                    <Landmark className="w-3 h-3" />
                    {b.shortName} · {b.annualRate.toFixed(2)}%
                    {clickable && <ArrowRight className="w-3 h-3 ml-0.5 opacity-80" />}
                  </button>
                  {onChooseBank && (
                    <button
                      type="button"
                      onClick={() => onChooseBank(b.bankSlug)}
                      disabled={chooseBankPending || isChosen}
                      title={
                        isChosen
                          ? "Banco já selecionado para este lead"
                          : "Selecionar este banco para o lead"
                      }
                      className="flex items-center gap-1 px-2 py-1 border-l border-white/30 disabled:opacity-70"
                      style={{ background: isChosen ? "#10A65A" : "transparent" }}
                      data-testid={`sbpe-bank-choose-${b.bankSlug}`}
                    >
                      {isChosen ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Escolhido
                        </>
                      ) : (
                        <>Selecionar</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
