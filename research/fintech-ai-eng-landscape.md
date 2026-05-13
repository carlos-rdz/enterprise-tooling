# Fintech AI-for-Engineering Landscape (May 2026)

A reality check on how the largest fintechs actually deploy AI for engineering productivity — and how this repo's design choices compare. All claims sourced from public statements; see References at the end.

---

## Landscape map

| Company | Engineers | Primary AI eng tool | Coordination-layer agents (meetings, PM history, cross-team, oncall) | MCP usage | Public eval/governance posture |
|---|---|---|---|---|---|
| **Stripe** | ~5,000 | Claude Code (1,370 enabled) + Cursor (80%+) + 4 others | Not publicly documented | Stripe ships an official MCP server for *external* developers; internal use unclear | Stripe rolled own *enterprise binary* with Anthropic. Cursor Rules for codebase context. Zero-config rollout. |
| **Block** | ~3,500 | **Goose** (open-source, MCP-native, multi-LLM) | Not publicly documented — Goose is engineering-focused | Native; 70+ extensions | Open-source extension model; no public eval framework |
| **BlackRock** | ~4,000 (Aladdin) | Aladdin Copilot (Azure OpenAI / GPT-4) | Aladdin agents serve *clients* (asset managers), not internal engineers | Internal "plugin registry" pattern for 50-60 teams | Supervised agentic arch via LangChain/LangGraph |
| **JPMorgan** | ~65,000 | LLM Suite (multi-model, internal platform, 230K seats) | Not publicly documented | Anthropic Claude Code pilot starting Apr 2026 | **Performance reviews now tied to AI usage** (Mar 2026); 10–20% productivity gains claimed |
| **Klarna** | ~1,500 | "Kiki" internal assistant (OpenAI) | Used for internal knowledge mgmt; not specifically engineering workflows | Unknown | Public cautionary tale: rehired humans after over-relying on AI (mid-2025) |
| **Ramp** | ~500 | Cursor + Devin (Cognition) | Not publicly documented | Unknown | "AI-first" identity; uses production coding agents |
| **Industry survey** (906 engineers, Pragmatic Engineer Apr 2026) | n/a | Claude Code #1, Copilot dominant at large enterprises, 55% use agents regularly | **Not in the survey at all** | Growing | Not standardized |

---

## What every major fintech is doing

1. **Coding assistants are saturated.** 95% of engineers use AI weekly. 75% use it for half their work. This is table stakes within 12 months everywhere.
2. **Multi-tool reality.** Stripe runs 6 different coding assistants. JPM is layering Claude Code on top of LLM Suite. The "pick one vendor" era is over.
3. **MCP is winning the integration-protocol war.** Stripe, Block, Cloudflare, JPM, ServiceNow all explicitly building MCP-shaped futures. Block (Goose) ships ~70 extensions; the open-source MCP server registry is the de facto distribution mechanism.
4. **Enterprise binaries / signed distribution.** Stripe + Anthropic spent 2–3 months building a signed binary outside the npm chain. Every regulated fintech will need this pattern.
5. **AI usage is becoming a performance metric.** JPM tied AI adoption to engineer performance reviews in March 2026. This will spread.
6. **40% of enterprise apps will have task-specific agents by EOY 2026** (Gartner). Today: <5%.

---

## What every major fintech is NOT doing publicly

Across every source I found — Stripe customer story, Block's Goose announcement, Pragmatic Engineer survey of 906 engineers, BlackRock case studies, JPM LLM Suite coverage:

- **Zero public examples** of skill / subagent workflows that attack meetings.
- **Zero public examples** of PM domain-memory agents over PRD/ticket/customer-call corpora.
- **Zero public examples** of cross-team integrator agents that triangulate registry + Jira + Slack to surface hidden collisions.
- **Zero public examples** of oncall companions using the memory tool to recall pattern across pages.
- **Very few public examples** of LLM-as-judge eval harnesses with token-cost tracking gated in CI.

The entire industry is still pointing AI at the IDE. The upstream coordination layer is wide open.

---

## How this repo compares

### Aligned with current best practice ✓

