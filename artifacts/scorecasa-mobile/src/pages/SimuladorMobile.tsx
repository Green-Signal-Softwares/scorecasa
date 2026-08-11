import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetMe,
  getGetMeQueryKey,
  useGetClientProfile,
  getGetClientProfileQueryKey,
  useGetRatesCurrent,
  getGetRatesCurrentQueryKey,
} from "@workspace/api-client-react";
import {
  Calculator,
  CheckCircle2,
  Building2,
  DollarSign,
  SlidersHorizontal,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Info,
  Landmark,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Sistema = "SAC" | "PRICE";

interface BankProgram {
  id: string;
  bank: string;
  program: string;
  dot: string;
  rateAA: number;
  trAA: number;
  maxLTV: number;
  maxYears: number;
  minDownPct: number;
  notes: string;
}

const PROGRAM_RATE_KEYS: Record<string, { bankSlug: string; product: string }> = {
  "caixa-sbpe":     { bankSlug: "caixa",     product: "sbpe" },
  "caixa-mcmv":     { bankSlug: "caixa",     product: "mcmv_f3" },
  "bb-sbpe":        { bankSlug: "bb",        product: "sbpe" },
  "itau-sbpe":      { bankSlug: "itau",      product: "sbpe" },
  "bradesco-sbpe":  { bankSlug: "bradesco",  product: "sbpe" },
  "santander-sbpe": { bankSlug: "santander", product: "sbpe" },
};

const PROGRAMS: BankProgram[] = [
  { id: "caixa-sbpe",     bank: "Caixa",         program: "SBPE",       dot: "#1F4E9D", rateAA: 10.49, trAA: 1.62, maxLTV: 0.8, maxYears: 35, minDownPct: 0.2, notes: "Taxa a partir de 10,49% a.a. + TR. LTV até 80%." },
  { id: "caixa-mcmv",     bank: "Caixa",         program: "MCMV F3",    dot: "#10A65A", rateAA: 8.16,  trAA: 0,    maxLTV: 0.8, maxYears: 30, minDownPct: 0.2, notes: "Imóveis até R$ 350 mil. Renda até R$ 8 mil." },
  { id: "bb-sbpe",        bank: "Banco do Brasil",program: "SBPE",       dot: "#FFD500", rateAA: 10.99, trAA: 1.62, maxLTV: 0.8, maxYears: 35, minDownPct: 0.2, notes: "Taxa a partir de 10,99% a.a. + TR." },
  { id: "itau-sbpe",      bank: "Itaú",          program: "Crédito Imob",dot: "#EC7000", rateAA: 11.29, trAA: 1.62, maxLTV: 0.7, maxYears: 30, minDownPct: 0.3, notes: "Taxa a partir de 11,29% a.a. + TR. LTV até 70%." },
  { id: "bradesco-sbpe",  bank: "Bradesco",       program: "Financiamento",dot: "#CC092F", rateAA: 11.39, trAA: 1.62, maxLTV: 0.8, maxYears: 30, minDownPct: 0.2, notes: "Taxa a partir de 11,39% a.a. + TR." },
  { id: "santander-sbpe", bank: "Santander",      program: "Crédito Imob",dot: "#EC0000", rateAA: 11.59, trAA: 1.62, maxLTV: 0.8, maxYears: 35, minDownPct: 0.2, notes: "Taxa a partir de 11,59% a.a. + TR." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function maskBRL(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (parseInt(d, 10) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\D/g, "")) / 100 || 0;
}

// ── Simulation engine ─────────────────────────────────────────────────────────
interface SimResult {
  parcelaInicial: number;
  parcelaFinal: number;
  totalPago: number;
  totalJuros: number;
  comprometimento: number;
  rendaMinima: number;
  alerta?: string;
}

function simulate(opts: {
  valorImovel: number; entrada: number; prazoMeses: number;
  sistema: Sistema; rateAA: number; trAA: number; rendaMensal: number;
}): SimResult {
  const { valorImovel, entrada, prazoMeses, sistema, rateAA, trAA, rendaMensal } = opts;
  const valorFinanciado = Math.max(0, valorImovel - entrada);
  const i = Math.pow(1 + (rateAA + trAA) / 100, 1 / 12) - 1;

  let parcelaInicial = 0, parcelaFinal = 0, totalPago = 0;

  if (sistema === "SAC") {
    const amortMensal = valorFinanciado / prazoMeses;
    let saldo = valorFinanciado;
    for (let n = 1; n <= prazoMeses; n++) {
      const parcela = amortMensal + saldo * i;
      saldo -= amortMensal;
      totalPago += parcela;
      if (n === 1) parcelaInicial = parcela;
      if (n === prazoMeses) parcelaFinal = parcela;
    }
  } else {
    const pmt = (valorFinanciado * i) / (1 - Math.pow(1 + i, -prazoMeses));
    parcelaInicial = pmt;
    parcelaFinal = pmt;
    totalPago = pmt * prazoMeses;
  }

  const totalJuros = totalPago - valorFinanciado;
  const comprometimento = rendaMensal > 0 ? (parcelaInicial / rendaMensal) * 100 : 0;
  const rendaMinima = parcelaInicial / 0.3;

  const alerta =
    rendaMensal > 0 && comprometimento > 30
      ? `Comprometimento de ${comprometimento.toFixed(1)}% da renda. Bancos limitam em 30% — renda mínima necessária: ${fmtBRL(rendaMinima)}.`
      : undefined;

  return { parcelaInicial, parcelaFinal, totalPago, totalJuros, comprometimento, rendaMinima, alerta };
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav() {
  const [, setLocation] = useLocation();
  const tabs = [
    { label: "Score",      icon: CheckCircle2,      href: "/portal/score" },
    { label: "Imóveis",    icon: Building2,          href: "/portal/imoveis" },
    { label: "Simulador",  icon: Calculator,          href: "/portal/simulador" },
    { label: "Pagamentos", icon: DollarSign,          href: "/portal/pagamentos" },
    { label: "Dívidas",    icon: Landmark,            href: "/portal/dividas" },
    { label: "Dados",      icon: SlidersHorizontal,   href: "/portal/meus-dados" },
  ];
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around pt-3"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 50,
      }}
    >
      {tabs.map(({ label, icon: Icon, href }) => {
        const active = href === "/portal/simulador";
        return (
          <button
            key={label}
            type="button"
            onClick={() => setLocation(href)}
            className="flex flex-col items-center gap-1"
          >
            <Icon className="w-5 h-5" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }} />
            <span className="text-[10px] font-semibold" style={{ color: active ? "#0D1B8C" : "#9CA3AF" }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-1 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-base font-extrabold" style={{ color: accent ?? "#07113A" }}>{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SimuladorMobile() {
  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000 },
  });
  const { data: profile } = useGetClientProfile({
    query: { queryKey: getGetClientProfileQueryKey(), staleTime: 30_000, retry: false },
  });
  const { data: liveRatesData } = useGetRatesCurrent({
    query: { queryKey: getGetRatesCurrentQueryKey(), staleTime: 5 * 60_000, retry: false },
  });

  // Merge live rates
  const livePrograms = useMemo<BankProgram[]>(() => {
    const live = (liveRatesData ?? []) as Array<{ bankSlug: string; product: string; rateAA: number }>;
    if (!live.length) return PROGRAMS;
    const byKey = new Map(live.map((r) => [`${r.bankSlug}|${r.product}`, r]));
    return PROGRAMS.map((p) => {
      const m = PROGRAM_RATE_KEYS[p.id];
      if (!m) return p;
      const found = byKey.get(`${m.bankSlug}|${m.product}`);
      return found ? { ...p, rateAA: found.rateAA } : p;
    });
  }, [liveRatesData]);

  const lead = profile?.lead;

  // Form state — pre-fill from profile
  const [valorImovelStr, setValorImovelStr] = useState(
    lead?.propertyValue ? maskBRL(String(Math.round((lead.propertyValue) * 100))) : ""
  );
  const [entradaStr, setEntradaStr] = useState(
    lead?.propertyValue ? maskBRL(String(Math.round(lead.propertyValue * 0.2 * 100))) : ""
  );
  const [rendaStr, setRendaStr] = useState(
    lead?.income ? maskBRL(String(Math.round((lead.income) * 100))) : ""
  );
  const [prazoAnos, setPrazoAnos] = useState(30);
  const [sistema, setSistema] = useState<Sistema>("SAC");
  const [programId, setProgramId] = useState("caixa-sbpe");
  const [showBankPicker, setShowBankPicker] = useState(false);

  const program = livePrograms.find((p) => p.id === programId) ?? PROGRAMS[0];
  const valorImovel = parseBRL(valorImovelStr);
  const entrada = parseBRL(entradaStr);
  const renda = parseBRL(rendaStr);
  const prazoMeses = prazoAnos * 12;
  const valorFinanciado = Math.max(0, valorImovel - entrada);
  const ltv = valorImovel > 0 ? valorFinanciado / valorImovel : 0;
  const minEntrada = valorImovel * program.minDownPct;
  const entradaInsuficiente = entrada > 0 && entrada < minEntrada;
  const ltvExcedido = ltv > program.maxLTV;
  const valid = valorImovel > 0 && entrada > 0 && entrada < valorImovel && prazoMeses > 0 && !entradaInsuficiente;

  const result = useMemo<SimResult | null>(() => {
    if (!valid) return null;
    return simulate({ valorImovel, entrada, prazoMeses, sistema, rateAA: program.rateAA, trAA: program.trAA, rendaMensal: renda });
  }, [valid, valorImovel, entrada, prazoMeses, sistema, program, renda]);

  const taxaEfetiva = program.rateAA + program.trAA;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F4F7", fontFamily: "Poppins, sans-serif", paddingBottom: 90 }}
    >
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #0D1B8C 0%, #07113A 100%)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>Olá,</div>
            <div className="text-base font-bold text-white">{me?.name ?? "Cliente"}</div>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
            style={{ background: "rgba(16,166,90,0.2)", color: "#10A65A", border: "1px solid rgba(16,166,90,0.3)" }}
          >
            <Calculator className="w-3.5 h-3.5" />
            Simulador
          </div>
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          Simule sua parcela com taxas reais dos principais bancos.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4">

        {/* Bank selector */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBankPicker((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: program.dot }} />
              <div className="text-left">
                <div className="text-sm font-bold" style={{ color: "#07113A" }}>{program.bank}</div>
                <div className="text-xs" style={{ color: "#6B7280" }}>{program.program}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold" style={{ color: "#0D1B8C" }}>
                {program.rateAA.toFixed(2)}% a.a.
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{ color: "#9CA3AF", transform: showBankPicker ? "rotate(180deg)" : "none" }}
              />
            </div>
          </button>
          {showBankPicker && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {livePrograms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProgramId(p.id); setShowBankPicker(false); }}
                  className="w-full flex items-center justify-between px-5 py-3 text-left"
                  style={{ background: p.id === programId ? "#F0F4FF" : "white" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.dot }} />
                    <div>
                      <div className="text-xs font-bold text-gray-800">{p.bank}</div>
                      <div className="text-[10px] text-gray-400">{p.program}</div>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold" style={{ color: p.id === programId ? "#0D1B8C" : "#374151" }}>
                    {p.rateAA.toFixed(2)}% a.a.
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="px-5 py-2.5 border-t border-gray-50">
            <p className="text-[11px] italic" style={{ color: "#94A3B8" }}>{program.notes}</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Parâmetros</p>

          {/* Valor do imóvel */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Valor do imóvel</label>
            <input
              type="text" inputMode="numeric"
              value={valorImovelStr}
              onChange={(e) => setValorImovelStr(maskBRL(e.target.value))}
              placeholder="R$ 0"
              className="w-full px-4 h-12 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-[#0D1B8C]"
              style={{ color: "#07113A" }}
            />
          </div>

          {/* Entrada */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Entrada
              {valorImovel > 0 && (
                <span className="text-gray-400 ml-1">(mín. {(program.minDownPct * 100).toFixed(0)}% = {fmtBRL(minEntrada)})</span>
              )}
            </label>
            <input
              type="text" inputMode="numeric"
              value={entradaStr}
              onChange={(e) => setEntradaStr(maskBRL(e.target.value))}
              placeholder="R$ 0"
              className="w-full px-4 h-12 rounded-xl border text-sm font-semibold outline-none"
              style={{
                color: "#07113A",
                borderColor: entradaInsuficiente ? "#F59E0B" : "#E2E8F0",
                background: entradaInsuficiente ? "#FFFBEB" : "white",
              }}
            />
            {entradaInsuficiente && (
              <p className="text-xs text-amber-700 mt-1">Entrada abaixo do mínimo exigido pelo programa.</p>
            )}
          </div>

          {/* Prazo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-700">Prazo</label>
              <span className="text-sm font-extrabold" style={{ color: "#0D1B8C" }}>{prazoAnos} anos</span>
            </div>
            <input
              type="range" min={5} max={program.maxYears} step={1}
              value={Math.min(prazoAnos, program.maxYears)}
              onChange={(e) => setPrazoAnos(parseInt(e.target.value, 10))}
              className="w-full accent-[#0D1B8C]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>5 anos</span>
              <span>{program.maxYears} anos (máx)</span>
            </div>
          </div>

          {/* Sistema */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Sistema de amortização</label>
            <div className="grid grid-cols-2 gap-2">
              {(["SAC", "PRICE"] as Sistema[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSistema(s)}
                  className="h-11 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: sistema === s ? "#0D1B8C" : "#F8FAFC",
                    color: sistema === s ? "white" : "#374151",
                    border: sistema === s ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  {s === "SAC" ? "SAC" : "Price"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              <strong>SAC</strong>: parcela decrescente. <strong>Price</strong>: parcela fixa.
            </p>
          </div>

          {/* Renda */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Renda mensal bruta</label>
            <input
              type="text" inputMode="numeric"
              value={rendaStr}
              onChange={(e) => setRendaStr(maskBRL(e.target.value))}
              placeholder="R$ 0"
              className="w-full px-4 h-12 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-[#0D1B8C]"
              style={{ color: "#07113A" }}
            />
            <p className="text-[11px] text-gray-400 mt-1">Bancos limitam parcela a 30% da renda.</p>
          </div>
        </div>

        {/* ── Results ── */}
        {!valid ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Calculator className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
            <p className="text-sm text-gray-400">Preencha os campos acima para simular.</p>
          </div>
        ) : result && (
          <>
            {/* Resultado Header */}
            <div className="rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #07113A 0%, #0D1B8C 100%)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#93C5FD" }}>
                  Resultado da simulação
                </p>
                <p className="text-white font-bold">{program.bank} — {program.program}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {sistema} · {prazoAnos} anos · {taxaEfetiva.toFixed(2)}% a.a.
                </p>
              </div>
            </div>

            {/* Main cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={sistema === "SAC" ? "1ª Parcela" : "Parcela mensal"}
                value={fmtBRL(result.parcelaInicial)}
                accent="#0D1B8C"
              />
              {sistema === "SAC" ? (
                <StatCard label="Última parcela" value={fmtBRL(result.parcelaFinal)} accent="#10A65A" />
              ) : (
                <StatCard label="Total a pagar" value={fmtBRL(result.totalPago + entrada)} />
              )}
              <StatCard label="Valor financiado" value={fmtBRL(valorFinanciado)} />
              <StatCard label="Total de juros" value={fmtBRL(result.totalJuros)} accent="#EF4444" />
            </div>

            {/* DTI */}
            {renda > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold" style={{ color: "#07113A" }}>Comprometimento da renda</span>
                  <span
                    className="text-xl font-extrabold"
                    style={{ color: result.comprometimento <= 30 ? "#10A65A" : "#EF4444" }}
                  >
                    {result.comprometimento.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, result.comprometimento)}%`,
                      background: result.comprometimento <= 30
                        ? "linear-gradient(90deg,#10A65A,#84CC16)"
                        : "linear-gradient(90deg,#F59E0B,#EF4444)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span className="font-semibold text-gray-600">limite 30%</span>
                  <span>100%</span>
                </div>
                {result.alerta ? (
                  <div className="mt-3 p-3 rounded-xl flex gap-2 items-start" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#92400E" }} />
                    <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>{result.alerta}</p>
                  </div>
                ) : (
                  <div className="mt-3 p-3 rounded-xl flex gap-2 items-start" style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}>
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#065F46" }} />
                    <p className="text-xs" style={{ color: "#065F46" }}>Parcela dentro do limite de 30% da sua renda.</p>
                  </div>
                )}
              </div>
            )}

            {/* LTV warning */}
            {ltvExcedido && (
              <div className="rounded-2xl p-4 flex gap-3 items-start" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#92400E" }} />
                <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                  LTV de {(ltv * 100).toFixed(1)}% excede o máximo de {(program.maxLTV * 100).toFixed(0)}% para {program.bank}. Aumente a entrada.
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-gray-400 text-center pb-2">
              Simulação estimativa. Taxas e condições sujeitas à análise de crédito dos bancos.
            </p>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
