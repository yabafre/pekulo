#!/usr/bin/env bash
# APED test-pollution bisector.
# Runs each test in a glob isolated, checks whether a given path on the
# filesystem changed (created / modified / size delta), and reports the
# first test that introduces the pollution.
#
# Usage: find-polluter.sh <state-path> <test-glob>
# Example: find-polluter.sh '.git' 'src/**/*.test.ts'
#          find-polluter.sh /tmp/cache 'tests/**/*.spec.js'
#
# Exit:
#   0 — no polluter found (clean)
#   1 — polluter found (test path printed to stdout)
#   2 — usage / arg error
#
# Test runner: defaults to 'npm test', override with APED_TEST_RUNNER env.

set -u
set -o pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <state-path> <test-glob>" >&2
  echo "Example: $0 '.git' 'src/**/*.test.ts'" >&2
  exit 2
fi

STATE_PATH="$1"
TEST_GLOB="$2"
RUNNER="${APED_TEST_RUNNER:-npm test}"

snapshot_state() {
  if [[ -e "$STATE_PATH" ]]; then
    # Use stat in a portable-ish way: prefer GNU stat, fallback to BSD stat.
    if stat -c '%Y %s' "$STATE_PATH" 2>/dev/null; then
      return 0
    fi
    stat -f '%m %z' "$STATE_PATH" 2>/dev/null || echo "exists"
  else
    echo "absent"
  fi
}

echo "find-polluter: state='$STATE_PATH' glob='$TEST_GLOB' runner='$RUNNER'"

# Resolve test files via shell glob (bash globstar) — no GNU find required.
shopt -s globstar nullglob 2>/dev/null || true
TEST_FILES=( $TEST_GLOB )

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  echo "find-polluter: no test files matched glob '$TEST_GLOB'" >&2
  exit 2
fi

TOTAL=${#TEST_FILES[@]}
echo "find-polluter: $TOTAL test files to scan"
echo ""

BEFORE=$(snapshot_state)

if [[ "$BEFORE" != "absent" ]]; then
  echo "find-polluter: WARNING — state '$STATE_PATH' already exists before any test ran."
  echo "find-polluter:           script will detect modification (mtime / size change) instead of creation."
fi

INDEX=0
for TEST_FILE in "${TEST_FILES[@]}"; do
  INDEX=$((INDEX + 1))
  echo "[$INDEX/$TOTAL] $TEST_FILE"

  # Run isolated; ignore exit code (failing tests still count as ran).
  $RUNNER "$TEST_FILE" >/dev/null 2>&1 || true

  AFTER=$(snapshot_state)

  if [[ "$BEFORE" == "absent" && "$AFTER" != "absent" ]]; then
    echo ""
    echo "find-polluter: POLLUTER FOUND"
    echo "  test:    $TEST_FILE"
    echo "  created: $STATE_PATH"
    exit 1
  fi

  if [[ "$BEFORE" != "absent" && "$AFTER" != "$BEFORE" ]]; then
    echo ""
    echo "find-polluter: POLLUTER FOUND"
    echo "  test:     $TEST_FILE"
    echo "  modified: $STATE_PATH"
    echo "  before:   $BEFORE"
    echo "  after:    $AFTER"
    exit 1
  fi
done

echo ""
echo "find-polluter: no polluter detected — all $TOTAL tests left state unchanged."
exit 0
