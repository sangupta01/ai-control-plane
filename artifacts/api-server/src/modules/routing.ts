import { storage } from "./storage.js";
import { MODEL_CATALOG } from "./providers.js";

export interface RoutingContext {
  session_id: string;
  requested_model?: string;
  tenant_id: string;
  estimated_prompt_tokens: number;
}

export interface RoutingDecision {
  selected_model: string;
  reason: string;
  session_affinity_hit: boolean;
  effective_cost: number;
  cache_preserved: boolean;
  model_switches: number;
}

const CACHE_MISS_PENALTY = 0.002;
const LATENCY_PENALTY_PER_MS = 0.0000005;

function estimateEffectiveCost(model: string, tokens: number, affinityHit: boolean): number {
  const cfg = MODEL_CATALOG[model] ?? MODEL_CATALOG["mock-gpt-4"]!;
  const baseCost = (tokens / 1000) * cfg.cost_per_1k_input;
  const cachePenalty = affinityHit ? 0 : CACHE_MISS_PENALTY;
  const latencyPenalty = cfg.avg_latency_ms * LATENCY_PENALTY_PER_MS;
  return baseCost + cachePenalty + latencyPenalty;
}

export function routeRequest(ctx: RoutingContext): RoutingDecision {
  const session = storage.getSession(ctx.session_id);
  const requestedModel = ctx.requested_model ?? "mock-gpt-4";

  if (!MODEL_CATALOG[requestedModel]) {
    const fallback = "mock-gpt-4";
    return {
      selected_model: fallback,
      reason: `Requested model '${requestedModel}' not found; falling back to ${fallback}`,
      session_affinity_hit: false,
      effective_cost: estimateEffectiveCost(fallback, ctx.estimated_prompt_tokens, false),
      cache_preserved: false,
      model_switches: session?.model_switches ?? 0,
    };
  }

  if (!session) {
    return {
      selected_model: requestedModel,
      reason: "New session; no affinity established",
      session_affinity_hit: false,
      effective_cost: estimateEffectiveCost(requestedModel, ctx.estimated_prompt_tokens, false),
      cache_preserved: false,
      model_switches: 0,
    };
  }

  const affinityModel = session.model;
  if (affinityModel === requestedModel) {
    return {
      selected_model: requestedModel,
      reason: `Session affinity: continuing with ${requestedModel}`,
      session_affinity_hit: true,
      effective_cost: estimateEffectiveCost(requestedModel, ctx.estimated_prompt_tokens, true),
      cache_preserved: true,
      model_switches: session.model_switches,
    };
  }

  const affinityCost = estimateEffectiveCost(affinityModel, ctx.estimated_prompt_tokens, true);
  const switchCost = estimateEffectiveCost(requestedModel, ctx.estimated_prompt_tokens, false);

  if (affinityCost <= switchCost * 1.5) {
    return {
      selected_model: affinityModel,
      reason: `Sticky routing: affinity model ${affinityModel} cost (${affinityCost.toFixed(6)}) preferred over switch to ${requestedModel} (${switchCost.toFixed(6)})`,
      session_affinity_hit: true,
      effective_cost: affinityCost,
      cache_preserved: true,
      model_switches: session.model_switches,
    };
  }

  return {
    selected_model: requestedModel,
    reason: `Model switch: ${affinityModel} → ${requestedModel} (cost savings justify switch: ${switchCost.toFixed(6)} < ${affinityCost.toFixed(6)})`,
    session_affinity_hit: false,
    effective_cost: switchCost,
    cache_preserved: false,
    model_switches: session.model_switches + 1,
  };
}
