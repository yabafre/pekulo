#!/usr/bin/env bash
# APED log — append a structured event to the per-day sprint log.
#
# Usage: log.sh <event-type> [key=value ...]
# Example: log.sh worktree_created story_key=1-2 ticket=KON-83 worktree=/path
#
# Events are written as JSONL to {APED_DIR}/logs/sprint-YYYY-MM-DD.jsonl with
# a fixed envelope (ts, type, …) plus arbitrary key=value pairs. Log writes
# are line-atomic on POSIX as long as each JSONL line stays under PIPE_BUF
# (4 KiB on Linux/macOS) — true for all our events.
#
# **Best-effort**: if the log dir cannot be created or the write fails, emit
# a WARN to stderr and exit 0. Observability must never break the caller —
# /aped-sprint, /aped-ship et al. would silently fail otherwise.

set -uo pipefail

EVENT_TYPE="${1:-}"
shift || true
[[ -n "$EVENT_TYPE" ]] || { echo "log.sh: missing event type" >&2; exit 0; }

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="$PROJECT_ROOT/.aped/logs"
DAY=$(date -u +%Y-%m-%d)
LOG_FILE="$LOG_DIR/sprint-${DAY}.jsonl"

mkdir -p "$LOG_DIR" 2>/dev/null || { echo "WARN: cannot create $LOG_DIR — skipping log" >&2; exit 0; }

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

build_json() {
  local ts="$(now_iso)" type="$1"; shift
  if command -v jq >/dev/null 2>&1; then
    local -a jq_args=(-c -n --arg ts "$ts" --arg type "$type")
    local fields="{ts:\$ts, type:\$type"
    local kv k
    for kv in "$@"; do
      k="${kv%%=*}"
      jq_args+=(--arg "$k" "${kv#*=}")
      fields+=", $k:\$$k"
    done
    fields+="}"
    jq "${jq_args[@]}" "$fields"
  else
    # Fallback: minimal escape (\ and "). Acceptable for local, trusted
    # values; logs are not meant to be processed by untrusted parsers.
    local out="{\"ts\":\"$ts\",\"type\":\"$type\""
    local kv k v esc
    for kv in "$@"; do
      k="${kv%%=*}"
      v="${kv#*=}"
      esc=$(printf '%s' "$v" | sed 's/\\/\\\\/g; s/"/\\"/g')
      out+=",\"$k\":\"$esc\""
    done
    out+="}"
    printf '%s' "$out"
  fi
}

JSON=$(build_json "$EVENT_TYPE" "$@")
printf '%s\n' "$JSON" >> "$LOG_FILE" 2>/dev/null || {
  echo "WARN: failed to append to $LOG_FILE" >&2
  exit 0
}
