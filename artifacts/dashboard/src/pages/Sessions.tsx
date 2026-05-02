import { useGetSessions, getGetSessionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

function AffinityBar({ rate, hits, total }: { rate: number; hits: number; total: number }) {
  const pct = rate * 100;
  const color = pct >= 70 ? "hsl(142,71%,45%)" : pct >= 40 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
      <span className="text-[10px] text-muted-foreground">({hits}/{total})</span>
    </div>
  );
}

export default function Sessions() {
  const { data, isLoading } = useGetSessions(
    { limit: 50 },
    { query: { refetchInterval: 15000, queryKey: getGetSessionsQueryKey({ limit: 50 }) } },
  );

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Session Manager</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{total} total sessions — sticky routing analytics</p>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Session ID", "Tenant", "Model", "Requests", "Tokens", "Cost", "Switches", "Affinity Rate", "Last Active"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="w-7 h-7 text-muted-foreground" />
                    <div className="text-muted-foreground text-center">
                      No sessions yet. Send requests with <code className="bg-muted px-1 rounded text-[10px]">session_id</code> to see sticky routing in action.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sessions.map(s => {
                const affinityRate = s.request_count > 0 ? s.affinity_hits / s.request_count : 0;
                return (
                  <tr
                    key={s.id}
                    data-testid={`row-session-${s.id}`}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono text-primary">{s.id.substring(0, 16)}…</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground max-w-[100px] truncate">{s.tenant_id}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground">{s.model.replace("mock-", "")}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">{s.request_count}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">{s.total_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">${s.total_cost.toFixed(6)}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-center">
                      <span className={s.model_switches > 0 ? "text-yellow-400" : "text-muted-foreground"}>
                        {s.model_switches}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <AffinityBar rate={affinityRate} hits={s.affinity_hits} total={s.request_count} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{s.last_active.substring(0, 19).replace("T", " ")}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Routing explainer */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs font-semibold text-foreground mb-2">Session-Aware Routing — How It Works</div>
        <div className="text-xs text-muted-foreground space-y-1 font-mono">
          <div>effective_cost = model_cost + cache_miss_penalty + latency_penalty</div>
          <div className="text-muted-foreground/60">cache_miss_penalty = $0.002 per request (when switching models)</div>
          <div className="text-muted-foreground/60">latency_penalty = $0.0000005 per ms of model avg latency</div>
          <div className="mt-2 text-foreground/70">
            Sticky routing is applied when the affinity model cost is within 1.5x of the requested model cost.
            Model switches are logged and tracked per session.
          </div>
        </div>
      </div>
    </div>
  );
}
