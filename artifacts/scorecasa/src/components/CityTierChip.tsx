import {
  cityTier,
  MCMV_2026_BY_TIER,
  type MCMVTier,
} from "@workspace/cities-br";

const TIER_LABEL: Record<MCMVTier, string> = {
  A: "Grande metrópole / RM SP-RJ / DF",
  B: "Metrópole / RM acima de 1 milhão",
  C: "Capital regional ou cidade de 250 mil a 1 milhão",
  D: "Cidade média (100 mil a 250 mil)",
  E: "Cidade pequena ou município sem cadastro",
};

const TIER_CHIP_STYLE: Record<MCMVTier, string> = {
  A: "bg-emerald-50 border-emerald-200 text-emerald-800",
  B: "bg-emerald-50 border-emerald-200 text-emerald-800",
  C: "bg-sky-50 border-sky-200 text-sky-800",
  D: "bg-amber-50 border-amber-200 text-amber-800",
  E: "bg-amber-50 border-amber-200 text-amber-800",
};

function formatBRLShort(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Chip que mostra o tier MCMV e os tetos vigentes para o município escolhido,
 *  com tooltip explicando como o teto é calculado. */
export function CityTierChip({ uf, city }: { uf: string; city: string }) {
  const tier = cityTier(uf, city);
  const limits = MCMV_2026_BY_TIER[tier];
  const tooltip =
    "O teto MCMV depende do porte do município: capitais e regiões " +
    "metropolitanas (A/B) têm o maior teto; capitais regionais e cidades " +
    "entre 250 mil e 1 milhão (C) vêm em seguida; cidades médias (D) e " +
    "pequenas ou sem cadastro (E) têm o teto mais restrito.";
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${TIER_CHIP_STYLE[tier]}`}
      data-testid="city-tier-chip"
    >
      <div className="flex items-start gap-2">
        <span className="font-semibold whitespace-nowrap">
          MCMV Tier {tier}
        </span>
        <span className="opacity-70">·</span>
        <span className="flex-1">
          <span className="font-medium">{TIER_LABEL[tier]}</span>
          <span className="block mt-0.5 opacity-90">
            Teto Faixas 1 e 2: <strong>{formatBRLShort(limits.capFaixa12)}</strong>
            {" · "}
            Faixa 3: <strong>{formatBRLShort(limits.capFaixa3)}</strong>
          </span>
        </span>
        <span
          className="cursor-help opacity-70 hover:opacity-100"
          title={tooltip}
          aria-label="Como esse teto é calculado?"
        >
          ⓘ
        </span>
      </div>
    </div>
  );
}
