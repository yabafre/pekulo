#!/usr/bin/env bash
# .github/scripts/android-settle.sh — story 10-9, used by .github/actions/maestro-android.
# Waits until a booted emulator is idle enough to snapshot or to test: the
# launcher must hold the window focus for SETTLE_STREAK polls in a row. A
# system "isn't responding" dialog (the Quickstep ANR seen on fresh AVDs,
# which covered the app and failed every core flow) is answered with "Wait".
# Never fails the job: if the emulator does not settle in time it warns, and
# the Maestro flows report the real state.
#
#   android-settle.sh <device-id>
#
# Env: SETTLE_TIMEOUT (s, default 240), SETTLE_INTERVAL (s, default 5),
#      SETTLE_STREAK (polls, default 3)
set -euo pipefail

DEVICE="$1"
TIMEOUT="${SETTLE_TIMEOUT:-240}"
INTERVAL="${SETTLE_INTERVAL:-5}"
STREAK="${SETTLE_STREAK:-3}"

# e.g. "mCurrentFocus=Window{4f1 u0 com.android.launcher3/…QuickstepLauncher}"
#   or "mCurrentFocus=Window{9c2 u0 Application Not Responding: com.android.launcher3}"
focus() {
  adb -s "$DEVICE" shell dumpsys window 2>/dev/null | grep -m 1 -E 'mCurrentFocus=' || true
}

# Taps the centre of android:id/aerr_wait, read from a uiautomator dump
# (bounds="[x1,y1][x2,y2]"). No-op when the button is not on screen.
tap_wait() {
  local bounds x1 y1 x2 y2
  adb -s "$DEVICE" shell uiautomator dump /sdcard/android-settle.xml >/dev/null 2>&1 || return 0
  bounds="$(adb -s "$DEVICE" shell cat /sdcard/android-settle.xml | tr '>' '\n' \
    | grep 'resource-id="android:id/aerr_wait"' \
    | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -n 1 || true)"
  [ -n "$bounds" ] || return 0
  read -r x1 y1 x2 y2 <<<"$(echo "$bounds" | grep -oE '[0-9]+' | tr '\n' ' ')"
  adb -s "$DEVICE" shell input tap "$(((x1 + x2) / 2))" "$(((y1 + y2) / 2))"
}

deadline=$((SECONDS + TIMEOUT))
streak=0
while [ "$SECONDS" -lt "$deadline" ]; do
  current="$(focus)"
  if echo "$current" | grep -q "Not Responding"; then
    echo "android-settle: system ANR dialog (${current}) — answering Wait"
    tap_wait
    streak=0
  elif echo "$current" | grep -qi "launcher"; then
    streak=$((streak + 1))
    if [ "$streak" -ge "$STREAK" ]; then
      echo "android-settle: launcher idle for ${streak} polls (${SECONDS}s)"
      exit 0
    fi
  else
    streak=0
  fi
  sleep "$INTERVAL"
done
echo "::warning title=android-settle::emulator not idle after ${TIMEOUT}s (last focus: $(focus))"
exit 0
