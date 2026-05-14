import { useGetDashboard, useGetApprovalFunnel, useGetLeadRanking, useGetBrokerRanking } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, Users, CheckCircle, XCircle, Clock, Target, ArrowUp, ArrowDown } from "lucide-react";
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
    <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? "text-green-600" : "text-red-500"}`}>
            {trend.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm font-medium text-foreground mt-0.5">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
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
    <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
      <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={circ * 0.125}
        strokeLinecap="round"
      />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${gap + circ * 0.25}`}
        strokeDashoffset={circ * 0.125}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="70" y="66" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>{value}%</text>
      <text x="70" y="82" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>Aprovacao media</text>
    </svg>
  );
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  analyzing: "Em Analise",
  approved: "Aprovado",
  rejected: "Reprovado",
  in_progress: "Em Andamento",
};

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
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const formatBRL = (v: number) =>
    v >= 1_000_000
      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `R$ ${(v / 1000).toFixed(0)}K`
      : `R$ ${v.toFixed(0)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Resumo</h1>
        <p className="text-sm text-muted-foreground">Visao geral da plataforma</p>
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
          subtitle={`${stats?.conversionRate?.toFixed(1) ?? 0}% de conversao`}
          icon={CheckCircle}
          color="#10A65A"
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Em Analise"
          value={stats?.pendingLeads ?? 0}
          icon={Clock}
          color="#F59E0B"
        />
        <StatCard
          title="Score Medio"
          value={stats?.averageScore ? Math.round(stats.averageScore) : 0}
          subtitle="Score Caixa medio"
          icon={Target}
          color="#6366F1"
          trend={{ value: 5, positive: true }}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-card-border p-5 shadow-sm">
          <div className="mb-4">
            <div className="text-sm font-semibold text-foreground">Aprovacoes Mensais</div>
            <div className="text-xs text-muted-foreground">Leads recebidos vs aprovados</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats?.monthlyApprovals ?? []}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D1B8C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0D1B8C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10A65A" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10A65A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#0D1B8C" strokeWidth={2} fill="url(#colorLeads)" />
              <Area type="monotone" dataKey="approvals" name="Aprovados" stroke="#10A65A" strokeWidth={2} fill="url(#colorApprovals)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gauge */}
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm flex flex-col items-center justify-center">
          <div className="text-sm font-semibold text-foreground mb-4 text-center">Chance Media de Aprovacao</div>
          <ApprovalGauge value={Math.round(stats?.averageApprovalChance ?? 0)} />
          <div className="mt-4 text-center">
            <div className="text-xs text-muted-foreground">Score Caixa Medio</div>
            <div className="text-xl font-bold text-foreground">{stats?.averageScore ? Math.round(stats.averageScore) : 0}</div>
          </div>
        </div>
      </div>

      {/* Funnel + Rankings */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground mb-4">Funil de Aprovacao</div>
          <div className="space-y-3">
            {funnel?.stages.map((stage, i) => (
              <div key={stage.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">{stage.name}</span>
                  <span className="text-xs font-semibold text-foreground">{stage.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stage.percentage}%`,
                      background: i === 3 ? "#10A65A" : `hsl(${233 - i * 15} 83% ${30 + i * 8}%)`,
                    }}
                  />
                </div>
                <div className="text-right text-xs text-muted-foreground mt-0.5">{stage.percentage}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Leads */}
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground mb-4">Top Leads por Aprovacao</div>
          <div className="space-y-2">
            {(leadRanking ?? []).slice(0, 5).map((lead) => (
              <div key={lead.leadId} className="flex items-center gap-3 py-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: lead.rank === 1 ? "#F59E0B" : lead.rank === 2 ? "#9CA3AF" : lead.rank === 3 ? "#CD7F32" : "#0D1B8C" }}
                >
                  {lead.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{lead.leadName}</div>
                  <div className="text-xs text-muted-foreground">Score: {lead.scoreCaixa}</div>
                </div>
                <div
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: lead.approvalChance >= 70 ? "#10A65A" : lead.approvalChance >= 40 ? "#F59E0B" : "#EF4444" }}
                >
                  {lead.approvalChance}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Brokers */}
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
          <div className="text-sm font-semibold text-foreground mb-4">Ranking de Corretores</div>
          <div className="space-y-2">
            {(brokerRanking ?? []).slice(0, 5).map((broker) => (
              <div key={broker.brokerId} className="flex items-center gap-3 py-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: broker.rank === 1 ? "#F59E0B" : broker.rank === 2 ? "#9CA3AF" : broker.rank === 3 ? "#CD7F32" : "#0D1B8C" }}
                >
                  {broker.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{broker.brokerName}</div>
                  <div className="text-xs text-muted-foreground">{broker.approvedLeads} aprovados</div>
                </div>
                <div className="text-xs font-semibold text-green-600">{broker.approvalRate.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
