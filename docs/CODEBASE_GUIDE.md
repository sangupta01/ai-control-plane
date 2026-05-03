# Codebase Guide — AI Control Plane

> **Audience:** Engineers picking up this codebase for the first time.  
> **Scope:** Where things live, how they connect, and exactly what to touch when you need to add something new.

---

## 1. Repo Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express backend — LLM gateway + observability API
│   │   ├── src/
│   │   │   ├── index.ts     # Process entry: binds Express to $PORT
│   │   │   ├── app.ts       # Express app: middleware, /api mount
│   │   │   ├── lib/
│   │   │   │   └── logger.ts        # Pino singleton logger
│   │   │   ├── modules/             # All business logic lives here
│   │   │   │   ├── gateway.ts       # Orchestrates every request end-to-end
│   │   │   │   ├── routing.ts       # Model selection + session affinity
│   │   │   │   ├── security.ts      # 5 scanners: PII / secrets / injection / jailbreak / exfil
│   │   │   │   ├── policies.ts      # Policy-as-Code: loads config/policies.yaml
│   │   │   │   ├── evaluation.ts    # Heuristic eval scoring (relevance, safety, etc.)
│   │   │   │   ├── providers.ts     # Mock LLM providers + MODEL_CATALOG
│   │   │   │   ├── storage.ts       # SQLite via better-sqlite3, all DB access
│   │   │   │   ├── cost-insights.ts # Cost analysis queries and optimization suggestions
│   │   │   │   └── redteam.ts       # Adversarial scenario runner
│   │   │   └── routes/
│   │   │       ├── index.ts         # Mounts all sub-routers onto the main Express Router
│   │   │       ├── health.ts        # GET /api/healthz
│   │   │       └── v1/
│   │   │           ├── chat.ts      # POST /api/v1/chat
│   │   │           ├── traces.ts    # GET  /api/v1/traces, GET /api/v1/traces/:id
│   │   │           ├── replay.ts    # POST /api/v1/traces/:id/replay
│   │   │           ├── metrics.ts   # GET  /api/v1/metrics/summary
│   │   │           ├── security.ts  # GET  /api/v1/security/events
│   │   │           ├── evals.ts     # GET  /api/v1/evals
│   │   │           ├── sessions.ts  # GET  /api/v1/sessions
│   │   │           ├── demo.ts      # POST /api/v1/demo/run
│   │   │           ├── policies.ts  # GET  /api/v1/policies, POST /api/v1/policies/reload
│   │   │           ├── cost.ts      # GET  /api/v1/cost/insights
│   │   │           └── redteam.ts   # GET/POST /api/v1/redteam/*
│   │   └── build.mjs                # esbuild config (bundles to dist/)
│   │
│   └── dashboard/           # React + Vite frontend
│       └── src/
│           ├── main.tsx             # React entry: createRoot → <App />
│           ├── App.tsx              # QueryClientProvider + WouterRouter + Layout
│           ├── components/
│           │   ├── Layout.tsx       # Sidebar nav + main scroll area
│           │   └── ui/              # shadcn/ui components
│           └── pages/
│               ├── Overview.tsx     # KPIs, charts, model/tenant breakdowns
│               ├── Traces.tsx       # Trace table, visual tags, Replay dialog
│               ├── Security.tsx     # Security events by scanner
│               ├── Sessions.tsx     # Session list, affinity rates
│               ├── Evals.tsx        # Evaluation score table
│               ├── Demo.tsx         # Demo runner, scenario cards
│               ├── Policies.tsx     # Policy rule viewer
│               ├── CostInsights.tsx # Cost optimization recommendations
│               └── RedTeam.tsx      # Adversarial test runner
│
├── lib/
│   ├── api-spec/
│   │   ├── openapi.yaml     # Single source of truth for the API contract
│   │   └── orval.config.ts  # Orval codegen config (React Query hooks + Zod schemas)
│   ├── api-client-react/
│   │   └── src/
│   │       ├── custom-fetch.ts      # Typed fetch wrapper (base URL, auth token, error classes)
│   │       ├── generated/api.ts     # Generated React Query hooks (useGetTraces, etc.)
│   │       └── generated/api.schemas.ts  # Generated TypeScript types
│   └── api-zod/
│       └── src/generated/api.ts     # Generated Zod validators
│
├── config/
│   └── policies.yaml        # Policy-as-Code rules (18 rules, hot-reloadable)
│
├── scripts/
│   └── src/
│       ├── test_suite.ts    # 22 baseline integration tests
│       ├── test_features.ts # 24 feature-expansion tests (policies, cost, red team)
│       ├── test_replay.ts   # 7 AI Incident Replay tests
│       └── run_demo.ts      # CLI demo runner
│
├── docs/                    # All project documentation
└── pnpm-workspace.yaml      # Workspace catalog + package discovery
```

---

## 2. Backend Entrypoint

```
artifacts/api-server/src/index.ts
```

Reads `$PORT` from env, calls `app.listen(port, ...)`. Throws if `PORT` is missing or invalid. The actual Express app is in `app.ts` — `index.ts` only handles process startup.

```
artifacts/api-server/src/app.ts
```

Sets up middleware in order:
1. `pino-http` — structured request logging  
2. `cors()` — allow all origins  
3. `express.json()` — JSON body parsing  
4. `app.use("/api", router)` — all routes under `/api`

---

## 3. Frontend Entrypoint

```
artifacts/dashboard/src/main.tsx
```

Standard React 18 entry: `createRoot(document.getElementById("root")).render(<App />)`.

```
artifacts/dashboard/src/App.tsx
```

Wraps everything in:
- `QueryClientProvider` (TanStack Query, stale-time 5 s, 1 retry)
- `TooltipProvider` (shadcn)
- `WouterRouter` (base = `import.meta.env.BASE_URL` stripped of trailing slash)
- `Layout` (sidebar) wrapping `<Switch>` with all page routes

Routing table:

| Path | Page |
|---|---|
| `/` | Overview |
| `/traces` | Traces |
| `/security` | Security |
| `/sessions` | Sessions |
| `/evals` | Evals |
| `/demo` | Demo Runner |
| `/policies` | Policies |
| `/cost` | Cost Insights |
| `/redteam` | Red Team |

---

## 4. Request Flow — POST /api/v1/chat

```
HTTP POST /api/v1/chat
        │
        ▼
