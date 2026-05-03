#!/usr/bin/env bash
# APED checkin — lead/story coordination plumbing.
#
# Story Leaders (inside a worktree) `post` a checkin at every transition;
# the Lead Dev (inside the main project) `poll`s, `approve`s (or `block`s),
# and `push`es the next command back into the worktree's tmux window.
#
# Backend: ticket system if configured (Linear / GitHub / GitLab / Jira)
# with labels `aped-checkin-<kind>`, `aped-approved-<kind>`,
# `aped-blocked-<kind>`. Otherwise falls back to JSONL inboxes under
# ${main_project}/.aped/checkins/ — concurrent-safe via flock.
#
# Usage:
#   checkin.sh post    <story-key> <kind> [--status <AGENT_STATUS>] [<reason>]
#   checkin.sh poll    [--format json|text]
#   checkin.sh approve <story-key> <kind>
#   checkin.sh block   <story-key> <kind> <reason>
#   checkin.sh push    <story-key> <next-command...>
#   checkin.sh status  <story-key> <kind>    # → pending|approved|blocked|none
#
# `kind` ∈ { story-ready, dev-done, review-done, dev-blocked }.
#
# `--status` (optional) reports the **agent-confidence status** independently
# of the workflow approval status. It is what the Story Leader tells the Lead
# Dev about its own confidence in the work it just shipped:
#   DONE                 — task complete, no concerns. Auto-approve eligible.
#   DONE_WITH_CONCERNS   — done but flagging a non-blocking concern. Never
#                          auto-approves; Lead must read the reason.
#   NEEDS_CONTEXT        — agent has hit a question that needs user input.
#                          Never auto-approves; reason is the question.
#   BLOCKED              — agent cannot proceed. Use kind=`dev-blocked`.
#
# Persisted in JSONL as field `agent_status` (distinct from the existing
# `status` field, which carries the workflow state pending|approved|blocked).
# Default-status-for-kind mapping when --status is omitted:
#   story-ready | dev-done | review-done → DONE
#   dev-blocked                          → BLOCKED
# DONE_WITH_CONCERNS and NEEDS_CONTEXT require a non-empty reason argument.

set -u
set -o pipefail

ACTION="${1:-}"
shift || true

# ── Paths ─────────────────────────────────────────────────────────────────
# Always resolve paths against the MAIN project root, not the worktree.
# `git worktree list` reports absolute paths with the main worktree on line 1.
MAIN_ROOT=""
if command -v git >/dev/null 2>&1; then
  MAIN_ROOT=$(git worktree list 2>/dev/null | awk 'NR==1 {print $1}' || true)
fi
: "${MAIN_ROOT:=${CLAUDE_PROJECT_DIR:-$(pwd)}}"

# ── Portable lock (mkdir is atomic on every POSIX fs; flock is Linux-only) ─
acquire_lock() {
  local lock="$1" timeout="${2:-10}" waited=0
  until mkdir "$lock" 2>/dev/null; do
    (( waited >= timeout * 10 )) && { echo "Lock timeout on $lock" >&2; return 1; }
    sleep 0.1
    waited=$((waited + 1))
  done
  # Cleanup on exit, including signals.
  # shellcheck disable=SC2064
  trap "rmdir '$lock' 2>/dev/null || true" EXIT INT TERM
}

CONFIG_FILE="$MAIN_ROOT/.aped/config.yaml"
STATE_FILE="$MAIN_ROOT/docs/state.yaml"
INBOX_DIR="$MAIN_ROOT/.aped/checkins"
LOCK_FILE="$INBOX_DIR/.lock"

mkdir -p "$INBOX_DIR"

# ── Config helpers ────────────────────────────────────────────────────────
read_config() {
  local key="$1"
  [[ -f "$CONFIG_FILE" ]] || { echo "none"; return; }
  local val
  val=$(grep -E "^${key}:" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*//;s/["'\'']//g;s/[[:space:]]*$//')
  echo "${val:-none}"
}

TICKET_SYSTEM=$(read_config ticket_system)
GIT_PROVIDER=$(read_config git_provider)

ticket_for_story() {
  field_for_story "$1" "ticket"
}

worktree_for_story() {
  field_for_story "$1" "worktree"
}

field_for_story() {
  local key="$1" field="$2"
  [[ -f "$STATE_FILE" ]] || return 1
  awk -v k="$key" -v f="$field" '
    $0 ~ "^    " k ":" { in_story=1; next }
    in_story && /^    [a-zA-Z0-9_-]+:/ { in_story=0 }
    in_story && $1 == f ":" {
      gsub(/"/, "", $2); print $2; exit
    }
  ' "$STATE_FILE"
}

# ── Validation ────────────────────────────────────────────────────────────
validate_kind() {
  case "$1" in
    story-ready|dev-done|review-done|dev-blocked) ;;
    *) echo "Invalid kind: $1 (expected story-ready | dev-done | review-done | dev-blocked)" >&2; exit 1 ;;
  esac
}

