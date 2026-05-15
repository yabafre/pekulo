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
# When omitted, the base ref defaults to the umbrella recorded in state.yaml
# (sprint mode) → config.yaml.base_branch (solo mode) → HEAD (last resort).
# /aped-sprint always passes the umbrella explicitly; this resolution chain
# only kicks in when the script is invoked manually.
BASE_REF="${3:-}"

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
if [[ ! -d "$PROJECT_ROOT/.git" ]] && ! git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: $PROJECT_ROOT is not inside a git repo" >&2
  exit 2
fi

# Resolve BASE_REF when not given on the command line. Read state.yaml first
# (sprint umbrella wins) then config.yaml.base_branch, then HEAD.
if [[ -z "$BASE_REF" ]]; then
  STATE_FILE_TMP="$PROJECT_ROOT/docs/state.yaml"
  CONFIG_FILE_TMP="$PROJECT_ROOT/.aped/config.yaml"
  if command -v yq >/dev/null 2>&1 && [[ -f "$STATE_FILE_TMP" ]]; then
    BASE_REF=$(yq eval '.sprint.umbrella_branch // ""' "$STATE_FILE_TMP" 2>/dev/null || echo "")
  fi
  if [[ -z "$BASE_REF" || "$BASE_REF" == "null" ]]; then
    if command -v yq >/dev/null 2>&1 && [[ -f "$CONFIG_FILE_TMP" ]]; then
      BASE_REF=$(yq eval '.base_branch // ""' "$CONFIG_FILE_TMP" 2>/dev/null || echo "")
    fi
  fi
  if [[ -z "$BASE_REF" || "$BASE_REF" == "null" ]]; then
    BASE_REF="HEAD"
  fi
fi

# Compute target paths up-front so the lock is keyed on the actual contended
# resource (the worktree path), not on the story key. The path includes
# BOTH the ticket id AND the story key — without the story key, two stories
# that share a ticket (e.g. sub-stories of the same parent ticket) would
# collide on disk and the second `git worktree add` would fail. The lock
# is then keyed on this resolved path, so sequential dispatch of two
# distinct stories no longer false-conflicts on the lock either.
PROJECT_NAME=$(basename "$PROJECT_ROOT")
WORKTREE_PATH="$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-${TICKET_ID}-${STORY_KEY}"
BRANCH_NAME="feature/${TICKET_ID}-${STORY_KEY}"

# ── Sprint mode detection (6.7.5) ──
# Read sprint.mode from state.yaml (preferred) or config.yaml. Default
# "parallel" preserves pre-6.7.5 behavior.
SPRINT_MODE="parallel"
SHARED_WORKTREE=""
if command -v yq >/dev/null 2>&1; then
  STATE_FILE_TMP="$PROJECT_ROOT/docs/state.yaml"
  CONFIG_FILE_TMP="$PROJECT_ROOT/.aped/config.yaml"
  if [[ -f "$STATE_FILE_TMP" ]]; then
    m=$(yq eval '.sprint.mode // ""' "$STATE_FILE_TMP" 2>/dev/null || echo "")
    [[ -n "$m" && "$m" != "null" ]] && SPRINT_MODE="$m"
    s=$(yq eval '.sprint.shared_worktree // ""' "$STATE_FILE_TMP" 2>/dev/null || echo "")
    [[ -n "$s" && "$s" != "null" ]] && SHARED_WORKTREE="$s"
  fi
  if [[ "$SPRINT_MODE" == "parallel" && -f "$CONFIG_FILE_TMP" ]]; then
    m=$(yq eval '.sprint.mode // ""' "$CONFIG_FILE_TMP" 2>/dev/null || echo "")
    [[ -n "$m" && "$m" != "null" ]] && SPRINT_MODE="$m"
  fi
fi

if [[ "$SPRINT_MODE" == "sequential" ]]; then
  # Sequential mode requires git-spice for stack management. `gs` collides
  # with GhostScript on macOS (/usr/bin/gs) — verify it's actually git-spice
  # by sniffing the --version output.
  if ! command -v gs >/dev/null 2>&1 || ! gs --version 2>&1 | grep -qiE 'git[ -]spice'; then
    echo "ERROR: sprint.mode=sequential requires git-spice (\`gs\`). Install: https://github.com/abhinav/git-spice" >&2
    exit 5
  fi
  if [[ -z "$SHARED_WORKTREE" ]]; then
    echo "ERROR: sprint.mode=sequential but sprint.shared_worktree is not set in state.yaml. \`aped-sprint\` must create the shared worktree at sprint start." >&2
    exit 5
  fi
  if [[ ! -d "$SHARED_WORKTREE" ]]; then
    echo "ERROR: shared worktree $SHARED_WORKTREE does not exist on disk. Recreate via aped-sprint or reset state.yaml." >&2
    exit 5
  fi
  # Override the per-story worktree path: every sequential story lives in
  # the shared worktree. The branch still stacks via gs.
  WORKTREE_PATH="$SHARED_WORKTREE"
