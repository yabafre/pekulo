#!/usr/bin/env bash
# Oracle for Architecture phase. Verifies that every PRD FR is referenced
# at least once in the architecture decisions, and that every component
# declaration has owner + tech-stack metadata.
#
# Usage: oracle-arch.sh <arch-file> <prd-file>
# Exit:  0 = clean, 1 = violations (printed as ERROR <code>: <reason>)
#
# Verifications:
#   E001 — arch or PRD file not found
#   E010 — FR from PRD not cited in arch
#   E011 — component declared without owner field
#   E012 — component declared without tech-stack field
#   E013 — ADR template field empty (Status / Context / Decision / Consequences)

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "ERROR E000: Usage: $0 <arch-file> <prd-file>" >&2
  exit 1
fi

ARCH="$1"
PRD="$2"
ECODE=0

if [[ ! -f "$ARCH" ]]; then
  echo "ERROR E001: arch file not found at $ARCH"
  exit 1
fi
if [[ ! -f "$PRD" ]]; then
  echo "ERROR E001: PRD file not found at $PRD"
  exit 1
fi

# FR coverage — every FR-N from PRD must appear at least once in arch
PRD_FRS=$(grep -oE 'FR-[0-9]+' "$PRD" | sort -u || true)
if [[ -n "$PRD_FRS" ]]; then
  for fr in $PRD_FRS; do
    if ! grep -q "$fr" "$ARCH"; then
      echo "ERROR E010: $fr from PRD is not referenced in architecture decisions"
      ECODE=1
    fi
  done
fi

# Component declarations — pattern `### Component: name` followed within 20
# lines by `Owner:` and `Tech stack:`. (We do a permissive check — if
# the file uses a different convention, the oracle simply doesn't fire,
# which is the right behaviour for a template-agnostic check.)
COMPONENTS=$(grep -n '^### Component:' "$ARCH" 2>/dev/null || true)
if [[ -n "$COMPONENTS" ]]; then
  while IFS= read -r line; do
    LINENO_=$(echo "$line" | cut -d: -f1)
    NAME=$(echo "$line" | cut -d: -f3- | sed 's/^[[:space:]]*//')
    BLOCK=$(sed -n "${LINENO_},$((LINENO_+20))p" "$ARCH")
    if ! echo "$BLOCK" | grep -qE '^[[:space:]]*-?[[:space:]]*Owner:'; then
      echo "ERROR E011: component '$NAME' (line $LINENO_) declared without Owner field"
      ECODE=1
    fi
    if ! echo "$BLOCK" | grep -qE '^[[:space:]]*-?[[:space:]]*Tech stack:'; then
      echo "ERROR E012: component '$NAME' (line $LINENO_) declared without Tech stack field"
      ECODE=1
    fi
  done <<< "$COMPONENTS"
fi

# ADR template fields — if the arch contains ADR sections, each must have
# all four canonical fields filled (non-empty after the colon).
ADR_BLOCKS=$(grep -n '^## ADR' "$ARCH" 2>/dev/null || true)
if [[ -n "$ADR_BLOCKS" ]]; then
  for field in "Status" "Context" "Decision" "Consequences"; do
    EMPTY=$(grep -nE "^\*?\*?${field}\*?\*?:\s*$" "$ARCH" 2>/dev/null || true)
    if [[ -n "$EMPTY" ]]; then
      while IFS= read -r line; do
        LINENO_=$(echo "$line" | cut -d: -f1)
        echo "ERROR E013: line $LINENO_ ADR field '$field' is empty"
        ECODE=1
      done <<< "$EMPTY"
    fi
  done
fi

if [[ "$ECODE" -eq 0 ]]; then
  PRD_COUNT=$(echo "$PRD_FRS" | { grep -E . 2>/dev/null || true; } | wc -l | tr -d ' ')
  echo "OK arch oracle: ${PRD_COUNT:-0} FRs referenced; all components have Owner+Tech stack; all ADR fields filled"
fi
exit "$ECODE"
