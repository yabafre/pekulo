#!/usr/bin/env bash
# Oracle for state.yaml. Deterministic shape verification.
#
# Usage: oracle-state.sh <apedDir>
# Exit:  0 = clean, 1+ = violations
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <apedDir>"
  exit 1
fi

APED_DIR="$1"
CONFIG_FILE="$APED_DIR/config.yaml"
ECODE=0

# Resolve output_path from config
OUTPUT_PATH="docs/aped"
if [[ -f "$CONFIG_FILE" ]]; then
  CUSTOM=$({ grep -E '^output_path:' "$CONFIG_FILE" 2>/dev/null || true; } | sed 's/^output_path:[[:space:]]*//' | sed "s/['\"[:space:]]//g")
  [[ -n "$CUSTOM" ]] && OUTPUT_PATH="$CUSTOM"
fi
STATE_FILE="$OUTPUT_PATH/state.yaml"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR E050: state.yaml not found at $STATE_FILE"
  exit 1
fi

# E050 — unknown top-level keys
if command -v yq >/dev/null 2>&1; then
  KNOWN="schema_version project_name pipeline sprint corrections_pointer corrections_count lead mcp"
  ACTUAL_KEYS=$(yq eval 'keys | .[]' "$STATE_FILE" 2>/dev/null || true)
  for k in $ACTUAL_KEYS; do
    FOUND=0
    for known in $KNOWN; do
      [[ "$k" == "$known" ]] && FOUND=1 && break
    done
    if [[ "$FOUND" -eq 0 ]]; then
      echo "ERROR E050: unknown top-level key '$k' in state.yaml (allowed: $KNOWN)"
      ECODE=1
    fi
  done
fi

# E053 — corrections_pointer broken
if command -v yq >/dev/null 2>&1; then
  POINTER=$(yq eval '.corrections_pointer // ""' "$STATE_FILE" 2>/dev/null || true)
  if [[ -n "$POINTER" && "$POINTER" != "null" && ! -f "$POINTER" ]]; then
    echo "ERROR E053: corrections_pointer=$POINTER but file does not exist"
    ECODE=1
  fi
fi

# E055 — lead.worktree set but WORKTREE marker missing
if command -v yq >/dev/null 2>&1; then
  WORKTREE_VAL=$(yq eval '.lead.worktree // ""' "$STATE_FILE" 2>/dev/null || true)
  if [[ -n "$WORKTREE_VAL" && "$WORKTREE_VAL" != "null" && "$WORKTREE_VAL" != "false" ]]; then
    if [[ ! -f "$APED_DIR/WORKTREE" ]]; then
      echo "ERROR E055: lead.worktree is set but $APED_DIR/WORKTREE marker is missing"
      ECODE=1
    fi
  fi
fi

if [[ "$ECODE" -eq 0 ]]; then
  echo "OK state oracle: all checks passed"
fi
exit "$ECODE"
