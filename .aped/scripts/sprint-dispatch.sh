#!/usr/bin/env bash
# APED sprint-dispatch — create a git worktree for a story so the user can
# launch a dedicated Claude Code session in it with /aped-dev.
#
# Usage: sprint-dispatch.sh <story-key> [<ticket-id>] [<base-ref>]
#
# <base-ref> is the git ref to cut the feature branch from. In sprint mode,
# the caller passes the sprint umbrella (e.g. "sprint/epic-1") so stories
# parent under it. In solo / classic mode, omit it — defaults to HEAD.
#
# Output: absolute path of the new worktree (stdout, line 1)
# Exit: 0 on success; 1 on user error; 2 on git error; 3 on concurrent dispatch;
#       4 if <base-ref> is given but does not resolve to a git ref.
#
# Concurrency: acquires a per-story mkdir lock at ${APED_DIR}/.sprint-locks/
# to prevent two /aped-sprint sessions from racing on the same story key
# (both calling `git worktree add` simultaneously and one failing cryptically).
# Stale locks older than SPRINT_LOCK_STALE_SECONDS (default 900s = 15min —
# worktree + initial push can be slow on large repos) are auto-reclaimed.

set -euo pipefail

SPRINT_LOCK_STALE_SECONDS=${APED_SPRINT_LOCK_STALE_SECONDS:-900}
SPRINT_LOCK_TIMEOUT_SECONDS=${APED_SPRINT_LOCK_TIMEOUT_SECONDS:-30}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <story-key> [<ticket-id>] [<base-ref>]" >&2
  exit 1
fi

STORY_KEY="$1"
TICKET_ID="${2:-$STORY_KEY}"
BASE_REF="${3:-HEAD}"

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
if [[ ! -d "$PROJECT_ROOT/.git" ]] && ! git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: $PROJECT_ROOT is not inside a git repo" >&2
  exit 2
fi

# Compute target paths up-front so the lock is keyed on the actual contended
# resource (the worktree path), not on the story key. Two stories that share
# a TICKET_ID would resolve to the same WORKTREE_PATH and race in
# `git worktree add`; the old per-story-key lock missed that case.
PROJECT_NAME=$(basename "$PROJECT_ROOT")
WORKTREE_PATH="$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-${TICKET_ID}"
BRANCH_NAME="feature/${TICKET_ID}-${STORY_KEY}"

# ── Fleet-lock keyed on the worktree path (sanitised for filesystem use) ─
LOCK_KEY=$(printf '%s' "$WORKTREE_PATH" | tr '/ ' '__')
SPRINT_LOCK_DIR="$PROJECT_ROOT/.aped/.sprint-locks/$LOCK_KEY"
mkdir -p "$(dirname "$SPRINT_LOCK_DIR")"

mtime_age() {
  local target="$1" now mtime
  now=$(date +%s)
  mtime=$(stat -c %Y "$target" 2>/dev/null || stat -f %m "$target" 2>/dev/null || echo "$now")
  echo $((now - mtime))
}

if [[ -d "$SPRINT_LOCK_DIR" ]]; then
  age=$(mtime_age "$SPRINT_LOCK_DIR")
  if (( age > SPRINT_LOCK_STALE_SECONDS )); then
    echo "WARN: stale dispatch lock for $WORKTREE_PATH (age ${age}s > ${SPRINT_LOCK_STALE_SECONDS}s) — previous dispatch likely crashed. Reclaiming." >&2
    rm -rf "$SPRINT_LOCK_DIR"
  fi
fi

waited=0
until mkdir "$SPRINT_LOCK_DIR" 2>/dev/null; do
  if (( waited >= SPRINT_LOCK_TIMEOUT_SECONDS * 10 )); then
    echo "ERROR: another /aped-sprint session is dispatching to $WORKTREE_PATH (lock: $SPRINT_LOCK_DIR). Wait for it to finish and retry, or remove the lock if you're certain it's stale." >&2
    exit 3
  fi
  sleep 0.1
  waited=$((waited + 1))
done
# Release on any exit (success, error, signal). The "worktree path already
# exists" check below is the next safety net for replays.
trap "rm -rf '$SPRINT_LOCK_DIR' 2>/dev/null || true" EXIT INT TERM

if [[ -d "$WORKTREE_PATH" ]]; then
  echo "ERROR: worktree path already exists: $WORKTREE_PATH" >&2
  exit 2
fi

cd "$PROJECT_ROOT"

# Resolve base-ref up-front so a typo fails loud instead of silently
# branching from an unrelated commit.
if [[ "$BASE_REF" != "HEAD" ]]; then
  if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    echo "ERROR: base-ref '$BASE_REF' does not resolve. In sprint mode the umbrella must be created by /aped-sprint before dispatch." >&2
    exit 4
  fi
fi

if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
  git worktree add "$WORKTREE_PATH" "$BRANCH_NAME" >&2
else
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF" >&2
fi

mkdir -p "$WORKTREE_PATH/.aped"
cat > "$WORKTREE_PATH/.aped/WORKTREE" <<EOF
schema_version: 1
story_key: $STORY_KEY
ticket: $TICKET_ID
branch: $BRANCH_NAME
project_root: $PROJECT_ROOT
created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

bash "$PROJECT_ROOT/.aped/scripts/log.sh" worktree_created \
  story="$STORY_KEY" ticket="$TICKET_ID" branch="$BRANCH_NAME" worktree="$WORKTREE_PATH" \
  2>/dev/null || true

printf '%s\n' "$WORKTREE_PATH"
