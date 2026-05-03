#!/usr/bin/env bash
# Oracle for Dev phase. Deterministic verification of TDD discipline
# before downstream review.
#
# Usage: oracle-dev.sh <story-file> <apedDir>
# Exit:  0 = clean, 1+ = violations (printed as ERROR <code>: <reason>)
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <story-file> <apedDir>"
  exit 1
fi

STORY_FILE="$1"
APED_DIR="$2"
ECODE=0

if [[ ! -f "$STORY_FILE" ]]; then
  echo "ERROR E030: story file not found at $STORY_FILE"
  exit 1
fi

# E030 — RED witness: each new test file should have a Confirmed RED entry
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  NEW_TESTS=$({ git diff --name-only HEAD~1 -- 'tests/**' 'test/**' '**/*.test.*' '**/*.spec.*' 2>/dev/null || true; })
  if [[ -n "$NEW_TESTS" ]] && [[ -f "$APED_DIR/dev-log.ndjson" ]]; then
    while IFS= read -r tf; do
      [[ -z "$tf" ]] && continue
      BASE=$(basename "$tf" | sed 's/\.[^.]*$//')
      RED_COUNT=$({ grep "Confirmed RED.*$BASE" "$APED_DIR/dev-log.ndjson" 2>/dev/null || true; } | wc -l | tr -d ' ')
      [[ "$RED_COUNT" =~ ^[0-9]+$ ]] || RED_COUNT=0
      if [[ "$RED_COUNT" -eq 0 ]]; then
        echo "ERROR E030: RED witness missing for test $tf (no 'Confirmed RED: $BASE' in dev-log.ndjson)"
        ECODE=1
      fi
    done <<< "$NEW_TESTS"
  fi
fi

# E031 — verbatim AC: test files should contain 'verbatim from' comment
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  NEW_TESTS2=$({ git diff --name-only HEAD~1 -- 'tests/**' 'test/**' '**/*.test.*' '**/*.spec.*' 2>/dev/null || true; })
  if [[ -n "$NEW_TESTS2" ]]; then
    while IFS= read -r tf; do
      [[ -z "$tf" || ! -f "$tf" ]] && continue
      VERBATIM=$({ grep 'verbatim from' "$tf" 2>/dev/null || true; } | wc -l | tr -d ' ')
      [[ "$VERBATIM" =~ ^[0-9]+$ ]] || VERBATIM=0
      TEST_COUNT=$({ grep -E '^\s*(it|test)\(' "$tf" 2>/dev/null || true; } | wc -l | tr -d ' ')
      if [[ "$TEST_COUNT" -gt 0 && "$VERBATIM" -eq 0 ]]; then
        echo "WARN E031: no 'verbatim from' comment in $tf ($TEST_COUNT tests without AC traceability)"
      fi
    done <<< "$NEW_TESTS2"
  fi
fi

# E032 — hallucinated identifier: new identifiers must appear in story/PRD
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  NEW_SYMBOLS=$({ git diff HEAD~1 -- 'src/**' 'lib/**' 'app/**' 2>/dev/null || true; } | { grep -E '^\+.*(class |function |const |let |def |CREATE TABLE |create_table)' 2>/dev/null || true; } | { grep -oE '(class|function|const|let|def|CREATE TABLE|create_table)\s+([A-Za-z_][A-Za-z0-9_]*)' 2>/dev/null || true; } | awk '{print $NF}' | sort -u)
  if [[ -n "$NEW_SYMBOLS" ]]; then
    while IFS= read -r sym; do
      [[ -z "$sym" || ${#sym} -lt 4 ]] && continue
      IN_STORY=$({ grep -wc "$sym" "$STORY_FILE" 2>/dev/null || true; })
      [[ "$IN_STORY" =~ ^[0-9]+$ ]] || IN_STORY=0
      if [[ "$IN_STORY" -eq 0 ]]; then
        echo "WARN E032: identifier '$sym' added in src/ but not found in story file (possible hallucination)"
      fi
    done <<< "$NEW_SYMBOLS"
  fi
fi

# E033 — last-test-exit cache must exist
if [[ ! -f "$APED_DIR/.last-test-exit" ]]; then
  echo "ERROR E033: last-test-exit cache missing at $APED_DIR/.last-test-exit"
  ECODE=1
fi

# E034 — if last-test-exit is non-zero but story says dev-done, flag it
if [[ -f "$APED_DIR/.last-test-exit" ]]; then
  LAST_EXIT=$(cat "$APED_DIR/.last-test-exit" 2>/dev/null || echo "unknown")
  if [[ "$LAST_EXIT" != "0" ]]; then
    DONE_STATUS=$({ grep -E '^-\s*status:\s*(dev-done|done|complete)' "$STORY_FILE" 2>/dev/null || true; } | wc -l | tr -d ' ')
    if [[ "$DONE_STATUS" -gt 0 ]]; then
      echo "ERROR E034: last-test-exit=$LAST_EXIT but story status is dev-done"
      ECODE=1
    fi
  fi
fi

# E036 — TDD inversion: src files touched but no test files touched
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  SRC_TOUCHED=$({ git diff --name-only HEAD~1 -- 'src/**' 'lib/**' 'app/**' 2>/dev/null || true; } | wc -l | tr -d ' ')
  TEST_TOUCHED=$({ git diff --name-only HEAD~1 -- 'tests/**' 'test/**' '**/*.test.*' '**/*.spec.*' 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [[ "$SRC_TOUCHED" -gt 0 && "$TEST_TOUCHED" -eq 0 ]]; then
    echo "ERROR E036: $SRC_TOUCHED source files touched but 0 test files — TDD inversion"
    ECODE=1
  fi
fi

if [[ "$ECODE" -eq 0 ]]; then
  echo "OK dev oracle: all checks passed"
fi
exit "$ECODE"
