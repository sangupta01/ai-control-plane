import { Router, type IRouter } from "express";
import { storage } from "../../modules/storage.js";

const router: IRouter = Router();

router.get("/v1/sessions", (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const { rows, total } = storage.getSessions({ limit });
  res.json({ sessions: rows, total });
});

export default router;