fi

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

if [[ "$SPRINT_MODE" == "sequential" ]]; then
  # Shared worktree already exists; stack the branch via git-spice.
  # gs branch create stacks on top of the currently-checked-out branch
  # inside the shared worktree. The aped-sprint skill is responsible for
  # ordering: prior story must be checked out (or the umbrella for story 1)
  # before invoking dispatch.
  if (cd "$SHARED_WORKTREE" && gs branch create "$BRANCH_NAME" >&2); then
    : # stacked successfully
  else
    echo "ERROR: \`gs branch create $BRANCH_NAME\` failed inside $SHARED_WORKTREE. Check the shared worktree's state with \`gs ls\` from there." >&2
    exit 6
  fi
else
  # Parallel mode (default): create an independent worktree per story.
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
fi

mkdir -p "$WORKTREE_PATH/.aped"
# 6.8.0 — sequential mode dispatches multiple stories into ONE shared worktree;
# writing the same WORKTREE file each time would let the last story overwrite
# the first. Per-story markers in sequential mode; legacy single marker stays
# in parallel mode (one worktree per story, no collision risk).
if [[ "$SPRINT_MODE" == "sequential" ]]; then
  # STORY_KEY becomes part of the marker filename — reject any character outside
  # [a-zA-Z0-9._-] so a key like `1-1/../evil` cannot escape the marker dir.
  case "$STORY_KEY" in
    "" | *[!a-zA-Z0-9._-]* | *..* )
      echo "ERROR: invalid STORY_KEY '$STORY_KEY' for sequential marker — allowed chars: [a-zA-Z0-9._-]" >&2
      exit 7 ;;
  esac
  MARKER_PATH="$WORKTREE_PATH/.aped/WORKTREE.$STORY_KEY.yaml"
else
  MARKER_PATH="$WORKTREE_PATH/.aped/WORKTREE"
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

bash "$PROJECT_ROOT/.aped/scripts/log.sh" worktree_created \
  story="$STORY_KEY" ticket="$TICKET_ID" branch="$BRANCH_NAME" worktree="$WORKTREE_PATH" \
  2>/dev/null || true

# ── Post-dispatch bootstrap (6.7.5) ──
# Override > smart defaults. All commands are best-effort: failures log and
# continue so a flaky network or missing tool never breaks dispatch.
post_dispatch_log() {
  bash "$PROJECT_ROOT/.aped/scripts/log.sh" post_dispatch_step \
    story="$STORY_KEY" step="$1" status="$2" \
    2>/dev/null || true
}

HOOK_CMDS=()
if command -v yq >/dev/null 2>&1 && [[ -f "$PROJECT_ROOT/.aped/config.yaml" ]]; then
  while IFS= read -r cmd; do
    [[ -n "$cmd" && "$cmd" != "null" ]] && HOOK_CMDS+=("$cmd")
  done < <(yq eval '.sprint.post_dispatch_hook[]? // ""' "$PROJECT_ROOT/.aped/config.yaml" 2>/dev/null || true)
fi

if (( ${#HOOK_CMDS[@]} > 0 )); then
  # User override — run each command, skip smart defaults entirely.
  for cmd in "${HOOK_CMDS[@]}"; do
    (cd "$WORKTREE_PATH" && bash -c "$cmd") \
      && post_dispatch_log "hook:$cmd" ok \
      || post_dispatch_log "hook:$cmd" failed
  done
else
  # Smart defaults — try them all, log each independently.
  if [[ -f "$WORKTREE_PATH/package.json" ]]; then
    RUNNER=$(bash "$PROJECT_ROOT/.aped/scripts/detect-package-runner.sh" "$WORKTREE_PATH" 2>/dev/null || echo "npm")
    (cd "$WORKTREE_PATH" && "$RUNNER" install 2>&1 | tail -5 >&2) \
      && post_dispatch_log "install:$RUNNER" ok \
      || post_dispatch_log "install:$RUNNER" failed
  fi
  if [[ -f "$WORKTREE_PATH/.env.example" && ! -f "$WORKTREE_PATH/.env" && -f "$PROJECT_ROOT/.env" ]]; then
    cp "$PROJECT_ROOT/.env" "$WORKTREE_PATH/.env" \
      && post_dispatch_log "env:copy" ok \
      || post_dispatch_log "env:copy" failed
  fi
fi

printf '%s\n' "$WORKTREE_PATH"
