---
description: Review a pull request — find real bugs, cite evidence, mark with severity, post comments if requested
argument-hint: <PR number, URL, or "list" to see open PRs>
---

Use the `pr-reviewer` subagent to review: $ARGUMENTS

The subagent will:
1. Fetch the PR metadata + diff via the `github` MCP server
2. Walk each changed file looking for bugs (null deref, SQLi, logic errors, resource leaks, etc.)
3. Return structured findings — APPROVE / REQUEST CHANGES / COMMENT with severity ceiling
4. If asked, post review comments back to the PR (honoring `DRY_RUN=true`)

If `$ARGUMENTS` is "list", show the open PRs first.
If no arguments given, default to: "list".
