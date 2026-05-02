import { Router, type IRouter } from "express";
import { getCostInsights } from "../../modules/cost-insights.js";

const router: IRouter = Router();

router.get("/v1/cost/insights", (_req, res) => {
  const insights = getCostInsights();
  res.json(insights);
});

export default router;
