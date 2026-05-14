import { useGetClientProfile, getGetClientProfileQueryKey } from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { SCRImport } from "@/components/portal/SCRImport";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";

// ── IPA helpers ──────────────────────────────────────────────────────────────

function computeIPA(lead: {
  scoreCaixa: number;
  income: number;
  propertyValue: number;
  informalIncome?: number | null;
  spouseIncome?: number | null;
}) {
  const totalIncome = lead.income + (lead.informalIncome ?? 0) * 0.7 + (lead.spouseIncome ?? 0);
  const S = Math.min(100, Math.max(0, Math.round((lead.scoreCaixa - 300) / 7)));
  const ratio = lead.propertyValue / (totalIncome * 12);
  const D = Math.min(100, Math.max(0, Math.round(100 - (ratio / 4.5) * 30)));
  const H = 70;
  const R = 55;
  const IPA = Math.round(S * 0.40 + D * 0.30 + H * 0.20 + R * 0.10);
  return { S, D, H, R, IPA };
}

function ipaClassification(ipa: number): { label: string; prob: string; color: string } {
  if (ipa >= 85) return { label: "Excelente", prob: "Altíssima (aprova valor máximo e menores taxas)", color: "#10A65A" };
  if (ipa >= 70) return { label: "Bom",       prob: "Alta (pode haver redução no valor financiado)", color: "#10A65A" };
  if (ipa >= 50) return { label: "Moderado",  prob: "Incerta (exige mais entrada ou fiador/composição)", color: "#F59E0B" };
  return              { label: "Crítico",     prob: "Baixa (provável reprovação por risco de crédito)", color: "#EF4444" };
}

// ── Shared visual components ─────────────────────────────────────────────────

function GradientBar({ value, max = 100 }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="relative py-2">
      <div className="h-3 rounded-full overflow-visible" style={{ background: "linear-gradient(to right, #EF4444 0%, #F59E0B 35%, #84CC16 65%, #10A65A 100%)" }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[3px] border-white shadow-md"
        style={{ left: `calc(${pct}% - 10px)`, background: "#1a1a2e" }}
      />
    </div>
  );
}

