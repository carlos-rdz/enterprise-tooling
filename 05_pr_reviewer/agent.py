"""
PR Reviewer Agent

Given a PR number, fetches metadata + diff from the github MCP server (synthetic
mode by default — reads JSON fixtures), then walks the diff and produces
structured findings: APPROVE / REQUEST CHANGES / COMMENT with per-finding
severity, evidence, and fix proposal.

Run:
  python 05_pr_reviewer/agent.py 202        # review PR #202
  python 05_pr_reviewer/agent.py            # default: review PR #203

Eval-tuned for bug recall + precision against the planted-bug corpus in
synthetic_prs/. See evals/golden/pr-reviewer.yaml.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Literal

import anthropic
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _shared.logging_setup import get_logger  # noqa: E402

log = get_logger("pr-reviewer")

MODEL = "claude-opus-4-7"
REPO_ROOT = Path(__file__).resolve().parent.parent
SYNTHETIC_PR_DIR = REPO_ROOT / "05_pr_reviewer" / "synthetic_prs"


SYSTEM = """You are a senior code reviewer for an enterprise engineering team.

The bar is BUG RECALL + PRECISION. Find real bugs. Don't manufacture issues to
fill out a review.

For each PR you walk every changed file looking for, in priority order:
  - SECURITY: SQL injection, command injection, auth bypass, secret material in code
  - DATA LOSS: dropped writes, race conditions, missing transactions
  - CRASHES: possibly-None values accessed without guards, out-of-bounds
  - LOGIC: operator swaps (and/or, </<=, etc.), off-by-one in financial calcs
  - CORRECTNESS: broken error handling, swallowed exceptions, missing edge cases
  - RESOURCES: unclosed files / connections / cursors

Severity bar:
  CRITICAL: security (SQLi, auth bypass, secret leak), data loss, guaranteed crash
  MAJOR:    will fail under input the function's signature accepts — including:
            * unguarded None returns from upstream services (can't prove
              upstream is exhaustive)
            * logic-op swaps (and/or, </<=, =/==)
            * financial-correctness violations
            * unparameterized inputs that aren't already CRITICAL SQLi
            * resource leaks under repeated invocation
  MINOR:    local issue that won't fail under common input (swallowed
            exception with no log; missing rare edge case)
  INFO:     style. Cap at 1 per review.

When in doubt between MAJOR and MINOR, prefer MAJOR if you cannot
mechanically prove the failure path is unreachable. The cost of an
under-classified MAJOR is an incident; the cost of an over-classified
MINOR is a 30-second discussion in the PR thread.

If a PR is genuinely clean, your verdict is APPROVE with "No issues found
at major+ severity." Lying about a clean review by inventing nits is a
failure mode you must avoid.

Every finding cites a specific quote from the diff as evidence."""


class Finding(BaseModel):
    severity: Literal["critical", "major", "minor", "info"]
    summary: str = Field(description="One-line summary of the issue")
    file: str
    issue: str = Field(description="Concrete description of what is broken")
    evidence: str = Field(description="Verbatim quote from the diff (one or two lines)")
    fix: str = Field(description="Specific proposed change")


class Review(BaseModel):
    pr_number: int
    pr_title: str
    verdict: Literal["APPROVE", "REQUEST CHANGES", "COMMENT"]
    severity_ceiling: Literal["none", "info", "minor", "major", "critical"]
    findings: list[Finding]
    verified_safe: list[str] = Field(
        default_factory=list,
        description="Concerns the reviewer specifically checked and ruled out. Helps the author trust the review.",
    )


# ---- Tool runner over the github MCP server ----------------------------------


def call_mcp_tool(server_path: Path, tool: str, args: dict[str, Any]) -> dict[str, Any]:
    """Run an MCP server one-shot and return the tool result. Synthetic mode."""
    payload_lines = [
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "pr-reviewer", "version": "0"},
                },
            }
        ),
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
        json.dumps(
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": tool, "arguments": args}}
        ),
    ]
    proc = subprocess.run(
        ["npx", "tsx", str(server_path)],
        input="\n".join(payload_lines) + "\n",
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "LOG_LEVEL": "error"},
    )
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if msg.get("id") == 2:
            content = msg["result"]["content"][0]["text"]
            parsed: dict[str, Any] = json.loads(content)
            return parsed
    raise RuntimeError(f"no tools/call response for {tool}: {proc.stdout[:500]}{proc.stderr[:500]}")


def fetch_pr_via_mcp(pr_number: int) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Pull (metadata, files) via the github MCP server."""
    server = REPO_ROOT / "mcp_servers" / "github" / "server.ts"
    meta = call_mcp_tool(server, "get_pr", {"number": pr_number})
    diff = call_mcp_tool(server, "get_pr_diff", {"number": pr_number})
    return meta["pr"], diff["files"]


