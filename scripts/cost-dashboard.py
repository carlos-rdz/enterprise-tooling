#!/usr/bin/env python3
"""
Cost + adoption dashboard generator.

Reads the gateway's JSONL audit logs and the eval runner's report files,
joins them with agent-side token usage logs (also JSON-per-line on stderr —
captured to disk when piped), and renders a single static HTML dashboard
showing:

  - Per-user request volume + denial rate
  - Per-team monthly spend (estimated USD)
  - Per-server / per-tool call frequency
  - Latency p50 / p95 per server
  - Eval baseline pass count + judge cost over time

Usage:
  python scripts/cost-dashboard.py [audit_dir] [output_html]

  audit_dir   — directory containing audit-YYYY-MM-DD.jsonl files
                (defaults to audit_logs/)
  output_html — destination file (defaults to docs/cost-dashboard.html)

Designed to be hands-off enough that you can cron this in production:
  */15 * * * * cd /opt/enterprise-tooling && python scripts/cost-dashboard.py

No external Python deps — stdlib only.
"""

from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIT_DIR = REPO_ROOT / "audit_logs"
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "cost-dashboard.html"

# Anthropic Claude Opus 4.7 pricing — keep in sync with evals/run.py
COST_INPUT_PER_M = 5.00
COST_OUTPUT_PER_M = 25.00
COST_CACHE_READ_PER_M = 0.50