validate_agent_status() {
  case "$1" in
    DONE|DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED) ;;
    *) echo "Invalid status: $1 (expected DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED)" >&2; exit 1 ;;
  esac
}

default_agent_status_for_kind() {
  case "$1" in
    story-ready|dev-done|review-done) echo DONE ;;
    dev-blocked)                      echo BLOCKED ;;
  esac
}

now_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

# ── Audit log (best-effort) ──────────────────────────────────────────────
# Mirrors every mutation through scripts/log.sh so /aped-status, postmortems,
# and replays have a single timeline to read. log.sh is fail-soft (always
# exits 0); we still guard with || true to be paranoid.
log_event() {
  bash "$MAIN_ROOT/.aped/scripts/log.sh" "$@" 2>/dev/null || true
}

# ── File backend ──────────────────────────────────────────────────────────
inbox_file() {
  echo "$INBOX_DIR/$1.jsonl"
}

append_entry() {
  local key="$1" kind="$2" status="$3" reason="${4:-}" agent_status="${5:-}"
  local file
  file=$(inbox_file "$key")
  local entry
  if command -v jq >/dev/null 2>&1; then
    entry=$(jq -c -n --arg ts "$(now_iso)" --arg s "$key" --arg k "$kind" --arg st "$status" --arg r "$reason" --arg ast "$agent_status"       '{ts:$ts, story:$s, kind:$k, status:$st, agent_status:$ast, reason:$r}')
  else
    entry=$(APED_TS="$(now_iso)" APED_S="$key" APED_K="$kind" APED_ST="$status" APED_R="$reason" APED_AST="$agent_status" node -e '
      process.stdout.write(JSON.stringify({
        ts: process.env.APED_TS, story: process.env.APED_S,
        kind: process.env.APED_K, status: process.env.APED_ST,
        agent_status: process.env.APED_AST, reason: process.env.APED_R
      }))')
  fi

  acquire_lock "$LOCK_FILE" || return 1
  printf '%s\n' "$entry" >> "$file"
  rmdir "$LOCK_FILE" 2>/dev/null || true
  trap - EXIT INT TERM
}

latest_status() {
  local key="$1" kind="$2"
  local file
  file=$(inbox_file "$key")
  [[ -f "$file" ]] || { echo "none"; return; }
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$kind" 'select(.kind == $k) | .status' "$file" 2>/dev/null | tail -1 || echo "none"
  else
    # Anchor on `{"` or `,"` to prevent the trailing `agent_status` field
    # from being consumed by the leading `.*` (regex would otherwise capture
    # it on entries where field order differs). This pins to the workflow
    # status, not the agent-confidence status.
    grep ""kind":"$kind"" "$file" | tail -1 | sed -E 's/.*[{,]"status":"([^"]*)".*/\1/' || echo "none"
  fi
}

# ── Ticket backend (thin — skills call providers directly, we just add labels + comments) ──
add_ticket_label() {
  local ticket="$1" label="$2"
  case "$TICKET_SYSTEM" in
    github-issues) gh issue edit "$ticket" --add-label "$label" >/dev/null 2>&1 || true ;;
    gitlab-issues) glab issue update "$ticket" --label "$label" >/dev/null 2>&1 || true ;;
    linear|jira) true ;;  # Labels set by the calling skill via provider CLI — script stays provider-light.
  esac
}

remove_ticket_label() {
  local ticket="$1" label="$2"
  case "$TICKET_SYSTEM" in
    github-issues) gh issue edit "$ticket" --remove-label "$label" >/dev/null 2>&1 || true ;;
    gitlab-issues) glab issue update "$ticket" --unlabel "$label" >/dev/null 2>&1 || true ;;
    linear|jira) true ;;
  esac
}

post_ticket_comment() {
  local ticket="$1" body="$2"
  case "$TICKET_SYSTEM" in
    github-issues) gh issue comment "$ticket" --body "$body" >/dev/null 2>&1 || true ;;
    gitlab-issues) glab issue note create "$ticket" --message "$body" >/dev/null 2>&1 || true ;;
    linear|jira) true ;;
  esac
}

