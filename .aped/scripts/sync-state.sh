#!/usr/bin/env bash
# APED sync-state — atomic, backed-up mutations to state.yaml.
#
# Takes a portable mkdir lock, writes via temp-file + mv (atomic on POSIX),
# and keeps a one-deep backup at ${APED_DIR}/state.yaml.backup for disaster
# recovery. Stale locks older than STALE_LOCK_SECONDS are auto-cleared with
# a warning (covers the "skill crashed mid-write" case).
#
# Usage: echo '<command> <args...>' | sync-state.sh
#
# Recognised commands:
#   set-scope-change       <true|false>
#   set-story-status       <key> <new-status>
#   set-story-worktree     <key> <path>
#   clear-story-worktree   <key>
#
# Exit codes: 0 ok, 1 generic error, 2 stale lock cleared + state untouched,
#             3 invalid command, 4 state.yaml missing or unreadable,
#             5 candidate file failed validation (refused to clobber state).

# Strict mode — any unhandled failure aborts the run BEFORE write_atomic
# touches the live state file. Without -e the previous version could swallow
# a failed cp/awk/sed and proceed to mv, writing corrupted YAML "atomically".
set -euo pipefail

STALE_LOCK_SECONDS=${APED_STALE_LOCK_SECONDS:-300}
LOCK_TIMEOUT_SECONDS=${APED_LOCK_TIMEOUT_SECONDS:-5}

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
LOCK_DIR="$PROJECT_ROOT/.aped/.state.lock"
BACKUP_FILE="$PROJECT_ROOT/.aped/state.yaml.backup"

mkdir -p "$(dirname "$LOCK_DIR")"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: state.yaml not found at $STATE_FILE" >&2
  exit 4
fi

# ── Stale-lock auto-recovery ─────────────────────────────────────────────
# mkdir is atomic on every POSIX fs, so the lock dir is our mutex. If the
# last holder crashed (OOM, SIGKILL, power loss), the dir persists forever.
# We check its age via the stamp file written right after acquisition; if
# >STALE_LOCK_SECONDS old, we assume orphan and reclaim with a warning.
lock_age_seconds() {
  local stamp="$LOCK_DIR/stamp"
  [[ -f "$stamp" ]] || { stat_mtime "$LOCK_DIR"; return; }
  stat_mtime "$stamp"
}

stat_mtime() {
  local target="$1"
  local now mtime
  now=$(date +%s)
  # Linux: stat -c; macOS/BSD: stat -f
  mtime=$(stat -c %Y "$target" 2>/dev/null || stat -f %m "$target" 2>/dev/null || echo "$now")
  echo $((now - mtime))
}

reclaim_stale_lock_if_any() {
  [[ -d "$LOCK_DIR" ]] || return 0
  local age
  age=$(lock_age_seconds)
  if (( age > STALE_LOCK_SECONDS )); then
    echo "WARN: stale lock $LOCK_DIR (age ${age}s > ${STALE_LOCK_SECONDS}s) — the previous sync-state run likely crashed. Reclaiming. Verify state.yaml integrity." >&2
    rm -rf "$LOCK_DIR"
  fi
}

acquire_lock() {
  local waited=0
  reclaim_stale_lock_if_any
  until mkdir "$LOCK_DIR" 2>/dev/null; do
    (( waited >= LOCK_TIMEOUT_SECONDS * 10 )) && {
      echo "ERROR: could not acquire $LOCK_DIR within ${LOCK_TIMEOUT_SECONDS}s. Another sync-state may be running. If you believe it is stuck, remove $LOCK_DIR manually." >&2
      return 1
    }
    sleep 0.1
    waited=$((waited + 1))
  done
  date +%s > "$LOCK_DIR/stamp"
  # shellcheck disable=SC2064
  trap "rm -rf '$LOCK_DIR' 2>/dev/null || true" EXIT INT TERM
}

