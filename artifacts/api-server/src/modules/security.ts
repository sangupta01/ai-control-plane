export type Severity = "low" | "medium" | "high" | "critical";
export type Action = "allow" | "flag" | "block";

export interface SecurityFinding {
  scanner: string;
  severity: Severity;
  action: Action;
  reason: string;
  matched?: string;
}

export interface SecurityResult {
  passed: boolean;
  findings: SecurityFinding[];
}

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; severity: Severity }> = [
  { name: "SSN", pattern: /\b\d{3}-\d{2}-\d{4}\b/, severity: "critical" },
  { name: "Credit Card", pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/, severity: "critical" },
  { name: "Email", pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/, severity: "medium" },
  { name: "Phone", pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s][0-9]{3}[-.\s][0-9]{4}\b/, severity: "medium" },
  { name: "IP Address", pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/, severity: "low" },
  { name: "Date of Birth", pattern: /\b(?:dob|date of birth|born on)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i, severity: "high" },
];

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: Severity }> = [
  { name: "AWS Access Key", pattern: /\bAKIA[0-9A-Z]{16}\b/, severity: "critical" },
  { name: "AWS Secret Key", pattern: /(?:aws[_\-]?secret[_\-]?(?:access[_\-]?)?key|aws_secret)\s*[=:]\s*[a-zA-Z0-9\/+]{40}/i, severity: "critical" },
  { name: "GitHub Token", pattern: /\bghp_[a-zA-Z0-9]{36}\b/, severity: "critical" },
  { name: "Bearer Token", pattern: /\bBearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\b/, severity: "high" },
  { name: "Generic API Key", pattern: /(?:api[_\-]?key|apikey|access[_\-]?token)\s*[=:]\s*['""]?[a-zA-Z0-9\-_]{20,}['""]?/i, severity: "high" },
  { name: "Private Key Header", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, severity: "critical" },
  { name: "OpenAI Key", pattern: /\bsk-[a-zA-Z0-9]{48}\b/, severity: "critical" },
];

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: Severity }> = [
  { pattern: /ignore (?:all )?(?:previous|prior|above) instructions/i, reason: "Direct prompt injection attempt", severity: "critical" },
  { pattern: /you are now (?:a |an )?(?:different|new|unrestricted|jailbroken)/i, reason: "Role override injection", severity: "critical" },
  { pattern: /disregard (?:your|all) (?:training|instructions|guidelines)/i, reason: "Training override attempt", severity: "high" },
  { pattern: /act as (?:if you have no|without any) (?:restrictions|limitations|filters)/i, reason: "Restriction bypass attempt", severity: "high" },
  { pattern: /\[SYSTEM\]|\[INST\]|<\|system\|>|<\|im_start\|>/i, reason: "Special token injection", severity: "high" },
  { pattern: /pretend you are|roleplay as|simulate being/i, reason: "Identity manipulation attempt", severity: "medium" },
];

const JAILBREAK_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: Severity }> = [
  { pattern: /DAN\s+mode|do\s+anything\s+now/i, reason: "DAN jailbreak attempt", severity: "critical" },
  { pattern: /jailbreak|jail\s*break/i, reason: "Explicit jailbreak mention", severity: "high" },
  { pattern: /bypass\s+(?:safety|filters|restrictions|censorship)/i, reason: "Safety bypass attempt", severity: "high" },
  { pattern: /developer\s+mode|dev\s+mode\s+enabled/i, reason: "Developer mode exploit", severity: "high" },
  { pattern: /as an? AI(?:,| that) (?:has no|without) (?:ethical|moral) (?:guidelines|constraints)/i, reason: "Ethics bypass attempt", severity: "critical" },
  { pattern: /(?:how to|instructions for|steps to) (?:make|build|create) (?:a )?(?:bomb|weapon|malware|virus)/i, reason: "Dangerous content request", severity: "critical" },
  { pattern: /generate (?:child|explicit|illegal)/i, reason: "Illegal content request", severity: "critical" },
];

const DATA_EXFIL_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: Severity }> = [
  { pattern: /(?:list|dump|export|print|show) (?:all|every) (?:user|customer|employee|record)/i, reason: "Bulk data exfiltration attempt", severity: "high" },
  { pattern: /SELECT \* FROM/i, reason: "SQL injection / data dump attempt", severity: "high" },
  { pattern: /(?:send|email|transmit) (?:data|records|information) to/i, reason: "Data exfiltration via transmission", severity: "medium" },
];

function getActionForSeverity(severity: Severity): Action {
  if (severity === "critical" || severity === "high") return "block";
  if (severity === "medium") return "flag";
  return "allow";
}

function scanText(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const p of PII_PATTERNS) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({
        scanner: "pii",
        severity: p.severity,
        action: getActionForSeverity(p.severity),
        reason: `PII detected: ${p.name}`,
        matched: match[0].substring(0, 50),
      });
    }
  }

  for (const p of SECRET_PATTERNS) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({
        scanner: "secrets",
        severity: p.severity,
        action: getActionForSeverity(p.severity),
        reason: `Secret detected: ${p.name}`,
        matched: match[0].substring(0, 30) + "***",
      });
    }
  }

  for (const p of INJECTION_PATTERNS) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({
        scanner: "prompt_injection",
        severity: p.severity,
        action: getActionForSeverity(p.severity),
        reason: p.reason,
        matched: match[0].substring(0, 80),
      });
    }
  }

  for (const p of JAILBREAK_PATTERNS) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({
        scanner: "jailbreak",
        severity: p.severity,
        action: getActionForSeverity(p.severity),
        reason: p.reason,
        matched: match[0].substring(0, 80),
      });
    }
  }

  for (const p of DATA_EXFIL_PATTERNS) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({
        scanner: "data_exfiltration",
        severity: p.severity,
        action: getActionForSeverity(p.severity),
        reason: p.reason,
        matched: match[0].substring(0, 80),
      });
    }
  }

  return findings;
}

export function runSecurityScan(messages: Array<{ role: string; content: string }>): SecurityResult {
  const userText = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n");

  const findings = scanText(userText);
  const blocked = findings.some(f => f.action === "block");

  return {
    passed: !blocked,
    findings,
  };
}

export function runOutputSecurityScan(response: string): SecurityResult {
  const findings = scanText(response);
  const blocked = findings.some(f => f.action === "block");
  return { passed: !blocked, findings };
}
