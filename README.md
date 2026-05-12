# Senior Staff Demo — Coordination AI Plugin

Three working agent workflows packaged as a Claude Code plugin. Built to demonstrate the upstream coordination layer is where AI leverage at the enterprise lives — not code completion.

**Start here:** [`architecture.md`](architecture.md) — the tool-surface map.

---

## What's in the repo

```
.
├── architecture.md             # tool-surface map — read first
│
├── .claude-plugin/plugin.json  # plugin manifest — one installable bundle
├── .claude/
│   ├── settings.json           # PostToolUse hook (transcript detection)
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
│   └── transcript.md
├── 02_pm_memory/
│   ├── agent.py
│   └── corpus/                 # PRDs, tickets, customer calls (synthetic)
└── 03_cross_team/
    ├── agent.py
    └── team_data/teams.md
```

## Setup

```bash
cd /Users/crodriguez/interview

# JS side (MCP servers)
npm install

# Python side (raw-form demos)
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

The slash commands invoke skills, which delegate to subagents, which call MCP servers. The hook fires automatically when a transcript-like `.md` file gets written, suggesting `/meeting-killer`.

## Run the raw form (Python + Anthropic SDK)

```bash
python 01_meeting_killer/agent.py
python 02_pm_memory/agent.py "why was FlexPay Standard killed last year"
python 03_cross_team/agent.py "who else is touching biometric auth right now"
```

Same workflows, same model (`claude-opus-4-7` with adaptive thinking), no Claude Code stack.

## Demo flow for the interview (~3 min)

1. Open [`architecture.md`](architecture.md) — tool surface map. (15 sec)
2. Show `.claude/skills/meeting-killer/SKILL.md` + run `/meeting-killer` in Claude Code. (45 sec)
3. Show the side-by-side: SKILL.md vs `01_meeting_killer/agent.py`. (15 sec)
4. Run `/cross-team` — watch the subagent call MCP tools, find the biometric overlap. (60 sec)
5. Show `.claude-plugin/plugin.json` — *"one install, every engineer at the enterprise has this."* (15 sec)
6. Close: *"None of this is a coding assistant. These are the upstream dysfunctions code completion will never touch."* (10 sec)

## The thesis

> "We already gave devs Cursor, Claude, Copilot. That's table stakes and the easy part. The actual leverage is killing meetings, giving PMs domain memory, and dissolving the team boundaries that make every cross-team project a re-negotiation. That's the year-1 thesis. Coding completion is a feature; this is a platform."
