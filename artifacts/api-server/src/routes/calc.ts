import { Router } from "express";

const router = Router();

/** Regra de mercado: idade do cliente + prazo do financiamento ≤ 80 anos e 6 meses.
 *  Para casais, vale a idade do MAIS VELHO. */
const LIMITE_IDADE_PRAZO_ANOS = 80.5;

function ageInYears(birthDateIso: string | undefined | null): number | null {
  if (!birthDateIso) return null;
  const d = new Date(birthDateIso);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

router.get("/max-term", (req, res) => {
  const birthDate = typeof req.query.birthDate === "string" ? req.query.birthDate : null;
  const spouseBirthDate =
    typeof req.query.spouseBirthDate === "string" && req.query.spouseBirthDate.length > 0
      ? req.query.spouseBirthDate
      : null;

  const ageMain = ageInYears(birthDate);
  const ageSpouse = ageInYears(spouseBirthDate);

  if (ageMain == null && ageSpouse == null) {
    res.status(400).json({ error: "Informe birthDate (e opcionalmente spouseBirthDate)." });
    return;
  }

  const ageReference = Math.max(ageMain ?? 0, ageSpouse ?? 0);
  const usedSpouse = (ageSpouse ?? 0) > (ageMain ?? 0);
  const maxYears = Math.max(0, LIMITE_IDADE_PRAZO_ANOS - ageReference);
  // Usamos FLOOR no total de meses para garantir que idade + prazo NUNCA
  // ultrapasse 80 anos e 6 meses (arredondamento poderia violar a regra).
  const totalMonths = Math.max(0, Math.floor(maxYears * 12));
  const wholeYears = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  let explanation: string;
  if (maxYears <= 0) {
    explanation =
      `Pela regra de soma idade + prazo ≤ 80 anos e 6 meses, a idade atual já ultrapassa o limite. ` +
      `Será preciso simular com prazos mais curtos ou avaliar coobrigado mais jovem.`;
  } else {
    explanation =
      `O banco usa a idade do mais velho do casal (${ageReference.toFixed(1)} anos) ` +
      `e soma o prazo do financiamento. A soma não pode ultrapassar ${LIMITE_IDADE_PRAZO_ANOS} anos. ` +
      `Por isso, o prazo máximo neste caso é de ${wholeYears} anos e ${months} meses. ` +
      `Quanto menor o prazo, maiores as parcelas — recomendamos simular no Simulador Habitacional CAIXA.`;
  }

  res.json({
    ageMain: ageMain != null ? Number(ageMain.toFixed(2)) : null,
    ageSpouse: ageSpouse != null ? Number(ageSpouse.toFixed(2)) : null,
    ageReference: Number(ageReference.toFixed(2)),
    usedSpouseAge: usedSpouse,
    maxYears: Number(maxYears.toFixed(2)),
    maxYearsLabel: `${wholeYears} anos e ${months} meses`,
    maxTotalMonths: totalMonths,
    rule: `Idade + prazo ≤ ${LIMITE_IDADE_PRAZO_ANOS} anos (regra padrão do mercado / Caixa)`,
    explanation,
  });
});

export default router;
