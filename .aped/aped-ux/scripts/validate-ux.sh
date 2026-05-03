#!/usr/bin/env bash
# Validate UX design spec completeness
# Usage: validate-ux.sh <ux-dir>
# Exit 0 if valid, exit 1 with missing items listed

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <ux-directory>"
  exit 1
fi

UX_DIR="$1"

if [[ ! -d "$UX_DIR" ]]; then
  echo "ERROR: Directory not found: $UX_DIR"
  exit 1
fi

ISSUES=()

# Check required output files
REQUIRED_FILES=(
  "design-spec.md"
  "screen-inventory.md"
  "components.md"
  "flows.md"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$UX_DIR/$file" ]]; then
    ISSUES+=("MISSING FILE: $UX_DIR/$file")
  fi
done

# Check design-spec.md has required sections
if [[ -f "$UX_DIR/design-spec.md" ]]; then
  SPEC_SECTIONS=(
    "## Tech Stack"
    "## Architecture"
    "## Conventions"
    "## Dependencies"
  )

  # Reuse pattern: check for sections about design tokens and UI library
  if ! grep -q "color\|Color\|palette\|token" "$UX_DIR/design-spec.md" 2>/dev/null; then
    ISSUES+=("MISSING CONTENT: design-spec.md has no color/token definitions")
  fi

  if ! grep -q "typography\|Typography\|font\|Font" "$UX_DIR/design-spec.md" 2>/dev/null; then
    ISSUES+=("MISSING CONTENT: design-spec.md has no typography definitions")
  fi
fi

# Check screen-inventory.md has content
if [[ -f "$UX_DIR/screen-inventory.md" ]]; then
  SCREEN_COUNT=$({ grep -E '^\|.*\|.*\|' "$UX_DIR/screen-inventory.md" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [[ "$SCREEN_COUNT" -lt 3 ]]; then
    ISSUES+=("LOW SCREEN COUNT: Found $SCREEN_COUNT screens (expected at least 3)")
  fi
fi

# Check components.md has component entries
if [[ -f "$UX_DIR/components.md" ]]; then
  COMP_COUNT=$({ grep -E '^#{2,3} ' "$UX_DIR/components.md" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [[ "$COMP_COUNT" -lt 3 ]]; then
    ISSUES+=("LOW COMPONENT COUNT: Found $COMP_COUNT components (expected at least 3)")
  fi
fi

# Check preview app exists
PREVIEW_DIR="${UX_DIR}-preview"
if [[ -d "$PREVIEW_DIR" ]]; then
  if [[ ! -f "$PREVIEW_DIR/package.json" ]]; then
    ISSUES+=("MISSING: Preview app has no package.json")
  fi
  if [[ ! -d "$PREVIEW_DIR/src" ]]; then
    ISSUES+=("MISSING: Preview app has no src/ directory")
  fi
else
  ISSUES+=("WARNING: No preview app at $PREVIEW_DIR (optional but recommended)")
fi

# Report
if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo "UX VALIDATION FAILED — Issues found:"
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue"
  done
  exit 1
fi

echo "UX VALIDATION PASSED — All required files and content present"
exit 0
