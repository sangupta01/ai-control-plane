import { getDb } from "./storage.js";

export interface TopSession {
  session_id: string;
  tenant_id: string;
  model: string;
  total_cost: number;
  total_tokens: number;
  request_count: number;
}

export interface TopTenant {
  tenant_id: string;
  total_cost: number;
  total_tokens: number;
  request_count: number;
  avg_cost_per_request: number;
}

export interface TopPrompt {
  trace_id: string;
  prompt_excerpt: string;
  model: string;
  cost: number;
  total_tokens: number;
  tenant_id: string;
  created_at: string;
}

export interface RoutingOptimization {
  current_model: string;
  suggested_model: string;
  potential_savings_pct: number;
  reason: string;
}

export interface CostInsights {
  top_sessions: TopSession[];
  top_tenants: TopTenant[];
  top_prompts: TopPrompt[];
  model_switch_count: number;
  estimated_cache_preserved: number;
  estimated_cache_miss_cost: number;
  total_wasted_cost: number;
  suggested_optimizations: RoutingOptimization[];
  generated_at: string;
}

const MODEL_CHEAPER_ALTERNATIVES: Record<string, { model: string; savings_pct: number; reason: string }> = {
  "mock-gpt-4": { model: "mock-gpt-3.5", savings_pct: 80, reason: "GPT-3.5 is 80% cheaper for simple queries" },
  "mock-claude-3-opus": { model: "mock-claude-3-haiku", savings_pct: 75, reason: "Claude Haiku is 75% cheaper for most tasks" },
  "mock-gpt-3.5": { model: "mock-gemini-pro", savings_pct: 30, reason: "Gemini Pro offers competitive pricing" },
};

export function getCostInsights(): CostInsights {
  const db = getDb();

  const topSessions = db.prepare(`
    SELECT
      t.session_id,
      t.tenant_id,
      t.model,
      SUM(t.cost) as total_cost,
      SUM(t.total_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM traces t
    WHERE t.blocked = 0
    GROUP BY t.session_id
    ORDER BY total_cost DESC
    LIMIT 10
  `).all() as TopSession[];

  const topTenants = (db.prepare(`
    SELECT
      tenant_id,
      SUM(cost) as total_cost,
      SUM(total_tokens) as total_tokens,
      COUNT(*) as request_count,
      AVG(cost) as avg_cost_per_request
    FROM traces
    WHERE blocked = 0
    GROUP BY tenant_id
    ORDER BY total_cost DESC
    LIMIT 10
  `).all() as Array<TopTenant & { avg_cost_per_request: number }>).map(r => ({
    ...r,
    avg_cost_per_request: r.avg_cost_per_request ?? 0,
  }));

  const topPromptsRaw = db.prepare(`
    SELECT
      id as trace_id,
      prompt,
      model,
      cost,
      total_tokens,
      tenant_id,
      created_at
    FROM traces
    WHERE blocked = 0
    ORDER BY cost DESC
    LIMIT 10
  `).all() as Array<{ trace_id: string; prompt: string; model: string; cost: number; total_tokens: number; tenant_id: string; created_at: string }>;

  const topPrompts: TopPrompt[] = topPromptsRaw.map(r => ({
    trace_id: r.trace_id,
    prompt_excerpt: r.prompt.substring(0, 120) + (r.prompt.length > 120 ? "…" : ""),
    model: r.model,
    cost: r.cost,
    total_tokens: r.total_tokens,
    tenant_id: r.tenant_id,
    created_at: r.created_at,
  }));

  const switchCount = (db.prepare(`
    SELECT COALESCE(SUM(model_switches), 0) as cnt FROM sessions
  `).get() as { cnt: number }).cnt;

  const affinityStats = db.prepare(`
    SELECT
      COALESCE(SUM(affinity_hits), 0) as hits,
      COALESCE(SUM(request_count), 0) as total
    FROM sessions
  `).get() as { hits: number; total: number };

  const avgCostPerRequest = (db.prepare(`
    SELECT AVG(cost) as avg FROM traces WHERE blocked = 0
  `).get() as { avg: number | null }).avg ?? 0;

  const cacheMissRate = affinityStats.total > 0
    ? (affinityStats.total - affinityStats.hits) / affinityStats.total
    : 0;
  const CACHE_MISS_PENALTY = 0.002;
  const estimatedCacheMissCost = switchCount * CACHE_MISS_PENALTY;
  const estimatedCachePreserved = affinityStats.hits * avgCostPerRequest * 0.1;
  const totalWastedCost = estimatedCacheMissCost;

  const modelUsage = db.prepare(`
    SELECT model, COUNT(*) as cnt, SUM(cost) as total_cost
    FROM traces WHERE blocked = 0
    GROUP BY model
    ORDER BY total_cost DESC
  `).all() as { model: string; cnt: number; total_cost: number }[];

  const optimizations: RoutingOptimization[] = [];
  for (const usage of modelUsage) {
    const alt = MODEL_CHEAPER_ALTERNATIVES[usage.model];
    if (alt && usage.cnt >= 3) {
      optimizations.push({
        current_model: usage.model,
        suggested_model: alt.model,
        potential_savings_pct: alt.savings_pct,
        reason: alt.reason,
      });
    }
  }

  return {
    top_sessions: topSessions,
    top_tenants: topTenants,
    top_prompts: topPrompts,
    model_switch_count: switchCount,
    estimated_cache_preserved: estimatedCachePreserved,
    estimated_cache_miss_cost: estimatedCacheMissCost,
    total_wasted_cost: totalWastedCost,
    suggested_optimizations: optimizations,
    generated_at: new Date().toISOString(),
  };
}
