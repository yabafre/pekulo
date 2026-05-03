#!/usr/bin/env bash
# APED validate-state — check that state.yaml is syntactically valid,
# every story status is in the allowed whitelist, and the schema version
# is one this build understands. Skills call this at Setup so a hand-
# edited or half-corrupted state.yaml produces a clear message instead
# of silent grep/awk failures downstream.
#
# Schema versions: this script knows about version(s) listed in
# KNOWN_SCHEMA_VERSIONS below. Bumping the schema requires an explicit
# migration before this script will accept the file again.
#
# Exit codes:
#   0 ok
#   1 state.yaml missing
#   2 yaml parse error (if yq is available)
#   3 invalid status value
#   4 unknown schema_version (refuse to operate)

set -u
set -o pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
BACKUP_FILE="$PROJECT_ROOT/.aped/state.yaml.backup"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: $STATE_FILE not found." >&2
  if [[ -f "$BACKUP_FILE" ]]; then
    echo "HINT: a backup exists at $BACKUP_FILE — restore with: cp $BACKUP_FILE $STATE_FILE" >&2
  fi
  exit 1
fi

# ── YAML syntax (best-effort via yq if present) ──────────────────────────
if command -v yq >/dev/null 2>&1; then
  if ! yq eval 'true' "$STATE_FILE" >/dev/null 2>&1; then
    echo "ERROR: $STATE_FILE is not valid YAML." >&2
    if [[ -f "$BACKUP_FILE" ]]; then
      echo "HINT: backup at $BACKUP_FILE — inspect with: diff $STATE_FILE $BACKUP_FILE" >&2
    fi
    exit 2
  fi
fi

# ── Schema version check ─────────────────────────────────────────────────
# Hand-edited state.yaml may omit schema_version (legacy files); accept
# missing as version 1 so existing projects keep working until they bump.
# v1 → v2 migration (4.1.0) splits `corrections:` out into a sibling file
# (`corrections_pointer` + `corrections_count` mirror in state.yaml).
# Schema versions beyond KNOWN_SCHEMA_VERSIONS — refuse with a clear hint
# instead of silently best-effort-parsing a future shape.
KNOWN_SCHEMA_VERSIONS="1 2"
schema_version="1"
if command -v yq >/dev/null 2>&1; then
  schema_version=$(yq eval '.schema_version // 1' "$STATE_FILE" 2>/dev/null || echo "1")
else
  v=$(grep -E '^schema_version:' "$STATE_FILE" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*//;s/["[:space:]]//g')
  [[ -n "$v" ]] && schema_version="$v"
fi
# Normalize 1.0 → 1 so the grep+sed branch agrees with yq's int-coerce.
# YAML treats `1` and `1.0` as the same scalar; this script must too.
schema_version=${schema_version%.0}
if ! grep -qw "$schema_version" <<< "$KNOWN_SCHEMA_VERSIONS"; then
  echo "ERROR: state.yaml schema_version=$schema_version is not understood by this APED build (known: $KNOWN_SCHEMA_VERSIONS). This state.yaml requires a newer APED — upgrade aped-method (`npm i -g aped-method@latest`) and re-run, or run aped/scripts/migrate-state.sh if a downgrade is intended. Do not edit state.yaml manually." >&2
  exit 4
fi

# ── Top-level block recognition (warn-only on unknown) ───────────────────
# Forward-compat: skills may grow new top-level blocks (e.g. `metrics:`,
# `releases:`) that older APED installs don't understand. Treat unknown
# top-level keys as a non-fatal warning so a project on a slightly newer
# template still validates on an older CLI. Known set tracks the canonical
# blocks declared by config.js + the documented schema-extension slots.
KNOWN_TOP_LEVEL_BLOCKS_V1="schema_version pipeline sprint ticket_sync backlog_future_scope corrections"
KNOWN_TOP_LEVEL_BLOCKS_V2="schema_version pipeline sprint ticket_sync backlog_future_scope corrections_pointer corrections_count"
case "$schema_version" in
  2) KNOWN_TOP_LEVEL_BLOCKS="$KNOWN_TOP_LEVEL_BLOCKS_V2" ;;
  *) KNOWN_TOP_LEVEL_BLOCKS="$KNOWN_TOP_LEVEL_BLOCKS_V1" ;;
esac

# In v2, top-level `corrections:` is a hard error — the migration moves it
# to the sister file pointed to by `corrections_pointer` (default
# `${output_path}/state-corrections.yaml`) and replaces it with a pointer. A residual
# top-level `corrections:` after migration means manual editing or a botched
# migration; either way the audit invariant ("one source of truth for
# corrections") is broken. Surface it loudly.
if [[ "$schema_version" == "2" ]] && grep -qE '^corrections:' "$STATE_FILE" 2>/dev/null; then
  echo "ERROR: state.yaml schema_version=2 but a top-level \`corrections:\` block is still present. In v2 corrections live in the file pointed to by \`corrections_pointer\`. Run \`bash .aped/scripts/migrate-state.sh\` to migrate, or remove the residual top-level block manually." >&2
  exit 4
fi

while IFS= read -r block; do
  [[ -z "$block" ]] && continue
  if ! grep -qw "$block" <<< "$KNOWN_TOP_LEVEL_BLOCKS"; then
    echo "WARN: unknown top-level block '$block' in state.yaml — proceeding (forward-compat). Verify this isn't a typo of a known block." >&2
  fi
done < <(grep -E '^[a-zA-Z_][a-zA-Z0-9_-]*:' "$STATE_FILE" 2>/dev/null | sed 's/:.*//' | sort -u || true)

# ── Status whitelist check (grep-based, dependency-free) ─────────────────
# Accepted statuses: pending | ready-for-dev | in-progress | dev-done |
# review | review-queued | review-done | done
VALID_STATUSES_PATTERN='(pending|ready-for-dev|in-progress|dev-done|review|review-queued|review-done|done)'

# Extract all status: "xxx" lines and complain about any that don't match.
invalid_found=0
while IFS= read -r line; do
  # Skip comment lines and empty status values
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  val=$(echo "$line" | sed -E 's/.*status:[[:space:]]*"?([^"#]*)"?.*/\1/' | sed 's/[[:space:]]*$//')
  [[ -z "$val" ]] && continue
  if ! [[ "$val" =~ ^${VALID_STATUSES_PATTERN}$ ]]; then
    echo "ERROR: invalid story status '$val' in state.yaml" >&2
    invalid_found=1
  fi
done < <(grep -E '^[[:space:]]+status:' "$STATE_FILE" 2>/dev/null || true)

if (( invalid_found )); then
  echo "HINT: valid values are: pending, ready-for-dev, in-progress, dev-done, review, review-queued, review-done, done" >&2
  exit 3
fi

exit 0
