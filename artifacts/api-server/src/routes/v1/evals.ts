import { Router, type IRouter } from "express";
import { storage } from "../../modules/storage.js";

const router: IRouter = Router();

router.get("/v1/evals", (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const trace_id = req.query["trace_id"] as string | undefined;

  const { rows, total } = storage.getEvals({ limit, trace_id });
  res.json({ evals: rows, total });
});

export default router;
