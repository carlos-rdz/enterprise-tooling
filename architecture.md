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

| Component | Demo 1: Meeting Killer | Demo 2: PM Memory | Demo 3: Cross-Team | Where it lives |
|---|---|---|---|---|
| **Skill** | `meeting-killer` | `pm-memory` | `cross-team` | `.claude/skills/*/SKILL.md` |
| **Slash command** | `/meeting-killer` | `/pm-memory` | `/cross-team` | `.claude/commands/*.md` |
| **Subagent** | — | `pm-historian` | `cross-team-integrator` | `.claude/agents/*.md` |
| **MCP server** | — | `pm-memory` (TypeScript) | `team-registry` (TypeScript) | `mcp_servers/*/server.ts` |
| **Hook** | `PostToolUse` on `Write` → transcript detection | — | — | `.claude/settings.json` |
| **Plugin manifest** | bundles all three | bundles all three | bundles all three | `.claude-plugin/plugin.json` |
| **Adaptive thinking** | ✓ | ✓ | ✓ | model param |
| **Structured outputs (Pydantic)** | ✓ (raw form) | ✓ (raw form) | — | `*/agent.py` |
| **Tool-use loop** | — | via subagent | ✓ (raw form, manual) | `03_cross_team/agent.py` |
| **Prompt caching** | — | ✓ (raw form, on corpus) | — | `02_pm_memory/agent.py` |

Combined, these three workflows exercise most of the public Claude Code + Claude API surface: skills, slash commands, subagents, MCP servers (TypeScript SDK), hooks, plugin bundling, adaptive thinking, structured outputs, manual tool use, prompt caching, settings.json configuration.

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
              │   MCP servers (TypeScript, stdio)  │ ←─ pm-memory
              │   - typed Zod schemas              │    team-registry
              │   - shared across all agents       │
              └────────────────────────────────────┘
                               ▲
                               │ (in production: Confluence, Jira, transcript stores,
                               │  service registry. In this repo: local .md corpus.)


              ┌─────────────────────────────┐
   ambient    │   PostToolUse hook on Write │ ←─ detects transcript writes,
   workflow   │   (.claude/settings.json)   │    nudges Claude to invoke the skill
              └─────────────────────────────┘

              ┌─────────────────────────────┐
   shipping   │   plugin.json               │ ←─ one installable bundle
              │   (.claude-plugin/)         │    distributable to every engineer
              └─────────────────────────────┘
```

---

## Design principles

1. **MCP servers are the integration boundary.** Anything that touches an external system (corpus, Jira, Confluence, transcript store) lives behind an MCP server with a typed Zod schema. Skills and subagents call those tools; they never reach for the data directly. This means each new data source is added once and reused by every workflow.

2. **Subagents own the heavy work.** Workflows that need a separate reasoning context (pm-historian doing deep history synthesis, cross-team-integrator pivoting across many tool calls) are subagents with their own model selection, system prompt, and tool allowlist. Skills stay light; subagents do the cognitive lifting.

3. **Skills are the workflow definition.** A skill's `SKILL.md` is both human documentation and the prompt the model loads when it auto-triggers. The frontmatter `description` is the trigger contract; the body is the spec.

4. **Hooks for ambient workflow.** The transcript-detection hook is the simplest possible demonstration: notice a file pattern, suggest the relevant skill. The same shape applies to PR creation, ticket transitions, incident pages.

5. **Plugin manifest as the shipping unit.** A `plugin.json` bundles skills + agents + commands + MCP servers + hooks into one installable artifact. The deployment story for an enterprise rollout is "install one plugin," not "configure six things."

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