# ── Actions ───────────────────────────────────────────────────────────────
cmd_post() {
  # Parse positional args + optional --status flag (placed anywhere).
  # `--` ends flag parsing; subsequent tokens are positional, even if they
  # start with `--` (so a reason starting with two dashes can be passed
  # safely: `post key kind -- "--this is a literal reason"`).
  local key="" kind="" reason="" agent_status="" no_more_flags=false
  while [[ $# -gt 0 ]]; do
    if [[ "$no_more_flags" == "true" ]]; then
      if   [[ -z "$key" ]];    then key="$1"
      elif [[ -z "$kind" ]];   then kind="$1"
      elif [[ -z "$reason" ]]; then reason="$1"
      else echo "Unexpected argument: $1" >&2; exit 1
      fi
      shift; continue
    fi
    case "$1" in
      --)
        no_more_flags=true; shift ;;
      --status)
        [[ $# -ge 2 ]] || { echo "checkin.sh post: --status requires an argument" >&2; exit 1; }
        agent_status="$2"; shift 2 ;;
      --status=*)
        agent_status="${1#--status=}"; shift ;;
      *)
        if   [[ -z "$key" ]];    then key="$1"
        elif [[ -z "$kind" ]];   then kind="$1"
        elif [[ -z "$reason" ]]; then reason="$1"
        else echo "Unexpected argument: $1" >&2; exit 1
        fi
        shift ;;
    esac
  done

  [[ -n "$key" && -n "$kind" ]] || { echo "Usage: checkin.sh post <key> <kind> [--status <AGENT_STATUS>] [reason]" >&2; exit 1; }
  validate_kind "$kind"

  if [[ -z "$agent_status" ]]; then
    agent_status=$(default_agent_status_for_kind "$kind")
  else
    validate_agent_status "$agent_status"
  fi

  # BLOCKED is paired with kind=dev-blocked exclusively, and dev-blocked is
  # paired with status BLOCKED exclusively. The kind is the schedule signal,
  # the status is the confidence signal — diverging them creates a state the
  # Lead Dev's routing table doesn't model (e.g. kind=dev-blocked +
  # status=DONE would auto-approve a blocked check-in via DONE's path).
  if [[ "$agent_status" == "BLOCKED" && "$kind" != "dev-blocked" ]]; then
    echo "Status BLOCKED requires kind=dev-blocked (got kind=$kind). Use: checkin.sh post $key dev-blocked YOUR_REASON" >&2
    exit 1
  fi
  if [[ "$kind" == "dev-blocked" && "$agent_status" != "BLOCKED" ]]; then
    echo "kind=dev-blocked requires status=BLOCKED (got --status $agent_status). dev-blocked and BLOCKED are paired exclusively." >&2
    exit 1
  fi

  # DONE_WITH_CONCERNS, NEEDS_CONTEXT, and BLOCKED carry information beyond
  # the kind (the concern, the question, the reason). Without a reason the
  # Lead has nothing to act on — refuse the post.
  case "$agent_status" in
    DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED)
      [[ -n "$reason" ]] || { echo "Status $agent_status requires a reason argument explaining the concern/question/blocker." >&2; exit 1; } ;;
  esac

  append_entry "$key" "$kind" "pending" "$reason" "$agent_status"

  if [[ "$TICKET_SYSTEM" != "none" ]]; then
    local ticket
    ticket=$(ticket_for_story "$key" || true)
    if [[ -n "$ticket" ]]; then
      add_ticket_label "$ticket" "aped-checkin-$kind"
      post_ticket_comment "$ticket" "[APED:CHECKIN:$kind:$agent_status] $key — requesting lead approval.${reason:+$'\n'Reason: $reason}"
    fi
  fi

  log_event checkin_posted story="$key" kind="$kind" agent_status="$agent_status" reason="$reason"
  printf 'posted %s/%s (pending, agent_status=%s)\n' "$key" "$kind" "$agent_status"
}

cmd_approve() {
  local key="${1:-}" kind="${2:-}"
  [[ -n "$key" && -n "$kind" ]] || { echo "Usage: checkin.sh approve <key> <kind>" >&2; exit 1; }
  validate_kind "$kind"
  append_entry "$key" "$kind" "approved" ""

  if [[ "$TICKET_SYSTEM" != "none" ]]; then
    local ticket
    ticket=$(ticket_for_story "$key" || true)
    if [[ -n "$ticket" ]]; then
      remove_ticket_label "$ticket" "aped-checkin-$kind"
      add_ticket_label "$ticket" "aped-approved-$kind"
      post_ticket_comment "$ticket" "[APED:APPROVE:$kind] $key — lead approved. Proceed."
    fi
  fi
  log_event checkin_approved story="$key" kind="$kind"
  printf 'approved %s/%s\n' "$key" "$kind"
}

