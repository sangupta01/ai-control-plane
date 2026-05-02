import { v4 as uuidv4 } from "uuid";
import { callProvider, calculateCost } from "./providers.js";
import { runSecurityScan, runOutputSecurityScan } from "./security.js";
import { routeRequest } from "./routing.js";
import { evaluate } from "./evaluation.js";
import { storage } from "./storage.js";

export interface GatewayRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  session_id?: string;
  tenant_id?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayResponse {
  id: string;
  trace_id: string;
  session_id: string;
  model: string;
  message: { role: string; content: string };
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost: number;
  latency_ms: number;
  routing_decision: ReturnType<typeof routeRequest>;
  security_result: ReturnType<typeof runSecurityScan>;
  eval_scores: ReturnType<typeof evaluate>;
  blocked: boolean;
  block_reason?: string;
}

export async function processRequest(req: GatewayRequest): Promise<GatewayResponse> {
  const requestStart = Date.now();
  const traceId = uuidv4();
  const sessionId = req.session_id ?? uuidv4();
  const tenantId = req.tenant_id ?? "default";
  const requestedModel = req.model ?? "mock-gpt-4";

  const promptText = req.messages.map(m => m.content).join("\n");
  const estimatedTokens = Math.ceil(promptText.split(/\s+/).length * 1.3);

  const preSecurityResult = runSecurityScan(req.messages);

  if (!preSecurityResult.passed) {
    const blockReason = preSecurityResult.findings
      .filter(f => f.action === "block")
      .map(f => f.reason)
      .join("; ");

    const emptyEval = { relevance: 0, safety: 0, hallucination_risk: 1, groundedness: 0, overall: 0 };
    const routingDecision = routeRequest({ session_id: sessionId, requested_model: requestedModel, tenant_id: tenantId, estimated_prompt_tokens: estimatedTokens });

    const traceData = {
      id: traceId,
      session_id: sessionId,
      tenant_id: tenantId,
      model: requestedModel,
      prompt: promptText.substring(0, 2000),
      response: "[BLOCKED]",
      prompt_tokens: estimatedTokens,
      completion_tokens: 0,
      total_tokens: estimatedTokens,
      cost: 0,
      latency_ms: Date.now() - requestStart,
      routing_decision: JSON.stringify(routingDecision),
      security_result: JSON.stringify(preSecurityResult),
      eval_scores: JSON.stringify(emptyEval),
      blocked: 1,
      block_reason: blockReason,
    };

    storage.insertTrace(traceData);

    for (const finding of preSecurityResult.findings) {
      if (finding.action === "block" || finding.action === "flag") {
        storage.insertSecurityEvent({
          id: uuidv4(),
          trace_id: traceId,
          session_id: sessionId,
          scanner: finding.scanner,
          severity: finding.severity,
          action: finding.action,
          reason: finding.reason,
          matched: finding.matched ?? null,
          prompt_excerpt: promptText.substring(0, 200),
        });
      }
    }

    updateSession(sessionId, tenantId, requestedModel, estimatedTokens, 0, routingDecision);

    return {
      id: uuidv4(),
      trace_id: traceId,
      session_id: sessionId,
      model: requestedModel,
      message: { role: "assistant", content: `Request blocked: ${blockReason}` },
      usage: { prompt_tokens: estimatedTokens, completion_tokens: 0, total_tokens: estimatedTokens },
      cost: 0,
      latency_ms: Date.now() - requestStart,
      routing_decision: routingDecision,
      security_result: preSecurityResult,
      eval_scores: emptyEval,
      blocked: true,
      block_reason: blockReason,
    };
  }

  const routingDecision = routeRequest({
    session_id: sessionId,
    requested_model: requestedModel,
    tenant_id: tenantId,
    estimated_prompt_tokens: estimatedTokens,
  });

  const selectedModel = routingDecision.selected_model;

  const providerResponse = await callProvider({ model: selectedModel, messages: req.messages });

  const outputSecurityResult = runOutputSecurityScan(providerResponse.content);

  const mergedSecurity = {
    passed: preSecurityResult.passed && outputSecurityResult.passed,
    findings: [...preSecurityResult.findings, ...outputSecurityResult.findings.map(f => ({ ...f, scanner: `output_${f.scanner}` }))],
  };

  const evalScores = evaluate(promptText, providerResponse.content);
  const cost = calculateCost(selectedModel, providerResponse.prompt_tokens, providerResponse.completion_tokens);
  const totalLatency = Date.now() - requestStart;

  const traceData = {
    id: traceId,
    session_id: sessionId,
    tenant_id: tenantId,
    model: selectedModel,
    prompt: promptText.substring(0, 2000),
    response: providerResponse.content.substring(0, 2000),
    prompt_tokens: providerResponse.prompt_tokens,
    completion_tokens: providerResponse.completion_tokens,
    total_tokens: providerResponse.total_tokens,
    cost,
    latency_ms: totalLatency,
    routing_decision: JSON.stringify(routingDecision),
    security_result: JSON.stringify(mergedSecurity),
    eval_scores: JSON.stringify(evalScores),
    blocked: 0,
    block_reason: null,
  };

  storage.insertTrace(traceData);
  storage.insertEvalResult({ id: uuidv4(), trace_id: traceId, ...evalScores });

  for (const finding of mergedSecurity.findings) {
    if (finding.action === "flag") {
      storage.insertSecurityEvent({
        id: uuidv4(),
        trace_id: traceId,
        session_id: sessionId,
        scanner: finding.scanner,
        severity: finding.severity,
        action: finding.action,
        reason: finding.reason,
        matched: finding.matched ?? null,
        prompt_excerpt: promptText.substring(0, 200),
      });
    }
  }

  updateSession(sessionId, tenantId, selectedModel, providerResponse.total_tokens, cost, routingDecision);

  return {
    id: uuidv4(),
    trace_id: traceId,
    session_id: sessionId,
    model: selectedModel,
    message: { role: "assistant", content: providerResponse.content },
    usage: {
      prompt_tokens: providerResponse.prompt_tokens,
      completion_tokens: providerResponse.completion_tokens,
      total_tokens: providerResponse.total_tokens,
    },
    cost,
    latency_ms: totalLatency,
    routing_decision: routingDecision,
    security_result: mergedSecurity,
    eval_scores: evalScores,
    blocked: false,
  };
}

function updateSession(
  sessionId: string,
  tenantId: string,
  model: string,
  tokens: number,
  cost: number,
  routing: ReturnType<typeof routeRequest>,
): void {
  const existing = storage.getSession(sessionId);
  storage.upsertSession({
    id: sessionId,
    tenant_id: tenantId,
    model,
    request_count: (existing?.request_count ?? 0) + 1,
    total_tokens: (existing?.total_tokens ?? 0) + tokens,
    total_cost: (existing?.total_cost ?? 0) + cost,
    model_switches: routing.model_switches,
    affinity_hits: (existing?.affinity_hits ?? 0) + (routing.session_affinity_hit ? 1 : 0),
  });
}
