import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SbpeRecommendationBlock } from "./SbpeRecommendationBlock";
import type { SbpeRecommendation } from "@workspace/api-client-react";

// Mock que casa com a forma retornada por computeSbpeRecommendation.
const REC: SbpeRecommendation = {
  reason:
    "MCMV bloqueado: cliente já possui imóvel no município. Estas são as alternativas SBPE elegíveis com os dados atuais do lead.",
  banks: [
    {
      bank: "Banco Inter",
      bankSlug: "inter",
      shortName: "INT",
      annualRate: 10.49,
      termYears: 30,
      maxLTV: 0.8,
      monthlyInstallment: 3400,
      downPayment: 60000,
      loanAmount: 240000,
      approvalPct: 85,
      status: "eligible",
    },
    {
      bank: "Banco do Brasil",
      bankSlug: "bb",
      shortName: "BB",
      annualRate: 10.69,
      termYears: 30,
      maxLTV: 0.8,
      monthlyInstallment: 3450,
      downPayment: 60000,
      loanAmount: 240000,
      approvalPct: 75,
      status: "analysis",
    },
  ],
  rateRange: { min: 10.49, max: 10.69 },
  maxFinancedPct: 0.8,
  bestMonthlyInstallment: 3400,
  estimatedDownPayment: 60000,
  estimatedLoanAmount: 240000,
  termYears: 30,
};

describe("<SbpeRecommendationBlock /> — render do pivot SBPE", () => {
  it("renderiza o container, a faixa de taxa, LTV, parcela e bancos", () => {
    const html = renderToStaticMarkup(<SbpeRecommendationBlock rec={REC} />);

    // Container marcador do bloco — usado pelos testes de integração.
    expect(html).toContain('data-testid="block-sbpe-recommendation"');
    expect(html).toContain('data-testid="sbpe-rate-range"');
    expect(html).toContain('data-testid="sbpe-max-ltv"');
    expect(html).toContain('data-testid="sbpe-installment"');
    expect(html).toContain('data-testid="sbpe-down-payment"');

    // Faixa de taxa formatada com 2 casas, separador en-dash.
    expect(html).toMatch(/10\.49[–-]10\.69%/);
    // LTV em porcentagem inteira.
    expect(html).toContain("80%");
    // Reason / cabeçalho mencionando o pivot e o MCMV bloqueado.
    expect(html).toMatch(/Pivot SBPE/i);
    expect(html).toMatch(/MCMV bloqueado/i);

    // Chip por banco (1 por slug).
    expect(html).toContain('data-testid="sbpe-bank-inter"');
    expect(html).toContain('data-testid="sbpe-bank-bb"');
  });

  it("ProcessDetails só renderiza o bloco quando há blocker MCMV + recomendação", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../pages/ProcessDetails.tsx"),
      "utf8",
    );
    // O bloco deve ser importado e gateado pelos dois sinais.
    expect(src).toContain("SbpeRecommendationBlock");
    expect(src).toMatch(
      /summary\.alreadyOwnsPropertyInPropertyCity[\s\S]{0,80}summary\.sbpeRecommendation[\s\S]{0,200}<SbpeRecommendationBlock/,
    );
  });

  it("LeadDetails só renderiza o bloco quando há blocker MCMV + recomendação", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../pages/LeadDetails.tsx"),
      "utf8",
    );
    expect(src).toContain("SbpeRecommendationBlock");
    expect(src).toMatch(
      /lead\.alreadyOwnsPropertyInPropertyCity === true[\s\S]{0,120}score\?\.sbpeRecommendation[\s\S]{0,200}<SbpeRecommendationBlock/,
    );
  });
});
