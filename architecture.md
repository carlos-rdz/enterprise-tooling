# Architecture — Tool Surface Map

> The same three workflows, built **two ways**. Left column proves I understand the primitive. Right column proves I know the stack every the enterprise engineer should have in their daily flow tomorrow morning.

## The two implementations

| | RAW form (what an engineer ships) | PRODUCTIZED form (what every engineer uses) |
|---|---|---|
| Stack | Anthropic Python SDK only | Claude Code: skill + slash + subagent + MCP + hook + plugin |
| Audience | Programmatic callers, batch jobs, CI | Every IC and PM at the enterprise, every day |
| Token cost per call | Same model, same prompts | Same model, same prompts |
| Lines of code I wrote | ~150 / demo | ~30 / demo (the heavy lifting is the platform) |

Both call `claude-opus-4-7` with adaptive thinking. The productized form isn't "smarter" — it's **leveraged**. That's the entire point of platform investment in this space.

---

## Tool-surface coverage matrix

| Component | Demo 1: Meeting Killer | Demo 2: PM Memory | Demo 3: Cross-Team | Where it lives |
|---|---|---|---|---|
| **Skill** | `meeting-killer` | `pm-memory` | `cross-team` | `.claude/skills/*/SKILL.md` |
| **Slash command** | `/meeting-killer` | `/pm-memory` | `/cross-team` | `.claude/commands/*.md` |
| **Subagent** | — | `pm-historian` | `cross-team-integrator` | `.claude/agents/*.md` |
| **MCP server** | — | `pm-memory` (TypeScript) | `team-registry` (TypeScript) | `mcp_servers/*/server.ts` |
| **Hook** | `PostToolUse` on Write → transcript detection | — | — | `.claude/settings.json` |
| **Plugin manifest** | bundles all three | bundles all three | bundles all three | `.claude-plugin/plugin.json` |
| **Adaptive thinking** | ✓ | ✓ | ✓ | model param |
| **Structured outputs (Pydantic)** | ✓ (raw form) | ✓ (raw form) | — | `*/agent.py` |
| **Tool-use loop** | — | via subagent | ✓ (raw form, manual) | `03_cross_team/agent.py` |
| **Prompt caching** | — | ✓ (raw form, on corpus) | — | `02_pm_memory/agent.py` |

By the end of the demo, the panel has seen: **skills, slash commands, subagents, MCP servers (TypeScript SDK), hooks, plugin bundling, adaptive thinking, structured outputs, tool use, prompt caching, settings.json config.** That's substantially the entire Claude Code + Claude API surface.

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
                               │ (in production: Confluence, Jira, Gong, service registry)
                               │ (in demo: local .md corpus)


              ┌─────────────────────────────┐
   ambient    │   PostToolUse hook on Write │ ←─ detects transcript writes,
   workflow   │   (.claude/settings.json)   │    nudges Claude to invoke skill
              └─────────────────────────────┘

              ┌─────────────────────────────┐
   shipping   │   plugin.json               │ ←─ one installable bundle
              │   (.claude-plugin/)         │    every engineer at the enterprise
              └─────────────────────────────┘
```

---

## What this proves for the role

1. **I know the primitive.** Raw SDK with structured outputs + adaptive thinking + manual tool-use loops.
2. **I know the productivity stack.** Skills, subagents, slash commands, MCP, hooks, plugin format.
3. **I understand the deployment model.** One plugin, one MCP-server registration, one `npm install` — every engineer has the same baseline.
4. **I've made the architectural call.** TypeScript MCP servers because that's what most enterprise MCP work looks like and the type system pays off across many consumers. Python raw scripts because Pydantic + the Anthropic SDK are the cleanest demo of structured outputs.
5. **I see the upstream work.** None of these demos are coding assistants. They attack meeting overhead, PM domain ignorance, and cross-team silos — the three things I've been calling out for four years as a Director.

---

## Production roadmap (year-1, abbreviated)

| Quarter | Move |
|---|---|
| Q1 | Ship the plugin internally. Wire MCP servers to real Confluence + Jira behind read-only service accounts. Eval framework live (golden questions per skill, weekly judge). |
| Q2 | Subagent fleet expansion: `incident-historian`, `compliance-pre-reviewer`, `ticket-triage`. Each one a Senior IC's tribal knowledge made callable. |
| Q3 | Cross-team integrator wired into PR creation — auto-tag adjacent-team owners on PRs that touch their surface area. |
| Q4 | Cost + adoption dashboards. Eval-gated model upgrades. Plugin marketplace for the enterprise-internal contributions from BU teams. |
