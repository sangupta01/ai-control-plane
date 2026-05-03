# Hackathon Submission — AI Control Plane

## Project Name

**AI Control Plane**

## One-Liner

A production-grade AI gateway and observability platform that gives every LLM request security enforcement, policy control, cost tracking, eval scoring, and incident replay — with a full React dashboard.

## Longer Description

AI Control Plane is the infrastructure layer that sits between your application and every LLM you use. Instead of calling OpenAI or Anthropic directly, you call `/api/v1/chat` — and the platform handles everything else: blocking security threats before they reach the model, enforcing governance policies defined in YAML, routing to the right model based on session affinity and cost thresholds, scoring every response for quality, tracking cost at every level, and storing every trace for later replay and debugging.

The dashboard makes all of this visible in real time — security events by scanner class, full trace history with tags, session routing decisions, cost attribution by tenant, eval score trends, and an incident replay UI where you can re-run any historical request against a different model and see the side-by-side comparison.

## Problem

Teams shipping LLM-powered applications face a common set of ungoverned risks:

- **Security**: Prompt injections, PII in requests, leaked secrets, jailbreak attempts, and bulk data exfiltration attempts go unchecked when LLM calls happen directly in application code.
- **Cost**: Without per-request attribution and routing intelligence, teams overspend on expensive models for tasks that cheaper models handle equally well.
- **Quality**: There's no systematic way to measure whether LLM responses are relevant, safe, or hallucinating — especially at scale.
- **Debugging**: When an AI incident occurs (wrong response, unexpected behavior, policy violation), there's no way to reproduce it exactly, compare alternatives, or understand what the model received.
- **Governance**: Security and compliance teams can't enforce rules on LLM usage without instrumenting every call site in the codebase.

## Solution

AI Control Plane provides a single gateway endpoint that every LLM call routes through. The pipeline runs on every request in sequence:

1. **Security Scanner** — 5 parallel scanners check for PII, secrets, prompt injection, jailbreak patterns, and data exfiltration attempts
2. **Policy Engine** — 18 YAML rules map findings to enforcement actions (block, flag, allow) — hot-reloadable with zero downtime
3. **Session Router** — tracks model affinity per session; switches only when cost delta exceeds 1.5× threshold
4. **LLM Provider** — dispatches to mock or real provider (OpenAI, Anthropic); falls back gracefully
5. **Output Scanner** — scans the model response for leaked secrets or PII
6. **Eval Scorer** — heuristic scoring: relevance, safety, hallucination risk, groundedness
7. **Storage** — writes the full trace (request, response, findings, scores, cost, latency) to SQLite

The React dashboard consumes this data in real time. The Incident Replay feature lets you select any historical trace, pick a different model, and re-run it — the result shows model changed / response changed badges and a full eval diff.

## Tech Stack

| Layer | Technology |
|---|---|
| API Gateway | Node.js, Express, TypeScript |
| Storage | SQLite (better-sqlite3, WAL mode) |
| Frontend | React 18, Vite, TailwindCSS, TanStack Query |
| API Contract | OpenAPI 3.1 → Orval codegen (Zod + React Query hooks) |
| Monorepo | pnpm workspaces |
| Containerization | Docker + Docker Compose |
| Testing | Custom TypeScript test suites (53 tests, 3 suites) |
| Policy Engine | YAML rules, in-process hot reload |
| Security | 5-scanner pipeline (PII, secrets, injection, jailbreak, data exfil) |
| LLM Providers | Mock (default), OpenAI, Anthropic |

## Demo Script

**Live app:** https://autonomous-executor--santoshgupta14.replit.app/

1. Open **Demo Runner** → click **Run Full Demo** → 11 scenarios run in ~5 seconds; 7 pass, 4 blocked
2. Navigate to **Security** → see 5 scanner classes with distinct event counts (injection highest, data exfil lowest)
3. Navigate to **Traces** → click **Replay** on any trace → select a cheaper model → see side-by-side eval diff
4. Navigate to **Cost Insights** → see routing optimization suggestions (GPT-4 → GPT-3.5 saves ~80%)
5. Navigate to **Red Team** → click **Run Red Team** → 10 adversarial attacks, 100% block rate

Full narrated demo script: [docs/DEMO_SCRIPT.md](DEMO_SCRIPT.md)

## What Makes It Unique

**1. End-to-end pipeline in one process** — security, policy, routing, provider dispatch, output scan, eval, and storage all run synchronously in a single request cycle. No external queues, no separate microservices, no managed infrastructure required.

**2. AI Incident Replay** — not just logging, but replay. Any historical trace can be re-run with an alternate model, producing a linked trace with a computed eval diff. This is the feature that closes the "what actually happened?" loop in AI debugging.

**3. Policy-as-Code with hot reload** — security engineers define enforcement rules in YAML. A single API call reloads them in-process with no restart, no deployment, no application code changes.

**4. Weighted attack simulation** — the workload generator produces a realistic distribution of security events: more prompt injections than jailbreaks, more jailbreaks than PII events, fewer data exfiltration attempts — so the dashboard looks like real production traffic, not a toy demo.

**5. Zero external dependencies in mock mode** — the entire platform runs without any API keys, external services, or network access. Judges can evaluate the full system offline.

## Future Roadmap

- **Persistent event store** — write security events to the database so counts survive server restarts
- **Real-time threat feed** — Server-Sent Events push new security events to the dashboard without polling
- **Multi-model eval comparison** — run the same prompt against N models simultaneously and rank by eval score
- **Webhook alerts** — fire webhooks on critical security events for integration with PagerDuty, Slack, etc.
- **RBAC / tenant isolation** — per-tenant policy sets and access control for multi-team deployments
- **Gemini integration** — complete the third real provider alongside OpenAI and Anthropic
- **CI gate integration** — published GitHub Action that calls `/api/v1/redteam/run` and fails the build if pass rate drops
- **Streaming responses** — SSE streaming from the gateway to the client for real-time token delivery
