import { useState } from "react";
import { useLocation } from "wouter";
import { useRunDemo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlayCircle, CheckCircle, XCircle, ShieldOff, ChevronDown, ChevronUp,
  Loader2, ArrowRight, RotateCcw, Activity, Sparkles,
} from "lucide-react";

interface ScenarioResult {
  scenario: string;
  status: "passed" | "blocked" | "failed";
  trace_id?: string;
  description: string;
  details?: Record<string, unknown>;
}

const SCENARIO_DEFS = [
  {
    name: "normal_request",
    description: "Normal chat request with mock-gpt-4",
    tag: "Happy Path",
    replayCandidate: true,
    replayHint: "Try replaying with Claude Haiku — 75% cheaper",
  },
  {
    name: "prompt_injection",
    description: "Prompt injection attack — blocked by security scanner",
    tag: "Security",
    replayCandidate: false,
  },
  {
    name: "pii_detection",
    description: "Request containing SSN — PII detected and blocked by policy",
    tag: "Security",
    replayCandidate: false,
  },
  {
    name: "secret_leak",
    description: "Request containing AWS key — secret detected and blocked",
    tag: "Security",
    replayCandidate: false,
  },
  {
    name: "jailbreak_attempt",
    description: "DAN mode jailbreak — blocked at critical severity",
    tag: "Security",
    replayCandidate: false,
  },
  {
    name: "expensive_prompt",
    description: "Large prompt to test cost tracking and routing",
    tag: "Cost",
    replayCandidate: true,
    replayHint: "Replay with GPT-3.5 to see -80% cost reduction",
  },
  {
    name: "session_routing_1",
    description: "First message — establishes session affinity with mock-gpt-4",
    tag: "Routing",
    replayCandidate: false,
  },
  {
    name: "session_routing_2",
    description: "Second message — sticky routing keeps gpt-4 even if gpt-3.5 requested",
    tag: "Routing",
    replayCandidate: true,
    replayHint: "Best replay candidate — demonstrates routing decision logic",
  },
  {
    name: "multi_tenant",
    description: "Multi-tenant usage with separate tenant IDs and isolation",
    tag: "Multi-tenant",
    replayCandidate: false,
  },
  {
    name: "evaluation_scoring",
    description: "Request that produces varied evaluation scores across all dimensions",
    tag: "Eval",
    replayCandidate: true,
    replayHint: "Replay with different model to compare eval scores side-by-side",
  },
];