# ── Atomic write + backup ────────────────────────────────────────────────
# All mutations flow through write_atomic. Order matters:
#   1. Validate the candidate file (non-empty, parses as YAML if yq present)
#      — refuse to clobber the live state with garbage. This is the gate
#      that turns a buggy awk/sed into "no-op + clear error" instead of
#      "atomically corrupt the canonical state".
#   2. Snapshot the current good state to BACKUP_FILE. Failure here aborts
#      — better to fail the mutation than to overwrite with no rollback.
#   3. mv the candidate over the live file. mv within the same filesystem
#      is atomic on POSIX, so a crash mid-mv leaves either the old or the
#      new state, never a truncated mix.
write_atomic() {
  local new_content_path="$1"

  if [[ ! -s "$new_content_path" ]]; then
    echo "ERROR: candidate state file is empty ($new_content_path) — refusing write." >&2
    rm -f "$new_content_path" 2>/dev/null || true
    return 5
  fi

  if command -v yq >/dev/null 2>&1; then
    if ! yq eval 'true' "$new_content_path" >/dev/null 2>&1; then
      echo "ERROR: candidate state file is not valid YAML ($new_content_path) — refusing write. Inspect the candidate before retrying." >&2
      return 5
    fi
  fi

  if ! cp -f "$STATE_FILE" "$BACKUP_FILE"; then
    echo "ERROR: failed to write backup at $BACKUP_FILE — aborting before mutating live state." >&2
    return 1
  fi

  mv -f "$new_content_path" "$STATE_FILE"
  command -v sync >/dev/null 2>&1 && sync || true
}

# ── Commands ─────────────────────────────────────────────────────────────
set_scope_change() {
  local val="${1:-false}"
  [[ "$val" == "true" || "$val" == "false" ]] || { echo "ERROR: set-scope-change expects true|false (got: $val)" >&2; return 3; }
  local tmp="$STATE_FILE.tmp"
  if grep -q 'scope_change_active:' "$STATE_FILE"; then
    sed "s|scope_change_active:.*|scope_change_active: $val|" "$STATE_FILE" > "$tmp"
  elif grep -q '^sprint:' "$STATE_FILE"; then
    awk -v v="$val" '
      /^sprint:/ { print; print "  scope_change_active: " v; next }
      { print }
    ' "$STATE_FILE" > "$tmp"
  else
    # No sprint section — append one.
    { cat "$STATE_FILE"; echo "sprint:"; echo "  scope_change_active: $val"; } > "$tmp"
  fi
  write_atomic "$tmp"
}

set_story_field() {
  local key="$1" field="$2" value="$3"
  [[ -n "$key" && -n "$field" ]] || { echo "ERROR: missing story key or field" >&2; return 3; }
  local tmp="$STATE_FILE.tmp"

  # Prefer yq when available — robust against regex metachars in story keys
  # (e.g. dots, hyphens, the slug suffix), preserves YAML structure exactly,
  # and survives indentation drift the awk fallback can't see. The path
  # 'sprint.stories."<key>".<field>' matches the canonical layout written by
  # /aped-epics. The caller wraps string values with literal quotes (so
  # awk's print-line preserves them); for yq we strip those and let yq
  # quote the value itself.
  if command -v yq >/dev/null 2>&1; then
    cp -f "$STATE_FILE" "$tmp"
    if [[ "$value" == "null" ]]; then
      yq eval -i ".sprint.stories.\"$key\".$field = null" "$tmp"
    else
      local raw="${value#\"}"
      raw="${raw%\"}"
      yq eval -i ".sprint.stories.\"$key\".$field = \"$raw\"" "$tmp"
    fi
    write_atomic "$tmp"
    return
  fi

  # awk fallback (yq absent). Escape regex metachars in the story key so a
  # key like "1-2-foo.bar" or "story[v2]" doesn't blow up the match.
  local key_re
  key_re=$(printf '%s' "$key" | sed 's/[][\\/.^$*+?(){}|]/\\&/g')
  awk -v k_re="$key_re" -v f="$field" -v v="$value" '
    function is_story_header(s) {
      # "<indent>WORD:" with optional trailing whitespace and nothing else
      return match(s, "^[[:space:]]+[A-Za-z0-9_-]+:[[:space:]]*$")
    }
    BEGIN { in_story = 0 }
    {
      line = $0
      if (match(line, "^([[:space:]]+)" k_re ":[[:space:]]*$")) {
        in_story = 1
        print line
        next
      }
      if (in_story && is_story_header(line)) {
        in_story = 0
      }
      if (in_story && match(line, "^([[:space:]]+)" f ":[[:space:]]")) {
        # Preserve the exact indentation of the original field line.
        split(line, arr, f ":")
        indent = arr[1]
        print indent f ": " v
        next
      }
      print line
    }
  ' "$STATE_FILE" > "$tmp"
  write_atomic "$tmp"
}

