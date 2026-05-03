# AI Control Plane

> **Production-grade AI Gateway + Full LLM Observability Platform**  
> Every LLM request flows through unified routing, security scanning, policy enforcement, eval scoring, cost tracking, and incident replay — with a dark-navy React dashboard showing it all live.

---

## Hackathon Demo

**Live app (no login, no API keys):**  
🔗 **https://autonomous-executor--santoshgupta14.replit.app/**

> Mock mode is the default — open the link, click "Demo Runner", and the full system runs in 5 seconds.

### Judge Path (under 2 minutes)

1. Open the live app → **Demo Runner** → click **Run Full Demo** — watch 11 scenarios execute (6 pass, 5 blocked)
2. Click **Traces** → click **Replay** on any row → change the model → see the eval diff
3. Click **Cost Insights** → review routing optimization suggestions
4. Click **Security** → see 5 scanner classes with distinct live event counts
5. Click **Red Team** → click **Run Red Team** → 10 adversarial attacks, 100% block rate

### 30-Second Value Prop

Most teams bolt LLM calls directly into application code with no visibility, no guardrails, and no recovery path when something goes wrong. **AI Control Plane** is the missing infrastructure layer — a self-contained gateway that gives every LLM request security enforcement, policy control, cost tracking, heuristic evaluation, and full replay capability, all in one place.

### 5-Step Demo Flow

| Step | Where | What you see |
|------|--------|-------------|
| 1 | **Demo Runner** → "Run Full Demo" | 11 scenarios execute: 6 pass, 5 blocked (injection, PII, secret, jailbreak, data exfil) |
| 2 | **Security** | 5 scanner classes with live event counts — prompt injection highest, data exfil lowest |
| 3 | **Traces** → click "Replay" on any trace | Replay against a cheaper model; side-by-side eval diff appears |
| 4 | **Cost Insights** | Routing optimization suggestions: GPT-4 → GPT-3.5 saves ~80% |
| 5 | **Red Team** → "Run Red Team" | 10 adversarial attacks, 100% block rate |

> **No API keys required — mock mode works by default.**  
> To use real providers: copy `.env.example` → `.env`, add your keys, set `PROVIDER_MODE=real`.

---

## Why This Matters

AI applications are moving to production faster than the tooling to govern them.  
Teams shipping LLM-powered products need:

- **Security** — stop prompt injections, PII leaks, secret exposure, and jailbreaks before they reach the model
- **Governance** — policy-as-code rules that security engineers control, not developers
- **Cost control** — per-request, per-session, and per-tenant cost attribution with routing optimization suggestions
- **Evaluation** — heuristic quality scoring on every response (relevance, safety, hallucination risk, groundedness)
- **Observability** — full trace history with tags, latency, token counts, and model used
- **Replay** — re-run any historical incident through a different model with side-by-side comparison

AI Control Plane is the **gateway layer** that provides all of this for production agent systems, without requiring changes to application code beyond pointing at `/api/v1/chat`.

---

## Judging Highlights

| Capability | What it does |
|---|---|
| **Unified LLM Gateway** | Single `/api/v1/chat` endpoint across 5 models; swap providers without changing app code |
| **Session Sticky Routing** | Affinity-based model routing; switches only when cost delta exceeds 1.5× threshold |
| **Security Guardrails** | 5 scanners: PII, secrets, prompt injection, jailbreak, data exfiltration — runs on every request |
| **Policy-as-Code** | 18 YAML rules, hot-reloadable via API with zero downtime |
| **Cost / Token Insights** | Top sessions, tenants, prompts ranked by spend; automated routing recommendations |
| **Eval Scoring** | Heuristic scoring on every response: relevance, safety, hallucination risk, groundedness |
| **AI Incident Replay** | Re-run any trace with an alternate model; shows eval diff and RESPONSE CHANGED badge |
| **Red Team Testing** | 10 adversarial scenarios; pass rate < 100% can gate CI deployments |
| **React Dashboard** | Dark-navy UI with traces, sessions, security events, evals, cost, policies, demo runner |

**53 automated tests across 3 suites — all passing.**

---

## Screenshots

### Overview Dashboard
![Overview](docs/screenshots/overview.jpg)

### Trace Explorer with Replay
![Session Replay](docs/screenshots/session-replay.jpg)

### Security Events — 5 Scanner Classes
![Security Events](docs/screenshots/security-events.jpg)

---

## What it does

| Capability | Details |
|---|---|
| **Unified LLM Gateway** | Single `/api/v1/chat` endpoint across 5 models |
| **Session Sticky Routing** | Affinity-based model routing with cost-aware switching |
| **Security Guardrails** | 5 scanners: PII, secrets, prompt injection, jailbreak, data exfiltration |
| **Policy-as-Code** | 18 YAML rules, hot-reloadable without restart |
| **Heuristic Eval Scoring** | Relevance, safety, hallucination risk, groundedness |
| **AI Incident Replay** | Re-run any historical trace with an alternate model; side-by-side eval diff |
| **Cost Insights** | Top sessions, tenants, prompts; routing optimization suggestions |
| **Red Team Testing** | Adversarial scenario runner with pass/fail tracking |
| **Full Observability Dashboard** | Dark-navy React UI with traces, sessions, evals, security events |

---

## Quick Verification

```bash
make install      # install all workspace dependencies
make dev          # start API server
make test-all     # run all 53 tests (22 + 24 + 7)
make demo         # run 11 demo scenarios
```

