import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Poppins",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2",
      fontWeight: 700,
    },
  ],
});

const BLUE = "#0D1B8C";
const GREEN = "#10A65A";
const DARK = "#07113A";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F3F4F6";
const BORDER = "#E5E7EB";

const s = StyleSheet.create({
  page: {
    fontFamily: "Poppins",
    fontSize: 9,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    paddingBottom: 40,
  },

  // Header
  header: {
    backgroundColor: DARK,
    padding: "24 32 20 32",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flexDirection: "column" },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  logoDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: GREEN, marginRight: 6,
  },
  logoText: { fontFamily: "Poppins", fontWeight: 700, fontSize: 14, color: "#FFFFFF" },
  logoSub: { fontSize: 7, color: GREEN, marginTop: 1 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 },
  headerCPF: { fontSize: 9, color: "#93C5FD" },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 8, color: "#93C5FD" },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 8, fontWeight: 600 },

  body: { padding: "20 32" },

  // Section
  sectionTitle: {
    fontWeight: 700,
    fontSize: 10,
    color: BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 6,
  },

  section: { marginBottom: 20 },

  // Info grid
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoItem: {
    width: "31%",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: "8 10",
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoLabel: { fontSize: 7, color: GRAY, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 9, fontWeight: 600, color: "#111827" },

  // Score cards row
  scoreRow: { flexDirection: "row", gap: 10 },
  scoreCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: "12 10",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  scoreLabel: { fontSize: 7, color: GRAY, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  scoreValue: { fontWeight: 700, fontSize: 22, marginBottom: 6 },
  scoreMaxLabel: { fontSize: 7, color: GRAY },
  scoreBar: { width: "100%", height: 5, backgroundColor: LIGHT_GRAY, borderRadius: 3, marginTop: 8 },
  scoreBarFill: { height: 5, borderRadius: 3 },
  scoreName: { fontSize: 8, fontWeight: 600, marginTop: 6 },

  // Chance card (wider)
  chanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: "12 14",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  chanceValue: { fontWeight: 700, fontSize: 32 },
  chanceLabel: { fontSize: 8, color: GRAY, marginTop: 2 },
  chanceBar: { width: "100%", height: 8, backgroundColor: LIGHT_GRAY, borderRadius: 4, marginTop: 10 },
  chanceBarFill: { height: 8, borderRadius: 4 },

  // Recommendation box
  recBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    padding: "10 12",
    borderLeftWidth: 3,
    borderLeftColor: BLUE,
  },
  recText: { fontSize: 9, color: "#1E40AF", lineHeight: 1.6 },

  // Factors
  factorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: "7 10",
    borderRadius: 6,
    marginBottom: 5,
  },
  factorIcon: { width: 14, fontSize: 8, fontWeight: 700, marginRight: 8, marginTop: 0.5 },
  factorContent: { flex: 1 },
  factorName: { fontWeight: 600, fontSize: 8, marginBottom: 2 },
  factorDesc: { fontSize: 7.5, lineHeight: 1.5 },
  factorValue: { fontSize: 8, fontWeight: 700, marginLeft: 8 },

  // Banks
  banksRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  bankChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: BLUE,
  },
  bankText: { fontSize: 8, color: "#FFFFFF", fontWeight: 600 },

  // Income ratio
  ratioSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: "10 12",
    borderWidth: 1,
    borderColor: BORDER,
  },
  ratioRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  ratioBar: { height: 6, backgroundColor: LIGHT_GRAY, borderRadius: 3 },
  ratioFill: { height: 6, borderRadius: 3 },
  ratioLegend: { fontSize: 7, color: GRAY, marginTop: 4 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: DARK,
    padding: "10 32",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: "#93C5FD" },
  footerBrand: { fontSize: 8, color: "#FFFFFF", fontWeight: 700 },
});

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7" },
  analyzing: { label: "Em Analise", color: "#1E40AF", bg: "#DBEAFE" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE" },
};

const IMPACT_CONFIG = {
  positive: { symbol: "+", color: "#065F46", bg: "#D1FAE5" },
  negative: { symbol: "−", color: "#991B1B", bg: "#FEE2E2" },
  neutral:  { symbol: "·", color: "#374151", bg: "#F3F4F6" },
};

function scoreColor(pct: number) {
  if (pct >= 65) return GREEN;
  if (pct >= 40) return "#F59E0B";
  return "#EF4444";
}

