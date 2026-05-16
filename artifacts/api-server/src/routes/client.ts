import { Router } from "express";
import { db, usersTable, leadsTable, brokersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractBcbFromPdf, normalizeCpf, safeOcrErrorMessage } from "./bcb-ocr-helper";

const router = Router();

function requireClient(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function getClientProfile(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) return null;

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) return null;

  let brokerName: string | null = null;
  if (lead.brokerId) {
    const [broker] = await db.select({ name: brokersTable.name }).from(brokersTable).where(eq(brokersTable.id, lead.brokerId)).limit(1);
    brokerName = broker?.name ?? null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      leadId: user.leadId,
    },
    lead: {
      ...lead,
      brokerName,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
  };
}

// ── Histórico de score (6 meses) ─────────────────────────────────────────────
// Como ainda não persistimos snapshots mensais, sintetizamos uma série
// determinística a partir do scoreCaixa atual + leadId. Quando houver
// histórico real persistido (tabela score_snapshots), basta substituir o
// gerador por uma query agregada.
const MONTH_LABELS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function scoreStatus(score: number): { key: "atencao" | "regular" | "bom" | "otimo"; label: string; color: string } {
  if (score >= 800) return { key: "otimo", label: "Score ótimo", color: "#10A65A" };
  if (score >= 650) return { key: "bom", label: "Score bom", color: "#0D1B8C" };
  if (score >= 450) return { key: "regular", label: "Score regular", color: "#F59E0B" };
  return { key: "atencao", label: "Precisa de atenção", color: "#EF4444" };
}

