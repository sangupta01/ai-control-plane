import { useGetEvals, getGetEvalsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

function ScoreGauge({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const display = invert ? 1 - value : value;
  const color = display > 0.8 ? "hsl(142,71%,45%)" : display > 0.5 ? "hsl(38,92%,50%)" : "hsl(0,72%,51%)";
  const pct = display * 100;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-14 text-[10px] text-muted-foreground text-right shrink-0 leading-tight">{label}</div>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-10 text-[10px] font-mono tabular-nums font-bold" style={{ color }}>{value.toFixed(3)}</div>
    </div>
  );
}

function OverallBadge({ score }: { score: number }) {
  const color = score > 0.8 ? "text-emerald-400" : score > 0.5 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-bold text-sm tabular-nums ${color}`}>{score.toFixed(3)}</span>;
}

export default function Evals() {
  const { data, isLoading } = useGetEvals(
    { limit: 50 },
    { query: { refetchInterval: 15000, queryKey: getGetEvalsQueryKey({ limit: 50 }) } },
  );

  const evals = data?.evals ?? [];
  const total = data?.total ?? 0;

  const avgScores = evals.length > 0 ? {
    relevance: evals.reduce((a, e) => a + e.relevance, 0) / evals.length,
    safety: evals.reduce((a, e) => a + e.safety, 0) / evals.length,
    hallucination_risk: evals.reduce((a, e) => a + e.hallucination_risk, 0) / evals.length,
    groundedness: evals.reduce((a, e) => a + e.groundedness, 0) / evals.length,
    overall: evals.reduce((a, e) => a + e.overall, 0) / evals.length,
  } : null;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Evaluation Scores</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{total} evaluations scored</p>
      </div>

      {/* Averages */}
      {avgScores && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs font-semibold text-foreground mb-3">Average Scores</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ScoreGauge label="Relevance" value={avgScores.relevance} />
            <ScoreGauge label="Safety" value={avgScores.safety} />
            <ScoreGauge label="Hallucin." value={avgScores.hallucination_risk} invert />
            <ScoreGauge label="Grounded" value={avgScores.groundedness} />
            <ScoreGauge label="Overall" value={avgScores.overall} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Time", "Trace ID", "Overall", "Relevance", "Safety", "Hallucin. Risk", "Groundedness"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : evals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10">
                  <div className="flex flex-col items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-muted-foreground" />
                    <div className="text-muted-foreground text-center">
                      No evaluations yet. Evaluations are generated automatically for non-blocked requests.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              evals.map(e => (
                <tr
                  key={e.id}
                  data-testid={`row-eval-${e.id}`}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{e.created_at.substring(11, 19)}</td>
                  <td className="px-3 py-2.5 font-mono text-primary">{e.trace_id.substring(0, 14)}…</td>
                  <td className="px-3 py-2.5"><OverallBadge score={e.overall} /></td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">{e.relevance.toFixed(3)}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">{e.safety.toFixed(3)}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    <span className={e.hallucination_risk > 0.3 ? "text-orange-400" : "text-muted-foreground"}>
                      {e.hallucination_risk.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">{e.groundedness.toFixed(3)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Scoring key */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="text-xs font-semibold text-foreground mb-2">Scoring Legend</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div><span className="text-emerald-400 font-mono">&gt;0.800</span> — Excellent</div>
          <div><span className="text-yellow-400 font-mono">0.500–0.800</span> — Acceptable</div>
          <div><span className="text-red-400 font-mono">&lt;0.500</span> — Needs Review</div>
          <div><span className="text-orange-400 font-mono">hallucin. &gt;0.3</span> — High Risk</div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground/60">
          Note: Hallucination risk is inverted for the overall score — lower risk = better score.
        </div>
      </div>
    </div>
  );
}
