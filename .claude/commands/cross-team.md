---
description: Find hidden cross-team dependencies and overlaps for a multi-team initiative
argument-hint: <natural-language description of the initiative>
---

Use the `cross-team-integrator` subagent to analyze: $ARGUMENTS

The subagent has access to the `team-registry` MCP server and will query every team's current sprint and recent decisions to find:
1. Hidden overlaps (two teams building the same thing)
2. Hidden dependencies (one team's plan needs another team's in-flight work)
3. Critical-path risks for the user's initiative

If no initiative was given, default to: "I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across other teams?"
