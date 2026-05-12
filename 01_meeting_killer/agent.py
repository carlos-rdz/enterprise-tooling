"""
Meeting Killer Agent

Ingests a meeting transcript and produces:
  1. Structured action graph (who, what, by when, dependencies)
  2. Drafted followup messages per attendee with action items
  3. "Who didn't need to be here" analysis
  4. A one-line "could this have been async?" verdict

Run:
  python 01_meeting_killer/agent.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

MODEL = "claude-opus-4-7"

SYSTEM = """You are an analyst whose job is to make meetings die faster.

You read a transcript and produce four artifacts:
1. A structured action graph
2. Per-attendee followup drafts
3. An attendance audit — who didn't need to be there and why
4. A blunt verdict on whether the meeting needed to happen synchronously at all

Be direct. No corporate hedging. If an attendee added zero value, say so.
If the meeting should have been an email, say so.
Your audience is a senior engineering leader at a Fortune 100 bank who is sick
of meetings eating engineering capacity."""


class ActionItem(BaseModel):
    owner: str
    action: str
    due_by: str = Field(description="Specific date or relative deadline as stated")
    depends_on: list[str] = Field(default_factory=list, description="Other action item descriptions this blocks/requires")
    risk_if_missed: str


class AttendanceJudgment(BaseModel):
    attendee: str
    verdict: Literal["essential", "borderline", "could_have_been_briefed"]
    reason: str


class FollowupDraft(BaseModel):
    recipient: str
    subject: str
    body: str


class MeetingAnalysis(BaseModel):
    one_line_verdict: str = Field(description="Did this meeting need to be synchronous? One sentence.")
    sync_score: int = Field(ge=0, le=10, description="0 = should have been async memo. 10 = could not have been anything else.")
    action_graph: list[ActionItem]
    attendance_audit: list[AttendanceJudgment]
    followup_drafts: list[FollowupDraft]
    structural_observations: list[str] = Field(description="Patterns the org should fix — e.g. 'critical info surfaced 47 min in', 'no single owner declared until prompted'")


def analyze_meeting(transcript: str) -> MeetingAnalysis:
    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"""Analyze the following meeting transcript.

Produce the full analysis. Be specific. Use attendee names verbatim from the transcript.

For followup drafts: only draft for attendees who have action items or unresolved questions.
For attendance audit: be honest about who could have just been CC'd on a memo.

TRANSCRIPT:
---
{transcript}
---""",
            }
        ],
        output_format=MeetingAnalysis,
    )
    return response.parsed_output


def render(analysis: MeetingAnalysis) -> str:
    out: list[str] = []
    out.append("=" * 70)
    out.append("MEETING POSTMORTEM")
    out.append("=" * 70)
    out.append("")
    out.append(f"VERDICT: {analysis.one_line_verdict}")
    out.append(f"SYNC SCORE: {analysis.sync_score}/10")
    out.append("")

    out.append("-" * 70)
    out.append("ACTION GRAPH")
    out.append("-" * 70)
    for i, a in enumerate(analysis.action_graph, 1):
        out.append(f"{i}. [{a.owner}] {a.action}")
        out.append(f"   Due: {a.due_by}")
        if a.depends_on:
            out.append(f"   Depends on: {', '.join(a.depends_on)}")
        out.append(f"   Risk if missed: {a.risk_if_missed}")
        out.append("")

    out.append("-" * 70)
    out.append("ATTENDANCE AUDIT")
    out.append("-" * 70)
    for j in analysis.attendance_audit:
        marker = {"essential": "[KEEP] ", "borderline": "[?]    ", "could_have_been_briefed": "[CUT]  "}[j.verdict]
        out.append(f"{marker} {j.attendee} — {j.reason}")
    out.append("")

    out.append("-" * 70)
    out.append("STRUCTURAL OBSERVATIONS")
    out.append("-" * 70)
    for obs in analysis.structural_observations:
        out.append(f"• {obs}")
    out.append("")

    out.append("-" * 70)
    out.append("FOLLOWUP DRAFTS")
    out.append("-" * 70)
    for d in analysis.followup_drafts:
        out.append(f"\nTo: {d.recipient}")
        out.append(f"Subject: {d.subject}")
        out.append("")
        out.append(d.body)
        out.append("")
        out.append("- " * 30)

    return "\n".join(out)


def main() -> int:
    transcript_path = Path(__file__).parent / "transcript.md"
    if not transcript_path.exists():
        print(f"missing {transcript_path}", file=sys.stderr)
        return 1
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("set ANTHROPIC_API_KEY", file=sys.stderr)
        return 1

    transcript = transcript_path.read_text()
    print(f"analyzing transcript ({len(transcript)} chars)...\n", file=sys.stderr)
    analysis = analyze_meeting(transcript)
    print(render(analysis))
    return 0


if __name__ == "__main__":
    sys.exit(main())
