#!/usr/bin/env bash
# Run mypy strict against each agent script individually.
#
# Why a loop instead of mypy's normal multi-file mode:
# every agent's entry point is literally `agent.py` — mypy refuses to
# resolve four modules with the same name in one invocation. Running per
# directory with the dir's parent on MYPYPATH lets us strict-check each
# script in isolation while still letting them import the shared
# `_shared` package from the repo root.

set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
FAILED=0

for dir in 01_meeting_killer 02_pm_memory 03_cross_team 04_oncall_companion 05_pr_reviewer; do
  echo "── mypy: $dir/agent.py"
  if ! MYPYPATH="$REPO_ROOT" python -m mypy \
       --strict \
       --warn-unused-ignores \
       --warn-redundant-casts \
       --warn-unreachable \
       --scripts-are-modules \
       --follow-imports=silent \
       "$dir/agent.py"; then
    FAILED=1
  fi
done

exit "$FAILED"
