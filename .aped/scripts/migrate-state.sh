#!/usr/bin/env bash
# APED migrate-state — schema_version migration framework.
#
# 4.1.0 — first real migration: v1 → v2 splits the top-level `corrections`
# block out into a sibling file at the path read from `state.corrections_path`
# in config.yaml (default `${o}/state-corrections.yaml` — tracks the
# project's output_path). The state.yaml
# gains a `corrections_pointer` (path string) and `corrections_count`
# (length cache for fast reads) at the top level; `corrections:` is removed.
#
# Idempotent: running on v2 is a no-op. Always writes a backup at
# `docs/state.yaml.pre-v2-migration.bak` BEFORE any mutation, so a botched
# migration is recoverable with `mv state.yaml.pre-v2-migration.bak state.yaml`.
#
# Usage: migrate-state.sh
#
# Exit codes:
#   0 ok (no migration needed, or migration applied)
#   1 unsupported schema_version — caller must upgrade aped-method
#   3 missing dependency (yq required for v1→v2)
#   4 state.yaml missing or malformed

set -uo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
STATE_FILE="$PROJECT_ROOT/docs/state.yaml"
APED_DIR_ABS="$PROJECT_ROOT/.aped"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: state.yaml not found at $STATE_FILE" >&2
  exit 4
fi

# Read schema_version. Missing → implicit 1 (matches validate-state.sh).
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

if ! [[ "$schema_version" =~ ^[0-9]+$ ]]; then
  echo "ERROR: malformed schema_version='$schema_version' in $STATE_FILE — expected an integer." >&2
  exit 4
fi

