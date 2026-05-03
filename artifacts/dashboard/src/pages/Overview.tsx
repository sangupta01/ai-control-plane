import { useGetMetricsSummary, getGetMetricsSummaryQueryKey } from "@workspace/api-client-react";
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, DollarSign, Shield, Zap, TrendingUp, Users, CheckCircle, BarChart2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = ["hsl(210,100%,56%)", "hsl(199,89%,48%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(280,80%,60%)"];

function KpiCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground font-mono" data-testid={`kpi-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function Overview() {
  const { data, isLoading } = useGetMetricsSummary({
    query: { refetchInterval: 10000, queryKey: getGetMetricsSummaryQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Requests", value: fmt(data.total_requests ?? 0), icon: Activity, color: "hsl(210,100%,56%)" },
    { label: "Total Tokens", value: fmt(data.total_tokens ?? 0), icon: Zap, color: "hsl(199,89%,48%)" },
    { label: "Total Cost", value: `$${(data.total_cost ?? 0).toFixed(4)}`, icon: DollarSign, color: "hsl(142,71%,45%)" },
    { label: "Avg Latency", value: `${(data.avg_latency_ms ?? 0).toFixed(0)}ms`, icon: TrendingUp, color: "hsl(38,92%,50%)" },
    { label: "Security Events", value: fmt(data.security_events_count ?? 0), icon: Shield, color: "hsl(0,72%,51%)" },
    { label: "Blocked", value: fmt(data.blocked_requests ?? 0), icon: Shield, color: "hsl(0,72%,51%)" },
    { label: "Avg Eval Score", value: (data.avg_eval_score ?? 0).toFixed(3), icon: CheckCircle, color: "hsl(142,71%,45%)" },
    { label: "Session Affinity", value: `${((data.session_affinity_rate ?? 0) * 100).toFixed(1)}%`, icon: Users, color: "hsl(280,80%,60%)" },
  ];

  const modelData = Object.entries(data.requests_per_model || {}).map(([name, value]) => ({
    name: name.replace("mock-", ""),
    value,
  }));

  const tenantData = Object.entries(data.requests_per_tenant || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const hourlyData = (data.requests_last_24h || []).map(p => ({
    ...p,
    hour: p.hour ? p.hour.substring(11, 16) : "",
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Overview</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Live platform metrics — refreshes every 10s</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Time series */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Requests — Last 24h</span>
          </div>
          {hourlyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet — run a request or demo</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,100%,56%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210,100%,56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,30%,18%)" />
                <XAxis dataKey="hour" tick={{ fill: "hsl(215,20%,50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215,20%,50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(222,44%,10%)", border: "1px solid hsl(220,28%,16%)", borderRadius: 6 }}
                  labelStyle={{ color: "hsl(210,40%,92%)" }}
                  itemStyle={{ color: "hsl(210,100%,56%)" }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(210,100%,56%)" fill="url(#reqGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">Cost — Last 24h</span>
          </div>
          {hourlyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,30%,18%)" />
                <XAxis dataKey="hour" tick={{ fill: "hsl(215,20%,50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215,20%,50%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(4)}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222,44%,10%)", border: "1px solid hsl(220,28%,16%)", borderRadius: 6 }}
                  labelStyle={{ color: "hsl(210,40%,92%)" }}
                  itemStyle={{ color: "hsl(199,89%,48%)" }}
                  formatter={(v: number) => [`$${v.toFixed(6)}`, "cost"]}
                />
                <Line type="monotone" dataKey="cost" stroke="hsl(199,89%,48%)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model breakdown */}
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-sm font-semibold text-foreground mb-4">Requests by Model</div>
          {modelData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <div className="flex gap-4 items-center">
              <PieChart width={120} height={120}>
                <Pie data={modelData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                  {modelData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(222,44%,10%)", border: "1px solid hsl(220,28%,16%)", borderRadius: 6 }}
                  itemStyle={{ color: "hsl(210,40%,92%)" }}
                />
              </PieChart>
              <div className="flex-1 space-y-1.5">
                {modelData.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-muted-foreground font-mono">{m.name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground tabular-nums">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tenant breakdown */}
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-sm font-semibold text-foreground mb-4">Requests by Tenant</div>
          {tenantData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          ) : (
            <div className="space-y-2">
              {tenantData.slice(0, 8).map((t, i) => {
                const max = Math.max(...tenantData.map(x => x.value));
                const pct = max > 0 ? (t.value / max) * 100 : 0;
                return (
                  <div key={t.name} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{t.name}</span>
                      <span className="text-xs font-bold text-foreground tabular-nums">{t.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
