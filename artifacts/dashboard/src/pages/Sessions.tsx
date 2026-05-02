import { useGetSessions, getGetSessionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Link2, ArrowLeftRight, Zap } from "lucide-react";

const MODEL_COLORS: Record<string, string> = {
  "mock-gpt-4":          "text-emerald-400",
  "mock-gpt-3.5":        "text-sky-400",
  "mock-claude-3-opus":  "text-orange-400",
  "mock-claude-3-haiku": "text-amber-400",
  "mock-gemini-pro":     "text-purple-400",
};

function AffinityBar({ rate }: { rate: number }) {
  const pct = rate * 100;
  const color = pct >= 70 ? "#34d399" : pct >= 30 ? "#facc15" : "#f87171";
  const label = pct >= 70 ? "High" : pct >= 30 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums w-8 text-right" style={{ color }}>{pct.toFixed(0)}%</span>
      <span className="text-[9px] text-muted-foreground w-10">{label}</span>
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

  const totalRequests = sessions.reduce((s, x) => s + x.request_count, 0);
  const totalSwitches = sessions.reduce((s, x) => s + x.model_switches, 0);
  const totalHits = sessions.reduce((s, x) => s + x.affinity_hits, 0);
  const overallRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Session Manager</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{total} sessions tracked — sticky routing analytics</p>
      </div>

      {/* Aggregate stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-card-border rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall Affinity Rate</div>
              <div className="text-xl font-bold font-mono text-blue-400">{(overallRate * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-muted-foreground">{totalHits} hits / {totalRequests} requests</div>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-yellow-500/10 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Model Switches</div>
              <div className="text-xl font-bold font-mono text-yellow-400">{totalSwitches}</div>
              <div className="text-[10px] text-muted-foreground">across all sessions</div>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Requests</div>
              <div className="text-xl font-bold font-mono text-foreground">{totalRequests}</div>
              <div className="text-[10px] text-muted-foreground">across {total} sessions</div>
            </div>
          </div>
        </div>
      )}

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
                    <div className="text-muted-foreground text-center text-xs">
                      No sessions yet. Run the Demo to see sticky routing in action.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sessions.map(s => {
                const affinityRate = s.request_count > 0 ? s.affinity_hits / s.request_count : 0;
                const modelColor = MODEL_COLORS[s.model] ?? "text-foreground";
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-primary">{s.id.substring(0, 14)}…</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground max-w-[90px] truncate">{s.tenant_id}</td>
                    <td className="px-3 py-2.5 font-mono">
                      <span className={`font-medium ${modelColor}`}>{s.model.replace("mock-", "")}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">{s.request_count}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">{s.total_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">${s.total_cost.toFixed(6)}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-center">
                      <span className={s.model_switches > 0 ? "text-yellow-400 font-bold" : "text-muted-foreground"}>
                        {s.model_switches}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <AffinityBar rate={affinityRate} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                      {s.last_active.substring(0, 19).replace("T", " ")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Routing formula explainer */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-blue-400" />
          Session-Aware Routing — How It Works
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-muted/30 rounded p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Effective Cost Formula</div>
            <div className="font-mono text-foreground text-[10px] space-y-0.5">
              <div>model_cost</div>
              <div className="text-muted-foreground">+ cache_miss_penalty</div>
              <div className="text-muted-foreground">+ latency_penalty</div>
            </div>
          </div>
          <div className="bg-muted/30 rounded p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Sticky Routing Rule</div>
            <div className="font-mono text-foreground text-[10px]">
              Stay on affinity model if its cost is within <span className="text-blue-400 font-bold">1.5×</span> of requested model
            </div>
          </div>
          <div className="bg-muted/30 rounded p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Cache Miss Penalty</div>
            <div className="font-mono text-yellow-400 text-[10px]">$0.002 per model switch</div>
            <div className="text-[9px] text-muted-foreground mt-1">Applied when switching away from affinity model</div>
          </div>
        </div>
      </div>
    </div>
  );
}