function approvalColor(chance: number) {
  if (chance >= 70) return GREEN;
  if (chance >= 40) return "#F59E0B";
  return "#EF4444";
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export interface LeadReportProps {
  lead: {
    id: number;
    name: string;
    cpf: string;
    email: string;
    phone: string;
    income: number;
    propertyValue: number;
    status: string;
    approvalChance: number;
    scoreCaixa: number;
    scoreMCMV: number;
    aiRecommendation?: string | null;
    brokerName?: string | null;
  };
  score: {
    factors: Array<{ name: string; description: string; impact: string; value?: string | null }>;
    eligibleBanks?: string[];
  } | null;
  generatedAt?: string;
}

export function LeadReport({ lead, score, generatedAt }: LeadReportProps) {
  const statusCfg = STATUS_CONFIG[lead.status] ?? { label: lead.status, color: "#374151", bg: "#F3F4F6" };
  const aColor = approvalColor(lead.approvalChance);
  const ratioRaw = lead.propertyValue / (lead.income * 12);
  const ratioFillPct = Math.min(100, (ratioRaw / 4.5) * 100);
  const ratioColor = ratioRaw <= 3 ? GREEN : ratioRaw <= 4.5 ? "#F59E0B" : "#EF4444";
  const dateStr = generatedAt ?? new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <Document title={`ScoreCasa — Relatorio ${lead.name}`} author="ScoreCasa" creator="ScoreCasa">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoRow}>
              <View style={s.logoDot} />
              <View>
                <Text style={s.logoText}>ScoreCasa</Text>
                <Text style={s.logoSub}>Inteligencia de Credito Imobiliario</Text>
              </View>
            </View>
            <Text style={s.headerTitle}>{lead.name}</Text>
            <Text style={s.headerCPF}>{formatCPF(lead.cpf)}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>Gerado em {dateStr}</Text>
            <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
        </View>

        <View style={s.body}>

          {/* ── 1. Dados do cliente ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Dados do Cliente</Text>
            <View style={s.infoGrid}>
              {[
                { label: "Email", value: lead.email },
                { label: "Telefone", value: lead.phone },
                { label: "Renda mensal", value: formatBRL(lead.income) },
                { label: "Valor do imovel", value: formatBRL(lead.propertyValue) },
                { label: "Corretor responsavel", value: lead.brokerName ?? "Nao atribuido" },
                { label: "ID do lead", value: `#${lead.id}` },
              ].map(({ label, value }) => (
                <View key={label} style={s.infoItem}>
                  <Text style={s.infoLabel}>{label}</Text>
                  <Text style={s.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── 2. Analise de credito ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Analise de Credito</Text>
            <View style={s.scoreRow}>

              {/* Chance IA */}
              <View style={s.chanceCard}>
                <Text style={s.scoreLabel}>Chance de Aprovacao (IA)</Text>
                <Text style={[s.chanceValue, { color: aColor }]}>{lead.approvalChance}%</Text>
                <Text style={s.chanceLabel}>probabilidade preditiva</Text>
                <View style={s.chanceBar}>
                  <View style={[s.chanceBarFill, { width: `${lead.approvalChance}%`, backgroundColor: aColor }]} />
                </View>
              </View>

              {/* Score Caixa */}
              <View style={s.scoreCard}>
                <Text style={s.scoreLabel}>Score Caixa</Text>
                <Text style={[s.scoreValue, { color: scoreColor((lead.scoreCaixa / 1000) * 100) }]}>
                  {lead.scoreCaixa}
                </Text>
                <Text style={s.scoreMaxLabel}>de 1.000</Text>
                <View style={s.scoreBar}>
                  <View style={[s.scoreBarFill, {
                    width: `${(lead.scoreCaixa / 1000) * 100}%`,
                    backgroundColor: scoreColor((lead.scoreCaixa / 1000) * 100),
                  }]} />
                </View>
              </View>

              {/* Score MCMV */}
              <View style={s.scoreCard}>
                <Text style={s.scoreLabel}>Score MCMV</Text>
                <Text style={[s.scoreValue, { color: scoreColor((lead.scoreMCMV / 1000) * 100) }]}>
                  {lead.scoreMCMV}
                </Text>
                <Text style={s.scoreMaxLabel}>de 1.000</Text>
                <View style={s.scoreBar}>
                  <View style={[s.scoreBarFill, {
                    width: `${(lead.scoreMCMV / 1000) * 100}%`,
                    backgroundColor: scoreColor((lead.scoreMCMV / 1000) * 100),
                  }]} />
                </View>
              </View>
            </View>
          </View>

          {/* ── 3. Comprometimento de renda ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Comprometimento de Renda</Text>
            <View style={s.ratioSection}>
              <View style={s.ratioRow}>
                <Text style={{ fontSize: 9, fontWeight: 600, color: "#111827" }}>
                  Relacao imovel / renda anual
                </Text>
                <Text style={{ fontSize: 9, fontWeight: 700, color: ratioColor }}>
                  {ratioRaw.toFixed(2)}× ({(ratioRaw / 4.5 * 100).toFixed(0)}% do limite)
                </Text>
              </View>
              <View style={s.ratioBar}>
                <View style={[s.ratioFill, { width: `${ratioFillPct}%`, backgroundColor: ratioColor }]} />
              </View>
              <Text style={s.ratioLegend}>
                Limite Caixa: 4,5× a renda anual bruta (R$ {formatBRL(lead.income * 12 * 4.5).replace("R$", "").trim()})
              </Text>
            </View>
          </View>

          {/* ── 4. Recomendacao IA ── */}
          {lead.aiRecommendation && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Recomendacao da IA</Text>
              <View style={s.recBox}>
                <Text style={s.recText}>{lead.aiRecommendation}</Text>
              </View>
            </View>
          )}

          {/* ── 5. Fatores de score ── */}
          {score && score.factors.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Fatores de Score</Text>
              {score.factors.map((factor, i) => {
                const cfg = IMPACT_CONFIG[factor.impact as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.neutral;
                return (
                  <View key={i} style={[s.factorRow, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.factorIcon, { color: cfg.color }]}>{cfg.symbol}</Text>
                    <View style={s.factorContent}>
                      <Text style={[s.factorName, { color: cfg.color }]}>{factor.name}</Text>
                      <Text style={[s.factorDesc, { color: cfg.color }]}>{factor.description}</Text>
                    </View>
                    {factor.value && (
                      <Text style={[s.factorValue, { color: cfg.color }]}>{factor.value}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── 6. Bancos elegiveis ── */}
          {score && score.eligibleBanks && score.eligibleBanks.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Bancos Elegiveis</Text>
              <View style={s.banksRow}>
                {score.eligibleBanks.map((bank) => (
                  <View key={bank} style={s.bankChip}>
                    <Text style={s.bankText}>{bank}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Documento confidencial — gerado automaticamente pela plataforma ScoreCasa
          </Text>
          <Text style={s.footerBrand}>ScoreCasa</Text>
        </View>

      </Page>
    </Document>
  );
}