| Practice | Industry norm | This repo |
|---|---|---|
| MCP as integration boundary | Block, Stripe, JPM, Cloudflare | ✓ 4 MCP servers (TypeScript SDK) |
| Multi-model support | Block Goose, JPM LLM Suite | ✓ All agents model-parameterized |
| Synthetic / fallback modes | Standard for demo-able code | ✓ Every live integration falls back to synthetic |
| Plugin manifest / extension model | Block Goose (~70 ext), Aladdin plugin registry | ✓ `plugin.json` bundles everything |
| Structured logging + retry/backoff | Production table stakes | ✓ pino + retry-with-backoff + rate-limit aware |
| Dry-run for write operations | Recommended for fintech MCP | ✓ `DRY_RUN=true` on Slack + Jira writes |
| LLM-judge eval harness | Not yet standardized — early adopter | ✓ 8/8 baseline, token cost tracked, CI-gated |
| Per-tool permission gating | Recommended by MCP enterprise guides | ✓ PreToolUse hook gates Jira writes |

### Forward-leaning compared to peers 🚀

| Direction | Where we are | Where industry is |
|---|---|---|
| Upstream coordination focus (meetings / PM / cross-team / oncall) | 4 workflows shipped | No public examples from any major fintech |
| Triangulated agent context (registry + Jira + Slack in one call) | cross-team-integrator | Not documented elsewhere |
| Eval harness as the gate, not the afterthought | CI-integrated, baseline-tracked | Pragmatic Engineer survey doesn't mention evals at all |
| Memory tool for cross-session pattern recognition | oncall-companion | Not in any fintech case study |
| `DRY_RUN` as first-class operational mode | Built into every write tool | Recommended by MCP guides but rarely shown in code |

### Production-norm gaps to close ⚠

| Gap | Industry norm | This repo |
|---|---|---|
| **OAuth 2.0 / enterprise auth** | Required for any fintech MCP deployment (per Cloudflare, MCP Manager, Strategy.com guides) | API tokens only (basic auth on Jira) |
| **Audit log persistence** | Required for SOX, SR 11-7, GLBA | pino → stderr only; no rotation, no archive |
| **Central gateway / cost governance** | MCP gateways are the recommended fintech pattern | Direct API calls; no per-user/per-team budget |
| **Telemetry / OpenTelemetry** | Standard for production AI infra | Not implemented |
| **Secret-scanning in prompts** | DLP requirement | Not implemented |
| **Shared memory across users** | Required for oncall rotation, team knowledge | filesystem-local single-user |
| **RBAC / SSO** | Required at any enterprise scale | Single-user model |

### Strategic moves peer-companies are making that we could mirror 💡

1. **Stripe's "zero-config enterprise binary"** — distribute the whole plugin as a single pre-configured artifact. We have `plugin.json`; the next step is a signed install command.
2. **Block Goose's open-source ecosystem play** — position this repo as a community-extensible MCP collection. The repo is already public + MIT-licensed; the missing piece is a CONTRIBUTING flow for *new MCP servers* specifically.
3. **JPMorgan's "AI usage as a performance metric"** — emit telemetry that lets an org track adoption per team. We have pino structured logs; aggregating them into a usage dashboard is the next move.
4. **Aladdin's plugin registry pattern** — explicit guide for teams to add their own MCP servers to the bundle. The architecture is there; the docs aren't.
5. **ServiceNow's 300+ pre-built agent skills marketplace** — the catalog model. Could ship as a `skills/` index README.

---

## Recommended next moves for this repo

Ranked by leverage vs. effort. Each is sized for a single grind cycle.

### Tier 1 — close enterprise auth + governance gaps (high leverage, fintech credibility)

- **A. Add an MCP gateway sketch** — a thin `mcp_gateway/` server that fronts the 4 MCP servers, terminates OAuth 2.0, enforces per-user rate limits, and emits audit events. Even as a reference impl, this signals "this is shaped for enterprise."
- **B. Audit log sink** — pino → JSONL on-disk with rotation + a `audit.md` describing the schema. SOX-compatible record without yet adding a SIEM connector.
- **C. Cost governance dashboard** — pino logs already record token usage; aggregate into a small HTML dashboard (per-user, per-team, per-skill). Static-rendered into the docs.

### Tier 2 — ecosystem / community positioning

- **D. "Adding an MCP server" guide** — modeled on Aladdin's plugin registry. Becomes the contract for community contributions.
- **E. Skills catalog index** — flat `skills.md` with all 4 skills' descriptions, triggers, and example outputs. Becomes the marketplace entry point.
- **F. Open-source positioning sweep** — frame the repo's README so it reads as "MCP collection for upstream coordination, fork it for your org" rather than "personal project."