---

## Recommended: Run with Docker

The fastest way to run the full stack locally — one command starts both the API server and the dashboard, with persistent SQLite storage and automatic `.env` loading.

```bash
# 1. Copy and edit environment (only needed once)
cp .env.example .env

# 2. Build the API image (only needed after code changes)
make docker-build

# 3. Start API + dashboard
make docker-up
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API health | http://localhost:8080/api/healthz |

```bash
make docker-logs    # follow live logs (Ctrl+C to exit)
make docker-test    # run all 53 tests against the running stack
make docker-down    # stop everything
```

Full Docker guide: [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md)

---

## Other Run Modes

### Replit Hosted Demo (no setup needed)

The app runs live on Replit. Open the preview pane:
- **Dashboard** — `/` (React UI)
- **API** — `/api/healthz`

Everything uses mock providers by default — no API keys required.

### Local Mac Mode (pnpm, no Docker)

```bash
make install
cp .env.example .env

# Terminal 1 — API server
PORT=8080 BASE_PATH=/api npx tsx artifacts/api-server/src/index.ts

# Terminal 2 — Dashboard
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run dev

# Tests
make test-all API_URL=http://localhost:8080/api
```

Full walkthrough: [docs/LOCAL_RUN.md](docs/LOCAL_RUN.md)

---

## Provider Modes

Set `PROVIDER_MODE` in your `.env` file:

| Mode | Behavior | Keys needed |
|---|---|---|
| `mock` | Deterministic mock responses, simulated latency **(default)** | None |
| `real` | Calls real LLM APIs; falls back to mock if key missing or call fails | `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` |
| `hybrid` | Tries real providers first; silently falls back to mock | Same |

**Model mapping in real/hybrid mode:**

| Gateway model | Real provider model |
|---|---|
| `mock-gpt-4` | `gpt-4o-mini` (OpenAI) |
| `mock-gpt-3.5` | `gpt-3.5-turbo` (OpenAI) |
| `mock-claude-3-opus` | `claude-3-opus-20240229` (Anthropic) |
| `mock-claude-3-haiku` | `claude-3-haiku-20240307` (Anthropic) |
| `mock-gemini-pro` | falls back to mock (Gemini not yet integrated) |

---

## Persistent Database

By default on Replit the SQLite database lives in the process working directory and resets when the container restarts (ephemeral).

For persistent local storage:

```bash
# In .env:
DB_PATH=./data/ai-control-plane.db
```

The `data/` directory is included in the repo (via `.gitkeep`) and excluded from `.gitignore`. The Docker setup mounts a named volume at `/data` for persistence across container restarts.

---

## Quick Start Commands

```bash
make install          # Install all workspace dependencies
make dev              # Start API server (Replit workflow mode)
make test             # Run 22 baseline tests
make test-all         # Run all 53 tests
make validate         # Full validation: all tests + demo
make demo             # Run demo scenario suite
make reset-db         # Delete local database

# Workload generation
make workload-coding      # 8 coding assistant requests
make workload-incident    # 6 incident debugging requests
make workload-support     # 6 customer support requests
make workload-security    # 6 security analyst requests
make workload-enterprise  # 12 mixed enterprise requests

# API inspection (requires running server)
make health
make chat
make metrics
make traces

# Docker (recommended local path)
make docker-build         # build API image
make docker-up            # start API + dashboard
make docker-logs          # follow live logs
make docker-test          # run all 53 tests against Docker
make docker-down          # stop everything
```

All `make` targets that hit the API accept `API_URL=...` to override the target:

```bash
make test-all API_URL=http://localhost:8080/api
make workload-enterprise API_URL=http://localhost:8080/api
```

---

## Architecture

```
Browser → Dashboard (React + Vite)
              │ fetch /api/*
              ▼
         API Server (Express)
              │
         processRequest()
              ├─ Security Scanner (5 scanners)
              ├─ Policy Engine   (YAML rules)
              ├─ Session Router  (affinity)
              ├─ LLM Provider    (mock | real)
              ├─ Output Scanner
              ├─ Eval Scorer
              └─ SQLite Storage  (WAL mode)
```

Detailed diagrams: [docs/ARCHITECTURE_DIAGRAM.md](docs/ARCHITECTURE_DIAGRAM.md)  
Codebase walkthrough: [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md)  
Demo script: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)  
Local run guide: [docs/LOCAL_RUN.md](docs/LOCAL_RUN.md)  
Hackathon submission: [docs/SUBMISSION.md](docs/SUBMISSION.md)

---

## Test Results

| Suite | Tests | Status |
|---|---|---|
| Baseline (`test_suite.ts`) | 22 | ✓ All pass |
| Feature expansion (`test_features.ts`) | 24 | ✓ All pass |
| AI Incident Replay (`test_replay.ts`) | 7 | ✓ All pass |
| **Total** | **53** | **✓ 53/53** |

---

## Project Structure

```
artifacts/api-server/   Express backend (LLM gateway + observability API)
artifacts/dashboard/    React + Vite frontend
lib/api-spec/           OpenAPI contract → code generation source
lib/api-client-react/   Generated TanStack Query hooks
lib/api-zod/            Generated Zod validators
config/policies.yaml    Policy-as-Code rules (hot-reloadable)
scripts/src/            Integration tests and workload generator
data/                   Persistent SQLite storage (local mode)
docs/                   All documentation
```
