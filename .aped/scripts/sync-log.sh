#!/usr/bin/env bash
# APED sync-log — emit structured JSON audit logs for ticket-system
# operations performed by /aped-epics, /aped-from-ticket, /aped-ship, and
# /aped-course. The single helper for all sync-time audit emission so
# skills don't hand-roll JSON and audit shape stays uniform across
# providers (Linear, GitHub, GitLab, Jira).
#
# Usage:
#   sync-log.sh start <provider>                     → prints log path on stdout
#   sync-log.sh phase <log-path> <name> <status> [json-fragment]
#   sync-log.sh record <log-path> <key> <value>
#   sync-log.sh meta <log-path> <key> <json-value>   → top-level key write (peer
#                                                      to phases/totals; for
#                                                      course-correction
#                                                      extensions like trigger,
#                                                      scope, source_pr, ...)
#   sync-log.sh end <log-path>                       → prints final path
#   sync-log.sh prune                                → retention sweep (driven by
#                                                      `sync_logs.retention` config)
#
# Provider is free-form (no enum) so future providers don't need a CLI bump.
# Status enum (phase): complete | skipped | error.
# JSON manipulation prefers `jq` (already used by other APED scripts);
# falls back to `node -e` because APED itself ships as a Node CLI so node
# is always present where create-aped runs. If neither is available, exit 2
# with an explicit dependency error.
#
# Atomic writes: every mutation goes through mktemp + mv (atomic on POSIX
# within the same filesystem). Concurrent calls on the same log file are
# serialised by a per-log mkdir lock at ${a}/.sync-log.<basename>.lock with
# stale-lock auto-recovery (>STALE_LOCK_SECONDS old → reclaimed with warn).
# Pattern mirrors sync-state.sh exactly so reasoning about both is uniform.
#
# Disabled: when `sync_logs.enabled: false` in config.yaml, every
# subcommand exits 0 silently with empty stdout. The kill switch is read
# the same way lint-placeholders.sh reads its kill switch (anchored awk
# block scan, no yq dependency).

set -euo pipefail

STALE_LOCK_SECONDS=${APED_STALE_LOCK_SECONDS:-300}
LOCK_TIMEOUT_SECONDS=${APED_LOCK_TIMEOUT_SECONDS:-5}

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
APED_DIR_REL=".aped"
APED_DIR_ABS="$PROJECT_ROOT/$APED_DIR_REL"

# ── Config: enabled + dir ────────────────────────────────────────────────
CONFIG_FILE=""
for candidate in "$APED_DIR_ABS/config.yaml" "$PROJECT_ROOT/.aped/config.yaml"; do
  if [[ -f "$candidate" ]]; then CONFIG_FILE="$candidate"; break; fi
done

read_sync_logs_field() {
  local field="$1" default="$2"
  [[ -n "$CONFIG_FILE" ]] || { echo "$default"; return; }
  awk -v f="$field" '
    /^sync_logs:[[:space:]]*$/ { in_block=1; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block {
      pat = "^  " f ":"
      if ($0 ~ pat) {
        sub(pat "[[:space:]]*", "")
        sub(/[ \t]*#.*$/, "")
        gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, "")
        print
        exit
      }
    }
  ' "$CONFIG_FILE" 2>/dev/null || echo "$default"
}

# Read a field under sync_logs.retention.<field>. Two-level state machine
# (in sync_logs block, then in retention sub-block). Returns default when
# the retention block is absent or commented out (the scaffolded default).
read_sync_logs_retention_field() {
  local field="$1" default="$2"
  [[ -n "$CONFIG_FILE" ]] || { echo "$default"; return; }
  awk -v f="$field" '
    /^sync_logs:[[:space:]]*$/ { in_block=1; in_retention=0; next }
    in_block && /^[^[:space:]]/ { in_block=0; in_retention=0 }
    in_block && /^  retention:[[:space:]]*$/ { in_retention=1; next }
    in_retention && /^  [^[:space:]]/ { in_retention=0 }
    in_retention {
      pat = "^    " f ":"
      if ($0 ~ pat) {
        sub(pat "[[:space:]]*", "")
        sub(/[ \t]*#.*$/, "")
        gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, "")
        print
        exit
      }
    }
  ' "$CONFIG_FILE" 2>/dev/null || echo "$default"
}

ENABLED=$(read_sync_logs_field "enabled" "true")
[[ -z "$ENABLED" ]] && ENABLED="true"
if [[ "$ENABLED" == "false" ]]; then
  # Silent no-op for every subcommand. No stdout, no stderr, exit 0.
  exit 0
fi

SYNC_LOG_DIR=$(read_sync_logs_field "dir" "docs/sync-logs/")
[[ -z "$SYNC_LOG_DIR" ]] && SYNC_LOG_DIR="docs/sync-logs/"
# Strip trailing slash for join consistency
SYNC_LOG_DIR="${SYNC_LOG_DIR%/}"

# ── JSON tool detection (jq preferred, node fallback) ────────────────────
JSON_TOOL=""
if command -v jq >/dev/null 2>&1; then
  JSON_TOOL="jq"
elif command -v node >/dev/null 2>&1; then
  JSON_TOOL="node"
else
  echo "ERROR: sync-log requires either \`jq\` or \`node\` to manipulate JSON; neither was found on PATH. Install jq (recommended) or ensure Node.js is available." >&2
  exit 2
fi

# Validate that a string parses as JSON. Returns 0 if valid, 1 otherwise.
json_validate() {
  local input="$1"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    printf '%s' "$input" | jq -e . >/dev/null 2>&1
  else
    printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{JSON.parse(s);process.exit(0)}catch(e){process.exit(1)}})' >/dev/null 2>&1
  fi
}

