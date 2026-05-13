"""
Cross-Team Integrator Agent

Simulates an MCP-wired surface that an engineer or PM can query to surface:
  - What other teams are doing that overlaps with my work
  - Hidden dependencies that nobody has flagged
  - Owners for things I'd otherwise have to hunt for in Slack

In production, the tools below would be backed by MCP servers reading from
Jira, Confluence, an internal service registry, and a team-ownership graph.
For the demo they read from the synthetic team_data/ corpus.

Run examples:
  python 03_cross_team/agent.py "I'm leading the FlexPay Q3 expansion. What should I be worried about across teams?"
  python 03_cross_team/agent.py "Who else is touching biometric auth right now?"
  python 03_cross_team/agent.py "What's the critical path for shipping FlexPay Standard in Q3?"
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import anthropic

MODEL = "claude-opus-4-7"

SYSTEM = """You are a cross-team integrator agent for enterprise engineering.

Your job: when an engineer or PM asks about their work, you proactively discover
what OTHER teams are doing that overlaps, blocks, or duplicates their effort.

You have three data sources, each better for a different question:
  - team-registry tools (list_teams, get_team_activity, search_across_teams) —
    curated mission + sprint snapshots per team. Best for "who owns what" and
    "what is team X working on this sprint".
  - search_jira — authoritative live ticket state. Best for "what's actually
    in flight" and confirming what the team-registry says.
  - search_slack — recent conversation. Best for catching decisions made
    informally before they hit a ticket — the most common source of hidden
    cross-team collisions.

Use the tools aggressively. Don't ask the user for context you can fetch
yourself. Triangulate: start broad with team-registry, validate against Jira
for live state, scan Slack for things nobody filed a ticket for yet.

Always finish with:
  1. The 2-3 critical hidden dependencies or overlaps
  2. Concrete owners the user should talk to TODAY
  3. The single biggest "if you do not align on X this week, the project ships in Q4 not Q3" warning

