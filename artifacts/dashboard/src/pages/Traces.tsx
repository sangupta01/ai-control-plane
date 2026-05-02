import { useState } from "react";
import { useGetTraces, getGetTracesQueryKey, useGetTrace, getGetTraceQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function severityBadge(blocked: boolean) {
  return blocked
    ? <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-1.5 py-0.5">BLOCKED</Badge>
    : <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0.5">OK</Badge>;
}

function evalColor(score: number) {
  if (score > 0.8) return "text-emerald-400";
  if (score > 0.5) return "text-yellow-400";
  return "text-red-400";
}

function TraceDetail({ traceId, open, onClose }: { traceId: string; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useGetTrace(traceId, {
    query: { enabled: open && !!traceId, queryKey: getGetTraceQueryKey(traceId) },
  });

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[560px] sm:w-[560px] overflow-y-auto bg-card border-card-border">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold text-foreground">Trace Detail</SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : (
          <div className="mt-4 space-y-5 text-xs">
            <Row label="ID" value={data.id} mono />
            <Row label="Session" value={data.session_id} mono />
            <Row label="Tenant" value={data.tenant_id} mono />
            <Row label="Model" value={data.model} mono />
            <Row label="Time" value={data.created_at} />
            <Row label="Tokens" value={`${data.prompt_tokens} prompt / ${data.completion_tokens} completion / ${data.total_tokens} total`} />
            <Row label="Cost" value={`$${data.cost.toFixed(6)}`} mono />
            <Row label="Latency" value={`${data.latency_ms.toFixed(0)}ms`} />
            <Row label="Blocked" value={data.blocked ? "YES" : "no"} valueClass={data.blocked ? "text-red-400 font-bold" : "text-muted-foreground"} />
            {data.block_reason && <Row label="Block Reason" value={data.block_reason} valueClass="text-red-400" />}

            {/* Prompt */}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Prompt</div>
              <pre className="bg-muted rounded p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-40 overflow-y-auto">{data.prompt}</pre>
            </div>

            {/* Response */}
            {!data.blocked && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Response</div>
                <pre className="bg-muted rounded p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-40 overflow-y-auto">{data.response}</pre>
              </div>
            )}

            {/* Routing */}
            {data.routing_decision && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Routing Decision</div>
                <div className="bg-muted rounded p-3 space-y-1.5">
                  {Object.entries(data.routing_decision as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground font-mono w-36 shrink-0">{k}:</span>
                      <span className="text-foreground font-mono break-words">{JSON.stringify(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security */}
            {data.security_result && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Security Result</div>
                <div className="bg-muted rounded p-3 space-y-2">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground font-mono w-16">passed:</span>
                    <span className={(data.security_result as { passed: boolean }).passed ? "text-emerald-400" : "text-red-400"}>
                      {JSON.stringify((data.security_result as { passed: boolean }).passed)}
                    </span>
                  </div>
                  {((data.security_result as { findings: unknown[] }).findings || []).map((f: unknown, i: number) => {
                    const finding = f as { scanner: string; severity: string; action: string; reason: string; matched?: string };
                    return (
                      <div key={i} className="pl-2 border-l border-border space-y-0.5">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground font-mono">scanner:</span>
                          <span className="text-primary">{finding.scanner}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground font-mono">severity:</span>
                          <span className={finding.severity === "critical" ? "text-red-400" : finding.severity === "high" ? "text-orange-400" : "text-yellow-400"}>{finding.severity}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground font-mono">reason:</span>
                          <span className="text-foreground">{finding.reason}</span>
                        </div>
                        {finding.matched && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground font-mono">matched:</span>
                            <span className="text-yellow-300 font-mono">{finding.matched}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Eval scores */}
            {data.eval_scores && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Evaluation Scores</div>
                <div className="bg-muted rounded p-3 grid grid-cols-2 gap-2">
                  {Object.entries(data.eval_scores as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-muted-foreground font-mono">{k}:</span>
                      <span className={`font-bold font-mono ${evalColor(k === "hallucination_risk" ? 1 - v : v)}`}>{v.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className={`${mono ? "font-mono" : ""} text-foreground break-all ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

const PAGE_SIZE = 25;

export default function Traces() {
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useGetTraces(
    { limit: PAGE_SIZE, offset },
    { query: { refetchInterval: 15000, queryKey: getGetTracesQueryKey({ limit: PAGE_SIZE, offset }) } },
  );

  const total = data?.total ?? 0;
  const traces = data?.traces ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Trace Explorer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} total traces</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Page {currentPage} of {totalPages || 1}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Time", "Model", "Session", "Prompt", "Tokens", "Cost", "Latency", "Status", "Score"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No traces yet — send a request or run the demo
                </td>
              </tr>
            ) : (
              traces.map(t => {
                const evalScores = t.eval_scores as { overall?: number } | null;
                const overall = evalScores?.overall;
                return (
                  <tr
                    key={t.id}
                    data-testid={`row-trace-${t.id}`}
                    className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(t.id)}
                  >
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{t.created_at.substring(11, 19)}</td>
                    <td className="px-3 py-2.5 font-mono text-primary whitespace-nowrap">{t.model.replace("mock-", "")}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{t.session_id.substring(0, 8)}…</td>
                    <td className="px-3 py-2.5 text-foreground max-w-[180px] truncate">{t.prompt}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground tabular-nums">{t.total_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground tabular-nums">${t.cost.toFixed(6)}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground tabular-nums">{t.latency_ms.toFixed(0)}ms</td>
                    <td className="px-3 py-2.5">{severityBadge(t.blocked)}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {overall !== undefined ? (
                        <span className={evalColor(overall)}>{overall.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <TraceDetail traceId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
