import { Router, type IRouter } from "express";
import { getPolicies, reloadPolicies } from "../../modules/policies.js";

const router: IRouter = Router();

router.get("/v1/policies", (_req, res) => {
  const policies = getPolicies();
  res.json({
    version: policies.version,
    policy_set: policies.policy_set,
    description: policies.description,
    rules: policies.rules,
    total: policies.rules.length,
    enabled: policies.rules.filter(r => r.enabled).length,
  });
});

router.post("/v1/policies/reload", (_req, res) => {
  reloadPolicies();
  const policies = getPolicies();
  res.json({
    success: true,
    message: "Policies reloaded",
    total: policies.rules.length,
  });
});

export default router;
