#!/usr/bin/env bash
# Oracle for QA phase. Deterministic verification of test quality markers.
#
# Usage: oracle-qa.sh <story-or-epic-key> <apedDir>
# Exit:  0 = clean, 1+ = violations
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <story-or-epic-key> <apedDir>"
  exit 1
fi

KEY="$1"
APED_DIR="$2"
ECODE=0

# E042 — flaky test markers (.skip, .only, .todo, @pytest.mark.skip/flaky)
FLAKY_HITS=$({ grep -rnE '\.(skip|only|todo)\(' tests/ test/ 2>/dev/null || true; } | { grep -v 'node_modules' || true; } | wc -l | tr -d ' ')
if [[ "$FLAKY_HITS" -gt 0 ]]; then
  echo "ERROR E042: $FLAKY_HITS flaky marker(s) found (.skip/.only/.todo) in test tree"
  ECODE=1
fi

# E044 WARN — last-test-exit is stale (>24h)
if [[ -f "$APED_DIR/.last-test-exit" ]]; then
  if command -v stat >/dev/null 2>&1; then
    # macOS vs Linux stat
    if stat -f %m "$APED_DIR/.last-test-exit" >/dev/null 2>&1; then
      MTIME=$(stat -f %m "$APED_DIR/.last-test-exit")
    else
      MTIME=$(stat -c %Y "$APED_DIR/.last-test-exit" 2>/dev/null || echo 0)
    fi
    NOW=$(date +%s)
    AGE=$(( NOW - MTIME ))
    if [[ "$AGE" -gt 86400 ]]; then
      echo "WARN E044: last-test-exit is stale ($(( AGE / 3600 ))h old, threshold 24h)"
    fi
  fi
fi

if [[ "$ECODE" -eq 0 ]]; then
  echo "OK qa oracle: all checks passed for key $KEY"
fi
exit "$ECODE"
