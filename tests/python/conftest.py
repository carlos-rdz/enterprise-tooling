"""
Shared pytest fixtures and path setup for Python agent tests.

Ensures `_shared`, agent dirs, and `evals` are all importable from tests.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))
