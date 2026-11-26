---
storyKey: 10-6-android-parity-and-maestro
epic: 10
ticket: "#162"
branch: feature/162-10-6-android-parity-and-maestro
status: done
complexity: L
stepsCompleted: [1, 2, 3, 4, 5]
---

# Story: 10-6-android-parity-and-maestro — Android-safe native surfaces, Android APK, and Maestro E2E on an Android emulator (EAS Workflows)

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** done
**Ticket:** [#162](https://github.com/yabafre/pekulo/issues/162)
**Branch:** `feature/162-10-6-android-parity-and-maestro`
**Depends on:** 10-5-mobile-parity-and-maestro (done, PR #161)
**Covered FRs:** FR-56 (Android parity)
**Complexity:** L (re-estimated from M at step-04 — the Android surface audit found three crash/blocker classes beyond the epic summary)

## User Story

**As a** Pekulo user on Android, **I want** the mobile app to build, behave, and pass the same Maestro suite on Android, **so that** the V1.5 app ships on both stores with the parity guarantees 10-5 established for iOS.

## Acceptance Criteria

- **AC-1 (Android APK build)** — **Given** the end-to-end test build profile, **When** an Android build runs, **Then** it produces an installable APK that runs in preview mode with the DS gallery enabled; **And** generating the native Android project locally succeeds, registers the `pekulo://` deep-link scheme, and leaves the generated project out of version control (like iOS).
- **AC-2 (no iOS-only header crash on Android)** — **Given** the app running on Android, **When** any primary tab, Paramètres, or any form sheet renders, **Then** no iOS-only toolbar item is rendered (they crash on Android without the optional Expo UI module); the four tabs with header actions show their create (+) and profile buttons in the native header, on an opaque Pekulo-coloured header that never overlaps the content; every form sheet shows an in-content header row (Annuler/Fermer · title · primary action) and its primary action submits the form; Paramètres shows its own title and closes with the system back action; **And** iOS headers and toolbar items are unchanged.
- **AC-3 (complete row action menus on Android)** — **Given** a row action menu with N actions (Immobilier has 5, Cap has 3, a select field has one per option), **When** it opens on Android, **Then** a Pekulo DS bottom sheet lists all N actions plus « Annuler », destructive actions in the danger colour, pressing an action closes the sheet then runs exactly that action, and « Annuler » runs none; **And** no system alert dialog (capped at three buttons on Android) is used for menus; **And** iOS keeps its native action sheet.
- **AC-4 (account deletion on Android)** — **Given** an authenticated user on Android, **When** they press « Supprimer mon compte » in Paramètres, **Then** a deletion sheet opens; typing an email that does not match the account email (ignoring case and surrounding spaces) shows the « E-mail incorrect » alert and calls nothing; typing the matching email deletes the account, signs out and returns to the login screen; **And** iOS keeps its native text prompt, with the same email check on both platforms.
- **AC-5 (icons on Android)** — **Given** any system symbol icon in the mobile app, **When** it renders on Android, **Then** it shows a Material Symbol, never a blank or text fallback; **And** the mobile test suite fails when a new symbol icon has no Android name; **And** the Android tab bar shows all five labels on a grayscale Pekulo bar.
- **AC-6 (sheet chrome on Android)** — **Given** the form sheets and Paramètres, **When** presented on Android, **Then** they are headerless, keep their detents (at most three, Android's limit), and cast no drop shadow.
- **AC-7 (Maestro flows run on Android)** — **Given** the Android end-to-end APK on an emulator in preview mode with no backend, **When** the Maestro suite runs, **Then** the smoke, navigation (Paramètres dismissed by back on Android, by swipe on iOS), preview-guard, and Android DS gallery flows pass, every component's golden case matching its committed Android screenshot at a 98 % similarity threshold — or being captured fresh when golden regeneration is requested; **And** the mobile test suite fails when either committed gallery flow (iOS, unchanged from 10-5, or Android) drifts from the parity catalog.
- **AC-8 (CI)** — **Given** a PR to `main` touching the mobile app or the shared UI / contracts / validators / types packages, **When** EAS Workflows run, **Then** an Android workflow builds the APK and runs the four flows on an Android emulator (non-required check, one retry per flow, failure artifacts uploaded); **And** a manual workflow recaptures the Android goldens on the same emulator image; **And** if EAS refuses the emulator worker on the current plan, the documented GitHub Actions fallback is used and the refusal is recorded.
- **AC-9 (Android test project)** — **Given** the mobile test suite, **When** it runs, **Then** the existing suites run under the iOS platform and a second, Android-platform project runs the Android surface tests, proving AC-2..AC-4 on Android against a toolbar stand-in that throws like the real one; **And** the 16 pre-existing suites (194 tests) stay green.
- **AC-10 (docs + quality gates)** — **Given** the finished change, **When** typecheck, lint, format check, and the mobile tests run, **Then** all pass; **And** the epic plan, sprint state, architecture test pyramid / FR-56 traceability, and mobile README are synced in this change; **And** the vendored mobile design skills are committed on this branch.


> **Realized AC-7 / AC-8 (2026-11-26, user decision — recorded at review).** AC-8's EAS-refusal branch was never exercised: EAS Workflows accepted the Android emulator worker, and the user then moved all mobile E2E (iOS and Android) to GitHub Actions for speed and control. AC-8 is met by `.github/workflows/e2e-mobile.yml`: a non-required check on PRs to `main` touching the mobile app or the shared packages; Android APK built on `ubuntu-24.04`; flows on a pinned API 35 Pixel 7 emulator; failure artifacts uploaded; goldens recaptured on the same image through the `maestro:update-goldens` PR label or `workflow_dispatch`. "One retry per flow" holds for the core flows (`flow-retry: 1`). The gallery instead retries **each golden case** once (Maestro `retry`), which gives finer-grained retries than one retry per flow. AC-7's gallery "flow" ships as 4 generated shards per platform (`.maestro/gallery/<platform>/shard-<n>.yaml`). The iOS shards are regenerated, so they are no longer byte-identical to 10-5's `ds-gallery.yaml`. The drift guard covers both platforms (`__tests__/maestro-ds-gallery-flow.test.ts`). Review added `action-sheet-android.yaml`, which checks AC-3 on the emulator.

## Tasks

Run every command from the repository root unless the command starts with `cd`. Never use `bun --cwd` (lesson 2026-05-05) and always filter by package name, `bun --filter='@pekulo/mobile'` (lesson 2026-05-19). `bun --filter='@pekulo/mobile' test` runs Bun's own runner — always use `run test` or `bunx jest` inside `apps/mobile`.

**T1 — Commit the vendored mobile design skills** [AC: AC-10]

- [x] **T1.1 — Commit `skills-lock.json` + the vendored skills** [AC: AC-10]
  Done at story-prep time (2026-11-25), in the commit `chore(#162): vendor mobile design and store compliance skills`, because `skills-lock.json` lists all four skills installed on the dev machine: `.claude/skills/{ios-design,ui-taste}` plus `.agents/skills/{app-store-compliance,mobile-agent-testers}` and their `.claude/skills/*` symlinks. The last two are byte-identical to what `feature/163-10-7-store-compliance-and-agent-testers` commits in `64dfa23`, so the identical adds merge cleanly; `skills-lock.json` itself will need a trivial merge (keep the version-2 superset). Not committed, on purpose: `apps/web/next-env.d.ts` (regenerated by Next.js), `.aped/state.yaml.backup`, `.aped/checkins/` (10-7 session runtime file) and `docs/quick-specs/2026-11-22-unify-bun-1-3-14 2.md` (iCloud duplicate of the tracked quick-spec).
  Run: `git log --oneline -1 -- skills-lock.json`
  Expected: `<sha> chore(#162): vendor mobile design and store compliance skills`. Nothing to do in `aped-dev`.

**T2 — Jest `android` project** [AC: AC-9]

- [x] **T2.1 (RED) — Add `apps/mobile/__tests__/android/platform.test.ts`** [AC: AC-9]
  Create the file:
  ```ts
  // apps/mobile/__tests__/android/platform.test.ts
  // Story 10-6 AC-9 — proves the `android` Jest project really runs under
  // jest-expo/android (Platform.OS + `.android` module resolution) before any
  // Android surface test relies on it.
  //
  // AC-9 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given the mobile test suite, When it runs, Then the existing suites run under
  //   the iOS platform and a second, Android-platform project runs the Android
  //   surface tests, proving AC-2..AC-4 on Android against a toolbar stand-in that
  //   throws like the real one; And the 16 pre-existing suites (194 tests) stay
  //   green.
  import { Platform } from "react-native";

  describe("android Jest project (story 10-6, AC-9)", () => {
    it("runs with Platform.OS === 'android'", () => {
      expect(Platform.OS).toBe("android");
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest __tests__/android/platform.test.ts`
  Expected (RED): `Expected: "android"` / `Received: "ios"`, `Tests: 1 failed`.

- [x] **T2.2 (GREEN) — Split `apps/mobile/jest.config.js` into `ios` + `android` projects** [AC: AC-9]
  Replace the whole file with:
  ```js
  // apps/mobile/jest.config.js
  // Story 10-6 AC-9 — two Jest projects sharing one transform/mapping setup:
  //   - `ios`: the historical `jest-expo` preset (haste defaultPlatform ios) for
  //     every suite under __tests__/ except __tests__/android/;
  //   - `android`: `jest-expo/android` (Platform.OS === "android", `.android.*`
  //     resolution) for __tests__/android/**.
  const path = require("node:path");
  const jestExpoPreset = require("jest-expo/jest-preset");
  const jestExpoAndroidPreset = require("jest-expo/android/jest-preset");

  const babelRuntimeDir = path.dirname(
    require.resolve("@babel/runtime/package.json", {
      paths: [require.resolve("react-native/package.json")],
    }),
  );
  const reactNativeEntry = require.resolve("react-native");
  const reanimatedEntry = require.resolve("react-native-reanimated");
  const workletsEntry = require.resolve("react-native-worklets");
  const svgEntry = require.resolve("react-native-svg");
  const lucideNativeEntry = require.resolve("lucide-react-native");
  const dateTimePickerEntry = require.resolve("@react-native-community/datetimepicker");
  const pickerEntry = require.resolve("@react-native-picker/picker");
  const secureStoreEntry = require.resolve("expo-secure-store");

  const MODULE_NAME_MAPPER = {
    "^@babel/runtime/(.*)$": `${babelRuntimeDir}/$1`,
    "^react-native$": reactNativeEntry,
    "^react-native-reanimated$": reanimatedEntry,
    "^react-native-worklets$": workletsEntry,
    "^react-native-svg$": svgEntry,
    "^lucide-react-native$": lucideNativeEntry,
    "^@react-native-community/datetimepicker$": dateTimePickerEntry,
    "^@react-native-picker/picker$": pickerEntry,
    "^expo-secure-store$": secureStoreEntry,
    "^@pekulo/ui$": "<rootDir>/../../packages/ui/src/index.native.ts",
    "^@pekulo/ui/client$": "<rootDir>/../../packages/ui/src/client.ts",
    "^@pekulo/ui/parity$": "<rootDir>/../../packages/ui/src/parity/index.ts",
    "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
    "^@pekulo/contracts$": "<rootDir>/../../packages/contracts/src/index.ts",
    "^@pekulo/validators$": "<rootDir>/../../packages/validators/src/index.ts",
    "^@pekulo/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@pekulo/zod$": "<rootDir>/../../packages/zod/src/index.ts",
    "^@/(.*)$": "<rootDir>/$1",
  };

  const TRANSFORM_IGNORE_PATTERNS = [
    "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|@react-native-picker/.*|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|lucide-react-native|react-native-svg|@orpc/.*|@supabase/.*|@tanstack/.*|@standard-schema/.*|zod|tamagui|@tamagui/.*|@pekulo/.*)))",
  ];

  // jest-expo's default transform only matches `\.[jt]sx?$`, skipping `.mjs` ESM
  // entrypoints shipped by `@orpc/*` and `zod` v4 under Jest CommonJS mode.
  function projectBase(preset) {
    const { "\\.[jt]sx?$": babelTransform, ...assetTransforms } = preset.transform;
    return {
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      transform: {
        ...assetTransforms,
        "\\.m?[jt]sx?$": babelTransform,
      },
      moduleNameMapper: MODULE_NAME_MAPPER,
      transformIgnorePatterns: TRANSFORM_IGNORE_PATTERNS,
    };
  }

  /** @type {import("jest").Config} */
  module.exports = {
    testTimeout: 20000,
    projects: [
      {
        ...projectBase(jestExpoPreset),
        displayName: "ios",
        preset: "jest-expo",
        testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
        testPathIgnorePatterns: ["/node_modules/", "<rootDir>/__tests__/android/"],
      },
      {
        ...projectBase(jestExpoAndroidPreset),
        displayName: "android",
        preset: "jest-expo/android",
        testMatch: ["<rootDir>/__tests__/android/**/*.test.{ts,tsx}"],
      },
    ],
  };
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects android`
  Expected: `✓ runs with Platform.OS === 'android'`, `Tests: 1 passed, 1 total`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios`
  Expected: `Test Suites: 16 passed, 16 total`, `Tests: 194 passed, 194 total` (baseline measured at write time, 2026-11-24).
  Commit: `git add apps/mobile/jest.config.js apps/mobile/__tests__/android/platform.test.ts && git commit -m "test(#162): add jest-expo/android project for Android surface tests"`

**T3 — Native-surface guard meta-test** [AC: AC-2, AC-5]

- [x] **T3.1 (RED) — Add `apps/mobile/__tests__/native-surface-guards.test.ts`** [AC: AC-2, AC-5]
  Create the file:
  ```ts
  // apps/mobile/__tests__/native-surface-guards.test.ts
  // Story 10-6 AC-5 / AC-2 — class-killer meta-tests over the mobile sources
  // (lesson 2026-06-05, second half: enumerate the source of truth and assert):
  //   1. every `<SymbolView … />` declares an Android Material Symbol
  //      (`name={{ ios: "…", android: "…" }}`), so no icon renders blank on Android;
  //   2. `Stack.Toolbar` (throws on Android without `@expo/ui`) only appears in the
  //      three files whose Android branch is covered by __tests__/android/*.test.tsx.
  //      A new usage fails here until it gets an Android branch AND an Android test.
  //
  // AC-5 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given any system symbol icon in the mobile app, When it renders on Android,
  //   Then it shows a Material Symbol, never a blank or text fallback; And the
  //   mobile test suite fails when a new symbol icon has no Android name; And the
  //   Android tab bar shows all five labels on a grayscale Pekulo bar.
  const fs = require("node:fs") as {
    readdirSync: (dir: string) => string[];
    readFileSync: (filePath: string, encoding: "utf8") => string;
    statSync: (filePath: string) => { isDirectory: () => boolean };
  };
  const path = require("node:path") as {
    dirname: (filePath: string) => string;
    join: (...segments: string[]) => string;
    relative: (from: string, to: string) => string;
  };

  const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
  const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
  const SOURCE_DIRS = ["app", "components", "lib"];
  const STACK_TOOLBAR_FILES = [
    "app/parametres.tsx",
    "components/form/sheet.tsx",
    "components/tab-stack-layout.tsx",
  ];

  function listSources(dir: string): string[] {
    return fs.readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) return listSources(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  const SOURCES = SOURCE_DIRS.flatMap((dir) => listSources(path.join(MOBILE_ROOT, dir))).map(
    (file) => ({ file: path.relative(MOBILE_ROOT, file), text: fs.readFileSync(file, "utf8") }),
  );

  /** Every `<SymbolView … />` element as raw source text (`name` is always its first prop). */
  function symbolViewElements(text: string): string[] {
    return text.match(/<SymbolView\b[\s\S]*?\/>/g) ?? [];
  }

  describe("native surface guards (story 10-6)", () => {
    it("scans the mobile sources", () => {
      expect(SOURCES.length).toBeGreaterThan(20);
      expect(SOURCES.flatMap(({ text }) => symbolViewElements(text)).length).toBeGreaterThanOrEqual(6);
    });

    it("gives every SymbolView an Android Material Symbol name (AC-5)", () => {
      const missing = SOURCES.flatMap(({ file, text }) =>
        symbolViewElements(text)
          .filter((element) => !/\bandroid:\s*"/.test(element))
          .map(() => file),
      );
      expect(missing).toEqual([]);
    });

    it("keeps <Stack.Toolbar> inside the Android-tested files only (AC-2)", () => {
      // JSX usage only — comments that merely mention Stack.Toolbar are fine.
      const users = SOURCES.filter(({ text }) => text.includes("<Stack.Toolbar"))
        .map(({ file }) => file)
        .sort();
      expect(users).toEqual(STACK_TOOLBAR_FILES);
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/native-surface-guards.test.ts`
  Expected (RED): `✕ gives every SymbolView an Android Material Symbol name (AC-5)` (the `<Stack.Toolbar>` allow-list test already passes: at write time exactly the three allow-listed files contain `<Stack.Toolbar`) with `Received` listing `"app/(tabs)/transactions/index.tsx"`, `"app/parametres.tsx"`, `"components/form/fields.tsx"`, `"components/search-field.tsx"`, `"components/tab-stack-layout.tsx"` (twice); the two other tests pass — `Tests: 1 failed, 2 passed, 3 total`.
  Commit: none (RED kept uncommitted; committed with T4).

**T4 — Android Material Symbol names** [AC: AC-5]

- [x] **T4.1 (GREEN) — Give the six `SymbolView`s an Android name** [AC: AC-5]
  Apply exactly these replacements (each `old` block occurs once in its file):

  `apps/mobile/app/parametres.tsx` — replace
  ```tsx
            <SymbolView
              name="chevron.right"
  ```
  with
  ```tsx
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right" }}
  ```

  `apps/mobile/app/(tabs)/transactions/index.tsx` — replace
  ```tsx
        name={direction === "prev" ? "chevron.left" : "chevron.right"}
  ```
  with
  ```tsx
        name={
          direction === "prev"
            ? { ios: "chevron.left", android: "chevron_left" }
            : { ios: "chevron.right", android: "chevron_right" }
        }
  ```

  `apps/mobile/components/form/fields.tsx` — replace
  ```tsx
          name="chevron.up.chevron.down"
  ```
  with
  ```tsx
          name={{ ios: "chevron.up.chevron.down", android: "unfold_more" }}
  ```

  `apps/mobile/components/search-field.tsx` — replace
  ```tsx
          name="magnifyingglass"
  ```
  with
  ```tsx
          name={{ ios: "magnifyingglass", android: "search" }}
  ```

  `apps/mobile/components/tab-stack-layout.tsx` — replace
  ```tsx
          name="person.crop.circle"
  ```
  with
  ```tsx
          name={{ ios: "person.crop.circle", android: "account_circle" }}
  ```
  and replace
  ```tsx
        name="plus"
  ```
  with
  ```tsx
        name={{ ios: "plus", android: "add" }}
  ```
  All five Material names exist in `expo-symbols@58.0.5` `build/android/symbols.json` (verified at write time: `chevron_right`, `chevron_left`, `unfold_more`, `search`, `account_circle`, `add`). On iOS `SymbolView.ios` picks `name.ios`, so iOS rendering is unchanged. String weights (`"semibold"`) map to the regular Material weight on Android — intended.
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/native-surface-guards.test.ts`
  Expected: `Tests: 3 passed, 3 total`.
  Run: `bun --filter='@pekulo/mobile' run typecheck`
  Expected: exit 0 (no `TS2322` on `name`).
  Commit: `git add apps/mobile/__tests__/native-surface-guards.test.ts apps/mobile/app/parametres.tsx "apps/mobile/app/(tabs)/transactions/index.tsx" apps/mobile/components/form/fields.tsx apps/mobile/components/search-field.tsx apps/mobile/components/tab-stack-layout.tsx && git commit -m "feat(#162): Android Material Symbol names for every SymbolView"`

- [x] **T4.2 — Android tab bar: all labels, grayscale chrome** [AC: AC-5]
  In `apps/mobile/app/(tabs)/_layout.tsx` replace
  ```tsx
  import { pekuloColors, useThemeSetting } from "@pekulo/ui";
  import { NativeTabs } from "expo-router/native-tabs";
  ```
  with
  ```tsx
  import { pekuloColors, useThemeSetting } from "@pekulo/ui";
  import { NativeTabs } from "expo-router/native-tabs";
  import { Platform } from "react-native";
  ```
  and replace
  ```tsx
    const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;

    return (
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={palette.text.primary}
        iconColor={palette.text.secondary}
        labelStyle={{ color: palette.text.secondary }}
      >
  ```
  with
  ```tsx
    const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;
    // Story 10-6 AC-5 — Material bottom navigation hides unselected labels past
    // three items by default ("auto"); keep all five visible like iOS (and so
    // Maestro can tap them by text). `backgroundColor` also applies on iOS, where
    // it would kill the Liquid Glass bar — so these props are Android-only.
    const androidChrome =
      Platform.OS === "android"
        ? {
            labelVisibilityMode: "labeled" as const,
            backgroundColor: palette.surface.bg,
            indicatorColor: palette.surface.muted,
            rippleColor: palette.surface.muted,
          }
        : {};

    return (
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={palette.text.primary}
        iconColor={palette.text.secondary}
        labelStyle={{ color: palette.text.secondary }}
        {...androidChrome}
      >
  ```
  Run: `bun --filter='@pekulo/mobile' run typecheck && cd apps/mobile && bunx jest --selectProjects ios __tests__/navigation-tabs.test.tsx`
  Expected: typecheck exit 0; `Tests: 4 passed` (all navigation-tabs tests green, iOS unchanged).
  Commit: `git add "apps/mobile/app/(tabs)/_layout.tsx" && git commit -m "feat(#162): label all five Android tabs on a grayscale bar"`

**T5 — Shared typed-email check** [AC: AC-4]

- [x] **T5.1 (RED) — Add `apps/mobile/__tests__/account-deletion.test.ts`** [AC: AC-4]
  ```ts
  // apps/mobile/__tests__/account-deletion.test.ts
  // Story 10-6 AC-4 — the typed-email confirmation shared by the iOS
  // `Alert.prompt` path (app/parametres.tsx) and the Android sheet
  // (app/sheets/delete-account.tsx).
  import { isDeletionEmailConfirmed } from "../lib/account-deletion";

  describe("isDeletionEmailConfirmed (story 10-6, AC-4)", () => {
    it("accepts the account email, ignoring case and surrounding spaces", () => {
      expect(isDeletionEmailConfirmed("  Alex@Pekulo.app ", "alex@pekulo.app")).toBe(true);
    });

    it("rejects a different email", () => {
      expect(isDeletionEmailConfirmed("bob@pekulo.app", "alex@pekulo.app")).toBe(false);
    });

    it("rejects empty input", () => {
      expect(isDeletionEmailConfirmed("", "alex@pekulo.app")).toBe(false);
      expect(isDeletionEmailConfirmed(undefined, "alex@pekulo.app")).toBe(false);
    });

    it("rejects everything when the account email is unknown", () => {
      expect(isDeletionEmailConfirmed("   ", null)).toBe(false);
      expect(isDeletionEmailConfirmed("a@b.c", undefined)).toBe(false);
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/account-deletion.test.ts`
  Expected (RED): `Cannot find module '../lib/account-deletion'`, `Test Suites: 1 failed`.

- [x] **T5.2 (GREEN) — Create `apps/mobile/lib/account-deletion.ts`** [AC: AC-4]
  ```ts
  // apps/mobile/lib/account-deletion.ts
  // Story 10-6 AC-4 — typed-email confirmation shared by the iOS `Alert.prompt`
  // path (app/parametres.tsx) and the Android sheet (app/sheets/delete-account.tsx).
  // Case- and surrounding-space-insensitive. An unknown account email never
  // confirms (the 10-4 inline check accepted "   " when the email was missing).

  export function isDeletionEmailConfirmed(
    typed: string | undefined,
    accountEmail: string | null | undefined,
  ): boolean {
    const expected = (accountEmail ?? "").trim().toLowerCase();
    if (!typed || expected === "") return false;
    return typed.trim().toLowerCase() === expected;
  }
  ```
  Then in `apps/mobile/app/parametres.tsx` replace
  ```tsx
  import { useI18n } from "../lib/i18n";
  ```
  with
  ```tsx
  import { isDeletionEmailConfirmed } from "../lib/account-deletion";
  import { useI18n } from "../lib/i18n";
  ```
  and replace the whole `confirmAccountDeletion` function
  ```tsx
    function confirmAccountDeletion(typed: string | undefined) {
      const expected = (userEmail ?? "").trim().toLowerCase();
      if (!typed || typed.trim().toLowerCase() !== expected) {
        Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
        return;
      }
      void run(async () => {
        await deleteAccount.mutateAsync({ confirmationEmail: typed.trim() });
        router.replace("/login");
      }, t("settings.deletion.done"));
    }
  ```
  with
  ```tsx
    function confirmAccountDeletion(typed: string | undefined) {
      if (!isDeletionEmailConfirmed(typed, userEmail)) {
        Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
        return;
      }
      const confirmationEmail = (typed ?? "").trim();
      void run(async () => {
        await deleteAccount.mutateAsync({ confirmationEmail });
        router.replace("/login");
      }, t("settings.deletion.done"));
    }
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/account-deletion.test.ts __tests__/settings-interactions.test.tsx`
  Expected: `Test Suites: 2 passed, 2 total` (4 new tests + the existing iOS `Alert.prompt` deletion tests unchanged).
  Commit: `git add apps/mobile/lib/account-deletion.ts apps/mobile/__tests__/account-deletion.test.ts apps/mobile/app/parametres.tsx && git commit -m "refactor(#162): share the typed-email deletion check"`

**T6 — Android row action sheet** [AC: AC-3]

- [x] **T6.1 (RED) — Add `apps/mobile/__tests__/android/action-sheet.test.tsx`** [AC: AC-3]
  ```tsx
  // apps/mobile/__tests__/android/action-sheet.test.tsx
  // Story 10-6 AC-3 — on Android, `showActions` must list EVERY action plus
  // Annuler (Alert.alert caps Android dialogs at three buttons, which silently
  // dropped Immobilier's 5-action menu).
  //
  // AC-3 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given a row action menu with N actions (Immobilier has 5, Cap has 3, a select
  //   field has one per option), When it opens on Android, Then a Pekulo DS bottom
  //   sheet lists all N actions plus « Annuler », destructive actions in the danger
  //   colour, pressing an action closes the sheet then runs exactly that action, and
  //   « Annuler » runs none; And no system alert dialog (capped at three buttons on
  //   Android) is used for menus; And iOS keeps its native action sheet.
  import { PekuloRootProvider } from "@pekulo/ui";
  import { act, fireEvent, render, screen } from "@testing-library/react-native";
  import { Alert, Platform } from "react-native";

  import { ActionSheetHost, closeActionSheet } from "../../lib/action-sheet-host";
  import { showActions } from "../../lib/actions";

  const LABELS = ["Mettre à jour la valeur", "Historique", "Crédit", "Location", "Supprimer"];

  async function openFiveActionMenu() {
    const handlers = LABELS.map(() => jest.fn());
    await render(
      <PekuloRootProvider theme="pekulo-light">
        <ActionSheetHost />
      </PekuloRootProvider>,
    );
    await act(async () => {
      showActions(
        "Appartement Lyon",
        LABELS.map((label, index) => ({
          label,
          destructive: label === "Supprimer",
          onPress: handlers[index],
        })),
      );
    });
    return handlers;
  }

  describe("Android row action menus (story 10-6, AC-3)", () => {
    afterEach(() => {
      act(() => closeActionSheet());
      jest.restoreAllMocks();
    });

    it("lists all five actions plus Annuler in a DS sheet and runs only the pressed one", async () => {
      expect(Platform.OS).toBe("android");
      const alertSpy = jest.spyOn(Alert, "alert");
      const handlers = await openFiveActionMenu();

      expect(alertSpy).not.toHaveBeenCalled();
      expect(screen.getByText("Appartement Lyon")).toBeTruthy();
      for (const label of [...LABELS, "Annuler"]) {
        expect(screen.getByText(label)).toBeTruthy();
      }

      await fireEvent.press(screen.getByTestId("action-sheet-item-3"));
      expect(handlers[3]).toHaveBeenCalledTimes(1);
      for (const index of [0, 1, 2, 4]) expect(handlers[index]).not.toHaveBeenCalled();
      expect(screen.queryByText("Historique")).toBeNull();
    });

    it("closes without running anything on Annuler", async () => {
      const handlers = await openFiveActionMenu();
      await fireEvent.press(screen.getByTestId("action-sheet-cancel"));
      for (const handler of handlers) expect(handler).not.toHaveBeenCalled();
      expect(screen.queryByText("Appartement Lyon")).toBeNull();
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/action-sheet.test.tsx`
  Expected (RED): `Cannot find module '../../lib/action-sheet-host'`, `Test Suites: 1 failed`.

- [x] **T6.2 (GREEN) — Create `apps/mobile/lib/action-sheet-host.tsx`** [AC: AC-3]
  ```tsx
  // apps/mobile/lib/action-sheet-host.tsx
  // Story 10-6 AC-3 — Android row action menus. `Alert.alert` renders at most
  // three buttons on Android, so `showActions` (lib/actions.ts) routes Android
  // menus here: a module-level store holds the pending request and
  // <ActionSheetHost /> (mounted once, Android only, in app/_layout.tsx) renders
  // it as a Pekulo DS bottom sheet (`PekuloDrawer` native → @tamagui/sheet)
  // listing every action + « Annuler ». iOS keeps `ActionSheetIOS`.

  import { PekuloDrawer } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useSyncExternalStore } from "react";
  import { Pressable, ScrollView } from "react-native";

  import { tNow } from "./i18n";

  export interface ActionSheetItem {
    label: string;
    destructive?: boolean;
    onPress: () => void;
  }

  export interface ActionSheetRequest {
    title: string;
    message?: string;
    actions: ActionSheetItem[];
  }

  type Listener = () => void;

  let current: ActionSheetRequest | null = null;
  const listeners = new Set<Listener>();

  function emit() {
    for (const listener of listeners) listener();
  }

  export function openActionSheet(request: ActionSheetRequest) {
    current = request;
    emit();
  }

  export function closeActionSheet() {
    current = null;
    emit();
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot() {
    return current;
  }

  /** One 48dp Material touch target per action; destructive actions in `$danger`. */
  function ActionRow({
    label,
    destructive = false,
    onPress,
    testID,
  }: {
    label: string;
    destructive?: boolean;
    onPress: () => void;
    testID: string;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 48,
          justifyContent: "center",
          paddingHorizontal: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          color={destructive ? "$danger" : "$color"}
          fontSize="$body"
          fontWeight={destructive ? "500" : "400"}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  export function ActionSheetHost() {
    const request = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return (
      <PekuloDrawer
        open={request !== null}
        onOpenChange={(next) => {
          if (!next) closeActionSheet();
        }}
      >
        <PekuloDrawer.Portal>
          <PekuloDrawer.Content testID="action-sheet">
            {request ? (
              <>
                <PekuloDrawer.Header>
                  <PekuloDrawer.Title>{request.title}</PekuloDrawer.Title>
                  {request.message ? (
                    <PekuloDrawer.Description>{request.message}</PekuloDrawer.Description>
                  ) : null}
                </PekuloDrawer.Header>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View gap="$1">
                    {request.actions.map((action, index) => (
                      <ActionRow
                        key={`${index}-${action.label}`}
                        label={action.label}
                        destructive={action.destructive}
                        testID={`action-sheet-item-${index}`}
                        onPress={() => {
                          closeActionSheet();
                          action.onPress();
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
                <ActionRow
                  label={tNow("common.actions.cancel")}
                  testID="action-sheet-cancel"
                  onPress={closeActionSheet}
                />
              </>
            ) : null}
          </PekuloDrawer.Content>
        </PekuloDrawer.Portal>
      </PekuloDrawer>
    );
  }
  ```
  Then in `apps/mobile/lib/actions.ts` replace the header comment + imports + `showActions`
  ```ts
  // apps/mobile/lib/actions.ts
  // Native iOS interaction helpers: row action sheets (`ActionSheetIOS`, with an
  // `Alert` fallback on Android), destructive confirmations, and the single place
  // that turns a mutation error into the right feedback — sign-in prompt in
  // preview mode, inline message for validation, toast for anything else.

  import { ActionSheetIOS, Alert, Platform } from "react-native";

  import { FormValidationError } from "./forms";
  import { tNow, type MessageKey } from "./i18n";
  import { PreviewModeError } from "./hooks/use-mobile-mutations";
  import { orpcErrorCode } from "./orpc/errors";

  export interface RowAction {
    label: string;
    destructive?: boolean;
    onPress: () => void;
  }

  export function showActions(title: string, actions: RowAction[], message?: string) {
    const labels = [...actions.map((a) => a.label), tNow("common.actions.cancel")];
    const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: labels,
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: destructive,
        },
        (index) => {
          actions[index]?.onPress();
        },
      );
      return;
    }

    Alert.alert(title, message, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ("destructive" as const) : ("default" as const),
        onPress: a.onPress,
      })),
      { text: tNow("common.actions.cancel"), style: "cancel" as const },
    ]);
  }
  ```
  with
  ```ts
  // apps/mobile/lib/actions.ts
  // Native interaction helpers: row action sheets (`ActionSheetIOS` on iOS, the
  // Pekulo DS `ActionSheetHost` on Android — story 10-6 AC-3, because Android
  // `Alert` dialogs cap at three buttons), destructive confirmations, and the
  // single place that turns a mutation error into the right feedback — sign-in
  // prompt in preview mode, inline message for validation, toast for anything else.

  import { ActionSheetIOS, Alert, Platform } from "react-native";

  import { openActionSheet } from "./action-sheet-host";
  import { FormValidationError } from "./forms";
  import { tNow, type MessageKey } from "./i18n";
  import { PreviewModeError } from "./hooks/use-mobile-mutations";
  import { orpcErrorCode } from "./orpc/errors";

  export interface RowAction {
    label: string;
    destructive?: boolean;
    onPress: () => void;
  }

  export function showActions(title: string, actions: RowAction[], message?: string) {
    if (Platform.OS === "ios") {
      const labels = [...actions.map((a) => a.label), tNow("common.actions.cancel")];
      const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: labels,
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: destructive,
        },
        (index) => {
          actions[index]?.onPress();
        },
      );
      return;
    }

    openActionSheet({ title, message, actions });
  }
  ```
  (`confirmDestructive`, `CONTRACT_ERROR_COPY`, `contractErrorCopy`, `handleMutationError` stay byte-identical; `Alert` is still imported for them.)
  Then mount the host in `apps/mobile/app/_layout.tsx` — done as part of the full-file replacement in T9.5. Until T9.5 lands the host is only mounted by the test, which is enough for this task.
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/action-sheet.test.tsx`
  Expected: `✓ lists all five actions plus Annuler in a DS sheet and runs only the pressed one`, `✓ closes without running anything on Annuler`, `Tests: 2 passed, 2 total`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios`
  Expected: `Test Suites: 18 passed, 18 total` (16 baseline + guards + account-deletion), 0 failed — iOS `ActionSheetIOS` path unchanged.
  Commit: `git add apps/mobile/lib/action-sheet-host.tsx apps/mobile/lib/actions.ts apps/mobile/__tests__/android/action-sheet.test.tsx && git commit -m "feat(#162): Android row action menus in a Pekulo DS sheet"`

**T7 — Android tab headers** [AC: AC-2]

- [x] **T7.1 (RED) — Add the Android `Stack` stand-in + `apps/mobile/__tests__/android/headers.test.tsx`** [AC: AC-2]
  Create `apps/mobile/__tests__/android/helpers/android-stack-mock.ts` (not matched by `testMatch`, which only takes `*.test.*`):
  ```ts
  // apps/mobile/__tests__/android/helpers/android-stack-mock.ts
  // Story 10-6 AC-2 — `expo-router/stack` stand-in for the android Jest project.
  // `Stack.Toolbar` / `Stack.Toolbar.Button` THROW the exact error expo-router 58
  // raises on Android without `@expo/ui`
  // (build/layouts/stack-utils/toolbar/processHeaderItemsForPlatform.android.js),
  // so any Android render path that still reaches them fails the test.
  // `Stack.Screen` renders `options.headerRight()` so header actions can be pressed.
  import { Fragment, createElement, type ReactNode } from "react";
  import { View } from "react-native";

  export const ANDROID_TOOLBAR_ERROR =
    "Stack.Toolbar on Android requires '@expo/ui'. Install it with `npx expo install @expo/ui` and rebuild your app.";

  interface MockScreenOptions {
    title?: string;
    headerRight?: () => ReactNode;
  }

  export function createAndroidStackMock() {
    function MockStack({ children }: { children?: ReactNode }) {
      return createElement(Fragment, null, children);
    }
    MockStack.Screen = function MockStackScreen({ options }: { options?: MockScreenOptions }) {
      if (!options?.headerRight) return null;
      return createElement(View, { testID: "mock-native-header-right" }, options.headerRight());
    };
    function MockToolbar(): never {
      throw new Error(ANDROID_TOOLBAR_ERROR);
    }
    MockToolbar.Button = function MockToolbarButton(): never {
      throw new Error(ANDROID_TOOLBAR_ERROR);
    };
    MockStack.Toolbar = MockToolbar;
    return { __esModule: true, default: MockStack };
  }
  ```
  Create `apps/mobile/__tests__/android/headers.test.tsx`:
  ```tsx
  // apps/mobile/__tests__/android/headers.test.tsx
  // Story 10-6 AC-2 — Android header surfaces never reach Stack.Toolbar.
  //
  // AC-2 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given the app running on Android, When any primary tab, Paramètres, or any
  //   form sheet renders, Then no iOS-only toolbar item is rendered (they crash on
  //   Android without the optional Expo UI module); the four tabs with header
  //   actions show their create (+) and profile buttons in the native header, on an
  //   opaque Pekulo-coloured header that never overlaps the content; every form
  //   sheet shows an in-content header row (Annuler/Fermer · title · primary action)
  //   and its primary action submits the form; Paramètres shows its own title and
  //   closes with the system back action; And iOS headers and toolbar items are
  //   unchanged.
  const mockBack = jest.fn();
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  jest.mock("expo-router", () => {
    const actual = jest.requireActual("expo-router");
    return {
      ...actual,
      useLocalSearchParams: () => ({}),
      useRouter: () => ({
        back: mockBack,
        push: mockPush,
        replace: mockReplace,
        canGoBack: () => true,
      }),
    };
  });

  jest.mock("expo-router/stack", () =>
    require("./helpers/android-stack-mock").createAndroidStackMock(),
  );

  import { PekuloRootProvider } from "@pekulo/ui";
  import { Text } from "@pekulo/ui/client";
  import { fireEvent, render, screen } from "@testing-library/react-native";
  import type { ReactNode } from "react";

  import { SheetScaffold } from "../../components/form/sheet";
  import { TabToolbar } from "../../components/tab-stack-layout";

  async function renderThemed(ui: ReactNode) {
    return await render(<PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>);
  }

  describe("Android headers (story 10-6, AC-2)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("TabToolbar puts + and profile in the native header without Stack.Toolbar", async () => {
      const onAdd = jest.fn();
      await renderThemed(<TabToolbar onAdd={onAdd} addLabel="Nouvelle transaction" />);
      expect(screen.getByTestId("mock-native-header-right")).toBeTruthy();
      expect(screen.getByLabelText("Nouvelle transaction")).toBeTruthy();
      await fireEvent.press(screen.getByTestId("header-add-btn"));
      expect(onAdd).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByTestId("header-settings-btn"));
      expect(mockPush).toHaveBeenCalledWith("/parametres");
    });

    it("TabToolbar without onAdd renders only the profile button", async () => {
      await renderThemed(<TabToolbar />);
      expect(screen.queryByTestId("header-add-btn")).toBeNull();
      expect(screen.getByTestId("header-settings-btn")).toBeTruthy();
    });

    it("SheetScaffold renders an in-content header whose primary action submits", async () => {
      const onPrimary = jest.fn();
      await renderThemed(
        <SheetScaffold title="Nouvelle valorisation" onPrimary={onPrimary}>
          <Text>Corps du formulaire</Text>
        </SheetScaffold>,
      );
      expect(screen.getByText("Nouvelle valorisation")).toBeTruthy();
      expect(screen.getByText("Corps du formulaire")).toBeTruthy();
      expect(screen.getByText("Annuler")).toBeTruthy();
      expect(screen.getByText("Enregistrer")).toBeTruthy();
      await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
      expect(onPrimary).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByTestId("sheet-dismiss-btn"));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("SheetScaffold ignores the primary action while it is disabled", async () => {
      const onPrimary = jest.fn();
      await renderThemed(
        <SheetScaffold title="Compte" onPrimary={onPrimary} primaryDisabled>
          <Text>Corps</Text>
        </SheetScaffold>,
      );
      await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
      expect(onPrimary).not.toHaveBeenCalled();
    });

    it("SheetScaffold without a primary action shows Fermer only", async () => {
      await renderThemed(
        <SheetScaffold title="Historique">
          <Text>Corps</Text>
        </SheetScaffold>,
      );
      expect(screen.getByText("Fermer")).toBeTruthy();
      expect(screen.queryByTestId("sheet-primary-btn")).toBeNull();
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/headers.test.tsx`
  Expected (RED): every test fails with `Stack.Toolbar on Android requires '@expo/ui'`, `Tests: 5 failed, 5 total`.

- [x] **T7.2 (GREEN) — Replace `apps/mobile/components/tab-stack-layout.tsx`** [AC: AC-2]
  Replace the whole file with:
  ```tsx
  // apps/mobile/components/tab-stack-layout.tsx
  // Shared native Stack layout for primary tabs.
  //   - iOS: native Large Title collapse, translucent header chrome synced to
  //     Pekulo themes, and real `UIBarButtonItem`s via `Stack.Toolbar` (React
  //     views in `headerRight` never receive taps on the iOS 26 navigation bar).
  //   - Android (story 10-6 AC-2): `Stack.Toolbar` throws without `@expo/ui`, so
  //     the same create/profile buttons render through `headerRight` (which works
  //     on Android) on an opaque Pekulo-coloured header — a transparent header
  //     would overlap the content because Android has no automatic content insets.

  import { pekuloColors, useThemeSetting } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useRouter } from "expo-router";
  import Stack from "expo-router/stack";
  import { SymbolView } from "expo-symbols";
  import { Platform, Pressable } from "react-native";
  import { useTheme } from "tamagui";

  import { useI18n, type MessageKey } from "../lib/i18n";

  export function SettingsHeaderButton({ testID = "header-settings-btn" }: { testID?: string }) {
    const theme = useTheme();
    const router = useRouter();
    const { t } = useI18n();
    // Same profile glyph as the native toolbar button on the other tabs.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.actions.openSettings")}
        hitSlop={4}
        testID={testID}
        onPress={() => router.push("/parametres")}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <SymbolView
          name={{ ios: "person.crop.circle", android: "account_circle" }}
          size={24}
          tintColor={theme.color.val}
          fallback={
            <Text color="$color" fontSize="$bodySm" fontWeight="600">
              ⚙︎
            </Text>
          }
        />
      </Pressable>
    );
  }

  /** 44×44pt "plus" button for a tab's primary create action. */
  export function HeaderAddButton({
    onPress,
    accessibilityLabel,
    testID = "header-add-btn",
  }: {
    onPress: () => void;
    accessibilityLabel: string;
    testID?: string;
  }) {
    const theme = useTheme();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={4}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <SymbolView
          name={{ ios: "plus", android: "add" }}
          size={20}
          weight="semibold"
          tintColor={theme.color.val}
          fallback={
            <Text color="$color" fontSize="$h2" fontWeight="500">
              +
            </Text>
          }
        />
      </Pressable>
    );
  }

  /** Header trailing items: optional create button, then the settings avatar. */
  export function TabHeaderActions({
    onAdd,
    addLabel,
    settingsTestID,
  }: {
    onAdd?: () => void;
    addLabel?: string;
    settingsTestID?: string;
  }) {
    return (
      <View flexDirection="row" alignItems="center">
        {onAdd ? (
          <HeaderAddButton onPress={onAdd} accessibilityLabel={addLabel ?? "Ajouter"} />
        ) : null}
        <SettingsHeaderButton testID={settingsTestID} />
      </View>
    );
  }

  /**
   * Header items for a tab screen: render inside the screen, e.g.
   * `<TabToolbar onAdd={…} addLabel="…" />`.
   *   - iOS: real `UIBarButtonItem`s (`Stack.Toolbar.*` children must stay direct
   *     children of `Stack.Toolbar`).
   *   - Android: `headerRight` with the same buttons (story 10-6 AC-2).
   */
  export function TabToolbar({ onAdd, addLabel }: { onAdd?: () => void; addLabel?: string }) {
    const router = useRouter();
    const { t } = useI18n();
    const resolvedAddLabel = addLabel ?? t("common.actions.add");

    if (Platform.OS === "android") {
      return (
        <Stack.Screen
          options={{
            headerRight: () => <TabHeaderActions onAdd={onAdd} addLabel={resolvedAddLabel} />,
          }}
        />
      );
    }

    return (
      <Stack.Toolbar placement="right">
        {onAdd ? (
          <Stack.Toolbar.Button icon="plus" accessibilityLabel={resolvedAddLabel} onPress={onAdd} />
        ) : null}
        <Stack.Toolbar.Button
          icon="person.crop.circle"
          accessibilityLabel={t("common.actions.openSettings")}
          onPress={() => router.push("/parametres")}
        />
      </Stack.Toolbar>
    );
  }

  export interface TabStackLayoutProps {
    titleKey: MessageKey;
  }

  export function TabStackLayout({ titleKey }: TabStackLayoutProps) {
    const { t } = useI18n();
    const title = t(titleKey);
    const { resolvedTheme } = useThemeSetting();
    const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;

    const screenOptions =
      Platform.OS === "android"
        ? {
            headerShadowVisible: false,
            headerStyle: { backgroundColor: palette.surface.bg },
            headerTitleStyle: { color: palette.text.primary },
            headerTintColor: palette.text.primary,
            contentStyle: { backgroundColor: palette.surface.bg },
          }
        : {
            headerTransparent: true,
            headerLargeTitle: true,
            headerShadowVisible: false,
            headerLargeTitleShadowVisible: false,
            headerLargeStyle: { backgroundColor: "transparent" },
            headerTitleStyle: { color: palette.text.primary },
            headerLargeTitleStyle: { color: palette.text.primary },
            headerTintColor: palette.text.primary,
            headerBackButtonDisplayMode: "minimal" as const,
            contentStyle: { backgroundColor: palette.surface.bg },
          };

    return (
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title }} />
      </Stack>
    );
  }
  ```
  Note: `SettingsHeaderButton` moves from `<Link href asChild>` to `router.push("/parametres")` — same navigation, but testable with a mocked `useRouter` and identical for `navigation-tabs.test.tsx` (`renderRouter`). The iOS `Stack.Toolbar` branch is byte-equivalent to 10-4 except for the shared `resolvedAddLabel`.
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/headers.test.tsx`
  Expected: the two `TabToolbar` tests pass; the three `SheetScaffold` tests still fail (`Stack.Toolbar on Android requires '@expo/ui'`) — `Tests: 3 failed, 2 passed, 5 total`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/navigation-tabs.test.tsx __tests__/cap-screen.test.tsx __tests__/i18n-cap.test.tsx`
  Expected: `Test Suites: 3 passed, 3 total`.
  Commit: `git add apps/mobile/components/tab-stack-layout.tsx apps/mobile/__tests__/android/helpers/android-stack-mock.ts apps/mobile/__tests__/android/headers.test.tsx && git commit -m "feat(#162): Android tab headers via headerRight on an opaque bar"`

**T8 — Android form-sheet header** [AC: AC-2]

- [x] **T8.1 (GREEN) — Replace `apps/mobile/components/form/sheet.tsx`** [AC: AC-2]
  Replace the whole file with:
  ```tsx
  // apps/mobile/components/form/sheet.tsx
  // Shared scaffold for the form sheets (`app/sheets/*`).
  //   - iOS: the native header carries Annuler (left) and the primary action
  //     (right, bold) through `Stack.Toolbar`.
  //   - Android (story 10-6 AC-2): `Stack.Toolbar` throws without `@expo/ui` and
  //     the sheets are presented headerless (app/_layout.tsx), so the same three
  //     controls render as an in-content header row.
  // The body is the standard keyboard-aware `ScreenShell`, and `useMutationRunner`
  // centralises success toasts, dismissal and error routing (sign-in prompt in
  // preview mode, inline message for validation, toast otherwise).

  import { pekuloColors, useThemeSetting, useToast } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useRouter } from "expo-router";
  import Stack from "expo-router/stack";
  import { useRef, useState, type ReactNode } from "react";
  import { Platform, Pressable } from "react-native";

  import { handleMutationError } from "../../lib/actions";
  import { useI18n } from "../../lib/i18n";
  import { ScreenShell } from "../screen-shell";
  import { FormError } from "./fields";

  /**
   * Runs a mutation with consistent feedback. `dismiss` closes the sheet on
   * success; the returned `error` is the inline validation message, if any.
   */
  export function useMutationRunner({ dismiss = false }: { dismiss?: boolean } = {}) {
    const router = useRouter();
    const toast = useToast();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    // `pending` state lags a render behind: two taps dispatched before the
    // re-render would both pass it and post a duplicate. The ref closes that.
    const inFlight = useRef(false);

    async function run(action: () => Promise<unknown>, successTitle?: string) {
      if (inFlight.current) return false;
      inFlight.current = true;
      setError(null);
      setPending(true);
      try {
        await action();
        if (successTitle) toast.success(successTitle);
        if (dismiss && router.canGoBack()) router.back();
        return true;
      } catch (caught) {
        setError(
          handleMutationError(caught, {
            goToLogin: () => {
              if (dismiss && router.canGoBack()) router.back();
              router.push("/login");
            },
            toastDanger: (title, message) => toast.danger(title, message),
          }),
        );
        return false;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    }

    return { run, error, setError, pending };
  }

  /** Android in-content header button: 48dp touch target, Pekulo ink, no system tint. */
  function SheetHeaderButton({
    label,
    onPress,
    disabled = false,
    emphasized = false,
    testID,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    emphasized?: boolean;
    testID: string;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        testID={testID}
        hitSlop={8}
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => ({
          minHeight: 48,
          minWidth: 48,
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        })}
      >
        <Text color="$color" fontSize="$body" fontWeight={emphasized ? "600" : "400"}>
          {label}
        </Text>
      </Pressable>
    );
  }

  export function SheetScaffold({
    title,
    primaryLabel,
    onPrimary,
    primaryDisabled,
    error,
    children,
  }: {
    title: string;
    primaryLabel?: string;
    onPrimary?: () => void;
    primaryDisabled?: boolean;
    error?: string | null;
    children: ReactNode;
  }) {
    const router = useRouter();
    const { t } = useI18n();
    const primary = primaryLabel ?? t("common.actions.save");
    const dismissLabel = onPrimary ? t("common.actions.cancel") : t("common.actions.close");
    const { resolvedTheme } = useThemeSetting();
    // TR-strict chrome: the primary action uses the Pekulo ink, not system blue.
    const ink = (resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark).text
      .primary;
    const dismiss = () => {
      if (router.canGoBack()) router.back();
    };

    if (Platform.OS === "android") {
      return (
        <>
          <Stack.Screen options={{ title }} />
          <ScreenShell>
            <View flexDirection="row" alignItems="center" justifyContent="space-between" gap="$3">
              <SheetHeaderButton label={dismissLabel} onPress={dismiss} testID="sheet-dismiss-btn" />
              <Text
                flex={1}
                textAlign="center"
                color="$color"
                fontSize="$body"
                fontWeight="600"
                numberOfLines={1}
                accessibilityRole="header"
              >
                {title}
              </Text>
              {onPrimary ? (
                <SheetHeaderButton
                  label={primary}
                  onPress={onPrimary}
                  disabled={primaryDisabled}
                  emphasized
                  testID="sheet-primary-btn"
                />
              ) : (
                <View width={48} />
              )}
            </View>
            {children}
            <FormError message={error} />
          </ScreenShell>
        </>
      );
    }

    return (
      <>
        <Stack.Screen options={{ title }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button accessibilityLabel={dismissLabel} onPress={dismiss}>
            {dismissLabel}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        {onPrimary ? (
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              variant="done"
              tintColor={ink}
              accessibilityLabel={primary}
              disabled={primaryDisabled}
              onPress={onPrimary}
            >
              {primary}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        ) : null}
        <ScreenShell>
          {children}
          <FormError message={error} />
        </ScreenShell>
      </>
    );
  }
  ```
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/headers.test.tsx`
  Expected: `Tests: 5 passed, 5 total`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/form-kit.test.tsx __tests__/sheets-transactions-cap.test.tsx __tests__/sheets-monthly-portfolio-realestate.test.tsx __tests__/settings-interactions.test.tsx`
  Expected: `Test Suites: 4 passed, 4 total` (iOS sheets unchanged; the iOS mock still exposes `sheet-primary-btn` through `variant="done"`).
  Commit: `git add apps/mobile/components/form/sheet.tsx && git commit -m "feat(#162): in-content form-sheet header on Android"`

**T9 — Root layout, Paramètres, and the Android deletion sheet** [AC: AC-2, AC-3, AC-4, AC-6]

- [x] **T9.1 (RED) — Add `apps/mobile/__tests__/android/account-deletion.test.tsx`** [AC: AC-2, AC-3, AC-4, AC-6]
  ```tsx
  // apps/mobile/__tests__/android/account-deletion.test.tsx
  // Story 10-6 AC-2 / AC-4 — Paramètres and account deletion on Android.
  //
  // AC-4 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given an authenticated user on Android, When they press « Supprimer mon compte
  //   » in Paramètres, Then a deletion sheet opens; typing an email that does not
  //   match the account email (ignoring case and surrounding spaces) shows the «
  //   E-mail incorrect » alert and calls nothing; typing the matching email deletes
  //   the account, signs out and returns to the login screen; And iOS keeps its
  //   native text prompt, with the same email check on both platforms.
  const mockBack = jest.fn();
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  jest.mock("expo-router", () => {
    const actual = jest.requireActual("expo-router");
    return {
      ...actual,
      useLocalSearchParams: () => ({}),
      useRouter: () => ({
        back: mockBack,
        push: mockPush,
        replace: mockReplace,
        canGoBack: () => true,
      }),
    };
  });

  jest.mock("expo-router/stack", () =>
    require("./helpers/android-stack-mock").createAndroidStackMock(),
  );

  jest.mock("../../lib/orpc/modules", () => {
    const actual = jest.requireActual("../../lib/orpc/modules");
    return {
      ...actual,
      compassClient: { getCompass: jest.fn(), updateCompass: jest.fn() },
      llmClient: { getOptIn: jest.fn(), setOptIn: jest.fn() },
      settingsClient: {
        get: jest.fn(),
        updateTheme: jest.fn(),
        updateLang: jest.fn(),
        deleteAccount: jest.fn(),
      },
    };
  });

  import { PekuloRootProvider } from "@pekulo/ui";
  import type { Session } from "@supabase/supabase-js";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
  import type { ReactNode } from "react";
  import { Alert } from "react-native";

  import ParametresScreen from "../../app/parametres";
  import DeleteAccountSheet from "../../app/sheets/delete-account";
  import { AuthProvider, createMobileQueryClient } from "../../lib/auth/auth-context";
  import { compassClient, llmClient, settingsClient } from "../../lib/orpc/modules";
  import { supabase } from "../../lib/supabase/client";
  import { deleteAccountResult } from "../helpers/contract-fixtures";

  const SESSION: Session = {
    access_token: "jwt",
    refresh_token: "r",
    expires_in: 3600,
    expires_at: 1999999999,
    token_type: "bearer",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "alex@pekulo.app",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-05-03T00:00:00Z",
    },
  };

  async function renderLive(ui: ReactNode) {
    const queryClient = createMobileQueryClient();
    return await render(
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider theme="pekulo-light">
          <AuthProvider initialSession={SESSION} requireAuth={false}>
            {ui}
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>,
    );
  }

  describe("Paramètres and account deletion on Android (story 10-6, AC-2/AC-4)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
      (compassClient.getCompass as jest.Mock).mockResolvedValue({
        objectif: 800000,
        horizonYears: 30,
      });
      (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
      (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "fr" });
    });

    it("renders Paramètres with its own title and no Stack.Toolbar", async () => {
      await renderLive(<ParametresScreen />);
      expect(await screen.findByText("Paramètres")).toBeTruthy();
      expect(screen.getByTestId("delete-account-btn")).toBeTruthy();
    });

    it("opens the deletion sheet instead of Alert.prompt", async () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      await renderLive(<ParametresScreen />);
      await fireEvent.press(await screen.findByTestId("delete-account-btn"));
      expect(mockPush).toHaveBeenCalledWith("/sheets/delete-account");
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it("refuses a non-matching email without calling the API", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      await renderLive(<DeleteAccountSheet />);
      await fireEvent.changeText(screen.getByTestId("delete-account-email"), "bob@pekulo.app");
      await fireEvent.press(screen.getByTestId("delete-account-confirm-btn"));
      expect(alertSpy).toHaveBeenCalledWith(
        "E-mail incorrect",
        "Saisissez exactement l’adresse e-mail de votre compte.",
      );
      expect(settingsClient.deleteAccount).not.toHaveBeenCalled();
    });

    it("deletes the account after typing the account email, then signs out", async () => {
      (settingsClient.deleteAccount as jest.Mock).mockResolvedValue(deleteAccountResult());
      const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
      await renderLive(<DeleteAccountSheet />);
      await fireEvent.changeText(screen.getByTestId("delete-account-email"), " Alex@Pekulo.app ");
      await fireEvent.press(screen.getByTestId("delete-account-confirm-btn"));
      await waitFor(() =>
        expect(settingsClient.deleteAccount).toHaveBeenCalledWith({
          confirmationEmail: "Alex@Pekulo.app",
        }),
      );
      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    });
  });
  ```
  Note: `confirmationEmail` is sent trimmed but with the user's casing — exactly what 10-4's iOS path sends (`typed.trim()`). `deleteUserAccountInputSchema` (`packages/validators/src/settings/deletion.schemas.ts`) is `z.object({ confirmationEmail: z.string().min(1).max(320) })`, so the mixed-case value passes client validation; the server compares it to the JWT email (story 11-2). Do NOT lowercase in the app.
  Run: `cd apps/mobile && bunx jest --selectProjects android __tests__/android/account-deletion.test.tsx`
  Expected (RED): `Cannot find module '../../app/sheets/delete-account'`, `Test Suites: 1 failed`.

- [x] **T9.2 (GREEN) — i18n: add `settings.deletion.emailLabel`, drop `settings.deletion.webOnly`** [AC: AC-2, AC-3, AC-4, AC-6]
  In `apps/mobile/lib/i18n/messages/settings.ts`, French block — replace
  ```ts
      yourEmail: "votre e-mail",
      webOnly: "Supprimez votre compte depuis l’espace web Pekulo.",
  ```
  with
  ```ts
      yourEmail: "votre e-mail",
      emailLabel: "E-mail du compte",
  ```
  English block — replace
  ```ts
      yourEmail: "your email",
      webOnly: "Delete your account from the Pekulo web app.",
  ```
  with
  ```ts
      yourEmail: "your email",
      emailLabel: "Account email",
  ```
  (`Shape<typeof fr>` forces both blocks to change together; `webOnly`'s only consumer is the Android branch of `handleDeleteAccount`, replaced in T9.4.)

- [x] **T9.3 (GREEN) — Create `apps/mobile/app/sheets/delete-account.tsx`** [AC: AC-2, AC-3, AC-4, AC-6]
  ```tsx
  // apps/mobile/app/sheets/delete-account.tsx
  // Story 10-6 AC-4 — Android account deletion with typed-email confirmation.
  // `Alert.prompt` (the iOS path in app/parametres.tsx) does not exist on Android;
  // this sheet runs the same `isDeletionEmailConfirmed` check and the same
  // `useDeleteUserAccount` mutation (which signs out), then replaces to /login.
  // Presented only from the Android branch of Paramètres.

  import { Text } from "@pekulo/ui/client";
  import { useRouter } from "expo-router";
  import { useState } from "react";
  import { Alert } from "react-native";

  import { DestructiveButton, FormSection, TextField } from "../../components/form/fields";
  import { SheetScaffold, useMutationRunner } from "../../components/form/sheet";
  import { isDeletionEmailConfirmed } from "../../lib/account-deletion";
  import { useAuth } from "../../lib/auth/auth-context";
  import { useDeleteUserAccount } from "../../lib/hooks/use-mobile-mutations";
  import { useI18n } from "../../lib/i18n";

  export default function DeleteAccountSheet() {
    const router = useRouter();
    const { userEmail } = useAuth();
    const deleteAccount = useDeleteUserAccount();
    const { run, error, pending } = useMutationRunner();
    const { t } = useI18n();
    const [typed, setTyped] = useState("");

    function handleConfirm() {
      if (pending) return;
      if (!isDeletionEmailConfirmed(typed, userEmail)) {
        Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
        return;
      }
      const confirmationEmail = typed.trim();
      void run(async () => {
        await deleteAccount.mutateAsync({ confirmationEmail });
        router.replace("/login");
      }, t("settings.deletion.done"));
    }

    return (
      <SheetScaffold title={t("settings.deletion.title")} error={error}>
        <FormSection>
          <Text color="$colorSecondary" fontSize="$bodySm">
            {t("settings.deletion.message", {
              email: userEmail ?? t("settings.deletion.yourEmail"),
            })}
          </Text>
          <TextField
            label={t("settings.deletion.emailLabel")}
            value={typed}
            onChange={setTyped}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="delete-account-email"
          />
        </FormSection>
        <DestructiveButton
          label={t("settings.deletion.button")}
          onPress={handleConfirm}
          testID="delete-account-confirm-btn"
        />
      </SheetScaffold>
    );
  }
  ```

- [x] **T9.4 (GREEN) — Android branch of `apps/mobile/app/parametres.tsx`** [AC: AC-2, AC-3, AC-4, AC-6]
  Replace the header comment
  ```tsx
  // apps/mobile/app/parametres.tsx
  // Mobile Paramètres native iOS form sheet: omits duplicate inline header title
  // (owned by native Stack formSheet header), gives account identity + auth CTA
  // spacious vertical layout for 375pt iPhones, prompts a native iOS destructive
  // confirmation alert before sign-out, and syncs theme & language with
  // `useThemeSetting()` and `settingsClient`.
  ```
  with
  ```tsx
  // apps/mobile/app/parametres.tsx
  // Mobile Paramètres form sheet: on iOS the native Stack formSheet header owns
  // the title and the Fermer toolbar item; on Android (story 10-6 AC-2) the sheet
  // is headerless, so the title renders in-content and the system back action
  // closes it. Gives account identity + auth CTA spacious vertical layout,
  // prompts a destructive confirmation before sign-out, routes account deletion
  // to `Alert.prompt` (iOS) or the `sheets/delete-account` sheet (Android,
  // AC-4), and syncs theme & language with `useThemeSetting()` and `settingsClient`.
  ```
  Replace the whole `handleDeleteAccount` function
  ```tsx
    function handleDeleteAccount() {
      const message = t("settings.deletion.message", {
        email: userEmail ?? t("settings.deletion.yourEmail"),
      });
      if (Platform.OS === "ios") {
        Alert.prompt(
          t("settings.deletion.title"),
          message,
          [
            { text: t("common.actions.cancel"), style: "cancel" },
            {
              text: t("common.actions.delete"),
              style: "destructive",
              onPress: confirmAccountDeletion,
            },
          ],
          "plain-text",
          "",
          "email-address",
        );
        return;
      }
      Alert.alert(t("settings.deletion.title"), t("settings.deletion.webOnly"));
    }
  ```
  with
  ```tsx
    function handleDeleteAccount() {
      if (Platform.OS !== "ios") {
        // `Alert.prompt` is iOS-only: Android types the email in a sheet (AC-4).
        router.push("/sheets/delete-account");
        return;
      }
      const message = t("settings.deletion.message", {
        email: userEmail ?? t("settings.deletion.yourEmail"),
      });
      Alert.prompt(
        t("settings.deletion.title"),
        message,
        [
          { text: t("common.actions.cancel"), style: "cancel" },
          {
            text: t("common.actions.delete"),
            style: "destructive",
            onPress: confirmAccountDeletion,
          },
        ],
        "plain-text",
        "",
        "email-address",
      );
    }
  ```
  Replace the top of the returned JSX
  ```tsx
    return (
      <ScreenShell>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t("common.actions.closeSettings")}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/");
            }}
          >
            {t("common.actions.close")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
  ```
  with
  ```tsx
    const isAndroid = Platform.OS === "android";

    return (
      <ScreenShell title={isAndroid ? t("settings.title") : undefined}>
        {isAndroid ? null : (
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              accessibilityLabel={t("common.actions.closeSettings")}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
            >
              {t("common.actions.close")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        )}
  ```

- [x] **T9.5 (GREEN) — Replace `apps/mobile/app/_layout.tsx`** [AC: AC-2, AC-3, AC-4, AC-6]
  Replace the whole file with:
  ```tsx
  // apps/mobile/app/_layout.tsx
  // Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
  // QueryClientProvider, PekuloRootProvider (@pekulo/ui), and AuthProvider,
  // holds splash screen until fonts AND auth session state resolve (zero login
  // flash), syncs React Navigation ThemeProvider with active Pekulo theme, and
  // presents Paramètres + the edit/create flows as native form sheets:
  //   - iOS: native transparent header carrying `Stack.Toolbar` items;
  //   - Android (story 10-6 AC-2/AC-6): headerless (the scaffold renders its own
  //     header row), `sheetElevation: 0` (design-spec: no drop shadows), plus the
  //     DS `ActionSheetHost` for row action menus (AC-3).

  import {
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  } from "@expo-google-fonts/geist";
  import {
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  } from "@expo-google-fonts/geist-mono";
  import { PekuloRootProvider, pekuloColors, useThemeSetting } from "@pekulo/ui";
  import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { useFonts } from "expo-font";
  import { usePathname, useRouter } from "expo-router";
  import Stack from "expo-router/stack";
  import * as SplashScreen from "expo-splash-screen";
  import { StatusBar } from "expo-status-bar";
  import { useEffect, useState, type ReactNode } from "react";
  import { Platform } from "react-native";

  import { ActionSheetHost } from "../lib/action-sheet-host";
  import { AuthProvider, createMobileQueryClient, useAuth } from "../lib/auth/auth-context";
  import { isDsGalleryEnabled } from "../lib/ds-gallery";
  import { useMobileSettingsData } from "../lib/hooks/use-mobile-queries";
  import { I18nProvider, useI18n } from "../lib/i18n";

  void SplashScreen.preventAutoHideAsync().catch(() => {});

  const IS_ANDROID = Platform.OS === "android";

  // Edit/create flows presented as native form sheets. Short forms open at a
  // medium detent and can be dragged to full height; long forms open full height.
  // Android honours at most three detents — every entry stays ≤ 2.
  const SHEET_ROUTES: { name: string; detents: number[] }[] = [
    { name: "sheets/transaction", detents: [1.0] },
    { name: "sheets/milestone", detents: [0.6, 1.0] },
    { name: "sheets/account", detents: [1.0] },
    { name: "sheets/account-balance", detents: [0.5, 1.0] },
    { name: "sheets/holding", detents: [1.0] },
    { name: "sheets/lot", detents: [1.0] },
    { name: "sheets/property", detents: [0.75, 1.0] },
    { name: "sheets/valuation", detents: [0.5, 1.0] },
    { name: "sheets/valuations", detents: [0.6, 1.0] },
    { name: "sheets/mortgage", detents: [1.0] },
    { name: "sheets/rental", detents: [0.6, 1.0] },
    { name: "sheets/cloture", detents: [1.0] },
    { name: "sheets/compass", detents: [0.6, 1.0] },
    { name: "sheets/delete-account", detents: [0.6, 1.0] },
  ];

  /** Form-sheet presentation shared by Paramètres and every `sheets/*` route. */
  function sheetOptions(detents: number[], chrome: { background: string; ink: string }) {
    if (IS_ANDROID) {
      return {
        headerShown: false,
        presentation: "formSheet" as const,
        sheetGrabberVisible: true,
        sheetAllowedDetents: detents,
        sheetElevation: 0,
        contentStyle: { backgroundColor: chrome.background },
      };
    }
    return {
      headerShown: true,
      presentation: "formSheet" as const,
      sheetGrabberVisible: true,
      sheetAllowedDetents: detents,
      headerTransparent: true,
      headerShadowVisible: false,
      headerTitleStyle: { color: chrome.ink },
      headerTintColor: chrome.ink,
      contentStyle: { backgroundColor: chrome.background },
    };
  }

  function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
    const { resolvedTheme } = useThemeSetting();
    const { isAuthenticated, isLoading, requireAuth } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useI18n();
    const isLight = resolvedTheme === "pekulo-light";
    const palette = isLight ? pekuloColors.light : pekuloColors.dark;
    const chrome = { background: palette.surface.bg, ink: palette.text.primary };

    useEffect(() => {
      if (fontsReady && !isLoading) {
        void SplashScreen.hideAsync().catch(() => {});
      }
    }, [fontsReady, isLoading]);

    useEffect(() => {
      if (isLoading) return;
      const isDsGalleryRoute = isDsGalleryEnabled() && pathname.startsWith("/ds/");
      if (requireAuth && !isAuthenticated && pathname !== "/login" && !isDsGalleryRoute) {
        router.replace("/login");
      } else if (isAuthenticated && pathname === "/login") {
        router.replace("/");
      }
    }, [isAuthenticated, isLoading, pathname, requireAuth, router]);

    const navTheme = isLight
      ? {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: palette.surface.bg,
            card: palette.surface.card,
          },
        }
      : {
          ...DarkTheme,
          colors: { ...DarkTheme.colors, background: palette.surface.bg, card: palette.surface.card },
        };

    return (
      <ThemeProvider value={navTheme}>
        <StatusBar style={isLight ? "dark" : "light"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="parametres"
            options={{ ...sheetOptions([1.0], chrome), title: t("settings.title") }}
          />
          {SHEET_ROUTES.map((sheet) => (
            <Stack.Screen
              key={sheet.name}
              name={sheet.name}
              options={sheetOptions(sheet.detents, chrome)}
            />
          ))}
          <Stack.Screen
            name="login"
            options={{
              headerShown: false,
              title: "Connexion",
              animation: "fade",
              gestureEnabled: false,
            }}
          />
        </Stack>
        {IS_ANDROID ? <ActionSheetHost /> : null}
      </ThemeProvider>
    );
  }

  /** Drives the UI language from the saved `settings.lang` preference. */
  function LocalizedRoot({ children }: { children: ReactNode }) {
    const { prefs } = useMobileSettingsData();
    return <I18nProvider lang={prefs.lang}>{children}</I18nProvider>;
  }

  export default function RootLayout() {
    const [queryClient] = useState(() => createMobileQueryClient());
    const [fontsLoaded, fontError] = useFonts({
      Geist_400Regular,
      Geist_500Medium,
      Geist_600SemiBold,
      Geist_700Bold,
      GeistMono_400Regular,
      GeistMono_500Medium,
      GeistMono_600SemiBold,
      GeistMono_700Bold,
    });

    const fontsReady = Boolean(fontsLoaded || fontError);

    if (!fontsReady) {
      return null;
    }

    return (
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider>
          <AuthProvider>
            <LocalizedRoot>
              <RootNavigator fontsReady={fontsReady} />
            </LocalizedRoot>
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>
    );
  }
  ```
  On iOS the produced options are key-for-key the 10-5 ones (`headerShown`, `presentation`, `sheetGrabberVisible`, `sheetAllowedDetents`, `headerTransparent`, `headerShadowVisible`, `headerTitleStyle`, `headerTintColor`, `contentStyle`, plus `title` on Paramètres).

  Typed routes: `experiments.typedRoutes` reads `apps/mobile/.expo/types/router.d.ts`, a gitignored file generated by the dev server. If `tsc` rejects `"/sheets/delete-account"` as an `Href`, the local file is stale: run `rm -f apps/mobile/.expo/types/router.d.ts` (CI never has it; the next `expo start` regenerates it with the new route).
  Run: `cd apps/mobile && bunx jest --selectProjects android`
  Expected: `Test Suites: 4 passed, 4 total`, `Tests: 12 passed, 12 total` (platform 1, action-sheet 2, headers 5, account-deletion 4).
  Run: `cd apps/mobile && bunx jest --selectProjects ios`
  Expected: `Test Suites: 18 passed, 18 total`, 0 failed (including `i18n-assets-settings.test.tsx`, `auth-and-orpc.test.tsx`, `navigation-tabs.test.tsx`).
  Run: `bun --filter='@pekulo/mobile' run typecheck`
  Expected: exit 0.
  Commit: `git add apps/mobile/app/_layout.tsx apps/mobile/app/parametres.tsx apps/mobile/app/sheets/delete-account.tsx apps/mobile/lib/i18n/messages/settings.ts apps/mobile/__tests__/android/account-deletion.test.tsx && git commit -m "feat(#162): Android sheets, Paramètres and typed-email account deletion"`

**T10 — Android APK profile + local prebuild check** [AC: AC-1]

- [x] **T10.1 — `apps/mobile/eas.json`: build an APK for `e2e-test`** [AC: AC-1]
  Replace
  ```json
      "e2e-test": {
        "withoutCredentials": true,
        "bun": "1.3.14",
        "ios": {
          "simulator": true
        },
        "env": {
  ```
  with
  ```json
      "e2e-test": {
        "withoutCredentials": true,
        "bun": "1.3.14",
        "ios": {
          "simulator": true
        },
        "android": {
          "buildType": "apk"
        },
        "env": {
  ```
  Run: `cd apps/mobile && bunx expo prebuild --platform android --no-install`
  Expected: `✔ Finished prebuild` (no Android SDK is needed to generate the project; none is installed on the dev Mac — `ANDROID_HOME` points to a missing folder).
  Run: `grep -c 'android:scheme="pekulo"' apps/mobile/android/app/src/main/AndroidManifest.xml && git status --porcelain apps/mobile/android | wc -l`
  Expected: first number `≥ 1` (the `pekulo://ds/<case>` deep link resolves on Android), second number `0` (`apps/mobile/android/` is ignored by `.gitignore:97` and `.easignore`, verified at write time — no ignore change needed).
  Commit: `git add apps/mobile/eas.json && git commit -m "build(#162): e2e-test profile produces an Android APK"`

**T11 — Maestro flows for Android** [AC: AC-7]

- [x] **T11.1 — `apps/mobile/.maestro/flows/navigation.yaml`: platform-specific dismissal** [AC: AC-7]
  Replace the whole file with:
  ```yaml
  # Story 10-5 AC-5 / story 10-6 AC-7 — Paramètres opens from the Cap header and closes.
  # Targets the in-content settings button by testID (never a top-right
  # coordinate tap: the Expo dev-tools button sits there in Dev Client builds).
  # iOS dismisses the form sheet by swiping it down; Android uses the system back.
  appId: app.pekulo.mobile
  name: Navigation — Paramètres sheet opens from Cap and closes
  tags:
    - navigation
  ---
  - launchApp:
      clearState: true
      clearKeychain: true
  - extendedWaitUntil:
      visible: "Patrimoine total"
      timeout: 30000
  - tapOn:
      id: "open-settings-btn"
  - extendedWaitUntil:
      visible: "Apparence"
      timeout: 10000
  - assertVisible: "Compte"
  - assertVisible: "Mode aperçu"
  - runFlow:
      when:
        platform: iOS
      commands:
        - swipe:
            start: "50%, 12%"
            end: "50%, 92%"
  - runFlow:
      when:
        platform: Android
      commands:
        - back
  - extendedWaitUntil:
      notVisible: "Apparence"
      timeout: 10000
  - assertVisible: "Patrimoine total"
  ```
  (`smoke.yaml` and `preview-guard.yaml` are unchanged: they tap tab labels by text — visible on Android since T4.2 — and the « Plus tard » / « Se connecter » `Alert` buttons by text.)

- [x] **T11.2 — Generate both DS gallery flows from one test** [AC: AC-7]
  Replace the whole `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts` with:
  ```ts
  // apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts
  // Story 10-5 AC-5 / story 10-6 AC-7 — the DS gallery Maestro flows are
  // GENERATED from PARITY_CASES (one step block per golden case):
  //   - apps/mobile/.maestro/flows/ds-gallery.yaml          (iOS, byte-identical to 10-5)
  //   - apps/mobile/.maestro/flows/ds-gallery-android.yaml  (Android, tag `android-only`)
  // This test fails when a committed flow drifts from the catalog. Regenerate both with:
  //   cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts
  //
  // AC-5 (verbatim from story 10-5-mobile-parity-and-maestro:20):
  //   Given the iOS Simulator end-to-end build running in preview mode with no
  //   backend, When the Maestro suite runs, Then the five tabs show their preview
  //   figures, Paramètres opens from the Cap header and closes, a mutation
  //   attempted in preview mode shows the "Mode aperçu" sign-in prompt and can be
  //   dismissed, and every component's golden case matches its committed iOS
  //   screenshot at a 98 % similarity threshold — or is captured as a fresh
  //   screenshot when golden regeneration is requested; And the mobile test suite
  //   fails when the committed screenshot flow no longer matches the golden cases
  //   of the catalog.
  //
  // AC-7 (verbatim from story 10-6-android-parity-and-maestro):
  //   Given the Android end-to-end APK on an emulator in preview mode with no
  //   backend, When the Maestro suite runs, Then the smoke, navigation (Paramètres
  //   dismissed by back on Android, by swipe on iOS), preview-guard, and Android DS
  //   gallery flows pass, every component's golden case matching its committed
  //   Android screenshot at a 98 % similarity threshold — or being captured fresh
  //   when golden regeneration is requested; And the mobile test suite fails when
  //   either committed gallery flow (iOS, unchanged from 10-5, or Android) drifts
  //   from the parity catalog.
  //
  // Golden mode: MAESTRO_UPDATE_GOLDENS=true → takeScreenshot (artifacts),
  // otherwise assertScreenshot against apps/mobile/.maestro/goldens/<platform>/.
  import { PARITY_CASES } from "@pekulo/ui/parity";

  const { readFileSync, writeFileSync } = require("node:fs") as {
    readFileSync: (filePath: string, encoding: "utf8") => string;
    writeFileSync: (filePath: string, data: string) => void;
  };
  const path = require("node:path") as {
    dirname: (filePath: string) => string;
    resolve: (...segments: string[]) => string;
  };

  const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
  const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
  const UPDATE_GOLDENS =
    "${typeof MAESTRO_UPDATE_GOLDENS !== 'undefined' && MAESTRO_UPDATE_GOLDENS === 'true'}";
  const ASSERT_GOLDENS =
    "${typeof MAESTRO_UPDATE_GOLDENS === 'undefined' || MAESTRO_UPDATE_GOLDENS !== 'true'}";

  type GalleryPlatform = "ios" | "android";

  interface GalleryFlowSpec {
    /** Flow file, relative to apps/mobile. */
    file: string;
    headerComment: string;
    name: string;
    tags: string[];
    /** takeScreenshot `path` is relative to Maestro's artifact output. */
    capturePrefix: string;
    /** assertScreenshot `path` is resolved from the flow file. */
    assertPrefix: string;
    /** iOS asks "Open in Pekulo?" for a custom-scheme openLink; Android does not. */
    dismissOpenPrompt: boolean;
  }

  const FLOWS: Record<GalleryPlatform, GalleryFlowSpec> = {
    ios: {
      file: ".maestro/flows/ds-gallery.yaml",
      headerComment: "# Story 10-5 AC-5 — one iOS screenshot golden per @pekulo/ui component.",
      name: "DS gallery — iOS goldens",
      tags: ["ds-gallery"],
      capturePrefix: "goldens/ios/",
      assertPrefix: "../goldens/ios/",
      dismissOpenPrompt: true,
    },
    android: {
      file: ".maestro/flows/ds-gallery-android.yaml",
      headerComment: "# Story 10-6 AC-7 — one Android screenshot golden per @pekulo/ui component.",
      name: "DS gallery — Android goldens",
      tags: ["ds-gallery-android", "android-only"],
      capturePrefix: "goldens/android/",
      assertPrefix: "../goldens/android/",
      dismissOpenPrompt: false,
    },
  };

  function caseSteps(id: string, spec: GalleryFlowSpec): string[] {
    return [
      `- openLink: "pekulo://ds/${id}?theme=pekulo-dark"`,
      ...(spec.dismissOpenPrompt
        ? ["- runFlow:", "    when:", '      visible: "Open"', "    commands:", '      - tapOn: "Open"']
        : []),
      "- extendedWaitUntil:",
      "    visible:",
      `      id: "ds-case-${id}"`,
      "    timeout: 15000",
      "- waitForAnimationToEnd:",
      "    timeout: 5000",
      "- runFlow:",
      "    when:",
      `      true: ${UPDATE_GOLDENS}`,
      "    commands:",
      "      - takeScreenshot:",
      `          path: "${spec.capturePrefix}${id}"`,
      "          cropOn:",
      `            id: "ds-case-${id}"`,
      "- runFlow:",
      "    when:",
      `      true: ${ASSERT_GOLDENS}`,
      "    commands:",
      "      - assertScreenshot:",
      `          path: "${spec.assertPrefix}${id}.png"`,
      "          cropOn:",
      `            id: "ds-case-${id}"`,
      "          thresholdPercentage: 98",
    ];
  }

  function buildDsGalleryFlow(spec: GalleryFlowSpec): string {
    const goldenIds = PARITY_CASES.filter((c) => c.golden).map((c) => c.id);
    const lines = [
      "# GENERATED by apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts — do not edit.",
      spec.headerComment,
      "appId: app.pekulo.mobile",
      `name: ${spec.name}`,
      "tags:",
      ...spec.tags.map((tag) => `  - ${tag}`),
      "---",
      "- launchApp:",
      "    clearState: true",
      ...goldenIds.flatMap((id) => caseSteps(id, spec)),
    ];
    return `${lines.join("\n")}\n`;
  }

  describe.each(["ios", "android"] as const)(
    "Maestro ds-gallery flow — %s (stories 10-5 AC-5, 10-6 AC-7)",
    (platform) => {
      const spec = FLOWS[platform];
      const flowPath = path.resolve(MOBILE_ROOT, spec.file);

      it("is generated from PARITY_CASES and committed up to date", () => {
        const expected = buildDsGalleryFlow(spec);
        if (process.env.UPDATE_DS_FLOW === "1") writeFileSync(flowPath, expected);
        expect(readFileSync(flowPath, "utf8")).toBe(expected);
      });

      it("captures exactly one golden per component", () => {
        const goldenCount = PARITY_CASES.filter((c) => c.golden).length;
        const components = new Set(PARITY_CASES.map((c) => c.component)).size;
        expect(goldenCount).toBe(components);
        expect(buildDsGalleryFlow(spec).match(/- assertScreenshot:/g)?.length).toBe(goldenCount);
      });
    },
  );
  ```
  Run (generate the Android flow): `cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts`
  Then: `git diff --exit-code apps/mobile/.maestro/flows/ds-gallery.yaml && grep -c -- '- assertScreenshot:' apps/mobile/.maestro/flows/ds-gallery-android.yaml`
  Expected: `git diff` exit 0 (iOS flow byte-identical to 10-5), then `42`.
  Run: `cd apps/mobile && bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts`
  Expected: `Tests: 4 passed, 4 total`.
  Commit: `git add apps/mobile/.maestro/flows/navigation.yaml apps/mobile/.maestro/flows/ds-gallery-android.yaml apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts && git commit -m "test(#162): Android Maestro navigation and generated DS gallery flow"`

**T12 — EAS Workflows for Android** [AC: AC-8]

- [x] **T12.1 — Create `apps/mobile/.eas/workflows/e2e-android.yml`** [AC: AC-8]
  ```yaml
  # Story 10-6 AC-8 — Android APK build + Maestro E2E on an Android emulator (EAS Workflows).
  # Custom job on a `linux-medium-nested-virtualization` worker (Android emulators
  # need nested virtualization; docs.expo.dev/eas/workflows/syntax) using the
  # built-in `eas/start_android_emulator` step (@expo/build-tools ≥ 27, waits for
  # boot). Mirrors e2e-ios.yml. Non-required check.
  name: e2e-android

  on:
    pull_request:
      branches: ["main"]
      paths:
        - "apps/mobile/**"
        - "packages/ui/**"
        - "packages/contracts/**"
        - "packages/validators/**"
        - "packages/types/**"

  jobs:
    build_android_apk:
      name: Build Android APK (e2e-test)
      type: build
      params:
        platform: android
        profile: e2e-test

    maestro_android:
      name: Maestro E2E (Android)
      needs: [build_android_apk]
      runs_on: linux-medium-nested-virtualization
      steps:
        - uses: eas/checkout

        - uses: eas/download_build
          id: download_build
          with:
            build_id: ${{ needs.build_android_apk.outputs.build_id }}
            extensions: [apk]

        - uses: eas/start_android_emulator
          with:
            device_name: pekulo-e2e
            system_image_package: system-images;android-35;default;x86_64

        - name: Run Maestro E2E suite (with 1 retry per flow)
          run: |
            set -euo pipefail
            export PATH="$PATH:$HOME/.maestro/bin:${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools"
            export MAESTRO_CLI_NO_ANALYTICS=1
            command -v maestro >/dev/null || { echo "maestro CLI not found in PATH" >&2; exit 1; }
            command -v adb >/dev/null || { echo "adb not found in PATH" >&2; exit 1; }
            maestro --version

            # EAS Workflows interpolates steps.*.outputs inside `run:`, not step-level `env:`.
            ARTIFACT_PATH="${{ steps.download_build.outputs.artifact_path }}"
            if [ ! -e "$ARTIFACT_PATH" ]; then
              echo "Downloaded APK not found at: $ARTIFACT_PATH" >&2
              exit 1
            fi

            JOB_CWD="$(pwd)"
            if [ -d "$JOB_CWD/apps/mobile/.maestro" ]; then
              MAESTRO_DIR="$JOB_CWD/apps/mobile/.maestro"
            elif [ -d "$JOB_CWD/.maestro" ]; then
              MAESTRO_DIR="$JOB_CWD/.maestro"
            else
              echo "Cannot find .maestro directory from $JOB_CWD" >&2
              exit 1
            fi
            # eas/upload_artifact resolves `path` from EAS_BUILD_WORKINGDIR (repo root),
            # whereas eas/checkout changes `run:` cwd to apps/mobile.
            ARTIFACT_ROOT="${EAS_BUILD_WORKINGDIR:-$JOB_CWD}"
            RESULTS_DIR="$ARTIFACT_ROOT/maestro-results"

            DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
            if [ -z "$DEVICE_ID" ]; then
              echo "No booted Android emulator found" >&2
              adb devices >&2
              exit 1
            fi
            echo "Using Android emulator: $DEVICE_ID"
            adb -s "$DEVICE_ID" install -r "$ARTIFACT_PATH"

            rm -rf "$RESULTS_DIR"
            mkdir -p "$RESULTS_DIR"
            run_flow() {
              local flow="$1"
              local flow_name
              flow_name="$(basename "$flow" .yaml)"
              maestro test --device "$DEVICE_ID" --test-output-dir "$RESULTS_DIR/$flow_name/attempt-1" "$flow" \
                || maestro test --device "$DEVICE_ID" --test-output-dir "$RESULTS_DIR/$flow_name/attempt-2" "$flow"
            }

            run_flow "$MAESTRO_DIR/flows/smoke.yaml"
            run_flow "$MAESTRO_DIR/flows/navigation.yaml"
            run_flow "$MAESTRO_DIR/flows/preview-guard.yaml"
            run_flow "$MAESTRO_DIR/flows/ds-gallery-android.yaml"

        - uses: eas/upload_artifact
          if: ${{ failure() }}
          with:
            type: other
            name: maestro-android-failure-artifacts
            path: maestro-results/**/*
            ignore_error: true
  ```

- [x] **T12.2 — Create `apps/mobile/.eas/workflows/e2e-android-update-goldens.yml`** [AC: AC-8]
  ```yaml
  # Story 10-6 AC-8 — regenerates the Android DS goldens on the SAME emulator image
  # the e2e-android workflow asserts against. Manual only:
  #   cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android-update-goldens.yml
  # Download the "android-ds-goldens" artifact and copy the PNGs into
  # apps/mobile/.maestro/goldens/android/ (see apps/mobile/README.md).
  name: e2e-android-update-goldens

  on:
    workflow_dispatch: {}

  jobs:
    build_android_apk:
      name: Build Android APK (e2e-test)
      type: build
      params:
        platform: android
        profile: e2e-test

    capture_goldens:
      name: Capture DS goldens (Android)
      needs: [build_android_apk]
      runs_on: linux-medium-nested-virtualization
      steps:
        - uses: eas/checkout

        - uses: eas/download_build
          id: download_build
          with:
            build_id: ${{ needs.build_android_apk.outputs.build_id }}
            extensions: [apk]

        - uses: eas/start_android_emulator
          with:
            device_name: pekulo-e2e
            system_image_package: system-images;android-35;default;x86_64

        - name: Capture 42 Android DS goldens
          run: |
            set -euo pipefail
            export PATH="$PATH:$HOME/.maestro/bin:${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools"
            export MAESTRO_CLI_NO_ANALYTICS=1
            command -v maestro >/dev/null || { echo "maestro CLI not found in PATH" >&2; exit 1; }
            command -v adb >/dev/null || { echo "adb not found in PATH" >&2; exit 1; }
            maestro --version

            # EAS Workflows interpolates steps.*.outputs inside `run:`, not step-level `env:`.
            ARTIFACT_PATH="${{ steps.download_build.outputs.artifact_path }}"
            if [ ! -e "$ARTIFACT_PATH" ]; then
              echo "Downloaded APK not found at: $ARTIFACT_PATH" >&2
              exit 1
            fi

            JOB_CWD="$(pwd)"
            if [ -d "$JOB_CWD/apps/mobile/.maestro" ]; then
              MAESTRO_DIR="$JOB_CWD/apps/mobile/.maestro"
            elif [ -d "$JOB_CWD/.maestro" ]; then
              MAESTRO_DIR="$JOB_CWD/.maestro"
            else
              echo "Cannot find .maestro directory from $JOB_CWD" >&2
              exit 1
            fi
            # eas/upload_artifact resolves `path` from EAS_BUILD_WORKINGDIR (repo root),
            # whereas eas/checkout changes `run:` cwd to apps/mobile.
            ARTIFACT_ROOT="${EAS_BUILD_WORKINGDIR:-$JOB_CWD}"
            GOLDENS_DIR="$ARTIFACT_ROOT/maestro-goldens-android"

            DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
            if [ -z "$DEVICE_ID" ]; then
              echo "No booted Android emulator found" >&2
              adb devices >&2
              exit 1
            fi
            echo "Using Android emulator: $DEVICE_ID"
            adb -s "$DEVICE_ID" install -r "$ARTIFACT_PATH"

            rm -rf /tmp/maestro-goldens "$GOLDENS_DIR"
            mkdir -p /tmp/maestro-goldens "$GOLDENS_DIR"
            maestro test --device "$DEVICE_ID" \
              -e MAESTRO_UPDATE_GOLDENS=true \
              --test-output-dir /tmp/maestro-goldens \
              "$MAESTRO_DIR/flows/ds-gallery-android.yaml"

            find /tmp/maestro-goldens -path '*/goldens/android/*.png' -exec cp {} "$GOLDENS_DIR/" \;
            if [ "$(find "$GOLDENS_DIR" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')" -eq 0 ] && [ -d "$JOB_CWD/goldens/android" ]; then
              find "$JOB_CWD/goldens/android" -maxdepth 1 -name '*.png' -exec cp {} "$GOLDENS_DIR/" \;
            fi
            EXPECTED_COUNT="$(grep -c -- '- takeScreenshot:' "$MAESTRO_DIR/flows/ds-gallery-android.yaml")"
            ACTUAL_COUNT="$(find "$GOLDENS_DIR" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
            echo "Captured $ACTUAL_COUNT / $EXPECTED_COUNT Android DS goldens"
            if [ "$ACTUAL_COUNT" -ne "$EXPECTED_COUNT" ]; then
              echo "Golden count mismatch: expected $EXPECTED_COUNT, got $ACTUAL_COUNT" >&2
              exit 1
            fi

        - uses: eas/upload_artifact
          with:
            type: other
            name: android-ds-goldens
            path: maestro-goldens-android/*.png
  ```
  Run: `cd apps/mobile && bunx eas-cli@latest workflow:validate .eas/workflows/e2e-android.yml && bunx eas-cli@latest workflow:validate .eas/workflows/e2e-android-update-goldens.yml`
  Expected: `✔ Workflow configuration YAML is valid.` twice. (The validator checks the schema only — it does NOT reject unknown `uses:` names; `eas/start_android_emulator` and its `device_name` / `system_image_package` inputs were verified at write time in `@expo/build-tools@27.11.0` `dist/steps/functions/startAndroidEmulator.js`.)
  Commit: `git add apps/mobile/.eas/workflows/e2e-android.yml apps/mobile/.eas/workflows/e2e-android-update-goldens.yml && git commit -m "ci(#162): EAS Android emulator Maestro workflows"`

**T13 — Capture and commit the Android goldens** [AC: AC-7, AC-8]

- [x] **T13.1 — Run the golden-capture workflow** [AC: AC-7, AC-8]
  Run: `cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android-update-goldens.yml --wait`
  Expected: the run ends `SUCCESS`; job log line `Captured 42 / 42 Android DS goldens`.
  **If the run fails because the `linux-medium-nested-virtualization` worker is not available on the account's plan** (or the job never starts with a plan/permission error): ⏸ **HALT** — record the exact error text in the Dev Agent Record § Deviations, tell the user, and switch to Dev Notes § Fallback F1 only after their go (it needs an `EXPO_TOKEN` repository secret they must create).
  **If the run fails for any other reason** (emulator boot, APK install, a flow step): download the run logs with `bunx eas-cli@latest workflow:logs <run-id>`, fix the cause, re-run. Do not lower the 98 % threshold.

- [x] **T13.2 — ⏸ Download the artifact (user-assisted) and review the goldens** [AC: AC-7, AC-8]
  Ask the user to download the `android-ds-goldens` artifact from the run page (expo.dev → project → Workflows → the run → Artifacts) and unzip it into `apps/mobile/.maestro/goldens/android/`. Then show the user five representative PNGs for a visual check against the iOS goldens (`PekuloHero.mobile`, `PekuloDonutCard.default`, `PekuloAccountsSection.three`, `PekuloSegmentedControl.theme`, `PekuloMobileBottomNav.cap`): same layout and grayscale chrome, Geist font, no clipped glyphs. Visual differences inherent to the platform (font rasterisation) are expected; layout breaks are bugs to fix in `@pekulo/ui` native sources before committing.
  Run: `ls apps/mobile/.maestro/goldens/android/*.png | wc -l`
  Expected: `42`.
  Commit: `git add apps/mobile/.maestro/goldens/android && git commit -m "test(#162): Android DS screenshot goldens"`

**T14 — Prove the Android E2E workflow** [AC: AC-7, AC-8]

- [x] **T14.1 — Run `e2e-android.yml` end to end** [AC: AC-7, AC-8]
  Run: `cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android.yml --wait`
  Expected: run `SUCCESS`; the `Maestro E2E (Android)` job passes `smoke`, `navigation`, `preview-guard`, `ds-gallery-android` (each on attempt 1 or 2).
  On failure: `bunx eas-cli@latest workflow:logs <run-id>`; the `maestro-android-failure-artifacts` artifact holds screenshots + hierarchy per attempt. Known Android-specific risks to check first (Dev Notes § Risks): Material `AlertDialog` button casing in `preview-guard`, `clearKeychain` on Android, sheet top inset at the 1.0 detent.
  Also run the iOS workflow once to prove no iOS regression: `cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-ios.yml --wait` — Expected: `SUCCESS` with the unchanged iOS goldens.
  Record both run URLs in the Dev Agent Record § Test output. No commit (verification only).

**T15 — Docs sync** [AC: AC-10]

- [x] **T15.1 — `apps/mobile/README.md`** [AC: AC-10]
  Replace the line
  ```md
  ## E2E — Maestro on EAS Workflows (story 10-5)
  ```
  with
  ```md
  ## E2E — Maestro on EAS Workflows (stories 10-5 iOS, 10-6 Android)
  ```
  and append at the end of that section (after the local golden regeneration block) this block:
  ````md
  ### Android (story 10-6)

  `e2e-android.yml` builds the `e2e-test` profile as an **APK** and runs `smoke`, `navigation`, `preview-guard` and the generated `ds-gallery-android` flow on an Android emulator (`linux-medium-nested-virtualization` worker, `eas/start_android_emulator`, `system-images;android-35;default;x86_64`). Android goldens live in `apps/mobile/.maestro/goldens/android/` and are only valid for that emulator image.

  ```bash
  # Run the Android E2E workflow manually
  cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android.yml

  # Regenerate the Android goldens on the CI emulator image, then download the
  # "android-ds-goldens" artifact into apps/mobile/.maestro/goldens/android/, review, commit.
  cd apps/mobile && bunx eas-cli@latest workflow:run .eas/workflows/e2e-android-update-goldens.yml

  # Local runs: the iOS and Android gallery flows assert different goldens.
  maestro test --exclude-tags android-only apps/mobile/.maestro          # iOS Simulator
  maestro test --exclude-tags ds-gallery apps/mobile/.maestro            # Android emulator
  ```

  Android-specific surfaces (all covered by the `android` Jest project, `__tests__/android/`): tab header buttons through `headerRight` (`Stack.Toolbar` needs `@expo/ui` on Android), headerless form sheets with an in-content header row, row action menus in the DS `ActionSheetHost`, and account deletion in `sheets/delete-account` (no `Alert.prompt` on Android).
  ````

- [x] **T15.2 — `docs/architecture.md`** [AC: AC-10]
  In the **Test pyramid (D6)** bullet replace
  ```md
  **Maestro on EAS Workflows** (iOS Simulator, preview mode: smoke / navigation / preview-guard / DS-gallery screenshot goldens — story 10-5; Android in 10-6)
  ```
  with
  ```md
  **Maestro on EAS Workflows** (iOS Simulator on `macos-medium` and Android emulator on `linux-medium-nested-virtualization`, preview mode: smoke / navigation / preview-guard / per-platform DS-gallery screenshot goldens — stories 10-5, 10-6) ; Jest `ios` + `android` projects in `apps/mobile` (story 10-6)
  ```
  and in the FR-56 traceability row replace
  ```md
  + Maestro iOS DS goldens (`apps/mobile/.maestro/flows/ds-gallery.yaml`) |
  ```
  with
  ```md
  + Maestro iOS / Android DS goldens (`apps/mobile/.maestro/flows/ds-gallery{,-android}.yaml`) |
  ```
  (Keep the table column alignment: run `bun run format` after the edit — oxfmt realigns the table.)

- [x] **T15.3 — `docs/epics.md`: realized scope for 10-6** [AC: AC-10]
  Directly under the line `**Complexity:** M` that closes `#### Story 10-6-android-parity-and-maestro` (the `**Ticket:**` line already reads `[#162](https://github.com/yabafre/pekulo/issues/162)` since aped-story), add:
  ```md

  > **Realized scope (2026-11-24, step-04, user-approved) — supersedes the summary above without deleting it.** The Android audit found `Stack.Toolbar` throws on Android without `@expo/ui` (tabs, Paramètres, all form sheets), `Alert.alert` caps menus at 3 buttons, and `Alert.prompt` is iOS-only. Delivered: platform-split headers (`headerRight` tabs, in-content sheet header, headerless sheets with `sheetElevation: 0`), a DS `ActionSheetHost` (`PekuloDrawer`) for Android menus, an Android-only `sheets/delete-account` typed-email sheet sharing `isDeletionEmailConfirmed` with iOS, Material Symbol names for every `SymbolView` (meta-test), labelled grayscale Android tab bar, a Jest `android` project (`jest-expo/android`), the `e2e-test` APK, generated `ds-gallery-android` flow + 42 Android goldens, and EAS `e2e-android{,-update-goldens}.yml` custom jobs on `linux-medium-nested-virtualization`. iOS behaviour unchanged.

  **Complexity:** L (re-estimated from M)
  ```

- [x] **T15.4 — `docs/state.yaml`** [AC: AC-10]
  Leave `10-6-android-parity-and-maestro` as `status: ready-for-dev` / `ticket: "#162"` (set by aped-story); `aped-dev` flips it to `in-progress` / `review` per its own workflow — do not hand-edit beyond that.
  Run: `bun run format:check`
  Expected: exit 0 (run `bun run format` first if the architecture table needs realignment, then re-check).
  Commit: `git add apps/mobile/README.md docs/architecture.md docs/epics.md && git commit -m "docs(#162): Android E2E, test pyramid and 10-6 realized scope"`

**T16 — Quality gates** [AC: AC-10]

- [x] **T16.1 — Full gate run** [AC: AC-10]
  Run: `bun run typecheck`
  Expected: exit 0, every workspace `tsc --noEmit` clean.
  Run: `bun run lint`
  Expected: exit 0, `Found 0 warnings and 0 errors` for `@pekulo/mobile`.
  Run: `bun run format:check`
  Expected: exit 0.
  Run: `bun --filter='@pekulo/mobile' run test`
  Expected: `Test Suites: 22 passed, 22 total`, `Tests: 215 passed, 215 total` (ios 18 suites / 203 tests: 194 baseline − 2 old gallery tests + 4 gallery + 4 deletion helper + 3 guards; android 4 suites / 12 tests).
  Run: `git status --porcelain`
  Expected: only the pre-existing unrelated entries (` M apps/web/next-env.d.ts`, `?? .aped/state.yaml.backup`, `?? "docs/quick-specs/2026-11-22-unify-bun-1-3-14 2.md"`) — nothing from this story uncommitted.
  `packages/ui` and `apps/web` sources are untouched by this story, so no Tamagui CSS regeneration and no web snapshot run are required; if any `packages/ui` file changed during T13.2 fixes, also run `bun --filter='@pekulo/ui' run test`, `bun run generate:tamagui-css` and `git diff --exit-code packages/ui/public/tamagui.generated.css` (lesson 2026-05-24).
  No commit (verification only). Then hand over to `aped-review`.

## Dev Notes

### Scope decisions (step-04, user-approved 2026-11-24)

- **One story, L.** User kept the Android adaptations and the Android CI in one story (no split), re-estimated M → L.
- **CI runner:** EAS custom job on `runs_on: linux-medium-nested-virtualization` with `eas/start_android_emulator`, symmetric to `e2e-ios.yml`. The Expo docs do not state whether this worker is on the Free plan; if EAS refuses it, record the refusal and fall back to Fallback F1 (GitHub Actions) after the user's go.
- **Android menus:** in-house `ActionSheetHost` on `PekuloDrawer` native (no new dependency, Pekulo style). iOS keeps `ActionSheetIOS`.
- **Android headers:** platform split — `headerRight` React views on Android tabs, in-content header row for sheets, system back for Paramètres. No `@expo/ui`. iOS unchanged.
- **Android account deletion:** `sheets/delete-account` used on Android only; iOS keeps the reviewed `Alert.prompt`.
- **Out of scope:** `@expo/ui` adoption, Play Store submission/signing (`production` profile), authenticated E2E against a real backend (preview mode only), making the EAS check required, primitives parity (still the 10-5 follow-up), Android dark-theme goldens (the gallery captures `pekulo-dark` only, like iOS).

### Existing code at write time (Step-0 verbatim quotes, 2026-11-24, `origin/main` @ `dfc99e4`)

`apps/mobile/lib/actions.ts` — `showActions` (Android path is a 3-button-capped `Alert.alert`):
```ts
export function showActions(title: string, actions: RowAction[], message?: string) {
  const labels = [...actions.map((a) => a.label), tNow("common.actions.cancel")];
  const destructive = actions.flatMap((a, i) => (a.destructive ? [i] : []));

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: destructive,
      },
      (index) => {
        actions[index]?.onPress();
      },
    );
    return;
  }

  Alert.alert(title, message, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ("destructive" as const) : ("default" as const),
      onPress: a.onPress,
    })),
    { text: tNow("common.actions.cancel"), style: "cancel" as const },
  ]);
}
```
Call sites and action counts: `app/(tabs)/immobilier/index.tsx:38` (5), `app/(tabs)/(cap)/index.tsx:60` (3) and `:85` (3), `app/(tabs)/portefeuille/index.tsx:39` (2), `app/(tabs)/transactions/index.tsx:134` (2) and `:263` (1), `app/(tabs)/mensuel/index.tsx:55` (1), `components/form/fields.tsx:240` (`SelectField`, one per option). None of them change.

`apps/mobile/components/tab-stack-layout.tsx` — `TabToolbar` (iOS-only `Stack.Toolbar`, used by 4 tabs):
```tsx
export function TabToolbar({ onAdd, addLabel }: { onAdd?: () => void; addLabel?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Stack.Toolbar placement="right">
      {onAdd ? (
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel={addLabel ?? t("common.actions.add")}
          onPress={onAdd}
        />
      ) : null}
      <Stack.Toolbar.Button
        icon="person.crop.circle"
        accessibilityLabel={t("common.actions.openSettings")}
        onPress={() => router.push("/parametres")}
      />
    </Stack.Toolbar>
  );
}
```
`TabStackLayout` screenOptions (iOS-tuned, `headerTransparent: true` on every platform):
```tsx
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerTitleStyle: { color: palette.text.primary },
        headerLargeTitleStyle: { color: palette.text.primary },
        headerTintColor: palette.text.primary,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: palette.surface.bg },
      }}
    >
```
`SettingsHeaderButton` wraps a `Pressable` in `<Link href="/parametres" asChild>`; `SymbolView name="person.crop.circle"` and `name="plus"`.

`expo-router@58.0.31` `build/layouts/stack-utils/toolbar/processHeaderItemsForPlatform.android.js`:
```js
    (0, _expoui.requireExpoUI)("Stack.Toolbar on Android requires '@expo/ui'. Install it with `npx expo install @expo/ui` and rebuild your app.");
```
and `build/optional-libraries/expo-ui.js` `requireExpoUI` → `throw new Error(errorMessage)` when `@expo/ui` is absent (it is not a dependency of `@pekulo/mobile`).

`apps/mobile/components/form/sheet.tsx` — `SheetScaffold` iOS-only header:
```tsx
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={dismissLabel}
          onPress={() => {
            if (router.canGoBack()) router.back();
          }}
        >
          {dismissLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {onPrimary ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            variant="done"
            tintColor={ink}
            accessibilityLabel={primary}
            disabled={primaryDisabled}
            onPress={onPrimary}
          >
            {primary}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <ScreenShell>
        {children}
        <FormError message={error} />
      </ScreenShell>
    </>
  );
```

`apps/mobile/app/parametres.tsx` — iOS-only deletion and toolbar:
```tsx
  function confirmAccountDeletion(typed: string | undefined) {
    const expected = (userEmail ?? "").trim().toLowerCase();
    if (!typed || typed.trim().toLowerCase() !== expected) {
      Alert.alert(t("settings.deletion.wrongEmailTitle"), t("settings.deletion.wrongEmailMessage"));
      return;
    }
    void run(async () => {
      await deleteAccount.mutateAsync({ confirmationEmail: typed.trim() });
      router.replace("/login");
    }, t("settings.deletion.done"));
  }

  function handleDeleteAccount() {
    const message = t("settings.deletion.message", {
      email: userEmail ?? t("settings.deletion.yourEmail"),
    });
    if (Platform.OS === "ios") {
      Alert.prompt(
        t("settings.deletion.title"),
        message,
        [
          { text: t("common.actions.cancel"), style: "cancel" },
          {
            text: t("common.actions.delete"),
            style: "destructive",
            onPress: confirmAccountDeletion,
          },
        ],
        "plain-text",
        "",
        "email-address",
      );
      return;
    }
    Alert.alert(t("settings.deletion.title"), t("settings.deletion.webOnly"));
  }
```
(The returned-JSX toolbar block is the `old` block of T9.4.) `useAuth().userEmail` is typed `string | null` (`lib/auth/auth-context.tsx:69`). `useDeleteUserAccount` (`lib/hooks/use-mobile-mutations.ts:243`) throws `PreviewModeError` when unauthenticated, validates with `deleteUserAccountInputSchema`, calls `settingsClient.deleteAccount`, and calls `signOut()` on success.

`apps/mobile/app/_layout.tsx` — sheet options shared by all 13 sheets + Paramètres (`headerShown: true`, `presentation: "formSheet"`, `sheetGrabberVisible: true`, `sheetAllowedDetents`, `headerTransparent: true`, `headerShadowVisible: false`, `headerTitleStyle`, `headerTintColor`, `contentStyle`); quoted in full by the T9.5 replacement. `react-native-screens@4.30.1` `src/types.tsx`: "**Android is limited to up 3 values in the array**" for `sheetAllowedDetents`; `sheetElevation` "Defaults to `24`" (@platform android).

`SymbolView` sites (6): `app/parametres.tsx` `chevron.right` (`fallback={null}` → blank on Android), `app/(tabs)/transactions/index.tsx` `chevron.left/right` (text fallback), `components/form/fields.tsx` `chevron.up.chevron.down` (`fallback={null}`), `components/search-field.tsx` `magnifyingglass` (`fallback={null}`), `components/tab-stack-layout.tsx` `person.crop.circle` (`⚙︎` fallback) and `plus` (`+` fallback). `expo-symbols@58.0.5` `build/SymbolView.js` (Android): `const name = typeof nameProp === 'object' ? nameProp[Platform.OS === 'android' ? 'android' : 'web'] : null; … if (!name) return fallback`.

`apps/mobile/app/(tabs)/_layout.tsx` — `NativeTabs` with `minimizeBehavior`, `tintColor`, `iconColor`, `labelStyle`; every trigger already has an `md=` Material icon. `expo-router@58` `native-tabs/types.d.ts`: `labelVisibilityMode` (`'auto' | 'selected' | 'labeled' | 'unlabeled'`), `indicatorColor`, `rippleColor` are `@platform android`; `backgroundColor` is `@platform android / iOS / web`.

`apps/mobile/jest.config.js` — single `preset: "jest-expo"` config (quoted in full by the T2.2 replacement). `jest-expo/jest-preset` haste `defaultPlatform: "ios"`; `jest-expo/android/jest-preset` haste `defaultPlatform: "android"`; both expose the same three `transform` keys.

`apps/mobile/eas.json` — `e2e-test` has `withoutCredentials`, `bun: "1.3.14"`, `ios.simulator: true`, `env.EXPO_PUBLIC_DS_GALLERY: "1"`, `env.DATABASE_URL` stub; no `android` block. `app.json` already sets `android.package: "app.pekulo.mobile"`, `scheme: "pekulo"`, `android.softwareKeyboardLayoutMode: "resize"`.

`apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts` — `caseSteps(id)` / `buildDsGalleryFlow()` hard-code `GOLDEN_CAPTURE_PREFIX = "goldens/ios/"`, `GOLDEN_ASSERT_PREFIX = "../goldens/ios/"` and the iOS `tapOn: "Open"` prompt step; replaced in T11.2 by a platform spec whose iOS output is byte-identical.

`apps/mobile/.maestro/flows/navigation.yaml` — dismisses Paramètres with `swipe: { start: "50%, 12%", end: "50%, 92%" }` (iOS sheet gesture).

`apps/mobile/lib/i18n/messages/settings.ts` — `deletion.{button,title,message,yourEmail,webOnly,wrongEmailTitle,wrongEmailMessage,done}` in fr + en; `webOnly` consumed only by `app/parametres.tsx`.

`@pekulo/ui` `packages/ui/src/primitives/PekuloDrawer.native.tsx` — `PekuloDrawer` (controlled `open` / `onOpenChange`) + `.Portal` / `.Content` (`@tamagui/sheet` modal, `snapPoints={[80, 45]}`, `dismissOnSnapToBottom`, `backgroundColor="$backgroundElevated"`) / `.Header` / `.Title` / `.Description`; already exercised in Jest by `__tests__/ui-native-parity.test.tsx:679-817` (opens, renders content, closes).

New files: `lib/action-sheet-host.tsx`, `lib/account-deletion.ts`, `app/sheets/delete-account.tsx`, `.maestro/flows/ds-gallery-android.yaml` (generated), `.maestro/goldens/android/*.png` (42, captured), `.eas/workflows/e2e-android{,-update-goldens}.yml`, `__tests__/{native-surface-guards,account-deletion}.test.ts`, `__tests__/android/{platform.test.ts,action-sheet.test.tsx,headers.test.tsx,account-deletion.test.tsx,helpers/android-stack-mock.ts}` — none exist at write time.

### File structure design (3-bullet decision template per file)

- `apps/mobile/jest.config.js` — **Responsibility:** declare the `ios` and `android` Jest projects over one shared transform/mapping base. **In/Out:** reads `jest-expo` presets + module paths; exports the Jest config.
- `apps/mobile/lib/action-sheet-host.tsx` — **Responsibility:** hold and render the pending Android row action menu. **In/Out:** imports `PekuloDrawer`, `tNow`; exports `openActionSheet`, `closeActionSheet`, `ActionSheetHost`, `ActionSheetItem`, `ActionSheetRequest`.
- `apps/mobile/lib/actions.ts` — **Responsibility:** route a menu request to the platform's native menu (unchanged role). **In/Out:** imports `ActionSheetIOS`, `openActionSheet`; exports `showActions` (same signature), `confirmDestructive`, `contractErrorCopy`, `handleMutationError`.
- `apps/mobile/lib/account-deletion.ts` — **Responsibility:** decide whether a typed email confirms deletion. **In/Out:** pure function `isDeletionEmailConfirmed(typed, accountEmail) → boolean`.
- `apps/mobile/app/sheets/delete-account.tsx` — **Responsibility:** Android typed-email account deletion sheet. **In/Out:** imports form kit, `isDeletionEmailConfirmed`, `useAuth`, `useDeleteUserAccount`; default-exports the route screen.
- `apps/mobile/app/parametres.tsx` — **Responsibility:** Paramètres screen (unchanged), now platform-aware for title/toolbar/deletion entry. **In/Out:** adds `isDeletionEmailConfirmed`; pushes `/sheets/delete-account` on Android.
- `apps/mobile/app/_layout.tsx` — **Responsibility:** root providers + navigator presentation (unchanged), now platform-aware sheet options + Android `ActionSheetHost`. **In/Out:** adds `Platform`, `ActionSheetHost`; registers `sheets/delete-account`.
- `apps/mobile/components/tab-stack-layout.tsx` — **Responsibility:** tab Stack chrome + header actions (unchanged), now with Android `headerRight` branch and opaque Android header. **In/Out:** same exports; `SettingsHeaderButton` navigates via `useRouter`.
- `apps/mobile/components/form/sheet.tsx` — **Responsibility:** form-sheet scaffold + mutation runner (unchanged), now with Android in-content header. **In/Out:** same exports (`useMutationRunner`, `SheetScaffold`); private `SheetHeaderButton`.
- `apps/mobile/app/(tabs)/_layout.tsx` — **Responsibility:** native tab bar (unchanged), now with Android-only label/colour props. **In/Out:** adds `Platform`.
- `apps/mobile/app/parametres.tsx`, `app/(tabs)/transactions/index.tsx`, `components/form/fields.tsx`, `components/search-field.tsx` — **Responsibility:** unchanged; only `SymbolView name` gains an Android key.
- `apps/mobile/lib/i18n/messages/settings.ts` — **Responsibility:** settings copy (fr/en); `+emailLabel`, `−webOnly`.
- `apps/mobile/eas.json` — **Responsibility:** EAS build profiles; `e2e-test` gains `android.buildType: "apk"`.
- `apps/mobile/.maestro/flows/navigation.yaml` — **Responsibility:** Paramètres open/close flow; platform-conditional dismissal.
- `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts` — **Responsibility:** generate + guard both DS gallery flows from `PARITY_CASES`. **In/Out:** writes `ds-gallery{,-android}.yaml` under `UPDATE_DS_FLOW=1`.
- `apps/mobile/.maestro/flows/ds-gallery-android.yaml` — **Responsibility:** generated Android golden assertions (never hand-edited).
- `apps/mobile/.maestro/goldens/android/*.png` — **Responsibility:** 42 Android emulator goldens (captured by CI, reviewed by the user).
- `apps/mobile/.eas/workflows/e2e-android.yml` — **Responsibility:** PR Android build + emulator Maestro run.
- `apps/mobile/.eas/workflows/e2e-android-update-goldens.yml` — **Responsibility:** manual Android golden recapture.
- `apps/mobile/__tests__/native-surface-guards.test.ts` — **Responsibility:** static guards (SymbolView Android names, `Stack.Toolbar` allow-list).
- `apps/mobile/__tests__/account-deletion.test.ts` — **Responsibility:** unit tests of `isDeletionEmailConfirmed`.
- `apps/mobile/__tests__/android/platform.test.ts` — **Responsibility:** prove the `android` Jest project's platform.
- `apps/mobile/__tests__/android/helpers/android-stack-mock.ts` — **Responsibility:** `expo-router/stack` stand-in with a throwing `Stack.Toolbar`.
- `apps/mobile/__tests__/android/action-sheet.test.tsx`, `headers.test.tsx`, `account-deletion.test.tsx` — **Responsibility:** Android behaviour of AC-3, AC-2, AC-2/AC-4.
- `apps/mobile/README.md`, `docs/architecture.md`, `docs/epics.md` — **Responsibility:** doc-sync (lesson 2026-05-31).
- `skills-lock.json`, `.claude/skills/{ios-design,ui-taste}/**` — **Responsibility:** vendored design skills (T1).

### Architecture & Lessons Applied

- **Platform-split native surface** (epic-10 context, 10-2/10-3): Android branches use runtime `Platform.OS` inside the existing files rather than new `.android.tsx` siblings — the branches are small and share hooks/state with the iOS path; `.android.*` files would duplicate the mutation runner and theming. Jest coverage of the Android branches comes from the dedicated `jest-expo/android` project, not from mocking `Platform`.
- **iOS 26 lessons stay intact** (session memory, 10-4): React views in `headerRight` never get taps on iOS 26 → iOS keeps `Stack.Toolbar`; the `headerRight` path is Android-only. The Expo dev-tools floating button swallows top-right taps → Maestro keeps targeting `open-settings-btn` (in-content on Cap) and `back`, never a top-right coordinate.
- **Design-spec §1 / allowed accents** (lesson 2026-05-07): Android chrome is grayscale (`surface.bg`, `surface.muted` indicator/ripple, `text.primary` ink); `$danger` only on destructive actions, matching the iOS system action sheet and the existing `DestructiveButton`; `sheetElevation: 0` because drop shadows are banned in dark.
- **Lesson 2026-06-05 (split)** — scope expanded at step-04 (three blocker classes); the user chose to keep one L story because no new subsystem/persistence is introduced.
- **Lesson 2026-06-05 (class-killer meta-test)** — `native-surface-guards.test.ts` enumerates every source file for `SymbolView` Android names and pins the `Stack.Toolbar` allow-list.
- **Lesson 2026-06-15 (prove the guard is active)** — T3.1 runs the guard RED against the current tree (6 offenders) before T4 makes it green; T7.1 runs the Android header tests RED against the throwing `Stack.Toolbar` stand-in.
- **Lesson 2026-05-31 (doc-sync)** — README / architecture / epics updated in this change (T15).
- **Lessons 2026-05-19 / 2026-05-05** — `bun --filter='@pekulo/mobile'`, never `bun --cwd`; mobile tests via `run test` or `bunx jest` inside `apps/mobile` (memory: `bun --filter=<pkg> test` runs Bun's runner).
- **Lesson 2026-06-01** — pre-commit hooks don't run `tsc`: run `bun --filter='@pekulo/mobile' run typecheck` before each feature commit (T4, T9).
- **10-5 EAS facts reused verbatim** — custom `runs_on` jobs (no paid `type: maestro`), `steps.*.outputs.*` interpolated inside `run:`, `eas/upload_artifact` paths resolved from `EAS_BUILD_WORKINGDIR`, 1 retry per flow, goldens valid only for the capturing image.
- **ADR-0002 test pyramid** — Jest + RNTL for `apps/mobile`, Maestro for E2E; this story adds the Android leg of both.

### Risks and how to handle them

- **Nested-virtualization worker not on the plan** → T13.1 HALT + Fallback F1.
- **Material `AlertDialog` button casing** (`preview-guard` taps « Plus tard »): RN Android dialogs on the SDK 58 Material3 theme keep sentence case. If Maestro cannot find « Plus tard », check the failure hierarchy; fix by matching case-insensitively in the flow (`tapOn: "(?i)plus tard"`), never by changing the copy.
- **`clearKeychain: true` on Android** (`smoke`, `navigation`, `preview-guard`): Maestro treats it as iOS-only. If the Android run errors on it, move it under `runFlow: when: platform: iOS` in those three flows (keep iOS behaviour identical).
- **Sheet top inset at the 1.0 detent on Android**: the headerless sheet's in-content header may sit under the status bar when fully expanded. If the T13.2 / T14 screenshots show it, pass `respectTopSafeArea` to the Android `ScreenShell` in `SheetScaffold` (it adds `insets.top` on Android only) and re-run T8/T14.
- **`PekuloDrawer` snap points `[80, 45]`** cap the menu height; long `SelectField` option lists scroll inside the `ScrollView` — verify with the category picker on the emulator (T14 failure artifacts or a manual `workflow:ssh` session).
- **`labelVisibilityMode`/`backgroundColor` on iOS**: spread only on Android (T4.2); `backgroundColor` would otherwise replace the iOS Liquid Glass bar.

### Fallback F1 — GitHub Actions Android emulator (only after T13.1 HALT + user go)

Create `.github/workflows/e2e-android.yml` and delete `apps/mobile/.eas/workflows/e2e-android{,-update-goldens}.yml`; the user must first add the `EXPO_TOKEN` repository secret (Expo access token). Goldens must then be recaptured with `workflow_dispatch` input `update_goldens: true` (they are only valid for this runner's emulator image):
```yaml
# Story 10-6 AC-8 fallback — EAS cloud APK build + Maestro on a GitHub-hosted
# Android emulator (KVM on ubuntu-latest). Non-required check.
name: e2e-android

on:
  pull_request:
    branches: [main]
    paths:
      - "apps/mobile/**"
      - "packages/ui/**"
      - "packages/contracts/**"
      - "packages/validators/**"
      - "packages/types/**"
  workflow_dispatch:
    inputs:
      update_goldens:
        description: "Capture Android DS goldens instead of asserting them"
        type: boolean
        default: false

jobs:
  maestro-android:
    runs-on: ubuntu-latest
    timeout-minutes: 75
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: bun install --frozen-lockfile

      - name: Build the e2e-test APK on EAS
        working-directory: apps/mobile
        run: |
          eas build --platform android --profile e2e-test --non-interactive --wait --json > /tmp/eas-build.json
          APK_URL="$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/eas-build.json','utf8'))[0].artifacts.buildUrl)")"
          curl -fsSL -o /tmp/pekulo.apk "$APK_URL"

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Install Maestro
        run: curl -fsSL "https://get.maestro.mobile.dev" | bash

      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 35
          arch: x86_64
          target: default
          script: bash apps/mobile/.maestro/run-android.sh "${{ inputs.update_goldens || 'false' }}"

      - uses: actions/upload-artifact@v4
        if: ${{ always() }}
        with:
          name: maestro-android
          path: |
            maestro-results/**
            maestro-goldens-android/*.png
          if-no-files-found: ignore
```
with `apps/mobile/.maestro/run-android.sh`:
```bash
#!/usr/bin/env bash
# Story 10-6 Fallback F1 — runs inside reactivecircus/android-emulator-runner.
set -euo pipefail
UPDATE_GOLDENS="${1:-false}"
export PATH="$PATH:$HOME/.maestro/bin"
export MAESTRO_CLI_NO_ANALYTICS=1
MAESTRO_DIR="apps/mobile/.maestro"
adb install -r /tmp/pekulo.apk

if [ "$UPDATE_GOLDENS" = "true" ]; then
  rm -rf /tmp/maestro-goldens maestro-goldens-android
  mkdir -p /tmp/maestro-goldens maestro-goldens-android
  maestro test -e MAESTRO_UPDATE_GOLDENS=true --test-output-dir /tmp/maestro-goldens \
    "$MAESTRO_DIR/flows/ds-gallery-android.yaml"
  find /tmp/maestro-goldens -path '*/goldens/android/*.png' -exec cp {} maestro-goldens-android/ \;
  ls maestro-goldens-android/*.png | wc -l
  exit 0
fi

run_flow() {
  local flow="$1"
  local name
  name="$(basename "$flow" .yaml)"
  maestro test --test-output-dir "maestro-results/$name/attempt-1" "$flow" \
    || maestro test --test-output-dir "maestro-results/$name/attempt-2" "$flow"
}
run_flow "$MAESTRO_DIR/flows/smoke.yaml"
run_flow "$MAESTRO_DIR/flows/navigation.yaml"
run_flow "$MAESTRO_DIR/flows/preview-guard.yaml"
run_flow "$MAESTRO_DIR/flows/ds-gallery-android.yaml"
```
Validate with `bunx --bun @action-validator/cli .github/workflows/e2e-android.yml` (lesson 2026-05-05: the CLI lives in `@action-validator/cli`), record the switch in the Dev Agent Record § Deviations and update the README/architecture text of T15 accordingly.

### Testing

- **Unit / component (Jest, `apps/mobile`)** — `ios` project: 16 baseline suites + `native-surface-guards` + `account-deletion` (helper); `android` project (`jest-expo/android`): `platform`, `action-sheet`, `headers`, `account-deletion`. Android tests replace `expo-router/stack` with `__tests__/android/helpers/android-stack-mock.ts`, whose `Stack.Toolbar` throws the exact expo-router 58 Android error.
- **E2E (Maestro on EAS)** — Android: `smoke`, `navigation`, `preview-guard`, `ds-gallery-android` (42 goldens, 98 %); iOS re-run once to prove no regression.
- **Visual verification** — React Grab MCP is unavailable on React Native (deferred in 10-2..10-5); there is no local Android SDK/emulator on the dev Mac. Visual verification = the 42 Android goldens reviewed with the user (T13.2) + Maestro failure screenshots (T14).
- **Commands** — single file: `cd apps/mobile && bunx jest --selectProjects <ios|android> <path>`; package: `bun --filter='@pekulo/mobile' run test`.
- **iCloud caveat** (memory) — the repo lives in iCloud Drive: if `tsc`/`jest`/`oxlint` hangs at 0 % CPU or a dependency reads as empty, an evicted `dataless` file is the cause, not the code — re-materialise it before debugging.

### Dependencies

- No new npm dependency. Uses `expo-symbols@58.0.5` (Android Material Symbols via `@expo-google-fonts/material-symbols`), `expo-router@58.0.31` (`Stack`, `NativeTabs` Android props), `react-native-screens@4.30.1` (`formSheet`, `sheetElevation`), `@pekulo/ui` `PekuloDrawer` native (`@tamagui/sheet`), `jest-expo@58` `android` preset.
- EAS: `eas-cli@latest` (27.11.0 at write time: `workflow:run`, `workflow:validate`, `workflow:logs`), EAS Workflows worker `linux-medium-nested-virtualization`, built-in steps `eas/checkout`, `eas/download_build`, `eas/start_android_emulator`, `eas/upload_artifact`; Maestro CLI preinstalled on the EAS Android images.

### Commit conventions

`type(#162): description` (`feat`, `test`, `refactor`, `build`, `ci`, `docs`, `chore`); stage explicit paths only (never `git add .` / `-A`); PR title `feat(#162): Story 10-6 — Android parity and Maestro E2E`, body `Closes #162`.

## File List

_Refreshed at review (2026-11-26) to match the branch. The original plan listed `.eas/workflows/e2e-android*.yml` and `.maestro/flows/ds-gallery-android.yaml`; both were superseded (see Dev Agent Record § Deviations)._

**Created**
- `.github/workflows/e2e-mobile.yml`
- `.github/actions/maestro-android/action.yml`
- `.github/actions/maestro-ios/action.yml`
- `.github/scripts/maestro-run.sh`
- `apps/mobile/lib/action-sheet-host.tsx`
- `apps/mobile/lib/account-deletion.ts`
- `apps/mobile/lib/sheet-presentation.ts`
- `apps/mobile/app/sheets/delete-account.tsx`
- `apps/mobile/.maestro/gallery/ios/shard-1.yaml` (generated)
- `apps/mobile/.maestro/gallery/ios/shard-2.yaml` (generated)
- `apps/mobile/.maestro/gallery/ios/shard-3.yaml` (generated)
- `apps/mobile/.maestro/gallery/ios/shard-4.yaml` (generated)
- `apps/mobile/.maestro/gallery/android/shard-1.yaml` (generated)
- `apps/mobile/.maestro/gallery/android/shard-2.yaml` (generated)
- `apps/mobile/.maestro/gallery/android/shard-3.yaml` (generated)
- `apps/mobile/.maestro/gallery/android/shard-4.yaml` (generated)
- `apps/mobile/.maestro/flows/action-sheet-android.yaml` (review)
- `apps/mobile/.maestro/goldens/android/` — 42 PNGs, captured on CI
- `apps/mobile/__tests__/native-surface-guards.test.ts`
- `apps/mobile/__tests__/account-deletion.test.ts`
- `apps/mobile/__tests__/sheet-presentation.test.ts`
- `apps/mobile/__tests__/e2e-build-env.test.ts` (review)
- `apps/mobile/__tests__/android/platform.test.ts`
- `apps/mobile/__tests__/android/action-sheet.test.tsx`
- `apps/mobile/__tests__/android/headers.test.tsx`
- `apps/mobile/__tests__/android/account-deletion.test.tsx`
- `apps/mobile/__tests__/android/sheet-presentation.test.ts`
- `apps/mobile/__tests__/android/tabs-layout.test.tsx` (review)
- `apps/mobile/__tests__/android/date-field.test.tsx` (review)
- `apps/mobile/__tests__/android/helpers/android-stack-mock.ts`
- `.claude/skills/ios-design/**`, `.claude/skills/ui-taste/**`, `.agents/skills/{app-store-compliance,mobile-agent-testers}/**` (vendored, T1)

**Modified**
- `apps/mobile/jest.config.js`
- `apps/mobile/lib/actions.ts`
- `apps/mobile/lib/i18n/messages/settings.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/transactions/index.tsx`
- `apps/mobile/app/ds/[case].tsx`
- `apps/mobile/components/tab-stack-layout.tsx`
- `apps/mobile/components/form/sheet.tsx`
- `apps/mobile/components/form/fields.tsx`
- `apps/mobile/components/search-field.tsx`
- `apps/mobile/eas.json`
- `apps/mobile/.maestro/flows/navigation.yaml`
- `apps/mobile/.maestro/goldens/ios/PekuloSkeleton.lines.png` (recaptured)
- `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts`
- `apps/mobile/__tests__/ds-gallery-screen.test.tsx`
- `apps/mobile/README.md`
- `packages/ui/src/primitives/PekuloDrawer.native.tsx` (review: `PekuloDrawer.ScrollView`)
- `packages/ui/src/primitives/PekuloDrawer.tsx` (review: `PekuloDrawer.ScrollView`)
- `README.md`
- `docs/architecture.md`
- `docs/epics.md`
- `docs/state.yaml`
- `skills-lock.json`

**Deleted**
- `apps/mobile/.eas/workflows/e2e-ios.yml`
- `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml`
- `apps/mobile/.maestro/flows/ds-gallery.yaml`

## Dev Agent Record

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`)
- **Started:** 2026-11-25T20:30:00Z
- **Completed:** 2026-11-26T04:30:00Z

### Summary

Android parity shipped as planned for the app surfaces (T2–T11): platform-split headers, the DS `ActionSheetHost`, the Android typed-email deletion sheet, Material Symbols, the labelled tab bar and an `android` Jest project. The E2E half was reworked after the user's mid-story request: Maestro now runs on GitHub Actions (`.github/workflows/e2e-mobile.yml`, iOS on `macos-26` + Android on `ubuntu-24.04`) instead of EAS Workflows, the DS gallery only runs on DS / gallery / golden changes and is split into 4 shards per platform with one Maestro `retry` per case. Final assertion run green on both platforms; 83 of 84 goldens recaptured on the GitHub runners were byte-identical to the committed ones.

### Files changed

- `.github/actions/maestro-android/action.yml`, `.github/actions/maestro-ios/action.yml`, `.github/scripts/maestro-run.sh`, `.github/workflows/e2e-mobile.yml` (new)
- `apps/mobile/.eas/workflows/e2e-ios.yml`, `apps/mobile/.eas/workflows/e2e-ios-update-goldens.yml` (deleted — replaced by `e2e-mobile.yml`)
- `apps/mobile/.maestro/flows/ds-gallery.yaml` (deleted — replaced by `apps/mobile/.maestro/gallery/{ios,android}/shard-{1..4}.yaml`)
- `apps/mobile/.maestro/flows/navigation.yaml`
- `apps/mobile/.maestro/goldens/android/*.png` (42, new), `apps/mobile/.maestro/goldens/ios/PekuloSkeleton.lines.png` (recaptured)
- `apps/mobile/__tests__/account-deletion.test.ts`, `apps/mobile/__tests__/native-surface-guards.test.ts`, `apps/mobile/__tests__/sheet-presentation.test.ts` (new)
- `apps/mobile/__tests__/android/{platform.test.ts,action-sheet.test.tsx,headers.test.tsx,account-deletion.test.tsx,sheet-presentation.test.ts,helpers/android-stack-mock.ts}` (new)
- `apps/mobile/__tests__/ds-gallery-screen.test.tsx`, `apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts`
- `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/transactions/index.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/ds/[case].tsx`, `apps/mobile/app/parametres.tsx`, `apps/mobile/app/sheets/delete-account.tsx` (new)
- `apps/mobile/components/form/fields.tsx`, `apps/mobile/components/form/sheet.tsx`, `apps/mobile/components/search-field.tsx`, `apps/mobile/components/tab-stack-layout.tsx`
- `apps/mobile/lib/account-deletion.ts`, `apps/mobile/lib/action-sheet-host.tsx`, `apps/mobile/lib/sheet-presentation.ts` (new), `apps/mobile/lib/actions.ts`, `apps/mobile/lib/i18n/messages/settings.ts`
- `apps/mobile/eas.json`, `apps/mobile/jest.config.js`, `apps/mobile/README.md`
- `README.md`, `docs/architecture.md`, `docs/epics.md`, `docs/state.yaml`, `docs/stories/10-6-android-parity-and-maestro.md`
- `skills-lock.json`, `.claude/skills/{ios-design,ui-taste}/**`, `.agents/skills/{app-store-compliance,mobile-agent-testers}/**` (T1, vendored)

### Deviations

- **E2E moved from EAS Workflows to GitHub Actions (user request, 2026-11-26).** T12's `e2e-android{,-update-goldens}.yml` were built, run, then deleted together with the 10-5 `e2e-ios{,-update-goldens}.yml`; AC-8 is met by `.github/workflows/e2e-mobile.yml` (`concurrency.cancel-in-progress`, pinned `macos-26` / Xcode 26.6 / iPhone 17 Pro iOS 26.5 and `ubuntu-24.04` / API 35 Pixel 7, gallery gated by `dorny/paths-filter`, 4 shards per platform). Golden capture is a PR label (`maestro:update-goldens`) or `workflow_dispatch` after merge. `apps/mobile/eas.json`'s `e2e-test` profile stays but CI no longer uses it.
- **Gallery flows generated as shards** (`.maestro/gallery/<platform>/shard-<n>.yaml`) instead of one file per platform; each case is wrapped in a Maestro `retry`, and a shard opens a single deep link then steps with an in-app `ds-next` button on `app/ds/[case].tsx` (every iOS `simctl openurl` raised an "Open in Pekulo?" prompt and timed out on `macos-26`). `ds-next` sits in the scroll content — pinned to the bottom it was hidden under the Android taskbar. The 10-5 claim "iOS flow byte-identical" no longer holds by design.
- **CI fixes found by the runs:** Android deep links fired right after a cold `launchApp` were dropped (wait for `tab-cap` first); the default emulator rendered ~320 dp at 1x (pinned 1080×2400 @ 420); each `maestro test` call re-installed the iOS XCTest driver (one invocation per job + `MAESTRO_DRIVER_STARTUP_TIMEOUT=300000`); the XCTest driver can still die on the 3-vCPU macOS runners, so an iOS gallery shard reruns once on a crash; ccache never cached anything (Expo native code is Swift) — the iOS `.app` is now cached under `@expo/fingerprint` and only the JS is re-bundled.
- **Test-harness fixes to the story's code:** `action-sheet.test.tsx` `afterEach` awaits `act` (RNTL 14 `act` is async; the un-awaited one swallowed the next test's render); `SheetHeaderButton` also passes `disabled` to `Pressable` (the disabled-primary test failed without it); typed `onPress` pairing and label-based keys for TS `noUncheckedIndexedAccess` / `no-array-index-key`.
- **AC-6 test added at step 07** (`lib/sheet-presentation.ts` extracted from `app/_layout.tsx`): the story planned no test for AC-6.
- **Merged `origin/main` (10-7) mid-story** (`759ab8c`): resolved `parametres.tsx` (haptics + Android deletion), docs and `skills-lock.json`; gave 10-7's new Paramètres chevron an Android Material Symbol (caught by `native-surface-guards`) and made that suite a module so it no longer collides with `store-compliance.test.ts`.
- **Native text renders in the system font** (SF Pro on iOS, Roboto on Android): DS `Text` emits no `fontFamily` on native. Pre-existing since 10-3/10-5, affects both platforms — goldens committed as is, fix split to a follow-up story (user decision 2026-11-26).
- **Durations:** the 5–7 min target holds for Android-only paths but not iOS: final run 16 min 32 (iOS build 2 min 08 on fingerprint hit; each iOS test job 10–14 min, mostly simulator boot + Maestro driver start on 3-vCPU runners; Android build ~6 min, tests ~2 min 20).
- **Visual verification:** React Grab is unavailable on React Native; done through the 42 Android goldens (reviewed with the user) and Maestro failure artifacts.

### Test output

```
$ bun --filter='@pekulo/mobile' run test
@pekulo/mobile test: Test Suites: 28 passed, 28 total
@pekulo/mobile test: Tests:       241 passed, 241 total
$ bun run typecheck   → exit 0
$ bun run lint        → exit 0 (@pekulo/mobile: Found 0 warnings and 0 errors; 3 pre-existing apps/web warnings)
$ bun run format:check → exit 0
$ actionlint .github/workflows/e2e-mobile.yml → exit 0 ; shellcheck .github/scripts/maestro-run.sh → exit 0
```

CI (`e2e-mobile`, PR #165): capture run https://github.com/yabafre/pekulo/actions/runs/45748592378 (14/14 green, label `maestro:update-goldens`); assertion run https://github.com/yabafre/pekulo/actions/runs/45750772910 (14/14 green, all 42 goldens per platform at ≥ 98 %).

## Review Record

**Date:** 2026-11-26
**Auditors:** Spec, Code, Edge & Hallucination. Aria was not dispatched: React Grab is unavailable on React Native.
**Verdict:** done
- **Override:** AC gap accepted. Reason: "User chose to fix every finding during review instead of returning the story to dev." The spec gaps were missing assertions and stale docs, not missing behaviour, and all of them are now fixed.

### Findings

#### Resolved
- [MAJOR] Hardware back did not close the Android action sheet. It popped the screen underneath and left the menu bound to an unmounted form. [apps/mobile/lib/action-sheet-host.tsx]
  - Source: Edge
  - Resolution: `33921dc`. A `BackHandler` is registered only while the sheet is open and consumes the back press. The test proves there is no listener while closed. On device, `action-sheet-android.yaml` presses back and the form stays open.
- [MAJOR] Long menus (17 categories) scrolled in a plain RN `ScrollView`, whose drags `@tamagui/sheet`'s pan responder takes over. There was also no device proof that the root-mounted menu renders above a native form sheet. [apps/mobile/lib/action-sheet-host.tsx, packages/ui/src/primitives/PekuloDrawer{,.native}.tsx]
  - Source: Code + Edge
  - Resolution: `33921dc` adds `PekuloDrawer.ScrollView` (native: `Sheet.ScrollView`; web: a scrollable div) and uses it in the host. `07a6139` adds `.maestro/flows/action-sheet-android.yaml` (transaction sheet → category menu → scroll to the 17th option → back → pick), which is green on the CI emulator (run 45761261872).
- [MAJOR] New, found by that flow on the emulator: a mounted `<DateTimePicker>` is the Material dialog itself on Android, so every sheet with a date (transaction, valuation, mortgage, property, lot) opened a calendar over the form. [apps/mobile/components/form/fields.tsx]
  - Source: Lead (CI run 45759209429, Maestro screenshot)
  - Resolution: `8a729b9`. Android shows the date and opens `DateTimePickerAndroid` on tap. `__tests__/android/date-field.test.tsx` was confirmed RED on the old code. iOS is unchanged.
- [MINOR] Action rows were keyed by label, so duplicate account names collided. [apps/mobile/lib/action-sheet-host.tsx]
  - Source: Code + Edge + Spec
  - Resolution: `33921dc`. Keys are now positional with a label suffix. The test asserts no duplicate-key warning and is confirmed RED on label keys.
- [MINOR] The Android deletion sheet left Paramètres in the stack under `/login`. [apps/mobile/app/sheets/delete-account.tsx]
  - Source: Edge
  - Resolution: `8269d88`. `dismissAll()` runs before `replace("/login")`, and the test checks the call order.
- [MINOR] The CI path filters missed `.github/actions/maestro-*`, `app/_layout.tsx` and `bun.lock`. `cancel-in-progress` also cancelled `main` cache-warming runs. [.github/workflows/e2e-mobile.yml]
  - Source: Edge + Code
  - Resolution: `07a6139`.
- [MINOR] AC-2, AC-3 and AC-5 assertions were missing: opaque Android header, danger colour, close-then-run order, five tab labels on a grayscale bar, and the `md=` tab-icon guard. [apps/mobile/__tests__/android/*, __tests__/native-surface-guards.test.ts]
  - Source: Spec + Code
  - Resolution: `33921dc`, `7fe3008`. The iOS half of AC-3 was already covered by `__tests__/form-kit.test.tsx` (`ActionSheetIOS`).
- [MINOR] AC-7/AC-8 wording still described EAS, the File List was stale, and `epics.md` / `architecture.md` still referred to the EAS workflows. [docs/*]
  - Source: Spec + git-audit
  - Resolution: `adc2624`. The realized AC-7/AC-8 note is above Tasks, and the File List was rebuilt from the branch diff.
- [MINOR] The Android sheet-presentation test hardcoded Paramètres' detents and used a partial match. [apps/mobile/__tests__/android/sheet-presentation.test.ts]
  - Source: Code
  - Resolution: `7fe3008`. `PARAMETRES_DETENTS` is shared with `app/_layout.tsx`, and the test uses exact `toEqual`.
- [LOW] Introduced by the fix: writing a ref during render made React Compiler skip `ActionSheetHost`. [apps/mobile/lib/action-sheet-host.tsx]
  - Source: verification auditor
  - Resolution: `81a2aeb` switches to the previous-value state pattern. `babel-plugin-react-compiler` went from `CompileError` to `CompileSuccess`.
- [NIT] `TabToolbar` rebuilt `headerRight` on every render; the closing sheet went blank; a null account email showed « E-mail incorrect »; the Maestro CLI version was not asserted; the `e2e-test` env was duplicated in the workflow.
  - Source: Code + Edge
  - Resolution:
    - `7fe3008`: `useMemo` for `headerRight`.
    - `33921dc`, `81a2aeb`: the last request stays rendered while the sheet closes.
    - `8269d88`: `settings.deletion.emailUnavailable` for a null account email.
    - `07a6139`: `maestro-run.sh` fails fast on a version mismatch, and `__tests__/e2e-build-env.test.ts` catches env drift (confirmed RED).

#### Dismissed
- none

#### Unresolved (story stays in `review`)
- none

### Verification
- Test command: `bun --filter='@pekulo/mobile' run test` → `Test Suites: 31 passed, 31 total` / `Tests: 253 passed, 253 total` (ios + android projects). `bun --filter='@pekulo/ui' run test` → 162 files, 352 passed, 1 skipped.
- `bun run typecheck` exit 0 · `bun run lint` 0 errors (3 pre-existing `apps/web` warnings) · `bun run format:check` exit 0 · `actionlint` / `shellcheck` / `maestro check-syntax` OK.
- CI `e2e-mobile` run 45761261872: 13/13 jobs green. The Android core job passed `action-sheet-android` on its first attempt. PR #165: 25/25 checks pass.
- Visual verification: deferred. React Grab MCP is unavailable on React Native (2026-11-26T06:30:00Z). Android behaviour is checked through the Maestro emulator flows and failure screenshots, plus the 42 Android goldens.

### Ticket sync
- Ticket comment posted: https://github.com/yabafre/pekulo/issues/162#issuecomment-7183693036
- PR opened/updated: https://github.com/yabafre/pekulo/pull/165
