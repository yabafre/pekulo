#!/usr/bin/env bash
# APED Guardrail — UserPromptSubmit hook
# Injects pipeline coherence warnings into Claude's context.
# Does NOT block — warns and asks for confirmation.
#
# stdin:  JSON with hook_event_name + prompt
# stdout: JSON with hookSpecificOutput.additionalContext
# exit 0 = allow; any non-zero return from this hook is ignored by Claude Code.

set -u
set -o pipefail
# No set -e: many commands (grep -q, glob tests) return non-zero as expected.

# ── Small helpers ──────────────────────────────────────────────────────────
#
# json_encode <string>
# Emits a JSON-encoded string (with surrounding quotes). Prefers jq, falls back
# to node. Claude Code itself runs on node, so node is always available in
# environments where this hook fires.
json_encode() {
  local input="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -Rs '.'
  elif command -v node >/dev/null 2>&1; then
    APED_GUARDRAIL_INPUT="$input" node -e 'process.stdout.write(JSON.stringify(process.env.APED_GUARDRAIL_INPUT))'
  else
    # No safe encoder available — emit nothing and let Claude proceed unannotated.
    return 1
  fi
}

# ── Read stdin JSON ────────────────────────────────────────────────────────
INPUT=""
if ! IFS= read -r -t 2 INPUT; then
  exit 0
fi

# Extract the prompt (jq → node → grep, in order of robustness).
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
elif command -v node >/dev/null 2>&1; then
  PROMPT=$(APED_GUARDRAIL_STDIN="$INPUT" node -e 'try { const o = JSON.parse(process.env.APED_GUARDRAIL_STDIN); process.stdout.write(o.prompt || ""); } catch {}' 2>/dev/null || true)
else
  PROMPT=$(printf '%s' "$INPUT" | grep -o '"prompt":"[^"]*"' | sed 's|"prompt":"||;s|"$||' 2>/dev/null || true)
fi

# Empty prompt → allow silently.
if [[ -z "${PROMPT:-}" ]]; then
  exit 0
fi

# ── Resolve paths (must stay under the project root) ───────────────────────
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
CONFIG_FILE="$PROJECT_ROOT/.aped/config.yaml"
OUTPUT_DIR="$PROJECT_ROOT/docs"

# ── Read + validate current phase ──────────────────────────────────────────
# Whitelist guards against garbage (or injected) values in state.yaml flowing
# into the context we hand back to Claude.
CURRENT_PHASE="none"
if [[ -f "$STATE_FILE" ]]; then
  RAW_PHASE=$(grep 'current_phase:' "$STATE_FILE" 2>/dev/null | head -n 1 | sed 's|.*current_phase:[[:space:]]*||;s|["'\'']||g;s|[[:space:]]*$||' || true)
  case "$RAW_PHASE" in
    none|analyze|prd|ux|architecture|sprint) CURRENT_PHASE="$RAW_PHASE" ;;
    *)                                       CURRENT_PHASE="none" ;;
  esac
fi

# ── Read + validate communication language ────────────────────────────────
COMM_LANG="english"
if [[ -f "$CONFIG_FILE" ]]; then
  RAW_LANG=$(grep 'communication_language:' "$CONFIG_FILE" 2>/dev/null | head -n 1 | sed 's|.*communication_language:[[:space:]]*||;s|["'\'']||g;s|[[:space:]]*$||' || true)
  case "$RAW_LANG" in
    french|français|francais) COMM_LANG="french" ;;
    *)                        COMM_LANG="english" ;;
  esac
fi

# ── Detect intent (semantic, not bare-keyword) ─────────────────────────────
#
# A prompt expresses *command intent* for phase X only when one of these
# holds:
#   1. the literal slash command "/aped-X" appears in the prompt
#   2. the prompt is a single-word match (e.g. just "review" alone)
#   3. the prompt is short (< 80 chars) AND starts with an imperative verb
#      tied to that phase (in the first 40 chars)
#
# Conversational connectors anywhere in the prompt suppress all bare-keyword
# matches — they signal the user is talking *about* a phase, not invoking it.
# Concrete user-reported false positive that motivated this refactor:
#   "bon petite review par rapport à ta proposition pour le prd"
# Bare keyword match would fire WANTS_REVIEW + WANTS_PRD; intent detection
# correctly classifies it as conversational and emits no warning.
#
# /aped-X slash form is always honoured — that is the unambiguous command.

