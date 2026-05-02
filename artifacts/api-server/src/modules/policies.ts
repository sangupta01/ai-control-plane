import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { SecurityFinding } from "./security.js";

export type PolicyAction = "allow" | "flag" | "block" | "redact";

export interface PolicyRule {
  id: string;
  scanner: string;
  pattern_name?: string;
  severity?: string;
  action: PolicyAction;
  description: string;
  enabled: boolean;
}

export interface PolicySet {
  version: string;
  policy_set: string;
  description: string;
  rules: PolicyRule[];
}

let _policies: PolicySet | null = null;

function parsePoliciesYaml(content: string): PolicySet {
  const lines = content.split("\n");
  const result: PolicySet = {
    version: "1.0",
    policy_set: "default",
    description: "",
    rules: [],
  };

  let currentRule: Partial<PolicyRule> | null = null;
  let inRules = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (line.startsWith("version:")) {
      result.version = trimmed.replace("version:", "").trim().replace(/['"]/g, "");
      continue;
    }
    if (line.startsWith("policy_set:")) {
      result.policy_set = trimmed.replace("policy_set:", "").trim().replace(/['"]/g, "");
      continue;
    }
    if (line.startsWith("description:")) {
      result.description = trimmed.replace("description:", "").trim().replace(/['"]/g, "");
      continue;
    }
    if (line.startsWith("rules:")) {
      inRules = true;
      continue;
    }

    if (!inRules) continue;

    if (/^  - id:/.test(line)) {
      if (currentRule?.id) result.rules.push(currentRule as PolicyRule);
      currentRule = { id: trimmed.replace("- id:", "").trim().replace(/['"]/g, ""), enabled: true };
      continue;
    }

    if (!currentRule) continue;

    const kv = trimmed.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (!kv) continue;
    const [, key, value] = kv;
    const v = value.trim();

    if (key === "scanner") currentRule.scanner = v;
    else if (key === "pattern_name") currentRule.pattern_name = v;
    else if (key === "severity") currentRule.severity = v;
    else if (key === "action") currentRule.action = v as PolicyAction;
    else if (key === "description") currentRule.description = v;
    else if (key === "enabled") currentRule.enabled = v === "true";
  }

  if (currentRule?.id) result.rules.push(currentRule as PolicyRule);
  return result;
}

export function getPolicies(): PolicySet {
  if (_policies) return _policies;

  const possiblePaths = [
    path.join(process.cwd(), "../../config/policies.yaml"),
    path.join(process.cwd(), "config/policies.yaml"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../config/policies.yaml"),
    "/home/runner/workspace/config/policies.yaml",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      _policies = parsePoliciesYaml(content);
      return _policies;
    }
  }

  _policies = {
    version: "1.0",
    policy_set: "default",
    description: "Fallback default policies",
    rules: [],
  };
  return _policies;
}

export function applyPolicies(findings: SecurityFinding[]): SecurityFinding[] {
  const policies = getPolicies();
  const enabledRules = policies.rules.filter(r => r.enabled);

  return findings.map(finding => {
    const matchingRule = enabledRules.find(rule => {
      if (rule.scanner !== finding.scanner) return false;
      if (rule.severity && rule.severity !== finding.severity) return false;
      if (rule.pattern_name) {
        const nameInReason = finding.reason.toLowerCase().includes(rule.pattern_name.toLowerCase());
        if (!nameInReason) return false;
      }
      return true;
    });

    if (matchingRule) {
      const policyAction = matchingRule.action === "redact" ? "flag" : matchingRule.action;
      return { ...finding, action: policyAction };
    }
    return finding;
  });
}

export function reloadPolicies(): void {
  _policies = null;
  getPolicies();
}