routes/v1/chat.ts
  • Validates messages[] is present and non-empty → 400 if not
  • Calls processRequest(req)
        │
        ▼
modules/gateway.ts → processRequest()
  1. Generate traceId (uuid), resolve sessionId and tenantId
  2. Estimate prompt tokens (word-count × 1.3)
  3. runSecurityScan(messages)               ← modules/security.ts
     └─ applyPolicies(rawFindings)           ← modules/policies.ts
     • If blocked → insertTrace (blocked=1), insertSecurityEvent,
                    updateSession, return 200 with blocked:true
  4. routeRequest(ctx)                       ← modules/routing.ts
     • Returns selected_model, reason, session_affinity_hit, etc.
  5. callProvider({ model, messages })       ← modules/providers.ts
     • Simulates latency, picks mock response, counts tokens
  6. runOutputSecurityScan(response.content) ← modules/security.ts
  7. evaluate(prompt, response)              ← modules/evaluation.ts
  8. calculateCost(model, tokens)            ← modules/providers.ts
  9. insertTrace(traceData)                  ← modules/storage.ts
 10. insertEvalResult(evalScores)            ← modules/storage.ts
 11. insertSecurityEvent (for flag findings) ← modules/storage.ts
 12. updateSession(...)                      ← modules/storage.ts
        │
        ▼
  Returns GatewayResponse JSON to caller
```

Key invariant: **every request that reaches `processRequest` produces exactly one trace row**, whether blocked or not.

---

## 5. Where Routing Lives

```
artifacts/api-server/src/modules/routing.ts
```

**Function:** `routeRequest(ctx: RoutingContext): RoutingDecision`

Decision logic (in order):
1. If `requested_model` is not in `MODEL_CATALOG` → fall back to `mock-gpt-4`
2. If no existing session → use `requested_model` (no affinity yet)
3. If session's affinity model === `requested_model` → session affinity hit, stay on model
4. Compute `affinityCost` (staying) vs `switchCost` (switching, includes `$0.002` cache-miss penalty):
   - If `affinityCost ≤ switchCost × 1.5` → sticky routing, stay on affinity model
   - Otherwise → allow switch, increment `model_switches`

**Effective cost formula:**
```
effective_cost = (tokens / 1000) × cost_per_1k_input
              + (affinityHit ? 0 : 0.002)          // cache miss penalty
              + avg_latency_ms × 0.0000005          // latency penalty
