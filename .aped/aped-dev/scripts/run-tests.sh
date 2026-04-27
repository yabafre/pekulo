#!/usr/bin/env bash
# Auto-detect test framework and run tests
# Usage: run-tests.sh [test-path]
# Exit code matches the test runner's exit code

set -euo pipefail

TEST_PATH="${1:-}"

# Auto-detect test framework
if [[ -f "package.json" ]]; then
  echo "Detected: Node.js project"
  if grep -q '"vitest"' package.json 2>/dev/null; then
    echo "Runner: vitest"
    npx vitest run ${TEST_PATH:+"$TEST_PATH"}
  elif grep -q '"jest"' package.json 2>/dev/null; then
    echo "Runner: jest"
    npx jest ${TEST_PATH:+"$TEST_PATH"}
  else
    echo "Runner: npm test"
    npm test ${TEST_PATH:+-- "$TEST_PATH"}
  fi
elif [[ -f "setup.py" ]] || [[ -f "pyproject.toml" ]] || [[ -f "setup.cfg" ]]; then
  echo "Detected: Python project"
  if [[ -n "$TEST_PATH" ]]; then
    python -m pytest "$TEST_PATH" -v
  else
    python -m pytest -v
  fi
elif [[ -f "Cargo.toml" ]]; then
  echo "Detected: Rust project"
  if [[ -n "$TEST_PATH" ]]; then
    cargo test "$TEST_PATH"
  else
    cargo test
  fi
elif [[ -f "go.mod" ]]; then
  echo "Detected: Go project"
  if [[ -n "$TEST_PATH" ]]; then
    go test "$TEST_PATH" -v
  else
    go test ./... -v
  fi
else
  echo "ERROR: No recognized test framework found"
  echo "Supported: package.json (Node), setup.py/pyproject.toml (Python), Cargo.toml (Rust), go.mod (Go)"
  exit 1
fi
