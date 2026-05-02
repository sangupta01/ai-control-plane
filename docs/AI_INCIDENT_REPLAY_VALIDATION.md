# AI Incident Replay — Validation Report

**Date:** 2026-05-02  
**Status: COMPLETE — 53/53 tests pass, 0 regressions**

---

## Summary

| Suite | Tests | Result |
|---|---|---|
| Original baseline (`test_suite.ts`) | 22 | 22/22 PASS |
| Feature expansion (`test_features.ts`) | 24 | 24/24 PASS |
| AI Incident Replay (`test_replay.ts`) | 7 | 7/7 PASS |
| **Total** | **53** | **53/53 PASS** |

Regressions against lockdown baseline: **0**

---

## New Endpoint

```
POST /api/v1/traces/:id/replay
```

**Request body** (all fields optional):
```json
{
  "override_model": "mock-claude-3-haiku",
  "override_routing_strategy": "string (accepted, reserved)"
}
```

**Response shape:**
```json
{
  "original_trace": { ...traceFields },
  "replay_trace":   { ...traceFields, "replay_of_trace_id": "<id>", "is_replay": true },
  "diff": {
    "response_changed": true,
    "model_changed": true,
    "routing_changed": false,
    "eval_diff": {
      "relevance":    0.012,
      "safety":       0.000,
      "hallucination": 0.005,
      "groundedness": -0.003
    }
  }
}
```

Returns **404** if the original trace ID does not exist.

---

## Implementation — Files Changed

All changes are **additive only**. No existing HTTP routes, response shapes, or module logic were altered.

### `artifacts/api-server/src/modules/storage.ts`
- Added two safe `ALTER TABLE` migrations in `initSchema` (try/catch, no-op if columns already exist):
  ```sql
  ALTER TABLE traces ADD COLUMN replay_of_trace_id TEXT
  ALTER TABLE traces ADD COLUMN is_replay INTEGER NOT NULL DEFAULT 0
  ```
- Extended `TraceRow` interface with optional `replay_of_trace_id?: string | null` and `is_replay?: number`
- Updated `insertTrace` INSERT to include both new columns (defaults to `null` / `0` for all existing callers)

### `artifacts/api-server/src/modules/gateway.ts`
- Added optional `replay_of_trace_id?: string` to `GatewayRequest` interface
- Threaded the field into both `insertTrace` calls (blocked path and normal path), setting `is_replay: 1` when present

### `artifacts/api-server/src/routes/v1/replay.ts` *(new)*
- Single `POST /v1/traces/:id/replay` handler
- Fetches original trace → 404 if missing
- Calls existing `processRequest()` from `gateway.ts` with original prompt, metadata, and optional model override
- When `override_model` is supplied, a fresh session ID is used so sticky routing doesn't suppress the override
- Reads the newly stored replay trace back from storage to return full trace fields
- Computes diff: `response_changed`, `model_changed`, `routing_changed`, per-dimension `eval_diff`

### `artifacts/api-server/src/routes/index.ts`
- Added `import replayRouter` and `router.use(replayRouter)` — one import, one mount line

### `scripts/src/test_replay.ts` *(new)*
- 7 tests covering all required assertions

---

## Replay Test Results (7/7)

```
══════════════════════════════════════════════════
  AI Incident Replay Tests
══════════════════════════════════════════════════

  ✓ Replay endpoint returns 200
  ✓ Replay returns original_trace, replay_trace and diff
  ✓ Replay creates a new trace in storage
  ✓ Replay trace links back to original via replay_of_trace_id
  ✓ Replay diff has all required fields
  ✓ Replay with override_model uses specified model
  ✓ Replay of nonexistent trace returns 404

  Results: 7 passed  0 failed  / 7 total
```

---

## Observability Fields on Replay Traces

Every replay trace stored in the `traces` table includes:

| Field | Type | Value |
|---|---|---|
| `replay_of_trace_id` | `TEXT` | ID of the original trace being replayed |
| `is_replay` | `INTEGER` | `1` for replay traces, `0` for all others |

These fields are returned by `GET /api/v1/traces` and `GET /api/v1/traces/:id` automatically (no route changes required — SQLite `SELECT *` picks them up).

---

## Existing Module Reuse

| Module | How Used in Replay |
|---|---|
| `gateway.processRequest()` | Full pipeline: security scan → routing → provider → eval → storage |
| `routing.routeRequest()` | Called inside `processRequest`; respects `override_model` via fresh session |
| `evaluation.evaluate()` | Called inside `processRequest`; eval scores diffed in replay response |
| `security.runSecurityScan()` | Called inside `processRequest`; replay can be blocked if original prompt matches |
| `storage.insertTrace()` | Called inside `processRequest` with new `replay_of_trace_id` / `is_replay` fields |
| `storage.getTraceById()` | Used to fetch original trace and to read back the stored replay trace |

No logic was duplicated.

---

## How to Re-run

```bash
# All 53 tests
API_URL=http://localhost:80/api npx tsx scripts/src/test_suite.ts
API_URL=http://localhost:80/api npx tsx scripts/src/test_features.ts
API_URL=http://localhost:80/api npx tsx scripts/src/test_replay.ts

# Quick manual replay (replace <trace_id> with a real ID from GET /api/v1/traces)
curl -s -X POST http://localhost:80/api/v1/traces/<trace_id>/replay \
  -H "Content-Type: application/json" \
  -d '{"override_model":"mock-claude-3-haiku"}' | jq '{model_changed:.diff.model_changed, eval_diff:.diff.eval_diff}'
```
