const BASE_URL = process.env.API_URL ?? "http://localhost:80/api";
const DELAY_MS = Number(process.env.DELAY_MS ?? "200");

type Message = { role: "user" | "system" | "assistant"; content: string };
type WorkloadType = "coding" | "incident" | "support" | "security" | "enterprise";

interface WorkloadScenario {
  name: string;
  model: string;
  session_id?: string;
  tenant_id: string;
  messages: Message[];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendChat(scenario: WorkloadScenario): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: scenario.messages,
        model: scenario.model,
        session_id: scenario.session_id,
        tenant_id: scenario.tenant_id,
      }),
    });
    const data = await res.json() as { trace_id?: string; blocked?: boolean; model?: string; cost?: number };
    const status = data.blocked ? "BLOCKED" : "OK";
    console.log(`  [${status}] ${scenario.name} → model=${data.model ?? "?"} cost=$${(data.cost ?? 0).toFixed(6)} trace=${data.trace_id?.substring(0, 8) ?? "?"}`);
  } catch (err) {
    console.error(`  [ERR] ${scenario.name}: ${(err as Error).message}`);
  }
}

async function runWorkload(label: string, scenarios: WorkloadScenario[]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Workload: ${label} (${scenarios.length} requests)`);
  console.log("=".repeat(60));
  for (const scenario of scenarios) {
    await sendChat(scenario);
    await sleep(DELAY_MS);
  }
  console.log(`Done: ${label}`);
}

function sessionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function codingWorkload(): WorkloadScenario[] {
  const sid = sessionId("coding");
  return [
    {
      name: "TypeScript generic types",
      model: "mock-gpt-4",
      session_id: sid,
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "Explain TypeScript generic constraints. How do I use `extends` with generics to constrain a type parameter to objects that have a specific property?" }],
    },
    {
      name: "React hook pattern",
      model: "mock-gpt-4",
      session_id: sid,
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "Write a custom React hook called useLocalStorage that syncs state to localStorage. Include TypeScript types and handle JSON serialization." }],
    },
    {
      name: "SQL query optimization",
      model: "mock-gpt-3.5",
      session_id: sessionId("coding-sql"),
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "I have a PostgreSQL query joining three tables (orders, users, products) that takes 4 seconds. The orders table has 5M rows. How do I analyze and optimize this?" }],
    },
    {
      name: "Python async patterns",
      model: "mock-gpt-4",
      session_id: sessionId("coding-py"),
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "What is the difference between asyncio.gather, asyncio.wait, and asyncio.TaskGroup in Python 3.11? When should I use each one? Show a concrete example." }],
    },
    {
      name: "Docker multi-stage build",
      model: "mock-gpt-3.5",
      session_id: sessionId("coding-docker"),
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "Write a production Dockerfile for a Node.js Express API. Use multi-stage build to keep the image small. The app needs pnpm and has native addons." }],
    },
    {
      name: "Rate limiter implementation",
      model: "mock-gpt-4",
      session_id: sessionId("coding-rate"),
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "Implement a sliding window rate limiter in TypeScript using Redis. It should support per-user limits with configurable window size and request count." }],
    },
    {
      name: "Code review feedback",
      model: "mock-gpt-3.5",
      session_id: sessionId("coding-review"),
      tenant_id: "eng-team",
      messages: [
        { role: "system", content: "You are a senior software engineer doing code review." },
        { role: "user", content: "Review this function: function processData(data) { for(let i=0; i<data.length; i++) { try { result.push(transform(data[i])) } catch(e) { console.log(e) } } return result; }" },
      ],
    },
    {
      name: "API design question",
      model: "mock-gpt-4",
      session_id: sessionId("coding-api"),
      tenant_id: "eng-team",
      messages: [{ role: "user", content: "Design a REST API for a multi-tenant SaaS platform. How should tenant isolation be handled at the API layer? Cover authentication, routing, rate limiting, and data isolation." }],
    },
  ];
}

function incidentWorkload(): WorkloadScenario[] {
  const sid = sessionId("incident");
  return [
    {
      name: "P1 database outage analysis",
      model: "mock-claude-3-opus",
      session_id: sid,
      tenant_id: "ops-team",
      messages: [
        { role: "system", content: "You are a senior SRE helping investigate a production incident." },
        { role: "user", content: "P1 incident: PostgreSQL primary is unresponsive. Replica lag is 45 seconds. CPU is 100%, I/O wait is 80%. Active connections: 497/500. What is happening and what are my immediate actions?" },
      ],
    },
    {
      name: "Memory leak diagnosis",
      model: "mock-gpt-4",
      session_id: sid,
      tenant_id: "ops-team",
      messages: [{ role: "user", content: "Our Node.js API server memory grows by 50MB per hour and crashes every 8 hours. Heap snapshots show EventEmitter listeners growing unboundedly. How do I identify and fix the leak?" }],
    },
    {
      name: "Kubernetes pod crashloop",
      model: "mock-claude-3-haiku",
      session_id: sessionId("incident-k8s"),
      tenant_id: "ops-team",
      messages: [{ role: "user", content: "Pod is CrashLoopBackOff. kubectl logs shows: FATAL: bind EADDRINUSE :::8080. This worked yesterday. The deployment has 3 replicas. What is wrong?" }],
    },
    {
      name: "High latency root cause",
      model: "mock-gpt-4",
      session_id: sessionId("incident-latency"),
      tenant_id: "ops-team",
      messages: [{ role: "user", content: "Our API p99 latency spiked from 120ms to 4200ms 30 minutes ago. Database query times look normal. Cache hit rate dropped from 94% to 31%. Network bandwidth is normal. What do I investigate next?" }],
    },
    {
      name: "Alert fatigue analysis",
      model: "mock-gpt-3.5",
      session_id: sessionId("incident-alerts"),
      tenant_id: "ops-team",
      messages: [{ role: "user", content: "We receive 800 alerts per day. Engineers are ignoring them. 70% are duplicates or noise. How do I design a better alerting strategy? What thresholds and grouping rules should I apply?" }],
    },
    {
      name: "On-call runbook generation",
      model: "mock-gpt-4",
      session_id: sessionId("incident-runbook"),
      tenant_id: "ops-team",
      messages: [
        { role: "system", content: "You are an expert SRE creating incident response runbooks." },
        { role: "user", content: "Create a runbook for: Redis cluster reports NOAUTH errors. Include: detection signals, immediate triage steps, common root causes, remediation steps, and escalation criteria." },
      ],
    },
  ];
}

function supportWorkload(): WorkloadScenario[] {
  return [
    {
      name: "Billing inquiry",
      model: "mock-gpt-3.5",
      session_id: sessionId("support-billing"),
      tenant_id: "support-team",
      messages: [
        { role: "system", content: "You are a helpful customer support agent for a SaaS platform." },
        { role: "user", content: "I was charged twice for my subscription this month. My account email is john@example.com. I need this resolved urgently because my card limit was hit." },
      ],
    },
    {
      name: "Feature request guidance",
      model: "mock-gpt-3.5",
      session_id: sessionId("support-feature"),
      tenant_id: "support-team",
      messages: [
        { role: "system", content: "You are a product support specialist." },
        { role: "user", content: "Does your platform support SSO with Okta? If yes, how do I configure it? If no, is it on the roadmap?" },
      ],
    },
    {
      name: "Integration troubleshooting",
      model: "mock-gpt-4",
      session_id: sessionId("support-integration"),
      tenant_id: "support-team",
      messages: [
        { role: "user", content: "I set up the webhook but I'm getting 401 Unauthorized responses. I've verified the secret key matches. The Content-Type is application/json. What could cause this?" },
      ],
    },
    {
      name: "Onboarding help",
      model: "mock-gpt-3.5",
      session_id: sessionId("support-onboard"),
      tenant_id: "support-team",
      messages: [
        { role: "system", content: "You are an onboarding specialist helping new enterprise customers." },
        { role: "user", content: "We just signed up for the enterprise plan. We have 50 engineers across 3 teams. What is the recommended way to set up teams, permissions, and SSO for an organization our size?" },
      ],
    },
    {
      name: "Data export request",
      model: "mock-gpt-3.5",
      session_id: sessionId("support-export"),
      tenant_id: "support-team",
      messages: [
        { role: "user", content: "I need to export all our usage data for the last 6 months for an audit. What formats are available? How long does the export take? Will it include all sub-accounts?" },
      ],
    },
    {
      name: "Performance complaint",
      model: "mock-gpt-3.5",
      session_id: sessionId("support-perf"),
      tenant_id: "support-team",
      messages: [
        { role: "system", content: "You are a technical support agent." },
        { role: "user", content: "Your API has been returning responses in 8-10 seconds for the past 2 days. Our SLA requires under 500ms. This is causing us production failures. What is the status and your remediation plan?" },
      ],
    },
  ];
}

function securityWorkload(): WorkloadScenario[] {
  return [
    {
      name: "Threat modeling request",
      model: "mock-claude-3-opus",
      session_id: sessionId("sec-threat"),
      tenant_id: "security-team",
      messages: [
        { role: "system", content: "You are a security expert helping with threat modeling." },
        { role: "user", content: "Perform a STRIDE threat model for an API gateway that sits between public internet and internal microservices. It handles authentication, rate limiting, and request routing." },
      ],
    },
    {
      name: "CVE analysis",
      model: "mock-gpt-4",
      session_id: sessionId("sec-cve"),
      tenant_id: "security-team",
      messages: [
        { role: "user", content: "Explain CVE-2024-24576 (the Rust BatBadBut vulnerability). What systems are affected? Is our Node.js 22 application that uses child_process.spawn vulnerable?" },
      ],
    },
    {
      name: "Security review of auth code",
      model: "mock-claude-3-opus",
      session_id: sessionId("sec-review"),
      tenant_id: "security-team",
      messages: [
        { role: "system", content: "You are a security code reviewer." },
        { role: "user", content: "Review this JWT verification: const payload = JSON.parse(atob(token.split('.')[1])). What security vulnerabilities does this have? How should it be fixed?" },
      ],
    },
    {
      name: "OWASP Top 10 briefing",
      model: "mock-gpt-4",
      session_id: sessionId("sec-owasp"),
      tenant_id: "security-team",
      messages: [
        { role: "user", content: "Which OWASP Top 10 2021 categories apply to a REST API that uses JWT auth, PostgreSQL, Redis, and accepts file uploads? Prioritize by risk for a fintech platform." },
      ],
    },
    {
      name: "Incident response playbook",
      model: "mock-claude-3-opus",
      session_id: sessionId("sec-playbook"),
      tenant_id: "security-team",
      messages: [
        { role: "system", content: "You are a CISO-level security expert." },
        { role: "user", content: "Create a security incident response playbook for: suspected API key compromise. Include: immediate containment, evidence collection, impact assessment, remediation, and post-incident review." },
      ],
    },
    {
      name: "Penetration testing guidance",
      model: "mock-gpt-4",
      session_id: sessionId("sec-pentest"),
      tenant_id: "security-team",
      messages: [
        { role: "user", content: "What automated and manual checks should our pentesting team run against our API? We use OAuth2 PKCE, rate limiting, and WAF. Focus on business logic vulnerabilities." },
      ],
    },
  ];
}

function enterpriseWorkload(): WorkloadScenario[] {
  const scenarios: WorkloadScenario[] = [];

  const teams = ["eng-team", "ops-team", "data-team", "finance-team", "legal-team"];
  const models: Array<WorkloadScenario["model"]> = [
    "mock-gpt-4", "mock-gpt-3.5", "mock-claude-3-haiku", "mock-claude-3-opus", "mock-gemini-pro",
  ];

  const prompts = [
    "Summarize the key architectural differences between microservices and event-driven architectures for our platform migration decision.",
    "Create a template for a quarterly technology review presentation for our board of directors.",
    "What are the compliance requirements for storing PII data under GDPR and CCPA? How do they differ?",
    "Generate a project status report template for a software engineering team following agile methodologies.",
    "Explain the trade-offs between GraphQL and REST APIs for our mobile-first product strategy.",
    "Draft a technical due diligence checklist for evaluating a B2B SaaS vendor we are considering integrating.",
    "What KPIs should an engineering team track to measure developer productivity and platform reliability?",
    "Write an executive summary explaining our decision to migrate from MongoDB to PostgreSQL.",
    "How should we structure a cloud cost optimization initiative across 8 engineering teams?",
    "Create a data retention policy template that balances compliance requirements with storage costs.",
    "What are the best practices for zero-downtime database migrations at scale?",
    "Draft interview questions for a Staff Engineer role focused on distributed systems.",
  ];

  for (let i = 0; i < prompts.length; i++) {
    scenarios.push({
      name: `enterprise-${i + 1}: ${prompts[i]!.substring(0, 50)}...`,
      model: models[i % models.length]!,
      session_id: sessionId(`enterprise-${teams[i % teams.length]!}`),
      tenant_id: teams[i % teams.length]!,
      messages: [{ role: "user", content: prompts[i]! }],
    });
  }

  return scenarios;
}

const WORKLOAD_MAP: Record<WorkloadType, () => WorkloadScenario[]> = {
  coding: codingWorkload,
  incident: incidentWorkload,
  support: supportWorkload,
  security: securityWorkload,
  enterprise: enterpriseWorkload,
};

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/healthz`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const arg = (process.argv[2] ?? "enterprise") as WorkloadType;

  if (!WORKLOAD_MAP[arg]) {
    console.error(`Unknown workload type: ${arg}`);
    console.error(`Valid types: ${Object.keys(WORKLOAD_MAP).join(", ")}`);
    process.exit(1);
  }

  console.log(`AI Control Plane — Workload Generator`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Type:   ${arg}`);
  console.log(`Delay:  ${DELAY_MS}ms between requests`);

  const healthy = await checkHealth();
  if (!healthy) {
    console.error(`\nAPI server not reachable at ${BASE_URL}/healthz`);
    console.error("Make sure the API server is running before generating workload.");
    process.exit(1);
  }

  const scenarios = WORKLOAD_MAP[arg]();
  await runWorkload(arg, scenarios);

  console.log(`\nWorkload complete. Check the dashboard at http://localhost:3000 to see traces.`);
}

main().catch(err => {
  console.error("Workload generator failed:", err);
  process.exit(1);
});
