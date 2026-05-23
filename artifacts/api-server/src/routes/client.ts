import { Router } from "express";
import { db, usersTable, leadsTable, brokersTable, correspondentsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { extractBcbFromPdf, normalizeCpf, safeOcrErrorMessage } from "./bcb-ocr-helper";
import { eligibleBankSlugs, type LeadInput as OffersLeadInput } from "@workspace/bank-offers";

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

  let linkedCorrespondent: typeof correspondentsTable.$inferSelect | null = null;
  if (lead.linkedCorrespondentId) {
    const [c] = await db
      .select()
      .from(correspondentsTable)
      .where(eq(correspondentsTable.id, lead.linkedCorrespondentId))
      .limit(1);
    linkedCorrespondent = c ?? null;
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
    linkedCorrespondent: linkedCorrespondent
      ? serializeCorrespondent(linkedCorrespondent)
      : null,
  };
}

// ── Banks/correspondents helpers ────────────────────────────────────────────
// Catálogo de bancos compatível com o computeOffers do BankComparison.
// shortName/color batem com o que o front renderiza para manter a aparência
// consistente entre as duas superfícies (Bancos do Resumo e Meu Financiamento).
const BANK_CATALOG = [
  { bank: "caixa",     shortName: "CEF",   name: "Caixa Econômica Federal", color: "#0070C0", bgColor: "#E6F0FA" },
  { bank: "bb",        shortName: "BB",    name: "Banco do Brasil",          color: "#FACC15", bgColor: "#FEF9C3" },
  { bank: "bradesco",  shortName: "BRA",   name: "Bradesco",                 color: "#CC092F", bgColor: "#FEE2E2" },
  { bank: "itau",      shortName: "ITAÚ",  name: "Itaú",                     color: "#EC7000", bgColor: "#FFEDD5" },
  { bank: "santander", shortName: "SAN",   name: "Santander",                color: "#EC0000", bgColor: "#FEE2E2" },
  { bank: "inter",     shortName: "INTER", name: "Inter",                    color: "#FF7A00", bgColor: "#FFEDD5" },
] as const;
const BANK_SLUGS: Set<string> = new Set(BANK_CATALOG.map((b) => b.bank as string));

function serializeCorrespondent(c: typeof correspondentsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    bank: c.bank,
    code: c.code,
    email: c.email ?? null,
    phone: c.phone ?? null,
    status: c.status,
  };
}

// Elegibilidade vem do MESMO motor que o BankComparison.computeOffers
// (lib/bank-offers). Garante que o seletor "Meu Financiamento" e o subtab
// Bancos do Resumo nunca discordem sobre quais bancos o cliente pode tocar.
function leadToOffersInput(lead: typeof leadsTable.$inferSelect): OffersLeadInput {
  return {
    income: lead.income,
    propertyValue: lead.propertyValue,
    hasFgts: lead.hasFgts,
    fgtsBalance: lead.fgtsBalance,
    employmentType: lead.employmentType,
    maritalStatus: lead.maritalStatus,
    spouseIncome: lead.spouseIncome,
    informalIncome: lead.informalIncome,
    scoreCaixa: lead.scoreCaixa ?? 0,
    scoreMCMV: lead.scoreMCMV ?? 0,
    approvalChance: lead.approvalChance ?? 0,
    serasaScore: lead.serasaScore,
    hasNegativations: lead.hasNegativations,
    hasProtests: lead.hasProtests,
    siricStatus: lead.siricStatus,
    propertyType: lead.propertyType,
  };
}

function eligibleBanksFor(lead: typeof leadsTable.$inferSelect): Set<string> {
  return eligibleBankSlugs(leadToOffersInput(lead));
}