function Speedometer({ value, max = 1000 }: { value: number; max: number }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const cx = 110, cy = 105, r = 82;

  const getArcPath = (from: number, to: number) => {
    const a1 = Math.PI - from * Math.PI;
    const a2 = Math.PI - to * Math.PI;
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy - r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  const segments = [
    { from: 0,    to: 0.25, color: "#EF4444" },
    { from: 0.25, to: 0.50, color: "#F59E0B" },
    { from: 0.50, to: 0.75, color: "#84CC16" },
    { from: 0.75, to: 1.00, color: "#10A65A" },
  ];

  const needleAngle = Math.PI - pct * Math.PI;
  const nx = cx + 68 * Math.cos(needleAngle);
  const ny = cy - 68 * Math.sin(needleAngle);

  return (
    <svg viewBox="0 0 220 115" className="w-full max-w-xs mx-auto">
      <path d={getArcPath(0, 1)} fill="none" stroke="#E5E7EB" strokeWidth="14" />
      {segments.map((s, i) => (
        <path key={i} d={getArcPath(s.from, s.to)} fill="none" stroke={s.color} strokeWidth="14" />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#07113A" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="9" fill="#07113A" />
      <circle cx={cx} cy={cy} r="4" fill="white" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClientPortal() {
  const [, setLocation] = useLocation();

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
    if (!loadingMe && !me) setLocation("/login");
  }, [loadingMe, me, setLocation]);

  const { data: profile, isLoading } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000 },
  });

  if (loadingMe || isLoading || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <ClientLayout userName={me.name} activePage="dashboard">
        <div className="text-center py-20 text-gray-500">Perfil não encontrado.</div>
      </ClientLayout>
    );
  }

  const { lead } = profile;
  const { S, D, H, R, IPA } = computeIPA(lead as any);
  const ipaClass = ipaClassification(IPA);
  const scoreColor = lead.scoreCaixa >= 700 ? "#10A65A" : lead.scoreCaixa >= 500 ? "#F59E0B" : "#EF4444";

  const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const cpfMasked = lead.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***.$$4").replace("$$4", lead.cpf.slice(-2));
  const totalIncome = lead.income + ((lead as any).informalIncome ?? 0) * 0.7 + ((lead as any).spouseIncome ?? 0);

  let ageText = "—";
  if ((lead as any).birthDate) {
    const age = Math.floor((Date.now() - new Date((lead as any).birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    ageText = `${age} anos`;
  }

  const employmentTypeLabels: Record<string, string> = {
    clt: "CLT / Empregado",
    servidor_publico: "Servidor Público",
    autonomo: "Autônomo",
    liberal: "Profissional Liberal",
    empresario: "Empresário / MEI",
    aposentado: "Aposentado",
    desempregado: "Desempregado",
  };
  const maritalLabels: Record<string, string> = {
    solteiro: "Solteiro(a)",
    casado: "Casado(a)",
    uniao_estavel: "União Estável",
    divorciado: "Divorciado(a)",
    viuvo: "Viúvo(a)",
  };

  const incomeType = (lead as any).employmentType ? (employmentTypeLabels[(lead as any).employmentType] ?? (lead as any).employmentType) : "Não informado";
  const maritalLabel = (lead as any).maritalStatus ? (maritalLabels[(lead as any).maritalStatus] ?? (lead as any).maritalStatus) : "Não informado";

  return (
    <ClientLayout userName={me.name} activePage="dashboard">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Olá, {me.name.split(" ")[0]}.
        </h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo à sua área. Aqui você poderá acompanhar suas informações e interações.</p>
      </div>

      {/* ── Scorecasa Crédito ─────────────────────────────────────────── */}
      <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 bg-white">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: "#07113A" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">SCORE DE PERFIL</p>
            <p className="text-white font-bold text-lg">Scorecasa Crédito</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#10A65A22", color: "#10A65A", border: "1px solid #10A65A55" }}>
            ⚪ Estimativa
          </span>
        </div>

        <div className="p-5">
          {/* Speedometer */}
          <div className="mb-2">
            <Speedometer value={lead.scoreCaixa} max={1000} />
          </div>

          <div className="text-center mb-4">
            <div className="text-4xl font-black" style={{ color: scoreColor }}>
              {lead.scoreCaixa} <span className="text-xl font-normal text-gray-400">/ 1000</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Referência atualizada em {now}</p>
          </div>

          {/* Profile status */}
          {lead.approvalChance >= 60 ? (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-green-50 border border-green-100">
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Perfil favorável</span>
              <span className="text-xs text-green-600">Você está acima da média do mercado</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">⚠ Atenção</span>
              <span className="text-xs text-amber-600">Perfil requer melhorias antes de solicitar financiamento</span>
            </div>
          )}

          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {lead.aiRecommendation ?? "Com base em simulação ilustrativa, seu indicador sugere capacidade de negociação na busca por financiamento ou locação. Esta é uma visualização de demonstração — não substitui consulta oficial em bureaus de crédito."}
          </p>

          {/* Risk bar */}
          <div className="mb-2">
            <GradientBar value={lead.scoreCaixa} max={1000} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Risco alto</span>
              <span>Médio</span>
              <span>Risco baixo</span>
            </div>
          </div>

          {/* Notices */}
          <div className="mt-4 space-y-1.5 text-xs text-gray-500">
            <p>↑ <strong>Pontos positivos:</strong> histórico simulado de cadastro completo e engajamento na plataforma.</p>
            <p>● <strong>Dica:</strong> manter dados atualizados pode melhorar sua visibilidade para corretores parceiros.</p>
            <p className="text-gray-400">🔒 Dados exibidos são <em>fictícios</em>, apenas para layout da área do cliente.</p>
          </div>
        </div>
      </div>

      {/* ── IPA ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl shadow-sm overflow-hidden mb-6">
        {/* Dark green header */}
        <div className="px-5 py-4" style={{ background: "#0D4A2C" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg" style={{ background: "#0D6B40" }}>
              📊
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-green-300">SIMULAÇÃO EDUCATIVA</p>
              <p className="text-white font-bold text-lg leading-tight">Índice de Potencial de Aprovação (IPA)</p>
            </div>
          </div>
          <p className="text-green-200 text-sm mt-3 leading-relaxed">
            Combina score de crédito, comprometimento de renda (DTI), histórico no Bacen e relacionamento com o banco — todos normalizados de 0 a 100.
          </p>
        </div>

        <div className="bg-white p-5 space-y-5">
          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <span className="mt-0.5">ℹ</span>
            <span><strong>Valores ilustrativos.</strong> Complete seu cadastro para calcular o IPA com o score modelo Scorecasa e o comprometimento informado.</span>
          </div>

          {/* Formula */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">FÓRMULA</p>
            <p className="font-mono text-sm text-gray-800">IPA = (S × 0,40) + (D × 0,30) + (H × 0,20) + (R × 0,10)</p>
          </div>

          {/* IPA score */}
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black" style={{ color: ipaClass.color }}>{IPA}</span>
              <span className="text-xl text-gray-400 font-light">/ 100</span>
            </div>
            <p className="font-semibold text-sm mb-0.5" style={{ color: ipaClass.color }}>{ipaClass.label}</p>
            <p className="text-xs text-gray-500 mb-3">{ipaClass.prob}</p>
            <GradientBar value={IPA} max={100} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>

          {/* Variables table */}
          <div>
            <p className="font-bold text-gray-800 mb-2">Variáveis (0 a 100)</p>
            <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">
              <div className="grid grid-cols-[1fr_60px_60px] bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <span>Variável</span>
                <span className="text-right">Peso</span>
                <span className="text-right">Valor</span>
              </div>
              {[
                { key: "S", label: "Score de crédito (Serasa/Boa Vista)", peso: "40%", valor: S, estim: false },
                { key: "D", label: "Comprometimento de dívida (DTI)",     peso: "30%", valor: D, estim: false },
                { key: "H", label: "Histórico SCR / Registrato (Bacen)",  peso: "20%", valor: H, estim: true  },
                { key: "R", label: "Relacionamento com a instituição",    peso: "10%", valor: R, estim: true  },
              ].map((row) => (
                <div key={row.key} className="grid grid-cols-[1fr_60px_60px] px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white" style={{ background: "#0D1B8C" }}>{row.key}</span>
                    <span className="text-gray-700 text-xs leading-tight">{row.label}</span>
                    {row.estim && <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: "#EFF6FF", color: "#0D1B8C" }}>estim.</span>}
                  </div>
                  <span className="text-right text-gray-500 text-sm">{row.peso}</span>
                  <span className="text-right font-bold text-gray-900">{row.valor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Variable descriptions */}
          <ul className="space-y-2 text-xs text-gray-600 leading-relaxed">
            <li><span className="font-bold">S</span> — Score de crédito (Serasa/Boa Vista): sua pontuação oficial de mercado. Peso 40% (principal filtro inicial).</li>
            <li><span className="font-bold">D</span> — Comprometimento de dívida (DTI): D = 100 − ((dívidas mensais ÷ renda bruta) × 0,3 × 100), limitado a 0–100. Sem dívidas = 100; ao usar toda a margem de 30% da renda em dívidas = 0. Peso 30%.</li>
            <li><span className="font-bold">H</span> — Histórico no Banco Central (SCR/Registrato): atrasos nos últimos 24 meses. Sem atrasos = 100; atrasos frequentes tendem a 0. Peso 20%.<br /><em className="text-gray-400">Sem dados Registrato integrados — valor neutro (50) aplicado. Substituirá quando houver consulta.</em></li>
            <li><span className="font-bold">R</span> — Relacionamento com a instituição: tempo de conta, salário, investimentos ou seguros. Peso 10% (desempate / melhores taxas).<br /><em className="text-gray-400">Sem dados de relacionamento — valor neutro (50) aplicado.</em></li>
          </ul>

          {/* Interpretation table */}
          <div>
            <p className="font-bold text-gray-800 mb-2">Interpretação do IPA</p>
            <div className="rounded-xl border border-gray-100 overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-gray-50 px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <span>IPA</span>
                <span>Classificação</span>
                <span>Probabilidade De Aprovação</span>
              </div>
              {[
                { range: "85 a 100", class: "Excelente", prob: "Altíssima (aprova valor máximo e menores taxas)",     active: IPA >= 85 },
                { range: "70 a 84",  class: "Bom",       prob: "Alta (pode haver redução no valor financiado)",       active: IPA >= 70 && IPA < 85 },
                { range: "50 a 69",  class: "Moderado",  prob: "Incerta (exige mais entrada ou fiador/composição)",  active: IPA >= 50 && IPA < 70 },
                { range: "Abaixo de 50", class: "Crítico", prob: "Baixa (provável reprovação por risco de crédito)", active: IPA < 50 },
              ].map((row) => (
                <div key={row.range} className={`grid grid-cols-3 px-4 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${row.active ? "bg-blue-50" : ""}`}>
                  <span className={row.active ? "font-bold" : ""}>{row.range}</span>
                  <span className={row.active ? "font-bold" : ""}>{row.class}</span>
                  <span>{row.prob}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 italic">O IPA é uma referência educativa. A decisão de crédito cabe a cada instituição e pode usar outros critérios.</p>
        </div>
      </div>

      {/* ── SCR Registrato (Banco Central) ───────────────────────────── */}
      <SCRImport lead={lead as any} />

      {/* ── Resultado da Pesquisa ────────────────────────────────────── */}
      <div className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 bg-white">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">RESULTADO DA PESQUISA</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4 italic">Ilustrativo — bases CADIN, SERASA, SCPC e protesto não foram consultadas.</p>
          <div className="rounded-xl border border-gray-100 overflow-hidden text-xs">
            {[
              { label: "Nome do cliente", value: me.name },
              { label: "CPF",             value: cpfMasked },
              { label: "Data/hora",       value: now },
              { label: "CADIN",           value: "Não consultado" },
              { label: "SERASA",          value: "Não consultado" },
              { label: "SCPC",            value: "Não consultado" },
              { label: "Protesto",        value: "Não consultado" },
            ].map((row) => (
              <div key={row.label} className="flex border-b border-gray-50 last:border-0">
                <div className="w-36 px-4 py-2.5 font-semibold text-gray-600 bg-gray-50 flex-shrink-0">{row.label}</div>
                <div className="px-4 py-2.5 text-gray-800">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dados utilizados ─────────────────────────────────────────── */}
      <div className="rounded-2xl shadow-sm border border-gray-100 bg-white mb-6 p-5">
        <p className="font-bold text-gray-800 mb-3">Dados utilizados</p>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li>• <strong>Renda mensal considerada (titular):</strong> {totalIncome.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</li>
          <li>• <strong>Tipo de renda:</strong> {incomeType}</li>
          <li>• <strong>Comprometimento (dívidas):</strong> {D > 0 ? `${100 - D}%` : "0% (sem dado no cadastro → 0%)"}</li>
          <li>• <strong>Idade:</strong> {ageText}</li>
          <li>• <strong>Cidade:</strong> {(lead as any).propertyCity ? `${(lead as any).propertyCity}` : "fator neutro 0,5 (sem índice regional no sistema)"}</li>
          <li>• <strong>Estado civil:</strong> {maritalLabel}</li>
          <li>• <strong>Dependentes:</strong> {((lead as any).maritalStatus === "casado" || (lead as any).maritalStatus === "uniao_estavel") && (lead as any).spouseName ? "1 (cônjuge informado)" : "0 (campo não informado no cadastro)"}</li>
        </ul>
        <p className="text-xs text-gray-400 mt-3">Faixas de referência: ≥ 70 alta probabilidade de aprovação; 50–69 análise complementar; &lt; 50 cenário mais conservador.</p>
      </div>
    </ClientLayout>
  );
}
