import { Router, type IRouter } from "express";

const router: IRouter = Router();
const startTime = Date.now();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    uptime: (Date.now() - startTime) / 1000,
    version: "1.0.0",
  });
});

export default router;