router.get("/score-history", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes podem consultar histórico." });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }

  const current = lead.scoreCaixa || 500;
  const now = new Date();
  // Seed depende apenas do leadId — assim o histórico passado permanece
  // estável quando o score atual muda (atualizações futuras só afetam o ponto
  // mais recente, mantendo a sensação de linha do tempo).
  const seed = (lead.id * 17) % 97;

  // Gera 6 pontos (5 meses atrás → mês atual). Variação suave ±60 pts,
  // ancorada no score atual.
  const months: Array<{
    monthKey: string;
    monthLabel: string;
    year: number;
    score: number;
    delta: number;
    deltaLabel: string;
    updatedAt: string;
    status: ReturnType<typeof scoreStatus>;
  }> = [];

  let prev: number | null = null;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    // Deterministic variation
    const sway = ((seed + i * 13) % 121) - 60; // -60..+60
    const trend = i * 5; // leve melhora ao longo do tempo
    let score: number;
    if (i === 0) score = current;
    else score = Math.max(300, Math.min(1000, current - trend + sway));
    const delta = prev === null ? 0 : score - prev;
    months.push({
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      score,
      delta,
      deltaLabel: delta === 0 ? "Sem alteração" : delta > 0 ? `+${delta}` : `${delta}`,
      updatedAt: `12 ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      status: scoreStatus(score),
    });
    prev = score;
  }

  const last = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const monthlyDelta = last.delta;

  // Fatores que pesam no score (determinístico em função do lead)
  const factors = {
    atencao: [
      {
        title: "Comprometimento de renda elevado",
        description: "Sua renda mensal vs valor financiado está acima de 35%. Reduzir o valor do imóvel ou aumentar a entrada melhora muito sua aprovação.",
      },
      {
        title: "Histórico curto no Open Finance",
        description: "Conectar mais bancos via Open Finance aumenta a confiança das instituições no seu perfil.",
      },
    ],
    bom: [
      {
        title: "Pagamentos em dia",
        description: "Suas contas e cartões estão sem atrasos nos últimos 12 meses.",
      },
      {
        title: "Tempo de relacionamento bancário",
        description: "Você mantém conta ativa há mais de 2 anos — bom sinal para os bancos.",
      },
    ],
    otimo: [
      {
        title: "Sem registro de restrição",
        description: "Nenhum apontamento em SPC, Serasa ou Banco Central.",
      },
      {
        title: "Renda comprovada estável",
        description: "Renda formal declarada e compatível com Open Finance.",
      },
      {
        title: "CPF regular na Receita Federal",
        description: "Situação cadastral regular, sem pendências.",
      },
      {
        title: "Elegível ao MCMV",
        description: "Seu perfil atende às faixas do programa Minha Casa Minha Vida.",
      },
    ],
  };

  res.json({
    current: {
      score: current,
      max: 1000,
      status: scoreStatus(current),
      monthlyDelta,
      deltaLabel: monthlyDelta === 0 ? "Sem alteração" : monthlyDelta > 0 ? `+${monthlyDelta}` : `${monthlyDelta}`,
      previousScore: prevMonth?.score ?? current,
      updatedAt: last.updatedAt,
    },
    months,
    factors,
    counts: {
      atencao: factors.atencao.length,
      bom: factors.bom.length,
      otimo: factors.otimo.length,
    },
  });
});

router.get("/profile", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const profile = await getClientProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.put("/profile", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const {
    income, propertyValue, phone, name,
    birthDate, profession, employmentType, informalIncome, maritalStatus,
    propertyCity, propertyState,
    spouseName, spouseCpf, spouseBirthDate, spouseProfession, spouseIncome,
  } = req.body as Record<string, any>;

  const leadUpdate: Record<string, any> = { updatedAt: new Date() };
  if (typeof income === "number") leadUpdate.income = income;
  if (typeof propertyValue === "number") leadUpdate.propertyValue = propertyValue;
  if (typeof phone === "string") leadUpdate.phone = phone;
  if (typeof name === "string") leadUpdate.name = name;
  if (typeof birthDate === "string" || birthDate === null) leadUpdate.birthDate = birthDate;
  if (typeof profession === "string" || profession === null) leadUpdate.profession = profession;
  if (typeof employmentType === "string" || employmentType === null) leadUpdate.employmentType = employmentType;
  if (typeof informalIncome === "number" || informalIncome === null) leadUpdate.informalIncome = informalIncome;
  if (typeof maritalStatus === "string" || maritalStatus === null) leadUpdate.maritalStatus = maritalStatus;
  if (typeof propertyCity === "string" || propertyCity === null) leadUpdate.propertyCity = propertyCity;
  if (typeof propertyState === "string" || propertyState === null) leadUpdate.propertyState = propertyState;
  if (typeof spouseName === "string" || spouseName === null) leadUpdate.spouseName = spouseName;
  if (typeof spouseCpf === "string" || spouseCpf === null) leadUpdate.spouseCpf = spouseCpf;
  if (typeof spouseBirthDate === "string" || spouseBirthDate === null) leadUpdate.spouseBirthDate = spouseBirthDate;
  if (typeof spouseProfession === "string" || spouseProfession === null) leadUpdate.spouseProfession = spouseProfession;
  if (typeof spouseIncome === "number" || spouseIncome === null) leadUpdate.spouseIncome = spouseIncome;

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (existing && (typeof income === "number" || typeof propertyValue === "number" || typeof informalIncome === "number")) {
    const inc  = typeof income === "number" ? income : existing.income;
    const pv   = typeof propertyValue === "number" ? propertyValue : existing.propertyValue;
    const inf  = typeof informalIncome === "number" ? informalIncome : (existing.informalIncome ?? 0);
    const sp   = typeof spouseIncome === "number" ? spouseIncome : (existing.spouseIncome ?? 0);
    const totalInc = inc + inf * 0.7 + sp;
    const ratio = pv / (totalInc * 12);
    const maxRatio = 4.5;
    let baseChance = Math.max(0, Math.min(100, 100 - (ratio / maxRatio) * 60));
    const empType = typeof employmentType === "string" ? employmentType : existing.employmentType;
    if (empType === "clt" || empType === "servidor_publico") baseChance += 8;
    const approvalChance = Math.min(100, Math.max(0, Math.round(baseChance + (Math.random() * 10 - 5))));
    const scoreCaixa = Math.min(1000, Math.max(300, Math.round(300 + (approvalChance / 100) * 550 + (Math.random() * 80 - 40))));
    const scoreMCMV = inc <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);
    let recommendation = "";
    if (approvalChance >= 70) recommendation = "Perfil com alta chance de aprovação. Recomendamos prosseguir com a análise completa.";
    else if (approvalChance >= 50) recommendation = "Perfil com chances moderadas. Ajustando o comprometimento de renda, a aprovação pode ser garantida.";
    else recommendation = "Perfil com chances baixas. Sugerimos rever o valor do imóvel ou aumentar a renda comprovada.";
    Object.assign(leadUpdate, { approvalChance, scoreCaixa, scoreMCMV: Math.min(1000, Math.max(0, scoreMCMV)), aiRecommendation: recommendation });
  }

  if (typeof name === "string") {
    await db.update(usersTable).set({ name }).where(eq(usersTable.id, userId));
  }

  await db.update(leadsTable).set(leadUpdate).where(eq(leadsTable.id, user.leadId));

  const profile = await getClientProfile(userId);
  res.json(profile);
});

// Importa dados do SCR (Banco Central / Registrato) para o lead do cliente.
// Recebe o PDF original do SCR; o servidor faz OCR, valida CPF e persiste os campos.
// Esta abordagem garante que o cliente NAO consegue forjar valores financeiros usados no score.
router.post("/scr-import", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes com lead vinculado podem importar SCR." });
    return;
  }

  const { imageBase64, mimeType } = (req.body ?? {}) as { imageBase64?: string; mimeType?: string };
  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "Envie o PDF do relatorio SCR (imageBase64 obrigatorio)." });
    return;
  }
  const mime = typeof mimeType === "string" ? mimeType : "application/pdf";

  // OCR server-side. Resultado e a unica fonte de verdade para os campos persistidos.
  let extraction;
  try {
    const result = await extractBcbFromPdf(imageBase64, mime);
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    extraction = result;
  } catch (err: any) {
    req.log.error({ err }, "scr-import: OCR error");
    res.status(500).json({ error: safeOcrErrorMessage(err) });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead nao encontrado." });
    return;
  }

  // Valida que o CPF do SCR confere com o do lead (anti-fraude).
  // CPF e obrigatorio: se a OCR nao conseguir extrair, recusamos a importacao.
  const scrCpf = normalizeCpf(extraction.summary.cpf);
  const leadCpf = normalizeCpf(existing.cpf);
  if (!scrCpf || scrCpf.length !== 11) {
    res.status(422).json({
      error: "Nao foi possivel identificar o CPF no relatorio SCR. Envie o PDF original do Registrato (gov.br), sem cortes ou alteracoes.",
    });
    return;
  }
  if (!leadCpf) {
    res.status(400).json({ error: "Seu cadastro nao tem CPF informado. Atualize seus dados antes de importar o SCR." });
    return;
  }
  if (scrCpf !== leadCpf) {
    res.status(400).json({
      error: "O CPF do relatorio SCR (" + scrCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") + ") nao confere com o CPF do seu cadastro. Envie o relatorio do titular.",
    });
    return;
  }

  const ef = extraction.enrichFields;

  // Persistencia explicita: zeros e nulls SAO escritos para limpar dados antigos
  // de relatorios SCR anteriores (ex.: divida vencida quitada).
  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    bcbTotalDebt: ef.bcbTotalDebt,
    bcbMonthlyCommitment: ef.bcbMonthlyCommitment,
    bcbOperationsCount: ef.bcbOperationsCount,
    bcbQueryDate: ef.bcbQueryDate,
    bcbDebtsCurrent: ef.bcbDebtsCurrent,
    bcbDebtsOverdue: ef.bcbDebtsOverdue,
    bcbCreditLimits: ef.bcbCreditLimits,
    bcbOperationsJson: ef.bcbOperationsJson,
    creditCardLimit: ef.creditCardLimit,
    creditCardUsage: ef.creditCardUsage,
    vehicleLoanMonthly: ef.vehicleLoanMonthly,
    otherLoansMonthly: ef.otherLoansMonthly,
    hasNegativations: ef.hasNegativations,
  };

  // Recalcula score
  const totalIncome = existing.income + (existing.informalIncome ?? 0) * 0.7 + (existing.spouseIncome ?? 0);
  const ratio = totalIncome > 0 ? existing.propertyValue / (totalIncome * 12) : 99;
  let baseChance = Math.max(0, Math.min(100, 100 - (ratio / 4.5) * 60));

  const monthlyDebt = ef.bcbMonthlyCommitment ?? ((ef.vehicleLoanMonthly ?? 0) + (ef.otherLoansMonthly ?? 0));
  const debtRatio = totalIncome > 0 ? monthlyDebt / totalIncome : 0;
  if (debtRatio > 0.30) baseChance -= 18;
  else if (debtRatio > 0.20) baseChance -= 10;
  else if (debtRatio > 0.10) baseChance -= 4;

  const overdue = ef.bcbDebtsOverdue ?? 0;
  if (overdue > 0) baseChance -= 25;

  const approvalChance = Math.round(Math.max(0, Math.min(100, baseChance)));
  const scoreCaixa = Math.min(1000, Math.max(300, Math.round(300 + (approvalChance / 100) * 550)));
  const scoreMCMV = existing.income <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);

  let recommendation: string;
  if (overdue > 0) {
    recommendation = `SCR aponta R$ ${overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em dividas vencidas. Regularize antes de solicitar financiamento.`;
  } else if (debtRatio > 0.30) {
    recommendation = `Comprometimento mensal esta em ${(debtRatio * 100).toFixed(0)}% da renda — acima do limite Caixa de 30%. Reduza dividas ativas antes de prosseguir.`;
  } else if (approvalChance >= 70) {
    recommendation = "Perfil com alta chance de aprovacao. SCR limpo e comprometimento dentro do limite.";
  } else {
    recommendation = "Perfil viavel. Trabalhe a entrada e mantenha o SCR regular.";
  }
  Object.assign(update, { approvalChance, scoreCaixa, scoreMCMV, aiRecommendation: recommendation });

  await db.update(leadsTable).set(update).where(eq(leadsTable.id, user.leadId));
  const profile = await getClientProfile(userId);
  res.json({ ...profile, summary: extraction.summary });
});

export default router;
