---
description: One-shot brief for a multi-team initiative — fans out to PM history, cross-team, oncall, PR scan, then synthesizes
argument-hint: <one-line initiative description, e.g. "FlexPay Q3 Standard expansion">
---

Use the `orchestrator` subagent to produce a coherent brief on: $ARGUMENTS

The orchestrator will fan out in parallel to pm-historian, cross-team-integrator, and (if relevant) pr-reviewer + oncall-companion, plus inline Confluence and Jira lookups, then synthesize one brief with:
- One-line verdict (can this ship as scoped)
- Top 3 risks with owners + this-week actions
- History + cross-team picture
- Live state (open tickets, PRs, recent incidents, relevant runbooks)
- Specific people to talk to this week
- Single biggest "if you don't do this, ship slips" warning

If no arguments given, default to: "FlexPay Q3 Standard expansion".
