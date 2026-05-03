# Local Run Guide — AI Control Plane

This guide covers running the project on your Mac (or any Linux machine) without Replit. The Replit hosted demo is unaffected.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ (22 recommended) | `node --version` |
| pnpm | 10+ | `npm install -g pnpm@10` |
| Python 3 | Any | Used by `make` targets for JSON formatting (`python3 -m json.tool`) |
| Docker | 24+ | Optional — only needed for Docker mode |
| Docker Compose | v2 | Bundled with Docker Desktop on Mac |

Check your versions:
```bash
node --version
pnpm --version
python3 --version
docker --version
```

---

## Install Steps

```bash
# Clone or open the project
cd /path/to/ai-control-plane

# Install all workspace dependencies
make install
# or: pnpm install
```

---

## Environment Variables

Copy the example and configure for local use:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required for API server
PORT=8080
BASE_PATH=/api

# Persistent local database (recommended for local dev)
DB_PATH=./data/ai-control-plane.db

# Provider mode: mock (default), real, or hybrid
PROVIDER_MODE=mock

# Optional: real LLM API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Default model when none is specified
DEFAULT_MODEL=mock-gpt-4
```

**Important:** `.env` should never be committed. It is listed in `.gitignore`.

---

## Running the Backend

### Option A — Direct (recommended for development)

```bash
# Load env vars and start the server
set -a && source .env && set +a
PORT=8080 BASE_PATH=/api DB_PATH=./data/ai-control-plane.db \
  npx tsx artifacts/api-server/src/index.ts
```

Or after building:

```bash
pnpm --filter @workspace/api-server run build
PORT=8080 BASE_PATH=/api DB_PATH=./data/ai-control-plane.db \
  node --enable-source-maps artifacts/api-server/dist/index.mjs
```

The server starts on `http://localhost:8080`. Verify it:

```bash
curl http://localhost:8080/api/healthz
```

### Option B — Docker

```bash
make docker-build
make docker-up
```

API server: `http://localhost:8080/api/healthz`

---

## Running the Dashboard

The dashboard is a Vite dev server. It calls `/api` relative to its own origin — when running locally, you need to point it at the API server.

Because Vite proxies are not configured (the project uses path-based routing via a reverse proxy on Replit), the simplest approach locally is to run **both servers on the same port via a local reverse proxy**, or point the dashboard at the API port directly by setting `VITE_API_BASE_URL` if your dashboard version supports it.

**Simplest approach — run API on 8080, access dashboard through a simple proxy:**

```bash
# Terminal 1: API server
PORT=8080 BASE_PATH=/api DB_PATH=./data/ai-control-plane.db \
  node artifacts/api-server/dist/index.mjs

# Terminal 2: Dashboard
PORT=3000 BASE_PATH=/ \
  pnpm --filter @workspace/dashboard run dev
```

Then open `http://localhost:3000`. The dashboard will call `/api` — if you see 404 errors for API calls, you need to proxy `/api` to port 8080.

**Using `nginx` as a local proxy (optional but recommended):**

```nginx
server {
    listen 4000;
    location /api/ {
        proxy_pass http://localhost:8080;
    }
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

Start nginx and access everything at `http://localhost:4000`.

**Docker Compose (easiest for full local stack):**

```bash
make docker-up
# Dashboard: http://localhost:3000
# API: http://localhost:8080/api
```

---

## Running Tests

Tests read `API_URL` from the environment. Set it to your local API server:

```bash
# Run all 53 tests against local server
make test-all API_URL=http://localhost:8080/api

# Or run individually
make test         API_URL=http://localhost:8080/api   # 22 baseline
make test-features API_URL=http://localhost:8080/api  # 24 feature tests
make test-replay  API_URL=http://localhost:8080/api   # 7 replay tests
```

All 53 tests must pass before any commit.

---

## Running the Demo

```bash
make demo API_URL=http://localhost:8080/api
```

This runs all demo scenarios through the API and prints a summary. The Replit demo page in the dashboard calls the same underlying `POST /api/v1/demo/run` endpoint.

---

## Generating Realistic Workloads

The workload generator creates realistic multi-tenant, multi-model traffic so the dashboard has interesting data to show.

```bash
# Generate 8 coding assistant requests
make workload-coding API_URL=http://localhost:8080/api

# Generate 6 incident debugging requests
make workload-incident API_URL=http://localhost:8080/api

# Generate 12 mixed enterprise requests (default)
make workload-enterprise API_URL=http://localhost:8080/api

# All workload types
make workload-coding workload-incident workload-support \
     workload-security workload-enterprise \
     API_URL=http://localhost:8080/api
```

Control request pacing:
```bash
DELAY_MS=500 make workload-enterprise API_URL=http://localhost:8080/api
```

