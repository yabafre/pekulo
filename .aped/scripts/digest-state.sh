#!/usr/bin/env bash
# APED digest-state — render aped/state.yaml as a human-readable Markdown
# snapshot. Used by `aped-method state` (6.12.0+).
#
# Usage: digest-state.sh [--write]
#   --write : write to STATE.md at project root (default: stdout)
#
# Exit codes:
#   0 ok
#   1 state.yaml missing or project not initialised

set -uo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
WRITE_MODE="false"

if [[ "${1:-}" == "--write" ]]; then
  WRITE_MODE="true"
fi

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: state.yaml not found at $STATE_FILE" >&2
  echo "HINT: not an APED project, or pipeline never started. Run \`npx aped-method\` first." >&2
  exit 1
fi

# yq preferred (typed extraction); grep/awk fallback covers the canonical
# schema-v3/v4 shape produced by sync-state.sh and skill writers. Missing
# fields default to empty string (rendered as dash).
yq_get() {
  if command -v yq >/dev/null 2>&1; then
    yq eval "$1 // \"\"" "$STATE_FILE" 2>/dev/null
  fi
}

CURRENT_PHASE=$(yq_get '.pipeline.current_phase')
if [[ -z "$CURRENT_PHASE" || "$CURRENT_PHASE" == "null" ]]; then
  CURRENT_PHASE=$(awk '/^pipeline:/{p=1;next} p && /^[^[:space:]]/{p=0} p && /^  current_phase:/{sub(/^  current_phase:[[:space:]]*/,""); gsub(/["\x27]/,""); print; exit}' "$STATE_FILE")
fi
CURRENT_PHASE=${CURRENT_PHASE:-none}

PHASE_STATUS=$(yq_get ".pipeline.phases.${CURRENT_PHASE}.status")
PHASE_SUBPHASE=$(yq_get ".pipeline.phases.${CURRENT_PHASE}.current_subphase")
PHASE_DONE_COUNT=$(yq_get ".pipeline.phases.${CURRENT_PHASE}.completed_subphases | length")
PHASE_OUTPUT=$(yq_get ".pipeline.phases.${CURRENT_PHASE}.output")
PHASE_LAST_UPDATED=$(yq_get ".pipeline.phases.${CURRENT_PHASE}.last_updated")

WATCH_COUNT=$(yq_get '.pipeline.phases.architecture.watch_items | length')
GAP_COUNT=$(yq_get '.pipeline.phases.architecture.residual_gaps | length')
EPIC_ZERO_COUNT=$(yq_get '.pipeline.phases.architecture.epic_zero_stories | length')
WATCH_COUNT=${WATCH_COUNT:-0}
GAP_COUNT=${GAP_COUNT:-0}
EPIC_ZERO_COUNT=${EPIC_ZERO_COUNT:-0}
for var in WATCH_COUNT GAP_COUNT EPIC_ZERO_COUNT; do
  val="${!var}"
  if [[ "$val" == "" || "$val" == "null" ]]; then printf -v "$var" '%s' 0; fi
done

CORRECTIONS_COUNT=$(yq_get '.corrections_count')
if [[ -z "$CORRECTIONS_COUNT" || "$CORRECTIONS_COUNT" == "null" ]]; then
  CORRECTIONS_COUNT=0
fi

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DIGEST=$(cat <<DIGEST_EOF
# APED Pipeline Snapshot

> Generated $NOW by \`aped-method state\`. Refresh with \`aped-method state --write\`.

## Current phase

- **Phase:** \`$CURRENT_PHASE\`
- **Status:** \`${PHASE_STATUS:-not-started}\`
- **Subphase:** \`${PHASE_SUBPHASE:-—}\`
- **Completed subphases:** ${PHASE_DONE_COUNT:-0}
- **Output:** \`${PHASE_OUTPUT:-—}\`
- **Last updated:** \`${PHASE_LAST_UPDATED:-—}\`

## Architecture intake

- **Watch items (W):** $WATCH_COUNT
- **Residual gaps (G):** $GAP_COUNT
- **Epic Zero stories (E0):** $EPIC_ZERO_COUNT

## Corrections

- **Total recorded:** $CORRECTIONS_COUNT
DIGEST_EOF
)

if [[ "$WRITE_MODE" == "true" ]]; then
  TARGET="$PROJECT_ROOT/STATE.md"
  printf '%s\n' "$DIGEST" > "$TARGET"
  echo "Wrote $TARGET ($(wc -l < "$TARGET" | tr -d ' ') lines)" >&2
else
  printf '%s\n' "$DIGEST"
fi
exit 0
