"""Tests for the cross-team integrator agent."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_agent() -> Any:
    sys.modules.pop("agent", None)
    spec = importlib.util.spec_from_file_location("agent", REPO_ROOT / "03_cross_team" / "agent.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_load_teams_parses_real_corpus() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    assert "plan-it" in teams
    assert "auth-platform" in teams
    assert teams["plan-it"]["name"] == "plan-it"


def test_run_tool_list_teams() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("list_teams", {}, teams)
    payload = json.loads(result)
    assert isinstance(payload, list)
    assert any(t["name"] == "plan-it" for t in payload)


def test_run_tool_get_team_activity_unknown() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("get_team_activity", {"team_name": "nonexistent"}, teams)
    payload = json.loads(result)
    assert "error" in payload
    assert "available" in payload


def test_run_tool_search_across_teams_finds_biometric() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("search_across_teams", {"query": "biometric"}, teams)
    payload = json.loads(result)
    teams_hit = {h["team"] for h in payload["hits"]}
    # The synthetic data has biometric work in at least these 3 teams
    assert {"plan-it", "mobile-platform", "auth-platform"}.issubset(teams_hit)


def test_run_tool_search_jira_finds_biometric_keys() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("search_jira", {"query": "biometric"}, teams)
    payload = json.loads(result)
    keys = {i["key"] for i in payload["issues"]}
    assert {"PLAN-1925", "MOBILE-3501", "AUTH-455"}.issubset(keys)


def test_run_tool_search_slack_finds_biometric_messages() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("search_slack", {"query": "biometric"}, teams)
    payload = json.loads(result)
    assert payload["hit_count"] >= 2


def test_run_tool_unknown_returns_error() -> None:
    agent = load_agent()
    teams = agent.load_teams(REPO_ROOT / "03_cross_team" / "team_data" / "teams.md")
    result = agent.run_tool("nonexistent_tool", {}, teams)
    payload = json.loads(result)
    assert "error" in payload


def test_main_returns_1_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["agent.py"])
    rc = agent.main()
    assert rc == 1
