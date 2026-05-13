"""Tests for the outcomes log + cost dashboard outcomes section."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_module(rel_path: str, name: str) -> Any:
    sys.modules.pop(name, None)
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / rel_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_log_outcome_pr_merged(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = load_module("scripts/log-outcome.py", "log_outcome")
    monkeypatch.setattr(mod, "OUTCOMES_DIR", tmp_path)
    rc = mod.main(["pr-merged", "--pr", "999", "--ai-touched-lines", "11", "--user", "test@example.com"])
    assert rc == 0
    files = list(tmp_path.glob("outcomes-*.jsonl"))
    assert len(files) == 1
    line = files[0].read_text().splitlines()[0]
    event = json.loads(line)
    assert event["kind"] == "pr_merged"
    assert event["pr"] == 999
    assert event["ai_touched_lines"] == 11
    assert event["user"] == "test@example.com"


def test_log_outcome_incident_closed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = load_module("scripts/log-outcome.py", "log_outcome")
    monkeypatch.setattr(mod, "OUTCOMES_DIR", tmp_path)
    rc = mod.main(["incident-closed", "--incident", "INC-1", "--duration-minutes", "42", "--user", "h@x.com", "--ai-assisted"])
    assert rc == 0
    event = json.loads(list(tmp_path.glob("outcomes-*.jsonl"))[0].read_text().splitlines()[0])
    assert event["kind"] == "incident_closed"
    assert event["incident"] == "INC-1"
    assert event["ai_assisted"] is True


def test_log_outcome_action_done(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mod = load_module("scripts/log-outcome.py", "log_outcome")
    monkeypatch.setattr(mod, "OUTCOMES_DIR", tmp_path)
    rc = mod.main(["action-done", "--action-id", "PLAN-1893", "--user", "m@x.com"])
    assert rc == 0
    event = json.loads(list(tmp_path.glob("outcomes-*.jsonl"))[0].read_text().splitlines()[0])
    assert event["kind"] == "action_done"
    assert event["action_id"] == "PLAN-1893"


def test_summarize_outcomes_aggregates(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log_mod = load_module("scripts/log-outcome.py", "log_outcome")
    monkeypatch.setattr(log_mod, "OUTCOMES_DIR", tmp_path)
    log_mod.main(["pr-merged", "--pr", "100", "--ai-touched-lines", "10", "--user", "a@x.com"])
    log_mod.main(["pr-merged", "--pr", "101", "--ai-touched-lines", "20", "--user", "b@x.com"])
    log_mod.main(["incident-closed", "--incident", "INC-1", "--duration-minutes", "30", "--user", "h@x.com", "--ai-assisted"])
    log_mod.main(["incident-closed", "--incident", "INC-2", "--duration-minutes", "120", "--user", "h@x.com"])

    dash_mod = load_module("scripts/cost-dashboard.py", "cost_dashboard")
    outcomes = dash_mod.load_outcomes(tmp_path)
    agg = dash_mod.summarize_outcomes(outcomes)
    assert agg["total"] == 4
    assert agg["by_kind"]["pr_merged"] == 2
    assert agg["by_kind"]["incident_closed"] == 2
    assert agg["pr_lines_total"] == 30
    assert agg["incident_minutes_total"] == 150
    assert agg["ai_assisted_incidents"] == 1


def test_cost_dashboard_renders_with_outcomes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """The dashboard should render an Outcomes section when outcomes events exist."""
    log_mod = load_module("scripts/log-outcome.py", "log_outcome")
    dash_mod = load_module("scripts/cost-dashboard.py", "cost_dashboard")

    monkeypatch.setattr(log_mod, "OUTCOMES_DIR", tmp_path)
    log_mod.main(["meeting-ended", "--meeting", "test meeting", "--action-count", "3", "--sync-score", "4"])

    outcomes = dash_mod.load_outcomes(tmp_path)
    agg = dash_mod.summarize_outcomes(outcomes)
    html = dash_mod.render_html(
        {"by_user": {}, "by_team": {}, "by_server": {}, "by_tool": {}, "latency": {}, "denial_reasons": {}, "total_events": 0},
        None,
        agg,
    )
    assert "Outcomes" in html
    assert "meeting_ended" in html
