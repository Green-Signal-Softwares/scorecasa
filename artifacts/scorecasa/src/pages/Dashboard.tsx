import { useGetDashboard, useGetApprovalFunnel, useGetLeadRanking, useGetBrokerRanking } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, CheckCircle, Clock, Target, ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${color}12`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="text-3xl font-extrabold text-gray-800 tracking-tight">{value}</div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50/60">
        <span className="text-[10px] font-bold text-gray-400 truncate max-w-[70%]">
          {subtitle || "Atualizado em tempo real"}
        </span>
        {trend && (
          <div
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              trend.positive
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-red-50 text-red-500 border border-red-100"
            }`}
          >
            {trend.positive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
            {trend.value}%
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalGauge({ value }: { value: number }) {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ * 0.75;
  const gap = circ - dash;
  const color = value >= 70 ? "#10A65A" : value >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto">
      <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          className="transform origin-center rotate-90"
        />
        {/* Active Value Arc */}
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${gap + circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          className="transform origin-center rotate-90"
          style={{
            transition: "stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: `drop-shadow(0 0 4px ${color}30)`
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-gray-800 tracking-tight">{value}%</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Aprovação</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboard();
  const { data: funnel } = useGetApprovalFunnel();
  const { data: leadRanking } = useGetLeadRanking();
  const { data: brokerRanking } = useGetBrokerRanking();

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Visão Geral</h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">Acompanhamento e inteligência de crédito imobiliário</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-100 shadow-sm text-xs font-bold text-gray-600 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Dados atualizados hoje
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Leads"
          value={stats?.totalLeads ?? 0}
          icon={Users}
          color="#0D1B8C"
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Aprovados"
          value={stats?.approvedLeads ?? 0}
          subtitle={`${stats?.conversionRate?.toFixed(1) ?? 0}% de conversão`}
          icon={CheckCircle}
          color="#10A65A"
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Em Análise"
          value={stats?.pendingLeads ?? 0}
          subtitle="Aguardando retorno"
          icon={Clock}
          color="#F59E0B"
        />
        <StatCard
          title="Score Médio"
          value={stats?.averageScore ? Math.round(stats.averageScore) : 0}
          subtitle="Score Caixa médio"
          icon={Target}
          color="#6366F1"
          trend={{ value: 5, positive: true }}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aprovações Mensais</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Leads recebidos vs aprovados nos últimos meses</div>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0D1B8C]/20 border border-[#0D1B8C]" />
                <span className="text-gray-500">Leads</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10A65A]/20 border border-[#10A65A]" />
                <span className="text-gray-500">Aprovados</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={stats?.monthlyApprovals ?? []} margin={{ left: -20, right: 10, bottom: 0, top: 10 }}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D1B8C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0D1B8C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10A65A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10A65A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 600, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #F1F5F9",
                  borderRadius: 12,
                  fontSize: 11,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  fontWeight: 600
                }}
              />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#0D1B8C" strokeWidth={2.5} fill="url(#colorLeads)" />
              <Area type="monotone" dataKey="approvals" name="Aprovados" stroke="#10A65A" strokeWidth={2.5} fill="url(#colorApprovals)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gauge */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-between min-h-[300px]">
          <div className="w-full text-center">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chance Média de Aprovação</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Desempenho geral dos proponentes</div>
          </div>
          
          <div className="my-auto">
            <ApprovalGauge value={Math.round(stats?.averageApprovalChance ?? 0)} />
          </div>

          <div className="w-full mt-4 pt-4 border-t border-gray-50 flex items-center justify-between px-2">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">Score Médio</div>
              <div className="text-sm font-extrabold text-gray-700 mt-0.5">{stats?.averageScore ? Math.round(stats.averageScore) : 0} pts</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase font-bold">Status Geral</div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 mt-0.5">
                Saudável
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Funnel + Rankings */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Funil de Aprovação</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Etapas ativas de conversão</div>
              </div>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                Fluxo
              </span>
            </div>
            
            <div className="space-y-4">
              {funnel?.stages.map((stage, i) => (
                <div key={stage.name} className="group">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition-colors">{stage.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-gray-800">{stage.count} leads</span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {stage.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{
                        width: `${stage.percentage}%`,
                        background: i === 3 ? "linear-gradient(90deg, #10B981 0%, #059669 100%)" : `linear-gradient(90deg, hsl(${233 - i * 15} 70% ${50 + i * 5}%) 0%, hsl(${233 - i * 15} 83% ${35 + i * 8}%) 100%)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Leads */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Leads por Aprovação</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Leads com maior chance de fechamento</div>
              </div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                Score Caixa
              </span>
            </div>
            
            <div className="space-y-3.5">
              {(leadRanking ?? []).slice(0, 5).map((lead) => {
                const getRankGradient = (r: number) => {
                  if (r === 1) return "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)";
                  if (r === 2) return "linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)";
                  if (r === 3) return "linear-gradient(135deg, #FDBA74 0%, #C2410C 100%)";
                  return "linear-gradient(135deg, #94A3B8 0%, #475569 100%)";
                };
                return (
                  <div key={lead.leadId} className="flex items-center gap-3 py-2 border-b border-gray-50/60 last:border-0 last:pb-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-sm"
                      style={{ background: getRankGradient(lead.rank) }}
                    >
                      {lead.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-700 truncate">{lead.leadName}</div>
                      <div className="text-[10px] text-gray-400 font-medium">Score: <span className="font-bold text-gray-600">{lead.scoreCaixa}</span></div>
                    </div>
                    <div
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white shadow-sm flex items-center gap-0.5"
                      style={{
                        background: lead.approvalChance >= 70 ? "linear-gradient(135deg, #10B981 0%, #059669 100%)" : lead.approvalChance >= 40 ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
                      }}
                    >
                      {lead.approvalChance}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Brokers */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ranking de Corretores</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Líderes em conversão de crédito</div>
              </div>
              <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                Produtividade
              </span>
            </div>
            
            <div className="space-y-3.5">
              {(brokerRanking ?? []).slice(0, 5).map((broker) => {
                const getRankGradient = (r: number) => {
                  if (r === 1) return "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)";
                  if (r === 2) return "linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 100%)";
                  if (r === 3) return "linear-gradient(135deg, #FDBA74 0%, #C2410C 100%)";
                  return "linear-gradient(135deg, #94A3B8 0%, #475569 100%)";
                };
                return (
                  <div key={broker.brokerId} className="flex items-center gap-3 py-2 border-b border-gray-50/60 last:border-0 last:pb-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-sm"
                      style={{ background: getRankGradient(broker.rank) }}
                    >
                      {broker.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-700 truncate">{broker.brokerName}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{broker.approvedLeads} aprovados</div>
                    </div>
                    <div className="text-[10px] font-extrabold text-green-600 bg-green-50/50 px-2 py-0.5 rounded-lg border border-green-100/50">
                      {broker.approvalRate.toFixed(0)}% conv.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