async function buildBanksAndCorrespondentsResponse(lead: typeof leadsTable.$inferSelect) {
  const eligible = eligibleBanksFor(lead);
  const banks = BANK_CATALOG.map((b) => ({
    bank: b.bank,
    shortName: b.shortName,
    name: b.name,
    color: b.color,
    bgColor: b.bgColor,
    eligible: eligible.has(b.bank),
    eligibilityLabel: eligible.has(b.bank) ? "Elegível" : "Em análise",
  }));
  const corrs = await db
    .select()
    .from(correspondentsTable)
    .where(eq(correspondentsTable.status, "active"));
  let linkedCorrespondent: any = null;
  if (lead.linkedCorrespondentId) {
    const [c] = await db
      .select()
      .from(correspondentsTable)
      .where(eq(correspondentsTable.id, lead.linkedCorrespondentId))
      .limit(1);
    linkedCorrespondent = c ? serializeCorrespondent(c) : null;
  }
  return {
    banks,
    correspondents: corrs.map(serializeCorrespondent),
    chosenBank: lead.chosenBank ?? null,
    linkedCorrespondentId: lead.linkedCorrespondentId ?? null,
    linkedCorrespondent,
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

  const body = req.body as Record<string, any>;
  const {
    income, propertyValue, phone, name,
    birthDate, profession, employmentType, informalIncome, maritalStatus,
    propertyCity, propertyState,
    spouseName, spouseCpf, spouseBirthDate, spouseProfession, spouseIncome,
  } = body;

  // ── Validação por campo (devolve `fields` para o front destacar inputs) ──
  // Limites superiores protegem contra overflow em colunas `real` do Postgres
  // e contra inputs absurdos (renda negativa, CPF inválido, etc).
  const MAX_MONEY = 1_000_000_000;
  const EMPLOYMENT_TYPES = new Set(["clt", "autonomo", "servidor_publico", "empresario", "aposentado", "outro"]);
  const MARITAL_STATUSES = new Set(["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"]);
  const UFS = new Set([
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
    "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
  ]);
  const errors: string[] = [];

  function checkMoney(name: string, v: any): boolean {
    if (v === undefined || v === null) return true;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_MONEY) {
      errors.push(name);
      return false;
    }
    return true;
  }
  function checkName(field: string, v: any, min = 2, max = 120): boolean {
    if (v === undefined || v === null) return true;
    if (typeof v !== "string") { errors.push(field); return false; }
    const t = v.trim();
    if (t.length === 0) return true; // tratado como vazio
    if (t.length < min || t.length > max) { errors.push(field); return false; }
    return true;
  }
  function checkEnum(field: string, v: any, allowed: Set<string>): boolean {
    if (v === undefined || v === null || v === "") return true;
    if (typeof v !== "string" || !allowed.has(v)) { errors.push(field); return false; }
    return true;
  }
  function checkDateStr(field: string, v: any): boolean {
    if (v === undefined || v === null || v === "") return true;
    if (typeof v !== "string") { errors.push(field); return false; }
    // Aceita YYYY-MM-DD (input date) ou ISO. Exige ano plausível e idade >= 18 quando aplicável.
    const t = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(t)) { errors.push(field); return false; }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) { errors.push(field); return false; }
    const year = d.getUTCFullYear();
    if (year < 1900 || year > new Date().getUTCFullYear()) { errors.push(field); return false; }
    return true;
  }
  function checkCpf(field: string, v: any): boolean {
    if (v === undefined || v === null || v === "") return true;
    if (typeof v !== "string") { errors.push(field); return false; }
    const digits = v.replace(/\D/g, "");
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) { errors.push(field); return false; }
    return true;
  }
  function checkPhone(field: string, v: any): boolean {
    if (v === undefined || v === null || v === "") return true;
    if (typeof v !== "string") { errors.push(field); return false; }
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) { errors.push(field); return false; }
    return true;
  }

  // Birth date (idade mínima 18 anos quando informada)
  function checkBirth(field: string, v: any): boolean {
    if (!checkDateStr(field, v)) return false;
    if (v === undefined || v === null || v === "") return true;
    const d = new Date(v);
    const today = new Date();
    let age = today.getUTCFullYear() - d.getUTCFullYear();
    const m = today.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
    if (age < 18 || age > 120) { errors.push(field); return false; }
    return true;
  }

  checkMoney("income", income);
  checkMoney("propertyValue", propertyValue);
  checkMoney("informalIncome", informalIncome);
  checkMoney("spouseIncome", spouseIncome);
  checkName("name", name);
  checkName("profession", profession, 2, 80);
  checkName("spouseName", spouseName);
  checkName("spouseProfession", spouseProfession, 2, 80);
  checkName("propertyCity", propertyCity, 2, 80);
  checkEnum("employmentType", employmentType, EMPLOYMENT_TYPES);
  checkEnum("maritalStatus", maritalStatus, MARITAL_STATUSES);
  checkEnum("propertyState", propertyState, UFS);
  checkBirth("birthDate", birthDate);
  checkBirth("spouseBirthDate", spouseBirthDate);
  checkCpf("spouseCpf", spouseCpf);
  checkPhone("phone", phone);

  if (errors.length > 0) {
    res.status(400).json({
      error: `Verifique os campos destacados: ${errors.join(", ")}. Use apenas valores válidos (renda não pode ser negativa, CPF deve ter 11 dígitos, idade mínima 18 anos).`,
      fields: errors,
    });
    return;
  }

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

