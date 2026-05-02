import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGetTraces, getGetTracesQueryKey, useGetTrace, getGetTraceQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronRight, ShieldOff, Eye, Zap, Link2,
  DollarSign, RotateCcw, Loader2, TrendingUp, TrendingDown,
  Minus, Lock, RefreshCw, ArrowRight,
} from "lucide-react";

// ─── Tag system ────────────────────────────────────────────────────────────────

interface TagDef { label: string; cls: string; icon: React.ElementType }

function getTraceTags(t: TraceItem): TagDef[] {
  const tags: TagDef[] = [];
  const findings: any[] = (t.security_result as any)?.findings ?? [];

  if (t.blocked) {
    tags.push({ label: "BLOCKED", cls: "bg-red-500/20 text-red-400 border-red-500/30", icon: ShieldOff });
  }
  if (findings.some(f => f.scanner === "pii")) {
    tags.push({ label: "PII DETECTED", cls: "bg-orange-500/15 text-orange-400 border-orange-500/25", icon: Eye });
  }
  if (findings.some(f => f.scanner === "prompt_injection")) {
    tags.push({ label: "PROMPT INJECTION", cls: "bg-red-500/15 text-red-300 border-red-500/25", icon: Zap });
  }
  if (findings.some(f => f.scanner === "jailbreak")) {
    tags.push({ label: "JAILBREAK", cls: "bg-purple-500/15 text-purple-400 border-purple-500/25", icon: Lock });
  }
  if ((t.routing_decision as any)?.session_affinity_hit === true) {
    tags.push({ label: "STICKY ROUTING", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: Link2 });
  }
  if (!t.blocked && t.cost > 0.003) {
    tags.push({ label: "HIGH COST", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25", icon: DollarSign });
  }
  if ((t as any).is_replay === 1 || (t as any).is_replay === true) {
    tags.push({ label: "REPLAYED", cls: "bg-violet-500/15 text-violet-400 border-violet-500/25", icon: RotateCcw });
  }
  return tags;
}

type TraceItem = {
  id: string;
  session_id: string;
  tenant_id: string;
  model: string;
  prompt: string;
  response: string;
  cost: number;
  latency_ms: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  blocked: boolean;
  block_reason?: string | null;
  created_at: string;
  routing_decision?: unknown;
  security_result?: unknown;
  eval_scores?: unknown;
};

// ─── Models ────────────────────────────────────────────────────────────────────

const MODELS = [
  { id: "mock-gpt-4",          label: "GPT-4",         cls: "border-emerald-500/40 text-emerald-300" },
  { id: "mock-gpt-3.5",        label: "GPT-3.5",       cls: "border-sky-500/40 text-sky-300" },
  { id: "mock-claude-3-opus",  label: "Claude Opus",   cls: "border-orange-500/40 text-orange-300" },
  { id: "mock-claude-3-haiku", label: "Claude Haiku",  cls: "border-amber-500/40 text-amber-300" },
  { id: "mock-gemini-pro",     label: "Gemini Pro",    cls: "border-purple-500/40 text-purple-300" },
];

function modelLabel(id: string) {
  return MODELS.find(m => m.id === id)?.label ?? id.replace("mock-", "");
}

// ─── Replay API hook ────────────────────────────────────────────────────────────

interface ReplayResult {
  original_trace: TraceItem & { eval_scores?: Record<string, number> };
  replay_trace: TraceItem & { eval_scores?: Record<string, number>; replay_of_trace_id?: string; is_replay?: boolean };
  diff: {
    response_changed: boolean;
    model_changed: boolean;
    routing_changed: boolean;
    eval_diff: { relevance: number; safety: number; hallucination: number; groundedness: number };
  };
}

function useReplayTrace() {
  return useMutation({
    mutationFn: async ({ traceId, overrideModel }: { traceId: string; overrideModel?: string }): Promise<ReplayResult> => {
      const res = await fetch(`/api/v1/traces/${traceId}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrideModel ? { override_model: overrideModel } : {}),
      });
      if (!res.ok) throw new Error(`Replay failed: ${res.status}`);
      return res.json();
    },
  });
}

// ─── Diff badge ────────────────────────────────────────────────────────────────

function DiffBadge({ label, changed, improved }: { label: string; changed: boolean; improved?: boolean }) {
  if (!changed && improved === undefined) return null;
  if (improved !== undefined) {
    return improved
      ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          <TrendingUp className="w-2.5 h-2.5" /> {label} IMPROVED
        </span>
      : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-red-500/15 text-red-400 border-red-500/30">
          <TrendingDown className="w-2.5 h-2.5" /> {label} DEGRADED
        </span>;
  }
  return changed
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
        {label} CHANGED
      </span>
    : null;
}

function EvalDiff({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.001) return <span className="text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />0.000</span>;
  return delta > 0
    ? <span className="text-emerald-400 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{delta.toFixed(3)}</span>
    : <span className="text-red-400 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{delta.toFixed(3)}</span>;
}

// ─── Replay comparison dialog ───────────────────────────────────────────────────

function ReplayDialog({ trace, open, onClose }: { trace: TraceItem | null; open: boolean; onClose: () => void }) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const replay = useReplayTrace();

  const effectiveModel = selectedModel ?? trace?.model ?? null;

  function runReplay() {
    if (!trace) return;
    setResult(null);
    const overrideModel = selectedModel && selectedModel !== trace.model ? selectedModel : undefined;
    replay.mutate({ traceId: trace.id, overrideModel }, {
      onSuccess: (data) => setResult(data),
    });
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setResult(null);
      setSelectedModel(null);
      replay.reset();
      onClose();
    }
  }

  if (!trace) return null;

  const origEval = trace.eval_scores as Record<string, number> | null;
  const repEval = result?.replay_trace.eval_scores as Record<string, number> | null;
  const overallDelta = repEval && origEval ? (repEval.overall ?? 0) - (origEval.overall ?? 0) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl bg-card border-card-border overflow-y-auto max-h-[90vh]">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-violet-400" />
            Incident Replay
            <span className="font-mono text-muted-foreground font-normal text-xs ml-2">{trace.id.substring(0, 16)}…</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Model selector */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">
              Select Replay Model
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => {
                const isCurrent = m.id === trace.model;
                const isSelected = effectiveModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`text-xs px-3 py-1.5 rounded border font-mono transition-all ${
                      isSelected
                        ? `${m.cls} bg-muted/60 font-bold`
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    }`}
                  >
                    {m.label}
                    {isCurrent && <span className="ml-1.5 text-[9px] opacity-60">(original)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={runReplay}
              disabled={replay.isPending}
              className="gap-2"
              size="sm"
            >
              {replay.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Replaying…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Run Replay</>
              }
            </Button>
            {effectiveModel && effectiveModel !== trace.model && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{modelLabel(trace.model)}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-mono text-foreground">{modelLabel(effectiveModel)}</span>
              </div>
            )}
            {replay.isError && (
              <span className="text-xs text-red-400">Replay failed — try again</span>
            )}
          </div>

          {/* Diff summary badges */}
          {result && (
            <div className="flex flex-wrap gap-2">
              <DiffBadge label="MODEL" changed={result.diff.model_changed} />
              <DiffBadge label="RESPONSE" changed={result.diff.response_changed} />
              {overallDelta !== null && Math.abs(overallDelta) >= 0.001 && (
                <DiffBadge label="EVAL" changed={false} improved={overallDelta > 0} />
              )}
              {!result.diff.model_changed && !result.diff.response_changed && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-muted/50 text-muted-foreground border-border">
                  <Minus className="w-2.5 h-2.5" /> IDENTICAL RESPONSE
                </span>
              )}
            </div>
          )}

          {/* Loading */}
          {replay.isPending && (
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map(i => (
                <div key={i} className="bg-muted/20 rounded-lg border border-border p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          )}

          {/* Side-by-side comparison */}
          {result && (
            <div className="grid grid-cols-2 gap-4">
              {/* Original */}
              <ComparePanel
                label="ORIGINAL"
                labelCls="text-muted-foreground"
                t={result.original_trace}
                evalScores={origEval}
                evalDiff={null}
              />
              {/* Replay */}
              <ComparePanel
                label="REPLAY"
                labelCls="text-violet-400"
                t={result.replay_trace}
                evalScores={repEval}
                evalDiff={result.diff.eval_diff}
              />
            </div>
          )}

          {/* Original trace prompt (read-only context) */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              Original Prompt (replayed verbatim)
            </div>
            <pre className="bg-muted/30 rounded p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-28 overflow-y-auto border border-border/40">
              {trace.prompt}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparePanel({
  label, labelCls, t, evalScores, evalDiff,
}: {
  label: string;
  labelCls: string;
  t: TraceItem & { eval_scores?: Record<string, number> };
  evalScores: Record<string, number> | null;
  evalDiff: ReplayResult["diff"]["eval_diff"] | null;
}) {
  const EVAL_KEYS: { key: string; label: string; diffKey?: keyof ReplayResult["diff"]["eval_diff"] }[] = [
    { key: "relevance",       label: "Relevance",       diffKey: "relevance" },
    { key: "safety",          label: "Safety",          diffKey: "safety" },
    { key: "hallucination_risk", label: "Hallucination", diffKey: "hallucination" },
    { key: "groundedness",    label: "Groundedness",    diffKey: "groundedness" },
    { key: "overall",         label: "Overall",         diffKey: undefined },
  ];

  return (
    <div className="bg-muted/10 border border-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${labelCls}`}>{label}</span>
        <span className="text-xs font-mono text-muted-foreground">{modelLabel(t.model)}</span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="bg-muted/30 rounded p-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Cost</div>
          <div className="font-mono font-bold text-foreground">${t.cost.toFixed(6)}</div>
        </div>
        <div className="bg-muted/30 rounded p-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Latency</div>
          <div className="font-mono font-bold text-foreground">{t.latency_ms.toFixed(0)}ms</div>
        </div>
        <div className="bg-muted/30 rounded p-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Tokens</div>
          <div className="font-mono font-bold text-foreground">{t.total_tokens}</div>
        </div>
      </div>

      {/* Response */}
      <div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Response</div>
        {t.blocked
          ? <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-[11px] text-red-400 font-mono">
              [BLOCKED] {t.block_reason}
            </div>
          : <pre className="bg-muted/30 border border-border/40 rounded p-2 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-32 overflow-y-auto">
              {t.response}
            </pre>
        }
      </div>

      {/* Eval scores */}
      {evalScores && (
        <div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1.5">Eval Scores</div>
          <div className="space-y-1">
            {EVAL_KEYS.map(({ key, label: lbl, diffKey }) => {
              const val = evalScores[key] ?? 0;
              const delta = evalDiff && diffKey ? evalDiff[diffKey] : null;
              const isHallucination = key === "hallucination_risk";
              const displayVal = isHallucination ? 1 - val : val;
              const color = displayVal > 0.8 ? "text-emerald-400" : displayVal > 0.5 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono w-28 shrink-0">{lbl}</span>
                  <span className={`text-[11px] font-mono font-bold ${color}`}>{val.toFixed(3)}</span>
                  {delta !== null && <EvalDiff delta={delta} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trace detail sheet ────────────────────────────────────────────────────────

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

            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Prompt</div>
              <pre className="bg-muted rounded p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-40 overflow-y-auto">{data.prompt}</pre>
            </div>

            {!data.blocked && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Response</div>
                <pre className="bg-muted rounded p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground max-h-40 overflow-y-auto">{data.response}</pre>
              </div>
            )}

            {data.routing_decision && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Routing Decision</div>
                <div className="bg-muted rounded p-3 space-y-1.5">
                  {Object.entries(data.routing_decision as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground font-mono w-36 shrink-0">{k}:</span>
                      <span className={`text-foreground font-mono break-words ${k === "session_affinity_hit" && v ? "text-blue-400 font-bold" : ""}`}>
                        {JSON.stringify(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        <div className="flex gap-2"><span className="text-muted-foreground font-mono">scanner:</span><span className="text-primary">{finding.scanner}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground font-mono">severity:</span>
                          <span className={finding.severity === "critical" ? "text-red-400" : finding.severity === "high" ? "text-orange-400" : "text-yellow-400"}>{finding.severity}</span>
                        </div>
                        <div className="flex gap-2"><span className="text-muted-foreground font-mono">reason:</span><span className="text-foreground">{finding.reason}</span></div>
                        {finding.matched && (
                          <div className="flex gap-2"><span className="text-muted-foreground font-mono">matched:</span><span className="text-yellow-300 font-mono">{finding.matched}</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.eval_scores && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">Evaluation Scores</div>
                <div className="bg-muted rounded p-3 grid grid-cols-2 gap-2">
                  {Object.entries(data.eval_scores as Record<string, number>).map(([k, v]) => {
                    const display = k === "hallucination_risk" ? 1 - v : v;
                    const color = display > 0.8 ? "text-emerald-400" : display > 0.5 ? "text-yellow-400" : "text-red-400";
                    return (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-muted-foreground font-mono">{k}:</span>
                        <span className={`font-bold font-mono ${color}`}>{v.toFixed(3)}</span>
                      </div>
                    );
                  })}
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

// ─── Eval color helper ─────────────────────────────────────────────────────────

function evalColor(score: number) {
  if (score > 0.8) return "text-emerald-400";
  if (score > 0.5) return "text-yellow-400";
  return "text-red-400";
}

// ─── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function Traces() {
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayTrace, setReplayTrace] = useState<TraceItem | null>(null);

  const { data, isLoading } = useGetTraces(
    { limit: PAGE_SIZE, offset },
    { query: { refetchInterval: 15000, queryKey: getGetTracesQueryKey({ limit: PAGE_SIZE, offset }) } },
  );

  const total = data?.total ?? 0;
  const traces = (data?.traces ?? []) as unknown as TraceItem[];
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Trace Explorer</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} total traces — click any row to inspect, or replay to debug</p>
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

      {/* Tag legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {[
          { label: "BLOCKED",        cls: "bg-red-500/15 text-red-400 border-red-500/25" },
          { label: "PII DETECTED",   cls: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
          { label: "PROMPT INJECTION",cls: "bg-red-500/15 text-red-300 border-red-500/25" },
          { label: "JAILBREAK",      cls: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
          { label: "STICKY ROUTING", cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
          { label: "HIGH COST",      cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
          { label: "REPLAYED",       cls: "bg-violet-500/15 text-violet-400 border-violet-500/25" },
        ].map(t => (
          <span key={t.label} className={`px-1.5 py-0.5 rounded border font-medium ${t.cls}`}>{t.label}</span>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Time", "Model", "Session", "Prompt", "Tokens", "Cost", "Latency", "Tags & Status", "Score", "Actions"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  No traces yet — send a request or run the demo
                </td>
              </tr>
            ) : (
              traces.map(t => {
                const evalScores = t.eval_scores as { overall?: number } | null;
                const overall = evalScores?.overall;
                const tags = getTraceTags(t);

                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${
                      (t as any).is_replay ? "bg-violet-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{t.created_at.substring(11, 19)}</td>
                    <td className="px-3 py-2.5 font-mono text-primary whitespace-nowrap">{t.model.replace("mock-", "")}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{t.session_id.substring(0, 8)}…</td>
                    <td
                      className="px-3 py-2.5 text-foreground max-w-[160px] truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setSelectedId(t.id)}
                      title={t.prompt}
                    >
                      {t.prompt}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground tabular-nums">{t.total_tokens.toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      <span className={t.cost > 0.003 && !t.blocked ? "text-yellow-400 font-bold" : "text-foreground"}>
                        ${t.cost.toFixed(6)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground tabular-nums">{t.latency_ms.toFixed(0)}ms</td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">OK</Badge>
                        ) : (
                          tags.map(tag => {
                            const Icon = tag.icon;
                            return (
                              <Badge key={tag.label} className={`${tag.cls} text-[9px] px-1 py-0 gap-0.5 font-bold`}>
                                <Icon className="w-2 h-2 shrink-0" />
                                <span className="hidden xl:inline">{tag.label}</span>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {overall !== undefined ? (
                        <span className={evalColor(overall)}>{overall.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedId(t.id)}
                        >
                          Detail
                        </Button>
                        {!t.blocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                            onClick={(e) => { e.stopPropagation(); setReplayTrace(t); }}
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                            Replay
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TraceDetail traceId={selectedId ?? ""} open={!!selectedId} onClose={() => setSelectedId(null)} />
      <ReplayDialog trace={replayTrace} open={!!replayTrace} onClose={() => setReplayTrace(null)} />
    </div>
  );
}
