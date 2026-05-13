"""
Eval runner.

Reads golden cases from evals/golden/<skill>.yaml, runs each through the raw
Python agent for that workflow, then asks an LLM judge (Claude Opus 4.7) to
grade the output against the case's `must_have` and `must_not_have` rubric.

Outputs a markdown report to evals/runs/<timestamp>/report.md and updates a
top-level evals/report.md symlink-equivalent (copied content) to the latest.

Usage:
  python evals/run.py                 # run all skills
  python evals/run.py meeting-killer  # run just one
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic
import yaml
from pydantic import BaseModel, Field

JUDGE_MODEL = "claude-opus-4-7"
REPO_ROOT = Path(__file__).resolve().parent.parent
GOLDEN_DIR = REPO_ROOT / "evals" / "golden"
RUNS_DIR = REPO_ROOT / "evals" / "runs"

# Pricing (USD per 1M tokens) — Claude Opus 4.7.
COST_PER_M_INPUT = 5.00
COST_PER_M_OUTPUT = 25.00
COST_PER_M_CACHE_READ = 0.50


@dataclass
class TokenAccount:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0

    def add(self, usage: anthropic.types.Usage) -> None:
        self.input_tokens += usage.input_tokens or 0
        self.output_tokens += usage.output_tokens or 0
        self.cache_read_input_tokens += getattr(usage, "cache_read_input_tokens", 0) or 0

    def cost_usd(self) -> float:
        return (
            self.input_tokens * COST_PER_M_INPUT / 1_000_000
            + self.output_tokens * COST_PER_M_OUTPUT / 1_000_000
            + self.cache_read_input_tokens * COST_PER_M_CACHE_READ / 1_000_000
        )


# ---- Schemas -----------------------------------------------------------------


class CriterionVerdict(BaseModel):
    criterion: str
    passed: bool
    evidence: str = Field(description="Specific quote or paraphrase from the agent output that supports the verdict, or absence-of-evidence note if failed.")


class CaseVerdict(BaseModel):
    case_id: str
    overall_pass: bool = Field(description="True only if every must_have passed AND no must_not_have was violated.")
    must_have: list[CriterionVerdict]
    must_not_have: list[CriterionVerdict]
    judge_notes: str = Field(description="One-paragraph summary of how the agent performed on this case, including any concerns the rubric didn't capture.")


# ---- Agent runners -----------------------------------------------------------


def run_meeting_killer(case: dict[str, Any]) -> str:
    transcript_path = REPO_ROOT / case["input_transcript_path"]
    out = subprocess.run(
        [sys.executable, str(REPO_ROOT / "01_meeting_killer" / "agent.py")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "MEETING_TRANSCRIPT_PATH_OVERRIDE": str(transcript_path)},
        timeout=300,
    )
    if out.returncode != 0:
        raise RuntimeError(f"meeting-killer agent failed:\nSTDOUT:\n{out.stdout}\nSTDERR:\n{out.stderr}")
    return out.stdout


def run_pm_memory(case: dict[str, Any]) -> str:
    out = subprocess.run(
        [sys.executable, str(REPO_ROOT / "02_pm_memory" / "agent.py"), case["question"]],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if out.returncode != 0:
        raise RuntimeError(f"pm-memory agent failed:\nSTDOUT:\n{out.stdout}\nSTDERR:\n{out.stderr}")
    return out.stdout


def run_cross_team(case: dict[str, Any]) -> str:
    out = subprocess.run(
        [sys.executable, str(REPO_ROOT / "03_cross_team" / "agent.py"), case["question"]],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if out.returncode != 0:
        raise RuntimeError(f"cross-team agent failed:\nSTDOUT:\n{out.stdout}\nSTDERR:\n{out.stderr}")
    return out.stdout


def run_oncall_companion(case: dict[str, Any]) -> str:
    """Set up memory per `_setup` directives, then pipe the page to the agent on stdin."""
    setup = case.get("_setup", {})
    memory_root = REPO_ROOT / "04_oncall_companion" / ".memory"
    if setup.get("reset_memory"):
        if memory_root.exists():
            shutil.rmtree(memory_root)
        memory_root.mkdir(parents=True, exist_ok=True)
    seed_files: dict[str, str] = setup.get("seed_files", {})
    for path, content in seed_files.items():
        target = memory_root / path.lstrip("/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    out = subprocess.run(
        [sys.executable, str(REPO_ROOT / "04_oncall_companion" / "agent.py")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        input=case["page"],
        timeout=300,
    )
    if out.returncode != 0:
        raise RuntimeError(f"oncall-companion agent failed:\nSTDOUT:\n{out.stdout}\nSTDERR:\n{out.stderr}")
    return str(out.stdout)


RUNNERS = {
    "meeting-killer": run_meeting_killer,
    "pm-memory": run_pm_memory,
    "cross-team": run_cross_team,
    "oncall-companion": run_oncall_companion,
}


# ---- LLM judge ---------------------------------------------------------------

JUDGE_SYSTEM = """You are an expert evaluator grading the output of an AI agent against a rubric of behavioral criteria.

