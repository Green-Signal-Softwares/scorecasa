import { describe, it, expect } from "vitest";
import {
  computeOffers,
  computeSbpeRecommendation,
  type LeadInput,
} from "./index";

// Lead "feliz" no pivot SBPE: renda alta o suficiente para a parcela caber,
// score bom, sem restrições. Quando o MCMV cair (porque o cliente já possui
// imóvel no município), todos os SBPE devem aparecer como elegíveis.
function happySbpeLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    income: 12000,
    propertyValue: 500000,
    hasFgts: true,
    fgtsBalance: 40000,
    employmentType: "clt",
    maritalStatus: "single",
    spouseIncome: 0,
    informalIncome: 0,
    scoreCaixa: 780,
    scoreMCMV: 0, // bloqueado pelo "já possui imóvel"
    approvalChance: 80,
    serasaScore: 780,
    hasNegativations: false,
    hasProtests: false,
    siricStatus: "regular",
    propertyType: "apartamento",
    ...overrides,
  };
}

describe("computeSbpeRecommendation — MCMV bloqueado", () => {
  it("happy path: devolve recomendação com bancos, faixa de taxa e parcela positiva", () => {
    const lead = happySbpeLead();
    const rec = computeSbpeRecommendation(lead);

    expect(rec).not.toBeNull();
    const r = rec!;

    // Tem pelo menos um banco SBPE elegível/análise.
    expect(r.banks.length).toBeGreaterThanOrEqual(1);
    for (const b of r.banks) {
      expect(["eligible", "analysis"]).toContain(b.status);
      // Status do programa coerente com SBPE (não pode ter MCMV vazado aqui)
      expect(b.annualRate).toBeGreaterThan(0);
      expect(b.monthlyInstallment).toBeGreaterThan(0);
      expect(b.maxLTV).toBeGreaterThan(0);
      expect(b.maxLTV).toBeLessThanOrEqual(0.9);
    }

    // Range de taxa coerente: min <= max e ambos derivam dos bancos retornados.
    expect(r.rateRange.min).toBeLessThanOrEqual(r.rateRange.max);
    const ratesFromBanks = r.banks.map((b) => b.annualRate);
    expect(r.rateRange.min).toBe(Math.min(...ratesFromBanks));
    expect(r.rateRange.max).toBe(Math.max(...ratesFromBanks));

    // Parcela / entrada / loan derivados do "melhor" banco — positivos.
    expect(r.bestMonthlyInstallment).toBeGreaterThan(0);
    expect(r.estimatedDownPayment).toBeGreaterThan(0);
    expect(r.estimatedLoanAmount).toBeGreaterThan(0);
    expect(r.termYears).toBeGreaterThan(0);

    // Mensagem reforça que MCMV está bloqueado.
    expect(r.reason).toMatch(/MCMV bloqueado/i);
  });

  it("ordena o melhor banco por aprovação > taxa > parcela e o primeiro vira referência", () => {
    const lead = happySbpeLead();
    const rec = computeSbpeRecommendation(lead)!;
    const ordered = [...rec.banks];
    const sorted = [...rec.banks].sort(
      (a, b) =>
        b.approvalPct - a.approvalPct ||
        a.annualRate - b.annualRate ||
        a.monthlyInstallment - b.monthlyInstallment,
    );
    expect(ordered).toEqual(sorted);

    // bestMonthlyInstallment / entrada / loan vêm do primeiro da lista
    const best = ordered[0];
    expect(rec.bestMonthlyInstallment).toBe(best.monthlyInstallment);
    expect(rec.estimatedDownPayment).toBe(best.downPayment);
    expect(rec.estimatedLoanAmount).toBe(best.loanAmount);
    expect(rec.termYears).toBe(best.termYears);
    expect(rec.maxFinancedPct).toBe(Math.max(...rec.banks.map((b) => b.maxLTV)));
  });

  it("fallback: sem nenhum banco SBPE elegível devolve null", () => {
    // Protestos eliminam tudo (hardBlock em todos os bancos) → nenhuma oferta
    // SBPE elegible/análise → null.
    const lead = happySbpeLead({
      hasProtests: true,
      hasNegativations: true,
      serasaScore: 300,
      approvalChance: 5,
      scoreCaixa: 300,
    });
    const offers = computeOffers(lead);
    const sbpeUsable = offers.filter(
      (o) =>
        o.program === "SBPE" &&
        (o.status === "eligible" || o.status === "analysis"),
    );
    expect(sbpeUsable.length).toBe(0);

    expect(computeSbpeRecommendation(lead)).toBeNull();
  });

  it("rateRange reflete corretamente a matemática quando há vários bancos", () => {
    const lead = happySbpeLead();
    const rec = computeSbpeRecommendation(lead)!;
    expect(rec.banks.length).toBeGreaterThan(1);

    const min = Math.min(...rec.banks.map((b) => b.annualRate));
    const max = Math.max(...rec.banks.map((b) => b.annualRate));
    expect(rec.rateRange).toEqual({ min, max });
    // Sanidade: as taxas SBPE estão na faixa esperada (~10–12% a.a.).
    expect(min).toBeGreaterThan(9);
    expect(max).toBeLessThan(14);
  });
});
