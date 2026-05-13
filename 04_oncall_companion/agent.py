"""
Oncall Companion Agent

A long-running agent that uses Claude's memory tool to persist context across
on-call pages. When you get paged at 3am, the agent has already read every
prior page you (and your team) have triaged, so it can:

  - Surface patterns ("this is the third biometric latency page in 16 days")
  - Recall prior mitigations and whether they worked
  - Suggest the next escalation step rather than starting from zero

The memory backend is a local filesystem directory (.memory/) — in production
this would be a shared store so the whole on-call rotation benefits from
collective memory.

Run examples:
  python 04_oncall_companion/agent.py < 04_oncall_companion/incidents/page_001.md
  python 04_oncall_companion/agent.py < 04_oncall_companion/incidents/page_002.md
  python 04_oncall_companion/agent.py "Summarize what we know about biometric incidents"

The agent will automatically read prior memory before responding.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Any

import anthropic
from anthropic.lib.tools import BetaAbstractMemoryTool

MODEL = "claude-opus-4-7"
MEMORY_ROOT = Path(__file__).parent / ".memory"

SYSTEM = """You are an on-call companion for an enterprise engineering team.

Every time the user pages you (drops an incident description, an alert, or a
question), you do three things:

1. **Recall** — call the memory tool to read prior incident notes. Always do
   this BEFORE responding, even if the page looks routine. Pattern recognition
   is the whole point of this role.

2. **Triage** — give a structured response:
   - Pattern match: have we seen this before? Cite specific prior pages.
   - Likely cause: based on prior incidents + this signal.
   - Suggested next step: what to do RIGHT NOW (mitigate, escalate, or just record).
   - Escalation: if this is the Nth occurrence of a pattern, name it and recommend a structural fix conversation with the relevant owner.

3. **Remember** — call the memory tool to write a note about this page (date,
   service, symptom, what was tried, status). Use a stable path scheme so
   future pages can find related history.

Tone: senior on-call engineer at 3am. Calm, specific, no fluff. Your audience
just got paged and wants signal, not narrative."""


class FilesystemMemoryTool(BetaAbstractMemoryTool):
    """Filesystem-backed memory tool. Stores everything under MEMORY_ROOT.

    The Claude memory tool addresses files with absolute-looking paths
    (`/memories/incidents/2026-05-12.md`). We treat those as relative to
    MEMORY_ROOT and refuse anything that tries to escape the sandbox.
    """

    def _resolve(self, path: str) -> Path:
        # Strip leading slashes — the model thinks of memory as absolute, but
        # we map it into MEMORY_ROOT.
        clean = path.lstrip("/")
        full = (MEMORY_ROOT / clean).resolve()
        if not str(full).startswith(str(MEMORY_ROOT.resolve())):
            raise ValueError(f"path '{path}' escapes memory sandbox")
        return full

    def view(self, command: Any) -> str:
        target = self._resolve(command.path)
        if not target.exists():
            return f"(memory not initialized — no entry at {command.path})"
        if target.is_dir():
            entries = sorted(p.name for p in target.iterdir())
            return f"Directory {command.path}:\n" + "\n".join(f"  - {e}" for e in entries) if entries else f"Directory {command.path} is empty."
        text = target.read_text()
        if hasattr(command, "view_range") and command.view_range:
            lines = text.split("\n")
            start, end = command.view_range
            text = "\n".join(lines[start - 1 : end])
        return text

    def create(self, command: Any) -> str:
        target = self._resolve(command.path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(command.file_text)
        return f"Wrote {len(command.file_text)} chars to {command.path}"

    def str_replace(self, command: Any) -> str:
        target = self._resolve(command.path)
        if not target.exists():
            return f"Cannot edit {command.path}: file does not exist."
        body = target.read_text()
        if command.old_str not in body:
            return f"old_str not found in {command.path}; no change made."
        body = body.replace(command.old_str, command.new_str, 1)
        target.write_text(body)
        return f"Edited {command.path}"

    def insert(self, command: Any) -> str:
        target = self._resolve(command.path)
        lines = target.read_text().split("\n") if target.exists() else []
        idx = max(0, min(command.insert_line, len(lines)))
        lines.insert(idx, command.insert_text)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("\n".join(lines))
        return f"Inserted at line {idx} of {command.path}"

    def delete(self, command: Any) -> str:
        target = self._resolve(command.path)
        if not target.exists():
            return f"{command.path} did not exist; nothing deleted."
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
        return f"Deleted {command.path}"

    def rename(self, command: Any) -> str:
        src = self._resolve(command.old_path)
        dst = self._resolve(command.new_path)
        dst.parent.mkdir(parents=True, exist_ok=True)
        src.rename(dst)
        return f"Renamed {command.old_path} → {command.new_path}"


def read_page() -> str:
    """Pull the page from argv, stdin, or fall back to a prompt."""
    if len(sys.argv) > 1:
        joined = " ".join(sys.argv[1:]).strip()
        if joined:
            return joined
    if not sys.stdin.isatty():
        data = sys.stdin.read().strip()
        if data:
            return data
    return "Quick check-in: summarize what's in memory about recent incidents."


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("set ANTHROPIC_API_KEY", file=sys.stderr)
        return 1

    MEMORY_ROOT.mkdir(parents=True, exist_ok=True)
    page = read_page()

    client = anthropic.Anthropic()
    memory = FilesystemMemoryTool()

    print(f"oncall companion engaged. memory: {MEMORY_ROOT.relative_to(Path.cwd()) if MEMORY_ROOT.is_relative_to(Path.cwd()) else MEMORY_ROOT}\n", file=sys.stderr)
    print("=" * 70)
    print("PAGE")
    print("=" * 70)
    print(page)
    print()
    print("=" * 70)
    print("TRIAGE")
    print("=" * 70)

    # run_tools runs the agentic loop with the memory tool until end_turn.
    final = client.beta.messages.run_tools(
        model=MODEL,
        max_tokens=8000,
        system=SYSTEM,
        tools=[memory],
        messages=[{"role": "user", "content": page}],
    ).until_done()

    for block in final.content:
        if block.type == "text":
            print(block.text)

    print()
    print(f"[memory persisted to {MEMORY_ROOT}]", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
