import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Activity,
  Shield,
  Users,
  BarChart3,
  PlayCircle,
  Cpu,
  FileCode2,
  DollarSign,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkloadStatus } from "./WorkloadStatus";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/traces", label: "Traces", icon: Activity },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/sessions", label: "Sessions", icon: Users },
  { href: "/evals", label: "Evaluations", icon: BarChart3 },
  { href: "/demo", label: "Demo Runner", icon: PlayCircle },
  { href: "/policies", label: "Policies", icon: FileCode2 },
  { href: "/cost", label: "Cost Insights", icon: DollarSign },
  { href: "/redteam", label: "Red Team", icon: Target },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight leading-none">
            AI Control Plane
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Live workload status widget */}
        <WorkloadStatus />

        {/* Footer */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="text-[10px] text-muted-foreground font-mono">v1.2.0 — mock providers</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
