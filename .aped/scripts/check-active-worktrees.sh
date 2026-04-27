#!/usr/bin/env bash
# APED check-active-worktrees — reconcile state.yaml against disk reality.
#
# /aped-sprint computes parallel-capacity from state.yaml only. If the user
# manually rm-rf'd a worktree, capacity is wrong and dispatch is needlessly
# blocked. This script is the read-side reconciliation: it lists every
# story registered as active (in-progress / review-queued / review) and
# verifies its worktree path still exists on disk.
#
# Output (text default, --format json available): one line per story.
# Exit:
#   0 → all worktrees present (or none registered)
#   1 → one or more missing (state out of sync — /aped-lead can fix)
#   3 → state.yaml unreadable

set -uo pipefail

FORMAT="text"
if [[ "${1:-}" == "--format" ]]; then
  FORMAT="${2:-text}"
fi

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
[[ -f "$STATE_FILE" ]] || { echo "ERROR: $STATE_FILE not found" >&2; exit 3; }

declare -a ENTRIES=()

emit_if_active() {
  local key="$1" status="$2" worktree="$3"
  [[ -z "$key" ]] && return
  [[ -z "$worktree" || "$worktree" == "null" ]] && return
  case "$status" in
    in-progress|review-queued|review) ;;
    *) return ;;
  esac
  if [[ -d "$worktree" ]]; then
    ENTRIES+=("$key|$status|$worktree|present")
  else
    ENTRIES+=("$key|$status|$worktree|missing")
  fi
}

if command -v yq >/dev/null 2>&1; then
  while IFS='|' read -r key status worktree; do
    emit_if_active "$key" "$status" "$worktree"
  done < <(yq eval '.sprint.stories | to_entries | .[] | [.key, (.value.status // ""), (.value.worktree // "null")] | join("|")' "$STATE_FILE" 2>/dev/null || true)
else
  # awk fallback — scoped to sprint.stories so we don't accidentally treat
  # other top-level maps as story entries. Story headers are 4-space indent
  # bare keys; status/worktree fields are 6-space indent.
  while IFS='|' read -r key status worktree; do
    emit_if_active "$key" "$status" "$worktree"
  done < <(awk '
    /^sprint:/ { in_sprint=1; next }
    in_sprint && /^[a-zA-Z]/ { in_sprint=0 }
    in_sprint && /^  stories:/ { in_stories=1; next }
    in_stories && /^  [a-zA-Z]/ { in_stories=0 }
    in_stories && /^    [a-zA-Z0-9_-]+:[[:space:]]*$/ {
      if (key != "") print key "|" status "|" worktree
      k=$0; sub(/:[[:space:]]*$/, "", k); sub(/^[[:space:]]+/, "", k)
      key=k; status=""; worktree="null"
      next
    }
    in_stories && /^      status:/ {
      v=$0; sub(/^[^:]*:[[:space:]]*/, "", v); gsub(/"/, "", v); gsub(/[[:space:]]+$/, "", v)
      status=v; next
    }
    in_stories && /^      worktree:/ {
      v=$0; sub(/^[^:]*:[[:space:]]*/, "", v); gsub(/"/, "", v); gsub(/[[:space:]]+$/, "", v)
      worktree=v; next
    }
    END { if (key != "") print key "|" status "|" worktree }
  ' "$STATE_FILE")
fi

missing=0
# bash quirk: ${ENTRIES[@]} on an empty array under `set -u` raises
# "unbound variable" in bash <5.1. ${ENTRIES[@]+"${ENTRIES[@]}"} expands
# to nothing safely on empty arrays.
for e in ${ENTRIES[@]+"${ENTRIES[@]}"}; do
  [[ "${e##*|}" == "missing" ]] && missing=$((missing + 1))
done

if [[ "$FORMAT" == "json" ]]; then
  printf '['
  first=1
  for e in ${ENTRIES[@]+"${ENTRIES[@]}"}; do
    [[ $first -eq 1 ]] && first=0 || printf ','
    IFS='|' read -r k s w r <<< "$e"
    printf '{"story":"%s","status":"%s","worktree":"%s","reality":"%s"}' "$k" "$s" "$w" "$r"
  done
  printf ']\n'
else
  if [[ ${#ENTRIES[@]} -eq 0 ]]; then
    echo "No active worktrees registered."
  else
    printf '%-20s  %-15s  %-50s  %s\n' "STORY" "STATUS" "WORKTREE" "REALITY"
    for e in "${ENTRIES[@]}"; do
      IFS='|' read -r k s w r <<< "$e"
      mark="✓"
      [[ "$r" == "missing" ]] && mark="✗"
      printf '%-20s  %-15s  %-50s  %s %s\n' "$k" "$s" "$w" "$mark" "$r"
    done
  fi
fi

exit $(( missing > 0 ? 1 : 0 ))
