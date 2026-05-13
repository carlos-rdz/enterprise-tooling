# Outcomes log schema

The outcomes log records real-world events that close the loop between AI
spend (recorded in `audit-YYYY-MM-DD.jsonl`) and the value delivered. Pairing
the two lets you compute `cost-per-merged-PR`, `cost-per-resolved-incident`,
and `cost-per-completed-action-item` — the metrics that answer *"is the AI
paying for itself"* without hand-waving.

Records are written by `scripts/log-outcome.py` (manual + webhook-driven)
to `audit_logs/outcomes-YYYY-MM-DD.jsonl`.

## Event kinds

### `pr_merged`

```json
{
  "ts": "2026-05-13T02:15:00Z",
  "kind": "pr_merged",
  "pr": 1247,
  "ai_touched_lines": 42,
  "user": "carlos@example.com",
  "repo": "owner/repo"
}
```

In production: wire a GitHub webhook on `pull_request.closed` with `merged=true`.
Set `ai_touched_lines` by diffing the PR against commits authored or assisted
by an agent — your CI bot can append a label.

### `incident_closed`

```json
{
  "ts": "...",
  "kind": "incident_closed",
  "incident": "INC-9001",
  "duration_minutes": 47,
  "user": "hiroshi@example.com",
  "ai_assisted": true
}
```

`ai_assisted=true` means the on-call companion or another agent was used
during triage. Compare resolution time / cost between assisted vs. not.

### `action_done`

```json
{
  "ts": "...",
  "kind": "action_done",
  "action_id": "PLAN-1893",
  "user": "marcus@example.com",
  "source_meeting": "Q3 expansion sync transcript"
}
```

A meeting-killer action graph entry that completed. Lets you measure
meeting-killer's downstream value: of N action items the agent surfaced,
how many actually got done.

### `meeting_ended`

```json
{
  "ts": "...",
  "kind": "meeting_ended",
  "meeting": "Q3 expansion sync",
  "action_count": 7,
  "sync_score": 4
}
```

Recorded by the meeting-killer skill at end of analysis. The base rate
for `action_done` joins.

## How to wire this in production

1. **GitHub webhook** on `pull_request.closed` → POST to a small handler
   that calls `python scripts/log-outcome.py pr-merged`.
2. **PagerDuty webhook** on `incident.resolved` → same shape.
3. **Jira webhook** on issue transitioned to `Done` → look up the source
   meeting / agent run, log `action-done`.
4. **The meeting-killer skill itself** logs `meeting-ended` at the end of
   each analysis (already done as of the next release).

## Querying

```bash
# Today's merged PRs with AI-touched lines
jq 'select(.kind == "pr_merged")' audit_logs/outcomes-$(date -u +%F).jsonl

# Total AI-touched lines merged this week
cat audit_logs/outcomes-2026-05-*.jsonl \
  | jq -s 'map(select(.kind == "pr_merged") | .ai_touched_lines) | add'

# Per-user PR count this month
jq -r 'select(.kind == "pr_merged") | .user' audit_logs/outcomes-2026-05-*.jsonl \
  | sort | uniq -c | sort -rn

# Cost-per-merged-PR-line (requires both audit + outcomes for the same window)
# See scripts/cost-dashboard.py — it joins them for you.
```
