"""
Structured-logging setup shared by every Python agent.

Writes JSON-ish single-line records to stderr with a stable shape:

    {"ts": "...", "level": "INFO", "agent": "meeting-killer", "msg": "...", ...}

Log level is controlled via LOG_LEVEL env var (DEBUG / INFO / WARNING / ERROR).
Default is INFO.

stdout is reserved for the agent's final user-visible rendering.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class JSONFormatter(logging.Formatter):
    def __init__(self, agent: str) -> None:
        super().__init__()
        self.agent = agent

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "agent": self.agent,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Pass through any structured fields set via `extra=`.
        for key, value in record.__dict__.items():
            if key in {"args", "asctime", "created", "exc_info", "exc_text", "filename", "funcName",
                       "levelname", "levelno", "lineno", "message", "module", "msecs", "msg", "name",
                       "pathname", "process", "processName", "relativeCreated", "stack_info", "thread",
                       "threadName", "taskName"}:
                continue
            payload[key] = value
        return json.dumps(payload, default=str)


def get_logger(agent: str) -> logging.Logger:
    """Get a configured logger for the given agent name.

    Safe to call multiple times — guards against duplicate handlers.
    """
    logger = logging.getLogger(f"agent.{agent}")
    if logger.handlers:
        return logger
    logger.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())
    handler = logging.StreamHandler(stream=sys.stderr)
    handler.setFormatter(JSONFormatter(agent))
    logger.addHandler(handler)
    logger.propagate = False
    return logger
