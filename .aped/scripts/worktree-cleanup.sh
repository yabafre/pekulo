#!/usr/bin/env bash
# APED worktree-cleanup — remove a worktree (and optionally its branch) once
# a story has been merged. Run from the main project root.
#
# Usage: worktree-cleanup.sh <worktree-path> [--delete-branch] [--yes-destroy]
#
# Safe by default: refuses to drop a worktree with uncommitted changes or
# stashes. The previous version silently re-tried with --force on the first
# failure, which is exactly how a half-finished branch's local-only files
# disappear (.env tweaks, debug logs, an unstaged migration). To opt into
# destructive removal, pass --yes-destroy explicitly.

set -euo pipefail

WORKTREE_PATH=""
DELETE_BRANCH=false
YES_DESTROY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete-branch) DELETE_BRANCH=true; shift ;;
    --yes-destroy)   YES_DESTROY=true;   shift ;;
    --) shift; WORKTREE_PATH="${1:-}"; shift; break ;;
    -*) echo "Unknown flag: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$WORKTREE_PATH" ]]; then
        WORKTREE_PATH="$1"
      else
        echo "Unexpected positional argument: $1" >&2; exit 1
      fi
      shift
      ;;
  esac
done

[[ -n "$WORKTREE_PATH" ]] || {
  echo "Usage: $0 <worktree-path> [--delete-branch] [--yes-destroy]" >&2
  exit 1
}

if [[ ! -d "$WORKTREE_PATH" ]]; then
  echo "No such worktree: $WORKTREE_PATH" >&2
  exit 0
fi

BRANCH_NAMES=()
# Sequential mode (6.8.0+) writes per-story markers WORKTREE.<key>.yaml.
# Parallel mode writes a single WORKTREE file. We read BOTH unconditionally:
# a worktree migrated mid-flight may carry one legacy WORKTREE alongside the
# new per-story markers; without reading both, the legacy branch leaks.
shopt -s nullglob
for marker in "$WORKTREE_PATH/.aped"/WORKTREE.*.yaml; do
  b=$(grep '^branch:' "$marker" 2>/dev/null | sed 's/.*:[[:space:]]*//')
  [[ -n "$b" ]] && BRANCH_NAMES+=("$b")
done
shopt -u nullglob
if [[ -f "$WORKTREE_PATH/.aped/WORKTREE" ]]; then
  b=$(grep '^branch:' "$WORKTREE_PATH/.aped/WORKTREE" | sed 's/.*:[[:space:]]*//')
  [[ -n "$b" ]] && BRANCH_NAMES+=("$b")
fi

# Try a clean remove first.
if git worktree remove "$WORKTREE_PATH" 2>/dev/null; then
  :
else
  # Diagnose what's holding the worktree before deciding.
  echo "Cannot remove cleanly — worktree has local state:" >&2
  echo "" >&2
  echo "Uncommitted changes (git status --porcelain):" >&2
  git -C "$WORKTREE_PATH" status --porcelain | sed 's/^/  /' >&2 || true
  echo "" >&2
  echo "Stashes (git stash list):" >&2
  git -C "$WORKTREE_PATH" stash list | sed 's/^/  /' >&2 || true
  echo "" >&2

  if [[ "$YES_DESTROY" != "true" ]]; then
    echo "REFUSING to --force without --yes-destroy. Choose one:" >&2
    echo "  1. Commit/stash the work in the worktree, then re-run this script." >&2
    echo "  2. Re-run with --yes-destroy to discard the local state above." >&2
    exit 2
  fi

  echo "WARN: --yes-destroy specified — discarding the local state above." >&2
  git worktree remove --force "$WORKTREE_PATH"
fi

if [[ "$DELETE_BRANCH" == "true" && ${#BRANCH_NAMES[@]} -gt 0 ]]; then
  for b in "${BRANCH_NAMES[@]}"; do
    git branch -D "$b" 2>&1 || echo "Branch $b already gone or not fully merged"
  done
fi

git worktree prune
echo "Cleaned up $WORKTREE_PATH"
