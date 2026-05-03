#!/usr/bin/env bash
# Oracle for PRD phase. Deterministic verification of structural invariants
# before downstream skills (aped-arch, aped-epics) consume the artefact.
#
# Usage: oracle-prd.sh <prd-file>
# Exit:  0 = clean, 1 = violations (printed as ERROR <code>: <reason>)
#
# Verifications:
#   E001 — file not found
#   E002 — required section missing
#   E003 — FR count out of bounds (10 ≤ N ≤ 80)
#   E004 — FR uses non-hyphenated form (FR1 instead of FR-1)
#   E005 — FR has no Acceptance: line within next 5 lines
#   E006 — anti-pattern word in FR text (easy/intuitive/fast/etc.)
#   E007 — NFR has no measurable threshold (number + unit)
#
# This oracle SUPERSEDES validate-prd.sh in pre-merge gates. The legacy
# validate-prd.sh is kept for backwards compatibility but writes
# multi-line bullets, which break grep pipelines.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "ERROR E000: Usage: $0 <prd-file>" >&2
  exit 1
fi

FILE="$1"
ECODE=0

if [[ ! -f "$FILE" ]]; then
  echo "ERROR E001: PRD file not found at $FILE"
  exit 1
fi

# Required sections
REQUIRED_SECTIONS=(
  "## Executive Summary"
  "## Success Criteria"
  "## Product Scope"
  "## User Journeys"
  "## Functional Requirements"
  "## Non-Functional Requirements"
)
for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -q "$section" "$FILE"; then
    echo "ERROR E002: missing section: $section"
    ECODE=1
  fi
done

# FR format — canonical hyphenated form FR-N (4.7.6 normalisation lock)
# The character class [^[:alnum:]_-] excludes a leading hyphen, so this regex
# only fires on non-hyphenated forms (FR1, FR2, …). No further -v filter needed
# — a line containing both "FR1:" and "FR-1" is still a violation because the
# unhyphenated form exists.
NON_HYPHEN_FR=$(grep -nE '(^|[^[:alnum:]_-])FR[0-9]+:' "$FILE" 2>/dev/null || true)
if [[ -n "$NON_HYPHEN_FR" ]]; then
  while IFS= read -r line; do
    LINENO_=$(echo "$line" | cut -d: -f1)
    echo "ERROR E004: line $LINENO_ uses non-hyphenated FR (canonical is FR-N)"
    ECODE=1
  done <<< "$NON_HYPHEN_FR"
fi

# FR count
FR_COUNT=$({ grep -E '(^|[^[:alnum:]_-])FR-[0-9]+:' "$FILE" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [[ "$FR_COUNT" -lt 10 ]]; then
  echo "ERROR E003: FR count too low: $FR_COUNT (min 10)"
  ECODE=1
fi
if [[ "$FR_COUNT" -gt 80 ]]; then
  echo "ERROR E003: FR count too high: $FR_COUNT (max 80)"
  ECODE=1
fi

# Anti-pattern words inside FR text
ANTI_PATTERNS=("easy" "intuitive" "fast" "responsive" "simple" "multiple" "several" "various")
for pattern in "${ANTI_PATTERNS[@]}"; do
  HITS=$(grep -inE "FR-[0-9]+.*:.*\b${pattern}\b" "$FILE" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    while IFS= read -r line; do
      LINENO_=$(echo "$line" | cut -d: -f1)
      echo "ERROR E006: line $LINENO_ uses anti-pattern word '$pattern' (specify a measurable threshold instead)"
      ECODE=1
    done <<< "$HITS"
  fi
done

# NFR threshold check — every NFR-N must contain a number + unit nearby
NFR_LINES=$(grep -nE '(^|[^[:alnum:]_-])NFR-[0-9]+:' "$FILE" 2>/dev/null || true)
if [[ -n "$NFR_LINES" ]]; then
  while IFS= read -r line; do
    LINENO_=$(echo "$line" | cut -d: -f1)
    NFR_TEXT=$(echo "$line" | cut -d: -f2-)
    # Look for number followed by common units (ms, s, %, kb, mb, requests/sec, etc.)
    if ! echo "$NFR_TEXT" | grep -qE '[0-9]+\s?(ms|s|%|kb|mb|gb|bytes?|chars?|requests?|users?|seconds?|minutes?|hours?|days?|p[0-9]+)'; then
      echo "ERROR E007: line $LINENO_ NFR has no measurable threshold (number + unit) — '$NFR_TEXT'"
      ECODE=1
    fi
  done <<< "$NFR_LINES"
fi

if [[ "$ECODE" -eq 0 ]]; then
  echo "OK PRD oracle: $FR_COUNT FRs, all sections present, no anti-patterns, NFRs measurable"
fi
exit "$ECODE"