apply_patch() {
  local cmd="${1:-}"; shift || true
  case "$cmd" in
    set-scope-change)
      set_scope_change "${1:-false}"
      ;;
    set-story-status)
      [[ $# -eq 2 ]] || { echo "Usage: set-story-status <key> <status>" >&2; return 3; }
      set_story_field "$1" "status" "\"$2\""
      ;;
    set-story-worktree)
      [[ $# -eq 2 ]] || { echo "Usage: set-story-worktree <key> <path>" >&2; return 3; }
      set_story_field "$1" "worktree" "\"$2\""
      ;;
    clear-story-worktree)
      [[ $# -eq 1 ]] || { echo "Usage: clear-story-worktree <key>" >&2; return 3; }
      set_story_field "$1" "worktree" "null"
      ;;
    set-story-field)
      # Generic escape hatch — used by /aped-sprint for ticket_sync_status,
      # by /aped-lead for retry bookkeeping, etc. Keep specific commands
      # above for the hot-path mutations (better error messages, narrower
      # surface to misuse).
      [[ $# -eq 3 ]] || { echo "Usage: set-story-field <key> <field> <value>" >&2; return 3; }
      local raw_value="$3"
      if [[ "$raw_value" == "null" || "$raw_value" == "true" || "$raw_value" == "false" ]]; then
        set_story_field "$1" "$2" "$raw_value"
      else
        set_story_field "$1" "$2" "\"$raw_value\""
      fi
      ;;
    set-sprint-field)
      # Mutate a top-level field under sprint:. Used for umbrella_branch
      # bookkeeping by /aped-sprint at sprint start. yq path is preferred;
      # awk fallback is the same shape as set_story_field.
      [[ $# -eq 2 ]] || { echo "Usage: set-sprint-field <field> <value>" >&2; return 3; }
      local field="$1" value="$2" tmp="$STATE_FILE.tmp"
      if command -v yq >/dev/null 2>&1; then
        cp -f "$STATE_FILE" "$tmp"
        if [[ "$value" == "null" ]]; then
          yq eval -i ".sprint.$field = null" "$tmp"
        else
          local raw="${value#\"}"; raw="${raw%\"}"
          yq eval -i ".sprint.$field = \"$raw\"" "$tmp"
        fi
        write_atomic "$tmp"
      else
        # awk fallback: scan for "  $field:" inside the sprint: block.
        awk -v f="$field" -v v="$value" '
          BEGIN { in_sprint = 0; emitted = 0 }
          /^sprint:/ { in_sprint = 1; print; next }
          in_sprint && /^[a-zA-Z]/ && !/^sprint:/ { in_sprint = 0 }
          in_sprint && match($0, "^([[:space:]]+)" f ":[[:space:]]") {
            split($0, arr, f ":")
            print arr[1] f ": " v
            emitted = 1
            next
          }
          { print }
          END {
            if (!emitted) {
              # Append the field at the end if the sprint section never had it
              print "  " f ": " v
            }
          }
        ' "$STATE_FILE" > "$tmp"
        write_atomic "$tmp"
      fi
      ;;
    "")
      echo "ERROR: no command on stdin" >&2
      return 3
      ;;
    *)
      echo "ERROR: unknown command '$cmd' (known: set-scope-change | set-story-status | set-story-worktree | clear-story-worktree | set-story-field | set-sprint-field)" >&2
      return 3
      ;;
  esac
}

read_cmd() {
  local line
  IFS= read -r line || return 1
  # shellcheck disable=SC2086
  set -- $line
  apply_patch "$@"
}

acquire_lock || exit 1
read_cmd
