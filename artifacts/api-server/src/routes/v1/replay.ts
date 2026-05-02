import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { storage } from "../../modules/storage.js";
import { processRequest } from "../../modules/gateway.js";
import type { EvalScores } from "../../modules/evaluation.js";

const router: IRouter = Router();

function parseTrace(row: ReturnType<typeof storage.getTraceById>) {
  if (!row) return null;
  return {
    ...row,
    blocked: row.blocked === 1,
    is_replay: (row.is_replay ?? 0) === 1,
    routing_decision: row.routing_decision ? JSON.parse(row.routing_decision) : null,
    security_result: row.security_result ? JSON.parse(row.security_result) : null,
    eval_scores: row.eval_scores ? JSON.parse(row.eval_scores) as EvalScores : null,
  };
}

router.post("/v1/traces/:id/replay", async (req, res) => {
  const originalRow = storage.getTraceById(req.params["id"]!);
  if (!originalRow) {
    res.status(404).json({ error: "Trace not found" });
    return;
  }

  const { override_model } = req.body as {
    override_model?: string;
    override_routing_strategy?: string;
  };

  // When override_model is specified use a fresh session so sticky routing
  // doesn't suppress the requested model change.
  const replaySessionId = override_model ? `replay-${uuidv4()}` : originalRow.session_id;

  const replayResult = await processRequest({
    messages: [{ role: "user", content: originalRow.prompt }],
    model: override_model ?? originalRow.model,
    session_id: replaySessionId,
    tenant_id: originalRow.tenant_id,
    replay_of_trace_id: originalRow.id,
  });

  const originalTrace = parseTrace(originalRow)!;
  const replayRow = storage.getTraceById(replayResult.trace_id);
  const replayTrace = parseTrace(replayRow)!;

  const origEval: EvalScores = originalTrace.eval_scores ?? {
    relevance: 0, safety: 0, hallucination_risk: 0, groundedness: 0, overall: 0,
  };
  const replayEval: EvalScores = replayResult.eval_scores;

  const round = (n: number) => Math.round(n * 1000) / 1000;

  const diff = {
    response_changed: originalTrace.response !== replayResult.message.content,
    model_changed: originalTrace.model !== replayResult.model,
    routing_changed: originalTrace.routing_decision?.selected_model !== replayResult.routing_decision.selected_model,
    eval_diff: {
      relevance:         round(replayEval.relevance         - origEval.relevance),
      safety:            round(replayEval.safety            - origEval.safety),
      hallucination:     round(origEval.hallucination_risk  - replayEval.hallucination_risk),
      groundedness:      round(replayEval.groundedness      - origEval.groundedness),
    },
  };

  res.json({ original_trace: originalTrace, replay_trace: replayTrace, diff });
});

export default router;
