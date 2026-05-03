# Workload Streaming Guide — AI Control Plane

Continuous workload streaming creates realistic, persistent LLM traffic so the dashboard updates live — traces accumulate, session affinity builds up, security events appear, and eval scores trend over time.

---

## Two Ways to Stream

| Method | Best for |
|---|---|
| **Script** (`stream_workload.ts`) | Local Mac, CI, controlled benchmarks |
| **Dashboard widget** | Quick browser-based start/stop during demos |
| **API endpoint** (`POST /api/v1/workload/start`) | Programmatic control, integration with other tools |

All three use the same mock providers by default. Real providers require an explicit `PROVIDER_MODE=real` env var.

---

## Workload Profiles

| Profile | Models | Tenants | Prompt style |
|---|---|---|---|
| `coding_assistant` | mock-gpt-4, mock-gpt-3.5 | eng-frontend, eng-backend, eng-infra | TypeScript, React, system design |
| `incident_debugging` | mock-claude-3-opus, mock-gpt-4 | ops-primary, ops-sre, ops-platform | P1 triage, runbooks, root cause |
| `customer_support` | mock-gpt-3.5, mock-claude-3-haiku | support-tier1, support-tier2, support-enterprise | Billing, onboarding, integration help |
| `security_analyst` | mock-claude-3-opus, mock-gpt-4 | security-red, security-compliance | Threat modeling, CVEs, code review |
| `mixed_enterprise` | all 5 models | 7 tenant teams | All of the above, rotated |

Each profile generates realistic, domain-appropriate prompts. Multi-user session pools are maintained per profile so session affinity routing is exercised realistically.

---

## Quick Start — Script

```bash
# 5-minute mixed enterprise stream at 10 req/min, 10% attack rate (default)
npx tsx scripts/src/stream_workload.ts

# Explicit options
npx tsx scripts/src/stream_workload.ts \
  --profile mixed_enterprise \
  --duration 10m \
  --rpm 30 \
  --attack-rate 0.15 \
  --api-url http://localhost:80/api

# Preview payloads without sending (dry-run)
npx tsx scripts/src/stream_workload.ts \
  --profile coding_assistant \
  --dry-run

# Run forever until Ctrl+C
npx tsx scripts/src/stream_workload.ts \
  --profile incident_debugging \
  --duration 0 \
  --rpm 20
```

---

## Makefile Targets

```bash
# Default: mixed_enterprise, 5m, 10 rpm, 10% attacks
make stream

# Profile-specific streams (5m, 10 rpm)
make stream-coding
make stream-incident
make stream-support
make stream-security
make stream-enterprise

# Override API URL
make stream API_URL=http://localhost:8080/api

# Override duration and rpm
make stream STREAM_DURATION=10m STREAM_RPM=20

# Dry-run (no requests sent)
make stream-dry-run
```

---

## CLI Options Reference

| Option | Default | Description |
|---|---|---|
| `--profile` | `mixed_enterprise` | Workload profile (see table above) |
| `--duration` | `5m` | Duration: `30s`, `5m`, `1h`, `0`/`forever` |
| `--rpm` | `10` | Requests per minute (1–120) |
| `--attack-rate` | `0.10` | Fraction of adversarial requests (0.0–1.0) |
| `--api-url` | `http://localhost:80/api` | API server base URL |
| `--dry-run` | off | Print payloads, do not send requests |

**Environment variable override for API URL:**
```bash
API_URL=http://localhost:8080/api npx tsx scripts/src/stream_workload.ts --profile coding_assistant
```

---

## Live Stats Output

While streaming, a single updating line shows:

```
● LIVE  2m14s | 2m46s left  mixed_enterprise  9.8 req/min (target 10)
        sent=22  blocked=3 (13.6%)  flagged=1  attack=13.6%
```

On completion, a full summary is printed:

```
Duration   : 5m0s
Sent       : 50 requests
Blocked    : 7 (14.0%)
Flagged    : 4 (8.0%)
Attacks    : 7 (14.0%)
Avg latency: 294ms
Actual RPM : 10.0
```

Press `Ctrl+C` at any time for a clean shutdown with final stats.

---

## Attack Rate

Setting `--attack-rate 0.15` means 15% of requests use adversarial prompts designed to trigger the security scanners:

| Attack type | Scanner triggered | Expected action |
|---|---|---|
| Prompt injection | `prompt_injection` | block |
| Jailbreak | `jailbreak` | block |
| PII (SSN, credit card) | `pii` | block |
| Secrets (AWS key, private key) | `secrets` | block |
| Data exfiltration | `data_exfiltration` | block / flag |

All blocked requests still produce a trace row with `blocked=1`. You can see them in the Traces page with the **BLOCKED** tag.

Safe defaults:
- Default attack rate: 10% — generates interesting security events without overwhelming the security page
- Maximum accepted via API: 100% (all attacks, useful for red-team testing)
- Maximum accepted via dashboard widget: 50% (capped to prevent accidental overload)

---

## Dashboard Widget

The sidebar shows a live workload status indicator at all times:

- **Idle state**: "Workload: idle" — click to expand and configure
- **Running state**: pulsing green dot, profile, actual rpm, block rate