PROMPT_LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')
PROMPT_LEN=${#PROMPT}
PROMPT_HEAD=$(printf '%s' "$PROMPT_LOWER" | cut -c1-40)
# Whitespace-only trim. Internal punctuation is preserved so that
# "prd?" (a question about the PRD) does NOT collapse to "prd" and trip
# trimmed_equals_any — that was a real false-positive class flagged by
# the edge-case review.
PROMPT_TRIMMED=$(printf '%s' "$PROMPT_LOWER" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

# Short prompts are eligible for imperative-at-start detection. Anything
# longer is treated as prose and only the slash form fires.
PROMPT_SHORT=false
(( PROMPT_LEN < 80 )) && PROMPT_SHORT=true

# Conversational connectors — FR + EN. If any appears, bare keywords are
# treated as nominal mentions, not commands. /aped-X slashes still fire.
CONVERSATIONAL=false
case "$PROMPT_LOWER" in
  *'par rapport'*|*'à propos'*|*'a propos'*|*'concernant'*  |*'ta proposition'*|*'votre proposition'*|*'ton avis'*|*'votre avis'*  |*'petite '*|*'petit '*|*'la review'*|*'la story'*|*'le prd'*|*'le dev'*  |*'about your'*|*'regarding your'*|*'about the '*|*'regarding the '*  |*'your proposal'*|*'your suggestion'*|*'speaking of'*|*'with respect to'*)
    CONVERSATIONAL=true ;;
esac

# Helper: does the head start with one of the given space-separated words?
# Args: $1..N = candidate first-word imperatives.
head_starts_with_any() {
  local head="$PROMPT_HEAD" word
  for word in "$@"; do
    case "$head" in
      "$word"|"$word "*|"$word,"*|"$word."*|"$word:"*|"$word!"*|"$word?"*) return 0 ;;
    esac
  done
  return 1
}

# Helper: is the (whitespace-trimmed) prompt one of these single tokens,
# optionally with a trailing terminator? A trailing "?" disqualifies — a
# question is never a command intent ("prd?" is "where's the prd?", not
# "run /aped-prd").
trimmed_equals_any() {
  local word
  case "$PROMPT_TRIMMED" in *'?') return 1 ;; esac
  for word in "$@"; do
    [[ "$PROMPT_TRIMMED" == "$word" ]] && return 0
    [[ "$PROMPT_TRIMMED" == "$word"[.,!:] ]] && return 0
  done
  return 1
}

# Helper: does the prompt contain the literal slash command?
has_slash() {
  case "$PROMPT_LOWER" in
    *"/aped-$1"*) return 0 ;;
    *) return 1 ;;
  esac
}

WANTS_ANALYZE=false
WANTS_PRD=false
WANTS_EPICS=false
WANTS_DEV=false
WANTS_REVIEW=false
WANTS_QUICK=false
WANTS_CODE=false

# /aped-X slash always wins — explicit command, no ambiguity.
has_slash analyze && WANTS_ANALYZE=true
has_slash prd     && WANTS_PRD=true
has_slash epics   && WANTS_EPICS=true
has_slash dev     && WANTS_DEV=true
has_slash review  && WANTS_REVIEW=true
has_slash quick   && WANTS_QUICK=true

# Single-word prompts (e.g. "review", "prd") count as command intent.
trimmed_equals_any analyze analyse research              && WANTS_ANALYZE=true
trimmed_equals_any prd                                    && WANTS_PRD=true
trimmed_equals_any epics epic stories                     && WANTS_EPICS=true
trimmed_equals_any dev develop implement                  && WANTS_DEV=true
trimmed_equals_any review audit                           && WANTS_REVIEW=true
trimmed_equals_any quick hotfix                           && WANTS_QUICK=true
trimmed_equals_any code refactor                          && WANTS_CODE=true

# Imperative-at-start, short prompt, no conversational connectors.
if [[ "$CONVERSATIONAL" == "false" && "$PROMPT_SHORT" == "true" ]]; then
  head_starts_with_any analyze analyse research                  && WANTS_ANALYZE=true
  head_starts_with_any 'write' 'draft' 'create'                  && {
    case "$PROMPT_LOWER" in *prd*) WANTS_PRD=true ;; esac
    case "$PROMPT_LOWER" in *epic*|*stor*) WANTS_EPICS=true ;; esac
  }
  head_starts_with_any review audit                              && WANTS_REVIEW=true
  head_starts_with_any implement build develop refactor          && WANTS_DEV=true
  head_starts_with_any code                                      && WANTS_CODE=true
  head_starts_with_any hotfix                                    && WANTS_QUICK=true
fi

# WANTS_CODE catches generic code-writing requests (paired with Rule 1).
# Only fires on imperative form, never on prose mentions of "code".
if [[ "$CONVERSATIONAL" == "false" && "$PROMPT_SHORT" == "true" ]]; then
  case "$PROMPT_HEAD" in
    'fix the bug'*|'fix bug'*|'add feature'*|'write a function'*|'create a file'*)
      WANTS_CODE=true ;;
  esac
fi

# ── Check artifact existence (nullglob-safe) ──────────────────────────────
HAS_BRIEF=false
HAS_PRD=false
HAS_EPICS=false

