import { useMemo } from "react";
import { Link } from "wouter";
import { useListProcesses } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, User, ArrowRight, CheckCircle2, Clock } from "lucide-react";

const STAGES = [
  { id: "aprovacao",     label: "Aprovação",     color: "#0D1B8C", bg: "#EEF2FF" },
  { id: "engenharia",    label: "Engenharia",    color: "#D97706", bg: "#FFFBEB" },
  { id: "conformidade",  label: "Conformidade",  color: "#0891B2", bg: "#ECFEFF" },
  { id: "assinatura",    label: "Contrato",      color: "#10A65A", bg: "#F0FDF4" },
  { id: "concluido",     label: "Concluído",     color: "#047857", bg: "#ECFDF5" },
] as const;

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function Processos() {
  const { data: processes, isLoading } = useListProcesses();

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>(STAGES.map((s) => [s.id, [] as any[]]));
    (processes ?? []).forEach((p: any) => {
      const list = map.get(p.stage);
      if (list) list.push(p);
    });
    return map;
  }, [processes]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#07113A" }}>Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o pipeline de aprovação de crédito imobiliário em tempo real.
          </p>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4" data-testid="processes-kanban">
        {STAGES.map((stage) => {
          const items = grouped.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="flex flex-col min-h-[300px]">
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
                style={{ background: stage.bg }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-sm font-bold" style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "white", color: stage.color }}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 flex-1">
                {isLoading && (
                  <Card className="p-3 animate-pulse h-24 bg-muted/40" />
                )}

                {!isLoading && items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                    Nenhum processo
                  </div>
                )}

                {items.map((p: any) => (
                  <Link key={p.leadId} href={`/processos/${p.leadId}`}>
                    <Card
                      className="p-3 cursor-pointer hover:shadow-md transition-all duration-150 border-l-4"
                      style={{ borderLeftColor: stage.color }}
                      data-testid={`process-card-${p.leadId}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm line-clamp-1" style={{ color: "#07113A" }}>
                          {p.leadName}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      </div>

                      <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        <span className="line-clamp-1">
                          {p.propertyCity ? `${p.propertyCity}/${p.propertyState ?? ""}` : "Imóvel"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm font-bold" style={{ color: "#10A65A" }}>
                        {fmtCurrency(Number(p.propertyValue) || 0)}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                          <FileText className="w-2.5 h-2.5" />
                          {p.documentsCount} doc{p.documentsCount === 1 ? "" : "s"}
                        </Badge>
                        {p.documentsApproved > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 px-1.5 py-0"
                            style={{ background: "#F0FDF4", color: "#10A65A", borderColor: "#10A65A" }}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {p.documentsApproved}
                          </Badge>
                        )}
                        {p.documentsPending > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 px-1.5 py-0"
                            style={{ background: "#FFFBEB", color: "#D97706", borderColor: "#D97706" }}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {p.documentsPending}
                          </Badge>
                        )}
                      </div>

                      {(p.brokerName || p.correspondentName) && (
                        <div className="mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span className="line-clamp-1">
                            {p.correspondentName ?? p.brokerName}
                          </span>
                        </div>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