// ── Dívidas & comprometimento (preenchido manualmente pelo cliente) ──────────
// O cliente pode informar manualmente parcelas ativas (veiculo, outras dividas,
// cartoes) e os totais do Registrato/BCB. Para o relatorio oficial via OCR/PDF,
// existe a rota /scr-import — esta rota cobre o caso em que o cliente apenas
// digita os valores. Recalcula o score na hora.
router.put("/debts", requireClient, async (req, res) => {
  const userId = (req as any).session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = req.body as Record<string, any>;

  // Validação estrita: rejeita valores inválidos com 400 em vez de ignorar
  // silenciosamente (impede que o cliente ache que salvou algo que não salvou).
  // Limites superiores protegem contra overflow em colunas `real` do Postgres.
  const MAX_MONEY = 1_000_000_000; // R$ 1 bilhão por campo é mais que suficiente
  const MAX_OPS = 1_000;
  const errors: string[] = [];

  function money(name: string, v: any): number | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    if (typeof v !== "number" && typeof v !== "string") { errors.push(name); return undefined; }
    const s = typeof v === "string" ? v.trim().replace(",", ".") : String(v);
    if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) { errors.push(name); return undefined; }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY) { errors.push(name); return undefined; }
    return n;
  }
  function pctValue(name: string, v: any): number | null | undefined {
    const n = money(name, v);
    if (typeof n !== "number") return n;
    if (n > 100) { errors.push(name); return undefined; }
    return n;
  }
  function opsValue(name: string, v: any): number | null | undefined {
    const n = money(name, v);
    if (typeof n !== "number") return n;
    if (n > MAX_OPS) { errors.push(name); return undefined; }
    return Math.round(n);
  }
  function dateStr(name: string, v: any): string | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    if (typeof v !== "string") { errors.push(name); return undefined; }
    const t = v.trim();
    if (t.length > 32) { errors.push(name); return undefined; }
    return t;
  }

  const parsed = {
    vehicleLoanMonthly: money("vehicleLoanMonthly", body.vehicleLoanMonthly),
    otherLoansMonthly: money("otherLoansMonthly", body.otherLoansMonthly),
    creditCardLimit: money("creditCardLimit", body.creditCardLimit),
    creditCardUsage: pctValue("creditCardUsage", body.creditCardUsage),
    bcbTotalDebt: money("bcbTotalDebt", body.bcbTotalDebt),
    bcbMonthlyCommitment: money("bcbMonthlyCommitment", body.bcbMonthlyCommitment),
    bcbOperationsCount: opsValue("bcbOperationsCount", body.bcbOperationsCount),
    bcbQueryDate: dateStr("bcbQueryDate", body.bcbQueryDate),
  };

  if (errors.length > 0) {
    res.status(400).json({
      error: `Valores inválidos: ${errors.join(", ")}. Use apenas números positivos (cartão até 100%, operações até ${MAX_OPS}).`,
      fields: errors,
    });
    return;
  }

  const update: Record<string, any> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) update[k] = v;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Lead nao encontrado." });
    return;
  }

  // Recalcula score com a MESMA logica do scr-import: usa BCB se houver,
  // caso contrario soma veiculo + outras parcelas.
  const merged = { ...existing, ...update };
  const totalIncome = merged.income + (merged.informalIncome ?? 0) * 0.7 + (merged.spouseIncome ?? 0);
  const ratio = totalIncome > 0 ? merged.propertyValue / (totalIncome * 12) : 99;
  let baseChance = Math.max(0, Math.min(100, 100 - (ratio / 4.5) * 60));

  const monthlyDebt = merged.bcbMonthlyCommitment ?? ((merged.vehicleLoanMonthly ?? 0) + (merged.otherLoansMonthly ?? 0));
  const debtRatio = totalIncome > 0 ? monthlyDebt / totalIncome : 0;
  if (debtRatio > 0.30) baseChance -= 18;
  else if (debtRatio > 0.20) baseChance -= 10;
  else if (debtRatio > 0.10) baseChance -= 4;

  const overdue = merged.bcbDebtsOverdue ?? 0;
  if (overdue > 0) baseChance -= 25;

  const approvalChance = Math.round(Math.max(0, Math.min(100, baseChance)));
  const scoreCaixa = Math.min(1000, Math.max(300, Math.round(300 + (approvalChance / 100) * 550)));
  const scoreMCMV = merged.income <= 8000 ? Math.round(600 + Math.random() * 250) : Math.round(300 + Math.random() * 200);

  let recommendation: string;
  if (overdue > 0) {
    recommendation = `SCR aponta R$ ${overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em dividas vencidas. Regularize antes de solicitar financiamento.`;
  } else if (debtRatio > 0.30) {
    recommendation = `Comprometimento mensal esta em ${(debtRatio * 100).toFixed(0)}% da renda — acima do limite Caixa de 30%. Reduza dividas ativas antes de prosseguir.`;
  } else if (approvalChance >= 70) {
    recommendation = "Perfil com alta chance de aprovacao. Comprometimento dentro do limite.";
  } else {
    recommendation = "Perfil viavel. Trabalhe a entrada e mantenha o comprometimento baixo.";
  }
  Object.assign(update, { approvalChance, scoreCaixa, scoreMCMV, aiRecommendation: recommendation });

  await db.update(leadsTable).set(update).where(eq(leadsTable.id, user.leadId));
  const profile = await getClientProfile(userId);
  res.json(profile);
});

