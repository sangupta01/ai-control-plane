import { Router, type IRouter } from "express";
import { runRedTeam, getRedTeamHistory, RED_TEAM_SCENARIOS, ensureRedTeamTable } from "../../modules/redteam.js";

const router: IRouter = Router();

router.get("/v1/redteam/scenarios", (_req, res) => {
  res.json({
    scenarios: RED_TEAM_SCENARIOS,
    total: RED_TEAM_SCENARIOS.length,
  });
});

router.post("/v1/redteam/run", async (req, res) => {
  const scenarioIds: string[] = req.body?.scenarios ?? [];
  const results = await runRedTeam(scenarioIds.length > 0 ? scenarioIds : undefined);
  res.json(results);
});

router.get("/v1/redteam/history", (req, res) => {
  ensureRedTeamTable();
  const limit = Math.min(Number(req.query.limit ?? 10), 50);
  const history = getRedTeamHistory(limit);
  res.json({ runs: history, total: history.length });
});

export default router;
