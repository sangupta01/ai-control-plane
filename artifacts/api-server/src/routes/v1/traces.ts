import { Router, type IRouter } from "express";
import { storage } from "../../modules/storage.js";

const router: IRouter = Router();

router.get("/v1/traces", (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);
  const session_id = req.query["session_id"] as string | undefined;
  const model = req.query["model"] as string | undefined;

  const { rows, total } = storage.getTraces({ limit, offset, session_id, model });

  const traces = rows.map(r => ({
    ...r,
    blocked: r.blocked === 1,
    routing_decision: r.routing_decision ? JSON.parse(r.routing_decision) : null,
    security_result: r.security_result ? JSON.parse(r.security_result) : null,
    eval_scores: r.eval_scores ? JSON.parse(r.eval_scores) : null,
  }));

  res.json({ traces, total, limit, offset });
});

router.get("/v1/traces/:id", (req, res) => {
  const row = storage.getTraceById(req.params["id"]!);
  if (!row) {
    res.status(404).json({ error: "Trace not found" });
    return;
  }

  res.json({
    ...row,
    blocked: row.blocked === 1,
    routing_decision: row.routing_decision ? JSON.parse(row.routing_decision) : null,
    security_result: row.security_result ? JSON.parse(row.security_result) : null,
    eval_scores: row.eval_scores ? JSON.parse(row.eval_scores) : null,
  });
});

export default router;
