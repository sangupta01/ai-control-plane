import { Router, type IRouter } from "express";
import { storage } from "../../modules/storage.js";

const router: IRouter = Router();

router.get("/v1/metrics/summary", (_req, res) => {
  const summary = storage.getMetricsSummary();
  res.json(summary);
});

export default router;