### Tier 3 — production-norm polish

- **G. OpenTelemetry traces** through the agent loop — show end-to-end timing.
- **H. Secret-scanning hook** — PreToolUse hook that checks for high-entropy strings / known credential patterns in any prompt that would hit Slack/Jira.
- **I. Shared-memory backend for oncall** — swap the filesystem memory tool for a SQLite or Redis-backed shared store. Rotates across team.

---

## My read on what to build next

**The thesis is right.** No fintech publicly does what this repo does on the coordination layer. That's a moat, not a gap.

**The implementation has 3 credibility holes for fintech audiences:**
1. No enterprise auth pattern (OAuth 2.0 + RBAC + SSO)
2. No persisted audit trail (just stderr logs)
3. No cost governance (token spend per team)

**Recommended Phase 1.5 (before docs + videos):** ship Tier 1 (A + B + C). That's the difference between "demo" and "could plausibly be deployed at a regulated bank." Once those land, Phase 2 (Confluence docs) and Phase 3 (VHS videos) have the underlying substance to demonstrate.

The Tier 2 community-positioning work (D + E + F) is the lever for making this repo *known* — Phase 2 territory.

The Tier 3 work (G + H + I) is the polish — incremental, no rush.

---

## References

Sources, by section. All accessed May 2026.

**Stripe:**
- [How Stripe rolled out a consistent Cursor experience for 3,000 engineers](https://cursor.com/blog/stripe)
- [Stripe customer story — Claude](https://claude.com/customers/stripe)
- [Model Context Protocol (MCP) — Stripe docs](https://docs.stripe.com/mcp)
- [Build on Stripe with AI](https://docs.stripe.com/building-with-ai)

**Block / Goose:**
- [Block Open Source Introduces "codename goose"](https://block.xyz/inside/block-open-source-introduces-codename-goose)
- [Goose documentation](https://goose-docs.ai/)

**BlackRock / Aladdin:**
- [Introducing Generative AI by Aladdin / Aladdin Copilot](https://www.blackrock.com/aladdin/solutions/aladdin-copilot)
- [How BlackRock's Aladdin Copilot Uses AI and Agentic Architecture](https://www.lowtouch.ai/blackrocks-aladdin-copilot-agentic-architecture-transform-investment-management/)
- [Agentic AI Architecture for Investment Management Platform — ZenML LLMOps Database](https://www.zenml.io/llmops-database/agentic-ai-architecture-for-investment-management-platform)

**JPMorgan:**
- [JPMorgan Ties Engineer Performance Reviews to AI Tool Adoption for 65,000 Staff](https://letsdatascience.com/blog/jpmorgan-tracks-65000-engineers-ai-usage-performance-reviews)
- [JPMorgan Chase's LLM Suite drives AI transformation across the enterprise](https://thedigitalbanker.com/jpmorgan-chases-llm-suite-drives-ai-transformation-across-the-enterprise/)
- [How J.P. Morgan developers leverage AI](https://developer.payments.jpmorgan.com/blog/guides/ai-software-development)

**Klarna:**
- [90% of Klarna staff are using AI daily](https://www.klarna.com/international/press/90-of-klarna-staff-are-using-ai-daily-game-changer-for-productivity/)

**Industry & MCP:**
- [AI Tooling for Software Engineers in 2026 — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/ai-tooling-2026)
- [Scaling MCP adoption — Cloudflare](https://blog.cloudflare.com/enterprise-mcp/)
- [Model Context Protocol servers (registry)](https://github.com/modelcontextprotocol/servers)
- [What is Model Context Protocol and how to leverage it in the fintech industry — Prometeo](https://prometeoapi.com/en/blog/model-context-protocol-fintech)
- [Enterprise MCP — MCP Manager](https://mcpmanager.ai/blog/enterprise-mcp/)
- [Enterprise-Managed Authorization — MCP spec](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization)
- [Gartner: 40% of enterprise apps will feature task-specific AI agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025)
- [How agentic AI will reshape engineering workflows in 2026 — CIO](https://www.cio.com/article/4134741/how-agentic-ai-will-reshape-engineering-workflows-in-2026.html)
