#!/usr/bin/env bash
# APED write-worktree-marker — write the worktree marker file that lets
# aped-story / aped-dev recognise they're running on a sprint-owned feature
# branch (and skip the solo-mode branch-creation gate).
#
# Two writers, one schema:
#   - sprint-dispatch.sh (Path B/C — git worktree add + helper call)
#   - aped-sprint workflow Path A (workmux add + helper call)
#
# Before 6.12.2 the marker was inlined in sprint-dispatch.sh, which Path A
# never invokes — workmux-dispatched worktrees launched without a marker,
# so /aped-story silently fell back to solo mode and lost its sprint link.
# This helper centralises the write so both paths use the same code.
#
# Usage:
#   write-worktree-marker.sh \
#     --worktree <abs-path> --story <key> --ticket <id> --branch <ref> \
#     [--mode parallel|sequential] [--project-root <abs-path>]
#
# Behaviour:
#   - parallel (default) → writes <worktree>/.aped/WORKTREE
#   - sequential         → writes <worktree>/.aped/WORKTREE.<story>.yaml
#
# Idempotent: rewriting an existing marker with identical fields is a no-op
# (timestamp refresh only). Mismatched story_key on the same file is a hard
# error — refusing to overwrite a marker from a different story is the
# whole point of the per-story filename in sequential mode.
#
# Exit codes:
#   0  marker written (or already correct)
#   1  bad/missing arguments
#   2  worktree path does not exist on disk
#   3  invalid STORY_KEY (path-traversal guard)
#   4  marker exists with a conflicting story_key

set -euo pipefail

usage() {
  echo "Usage: $0 --worktree <path> --story <key> --ticket <id> --branch <ref> [--mode parallel|sequential] [--project-root <path>]" >&2
}

WORKTREE=""
STORY_KEY=""
TICKET_ID=""
BRANCH_NAME=""
SPRINT_MODE="parallel"
PROJECT_ROOT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --worktree)     WORKTREE="${2:-}";     shift 2 ;;
    --story)        STORY_KEY="${2:-}";    shift 2 ;;
    --ticket)       TICKET_ID="${2:-}";    shift 2 ;;
    --branch)       BRANCH_NAME="${2:-}";  shift 2 ;;
    --mode)         SPRINT_MODE="${2:-}";  shift 2 ;;
    --project-root) PROJECT_ROOT="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

[[ -n "$WORKTREE" && -n "$STORY_KEY" && -n "$TICKET_ID" && -n "$BRANCH_NAME" ]] || { usage; exit 1; }

case "$SPRINT_MODE" in
  parallel|sequential) : ;;
  *) echo "ERROR: --mode must be parallel or sequential, got: $SPRINT_MODE" >&2; exit 1 ;;
esac

if [[ ! -d "$WORKTREE" ]]; then
  echo "ERROR: worktree path does not exist: $WORKTREE" >&2
  exit 2
fi

# Path-traversal guard: STORY_KEY ends up in the marker filename in sequential
# mode, so reject anything outside [a-zA-Z0-9._-]. Same guard sprint-dispatch.sh
# used before the refactor — keep it identical.
case "$STORY_KEY" in
  "" | *[!a-zA-Z0-9._-]* | *..* )
    echo "ERROR: invalid STORY_KEY '$STORY_KEY' — allowed chars: [a-zA-Z0-9._-]" >&2
    exit 3 ;;
esac

if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git -C "$WORKTREE" rev-parse --show-toplevel 2>/dev/null || pwd)}"
fi

mkdir -p "$WORKTREE/.aped"

if [[ "$SPRINT_MODE" == "sequential" ]]; then
  MARKER_PATH="$WORKTREE/.aped/WORKTREE.$STORY_KEY.yaml"
else
  MARKER_PATH="$WORKTREE/.aped/WORKTREE"
fi

# If a marker already exists, refuse to clobber a different story's marker.
# This catches "Path A re-dispatch onto a stale worktree" — better to surface
# the conflict than silently overwrite.
if [[ -f "$MARKER_PATH" ]]; then
  existing_key=$(grep -E '^story_key:' "$MARKER_PATH" 2>/dev/null | sed 's/^story_key:[[:space:]]*//' || true)
  if [[ -n "$existing_key" && "$existing_key" != "$STORY_KEY" ]]; then
    echo "ERROR: marker at $MARKER_PATH already owned by story '$existing_key' (refusing to overwrite with '$STORY_KEY')" >&2
    exit 4
  fi
fi

cat > "$MARKER_PATH" <<EOF
schema_version: 1
story_key: $STORY_KEY
ticket: $TICKET_ID
branch: $BRANCH_NAME
project_root: $PROJECT_ROOT
sprint_mode: $SPRINT_MODE
created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

printf '%s\n' "$MARKER_PATH"
