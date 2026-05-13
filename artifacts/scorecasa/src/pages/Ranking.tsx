import { useGetBrokerRanking, useGetLeadRanking } from "@workspace/api-client-react";
import { Trophy, Medal, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function RankBadge({ rank }: { rank: number }) {
  const colors = {
    1: { bg: "#FEF3C7", color: "#92400E", icon: "🥇" },
    2: { bg: "#F3F4F6", color: "#374151", icon: "🥈" },
    3: { bg: "#FEF3C7", color: "#78350F", icon: "🥉" },
  };
  const cfg = colors[rank as 1 | 2 | 3];

  if (cfg) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
        {rank}
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-muted text-muted-foreground">
      {rank}
    </div>
  );
}

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "#92400E", bg: "#FEF3C7" },
  analyzing: { label: "Em Analise", color: "#1E40AF", bg: "#DBEAFE" },
  approved: { label: "Aprovado", color: "#065F46", bg: "#D1FAE5" },
  rejected: { label: "Reprovado", color: "#991B1B", bg: "#FEE2E2" },
  in_progress: { label: "Em Andamento", color: "#7C3AED", bg: "#EDE9FE" },
};

export function Ranking() {
  const { data: brokerRanking, isLoading: brokersLoading } = useGetBrokerRanking();
  const { data: leadRanking, isLoading: leadsLoading } = useGetLeadRanking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Ranking</h1>
        <p className="text-sm text-muted-foreground">Performance de corretores e leads com maior chance de aprovacao</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Broker ranking */}
        <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: "#0D1B8C" }} />
            <div className="text-sm font-semibold text-foreground">Ranking de Corretores</div>
          </div>
          <div className="divide-y divide-border">
            {brokersLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : (brokerRanking ?? []).map((broker) => (
                  <div
                    key={broker.brokerId}
                    className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                    data-testid={`row-broker-rank-${broker.rank}`}
                  >
                    <RankBadge rank={broker.rank} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{broker.brokerName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {broker.totalLeads} leads &bull; {broker.approvedLeads} aprovados
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color: "#10A65A" }}>{broker.approvalRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">{formatBRL(broker.volume)}</div>
                    </div>
                  </div>
                ))}
          </div>
          {!brokersLoading && (brokerRanking ?? []).length === 0 && (
            <div className="py-12 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">Sem dados de ranking ainda</div>
            </div>
          )}
        </div>

        {/* Lead ranking */}
        <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "#10A65A" }} />
            <div className="text-sm font-semibold text-foreground">Top Leads por Aprovacao</div>
          </div>
          <div className="divide-y divide-border">
            {leadsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : (leadRanking ?? []).map((lead) => {
                  const statusCfg = STATUS_CONFIG[lead.status];
                  const approvalColor = lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 40 ? "#F59E0B" : "#EF4444";
                  return (
                    <div
                      key={lead.leadId}
                      className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                      data-testid={`row-lead-rank-${lead.rank}`}
                    >
                      <RankBadge rank={lead.rank} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{lead.leadName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Score Caixa: {lead.scoreCaixa}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ color: statusCfg?.color, background: statusCfg?.bg }}
                        >
                          {statusCfg?.label}
                        </span>
                        <div
                          className="text-sm font-bold px-2 py-0.5 rounded-lg text-white"
                          style={{ background: approvalColor }}
                        >
                          {lead.approvalChance}%
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
          {!leadsLoading && (leadRanking ?? []).length === 0 && (
            <div className="py-12 text-center">
              <Medal className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">Sem leads para rankear ainda</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
