/**
 * Feature Expansion Tests
 * Tests for: Policy-as-Code, Cost Optimization Insights, Red Team Mode
 * Run: API_URL=http://localhost:80/api npx tsx scripts/src/test_features.ts
 */

const BASE_URL = process.env.API_URL ?? "http://localhost:80/api";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`);
  const body = await res.json();
  return body;
}

async function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ─── Seed some data first ───────────────────────────────────────────────────

async function seedData(): Promise<void> {
  await post("/v1/chat", {
    messages: [{ role: "user", content: "What is machine learning?" }],
    model: "mock-gpt-4",
    session_id: "feature-test-session-1",
    tenant_id: "feature-tenant-a",
  });
  await post("/v1/chat", {
    messages: [{ role: "user", content: "Explain neural networks." }],
    model: "mock-claude-3-opus",
    session_id: "feature-test-session-2",
    tenant_id: "feature-tenant-b",
  });
}

// ─── Policy-as-Code Tests ────────────────────────────────────────────────────

async function runPolicyTests(): Promise<void> {
  console.log("\n  Policy-as-Code");
  console.log("  " + "─".repeat(44));

  await test("GET /v1/policies returns 200 with correct shape", async () => {
    const data = await get("/v1/policies") as Record<string, unknown>;
    assert(typeof data === "object" && data !== null, "should be object");
    assert(typeof data.version === "string", "should have version");
    assert(typeof data.policy_set === "string", "should have policy_set");
    assert(typeof data.description === "string", "should have description");
    assert(Array.isArray(data.rules), "should have rules array");
    assert(typeof data.total === "number", "should have total count");
    assert(typeof data.enabled === "number", "should have enabled count");
  });

  await test("Policies list has expected rule count (>= 15)", async () => {
    const data = await get("/v1/policies") as { total: number; enabled: number };
    assert(data.total >= 15, `expected >= 15 rules, got ${data.total}`);
    assert(data.enabled >= 15, `expected >= 15 enabled, got ${data.enabled}`);
  });

  await test("Each policy rule has required fields", async () => {
    const data = await get("/v1/policies") as { rules: Record<string, unknown>[] };
    for (const rule of data.rules) {
      assert(typeof rule.id === "string" && rule.id.length > 0, `rule missing id: ${JSON.stringify(rule)}`);
      assert(typeof rule.scanner === "string", `rule missing scanner: ${rule.id}`);
      assert(typeof rule.action === "string", `rule missing action: ${rule.id}`);
      assert(["allow", "flag", "block", "redact"].includes(rule.action as string), `invalid action: ${rule.action}`);
      assert(typeof rule.enabled === "boolean", `rule missing enabled: ${rule.id}`);
    }
  });

  await test("Policies grouped by expected scanners", async () => {
    const data = await get("/v1/policies") as { rules: { scanner: string }[] };
    const scanners = new Set(data.rules.map(r => r.scanner));
    assert(scanners.has("pii"), "missing pii scanner rules");
    assert(scanners.has("secrets"), "missing secrets scanner rules");
    assert(scanners.has("prompt_injection"), "missing prompt_injection scanner rules");
    assert(scanners.has("jailbreak"), "missing jailbreak scanner rules");
    assert(scanners.has("data_exfiltration"), "missing data_exfiltration scanner rules");
  });

  await test("POST /v1/policies/reload returns success", async () => {
    const { status, body } = await post("/v1/policies/reload", {});
    assert(status === 200, `expected 200, got ${status}`);
    const b = body as Record<string, unknown>;
    assert(b.success === true, "should have success:true");
    assert(typeof b.total === "number", "should have total");
  });

  await test("Block rule exists for SSN (critical PII)", async () => {
    const data = await get("/v1/policies") as { rules: { scanner: string; action: string; severity?: string }[] };
    const ssnRule = data.rules.find(r =>
      r.scanner === "pii" && r.action === "block" && r.severity === "critical"
    );
    assert(ssnRule !== undefined, "should have a block rule for critical PII");
  });

  await test("Policy engine blocks SSN (end-to-end policy enforcement)", async () => {
    const { body } = await post("/v1/chat", {
      messages: [{ role: "user", content: "My SSN is 123-45-6789. Help me file taxes." }],
      model: "mock-gpt-4",
      tenant_id: "policy-test",
    });
    const b = body as { blocked: boolean };
    assert(b.blocked === true, "SSN should be blocked by policy");
  });

  await test("Policy engine allows low-severity IP address finding", async () => {
    const { body } = await post("/v1/chat", {
      messages: [{ role: "user", content: "What is the server at 192.168.1.1 used for?" }],
      model: "mock-gpt-4",
      tenant_id: "policy-test",
    });
    const b = body as { blocked: boolean };
    assert(b.blocked === false, "IP address should be allowed by policy (low severity)");
  });
}

// ─── Cost Optimization Insights Tests ───────────────────────────────────────

async function runCostTests(): Promise<void> {
  console.log("\n  Cost Optimization Insights");
  console.log("  " + "─".repeat(44));

  await test("GET /v1/cost/insights returns 200 with correct shape", async () => {
    const data = await get("/v1/cost/insights") as Record<string, unknown>;
    assert(typeof data === "object" && data !== null, "should be object");
    assert(Array.isArray(data.top_sessions), "should have top_sessions");
    assert(Array.isArray(data.top_tenants), "should have top_tenants");
    assert(Array.isArray(data.top_prompts), "should have top_prompts");
    assert(typeof data.model_switch_count === "number", "should have model_switch_count");
    assert(typeof data.estimated_cache_preserved === "number", "should have estimated_cache_preserved");
    assert(typeof data.estimated_cache_miss_cost === "number", "should have estimated_cache_miss_cost");
    assert(typeof data.total_wasted_cost === "number", "should have total_wasted_cost");
    assert(Array.isArray(data.suggested_optimizations), "should have suggested_optimizations");
    assert(typeof data.generated_at === "string", "should have generated_at");
  });

  await test("Top sessions have required fields", async () => {
    const data = await get("/v1/cost/insights") as { top_sessions: Record<string, unknown>[] };
    for (const s of data.top_sessions) {
      assert(typeof s.session_id === "string", "session should have session_id");
      assert(typeof s.tenant_id === "string", "session should have tenant_id");
      assert(typeof s.total_cost === "number", "session should have total_cost");
      assert(typeof s.total_tokens === "number", "session should have total_tokens");
      assert(typeof s.request_count === "number", "session should have request_count");
    }
  });

  await test("Top tenants have required fields", async () => {
    const data = await get("/v1/cost/insights") as { top_tenants: Record<string, unknown>[] };
    for (const t of data.top_tenants) {
      assert(typeof t.tenant_id === "string", "tenant should have tenant_id");
      assert(typeof t.total_cost === "number", "tenant should have total_cost");
      assert(typeof t.avg_cost_per_request === "number", "tenant should have avg_cost_per_request");
    }
  });

  await test("Top prompts have required fields and excerpt", async () => {
    const data = await get("/v1/cost/insights") as { top_prompts: Record<string, unknown>[] };
    for (const p of data.top_prompts) {
      assert(typeof p.trace_id === "string", "prompt should have trace_id");
      assert(typeof p.prompt_excerpt === "string", "prompt should have prompt_excerpt");
      assert((p.prompt_excerpt as string).length <= 125, "excerpt should be truncated");
      assert(typeof p.cost === "number", "prompt should have cost");
      assert(typeof p.model === "string", "prompt should have model");
    }
  });

  await test("Routing optimizations have required fields", async () => {
    const data = await get("/v1/cost/insights") as { suggested_optimizations: Record<string, unknown>[] };
    for (const opt of data.suggested_optimizations) {
      assert(typeof opt.current_model === "string", "opt should have current_model");
      assert(typeof opt.suggested_model === "string", "opt should have suggested_model");
      assert(typeof opt.potential_savings_pct === "number", "opt should have potential_savings_pct");
      assert(opt.potential_savings_pct >= 0 && (opt.potential_savings_pct as number) <= 100, "savings must be 0-100");
      assert(typeof opt.reason === "string", "opt should have reason");
    }
  });

  await test("generated_at is a valid ISO timestamp", async () => {
    const data = await get("/v1/cost/insights") as { generated_at: string };
    const ts = new Date(data.generated_at).getTime();
    assert(!isNaN(ts), "generated_at should be valid ISO date");
    assert(ts > Date.now() - 60000, "generated_at should be recent (within 60s)");
  });
}

// ─── Red Team Tests ──────────────────────────────────────────────────────────

async function runRedTeamTests(): Promise<void> {
  console.log("\n  Red Team Mode");
  console.log("  " + "─".repeat(44));

  await test("GET /v1/redteam/scenarios returns all scenarios", async () => {
    const data = await get("/v1/redteam/scenarios") as { scenarios: unknown[]; total: number };
    assert(Array.isArray(data.scenarios), "should have scenarios array");
    assert(data.total >= 8, `expected >= 8 scenarios, got ${data.total}`);
    assert(data.scenarios.length === data.total, "count should match array length");
  });

  await test("Each scenario has required fields", async () => {
    const data = await get("/v1/redteam/scenarios") as { scenarios: Record<string, unknown>[] };
    for (const s of data.scenarios) {
      assert(typeof s.id === "string" && s.id.length > 0, "scenario missing id");
      assert(typeof s.name === "string", "scenario missing name");
      assert(typeof s.category === "string", "scenario missing category");
      assert(typeof s.description === "string", "scenario missing description");
      assert(typeof s.attack_prompt === "string" && s.attack_prompt.length > 0, "scenario missing attack_prompt");
      assert(typeof s.expected_blocked === "boolean", "scenario missing expected_blocked");
    }
  });

  await test("Scenarios cover all required attack categories", async () => {
    const data = await get("/v1/redteam/scenarios") as { scenarios: { category: string }[] };
    const cats = new Set(data.scenarios.map(s => s.category));
    assert(cats.has("prompt_injection"), "missing prompt_injection category");
    assert(cats.has("jailbreak"), "missing jailbreak category");
    assert(cats.has("secret_leak"), "missing secret_leak category");
    assert(cats.has("pii"), "missing pii category");
    assert(cats.has("data_exfiltration"), "missing data_exfiltration category");
    assert(cats.has("baseline"), "missing baseline category");
  });

  await test("POST /v1/redteam/run returns valid run structure", async () => {
    const { status, body } = await post("/v1/redteam/run", {});
    assert(status === 200, `expected 200, got ${status}`);
    const b = body as Record<string, unknown>;
    assert(typeof b.run_id === "string" && (b.run_id as string).length > 0, "should have run_id");
    assert(typeof b.total === "number" && (b.total as number) > 0, "should have total > 0");
    assert(typeof b.passed === "number", "should have passed count");
    assert(typeof b.failed === "number", "should have failed count");
    assert(typeof b.errors === "number", "should have errors count");
    assert(typeof b.pass_rate === "number", "should have pass_rate");
    assert(Array.isArray(b.results), "should have results array");
    assert(typeof b.created_at === "string", "should have created_at");
  });

  await test("Red team run blocks all adversarial scenarios", async () => {
    const { body } = await post("/v1/redteam/run", {});
    const b = body as { results: { scenario_name: string; status: string; expected_blocked: boolean; actual_blocked: boolean; correct: boolean }[] };
    const adversarial = b.results.filter(r => r.expected_blocked);
    assert(adversarial.length > 0, "should have adversarial scenarios");
    const allBlocked = adversarial.every(r => r.actual_blocked);
    assert(allBlocked, `some adversarial scenarios were NOT blocked: ${adversarial.filter(r => !r.actual_blocked).map(r => r.scenario_name).join(", ")}`);
  });

  await test("Red team run passes all baseline (benign) scenarios", async () => {
    const { body } = await post("/v1/redteam/run", {});
    const b = body as { results: { scenario_name: string; expected_blocked: boolean; actual_blocked: boolean }[] };
    const benign = b.results.filter(r => !r.expected_blocked);
    assert(benign.length > 0, "should have benign (baseline) scenarios");
    const allPassed = benign.every(r => !r.actual_blocked);
    assert(allPassed, `some benign scenarios were incorrectly blocked: ${benign.filter(r => r.actual_blocked).map(r => r.scenario_name).join(", ")}`);
  });

  await test("Red team result has correct per-scenario fields", async () => {
    const { body } = await post("/v1/redteam/run", {});
    const b = body as { results: Record<string, unknown>[] };
    for (const r of b.results) {
      assert(typeof r.id === "string", "result missing id");
      assert(typeof r.run_id === "string", "result missing run_id");
      assert(typeof r.scenario_id === "string", "result missing scenario_id");
      assert(typeof r.scenario_name === "string", "result missing scenario_name");
      assert(typeof r.category === "string", "result missing category");
      assert(["passed", "failed", "error"].includes(r.status as string), `invalid status: ${r.status}`);
      assert(typeof r.expected_blocked === "boolean", "result missing expected_blocked");
      assert(typeof r.actual_blocked === "boolean", "result missing actual_blocked");
      assert(typeof r.correct === "boolean", "result missing correct");
      assert(typeof r.security_findings === "number", "result missing security_findings");
      assert(typeof r.latency_ms === "number", "result missing latency_ms");
    }
  });

  await test("Red team partial run — single scenario by name", async () => {
    const { status, body } = await post("/v1/redteam/run", { scenarios: ["direct_injection"] });
    assert(status === 200, `expected 200, got ${status}`);
    const b = body as { total: number; results: { scenario_name: string }[] };
    assert(b.total === 1, `expected 1 result, got ${b.total}`);
    assert(b.results[0].scenario_name === "direct_injection", "should run the requested scenario");
  });

  await test("GET /v1/redteam/history returns persisted runs", async () => {
    const data = await get("/v1/redteam/history") as { runs: unknown[]; total: number };
    assert(Array.isArray(data.runs), "should have runs array");
    assert(typeof data.total === "number", "should have total");
    assert(data.total > 0, "should have at least 1 run from prior tests");
  });

  await test("Red team overall pass rate is 100% (all scenarios correct)", async () => {
    const { body } = await post("/v1/redteam/run", {});
    const b = body as { pass_rate: number; failed: number; results: { scenario_name: string; correct: boolean }[] };
    const incorrectScenarios = b.results.filter(r => !r.correct).map(r => r.scenario_name);
    assert(b.pass_rate === 1.0, `Expected 100% pass rate, got ${(b.pass_rate * 100).toFixed(0)}%. Incorrect: ${incorrectScenarios.join(", ")}`);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("═".repeat(50));
console.log("  Feature Expansion Tests");
console.log("  Policy-as-Code | Cost Insights | Red Team");
console.log("═".repeat(50));

await seedData();
await runPolicyTests();
await runCostTests();
await runRedTeamTests();

console.log("\n" + "─".repeat(50));
console.log(`\n  Results: ${passed} passed  ${failed} failed  / ${passed + failed} total`);

if (failed > 0) {
  process.exit(1);
}