# Pretty-print JSON from stdin to stdout. Used to format files on write.
json_pretty() {
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq .
  else
    node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+"\n")})'
  fi
}

# ── Lock helpers (mirror sync-state.sh) ──────────────────────────────────
stat_mtime() {
  local target="$1"
  local now mtime
  now=$(date +%s)
  mtime=$(stat -c %Y "$target" 2>/dev/null || stat -f %m "$target" 2>/dev/null || echo "$now")
  echo $((now - mtime))
}

lock_age_seconds() {
  local stamp="$1/stamp"
  [[ -f "$stamp" ]] || { stat_mtime "$1"; return; }
  stat_mtime "$stamp"
}

reclaim_stale_lock_if_any() {
  local lock_dir="$1"
  [[ -d "$lock_dir" ]] || return 0
  local age
  age=$(lock_age_seconds "$lock_dir")
  if (( age > STALE_LOCK_SECONDS )); then
    echo "WARN: stale sync-log lock $lock_dir (age ${age}s > ${STALE_LOCK_SECONDS}s) — previous run likely crashed. Reclaiming." >&2
    rm -rf "$lock_dir"
  fi
}

acquire_lock() {
  local lock_dir="$1"
  local waited=0
  mkdir -p "$(dirname "$lock_dir")"
  reclaim_stale_lock_if_any "$lock_dir"
  until mkdir "$lock_dir" 2>/dev/null; do
    (( waited >= LOCK_TIMEOUT_SECONDS * 10 )) && {
      echo "ERROR: could not acquire $lock_dir within ${LOCK_TIMEOUT_SECONDS}s. Another sync-log writer may be running. If stuck, remove the directory manually." >&2
      return 1
    }
    sleep 0.1
    waited=$((waited + 1))
  done
  date +%s > "$lock_dir/stamp"
  # shellcheck disable=SC2064
  trap "rm -rf '$lock_dir' 2>/dev/null || true" EXIT INT TERM
}

lock_dir_for_log() {
  local log_path="$1"
  local base
  base=$(basename "$log_path")
  echo "$APED_DIR_ABS/.sync-log.$base.lock"
}

# Write JSON content atomically to $1. Creates parent dir if needed.
write_atomic_json() {
  local target="$1" content="$2"
  mkdir -p "$(dirname "$target")"
  local tmp
  tmp=$(mktemp "$(dirname "$target")/.sync-log.XXXXXX")
  printf '%s' "$content" | json_pretty > "$tmp"
  mv -f "$tmp" "$target"
}

# Read existing log JSON to stdout (compact form). Errors out if not parseable.
read_log_json() {
  local log_path="$1"
  [[ -f "$log_path" ]] || { echo "ERROR: sync-log file not found: $log_path" >&2; return 1; }
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -c . "$log_path"
  else
    node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))))' "$log_path"
  fi
}

# Merge a JSON value into an existing log file at a given top-level path.
# $1 = log file, $2 = jq path expression (e.g. .phases.auth_check),
# $3 = JSON value to assign at that path.
set_json_path() {
  local log_path="$1" jq_path="$2" value_json="$3"
  local current new
  current=$(read_log_json "$log_path") || return 1
  if [[ "$JSON_TOOL" == "jq" ]]; then
    new=$(printf '%s' "$current" | jq --argjson v "$value_json" "$jq_path = \$v")
  else
    new=$(node -e '
      const cur = JSON.parse(process.argv[1]);
      const path = process.argv[2];
      const val = JSON.parse(process.argv[3]);
      const parts = path.replace(/^\./,"").split(".").filter(Boolean);
      let o = cur;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof o[parts[i]] !== "object" || o[parts[i]] === null) o[parts[i]] = {};
        o = o[parts[i]];
      }
      o[parts[parts.length-1]] = val;
      process.stdout.write(JSON.stringify(cur));
    ' "$current" "$jq_path" "$value_json")
  fi
  write_atomic_json "$log_path" "$new"
}

