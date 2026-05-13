"""Tests for the shared logging helper."""

from __future__ import annotations

import io
import json
import logging
from typing import cast

import pytest

from _shared.logging_setup import JSONFormatter, get_logger


def test_get_logger_returns_same_logger_for_same_agent() -> None:
    a = get_logger("test-shared-1")
    b = get_logger("test-shared-1")
    assert a is b


def test_get_logger_does_not_duplicate_handlers() -> None:
    a = get_logger("test-shared-handlers")
    initial = len(a.handlers)
    b = get_logger("test-shared-handlers")
    assert len(b.handlers) == initial


def test_logger_emits_json_with_required_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    sink = io.StringIO()
    handler = logging.StreamHandler(stream=sink)
    handler.setFormatter(JSONFormatter("test-shared-2"))
    logger = logging.getLogger("agent.test-shared-2-emit")
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    logger.info("hello world", extra={"custom_field": 42, "session": "abc"})

    line = sink.getvalue().strip()
    record = cast(dict[str, object], json.loads(line))
    assert record["msg"] == "hello world"
    assert record["level"] == "INFO"
    assert record["agent"] == "test-shared-2"
    assert record["custom_field"] == 42
    assert record["session"] == "abc"
    assert "ts" in record
