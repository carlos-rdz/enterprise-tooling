#!/usr/bin/env python3
"""
Log a real-world outcome — a merged PR, a closed incident, a completed
action item — to the outcomes JSONL so the cost dashboard can compute
cost-per-outcome.

This is the metric that answers "is the AI paying for itself" without
hand-waving. Audit log records inputs (token spend). Outcomes log records
the matching outputs. Joining gives you USD per merged-PR-touched-line,
USD per resolved incident, USD per completed action item.

Usage:
  scripts/log-outcome.py pr-merged       --pr 123 --ai-touched-lines 42 --user carlos@example.com
  scripts/log-outcome.py incident-closed --incident INC-9001 --duration-minutes 47 --user hiroshi@example.com
  scripts/log-outcome.py action-done     --action-id PLAN-1893 --user marcus@example.com
  scripts/log-outcome.py meeting-ended   --meeting "Q3 expansion sync" --action-count 4

In production this is called by:
  - A GitHub-webhook handler on pull_request.closed (merged=true)
  - A PagerDuty-webhook handler on incident.resolved
  - A Jira-webhook handler on issue transitioned to Done
  - The meeting-killer skill itself when it writes the action graph

Stdlib only — keeps the deploy surface tiny.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTCOMES_DIR = REPO_ROOT / "audit_logs"


def outcomes_path() -> Path:
    OUTCOMES_DIR.mkdir(parents=True, exist_ok=True)
    ymd = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return OUTCOMES_DIR / f"outcomes-{ymd}.jsonl"


def log_event(kind: str, **fields: Any) -> dict[str, Any]:
    event: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        **fields,
    }
    with outcomes_path().open("a") as f:
        f.write(json.dumps(event) + "\n")
    return event


def cmd_pr_merged(args: argparse.Namespace) -> dict[str, Any]:
    return log_event(
        "pr_merged",
        pr=args.pr,
        ai_touched_lines=args.ai_touched_lines,
        user=args.user,
        repo=args.repo,
    )


def cmd_incident_closed(args: argparse.Namespace) -> dict[str, Any]:
    return log_event(
        "incident_closed",
        incident=args.incident,
        duration_minutes=args.duration_minutes,
        user=args.user,
        ai_assisted=args.ai_assisted,
    )


def cmd_action_done(args: argparse.Namespace) -> dict[str, Any]:
    return log_event(
        "action_done",
        action_id=args.action_id,
        user=args.user,
        source_meeting=args.source_meeting,
    )


def cmd_meeting_ended(args: argparse.Namespace) -> dict[str, Any]:
    return log_event(
        "meeting_ended",
        meeting=args.meeting,
        action_count=args.action_count,
        sync_score=args.sync_score,
    )


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="kind", required=True)

    pr = sub.add_parser("pr-merged", help="A PR was merged with AI-touched lines.")
    pr.add_argument("--pr", type=int, required=True)
    pr.add_argument("--ai-touched-lines", type=int, required=True)
    pr.add_argument("--user", required=True)
    pr.add_argument("--repo", default="carlos-rdz/enterprise-tooling")
    pr.set_defaults(func=cmd_pr_merged)

    inc = sub.add_parser("incident-closed", help="An incident was resolved.")
    inc.add_argument("--incident", required=True)
    inc.add_argument("--duration-minutes", type=int, required=True)
    inc.add_argument("--user", required=True)
    inc.add_argument("--ai-assisted", action="store_true",
                     help="Set if the oncall-companion or a similar agent was used during triage.")
    inc.set_defaults(func=cmd_incident_closed)

    act = sub.add_parser("action-done", help="A meeting action item or ticket completed.")
    act.add_argument("--action-id", required=True)
    act.add_argument("--user", required=True)
    act.add_argument("--source-meeting", default=None,
                     help="If known, the meeting title or transcript path that produced this action.")
    act.set_defaults(func=cmd_action_done)

    meet = sub.add_parser("meeting-ended", help="A meeting was analyzed by the meeting-killer skill.")
    meet.add_argument("--meeting", required=True, help="Meeting title or transcript identifier.")
    meet.add_argument("--action-count", type=int, required=True)
    meet.add_argument("--sync-score", type=int, default=None)
    meet.set_defaults(func=cmd_meeting_ended)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    event = args.func(args)
    print(json.dumps(event), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