# ── Retention pruning ────────────────────────────────────────────────────
# Provider-scoped, mtime-ordered prune. Called from cmd_end after the final
# write, and also re-used by the `aped-method sync-logs prune` CLI subcommand
# (PRUNE_DRY_RUN=1 makes it list-only; PRUNE_PROVIDER_FILTER scopes a one-shot).
prune_old_logs() {
  local provider="$1"
  local mode keep_last_n
  mode=$(read_sync_logs_retention_field "mode" "none")
  # awk reader returns empty string when the block is absent (fall-through).
  [[ -z "$mode" ]] && mode="none"
  [[ "$mode" == "keep_last_n" ]] || return 0

  keep_last_n=$(read_sync_logs_retention_field "keep_last_n" "50")
  [[ -z "$keep_last_n" ]] && keep_last_n=50
  [[ "$keep_last_n" =~ ^[0-9]+$ ]] || keep_last_n=50

  local sync_log_dir_abs="$PROJECT_ROOT/$SYNC_LOG_DIR"
  [[ -d "$sync_log_dir_abs" ]] || return 0

  # List provider logs into an array (NUL-separated to handle weird paths).
  local -a all_logs=()
  while IFS= read -r -d '' f; do
    all_logs+=("$f")
  done < <(find "$sync_log_dir_abs" -maxdepth 1 -type f -name "${provider}-sync-*.json" -print0 2>/dev/null)

  local total=${#all_logs[@]}
  (( total > keep_last_n )) || return 0

  # Sort by mtime descending (newest first).
  local -a sorted=()
  while IFS= read -r line; do
    sorted+=("${line#* }")
  done < <(
    for f in "${all_logs[@]}"; do
      local m
      m=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
      printf '%s %s\n' "$m" "$f"
    done | sort -rn
  )

  local i=0 n_pruned=0
  for f in "${sorted[@]}"; do
    if (( i >= keep_last_n )); then
      if [[ "${PRUNE_DRY_RUN:-0}" == "1" ]]; then
        printf 'would-prune %s\n' "$f"
        n_pruned=$((n_pruned + 1))
      else
        # rm -f tolerates a vanished file (concurrent prune or external delete).
        if rm -f "$f" 2>/dev/null; then
          n_pruned=$((n_pruned + 1))
        fi
      fi
    fi
    i=$((i + 1))
  done

  if (( n_pruned > 0 )) && [[ "${PRUNE_QUIET:-0}" != "1" ]]; then
    if [[ "${PRUNE_DRY_RUN:-0}" == "1" ]]; then
      echo "sync-log: would prune $n_pruned log(s) (keep $keep_last_n most recent for provider '$provider')" >&2
    else
      echo "sync-log: pruned $n_pruned log(s) (kept $keep_last_n most recent for provider '$provider')" >&2
    fi
  fi
}

# Discover providers present in the sync-log dir (parsed from filenames).
# Used by the prune CLI subcommand when `--provider` is not specified.
list_providers_in_dir() {
  local sync_log_dir_abs="$PROJECT_ROOT/$SYNC_LOG_DIR"
  [[ -d "$sync_log_dir_abs" ]] || return 0
  find "$sync_log_dir_abs" -maxdepth 1 -type f -name "*-sync-*.json" 2>/dev/null \
    | sed -E 's|.*/||; s|-sync-.*||' \
    | sort -u
}

# CLI entrypoint reused from src/subcommands.js for `aped-method sync-logs prune`.
# Walks all providers (or one if PRUNE_PROVIDER_FILTER is set) under retention.
cmd_prune() {
  local mode
  mode=$(read_sync_logs_retention_field "mode" "none")
  [[ -z "$mode" ]] && mode="none"
  if [[ "$mode" == "none" ]]; then
    echo "retention disabled in sync_logs.retention.mode (set to 'keep_last_n' in $(basename "$CONFIG_FILE" 2>/dev/null || echo "config.yaml") to enable). Nothing to prune."
    return 0
  fi

  local providers
  if [[ -n "${PRUNE_PROVIDER_FILTER:-}" ]]; then
    providers="$PRUNE_PROVIDER_FILTER"
  else
    providers=$(list_providers_in_dir)
  fi
  if [[ -z "$providers" ]]; then
    echo "no provider logs found under $SYNC_LOG_DIR — nothing to prune."
    return 0
  fi
  while IFS= read -r p; do
    [[ -n "$p" ]] || continue
    prune_old_logs "$p"
  done <<< "$providers"
}

# ── Subcommands ──────────────────────────────────────────────────────────
cmd_start() {
  local provider="${1:-}"
  [[ -n "$provider" ]] || { echo "Usage: sync-log.sh start <provider>" >&2; exit 1; }
  local iso_file iso_full sync_id log_path operator dv
  # Filename-safe ISO (colons → hyphens). Inside the JSON we keep canonical
  # ISO with colons — only the on-disk filename needs the substitution.
  # Seconds-granularity in filename to avoid two starts in the same minute
  # silently clobbering each other.
  iso_file=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  iso_full=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  sync_id="${provider}-sync-${iso_file}"
  log_path="$PROJECT_ROOT/$SYNC_LOG_DIR/${sync_id}.json"
  operator=$(git config user.email 2>/dev/null || echo "unknown")
  dv="${APED_SYNC_LOG_DIRECTIVE_VERSION:-}"

  local doc
  if [[ "$JSON_TOOL" == "jq" ]]; then
    doc=$(jq -n \
      --arg sid "$sync_id" \
      --arg started "$iso_full" \
      --arg provider "$provider" \
      --arg operator "$operator" \
      --arg dv "$dv" \
      '{sync_id:$sid, started_at:$started, provider:$provider, operator:$operator, directive_version: (if $dv == "" then null else $dv end), phases:{}, totals:{}}')
  else
    doc=$(node -e '
      const [sid, started, provider, operator, dv] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({
        sync_id: sid, started_at: started, provider, operator,
        directive_version: dv === "" ? null : dv,
        phases: {}, totals: {}
      }));
    ' "$sync_id" "$iso_full" "$provider" "$operator" "$dv")
  fi

  write_atomic_json "$log_path" "$doc"
  printf '%s\n' "$log_path"
}

cmd_phase() {
  local log="${1:-}" name="${2:-}" status="${3:-}" fragment="${4:-}"
  [[ -n "$log" && -n "$name" && -n "$status" ]] || {
    echo "Usage: sync-log.sh phase <log-path> <name> <status> [json-fragment]" >&2
    exit 1
  }
  # Restrict phase names to a jq-safe identifier shape. The current
  # set_json_path uses jq path-expression syntax (`.phases.<name>`) which
  # parses hyphens as subtraction and breaks on `:`, leading digits, etc.
  # Snake_case is the convention across all wired skills (auth_check,
  # ticket_fetch, branch_close, etc.); reject anything else with a clear
  # error rather than silently producing divergent jq-vs-node output.
  if ! [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "ERROR: phase name '$name' must match [A-Za-z_][A-Za-z0-9_]* (snake_case). Hyphens, colons, and leading digits are not safe under the jq backend." >&2
    exit 1
  fi
  case "$status" in
    complete|skipped|error) ;;
    *)
      echo "ERROR: invalid status '$status' (expected: complete | skipped | error)" >&2
      exit 1
      ;;
  esac

  local fragment_json="{}"
  if [[ -n "$fragment" ]]; then
    if ! json_validate "$fragment"; then
      echo "ERROR: phase fragment is not valid JSON: $fragment" >&2
      exit 1
    fi
    fragment_json="$fragment"
  fi

  local lock_dir
  lock_dir=$(lock_dir_for_log "$log")
  acquire_lock "$lock_dir" || exit 1

  # Compose new phase object: {status, ...fragment}. Fragment keys may
  # override status if the caller really wants — we only seed the default.
  local phase_obj
  if [[ "$JSON_TOOL" == "jq" ]]; then
    phase_obj=$(jq -n --arg s "$status" --argjson f "$fragment_json" '{status:$s} + $f')
  else
    phase_obj=$(node -e '
      const status = process.argv[1];
      const frag = JSON.parse(process.argv[2]);
      process.stdout.write(JSON.stringify(Object.assign({status}, frag)));
    ' "$status" "$fragment_json")
  fi

  set_json_path "$log" ".phases.$name" "$phase_obj"
}

cmd_record() {
  local log="${1:-}" key="${2:-}" value="${3:-}"
  [[ -n "$log" && -n "$key" && -n "$value" ]] || {
    echo "Usage: sync-log.sh record <log-path> <key> <value>" >&2
    exit 1
  }
  if ! [[ "$value" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
    echo "ERROR: record value must be numeric (got: $value)" >&2
    exit 1
  fi

  local lock_dir
  lock_dir=$(lock_dir_for_log "$log")
  acquire_lock "$lock_dir" || exit 1

  local current new
  current=$(read_log_json "$log") || exit 1
  if [[ "$JSON_TOOL" == "jq" ]]; then
    new=$(printf '%s' "$current" | jq --arg k "$key" --argjson v "$value" '.totals[$k] = ((.totals[$k] // 0) + $v)')
  else
    new=$(node -e '
      const cur = JSON.parse(process.argv[1]);
      const key = process.argv[2];
      const v = Number(process.argv[3]);
      cur.totals = cur.totals || {};
      cur.totals[key] = (cur.totals[key] || 0) + v;
      process.stdout.write(JSON.stringify(cur));
    ' "$current" "$key" "$value")
  fi
  write_atomic_json "$log" "$new"
}

cmd_meta() {
  local log="${1:-}" key="${2:-}" value="${3:-}"
  [[ -n "$log" && -n "$key" && -n "$value" ]] || {
    echo "Usage: sync-log.sh meta <log-path> <key> <json-value>" >&2
    exit 1
  }
  # Same jq-safe identifier shape as cmd_phase — `set_json_path` builds a jq
  # path expression `.<key>`, which only parses cleanly with snake_case.
  if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "ERROR: meta key '$key' must match [A-Za-z_][A-Za-z0-9_]* (snake_case)." >&2
    exit 1
  fi
  # Reserved top-level keys are written by the helper itself (start/phase/record/end).
  # Refusing to overwrite them keeps the audit trail's spine intact.
  case "$key" in
    sync_id|provider|started_at|ended_at|operator|directive_version|phases|totals)
      echo "ERROR: meta key '$key' is reserved by the sync-log helper. Use a different name." >&2
      exit 1
      ;;
  esac
  if ! json_validate "$value"; then
    echo "ERROR: meta value is not valid JSON: $value" >&2
    exit 1
  fi

  local lock_dir
  lock_dir=$(lock_dir_for_log "$log")
  acquire_lock "$lock_dir" || exit 1

  set_json_path "$log" ".$key" "$value"
}

cmd_end() {
  local log="${1:-}"
  [[ -n "$log" ]] || { echo "Usage: sync-log.sh end <log-path>" >&2; exit 1; }

  local lock_dir
  lock_dir=$(lock_dir_for_log "$log")
  acquire_lock "$lock_dir" || exit 1

  local iso_full
  iso_full=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  local current new
  current=$(read_log_json "$log") || exit 1
  if [[ "$JSON_TOOL" == "jq" ]]; then
    new=$(printf '%s' "$current" | jq --arg t "$iso_full" '.ended_at = $t')
  else
    new=$(node -e '
      const cur = JSON.parse(process.argv[1]);
      cur.ended_at = process.argv[2];
      process.stdout.write(JSON.stringify(cur));
    ' "$current" "$iso_full")
  fi
  if ! json_validate "$new"; then
    echo "ERROR: final sync-log JSON failed to validate — refusing to write" >&2
    exit 1
  fi
  write_atomic_json "$log" "$new"

  # Retention prune. Pulls provider out of the just-written JSON so we don't
  # accidentally touch other providers' logs. Best-effort — failure to prune
  # never fails the end command (the audit trail itself is already written).
  local provider_for_prune=""
  if [[ "$JSON_TOOL" == "jq" ]]; then
    provider_for_prune=$(printf '%s' "$new" | jq -r '.provider // empty' 2>/dev/null || true)
  else
    provider_for_prune=$(printf '%s' "$new" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const d=JSON.parse(s);process.stdout.write(d.provider||"")}catch(e){}})' 2>/dev/null || true)
  fi
  if [[ -n "$provider_for_prune" ]]; then
    prune_old_logs "$provider_for_prune" || true
  fi

  printf '%s\n' "$log"
}

# ── Dispatch ─────────────────────────────────────────────────────────────
sub="${1:-}"
shift || true
case "$sub" in
  start)  cmd_start  "$@" ;;
  phase)  cmd_phase  "$@" ;;
  record) cmd_record "$@" ;;
  meta)   cmd_meta   "$@" ;;
  end)    cmd_end    "$@" ;;
  prune)  cmd_prune  "$@" ;;
  "")
    echo "Usage: sync-log.sh {start|phase|record|meta|end|prune} ..." >&2
    exit 3
    ;;
  *)
    echo "ERROR: unknown sync-log subcommand '$sub' (expected: start | phase | record | meta | end | prune)" >&2
    exit 3
    ;;
esac
