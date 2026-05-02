import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "control_plane.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      latency_ms REAL NOT NULL DEFAULT 0,
      routing_decision TEXT,
      security_result TEXT,
      eval_scores TEXT,
      blocked INTEGER NOT NULL DEFAULT 0,
      block_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      scanner TEXT NOT NULL,
      severity TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      matched TEXT,
      prompt_excerpt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eval_results (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      relevance REAL NOT NULL DEFAULT 0,
      safety REAL NOT NULL DEFAULT 0,
      hallucination_risk REAL NOT NULL DEFAULT 0,
      groundedness REAL NOT NULL DEFAULT 0,
      overall REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      model TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      model_switches INTEGER NOT NULL DEFAULT 0,
      affinity_hits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_traces_session ON traces(session_id);
    CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_security_trace ON security_events(trace_id);
    CREATE INDEX IF NOT EXISTS idx_security_created ON security_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evals_trace ON eval_results(trace_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(last_active DESC);
  `);

  // Safe additive migrations — no-op if columns already exist
  try { db.exec(`ALTER TABLE traces ADD COLUMN replay_of_trace_id TEXT`); } catch (_) { /* already exists */ }
  try { db.exec(`ALTER TABLE traces ADD COLUMN is_replay INTEGER NOT NULL DEFAULT 0`); } catch (_) { /* already exists */ }
}

export function newId(): string {
  return uuidv4();
}

export interface TraceRow {
  id: string;
  session_id: string;
  tenant_id: string;
  model: string;
  prompt: string;
  response: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  routing_decision: string | null;
  security_result: string | null;
  eval_scores: string | null;
  blocked: number;
  block_reason: string | null;
  created_at: string;
  replay_of_trace_id?: string | null;
  is_replay?: number;
}

export interface SecurityEventRow {
  id: string;
  trace_id: string;
  session_id: string;
  scanner: string;
  severity: string;
  action: string;
  reason: string;
  matched: string | null;
  prompt_excerpt: string | null;
  created_at: string;
}

export interface EvalResultRow {
  id: string;
  trace_id: string;
  relevance: number;
  safety: number;
  hallucination_risk: number;
  groundedness: number;
  overall: number;
  created_at: string;
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  model: string;
  request_count: number;
  total_tokens: number;
  total_cost: number;
  model_switches: number;
  affinity_hits: number;
  created_at: string;
  last_active: string;
}

export const storage = {
  insertTrace(trace: Omit<TraceRow, "created_at">): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO traces (id, session_id, tenant_id, model, prompt, response,
        prompt_tokens, completion_tokens, total_tokens, cost, latency_ms,
        routing_decision, security_result, eval_scores, blocked, block_reason,
        replay_of_trace_id, is_replay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trace.id, trace.session_id, trace.tenant_id, trace.model,
      trace.prompt, trace.response,
      trace.prompt_tokens, trace.completion_tokens, trace.total_tokens,
      trace.cost, trace.latency_ms,
      trace.routing_decision, trace.security_result, trace.eval_scores,
      trace.blocked ? 1 : 0, trace.block_reason ?? null,
      trace.replay_of_trace_id ?? null, trace.is_replay ?? 0,
    );
  },

  getTraces(opts: { limit?: number; offset?: number; session_id?: string; model?: string }): { rows: TraceRow[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.session_id) { conditions.push("session_id = ?"); params.push(opts.session_id); }
    if (opts.model) { conditions.push("model = ?"); params.push(opts.model); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (db.prepare(`SELECT COUNT(*) as count FROM traces ${where}`).get(...params) as { count: number }).count;
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const rows = db.prepare(`SELECT * FROM traces ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as TraceRow[];
    return { rows, total };
  },

  getTraceById(id: string): TraceRow | null {
    const db = getDb();
    return (db.prepare("SELECT * FROM traces WHERE id = ?").get(id) as TraceRow | undefined) ?? null;
  },

  insertSecurityEvent(ev: Omit<SecurityEventRow, "created_at">): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO security_events (id, trace_id, session_id, scanner, severity, action, reason, matched, prompt_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ev.id, ev.trace_id, ev.session_id, ev.scanner, ev.severity, ev.action, ev.reason, ev.matched ?? null, ev.prompt_excerpt ?? null);
  },

  getSecurityEvents(opts: { limit?: number; severity?: string }): { rows: SecurityEventRow[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.severity) { conditions.push("severity = ?"); params.push(opts.severity); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (db.prepare(`SELECT COUNT(*) as count FROM security_events ${where}`).get(...params) as { count: number }).count;
    const limit = opts.limit ?? 50;
    const rows = db.prepare(`SELECT * FROM security_events ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit) as SecurityEventRow[];
    return { rows, total };
  },

  insertEvalResult(ev: Omit<EvalResultRow, "created_at">): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO eval_results (id, trace_id, relevance, safety, hallucination_risk, groundedness, overall)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ev.id, ev.trace_id, ev.relevance, ev.safety, ev.hallucination_risk, ev.groundedness, ev.overall);
  },

  getEvals(opts: { limit?: number; trace_id?: string }): { rows: EvalResultRow[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.trace_id) { conditions.push("trace_id = ?"); params.push(opts.trace_id); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (db.prepare(`SELECT COUNT(*) as count FROM eval_results ${where}`).get(...params) as { count: number }).count;
    const limit = opts.limit ?? 50;
    const rows = db.prepare(`SELECT * FROM eval_results ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit) as EvalResultRow[];
    return { rows, total };
  },

  upsertSession(session: Omit<SessionRow, "created_at" | "last_active">): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO sessions (id, tenant_id, model, request_count, total_tokens, total_cost, model_switches, affinity_hits)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model = excluded.model,
        request_count = excluded.request_count,
        total_tokens = excluded.total_tokens,
        total_cost = excluded.total_cost,
        model_switches = excluded.model_switches,
        affinity_hits = excluded.affinity_hits,
        last_active = datetime('now')
    `).run(session.id, session.tenant_id, session.model, session.request_count, session.total_tokens, session.total_cost, session.model_switches, session.affinity_hits);
  },

  getSession(id: string): SessionRow | null {
    const db = getDb();
    return (db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined) ?? null;
  },

  getSessions(opts: { limit?: number }): { rows: SessionRow[]; total: number } {
    const db = getDb();
    const total = (db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
    const limit = opts.limit ?? 50;
    const rows = db.prepare("SELECT * FROM sessions ORDER BY last_active DESC LIMIT ?").all(limit) as SessionRow[];
    return { rows, total };
  },

  getMetricsSummary() {
    const db = getDb();
    const agg = db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked_requests
      FROM traces
    `).get() as { total_requests: number; total_tokens: number; total_cost: number; avg_latency_ms: number; blocked_requests: number };

    const secCount = (db.prepare("SELECT COUNT(*) as c FROM security_events").get() as { c: number }).c;
    const avgEval = (db.prepare("SELECT AVG(overall) as avg FROM eval_results").get() as { avg: number | null }).avg ?? 0;

    const sessionStats = db.prepare(`
      SELECT
        SUM(affinity_hits) as hits,
        SUM(request_count) as total
      FROM sessions
    `).get() as { hits: number | null; total: number | null };
    const affinityRate = sessionStats.total ? (sessionStats.hits ?? 0) / sessionStats.total : 0;

    const perModel = db.prepare("SELECT model, COUNT(*) as cnt FROM traces GROUP BY model").all() as { model: string; cnt: number }[];
    const perTenant = db.prepare("SELECT tenant_id, COUNT(*) as cnt FROM traces GROUP BY tenant_id").all() as { tenant_id: string; cnt: number }[];

    const last24h = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:00', created_at) as hour,
        COUNT(*) as count,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(cost), 0) as cost
      FROM traces
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour ASC
    `).all() as { hour: string; count: number; tokens: number; cost: number }[];

    return {
      ...agg,
      security_events_count: secCount,
      avg_eval_score: avgEval,
      session_affinity_rate: affinityRate,
      requests_per_model: Object.fromEntries(perModel.map(r => [r.model, r.cnt])),
      requests_per_tenant: Object.fromEntries(perTenant.map(r => [r.tenant_id, r.cnt])),
      requests_last_24h: last24h,
    };
  },
};
