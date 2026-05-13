"""Tests for the pm-memory agent."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_agent() -> Any:
    sys.modules.pop("agent", None)
    spec = importlib.util.spec_from_file_location("agent", REPO_ROOT / "02_pm_memory" / "agent.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["agent"] = module
    spec.loader.exec_module(module)
    module.PMAnswer.model_rebuild()
    return module


def _fake_answer(agent_mod: Any) -> Any:
    return agent_mod.PMAnswer(
        direct_answer="Q3 expansion is not real without the three preconditions.",
        historical_context="Killed in 2025-Q3.",
        what_was_tried=["Lowered fraud threshold", "SMS OTP"],
        current_owner="Priya Shankar",
        risks_and_open_items=["UDAAP not started", "Risk model wide CIs"],
        citations=["prds/2025_plan_it_gold_explore.md"],
        blunt_warning="You're about to repeat last year's mistake.",
    )


def test_load_corpus_includes_real_files() -> None:
    agent = load_agent()
    corpus_dir = REPO_ROOT / "02_pm_memory" / "corpus"
    body = agent.load_corpus(corpus_dir)
    assert "<doc filename=" in body
    assert "prds/" in body


def test_render_includes_warning_when_present() -> None:
    agent = load_agent()
    a = _fake_answer(agent)
    out = agent.render("Q3 expansion?", a)
    assert "WARNING" in out
    assert "Priya Shankar" in out
    assert "prds/2025_plan_it_gold_explore.md" in out


def test_render_omits_warning_section_when_absent() -> None:
    agent = load_agent()
    a = _fake_answer(agent)
    a.blunt_warning = None
    out = agent.render("Q?", a)
    assert "WARNING" not in out


def test_ask_invokes_client_with_caching_and_adaptive_thinking(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    fake = _fake_answer(agent)

    captured: dict[str, Any] = {}

    class FakeMessages:
        def parse(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(parsed_output=fake)

    class FakeAnthropic:
        def __init__(self, *a: Any, **kw: Any) -> None:
            self.messages = FakeMessages()

    monkeypatch.setattr(agent.anthropic, "Anthropic", FakeAnthropic)

    result = agent.ask("CORPUS BODY HERE", "Why was X killed?")
    assert result is fake
    assert captured["model"] == agent.MODEL
    assert captured["thinking"] == {"type": "adaptive"}
    # cache_control must be on the corpus block (the stable prefix)
    system = captured["system"]
    assert isinstance(system, list)
    corpus_block = next(b for b in system if "CORPUS" in b["text"])
    assert corpus_block.get("cache_control", {}).get("type") == "ephemeral"


def test_main_returns_1_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["agent.py"])
    rc = agent.main()
    assert rc == 1