You receive:
- The agent's full output
- A list of `must_have` criteria — the output MUST satisfy all of these
- A list of `must_not_have` criteria — the output MUST NOT exhibit any of these

For each criterion, you produce:
- passed: boolean
- evidence: a specific quote or paraphrase from the agent output supporting your verdict

`overall_pass` is true only if every must_have passes AND no must_not_have is violated.

Be strict. If the criterion says "names a specific person," generic phrases like "the team lead" do not satisfy it. If the criterion says "blunt warning," a polite paragraph of context does not satisfy it.

Your audience is an engineer who will use these grades to decide whether to ship a prompt or system change. Reliability matters more than charity."""


def judge_case(client: anthropic.Anthropic, case: dict[str, Any], agent_output: str, account: TokenAccount) -> CaseVerdict:
    must_have = case.get("must_have", [])
    must_not_have = case.get("must_not_have", [])
    response = client.messages.parse(
        model=JUDGE_MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=JUDGE_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"""CASE: {case['id']}

MUST_HAVE criteria (output must satisfy ALL):
{json.dumps(must_have, indent=2)}

MUST_NOT_HAVE criteria (output must violate NONE):
{json.dumps(must_not_have, indent=2)}

AGENT OUTPUT:
---
{agent_output}
---

Grade the output. For each criterion, decide passed=true/false with specific evidence from the output. Then compute overall_pass.""",
            }
        ],
        output_format=CaseVerdict,
    )
    account.add(response.usage)
    parsed = response.parsed_output
    if parsed is None:
        raise RuntimeError(f"judge model returned no parsed output for case {case['id']}")
    return parsed


# ---- Reporting ---------------------------------------------------------------


@dataclass
class SkillResult:
    skill: str
    verdicts: list[CaseVerdict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def pass_count(self) -> int:
        return sum(1 for v in self.verdicts if v.overall_pass)

    @property
    def total(self) -> int:
        return len(self.verdicts) + len(self.errors)


def render_report(results: list[SkillResult], run_dir: Path, account: TokenAccount) -> str:
    total_pass = sum(r.pass_count for r in results)
    total_cases = sum(r.total for r in results)

    lines: list[str] = []
    lines.append("# Eval Report")
    lines.append("")
    lines.append(f"**Generated:** {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"**Run dir:** `{run_dir.relative_to(REPO_ROOT)}`")
    lines.append(f"**Judge model:** `{JUDGE_MODEL}`")
    lines.append("")
    lines.append(f"## Summary: {total_pass}/{total_cases} cases passed")
    lines.append("")
    lines.append("| Skill | Pass | Total |")
    lines.append("|---|---|---|")
    for r in results:
        lines.append(f"| `{r.skill}` | {r.pass_count} | {r.total} |")
    lines.append("")
    lines.append(f"## Judge token cost")
    lines.append("")
    lines.append(f"| Field | Value |")
    lines.append(f"|---|---|")
    lines.append(f"| Input tokens | {account.input_tokens:,} |")
    lines.append(f"| Output tokens | {account.output_tokens:,} |")
    lines.append(f"| Cache-read input tokens | {account.cache_read_input_tokens:,} |")
    lines.append(f"| Estimated cost (judge only) | ${account.cost_usd():.4f} |")
    lines.append("")
    lines.append("_Judge cost only. Agent costs are tracked separately by the agent's own logger output._")
    lines.append("")

    for r in results:
        lines.append(f"## `{r.skill}`")
        lines.append("")
        for v in r.verdicts:
            marker = "✅ PASS" if v.overall_pass else "❌ FAIL"
            lines.append(f"### {marker} — `{v.case_id}`")
            lines.append("")
            lines.append(f"_{v.judge_notes}_")
            lines.append("")
            lines.append("**must_have:**")
            for c in v.must_have:
                m = "✅" if c.passed else "❌"
                lines.append(f"- {m} {c.criterion}")
                lines.append(f"  - _Evidence:_ {c.evidence}")
            if v.must_not_have:
                lines.append("")
                lines.append("**must_not_have:**")
                for c in v.must_not_have:
                    m = "✅" if c.passed else "❌"
                    lines.append(f"- {m} {c.criterion}")
                    lines.append(f"  - _Evidence:_ {c.evidence}")
            lines.append("")
        for err in r.errors:
            lines.append(f"### ❌ ERROR")
            lines.append("")
            lines.append("```")
            lines.append(err)
            lines.append("```")
            lines.append("")

    return "\n".join(lines)


# ---- Main --------------------------------------------------------------------


def load_cases(skill: str) -> list[dict[str, Any]]:
    path = GOLDEN_DIR / f"{skill}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"no golden file: {path}")
    data = yaml.safe_load(path.read_text())
    cases = data["cases"]
    if not isinstance(cases, list):
        raise ValueError(f"{path}: 'cases' must be a list")
    return list(cases)


def main() -> int:
    skills = sys.argv[1:] or list(RUNNERS.keys())
    unknown = [s for s in skills if s not in RUNNERS]
    if unknown:
        print(f"unknown skill(s): {unknown}. available: {list(RUNNERS.keys())}", file=sys.stderr)
        return 2

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("set ANTHROPIC_API_KEY", file=sys.stderr)
        return 1

    client = anthropic.Anthropic()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = RUNS_DIR / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    account = TokenAccount()
    results: list[SkillResult] = []
    for skill in skills:
        print(f"\n=== {skill} ===", file=sys.stderr)
        result = SkillResult(skill=skill)
        cases = load_cases(skill)
        for case in cases:
            cid = case["id"]
            print(f"  {cid}: running agent...", file=sys.stderr)
            try:
                agent_output = RUNNERS[skill](case)
                (run_dir / f"{skill}__{cid}.txt").write_text(agent_output)
            except Exception as e:
                err = f"agent error for {skill}/{cid}: {e}"
                print(f"  {cid}: ERROR — {e}", file=sys.stderr)
                result.errors.append(err)
                continue
            print(f"  {cid}: judging...", file=sys.stderr)
            verdict = judge_case(client, case, agent_output, account)
            result.verdicts.append(verdict)
            marker = "PASS" if verdict.overall_pass else "FAIL"
            print(f"  {cid}: {marker}", file=sys.stderr)
        results.append(result)

    report = render_report(results, run_dir, account)
    (run_dir / "report.md").write_text(report)
    (REPO_ROOT / "evals" / "report.md").write_text(report)
    print(f"\nreport written to {run_dir / 'report.md'}", file=sys.stderr)

    total_pass = sum(r.pass_count for r in results)
    total_cases = sum(r.total for r in results)
    print(
        f"summary: {total_pass}/{total_cases} passed | judge cost ${account.cost_usd():.4f}",
        file=sys.stderr,
    )
    return 0 if total_pass == total_cases else 1


if __name__ == "__main__":
    sys.exit(main())
