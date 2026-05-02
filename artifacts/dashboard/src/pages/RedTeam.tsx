import { useState } from "react";
import { useRunRedTeam, useGetRedTeamScenarios } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, CheckCircle, XCircle, AlertTriangle,
  PlayCircle, Loader2, ChevronDown, ChevronUp, ShieldOff,
} from "lucide-react";

const CATEGORY_BADGE: Record<string, string> = {
  prompt_injection: "bg-red-500/15 text-red-400 border-red-500/25",
  jailbreak: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  secret_leak: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  pii: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  data_exfiltration: "bg-red-600/15 text-red-300 border-red-600/25",
  baseline: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/25",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  none: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

interface RedTeamResult {
  id: string;
  run_id: string;
  scenario_id: string;
  scenario_name: string;
  category: string;
  status: "passed" | "failed" | "error";
  expected_blocked: boolean;
  actual_blocked: boolean;
  correct: boolean;
  trace_id?: string;
  block_reason?: string;
  security_findings: number;
  latency_ms: number;
  error?: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "passed") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
}

export default function RedTeam() {
  const [runResults, setRunResults] = useState<RedTeamResult[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: scenariosData, isLoading: scenariosLoading } = useGetRedTeamScenarios();
  const runRedTeam = useRunRedTeam();

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAll() {
    setRunResults(null);
    setExpanded(new Set());
    runRedTeam.mutate(
      {},
      {
        onSuccess: (data) => {
          setRunResults(data.results as RedTeamResult[]);
          setRunId(data.run_id);
          const failedIds = new Set(
            (data.results as RedTeamResult[]).filter(r => r.status !== "passed").map(r => r.id)
          );
          setExpanded(failedIds);
        },
      },
    );
  }

  const resultMap: Record<string, RedTeamResult> = {};
  for (const r of runResults ?? []) resultMap[r.scenario_id] = r;

  const passed = runResults?.filter(r => r.status === "passed").length ?? 0;
  const failed = runResults?.filter(r => r.status === "failed").length ?? 0;
  const errors = runResults?.filter(r => r.status === "error").length ?? 0;
  const passRate = runResults ? (passed / runResults.length * 100).toFixed(0) : null;

  const scenarios = scenariosData?.scenarios ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Red Team Mode</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adversarial testing — {scenarios.length} attack scenarios covering all scanner categories
          </p>
        </div>
        <Button
          onClick={runAll}
          disabled={runRedTeam.isPending}
          className="gap-2"
        >
          {runRedTeam.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
          ) : (
            <><Target className="w-4 h-4" /> Run Red Team</>
          )}
        </Button>
      </div>

      {/* Summary */}
      {runResults && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Run Summary</span>
            {runId && (
              <span className="text-[10px] font-mono text-muted-foreground">run: {runId.substring(0, 8)}…</span>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-3 py-1.5 text-sm">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{passed}</span> passed
            </div>
            <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded px-3 py-1.5 text-sm">
              <XCircle className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{failed}</span> failed
            </div>
            {errors > 0 && (
              <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded px-3 py-1.5 text-sm">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-mono font-bold">{errors}</span> errors
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-3 py-1.5 text-sm">
              <ShieldOff className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{passRate}%</span> pass rate
            </div>
          </div>
        </div>
      )}

      {/* Scenario list */}
      {scenariosLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {scenarios.map(scenario => {
            const result = resultMap[scenario.id];
            const isExpanded = expanded.has(result?.id ?? scenario.id);

            return (
              <div
                key={scenario.id}
                className="bg-card border border-card-border rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-5 shrink-0">
                    {result ? (
                      <StatusIcon status={result.status} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">{scenario.name}</span>
                      <Badge className={`${CATEGORY_BADGE[scenario.category] ?? ""} text-[10px] px-1.5 py-0 border`}>
                        {scenario.category}
                      </Badge>
                      <Badge className={`${SEVERITY_BADGE[scenario.severity] ?? ""} text-[10px] px-1.5 py-0 border`}>
                        {scenario.severity}
                      </Badge>
                      {scenario.expected_blocked && (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] px-1.5 py-0 border">
                          expect: blocked
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{scenario.description}</div>
                  </div>

                  {result && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => toggleExpand(result.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>

                {result && isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50 bg-muted/10">
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">expected_blocked:</span>
                        <span className={`font-mono ${result.expected_blocked ? "text-yellow-400" : "text-emerald-400"}`}>
                          {String(result.expected_blocked)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">actual_blocked:</span>
                        <span className={`font-mono ${result.actual_blocked ? "text-yellow-400" : "text-emerald-400"}`}>
                          {String(result.actual_blocked)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">correct:</span>
                        <span className={`font-mono ${result.correct ? "text-emerald-400" : "text-red-400"}`}>
                          {String(result.correct)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">security_findings:</span>
                        <span className="font-mono text-foreground">{result.security_findings}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground font-mono w-36 shrink-0">latency_ms:</span>
                        <span className="font-mono text-foreground">{result.latency_ms.toFixed(0)}ms</span>
                      </div>
                      {result.block_reason && (
                        <div className="flex gap-2 col-span-2">
                          <span className="text-muted-foreground font-mono w-36 shrink-0">block_reason:</span>
                          <span className="font-mono text-red-300">{result.block_reason}</span>
                        </div>
                      )}
                      {result.trace_id && (
                        <div className="flex gap-2 col-span-2">
                          <span className="text-muted-foreground font-mono w-36 shrink-0">trace_id:</span>
                          <span className="font-mono text-muted-foreground text-[10px]">{result.trace_id}</span>
                        </div>
                      )}
                      {result.error && (
                        <div className="flex gap-2 col-span-2">
                          <span className="text-muted-foreground font-mono w-36 shrink-0">error:</span>
                          <span className="font-mono text-red-400">{result.error}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 p-2 bg-muted/20 rounded text-[10px] font-mono text-muted-foreground break-all">
                      <span className="text-muted-foreground/60">attack: </span>
                      {scenario.attack_prompt.substring(0, 160)}{scenario.attack_prompt.length > 160 ? "…" : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!runResults && !runRedTeam.isPending && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground border border-border/40 rounded-lg px-4 py-3 bg-muted/10">
          <PlayCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Click "Run Red Team" to execute all {scenarios.length} adversarial attack scenarios against the gateway. Results are persisted to the database.</span>
        </div>
      )}
    </div>
  );
}