if [[ -d "$OUTPUT_DIR" ]]; then
  shopt -s nullglob
  brief_matches=("$OUTPUT_DIR"/*brief*)
  prd_matches=("$OUTPUT_DIR"/*prd*)
  epic_matches=("$OUTPUT_DIR"/*epic*)
  shopt -u nullglob
  (( ${#brief_matches[@]} > 0 )) && HAS_BRIEF=true
  (( ${#prd_matches[@]} > 0 )) && HAS_PRD=true
  (( ${#epic_matches[@]} > 0 )) && HAS_EPICS=true
fi

# ── Derive effective phase ────────────────────────────────────────────────
IN_SPRINT=false
[[ "$CURRENT_PHASE" == "sprint" ]] && IN_SPRINT=true

HAS_STORY_IN_REVIEW=false
if [[ -f "$STATE_FILE" ]]; then
  # Strip comment lines first — the scaffolded template documents the status
  # lifecycle in a comment ("# Per-story status: pending → … → in-progress → …"),
  # and we don't want those strings to trip the sprint detector.
  STATE_BODY=$(grep -v '^[[:space:]]*#' "$STATE_FILE" 2>/dev/null || true)
  printf '%s' "$STATE_BODY" | grep -q 'status:[[:space:]]*"*\(in-progress\|review\|ready-for-dev\)"*' && IN_SPRINT=true
  printf '%s' "$STATE_BODY" | grep -q 'status:[[:space:]]*"*review"*' && HAS_STORY_IN_REVIEW=true
fi

# ── Rules ──────────────────────────────────────────────────────────────────
WARNINGS=""

# Rule 0: /aped-quick bypasses pipeline checks entirely.
if [[ "$WANTS_QUICK" == "true" ]]; then
  exit 0
fi

# Rule 1: coding without going through the pipeline
if [[ "$WANTS_CODE" == "true" || "$WANTS_DEV" == "true" ]] && [[ "$IN_SPRINT" == "false" ]]; then
  if [[ "$HAS_EPICS" == "false" ]]; then
    WARNINGS="$WARNINGS
SKIP_DETECTED: Attempting dev/code without epics. Current phase: $CURRENT_PHASE. Run aped-analyze, aped-prd, aped-epics first."
  elif [[ "$HAS_PRD" == "false" ]]; then
    WARNINGS="$WARNINGS
SKIP_DETECTED: Attempting dev/code without PRD. Current phase: $CURRENT_PHASE. Run aped-analyze, aped-prd first."
  fi
fi

# Rule 2: PRD without brief
if [[ "$WANTS_PRD" == "true" ]] && [[ "$HAS_BRIEF" == "false" ]] && [[ "$CURRENT_PHASE" != "prd" ]]; then
  WARNINGS="$WARNINGS
MISSING_ARTIFACT: No product brief found. Run aped-analyze first."
fi

# Rule 3: Epics without PRD
if [[ "$WANTS_EPICS" == "true" ]] && [[ "$HAS_PRD" == "false" ]]; then
  WARNINGS="$WARNINGS
MISSING_ARTIFACT: No PRD found. Run aped-prd first."
fi

# Rule 4: Review without a story in review status
if [[ "$WANTS_REVIEW" == "true" ]] && [[ "$HAS_STORY_IN_REVIEW" == "false" ]]; then
  WARNINGS="$WARNINGS
PREMATURE_REVIEW: No story in review status. Run aped-dev first."
fi

# Rule 5: Modifying upstream during sprint
if [[ "$IN_SPRINT" == "true" ]]; then
  if [[ "$WANTS_PRD" == "true" || "$WANTS_ANALYZE" == "true" ]]; then
    WARNINGS="$WARNINGS
SCOPE_CHANGE: Sprint is active. Modifying PRD/brief invalidates epics and stories. Use aped-course instead."
  fi
fi

# Rule 6: dev without entering sprint
if [[ "$WANTS_DEV" == "true" ]] && [[ "$IN_SPRINT" == "false" ]] && [[ "$HAS_EPICS" == "true" ]]; then
  WARNINGS="$WARNINGS
PHASE_SKIP: Epics exist but sprint not started. Run aped-epics to finalize and enter sprint phase."
fi

# No warnings → allow silently.
if [[ -z "$WARNINGS" ]]; then
  exit 0
fi

# ── Build + emit context ──────────────────────────────────────────────────
CONTEXT="[APED GUARDRAIL] Pipeline coherence check. Current phase: $CURRENT_PHASE | Artifacts: brief=$HAS_BRIEF, prd=$HAS_PRD, epics=$HAS_EPICS
Warnings:$WARNINGS"

if [[ "$COMM_LANG" == "french" ]]; then
  CONTEXT="$CONTEXT
INSTRUCTION: Signale ces avertissements a l'utilisateur en francais AVANT d executer quoi que ce soit. Explique le probleme et propose le chemin correct. Demande confirmation pour continuer."
else
  CONTEXT="$CONTEXT
INSTRUCTION: Report these warnings to the user BEFORE executing anything. Explain the issue and suggest the correct pipeline path. Ask for confirmation to proceed."
fi

ENCODED=$(json_encode "$CONTEXT") || exit 0
printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s}}\n' "$ENCODED"
