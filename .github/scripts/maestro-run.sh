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
# Every golden case retries itself (Maestro `retry`), so a screenshot flake never
# replays a shard. <flow-retry> 1 reruns the batch once more: the core flows
# (cheap) and the iOS gallery shards, whose XCTest driver can die on slow CI
# simulators and abort the whole run (no per-case retry can catch that).
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

# One `maestro test` for all flows: each invocation (re)installs and boots the
# XCTest driver on iOS (~1.5–2 min on a fresh simulator), so per-flow calls
# multiplied that cost. A retry reuses the already-running driver.
status=0
if ! maestro test "${args[@]}" --test-output-dir "$RESULTS_DIR/attempt-1" "$@"; then
  if [ "$FLOW_RETRY" = "1" ] \
    && maestro test "${args[@]}" --no-reinstall-driver --test-output-dir "$RESULTS_DIR/attempt-2" "$@"; then
    :
  else
    echo "::error title=Maestro ${PLATFORM}::$* failed" >&2
    dump_android_diagnostics
    status=1
  fi
fi

if [ "$UPDATE_GOLDENS" = "true" ]; then
  mkdir -p "$GOLDENS_OUT"
  # Depending on the Maestro version, takeScreenshot paths resolve against the
  # test output dir or the working directory — collect from both.
  find "$RESULTS_DIR" "goldens/$PLATFORM" -path "*goldens/$PLATFORM/*.png" \
    -exec cp {} "$GOLDENS_OUT/" \; 2>/dev/null || true
  echo "Captured $(find "$GOLDENS_OUT" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ') ${PLATFORM} goldens"
fi

exit "$status"