```

---

## 6. Where Session Affinity Lives

Session state is stored in the `sessions` SQLite table. Two functions in `modules/storage.ts` manage it:

- `storage.getSession(id)` — read current affinity model, request count, affinity hits, switches
- `storage.upsertSession(data)` — write/update via `INSERT … ON CONFLICT DO UPDATE`

The `updateSession()` private function in `gateway.ts` is called at the end of every request (blocked or not) to keep session stats current.

The `sessions` table tracks:
- `model` — current affinity model
- `affinity_hits` — cumulative count of requests where sticky routing applied
- `model_switches` — cumulative model change count
- `last_active` — updated to `datetime('now')` on every upsert

---

## 7. Where Security Scanners Live

```
artifacts/api-server/src/modules/security.ts
```

**Two public functions:**
- `runSecurityScan(messages)` — scans user-role messages (pre-model call)
- `runOutputSecurityScan(responseText)` — scans model output (post-model call); findings are prefixed `output_*` in the merged result

**Five internal scanners** — all implemented as regex arrays in `scanText()`:

| Scanner id | Patterns file constant | What it catches |
|---|---|---|
| `pii` | `PII_PATTERNS` | SSN, credit card, email, phone, IP, date of birth |
| `secrets` | `SECRET_PATTERNS` | AWS keys, GitHub tokens, Bearer JWTs, OpenAI keys, PEM headers |
| `prompt_injection` | `INJECTION_PATTERNS` | "ignore previous instructions", role overrides, special tokens |
| `jailbreak` | `JAILBREAK_PATTERNS` | DAN mode, bypass safety, developer mode, illegal content requests |
| `data_exfiltration` | `DATA_EXFIL_PATTERNS` | bulk dump requests, SQL SELECT *, transmission commands |

**Default severity → action mapping** (before policy override):
- `critical` / `high` → `block`
- `medium` → `flag`
- `low` → `allow`

After scanner produces raw findings, `applyPolicies(findings)` from `policies.ts` is called — policy rules can override the default action per scanner+severity+pattern_name combination.

---

## 8. Where Policy-as-Code Lives

**Config file (edit this to change enforcement):**
```
config/policies.yaml
```

**Parser + engine:**
```
artifacts/api-server/src/modules/policies.ts
```

The module caches the loaded `PolicySet` in a module-level variable (`_policies`). To hot-reload without restarting the process, call `POST /api/v1/policies/reload` — this calls `reloadPolicies()` which nulls the cache and re-reads the file.

**Rule matching logic** (`applyPolicies`):
For each finding, find the first enabled rule where:
1. `rule.scanner === finding.scanner`
2. `rule.severity === finding.severity` (if rule specifies severity)
3. `rule.pattern_name` appears in `finding.reason` (case-insensitive, if rule specifies pattern_name)

If a matching rule is found, its `action` replaces the scanner's default action. The `redact` action is treated as `flag` at enforcement time (display-only concept).

**18 current rules cover:**
- PII: SSN → block, credit card → block, email → flag, phone → flag, IP → allow, DOB → block
- Secrets: AWS → block, GitHub → block, Bearer → block, generic API key → block, private key → block
- Injection: all patterns → block
- Jailbreak: all patterns → block
- Data exfiltration: all patterns → block/flag

---

## 9. Where Eval Scoring Lives

```
artifacts/api-server/src/modules/evaluation.ts
```

**Function:** `evaluate(prompt: string, response: string): EvalScores`

Five scores — all clamped to [0, 1], rounded to 3 decimal places, ±0.025 noise added:

| Score | Method | Higher = better? |
|---|---|---|
| `relevance` | Word overlap between prompt and response (≥4-char words) | Yes |
| `safety` | Penalty per safety-risk keyword match (violence, illegal, hate) | Yes |
| `hallucination_risk` | Density of uncertainty markers (I think, maybe, approximately) | **No** — lower is better |
| `groundedness` | Count of grounding phrases (according to, research shows, %) | Yes |
| `overall` | `relevance×0.35 + safety×0.30 + (1−hallucination_risk)×0.20 + groundedness×0.15` | Yes |

The `hallucination_risk` field is stored as a raw risk score (0 = no risk, 1 = high risk). The dashboard inverts it for display: `displayValue = 1 − hallucination_risk`.

---

## 10. Where Storage / Schema Lives

```
artifacts/api-server/src/modules/storage.ts
```

**Database file:** `control_plane.db` in the process working directory (configurable via `$DB_PATH`). WAL mode enabled, foreign keys on.

**Four tables:**

```sql
traces (
  id TEXT PRIMARY KEY,
  session_id TEXT, tenant_id TEXT, model TEXT,
  prompt TEXT, response TEXT,
  prompt_tokens INT, completion_tokens INT, total_tokens INT,
  cost REAL, latency_ms REAL,
  routing_decision TEXT,     -- JSON blob
  security_result TEXT,      -- JSON blob
  eval_scores TEXT,          -- JSON blob
  blocked INT DEFAULT 0,     -- 0 | 1
  block_reason TEXT,
  replay_of_trace_id TEXT,   -- NULL for originals; links to parent trace for replays
  is_replay INT DEFAULT 0,   -- 0 | 1
  created_at TEXT DEFAULT (datetime('now'))
)

