#!/usr/bin/env python3
"""
Generate docs/skills-catalog.md from the skill frontmatter under
.claude/skills/<skill-name>/SKILL.md.

Each entry shows: name, trigger description, slash-command-if-any,
subagent-if-any, MCP servers it depends on, and a link to the source SKILL.md.

Run:
  python scripts/generate-skills-catalog.py

CI verifies the generated file is up to date with the sources.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".claude" / "skills"
AGENTS_DIR = REPO_ROOT / ".claude" / "agents"
COMMANDS_DIR = REPO_ROOT / ".claude" / "commands"
OUTPUT = REPO_ROOT / "docs" / "skills-catalog.md"

FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---\n", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fm: dict[str, str] = {}
    current_key: str | None = None
    buf: list[str] = []
    for line in m.group(1).splitlines():
        if line and not line.startswith(" ") and ":" in line:
            if current_key is not None:
                fm[current_key] = "\n".join(buf).strip()
            key, _, rest = line.partition(":")
            current_key = key.strip()
            buf = [rest.strip()]
        else:
            buf.append(line)
    if current_key is not None:
        fm[current_key] = "\n".join(buf).strip()
    return fm, text[m.end() :]


def find_mcp_refs(body: str, allowed_tools: str | None) -> list[str]:
    refs: set[str] = set()
    for blob in (body, allowed_tools or ""):
        for m in re.finditer(r"mcp__([a-z0-9_-]+)__", blob):
            refs.add(m.group(1))
    return sorted(refs)


SUBAGENT_REF_RE = re.compile(r"`([a-z][a-z0-9-]+)`\s+subagent")


def find_slash_for_skill(skill_name: str) -> tuple[str, Path] | tuple[None, None]:
    """Return (slash_command_name, path_to_command_md) or (None, None)."""
    candidate = COMMANDS_DIR / f"{skill_name}.md"
    if candidate.exists():
        return f"/{skill_name}", candidate
    # Truncated form (e.g. oncall-companion -> /oncall)
    for path in COMMANDS_DIR.glob("*.md"):
        body = path.read_text()
        if skill_name in body or path.stem in skill_name:
            return f"/{path.stem}", path
    return None, None


def find_subagent_for_skill(skill_name: str, slash_command_path: Path | None) -> str | None:
    """Look for a subagent in three places, in order of accuracy:
       1. An agent file named exactly the same as the skill.
       2. A backtick-quoted `agent-name` subagent reference in the slash command body.
       3. An agent whose name includes the skill name (e.g. 'cross-team-integrator' for 'cross-team').
    """
    direct = AGENTS_DIR / f"{skill_name}.md"
    if direct.exists():
        return skill_name
    if slash_command_path and slash_command_path.exists():
        m = SUBAGENT_REF_RE.search(slash_command_path.read_text())
        if m:
            candidate = AGENTS_DIR / f"{m.group(1)}.md"
            if candidate.exists():
                return m.group(1)
    for path in AGENTS_DIR.glob("*.md"):
        if skill_name in path.stem:
            return path.stem
    return None


def generate() -> str:
    if not SKILLS_DIR.exists():
        return "# Skills catalog\n\n_no skills directory yet_\n"

    lines: list[str] = []
    lines.append("# Skills catalog")
    lines.append("")
    lines.append(
        "_Auto-generated from `.claude/skills/<name>/SKILL.md` frontmatter. "
        "Do not edit by hand — re-run `python scripts/generate-skills-catalog.py`._"
    )
    lines.append("")
    lines.append("Every skill in this repo, indexed by trigger description. The trigger description is what Claude sees when deciding whether to auto-invoke the skill — sharper descriptions make for better routing.")
    lines.append("")

    skills = sorted(SKILLS_DIR.iterdir())
    lines.append(f"## {len([s for s in skills if s.is_dir()])} skills available")
    lines.append("")
    lines.append("| Name | Slash command | Subagent | MCP servers used | Triggers on |")
    lines.append("|---|---|---|---|---|")

    for skill_dir in skills:
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        fm, body = parse_frontmatter(skill_md.read_text())
        name = fm.get("name", skill_dir.name)
        description = fm.get("description", "")
        slash, slash_path = find_slash_for_skill(name)
        agent_name = find_subagent_for_skill(name, slash_path)
        allowed_tools = None
        if agent_name:
            agent_path = AGENTS_DIR / f"{agent_name}.md"
            agent_fm, _ = parse_frontmatter(agent_path.read_text())
            allowed_tools = agent_fm.get("tools")
        mcp_refs = find_mcp_refs(body, allowed_tools)
        mcp_str = ", ".join(f"`{m}`" for m in mcp_refs) if mcp_refs else "—"
        trigger = (description[:240] + "…") if len(description) > 240 else description
        lines.append(
            f"| **[{name}]({skill_dir.relative_to(REPO_ROOT)}/SKILL.md)** "
            f"| {slash and f'`{slash}`' or '—'} "
            f"| {agent_name and f'`{agent_name}`' or '—'} "
            f"| {mcp_str} "
            f"| {trigger.replace('|', '\\|')} |"
        )

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Per-skill details")
    lines.append("")

    for skill_dir in skills:
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        fm, body = parse_frontmatter(skill_md.read_text())
        name = fm.get("name", skill_dir.name)
        description = fm.get("description", "")
        lines.append(f"### `{name}`")
        lines.append("")
        lines.append(f"**Trigger description:** {description}")
        lines.append("")
        slash, slash_path = find_slash_for_skill(name)
        agent_name = find_subagent_for_skill(name, slash_path)
        if slash:
            lines.append(f"- Slash command: `{slash}`")
        if agent_name:
            lines.append(f"- Subagent: [`{agent_name}`](.claude/agents/{agent_name}.md)")
        allowed_tools = None
        if agent_name:
            agent_path = AGENTS_DIR / f"{agent_name}.md"
            agent_fm, _ = parse_frontmatter(agent_path.read_text())
            allowed_tools = agent_fm.get("tools")
        mcp_refs = find_mcp_refs(body, allowed_tools)
        if mcp_refs:
            lines.append(f"- MCP servers: {', '.join(f'`{m}`' for m in mcp_refs)}")
        lines.append(f"- Source: [{skill_md.relative_to(REPO_ROOT)}]({skill_md.relative_to(REPO_ROOT)})")
        lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    output = generate()
    if "--check" in sys.argv:
        existing = OUTPUT.read_text() if OUTPUT.exists() else ""
        if existing != output:
            print("FAIL: docs/skills-catalog.md is out of date; re-run scripts/generate-skills-catalog.py", file=sys.stderr)
            return 1
        print("OK: skills catalog up to date", file=sys.stderr)
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(output)
    print(f"wrote {OUTPUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
