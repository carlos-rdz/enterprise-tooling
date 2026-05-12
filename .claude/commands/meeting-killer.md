---
description: Analyze a meeting transcript — produce action graph, attendance audit, sync-vs-async verdict, followup drafts
argument-hint: <path to transcript .md>
---

Use the `meeting-killer` skill on the transcript at `$1`.

Read the file, then produce the full analysis: one-line verdict, sync score, action graph (with owners + dependencies + risk-if-missed), attendance audit (essential / borderline / could_have_been_briefed with reasons), structural observations, and per-attendee followup drafts for everyone who has an action item or unresolved question.

Render in plain text suitable for terminal display — section headers in CAPS, attendance verdicts prefixed with `[KEEP]` / `[?]` / `[CUT]`.