const TAG_COLORS: Record<string, string> = {
  "Happy Path":   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "Security":     "bg-red-500/15 text-red-400 border-red-500/25",
  "Cost":         "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "Routing":      "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Multi-tenant": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "Eval":         "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] px-1.5 py-0.5 gap-1">
      <CheckCircle className="w-2.5 h-2.5" /> PASSED
    </Badge>
  );
  if (status === "blocked") return (
    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/25 text-[10px] px-1.5 py-0.5 gap-1">
      <ShieldOff className="w-2.5 h-2.5" /> BLOCKED ✓
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
      if (v > 10) return v.toFixed(0);
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
            k === "session_affinity_hit" && v ? "text-blue-400 font-bold" :
            k === "block_reason" ? "text-red-300" :
            k === "routing" && typeof v === "string" && v.includes("affinity") ? "text-blue-400" :
            "text-foreground"
          }`}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Demo() {
  const [, navigate] = useLocation();
  const [results, setResults] = useState<ScenarioResult[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const runDemo = useRunDemo();

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function runAll() {
    setResults(null);
    setExpanded(new Set());
    runDemo.mutate({}, {
      onSuccess: (data) => {
        const res = data.results as ScenarioResult[];
        setResults(res);
        setExpanded(new Set(res.filter(r => r.status === "failed").map(r => r.scenario)));
      },
    });
  }

  async function runOne(name: string) {
    runDemo.mutate({ scenarios: [name] }, {
      onSuccess: (data) => {
        const result = (data.results as ScenarioResult[])[0];
        if (!result) return;
        setResults(prev => {
          if (!prev) return [result];
          return [...prev.filter(r => r.scenario !== name), result];
        });
        setExpanded(prev => new Set([...prev, name]));
      },
    });
  }

  const resultMap: Record<string, ScenarioResult> = {};
  for (const r of results ?? []) resultMap[r.scenario] = r;

  const summary = results ? {
    passed: results.filter(r => r.status === "passed").length,
    blocked: results.filter(r => r.status === "blocked").length,
    failed: results.filter(r => r.status === "failed").length,
    total: results.length,
  } : null;

  const replayCandidates = results
    ? SCENARIO_DEFS.filter(s => s.replayCandidate && resultMap[s.name]?.status === "passed")
    : [];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Demo Runner</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            10 scenarios covering security, routing, cost, multi-tenancy, and evaluation
          </p>
        </div>
        <Button
          onClick={runAll}
          disabled={runDemo.isPending}
          size="lg"
          className="gap-2 font-semibold"
        >
          {runDemo.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Running all scenarios…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Run Full Demo</>
          )}
        </Button>
      </div>

      {/* Post-run analysis banner */}
      {summary && !runDemo.isPending && (
        <div className="bg-card border border-card-border rounded-lg p-4 space-y-3">
          {/* Summary row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-3 py-1.5 text-sm">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{summary.passed}</span> passed
            </div>
            <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded px-3 py-1.5 text-sm">
              <ShieldOff className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{summary.blocked}</span> blocked
              <span className="text-xs text-yellow-400/70 ml-1">(expected — security working)</span>
            </div>
            {summary.failed > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded px-3 py-1.5 text-sm">
                <XCircle className="w-3.5 h-3.5" />
                <span className="font-mono font-bold">{summary.failed}</span> failed
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => navigate("/traces")}
              >
                <Activity className="w-3.5 h-3.5" />
                View Traces
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Replay candidates */}
          {replayCandidates.length > 0 && (
            <div className="border-t border-border/50 pt-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3 text-violet-400" />
                Replay Candidates — open Traces to compare model responses
              </div>
              <div className="flex flex-wrap gap-2">
                {replayCandidates.map(s => (
                  <div key={s.name} className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded px-2.5 py-1.5">
                    <span className="text-xs font-mono text-violet-300">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">—</span>
                    <span className="text-[10px] text-violet-400/80">{s.replayHint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario cards */}
      <div className="space-y-2">
        {SCENARIO_DEFS.map(s => {
          const result = resultMap[s.name];
          const isExpanded = expanded.has(s.name);
          const isRunning = runDemo.isPending;
          const isReplayCandidate = s.replayCandidate && result?.status === "passed";

          return (
            <div
              key={s.name}
              className={`bg-card border rounded-lg overflow-hidden transition-colors ${
                isReplayCandidate ? "border-violet-500/30" : "border-card-border"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status icon */}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground font-mono">{s.name}</span>
                    <Badge className={`${TAG_COLORS[s.tag] ?? ""} text-[10px] px-1.5 py-0 border`}>{s.tag}</Badge>
                    {result && <StatusBadge status={result.status} />}
                    {isReplayCandidate && (
                      <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/25 text-[10px] px-1.5 py-0 border gap-0.5">
                        <RotateCcw className="w-2.5 h-2.5" /> Replay Ready
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                  {isReplayCandidate && s.replayHint && (
                    <div className="text-[10px] text-violet-400/70 mt-0.5 italic">{s.replayHint}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => runOne(s.name)}
                    disabled={isRunning}
                  >
                    <PlayCircle className="w-3 h-3" />
                    Run
                  </Button>
                  {result?.trace_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                      onClick={() => navigate("/traces")}
                    >
                      <Activity className="w-3 h-3" />
                      Trace
                    </Button>
                  )}
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
                    <div className="mt-3 flex items-center gap-3">
                      <div className="text-[10px] font-mono text-muted-foreground">
                        trace_id: {result.trace_id}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[10px] text-violet-400 gap-1"
                        onClick={() => navigate("/traces")}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Open in Traces to Replay
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Guided demo tip */}
      <div className="bg-card border border-card-border/50 rounded-lg p-4">
        <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          3-Minute Demo Flow
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Click <span className="text-foreground font-medium">Run Full Demo</span> — watch all 10 scenarios execute</li>
          <li>Navigate to <span className="text-foreground font-medium">Security</span> — see injection, PII, and jailbreak events logged</li>
          <li>Open <span className="text-foreground font-medium">Traces</span> — find a STICKY ROUTING trace, click Replay with Claude Haiku</li>
          <li>Open <span className="text-foreground font-medium">Cost Insights</span> — show the GPT-4 → GPT-3.5 -80% savings recommendation</li>
          <li>Open <span className="text-foreground font-medium">Red Team</span> — run adversarial tests, confirm 100% block rate</li>
        </ol>
      </div>
    </div>
  );
}
