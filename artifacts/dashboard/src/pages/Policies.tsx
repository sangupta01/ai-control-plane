import { useGetPolicies, getGetPoliciesQueryKey } from "@workspace/api-client-react";
import { Shield, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SCANNER_COLORS: Record<string, string> = {
  pii: "hsl(280,80%,60%)",
  secrets: "hsl(0,72%,51%)",
  prompt_injection: "hsl(38,92%,50%)",
  jailbreak: "hsl(0,72%,51%)",
  data_exfiltration: "hsl(199,89%,48%)",
};

const ACTION_BADGE: Record<string, string> = {
  block: "bg-red-500/15 text-red-400 border-red-500/25",
  flag: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  allow: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  redact: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/25",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

export default function Policies() {
  const { data, isLoading } = useGetPolicies({
    query: { refetchInterval: 30000, queryKey: getGetPoliciesQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const scannerGroups = data.rules.reduce<Record<string, typeof data.rules>>((acc, rule) => {
    const key = rule.scanner;
    acc[key] = acc[key] ?? [];
    acc[key].push(rule);
    return acc;
  }, {});

  const enabledCount = data.rules.filter(r => r.enabled).length;
  const blockCount = data.rules.filter(r => r.action === "block" && r.enabled).length;
  const flagCount = data.rules.filter(r => r.action === "flag" && r.enabled).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Policy-as-Code</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {data.policy_set} — {data.description}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Version</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{data.version}</div>
          <div className="text-xs text-muted-foreground mt-1">policy set: {data.policy_set}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active Rules</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">{enabledCount}</div>
          <div className="text-xs text-muted-foreground mt-1">of {data.total} total</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Block Rules</div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">{blockCount}</div>
          <div className="text-xs text-muted-foreground mt-1">hard enforcement</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Flag Rules</div>
          <div className="text-2xl font-bold font-mono text-yellow-400 mt-1">{flagCount}</div>
          <div className="text-xs text-muted-foreground mt-1">soft enforcement</div>
        </div>
      </div>

      {/* Rules grouped by scanner */}
      <div className="space-y-4">
        {Object.entries(scannerGroups).map(([scanner, rules]) => (
          <div key={scanner} className="bg-card border border-card-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: SCANNER_COLORS[scanner] ?? "hsl(215,20%,50%)" }}
              />
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground font-mono">{scanner}</span>
              <span className="text-xs text-muted-foreground">{rules.length} rules</span>
            </div>
            <div className="divide-y divide-border/30">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-4 shrink-0">
                    {rule.enabled
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-foreground">{rule.id}</span>
                      {rule.pattern_name && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                          {rule.pattern_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {rule.severity && (
                      <Badge className={`${SEVERITY_BADGE[rule.severity] ?? ""} text-[10px] px-1.5 py-0 border`}>
                        {rule.severity}
                      </Badge>
                    )}
                    <Badge className={`${ACTION_BADGE[rule.action] ?? ""} text-[10px] px-1.5 py-0 border uppercase font-mono`}>
                      {rule.action}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Policies are loaded from <code className="font-mono">config/policies.yaml</code> at startup. Reload the server to pick up changes.</span>
      </div>
    </div>
  );
}
