"""
PM Domain Memory Agent

A new PM lands on a product they don't yet know. This agent has read every
PRD, ticket, and customer call summary in the corpus. Ask it anything about
the product's history.

Run examples:
  python 02_pm_memory/agent.py "what have we tried to reduce fraud friction on signup"
  python 02_pm_memory/agent.py "why was the Standard expansion killed last year"
  python 02_pm_memory/agent.py "what's the deal with the mobile eligibility check"
  python 02_pm_memory/agent.py "who owns FlexPay now and what's at risk for Q3"

Default question if none given covers the most damaging org pattern:
  PM asks a question that has been asked and answered, but is now hidden in old docs.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field

MODEL = "claude-opus-4-7"

SYSTEM = """You are the institutional memory for an enterprise product team.

You have read every PRD, exploration doc, postmortem, ticket comment, and
customer call summary the team has on file. You answer questions like a
seasoned PM who has been on the product since launch — with specific citations
to the documents that ground every claim.

You answer in the following structure:
1. The direct answer in 2-4 sentences.
2. Key historical context the asker needs but probably didn't ask for.
3. What has been tried before (with outcomes) if relevant.
4. Who owns this today.
5. Risks or open items the asker should know about.
6. Citations — list the specific document filenames you drew from.

You are blunt. You do not hedge. If something is unresolved tech debt that's
about to become an incident, say so. If the question reveals the asker is
about to repeat a mistake, say so. Your job is to make the PM smarter in 30
seconds than they would be after a week of digging through Confluence.

If the corpus does not contain the answer, say so — do not invent."""


class PMAnswer(BaseModel):
    direct_answer: str
    historical_context: str
    what_was_tried: list[str] = Field(default_factory=list)
    current_owner: str
    risks_and_open_items: list[str]
    citations: list[str]
    blunt_warning: str | None = Field(default=None, description="Set if the question reveals the asker is about to repeat a known mistake or step on a known landmine")


def load_corpus(corpus_dir: Path) -> str:
    parts: list[str] = []
    for path in sorted(corpus_dir.rglob("*.md")):
        rel = path.relative_to(corpus_dir)
        parts.append(f"<doc filename=\"{rel}\">\n{path.read_text()}\n</doc>")
    return "\n\n".join(parts)


def ask(corpus: str, question: str) -> PMAnswer:
    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=[
            {"type": "text", "text": SYSTEM},
            {
                "type": "text",
                "text": f"PRODUCT HISTORY CORPUS:\n\n{corpus}",
                "cache_control": {"type": "ephemeral"},
            },
        ],
        messages=[{"role": "user", "content": question}],
        output_format=PMAnswer,
    )
    return response.parsed_output


def render(question: str, a: PMAnswer) -> str:
    out: list[str] = []
    out.append("=" * 70)
    out.append(f"Q: {question}")
    out.append("=" * 70)
    out.append("")
    out.append(a.direct_answer)
    out.append("")
    if a.blunt_warning:
        out.append("⚠ WARNING")
        out.append(a.blunt_warning)
        out.append("")
    out.append("CONTEXT YOU NEED")
    out.append(a.historical_context)
    out.append("")
    if a.what_was_tried:
        out.append("WHAT'S BEEN TRIED")
        for t in a.what_was_tried:
            out.append(f"  • {t}")
        out.append("")
    out.append(f"OWNER TODAY: {a.current_owner}")
    out.append("")
    out.append("OPEN RISKS")
    for r in a.risks_and_open_items:
        out.append(f"  • {r}")
    out.append("")
    out.append("CITATIONS")
    for c in a.citations:
        out.append(f"  - {c}")
    return "\n".join(out)


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("set ANTHROPIC_API_KEY", file=sys.stderr)
        return 1

    corpus_dir = Path(__file__).parent / "corpus"
    question = (
        " ".join(sys.argv[1:]).strip()
        or "We're being asked to ship FlexPay Standard expansion in Q3. What do I need to know?"
    )

    print(f"loading corpus from {corpus_dir}...", file=sys.stderr)
    corpus = load_corpus(corpus_dir)
    print(f"corpus loaded ({len(corpus)} chars). asking...\n", file=sys.stderr)
    answer = ask(corpus, question)
    print(render(question, answer))
    return 0


if __name__ == "__main__":
    sys.exit(main())
