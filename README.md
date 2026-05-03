# AI Control Plane

A production-grade **AI Gateway + Full LLM Observability Platform**.  
Every LLM request runs through unified routing, security scanning, policy enforcement, and heuristic evaluation — with a full-featured React dashboard showing live traces, security events, session affinity, cost insights, and AI incident replay.

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

## Modes of Operation

### Replit Hosted Demo (no setup needed)

The app runs live on Replit. Open the preview pane:
- **Dashboard** — `/` (React UI)
- **API** — `/api/healthz`

Everything uses mock providers by default — no API keys required.

### Local Mac Mode (pnpm)

For local development without Docker:

```bash
# 1. Install dependencies
make install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set DB_PATH=./data/ai-control-plane.db at minimum

# 3. Start API server (in one terminal)
PORT=8080 BASE_PATH=/api npx tsx artifacts/api-server/src/index.ts

# 4. Start dashboard (in another terminal)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/dashboard run dev

# 5. Run tests
make test-all API_URL=http://localhost:8080/api
```

Full walkthrough: [docs/LOCAL_RUN.md](docs/LOCAL_RUN.md)

### Docker Mode (Mac / Linux)

```bash
cp .env.example .env   # configure PROVIDER_MODE, API keys, etc.
make docker-build
make docker-up

# API: http://localhost:8080/api/healthz
# Dashboard: http://localhost:3000
```

Stop with: `make docker-down`

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

# Docker
make docker-build
make docker-up
make docker-down
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
