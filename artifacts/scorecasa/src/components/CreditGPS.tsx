import { useMemo } from "react";
import { CheckCircle, AlertTriangle, XCircle, Clock, TrendingUp, ArrowRight } from "lucide-react";

interface LeadInput {
  income: number;
  propertyValue: number;
  hasFgts?: boolean | null;
  fgtsBalance?: number | null;
  fgtsMonths?: number | null;
  employmentType?: string | null;
  employmentMonths?: number | null;
  maritalStatus?: string | null;
  spouseIncome?: number | null;
  informalIncome?: number | null;
  approvalChance: number;
  scoreCaixa: number;
  serasaScore?: number | null;
  hasNegativations?: boolean | null;
  negativationsValue?: number | null;
  hasProtests?: boolean | null;
  protestsValue?: number | null;
  siricStatus?: string | null;
  vehicleLoanMonthly?: number | null;
  creditCardLimit?: number | null;
  creditCardUsage?: number | null;
  otherLoansMonthly?: number | null;
}

export type GpsStatus = "done" | "warning" | "critical" | "pending";

export interface GpsStep {
  id: string;
  priority: number;
  status: GpsStatus;
  title: string;
  description: string;
  action: string;
  timeEstimate: string;
  impactPct: number;
}

export function computeGpsSteps(lead: LeadInput): GpsStep[] {
  const steps: GpsStep[] = [];
  const totalIncome = lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const totalMonthlyDebt = (lead.vehicleLoanMonthly ?? 0) + (lead.otherLoansMonthly ?? 0);
  const debtRatioPct = totalIncome > 0 ? (totalMonthlyDebt / totalIncome) * 100 : 0;
  const propertyIncomeRatio = lead.propertyValue / (totalIncome * 12);

  // ── Bloco 1: Restrições críticas (eliminatórias) ──────────────────────────
  if (lead.hasProtests) {
    steps.push({
      id: "protests",
      priority: 1,
      status: "critical",
      title: "Regularizar protestos em cartório",
      description:
        `Existem protestos em cartório registrados — este é critério eliminatório na Caixa, BB e todos os bancos privados.` +
        (lead.protestsValue ? ` Valor identificado: R$ ${lead.protestsValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` : "") +
        " Procure o cartório responsável e solicite o cancelamento após o pagamento. Guarde a certidão de cancelamento.",
      action: "Ir ao cartório de protesto e quitar o débito",
      timeEstimate: "1 a 4 semanas",
      impactPct: 30,
    });
  }

  if (lead.siricStatus === "irregular") {
    steps.push({
      id: "siric",
      priority: 2,
      status: "critical",
      title: "Regularizar situação no SIRIC (Caixa)",
      description:
        "Situação irregular no SIRIC bloqueia completamente o crédito habitacional na Caixa Econômica Federal. Pode indicar financiamento ativo não quitado, imóvel em nome ou restrição cadastral. Dirija-se a uma agência Caixa com documentos pessoais para verificar e regularizar.",
      action: "Ir a uma agência Caixa e solicitar consulta ao SIRIC",
      timeEstimate: "2 a 8 semanas",
      impactPct: 40,
    });
  }

  // ── Bloco 2: Restrições de crédito ────────────────────────────────────────
  if (lead.hasNegativations) {
    steps.push({
      id: "negativations",
      priority: 3,
      status: "critical",
      title: "Quitar negativações no Serasa/SPC",
      description:
        `Negativações ativas reduzem significativamente a chance de aprovação em todos os bancos.` +
        (lead.negativationsValue ? ` Valor total: R$ ${lead.negativationsValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` : "") +
        " Acesse serasa.com.br ou spcbrasil.org.br para negociar. Após quitação, solicite a exclusão do seu nome — pode levar até 5 dias úteis para sumir dos sistemas.",
      action: "Acessar Serasa Limpa Nome ou SPC Consumidor e negociar",
      timeEstimate: "1 a 4 semanas",
      impactPct: 25,
    });
  }

  if (lead.serasaScore != null && lead.serasaScore < 600) {
    const gap = 600 - lead.serasaScore;
    steps.push({
      id: "serasa_score",
      priority: 4,
      status: lead.serasaScore < 400 ? "critical" : "warning",
      title: "Melhorar Score Serasa",
      description:
        `Score atual: ${lead.serasaScore}/1000. Bancos privados exigem mínimo de 550–600 pontos.` +
        ` Precisa de +${gap} pontos.` +
        " Para aumentar: pague contas em dia, mantenha CPF ativo no Serasa, atualize cadastro positivo, reduza utilização de cartão (abaixo de 30% do limite), evite consultas excessivas ao CPF.",
      action: "Cadastrar no Serasa Premium e ativar Cadastro Positivo",
      timeEstimate: "3 a 9 meses",
      impactPct: 15,
    });
  }

  // ── Bloco 3: Comprometimento financeiro ────────────────────────────────────
  if (debtRatioPct > 30) {
    steps.push({
      id: "debt_ratio",
      priority: 5,
      status: "critical",
      title: "Reduzir comprometimento com dívidas ativas",
      description:
        `${debtRatioPct.toFixed(1)}% da renda mensal comprometida com financiamentos e empréstimos — acima do limite de 30% aceito pelos bancos.` +
        ` Valor mensal em parcelas: R$ ${totalMonthlyDebt.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` +
        " Priorize quitar o veículo ou renegociar parcelas antes de solicitar o crédito imobiliário. Antecipação de parcelas de veículo pode liberar renda significativa.",
      action: "Quitar ou refinanciar dívidas para reduzir parcela mensal",
      timeEstimate: "3 a 12 meses",
      impactPct: 18,
    });
  } else if (debtRatioPct > 15) {
    steps.push({
      id: "debt_ratio_warn",
      priority: 5,
      status: "warning",
      title: "Atenção ao comprometimento de dívidas",
      description:
        `${debtRatioPct.toFixed(1)}% da renda mensal em parcelas de dívidas ativas. Ainda dentro do limite mas reduz margem de aprovação.` +
        " Considere antecipar parcelas do veículo para melhorar a análise de crédito.",
      action: "Avaliar antecipação de parcelas do veículo",
      timeEstimate: "1 a 6 meses",
      impactPct: 8,
    });
  }

  if (lead.creditCardUsage != null && lead.creditCardUsage > 50) {
    steps.push({
      id: "credit_card",
      priority: 6,
      status: lead.creditCardUsage > 80 ? "critical" : "warning",
      title: "Reduzir utilização do cartão de crédito",
      description:
        `Utilização atual: ${lead.creditCardUsage.toFixed(0)}% do limite total.` +
        " Bancos consideram alta utilização de cartão como sinal de stress financeiro. O ideal é manter abaixo de 30% do limite total para melhorar o score Serasa e a análise de crédito.",
      action: `Pagar fatura e reduzir utilização para abaixo de 30%${lead.creditCardLimit ? ` (máx. R$ ${(lead.creditCardLimit * 0.3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })})` : ""}`,
      timeEstimate: "1 a 3 meses",
      impactPct: 10,
    });
  }

  // ── Bloco 4: Relação imóvel/renda ─────────────────────────────────────────
  if (propertyIncomeRatio > 4.5) {
    const maxProperty = totalIncome * 12 * 4.5;
    steps.push({
      id: "property_ratio",
      priority: 7,
      status: "critical",
      title: "Adequar valor do imóvel à renda",
      description:
        `Relação imóvel/renda anual: ${propertyIncomeRatio.toFixed(2)}x — acima do limite máximo de 4,5x da Caixa.` +
        ` Com a renda atual de R$ ${totalIncome.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês, o imóvel máximo é R$ ${maxProperty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` +
        " Opções: buscar imóvel de menor valor, aumentar a renda comprovada, incluir renda do cônjuge ou compor renda com familiar.",
      action: `Buscar imóvel até R$ ${maxProperty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ou aumentar renda`,
      timeEstimate: "Imediato",
      impactPct: 20,
    });
  } else if (propertyIncomeRatio > 3.5) {
    steps.push({
      id: "property_ratio_warn",
      priority: 7,
      status: "warning",
      title: "Relação imóvel/renda no limite",
      description:
        `${propertyIncomeRatio.toFixed(2)}x de comprometimento anual. Aprovação possível mas use o FGTS para reduzir o valor financiado.` +
        " Quanto menor a parcela em relação à renda, melhor a análise bancária.",
      action: "Usar FGTS para aumentar entrada e reduzir financiamento",
      timeEstimate: "Na contratação",
      impactPct: 5,
    });
  }

  // ── Bloco 5: FGTS e estabilidade ─────────────────────────────────────────
  if (!lead.hasFgts || (lead.fgtsBalance ?? 0) === 0) {
    steps.push({
      id: "fgts",
      priority: 8,
      status: "warning",
      title: "Verificar e mobilizar FGTS",
      description:
        "FGTS não informado ou sem saldo. O FGTS pode ser usado como entrada (reduz financiamento e parcela) e como amortização. Solicite o extrato atualizado na Caixa ou pelo app FGTS e verifique o saldo disponível.",
      action: "Baixar app FGTS e verificar saldo disponível",
      timeEstimate: "Imediato",
      impactPct: 8,
    });
  } else if ((lead.fgtsMonths ?? 0) < 36) {
    steps.push({
      id: "fgts_time",
      priority: 9,
      status: "warning",
      title: "Aumentar tempo de contribuição ao FGTS",
      description:
        `Tempo de contribuição: ${lead.fgtsMonths ?? 0} meses. Caixa recomenda mínimo de 36 meses para programas habitacionais melhores.` +
        ` Faltam ${36 - (lead.fgtsMonths ?? 0)} meses para atingir o patamar ideal.`,
      action: "Manter emprego com carteira assinada para acumular FGTS",
      timeEstimate: `${36 - (lead.fgtsMonths ?? 0)} meses`,
      impactPct: 5,
    });
  }

  if (lead.employmentType === "autonomo" || lead.employmentType === "liberal") {
    if ((lead.employmentMonths ?? 0) < 24) {
      steps.push({
        id: "employment",
        priority: 10,
        status: "warning",
        title: "Construir histórico de renda autônoma",
        description:
          `Para autônomos/liberais, bancos exigem mínimo de 24 meses de comprovação de renda (extratos, declaração de IR, pró-labore).` +
          ` Histórico atual: ${lead.employmentMonths ?? 0} meses.` +
          " Organize extratos bancários dos últimos 3 anos, entregue DECORE ou recibos mensais. A declaração completa do IR é fundamental.",
        action: "Organizar documentação de renda: IR, extratos e DECORE",
        timeEstimate: `${Math.max(0, 24 - (lead.employmentMonths ?? 0))} meses + organização documental`,
        impactPct: 12,
      });
    }
  }

  // ── Bloco 6: Situação favorável ───────────────────────────────────────────
  if (lead.siricStatus === "regular") {
    steps.push({
      id: "siric_ok",
      priority: 11,
      status: "done",
      title: "SIRIC Caixa regular",
      description: "Situação regular no sistema SIRIC da Caixa. Não há pendências de financiamento habitacional anterior. Mantenha esta situação até a contratação.",
      action: "Manter situação regular",
      timeEstimate: "Concluído",
      impactPct: 0,
    });
  }

  if (!lead.hasNegativations && !lead.hasProtests && (lead.serasaScore == null || lead.serasaScore >= 700)) {
    steps.push({
      id: "credit_clean",
      priority: 12,
      status: "done",
      title: "Cadastro de crédito limpo",
      description:
        "Sem negativações ou protestos registrados" +
        (lead.serasaScore != null ? ` e score Serasa de ${lead.serasaScore} pontos.` : ".") +
        " Continue mantendo pagamentos em dia para preservar este status.",
      action: "Manter pagamentos em dia",
      timeEstimate: "Concluído",
      impactPct: 0,
    });
  }

  // Ordenar: críticos primeiro, depois warnings, depois done
  return steps.sort((a, b) => {
    const order: Record<GpsStatus, number> = { critical: 0, warning: 1, pending: 2, done: 3 };
    return order[a.status] - order[b.status] || a.priority - b.priority;
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const STATUS_UI: Record<GpsStatus, { icon: typeof CheckCircle; color: string; bg: string; border: string; label: string }> = {
  done: { icon: CheckCircle, color: "#065F46", bg: "#F0FDF4", border: "#10A65A", label: "Concluído" },
  warning: { icon: AlertTriangle, color: "#92400E", bg: "#FFFBEB", border: "#F59E0B", label: "Atenção" },
  critical: { icon: XCircle, color: "#991B1B", bg: "#FEF2F2", border: "#EF4444", label: "Crítico" },
  pending: { icon: Clock, color: "#1E40AF", bg: "#EFF6FF", border: "#3B82F6", label: "Pendente" },
};

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function CreditGPS({ lead }: { lead: LeadInput }) {
  const steps = useMemo(() => computeGpsSteps(lead), [
    lead.approvalChance,
    lead.scoreCaixa,
    lead.serasaScore,
    lead.hasNegativations,
    lead.negativationsValue,
    lead.hasProtests,
    lead.protestsValue,
    lead.siricStatus,
    lead.fgtsMonths,
    lead.hasFgts,
    lead.fgtsBalance,
    lead.income,
    lead.propertyValue,
    lead.spouseIncome,
    lead.informalIncome,
    lead.employmentType,
    lead.employmentMonths,
    lead.vehicleLoanMonthly,
    lead.creditCardLimit,
    lead.creditCardUsage,
    lead.otherLoansMonthly,
  ]);

  const totalIncome = lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const totalMonthlyDebt = (lead.vehicleLoanMonthly ?? 0) + (lead.otherLoansMonthly ?? 0);
  const debtRatioPct = totalIncome > 0 ? (totalMonthlyDebt / totalIncome) * 100 : 0;

  const criticalCount = steps.filter((s) => s.status === "critical").length;
  const warningCount = steps.filter((s) => s.status === "warning").length;
  const doneCount = steps.filter((s) => s.status === "done").length;
  const totalImpact = steps.filter((s) => s.status !== "done").reduce((acc, s) => acc + s.impactPct, 0);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl border border-card-border p-4 bg-card shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#0D1B8C" }} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">GPS de Aprovação</div>
            <div className="text-xs text-muted-foreground">Roteiro personalizado para conquistar o crédito imobiliário</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: "Críticos", value: criticalCount, color: "#EF4444", bg: "#FEE2E2" },
            { label: "Atenção", value: warningCount, color: "#92400E", bg: "#FEF3C7" },
            { label: "Concluídos", value: doneCount, color: "#065F46", bg: "#D1FAE5" },
            { label: "Ganho potencial", value: `+${Math.min(totalImpact, 60)}%`, color: "#1E40AF", bg: "#DBEAFE" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-lg p-2.5 text-center" style={{ background: bg }}>
              <div className="text-lg font-bold" style={{ color }}>{value}</div>
              <div className="text-xs font-medium" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Debt summary row if data available */}
        {debtRatioPct > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Parcelas mensais ativas: </span>
              <span className="font-semibold text-foreground">{fmtBRL(totalMonthlyDebt)}/mês</span>
            </div>
            <div>
              <span className="text-muted-foreground">% da renda comprometida: </span>
              <span className="font-semibold" style={{ color: debtRatioPct > 30 ? "#EF4444" : debtRatioPct > 15 ? "#F59E0B" : "#10A65A" }}>
                {debtRatioPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const ui = STATUS_UI[step.status];
          const Icon = ui.icon;
          const stepNum = index + 1;
          return (
            <div
              key={step.id}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: ui.border, borderLeftWidth: 4 }}
            >
              <div className="p-4" style={{ background: ui.bg }}>
                {/* Header row */}
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ background: ui.border }}
                  >
                    {step.status === "done" ? <CheckCircle className="w-4 h-4" /> : stepNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: ui.color }}>{step.title}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: ui.color, background: "rgba(0,0,0,0.06)" }}
                      >
                        {ui.label}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: ui.color }}>
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 flex-wrap mt-2 pt-2 border-t" style={{ borderColor: `${ui.border}40` }}>
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: ui.color }} />
                    <span className="text-xs font-medium" style={{ color: ui.color }}>{step.action}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs" style={{ color: ui.color }}>
                      <Clock className="w-3 h-3" />
                      <span>{step.timeEstimate}</span>
                    </div>
                    {step.impactPct > 0 && (
                      <div
                        className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ color: "#065F46", background: "#D1FAE5" }}
                      >
                        <TrendingUp className="w-3 h-3" />
                        +{step.impactPct}% chance
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground text-center pt-1">
        Estimativas baseadas nos dados do cadastro. Impactos são aproximações — resultados reais variam conforme análise bancária.
      </div>
    </div>
  );
}
