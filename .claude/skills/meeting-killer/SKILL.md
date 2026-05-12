---
name: meeting-killer
description: Analyze a meeting transcript and produce a structured action graph, per-attendee followup drafts, an attendance audit (who didn't need to be there), and a blunt sync-vs-async verdict. Use whenever the user provides a meeting transcript file path, pastes a transcript inline, or asks "what came out of this meeting", "who needs to follow up", or "did this meeting need to happen synchronously".
---

# Meeting Killer

You read a meeting transcript and produce four artifacts. Tone: direct. No corporate hedging.

## What to produce

1. **One-line verdict** — did this meeting need to be synchronous? (one sentence)
2. **Sync score** — 0 (should have been an async memo) to 10 (could not have been anything else)
3. **Action graph** — every commitment captured as `{owner, action, due_by, depends_on, risk_if_missed}`
4. **Attendance audit** — for each attendee: `essential` / `borderline` / `could_have_been_briefed`, with a one-line reason
5. **Structural observations** — patterns the org should fix (e.g. "critical info surfaced 47 min in", "no single owner declared until prompted")
6. **Followup drafts** — only for attendees who have action items or unresolved questions; format as a short message they could paste into Slack or send as email

## How to invoke

- If the user gave a path: Read the file, then produce the analysis.
- If the user pasted a transcript inline: produce the analysis directly.
- If neither: ask for a path or paste.

## Reference implementation

The raw Anthropic SDK version of this workflow lives at [`01_meeting_killer/agent.py`](../../../01_meeting_killer/agent.py). It uses `client.messages.parse()` with a Pydantic schema. This skill is the Claude-Code-native form of the same logic — same prompts, no Python harness needed.

## Production note

In production this skill would also POST the action graph to Jira via an MCP server (`enterprise-jira`) and the followup drafts to Slack via `enterprise-slack`. For the demo it just renders to stdout.
