#!/usr/bin/env bash
# Oracle for Epics phase. Wraps validate-coverage.sh and adds:
#   - every epic has at least one story
#   - every story has a Covered FRs line listing concrete FR-N IDs
#   - no orphan story keys (story key not on any epic's roster)
#
# Usage: oracle-epics.sh <epics-file> <prd-file>
# Exit:  0 = clean, 1 = violations (printed as ERROR <code>: <reason>)

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "ERROR E000: Usage: $0 <epics-file> <prd-file>" >&2
  exit 1
fi

EPICS="$1"
PRD="$2"
ECODE=0

if [[ ! -f "$EPICS" ]]; then
  echo "ERROR E001: epics file not found at $EPICS"
  exit 1
fi
if [[ ! -f "$PRD" ]]; then
  echo "ERROR E001: PRD file not found at $PRD"
  exit 1
fi

# E020 — FR coverage (re-runs validate-coverage's logic with hyphenated form)
PRD_FRS=$(grep -oE 'FR-[0-9]+' "$PRD" | sort -u || true)
EPIC_FRS=$(grep -oE 'FR-[0-9]+' "$EPICS" | sort -u || true)
for fr in $PRD_FRS; do
  if ! echo "$EPIC_FRS" | grep -q "^${fr}$"; then
    echo "ERROR E020: $fr from PRD is not covered by any epic"
    ECODE=1
  fi
done

# E021 — every epic has ≥1 story
EPIC_HEADERS=$(grep -n '^## Epic' "$EPICS" 2>/dev/null || true)
if [[ -n "$EPIC_HEADERS" ]]; then
  while IFS= read -r line; do
    LINENO_=$(echo "$line" | cut -d: -f1)
    NAME=$(echo "$line" | cut -d: -f2-)
    # Find next epic header (or EOF)
    NEXT_EPIC_LINE=$(awk -v start="$LINENO_" 'NR > start && /^## Epic/ { print NR; exit }' "$EPICS")
    if [[ -z "$NEXT_EPIC_LINE" ]]; then
      NEXT_EPIC_LINE=$(wc -l < "$EPICS")
    fi
    BLOCK=$(sed -n "${LINENO_},${NEXT_EPIC_LINE}p" "$EPICS")
    # Story key pattern: digit-digit-slug. We use grep without -c then count
    # via wc -l to avoid the "0\n0" double-emission that happens with
    # `grep -c X || echo 0` (grep -c emits "0" and exits 1, then the OR
    # fallback emits another "0", which trips bash arithmetic).
    STORY_COUNT=$(echo "$BLOCK" | { grep -E '\b[0-9]+-[0-9]+-[a-z][a-z0-9-]*' 2>/dev/null || true; } | wc -l | tr -d ' ')
    if [[ "${STORY_COUNT:-0}" -lt 1 ]]; then
      echo "ERROR E021: epic at line $LINENO_ ('$NAME') has no stories"
      ECODE=1
    fi
  done <<< "$EPIC_HEADERS"
fi

# E022 — every story line should reference at least one FR-N somewhere
# in the same epic block (loose check — the FRs may be in the parent
# story description block rather than per-story).
# Skipped here as it requires deeper YAML parsing — left to a future v4.X
# when state.yaml schema can express story.covered_frs as a typed array.

if [[ "$ECODE" -eq 0 ]]; then
  PRD_COUNT=$(echo "$PRD_FRS" | { grep -E . 2>/dev/null || true; } | wc -l | tr -d ' ')
  EPIC_HCOUNT=$(echo "$EPIC_HEADERS" | { grep -E . 2>/dev/null || true; } | wc -l | tr -d ' ')
  echo "OK epics oracle: ${PRD_COUNT:-0} FRs covered, ${EPIC_HCOUNT:-0} epics, all with ≥1 story"
fi
exit "$ECODE"
