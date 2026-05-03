#!/usr/bin/env bash
# Auto-detect test framework and run tests, caching the exit code.
#
# Usage: run-tests.sh [test-path]
# Exit code matches the test runner's exit code.
#
# Side effect: writes the exit code to .aped/.last-test-exit (relative to
# cwd) so /aped-lead's check-auto-approve.sh dev-done can verify the most
# recent run passed without re-executing the suite. Skipped silently if
# .aped/ doesn't exist (running outside an APED project).

# Note: -e intentionally OMITTED so a failing test runner doesn't bypass
# the cache write below. -u and pipefail still apply.
set -uo pipefail

TEST_PATH="${1:-}"

CMD=()
if [[ -f "package.json" ]]; then
  echo "Detected: Node.js project"
  if grep -q '"vitest"' package.json 2>/dev/null; then
    echo "Runner: vitest"
    CMD=(npx vitest run)
    [[ -n "$TEST_PATH" ]] && CMD+=("$TEST_PATH")
  elif grep -q '"jest"' package.json 2>/dev/null; then
    echo "Runner: jest"
    CMD=(npx jest)
    [[ -n "$TEST_PATH" ]] && CMD+=("$TEST_PATH")
  else
    echo "Runner: npm test"
    CMD=(npm test)
    [[ -n "$TEST_PATH" ]] && CMD+=(-- "$TEST_PATH")
  fi
elif [[ -f "setup.py" ]] || [[ -f "pyproject.toml" ]] || [[ -f "setup.cfg" ]]; then
  echo "Detected: Python project"
  CMD=(python -m pytest -v)
  [[ -n "$TEST_PATH" ]] && CMD+=("$TEST_PATH")
elif [[ -f "Cargo.toml" ]]; then
  echo "Detected: Rust project"
  if [[ -n "$TEST_PATH" ]]; then
    CMD=(cargo test "$TEST_PATH")
  else
    CMD=(cargo test)
  fi
elif [[ -f "go.mod" ]]; then
  echo "Detected: Go project"
  if [[ -n "$TEST_PATH" ]]; then
    CMD=(go test "$TEST_PATH" -v)
  else
    CMD=(go test ./... -v)
  fi
else
  echo "ERROR: No recognized test framework found"
  echo "Supported: package.json (Node), setup.py/pyproject.toml (Python), Cargo.toml (Rust), go.mod (Go)"
  exit 1
fi

"${CMD[@]}"
EXIT=$?

if [[ -d ".aped" ]]; then
  echo "$EXIT" > ".aped/.last-test-exit" 2>/dev/null || true
fi

exit $EXIT
