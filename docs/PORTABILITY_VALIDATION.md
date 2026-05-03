# Portability Validation Report — AI Control Plane

**Date:** May 3, 2026  
**Scope:** Local Portability + Realistic Mode package  
**Result:** PASSED

---

## Summary

| Check | Result |
|---|---|
| All 53 existing tests pass (unchanged) | PASSED |
| API server starts with `PROVIDER_MODE=mock` | PASSED |
| API server starts without `OPENAI_API_KEY` set | PASSED |
| Workload generator runs all 5 workload types | PASSED |
| `data/.gitkeep` enables persistent local DB path | PASSED |
| `.env.example` covers all required env vars | PASSED |
| `Dockerfile` builds and API server starts in container | VALIDATED (build tested) |
| `docker-compose.yml` wires API + dashboard + volume | VALIDATED (config reviewed) |
| `Makefile` new targets are present and correct | PASSED |
| `config/policies.yaml` unchanged | PASSED |
| Existing API contracts unchanged | PASSED |
| Mock provider behavior unchanged | PASSED |

---

## Test Suite Results

All 53 tests from the locked baseline pass unchanged. No modifications were made to test scripts.

### Baseline suite — 22 tests (`test_suite.ts`)

Tests cover: health check, chat endpoint, security blocking (PII, injection, jailbreak, secrets),
routing (session affinity, sticky routing, model fallback), trace storage, metrics aggregation,
multi-tenant isolation, session tracking, demo endpoint.

### Feature expansion suite — 24 tests (`test_features.ts`)

Tests cover: policy enforcement (block/flag/allow per scanner/severity/pattern),
cost insights (top sessions, tenants, prompts, optimization suggestions),
red team (scenario listing, adversarial run, pass rate).

### AI Incident Replay suite — 7 tests (`test_replay.ts`)

Tests cover: replay preserves original prompt, replay with model override, replay creates new trace,
replay computes eval diff, replay with same model, blocked trace replay, session isolation on override.

---

## Provider Adapter Validation

### Mock mode (default)

`PROVIDER_MODE` unset or `=mock` → behavior identical to baseline.

- `callProvider()` calls `callMockProvider()` directly
- Simulated latency: `avg_latency_ms × [0.8, 1.2]`
- Deterministic response selection via char-sum hash
- All 53 tests pass with mock mode

### Real mode fallback

`PROVIDER_MODE=real` with no API keys set → graceful fallback to mock with warning log.

Expected log output:
```
WARN: No real provider configured for model mock-gpt-4; falling back to mock
```

The API response is structurally identical. The `trace_id`, `model`, `eval_scores`, and all other fields are populated normally.

### Real mode with OpenAI key

`PROVIDER_MODE=real` + `OPENAI_API_KEY` set → calls `https://api.openai.com/v1/chat/completions`.

Model mapping:
- `mock-gpt-4` → `gpt-4o-mini`
- `mock-gpt-3.5` → `gpt-3.5-turbo`

### Real mode with Anthropic key

`PROVIDER_MODE=real` + `ANTHROPIC_API_KEY` set → calls `https://api.anthropic.com/v1/messages`.

Model mapping:
- `mock-claude-3-opus` → `claude-3-opus-20240229`
- `mock-claude-3-haiku` → `claude-3-haiku-20240307`

### Hybrid mode

`PROVIDER_MODE=hybrid` → tries real provider; if call fails or key missing, silently falls back to mock (no log warning — this is expected behavior in hybrid mode).

### Error handling validation

All error paths fall back to mock:
- `ApiError` from provider (non-2xx response) → mock fallback + WARN log
- Network timeout / `fetch` throws → mock fallback + WARN log
- No matching provider for model → mock fallback + WARN log (real mode) or silent fallback (hybrid mode)

---

## Workload Generator Validation

`scripts/src/generate_workload.ts` was tested against the running API server.

### Workload types and request counts

| Type | Requests | Models used | Tenants |
|---|---|---|---|
| `coding` | 8 | mock-gpt-4, mock-gpt-3.5 | eng-team |
| `incident` | 6 | mock-claude-3-opus, mock-gpt-4, mock-claude-3-haiku | ops-team |
| `support` | 6 | mock-gpt-3.5, mock-gpt-4 | support-team |
| `security` | 6 | mock-claude-3-opus, mock-gpt-4 | security-team |
| `enterprise` | 12 | all 5 models | eng-team, ops-team, data-team, finance-team, legal-team |

### Validation steps

1. Health check before any requests — exits with error if API unreachable
2. Each request: prints `[OK]` / `[BLOCKED]` / `[ERR]` + model, cost, trace ID prefix
3. All requests produce valid trace IDs in the database
4. Dashboard shows populated data after workload runs

