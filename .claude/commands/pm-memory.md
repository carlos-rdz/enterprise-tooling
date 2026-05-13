---
description: Ask the enterprise product-memory corpus a question — get a cited answer about prior decisions, customer feedback, and risks
argument-hint: <natural-language question>
---

Use the `pm-historian` subagent to answer: $ARGUMENTS

The subagent has access to the `pm-memory` MCP server and will pull from PRDs, tickets, and customer call summaries. Return the answer with citations to specific files, plus any blunt warning if the question reveals a likely mistake.

If no question was given, default to: "We're being asked to ship FlexPay Standard expansion in Q3. What do I need to know?"