security_events (
  id, trace_id, session_id, scanner, severity, action,
  reason, matched, prompt_excerpt, created_at
)

eval_results (
  id, trace_id, relevance, safety, hallucination_risk,
  groundedness, overall, created_at
)

sessions (
  id, tenant_id, model, request_count, total_tokens, total_cost,
  model_switches, affinity_hits, created_at, last_active
)
```

**Migrations:** Two additive `ALTER TABLE … ADD COLUMN` statements run at startup, wrapped in `try/catch` (no-op if column already exists). This is the pattern for all future schema additions — never drop or rename columns.

**All DB access** goes through the `storage` singleton object exported from `storage.ts`. No route or module ever imports `better-sqlite3` directly.

---

## 11. Where Dashboard Pages Live

```
artifacts/dashboard/src/pages/
```

| File | Route | Data hooks used |
|---|---|---|
| `Overview.tsx` | `/` | `useGetMetricsSummary` |
| `Traces.tsx` | `/traces` | `useGetTraces`, `useGetTrace`, raw `fetch` for replay |
| `Security.tsx` | `/security` | `useGetSecurityEvents` |
| `Sessions.tsx` | `/sessions` | `useGetSessions` |
| `Evals.tsx` | `/evals` | `useGetEvals` |
| `Demo.tsx` | `/demo` | `useRunDemo` |
| `Policies.tsx` | `/policies` | `useGetPolicies` |
| `CostInsights.tsx` | `/cost` | `useGetCostInsights` |
| `RedTeam.tsx` | `/redteam` | `useRunRedTeam`, `useGetRedTeamScenarios` |

All hooks are auto-generated by Orval from `lib/api-spec/openapi.yaml` and exported from `@workspace/api-client-react`. The Replay endpoint (`POST /api/v1/traces/:id/replay`) was added after the spec freeze and has no generated hook — `Traces.tsx` calls it directly via `useMutation` + `fetch("/api/v1/traces/:id/replay")`.

---

## 12. Where Tests Live

```
scripts/src/
```

All tests are plain TypeScript scripts using `fetch` against the running API server. They read `API_URL` from the environment (default: `http://localhost:80/api`).

| File | Count | Covers |
|---|---|---|
| `test_suite.ts` | 22 | Baseline: health, chat, security, routing, traces, metrics, sessions, demo, multi-tenant |
| `test_features.ts` | 24 | Feature expansion: policies, cost insights, red team |
| `test_replay.ts` | 7 | AI Incident Replay endpoint |
| **Total** | **53** | **All 53 pass** |

**Run all tests:**
```bash
API_URL=http://localhost:80/api npx tsx scripts/src/test_suite.ts
API_URL=http://localhost:80/api npx tsx scripts/src/test_features.ts
API_URL=http://localhost:80/api npx tsx scripts/src/test_replay.ts
```

No test framework is used — each script prints `✓ / ✗` per test and exits non-zero on any failure.

---

## 13. How to Add a New Scanner

**Step 1 — Add pattern array in `security.ts`:**

```typescript
// artifacts/api-server/src/modules/security.ts

const MY_NEW_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: Severity }> = [
  { pattern: /your-regex-here/i, reason: "Human-readable reason", severity: "high" },
];
```

**Step 2 — Add scanner call in `scanText()`:**

```typescript
// Inside scanText() in security.ts
for (const p of MY_NEW_PATTERNS) {
  const match = p.pattern.exec(text);
  if (match) {
    findings.push({
      scanner: "my_scanner",          // must be a unique string
      severity: p.severity,
      action: getActionForSeverity(p.severity),
      reason: p.reason,
      matched: match[0].substring(0, 80),
    });
  }
}
```

**Step 3 — Add policy rules in `config/policies.yaml`:**

