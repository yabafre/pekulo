#!/usr/bin/env bash
# Validate that all FRs from PRD are covered in epics
# Usage: validate-coverage.sh <epics-file> <prd-file>
# Exit 0 if all covered, exit 1 with missing FRs listed

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <epics-file> <prd-file>"
  exit 1
fi

EPICS_FILE="$1"
PRD_FILE="$2"

if [[ ! -f "$EPICS_FILE" ]]; then
  echo "ERROR: Epics file not found: $EPICS_FILE"
  exit 1
fi

if [[ ! -f "$PRD_FILE" ]]; then
  echo "ERROR: PRD file not found: $PRD_FILE"
  exit 1
fi

# Extract FR numbers — match both legacy FR1 and canonical FR-1 forms,
# then normalize to canonical FR-N for consistent comparison.
PRD_FRS=$(grep -oE 'FR-?[0-9]+' "$PRD_FILE" | sed 's/^FR\([0-9]\)/FR-\1/' | sort -u || true)
EPIC_FRS=$(grep -oE 'FR-?[0-9]+' "$EPICS_FILE" | sed 's/^FR\([0-9]\)/FR-\1/' | sort -u || true)

if [[ -z "$PRD_FRS" ]]; then
  echo "WARNING: No FRs found in PRD file"
  exit 0
fi

# Find missing FRs
MISSING=()
for fr in $PRD_FRS; do
  [[ -z "$fr" ]] && continue
  if ! echo "$EPIC_FRS" | grep -q "^${fr}$"; then
    MISSING+=("$fr")
  fi
done

PRD_COUNT=$(echo "$PRD_FRS" | { grep . 2>/dev/null || true; } | wc -l | tr -d ' ')
EPIC_COUNT=$(echo "$EPIC_FRS" | { grep . 2>/dev/null || true; } | wc -l | tr -d ' ')

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "COVERAGE VALIDATION FAILED"
  echo "PRD FRs: $PRD_COUNT | Epics FRs: $EPIC_COUNT"
  echo "Missing FRs (in PRD but not in epics):"
  for fr in "${MISSING[@]}"; do
    echo "  - $fr"
  done
  exit 1
fi

echo "COVERAGE VALIDATION PASSED — All $PRD_COUNT FRs covered in epics"
exit 0
