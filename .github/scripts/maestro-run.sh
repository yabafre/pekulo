#!/usr/bin/env bash
# .github/scripts/maestro-run.sh — stories 10-5 / 10-6, used by e2e-mobile.yml.
# Runs Maestro flows against an already-booted device with the app installed.
#
#   maestro-run.sh <ios|android> <device-id> <flow-retry:0|1> <flow>...
#
# Env:
#   RESULTS_DIR      where per-flow test output goes (default: maestro-results)
#   UPDATE_GOLDENS   "true" → capture screenshots instead of asserting them
#   GOLDENS_OUT      where captured goldens are collected (default: maestro-goldens)
#
# The core flows get one flow-level retry (cheap); gallery shards pass 0 because
# every golden case already retries itself (Maestro `retry`), so a flake never
# replays the whole shard.
set -euo pipefail

PLATFORM="$1"
DEVICE="$2"
FLOW_RETRY="$3"
shift 3

RESULTS_DIR="${RESULTS_DIR:-maestro-results}"
GOLDENS_OUT="${GOLDENS_OUT:-maestro-goldens}"
UPDATE_GOLDENS="${UPDATE_GOLDENS:-false}"
export MAESTRO_CLI_NO_ANALYTICS=1
export PATH="$PATH:$HOME/.maestro/bin"

maestro --version
mkdir -p "$RESULTS_DIR"

args=(--device "$DEVICE")
if [ "$UPDATE_GOLDENS" = "true" ]; then
  args+=(-e MAESTRO_UPDATE_GOLDENS=true)
fi

dump_android_diagnostics() {
  [ "$PLATFORM" = "android" ] || return 0
  echo "==== uiautomator hierarchy ====" >&2
  adb -s "$DEVICE" shell uiautomator dump /sdcard/pekulo-ui.xml >/dev/null 2>&1 \
    && adb -s "$DEVICE" shell cat /sdcard/pekulo-ui.xml | tr '>' '\n' \
      | grep -oE '(text|resource-id)="[^"]+"' | head -80 >&2 || true
  echo "==== logcat (errors) ====" >&2
  adb -s "$DEVICE" logcat -d -v brief '*:S' ReactNativeJS:V AndroidRuntime:E ReactNative:E Expo:E \
    | tail -150 >&2 || true
}

status=0
for flow in "$@"; do
  name="$(basename "$(dirname "$flow")")-$(basename "$flow" .yaml)"
  if maestro test "${args[@]}" --test-output-dir "$RESULTS_DIR/$name/attempt-1" "$flow"; then
    continue
  fi
  if [ "$FLOW_RETRY" = "1" ] \
    && maestro test "${args[@]}" --test-output-dir "$RESULTS_DIR/$name/attempt-2" "$flow"; then
    continue
  fi
  echo "::error title=Maestro ${PLATFORM}::${flow} failed" >&2
  dump_android_diagnostics
  status=1
done

if [ "$UPDATE_GOLDENS" = "true" ]; then
  mkdir -p "$GOLDENS_OUT"
  # Depending on the Maestro version, takeScreenshot paths resolve against the
  # test output dir or the working directory — collect from both.
  find "$RESULTS_DIR" "goldens/$PLATFORM" -path "*goldens/$PLATFORM/*.png" \
    -exec cp {} "$GOLDENS_OUT/" \; 2>/dev/null || true
  echo "Captured $(find "$GOLDENS_OUT" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ') ${PLATFORM} goldens"
fi

exit "$status"
