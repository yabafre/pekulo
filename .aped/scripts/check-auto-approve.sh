#!/usr/bin/env bash
# APED check-auto-approve — deterministic verdicts for /aped-lead's batch
# processor. Replaces LLM-based judgement on "is this check-in safe to
# auto-approve?". Each subcommand runs the checks listed in aped-lead.md
# and returns a verdict the LLM can trust.
#
# Subcommands:
#   story-ready  <story-key>
#   dev-done     <story-key>
#   review-done  <story-key>
#
# Exit codes:
#   0 → AUTO     (all checks passed)
#   1 → ESCALATE (one or more checks failed; reasons on stderr, "- " prefix)
#   2 → usage error
#   3 → preconditions missing (story not in state.yaml, worktree missing)
#
# Run from the MAIN project root; paths derive from there.

set -uo pipefail

ACTION="${1:-}"
KEY="${2:-}"

[[ -n "$ACTION" && -n "$KEY" ]] || {
  echo "Usage: check-auto-approve.sh <story-ready|dev-done|review-done> <story-key>" >&2
  exit 2
}

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
APED_DIR="$PROJECT_ROOT/.aped"
CONFIG_FILE="$APED_DIR/config.yaml"

[[ -f "$STATE_FILE" ]] || { echo "ERROR: state.yaml missing at $STATE_FILE" >&2; exit 3; }

REASONS=()
fail() { REASONS+=("- $1"); }

