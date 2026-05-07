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
# v2 → v3 migration (6.1.0) moves `sprint.parallel_limit` and
# `sprint.review_limit` out to config.yaml.sprint.* (preferences, not
# runtime state). Skill readers fall back to state.yaml for v2 scaffolds.
# Schema versions beyond KNOWN_SCHEMA_VERSIONS — refuse with a clear hint
# instead of silently best-effort-parsing a future shape.
KNOWN_SCHEMA_VERSIONS="1 2 3"
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
KNOWN_TOP_LEVEL_BLOCKS_V3="$KNOWN_TOP_LEVEL_BLOCKS_V2"
case "$schema_version" in
  3) KNOWN_TOP_LEVEL_BLOCKS="$KNOWN_TOP_LEVEL_BLOCKS_V3" ;;
  2) KNOWN_TOP_LEVEL_BLOCKS="$KNOWN_TOP_LEVEL_BLOCKS_V2" ;;
  *) KNOWN_TOP_LEVEL_BLOCKS="$KNOWN_TOP_LEVEL_BLOCKS_V1" ;;
esac

# In v2+, top-level `corrections:` is a hard error — the migration moves it
# to the sister file pointed to by `corrections_pointer` (default
# `${output_path}/state-corrections.yaml`) and replaces it with a pointer. A residual
# top-level `corrections:` after migration means manual editing or a botched
# migration; either way the audit invariant ("one source of truth for
# corrections") is broken. Surface it loudly.
if [[ "$schema_version" == "2" || "$schema_version" == "3" ]] && grep -qE '^corrections:' "$STATE_FILE" 2>/dev/null; then
  echo "ERROR: state.yaml schema_version=$schema_version but a top-level \`corrections:\` block is still present. In v2+ corrections live in the file pointed to by \`corrections_pointer\`. Run \`bash .aped/scripts/migrate-state.sh\` to migrate, or remove the residual top-level block manually." >&2
  exit 4
fi

# In v3, `sprint.parallel_limit` and `sprint.review_limit` MUST live in
# config.yaml, not state.yaml. A residual mention here points at an
# incomplete v2→v3 migration; the migration tool moves them to config.yaml
# and deletes them from state.yaml in lock-step.
if [[ "$schema_version" == "3" ]] && command -v yq >/dev/null 2>&1; then
  for runtime_pref in parallel_limit review_limit; do
    val=$(yq eval ".sprint.$runtime_pref // \"\"" "$STATE_FILE" 2>/dev/null || echo "")
    if [[ -n "$val" && "$val" != "null" ]]; then
      echo "ERROR: state.yaml schema_version=3 still has \`sprint.$runtime_pref\` — this preference moved to config.yaml in v3. Run \`bash .aped/scripts/migrate-state.sh\` to complete the migration, or remove the field manually." >&2
      exit 4
    fi
  done
fi

# In v3, when a sprint is active (`sprint.active_epic` is set), the
# umbrella branch MUST be recorded — every story branch parents under it
# and aped-ship reads it as the only thing it ships. Missing umbrella
# while active_epic is set means the sprint was started before the
# umbrella convention or someone hand-edited state.yaml. Surface it
# rather than letting aped-ship blow up later with a cryptic null.
if [[ "$schema_version" == "3" ]] && command -v yq >/dev/null 2>&1; then
  active_epic=$(yq eval '.sprint.active_epic // ""' "$STATE_FILE" 2>/dev/null || echo "")
  if [[ -n "$active_epic" && "$active_epic" != "null" ]]; then
    umbrella=$(yq eval '.sprint.umbrella_branch // ""' "$STATE_FILE" 2>/dev/null || echo "")
    if [[ -z "$umbrella" || "$umbrella" == "null" ]]; then
      echo "ERROR: state.yaml has \`sprint.active_epic: $active_epic\` but no \`sprint.umbrella_branch\`. Re-run aped-sprint to create+record the umbrella, or unset active_epic to abandon the sprint." >&2
      exit 4
    fi
  fi
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

# ── Strict schema validation (6.2.0+, WARN-only) ─────────────────────────
# Validate state.yaml against the canonical JSON Schema v3 shipped at
# ${APED_DIR}/data/state.yaml.schema.v3.json. Surfaces drift (invented
# sub-blocks, free-form story fields, out-of-taxonomy phase shapes) as
# stderr warnings. WARN-only in 6.2.0 — escalates to ERROR in 7.0.0
# after one MINOR cycle of grace.
#
# Lazy + optional dependencies: yq (YAML->JSON) + npx + ajv-cli. Any
# missing piece triggers a skip with a one-line stderr note. CI pipelines
# without yq or outbound npm access stay green.
if [[ "$schema_version" == "3" ]]; then
  schema_file="$PROJECT_ROOT/.aped/data/state.yaml.schema.v3.json"
  if [[ ! -f "$schema_file" ]]; then
    echo "WARN: schema check skipped ($schema_file not found - re-run \`aped-method --update\` to scaffold it)" >&2
  elif ! command -v yq >/dev/null 2>&1; then
    echo "WARN: schema check skipped (yq not installed)" >&2
  elif ! command -v npx >/dev/null 2>&1; then
    echo "WARN: schema check skipped (npx not installed)" >&2
  else
    # mktemp on macOS ignores the .json template suffix; add it ourselves
    # so ajv-cli detects the file as JSON (it dispatches by extension).
    json_tmp_dir=$(mktemp -d -t aped-state-XXXXXX 2>/dev/null || mktemp -d)
    json_tmp="$json_tmp_dir/state.json"
    if ! yq eval -o=json '.' "$STATE_FILE" > "$json_tmp" 2>/dev/null; then
      rm -rf "$json_tmp_dir"
      echo "WARN: schema check skipped (yq could not convert state.yaml to JSON)" >&2
    else
      ajv_output=$(npx --yes ajv-cli@^5 validate \
        --spec=draft2019 \
        --strict=false \
        -s "$schema_file" \
        -d "$json_tmp" 2>&1) || ajv_status=$?
      ajv_status=${ajv_status:-0}
      rm -rf "$json_tmp_dir"
      if [[ "$ajv_status" == "127" ]]; then
        echo "WARN: schema check skipped (npx ajv-cli unavailable - offline or sandboxed)" >&2
      elif [[ "$ajv_status" != "0" ]]; then
        echo "WARN: state.yaml does not match schema v3 (drift detected - see below). 6.2.0 is WARN-only; 7.0.0 will refuse to operate. Run \`aped-method --update\` to ship the latest schema; fix or re-route invented fields." >&2
        printf '%s\n' "$ajv_output" | head -40 >&2
      fi
    fi
  fi
fi

exit 0