```yaml
  - id: "my-scanner-block"
    scanner: "my_scanner"
    severity: "high"
    action: "block"
    description: "Block high-severity my_scanner findings"
    enabled: true
```

**Step 4 — Add a label in the dashboard Security page:**

```typescript
// artifacts/dashboard/src/pages/Security.tsx
const SCANNER_LABELS: Record<string, string> = {
  // ... existing labels ...
  my_scanner: "My Scanner",
};
```

**Step 5 — Write a test in `scripts/src/test_suite.ts` or `test_features.ts`.**

That's it. No restarts needed if hot-reloading policies via `POST /api/v1/policies/reload`.

---

## 14. How to Add a New Model Provider

**Step 1 — Add the model to `MODEL_CATALOG` in `providers.ts`:**

```typescript
// artifacts/api-server/src/modules/providers.ts

export const MODEL_CATALOG: Record<string, ModelConfig> = {
  // ... existing models ...
  "mock-my-model": {
    name: "mock-my-model",
    cost_per_1k_input: 0.002,
    cost_per_1k_output: 0.008,
    avg_latency_ms: 600,
    quality_tier: 3,
  },
};
```

**Step 2 — Optionally add a real provider call in `callProvider()`:**

The current implementation ignores the model name and returns a random mock response. For a real provider, add a branch:

```typescript
export async function callProvider(req: ProviderRequest): Promise<ProviderResponse> {
  if (req.model === "mock-my-model") {
    // call your real API here
  }
  // ... existing mock fallback
}
```

**Step 3 — Add a cheaper alternative in `cost-insights.ts`** (optional):

```typescript
const MODEL_CHEAPER_ALTERNATIVES: Record<string, ...> = {
  "mock-my-model": { model: "mock-claude-3-haiku", savings_pct: 40, reason: "Haiku is cheaper for simple tasks" },
};
```

**Step 4 — Add the model to the Replay dialog picker in `Traces.tsx`:**

```typescript
// artifacts/dashboard/src/pages/Traces.tsx
const MODELS = [
  // ... existing entries ...
  { id: "mock-my-model", label: "My Model", cls: "border-teal-500/40 text-teal-300" },
];
```

**Step 5 — Add a color entry in `Sessions.tsx`:**

```typescript
const MODEL_COLORS: Record<string, string> = {
  // ... existing ...
  "mock-my-model": "text-teal-400",
};
```

No schema changes needed — model name is stored as a free-text string.

---

## 15. How to Add a New Dashboard Page

**Step 1 — Create the page component:**

```typescript
// artifacts/dashboard/src/pages/MyPage.tsx
import { useSomeHook } from "@workspace/api-client-react";

export default function MyPage() {
  const { data, isLoading } = useSomeHook({
    query: { refetchInterval: 15000 }
  });
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold text-foreground">My Page</h1>
      {/* ... */}
    </div>
  );
}
```

**Step 2 — Register the route in `App.tsx`:**

```typescript
// artifacts/dashboard/src/App.tsx
import MyPage from "@/pages/MyPage";

// Inside Router() → <Switch>:
<Route path="/mypage" component={MyPage} />
```

**Step 3 — Add a sidebar link in `Layout.tsx`:**

```typescript
// artifacts/dashboard/src/components/Layout.tsx
import { SomeIcon } from "lucide-react";

const NAV_ITEMS = [
  // ... existing items ...
  { href: "/mypage", label: "My Page", icon: SomeIcon },
];
```

**Step 4 — If the page needs a new API endpoint:**
1. Add the path + schemas to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks
3. Add the route handler in `artifacts/api-server/src/routes/v1/myroute.ts`
4. Mount it in `artifacts/api-server/src/routes/index.ts`
5. Add any backend logic in a new `modules/mymodule.ts` file

---

## Key Invariants

- **All DB access goes through `storage.*`** — never import `better-sqlite3` elsewhere.
- **All business logic goes in `modules/`** — routes should be thin wrappers that validate input, call a module function, and return JSON.
- **Never use `console.log` in server code** — use `req.log` in route handlers and the `logger` singleton elsewhere.
- **Schema changes are additive-only** — add columns via `try/catch ALTER TABLE` in `initSchema()`. Never drop or rename columns.
- **OpenAPI is the contract** — if you add an endpoint you want typed hooks for, update `openapi.yaml` first, then run codegen.
- **Policy changes don't require a restart** — `POST /api/v1/policies/reload` hot-reloads `config/policies.yaml` in-process.
- **All 53 tests must pass before any merge** — run all three test scripts and verify exit codes.
