"""
SQLite-backed shared memory for the on-call companion.

Replaces the filesystem-local FilesystemMemoryTool with a shared store every
on-call across the rotation reads from and writes to. Means the 2am page
benefits from a pattern someone else recorded at 4am last Tuesday.

Schema is intentionally tiny — one table, path-keyed, with content + tombstone
+ updated_at + actor. The memory tool's view/create/str_replace/insert/delete/
rename commands all map straight onto SQL.

Concurrency: SQLite's default WAL mode + per-write transaction is sufficient
for the read-heavy / occasional-write shape this tool needs. For >50
writers/sec, swap for Postgres + the same schema.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic.lib.tools import BetaAbstractMemoryTool

DEFAULT_DB_PATH = Path(__file__).parent / ".memory.sqlite"


class SharedMemoryTool(BetaAbstractMemoryTool):
    """A filesystem-shaped memory tool backed by a single SQLite database.

    Every operation records the calling `actor` (default: env USER or
    'unknown') so audit queries can tell which on-call wrote what. Soft-
    deletes by default — `delete` flips a tombstone bit; rows persist for
    forensic recovery. Pass `hard_delete=True` to actually drop.
    """

    _SCHEMA = """
    CREATE TABLE IF NOT EXISTS memory_entries (
        path TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memory_entries_prefix ON memory_entries(path);
    """

    def __init__(self, db_path: Path = DEFAULT_DB_PATH, actor: str | None = None, hard_delete: bool = False):
        super().__init__()
        self.db_path = db_path
        self.actor = actor or os.environ.get("USER") or "unknown"
        self.hard_delete = hard_delete
        self._lock = threading.Lock()
        self._connect_and_migrate()

    def _connect_and_migrate(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(self._SCHEMA)
            conn.execute("PRAGMA journal_mode=WAL")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _norm(path: str) -> str:
        # Treat /memories/x.md and memories/x.md as the same logical path.
        return "/" + path.lstrip("/")

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ---- BetaAbstractMemoryTool interface --------------------------------

    def view(self, command: Any) -> str:
        path = self._norm(command.path)
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT content FROM memory_entries WHERE path = ? AND deleted = 0",
                (path,),
            ).fetchone()
            if row is not None:
                content = row["content"]
                if hasattr(command, "view_range") and command.view_range:
                    lines = content.split("\n")
                    start, end = command.view_range
                    content = "\n".join(lines[start - 1 : end])
                return content
            # Treat the request as a directory listing — find entries with
            # `path` as a prefix.
            prefix = path.rstrip("/") + "/"
            rows = conn.execute(
                "SELECT path FROM memory_entries WHERE path LIKE ? AND deleted = 0 ORDER BY path",
                (prefix + "%",),
            ).fetchall()
            if not rows:
                return f"(no entries at {command.path} — first-occurrence territory for this prefix)"
            children = sorted({r["path"][len(prefix):].split("/")[0] for r in rows})
            return f"Directory {command.path}:\n" + "\n".join(f"  - {c}" for c in children)

    def create(self, command: Any) -> str:
        path = self._norm(command.path)
        now = self._now()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO memory_entries (path, content, deleted, created_at, updated_at, created_by, updated_by)
                VALUES (?, ?, 0, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    content = excluded.content,
                    deleted = 0,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
                """,
                (path, command.file_text, now, now, self.actor, self.actor),
            )
            conn.commit()
        return f"Wrote {len(command.file_text)} chars to {command.path}"

    def str_replace(self, command: Any) -> str:
        path = self._norm(command.path)
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT content FROM memory_entries WHERE path = ? AND deleted = 0",
                (path,),
            ).fetchone()
            if row is None:
                return f"Cannot edit {command.path}: file does not exist."
            body = row["content"]
            if command.old_str not in body:
                return f"old_str not found in {command.path}; no change made."
            new_body = body.replace(command.old_str, command.new_str, 1)
            conn.execute(
                "UPDATE memory_entries SET content = ?, updated_at = ?, updated_by = ? WHERE path = ?",
                (new_body, self._now(), self.actor, path),
            )
            conn.commit()
        return f"Edited {command.path}"

    def insert(self, command: Any) -> str:
        path = self._norm(command.path)
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT content FROM memory_entries WHERE path = ? AND deleted = 0",
                (path,),
            ).fetchone()
            lines = row["content"].split("\n") if row is not None else []
            idx = max(0, min(command.insert_line, len(lines)))
            lines.insert(idx, command.insert_text)
            new_body = "\n".join(lines)
            now = self._now()
            conn.execute(
                """
                INSERT INTO memory_entries (path, content, deleted, created_at, updated_at, created_by, updated_by)
                VALUES (?, ?, 0, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET content = excluded.content, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by
                """,
                (path, new_body, now, now, self.actor, self.actor),
            )
            conn.commit()
        return f"Inserted at line {idx} of {command.path}"

    def delete(self, command: Any) -> str:
        path = self._norm(command.path)
        with self._lock, self._connect() as conn:
            if self.hard_delete:
                cur = conn.execute("DELETE FROM memory_entries WHERE path = ?", (path,))
            else:
                cur = conn.execute(
                    "UPDATE memory_entries SET deleted = 1, updated_at = ?, updated_by = ? WHERE path = ? AND deleted = 0",
                    (self._now(), self.actor, path),
                )
            conn.commit()
            if cur.rowcount == 0:
                return f"{command.path} did not exist; nothing deleted."
        return f"Deleted {command.path}"

    def rename(self, command: Any) -> str:
        src = self._norm(command.old_path)
        dst = self._norm(command.new_path)
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT content FROM memory_entries WHERE path = ? AND deleted = 0",
                (src,),
            ).fetchone()
            if row is None:
                return f"Cannot rename: {command.old_path} does not exist."
            now = self._now()
            conn.execute(
                """
                INSERT INTO memory_entries (path, content, deleted, created_at, updated_at, created_by, updated_by)
                VALUES (?, ?, 0, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET content = excluded.content, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by
                """,
                (dst, row["content"], now, now, self.actor, self.actor),
            )
            if self.hard_delete:
                conn.execute("DELETE FROM memory_entries WHERE path = ?", (src,))
            else:
                conn.execute(
                    "UPDATE memory_entries SET deleted = 1, updated_at = ?, updated_by = ? WHERE path = ?",
                    (now, self.actor, src),
                )
            conn.commit()
        return f"Renamed {command.old_path} → {command.new_path}"
