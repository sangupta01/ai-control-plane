# 3-Minute Demo Script — AI Control Plane

**Audience:** Engineers, technical leads, platform teams  
**Goal:** Show a production-grade AI gateway with full observability, security enforcement, cost optimization, and incident replay  
**Duration:** 2:30–3:00 minutes

---

## Before You Start

1. Open the dashboard at the root URL
2. Have the Demo Runner page open (`/demo`)
3. Optionally pre-run the demo once so traces already exist

---

## Act 1 — Run the Demo (0:00–0:40)

### Step 1: Open Demo Runner

Navigate to **Demo Runner** in the sidebar.

> **Say:** "This is our AI Control Plane. It acts as a unified gateway in front of every LLM in our infrastructure. Let me run a full simulation."

### Step 2: Click "Run Full Demo"

Click the **Run Full Demo** button and wait ~5–7 seconds.

> **Say:** "We're simulating 10 real-world request patterns simultaneously — normal traffic, security attacks, session routing decisions, and cost scenarios."

### Step 3: Read the results

Point to the summary bar:
- **6 passed** — legitimate requests processed
- **4 blocked** ✓ — security threats correctly stopped

> **Say:** "Notice 4 requests were blocked. That's correct behavior — those were prompt injections, a PII leak, an AWS key, and a DAN jailbreak attempt. The gateway caught all of them before they reached the model."

---

## Act 2 — Security (0:40–1:10)

### Step 4: Navigate to Security

Click **Security** in the sidebar.

> **Say:** "Every security event is logged in real-time. Look at what we caught."

Point to the scanner sections:
- **Prompt Injection** — "Direct instruction override attempt"
- **PII Detection** — SSN detected, blocked
- **Secret Detection** — AWS key detected, blocked
- **Jailbreak Detection** — DAN mode blocked

> **Say:** "These aren't just logged — they're enforced. The request never reached the model. And we have 18 policy rules in YAML that control exactly how each severity level is handled — block, flag, or allow."

**Click Policies in the sidebar:**
- Show 18 active rules
- Point to: `pii-ssn-block: critical → BLOCK`, `pii-ip-allow: low → ALLOW`

> **Say:** "Policy-as-Code. A security engineer edits a YAML file, reloads it with one API call, and the enforcement changes instantly — no deployment required."

---

## Act 3 — Incident Replay (1:10–1:50)

### Step 5: Navigate to Traces

Click **Traces** in the sidebar.

> **Say:** "Every request leaves a full trace. Look at the tags — we can see which traces had sticky routing, which were high-cost, and which were replayed."

Point to the tag legend at the top: BLOCKED, PII DETECTED, STICKY ROUTING, HIGH COST, REPLAYED.

### Step 6: Find a non-blocked trace, click Replay

Find a trace with the **STICKY ROUTING** tag. Click its **Replay** button.

> **Say:** "This is our killer feature — AI Incident Replay. I can re-run any historical request through the full gateway pipeline, optionally with a different model."

In the Replay dialog:
1. Point to the original model (GPT-4)
2. Click **Claude Haiku** in the model picker
3. Click **Run Replay**

> **Say:** "I'm replaying this exact prompt against Claude Haiku — 75% cheaper. Watch the comparison."

When results appear, point to:
- **MODEL CHANGED** badge
- **RESPONSE CHANGED** badge (or IDENTICAL RESPONSE)  
- Eval diff numbers (relevance, safety, groundedness)

> **Say:** "Same prompt, different model, side-by-side eval comparison. This is how you debug AI incidents, validate model migrations, and build confidence before switching providers."

---

## Act 4 — Cost Optimization (1:50–2:20)

### Step 7: Navigate to Cost Insights

Click **Cost Insights** in the sidebar.

> **Say:** "The platform tracks cost at every level — per request, per session, per tenant."

Point to:
- **Suggested Routing Optimizations**: GPT-4 → GPT-3.5 (-80%), Claude Opus → Claude Haiku (-75%)
- **Top Sessions by Cost** list
- **Cache Preserved** via session affinity

> **Say:** "The system identified that 80% of our GPT-4 requests could be handled by GPT-3.5. That's an automated cost recommendation based on actual traffic patterns. Session affinity also preserved cache — saving us from model switch penalties."

---

## Act 5 — Red Team (2:20–2:45)

### Step 8: Navigate to Red Team

Click **Red Team** in the sidebar.

> **Say:** "Finally, this is our adversarial testing mode. Before any model or policy change goes to production, we run 10 attack scenarios automatically."

Click **Run Red Team**.

When results appear (100% pass rate):

> **Say:** "10 for 10. Every adversarial attack blocked, both benign baselines allowed. This runs in CI before every deployment. If the pass rate drops below 100%, the deployment fails."

---

## Closing (2:45–3:00)

> **Say:** "So in one platform we have:
> - A unified LLM gateway across 5 providers
> - Real-time security enforcement with Policy-as-Code  
> - Full trace observability and incident replay
> - Automated cost optimization recommendations
> - Red team adversarial testing
>
> All production-grade, all observable, all auditable."

---

## Key Numbers to Know

| Metric | Value |
|---|---|
| Security scanners | 5 (PII, secrets, injection, jailbreak, data exfiltration) |
| Policy rules | 18 (YAML, hot-reloadable) |
| Demo scenarios | 10 (6 pass, 4 blocked — all correct) |
| Red team scenarios | 10 (100% pass rate) |
| Model providers | 5 (GPT-4, GPT-3.5, Claude Opus, Claude Haiku, Gemini Pro) |
| Replay capability | Any trace, any model, full eval comparison |
| Routing algorithm | Session-sticky, cost-aware, 1.5x threshold |

---

## Common Questions

**Q: Is this real traffic?**  
A: This runs on mock providers that simulate real model behavior including latency, token counts, and cost. The gateway logic, security scanners, and routing engine are production-grade.

**Q: How does the replay work?**  
A: The replay fetches the original prompt from the trace store, re-runs it through the full pipeline (security → routing → provider → eval), and stores the result as a new linked trace with diff computation.

**Q: Can policies be changed without a deployment?**  
A: Yes. Edit `config/policies.yaml`, call `POST /api/v1/policies/reload`, and the new rules take effect immediately in-process.

**Q: What happens when the red team pass rate drops?**  
A: The `POST /api/v1/redteam/run` endpoint returns a numeric `pass_rate`. In CI, a check against this value gates deployments. A pass_rate < 1.0 fails the build.