field_for_story() {
  local key="$1" field="$2"
  awk -v k="$key" -v f="$field" '
    $0 ~ "^    " k ":" { in_story=1; next }
    in_story && /^    [a-zA-Z0-9_-]+:/ { in_story=0 }
    in_story && $1 == f ":" { gsub(/"/, "", $2); print $2; exit }
  ' "$STATE_FILE"
}

WORKTREE=$(field_for_story "$KEY" "worktree" || true)
[[ -n "$WORKTREE" && "$WORKTREE" != "null" ]] || {
  echo "ERROR: no worktree registered for $KEY in state.yaml" >&2
  exit 3
}
[[ -d "$WORKTREE" ]] || {
  echo "ERROR: worktree path $WORKTREE not found on disk" >&2
  exit 3
}

STORY_FILE="$WORKTREE/docs/stories/${KEY}.md"

check_story_ready() {
  [[ -f "$STORY_FILE" ]] || { fail "story file missing at $STORY_FILE"; return; }

  # ACs use Given/When/Then, either numbered ("1. Given …") or bulleted ("- Given …").
  if ! grep -qE '^[[:space:]]*([0-9]+\.|-)[[:space:]]+(Given|GIVEN)' "$STORY_FILE"; then
    fail "no Given/When/Then-formatted Acceptance Criteria in story file"
  fi

  # Story file must be committed on the worktree's branch.
  if ! git -C "$WORKTREE" log --oneline -- "docs/stories/${KEY}.md" 2>/dev/null | grep -q .; then
    fail "story file is not committed on the feature branch"
  fi

  # depends_on all done.
  local deps
  deps=$(awk -v k="$KEY" '
    $0 ~ "^    " k ":" { in_story=1; next }
    in_story && /^    [a-zA-Z0-9_-]+:/ && !/depends_on:/ { if (!in_deps) in_story=0 }
    in_story && /^[[:space:]]+depends_on:/ { in_deps=1; next }
    in_deps && /^[[:space:]]+-[[:space:]]/ { gsub(/^[[:space:]]+-[[:space:]]+/, ""); gsub(/"/, ""); print }
    in_deps && /^[[:space:]]+[a-zA-Z]/ { in_deps=0 }
  ' "$STATE_FILE")

  local dep dep_status
  for dep in $deps; do
    dep_status=$(field_for_story "$dep" "status" || echo "unknown")
    [[ "$dep_status" == "done" ]] || fail "dependency $dep is $dep_status (need done)"
  done
}

check_dev_done() {
  # Test result freshness — /aped-dev should write .aped/.last-test-exit on
  # every run. Missing cache is treated as "tests not verified" and escalates.
  local exit_file="$WORKTREE/.aped/.last-test-exit"
  if [[ -f "$exit_file" ]]; then
    local last_exit
    last_exit=$(cat "$exit_file" 2>/dev/null || echo "missing")
    [[ "$last_exit" == "0" ]] || fail "last test run exited $last_exit (cached at .last-test-exit)"
  else
    fail "no .aped/.last-test-exit cache — run tests in worktree before approving"
  fi

  if [[ -f "$STORY_FILE" ]]; then
    if grep -qE '^[[:space:]]*- \[ \]' "$STORY_FILE"; then
      local unchecked
      unchecked=$({ grep -E '^[[:space:]]*- \[ \]' "$STORY_FILE" 2>/dev/null || true; } | wc -l | tr -d ' ')
      fail "$unchecked tasks still unchecked in story"
    fi
    if grep -qi 'HALT' "$STORY_FILE"; then
      fail "HALT entries present in Dev Agent Record"
    fi
  else
    fail "story file missing at $STORY_FILE"
  fi

  if [[ -n "$(git -C "$WORKTREE" status --porcelain 2>/dev/null)" ]]; then
    fail "worktree has uncommitted changes"
  fi

  if [[ -x "$APED_DIR/aped-review/scripts/git-audit.sh" && -f "$STORY_FILE" ]]; then
    if ! (cd "$WORKTREE" && bash "$APED_DIR/aped-review/scripts/git-audit.sh" "$STORY_FILE") >/dev/null 2>&1; then
      fail "git-audit.sh reports file-list/git-changes mismatch"
    fi
  fi
}

check_review_done() {
  local status
  status=$(field_for_story "$KEY" "status" || echo "unknown")
  [[ "$status" == "done" ]] || fail "story status is $status (need done)"

  local ticket ticket_system
  ticket=$(field_for_story "$KEY" "ticket" || true)
  ticket_system=$(grep -E '^ticket_system:' "$CONFIG_FILE" 2>/dev/null | sed 's/.*:[[:space:]]*//;s/["'"'"']//g' || echo "none")

  if [[ -n "$ticket" ]]; then
    case "$ticket_system" in
      github-issues)
        if command -v gh >/dev/null 2>&1; then
          if gh issue view "$ticket" --json labels 2>/dev/null | grep -q 'aped-blocked-'; then
            fail "ticket $ticket has aped-blocked-* label"
          fi
        fi
        ;;
      gitlab-issues)
        if command -v glab >/dev/null 2>&1; then
          if glab issue view "$ticket" 2>/dev/null | grep -q 'aped-blocked-'; then
            fail "ticket $ticket has aped-blocked-* label"
          fi
        fi
        ;;
    esac
  fi

  # PR mergeability + base check — github only for now; other providers skip
  # silently (no escalation). The PR's base MUST be the sprint umbrella; if
  # /aped-review opened it against the wrong base (e.g. the actual base
  # branch), the merge would skip the umbrella convention entirely.
  local umbrella=""
  if command -v yq >/dev/null 2>&1; then
    umbrella=$(yq -r '.sprint.umbrella_branch // ""' "$STATE_FILE" 2>/dev/null || echo "")
  fi

  if [[ -n "$ticket" ]] && command -v gh >/dev/null 2>&1; then
    local pr_json mergeable base_ref
    pr_json=$(cd "$WORKTREE" && gh pr view --json mergeable,baseRefName 2>/dev/null || echo "{}")
    mergeable=$(printf '%s' "$pr_json" | grep -oE '"mergeable":[[:space:]]*"[A-Z]+"' | sed 's/.*"\([A-Z]*\)"/\1/' || echo "UNKNOWN")
    base_ref=$(printf '%s' "$pr_json" | grep -oE '"baseRefName":[[:space:]]*"[^"]+"' | sed 's/.*"\([^"]*\)"/\1/' || echo "")

    case "$mergeable" in
      MERGEABLE|UNKNOWN) ;;
      *) fail "PR mergeable status is $mergeable (need MERGEABLE)" ;;
    esac

    if [[ -n "$umbrella" && -n "$base_ref" && "$base_ref" != "$umbrella" ]]; then
      fail "PR base is '$base_ref' but expected sprint umbrella '$umbrella' — re-open the PR with --base $umbrella"
    fi
  fi
}

case "$ACTION" in
  story-ready) check_story_ready ;;
  dev-done)    check_dev_done ;;
  review-done) check_review_done ;;
  *) echo "Unknown action: $ACTION (expected story-ready|dev-done|review-done)" >&2; exit 2 ;;
esac

if [[ ${#REASONS[@]} -gt 0 ]]; then
  printf '%s\n' "${REASONS[@]}" >&2
  exit 1
fi
exit 0
