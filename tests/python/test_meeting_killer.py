"""
Tests for the meeting-killer agent.

The anthropic client is mocked: we don't burn API credits in CI and the tests
focus on the agent's plumbing (rendering, env handling, path resolution)
rather than the model's reasoning, which the eval harness covers separately.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

import importlib.util

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_agent() -> Any:
    """Fresh import each test to avoid module-level side effects bleeding."""
    sys.modules.pop("agent", None)
    spec = importlib.util.spec_from_file_location("agent", REPO_ROOT / "01_meeting_killer" / "agent.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["agent"] = module  # required so Pydantic can resolve forward refs
    spec.loader.exec_module(module)
    module.AttendanceJudgment.model_rebuild()
    module.ActionItem.model_rebuild()
    module.FollowupDraft.model_rebuild()
    module.MeetingAnalysis.model_rebuild()
    return module


def _fake_analysis(agent_mod: Any) -> Any:
    """Build a MeetingAnalysis pydantic object directly."""
    return agent_mod.MeetingAnalysis(
        one_line_verdict="Should have been an async memo.",
        sync_score=3,
        action_graph=[
            agent_mod.ActionItem(
                owner="Test Owner",
                action="Do thing",
                due_by="2026-12-31",
                depends_on=[],
                risk_if_missed="Nothing burns.",
            )
        ],
        attendance_audit=[
            agent_mod.AttendanceJudgment(
                attendee="Alice", verdict="essential", reason="Drove the discussion."
            ),
            agent_mod.AttendanceJudgment(
                attendee="Bob", verdict="could_have_been_briefed", reason="Said nothing of value."
            ),
        ],
        followup_drafts=[],
        structural_observations=["Critical info surfaced too late."],
    )


def test_render_includes_verdict_and_sync_score() -> None:
    agent = load_agent()
    analysis = _fake_analysis(agent)
    out = agent.render(analysis)
    assert "VERDICT: Should have been an async memo." in out
    assert "SYNC SCORE: 3/10" in out
    assert "Test Owner" in out
    assert "[CUT]" in out  # Bob's "could_have_been_briefed" verdict renders with [CUT]


def test_render_attendance_markers() -> None:
    agent = load_agent()
    analysis = _fake_analysis(agent)
    out = agent.render(analysis)
    assert "[KEEP]" in out  # Alice
    assert "[CUT]" in out  # Bob


def test_analyze_meeting_calls_client_with_correct_model(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    fake = _fake_analysis(agent)

    captured: dict[str, Any] = {}

    class FakeMessages:
        def parse(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                parsed_output=fake,
                usage=SimpleNamespace(input_tokens=100, output_tokens=200, cache_read_input_tokens=0),
            )

    class FakeAnthropic:
        def __init__(self, *a: Any, **kw: Any) -> None:
            self.messages = FakeMessages()

    monkeypatch.setattr(agent.anthropic, "Anthropic", FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")

    result = agent.analyze_meeting("transcript body")
    assert result is fake
    assert captured["model"] == agent.MODEL
    assert captured["thinking"] == {"type": "adaptive"}
    assert captured["output_format"] is agent.MeetingAnalysis


def test_main_returns_1_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["agent.py"])
    rc = agent.main()
    assert rc == 1


def test_main_returns_1_for_missing_transcript(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("MEETING_TRANSCRIPT_PATH_OVERRIDE", "/nonexistent/path.md")
    monkeypatch.setattr(sys, "argv", ["agent.py"])
    rc = agent.main()
    assert rc == 1


def test_main_full_path(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    agent = load_agent()
    transcript = tmp_path / "transcript.md"
    transcript.write_text("# fake transcript\nuser: hi\n")

    fake = _fake_analysis(agent)

    class FakeMessages:
        def parse(self, **kwargs: Any) -> Any:
            return SimpleNamespace(
                parsed_output=fake,
                usage=SimpleNamespace(input_tokens=100, output_tokens=200, cache_read_input_tokens=0),
            )

    class FakeAnthropic:
        def __init__(self, *a: Any, **kw: Any) -> None:
            self.messages = FakeMessages()

    monkeypatch.setattr(agent.anthropic, "Anthropic", FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("MEETING_TRANSCRIPT_PATH_OVERRIDE", str(transcript))
    monkeypatch.setattr(sys, "argv", ["agent.py"])

    rc = agent.main()
    captured = capsys.readouterr()

    assert rc == 0
    assert "VERDICT:" in captured.out
    assert "SYNC SCORE: 3/10" in captured.out
