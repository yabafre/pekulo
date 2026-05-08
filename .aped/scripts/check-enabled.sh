#!/usr/bin/env bash
# Activation guard for APED skills (6.2.0; local-override added 6.3.3).
# Exit 0  → APED is enabled, skill body should proceed.
# Exit 1  → APED is disabled, skill body should HALT silently with the
#          one-liner: "APED disabled — run aped-method enable".
#
# Three short-circuits, in order:
#   1. ${APED_DIR}/.DISABLED marker file present  → disabled.
#   2. ${APED_DIR}/config.local.yaml has `aped.enabled: false` →
#      disabled. (6.3.3 — gitignored per-developer override written by
#      `aped-method disable --local`. Takes precedence over config.yaml.)
#   3. ${APED_DIR}/config.yaml has `aped.enabled: false` → disabled.
# Anything else → enabled (the default for fresh installs).

set -euo pipefail

# Resolve APED_DIR robustly. Skill bodies pass {{APED_DIR}} as an arg or
# via env; if neither is provided, fall back to .aped relative to PWD.
APED_DIR="${APED_DIR:-${1:-.aped}}"

if [[ -f "${APED_DIR}/.DISABLED" ]]; then
  exit 1
fi

# Reusable matcher — searches for an `aped:` block followed (within ~6
# lines) by `enabled: false`. Returns 0 (match) / 1 (no match).
_aped_disabled_in_yaml() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  awk '
    /^aped:[[:space:]]*$/ { in_block=1; lines=0; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block {
      lines++
      if (lines > 6) { in_block=0; next }
      if ($0 ~ /^[[:space:]]+enabled:[[:space:]]*false([[:space:]]|#|$)/) {
        print "DISABLED"; exit
      }
    }
  ' "$file" | { grep -q DISABLED || return 1; }
}

# 6.3.3 — local override takes precedence over the team-shared config.yaml.
if _aped_disabled_in_yaml "${APED_DIR}/config.local.yaml"; then
  exit 1
fi

if _aped_disabled_in_yaml "${APED_DIR}/config.yaml"; then
  exit 1
fi

exit 0
