import { $ } from "bun";

const BASE_URL = process.env.API_URL ?? "http://localhost:80/api";

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}: ${await res.text()}`);
  }
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }

function statusColor(status: string) {
  if (status === "passed") return green(status);
  if (status === "blocked") return yellow(status);
  return red(status);
}

async function main() {
  console.log(bold(cyan("\n╔══════════════════════════════════════════════════╗")));
  console.log(bold(cyan("║   AI Control Plane — Demo Runner                ║")));
  console.log(bold(cyan("╚══════════════════════════════════════════════════╝\n")));

  // Health check
  console.log(dim("Checking API health..."));
  const health = await apiGet("/healthz") as { status: string; uptime: number; version: string };
  console.log(green(`✓ API healthy — v${health.version}, uptime ${health.uptime.toFixed(1)}s\n`));

  // Run all demo scenarios
  console.log(bold("Running all demo scenarios...\n"));
  const startMs = Date.now();

  const result = await apiPost("/v1/demo/run", {}) as {
    results: Array<{
      scenario: string;
      status: string;
      trace_id: string | null;
      description: string;
      details: Record<string, unknown>;
    }>;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
  };

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);

  for (const r of result.results) {
    const icon = r.status === "passed" ? "✓" : r.status === "blocked" ? "⚡" : "✗";
    const iconColored = r.status === "passed" ? green(icon) : r.status === "blocked" ? yellow(icon) : red(icon);
    console.log(`${iconColored} ${bold(r.scenario.padEnd(25))} [${statusColor(r.status)}]`);
    console.log(`  ${dim(r.description)}`);

    const d = r.details as {
      model_used?: string;
      blocked?: boolean;
      block_reason?: string;
      cost?: number;
      latency_ms?: number;
      tokens?: number;
      session_affinity_hit?: boolean;
      security_findings?: number;
      eval_overall?: number;
      routing_reason?: string;
    };

    if (r.trace_id) {
      console.log(`  trace=${dim(r.trace_id.substring(0, 16))}...`);
    }
    if (d.model_used) {
      console.log(`  model=${cyan(d.model_used)} | latency=${d.latency_ms?.toFixed(0)}ms | tokens=${d.tokens} | cost=$${d.cost?.toFixed(6)}`);
    }
    if (d.routing_reason) {
      console.log(`  routing: ${dim(d.routing_reason)}`);
    }
    if (d.block_reason) {
      console.log(`  blocked: ${red(d.block_reason)}`);
    }
    if (d.eval_overall !== undefined) {
      const score = d.eval_overall;
      const scoreColor = score > 0.8 ? green : score > 0.5 ? yellow : red;
      console.log(`  eval_score=${scoreColor(score.toFixed(3))} | affinity_hit=${d.session_affinity_hit ? green("yes") : dim("no")} | security_findings=${d.security_findings ?? 0}`);
    }
    console.log();
  }

  // Summary
  console.log(bold(cyan("─────────────────────────────────────────────────")));
  console.log(bold(`Results: ${green(String(result.passed))} passed  ${yellow(String(result.blocked))} blocked  ${red(String(result.failed))} failed  (${elapsed}s)`));
  console.log(bold(cyan("─────────────────────────────────────────────────\n")));

  // Show metrics
  console.log(bold("Platform Metrics After Demo:\n"));
  const metrics = await apiGet("/v1/metrics/summary") as {
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_latency_ms: number;
    blocked_requests: number;
    security_events_count: number;
    avg_eval_score: number;
    session_affinity_rate: number;
    requests_per_model: Record<string, number>;
  };

  console.log(`  Total Requests:      ${cyan(String(metrics.total_requests))}`);
  console.log(`  Total Tokens:        ${cyan(String(metrics.total_tokens))}`);
  console.log(`  Total Cost:          ${cyan("$" + metrics.total_cost.toFixed(6))}`);
  console.log(`  Avg Latency:         ${cyan(metrics.avg_latency_ms.toFixed(1) + "ms")}`);
  console.log(`  Blocked Requests:    ${yellow(String(metrics.blocked_requests))}`);
  console.log(`  Security Events:     ${yellow(String(metrics.security_events_count))}`);
  console.log(`  Avg Eval Score:      ${cyan(metrics.avg_eval_score.toFixed(3))}`);
  console.log(`  Session Affinity:    ${cyan((metrics.session_affinity_rate * 100).toFixed(1) + "%")}`);
  console.log(`\n  Requests per model:`);
  for (const [model, count] of Object.entries(metrics.requests_per_model)) {
    console.log(`    ${model.padEnd(25)} ${cyan(String(count))}`);
  }
  console.log();

  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(red("\nDemo failed: " + String(err)));
  process.exit(1);
});
