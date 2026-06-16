import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListProcesses,
  useChangeProcessStage,
  getListProcessesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const changeStage = useChangeProcessStage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>(STAGES.map((s) => [s.id, [] as any[]]));
    (processes ?? []).forEach((p: any) => {
      const list = map.get(p.stage);
      if (list) list.push(p);
    });
    return map;
  }, [processes]);

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData("text/plain", String(leadId));
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStage !== stageId) {
      setDragOverStage(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadIdStr = e.dataTransfer.getData("text/plain");
    if (!leadIdStr) return;
    const leadId = Number(leadIdStr);

    changeStage.mutate(
      { leadId, data: { stage: targetStage as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProcessesQueryKey() });
          toast({
            title: "Etapa atualizada",
            description: `Processo movido para ${STAGES.find((s) => s.id === targetStage)?.label ?? targetStage}.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: "Erro ao mover processo",
            description: err.message || "Ocorreu um erro ao atualizar a etapa.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Processos</h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            Acompanhe o pipeline de aprovação de crédito imobiliário em tempo real. Arrasta os processos para atualizar a etapa.
          </p>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4" data-testid="processes-kanban">
        {STAGES.map((stage) => {
          const items = grouped.get(stage.id) ?? [];
          const isOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              className={`flex flex-col min-h-[400px] p-2 rounded-2xl border transition-all duration-300 ${
                isOver ? "bg-gray-100/60 border-dashed border-[#0D1B8C]/30 shadow-inner" : "border-transparent"
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border transition-colors shadow-sm"
                style={{ background: `${stage.bg}70`, borderColor: `${stage.color}15` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: stage.color }} />
                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                </div>
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm bg-white"
                  style={{ color: stage.color, borderColor: `${stage.color}15` }}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2.5 flex-1">
                {isLoading && (
                  <div className="p-3 animate-pulse h-24 bg-gray-50 border border-gray-100 rounded-2xl" />
                )}

                {!isLoading && items.length === 0 && (
                  <div className="text-[10px] font-bold text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/30">
                    Nenhum processo
                  </div>
                )}

                {items.map((p: any) => (
                  <Link key={p.leadId} href={`/processos/${p.leadId}`}>
                    <div
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, p.leadId)}
                      className="p-4 bg-white cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 rounded-2xl flex flex-col justify-between"
                      data-testid={`process-card-${p.leadId}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-gray-700 text-xs line-clamp-1">
                            {p.leadName}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        </div>

                        <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span className="line-clamp-1">
                            {p.propertyCity ? `${p.propertyCity}/${p.propertyState ?? ""}` : "Imóvel"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="mt-3 text-sm font-black text-gray-800">
                          {fmtCurrency(Number(p.propertyValue) || 0)}
                        </div>

                        <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] font-bold gap-1 px-1.5 py-0 border-gray-100 bg-gray-50/50 text-gray-500 rounded-lg">
                            <FileText className="w-2.5 h-2.5" />
                            {p.documentsCount} doc{p.documentsCount === 1 ? "" : "s"}
                          </Badge>
                          {p.documentsApproved > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold gap-1 px-1.5 py-0 rounded-lg"
                              style={{ background: "#F0FDF4", color: "#10A65A", borderColor: "#10A65A" }}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {p.documentsApproved}
                            </Badge>
                          )}
                          {p.documentsPending > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold gap-1 px-1.5 py-0 rounded-lg"
                              style={{ background: "#FFFBEB", color: "#D97706", borderColor: "#D97706" }}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {p.documentsPending}
                            </Badge>
                          )}
                        </div>

                        {(p.brokerName || p.correspondentName) && (
                          <div className="mt-3 pt-2.5 border-t border-gray-50 text-[9px] font-semibold text-gray-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="line-clamp-1">
                              {p.correspondentName ?? p.brokerName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
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

