import { useState } from "react";
import { useGetSecurityEvents, getGetSecurityEventsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, AlertCircle, Info } from "lucide-react";

type Severity = "critical" | "high" | "medium" | "low";
type Action = "block" | "flag" | "allow";

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/25",
    high:     "bg-orange-500/15 text-orange-400 border-orange-500/25",
    medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    low:      "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  const icons: Record<Severity, React.ElementType> = {
    critical: AlertCircle, high: AlertTriangle, medium: AlertTriangle, low: Info,
  };
  const Icon = icons[severity] ?? Info;
  return (
    <Badge className={`${styles[severity] ?? ""} text-[10px] px-1.5 py-0.5 gap-1 font-medium uppercase`}>
      <Icon className="w-2.5 h-2.5" />{severity}
    </Badge>
  );
}

function ActionBadge({ action }: { action: Action }) {
  const styles: Record<Action, string> = {
    block: "bg-red-500/15 text-red-400 border-red-500/25",
    flag:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    allow: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  };
  return (
    <Badge className={`${styles[action] ?? ""} text-[10px] px-1.5 py-0.5 font-medium uppercase`}>
      {action}
    </Badge>
  );
}

const SCANNERS = [
  { key: "prompt_injection",  label: "Prompt Injection" },
  { key: "jailbreak",         label: "Jailbreak Detection" },
  { key: "pii",               label: "PII Detection" },
  { key: "secrets",           label: "Secret Detection" },
  { key: "data_exfiltration", label: "Data Exfiltration" },
];

const PREVIEW = 2;

interface ScannerEvent {
  id: string; created_at: string; severity: string; action: string;
  reason: string; matched?: string; prompt_excerpt?: string;
}

function ScannerSection({ label, events }: { label: string; events: ScannerEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown  = expanded ? events : events.slice(0, PREVIEW);
  const hidden = events.length - PREVIEW;

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      {/* Header — "more" link lives here, no extra row */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/20">
        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {events.length > 0 && (
          <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
            {events.length}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {events.length === 0 ? "no events" : `showing ${shown.length} of ${events.length}`}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {expanded ? "· show less" : `· +${hidden} more`}
            </button>
          )}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="px-4 py-2.5 text-xs text-muted-foreground italic">
          No events — run the demo to generate {label.toLowerCase()} events.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              {["Time", "Severity", "Action", "Reason", "Matched", "Prompt Excerpt"].map(h => (
                <th key={h} className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(ev => (
              <tr key={ev.id} data-testid={`row-security-${ev.id}`} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{ev.created_at.substring(11, 19)}</td>
                <td className="px-3 py-1.5"><SeverityBadge severity={ev.severity as Severity} /></td>
                <td className="px-3 py-1.5"><ActionBadge action={ev.action as Action} /></td>
                <td className="px-3 py-1.5 text-foreground max-w-[200px] truncate" title={ev.reason}>{ev.reason}</td>
                <td className="px-3 py-1.5 font-mono text-yellow-300 max-w-[120px] truncate">{ev.matched ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground max-w-[180px] truncate">{ev.prompt_excerpt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Security() {
  const { data, isLoading } = useGetSecurityEvents(
    { limit: 500 },
    { query: { refetchInterval: 15000, queryKey: getGetSecurityEventsQueryKey({ limit: 500 }) } },
  );

  const events  = data?.events ?? [];
  const total   = data?.total ?? 0;

  const byScanner: Record<string, ScannerEvent[]> = {};
  for (const ev of events) {
    if (!byScanner[ev.scanner]) byScanner[ev.scanner] = [];
    byScanner[ev.scanner]!.push(ev);
  }

  const counts = {
    critical: events.filter(e => e.severity === "critical").length,
    high:     events.filter(e => e.severity === "high").length,
    medium:   events.filter(e => e.severity === "medium").length,
    low:      events.filter(e => e.severity === "low").length,
  };

  return (
    <div className="p-6 space-y-3">
      <div>
        <h1 className="text-lg font-bold text-foreground">Security Events</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{total} total events across {SCANNERS.length} scanner classes</p>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as Severity[]).map(sev => (
          <div key={sev} data-testid={`security-count-${sev}`} className="bg-card border border-card-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{sev}</div>
            <div className="text-2xl font-bold font-mono text-foreground">{counts[sev]}</div>
            <div className="mt-1"><SeverityBadge severity={sev} /></div>
          </div>
        ))}
      </div>

      {/* All 5 scanner sections */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {SCANNERS.map(({ key, label }) => (
            <ScannerSection key={key} label={label} events={byScanner[key] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
