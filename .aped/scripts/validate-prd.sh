#!/usr/bin/env bash
# Validate APED prd.md against the cohort-3 structural schema.
# Usage: validate-prd.sh <prd-file>
# Exit 0 conformant, 1 drift, 2 unreadable schema/target.

set -uo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <prd-file>" >&2
  exit 2
fi

TARGET="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APED_DIR_GUESS="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA="$APED_DIR_GUESS/data/prd.schema.json"
WALKER="$SCRIPT_DIR/lib/markdown-schema-walk.mjs"

if [[ ! -f "$WALKER" ]]; then
  echo "schema: walker not found at $WALKER (validators unavailable)" >&2
  exit 2
fi

exec node "$WALKER" "$SCHEMA" "$TARGET"
