#!/usr/bin/env bash
# APED package-runner detection.
#
# Usage:   PKG=$(bash .aped/scripts/detect-package-runner.sh [<dir>])
#          $PKG install
#          $PKG run typecheck
#
# <dir> defaults to the current working directory. Resolves the active
# JS package runner (npm / yarn / pnpm / bun) from lockfile presence,
# falling back to npm if no lockfile is found. The decision is intentionally
# pure — no detection of `packageManager` field, no version pinning —
# because we are asking "what runs commands here right now", not "what
# would a human prefer".
#
# Exit codes:
#   0  resolved a runner; printed on stdout.
#   2  no `package.json` at <dir> (so the question is malformed).
#
# Decision order (first match wins):
#   bun.lockb        → bun
#   pnpm-lock.yaml   → pnpm
#   yarn.lock        → yarn
#   package-lock.json → npm
#   no lockfile      → npm  (vanilla default)

set -eu -o pipefail

dir="${1:-$PWD}"

if [[ ! -f "$dir/package.json" ]]; then
  echo "ERROR: no package.json at $dir — package-runner detection is undefined." >&2
  exit 2
fi

if [[ -f "$dir/bun.lockb" ]]; then
  echo "bun"
elif [[ -f "$dir/pnpm-lock.yaml" ]]; then
  echo "pnpm"
elif [[ -f "$dir/yarn.lock" ]]; then
  echo "yarn"
else
  echo "npm"
fi