# Read state.corrections_path from config.yaml — returns default if absent.
read_corrections_path() {
  local default="docs/state-corrections.yaml"
  local cfg=""
  for candidate in "$APED_DIR_ABS/config.yaml" "$PROJECT_ROOT/.aped/config.yaml"; do
    if [[ -f "$candidate" ]]; then cfg="$candidate"; break; fi
  done
  [[ -n "$cfg" ]] || { echo "$default"; return; }
  local got
  got=$(awk '
    /^state:[[:space:]]*$/ { in_block=1; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block && /^  corrections_path:/ {
      sub(/^  corrections_path:[[:space:]]*/, "")
      sub(/[ \t]*#.*$/, "")
      gsub(/^[ \t"'\'']+|[ \t"'\'']+$/, "")
      print
      exit
    }
  ' "$cfg" 2>/dev/null)
  [[ -n "$got" ]] && echo "$got" || echo "$default"
}

migrate_v1_to_v2() {
  if ! command -v yq >/dev/null 2>&1; then
    echo "ERROR: v1 → v2 migration requires \`yq\` to manipulate YAML structurally. Install yq (\`brew install yq\` or \`npm i -g yq\`) and re-run \`aped-method --update\`." >&2
    return 3
  fi

  local corrections_path
  corrections_path=$(read_corrections_path)
  local corrections_abs="$PROJECT_ROOT/$corrections_path"
  local backup="$PROJECT_ROOT/docs/state.yaml.pre-v2-migration.bak"

  echo "Migrating state.yaml schema 1 → 2 (extracting corrections to $corrections_path)..." >&2

  # 1. Backup before any mutation. On failure here, abort: better fail
  # cleanly than mutate without rollback.
  if ! cp -f "$STATE_FILE" "$backup"; then
    echo "ERROR: failed to write backup at $backup — aborting migration." >&2
    return 1
  fi

  # 2. Read existing corrections array from state.yaml. yq returns "[]" if
  # the key is missing or null — so length(0) is the correct count for an
  # empty/absent corrections block.
  local corrections_yaml count
  corrections_yaml=$(yq eval '.corrections // []' "$STATE_FILE")
  count=$(yq eval '.corrections // [] | length' "$STATE_FILE")
  [[ -z "$count" || "$count" == "null" ]] && count=0

  # 3. Write to corrections file. If file exists with content, append-merge
  # (defensive — covers the edge case of partial migration retry where a
  # previous run wrote the sister file but failed to mutate state.yaml).
  #
  # 4.1.2 fix: the previous `yq eval-all` recipe emitted MULTI-DOCUMENT YAML
  # because eval-all over N inputs produces N output documents by default.
  # That corrupted the sister file (multi-doc) and made the downstream
  # `length` read return multi-line garbage, which then broke the state.yaml
  # mutation's count interpolation. Now we extract corrections from each
  # input as a single doc and combine via `load()` in a single -n eval —
  # guaranteed single-document output.
  mkdir -p "$(dirname "$corrections_abs")"
  local corrections_tmp
  corrections_tmp=$(mktemp "$(dirname "$corrections_abs")/.state-corrections.XXXXXX")
  if [[ -f "$corrections_abs" ]] && [[ -s "$corrections_abs" ]]; then
    # Merge path: read both as separate single-doc files, combine via yq -n + load().
    local incoming_yaml existing_yaml
    incoming_yaml=$(mktemp "$(dirname "$corrections_abs")/.incoming.XXXXXX.yaml")
    existing_yaml=$(mktemp "$(dirname "$corrections_abs")/.existing.XXXXXX.yaml")
    yq eval '.corrections // []' "$STATE_FILE" > "$incoming_yaml"
    # Sister file may itself be multi-doc from a pre-4.1.2 botched migration.
    # Take only the FIRST doc to avoid carrying the corruption forward.
    yq eval-all 'select(documentIndex == 0) | .corrections // []' "$corrections_abs" > "$existing_yaml"
    # Dedupe by (date, type, reason) — handles the common partial-migration
    # case where state.yaml.corrections is identical to (or a strict subset of)
    # the sister file from a previous attempt. Two legit corrections sharing
    # all three fields is exceptional; the trade-off favours recovery.
    #
    # Implementation note: `unique_by([.a, .b, .c])` compares array nodes
    # structurally and respects scalar style — so `type: minor` (plain) and
    # `type: "minor"` (quoted) are treated as DIFFERENT, even though they
    # represent the same string. We sidestep the issue by composing the key
    # via string concatenation, which coerces both to plain strings.
    yq eval -n "{\"corrections\": ((load(\"$existing_yaml\") + load(\"$incoming_yaml\")) | unique_by(.date + \"|\" + .type + \"|\" + .reason))}" > "$corrections_tmp"
    rm -f "$incoming_yaml" "$existing_yaml" 2>/dev/null || true
    count=$(yq eval '.corrections | length' "$corrections_tmp")
  else
    # Fresh-write path: state.yaml is the only source.
    yq eval '{"corrections": (.corrections // [])}' "$STATE_FILE" > "$corrections_tmp"
  fi

  # Sanity check the temp file before promoting it. Reject multi-document
  # output (regression guard for the 4.1.2 fix above — single-doc only).
  if ! yq eval 'true' "$corrections_tmp" >/dev/null 2>&1; then
    echo "ERROR: produced corrections file is not valid YAML ($corrections_tmp). State.yaml not yet mutated. Backup at $backup." >&2
    rm -f "$corrections_tmp" 2>/dev/null || true
    return 1
  fi
  if [[ $({ grep '^---' "$corrections_tmp" 2>/dev/null || true; } | wc -l | tr -d ' ') -gt 0 ]]; then
    echo "ERROR: produced corrections file is multi-document YAML ($corrections_tmp). This indicates a yq merge bug — please open an issue. State.yaml not yet mutated. Backup at $backup." >&2
    rm -f "$corrections_tmp" 2>/dev/null || true
    return 1
  fi
  mv -f "$corrections_tmp" "$corrections_abs"

  # 4. Mutate state.yaml: remove corrections, add pointer + count, bump
  # schema_version. All in one yq invocation = single atomic write.
  local state_tmp
  state_tmp=$(mktemp "$(dirname "$STATE_FILE")/.state.XXXXXX")
  cp -f "$STATE_FILE" "$state_tmp"
  yq eval -i "
    del(.corrections) |
    .corrections_pointer = \"$corrections_path\" |
    .corrections_count = $count |
    .schema_version = 2
  " "$state_tmp"

  if ! yq eval 'true' "$state_tmp" >/dev/null 2>&1; then
    echo "ERROR: produced state.yaml is not valid YAML. State unchanged. Backup at $backup; produced file at $state_tmp." >&2
    return 1
  fi
  mv -f "$state_tmp" "$STATE_FILE"

  echo "Migration complete. $count correction(s) moved. Backup at $backup." >&2
  return 0
}

# 4.1.2 self-heal: 4.1.0 / 4.1.1 hardcoded the corrections_pointer to
# the literal "docs/state-corrections.yaml" instead of interpolating the
# project's outputDir. For default scaffolds (outputDir=docs/aped/), the
# pointer was wrong by one level and append-correction silently wrote to
# docs/state-corrections.yaml — orphaning the docs/aped/state-corrections.yaml
# file shipped by the scaffold. Self-heal runs unconditionally (regardless
# of schema_version) so 4.1.0 / 4.1.1 users on v2 schema get fixed too on
# their next `aped-method --update`. Conservative: only retargets the
# pointer when the pointed-to file is empty / missing — never relocates
# user data. The user can move data manually via TROUBLESHOOTING.md §14.
#
# 4.1.3 fix: expected_pointer now comes from `read_corrections_path`
# (which reads `state.corrections_path` from config.yaml, falling back to
# ${o}/state-corrections.yaml). Previously it was hardcoded to the scaffold
# default, which silently overwrote any user-customized pointer the user
# had set in lock-step with config.yaml's state.corrections_path — breaking
# the documented "edit BOTH this key and the pointer" customization path
# whenever the target was empty/missing.
self_heal_corrections_pointer() {
  command -v yq >/dev/null 2>&1 || return 0
  local current_pointer expected_pointer
  current_pointer=$(yq eval '.corrections_pointer // ""' "$STATE_FILE" 2>/dev/null || echo "")
  [[ -z "$current_pointer" || "$current_pointer" == "null" ]] && return 0
  expected_pointer=$(read_corrections_path)
  [[ "$current_pointer" == "$expected_pointer" ]] && return 0
  local current_abs="$PROJECT_ROOT/$current_pointer"
  if [[ -s "$current_abs" ]]; then
    return 0
  fi
  yq eval -i ".corrections_pointer = \"$expected_pointer\"" "$STATE_FILE"
  echo "Self-healed corrections_pointer: $current_pointer → $expected_pointer (no data at the previous location, expected path read from state.corrections_path in config.yaml)." >&2
}
self_heal_corrections_pointer

case "$schema_version" in
  1)
    # Sub-case: if there's nothing to migrate (no corrections block at all),
    # we still bump schema + write the pointer + count=0 so subsequent calls
    # are no-ops. This keeps the validate-state.sh contract uniform.
    migrate_v1_to_v2
    exit $?
    ;;
  2)
    # Already on v2 — idempotent no-op (after self-heal above).
    exit 0
    ;;
  *)
    echo "ERROR: unsupported schema_version $schema_version; upgrade aped-method (\`npm i -g aped-method@latest\`) and retry." >&2
    exit 1
    ;;
esac
