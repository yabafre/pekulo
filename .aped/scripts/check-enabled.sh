#!/usr/bin/env bash
# Activation guard for APED skills (6.2.0).
# Exit 0  → APED is enabled, skill body should proceed.
# Exit 1  → APED is disabled, skill body should HALT silently with the
#          one-liner: "APED disabled — run aped-method enable".
#
# Two short-circuits, in order:
#   1. ${APED_DIR}/.DISABLED marker file present  → disabled.
#   2. ${APED_DIR}/config.yaml has `aped.enabled: false` (top-level
#      block) → disabled.
# Anything else → enabled (the default for fresh installs).

set -euo pipefail

# Resolve APED_DIR robustly. Skill bodies pass {{APED_DIR}} as an arg or
# via env; if neither is provided, fall back to .aped relative to PWD.
APED_DIR="${APED_DIR:-${1:-.aped}}"

if [[ -f "${APED_DIR}/.DISABLED" ]]; then
  exit 1
fi

CONFIG="${APED_DIR}/config.yaml"
if [[ -f "$CONFIG" ]]; then
  # Match `aped:` block followed (within ~5 lines) by `enabled: false`.
  # Tolerant of leading whitespace and inline comments.
  if awk '
    /^aped:[[:space:]]*$/ { in_block=1; lines=0; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block {
      lines++
      if (lines > 6) { in_block=0; next }
      if ($0 ~ /^[[:space:]]+enabled:[[:space:]]*false([[:space:]]|#|$)/) {
        print "DISABLED"; exit
      }
    }
  ' "$CONFIG" | grep -q DISABLED; then
    exit 1
  fi
fi

exit 0
