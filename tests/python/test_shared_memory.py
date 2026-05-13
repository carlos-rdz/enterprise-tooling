"""Tests for the SQLite-backed shared memory tool."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_shared_memory() -> Any:
    sys.modules.pop("shared_memory", None)
    spec = importlib.util.spec_from_file_location(
        "shared_memory", REPO_ROOT / "04_oncall_companion" / "shared_memory.py"
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def tool(tmp_path: Path) -> Any:
    mod = load_shared_memory()
    return mod.SharedMemoryTool(db_path=tmp_path / "test.sqlite", actor="alice@example.com")


def test_create_and_view_roundtrip(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/memories/incidents/page-1.md", file_text="hello\nworld"))
    assert tool.view(SimpleNamespace(path="/memories/incidents/page-1.md")) == "hello\nworld"


def test_view_nonexistent_returns_friendly_message(tool: Any) -> None:
    out = tool.view(SimpleNamespace(path="/memories/never.md"))
    assert "no entries" in out or "first-occurrence" in out


def test_view_directory_lists_first_level(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/memories/incidents/p1.md", file_text="x"))
    tool.create(SimpleNamespace(path="/memories/incidents/p2.md", file_text="y"))
    tool.create(SimpleNamespace(path="/memories/patterns/biometric.md", file_text="z"))
    out = tool.view(SimpleNamespace(path="/memories"))
    assert "incidents" in out
    assert "patterns" in out


def test_str_replace_edits_in_place(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="hello world"))
    tool.str_replace(SimpleNamespace(path="/m.md", old_str="world", new_str="oncall"))
    assert tool.view(SimpleNamespace(path="/m.md")) == "hello oncall"


def test_str_replace_missing_target(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="hello"))
    out = tool.str_replace(SimpleNamespace(path="/m.md", old_str="absent", new_str="X"))
    assert "not found" in out
    assert tool.view(SimpleNamespace(path="/m.md")) == "hello"


def test_str_replace_on_missing_file(tool: Any) -> None:
    out = tool.str_replace(SimpleNamespace(path="/ghost.md", old_str="a", new_str="b"))
    assert "does not exist" in out


def test_insert_at_line(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="line0\nline2"))
    tool.insert(SimpleNamespace(path="/m.md", insert_line=1, insert_text="line1"))
    assert tool.view(SimpleNamespace(path="/m.md")) == "line0\nline1\nline2"


def test_soft_delete_then_reaccess(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="bye"))
    tool.delete(SimpleNamespace(path="/m.md"))
    out = tool.view(SimpleNamespace(path="/m.md"))
    assert "no entries" in out or "first-occurrence" in out


def test_recreate_after_delete_works(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="v1"))
    tool.delete(SimpleNamespace(path="/m.md"))
    tool.create(SimpleNamespace(path="/m.md", file_text="v2"))
    assert tool.view(SimpleNamespace(path="/m.md")) == "v2"


def test_rename(tool: Any) -> None:
    tool.create(SimpleNamespace(path="/old.md", file_text="content"))
    tool.rename(SimpleNamespace(old_path="/old.md", new_path="/new.md"))
    assert tool.view(SimpleNamespace(path="/new.md")) == "content"
    out = tool.view(SimpleNamespace(path="/old.md"))
    assert "no entries" in out or "first-occurrence" in out


def test_actor_recorded_on_write(tool: Any, tmp_path: Path) -> None:
    tool.create(SimpleNamespace(path="/m.md", file_text="alice was here"))
    import sqlite3
    conn = sqlite3.connect(str(tool.db_path))
    row = conn.execute("SELECT created_by, updated_by FROM memory_entries WHERE path = ?", ("/m.md",)).fetchone()
    assert row == ("alice@example.com", "alice@example.com")


def test_second_actor_updates_updated_by(tmp_path: Path) -> None:
    mod = load_shared_memory()
    a = mod.SharedMemoryTool(db_path=tmp_path / "shared.sqlite", actor="alice@example.com")
    b = mod.SharedMemoryTool(db_path=tmp_path / "shared.sqlite", actor="bob@example.com")
    a.create(SimpleNamespace(path="/m.md", file_text="from alice"))
    b.str_replace(SimpleNamespace(path="/m.md", old_str="alice", new_str="bob"))
    import sqlite3
    conn = sqlite3.connect(str(a.db_path))
    row = conn.execute("SELECT created_by, updated_by FROM memory_entries WHERE path = ?", ("/m.md",)).fetchone()
    assert row == ("alice@example.com", "bob@example.com")


def test_path_normalization(tool: Any) -> None:
    tool.create(SimpleNamespace(path="memories/no-leading-slash.md", file_text="x"))
    assert tool.view(SimpleNamespace(path="/memories/no-leading-slash.md")) == "x"
