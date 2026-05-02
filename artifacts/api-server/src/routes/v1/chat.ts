import { Router, type IRouter } from "express";
import { processRequest } from "../../modules/gateway.js";

const router: IRouter = Router();

router.post("/v1/chat", async (req, res) => {
  try {
    const { messages, model, session_id, tenant_id, metadata } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required", code: "INVALID_REQUEST" });
      return;
    }

    const result = await processRequest({ messages, model, session_id, tenant_id, metadata });
    res.json(result);
  } catch (err) {
    req.log.error(err, "Chat endpoint error");
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

export default router;