After running workloads, open the dashboard and explore:
- **Overview** — KPI cards and 24h time-series charts fill in
- **Traces** — STICKY / HIGH COST / PII tags appear on real prompts
- **Sessions** — per-tenant session affinity stats update
- **Evals** — scoring distribution across models

---

## Using Real Provider Mode

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Set in `.env`:
   ```bash
   PROVIDER_MODE=real
   OPENAI_API_KEY=sk-...
   ```
3. Restart the API server.
4. Send a request using `mock-gpt-4` or `mock-gpt-3.5` — these map to `gpt-4o-mini` and `gpt-3.5-turbo` respectively.

The gateway model names stay the same (`mock-gpt-4`, etc.) — the real provider adapter maps them internally.

### Anthropic

```bash
PROVIDER_MODE=real
ANTHROPIC_API_KEY=sk-ant-...
```

Models `mock-claude-3-opus` and `mock-claude-3-haiku` call the real Anthropic API.

### Hybrid Mode (recommended for mixed real/mock)

```bash
PROVIDER_MODE=hybrid
OPENAI_API_KEY=sk-...
```

In hybrid mode, models with matching API keys call real providers. Models without configured keys silently fall back to mock responses. This is useful when you have an OpenAI key but no Anthropic key — GPT models will be real, Claude models will be mock.

### Fallback Behavior

In all non-mock modes:
- If the API call fails (network error, quota exceeded, invalid key): falls back to mock, logs a warning
- If no key is set for the requested model: falls back to mock, logs a warning
- The API response structure is identical whether real or mock provider was used

---

## Persistent Database

By default, the SQLite database (`control_plane.db`) is created in the process working directory and disappears when:
- Replit container restarts (ephemeral by default)
- You run `make reset-db`

**For local persistence:**

```bash
# .env
DB_PATH=./data/ai-control-plane.db
```

The `data/` directory is included in the repo and not gitignored. The DB files are gitignored individually.

**Docker persistence:**

The Docker Compose config mounts a named volume (`db_data`) at `/data` inside the container. Data persists across `docker compose down` and `docker compose up` cycles. To wipe it:

```bash
docker compose down -v   # removes volumes too
```

**Reset without Docker:**

```bash
make reset-db
```

This deletes `data/ai-control-plane.db` and `artifacts/api-server/control_plane.db` (and WAL/SHM sidecars).

---

## Troubleshooting

### API server fails to start: "PORT environment variable is required"

The server requires `PORT` to be set. Always pass it explicitly:

```bash
PORT=8080 BASE_PATH=/api node artifacts/api-server/dist/index.mjs
```

### Dashboard shows blank data / "Failed to fetch"

The dashboard calls `/api/...` relative to its own origin. If the dashboard is on port 3000 and the API is on 8080, the browser will call `http://localhost:3000/api/...` which will 404.

Solutions:
1. Use Docker Compose (routes everything through one origin)
2. Set up a local nginx proxy (see Running the Dashboard section)
3. Temporarily set `VITE_API_BASE=http://localhost:8080` if you patch the dashboard's `customFetch.ts` base URL

### `pnpm install` fails with lockfile error

```bash
pnpm install --no-frozen-lockfile
```

### `better-sqlite3` native module error on Mac

```bash
pnpm rebuild better-sqlite3
```

If that fails, make sure your Node.js version matches what was used to compile the module:

```bash
node --version   # should be 20 or 22
```

### Docker: container exits immediately

Check logs:
```bash
docker compose logs api
```

Common cause: `PORT` or `BASE_PATH` not set. The Dockerfile sets defaults — if you override them via environment, ensure they are valid integers.

### Tests fail: "Connection refused"

The API server isn't running. Start it first, then run tests:

```bash
# Check if API is up
curl http://localhost:8080/api/healthz

# If not, start it
PORT=8080 BASE_PATH=/api node artifacts/api-server/dist/index.mjs &
sleep 2
make test-all API_URL=http://localhost:8080/api
```

### Policies not updating after editing `config/policies.yaml`

Hot-reload without restarting:

```bash
curl -s -X POST http://localhost:8080/api/v1/policies/reload | python3 -m json.tool
```

---

## Directory Reference

```
data/                          Persistent local database (gitkeep)
config/policies.yaml           Policy-as-Code rules (edit to change enforcement)
artifacts/api-server/src/      API server source
artifacts/dashboard/src/       Dashboard source
scripts/src/generate_workload.ts  Realistic workload generator
docs/DEMO_SCRIPT.md            3-minute demo walkthrough
docs/ARCHITECTURE_DIAGRAM.md   System architecture diagrams
docs/CODEBASE_GUIDE.md         Developer orientation guide
```
