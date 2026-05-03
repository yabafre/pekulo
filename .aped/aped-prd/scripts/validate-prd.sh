#!/usr/bin/env bash
# Validate PRD has required sections, FR format, and no anti-patterns
# Usage: validate-prd.sh <prd-file>
# Exit 0 if valid, exit 1 with issues listed

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <prd-file>"
  exit 1
fi

FILE="$1"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: File not found: $FILE"
  exit 1
fi

ISSUES=()

# Check required sections
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
    ISSUES+=("MISSING SECTION: $section")
  fi
done

# Check FR format — accepts both legacy FR1: and canonical FR-1: forms
FR_LINES=$(grep -E '(^|[-*>[:space:]])\*{0,2}FR-?[0-9]+\*{0,2}\s*:' "$FILE" 2>/dev/null || true)
FR_COUNT=0
if [[ -n "$FR_LINES" ]]; then
  FR_COUNT=$(echo "$FR_LINES" | wc -l | tr -d ' ')
fi

if [[ "$FR_COUNT" -lt 10 ]]; then
  ISSUES+=("FR COUNT TOO LOW: Found $FR_COUNT FRs (minimum 10)")
fi

if [[ "$FR_COUNT" -gt 80 ]]; then
  ISSUES+=("FR COUNT TOO HIGH: Found $FR_COUNT FRs (maximum 80)")
fi

# Check for anti-pattern words in FR lines
ANTI_PATTERNS=("easy" "intuitive" "fast" "responsive" "simple" "multiple" "several" "various")

for pattern in "${ANTI_PATTERNS[@]}"; do
  MATCHES=$(grep -inE 'FR-?[0-9]+.*:.*\b${pattern}\b' "$FILE" 2>/dev/null || true)
  if [[ -n "$MATCHES" ]]; then
    ISSUES+=("ANTI-PATTERN '$pattern' found in FR: $MATCHES")
  fi
done

# Report results
if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "VALIDATION FAILED — Issues found:"
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue"
  done
  exit 1
fi

echo "VALIDATION PASSED — PRD is valid ($FR_COUNT FRs, all sections present, no anti-patterns)"
exit 0
