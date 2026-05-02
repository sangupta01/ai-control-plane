# Lockdown Baseline

**Checkpoint:** 488ecea46c2090d1b757db94f1aa34867cb0437e  
**Date:** 2026-05-02  
**Status: LOCKED — do not modify core features, API contracts, or passing behavior**

---

## Lockdown Rules

1. Backend logic is frozen.
2. No new core features without explicit approval.
3. No modifications to existing API contracts (paths, methods, request/response shapes).
4. No changes that break existing passing behavior.
5. Allowed: minor bug fixes, docs updates, demo polish, UI polish, one explicitly approved feature.

---

## Test Summary — 46/46

| Suite | Tests | Result |
|---|---|---|
| Original test suite (`scripts/src/test_suite.ts`) | 22 | 22/22 PASS |
| Feature expansion (`scripts/src/test_features.ts`) | 24 | 24/24 PASS |
| **Total** | **46** | **46/46 PASS** |

### Re-run commands
```bash
API_URL=http://localhost:80/api npx tsx scripts/src/test_suite.ts
API_URL=http://localhost:80/api npx tsx scripts/src/test_features.ts
```

---

## Working Endpoints — 11/11

All return HTTP 200. Served at `http://localhost:80/api` (proxy) → internal port 8080.

| Method | Path | Feature |
|---|---|---|
| GET | `/api/healthz` | Health check |
| POST | `/api/v1/chat` | LLM gateway — unified chat |
| GET | `/api/v1/traces` | Observability — trace list |
| GET | `/api/v1/traces/:id` | Observability — single trace (404 on miss) |
| GET | `/api/v1/metrics/summary` | Platform metrics |
| GET | `/api/v1/security/events` | Security event log |
| GET | `/api/v1/evals` | Heuristic eval scores |
| GET | `/api/v1/sessions` | Session list + affinity stats |
| POST | `/api/v1/demo/run` | Demo scenario runner |
| GET | `/api/v1/policies` | Policy-as-Code — rule list |
| POST | `/api/v1/policies/reload` | Policy-as-Code — hot reload |
| GET | `/api/v1/cost/insights` | Cost Optimization Insights |
| POST | `/api/v1/redteam/run` | Red Team Mode — run scenarios |
| GET | `/api/v1/redteam/scenarios` | Red Team Mode — scenario list |
| GET | `/api/v1/redteam/history` | Red Team Mode — run history |

---

## Dashboard Pages — 9/9

All pages load with live data. Dashboard served at `/` (proxy) → internal port 23183.

| Page | Route | Data Source |
|---|---|---|
| Overview | `/` | `GET /api/v1/metrics/summary` |
| Traces | `/traces` | `GET /api/v1/traces` |
| Security | `/security` | `GET /api/v1/security/events` |
| Sessions | `/sessions` | `GET /api/v1/sessions` |
| Evaluations | `/evals` | `GET /api/v1/evals` |
| Demo Runner | `/demo` | `POST /api/v1/demo/run` |
| Policies | `/policies` | `GET /api/v1/policies` |
| Cost Insights | `/cost` | `GET /api/v1/cost/insights` |
| Red Team | `/redteam` | `GET /api/v1/redteam/scenarios`, `POST /api/v1/redteam/run` |

---

## Demo Scenarios — 10/10

Run via `POST /api/v1/demo/run` or `npx tsx scripts/src/run_demo.ts`.

| Scenario | Expected Outcome |
|---|---|
| normal_request | passed — clean response |
| prompt_injection | blocked — injection detected |
| pii_detection | blocked — SSN/PII detected |
| secret_leak | blocked — AWS key detected |
| jailbreak_attempt | blocked — jailbreak detected |
| expensive_prompt | passed — legitimate complex request |
| session_routing_1 | passed — new session, no affinity |
| session_routing_2 | passed — sticky routing to prior model |
| multi_tenant | passed — per-tenant isolation confirmed |
| evaluation_scoring | passed — eval score returned (0.724 avg) |

6 pass, 4 blocked (blocking is correct expected behavior for security scenarios).

---

## Red Team Scenarios — 10/10, 100% pass rate

