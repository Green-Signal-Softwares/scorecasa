import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetClientProfile,
  getGetClientProfileQueryKey,
} from "@workspace/api-client-react";
import { ClientLayout } from "@/components/layout/ClientLayout";

type Sistema = "SAC" | "PRICE";

interface BankProgram {
  id: string;
  bank: string;
  program: string;
  badgeColor: string;
  rateAA: number;
  trAA: number;
  maxLTV: number;
  maxYears: number;
  minDownPct: number;
  notes: string;
}

const PROGRAMS: BankProgram[] = [
  {
    id: "caixa-sbpe",
    bank: "Caixa",
    program: "SBPE Crédito Imobiliário",
    badgeColor: "#1F4E9D",
    rateAA: 10.49,
    trAA: 1.62,
    maxLTV: 0.8,
    maxYears: 35,
    minDownPct: 0.2,
    notes: "Taxa nominal a partir de 10,49% a.a. + TR. LTV até 80%. Prazo até 420 meses.",
  },
  {
    id: "caixa-mcmv",
    bank: "Caixa",
    program: "Minha Casa Minha Vida (Faixa 3)",
    badgeColor: "#10A65A",
    rateAA: 8.16,
    trAA: 0,
    maxLTV: 0.8,
    maxYears: 30,
    minDownPct: 0.2,
    notes: "Imóveis até R$ 350 mil. Renda familiar até R$ 8 mil. Sem TR.",
  },
  {
    id: "bb-sbpe",
    bank: "Banco do Brasil",
    program: "SBPE Tradicional",
    badgeColor: "#FFD500",
    rateAA: 10.99,
    trAA: 1.62,
    maxLTV: 0.8,
    maxYears: 35,
    minDownPct: 0.2,
    notes: "Taxa nominal a partir de 10,99% a.a. + TR. LTV até 80%.",
  },
  {
    id: "itau-sbpe",
    bank: "Itaú",
    program: "Crédito Imobiliário",
    badgeColor: "#EC7000",
    rateAA: 11.29,
    trAA: 1.62,
    maxLTV: 0.7,
    maxYears: 30,
    minDownPct: 0.3,
    notes: "Taxa a partir de 11,29% a.a. + TR. LTV até 70%.",
  },
  {
    id: "bradesco-sbpe",
    bank: "Bradesco",
    program: "Financiamento Imobiliário",
    badgeColor: "#CC092F",
    rateAA: 11.39,
    trAA: 1.62,
    maxLTV: 0.8,
    maxYears: 30,
    minDownPct: 0.2,
    notes: "Taxa a partir de 11,39% a.a. + TR.",
  },
  {
    id: "santander-sbpe",
    bank: "Santander",
    program: "Crédito Imobiliário",
    badgeColor: "#EC0000",
    rateAA: 11.59,
    trAA: 1.62,
    maxLTV: 0.8,
    maxYears: 35,
    minDownPct: 0.2,
    notes: "Taxa a partir de 11,59% a.a. + TR.",
  },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function maskBRL(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (parseInt(d, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\D/g, "")) / 100 || 0;
}

interface SimResult {
  parcelaInicial: number;
  parcelaFinal: number;
  totalPago: number;
  totalJuros: number;
  cetEstimado: number;
  primeiraParcela: number;
  comprometimento: number;
  rendaMinima: number;
  amortizacaoMensal: number;
  alerta?: string;
  schedule: Array<{ n: number; parcela: number; juros: number; amortizacao: number; saldo: number }>;
}

function simulate(opts: {
  valorImovel: number;
  entrada: number;
  prazoMeses: number;
  sistema: Sistema;
  rateAA: number;
  trAA: number;
  rendaMensal: number;
}): SimResult {
  const { valorImovel, entrada, prazoMeses, sistema, rateAA, trAA, rendaMensal } = opts;
  const valorFinanciado = Math.max(0, valorImovel - entrada);
  const taxaAA = rateAA + trAA;
  const i = Math.pow(1 + taxaAA / 100, 1 / 12) - 1;

  let parcelaInicial = 0,
    parcelaFinal = 0,
    totalPago = 0,
    amortMensal = 0;
  const schedule: SimResult["schedule"] = [];

  if (sistema === "SAC") {
    amortMensal = valorFinanciado / prazoMeses;
    let saldo = valorFinanciado;
    for (let n = 1; n <= prazoMeses; n++) {
      const juros = saldo * i;
      const parcela = amortMensal + juros;
      saldo -= amortMensal;
      totalPago += parcela;
      if (n === 1) parcelaInicial = parcela;
      if (n === prazoMeses) parcelaFinal = parcela;
      if (n <= 12 || n === prazoMeses || n % 60 === 0)
        schedule.push({ n, parcela, juros, amortizacao: amortMensal, saldo: Math.max(0, saldo) });
    }
  } else {
    const pmt = (valorFinanciado * i) / (1 - Math.pow(1 + i, -prazoMeses));
    parcelaInicial = pmt;
    parcelaFinal = pmt;
    let saldo = valorFinanciado;
    for (let n = 1; n <= prazoMeses; n++) {
      const juros = saldo * i;
      const amortizacao = pmt - juros;
      saldo -= amortizacao;
      totalPago += pmt;
      if (n <= 12 || n === prazoMeses || n % 60 === 0)
        schedule.push({ n, parcela: pmt, juros, amortizacao, saldo: Math.max(0, saldo) });
    }
    amortMensal = pmt - valorFinanciado * i;
  }

  const totalJuros = totalPago - valorFinanciado;
  const cetEstimado = ((totalJuros / valorFinanciado / (prazoMeses / 12)) * 100) || 0;
  const comprometimento = rendaMensal > 0 ? (parcelaInicial / rendaMensal) * 100 : 0;
  const rendaMinima = parcelaInicial / 0.3;

  let alerta: string | undefined;
  if (rendaMensal > 0 && comprometimento > 30) {
    alerta = `Comprometimento de ${comprometimento.toFixed(1)}% da renda. Bancos limitam em 30% — você precisaria de renda de ${formatBRL(rendaMinima)} ou aumentar a entrada / prazo.`;
  }

  return {
    parcelaInicial,
    parcelaFinal,
    totalPago,
    totalJuros,
    cetEstimado,
    primeiraParcela: parcelaInicial,
    comprometimento,
    rendaMinima,
    amortizacaoMensal: amortMensal,
    alerta,
    schedule,
  };
}

export function ClientSimulador() {
  const [, setLocation] = useLocation();

  const { data: me, isLoading: loadingMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });
  const { data: profile, isLoading } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000 },
  });

  useEffect(() => {
    if (!loadingMe && me && me.role !== "client") setLocation("/dashboard");
    if (!loadingMe && !me) setLocation("/login");
  }, [loadingMe, me, setLocation]);

  const lead = profile?.lead;

  const initialIncome = lead?.income ?? 0;
  const initialPropValue = lead?.propertyValue ?? 0;
  const initialEntrada = initialPropValue ? Math.round(initialPropValue * 0.2) : 0;

  const [valorImovelStr, setValorImovelStr] = useState(initialPropValue ? formatBRL(initialPropValue) : "");
  const [entradaStr, setEntradaStr] = useState(initialEntrada ? formatBRL(initialEntrada) : "");
  const [rendaStr, setRendaStr] = useState(initialIncome ? formatBRL(initialIncome) : "");
  const [prazoAnos, setPrazoAnos] = useState(30);
  const [sistema, setSistema] = useState<Sistema>("SAC");
  const [programId, setProgramId] = useState<string>("caixa-sbpe");

  useEffect(() => {
    if (lead) {
      if (!valorImovelStr && lead.propertyValue) {
        setValorImovelStr(formatBRL(lead.propertyValue));
        setEntradaStr(formatBRL(Math.round(lead.propertyValue * 0.2)));
      }
      if (!rendaStr && lead.income) setRendaStr(formatBRL(lead.income));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  const valorImovel = parseBRL(valorImovelStr);
  const entrada = parseBRL(entradaStr);
  const renda = parseBRL(rendaStr);
  const prazoMeses = prazoAnos * 12;
  const program = PROGRAMS.find((p) => p.id === programId)!;

  const minEntrada = valorImovel * program.minDownPct;
  const entradaInsuficiente = entrada > 0 && entrada < minEntrada;

  const valid = valorImovel > 0 && entrada > 0 && entrada < valorImovel && prazoMeses > 0;

  const result = useMemo<SimResult | null>(() => {
    if (!valid) return null;
    return simulate({
      valorImovel,
      entrada,
      prazoMeses,
      sistema,
      rateAA: program.rateAA,
      trAA: program.trAA,
      rendaMensal: renda,
    });
  }, [valorImovel, entrada, prazoMeses, sistema, program, renda, valid]);

  const valorFinanciado = Math.max(0, valorImovel - entrada);
  const ltv = valorImovel > 0 ? valorFinanciado / valorImovel : 0;
  const ltvExcedido = ltv > program.maxLTV;
  const prazoExcedido = prazoAnos > program.maxYears;

  if (loadingMe || isLoading || !me || me.role !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07113A" }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClientLayout userName={me.name} activePage="simulador">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
          Simulador de Financiamento
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Simule sua parcela mensal com taxas de mercado dos principais bancos. Cálculos baseados nos sistemas SAC e Price.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* ── Coluna esquerda: parâmetros ── */}
        <div className="space-y-6">
          {/* Banco / programa */}
          <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Banco e Programa
            </p>
            <div className="space-y-2">
              {PROGRAMS.map((p) => {
                const active = p.id === programId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProgramId(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                      active
                        ? "border-transparent shadow-md"
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                    style={active ? { background: "#0D1B8C", color: "white" } : {}}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${active ? "text-white" : "text-gray-900"}`}>
                          {p.bank}
                        </div>
                        <div className={`text-xs truncate ${active ? "text-blue-200" : "text-gray-500"}`}>
                          {p.program}
                        </div>
                      </div>
                      <div className={`text-xs font-bold flex-shrink-0 ${active ? "text-[#10A65A]" : "text-gray-700"}`}>
                        {p.rateAA.toFixed(2)}% a.a.
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed italic">
              {program.notes}
            </p>
          </div>

          {/* Parâmetros do imóvel */}
          <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Parâmetros
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor do imóvel</label>
              <input
                type="text"
                inputMode="numeric"
                value={valorImovelStr}
                onChange={(e) => setValorImovelStr(maskBRL(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0D1B8C]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Entrada{" "}
                {valorImovel > 0 && (
                  <span className="text-gray-400">
                    (mín. {(program.minDownPct * 100).toFixed(0)}% = {formatBRL(minEntrada)})
                  </span>
                )}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={entradaStr}
                onChange={(e) => setEntradaStr(maskBRL(e.target.value))}
                placeholder="R$ 0,00"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none ${
                  entradaInsuficiente ? "border-amber-400 bg-amber-50" : "border-gray-200 focus:border-[#0D1B8C]"
                }`}
              />
              {entradaInsuficiente && (
                <p className="text-xs text-amber-700 mt-1">
                  Entrada abaixo do mínimo exigido pelo programa.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Prazo: <strong>{prazoAnos} anos</strong> ({prazoMeses} meses)
              </label>
              <input
                type="range"
                min={5}
                max={Math.min(35, program.maxYears)}
                step={1}
                value={Math.min(prazoAnos, program.maxYears)}
                onChange={(e) => setPrazoAnos(parseInt(e.target.value, 10))}
                className="w-full accent-[#0D1B8C]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>5 anos</span>
                <span>{program.maxYears} anos (máx)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sistema de amortização</label>
              <div className="grid grid-cols-2 gap-2">
                {(["SAC", "PRICE"] as Sistema[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSistema(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      sistema === s
                        ? "text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                    style={sistema === s ? { background: "#0D1B8C" } : {}}
                  >
                    {s === "SAC" ? "SAC" : "Price"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                <strong>SAC</strong>: parcela cai ao longo do tempo (juros menores no total). <strong>Price</strong>: parcela fixa.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Renda mensal bruta</label>
              <input
                type="text"
                inputMode="numeric"
                value={rendaStr}
                onChange={(e) => setRendaStr(maskBRL(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0D1B8C]"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Bancos limitam parcela a 30% da renda mensal.
              </p>
            </div>
          </div>
        </div>

        {/* ── Coluna direita: resultado ── */}
        <div className="space-y-6">
          {!valid ? (
            <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-12 text-center text-gray-400">
              Preencha o valor do imóvel, a entrada e o prazo para simular.
            </div>
          ) : (
            result && (
              <>
                {/* Cards principais */}
                <div className="rounded-2xl shadow-sm overflow-hidden bg-white border border-gray-100">
                  <div className="px-5 py-4 flex items-center justify-between" style={{ background: "#07113A" }}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                        RESULTADO DA SIMULAÇÃO
                      </p>
                      <p className="text-white font-bold text-lg">
                        {program.bank} — {program.program}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: "#10A65A22",
                        color: "#10A65A",
                        border: "1px solid #10A65A55",
                      }}
                    >
                      {sistema} · {prazoAnos} anos
                    </span>
                  </div>

                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat
                      label={sistema === "SAC" ? "1ª parcela" : "Parcela mensal"}
                      value={formatBRL(result.parcelaInicial)}
                      accent="#0D1B8C"
                      large
                    />
                    {sistema === "SAC" && (
                      <Stat
                        label="Última parcela"
                        value={formatBRL(result.parcelaFinal)}
                        accent="#10A65A"
                        large
                      />
                    )}
                    <Stat
                      label="Valor financiado"
                      value={formatBRL(valorFinanciado)}
                    />
                    <Stat
                      label="Total a pagar"
                      value={formatBRL(result.totalPago + entrada)}
                    />
                    <Stat
                      label="Total de juros"
                      value={formatBRL(result.totalJuros)}
                      accent="#EF4444"
                    />
                    <Stat
                      label="Taxa efetiva (a.a.)"
                      value={`${(program.rateAA + program.trAA).toFixed(2)}%`}
                    />
                    <Stat
                      label="LTV (% financiado)"
                      value={`${(ltv * 100).toFixed(1)}%`}
                      accent={ltvExcedido ? "#EF4444" : undefined}
                    />
                    <Stat
                      label="CET estimado (a.a.)"
                      value={`${result.cetEstimado.toFixed(2)}%`}
                    />
                  </div>
                </div>

                {/* Comprometimento de renda */}
                {renda > 0 && (
                  <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                      Comprometimento da renda (DTI)
                    </p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span
                        className="text-4xl font-black"
                        style={{ color: result.comprometimento <= 30 ? "#10A65A" : "#EF4444" }}
                      >
                        {result.comprometimento.toFixed(1)}%
                      </span>
                      <span className="text-sm text-gray-400">da renda mensal</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, result.comprometimento)}%`,
                          background:
                            result.comprometimento <= 30
                              ? "linear-gradient(90deg,#10A65A,#84CC16)"
                              : "linear-gradient(90deg,#F59E0B,#EF4444)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>0%</span>
                      <span className="font-semibold text-gray-600">limite 30%</span>
                      <span>100%</span>
                    </div>
                    {result.alerta && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
                        ⚠ {result.alerta}
                      </div>
                    )}
                    {result.comprometimento <= 30 && (
                      <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-green-700">
                        ✓ Parcela dentro do limite de 30% da sua renda.
                      </div>
                    )}
                  </div>
                )}

                {/* Avisos de viabilidade */}
                {(ltvExcedido || prazoExcedido) && (
                  <div className="rounded-2xl shadow-sm border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm font-bold text-amber-800 mb-2">⚠ Atenção aos limites do programa</p>
                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                      {ltvExcedido && (
                        <li>
                          LTV de {(ltv * 100).toFixed(1)}% acima do máximo de{" "}
                          {(program.maxLTV * 100).toFixed(0)}% para {program.bank}. Aumente a entrada para{" "}
                          {formatBRL(valorImovel * (1 - program.maxLTV))} ou mais.
                        </li>
                      )}
                      {prazoExcedido && (
                        <li>
                          Prazo de {prazoAnos} anos excede o máximo de {program.maxYears} anos do programa.
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Tabela de evolução */}
                <div className="rounded-2xl shadow-sm border border-gray-100 bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Evolução das Parcelas
                    </p>
                    <span className="text-[11px] text-gray-400">
                      Mostrando 1º ano + a cada 5 anos
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Mês</th>
                          <th className="px-4 py-2 text-right font-semibold">Parcela</th>
                          <th className="px-4 py-2 text-right font-semibold">Juros</th>
                          <th className="px-4 py-2 text-right font-semibold">Amortização</th>
                          <th className="px-4 py-2 text-right font-semibold">Saldo devedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.schedule.map((row) => (
                          <tr key={row.n} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <td className="px-4 py-2 text-gray-700 font-medium">{row.n}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">{formatBRL(row.parcela)}</td>
                            <td className="px-4 py-2 text-right text-red-600">{formatBRL(row.juros)}</td>
                            <td className="px-4 py-2 text-right text-green-700">{formatBRL(row.amortizacao)}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{formatBRL(row.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-xs text-gray-400 italic px-1">
                  Simulação com base em taxas referenciais de mercado em {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}. As condições efetivas de aprovação, taxas e prazos dependem da análise de crédito de cada instituição. Valores meramente ilustrativos.
                </p>
              </>
            )
          )}
        </div>
      </div>
    </ClientLayout>
  );
}

function Stat({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: string;
  accent?: string;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p
        className={`font-black ${large ? "text-2xl" : "text-base"} leading-tight`}
        style={{ color: accent ?? "#07113A" }}
      >
        {value}
      </p>
    </div>
  );
}
