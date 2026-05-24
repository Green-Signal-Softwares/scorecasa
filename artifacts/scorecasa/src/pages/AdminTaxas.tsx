import { useMemo, useState } from "react";
import {
  useGetRatesCurrent,
  getGetRatesCurrentQueryKey,
  useGetRatesHistory,
  useGetRatesRuns,
  useRefreshRates,
  useUpdateRate,
  useAcknowledgeRate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Clock, Activity } from "lucide-react";

const BANK_COLORS: Record<string, string> = {
  caixa: "#005CA9",
  bb: "#F5A623",
  itau: "#EC7000",
  bradesco: "#CC0000",
  santander: "#EC0000",
  inter: "#FF7A00",
  c6: "#222222",
};

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminTaxas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [days, setDays] = useState<number>(90);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  const { data: rates = [], isLoading } = useGetRatesCurrent({
    query: { queryKey: getGetRatesCurrentQueryKey(), staleTime: 30_000 },
  });
  const { data: history = [] } = useGetRatesHistory({ days } as any, {
    query: { queryKey: ["rates-history", days], staleTime: 60_000 },
  });
  const { data: runs = [] } = useGetRatesRuns({
    query: { queryKey: ["rates-runs"], staleTime: 30_000 },
  });

  const refresh = useRefreshRates();
  const updateRate = useUpdateRate();
  const acknowledge = useAcknowledgeRate();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetRatesCurrentQueryKey() });
    qc.invalidateQueries({ queryKey: ["rates-history", days] });
    qc.invalidateQueries({ queryKey: ["rates-runs"] });
  };

  const banks = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rates as any[]) set.set(r.bankSlug, r.bankName);
    return [...set.entries()].map(([slug, name]) => ({ slug, name }));
  }, [rates]);

  const products = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rates as any[]) set.set(r.product, r.productLabel);
    return [...set.entries()].map(([slug, label]) => ({ slug, label }));
  }, [rates]);

  const filteredRates = useMemo(
    () =>
      (rates as any[]).filter(
        (r) =>
          (bankFilter === "all" || r.bankSlug === bankFilter) &&
          (productFilter === "all" || r.product === productFilter),
      ),
    [rates, bankFilter, productFilter],
  );

  // Pivota o histórico: uma linha por dia, colunas por bankSlug-product.
  const chartData = useMemo(() => {
    const seriesKeys = filteredRates.map((r: any) => `${r.bankSlug}|${r.product}`);
    const byDay = new Map<string, Record<string, number | string>>();
    for (const h of history as any[]) {
      const key = `${h.bankSlug}|${h.product}`;
      if (!seriesKeys.includes(key)) continue;
      const row =
        byDay.get(h.observedOn) ??
        ({ observedOn: h.observedOn } as Record<string, string | number>);
      row[key] = Number(h.rateAA);
      byDay.set(h.observedOn, row);
    }
    return [...byDay.values()].sort((a, b) =>
      (a.observedOn as string).localeCompare(b.observedOn as string),
    );
  }, [history, filteredRates]);

  const alerts = useMemo(() => {
    const a: Array<{ kind: string; rate: any }> = [];
    for (const r of rates as any[]) {
      if (r.hasDivergence) a.push({ kind: "divergence", rate: r });
      if (r.needsReview) a.push({ kind: "stale", rate: r });
    }
    return a;
  }, [rates]);

  const lastRun = (runs as any[])[0];

  const handleRefresh = async () => {
    try {
      const r = await refresh.mutateAsync();
      toast({
        title: "Sincronização BCB concluída",
        description: `${r.rowsProcessed ?? 0} taxas verificadas · ${r.rowsChanged ?? 0} atualizadas.`,
      });
      invalidateAll();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Falha ao sincronizar",
        description: err?.message ?? "Erro inesperado",
      });
    }
  };

  const handleSave = async (rate: any) => {
    const raw = editing[rate.id];
    const newRate = Number((raw ?? "").replace(",", "."));
    if (!Number.isFinite(newRate) || newRate <= 0 || newRate > 100) {
      toast({ variant: "destructive", title: "Taxa inválida" });
      return;
    }
    try {
      await updateRate.mutateAsync({ id: rate.id, data: { rateAA: newRate } });
      toast({ title: "Taxa atualizada", description: `${rate.bankName} · ${rate.productLabel}` });
      setEditing((s) => {
        const c = { ...s };
        delete c[rate.id];
        return c;
      });
      invalidateAll();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err?.message });
    }
  };

  const handleAck = async (rate: any) => {
    try {
      await acknowledge.mutateAsync({ id: rate.id });
      toast({ title: "Marcada como revisada" });
      invalidateAll();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err?.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>
            Taxas e Mudanças
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Taxas da Caixa são atualizadas automaticamente todo dia à meia-noite pelo Banco Central.
            Para os demais bancos, cadastre manualmente — a rotina compara com o BCB e aponta divergências.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground text-right">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastRun
                ? `Última execução: ${fmtDate(lastRun.startedAt)}`
                : "Nenhuma execução ainda"}
            </div>
            {lastRun && (
              <div>
                {lastRun.success ? (
                  <span className="text-green-700">✓ {lastRun.rowsChanged} atualizada(s)</span>
                ) : (
                  <span className="text-red-700">✗ Falhou</span>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refresh.isPending}
            style={{ background: "#0D1B8C", color: "white" }}
            data-testid="btn-refresh-rates"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending ? "Atualizando…" : "Atualizar agora"}
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card className="p-4 border-l-4" style={{ borderColor: "#DC2626", background: "#FEF2F2" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-red-800">
                {alerts.length} alerta(s) pendente(s)
              </h3>
              <ul className="text-xs text-red-700 mt-1 space-y-1">
                {alerts.slice(0, 5).map((a, i) => (
                  <li key={i}>
                    {a.kind === "divergence" ? (
                      <>
                        Divergência: <b>{a.rate.bankName}</b> {a.rate.productLabel} cadastrada {fmtPct(a.rate.rateAA)} vs BCB {fmtPct(a.rate.bcbReferenceRate)}
                      </>
                    ) : (
                      <>
                        Sem revisão há mais de 7 dias: <b>{a.rate.bankName}</b> {a.rate.productLabel} ({a.rate.staleDays} dias)
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          data-testid="filter-bank"
        >
          <option value="all">Todos os bancos</option>
          {banks.map((b) => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          data-testid="filter-product"
        >
          <option value="all">Todos os produtos</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label}</option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm ml-auto"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          data-testid="filter-days"
        >
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={180}>Últimos 180 dias</option>
          <option value={365}>Último ano</option>
        </select>
      </div>

      {/* Tabela */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#F8FAFC" }}>
                <tr className="text-left">
                  <th className="p-3">Banco</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Taxa atual</th>
                  <th className="p-3">Anterior</th>
                  <th className="p-3">Ref BCB</th>
                  <th className="p-3">Fonte</th>
                  <th className="p-3">Atualizada em</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((r: any) => {
                  const isEditing = editing[r.id] !== undefined;
                  const manual = r.source === "manual";
                  return (
                    <tr key={r.id} className="border-t" data-testid={`rate-row-${r.id}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: BANK_COLORS[r.bankSlug] ?? "#666" }}
                          />
                          <span className="font-medium">{r.bankName}</span>
                        </div>
                      </td>
                      <td className="p-3">{r.productLabel}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <Input
                            value={editing[r.id]}
                            onChange={(e) =>
                              setEditing((s) => ({ ...s, [r.id]: e.target.value }))
                            }
                            className="w-24 h-8"
                            data-testid={`rate-input-${r.id}`}
                          />
                        ) : (
                          <span className="font-semibold">{fmtPct(r.rateAA)}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{fmtPct(r.previousRateAA)}</td>
                      <td className="p-3 text-muted-foreground">{fmtPct(r.bcbReferenceRate)}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={r.source === "bcb" ? "text-blue-700 border-blue-300" : ""}
                        >
                          {r.source === "bcb" ? "BCB automático" : "Manual"}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        <div>{fmtDate(r.updatedAt)}</div>
                        {r.hasDivergence && (
                          <Badge style={{ background: "#DC2626", color: "white" }} className="text-[10px] mt-1">
                            Divergência {(r.divergence ?? 0).toFixed(2)} p.p.
                          </Badge>
                        )}
                        {r.needsReview && (
                          <Badge style={{ background: "#D97706", color: "white" }} className="text-[10px] mt-1 ml-1">
                            Sem revisão há {r.staleDays}d
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {manual && !isEditing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditing((s) => ({
                                  ...s,
                                  [r.id]: String(r.rateAA).replace(".", ","),
                                }))
                              }
                              data-testid={`edit-${r.id}`}
                            >
                              Editar
                            </Button>
                          )}
                          {manual && isEditing && (
                            <>
                              <Button
                                size="sm"
                                style={{ background: "#10A65A", color: "white" }}
                                onClick={() => handleSave(r)}
                                disabled={updateRate.isPending}
                                data-testid={`save-${r.id}`}
                              >
                                <Save className="w-3 h-3 mr-1" /> Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setEditing((s) => {
                                    const c = { ...s };
                                    delete c[r.id];
                                    return c;
                                  })
                                }
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {(r.hasDivergence || r.needsReview) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAck(r)}
                              disabled={acknowledge.isPending}
                              data-testid={`ack-${r.id}`}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Revisada
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRates.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma taxa para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Gráfico histórico */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4" style={{ color: "#0D1B8C" }} />
          <h2 className="font-semibold" style={{ color: "#07113A" }}>
            Histórico ({days} dias)
          </h2>
        </div>
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Sem dados suficientes para o gráfico ainda. O histórico vai sendo construído a cada execução diária.
          </div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData as any[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="observedOn" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {filteredRates.map((r: any) => (
                  <Line
                    key={`${r.bankSlug}|${r.product}`}
                    type="monotone"
                    dataKey={`${r.bankSlug}|${r.product}`}
                    name={`${r.bankName} · ${r.productLabel}`}
                    stroke={BANK_COLORS[r.bankSlug] ?? "#666"}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Execuções */}
      <Card className="p-5">
        <h2 className="font-semibold mb-3" style={{ color: "#07113A" }}>
          Últimas execuções da rotina
        </h2>
        <div className="space-y-1 text-xs">
          {(runs as any[]).slice(0, 10).map((run: any) => (
            <div key={run.id} className="flex items-center gap-3 py-1 border-b last:border-0">
              <span className="w-32">{fmtDate(run.startedAt)}</span>
              <Badge variant="outline" className="text-[10px]">{run.trigger}</Badge>
              {run.success ? (
                <span className="text-green-700">
                  ✓ {run.rowsProcessed} verificadas · {run.rowsChanged} alteradas
                </span>
              ) : (
                <span className="text-red-700">✗ {run.error ?? "falhou"}</span>
              )}
            </div>
          ))}
          {(runs as any[]).length === 0 && (
            <div className="text-muted-foreground">Nenhuma execução registrada ainda.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
