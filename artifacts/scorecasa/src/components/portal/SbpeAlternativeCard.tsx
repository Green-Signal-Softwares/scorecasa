import { Landmark, ArrowRightLeft, Info } from "lucide-react";
import type { SbpeRecommendation } from "@workspace/api-client-react";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

// Variante voltada ao cliente final do `SbpeRecommendationBlock` usado no
// painel do corretor. Mostra a mesma recomendação SBPE (parcela indicativa,
// entrada, LTV máximo e bancos elegíveis), porém:
//  - linguagem amigável explicando por que o MCMV está bloqueado;
//  - sem percentual interno de aprovação por banco (informação operacional
//    do corretor, não do cliente);
//  - sem CTAs de "selecionar banco" — quem fecha o banco é o corretor.
export function SbpeAlternativeCard({ rec }: { rec: SbpeRecommendation }) {
  const { min, max } = rec.rateRange;
  const rateLabel =
    min === max
      ? `${min.toFixed(2)}% a.a.`
      : `${min.toFixed(2)}–${max.toFixed(2)}% a.a.`;
  return (
    <div
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{ borderColor: "#BFDBFE", background: "#EFF6FF" }}
      data-testid="portal-sbpe-alternative"
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "#DBEAFE", color: "#0D1B8C" }}
      >
        <ArrowRightLeft className="w-4 h-4" />
        <div className="text-xs font-bold uppercase tracking-wide">
          Alternativa SBPE
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div
          className="flex items-start gap-2 text-sm leading-relaxed"
          style={{ color: "#1E3A8A" }}
        >
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            O Minha Casa Minha Vida não está disponível para você porque o
            programa exige que o comprador não possua imóvel no município onde
            quer financiar. Mas existe um <strong>caminho alternativo</strong>:
            o SBPE (financiamento imobiliário tradicional), que aceita quem já
            tem imóvel. Veja abaixo a simulação indicativa.
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div
            className="rounded-lg p-3 bg-white border"
            style={{ borderColor: "#BFDBFE" }}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Parcela indicativa
            </div>
            <div
              className="text-base font-semibold mt-0.5"
              style={{ color: "#0D1B8C" }}
              data-testid="portal-sbpe-installment"
            >
              {formatBRL(rec.bestMonthlyInstallment)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              em {rec.termYears} anos · taxa {rateLabel}
            </div>
          </div>
          <div
            className="rounded-lg p-3 bg-white border"
            style={{ borderColor: "#BFDBFE" }}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Entrada estimada
            </div>
            <div
              className="text-base font-semibold mt-0.5"
              style={{ color: "#0D1B8C" }}
              data-testid="portal-sbpe-down-payment"
            >
              {formatBRL(rec.estimatedDownPayment)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              financia até {Math.round(rec.maxFinancedPct * 100)}% do imóvel
            </div>
          </div>
          <div
            className="rounded-lg p-3 bg-white border col-span-2 sm:col-span-1"
            style={{ borderColor: "#BFDBFE" }}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Financiamento máximo
            </div>
            <div
              className="text-base font-semibold mt-0.5"
              style={{ color: "#0D1B8C" }}
              data-testid="portal-sbpe-max-ltv"
            >
              {Math.round(rec.maxFinancedPct * 100)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              do valor do imóvel
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Bancos que podem financiar você ({rec.banks.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rec.banks.map((b) => (
              <div
                key={`${b.bankSlug}-${b.shortName}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white"
                style={{
                  background: b.status === "eligible" ? "#0D1B8C" : "#F59E0B",
                }}
                data-testid={`portal-sbpe-bank-${b.bankSlug}`}
                title={`${b.bank} — ${b.annualRate.toFixed(2)}% a.a. · ${formatBRL(
                  b.monthlyInstallment,
                )}/mês em ${b.termYears} anos`}
              >
                <Landmark className="w-3 h-3" />
                {b.shortName} · {b.annualRate.toFixed(2)}%
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            Valores são indicativos e podem variar conforme análise de cada
            banco. Seu corretor confirmará as condições finais.
          </div>
        </div>
      </div>
    </div>
  );
}
