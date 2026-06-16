import { useGetBrokerRanking, useGetLeadRanking } from "@workspace/api-client-react";
import { Trophy, Medal, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function RankBadge({ rank }: { rank: number }) {
  const getRankGradient = (r: number) => {
    if (r === 1) return "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)";
    if (r === 2) return "linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)";
    if (r === 3) return "linear-gradient(135deg, #FDBA74 0%, #C2410C 100%)";
    return "linear-gradient(135deg, #94A3B8 0%, #475569 100%)";
  };

  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-sm"
      style={{ background: getRankGradient(rank) }}
    >
      {rank}
    </div>
  );
}

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7", border: "#F59E0B" },
  analyzing: { label: "Em Análise", color: "#1E40AF", bg: "#DBEAFE", border: "#3B82F6" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5", border: "#10B981" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2", border: "#EF4444" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE", border: "#8B5CF6" },
};

export function Ranking() {
  const { data: brokerRanking, isLoading: brokersLoading } = useGetBrokerRanking();
  const { data: leadRanking, isLoading: leadsLoading } = useGetLeadRanking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">Ranking</h1>
        <p className="text-xs font-semibold text-gray-400 mt-1">Performance de corretores e leads com maior chance de aprovação</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Broker ranking */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <Trophy className="w-4 h-4 text-[#0D1B8C]" />
            <div className="text-sm font-bold text-gray-700">Ranking de Corretores</div>
          </div>
          <div className="divide-y divide-gray-50">
            {brokersLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-6 py-4">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : (brokerRanking ?? []).map((broker) => (
                  <div
                    key={broker.brokerId}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50/10 transition-colors"
                    data-testid={`row-broker-rank-${broker.rank}`}
                  >
                    <RankBadge rank={broker.rank} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-700 truncate">{broker.brokerName}</div>
                      <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {broker.totalLeads} leads &bull; {broker.approvedLeads} aprovados
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-extrabold text-green-600 bg-green-50/50 px-2 py-0.5 rounded-lg border border-green-100/50">
                        {broker.approvalRate.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold mt-1">{formatBRL(broker.volume)}</div>
                    </div>
                  </div>
                ))}
          </div>
          {!brokersLoading && (brokerRanking ?? []).length === 0 && (
            <div className="py-16 text-center">
              <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-gray-700">Sem dados de ranking ainda</div>
            </div>
          )}
        </div>

        {/* Lead ranking */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <div className="text-sm font-bold text-gray-700">Top Leads por Aprovação</div>
          </div>
          <div className="divide-y divide-gray-50">
            {leadsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-6 py-4">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : (leadRanking ?? []).map((lead) => {
                  const statusCfg = STATUS_CONFIG[lead.status] ?? { label: lead.status, color: "#374151", bg: "#F3F4F6", border: "#E5E7EB" };
                  const approvalGradient = lead.approvalChance >= 70
                    ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                    : lead.approvalChance >= 40
                    ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                    : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)";
                  return (
                    <div
                      key={lead.leadId}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50/10 transition-colors"
                      data-testid={`row-lead-rank-${lead.rank}`}
                    >
                      <RankBadge rank={lead.rank} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-700 truncate">{lead.leadName}</div>
                        <div className="text-[10px] text-gray-400 font-semibold mt-0.5">Score Caixa: {lead.scoreCaixa}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
                          style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: `${statusCfg.border}25` }}
                        >
                          {statusCfg.label}
                        </span>
                        <div
                          className="text-xs font-black px-2 py-1 rounded-lg text-white shadow-sm"
                          style={{ background: approvalGradient }}
                        >
                          {lead.approvalChance}%
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
          {!leadsLoading && (leadRanking ?? []).length === 0 && (
            <div className="py-16 text-center">
              <Medal className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-gray-700">Sem leads para rankear ainda</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
