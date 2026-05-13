# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Phase 3.5 — fintech-differentiation)
- **5th workflow: `pr-reviewer`** — measures bug-recall + false-positive precision against a 6-PR synthetic corpus (4 with planted bugs of varying class — null deref, SQL injection, eligibility logic error, resource leak — and 2 genuinely clean). Raw Python form + skill + subagent + `/pr-review` slash command. Golden evals locked at 6/6 PASS.
- **`github` MCP server** (5 tools: `health_check`, `list_open_prs`, `get_pr`, `get_pr_diff`, `post_review_comment`). Synthetic mode reads JSON fixtures from `05_pr_reviewer/synthetic_prs/`; live mode hits GitHub REST. `DRY_RUN` gate on comment posts.
- **`confluence` MCP server** (read-only, 3 tools: `health_check`, `search_pages`, `get_page`). Wired into `pm-historian` for institutional-wiki context (product principles, gating checklists, ADRs).
- **`grafana` MCP server** (read-only, 5 tools: `health_check`, `get_metric_series`, `search_metrics`, `list_dashboards`, `get_dashboard`). Wired into `oncall-companion` so triage can confirm alerts against actual metric data.
- **Meta-orchestrator subagent** (`orchestrator.md`) + `/launch` slash command. Fans out to pm-historian + cross-team-integrator + (conditionally) pr-reviewer + oncall-companion in parallel via `Task` tool, then synthesizes a single brief.
- **Outcomes log + `scripts/log-outcome.py`** — records `pr_merged`, `incident_closed`, `action_done`, `meeting_ended` events to `audit_logs/outcomes-YYYY-MM-DD.jsonl`. Documented in `audit_logs/OUTCOMES_SCHEMA.md`. Cost dashboard now joins audit spend against outcomes for **cost-per-merged-PR-line** + **cost-per-resolved-incident** metrics.
- **5 adversarial / red-team eval suites** — one per workflow. Cases include prompt injection in transcripts, leading-question misframing, unknown-team-no-hallucination, credential-leak-not-echoed, PR-description-doesn't-bypass-review. Each rubric is paired with the happy-path suite; the runner aliases `<skill>-adversarial` → same agent runner.
- **Deterministic `overall_pass` derivation** in `evals/run.py` — derives the case verdict from the per-criterion flags rather than trusting the judge model's own boolean. Eliminates a class of nondeterminism where the judge would set `overall_pass=false` while marking every criterion ✅.
- **Clarified judge semantics** — `must_not_have.passed=True` now consistently means "the forbidden behavior is ABSENT" (good outcome), matching the polarity of `must_have`.
- **MCP gateway** now fronts all 7 backends (added github, confluence, grafana).
- **Plugin manifest bumped to 0.5.0** with 5 skills, 5 subagents, 6 slash commands.
- Test coverage grows to **60 vitest + 51 pytest**. mypy strict still clean across all 5 agents + `_shared` + `evals`.