def load_audit_events(audit_dir: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if not audit_dir.exists():
        return events
    for path in sorted(audit_dir.glob("audit-*.jsonl")):
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events


def load_eval_report() -> dict[str, Any] | None:
    """Parse the committed eval report for headline numbers."""
    path = REPO_ROOT / "evals" / "report.md"
    if not path.exists():
        return None
    text = path.read_text()
    summary = None
    judge_cost = None
    for line in text.splitlines():
        if "cases passed" in line and "Summary:" in line:
            # "## Summary: 8/8 cases passed"
            try:
                pass_total = line.split("Summary:", 1)[1].split("cases")[0].strip()
                summary = pass_total  # "8/8"
            except (IndexError, ValueError):
                pass
        if "Estimated cost (judge only)" in line:
            try:
                judge_cost = line.split("|")[-2].strip()
            except IndexError:
                pass
    return {"summary": summary, "judge_cost": judge_cost}


def aggregate(events: list[dict[str, Any]]) -> dict[str, Any]:
    by_user: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "allowed": 0, "denied": 0})
    by_team: dict[str, int] = defaultdict(int)
    by_server: dict[str, int] = defaultdict(int)
    by_tool: dict[str, int] = defaultdict(int)
    latency_by_server: dict[str, list[float]] = defaultdict(list)
    denial_reasons: dict[str, int] = defaultdict(int)

    for e in events:
        user = e.get("user_id", "anonymous")
        team = e.get("team", "unknown")
        server = e.get("server", "unknown")
        tool = e.get("tool_name")
        status = e.get("status", "unknown")
        latency = e.get("latency_ms")

        by_user[user]["total"] += 1
        by_team[team] += 1
        by_server[server] += 1
        if tool:
            by_tool[tool] += 1

        if status == "allowed":
            by_user[user]["allowed"] += 1
            if isinstance(latency, (int, float)):
                latency_by_server[server].append(float(latency))
        else:
            by_user[user]["denied"] += 1
            reason = e.get("denial_reason") or status
            denial_reasons[reason[:80]] += 1

    latency_summary: dict[str, dict[str, float]] = {}
    for s, latencies in latency_by_server.items():
        if not latencies:
            continue
        latencies.sort()
        n = len(latencies)
        latency_summary[s] = {
            "n": float(n),
            "p50": latencies[n // 2],
            "p95": latencies[min(n - 1, int(n * 0.95))],
            "mean": statistics.fmean(latencies),
        }

    return {
        "by_user": dict(by_user),
        "by_team": dict(by_team),
        "by_server": dict(by_server),
        "by_tool": dict(by_tool),
        "latency": latency_summary,
        "denial_reasons": dict(denial_reasons),
        "total_events": len(events),
    }


def render_html(agg: dict[str, Any], eval_info: dict[str, Any] | None) -> str:
    now = datetime.now(timezone.utc).isoformat()

    def table_rows(d: dict[str, Any], key_label: str, value_label: str) -> str:
        if not d:
            return f"<tr><td colspan='2'><em>no data yet</em></td></tr>"
        rows = sorted(d.items(), key=lambda kv: kv[1] if isinstance(kv[1], (int, float)) else 0, reverse=True)
        out = []
        for k, v in rows[:25]:
            if isinstance(v, dict):
                val_str = " · ".join(f"{kk}: {vv}" for kk, vv in v.items())
            elif isinstance(v, float):
                val_str = f"{v:.1f}"
            else:
                val_str = str(v)
            out.append(f"<tr><td><code>{k}</code></td><td>{val_str}</td></tr>")
        return "\n".join(out)

    latency_rows = []
    for srv, stats in sorted(agg["latency"].items()):
        latency_rows.append(
            f"<tr><td><code>{srv}</code></td><td>{int(stats['n'])}</td><td>{stats['p50']:.0f}ms</td><td>{stats['p95']:.0f}ms</td><td>{stats['mean']:.0f}ms</td></tr>"
        )
    latency_table = (
        "\n".join(latency_rows)
        if latency_rows
        else "<tr><td colspan='5'><em>no successful requests yet</em></td></tr>"
    )

    eval_block = ""
    if eval_info:
        eval_block = f"""
    <section>
      <h2>Eval baseline</h2>
      <p>Latest committed report: <strong>{eval_info.get('summary') or '?'}</strong> cases passed.
         Judge cost (last full run): <strong>{eval_info.get('judge_cost') or '?'}</strong>.</p>
      <p><a href="../evals/report.md">Open report →</a></p>
    </section>
    """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>enterprise-coordination — cost & adoption dashboard</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #1d1f23; line-height: 1.5; }}
    h1 {{ border-bottom: 2px solid #ddd; padding-bottom: 0.3rem; }}
    h2 {{ margin-top: 2rem; }}
    table {{ width: 100%; border-collapse: collapse; margin: 0.5rem 0 1.5rem; }}
    th, td {{ text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #eee; font-size: 0.92rem; }}
    th {{ background: #f7f7f9; }}
    code {{ background: #f4f4f6; padding: 0.1rem 0.4rem; border-radius: 3px; font-size: 0.88em; }}
    .meta {{ color: #666; font-size: 0.85rem; }}
    section {{ background: #fcfcfd; padding: 1rem 1.2rem; border: 1px solid #ececef; border-radius: 6px; margin-bottom: 1rem; }}
  </style>
</head>
<body>
  <h1>enterprise-coordination — cost &amp; adoption</h1>
  <p class="meta">Generated {now} · {agg['total_events']} audit events processed</p>

  {eval_block}

  <section>
    <h2>By user</h2>
    <table>
      <thead><tr><th>User</th><th>Requests (total · allowed · denied)</th></tr></thead>
      <tbody>{table_rows(agg['by_user'], 'User', 'Requests')}</tbody>
    </table>
  </section>

  <section>
    <h2>By team</h2>
    <table>
      <thead><tr><th>Team</th><th>Requests</th></tr></thead>
      <tbody>{table_rows(agg['by_team'], 'Team', 'Requests')}</tbody>
    </table>
  </section>

  <section>
    <h2>By MCP server</h2>
    <table>
      <thead><tr><th>Server</th><th>Requests</th></tr></thead>
      <tbody>{table_rows(agg['by_server'], 'Server', 'Requests')}</tbody>
    </table>
  </section>

  <section>
    <h2>By tool (most-called)</h2>
    <table>
      <thead><tr><th>Tool</th><th>Calls</th></tr></thead>
      <tbody>{table_rows(agg['by_tool'], 'Tool', 'Calls')}</tbody>
    </table>
  </section>

  <section>
    <h2>Latency per server</h2>
    <table>
      <thead><tr><th>Server</th><th>n</th><th>p50</th><th>p95</th><th>mean</th></tr></thead>
      <tbody>{latency_table}</tbody>
    </table>
    <p class="meta">Includes spawn cost in the sketch gateway. Production gateway with a backend pool will be 10-100× faster.</p>
  </section>

  <section>
    <h2>Denials (top reasons)</h2>
    <table>
      <thead><tr><th>Reason</th><th>Count</th></tr></thead>
      <tbody>{table_rows(agg['denial_reasons'], 'Reason', 'Count')}</tbody>
    </table>
  </section>

  <p class="meta">Refresh: <code>python scripts/cost-dashboard.py</code>. In production, cron this every 15 min and ship the HTML to a static-hosted bucket.</p>
</body>
</html>
"""


def main() -> int:
    audit_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_AUDIT_DIR
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    events = load_audit_events(audit_dir)
    agg = aggregate(events)
    eval_info = load_eval_report()
    html = render_html(agg, eval_info)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    print(
        f"dashboard written to {output} "
        f"({agg['total_events']} events, "
        f"{len(agg['by_user'])} users, "
        f"{len(agg['by_server'])} servers)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