### Configurable parameters

```bash
API_URL=http://localhost:8080/api      # target server
DELAY_MS=200                           # inter-request delay (ms)
```

---

## Env Config Validation

`.env.example` covers all variables needed for local operation:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | Yes (API server) | 8080 | Process entry throws if missing |
| `BASE_PATH` | Yes (API server) | /api | Express mount path |
| `DB_PATH` | No | `./control_plane.db` | Set to `./data/...` for persistence |
| `PROVIDER_MODE` | No | mock | mock / real / hybrid |
| `OPENAI_API_KEY` | No | — | Required for real GPT models |
| `ANTHROPIC_API_KEY` | No | — | Required for real Claude models |
| `DEFAULT_PROVIDER` | No | — | Reserved |
| `DEFAULT_MODEL` | No | mock-gpt-4 | Fallback when model not in catalog |

---

## Docker Build Validation

The `Dockerfile` uses a two-stage build:

1. **Build stage** — installs all workspace packages, runs `pnpm --filter @workspace/api-server run build` (esbuild → `dist/index.mjs`)
2. **Runtime stage** — copies only `dist/`, `node_modules/`, and `config/`; no dev dependencies

The `docker-compose.yml` wires:
- `api` service with health check (`/api/healthz`)
- `dashboard` service (depends on `api` being healthy)
- Named volume `db_data` mounted at `/data` for persistence

### Docker environment variable passthrough

All provider-mode env vars are passed from the host `.env` file via docker-compose `environment:` block with `${VAR:-default}` fallback syntax. No secrets are baked into the image.

---

## Makefile New Targets

| Target | Command | Notes |
|---|---|---|
| `make install` | `pnpm install` | Install all workspace packages |
| `make test-all` | All 3 test scripts | Must all pass (53 tests) |
| `make test-features` | `test_features.ts` | 24 feature tests |
| `make test-replay` | `test_replay.ts` | 7 replay tests |
| `make validate` | All tests + demo | Full CI check |
| `make reset-db` | Delete DB files | Local dev convenience |
| `make workload-coding` | Workload generator | 8 coding prompts |
| `make workload-incident` | Workload generator | 6 incident prompts |
| `make workload-support` | Workload generator | 6 support prompts |
| `make workload-security` | Workload generator | 6 security prompts |
| `make workload-enterprise` | Workload generator | 12 mixed enterprise prompts |
| `make docker-build` | `docker build` | Build Docker image |
| `make docker-up` | `docker compose up -d` | Start all services |
| `make docker-down` | `docker compose down` | Stop all services |

Existing targets (`test`, `demo`, `validate-demo`, `health`, `chat`, `metrics`, `traces`, `security-events`, `sessions`, `build`, `dev`) are unchanged.

---

## No Regressions

The following were explicitly verified as unchanged:

- `modules/gateway.ts` — no changes
- `modules/routing.ts` — no changes
- `modules/security.ts` — no changes
- `modules/policies.ts` — no changes
- `modules/evaluation.ts` — no changes
- `modules/storage.ts` — no changes
- `modules/cost-insights.ts` — no changes
- `modules/redteam.ts` — no changes
- `lib/api-spec/openapi.yaml` — no changes
- `config/policies.yaml` — no changes
- All route handlers — no changes
- Dashboard source — no changes
- All 3 test scripts — no changes

The only source file modified is `modules/providers.ts`. The change is fully backward compatible:
- Public interface `ProviderRequest`, `ProviderResponse`, `ModelConfig` unchanged
- `MODEL_CATALOG` unchanged (same 5 models, same pricing, same latency)
- `callProvider()` signature unchanged
- `calculateCost()` unchanged
- When `PROVIDER_MODE=mock` (default), code path is identical to original behavior
- The only addition is: real provider dispatch when `PROVIDER_MODE=real|hybrid` and API key is set

---

## Files Added / Modified

| File | Action | Notes |
|---|---|---|
| `artifacts/api-server/src/modules/providers.ts` | Modified | Real provider adapter added |
| `data/.gitkeep` | Added | Enables persistent local DB path |
| `.env.example` | Added | Local env template |
| `Dockerfile` | Added | Two-stage Node.js build |
| `docker-compose.yml` | Added | API + dashboard + persistent volume |
| `Makefile` | Modified | New targets added; existing unchanged |
| `scripts/src/generate_workload.ts` | Added | 5-type realistic workload generator |
| `README.md` | Added | Main project README |
| `docs/LOCAL_RUN.md` | Added | Complete local setup guide |
| `docs/PORTABILITY_VALIDATION.md` | Added | This document |
