# AI Control Plane — Baseline Status

**Checkpoint:** known-good-baseline  
**Commit:** cdb8ff47c44ee485d8451db0f3394446f0ba43f6  
**Date:** 2026-05-02  
**Status: STABLE — all systems operational**

---

## Passing Tests

**22/22 automated tests pass** (`scripts/src/test_suite.ts`)

| # | Test |
|---|---|
| 1 | Health check returns ok status |
| 2 | Normal chat request succeeds |
| 3 | Invalid request returns 400 |
| 4 | Unknown model falls back gracefully |
| 5 | Prompt injection is blocked |
| 6 | SSN in prompt is blocked |
| 7 | AWS key in prompt is blocked |
| 8 | Jailbreak attempt is blocked |
| 9 | Normal email flagged but not blocked |
| 10 | Session affinity — sticky routing on second request |
| 11 | New session has no affinity |
| 12 | Eval scores returned for normal requests |
| 13 | Traces endpoint returns records |
| 14 | Get single trace by ID |
| 15 | Get trace by ID — 404 for nonexistent |
| 16 | Metrics summary returns all fields |
| 17 | Security events endpoint returns records |
| 18 | Evals endpoint returns records |
| 19 | Sessions endpoint returns records |
| 20 | Demo run returns results for all scenarios |
| 21 | Demo with specific scenario runs correctly |
| 22 | Multi-tenant requests tracked separately |

---

## Working Endpoints

All routes served under the `/api` prefix via reverse proxy. API server runs on port 8080 internally.

| Method | Path | HTTP Status |
|---|---|---|
| GET | `/api/healthz` | 200 |
| POST | `/api/v1/chat` | 200 |
| GET | `/api/v1/traces` | 200 |
| GET | `/api/v1/traces/:id` | 200 / 404 |
| GET | `/api/v1/metrics/summary` | 200 |
| GET | `/api/v1/security/events` | 200 |
| GET | `/api/v1/evals` | 200 |
| GET | `/api/v1/sessions` | 200 |
| POST | `/api/v1/demo/run` | 200 |

---

## Demo Scenarios

**10/10 scenarios — 6 passed, 4 correctly blocked, 0 failed** (`scripts/src/run_demo.ts`)

| Scenario | Outcome | Reason |
|---|---|---|
| `normal_request` | PASSED | Standard chat, gpt-4, cost + latency tracked |
| `prompt_injection` | BLOCKED | "Ignore all previous instructions" caught |
| `pii_detection` | BLOCKED | SSN pattern detected |
| `secret_leak` | BLOCKED | AWS Access Key detected |
| `jailbreak_attempt` | BLOCKED | DAN mode phrase detected |
| `expensive_prompt` | PASSED | claude-3-opus, large prompt, cost tracked |
| `session_routing_1` | PASSED | Session affinity established |
| `session_routing_2` | PASSED | Sticky routing held despite model switch request |
| `multi_tenant` | PASSED | Separate tenant IDs tracked correctly |
| `evaluation_scoring` | PASSED | All 5 eval dimensions returned |

"Blocked" outcomes for security scenarios are correct expected behavior, not failures.

---

## Dashboard Pages

Dashboard runs on port 23183, proxied at `/`. All 6 pages load with live data.

| Page | Route | Live Data From | Auto-refresh |
|---|---|---|---|
| Overview | `/` | `/api/v1/metrics/summary` | Every 10s |
| Traces | `/traces` | `/api/v1/traces` | Every 15s |
| Security | `/security` | `/api/v1/security/events` | Every 15s |
| Sessions | `/sessions` | `/api/v1/sessions` | Every 15s |
| Evaluations | `/evals` | `/api/v1/evals` | Every 15s |
| Demo Runner | `/demo` | `/api/v1/demo/run` | On demand |

---

## Known Limitations

1. **No `/api` prefix → 404.** Routes without the `/api` prefix (e.g. bare `POST /v1/chat`) return 404. This is correct — the proxy enforces `/api`. The dashboard and all test scripts use correct paths.

2. **In-memory SQLite.** The database does not persist across API server restarts. All data (traces, sessions, evals, security events) is lost on restart. This is expected for the demo environment.

3. **Mock providers only.** No real LLM API calls are made. Responses and latencies are simulated. Provider names (mock-gpt-4, mock-claude-3-opus, etc.) are clearly prefixed with `mock-`.

4. **No authentication.** The API has no auth layer — all endpoints are open. Appropriate for a demo; not for production.

5. **Single-node only.** Session affinity is tracked in-process SQLite. Would need a shared store (Redis/Postgres) for multi-instance deployments.

---

## How to Re-validate

```bash
# Run test suite
API_URL=http://localhost:80/api npx tsx scripts/src/test_suite.ts

# Run demo
API_URL=http://localhost:80/api npx tsx scripts/src/run_demo.ts

# Quick health check
curl http://localhost:80/api/healthz
```

Full curl verification and detailed results are in `docs/VALIDATION_REPORT.md`.
