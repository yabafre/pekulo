#!/usr/bin/env bash
# APED Upstream Lock — PreToolUse hook
# Denies Write/Edit on upstream docs (PRD, architecture, UX, product-brief)
# while any story is "in-progress" in state.yaml. Exception: /aped-course
# sets `scope_change_active: true` in state.yaml to unlock temporarily.
#
# stdin:  JSON with tool_name + tool_input.file_path
# stdout: PreToolUse JSON (permissionDecision=deny) on block; empty on allow.
# exit 0 always.

set -u
set -o pipefail

INPUT=""
IFS= read -r -t 2 INPUT || exit 0

# Extract tool_name and file_path (jq → node → bail).
if command -v jq >/dev/null 2>&1; then
  TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
  FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
elif command -v node >/dev/null 2>&1; then
  TOOL_NAME=$(APED_I="$INPUT" node -e 'try{const o=JSON.parse(process.env.APED_I);process.stdout.write(o.tool_name||"")}catch{}' 2>/dev/null || true)
  FILE_PATH=$(APED_I="$INPUT" node -e 'try{const o=JSON.parse(process.env.APED_I);process.stdout.write((o.tool_input&&o.tool_input.file_path)||"")}catch{}' 2>/dev/null || true)
else
  exit 0
fi

# Only Write/Edit/NotebookEdit are relevant.
case "${TOOL_NAME:-}" in
  Write|Edit|NotebookEdit) ;;
  *) exit 0 ;;
esac

[[ -n "${FILE_PATH:-}" ]] || exit 0

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
OUTPUT_DIR="$PROJECT_ROOT/docs"

# Normalise FILE_PATH to absolute (defensive — tool usually passes absolute already).
case "$FILE_PATH" in
  /*) ABS_PATH="$FILE_PATH" ;;
  *)  ABS_PATH="$PROJECT_ROOT/$FILE_PATH" ;;
esac

# Target only upstream docs.
IS_UPSTREAM=false
case "$ABS_PATH" in
  "$OUTPUT_DIR"/prd.md|"$OUTPUT_DIR"/architecture.md|"$OUTPUT_DIR"/product-brief.md)
    IS_UPSTREAM=true ;;
  "$OUTPUT_DIR"/ux/*)
    IS_UPSTREAM=true ;;
esac

[[ "$IS_UPSTREAM" == "true" ]] || exit 0

# No state.yaml → no sprint → allow.
[[ -f "$STATE_FILE" ]] || exit 0

# Any story in-progress?
if ! grep -q 'status:[[:space:]]*"*in-progress"*' "$STATE_FILE" 2>/dev/null; then
  exit 0
fi

# /aped-course unlocked writes?
if grep -q 'scope_change_active:[[:space:]]*true' "$STATE_FILE" 2>/dev/null; then
  exit 0
fi

# ── Block ──────────────────────────────────────────────────────────────────
REASON="Upstream doc write blocked.

Stories are in-progress (see ${STATE_FILE#$PROJECT_ROOT/}) and modifying ${ABS_PATH#$PROJECT_ROOT/} now would invalidate epic-context caches and confuse running worktrees.

Run /aped-course to go through the coordinated scope-change workflow: it notifies active worktrees via ticket comments, then unlocks upstream writes for the duration of the change."

if command -v jq >/dev/null 2>&1; then
  REASON_ENC=$(printf '%s' "$REASON" | jq -Rs '.')
elif command -v node >/dev/null 2>&1; then
  REASON_ENC=$(APED_R="$REASON" node -e 'process.stdout.write(JSON.stringify(process.env.APED_R))')
else
  # No safe encoder — fall through without blocking.
  exit 0
fi

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' "$REASON_ENC"
exit 0
