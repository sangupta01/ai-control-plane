# Assumptions

## Build Date
May 2, 2026

## Provider
- All AI providers are mock (deterministic). No real API keys required.
- Mock providers simulate GPT-4, GPT-3.5, Claude Opus/Haiku, Gemini Pro with realistic latency, token counts, and cost.
- Real providers can be added via env vars in the future.

## Storage
- SQLite via better-sqlite3. File stored at `control_plane.db` in the server working directory.
- WAL mode enabled for concurrent reads.

## Security
- Pattern-based regex scanners for PII, secrets, injection, jailbreak, data exfiltration.
- No ML-based classification (would require external model).

## Session Routing
- Session affinity determined by cost comparison: `effective_cost = model_cost + cache_miss_penalty + latency_penalty`.
- Sticky routing maintained unless switching saves >33% effective cost.

## Evaluation
- Heuristic scoring (regex + keyword density). Not ML-based.
- Scores are deterministic + small noise for realism.

## Dashboard
- React + Vite SPA using generated API hooks (React Query).
- Polls metrics every 10s for live updates.
