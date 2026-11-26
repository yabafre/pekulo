---
storyKey: 10-9-android-e2e-emulator-stability
epic: 10
ticket: "#168"
branch: feature/168-10-9-android-e2e-emulator-stability
status: review
complexity: S
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Story: 10-9-android-e2e-emulator-stability — Make the Android core Maestro job green on main and PRs

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** [#168](https://github.com/yabafre/pekulo/issues/168)
**Branch:** `feature/168-10-9-android-e2e-emulator-stability`
**Depends on:** 10-6-android-parity-and-maestro (done)
**Covered FRs:** FR-56 (Android E2E signal — CI hardening of 10-6 AC-7)
**Complexity:** S

## User Story

**As a** Pekulo maintainer, **I want** the e2e-mobile job "Android — smoke / navigation / preview-guard / action sheet" to pass on `main` and on every mobile PR, **so that** Android end-to-end results are a signal again instead of a constant red.

## Acceptance Criteria

- **AC-1 (AVD snapshot cached even when flows fail)** — **Given** an Android E2E job whose AVD cache misses, **When** the emulator snapshot has been created, **Then** the snapshot is saved to the cache before any Maestro flow runs, **And** a later failing flow no longer prevents the save, so the next run on the same ref (and every PR, once `main` ran) boots from the cached snapshot.
- **AC-2 (Emulator settled before snapshot and before tests)** — **Given** a booted Android emulator, **When** the snapshot is about to be taken or the APK is about to be installed, **Then** the job waits until the launcher has held the focus for three consecutive polls (at most 240 s) **And** answers any system "isn't responding" dialog with "Wait" instead of letting it cover the app.
- **AC-3 (Core flows survive a system ANR dialog)** — **Given** any core Maestro flow (smoke, navigation, preview-guard, Android action sheet) on Android or iOS, **When** the app launches and a system ANR dialog is on screen, **Then** the flow answers "Wait" and still waits for the Cap screen ("Patrimoine total"), retrying that check up to twice before failing; **And** on iOS, where no such dialog exists, the behaviour is unchanged.
- **AC-4 (Preview-guard toggle tapped inside the content)** — **Given** the Paramètres sheet in preview mode with text tall enough to push the third-party AI toggle to the bottom edge, **When** the preview-guard flow scrolls to the toggle and taps it, **Then** the toggle is centred on screen first, so the tap reaches it and the "Connectez-vous pour enregistrer des modifications sur votre compte." prompt appears.
- **AC-5 (Drift guard)** — **Given** the mobile Jest suite, **When** a core flow waits for "Patrimoine total" before going through the shared Cap-wait subflow, the subflow stops handling the ANR dialog, preview-guard drops the centring, or the Android action goes back to a single post-job AVD cache or stops settling the emulator, **Then** the suite fails.
- **AC-6 (Green CI proof)** — **Given** this story's PR against `main`, **When** e2e-mobile runs, **Then** "Android — smoke / navigation / preview-guard / action sheet" is green on the cold-cache run, **And** a re-run on the same ref reports `Cache restored from key: avd-35-x86_64-pixel_7-v2` and is green too.

## Tasks

Run every command from the worktree root unless it starts with `cd`. Never use `bun --cwd`; filter by package name (`--filter='@pekulo/mobile'`). Mobile tests are Jest: run them with `cd apps/mobile && bunx jest …` or `bun --filter='@pekulo/mobile' run test` (never `bun test`, never `bun --filter … test`). There is no local Android emulator: the emulator behaviour is proven only by CI (T6).

**T1 — Drift guard first (RED)** [AC: AC-5]

- [x] **T1.1 — Create `apps/mobile/__tests__/maestro-core-flows.test.ts`** [AC: AC-5]
  Create the file with exactly this content:
  ```ts
  // apps/mobile/__tests__/maestro-core-flows.test.ts
  // Story 10-9 — the Android core Maestro job failed on main because every run
  // booted a fresh AVD (the post-job cache never saved: the job failed) and the
  // launcher raised a system ANR dialog over the app; preview-guard also tapped
  // the system navigation bar once taller text pushed its toggle to the bottom.
  // This guard keeps the four hardening pieces from drifting away.
  export {};

  const fs = require("node:fs") as {
    existsSync: (filePath: string) => boolean;
    readFileSync: (filePath: string, encoding: "utf8") => string;
  };
  const path = require("node:path") as {
    dirname: (filePath: string) => string;
    join: (...segments: string[]) => string;
  };

  const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
  const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
  const REPO_ROOT = path.join(MOBILE_ROOT, "..", "..");
  const read = (relative: string) => fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");

  const CORE_FLOWS = [
    "apps/mobile/.maestro/flows/smoke.yaml",
    "apps/mobile/.maestro/flows/navigation.yaml",
    "apps/mobile/.maestro/flows/preview-guard.yaml",
    "apps/mobile/.maestro/flows/action-sheet-android.yaml",
  ];
  const WAIT_FOR_CAP = "apps/mobile/.maestro/subflows/wait-for-cap.yaml";
  const ACTION = ".github/actions/maestro-android/action.yml";
  const SETTLE = ".github/scripts/android-settle.sh";

  describe("Android core Maestro hardening (story 10-9)", () => {
    it.each(CORE_FLOWS)("%s waits for Cap through the shared subflow", (flow) => {
      const text = read(flow);
      const subflow = text.indexOf("runFlow: ../subflows/wait-for-cap.yaml");
      expect(subflow).toBeGreaterThan(-1);
      const firstCap = text.indexOf('"Patrimoine total"');
      if (firstCap !== -1) expect(subflow).toBeLessThan(firstCap);
    });

    it("answers a system ANR dialog with Wait, then retries the Cap check", () => {
      const text = read(WAIT_FOR_CAP);
      expect(text).toMatch(/^- retry:\n {4}maxRetries: 2\n/m);
      expect(text).toContain('id: "android:id/aerr_wait"');
      expect(text).toContain('visible: "Patrimoine total"');
    });

    it("centres the third-party AI toggle before preview-guard taps it", () => {
      const text = read("apps/mobile/.maestro/flows/preview-guard.yaml");
      expect(text).toMatch(
        /- scrollUntilVisible:\n {4}element:\n {6}id: "llm-optin-switch"\n(?: {4}.*\n)*? {4}centerElement: true\n/,
      );
    });

    it("saves the AVD snapshot before any flow runs and settles the emulator", () => {
      const text = read(ACTION);
      expect(text).toContain("uses: actions/cache/restore@v4");
      expect(text).toContain("uses: actions/cache/save@v4");
      expect(text).toContain("key: avd-${{ env.ANDROID_API }}-x86_64-pixel_7-v2");
      expect(text).not.toMatch(/uses: actions\/cache@v4\n(?: {6}.*\n)* {10}~\/\.android\/avd/);
      expect(text.indexOf("uses: actions/cache/save@v4")).toBeLessThan(
        text.indexOf("name: Run Maestro flows"),
      );
      expect(text.split("bash .github/scripts/android-settle.sh emulator-5554").length - 1).toBe(2);
      expect(fs.existsSync(path.join(REPO_ROOT, SETTLE))).toBe(true);
      expect(read(SETTLE)).toContain("android:id/aerr_wait");
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-core-flows.test.ts`
  Expected: RED — `Tests: 7 failed, 7 total` (nothing exists yet), exit 1.
  Commit: `git add apps/mobile/__tests__/maestro-core-flows.test.ts && git commit -m "test(#168): guard the Android core Maestro hardening"`

**T2 — Emulator settle script** [AC: AC-2]

- [x] **T2.1 — Create `.github/scripts/android-settle.sh`** [AC: AC-2]
  Create the file with exactly this content, then `chmod +x .github/scripts/android-settle.sh`:
  ```bash
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
  ```
  Run: `bash -n .github/scripts/android-settle.sh && test -x .github/scripts/android-settle.sh && echo SETTLE_OK`
  Expected: `SETTLE_OK`, exit 0.
  Commit: `git add .github/scripts/android-settle.sh && git commit -m "ci(#168): settle the Android emulator and answer system ANR dialogs"`

**T3 — Cache the AVD before the flows run** [AC: AC-1, AC-2]

- [x] **T3.1 — Replace the AVD cache and run steps of `.github/actions/maestro-android/action.yml`** [AC: AC-1, AC-2]
  In `.github/actions/maestro-android/action.yml`, replace everything from `    - name: Restore AVD snapshot` to the end of the file with exactly:
  ```yaml
      # Restore and save are split (story 10-9): the post-job save of
      # actions/cache only runs when the whole job succeeds, so a failing flow
      # left main without a snapshot and every run cold-booted a fresh AVD.
      - name: Restore AVD snapshot
        id: avd-cache
        uses: actions/cache/restore@v4
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-${{ env.ANDROID_API }}-x86_64-pixel_7-v2
      # The snapshot is taken once the launcher is idle: snapshotting a few
      # seconds after boot_completed froze a busy launcher that later raised a
      # system ANR dialog over the app.
      - name: Create AVD snapshot
        if: steps.avd-cache.outputs.cache-hit != 'true'
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: ${{ env.ANDROID_API }}
          arch: x86_64
          target: default
          profile: pixel_7
          force-avd-creation: false
          emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          disable-animations: false
          script: bash .github/scripts/android-settle.sh emulator-5554
      - name: Save AVD snapshot
        if: steps.avd-cache.outputs.cache-hit != 'true'
        uses: actions/cache/save@v4
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: ${{ steps.avd-cache.outputs.cache-primary-key }}
      - name: Run Maestro flows
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: ${{ env.ANDROID_API }}
          arch: x86_64
          target: default
          profile: pixel_7
          force-avd-creation: false
          emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          disable-animations: true
          script: |
            bash .github/scripts/android-settle.sh emulator-5554
            adb install -r app-release.apk
            bash .github/scripts/maestro-run.sh android emulator-5554 ${{ inputs.flow-retry }} ${{ inputs.flows }}
  ```
  Also, in the `description:` at the top of the same file, replace `from a cached AVD snapshot, installs the APK` with `from a cached AVD snapshot (saved as soon as it is created, story 10-9), waits for the emulator to settle, installs the APK`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-core-flows.test.ts -t "saves the AVD snapshot"`
  Expected: `Tests: 1 passed`, exit 0.
  Commit: `git add .github/actions/maestro-android/action.yml && git commit -m "ci(#168): save the AVD snapshot before the flows and settle the emulator"`

**T4 — Shared Cap-wait subflow** [AC: AC-3]

- [x] **T4.1 — Create `apps/mobile/.maestro/subflows/wait-for-cap.yaml`** [AC: AC-3]
  Create the file with exactly this content (it lives outside `flows/`, so `apps/mobile/.maestro/config.yaml`, which runs `flows/*`, never runs it on its own):
  ```yaml
  # apps/mobile/.maestro/subflows/wait-for-cap.yaml — story 10-9.
  # First check of every core flow: the Cap screen is up. On a freshly booted
  # Android emulator the launcher can raise a system ANR dialog ("Quickstep
  # isn't responding") over the app, and Maestro then only sees that window.
  # Answer it with "Wait" and look again. On iOS the dialog never exists, so
  # this is the plain wait for "Patrimoine total".
  appId: app.pekulo.mobile
  ---
  - retry:
      maxRetries: 2
      commands:
        - runFlow:
            when:
              visible:
                id: "android:id/aerr_wait"
            commands:
              - tapOn:
                  id: "android:id/aerr_wait"
        - extendedWaitUntil:
            visible: "Patrimoine total"
            timeout: 20000
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-core-flows.test.ts -t "answers a system ANR dialog"`
  Expected: `Tests: 1 passed`, exit 0.
  Commit: `git add apps/mobile/.maestro/subflows/wait-for-cap.yaml && git commit -m "test(#168): shared Cap wait that answers a system ANR dialog"`

**T5 — Core flows use the subflow; preview-guard centres its toggle** [AC: AC-3, AC-4]

- [x] **T5.1 — `apps/mobile/.maestro/flows/smoke.yaml`, `navigation.yaml`, `preview-guard.yaml`** [AC: AC-3]
  In each of these three files, replace the first Cap wait (right after `launchApp`):
  ```yaml
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 30000
  ```
  with:
  ```yaml
  - runFlow: ../subflows/wait-for-cap.yaml
  ```
  Leave every later `"Patrimoine total"` check (smoke's return to Cap, navigation's final `assertVisible`) unchanged.
- [x] **T5.2 — `apps/mobile/.maestro/flows/action-sheet-android.yaml`** [AC: AC-3]
  Inside the `runFlow` → `commands:` list, replace:
  ```yaml
        - extendedWaitUntil:
            visible: "Patrimoine total"
            timeout: 30000
  ```
  with:
  ```yaml
        - runFlow: ../subflows/wait-for-cap.yaml
  ```
- [x] **T5.3 — `apps/mobile/.maestro/flows/preview-guard.yaml` centring** [AC: AC-4]
  Replace:
  ```yaml
  - scrollUntilVisible:
      element:
        id: "llm-optin-switch"
      direction: DOWN
      timeout: 10000
  ```
  with:
  ```yaml
  # centerElement (story 10-9): stopping as soon as the toggle is on screen left
  # it under the system navigation bar, which then received the tap.
  - scrollUntilVisible:
      element:
        id: "llm-optin-switch"
      direction: DOWN
      timeout: 10000
      centerElement: true
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-core-flows.test.ts`
  Expected: GREEN — `Tests: 7 passed, 7 total`, exit 0.
  Commit: `git add apps/mobile/.maestro/flows/smoke.yaml apps/mobile/.maestro/flows/navigation.yaml apps/mobile/.maestro/flows/preview-guard.yaml apps/mobile/.maestro/flows/action-sheet-android.yaml && git commit -m "test(#168): core flows answer system ANR dialogs; centre the preview-guard toggle"`

**T6 — Quality gates and CI proof** [AC: AC-5, AC-6]

- [x] **T6.1 — Typecheck and the full mobile suite**
  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run test`
  Expected: typecheck exit 0; Jest `Test Suites: … passed`, `Tests: … passed`, no failures, exit 0.
- [x] **T6.2 — Push, open the PR, prove it on CI** [AC: AC-6]
  Run: `git push -u origin feature/168-10-9-android-e2e-emulator-stability`, then `gh pr create --base main` (title `ci(#168): 10-9 — Android core Maestro job green again`, body closing #168 and stating the root cause).
  Expected: in e2e-mobile, "Android — smoke / navigation / preview-guard / action sheet" succeeds; the log shows `android-settle: launcher idle` in both emulator steps. Then re-run that job: its log shows `Cache restored from key: avd-35-x86_64-pixel_7-v2` and it succeeds again. If it fails, download `maestro-android-core` (ask the user first) and read the screenshots before changing anything.

## Dev Notes

### Root cause (measured)

Evidence: `maestro-android-core` artifacts of runs 45786645967 (`main`, commit 1dbabd1) and 45794481785 (PR #167).

1. **Cold AVD on every run → system ANR dialog over the app.** `actions/cache@v4` saves only in its post-job step when the job succeeds. The core job fails, so `main` never stores the AVD snapshot, and PR runs, which can only read `main`'s caches, always miss it too (`Cache not found for input keys: avd-35-x86_64-pixel_7-v1` in both runs). Each run creates a fresh AVD. `reactivecircus/android-emulator-runner` snapshots it 3 s after `sys.boot_completed`, while the launcher is still doing first-boot work. On `main` the launcher then hit an ANR: the screenshot `step-004-assertCondition-Patrimoine_total.png` shows the Cap screen rendered under a system dialog "Quickstep isn't responding" (Close app / Wait). The Maestro hierarchy only contains that dialog window (`android:id/aerr_close`, `android:id/aerr_wait`), so all 4 flows fail on `"Patrimoine total" is visible`, in both attempts.
2. **preview-guard taps the system navigation bar.** On PR #167 (taller Geist text) smoke, navigation and action-sheet pass. `scrollUntilVisible` stops as soon as `llm-optin-switch` is inside the screen bounds: at the very bottom, under the gesture/navigation bar (screenshot `step-008-assertCondition-Connectez-vous_pour_enre.png`). The tap lands on the navigation bar, so the sign-in prompt never opens.

The last green run (45763088790, PR #165, same tree as 1dbabd1) restored a snapshot cached on that PR's ref, which is why the defect only surfaced after the merge.

### Existing code at write time

`.github/actions/maestro-android/action.yml` (current, from `- name: Restore AVD snapshot` to the end):
```yaml
    - name: Restore AVD snapshot
      id: avd-cache
      uses: actions/cache@v4
      with:
        path: |
          ~/.android/avd/*
          ~/.android/adb*
        key: avd-${{ env.ANDROID_API }}-x86_64-pixel_7-v1
    - name: Create AVD snapshot
      if: steps.avd-cache.outputs.cache-hit != 'true'
      uses: reactivecircus/android-emulator-runner@v2
      with:
        api-level: ${{ env.ANDROID_API }}
        arch: x86_64
        target: default
        profile: pixel_7
        force-avd-creation: false
        emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
        disable-animations: false
        script: echo "Generated AVD snapshot for caching."
    - name: Run Maestro flows
      uses: reactivecircus/android-emulator-runner@v2
      with:
        api-level: ${{ env.ANDROID_API }}
        arch: x86_64
        target: default
        profile: pixel_7
        force-avd-creation: false
        emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
        disable-animations: true
        script: |
          adb install -r app-release.apk
          bash .github/scripts/maestro-run.sh android emulator-5554 ${{ inputs.flow-retry }} ${{ inputs.flows }}
```

`apps/mobile/.maestro/flows/{smoke,navigation,preview-guard}.yaml` (current, right after `launchApp`):
```yaml
- extendedWaitUntil:
    visible: "Patrimoine total"
    timeout: 30000
```

`apps/mobile/.maestro/flows/action-sheet-android.yaml` (current, inside the Android `runFlow`):
```yaml
      - launchApp:
          clearState: true
      - extendedWaitUntil:
          visible: "Patrimoine total"
          timeout: 30000
```

`apps/mobile/.maestro/flows/preview-guard.yaml` (current scroll):
```yaml
- scrollUntilVisible:
    element:
      id: "llm-optin-switch"
    direction: DOWN
    timeout: 10000
```

`.github/scripts/android-settle.sh`, `apps/mobile/.maestro/subflows/wait-for-cap.yaml`, `apps/mobile/__tests__/maestro-core-flows.test.ts`: none — new files.

### File decisions

- **`.github/actions/maestro-android/action.yml`** — Boots the cached emulator and runs the given flows. In: `flows`, `flow-retry`, the `pekulo-android-apk` artifact, `MAESTRO_VERSION` / `ANDROID_API`. Out: Maestro results in `maestro-results/`, plus the AVD cache entry `avd-35-x86_64-pixel_7-v2`.
- **`.github/scripts/android-settle.sh`** — Blocks until the emulator is idle and answers system ANR dialogs. In: device id, `SETTLE_*` env. Out: log lines, exit 0 always (a GitHub warning when the timeout is reached).
- **`apps/mobile/.maestro/subflows/wait-for-cap.yaml`** — The shared first check of the core flows: the Cap screen is visible. In: the launched app. Out: pass, or fail after 3 attempts.
- **`apps/mobile/.maestro/flows/*.yaml`** (4 files) — Unchanged responsibility; only their first Cap wait (and preview-guard's scroll) change.
- **`apps/mobile/__tests__/maestro-core-flows.test.ts`** — Drift guard for the four hardening pieces. In: the files above, read as text. Out: Jest assertions.

### Notes

- Commit prefixes: `ci(#168)`, `test(#168)`, `docs(#168)`.
- `actions/cache/save` racing: the core job and the 4 Android gallery shards may all miss and try to save the same key. Only one save wins; the others log "Unable to reserve cache" as a warning and the job goes on. That is expected.
- Caches are scoped per ref: a PR reads its own ref's caches and `main`'s. After merge, the next push run on `main` stores `v2` for every PR (or run e2e-mobile by `workflow_dispatch` on `main`).
- The gallery shards (generated from `PARITY_CASES`, `maestro-ds-gallery-flow.test.ts`) are not edited: the settle step protects them and keeps their generated files unchanged.
- `uiautomator dump` must not run while Maestro holds the UiAutomation connection (the existing diagnostics crash with "UiAutomationService … already registered"); the settle script only runs before Maestro starts.
- Repo is in iCloud Drive: if `bunx jest` hangs at 0 % CPU, evicted `node_modules` files are the cause (see the `fileprovider.ignore` memory), not this change.

## File List

- `.github/actions/maestro-android/action.yml` (modify)
- `.github/scripts/android-settle.sh` (create)
- `apps/mobile/.maestro/subflows/wait-for-cap.yaml` (create)
- `apps/mobile/.maestro/flows/smoke.yaml` (modify)
- `apps/mobile/.maestro/flows/navigation.yaml` (modify)
- `apps/mobile/.maestro/flows/preview-guard.yaml` (modify)
- `apps/mobile/.maestro/flows/action-sheet-android.yaml` (modify)
- `apps/mobile/__tests__/maestro-core-flows.test.ts` (create)
- `docs/stories/10-9-android-e2e-emulator-stability.md`, `docs/state.yaml`, `docs/epics.md` (docs)

## Dev Agent Record

### Summary

The Android core Maestro job is green again. The AVD snapshot is now saved as soon as it is created, the emulator settles (launcher idle, system ANR dialog answered with "Wait") before the snapshot and before the APK install, the core flows wait for Cap through an ANR-tolerant subflow, and preview-guard centres its toggle. Root causes: a post-job cache save that never ran because the job failed (cold AVD on every run, snapshot taken while the launcher was busy, then a "Quickstep isn't responding" dialog over the app), plus the preview-guard tap landing on the system navigation bar.

### Files changed

- .github/actions/maestro-android/action.yml
- .github/scripts/android-settle.sh
- apps/mobile/.maestro/flows/action-sheet-android.yaml
- apps/mobile/.maestro/flows/navigation.yaml
- apps/mobile/.maestro/flows/preview-guard.yaml
- apps/mobile/.maestro/flows/smoke.yaml
- apps/mobile/.maestro/subflows/wait-for-cap.yaml
- apps/mobile/__tests__/maestro-core-flows.test.ts
- docs/epics.md
- docs/state.yaml
- docs/stories/10-9-android-e2e-emulator-stability.md

### Deviations

- The drift-guard test carries the verbatim AC quotes required by the TDD cycle (not in the story's code block).
- On the cold-cache run an Android gallery shard won the `avd-35-x86_64-pixel_7-v2` save race; the core job logged "Unable to reserve cache" as a warning, as the Dev Notes anticipated.
- `android-settle.sh` was exercised locally against a stub `adb` (ANR focus, then launcher focus): it tapped the centre of `aerr_wait` (540, 1353) and exited after 3 launcher polls.

### Test output

- `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-core-flows.test.ts` — RED first (7 failed: subflow reference missing, ENOENT on the subflow, no `centerElement`, no `actions/cache/restore@v4`), then GREEN.
- `bun --filter='@pekulo/mobile' run typecheck` — exit 0.
- `bun --filter='@pekulo/mobile' run test` — `Test Suites: 32 passed, 32 total`, `Tests: 260 passed, 260 total`.
- CI, PR #169, e2e-mobile run 45811714076 (cold cache): `Cache not found for input keys: avd-35-x86_64-pixel_7-v2`, `android-settle: launcher idle for 3 polls (11s)`, all 4 core flows `[Passed]` on the first attempt; every iOS and Android job green.
- CI re-run of the Android core job (139941576503): `Cache restored from key: avd-35-x86_64-pixel_7-v2`, `Successfully loaded snapshot 'default_boot'`, all 4 core flows `[Passed]`, success.
