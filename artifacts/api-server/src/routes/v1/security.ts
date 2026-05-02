import { Router, type IRouter } from "express";
import { storage } from "../../modules/storage.js";

const router: IRouter = Router();

router.get("/v1/security/events", (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const severity = req.query["severity"] as string | undefined;

  const { rows, total } = storage.getSecurityEvents({ limit, severity });
  res.json({ events: rows, total });
});

export default router;
