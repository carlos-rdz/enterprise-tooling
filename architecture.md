# Architecture — Tool Surface Map

Each of the three workflows is implemented twice: once as a raw Python script calling the Anthropic SDK directly, and once as a Claude Code plugin assembled from skills, subagents, slash commands, MCP servers, and a hook. Same model, same prompts, very different leverage.

## The two implementations

| | RAW form | PRODUCTIZED form |
|---|---|---|
| Stack | Anthropic Python SDK only | Claude Code: skill + slash + subagent + MCP + hook + plugin |
| Audience | Programmatic callers, batch jobs, CI | Interactive use inside a Claude Code session |
| Token cost per call | Same model, same prompts | Same model, same prompts |
| Code per workflow | ~150 lines (script + Pydantic schema) | ~30 lines (the platform does the heavy lifting) |

Both call `claude-opus-4-7` with adaptive thinking. The productized form isn't smarter — it's **leveraged**. That's the entire point of investing in the Claude Code platform layer instead of building one-off scripts.

---

## Tool-surface coverage matrix

| Component | 1: Meeting Killer | 2: PM Memory | 3: Cross-Team | 4: Oncall Companion | Where it lives |
|---|---|---|---|---|---|
| **Skill** | `meeting-killer` | `pm-memory` | `cross-team` | `oncall-companion` | `.claude/skills/*/SKILL.md` |
| **Slash command** | `/meeting-killer` | `/pm-memory` | `/cross-team` | `/oncall` | `.claude/commands/*.md` |
| **Subagent** | — | `pm-historian` | `cross-team-integrator` | `oncall-companion` | `.claude/agents/*.md` |
| **MCP server (local data)** | — | `pm-memory` | `team-registry` | — | `mcp_servers/*/server.ts` |
| **MCP server (live API)** | `slack` + `jira` (writes) | `slack` + `jira` (reads) | `slack` + `jira` (reads) | `slack` + `jira` (reads) | `mcp_servers/{slack,jira}/server.ts` |
| **Hook (PostToolUse)** | transcript-detection on `Write` | — | — | — | `.claude/settings.json` |
| **Hook (PreToolUse)** | Jira write gate | Jira write gate | Jira write gate | Jira write gate | `.claude/hooks/gate-jira-writes.mjs` |
| **Plugin manifest** | bundled | bundled | bundled | bundled | `.claude-plugin/plugin.json` |
| **Adaptive thinking** | ✓ | ✓ | ✓ | ✓ | model param |
| **Structured outputs (Pydantic)** | ✓ (raw form) | ✓ (raw form) | — | — | `*/agent.py` |
| **Manual tool-use loop** | — | via subagent | ✓ (raw form) | — | `03_cross_team/agent.py` |
| **SDK tool runner (`tool_runner().until_done()`)** | — | — | — | ✓ (raw form) | `04_oncall_companion/agent.py` |
| **Memory tool (`BetaAbstractMemoryTool`)** | — | — | — | ✓ (raw form, filesystem-backed) | `04_oncall_companion/agent.py` |
| **Prompt caching** | — | ✓ (raw form, on corpus) | — | — | `02_pm_memory/agent.py` |
| **Real API integration** | Slack + Jira writes | Slack + Jira reads | Slack + Jira reads | Slack + Jira reads | env-gated, synthetic fallback |
| **Eval coverage** | 1 case | 3 cases | 2 cases | 2 cases | `evals/golden/*.yaml` |
| **Structured logging** | ✓ stdlib logging (JSON to stderr) | ✓ | ✓ | ✓ | `_shared/logging_setup.py` |
| **Retry / backoff / rate-limit** | — | — | — | — | `mcp_servers/_shared/retry.ts` (live MCP servers only) |
| **LRU cache (TTL'd)** | — | search results | search results | — | `mcp_servers/_shared/cache.ts` |
| **`health_check` MCP tool** | — | ✓ | ✓ | ✓ | every MCP server |
| **Tests (vitest + pytest)** | ✓ | ✓ | ✓ | ✓ | `tests/` |
| **mypy strict** | ✓ | ✓ | ✓ | ✓ | `mypy.ini` + `scripts/typecheck-agents.sh` |

Combined, these workflows exercise substantially the full public Claude Code + Claude API surface: skills, slash commands, subagents, MCP servers (TS SDK with both local-data and live-API patterns), PostToolUse + PreToolUse hooks, plugin bundling, adaptive thinking, structured outputs, manual tool-use loops, the SDK tool runner, the memory tool, prompt caching, settings.json + .mcp.json configuration, live integration with external SaaS APIs, and an LLM-judge eval harness gating the whole thing.

---

## How it composes

```
                  ┌─────────────────────────┐
                  │   /meeting-killer       │ ←─ slash command (UX surface)
                  │   /pm-memory            │
                  │   /cross-team           │
                  └────────────┬────────────┘
                               │ invokes
                ┌──────────────▼──────────────┐
                │   Skills (meeting-killer,   │ ←─ structured prompts
                │   pm-memory, cross-team)    │    + workflow definitions
                └──┬──────────────────────┬───┘
                   │                      │ delegates to
                   │           ┌──────────▼──────────┐
                   │           │   Subagents          │ ←─ pm-historian
                   │           │   (separate context, │    cross-team-integrator
                   │           │    Opus 4.7)         │
                   │           └──────────┬───────────┘
                   │                      │ calls tools on
                   ▼                      ▼
              ┌────────────────────────────────────┐
              │   MCP servers (TypeScript, stdio)  │ ←─ pm-memory, team-registry
              │   - typed Zod schemas              │    (local-data: synthetic .md corpora)
              │   - shared across all agents       │
              │                                    │ ←─ slack, jira
              │                                    │    (live API: real Slack workspace + Jira Cloud
              │                                    │     when env vars set; synthetic fallback otherwise)
              └────────────────────────────────────┘


              ┌─────────────────────────────┐
   ambient    │   PostToolUse hook on Write │ ←─ detects transcript writes,
   workflow   │   (.claude/settings.json)   │    nudges Claude to invoke the skill
              └─────────────────────────────┘

              ┌─────────────────────────────┐
   shipping   │   plugin.json               │ ←─ one installable bundle
              │   (.claude-plugin/)         │    distributable to every engineer
              └─────────────────────────────┘

              ┌─────────────────────────────┐
   quality    │   evals/                    │ ←─ golden YAML rubrics +
   gate       │   golden/*.yaml + run.py    │    LLM judge (Opus 4.7)
              │                             │    eval-gates prompt/model changes
              └─────────────────────────────┘

              ┌─────────────────────────────┐
   CI         │   .github/workflows/ci.yml  │ ←─ typecheck + MCP smoke +
              │                             │    Python compile + hook tests
              └─────────────────────────────┘

              ┌─────────────────────────────────────────────────┐
   prod       │   mcp_gateway/gateway.ts                        │ ←─ HTTP front-door:
   front-     │   - bearer-token auth (allowlist file → JWT)    │    auth + ACL + rate
   door       │   - per-user rate limit + per-server ACL        │    limit + audit
              │   - JSONL audit log per request (SOX schema)    │
              │                                                 │
              │   scripts/cost-dashboard.py → docs/*.html       │ ←─ adoption + cost
              └─────────────────────────────────────────────────┘
```

---

## Design principles

1. **MCP servers are the integration boundary.** Anything that touches an external system (local corpus, Jira Cloud, Slack workspace, future Confluence) lives behind an MCP server with a typed Zod schema. Skills and subagents call those tools; they never reach for the data directly. This means each new data source is added once and reused by every workflow — the same `slack` server serves the meeting-killer (writes), the pm-historian (reads), and the cross-team-integrator (reads).

2. **Synthetic fallback is a first-class mode, not a stub.** Every server with a real-API integration (Slack, Jira) checks env vars on startup and falls back to a coherent synthetic dataset when credentials are missing. `npm install && npx tsx` always works for someone cloning fresh; the same code paths handle both modes. This is the pattern for shipping AI integrations that need to be demoable AND productionizable from one codebase.

3. **`DRY_RUN=true` for safe demos against real workspaces.** Even with real credentials, every write operation (Slack post/DM, Jira create/comment) checks `DRY_RUN` and logs to stderr instead of executing. Critical for demoing in a real workspace without spamming channels or littering Jira.

4. **Subagents own the heavy work.** Workflows that need a separate reasoning context (pm-historian doing deep history synthesis, cross-team-integrator pivoting across many tool calls) are subagents with their own model selection, system prompt, and tool allowlist. Skills stay light; subagents do the cognitive lifting.

5. **Skills are the workflow definition.** A skill's `SKILL.md` is both human documentation and the prompt the model loads when it auto-triggers. The frontmatter `description` is the trigger contract; the body is the spec.

6. **Hooks for ambient workflow.** The transcript-detection hook is the simplest possible demonstration: notice a file pattern, suggest the relevant skill. The same shape applies to PR creation, ticket transitions, incident pages.

7. **Plugin manifest as the shipping unit.** A `plugin.json` bundles skills + agents + commands + MCP servers + hooks into one installable artifact. The deployment story for an enterprise rollout is "install one plugin," not "configure six things."

---

## TypeScript vs Python — why both

- **TypeScript for MCP servers.** Most enterprise MCP work — Linear, GitHub, Notion, internal tools — is TypeScript-shaped. Zod schemas give you typed tool inputs across the network boundary, which pays off the moment multiple agents start sharing the same server. The `@modelcontextprotocol/sdk` ergonomics in TS are notably clean.

- **Python for the raw-form scripts.** Pydantic + `client.messages.parse()` is the cleanest demonstration of structured outputs in the Anthropic SDK. The raw scripts are also a useful reference when you want to know what the Claude Code stack is doing under the covers.

---

## Possible extensions

- **More subagents.** `incident-historian` (postmortem corpus), `compliance-pre-reviewer` (policy + prior reviews), `ticket-triage` (Jira backlog hygiene). Each one a Senior IC's tribal knowledge made callable.
- **Wire the cross-team integrator into PR creation.** A hook on `gh pr create` that runs the integrator on the diff and auto-tags adjacent-team owners.
- **Eval harness.** Golden questions per skill, an LLM judge, weekly regression report. The infrastructure piece that's most often missing in real enterprise AI deployments.
- **Cost + adoption dashboards.** Token spend per skill, invocation counts, accept rate, with per-team budgets.
