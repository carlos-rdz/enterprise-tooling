# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Prod-grade hardening pass: structured logging across all MCP servers and Python agents (pino for TS, stdlib `logging` for Python).
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
