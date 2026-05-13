"""Tests for the oncall-companion agent's filesystem memory tool."""

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
    spec = importlib.util.spec_from_file_location("agent", REPO_ROOT / "04_oncall_companion" / "agent.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def memory_in_tmp(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Any:
    """A FilesystemMemoryTool whose sandbox lives in a fresh tmp dir."""
    agent = load_agent()
    monkeypatch.setattr(agent, "MEMORY_ROOT", tmp_path / ".memory")
    (tmp_path / ".memory").mkdir(parents=True, exist_ok=True)
    return agent.FilesystemMemoryTool()


def test_create_and_view_roundtrip(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    msg = tool.create(SimpleNamespace(path="/memories/incidents/test.md", file_text="hello\nworld"))
    assert "Wrote" in msg
    viewed = tool.view(SimpleNamespace(path="/memories/incidents/test.md"))
    assert viewed == "hello\nworld"


def test_view_nonexistent_returns_friendly_message(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    viewed = tool.view(SimpleNamespace(path="/memories/incidents/never.md"))
    assert "no entry" in viewed or "memory not initialized" in viewed


def test_view_directory_lists_entries(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/memories/a.md", file_text="a"))
    tool.create(SimpleNamespace(path="/memories/b.md", file_text="b"))
    out = tool.view(SimpleNamespace(path="/memories"))
    assert "a.md" in out and "b.md" in out


def test_str_replace_edits_in_place(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/m.md", file_text="hello world"))
    tool.str_replace(SimpleNamespace(path="/m.md", old_str="world", new_str="oncall"))
    assert tool.view(SimpleNamespace(path="/m.md")) == "hello oncall"


def test_str_replace_missing_target_does_nothing(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/m.md", file_text="hello"))
    msg = tool.str_replace(SimpleNamespace(path="/m.md", old_str="missing", new_str="X"))
    assert "not found" in msg
    assert tool.view(SimpleNamespace(path="/m.md")) == "hello"


def test_insert_at_line(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/m.md", file_text="line0\nline2"))
    tool.insert(SimpleNamespace(path="/m.md", insert_line=1, insert_text="line1"))
    assert tool.view(SimpleNamespace(path="/m.md")) == "line0\nline1\nline2"


def test_delete_file(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/m.md", file_text="bye"))
    tool.delete(SimpleNamespace(path="/m.md"))
    assert "no entry" in tool.view(SimpleNamespace(path="/m.md")) or "not initialized" in tool.view(SimpleNamespace(path="/m.md"))


def test_rename(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    tool.create(SimpleNamespace(path="/old.md", file_text="content"))
    tool.rename(SimpleNamespace(old_path="/old.md", new_path="/new.md"))
    assert tool.view(SimpleNamespace(path="/new.md")) == "content"


def test_path_traversal_blocked(memory_in_tmp: Any) -> None:
    tool = memory_in_tmp
    with pytest.raises(ValueError, match="escapes memory sandbox"):
        tool.create(SimpleNamespace(path="/../../etc/passwd", file_text="evil"))


def test_read_page_from_argv(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.setattr(sys, "argv", ["agent.py", "What's happening?"])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    assert agent.read_page() == "What's happening?"


def test_main_returns_1_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    agent = load_agent()
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["agent.py"])
    rc = agent.main()
    assert rc == 1
