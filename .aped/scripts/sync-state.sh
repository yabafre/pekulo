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
#   mark-story-done        <key>          # 4.1.0 — atomic flip + runtime trim
#   append-correction      <json-blob>    # 4.1.0 — append to corrections file
#                                          # (schema v2; mirrors count in state)
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

# 4.1.0 — mark a story done in a single atomic write.
# Sets status=done, completed_at=<ISO UTC>, and DELETES the runtime fields
# (worktree, started_at, dispatched_at, ticket_sync_status). Permanent
# fields like merged_into_umbrella, ticket, depends_on, and any user-custom
# field are preserved (blocklist approach — we only touch what we know is
# transient). Validates that the story key exists before mutating.
mark_story_done() {
  local key="$1"
  [[ -n "$key" ]] || { echo "ERROR: mark-story-done requires a story key" >&2; return 3; }
  # 4.1.2 — yq is hard-required. The previous awk fallback claimed to set
  # status + completed_at, but `set_story_field`'s awk path can only REWRITE
  # existing fields, not INSERT new ones. `completed_at` is the field being
  # ADDED, so it was silently dropped while status flipped — leaving the
  # audit trail incomplete. Refusing loudly matches the behaviour of
  # append_correction (4.1.0) and is the contract this skill needs.
  if ! command -v yq >/dev/null 2>&1; then
    echo "ERROR: mark-story-done requires \`yq\` for atomic flip + runtime-fields trim. Install yq (\`brew install yq\` or \`npm i -g yq\`) and retry." >&2
    return 3
  fi
  local tmp="$STATE_FILE.tmp"
  local completed_at
  completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  cp -f "$STATE_FILE" "$tmp"
  # Existence check via yq — non-existent path returns "null" (or empty).
  local exists
  exists=$(yq eval ".sprint.stories.\"$key\" // \"\"" "$tmp" 2>/dev/null || echo "")
  if [[ -z "$exists" || "$exists" == "null" ]]; then
    rm -f "$tmp" 2>/dev/null || true
    echo "ERROR: story '$key' not found in sprint.stories" >&2
    return 3
  fi
  # Single yq invocation: set 2 fields, delete 4. Atomic via write_atomic.
  yq eval -i "
    .sprint.stories.\"$key\".status = \"done\" |
    .sprint.stories.\"$key\".completed_at = \"$completed_at\" |
    del(.sprint.stories.\"$key\".worktree) |
    del(.sprint.stories.\"$key\".started_at) |
    del(.sprint.stories.\"$key\".dispatched_at) |
    del(.sprint.stories.\"$key\".ticket_sync_status)
  " "$tmp"
  write_atomic "$tmp"
}

# 4.1.0 — Append a correction entry to the corrections file referenced by
# `corrections_pointer` in state.yaml. The pointer is single source of truth
# (config.yaml exposes `state.corrections_path` as the install-time default;
# state.yaml's pointer wins at runtime so a config edit can't desync from
# already-written corrections). Updates `corrections_count` in state.yaml
# in the same call so reader skills can do a single-file lookup.
#
# Required JSON keys: date, type, reason, artifacts_updated, affected_stories.
# Anything beyond is preserved as-is (forward-compat with project extensions).
append_correction() {
  local json="$1"
  [[ -n "$json" ]] || { echo "ERROR: append-correction requires a JSON blob" >&2; return 3; }
  if ! command -v yq >/dev/null 2>&1; then
    echo "ERROR: append-correction requires \`yq\` to manipulate YAML structurally. Install yq and retry." >&2
    return 3
  fi
  # 4.1.2 — schema-version guard. append-correction is the v2 helper. On a
  # v1 scaffold (3.x line, never run through migrate-state.sh), the legacy
  # top-level `corrections:` array is the source of truth — writing
  # corrections_pointer/corrections_count alongside it would orphan the
  # legacy entries and produce a wrong count. Refuse loudly with a hint.
  local schema_v
  schema_v=$(yq eval '.schema_version // 1' "$STATE_FILE" 2>/dev/null || echo 1)
  schema_v=${schema_v%.0}
  if [[ "$schema_v" != "2" ]]; then
    echo "ERROR: append-correction requires state.yaml schema v2 (current: v$schema_v). Run \`bash $(dirname "$0")/migrate-state.sh\` to migrate first, or — on legacy 3.x scaffolds — append directly to the top-level \`corrections:\` array in state.yaml until you upgrade." >&2
    return 3
  fi
  # Validate JSON shape via node (always available — APED ships as a Node CLI).
  local check
  check=$(node -e '
    try {
      const d = JSON.parse(process.argv[1]);
      const req = ["date","type","reason","artifacts_updated","affected_stories"];
      for (const k of req) {
        if (!(k in d)) { process.stdout.write("missing:" + k); process.exit(0); }
      }
      process.stdout.write("ok");
    } catch (e) { process.stdout.write("invalid-json"); }
  ' "$json" 2>/dev/null || echo "node-failed")
  case "$check" in
    ok)
      ;;
    invalid-json)
      echo "ERROR: append-correction blob is not valid JSON: $json" >&2
      return 3
      ;;
    missing:*)
      local k="${check#missing:}"
      echo "ERROR: append-correction missing required key '$k'. Required: date, type, reason, artifacts_updated, affected_stories." >&2
      return 3
      ;;
    *)
      # 4.1.2 — explicit handler for node-failed and any future signal that
      # isn't one of the expected forms. Previously this fell through silently
      # and the unvalidated blob was passed to yq. Refuse loudly so a broken
      # node setup or unexpected validator output never lets garbage through.
      echo "ERROR: append-correction validator returned '$check' — node may be missing from PATH or the validator script crashed. Refusing to write." >&2
      return 3
      ;;
  esac

  # Resolve corrections file: state.yaml pointer wins, else config default.
  local corrections_path
  corrections_path=$(yq eval '.corrections_pointer // ""' "$STATE_FILE" 2>/dev/null || echo "")
  if [[ -z "$corrections_path" || "$corrections_path" == "null" ]]; then
    # Fallback to config.yaml `state.corrections_path`, else a hardcoded default.
    local cfg=""
    for candidate in "$PROJECT_ROOT/.aped/config.yaml" "$PROJECT_ROOT/.aped/config.yaml"; do
      if [[ -f "$candidate" ]]; then cfg="$candidate"; break; fi
    done
    if [[ -n "$cfg" ]]; then
      corrections_path=$(awk '
        /^state:[[:space:]]*$/ { in_block=1; next }
        in_block && /^[^[:space:]]/ { in_block=0 }
        in_block && /^  corrections_path:/ {
          sub(/^  corrections_path:[[:space:]]*/, "")
          sub(/[ \t]*#.*$/, "")
          gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, "")
          print
          exit
        }
      ' "$cfg" 2>/dev/null)
    fi
    [[ -z "$corrections_path" ]] && corrections_path="docs/state-corrections.yaml"
  fi

  local corrections_abs="$PROJECT_ROOT/$corrections_path"
  mkdir -p "$(dirname "$corrections_abs")"
  if [[ ! -f "$corrections_abs" ]]; then
    # Lazy-init the file on first append (covers schema-v1 scaffolds that
    # never went through migrate-state.sh — e.g. someone calling this helper
    # directly during dev). `yq` will create the array on the first write.
    printf 'corrections: []\n' > "$corrections_abs"
  fi

  # Append using yq's `+=` over an array. The blob is JSON; yq accepts JSON
  # via `from_yaml` after we feed it as a string.
  local corrections_tmp
  corrections_tmp=$(mktemp "$(dirname "$corrections_abs")/.state-corrections.XXXXXX")
  cp -f "$corrections_abs" "$corrections_tmp"
  yq eval -i ".corrections += [$json]" "$corrections_tmp"
  if ! yq eval 'true' "$corrections_tmp" >/dev/null 2>&1; then
    echo "ERROR: append-correction produced invalid YAML — refusing to write. Original $corrections_abs untouched." >&2
    rm -f "$corrections_tmp" 2>/dev/null || true
    return 1
  fi
  mv -f "$corrections_tmp" "$corrections_abs"

  # Mirror count in state.yaml. Read fresh from the corrections file we
  # just wrote so a re-entrant caller sees the canonical length.
  local count
  count=$(yq eval '.corrections | length' "$corrections_abs" 2>/dev/null || echo 0)
  local state_tmp="$STATE_FILE.tmp"
  cp -f "$STATE_FILE" "$state_tmp"
  yq eval -i ".corrections_count = $count" "$state_tmp"
  # Also write the pointer so a fresh-on-v1-then-call scenario (no migration
  # yet) leaves state.yaml self-consistent for subsequent reads.
  yq eval -i ".corrections_pointer = \"$corrections_path\"" "$state_tmp"
  write_atomic "$state_tmp"
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
    mark-story-done)
      [[ $# -eq 1 ]] || { echo "Usage: mark-story-done <key>" >&2; return 3; }
      mark_story_done "$1"
      ;;
    append-correction)
      # 4.1.2 — read_cmd hands the JSON blob in as a single verbatim
      # argument (no word-split, no globbing). Earlier versions used
      # `append_correction "$*"` which collapsed multi-space sequences in
      # JSON string values; the verbatim path preserves them.
      [[ -n "${1:-}" ]] || { echo "Usage: append-correction <json-blob>" >&2; return 3; }
      append_correction "$1"
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
      echo "ERROR: unknown command '$cmd' (known: set-scope-change | set-story-status | set-story-worktree | clear-story-worktree | mark-story-done | append-correction | set-story-field | set-sprint-field)" >&2
      return 3
      ;;
  esac
}

read_cmd() {
  local line cmd rest
  IFS= read -r line || return 1
  # 4.1.2 — split off the first word as the command, take the remainder
  # verbatim for commands that need it (e.g. append-correction, where the
  # rest is a JSON blob whose internal whitespace and `*`/`?`/`[` characters
  # must NOT be word-split or pathname-expanded). For the legacy commands
  # (set-story-status, mark-story-done, etc.) we keep the historical
  # word-split behaviour, but with globbing disabled (`set -f`) so a story
  # key that happens to contain shell metacharacters never expands against
  # the working directory.
  cmd="${line%% *}"
  rest="${line#"$cmd"}"
  rest="${rest# }"
  case "$cmd" in
    append-correction)
      apply_patch "$cmd" "$rest"
      ;;
    *)
      set -f
      # shellcheck disable=SC2086
      set -- $line
      set +f
      apply_patch "$@"
      ;;
  esac
}

acquire_lock || exit 1
read_cmd
