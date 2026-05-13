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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _shared.logging_setup import get_logger  # noqa: E402

log = get_logger("oncall-companion")

MODEL = "claude-opus-4-7"
MEMORY_ROOT = Path(__file__).parent / ".memory"

SYSTEM = """You are an on-call companion for an enterprise engineering team. The user has been paged. You make them look like a senior on-call engineer regardless of the actual hour.

EVERY page gets three actions, in this order:

================ STEP 1 — RECALL (REQUIRED) =================
Use the memory tool to read prior incident notes BEFORE producing the triage.
ALWAYS perform at least these reads:
  - view /memories/incidents/   (list prior pages)
  - view /memories/patterns/    (list ongoing trend files)
If those return "no entry" or list new directories, that confirms first-occurrence — say so explicitly.
If matches exist, read the specific files that look related and quote them in PATTERN MATCH.
Pattern recognition across pages is the entire value of this role. Skipping the recall step is a failure.

================ STEP 2 — TRIAGE (REQUIRED STRUCTURE) =================
Output the following structure verbatim. Do not omit any field. Do not shorten to one line.

PATTERN MATCH:  <Either "first occurrence — memory empty for this signal" OR cite the specific prior memory path(s) and dates. Be explicit.>
SERVICE / IMPACT: <Restate the affected service and downstream user impact in YOUR words — not a copy of the page>
LIKELY CAUSE:   <Best hypothesis based on the recall + page signal>
NEXT STEP:      <Concrete action RIGHT NOW — mitigate / escalate / record. Not "investigate further".>
ESCALATION:     <If this is the Nth occurrence of a known pattern (N ≥ 2), name the pattern and the structural fix conversation to start, with the owner. Else "— first occurrence, no escalation yet".>
NOTES WRITTEN:  <The memory paths you wrote to in step 3>

================ STEP 3 — REMEMBER (REQUIRED) =================
Use the memory tool to write a note for this page. Use these paths:
  - /memories/incidents/<date>__<service>__<symptom>.md   (one per page)
  - /memories/patterns/<pattern_name>.md                  (running file when you detect/update a pattern; for the 2nd+ occurrence, append a dated line)
  - /memories/owners.md                                   (build up over time — who to escalate to for what)
The NOTES WRITTEN field in step 2 must list the exact paths you wrote. If you didn't write anything, that field reads "(none — skipped persistence)" and that counts as a failure of this role.

TONE: senior on-call engineer at 3am. Specific. No filler. But the structure above is NOT filler — it is the contract. Every field every time."""


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
        log.error("ANTHROPIC_API_KEY not set")
        return 1

    MEMORY_ROOT.mkdir(parents=True, exist_ok=True)
    page = read_page()

    client = anthropic.Anthropic()
    # ONCALL_SHARED_MEMORY=true → SQLite-backed shared store (whole rotation
    # reads/writes one DB). Default is filesystem-local for fast solo runs.
    if os.environ.get("ONCALL_SHARED_MEMORY") == "true":
        from shared_memory import SharedMemoryTool
        memory: Any = SharedMemoryTool()
        memory_backend = f"sqlite:{memory.db_path}"
    else:
        memory = FilesystemMemoryTool()
        memory_backend = f"filesystem:{MEMORY_ROOT}"

    log.info("oncall companion engaged", extra={"memory_backend": memory_backend, "page_chars": len(page)})
    print("=" * 70)
    print("PAGE")
    print("=" * 70)
    print(page)
    print()
    print("=" * 70)
    print("TRIAGE")
    print("=" * 70)

    # tool_runner returns a BetaToolRunner that drives the agentic loop with
    # the memory tool until end_turn. Beta API surface; types via Any.
    beta_messages: Any = client.beta.messages
    final = beta_messages.tool_runner(
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
    log.info("memory persisted", extra={"memory_root": str(MEMORY_ROOT)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