Be direct. The audience is a senior engineering leader who values speed over
politeness."""


def load_teams(path: Path) -> dict[str, dict[str, Any]]:
    """Parse the synthetic teams.md into a dict keyed by team name."""
    text = path.read_text()
    teams: dict[str, dict[str, Any]] = {}
    current: str | None = None
    section: str | None = None
    buf: list[str] = []

    def flush() -> None:
        if current and section:
            teams[current].setdefault(section, "\n".join(buf).strip())

    for line in text.splitlines():
        if line.startswith("## team: "):
            flush()
            current = line.removeprefix("## team: ").strip()
            teams[current] = {"name": current}
            section = "header"
            buf = []
        elif line.startswith("### "):
            flush()
            section = line.removeprefix("### ").strip().replace(" ", "_")
            buf = []
        elif current:
            buf.append(line)
    flush()
    return teams


JIRA_ISSUES: list[dict[str, Any]] = [
    {"key": "PLAN-1893", "project": "PLAN", "status": "Open", "summary": "Move FlexPay eligibility check server-side", "assignee": None, "reporter": "Aiko Tanaka"},
    {"key": "PLAN-1925", "project": "PLAN", "status": "In Progress", "summary": "Add biometric step-up to plan creation flow (>$1000)", "assignee": "Marcus Webb", "reporter": "Priya Shankar"},
    {"key": "MOBILE-3501", "project": "MOBILE", "status": "In Progress", "summary": "Integrate FaceID step-up into FlexPay mobile flow (using legacy shared lib)", "assignee": "Aiko Tanaka", "reporter": "Aiko Tanaka"},
    {"key": "MOBILE-3402", "project": "MOBILE", "status": "Open", "summary": "Audit + remediate remaining UIWebView usage", "assignee": None, "reporter": "Aiko Tanaka"},
    {"key": "AUTH-455", "project": "AUTH", "status": "In Progress", "summary": "Re-architect biometric service (centralized) — deprecates legacy shared lib, ETA Q3", "assignee": "Hiroshi Sato", "reporter": "Hiroshi Sato"},
    {"key": "AUTH-441", "project": "AUTH", "status": "In Progress", "summary": "Migrate legacy session token storage to vault-backed scheme (compliance-driven)", "assignee": "Hiroshi Sato", "reporter": "Hiroshi Sato"},
    {"key": "RISK-1102", "project": "RISK", "status": "In Progress", "summary": "Refresh delinquency model for 18-24 segment (FlexPay Standard)", "assignee": "Sasha Pereira", "reporter": "Dana Liu"},
    {"key": "FRAUD-1120", "project": "RISK", "status": "Open", "summary": "Step-up auth v2 — add existing-customer-relationship signal (needs biometric signal from auth)", "assignee": None, "reporter": "Dana Liu"},
    {"key": "COMP-2026-44", "project": "COMP", "status": "Not Started", "summary": "UDAAP review — FlexPay Standard expansion to 18-24 segment", "assignee": "Brett Holloway", "reporter": "Brett Holloway"},
    {"key": "COMP-2026-58", "project": "COMP", "status": "Not Started", "summary": "SR 11-7 model risk doc for new 18-24 delinquency model", "assignee": None, "reporter": "Brett Holloway"},
    {"key": "SVC-3411", "project": "SVC", "status": "Blocked", "summary": "New servicing scripts for FlexPay Standard (blocked on UDAAP)", "assignee": None, "reporter": "Tomás Reyes"},
]

SLACK_MESSAGES: list[dict[str, str]] = [
    {"channel": "flexpay-eng", "user": "Aiko Tanaka", "text": "Heads up: MOBILE-3501 (biometric step-up in FlexPay) is in flight. Using the existing biometric shared lib."},
    {"channel": "flexpay-eng", "user": "Marcus Webb", "text": "PLAN-1893 reopened — server-side eligibility migration, 4 sprints. Need to find capacity."},
    {"channel": "auth-platform", "user": "Hiroshi Sato", "text": "AUTH-455 (biometric service rewrite) is on track for Q3. Heads up: this deprecates the legacy biometric shared library that several teams call."},
    {"channel": "mobile-platform", "user": "Aiko Tanaka", "text": "Decided to integrate FaceID inline in MOBILE-3501 rather than wait for the centralized service. Faster ship, accepting the migration debt."},
    {"channel": "risk-modeling", "user": "Sasha Pereira", "text": "RISK-1102 — thin-file CIs are wide. Directional read possible by Mon, defensible bounds in ~2 wks."},
    {"channel": "flexpay-xfn", "user": "Brett Holloway", "text": "Reminder UDAAP review for Standard expansion has NOT been kicked off. 6-8 wks lead time."},
    {"channel": "flexpay-xfn", "user": "Tomás Reyes", "text": "Servicing AHT on FlexPay is 8.2 min vs 4.1 target. Standard expansion adds projected +14 FTE — finance hasn't approved."},
]


TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "list_teams",
        "description": "List all known teams with their mission and lead. Use this first to get an overview.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_team_activity",
        "description": "Get a specific team's current sprint items and recent decisions. Use this when you want to know what a team is working on right now.",
        "input_schema": {
            "type": "object",
            "properties": {"team_name": {"type": "string", "description": "The team name, e.g. 'plan-it', 'auth-platform'"}},
            "required": ["team_name"],
        },
    },
    {
        "name": "search_across_teams",
        "description": "Free-text search across all team activity (sprints + decisions). Returns matching teams and the matching context. Use this to find hidden cross-team overlaps. Search for specific concepts like 'biometric', 'UDAAP', 'eligibility', 'session token'.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Concept or keyword to search for"}},
            "required": ["query"],
        },
    },
    {
        "name": "search_jira",
        "description": "Search Jira issues by keyword. Returns matching issues from any project with key, status, summary, assignee. Use this to validate cross-team activity against authoritative ticket state — the team-registry data may be stale or incomplete.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Keyword to match against summary or project. Example: 'biometric', 'UDAAP'."}},
            "required": ["query"],
        },
    },
    {
        "name": "search_slack",
        "description": "Search recent Slack messages across team channels. Useful for catching cross-team conversations that haven't been filed in tickets yet — decisions made in conversation are the most common source of hidden cross-team collisions.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Keyword to match in message text."}},
            "required": ["query"],
        },
    },
]


def run_tool(name: str, args: dict[str, Any], teams: dict[str, dict[str, Any]]) -> str:
    if name == "list_teams":
        return json.dumps([
            {"name": t["name"], "header": t.get("header", "")[:200]} for t in teams.values()
        ], indent=2)

    if name == "get_team_activity":
        t = teams.get(args["team_name"])
        if not t:
            return json.dumps({"error": f"unknown team '{args['team_name']}'", "available": list(teams.keys())})
        return json.dumps(t, indent=2)

    if name == "search_across_teams":
        q = args["query"].lower()
        hits: list[dict[str, Any]] = []
        for t in teams.values():
            for section, body in t.items():
                if section == "name":
                    continue
                if q in body.lower():
                    hits.append({"team": t["name"], "section": section, "match": body})
        return json.dumps({"query": args["query"], "hits": hits}, indent=2)

    if name == "search_jira":
        q = args["query"].lower()
        hits_jira = [
            i for i in JIRA_ISSUES
            if q in i["summary"].lower() or q in i["project"].lower() or q in i["key"].lower()
        ]
        return json.dumps({"source": "jira (synthetic)", "query": args["query"], "hit_count": len(hits_jira), "issues": hits_jira}, indent=2)

    if name == "search_slack":
        q = args["query"].lower()
        hits_slack = [m for m in SLACK_MESSAGES if q in m["text"].lower()]
        return json.dumps({"source": "slack (synthetic)", "query": args["query"], "hit_count": len(hits_slack), "messages": hits_slack}, indent=2)

    return json.dumps({"error": f"unknown tool {name}"})


def run_agent(question: str, teams: dict[str, dict[str, Any]]) -> None:
    client = anthropic.Anthropic()
    messages: list[dict[str, Any]] = [{"role": "user", "content": question}]

    print("=" * 70)
    print(f"Q: {question}")
    print("=" * 70)
    print()

    step = 0
    while True:
        step += 1
        response = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            thinking={"type": "adaptive"},
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        for block in response.content:
            if block.type == "tool_use":
                print(f"  [step {step}] → tool: {block.name}({json.dumps(block.input)})", file=sys.stderr)

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    print(block.text)
            return

        if response.stop_reason != "tool_use":
            print(f"unexpected stop_reason: {response.stop_reason}", file=sys.stderr)
            return

        messages.append({"role": "assistant", "content": response.content})

        tool_results: list[dict[str, Any]] = []
        for block in response.content:
            if block.type == "tool_use":
                result = run_tool(block.name, block.input, teams)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        messages.append({"role": "user", "content": tool_results})


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("set ANTHROPIC_API_KEY", file=sys.stderr)
        return 1

    question = (
        " ".join(sys.argv[1:]).strip()
        or "I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across other teams?"
    )

    teams_path = Path(__file__).parent / "team_data" / "teams.md"
    teams = load_teams(teams_path)
    print(f"loaded {len(teams)} teams from {teams_path.name}\n", file=sys.stderr)
    run_agent(question, teams)
    return 0


if __name__ == "__main__":
    sys.exit(main())
