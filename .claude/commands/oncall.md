---
description: Triage an on-call page with memory of prior incidents — pattern match, suggest next step, write back to memory
argument-hint: <page contents, file path, or question>
---

Use the `oncall-companion` subagent to triage: $ARGUMENTS

The subagent will:
1. Recall from memory (prior incidents, patterns, owner map)
2. Triage with PATTERN MATCH / LIKELY CAUSE / NEXT STEP / ESCALATION / NOTES WRITTEN
3. Write a new memory note so the next on-call benefits

If the input looks like a file path, read the file first and pass the contents.
If no arguments given, default to: "Summarize what's in memory about recent incidents."
