/**
 * AI Incident Replay Tests
 * Run: API_URL=http://localhost:80/api npx tsx scripts/src/test_replay.ts
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

async function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, body: await res.json() };
}

console.log("═".repeat(50));
console.log("  AI Incident Replay Tests");
console.log("═".repeat(50));

// Seed a trace to replay
const seedResp = await post("/v1/chat", {
  messages: [{ role: "user", content: "Explain how a neural network learns." }],
  model: "mock-gpt-4",
  tenant_id: "replay-test",
  session_id: "replay-seed-session",
});
const seedBody = seedResp.body as { trace_id: string };
const originalTraceId = seedBody.trace_id;
console.log(`\n  Seed trace_id: ${originalTraceId.substring(0, 16)}...\n`);

await test("Replay endpoint returns 200", async () => {
  const { status } = await post(`/v1/traces/${originalTraceId}/replay`, {});
  assert(status === 200, `expected 200, got ${status}`);
});

await test("Replay returns original_trace, replay_trace and diff", async () => {
  const { body } = await post(`/v1/traces/${originalTraceId}/replay`, {});
  const b = body as Record<string, unknown>;
  assert(typeof b.original_trace === "object" && b.original_trace !== null, "missing original_trace");
  assert(typeof b.replay_trace === "object" && b.replay_trace !== null, "missing replay_trace");
  assert(typeof b.diff === "object" && b.diff !== null, "missing diff");
});

await test("Replay creates a new trace in storage", async () => {
  const { body: replayBody } = await post(`/v1/traces/${originalTraceId}/replay`, {});
  const rb = replayBody as { replay_trace: { id: string } };
  const newTraceId = rb.replay_trace.id;
  assert(newTraceId !== originalTraceId, "replay trace id should differ from original");

  const { status, body: fetchedBody } = await get(`/v1/traces/${newTraceId}`);
  assert(status === 200, `new trace should be fetchable, got ${status}`);
  const fetched = fetchedBody as { id: string };
  assert(fetched.id === newTraceId, "fetched trace id should match replay trace id");
});

await test("Replay trace links back to original via replay_of_trace_id", async () => {
  const { body: replayBody } = await post(`/v1/traces/${originalTraceId}/replay`, {});
  const rb = replayBody as { replay_trace: { replay_of_trace_id: string; is_replay: boolean } };
  assert(rb.replay_trace.replay_of_trace_id === originalTraceId,
    `expected replay_of_trace_id=${originalTraceId}, got ${rb.replay_trace.replay_of_trace_id}`);
  assert(rb.replay_trace.is_replay === true, "is_replay should be true on replay trace");
});

await test("Replay diff has all required fields", async () => {
  const { body: replayBody } = await post(`/v1/traces/${originalTraceId}/replay`, {});
  const rb = replayBody as { diff: Record<string, unknown> };
  const diff = rb.diff;
  assert(typeof diff.response_changed === "boolean", "diff missing response_changed");
  assert(typeof diff.model_changed === "boolean", "diff missing model_changed");
  assert(typeof diff.routing_changed === "boolean", "diff missing routing_changed");
  assert(typeof diff.eval_diff === "object" && diff.eval_diff !== null, "diff missing eval_diff");
  const ed = diff.eval_diff as Record<string, unknown>;
  assert(typeof ed.relevance === "number", "eval_diff missing relevance");
  assert(typeof ed.safety === "number", "eval_diff missing safety");
  assert(typeof ed.hallucination === "number", "eval_diff missing hallucination");
  assert(typeof ed.groundedness === "number", "eval_diff missing groundedness");
});

await test("Replay with override_model uses specified model", async () => {
  const { body: replayBody } = await post(`/v1/traces/${originalTraceId}/replay`, {
    override_model: "mock-claude-3-haiku",
  });
  const rb = replayBody as { replay_trace: { model: string }; diff: { model_changed: boolean } };
  assert(rb.replay_trace.model === "mock-claude-3-haiku",
    `expected model mock-claude-3-haiku, got ${rb.replay_trace.model}`);
  assert(rb.diff.model_changed === true, "model_changed should be true when override_model differs");
});

await test("Replay of nonexistent trace returns 404", async () => {
  const { status } = await post("/v1/traces/nonexistent-id-00000/replay", {});
  assert(status === 404, `expected 404, got ${status}`);
});

console.log("\n" + "─".repeat(50));
console.log(`\n  Results: ${passed} passed  ${failed} failed  / ${passed + failed} total`);

if (failed > 0) process.exit(1);
