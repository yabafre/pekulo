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

# ── Detect intent ──────────────────────────────────────────────────────────
PROMPT_LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

WANTS_ANALYZE=false
WANTS_PRD=false
WANTS_EPICS=false
WANTS_DEV=false
WANTS_REVIEW=false
WANTS_QUICK=false
WANTS_CODE=false

printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-analyze|/aped-analyze|analyze|analyse|research)'                                 && WANTS_ANALYZE=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-prd|/aped-prd|prd|product.req)'                                                  && WANTS_PRD=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-epics|/aped-epics|epic|stories|story)'                                           && WANTS_EPICS=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-dev|/aped-dev|dev|implement|build|create.*component|create.*service)'            && WANTS_DEV=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-review|/aped-review|review|audit)'                                               && WANTS_REVIEW=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(aped-quick|/aped-quick|quick.fix|quick.feature|hotfix)'                               && WANTS_QUICK=true
printf '%s' "$PROMPT_LOWER" | grep -qE '(code|implement|write.*function|create.*file|add.*feature|fix.*bug|refactor)'          && WANTS_CODE=true

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
SKIP_DETECTED: Attempting dev/code without epics. Current phase: $CURRENT_PHASE. Run /aped-analyze, /aped-prd, /aped-epics first."
  elif [[ "$HAS_PRD" == "false" ]]; then
    WARNINGS="$WARNINGS
SKIP_DETECTED: Attempting dev/code without PRD. Current phase: $CURRENT_PHASE. Run /aped-analyze, /aped-prd first."
  fi
fi

# Rule 2: PRD without brief
if [[ "$WANTS_PRD" == "true" ]] && [[ "$HAS_BRIEF" == "false" ]] && [[ "$CURRENT_PHASE" != "prd" ]]; then
  WARNINGS="$WARNINGS
MISSING_ARTIFACT: No product brief found. Run /aped-analyze first."
fi

# Rule 3: Epics without PRD
if [[ "$WANTS_EPICS" == "true" ]] && [[ "$HAS_PRD" == "false" ]]; then
  WARNINGS="$WARNINGS
MISSING_ARTIFACT: No PRD found. Run /aped-prd first."
fi

# Rule 4: Review without a story in review status
if [[ "$WANTS_REVIEW" == "true" ]] && [[ "$HAS_STORY_IN_REVIEW" == "false" ]]; then
  WARNINGS="$WARNINGS
PREMATURE_REVIEW: No story in review status. Run /aped-dev first."
fi

# Rule 5: Modifying upstream during sprint
if [[ "$IN_SPRINT" == "true" ]]; then
  if [[ "$WANTS_PRD" == "true" || "$WANTS_ANALYZE" == "true" ]]; then
    WARNINGS="$WARNINGS
SCOPE_CHANGE: Sprint is active. Modifying PRD/brief invalidates epics and stories. Use /aped-course instead."
  fi
fi

# Rule 6: dev without entering sprint
if [[ "$WANTS_DEV" == "true" ]] && [[ "$IN_SPRINT" == "false" ]] && [[ "$HAS_EPICS" == "true" ]]; then
  WARNINGS="$WARNINGS
PHASE_SKIP: Epics exist but sprint not started. Run /aped-epics to finalize and enter sprint phase."
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
