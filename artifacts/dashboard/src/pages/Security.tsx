import { useGetSecurityEvents, getGetSecurityEventsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, AlertCircle, Info } from "lucide-react";

type Severity = "critical" | "high" | "medium" | "low";
type Action = "block" | "flag" | "allow";

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/25",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    low: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  const icons: Record<Severity, React.ElementType> = {
    critical: AlertCircle,
    high: AlertTriangle,
    medium: AlertTriangle,
    low: Info,
  };
  const Icon = icons[severity] ?? Info;
  return (
    <Badge className={`${styles[severity] ?? ""} text-[10px] px-1.5 py-0.5 gap-1 font-medium uppercase`}>
      <Icon className="w-2.5 h-2.5" />
      {severity}
    </Badge>
  );
}

function ActionBadge({ action }: { action: Action }) {
  const styles: Record<Action, string> = {
    block: "bg-red-500/15 text-red-400 border-red-500/25",
    flag: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    allow: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  };
  return (
    <Badge className={`${styles[action] ?? ""} text-[10px] px-1.5 py-0.5 font-medium uppercase`}>
      {action}
    </Badge>
  );
}

const SCANNER_LABELS: Record<string, string> = {
  pii: "PII Detection",
  secrets: "Secret Detection",
  prompt_injection: "Prompt Injection",
  jailbreak: "Jailbreak Detection",
  data_exfiltration: "Data Exfiltration",
};

export default function Security() {
  const { data, isLoading } = useGetSecurityEvents(
    { limit: 100 },
    { query: { refetchInterval: 15000, queryKey: getGetSecurityEventsQueryKey({ limit: 100 }) } },
  );

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  const byScanner: Record<string, typeof events> = {};
  for (const ev of events) {
    if (!byScanner[ev.scanner]) byScanner[ev.scanner] = [];
    byScanner[ev.scanner]!.push(ev);
  }

  const counts = {
    critical: events.filter(e => e.severity === "critical").length,
    high: events.filter(e => e.severity === "high").length,
    medium: events.filter(e => e.severity === "medium").length,
    low: events.filter(e => e.severity === "low").length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Security Events</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} total events detected</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as Severity[]).map(sev => (
          <div key={sev} data-testid={`security-count-${sev}`} className="bg-card border border-card-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{sev}</div>
            <div className="text-2xl font-bold font-mono text-foreground">{counts[sev]}</div>
            <div className="mt-1"><SeverityBadge severity={sev} /></div>
          </div>
        ))}
      </div>

      {/* Events by scanner */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg p-10 flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground text-center">
            No security events yet. Run the demo to see injection attacks, PII, and secret detection in action.
          </div>
        </div>
      ) : (
        Object.entries(byScanner).map(([scanner, evs]) => (
          <div key={scanner} className="bg-card border border-card-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-muted/20">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-semibold text-foreground">{SCANNER_LABELS[scanner] ?? scanner}</span>
              <span className="ml-auto text-xs text-muted-foreground">{evs.length} events</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  {["Time", "Severity", "Action", "Reason", "Matched", "Prompt Excerpt"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evs.map(ev => (
                  <tr key={ev.id} data-testid={`row-security-${ev.id}`} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{ev.created_at.substring(11, 19)}</td>
                    <td className="px-3 py-2.5"><SeverityBadge severity={ev.severity as Severity} /></td>
                    <td className="px-3 py-2.5"><ActionBadge action={ev.action as Action} /></td>
                    <td className="px-3 py-2.5 text-foreground max-w-[200px] truncate" title={ev.reason}>{ev.reason}</td>
                    <td className="px-3 py-2.5 font-mono text-yellow-300 max-w-[120px] truncate">{ev.matched ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[180px] truncate">{ev.prompt_excerpt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
