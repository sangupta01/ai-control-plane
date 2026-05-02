import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import chatRouter from "./v1/chat.js";
import tracesRouter from "./v1/traces.js";
import metricsRouter from "./v1/metrics.js";
import securityRouter from "./v1/security.js";
import evalsRouter from "./v1/evals.js";
import sessionsRouter from "./v1/sessions.js";
import demoRouter from "./v1/demo.js";
import policiesRouter from "./v1/policies.js";
import costRouter from "./v1/cost.js";
import redteamRouter from "./v1/redteam.js";
import replayRouter from "./v1/replay.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(tracesRouter);
router.use(replayRouter);
router.use(metricsRouter);
router.use(securityRouter);
router.use(evalsRouter);
router.use(sessionsRouter);
router.use(demoRouter);
router.use(policiesRouter);
router.use(costRouter);
router.use(redteamRouter);

export default router;
