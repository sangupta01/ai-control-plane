import { useState } from "react";
import { useRunDemo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, CheckCircle, XCircle, ShieldOff, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface ScenarioResult {
  scenario: string;
  status: "passed" | "blocked" | "failed";
  trace_id?: string;
  description: string;
  details?: Record<string, unknown>;
}

const SCENARIO_DEFS = [
  { name: "normal_request", description: "Normal chat request with mock-gpt-4", tag: "Happy Path" },
  { name: "prompt_injection", description: "Prompt injection attack — should be blocked", tag: "Security" },
  { name: "pii_detection", description: "Request containing SSN — PII detected and blocked", tag: "Security" },
  { name: "secret_leak", description: "Request containing AWS key — secret detected and blocked", tag: "Security" },
  { name: "jailbreak_attempt", description: "DAN mode jailbreak — should be blocked", tag: "Security" },
  { name: "expensive_prompt", description: "Large prompt to test cost tracking and routing", tag: "Cost" },
  { name: "session_routing_1", description: "First message — establishes affinity with mock-gpt-4", tag: "Routing" },
  { name: "session_routing_2", description: "Second message — sticky routing keeps gpt-4 even if gpt-3.5 requested", tag: "Routing" },
  { name: "multi_tenant", description: "Multi-tenant usage with separate tenant IDs", tag: "Multi-tenant" },
  { name: "evaluation_scoring", description: "Request that produces varied evaluation scores", tag: "Eval" },
];

const TAG_COLORS: Record<string, string> = {
  "Happy Path": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "Security": "bg-red-500/15 text-red-400 border-red-500/25",
  "Cost": "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "Routing": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Multi-tenant": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "Eval": "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] px-1.5 py-0.5 gap-1">
      <CheckCircle className="w-2.5 h-2.5" /> PASSED
    </Badge>
  );
  if (status === "blocked") return (
    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/25 text-[10px] px-1.5 py-0.5 gap-1">
      <ShieldOff className="w-2.5 h-2.5" /> BLOCKED
    </Badge>
  );
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px] px-1.5 py-0.5 gap-1">
      <XCircle className="w-2.5 h-2.5" /> FAILED
    </Badge>
  );
}

function ResultDetails({ details }: { details: Record<string, unknown> }) {
  const fmt = (v: unknown): string => {
    if (typeof v === "number") {
      if (String(v).includes(".") && v < 1) return v.toFixed(6);
      if (typeof v === "number" && v > 10) return v.toFixed(0);
      return String(v);
    }
    return JSON.stringify(v);
  };

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
      {Object.entries(details).filter(([k]) => k !== "error").map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-muted-foreground font-mono w-36 shrink-0">{k}:</span>
          <span className={`font-mono ${
            k === "blocked" && v ? "text-red-400" :
            k === "session_affinity_hit" && v ? "text-emerald-400" :
            k === "block_reason" ? "text-red-300" :
            "text-foreground"
          }`}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Demo() {
  const [results, setResults] = useState<ScenarioResult[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const runDemo = useRunDemo();

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function runAll() {
    setResults(null);
    setExpanded(new Set());
    runDemo.mutate(
      {},
      {
        onSuccess: (data) => {
          setResults(data.results as ScenarioResult[]);
          setExpanded(new Set((data.results as ScenarioResult[]).filter(r => r.status === "failed").map(r => r.scenario)));
        },
      },
    );
  }

  async function runOne(name: string) {
    runDemo.mutate(
      { scenarios: [name] },
      {
        onSuccess: (data) => {
          const result = (data.results as ScenarioResult[])[0];
          if (!result) return;
          setResults(prev => {
            if (!prev) return [result];
            const next = prev.filter(r => r.scenario !== name);
            return [...next, result];
          });
          setExpanded(prev => new Set([...prev, name]));
        },
      },
    );
  }

  const resultMap: Record<string, ScenarioResult> = {};
  for (const r of results ?? []) resultMap[r.scenario] = r;

  const summary = results ? {
    passed: results.filter(r => r.status === "passed").length,
    blocked: results.filter(r => r.status === "blocked").length,
    failed: results.filter(r => r.status === "failed").length,
  } : null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Demo Runner</h1>
          <p className="text-xs text-muted-foreground mt-0.5">10 scenarios covering all platform capabilities</p>
        </div>
        <Button
          data-testid="button-run-all"
          onClick={runAll}
          disabled={runDemo.isPending}
          className="gap-2"
        >
          {runDemo.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
          ) : (
            <><PlayCircle className="w-4 h-4" /> Run All Scenarios</>
          )}
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-3 py-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="font-mono font-bold">{summary.passed}</span> passed
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded px-3 py-1.5">
            <ShieldOff className="w-3.5 h-3.5" />
            <span className="font-mono font-bold">{summary.blocked}</span> blocked
          </div>
          <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded px-3 py-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-mono font-bold">{summary.failed}</span> failed
          </div>
        </div>
      )}

      {/* Scenario cards */}
      <div className="space-y-2">
        {SCENARIO_DEFS.map(s => {
          const result = resultMap[s.name];
          const isExpanded = expanded.has(s.name);
          const isRunning = runDemo.isPending;

          return (
            <div
              key={s.name}
              data-testid={`card-scenario-${s.name}`}
              className="bg-card border border-card-border rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status or pending */}
                <div className="w-5 shrink-0">
                  {result ? (
                    result.status === "passed" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                    result.status === "blocked" ? <ShieldOff className="w-4 h-4 text-yellow-400" /> :
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border" />
                  )}
                </div>

                {/* Name & description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground font-mono">{s.name}</span>
                    <Badge className={`${TAG_COLORS[s.tag] ?? ""} text-[10px] px-1.5 py-0 border`}>{s.tag}</Badge>
                    {result && <StatusBadge status={result.status} />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    data-testid={`button-run-${s.name}`}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => runOne(s.name)}
                    disabled={isRunning}
                  >
                    <PlayCircle className="w-3 h-3" />
                    Run
                  </Button>
                  {result && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleExpand(s.name)}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {result && isExpanded && result.details && (
                <div className="px-4 pb-4 border-t border-border/50 bg-muted/10">
                  <ResultDetails details={result.details} />
                  {result.trace_id && (
                    <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                      trace_id: {result.trace_id}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