Run via `POST /api/v1/redteam/run`.

| ID | Scenario | Category | Expected | Validated |
|---|---|---|---|---|
| rt-001 | direct_injection | prompt_injection | BLOCKED | ✓ |
| rt-002 | role_override | prompt_injection | BLOCKED | ✓ |
| rt-003 | jailbreak_dan | jailbreak | BLOCKED | ✓ |
| rt-004 | jailbreak_developer_mode | jailbreak | BLOCKED | ✓ |
| rt-005 | fake_secret_leakage | secret_leak | BLOCKED | ✓ |
| rt-006 | pii_leakage | pii | BLOCKED | ✓ |
| rt-007 | data_exfiltration | data_exfiltration | BLOCKED | ✓ |
| rt-008 | indirect_injection | prompt_injection | BLOCKED | ✓ |
| rt-009 | benign_technical | baseline | ALLOWED | ✓ |
| rt-010 | benign_general | baseline | ALLOWED | ✓ |

**Pass rate: 1.00 (100%)** — all adversarial attacks blocked, all benign baselines allowed.

---

## Architecture Snapshot

### Backend (`artifacts/api-server`)
- Runtime: Node.js + Express + TypeScript
- Storage: better-sqlite3 (SQLite, ephemeral per restart unless `DB_PATH` set)
- Port: 8080 (internal), proxied at `/api`
- Security scanners: PII, secrets, prompt injection, jailbreak, data exfiltration
- Policy engine: 18 rules across 5 scanners (`config/policies.yaml`)
- Mock LLM providers: gpt-4, gpt-3.5, claude-3-opus, claude-3-haiku, gemini-pro

### Frontend (`artifacts/dashboard`)
- React + Vite + TypeScript
- Styling: Tailwind v4, dark navy/slate theme
- Routing: wouter
- API client: generated hooks from `@workspace/api-client-react`
- Port: 23183 (internal), proxied at `/`

### Key Source Files
```
artifacts/api-server/src/
  modules/security.ts          — scanner pipeline + policy integration
  modules/policies.ts          — policy-as-code engine
  modules/cost-insights.ts     — cost analytics
  modules/redteam.ts           — red team scenario runner
  modules/storage.ts           — SQLite storage layer
  modules/routing.ts           — session-sticky LLM routing
  modules/evaluator.ts         — heuristic eval scoring
  routes/index.ts              — router mount point
  routes/v1/                   — all route handlers

artifacts/dashboard/src/
  pages/                       — 9 dashboard pages
  components/Layout.tsx        — nav sidebar
  App.tsx                      — route definitions

config/policies.yaml           — 18 policy rules (source of truth)
lib/api-spec/openapi.yaml      — OpenAPI contract (15 paths, frozen)
scripts/src/test_suite.ts      — 22 original tests
scripts/src/test_features.ts   — 24 feature expansion tests
```

---

## Known Limitations

1. **Storage is ephemeral** — SQLite DB is in-memory per process restart unless `DB_PATH` env var is set to a persistent path. All traces, sessions, security events, and red team results reset on server restart.

2. **Mock providers only** — No real LLM calls. All responses are simulated. Token counts and costs are computed from mock response sizes using fixed per-token rates.

3. **No authentication** — All endpoints are unauthenticated. Not suitable for multi-user production without adding auth middleware.

4. **No rate limiting** — API has no rate limiting or request throttling.

5. **Policy hot-reload is in-process only** — `POST /v1/policies/reload` re-reads `config/policies.yaml` from disk but does not propagate across multiple server instances.

6. **Cost insights are heuristic** — Optimization suggestions are based on static model-to-model savings percentages, not actual usage pattern analysis.

7. **Red team scenarios are fixed** — The 10 scenarios are hardcoded in `modules/redteam.ts`. No UI for adding custom scenarios.

8. **Session affinity rate** — Currently ~7–8% because most test requests use unique or no session IDs. Rate increases significantly with real repeated-session traffic.

---

## Approved Next Feature Slot

One feature may be added after this checkpoint with explicit user approval. No feature is currently approved.

| Slot | Feature | Status |
|---|---|---|
| #1 | TBD | Awaiting approval |
