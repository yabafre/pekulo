#!/usr/bin/env bash
# APED placeholder lint — checks an artefact file for unmistakable
# placeholder strings that downstream skills shouldn't have to interpret.
#
# Usage: lint-placeholders.sh <file>
# Exit:  0 = clean, 1 = hits found, 2 = file or config error.
# Stdout (on hits): "<file>:<line>: <RULE_ID>: <matched-line>"
#
# Mustache tokens ({{var}} and {var}) are scrubbed before scanning so
# they never trip the lint. Lone ellipsis on its own line or as a table
# cell is flagged. Disabled when config.yaml has
# placeholder_lint.enabled: false.

set -u
set -o pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <file>" >&2
  exit 2
fi

FILE="$1"

if [[ ! -f "$FILE" ]]; then
  echo "lint-placeholders: file not found: $FILE" >&2
  exit 2
fi

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
CONFIG_FILE=""
for candidate in "$PROJECT_ROOT/.aped/config.yaml" "$PROJECT_ROOT/.aped/config.yaml"; do
  if [[ -f "$candidate" ]]; then CONFIG_FILE="$candidate"; break; fi
done

# Kill-switch: `placeholder_lint: { enabled: false }` in config.yaml means
# silent exit 0 regardless of file contents.
if [[ -n "$CONFIG_FILE" ]]; then
  # Match the line under `placeholder_lint:` block. We can't rely on yq
  # (not always present) so use a 2-line awk window.
  # Anchored on the exact key (avoids matching siblings like
  # placeholder_lint_legacy:) and only accepts `enabled:` at exactly
  # 2-space indent (the canonical YAML child level), so deeply-nested
  # keys (e.g. placeholder_lint.rules.enabled) cannot poison the kill
  # switch. Trailing `# comment` is stripped before comparison.
  ENABLED=$(awk '
    /^placeholder_lint:[[:space:]]*$/ { in_block=1; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block && /^  enabled:/ {
      sub(/^  enabled:[[:space:]]*/, "")
      sub(/[ \t]*#.*$/, "")
      gsub(/["'\'' ]/, "")
      print
      exit
    }
  ' "$CONFIG_FILE" 2>/dev/null || true)
  if [[ "$ENABLED" == "false" ]]; then
    exit 0
  fi
fi

# Scrub mustache tokens: {{var}} and {var} where the inner content is plain
# alphanumeric+underscore. Math/code expressions like {x|x>0} are left alone.
# Then blank out lines between `<!-- aped-lint-disable -->` and
# `<!-- aped-lint-enable -->` markers (line count preserved so reported
# line numbers still match the original file). Reference docs that need to
# quote the banned tokens use these markers; they should never wrap large
# regions silently — keep the disabled span tight.
SCRUBBED=$(mktemp 2>/dev/null || echo "/tmp/aped-lint-$$")
trap 'rm -f "$SCRUBBED"' EXIT
sed -E 's/\{\{[A-Za-z0-9_]+\}\}//g; s/\{[A-Za-z0-9_]+\}//g' "$FILE" \
  | awk -v FNAME="$FILE" '
      /<!--[[:space:]]*aped-lint-disable[[:space:]]*-->/ { skipping=1; print ""; next }
      /<!--[[:space:]]*aped-lint-enable[[:space:]]*-->/  { skipping=0; print ""; next }
      skipping { print ""; next }
      { print }
      END {
        if (skipping) {
          # Unbalanced disable marker — file ended without aped-lint-enable.
          # Without this warning, the rest of the file is silently exempt.
          print "lint-placeholders: WARN: " FNAME " has unbalanced aped-lint-disable (no matching aped-lint-enable). Lint may have skipped real placeholders." > "/dev/stderr"
        }
      }
    ' > "$SCRUBBED"

HITS=""

emit_match() {
  # $1 = rule_id, $2 = grep output (lineno:content)
  local rule_id="$1" grep_output="$2" line lineno content
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    lineno=$(printf '%s' "$line" | cut -d: -f1)
    content=$(printf '%s' "$line" | cut -d: -f2-)
    HITS="${HITS}${FILE}:${lineno}: ${rule_id}: ${content}
"
  done <<< "$grep_output"
}

scan_cs() { # case-sensitive
  local matches
  matches=$(grep -nE "$2" "$SCRUBBED" 2>/dev/null || true)
  [[ -n "$matches" ]] && emit_match "$1" "$matches"
}

scan_ci() { # case-insensitive
  local matches
  matches=$(grep -niE "$2" "$SCRUBBED" 2>/dev/null || true)
  [[ -n "$matches" ]] && emit_match "$1" "$matches"
}

# Banned phrases. Order matters only for output stability.
scan_cs TBD                  '\bTBD\b'
scan_cs TODO                 '\bTODO\b'
scan_cs FIXME                '\bFIXME\b'
scan_cs XXX                  '\bXXX\b'
scan_ci PLACEHOLDER_TAG      '<placeholder>'
scan_ci PLACEHOLDER_HTML     '<!-- placeholder'
scan_ci ADD_ERROR_HANDLING   'add appropriate error handling'
scan_ci SIMILAR_TO_STORY     'similar to story [A-Za-z0-9-]'
scan_ci SIMILAR_TO_TASK      'similar to task [A-Za-z0-9-]'
scan_ci IMPLEMENT_LATER      'implement later'
scan_ci TO_BE_DEFINED        'to be defined'
scan_ci TO_BE_DETERMINED     'to be determined'

# Lone-ellipsis: line is just "..." (3+ dots) or appears as a table cell.
LONE=$(grep -nE '^[[:space:]]*\.{3,}[[:space:]]*$|\|[[:space:]]*\.{3,}[[:space:]]*\|' "$SCRUBBED" 2>/dev/null || true)
[[ -n "$LONE" ]] && emit_match LONE_ELLIPSIS "$LONE"

if [[ -n "$HITS" ]]; then
  printf '%s' "$HITS"
  exit 1
fi

exit 0
