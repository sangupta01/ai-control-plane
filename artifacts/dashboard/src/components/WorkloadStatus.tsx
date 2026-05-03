import { useEffect, useState, useCallback } from "react";
import { Play, Square, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Profile =
  | "coding_assistant"
  | "incident_debugging"
  | "customer_support"
  | "security_analyst"
  | "mixed_enterprise";

interface WorkloadStatusData {
  running: boolean;
  profile: Profile;
  rpm: number;
  attack_rate: number;
  started_at: string | null;
  elapsed_seconds: number | null;
  total_sent: number;
  total_blocked: number;
  total_flagged: number;
  total_errors: number;
  actual_rpm: number;
  block_rate: number;
}

const PROFILE_LABELS: Record<Profile, string> = {
  coding_assistant:   "Coding",
  incident_debugging: "Incident",
  customer_support:   "Support",
  security_analyst:   "Security",
  mixed_enterprise:   "Enterprise",
};

const PROFILE_OPTIONS: { value: Profile; label: string }[] = [
  { value: "coding_assistant",   label: "Coding Assistant" },
  { value: "incident_debugging", label: "Incident Debugging" },
  { value: "customer_support",   label: "Customer Support" },
  { value: "security_analyst",   label: "Security Analyst" },
  { value: "mixed_enterprise",   label: "Mixed Enterprise" },
];

function fmtElapsed(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

export function WorkloadStatus() {
  const [status, setStatus] = useState<WorkloadStatusData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<Profile>("mixed_enterprise");
  const [rpm, setRpm] = useState(10);
  const [attackRate, setAttackRate] = useState(10);
  const [starting, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/workload/status");
      if (res.ok) {
        const data = await res.json() as WorkloadStatusData;
        setStatus(data);
      }
    } catch {
      // silently ignore network errors — API may not be ready
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleStart = async () => {
    setStopping(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/workload/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, rpm, attack_rate: attackRate / 100 }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to start");
      } else {
        setExpanded(false);
        await fetchStatus();
      }
    } catch {
      setError("Network error");
    } finally {
      setStopping(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await fetch("/api/v1/workload/stop", { method: "POST" });
      await new Promise(r => setTimeout(r, 600));
      await fetchStatus();
    } finally {
      setStopping(false);
    }
  };

  const running = status?.running ?? false;

  return (
    <div className="border-t border-sidebar-border">
      {/* Status bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={cn(
          "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors",
          running
            ? "hover:bg-green-950/30"
            : "hover:bg-sidebar-accent"
        )}
      >
        {running ? (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        ) : (
          <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {running && status ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">LIVE</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {PROFILE_LABELS[status.profile]}
              </span>
              <span className="text-[10px] text-foreground font-mono">
                {status.actual_rpm} rpm
              </span>
              <span className="text-[10px] text-red-400 font-mono">
                {status.block_rate}% blk
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">Workload: idle</span>
          )}
        </div>

        {expanded
          ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {running && status ? (
            <>
              {/* Live stats grid */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {[
                  ["Profile",  PROFILE_LABELS[status.profile]],
                  ["Target",   `${status.rpm} rpm`],
                  ["Actual",   `${status.actual_rpm} rpm`],
                  ["Elapsed",  fmtElapsed(status.elapsed_seconds)],
                  ["Sent",     String(status.total_sent)],
                  ["Blocked",  `${status.total_blocked} (${status.block_rate}%)`],
                  ["Flagged",  String(status.total_flagged)],
                  ["Attacks",  `${(status.attack_rate * 100).toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground font-mono">{v}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleStop}
                disabled={starting}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800/50 transition-colors disabled:opacity-50"
              >
                <Square className="w-3 h-3" />
                Stop Workload
              </button>
            </>
          ) : (
            <>
              {/* Start form */}
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] text-muted-foreground">Profile</label>
                  <select
                    value={profile}
                    onChange={e => setProfile(e.target.value as Profile)}
                    className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground"
                  >
                    {PROFILE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-muted-foreground">RPM (1–60)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={rpm}
                      onChange={e => setRpm(Math.min(60, Math.max(1, Number(e.target.value))))}
                      className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Attack % (0–50)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={attackRate}
                      onChange={e => setAttackRate(Math.min(50, Math.max(0, Number(e.target.value))))}
                      className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-[10px] text-red-400">{error}</p>
                )}

                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-800/50 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  Start Stream
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