### Added (Phase 1.5 — fintech credibility)
- **MCP gateway** (`mcp_gateway/gateway.ts`) — HTTP front-door with bearer-token auth (allowlist file, JWT-ready), per-user fixed-window rate limits, per-server ACLs, and per-request audit emission. `/healthz` for orchestrator probes.
- **Audit log sink** — every gateway request emits a SOX/SR 11-7/GLBA-shaped JSONL event to `audit_logs/audit-YYYY-MM-DD.jsonl`. Schema and sample jq queries in `audit_logs/SCHEMA.md`.
- **Cost + adoption dashboard** (`scripts/cost-dashboard.py`) — parses audit JSONL + eval report, renders a static HTML page with per-user/team/server/tool counts, latency p50/p95 per server, and denial-reason breakdown. Cron-able.
- **Adding-an-MCP-server guide** (`docs/adding-an-mcp-server.md`) — 10-step contract for community contributions: synthetic fallback, McpError, retry, DRY_RUN, health_check, tests, eval coverage, architecture-matrix update.
- **Auto-generated skills catalog** (`scripts/generate-skills-catalog.py` → `docs/skills-catalog.md`) — frontmatter + slash-command body parsing to resolve skill→subagent→MCP wiring. CI `--check` verifies freshness.
- **OpenTelemetry instrumentation** on the cross-team agent's tool-use loop. Spans for session, step, model call, per-tool. `_shared/tracing.py` setup; defaults to ConsoleSpanExporter, OTLP-ready for production.
- **Secret-scanner PreToolUse hook** (`.claude/hooks/scan-secrets.mjs`) — refuses Slack/Jira write payloads containing 14 known credential prefixes (Slack/GitHub/GitLab/Atlassian/Anthropic/OpenAI/Stripe/AWS/JWT/private-key) plus high-entropy hex + AWS-secret-shape heuristics.
- **SQLite-backed shared memory for oncall** (`04_oncall_companion/shared_memory.py`) — replaces filesystem-local memory; actor-tracked, soft-delete, WAL-mode. Selectable via `ONCALL_SHARED_MEMORY=true`.
- **OS positioning sweep** on README — repo now reads as "MCP collection for upstream engineering coordination, fork it for your org." Links to the public landscape audit.
- **Research doc** (`research/fintech-ai-eng-landscape.md`) — public-sources audit of Stripe / Block / BlackRock / JPM / Klarna / Ramp AI engineering posture, with concrete recommendations against the repo.
- Tests grow to **43 vitest + 46 pytest** all green. mypy strict still clean.
- CI runs `scripts/generate-skills-catalog.py --check` so the catalog can't drift.

### Phase 1 — prod-grade hardening (earlier in [Unreleased])
- Structured logging across all MCP servers and Python agents (pino for TS, stdlib `logging` for Python).
- Retry-with-backoff + rate-limit awareness for the `slack` and `jira` MCP server live-API paths.
- In-memory LRU cache + pagination support on MCP read endpoints.
- Proper `McpError` types replacing `isError: true` returns throughout.
- Vitest test suite for all 4 MCP servers (synthetic mode — no network required).
- pytest suite for the 4 Python agents (anthropic client mocked).
- mypy strict mode for the Python side.
- `health_check` tool on every MCP server.
- Token-cost tracking in `evals/run.py`.
- CI eval-gate: pull requests that regress eval pass rate fail CI.
- Oncall workflow eval coverage (golden YAML + baseline).
- Repo hygiene files: LICENSE (MIT), CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.

## [0.2.0] — 2026-05-12

### Added
- 4th workflow: `oncall-companion`. Raw Python form uses `BetaAbstractMemoryTool` subclass + `client.beta.messages.tool_runner().until_done()`. Productized form ships skill + subagent + `/oncall` slash command.
- `03_cross_team/agent.py` now triangulates team-registry + Jira + Slack via inline synthetic data.
- GitHub Actions CI: 3 jobs (typescript / python / hooks) — green on first push.
- Eval harness: golden YAML rubrics + LLM judge (`claude-opus-4-7`). Baseline 6/6 pass.
- `PreToolUse` hook gating `mcp__jira__jira_create_issue` + `mcp__jira__jira_add_comment` when `DRY_RUN` is unset.

### Changed
- Plugin manifest bumped to 0.2.0 to reflect the 4-workflow surface.

## [0.1.0] — 2026-05-12

### Added
- Initial commit: 3 workflows (meeting-killer, pm-memory, cross-team) each implemented twice — raw Python + Anthropic SDK, and productized as a Claude Code plugin.
- TypeScript MCP servers: `pm-memory`, `team-registry`.
- Live-API MCP servers: `slack` (Web API) + `jira` (Cloud REST v3) with synthetic fallback when credentials are missing.
- `PostToolUse` hook for ambient transcript detection.
- Plugin manifest bundling skills + agents + slash commands + MCP servers + hooks.