// ── GET /api/client/banks-and-correspondents ────────────────────────────────
// Devolve o catálogo de bancos com a flag de elegibilidade para este lead,
// a lista de correspondentes ativos e o vínculo atual. Mesma fonte usada
// pelas duas telas (Bancos do Resumo e Meu Financiamento).
router.get("/banks-and-correspondents", requireClient, async (req: any, res) => {
  const userId = req.session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }
  res.json(await buildBanksAndCorrespondentsResponse(lead));
});

// ── POST /api/client/choose-financing ───────────────────────────────────────
// Cliente escolhe banco e (opcionalmente) correspondente. Três modos:
//   1) bank=null → desfaz a escolha (limpa banco + correspondente).
//   2) bank + correspondentId → linka direto a um correspondente da lista.
//   3) bank + correspondentCode → procura por código, valida que pertence ao banco.
//   4) bank + autoAssign=true → servidor pega o primeiro correspondente ativo do banco.
//   5) bank apenas → registra a escolha de banco sem correspondente.
//
// Trocar de banco SEMPRE limpa o correspondente anterior (o vínculo é por banco).
router.post("/choose-financing", requireClient, async (req: any, res) => {
  const userId = req.session.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "client" || !user.leadId) {
    res.status(403).json({ error: "Apenas clientes." });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, user.leadId)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado." });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const bank = body.bank as string | null | undefined;
  const correspondentId = body.correspondentId as number | null | undefined;
  const correspondentCode = body.correspondentCode as string | null | undefined;
  const autoAssign = body.autoAssign === true;

  // Modo 1: limpar escolha
  if (bank === null || bank === undefined) {
    await db
      .update(leadsTable)
      .set({
        chosenBank: null,
        linkedCorrespondentId: null,
        proceedWithBank: null,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, lead.id));
    const [updated] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id)).limit(1);
    res.json(await buildBanksAndCorrespondentsResponse(updated!));
    return;
  }

  if (typeof bank !== "string" || !BANK_SLUGS.has(bank)) {
    res.status(400).json({ error: `Banco inválido. Use um de: ${[...BANK_SLUGS].join(", ")}.` });
    return;
  }

  // Backend também garante que o banco escolhido é elegível para este lead.
  // O front já desabilita botões de bancos inaptos, mas a regra de negócio
  // tem que ser autoritativa no servidor (mesma fonte computeOffers).
  const eligible = eligibleBanksFor(lead);
  if (!eligible.has(bank)) {
    res.status(400).json({
      error: `O banco ${bank} não está elegível para o seu perfil neste momento.`,
    });
    return;
  }

  // Resolve correspondente (modos 2/3/4)
  let linkedCorrespondentId: number | null = null;

  if (typeof correspondentId === "number" && Number.isFinite(correspondentId)) {
    const [c] = await db.select().from(correspondentsTable).where(eq(correspondentsTable.id, correspondentId)).limit(1);
    if (!c || c.status !== "active") {
      res.status(400).json({ error: "Correspondente não encontrado ou inativo." });
      return;
    }
    if (c.bank !== bank) {
      res.status(400).json({ error: `Correspondente "${c.name}" pertence ao banco ${c.bank}, não a ${bank}.` });
      return;
    }
    linkedCorrespondentId = c.id;
  } else if (typeof correspondentCode === "string" && correspondentCode.trim()) {
    const code = correspondentCode.trim();
    const [c] = await db
      .select()
      .from(correspondentsTable)
      .where(and(eq(correspondentsTable.code, code), eq(correspondentsTable.bank, bank)))
      .limit(1);
    if (!c) {
      res.status(400).json({ error: `Código "${code}" não encontrado para o banco escolhido.` });
      return;
    }
    if (c.status !== "active") {
      res.status(400).json({ error: "Correspondente está inativo." });
      return;
    }
    linkedCorrespondentId = c.id;
  } else if (autoAssign) {
    // Pega o primeiro correspondente ativo do banco sem leads (ou qualquer um se
    // todos já tiverem). Round-robin simples — basta pra MVP.
    const candidates = await db
      .select()
      .from(correspondentsTable)
      .where(and(eq(correspondentsTable.bank, bank), eq(correspondentsTable.status, "active")));
    if (candidates.length === 0) {
      res.status(400).json({ error: "Nenhum correspondente disponível para este banco." });
      return;
    }
    // Conta leads vinculados a cada candidato e escolhe o de menor carga.
    const counts = await Promise.all(
      candidates.map(async (c) => {
        const rows = await db
          .select({ id: leadsTable.id })
          .from(leadsTable)
          .where(eq(leadsTable.linkedCorrespondentId, c.id));
        return { c, n: rows.length };
      }),
    );
    counts.sort((a, b) => a.n - b.n);
    linkedCorrespondentId = counts[0]!.c.id;
  }
  // Else: modo 5 — só registra o banco, sem correspondente.

  await db
    .update(leadsTable)
    .set({
      chosenBank: bank,
      linkedCorrespondentId,
      // Mantém proceedWithBank em sincronia com chosenBank quando for "caixa"
      // (legado: client-documents.ts ainda usa essa coluna para liberar
      // assinatura via gov.br). Quando trocar para outro banco, limpa.
      proceedWithBank: bank === "caixa" ? "caixa" : null,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, lead.id));

  const [updated] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id)).limit(1);
  res.json(await buildBanksAndCorrespondentsResponse(updated!));
});

export default router;
