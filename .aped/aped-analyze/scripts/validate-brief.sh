#!/usr/bin/env bash
# Validate product brief has all required sections
# Usage: validate-brief.sh <brief-file>
# Exit 0 if valid, exit 1 with missing sections listed

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <brief-file>"
  exit 1
fi

FILE="$1"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: File not found: $FILE"
  exit 1
fi

REQUIRED_SECTIONS=(
  "## Executive Summary"
  "## Core Vision"
  "## Target Users"
  "## Success Metrics"
  "## MVP Scope"
)

MISSING=()

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -q "$section" "$FILE"; then
    MISSING+=("$section")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "VALIDATION FAILED — Missing sections:"
  for m in "${MISSING[@]}"; do
    echo "  - $m"
  done
  exit 1
fi

echo "VALIDATION PASSED — All required sections present"
exit 0
