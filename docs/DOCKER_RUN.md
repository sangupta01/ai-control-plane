# Docker Run Guide — AI Control Plane

Run the full AI Control Plane stack locally using Docker Compose. This is the **recommended path** for local development and validation — no Node.js or pnpm install required on the host.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker | 24+ | [docker.com/get-started](https://www.docker.com/get-started) |
| Docker Compose | v1 or v2 | Bundled with Docker Desktop; or `brew install docker-compose` |
| make | any | Pre-installed on Mac/Linux |

Verify:
```bash
docker --version

# Either of these must work:
docker compose version    # v2 plugin (Docker Desktop 3.6+)
docker-compose --version  # v1 standalone
```

> **Compatibility:** The Makefile auto-detects whether `docker compose` (v2 plugin) or `docker-compose` (v1 standalone) is available and uses whichever one is present.

---

## Quick Start (3 commands)

```bash
# 1. Copy and configure environment (only needed once)
cp .env.example .env

# 2. Build the API server image (only needed after code changes)
make docker-build

# 3. Start both services
make docker-up
```

**Services:**

| Service | URL | Notes |
|---|---|---|
| Dashboard | http://localhost:3000 | React UI — starts after API is healthy |
| API Server | http://localhost:8080/api/healthz | Express — returns `{"status":"ok"}` |

The dashboard connects to the API via an internal Vite proxy — no manual URL configuration needed.

---

## Daily Workflow

```bash
make docker-up      # start (detached — runs in background)
make docker-logs    # follow live logs from all containers (Ctrl+C to exit)
make docker-test    # run all 53 tests against the running stack
make docker-down    # stop and remove containers
```

### Running tests against Docker

With both containers running:

```bash
make docker-test
```

This runs all three test suites against `http://localhost:8080/api`:

```
Running all 53 tests against Docker API (http://localhost:8080/api)...
  ✓ Baseline suite:          22/22
  ✓ Feature expansion suite: 24/24
  ✓ AI Incident Replay suite: 7/7
All 53 tests PASSED against Docker
```

You can also run individual suites or quick checks:

```bash
make health API_URL=http://localhost:8080/api
make chat   API_URL=http://localhost:8080/api
make test   API_URL=http://localhost:8080/api
make test-all API_URL=http://localhost:8080/api
```

---

## Environment Variables

All variables flow from your `.env` file into the API container automatically.

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `PROVIDER_MODE` | `mock` | `mock`, `real`, or `hybrid` |
| `OPENAI_API_KEY` | _(empty)_ | Required for real OpenAI calls |
| `ANTHROPIC_API_KEY` | _(empty)_ | Required for real Anthropic calls |
| `DEFAULT_MODEL` | `mock-gpt-4` | Default model when none specified |

The `PORT`, `BASE_PATH`, `DB_PATH`, and `NODE_ENV` variables are set by `docker-compose.yml` and should not be overridden in `.env` for Docker mode.

### Using real providers

```bash
# In .env
PROVIDER_MODE=real
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Then rebuild and restart:

```bash
make docker-down
make docker-build
make docker-up
```

---

## Persistent SQLite Storage

The database lives in a named Docker volume (`db_data`) mounted at `/data` inside the API container. Data persists across `docker-down` / `docker-up` cycles.

```bash
# Reset the database (deletes the Docker volume)
docker compose down -v
make docker-up
```

To inspect the database file directly:

```bash
docker compose exec api sh -c "ls -lh /data/"
```

---

## How the Services Connect

```
Your browser
    │  http://localhost:3000
    ▼
Dashboard container (Vite dev server, port 3000)
    │  /api/* requests proxied → http://api:8080
    ▼
API container (Express, port 8080)
    │
    ▼
SQLite volume (/data/ai-control-plane.db)
```

The Vite dev server is configured with `API_PROXY_TARGET=http://api:8080` by `docker-compose.yml`. All `/api/*` requests from the browser are transparently forwarded to the API container using Docker's internal DNS. No CORS configuration or manual URL changes are needed.

---

## Troubleshooting

### Dashboard shows "API not reachable" or blank data

The dashboard waits for the API to pass its health check before starting. If the API is slow to initialize:

```bash
make docker-logs
# Watch for: "API Server listening on port 8080"
```

Then refresh http://localhost:3000.

### Port conflicts

If ports 3000 or 8080 are already in use:

```bash
# Check what's using the port
lsof -i :3000
lsof -i :8080
```

Stop the conflicting process or change the host port in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"   # change left side only
```

### Image rebuild after code changes

The API container runs the production build. After changing API server code:

```bash
make docker-down
make docker-build
make docker-up
```

The dashboard container mounts the source tree directly, so dashboard code changes take effect immediately (Vite HMR).

### Resetting everything

```bash
docker compose down -v        # stop containers + delete volumes
docker rmi ai-control-plane   # remove the built image
make docker-build             # rebuild from scratch
make docker-up
```

---

## What docker-compose.yml Does

```yaml
services:
  api:
    build: .                          # uses Dockerfile in repo root
    ports: ["8080:8080"]
    env_file: [{path: .env, required: false}]   # loads your .env
    volumes:
      - db_data:/data                 # persistent SQLite
      - ./config:/app/config:ro       # hot-reloadable policy YAML
    healthcheck: ...                  # waits until /api/healthz returns 200

  dashboard:
    image: node:22-slim               # no build step — mounts source live
    command: pnpm --filter @workspace/dashboard run dev
    environment:
      API_PROXY_TARGET: http://api:8080   # Vite proxies /api/* here
    depends_on:
      api: {condition: service_healthy}   # starts only after API is up

volumes:
  db_data:          # named volume — persists across restarts
  dashboard_modules: # cached node_modules inside container
```
