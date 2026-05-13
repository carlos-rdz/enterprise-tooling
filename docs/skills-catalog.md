# Skills catalog

_Auto-generated from `.claude/skills/<name>/SKILL.md` frontmatter. Do not edit by hand — re-run `python scripts/generate-skills-catalog.py`._

Every skill in this repo, indexed by trigger description. The trigger description is what Claude sees when deciding whether to auto-invoke the skill — sharper descriptions make for better routing.

## 4 skills available

| Name | Slash command | Subagent | MCP servers used | Triggers on |
|---|---|---|---|---|
| **[cross-team](.claude/skills/cross-team/SKILL.md)** | `/cross-team` | `cross-team-integrator` | `jira`, `slack`, `team-registry` | Discover hidden cross-team dependencies, overlaps, and blockers by querying the team-registry MCP server. Use when the user asks "who else is working on X", "what should I be worried about across teams", "what's the critical path for shippi… |
| **[meeting-killer](.claude/skills/meeting-killer/SKILL.md)** | `/meeting-killer` | — | `jira`, `slack` | Analyze a meeting transcript and produce a structured action graph, per-attendee followup drafts, an attendance audit (who didn't need to be there), and a blunt sync-vs-async verdict. Use whenever the user provides a meeting transcript file… |
| **[oncall-companion](.claude/skills/oncall-companion/SKILL.md)** | `/oncall` | `oncall-companion` | `jira`, `slack` | An on-call companion that uses Claude's memory tool to persist context across pages. Use when the user has been paged (drops an alert, incident description, or pastes a PagerDuty payload), when the user asks "have we seen this before", or a… |
| **[pm-memory](.claude/skills/pm-memory/SKILL.md)** | `/pm-memory` | `pm-historian` | `jira`, `pm-memory`, `slack` | Answer questions about an enterprise product's history — PRDs, tickets, prior decisions, customer feedback — by querying the pm-memory MCP server. Use when the user asks "why was X killed", "what have we tried before for Y", "who owns Z", "… |

---

## Per-skill details

### `cross-team`

**Trigger description:** Discover hidden cross-team dependencies, overlaps, and blockers by querying the team-registry MCP server. Use when the user asks "who else is working on X", "what should I be worried about across teams", "what's the critical path for shipping Y", or describes a multi-team initiative and wants to find the things nobody has flagged.

- Slash command: `/cross-team`
- Subagent: [`cross-team-integrator`](.claude/agents/cross-team-integrator.md)
- MCP servers: `jira`, `slack`, `team-registry`
- Source: [.claude/skills/cross-team/SKILL.md](.claude/skills/cross-team/SKILL.md)

### `meeting-killer`

**Trigger description:** Analyze a meeting transcript and produce a structured action graph, per-attendee followup drafts, an attendance audit (who didn't need to be there), and a blunt sync-vs-async verdict. Use whenever the user provides a meeting transcript file path, pastes a transcript inline, or asks "what came out of this meeting", "who needs to follow up", or "did this meeting need to happen synchronously".

- Slash command: `/meeting-killer`
- MCP servers: `jira`, `slack`
- Source: [.claude/skills/meeting-killer/SKILL.md](.claude/skills/meeting-killer/SKILL.md)

### `oncall-companion`

**Trigger description:** An on-call companion that uses Claude's memory tool to persist context across pages. Use when the user has been paged (drops an alert, incident description, or pastes a PagerDuty payload), when the user asks "have we seen this before", or any time the user is investigating a production incident and needs pattern-recognition across prior incidents. Critical at 3am when the on-call has no time to dig through history manually.

- Slash command: `/oncall`
- Subagent: [`oncall-companion`](.claude/agents/oncall-companion.md)
- MCP servers: `jira`, `slack`
- Source: [.claude/skills/oncall-companion/SKILL.md](.claude/skills/oncall-companion/SKILL.md)

### `pm-memory`

**Trigger description:** Answer questions about an enterprise product's history — PRDs, tickets, prior decisions, customer feedback — by querying the pm-memory MCP server. Use when the user asks "why was X killed", "what have we tried before for Y", "who owns Z", "what risks exist on product W", or any question that depends on institutional product memory the asker doesn't have.

- Slash command: `/pm-memory`
- Subagent: [`pm-historian`](.claude/agents/pm-historian.md)
- MCP servers: `jira`, `pm-memory`, `slack`
- Source: [.claude/skills/pm-memory/SKILL.md](.claude/skills/pm-memory/SKILL.md)