**Start from the dashboard:**
1. Click the workload widget in the sidebar (bottom, above version number)
2. Select a profile, set RPM (1–60) and attack % (0–50)
3. Click "Start Stream"
4. Navigate to Traces, Sessions, or Security to watch live updates
5. Click "Stop Workload" when done

The dashboard polls `GET /api/v1/workload/status` every 3 seconds.

---

## API Endpoints

The workload runs in-process inside the API server (no external processes). One workload stream can run at a time.

### Start

```bash
curl -s -X POST http://localhost:80/api/v1/workload/start \
  -H "Content-Type: application/json" \
  -d '{"profile":"mixed_enterprise","rpm":20,"attack_rate":0.15}' | jq
```

Response:
```json
{
  "status": "started",
  "profile": "mixed_enterprise",
  "rpm": 20,
  "attack_rate": 0.15,
  "interval_ms": 3000,
  "started_at": "2026-05-03T12:00:00.000Z"
}
```

Returns `409` if already running.

### Status

```bash
curl -s http://localhost:80/api/v1/workload/status | jq
```

Response:
```json
{
  "running": true,
  "profile": "mixed_enterprise",
  "rpm": 20,
  "attack_rate": 0.15,
  "started_at": "2026-05-03T12:00:00.000Z",
  "elapsed_seconds": 47,
  "total_sent": 15,
  "total_blocked": 2,
  "total_flagged": 1,
  "total_errors": 0,
  "actual_rpm": 19.1,
  "block_rate": 13.3
}
```

### Stop

```bash
curl -s -X POST http://localhost:80/api/v1/workload/stop | jq
```

---

## Replit Usage

On Replit, the API server runs at `http://localhost:80/api` (proxied through the shared reverse proxy). The workload script runs in a terminal tab.

**From the Replit shell:**

```bash
# 5-minute demo workload
make stream

# Custom: 10 minutes, 20 rpm, 20% attacks
API_URL=http://localhost:80/api npx tsx scripts/src/stream_workload.ts \
  --profile mixed_enterprise \
  --duration 10m \
  --rpm 20 \
  --attack-rate 0.20

# Or use the dashboard widget — no shell needed
```

**From the dashboard widget** (no shell needed):
1. Open the dashboard preview
2. Click the workload widget at the bottom of the sidebar
3. Configure and click "Start Stream"
4. The API server runs the workload in-process

---

## Local Mac Usage

```bash
# Start API server (Terminal 1)
PORT=8080 BASE_PATH=/api DB_PATH=./data/ai-control-plane.db \
  node artifacts/api-server/dist/index.mjs

# Run stream (Terminal 2)
make stream API_URL=http://localhost:8080/api

# Or with all options
npx tsx scripts/src/stream_workload.ts \
  --profile incident_debugging \
  --duration 15m \
  --rpm 15 \
  --attack-rate 0.20 \
  --api-url http://localhost:8080/api
```

---

## Safe Limits

| Parameter | Script max | Dashboard max | API max |
|---|---|---|---|
| RPM | 120 | 60 | 60 |
| Attack rate | 100% | 50% | 100% |
| Concurrent streams | 1 | 1 | 1 |

**Provider mode safety:**
- Default is always `mock` — no external API calls, no costs
- Real providers are only called when `PROVIDER_MODE=real` or `hybrid` is set AND an API key is present
- The workload script checks `PROVIDER_MODE` environment variable; it does not override it
- Use `PROVIDER_MODE=mock` (or leave unset) for all demo and load-testing scenarios

**Resource usage (mock mode):**
- Each request: ~200–1500ms simulated latency, <5ms CPU, <1ms DB write
- At 30 rpm: ~1 request every 2 seconds, negligible server load
- At 60 rpm: ~1 request per second, still comfortable on Replit free tier

**Recommended safe limits for Replit free tier:**
- Duration: up to 10 minutes
- RPM: 10–20 (default is 10)
- Attack rate: 10–20%

---

## Example Demo Flow

A suggested 5-minute live demo sequence that fills the dashboard with interesting data:

```bash
# 1. Start enterprise stream (background via dashboard widget or script)
make stream  # mixed_enterprise, 10rpm, 10% attacks

# 2. While streaming, run the full demo suite to add specific scenario traces
make demo

# 3. After 2-3 minutes, stop the stream
# (Ctrl+C if using script, or click "Stop Workload" in dashboard)

# 4. Show the dashboard:
#    Overview   — time-series chart has 20-30 data points
#    Traces     — BLOCKED, STICKY, PII, INJECTION tags visible
#    Sessions   — multiple tenants with affinity hits
#    Security   — security events from attack prompts
#    Evals      — eval score distribution across models
```

---

## Running Tests

```bash
# Run workload generator tests (13 tests)
make test-workload API_URL=http://localhost:80/api

# Or directly
API_URL=http://localhost:80/api npx tsx scripts/src/test_workload.ts
```

Tests cover: payload structure validation, session pool behavior, duration parser, dry-run mode, attack prompt format, and the full workload API lifecycle (start → status → 409 conflict → stop → idle confirmation → traces produced).
