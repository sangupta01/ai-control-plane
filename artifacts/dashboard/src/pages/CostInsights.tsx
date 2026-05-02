import { useGetCostInsights, getGetCostInsightsQueryKey } from "@workspace/api-client-react";
import { DollarSign, TrendingDown, ArrowRight, Zap, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function fmtCost(n: number) {
  return `$${n.toFixed(6)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function CostInsights() {
  const { data, isLoading, refetch, isFetching } = useGetCostInsights({
    query: { refetchInterval: 30000, queryKey: getGetCostInsightsQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Cost Optimization Insights</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated at {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border/50 hover:border-border"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Model Switches</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{data.model_switch_count}</div>
          <div className="text-xs text-muted-foreground mt-1">across all sessions</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cache Preserved</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{fmtCost(data.estimated_cache_preserved)}</div>
          <div className="text-xs text-muted-foreground mt-1">via session affinity</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cache Miss Cost</div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">{fmtCost(data.estimated_cache_miss_cost)}</div>
          <div className="text-xs text-muted-foreground mt-1">from model switches</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Optimizations</div>
          <div className="text-2xl font-bold font-mono text-yellow-400 mt-1">{data.suggested_optimizations.length}</div>
          <div className="text-xs text-muted-foreground mt-1">routing suggestions</div>
        </div>
      </div>

      {/* Routing optimizations */}
      {data.suggested_optimizations.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">Suggested Routing Optimizations</span>
          </div>
          <div className="divide-y divide-border/30">
            {data.suggested_optimizations.map((opt, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono text-foreground bg-muted/40 px-2 py-0.5 rounded">
                    {opt.current_model.replace("mock-", "")}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {opt.suggested_model.replace("mock-", "")}
                  </span>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] px-2 shrink-0">
                  -{opt.potential_savings_pct}%
                </Badge>
                <span className="text-xs text-muted-foreground hidden lg:block max-w-xs truncate">{opt.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top sessions */}
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <DollarSign className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-foreground">Top Sessions by Cost</span>
          </div>
          {data.top_sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No session data yet — run some requests</div>
          ) : (
            <div className="divide-y divide-border/30">
              {data.top_sessions.map((s, i) => (
                <div key={s.session_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-foreground truncate">{s.session_id.substring(0, 20)}…</div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.model.replace("mock-", "")} · {s.tenant_id} · {s.request_count} req
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-foreground">{fmtCost(s.total_cost)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtTokens(s.total_tokens)} tok</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top tenants */}
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-foreground">Top Tenants by Cost</span>
          </div>
          {data.top_tenants.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No tenant data yet</div>
          ) : (
            <div className="divide-y divide-border/30">
              {data.top_tenants.map((t, i) => (
                <div key={t.tenant_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-foreground truncate">{t.tenant_id}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.request_count} req · avg {fmtCost(t.avg_cost_per_request)}/req
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-foreground">{fmtCost(t.total_cost)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtTokens(t.total_tokens)} tok</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top prompts */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <DollarSign className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-foreground">Most Expensive Prompts</span>
        </div>
        {data.top_prompts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No prompt data yet</div>
        ) : (
          <div className="divide-y divide-border/30">
            {data.top_prompts.map((p, i) => (
              <div key={p.trace_id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs font-mono text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground font-mono line-clamp-1">{p.prompt_excerpt}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.model.replace("mock-", "")} · {p.tenant_id} · {fmtTokens(p.total_tokens)} tok
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-foreground shrink-0">{fmtCost(p.cost)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
