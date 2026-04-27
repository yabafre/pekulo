#!/usr/bin/env bash
# Compare git changes vs story file list
# Usage: git-audit.sh <story-file> [commits-back]
# Exit 0 if clean, exit 1 if HIGH severity discrepancies

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <story-file> [commits-back]"
  exit 1
fi

STORY_FILE="$1"
COMMITS_BACK="${2:-10}"

if [[ ! -f "$STORY_FILE" ]]; then
  echo "ERROR: Story file not found: $STORY_FILE"
  exit 1
fi

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "WARNING: Not a git repository. Skipping git audit."
  exit 0
fi

# Extract file list from story's Dev Agent Record section
STORY_FILES=$(sed -n '/^### File List/,/^##/p' "$STORY_FILE" | grep -E '^\s*[-*]' | sed 's/^[[:space:]]*[-*][[:space:]]*//' | sort -u)

# Get git changed files
GIT_FILES=$(git diff --name-only "HEAD~${COMMITS_BACK}" HEAD 2>/dev/null | sort -u)

if [[ -z "$GIT_FILES" ]]; then
  echo "WARNING: No git changes found in last $COMMITS_BACK commits"
  exit 0
fi

# Compare
IN_GIT_NOT_STORY=()
IN_STORY_NOT_GIT=()

while IFS= read -r file; do
  if [[ -n "$file" ]] && ! echo "$STORY_FILES" | grep -qF "$file"; then
    IN_GIT_NOT_STORY+=("$file")
  fi
done <<< "$GIT_FILES"

while IFS= read -r file; do
  if [[ -n "$file" ]] && ! echo "$GIT_FILES" | grep -qF "$file"; then
    IN_STORY_NOT_GIT+=("$file")
  fi
done <<< "$STORY_FILES"

# Report
echo "=== GIT AUDIT REPORT ==="
echo "Story: $STORY_FILE"
echo "Git range: HEAD~${COMMITS_BACK}..HEAD"
echo ""

HAS_ISSUES=false

if [[ ${#IN_GIT_NOT_STORY[@]} -gt 0 ]]; then
  echo "[MEDIUM] Files changed in git but NOT listed in story:"
  for f in "${IN_GIT_NOT_STORY[@]}"; do
    echo "  - $f"
  done
  echo ""
  HAS_ISSUES=true
fi

if [[ ${#IN_STORY_NOT_GIT[@]} -gt 0 ]]; then
  echo "[HIGH] Files listed in story but NO git changes:"
  for f in "${IN_STORY_NOT_GIT[@]}"; do
    echo "  - $f"
  done
  echo ""
  HAS_ISSUES=true
fi

if [[ "$HAS_ISSUES" == "false" ]]; then
  echo "No discrepancies found. Git changes match story file list."
  exit 0
fi

# Exit 1 if HIGH severity items found
if [[ ${#IN_STORY_NOT_GIT[@]} -gt 0 ]]; then
  exit 1
fi

exit 0