cmd_block() {
  local key="${1:-}" kind="${2:-}" reason="${3:-}"
  [[ -n "$key" && -n "$kind" && -n "$reason" ]] || { echo "Usage: checkin.sh block <key> <kind> <reason>" >&2; exit 1; }
  validate_kind "$kind"
  append_entry "$key" "$kind" "blocked" "$reason"

  if [[ "$TICKET_SYSTEM" != "none" ]]; then
    local ticket
    ticket=$(ticket_for_story "$key" || true)
    if [[ -n "$ticket" ]]; then
      remove_ticket_label "$ticket" "aped-checkin-$kind"
      add_ticket_label "$ticket" "aped-blocked-$kind"
      post_ticket_comment "$ticket" "[APED:BLOCK:$kind] $key — lead needs changes. Reason: $reason"
    fi
  fi
  log_event checkin_blocked story="$key" kind="$kind" reason="$reason"
  printf 'blocked %s/%s\n' "$key" "$kind"
}

cmd_status() {
  local key="${1:-}" kind="${2:-}"
  [[ -n "$key" && -n "$kind" ]] || { echo "Usage: checkin.sh status <key> <kind>" >&2; exit 1; }
  latest_status "$key" "$kind"
}

cmd_poll() {
  local format="text"
  if [[ "${1:-}" == "--format" ]]; then
    format="${2:-text}"
  fi

  local pending=()
  shopt -s nullglob
  for f in "$INBOX_DIR"/*.jsonl; do
    local key
    key=$(basename "$f" .jsonl)
    for kind in story-ready dev-done review-done dev-blocked; do
      local st
      st=$(latest_status "$key" "$kind")
      if [[ "$st" == "pending" ]]; then
        pending+=("$key|$kind")
      fi
    done
  done
  shopt -u nullglob

  if [[ "$format" == "json" ]]; then
    printf '['
    local first=1
    # Guard against bash 4 `set -u` + empty array: ${a[@]+"${a[@]}"} expands
    # to nothing safely when the array is empty.
    for entry in ${pending[@]+"${pending[@]}"}; do
      local k="${entry%|*}"
      local nd="${entry#*|}"
      [[ $first -eq 1 ]] && first=0 || printf ','
      printf '{"story":"%s","kind":"%s"}' "$k" "$nd"
    done
    printf ']\n'
  else
    if [[ ${#pending[@]} -eq 0 ]]; then
      echo "No pending check-ins."
    else
      echo "Pending check-ins (${#pending[@]}):"
      for entry in "${pending[@]}"; do
        local k="${entry%|*}"
        local nd="${entry#*|}"
        echo "  $k  $nd"
      done
    fi
  fi
}

cmd_archive() {
  # Move all .jsonl checkin inboxes to a dated archive directory and start
  # fresh. Called by /aped-ship after a successful umbrella PR open so the
  # next sprint starts with empty inboxes (poll latency stays O(active)).
  local archive_dir="$INBOX_DIR/archive/$(date -u +%Y-%m-%d)"
  mkdir -p "$archive_dir" 2>/dev/null || { echo "ERROR: cannot create $archive_dir" >&2; exit 1; }

  local moved=0
  shopt -s nullglob
  for f in "$INBOX_DIR"/*.jsonl; do
    mv -f "$f" "$archive_dir/" && moved=$((moved + 1))
  done
  shopt -u nullglob

  log_event checkin_archived to="$archive_dir" files="$moved"
  printf 'archived %d inbox file(s) to %s\n' "$moved" "$archive_dir"
}

cmd_push() {
  # Args: [--target <name>] <story-key> <prompt-words...>
  # Resolution order, in this priority:
  #   1. If --target is given, use only that name (no auto-discovery).
  #   2. Else build a candidate list from state.yaml: workmux handle (basename
  #      of worktree path), ticket id, story key — in that order.
  #   3. Try workmux first if installed: send to the candidate that workmux
  #      knows. If multiple match, REFUSE and ask for --target.
  #   4. Fall back to tmux: match against window names. Same multi-match rule.
  # Exit codes:
  #   0 pushed; 1 usage; 2 no target found anywhere; 3 ambiguous (>1 match).
  # Never prints "pushed" unless the underlying send command actually ran
  # against a single, unambiguous target.
  local key="" target=""
  local -a prompt_args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --target)
        target="${2:-}"; shift 2 || { echo "Usage: --target requires a value" >&2; exit 1; }
        ;;
      --)
        shift
        while [[ $# -gt 0 ]]; do prompt_args+=("$1"); shift; done
        break
        ;;
      *)
        if [[ -z "$key" ]]; then key="$1"; else prompt_args+=("$1"); fi
        shift
        ;;
    esac
  done

  [[ -n "$key" && ${#prompt_args[@]} -gt 0 ]] || {
    echo "Usage: checkin.sh push [--target <name>] <key> <command...>" >&2
    exit 1
  }
  local prompt="${prompt_args[*]}"

  local -a candidates=()
  if [[ -n "$target" ]]; then
    candidates=("$target")
  else
    local worktree ticket handle
    worktree=$(worktree_for_story "$key" || true)
    ticket=$(ticket_for_story "$key" || true)
    if [[ -n "$worktree" ]]; then
      handle=$(basename "$worktree")
      candidates+=("$handle")
    fi
    [[ -n "$ticket" ]] && candidates+=("$ticket")
    candidates+=("$key")
  fi

  # ── Path A: workmux (preferred when installed) ─────────────────────────
  if command -v workmux >/dev/null 2>&1; then
    local list_out
    list_out=$(workmux list --format name 2>/dev/null || true)
    local -a known=()
    local c
    for c in "${candidates[@]}"; do
      if printf '%s\n' "$list_out" | grep -Fxq "$c"; then
        known+=("$c")
      fi
    done
    if [[ ${#known[@]} -eq 1 ]]; then
      workmux send "${known[0]}" "$prompt"
      log_event push story="$key" target="${known[0]}" via=workmux prompt="$prompt"
      printf 'pushed via workmux to %s\n' "${known[0]}"
      return 0
    elif [[ ${#known[@]} -gt 1 ]]; then
      echo "ERROR: multiple workmux handles match candidates [${candidates[*]}]: ${known[*]}" >&2
      echo "Pass --target <handle> to disambiguate." >&2
      exit 3
    fi
    # zero workmux matches → fall through to tmux
  fi

  # ── Path B: tmux fallback ──────────────────────────────────────────────
  if ! command -v tmux >/dev/null 2>&1; then
    echo "ERROR: no workmux match and tmux not installed — Story Leader for $key must run '$prompt' manually." >&2
    exit 2
  fi

  local windows
  windows=$(tmux list-windows -a -F '#{session_name}:#{window_index} #{window_name}' 2>/dev/null || true)
  local -a matched=()
  local line name addr c
  for c in "${candidates[@]}"; do
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      name="${line##* }"
      addr="${line%% *}"
      [[ "$name" == "$c" ]] && matched+=("$addr")
    done <<< "$windows"
  done

  # Dedupe while preserving order. Guard the iterations: matched and unique
  # may be empty (no candidate matched any window), and bash 4 `set -u`
  # would explode on ${matched[@]} / ${unique[@]} with no elements.
  local -a unique=()
  local m
  for m in ${matched[@]+"${matched[@]}"}; do
    local seen=0 u
    for u in ${unique[@]+"${unique[@]}"}; do [[ "$u" == "$m" ]] && { seen=1; break; }; done
    (( seen == 0 )) && unique+=("$m")
  done

  if [[ ${#unique[@]} -eq 0 ]]; then
    echo "ERROR: no tmux window matches any candidate [${candidates[*]}]. Story Leader for $key must run '$prompt' manually, or pass --target <session:window-or-name>." >&2
    exit 2
  fi
  if [[ ${#unique[@]} -gt 1 ]]; then
    echo "ERROR: multiple tmux windows match candidates [${candidates[*]}]:" >&2
    printf '  %s\n' "${unique[@]}" >&2
    echo "Pass --target <session:window-or-name> to disambiguate." >&2
    exit 3
  fi

  tmux send-keys -t "${unique[0]}" "$prompt" Enter
  log_event push story="$key" target="${unique[0]}" via=tmux prompt="$prompt"
  printf 'pushed via tmux to %s\n' "${unique[0]}"
}

case "$ACTION" in
  post)    cmd_post    "$@" ;;
  poll)    cmd_poll    "$@" ;;
  approve) cmd_approve "$@" ;;
  block)   cmd_block   "$@" ;;
  status)  cmd_status  "$@" ;;
  push)    cmd_push    "$@" ;;
  archive) cmd_archive "$@" ;;
  ""|help|-h|--help)
    sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    echo "Run checkin.sh --help" >&2
    exit 1
    ;;
esac
