# enterprise-coordination

![ci](https://github.com/carlos-rdz/enterprise-tooling/actions/workflows/ci.yml/badge.svg)
![evals](https://github.com/carlos-rdz/enterprise-tooling/actions/workflows/evals.yml/badge.svg)

A Claude Code plugin that explores what AI tooling for engineering teams looks like when you stop building coding assistants and start building for the *upstream* dysfunctions — too many meetings, product teams without product memory, cross-team silos that turn every initiative into a re-negotiation, and on-call rotations where pattern recognition across prior incidents lives in nobody's head.

Four workflows, each implemented **twice**: once as a Claude Code plugin (skill + slash command + subagent + MCP server + hook), and once as a raw Python script using the Anthropic SDK directly. Same model, same prompts, very different leverage.

**Start here:** [`architecture.md`](architecture.md) — the tool-surface map and composition diagram.

**Prod-grade:** structured logging (pino + stdlib `logging`), retry-with-backoff on upstream APIs, LRU caches on read endpoints, `McpError` types, `health_check` tools, strict mypy + 33 pytest + 33 vitest tests, LLM-judge eval harness gated in CI. Three operational modes per integration: synthetic / dry-run / live.

---

## What's in the repo

```
.
├── architecture.md             # tool-surface map + composition diagram
├── SYNTHETIC_DATA_NOTICE.md    # confirms every name/product/ticket is fabricated
│
├── .claude-plugin/plugin.json  # plugin manifest — bundles everything below
├── .claude/
│   ├── settings.json           # 2 hooks: transcript detection + Jira write gate
│   ├── hooks/                  # gate-jira-writes.mjs (PreToolUse)
│   ├── skills/                 # 4 skills (meeting-killer, pm-memory, cross-team, oncall-companion)
│   ├── agents/                 # 3 subagents (pm-historian, cross-team-integrator, oncall-companion)
│   └── commands/               # 4 slash commands
├── .mcp.json                   # registers all 4 MCP servers
├── .env.example                # template for Slack + Jira credentials (optional)
├── mcp_servers/                # TypeScript MCP servers (@modelcontextprotocol/sdk)
│   ├── pm_memory/              # local: PRDs/tickets/calls corpus
│   ├── team_registry/          # local: team activity snapshots
│   ├── slack/                  # live Slack Web API + synthetic fallback
│   └── jira/                   # live Jira Cloud REST API + synthetic fallback
│
├── evals/                      # behavioral eval harness
│   ├── golden/                 # YAML rubrics per skill (must_have / must_not_have)
│   ├── run.py                  # runner + LLM judge (Claude Opus 4.7)
│   ├── runs/<ts>/              # per-run agent outputs + reports
│   └── report.md               # latest run summary
│
├── 01_meeting_killer/          # raw form: Python + Anthropic SDK
│   ├── agent.py
│   ├── transcript.md
│   └── captured_output.md
├── 02_pm_memory/
│   ├── agent.py
│   ├── corpus/                 # synthetic PRDs, tickets, customer-call summaries
│   └── captured_output.md
├── 03_cross_team/
│   ├── agent.py                # triangulates team-registry + Jira + Slack
│   ├── team_data/teams.md
│   └── captured_output.md
├── 04_oncall_companion/        # raw form: tool runner + memory tool
│   ├── agent.py
│   └── incidents/              # synthetic page snapshots
│
├── tests/                      # Vitest (MCP servers + shared modules) + pytest (Python agents)
│   ├── mcp-servers.test.ts
│   └── python/test_*.py
│
├── scripts/typecheck-agents.sh # per-agent mypy strict (handles the "four files named agent.py" case)
├── mypy.ini                    # strict mode config for _shared + evals
├── vitest.config.ts            # TS test config + coverage
├── pytest.ini                  # pytest config
│
└── .github/workflows/
    ├── ci.yml                  # typecheck + tests + MCP smoke + hook tests
    └── evals.yml               # nightly LLM-judge eval-gate, fails on regression
```

## The four workflows

| | What it does | Claude Code surfaces it uses |
|---|---|---|
| **Meeting killer** | Ingests a meeting transcript and produces a structured action graph, per-attendee followup drafts, attendance audit ("who didn't need to be there"), and a blunt sync-vs-async verdict. Optionally creates Jira tickets + Slack DMs. | Skill + slash + PostToolUse hook + Jira/Slack MCP |
| **PM domain memory** | Answers product-history questions over PRDs, tickets, customer calls. Cites sources. Warns when the asker is about to repeat a known mistake. | Skill + slash + subagent + pm-memory MCP + Jira read + Slack read |
| **Cross-team integrator** | Discovers hidden cross-team dependencies and overlaps by triangulating team-registry + live Jira state + recent Slack. Surfaces collisions humans can't see from their seat. | Skill + slash + subagent + team-registry MCP + Jira read + Slack read |
| **Oncall companion** | At 3am when you're paged, recalls every prior incident from memory, surfaces patterns ("this is the 3rd biometric incident in 16 days"), and writes a new memory note so the next on-call benefits. | Skill + slash + subagent + memory tool + Jira read + Slack read |

## Setup

```bash
git clone https://github.com/carlos-rdz/enterprise-tooling
cd enterprise-tooling

# JS side (MCP servers)
npm install

# Python side (raw-form scripts)
python3 -m venv .venv && source .venv/bin/activate
pip install anthropic pydantic pyyaml

export ANTHROPIC_API_KEY=sk-ant-...
```

### Optional: real Slack + Jira

Out of the box, the `slack` and `jira` MCP servers return synthetic FlexPay-shaped responses. To connect them to a real workspace:

```bash
cp .env.example .env
# Fill in SLACK_BOT_TOKEN, JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
# Leave DRY_RUN=true while testing — writes log to stderr instead of executing
```

- **Slack:** Create a Slack app, install to your workspace, copy the Bot User OAuth Token. Bot scopes needed: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `im:write`, `chat:write`, `search:read`, `users:read`, `users:read.email`.
- **Jira Cloud:** Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens. `JIRA_HOST` is your Atlassian subdomain (e.g. `yourco.atlassian.net`).

A PreToolUse hook (`.claude/hooks/gate-jira-writes.mjs`) gates `jira_create_issue` and `jira_add_comment` whenever `DRY_RUN` is unset — Claude Code asks for explicit user confirmation before any real Jira write fires.

## Run the productized form (Claude Code)

Inside a Claude Code session in this directory:

```
/meeting-killer 01_meeting_killer/transcript.md
/pm-memory We're being asked to ship FlexPay Standard in Q3. What do I need to know?
/cross-team I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across teams?
/oncall paste-your-page-here-or-give-a-file-path
```

The slash commands invoke skills, which delegate to subagents, which call MCP servers. The transcript hook fires automatically when a transcript-shaped `.md` file is written. The Jira-write hook fires before any Jira mutation.

## Run the raw form (Python + Anthropic SDK)

```bash
python 01_meeting_killer/agent.py
python 02_pm_memory/agent.py "why was FlexPay Standard killed last year"
python 03_cross_team/agent.py "who else is touching biometric auth right now"
python 04_oncall_companion/agent.py < 04_oncall_companion/incidents/page_001.md
```

Same workflows, same model (`claude-opus-4-7` with adaptive thinking), no Claude Code stack. The `captured_output.md` files show what these produce on the synthetic inputs.

## Evals

Behavioral eval harness with LLM judge:

```bash
python evals/run.py                 # all skills
python evals/run.py meeting-killer  # one skill
python evals/run.py oncall-companion
```

Cases live in `evals/golden/<skill>.yaml` as `must_have` / `must_not_have` criteria. A judge model (Claude Opus 4.7) grades each agent output against the rubric and writes a markdown report to `evals/report.md`. Each case captures the agent's full output to `evals/runs/<ts>/` and tracks judge token cost so cost-per-eval doesn't surprise anyone.

The `.github/workflows/evals.yml` workflow runs the suite nightly (and on manual dispatch) against the committed baseline pass count — if a change drops the pass rate below baseline, CI fails. This is the **eval-gate**.

Current baseline: **8/8 cases pass**. See `evals/report.md`. Judge cost per full run: ~$0.25 (Opus 4.7 input + output + cache-read tokens).

## Tests

```bash
npm test                # Vitest — 33 tests covering shared modules + all 4 MCP servers
pytest tests/python -q  # pytest — 33 tests covering all 4 Python agents + _shared

npm run typecheck       # tsc --noEmit
mypy                    # _shared + evals strict
bash scripts/typecheck-agents.sh  # per-agent strict
```

All check on every push and PR via `.github/workflows/ci.yml`.

## Why this exists

Most "AI for engineering" investment goes into the IDE — code completion, inline suggestions, faster typing. That's the easy part and table stakes within 12 months. The harder, more leveraged work lives upstream of code:

- A typical engineering week has more hours of meetings than hours of focused code.
- Product teams onboard onto products they don't yet understand and have no fast way to learn the history.
- Cross-team coordination overhead compounds with org size — and AI is uniquely well-suited to dissolve it.
- On-call rotations rediscover the same patterns every quarter because there's no shared memory across pages.

This repo is an exploration of what that looks like when you compose the full Claude Code + Claude API stack against those problems instead of against the IDE.
