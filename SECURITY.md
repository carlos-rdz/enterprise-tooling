# Security Policy

## Reporting a vulnerability

If you find a security issue in this repository, **please do not open a public GitHub issue.** Instead, email the maintainer directly (see commit metadata for contact) with:

- A description of the issue
- Steps to reproduce
- The impact you observed
- Any suggested mitigation

You'll receive an acknowledgement within 72 hours.

## Threat model

This repository ships agent tooling that integrates with real third-party SaaS (Slack, Jira Cloud) and uses Claude API credentials. The security boundary worth caring about:

| Asset | Where it lives | How it's protected |
|---|---|---|
| `ANTHROPIC_API_KEY` | env var, never written to disk by the repo | Required for Python agents and eval runner. Never committed (`.env` is gitignored). |
| `SLACK_BOT_TOKEN` | `.env`, gitignored | Required for live Slack MCP server. Synthetic mode requires no token. |
| `JIRA_API_TOKEN` | `.env`, gitignored | Required for live Jira MCP server. Synthetic mode requires no token. |
| Local PRD/ticket corpus (`02_pm_memory/corpus/`) | repo, public | Entirely synthetic and fabricated. See [SYNTHETIC_DATA_NOTICE.md](SYNTHETIC_DATA_NOTICE.md). |
| On-call memory store (`04_oncall_companion/.memory/`) | local filesystem, gitignored | The filesystem-backed memory tool refuses any path that would escape the sandbox root (see `_resolve` in the agent). |

## Hardening present in the repo

- **PreToolUse hook** (`.claude/hooks/gate-jira-writes.mjs`) gates `mcp__jira__jira_create_issue` and `mcp__jira__jira_add_comment` whenever `DRY_RUN` is unset. Claude Code will ask for explicit user confirmation before any real Jira write fires.
- **`DRY_RUN=true`** on the Slack and Jira MCP servers turns every write into a stderr log instead of a real API call. This is the default in `.env.example`.
- **Path traversal guard** in the oncall companion's `FilesystemMemoryTool`: every memory path is `.resolve()`'d and refused if it escapes the sandbox root.
- **No secrets in prompts:** vault-style credential injection happens at the MCP server boundary, not via the model. Prompts and message history never contain raw tokens.

## Known limitations

- The Python agents call Anthropic's API directly with the user's key. There is no upstream proxy or rate limiter in this repo; expect to consume real credit per run.
- The Jira MCP server uses Basic auth (email + API token). Token scoping is whatever the bot account has — scope the bot, not the token.
- The Slack MCP server uses a bot user OAuth token (xoxb-). Scope it to the minimum required channels.
- The repo does **not** implement audit logging for live API mutations beyond pino's structured log output. If you're deploying internally, wire pino to your log aggregator before turning off `DRY_RUN`.
