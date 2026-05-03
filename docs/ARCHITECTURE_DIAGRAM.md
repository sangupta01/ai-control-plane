# Architecture Diagrams — AI Control Plane

---

## 1. High-Level Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Replit Reverse Proxy                            │
│              path-based routing — mTLS, shared port 80                  │
└───────────────────────┬─────────────────────────────┬───────────────────┘
                        │                             │
          path: /api/*  │               path: /*      │
                        ▼                             ▼
          ┌─────────────────────┐       ┌─────────────────────┐
          │    API Server       │       │    Dashboard        │
          │  Express / Node.js  │       │  React + Vite       │
          │  port: $PORT        │       │  port: $PORT        │
          │                     │       │                     │
          │  ┌───────────────┐  │       │  ┌───────────────┐  │
          │  │   Gateway     │  │       │  │  React Query  │  │
          │  │ (orchestrator)│  │       │  │  hooks →      │  │
          │  └──────┬────────┘  │       │  │  /api/*       │  │
          │         │           │       │  └───────────────┘  │
          │  ┌──────┼────────┐  │       └─────────────────────┘
          │  ▼      ▼        ▼  │
          │ Security Routing Eval│         ┌─────────────────────┐
          │ scanner  engine  scorer        │   @workspace/       │
          │         │           │          │   api-client-react  │
          │  ┌──────▼────────┐  │          │                     │
          │  │  Mock LLM     │  │          │  Generated hooks +  │
          │  │  Providers    │  │          │  custom-fetch.ts    │
          │  │  (5 models)   │  │          └─────────────────────┘
          │  └───────────────┘  │
          │                     │         ┌─────────────────────┐
          │  ┌───────────────┐  │         │   lib/api-spec      │
          │  │   SQLite DB   │  │         │                     │
          │  │  (WAL mode)   │  │         │   openapi.yaml →    │
          │  │  4 tables     │  │         │   orval codegen     │
          │  └───────────────┘  │         └─────────────────────┘
          └─────────────────────┘

          ┌─────────────────────┐
          │  config/            │
          │  policies.yaml      │  ← hot-reloadable, no restart needed
          │  (18 rules)         │
          └─────────────────────┘
```

---

## 2. Request Lifecycle Diagram — POST /api/v1/chat

```
Client / Dashboard
       │
       │  POST /api/v1/chat
       │  { messages, model?, session_id?, tenant_id? }
       ▼
routes/v1/chat.ts
       │  validate messages[]
       │
       ▼
modules/gateway.ts → processRequest()
       │
       ├─ 1. Generate traceId, resolve sessionId + tenantId
       │
       ├─ 2. Estimate prompt tokens (word count × 1.3)
       │
       ├─ 3. ─────────────────────────────────────────────
       │       modules/security.ts: runSecurityScan()
       │       ├─ scanText(): run 5 regex-based scanners
       │       │    pii / secrets / prompt_injection
       │       │    jailbreak / data_exfiltration
       │       └─ modules/policies.ts: applyPolicies()
       │            match each finding against enabled rules
       │            override action per rule (allow/flag/block)
       │
       ├─ 4a. BLOCKED PATH ──────────────────────────────
       │       • security result has action=block finding
       │       • modules/storage.ts: insertTrace (blocked=1)
       │       • modules/storage.ts: insertSecurityEvent
       │       • modules/storage.ts: updateSession
       │       • Return 200: { blocked: true, block_reason, ... }
       │
       └─ 4b. ALLOWED PATH ──────────────────────────────
               │
               ├─ 5. modules/routing.ts: routeRequest()
               │       getSession() → check affinity model
               │       compare effective costs (1.5× threshold)
               │       return { selected_model, session_affinity_hit, ... }
               │
               ├─ 6. modules/providers.ts: callProvider()
               │       simulate latency, pick mock response
               │       return { content, prompt_tokens, completion_tokens }
               │
               ├─ 7. modules/security.ts: runOutputSecurityScan()
               │       scan model's response text
               │       merge with pre-call findings
               │
               ├─ 8. modules/evaluation.ts: evaluate()
               │       relevance / safety / hallucination_risk
               │       groundedness / overall
               │
               ├─ 9. modules/providers.ts: calculateCost()
               │       (prompt_tokens/1000 × input_rate)
               │     + (completion_tokens/1000 × output_rate)
               │
               ├─ 10. modules/storage.ts:
               │        insertTrace  (blocked=0)
               │        insertEvalResult
               │        insertSecurityEvent (flag-only findings)
               │        upsertSession (affinity_hits, model_switches)
               │
               └─ 11. Return 200: { trace_id, model, message,
                                    usage, cost, latency_ms,
                                    routing_decision, security_result,
                                    eval_scores, blocked: false }
```

### Timing Budget (mock providers)

| Step | Typical duration |
|---|---|
| Security scan (pre) | < 1 ms |
| Policy application | < 1 ms |
| Routing decision | < 1 ms |
| Provider call (simulated latency) | 160–1440 ms depending on model |
| Output security scan | < 1 ms |
| Evaluation scoring | < 1 ms |
| Storage writes | < 2 ms |
| **Total** | **~200–1450 ms** |

---

## 3. Replay Lifecycle Diagram — POST /api/v1/traces/:id/replay

```
Client / Dashboard Replay Dialog
       │
       │  POST /api/v1/traces/{original_trace_id}/replay
       │  { override_model?: "mock-claude-3-haiku" }
       ▼
routes/v1/replay.ts
       │
       ├─ storage.getTraceById(id)
       │    ─ Not found → 404
       │
       ├─ Determine replay session ID:
       │    ─ override_model provided → fresh session ID (replay-{uuid})
       │       prevents sticky routing from suppressing the override
       │    ─ no override → use original session ID
       │
       ├─ gateway.processRequest({
       │     messages: [{ role:"user", content: originalRow.prompt }],
       │     model: override_model ?? originalRow.model,
       │     session_id: replaySessionId,
       │     tenant_id: originalRow.tenant_id,
       │     replay_of_trace_id: originalRow.id,   ← links replay to original
       │   })
       │   (full pipeline runs: security → routing → provider → eval → storage)
       │   New trace stored with is_replay=1, replay_of_trace_id set
       │
       ├─ storage.getTraceById(replayResult.trace_id)
       │    read back full replay trace row
       │
       ├─ Compute diff:
       │    response_changed:  original.response  ≠ replay.response
       │    model_changed:     original.model     ≠ replay.model
       │    routing_changed:   original.routing.selected_model ≠ replay.routing.selected_model
       │    eval_diff: {
       │      relevance:    replay.relevance    − original.relevance
       │      safety:       replay.safety       − original.safety
       │      hallucination: original.hallucination_risk − replay.hallucination_risk  (inverted)
       │      groundedness: replay.groundedness − original.groundedness
       │    }
       │
       └─ Return 200: {
              original_trace: { ...full trace fields },
              replay_trace:   { ...full trace fields, is_replay:true, replay_of_trace_id },
              diff: { response_changed, model_changed, routing_changed, eval_diff }
            }

Dashboard: ReplayDialog renders side-by-side LEFT=original / RIGHT=replay
  with MODEL CHANGED / RESPONSE CHANGED / EVAL IMPROVED/DEGRADED badges
```

---

## 4. Data Model Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                              traces                                  │
├──────────────────┬───────────────────────────────────────────────────┤
│ id               │ UUID, primary key                                  │
│ session_id       │ groups requests from the same logical conversation │
│ tenant_id        │ multi-tenant isolation key                         │
│ model            │ e.g. "mock-gpt-4", "mock-claude-3-haiku"          │
│ prompt           │ concatenated user message content (≤2000 chars)   │
│ response         │ model output (≤2000 chars) or "[BLOCKED]"         │
│ prompt_tokens    │ estimated token count for the prompt               │
│ completion_tokens│ estimated token count for the response             │
│ total_tokens     │ sum of above                                       │
│ cost             │ USD: (p_tokens/1k×input_rate)+(c_tokens/1k×out)   │
│ latency_ms       │ wall-clock time from request start to storage write│
│ routing_decision │ JSON: selected_model, reason, affinity_hit, etc.  │
│ security_result  │ JSON: { passed, findings:[{scanner,severity,...}] }│
│ eval_scores      │ JSON: { relevance, safety, hallucination_risk,    │
│                  │         groundedness, overall }                    │
│ blocked          │ 0 | 1                                              │
│ block_reason     │ concatenated block reasons, or NULL                │
│ replay_of_trace_id│ NULL for originals; UUID of parent for replays   │
│ is_replay        │ 0 | 1                                              │
│ created_at       │ SQLite datetime string, UTC                        │
└──────────────────┴───────────────────────────────────────────────────┘
                 │ 1
                 │ has many
                 ▼ N
┌──────────────────────────────────────────────────────────────────────┐
│                          security_events                             │
├──────────────────┬───────────────────────────────────────────────────┤
│ id               │ UUID                                               │
│ trace_id         │ FK → traces.id                                     │
│ session_id       │ denormalized for query convenience                 │
│ scanner          │ "pii" | "secrets" | "prompt_injection" | ...       │
│ severity         │ "low" | "medium" | "high" | "critical"            │
│ action           │ "allow" | "flag" | "block"                        │
│ reason           │ human-readable description                         │
│ matched          │ the matched string (redacted for secrets)          │
│ prompt_excerpt   │ first 200 chars of the prompt                      │
│ created_at       │                                                    │
└──────────────────┴───────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                           eval_results                               │
├──────────────────┬───────────────────────────────────────────────────┤
│ id               │ UUID                                               │
│ trace_id         │ FK → traces.id                                     │
│ relevance        │ REAL [0,1]                                         │
│ safety           │ REAL [0,1]  higher = safer                         │
│ hallucination_risk│ REAL [0,1] lower = better                        │
│ groundedness     │ REAL [0,1]                                         │
│ overall          │ REAL [0,1]  weighted composite                     │
│ created_at       │                                                    │
└──────────────────┴───────────────────────────────────────────────────┘
  Note: eval_scores is also denormalized into the traces row as JSON
  for single-query access. eval_results exists for indexed queries.

┌──────────────────────────────────────────────────────────────────────┐
│                              sessions                                │
├──────────────────┬───────────────────────────────────────────────────┤
│ id               │ session_id (primary key, UUID)                     │
│ tenant_id        │                                                    │
│ model            │ current affinity model                             │
│ request_count    │ total requests in this session                     │
│ total_tokens     │ cumulative                                         │
│ total_cost       │ cumulative USD                                     │
│ model_switches   │ number of times model changed                      │
│ affinity_hits    │ number of requests where sticky routing applied    │
│ created_at       │                                                    │
│ last_active      │ updated on every upsert to datetime('now')        │
└──────────────────┴───────────────────────────────────────────────────┘

Indexes:
  traces:           session_id, created_at DESC
  security_events:  trace_id,   created_at DESC
  eval_results:     trace_id
  sessions:         last_active DESC
```

---

## 5. Component Responsibility Table

| Component | File(s) | Responsibility | Has side-effects? |
|---|---|---|---|
| **Gateway** | `modules/gateway.ts` | Orchestrates the full request pipeline; the only place that calls all other modules together | Yes — writes traces, security events, sessions |
| **Routing Engine** | `modules/routing.ts` | Selects the actual model to use; computes effective cost; determines if sticky routing applies | No — read-only; `storage.getSession` is a read |
| **Security Scanner** | `modules/security.ts` | Runs 5 regex-based scanners against prompt and response text; returns raw findings | No — pure function |
| **Policy Engine** | `modules/policies.ts` | Loads and caches `config/policies.yaml`; overrides scanner-default actions per rule | No — deterministic override; file I/O only at cache miss |
| **Evaluation Scorer** | `modules/evaluation.ts` | Computes 5 heuristic scores; adds ±0.025 noise | No — pure function (has random noise) |
| **Mock Providers** | `modules/providers.ts` | Simulates LLM call latency; returns deterministic-ish mock response; tracks token counts and cost | No — async delay only |
| **Storage** | `modules/storage.ts` | All SQLite reads and writes; schema init and migrations; `storage` singleton | Yes — all DB I/O |
| **Cost Insights** | `modules/cost-insights.ts` | Aggregation queries for cost reporting; computes savings suggestions from `MODEL_CHEAPER_ALTERNATIVES` | No — read-only queries |
| **Red Team** | `modules/redteam.ts` | Defines 10 adversarial scenarios; runs them through `processRequest`; persists results | Yes — calls `processRequest` which writes traces |
| **Chat Route** | `routes/v1/chat.ts` | Validates `messages[]`; delegates to `gateway.processRequest` | Via gateway |
| **Replay Route** | `routes/v1/replay.ts` | Fetches original trace; determines replay session ID; calls `gateway.processRequest`; computes diff | Via gateway |
| **Traces Route** | `routes/v1/traces.ts` | Paginates and serializes `storage.getTraces`; parses JSON blobs | No |
| **Metrics Route** | `routes/v1/metrics.ts` | Calls `storage.getMetricsSummary` (aggregate SQL) | No |
| **Sessions Route** | `routes/v1/sessions.ts` | Paginates `storage.getSessions`; computes affinity rate | No |
| **Policies Route** | `routes/v1/policies.ts` | Returns `getPolicies()`; `POST /reload` calls `reloadPolicies()` | `reload` clears module cache |
| **Demo Route** | `routes/v1/demo.ts` | Runs named scenarios through `processRequest`; collects results | Via gateway |
| **Logger** | `lib/logger.ts` | Pino singleton; used for non-request logging | No |
| **OpenAPI Spec** | `lib/api-spec/openapi.yaml` | API contract source of truth; drives codegen | No |
| **API Client** | `lib/api-client-react/` | Generated TanStack Query hooks + custom fetch wrapper | No |
| **Dashboard Layout** | `components/Layout.tsx` | Sidebar nav; active-link highlighting via `useLocation` | No |
| **Traces Page** | `pages/Traces.tsx` | Table with visual tags; per-row Replay button; ReplayDialog with model picker and side-by-side comparison | No (reads only; replay is user-initiated) |
| **Demo Page** | `pages/Demo.tsx` | Scenario cards; run-all / run-one; post-run replay candidate suggestions and navigation | Via `useRunDemo` mutation |
| **Sessions Page** | `pages/Sessions.tsx` | Aggregate affinity stats banner; session table with color-coded models and affinity bars | No |
| **Security Page** | `pages/Security.tsx` | Events grouped by scanner; severity + action badges | No |
| **Cost Insights Page** | `pages/CostInsights.tsx` | Routing optimization suggestions; top sessions/tenants/prompts | No |
| **Red Team Page** | `pages/RedTeam.tsx` | Adversarial test runner; per-scenario results; pass rate | Via `useRunRedTeam` mutation |

---

## Model Catalog Reference

| Model ID | Label | Input $/1k | Output $/1k | Avg Latency | Quality Tier |
|---|---|---|---|---|---|
| `mock-gpt-4` | GPT-4 | $0.0300 | $0.0600 | 800 ms | 4 |
| `mock-gpt-3.5` | GPT-3.5 | $0.0010 | $0.0020 | 300 ms | 3 |
| `mock-claude-3-opus` | Claude Opus | $0.0150 | $0.0750 | 1200 ms | 5 |
| `mock-claude-3-haiku` | Claude Haiku | $0.00025 | $0.00125 | 200 ms | 2 |
| `mock-gemini-pro` | Gemini Pro | $0.0005 | $0.0015 | 500 ms | 3 |

Routing cost thresholds: affinity model wins if its effective cost ≤ 1.5× the requested model's effective cost.

---

## API Surface Summary

| Endpoint | Method | Purpose | Generated hook? |
|---|---|---|---|
| `/api/healthz` | GET | Health check | No |
| `/api/v1/chat` | POST | Unified LLM gateway | No (use direct fetch) |
| `/api/v1/traces` | GET | List traces (paginated) | `useGetTraces` |
| `/api/v1/traces/:id` | GET | Single trace detail | `useGetTrace` |
| `/api/v1/traces/:id/replay` | POST | Replay a trace | **No — direct fetch** |
| `/api/v1/metrics/summary` | GET | Platform KPIs | `useGetMetricsSummary` |
| `/api/v1/security/events` | GET | Security event log | `useGetSecurityEvents` |
| `/api/v1/evals` | GET | Eval score log | `useGetEvals` |
| `/api/v1/sessions` | GET | Active sessions | `useGetSessions` |
| `/api/v1/demo/run` | POST | Run demo scenarios | `useRunDemo` |
| `/api/v1/policies` | GET | List policy rules | `useGetPolicies` |
| `/api/v1/policies/reload` | POST | Hot-reload policies.yaml | No |
| `/api/v1/cost/insights` | GET | Cost optimization data | `useGetCostInsights` |
| `/api/v1/redteam/scenarios` | GET | List red team scenarios | `useGetRedTeamScenarios` |
| `/api/v1/redteam/run` | POST | Run red team tests | `useRunRedTeam` |
| `/api/v1/redteam/history` | GET | Past red team runs | No |

Replay has no generated hook because the endpoint was added after the OpenAPI spec was frozen. All other endpoints are declared in `lib/api-spec/openapi.yaml` and have type-safe hooks generated by Orval.
