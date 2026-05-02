# AI Control Plane — Validation Report

**Date:** 2026-05-02  
**Environment:** Development (localhost:80 via reverse proxy → port 8080 API, port 23183 dashboard)  
**Status: PASS — demo-ready**

---

## 1. Server Status

| Service | Port | Status |
|---|---|---|
| API Server | 8080 (proxied at `/api`) | RUNNING |
| Dashboard | 23183 (proxied at `/`) | RUNNING |

**API Server build:** esbuild bundle — `dist/index.mjs` (1.3mb), built in ~340ms  
**API Server uptime:** stable, no crashes during validation

---

## 2. Registered Routes

All routes are mounted under the `/api` path prefix via the reverse proxy.

| Method | Path | Handler |
|---|---|---|
| GET | `/api/healthz` | health.js |
| POST | `/api/v1/chat` | v1/chat.js |
| GET | `/api/v1/traces` | v1/traces.js |
| GET | `/api/v1/traces/:id` | v1/traces.js |
| GET | `/api/v1/metrics/summary` | v1/metrics.js |
| GET | `/api/v1/security/events` | v1/security.js |
| GET | `/api/v1/evals` | v1/evals.js |
| GET | `/api/v1/sessions` | v1/sessions.js |
| POST | `/api/v1/demo/run` | v1/demo.js |

**Route note:** Routes without the `/api` prefix (e.g. `POST /v1/chat`) return 404 by design — the reverse proxy enforces the `/api` path. The dashboard frontend uses relative API URLs which correctly route through the proxy.

---

## 3. Endpoint Verification (curl)

All tests run against `http://localhost:80/api`.

| Endpoint | Method | Expected | Actual | Result |
|---|---|---|---|---|
| `/api/healthz` | GET | 200 | 200 | PASS |
| `/api/v1/chat` | POST | 200 | 200 | PASS |
| `/api/v1/traces` | GET | 200 | 200 | PASS |
| `/api/v1/metrics/summary` | GET | 200 | 200 | PASS |
| `/api/v1/security/events` | GET | 200 | 200 | PASS |
| `/api/v1/evals` | GET | 200 | 200 | PASS |
| `/api/v1/sessions` | GET | 200 | 200 | PASS |
| `/api/v1/demo/run` | POST | 200 | 200 | PASS |

---

## 4. Test Suite Results

**Command:** `API_URL=http://localhost:80/api npx tsx scripts/src/test_suite.ts`  
**Result: 22/22 PASSED — 0 failed**

| # | Test | Result |
|---|---|---|
| 1 | Health check returns ok status | PASS |
| 2 | Normal chat request succeeds | PASS |
| 3 | Invalid request returns 400 | PASS |
| 4 | Unknown model falls back gracefully | PASS |
| 5 | Prompt injection is blocked | PASS |
| 6 | SSN in prompt is blocked | PASS |
| 7 | AWS key in prompt is blocked | PASS |
| 8 | Jailbreak attempt is blocked | PASS |
| 9 | Normal email in context is flagged but not blocked | PASS |
| 10 | Session affinity — second request gets sticky routing | PASS |
| 11 | New session has no affinity | PASS |
| 12 | Eval scores are returned for normal requests | PASS |
| 13 | Traces endpoint returns records | PASS |
| 14 | Get single trace by ID | PASS |
| 15 | Get trace by ID — 404 for nonexistent | PASS |
| 16 | Metrics summary returns all fields | PASS |
| 17 | Security events endpoint returns records | PASS |
| 18 | Evals endpoint returns records | PASS |
| 19 | Sessions endpoint returns records | PASS |
| 20 | Demo run returns results for all scenarios | PASS |
| 21 | Demo with specific scenario runs correctly | PASS |
| 22 | Multi-tenant requests tracked separately | PASS |

---

## 5. Demo Validation Results

**Command:** `API_URL=http://localhost:80/api npx tsx scripts/src/run_demo.ts`  
**Result: 6 passed, 4 blocked (expected), 0 failed — completed in 4.86s**

| Scenario | Status | Notes |
|---|---|---|
| `normal_request` | PASSED | mock-gpt-4, ~645ms, cost tracked |
| `prompt_injection` | BLOCKED | "Ignore all previous instructions" caught by scanner |
| `pii_detection` | BLOCKED | SSN pattern detected, request rejected |
| `secret_leak` | BLOCKED | AWS Access Key detected, request rejected |
| `jailbreak_attempt` | BLOCKED | DAN mode phrase caught by jailbreak scanner |
| `expensive_prompt` | PASSED | mock-claude-3-opus, 101 tokens, latency tracked |
| `session_routing_1` | PASSED | Session affinity established with mock-gpt-4 |
| `session_routing_2` | PASSED | Sticky routing held gpt-4 despite gpt-3.5 request |
| `multi_tenant` | PASSED | Separate tenant IDs tracked independently |
| `evaluation_scoring` | PASSED | Full eval scores returned (relevance/safety/hallucination/groundedness/overall) |

**Note:** "blocked" status for security scenarios is the correct, expected outcome. These are not failures.

**Platform metrics after demo run:**
- Total requests: 70
- Total tokens: 2,608
- Total cost: $0.102694
- Avg latency: 523ms
- Blocked requests: 24
- Security events: 26
- Avg eval score: 0.726
- Session affinity rate: 12.9%

---

## 6. Dashboard Pages

All 6 pages verified loading with live data from the API:

| Page | Route | Data Source | Status |
|---|---|---|---|
| Overview | `/` | `/api/v1/metrics/summary` (10s refresh) | WORKING |
| Traces | `/traces` | `/api/v1/traces` (paginated) | WORKING |
| Security | `/security` | `/api/v1/security/events` | WORKING |
| Sessions | `/sessions` | `/api/v1/sessions` | WORKING |
| Evaluations | `/evals` | `/api/v1/evals` | WORKING |
| Demo Runner | `/demo` | `/api/v1/demo/run` (mutation) | WORKING |

---

## 7. Known Limitations

- Routes **without** the `/api` prefix (e.g. bare `/v1/chat`) return 404 — this is by design (proxy enforces `/api`). The dashboard and test suite both use the correct `/api/v1/...` paths.
- SQLite database is in-memory per process restart; data does not persist across server restarts. This is expected for a demo environment.
- Mock providers simulate latency and responses; no real LLM calls are made.

---

## 8. Conclusion

**All systems are operational and demo-ready.**

- 8/8 API endpoints respond correctly
- 22/22 automated tests pass
- 10/10 demo scenarios complete (6 pass, 4 correctly blocked, 0 fail)
- Dashboard renders live data on all 6 pages
- No blocking issues found
