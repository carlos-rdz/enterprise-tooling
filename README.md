# enterprise-coordination

A Claude Code plugin that explores what AI tooling for engineering teams looks like when you stop building coding assistants and start building for the *upstream* dysfunctions — too many meetings, product teams without product memory, and cross-team silos that turn every initiative into a re-negotiation.

Three workflows, each implemented **twice**: once as a Claude Code plugin (skill + slash command + subagent + MCP server + hook), and once as a raw Python script using the Anthropic SDK directly. Same model, same prompts, very different leverage.

**Start here:** [`architecture.md`](architecture.md) — the tool-surface map and composition diagram.

---

## What's in the repo

```
.
├── architecture.md             # tool-surface map + composition diagram
├── SYNTHETIC_DATA_NOTICE.md    # confirms every name/product/ticket is fabricated
│
├── .claude-plugin/plugin.json  # plugin manifest — bundles everything below
├── .claude/
│   ├── settings.json           # PostToolUse hook: detects transcript writes
│   ├── skills/                 # 3 skills: meeting-killer, pm-memory, cross-team
│   ├── agents/                 # 2 subagents: pm-historian, cross-team-integrator
│   └── commands/               # 3 slash commands
├── .mcp.json                   # registers the 2 MCP servers
├── mcp_servers/                # TypeScript MCP servers (@modelcontextprotocol/sdk)
│   ├── pm_memory/
│   └── team_registry/
│
├── 01_meeting_killer/          # raw form: Python + Anthropic SDK
│   ├── agent.py
│   ├── transcript.md           # synthetic meeting transcript
│   └── captured_output.md      # what the agent produced from it
├── 02_pm_memory/
│   ├── agent.py
│   ├── corpus/                 # synthetic PRDs, tickets, customer-call summaries
│   └── captured_output.md
└── 03_cross_team/
    ├── agent.py
    ├── team_data/teams.md      # synthetic team activity snapshots
    └── captured_output.md
```

## The three workflows

| | What it does | Surfaces |
|---|---|---|
| **Meeting killer** | Ingests a meeting transcript and produces a structured action graph, per-attendee followup drafts, an attendance audit ("who didn't need to be there"), and a blunt sync-vs-async verdict. | Skill + slash command + hook |
| **PM domain memory** | Answers product-history questions by querying a corpus of PRDs, tickets, and customer calls through an MCP server. Cites sources. Warns when the asker is about to repeat a known mistake. | Skill + slash command + subagent + MCP server |
| **Cross-team integrator** | Discovers hidden cross-team dependencies and overlaps by querying a team-activity registry through an MCP server. Surfaces collisions humans can't see from their seat. | Skill + slash command + subagent + MCP server |

## Setup

```bash
git clone https://github.com/carlos-rdz/enterprise-tooling
cd enterprise-tooling

# JS side (MCP servers)
npm install

# Python side (raw-form scripts)
python3 -m venv .venv && source .venv/bin/activate
pip install anthropic pydantic

export ANTHROPIC_API_KEY=sk-ant-...
```

## Run the productized form (Claude Code)

Inside a Claude Code session in this directory:

```
/meeting-killer 01_meeting_killer/transcript.md
/pm-memory We're being asked to ship FlexPay Standard in Q3. What do I need to know?
/cross-team I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across teams?
```

The slash commands invoke skills, which delegate to subagents, which call MCP servers. The hook fires automatically when a transcript-like `.md` file is written, suggesting `/meeting-killer`.

## Run the raw form (Python + Anthropic SDK)

```bash
python 01_meeting_killer/agent.py
python 02_pm_memory/agent.py "why was FlexPay Standard killed last year"
python 03_cross_team/agent.py "who else is touching biometric auth right now"
```

Same workflows, same model (`claude-opus-4-7` with adaptive thinking), no Claude Code stack. The `captured_output.md` files in each directory show what these produce on the synthetic inputs.

## Why this exists

Most "AI for engineering" investment goes into the IDE — code completion, inline suggestions, faster typing. That's the easy part and table stakes within 12 months. The harder, more leveraged work lives upstream of code:

- A typical engineering week has more hours of meetings than hours of focused code.
- Product teams onboard onto products they don't yet understand and have no fast way to learn the history.
- Cross-team coordination overhead compounds with org size — and AI is uniquely well-suited to dissolve it.

This repo is an exploration of what that looks like when you compose the full Claude Code + Claude API stack against those problems instead of against the IDE.