# ---- Review pipeline ---------------------------------------------------------


def review_pr(pr_number: int) -> Review:
    log.info("fetching PR via github MCP server", extra={"pr_number": pr_number})
    pr_meta, files = fetch_pr_via_mcp(pr_number)

    user_message = (
        f"PR #{pr_meta['number']} by {pr_meta['author']} on branch {pr_meta.get('head', '?')} → {pr_meta.get('base', '?')}\n"
        f"Title: {pr_meta['title']}\n"
        f"Labels: {', '.join(pr_meta.get('labels', []))}\n"
        f"\nDESCRIPTION:\n{pr_meta.get('description', '')}\n"
        f"\n--- DIFF ({len(files)} file{'s' if len(files) != 1 else ''}) ---\n"
    )
    for f in files:
        user_message += f"\n=== {f['path']} ===\n{f['diff']}\n"

    log.info("calling Claude", extra={"model": MODEL, "files": len(files)})
    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        messages=[{"role": "user", "content": user_message}],
        output_format=Review,
    )
    usage = response.usage
    log.info(
        "claude responded",
        extra={
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
        },
    )
    parsed = response.parsed_output
    if parsed is None:
        raise RuntimeError("model returned no parsed output — check stop_reason and rerun")
    return parsed


# ---- Rendering ---------------------------------------------------------------


SEVERITY_GLYPH = {"critical": "🔴 CRITICAL", "major": "🟠 MAJOR", "minor": "🟡 MINOR", "info": "ℹ️ INFO"}


def render(review: Review) -> str:
    out: list[str] = []
    out.append("=" * 70)
    out.append(f"PR Review: #{review.pr_number} — {review.pr_title}")
    out.append("=" * 70)
    out.append("")
    out.append(f"Verdict:          {review.verdict}")
    out.append(f"Bugs found:       {sum(1 for f in review.findings if f.severity in ('critical', 'major'))}")
    out.append(f"Severity ceiling: {review.severity_ceiling}")
    out.append("")
    if review.findings:
        out.append("FINDINGS")
        out.append("-" * 70)
        for f in review.findings:
            out.append(f"\n{SEVERITY_GLYPH[f.severity]} — {f.summary}")
            out.append(f"  File:     {f.file}")
            out.append(f"  Issue:    {f.issue}")
            out.append(f"  Evidence: {f.evidence}")
            out.append(f"  Fix:      {f.fix}")
        out.append("")
    else:
        out.append("No issues found at major+ severity.")
        out.append("")
    if review.verified_safe:
        out.append("VERIFIED SAFE")
        out.append("-" * 70)
        for note in review.verified_safe:
            out.append(f"  ✓ {note}")
    return "\n".join(out)


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.error("ANTHROPIC_API_KEY not set")
        return 1

    try:
        pr_number = int(sys.argv[1]) if len(sys.argv) > 1 else 203
    except ValueError:
        log.error("invalid PR number", extra={"argv": sys.argv[1:]})
        return 1

    review = review_pr(pr_number)
    print(render(review))
    return 0


if __name__ == "__main__":
    sys.exit(main())
