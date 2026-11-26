---
storyKey: 10-8-native-geist-font
epic: 10
ticket: "#166"
branch: feature/166-10-8-native-geist-font
status: done
complexity: M
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Story: 10-8-native-geist-font — Render every @pekulo/ui text in Geist on iOS and Android

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** done
**Ticket:** [#166](https://github.com/yabafre/pekulo/issues/166)
**Branch:** `feature/166-10-8-native-geist-font`
**Depends on:** 10-6-android-parity-and-maestro (done — PR #165; its review outcome records "native DS text still renders in the system font" as a pre-existing gap split to this story)
**Covered FRs:** FR-56 (native typography parity)
**Complexity:** M

## User Story

**As a** Pekulo mobile user, **I want** every `@pekulo/ui` text on iOS and Android to render in Geist like the web PWA, **so that** the native app matches the Pekulo Design System instead of falling back to SF Pro (iOS) and Roboto (Android).

## Acceptance Criteria

- **AC-1 (Every DS text resolves to a Geist face per weight)** — **Given** the mobile app running natively (iOS or Android), **When** any `@pekulo/ui` text renders — whether the Tamagui optimizing compiler flattened it at build time or Tamagui resolved it at runtime — **Then** its style carries a Geist face name matching its weight (`Geist_400Regular` for no weight / 400, `Geist_500Medium` for 500, `Geist_600SemiBold` for 600, `Geist_700Bold` for 700; `$heading` without weight → `Geist_600SemiBold`; `$mono` → `GeistMono_<weight>`), **And** that style carries **no** `fontWeight` alongside the custom face (a custom `fontFamily` + `fontWeight` pair makes Android fall back to the system font).
- **AC-2 (Text surfaces that bypass the global Text default)** — **Given** the native DS text inputs (single-line and multi-line), the native breadcrumb link, and the app's transaction search field, **When** they render, **Then** their text resolves to `Geist_400Regular`.
- **AC-3 (Proven on both platforms)** — **Given** the mobile unit test suite, **When** it runs for iOS and for Android with a cold transform cache, **Then** the same assertions prove AC-1 and AC-2 on both, **And** the suite fails if the build-time style compiler stops using the native font configuration or if the build-time and runtime configurations ever disagree on fonts or text defaults.
- **AC-4 (Web output byte-identical)** — **Given** the finished change, **When** the design-system web test suite runs and the pre-generated web stylesheet is regenerated, **Then** every web snapshot passes unchanged **And** the regenerated stylesheet is byte-identical to the committed one (lesson 2026-05-24).
- **AC-5 (Web ↔ native parity gate stays green)** — **Given** the web ↔ native text-style parity gate from story 10-5, **When** it compares native text styles to the frozen web baseline, **Then** it reads the native weight from the Geist face name when the explicit weight was folded into the face, so every case passes with **no new allow-list entry**.
- **AC-6 (Goldens show Geist on both platforms)** — **Given** the pull request against `main` with golden recapture requested, **When** the mobile E2E pipeline runs the DS gallery on the pinned iOS simulator and Android emulator, **Then** the recaptured screenshots of every gallery case on both platforms (downloaded only after the user approves) show Geist text, the user confirms it on review, they replace the committed goldens, recapture is switched off, and the next pipeline run asserts green against them.
- **AC-7 (Quality gates & doc sync)** — **Given** the finished change, **When** typecheck, lint, format check, the design-system web tests and the mobile tests run, **Then** all pass, **And** the epic plan, sprint state and epic context cache are synced in this change.

## Tasks

Run every command from the worktree root unless it starts with `cd`. Never `bun --cwd` (lesson 2026-05-05); filter workspaces by name `@pekulo/ui` / `@pekulo/mobile` (lesson 2026-05-19). Mobile Jest runs as `cd apps/mobile && bunx jest ...` (never `bun test` there). Commit prefix: `feat(#166): ...`. Run `bun run typecheck` before every commit (lesson 2026-06-01). The repo lives in iCloud: if `tsc`/`jest` sits at 0 % CPU, an evicted `dataless` file is being fetched — see memory `pekulo-icloud-dataless-hangs`.

**T1 — RED: shared native-font assertions in both Jest projects** [AC: AC-1, AC-2, AC-3]

- [x] **T1.1 — Create `apps/mobile/__tests__/helpers/native-fonts.tsx`** [AC: AC-1, AC-2, AC-3]
  ```tsx
  // apps/mobile/__tests__/helpers/native-fonts.tsx
  // Story 10-8 AC-1/AC-2/AC-3 — one assertion set shared by the `ios` and
  // `android` Jest projects. Renders DS text through every resolution path:
  //   - bare Tamagui Text (runtime defaultProps path),
  //   - PekuloHero (compiler-flattened path — only meaningful with a cold
  //     transform cache: run with `--no-cache`),
  //   - PekuloBreadcrumbLink (named styled(Text), bypasses defaultProps.Text),
  //   - PekuloInput / PekuloTextarea / SearchField (raw RN TextInput).
  import {
    PekuloBreadcrumbLink,
    PekuloHero,
    PekuloInput,
    PekuloRootProvider,
    PekuloTextarea,
  } from "@pekulo/ui";
  import { Text } from "@pekulo/ui/client";
  import { render } from "@testing-library/react-native";
  import { StyleSheet } from "react-native";

  import { SearchField } from "@/components/search-field";

  type HostNode = {
    type: string;
    props: Record<string, unknown>;
    children: Array<HostNode | string> | null;
  };

  export type NativeFontRecord = {
    type: string;
    testID: string | undefined;
    text: string;
    fontFamily: unknown;
    fontWeight: unknown;
  };

  export const GEIST_FACES = new Set([
    "Geist_400Regular",
    "Geist_500Medium",
    "Geist_600SemiBold",
    "Geist_700Bold",
    "GeistMono_400Regular",
    "GeistMono_500Medium",
    "GeistMono_600SemiBold",
    "GeistMono_700Bold",
  ]);

  function collect(node: HostNode | HostNode[] | string | null, out: NativeFontRecord[]): void {
    if (node === null || typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const child of node) collect(child, out);
      return;
    }
    if (node.type === "Text" || node.type === "TextInput") {
      const style = (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
      out.push({
        type: node.type,
        testID: node.props.testID as string | undefined,
        text: (node.children ?? []).filter((c): c is string => typeof c === "string").join(""),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
      });
    }
    for (const child of node.children ?? []) collect(child, out);
  }

  export async function renderNativeFontCases(): Promise<NativeFontRecord[]> {
    const view = await render(
      <PekuloRootProvider>
        <Text testID="t-default">default</Text>
        <Text testID="t-400" fontWeight="400">w400</Text>
        <Text testID="t-500" fontWeight="500">w500</Text>
        <Text testID="t-600" fontWeight="600">w600</Text>
        <Text testID="t-700" fontWeight="700">w700</Text>
        <Text testID="t-heading" fontFamily="$heading">heading</Text>
        <Text testID="t-mono-700" fontFamily="$mono" fontWeight="700">mono700</Text>
        <PekuloHero totalEur={152340} aheadEur={4200} />
        <PekuloBreadcrumbLink testID="t-crumb">crumb</PekuloBreadcrumbLink>
        <PekuloInput testID="t-input" placeholder="input" />
        <PekuloTextarea testID="t-textarea" placeholder="textarea" />
        <SearchField testID="t-search" value="" onChange={() => {}} placeholder="search" />
      </PekuloRootProvider>,
    );
    const out: NativeFontRecord[] = [];
    collect(view.toJSON() as HostNode | HostNode[] | null, out);
    await view.unmount();
    return out;
  }

  export const EXPECTED_FACE_BY_TEST_ID: Record<string, string> = {
    "t-default": "Geist_400Regular",
    "t-400": "Geist_400Regular",
    "t-500": "Geist_500Medium",
    "t-600": "Geist_600SemiBold",
    "t-700": "Geist_700Bold",
    "t-heading": "Geist_600SemiBold",
    "t-mono-700": "GeistMono_700Bold",
    "t-crumb": "Geist_400Regular",
    "t-input": "Geist_400Regular",
    "t-textarea": "Geist_400Regular",
    "t-search": "Geist_400Regular",
  };

  export function describeNativeFonts(platformLabel: string): void {
    describe(`@pekulo/ui native Geist faces on ${platformLabel} (story 10-8)`, () => {
      let records: NativeFontRecord[] = [];

      beforeAll(async () => {
        records = await renderNativeFontCases();
      });

      it.each(Object.entries(EXPECTED_FACE_BY_TEST_ID))(
        "%s resolves to %s",
        (testID, face) => {
          const record = records.find((r) => r.testID === testID);
          expect(record).toBeDefined();
          expect(record?.fontFamily).toBe(face);
        },
      );

      it("never pairs a custom Geist face with a fontWeight (Android fallback trap)", () => {
        const offenders = records.filter((r) => r.fontWeight !== undefined);
        expect(offenders).toEqual([]);
      });

      it("renders every text node — including compiler-flattened PekuloHero text — in a Geist face", () => {
        const offenders = records.filter(
          (r) => typeof r.fontFamily !== "string" || !GEIST_FACES.has(r.fontFamily),
        );
        expect(offenders).toEqual([]);
        expect(records.some((r) => r.testID === undefined && r.fontFamily === "Geist_600SemiBold")).toBe(true);
      });
    });
  }
  ```
  `SearchField` (`apps/mobile/components/search-field.tsx`) takes `{ value: string; onChange: (value: string) => void; placeholder: string; testID?: string }` and calls `useTheme()` (satisfied by `PekuloRootProvider`) and `useI18n()` (its context defaults to `"fr"`, no provider needed) — measured at write time.
  No run yet (helper only).

- [x] **T1.2 — Create `apps/mobile/__tests__/native-fonts.test.tsx` (ios project)** [AC: AC-3]
  ```tsx
  // apps/mobile/__tests__/native-fonts.test.tsx
  // Story 10-8 AC-3 — iOS Jest project (jest-expo). Run with --no-cache: the
  // Tamagui compiler config is not part of Jest's transform cache key.
  import { describeNativeFonts } from "./helpers/native-fonts";

  describeNativeFonts("iOS");
  ```

- [x] **T1.3 — Create `apps/mobile/__tests__/android/native-fonts.test.tsx` (android project)** [AC: AC-3]
  ```tsx
  // apps/mobile/__tests__/android/native-fonts.test.tsx
  // Story 10-8 AC-3 — Android Jest project (jest-expo/android). Same assertions
  // as the iOS project; Android is where fontFamily + fontWeight falls back to Roboto.
  import { describeNativeFonts } from "../helpers/native-fonts";

  describeNativeFonts("Android");
  ```

- [x] **T1.4 — Witness RED** [AC: AC-3]
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios android --testPathPatterns native-fonts`
  Expected (RED): both suites FAIL — e.g. `t-default resolves to Geist_400Regular` receives `undefined`, `t-crumb` receives `undefined`, `t-input`/`t-textarea` receive `undefined`, and the "every text node" test lists PekuloHero records with `fontFamily: "Geist, ui-sans-serif, …"`. `t-search` already passes (SearchField sets the face today). Paste the failing summary under `Dev Agent Record › Test output`.
  Commit: `git add apps/mobile/__tests__/helpers/native-fonts.tsx apps/mobile/__tests__/native-fonts.test.tsx apps/mobile/__tests__/android/native-fonts.test.tsx && git commit -m "test(#166): RED native Geist face assertions on iOS and Android"`

**T2 — Shared config factory + native-only Text default** [AC: AC-1, AC-4]

- [x] **T2.1 — Create `packages/ui/src/config/create-config.ts`** [AC: AC-1, AC-4]
  ```ts
  // packages/ui/src/config/create-config.ts
  // Story 10-8 — the single createTamagui() body shared by the runtime config
  // (`./tamagui.ts`, platform-resolved by Metro / Next / Vitest / @tamagui/cli)
  // and the native compiler config (`./tamagui.compiler.native.ts`, which must
  // import `./fonts.native` explicitly because @tamagui/static loads configs
  // with a plain Node require() that ignores `.native.ts`).
  //
  // Both @tamagui/cli rc.42 theme notes and the AC-1/AC-2 history of story 10-2
  // live in `./tamagui.ts`'s header.
  import { defaultConfig } from "@tamagui/config/v5";
  import { createTamagui } from "@tamagui/core";

  import { pekuloDark } from "../themes/pekulo-dark";
  import { pekuloLight } from "../themes/pekulo-light";
  import { pekuloRadius, pekuloSpacing } from "../tokens";

  export interface PekuloConfigInput {
    animations: Parameters<typeof createTamagui>[0]["animations"];
    fonts: unknown;
    /** Native only (story 10-8). `undefined` on web keeps the web config byte-identical. */
    defaultProps?: Record<string, Record<string, unknown>>;
  }

  export function createPekuloConfig({ animations, fonts, defaultProps }: PekuloConfigInput) {
    return createTamagui({
      ...defaultConfig,
      animations,
      settings: {
        ...defaultConfig.settings,
        // Allow longhand style props (`backgroundColor`, `borderRadius`, ...)
        // alongside Tamagui's shorthands (`bg`, `rounded`, ...). UX preview source
        // uses longhands ; reviewers read longhands more fluently.
        onlyAllowShorthands: false,
      },
      themes: {
        "pekulo-dark": pekuloDark,
        "pekulo-light": pekuloLight,
      },
      defaultTheme: "pekulo-dark",
      // createTamagui() treats `undefined` exactly like an absent key
      // (`configIn.defaultProps || {}`), so web output does not change.
      defaultProps: defaultProps as never,
      // Token overrides — Pekulo spacing/radius/font scales replace defaultConfig's.
      tokens: {
        ...defaultConfig.tokens,
        space: pekuloSpacing as never,
        size: pekuloSpacing as never,
        radius: pekuloRadius as never,
      },
      fonts: fonts as never,
    });
  }
  ```

- [x] **T2.2 — Replace the body of `packages/ui/src/config/tamagui.ts`** [AC: AC-1, AC-4]
  Keep the existing header comment block verbatim — every comment line from `// packages/ui/src/config/tamagui.ts` down to and including the line ending `See that script's header for the full rationale.`, then replace everything from `import { defaultConfig } from "@tamagui/config/v5";` to the end of the file with:
  ```ts
  //
  // Story 10-8: the createTamagui() body lives in ./create-config.ts so the
  // native compiler config (./tamagui.compiler.native.ts) builds the exact same
  // config with the native fonts. `pekuloFontDefaultProps` is `undefined` on
  // web (fonts.ts) and `{ Text: { fontFamily: "$body" } }` on native
  // (fonts.native.ts) — Tamagui only swaps in the weight-matched Geist face
  // when a Text carries a fontFamily.
  import { animations } from "./animations";
  import { createPekuloConfig } from "./create-config";
  import { createPekuloFonts, pekuloFontDefaultProps } from "./fonts";

  export const config = createPekuloConfig({
    animations,
    fonts: createPekuloFonts(),
    defaultProps: pekuloFontDefaultProps,
  });

  export type AppConfig = typeof config;

  declare module "@tamagui/web" {
    // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
    interface TamaguiCustomConfig extends AppConfig {}
  }
  ```

- [x] **T2.3 — Add the web no-op export to `packages/ui/src/config/fonts.ts`** [AC: AC-4]
  Append at the end of the file:
  ```ts

  /**
   * Story 10-8 — web needs no Text default: global CSS + the `font_*` classes
   * already give every Tamagui text Geist. Must stay `undefined` so the web
   * Tamagui config (and public/tamagui.generated.css) stays byte-identical.
   */
  export const pekuloFontDefaultProps: Record<string, Record<string, unknown>> | undefined =
    undefined;
  ```

- [x] **T2.4 — Add the native Text default, base face and face→weight map to `packages/ui/src/config/fonts.native.ts`** [AC: AC-1, AC-2, AC-5]
  Append at the end of the file:
  ```ts

  /**
   * Story 10-8 — every native Tamagui Text gets `fontFamily: "$body"`, so
   * Tamagui's native face swap (getSplitStyles) resolves `Geist_<weight>` and
   * deletes `fontWeight` (a custom family + weight makes Android fall back to
   * Roboto). Named styled(Text) components are keyed by their own name and must
   * set `fontFamily: "$body"` themselves (see PekuloBreadcrumb.native.tsx).
   */
  export const pekuloFontDefaultProps: Record<string, Record<string, unknown>> | undefined = {
    Text: { fontFamily: "$body" },
  };

  /** Story 10-8 — base face for raw React Native TextInput surfaces. */
  export const PEKULO_NATIVE_BODY_FACE = geistFace[400].normal;

  /**
   * Story 10-8 AC-5 — face name → CSS weight, so parity checks can read the
   * weight Tamagui folded into the face name after stripping `fontWeight`.
   */
  export const PEKULO_NATIVE_FACE_WEIGHT: Readonly<Record<string, string>> = Object.fromEntries(
    [geistFace, geistMonoFace].flatMap((faces) =>
      Object.entries(faces).map(([weight, face]) => [face.normal, weight]),
    ),
  );
  ```

- [x] **T2.5 — Verify the web config is untouched** [AC: AC-4]
  Run: `bun run typecheck`
  Expected: exit 0.
  Run: `bun --filter='@pekulo/ui' run test`
  Expected: same pass count as `main` (e.g. `Test Files  … passed`), zero snapshot changes, exit 0.
  Run: `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css`
  Expected: exit 0, empty diff.
  Commit: `git add packages/ui/src/config/create-config.ts packages/ui/src/config/tamagui.ts packages/ui/src/config/fonts.ts packages/ui/src/config/fonts.native.ts && git commit -m "feat(#166): shared Tamagui config factory with native-only Text font default"`

**T3 — Native compiler config** [AC: AC-1, AC-3]

- [x] **T3.1 — Create `packages/ui/src/config/tamagui.compiler.native.ts`** [AC: AC-1]
  ```ts
  // packages/ui/src/config/tamagui.compiler.native.ts
  // Story 10-8 — config entry for @tamagui/babel-plugin / @tamagui/metro-plugin
  // in apps/mobile ONLY. @tamagui/static loads the compiler config with a plain
  // Node require() (registerRequire) that never resolves `.native.ts`, so the
  // runtime config (./tamagui.ts → "./fonts") would bake the WEB font stack into
  // every flattened native Text. Importing "./fonts.native" explicitly makes the
  // compile-time config equal the runtime config Metro builds on device.
  //
  // `./animations` intentionally stays extension-less: the compiler resolved the
  // web (CSS) driver before this story and does not use animation drivers to
  // flatten styles; changing it is out of scope.
  //
  // Excluded from packages/ui's web typecheck by the `**/*.native.ts` rule;
  // type-checked by apps/mobile through apps/mobile/tamagui.config.ts.
  import { animations } from "./animations";
  import { createPekuloConfig } from "./create-config";
  import { createPekuloFonts, pekuloFontDefaultProps } from "./fonts.native";

  export const config = createPekuloConfig({
    animations,
    fonts: createPekuloFonts(),
    defaultProps: pekuloFontDefaultProps,
  });
  ```

- [x] **T3.2 — Export it from `packages/ui/package.json`** [AC: AC-1]
  In `"exports"`, replace:
  ```json
      "./tamagui-config": "./src/config/tamagui.ts",
  ```
  with:
  ```json
      "./tamagui-config": "./src/config/tamagui.ts",
      "./tamagui-compiler-config": "./src/config/tamagui.compiler.native.ts",
  ```

- [x] **T3.3 — Point the mobile compiler at it: replace `apps/mobile/tamagui.config.ts`** [AC: AC-1]
  ```ts
  // apps/mobile/tamagui.config.ts
  // Local root entrypoint for @tamagui/babel-plugin and @tamagui/metro-plugin.
  // Story 10-8: re-exports the NATIVE compiler config — the shared runtime
  // config resolves "./fonts" to the web stack under the compiler's Node
  // require(). Guarded by __tests__/native-font-config.test.ts.
  export { config as default } from "@pekulo/ui/tamagui-compiler-config";
  ```

- [x] **T3.4 — Map it for Jest in `apps/mobile/jest.config.js`** [AC: AC-3]
  In `MODULE_NAME_MAPPER`, after the line
  ```js
    "^@pekulo/ui/tamagui-config$": "<rootDir>/../../packages/ui/src/config/tamagui.ts",
  ```
  add:
  ```js
    "^@pekulo/ui/tamagui-compiler-config$":
      "<rootDir>/../../packages/ui/src/config/tamagui.compiler.native.ts",
  ```

- [x] **T3.5 — Create the guard `apps/mobile/__tests__/native-font-config.test.ts`** [AC: AC-3]
  ```ts
  // apps/mobile/__tests__/native-font-config.test.ts
  // Story 10-8 AC-3 — the Tamagui compiler must load the native-font config,
  // and that config must equal the runtime config (fonts + defaultProps).
  import { readFileSync } from "node:fs";
  import { join } from "node:path";

  const MOBILE_ROOT = join(__dirname, "..");
  const UI_CONFIG = join(MOBILE_ROOT, "../../packages/ui/src/config");

  describe("Tamagui native compiler config (story 10-8)", () => {
    it("apps/mobile/tamagui.config.ts re-exports the native compiler config", () => {
      const source = readFileSync(join(MOBILE_ROOT, "tamagui.config.ts"), "utf8");
      expect(source).toMatch(
        /export \{ config as default \} from "@pekulo\/ui\/tamagui-compiler-config";/,
      );
    });

    it("the compiler config imports the native fonts explicitly", () => {
      const source = readFileSync(join(UI_CONFIG, "tamagui.compiler.native.ts"), "utf8");
      expect(source).toMatch(/from "\.\/fonts\.native";/);
    });

    it("compiler and runtime configs agree on fonts and the Text default", () => {
      jest.isolateModules(() => {
        const runtime = require("@pekulo/ui/tamagui-config").config;
        const runtimeFonts = JSON.stringify(runtime.fontsParsed);
        const runtimeDefaults = JSON.stringify(runtime.defaultProps);
        const compiler = require("@pekulo/ui/tamagui-compiler-config").config;
        expect(JSON.stringify(compiler.fontsParsed)).toBe(runtimeFonts);
        expect(JSON.stringify(compiler.defaultProps)).toBe(runtimeDefaults);
        expect(compiler.defaultProps.Text).toEqual({ fontFamily: "$body" });
        expect(compiler.fontsParsed.$body.family.val ?? compiler.fontsParsed.$body.family).toBe(
          "Geist_400Regular",
        );
      });
    });
  });
  ```
  If `fontsParsed.$body.family` is a plain string rather than a variable object, the `?? ` fallback covers it; do not loosen the other assertions.
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios --testPathPatterns native-font-config`
  Expected: `Tests: 3 passed`, exit 0.
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios android --testPathPatterns native-fonts`
  Expected: still RED only on `t-crumb`, `t-input`, `t-textarea` (bare `Text` and PekuloHero now pass).
  Run: `bun run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/config/tamagui.compiler.native.ts packages/ui/package.json apps/mobile/tamagui.config.ts apps/mobile/jest.config.js apps/mobile/__tests__/native-font-config.test.ts && git commit -m "feat(#166): load native Geist fonts in the Tamagui compiler config"`

**T4 — Surfaces outside the Text default** [AC: AC-2]

- [x] **T4.1 — `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`** [AC: AC-2]
  Replace:
  ```tsx
  const BreadcrumbLinkText = styled(Text, {
    name: "PekuloBreadcrumbLinkText",
    role: "link",
    color: "$colorTertiary",
    fontSize: pekuloFontSizes.bodySm,
  });
  ```
  with:
  ```tsx
  const BreadcrumbLinkText = styled(Text, {
    name: "PekuloBreadcrumbLinkText",
    role: "link",
    // Story 10-8: config.defaultProps is keyed by componentName, so this named
    // Text never receives the global `Text` font default — set it here.
    fontFamily: "$body",
    color: "$colorTertiary",
    fontSize: pekuloFontSizes.bodySm,
  });
  ```

- [x] **T4.2 — `packages/ui/src/primitives/PekuloInput.native.tsx`** [AC: AC-2]
  Replace:
  ```tsx
  import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";
  ```
  with:
  ```tsx
  import { PEKULO_NATIVE_BODY_FACE } from "../config/fonts.native";
  import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";
  ```
  and in the `TextInput` style object replace:
  ```tsx
              fontSize: pekuloFontSizes.bodySm,
              borderWidth: invalid ? 1 : 0,
  ```
  with:
  ```tsx
              fontSize: pekuloFontSizes.bodySm,
              fontFamily: PEKULO_NATIVE_BODY_FACE,
              borderWidth: invalid ? 1 : 0,
  ```

- [x] **T4.3 — `packages/ui/src/primitives/PekuloTextarea.native.tsx`** [AC: AC-2]
  Add `import { PEKULO_NATIVE_BODY_FACE } from "../config/fonts.native";` directly above its existing `../tokens` import, and in the `TextInput` style object replace:
  ```tsx
            fontSize: pekuloFontSizes.bodySm,
            borderWidth: invalid ? 1 : 0,
  ```
  with:
  ```tsx
            fontSize: pekuloFontSizes.bodySm,
            fontFamily: PEKULO_NATIVE_BODY_FACE,
            borderWidth: invalid ? 1 : 0,
  ```
  `apps/mobile/components/search-field.tsx` already sets `fontFamily: "Geist_400Regular"` on its `TextInput` — no change; `t-search` keeps it pinned.

- [x] **T4.4 — GREEN** [AC: AC-1, AC-2, AC-3]
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios android --testPathPatterns "native-fonts|native-font-config"`
  Expected: every test passes in both projects (`Tests: … passed`, 0 failed), exit 0.
  Run: `bun run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloBreadcrumb.native.tsx packages/ui/src/primitives/PekuloInput.native.tsx packages/ui/src/primitives/PekuloTextarea.native.tsx && git commit -m "feat(#166): Geist face on native inputs and breadcrumb link"`

**T5 — Parity gate reads the weight from the face** [AC: AC-5]

- [x] **T5.1 — Witness the parity RED** [AC: AC-5]
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios --testPathPatterns ds-token-parity`
  Expected (RED): failures of the form `PekuloAccountRow.default|pekulo-dark|PEA Bourso#0|fontWeight — web="500" native=null` (measured at write time).

- [x] **T5.2 — Update `apps/mobile/__tests__/ds-token-parity.test.tsx`** [AC: AC-5]
  Add after the existing `import baselineJson ...` line:
  ```tsx
  import { PEKULO_NATIVE_FACE_WEIGHT } from "../../../packages/ui/src/config/fonts.native";
  ```
  Add above `function collectTextRecords(`:
  ```tsx
  // Story 10-8 AC-5 — on native, Tamagui folds the weight into the Geist face
  // name and deletes fontWeight (Android fallback trap), so read it back.
  function nativeFontWeight(merged: Record<string, unknown>): unknown {
    if (merged.fontWeight !== undefined) return merged.fontWeight;
    return typeof merged.fontFamily === "string"
      ? PEKULO_NATIVE_FACE_WEIGHT[merged.fontFamily]
      : undefined;
  }
  ```
  and inside `collectTextRecords` replace:
  ```tsx
          fontWeight: normalizeFontWeight(merged.fontWeight),
  ```
  with:
  ```tsx
          fontWeight: normalizeFontWeight(nativeFontWeight(merged)),
  ```
  Text with no explicit weight now resolves `Geist_400Regular` → `"400"`. If the web baseline left `fontWeight` unset for such a node, `diffTextStyles` only compares properties the web sets (AC-3 of 10-5), so no new divergence appears; if one does, STOP and report it under `Dev Agent Record › Deviations` — do not add an allow-list entry (AC-5).
  Run: `cd apps/mobile && bunx jest --no-cache --selectProjects ios --testPathPatterns ds-token-parity`
  Expected: all cases pass, exit 0.
  Commit: `git add apps/mobile/__tests__/ds-token-parity.test.tsx && git commit -m "test(#166): parity gate derives native weight from the Geist face"`

**T6 — Full gates** [AC: AC-4, AC-7]

- [x] **T6.1 — Run every gate** [AC: AC-4, AC-7]
  Run, in order:
  ```bash
  bun run typecheck
  bun run lint
  bun run format:check
  bun --filter='@pekulo/ui' run test
  bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
  cd apps/mobile && bunx jest --no-cache && cd ../..
  ```
  Expected: every command exits 0; the mobile run reports both `ios` and `android` projects green; the CSS diff is empty.
  If `format:check` fails on files this story touched, run `bunx oxfmt <those files>` and re-run. No commit unless a fix was needed: `git add <fixed files> && git commit -m "chore(#166): format"`.

**T7 — Doc sync** [AC: AC-7]

- [x] **T7.1 — `docs/epics.md`, `docs/state.yaml`, `docs/epics-context/epic-10-context.md`** [AC: AC-7]
  In `docs/epics.md`, insert directly after the Story 10-7 block (before `## Epic 11: Public-ramp readiness`):
  ```markdown
  #### Story 10-8-native-geist-font

  **Ticket:** [#166](https://github.com/yabafre/pekulo/issues/166)
  **Title:** Render every `@pekulo/ui` text in Geist on iOS and Android

  **Depends on:** 10-6-android-parity-and-maestro

  **As a** Pekulo mobile user, **I want** every `@pekulo/ui` text on iOS and Android to render in Geist like the web PWA, **so that** the native app matches the design system instead of falling back to SF Pro / Roboto.

  **Summary:** Two defects kept native DS text in the system font: no native `Text` default `fontFamily` (Tamagui only swaps in the weight-matched face when a family is set), and `@tamagui/static` loading the compiler config with a Node `require()` that resolves the web `fonts.ts`. Shared `createPekuloConfig()` factory, a native compiler config importing `fonts.native` explicitly, a native-only `defaultProps.Text.fontFamily = "$body"`, Geist on native inputs and the breadcrumb link, parity gate reading weight from the face, Jest proof on iOS + Android, web output byte-identical, goldens recaptured on both platforms.

  **Covered FRs:** FR-56 (native typography parity)
  **Complexity:** M
  ```
  `docs/state.yaml` already has the row below (written by aped-story); aped-dev only updates its `status` and timestamps as it progresses — verify it is present:
  ```yaml
      10-8-native-geist-font: {status: review, depends_on: [10-6-android-parity-and-maestro], ticket: "#166", worktree: null}
  ```
  In `docs/epics-context/epic-10-context.md`, under `## Architecture references` → `Patterns to respect`, add the bullet:
  ```markdown
    - **Tamagui compiler config is native-explicit (story 10-8)** — `apps/mobile/tamagui.config.ts` re-exports `@pekulo/ui/tamagui-compiler-config` (`packages/ui/src/config/tamagui.compiler.native.ts`), which imports `./fonts.native` explicitly because `@tamagui/static` loads compiler configs with a Node `require()` that ignores `.native.ts`. Both it and the runtime `tamagui.ts` call `createPekuloConfig()` (`create-config.ts`). Native `Text` defaults to `fontFamily: "$body"`; named `styled(Text)` components must set it themselves. Mobile Jest proofs that depend on compiler output run with `--no-cache`.
  ```
  Run: `bunx oxfmt --check docs/epics.md docs/state.yaml docs/epics-context/epic-10-context.md`
  Expected: exit 0 (format and re-run if not).
  Commit: `git add docs/epics.md docs/state.yaml docs/epics-context/epic-10-context.md docs/stories/10-8-native-geist-font.md && git commit -m "docs(#166): sync epic 10 plan and context for story 10-8"`

**T8 — PR + golden recapture on both platforms** [AC: AC-6]

- [x] **T8.1 — Push and open the PR against `main`**
  ```bash
  git push -u origin feature/166-10-8-native-geist-font
  gh pr create --base main --title "feat(#166): 10-8 render @pekulo/ui text in Geist on iOS and Android" --body "Closes #166"
  ```
  Expected: PR URL printed. The `e2e-mobile` workflow starts (paths include `packages/ui/**`); its DS gallery shards FAIL against the old system-font goldens — that failure is expected and is the visual proof the text changed.

- [x] **T8.2 — Recapture**
  ```bash
  gh pr edit --add-label "maestro:update-goldens"
  git commit --allow-empty -m "chore(#166): recapture Maestro goldens" && git push
  ```
  Wait for the `e2e-mobile` run on that push to finish (ask the user to watch it or use the PR's checks; do not poll in a loop). Then list its artifacts:
  ```bash
  RUN_ID=$(gh run list --workflow e2e-mobile.yml --branch feature/166-10-8-native-geist-font --limit 1 --json databaseId -q '.[0].databaseId')
  gh run view "$RUN_ID" --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
  gh api "repos/yabafre/pekulo/actions/runs/$RUN_ID/artifacts" -q '.artifacts[] | "\(.name) \(.size_in_bytes)"'
  ```
  ⏸ **Ask the user to approve the download** (state artifact names and sizes). On approval, download into a fresh empty directory, then copy only the PNGs:
  ```bash
  DL=$(mktemp -d)
  for p in ios android; do for s in 1 2 3 4; do gh run download "$RUN_ID" -n "goldens-$p-shard-$s" -D "$DL/$p-$s"; done; done
  for p in ios android; do /usr/bin/find "$DL" -path "*$p-*" -name '*.png' -exec cp {} "apps/mobile/.maestro/goldens/$p/" \; ; done
  git status --short apps/mobile/.maestro/goldens
  ```
  Expected: 42 modified PNGs per platform (no added/deleted names — a new or missing name means a gallery case drifted; STOP and report).

- [x] **T8.3 — Review with the user, commit, remove the label**
  ⏸ Show the user several before/after pairs per platform (e.g. `git show HEAD:apps/mobile/.maestro/goldens/android/<case>.png` vs the new file) and get explicit confirmation the text is Geist on both platforms.
  ```bash
  git add apps/mobile/.maestro/goldens/ios apps/mobile/.maestro/goldens/android
  git commit -m "test(#166): recapture iOS and Android DS goldens in Geist"
  gh pr edit --remove-label "maestro:update-goldens"
  git push
  ```
  Expected: the assert run on this push is green on every iOS and Android gallery shard and core flow.

## Dev Notes

- **Architecture:** platform-split `@pekulo/ui` (`*.native.ts` siblings, `"react-native"` export condition — epic-10 context); RSC barrel discipline is untouched (no barrel changes). Web stays on global CSS + `font_*` classes (lesson 2026-07-13); nothing in this story changes web resolution. Tamagui compiler = `@tamagui/babel-plugin` in `apps/mobile/babel.config.js` (Metro + Jest) and `@tamagui/metro-plugin` in `apps/mobile/metro.config.js`, both configured with `config: "./tamagui.config.ts"`.
- **Files:** see File List and per-file decisions below.
- **Testing:** Jest 30 + `jest-expo` (`ios` project) and `jest-expo/android` (`android` project, `__tests__/android/**`), RNTL async `render`. Always `--no-cache` for compiler-dependent proofs. Web: Vitest in `@pekulo/ui` + CSS regeneration diff. Visual: Maestro goldens via `e2e-mobile.yml` (no local Android emulator — memory `pekulo-android-proof-only-on-ci`). React Grab is unavailable on React Native (same deferral as 10-2…10-7); the golden review in T8.3 is the visual verification.
- **Dependencies:** none new. Fonts already loaded by `apps/mobile/app/_layout.tsx` (`useFonts` with `Geist_400Regular … GeistMono_700Bold` from `@expo-google-fonts/geist`). CI iOS job re-bundles JS into the fingerprint-cached app with `expo export:embed --reset-cache` (`e2e-mobile.yml` "Re-bundle the JS into the cached app"), so the JS-only change reaches the goldens without a native rebuild.
- **Lessons applied:** 2026-05-24 (regenerate CSS + `git diff --exit-code`), 2026-07-13 (web font rides on `font_*` classes — untouched), 2026-06-01 (typecheck before commit), 2026-05-19 / 2026-05-05 (workspace filters, no `--cwd`), 2026-05-31 (doc sync in the same change), 10-6 decision (goldens valid only for the pinned runners).
- **Commit prefix:** `feat(#166): …` / `test(#166): …` / `docs(#166): …`.

### Root cause (measured at write time, 2026-11-26)

Two independent defects, both measured with a throw-away Jest probe (reverted) rendering `PekuloHero`, bare Tamagui `Text` nodes and `PekuloBreadcrumbLink` inside `PekuloRootProvider`:

1. **Runtime — no default `fontFamily` on native.** `@tamagui/web@2.3.1` swaps the family for the weight-matched face (and deletes `fontWeight`/`fontStyle`, exactly to protect Android) **only when the style already has a `fontFamily`** — `node_modules/.bun/@tamagui+web@2.3.1+*/node_modules/@tamagui/web/src/helpers/getSplitStyles.tsx` (the `process.env.TAMAGUI_TARGET === 'native'` block: `if (style?.fontFamily) { const faceInfo = getFont(...)?.face; ... delete style.fontWeight }`). `settings.defaultFont` (already `"body"` via `defaultConfig.settings`) never writes a `fontFamily` on native. Probe: `<Text fontWeight="600">` → `{ fontWeight: "600" }` (no family); `<Text fontFamily="$body" fontWeight="600">` → `{ fontFamily: "Geist_600SemiBold" }` (weight stripped).
2. **Build time — the Tamagui compiler bakes the WEB fonts into native bundles.** `apps/mobile/babel.config.js` runs `@tamagui/babel-plugin` (Metro builds **and** Jest) with `config: "./tamagui.config.ts"`. `@tamagui/static`'s sync loader (`dist/extractor/loadTamagui.cjs` → `loadTamaguiSync`) loads that config with a plain Node `require()` under `registerRequire`, which has **no `.native.ts` resolution**, so `packages/ui/src/config/tamagui.ts`'s `import { createPekuloFonts } from "./fonts"` resolves `fonts.ts` (web). Every DS `Text` the compiler flattens is emitted with `fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"` — not a registered native face, so iOS/Android fall back to the system font. Probe output (cold cache): PekuloHero texts → that web stack; the compiled `apps/mobile/.tamagui/tamagui.config.json` contained zero occurrences of `Geist_400Regular`. Setting `TAMAGUI_TARGET=native` does not change it.

**Probe-validated fix:** a compiler-only config that imports `./fonts.native` **explicitly** + a native-only `defaultProps.Text.fontFamily = "$body"`. Probe result: PekuloHero → `Geist_400Regular` / `Geist_600SemiBold` / `Geist_500Medium` with no `fontWeight`; bare `Text` → `Geist_400Regular`; `$mono` 500 → `GeistMono_500Medium`. Remaining gap in the probe: `PekuloBreadcrumbLink` → `{}` because `getDefaultProps` keys `config.defaultProps` by `componentName` (`PekuloBreadcrumbLinkText`, not `Text`) — fixed in T4.

**Jest cache trap:** Jest's transform cache key does not include the compiler config, so a warm cache keeps serving the old flattened output. Every mobile proof command in this story uses `--no-cache`. CI has no Jest cache (verified: `.github/workflows/pr.yml` only caches Playwright), so CI is always cold.

### Existing code at write time

`packages/ui/src/config/tamagui.ts` (after the header comment):
```ts
import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "@tamagui/core";

import { pekuloDark } from "../themes/pekulo-dark";
import { pekuloLight } from "../themes/pekulo-light";
import { pekuloRadius, pekuloSpacing } from "../tokens";
import { animations } from "./animations";
import { createPekuloFonts } from "./fonts";

export const config = createTamagui({
  ...defaultConfig,
  animations,
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
  themes: {
    "pekulo-dark": pekuloDark,
    "pekulo-light": pekuloLight,
  },
  defaultTheme: "pekulo-dark",
  tokens: {
    ...defaultConfig.tokens,
    space: pekuloSpacing as never,
    size: pekuloSpacing as never,
    radius: pekuloRadius as never,
  },
  fonts: createPekuloFonts() as never,
});

export type AppConfig = typeof config;
```
(`defaultConfig.defaultProps` is `undefined`; `defaultConfig.settings.defaultFont` is already `"body"` — measured.)

`packages/ui/src/config/fonts.native.ts` (face maps, unchanged by this story):
```ts
const geistFace = {
  400: { normal: "Geist_400Regular" },
  500: { normal: "Geist_500Medium" },
  600: { normal: "Geist_600SemiBold" },
  700: { normal: "Geist_700Bold" },
};
const geistMonoFace = {
  400: { normal: "GeistMono_400Regular" },
  500: { normal: "GeistMono_500Medium" },
  600: { normal: "GeistMono_600SemiBold" },
  700: { normal: "GeistMono_700Bold" },
};
```
`createPekuloFonts()` returns `{ ...defaultConfig.fonts, body: createFont({ family: "Geist_400Regular", …, face: geistFace }), heading: createFont({ family: "Geist_600SemiBold", …, face: geistFace }), mono: createFont({ family: "GeistMono_400Regular", …, face: geistMonoFace }) }`.

`packages/ui/src/config/fonts.ts` exports only `createPekuloFonts()` (web: `family: pekuloFonts.sans` / `pekuloFonts.mono`).

`apps/mobile/tamagui.config.ts`:
```ts
export { config as default } from "@pekulo/ui/tamagui-config";
```

`packages/ui/package.json` exports include `"./tamagui-config": "./src/config/tamagui.ts"`; `packages/ui/tsconfig.json` excludes `**/*.native.ts` / `**/*.native.tsx`.

`packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`:
```tsx
const BreadcrumbLinkText = styled(Text, {
  name: "PekuloBreadcrumbLinkText",
  role: "link",
  color: "$colorTertiary",
  fontSize: pekuloFontSizes.bodySm,
});
```

`packages/ui/src/primitives/PekuloInput.native.tsx` — `TextInput` style object contains `fontSize: pekuloFontSizes.bodySm,` followed by `borderWidth: invalid ? 1 : 0,` and no `fontFamily`; imports `{ pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens"`.
`packages/ui/src/primitives/PekuloTextarea.native.tsx` — same pair (`fontSize: pekuloFontSizes.bodySm,` / `borderWidth: invalid ? 1 : 0,`), no `fontFamily`.
`apps/mobile/components/search-field.tsx` — `TextInput` style already `{ flex: 1, height: 38, fontSize: 17, color: theme.color.val, fontFamily: "Geist_400Regular" }`.

`apps/mobile/__tests__/ds-token-parity.test.tsx` `collectTextRecords` pushes `fontWeight: normalizeFontWeight(merged.fontWeight)`; `helpers/parity-allowlist.ts` contains zero `fontWeight` entries.

### Per-file decisions

- `packages/ui/src/config/create-config.ts` (new) — **Responsibility:** the one `createTamagui()` body. **In:** `@tamagui/config/v5`, `@tamagui/core`, themes, tokens; `{ animations, fonts, defaultProps? }`. **Out:** `createPekuloConfig()`, `PekuloConfigInput`.
- `packages/ui/src/config/tamagui.ts` — **Responsibility:** the platform-resolved runtime config + module augmentation. **In:** `./animations`, `./fonts` (platform-resolved), factory. **Out:** `config`, `AppConfig`.
- `packages/ui/src/config/tamagui.compiler.native.ts` (new) — **Responsibility:** compile-time config for the mobile Tamagui compiler. **In:** `./animations`, `./fonts.native` (explicit), factory. **Out:** `config` (via `@pekulo/ui/tamagui-compiler-config`).
- `packages/ui/src/config/fonts.ts` — **Responsibility:** web font config. **Out:** `createPekuloFonts`, `pekuloFontDefaultProps = undefined`.
- `packages/ui/src/config/fonts.native.ts` — **Responsibility:** native font config. **Out:** `createPekuloFonts`, `pekuloFontDefaultProps`, `PEKULO_NATIVE_BODY_FACE`, `PEKULO_NATIVE_FACE_WEIGHT`.
- `packages/ui/package.json` — **Responsibility:** public entrypoints. **Out:** adds `./tamagui-compiler-config`.
- `apps/mobile/tamagui.config.ts` — **Responsibility:** compiler entry for babel/metro plugins. **Out:** default export = native compiler config.
- `apps/mobile/jest.config.js` — **Responsibility:** Jest resolution. **Out:** maps `@pekulo/ui/tamagui-compiler-config`.
- `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx` / `PekuloInput.native.tsx` / `PekuloTextarea.native.tsx` — **Responsibility:** unchanged component behaviour; only the text face is set. **In:** `PEKULO_NATIVE_BODY_FACE` (inputs).
- `apps/mobile/__tests__/helpers/native-fonts.tsx` (new) — **Responsibility:** render every resolution path and assert faces. **Out:** `describeNativeFonts()`, `renderNativeFontCases()`, `EXPECTED_FACE_BY_TEST_ID`, `GEIST_FACES`.
- `apps/mobile/__tests__/native-fonts.test.tsx` / `__tests__/android/native-fonts.test.tsx` (new) — **Responsibility:** run the shared assertions per Jest project.
- `apps/mobile/__tests__/native-font-config.test.ts` (new) — **Responsibility:** guard compiler-config wiring and runtime/compiler equality.
- `apps/mobile/__tests__/ds-token-parity.test.tsx` — **Responsibility:** web ↔ native parity; now reads weight from the face.
- `apps/mobile/.maestro/goldens/{ios,android}/*.png` — **Responsibility:** recaptured visual baselines (42 per platform).
- `docs/epics.md`, `docs/state.yaml`, `docs/epics-context/epic-10-context.md` — doc sync.

### Out of scope

- App-local (`apps/mobile/app/**`, `components/**`) text that already goes through DS components or Tamagui `Text` is covered by the global default; no per-screen audit beyond `SearchField`.
- Italic faces: no `fontStyle` usage exists in `packages/ui/src` (measured), so no italic Geist face is added.
- Changing the compiler's animation driver resolution.

## File List

- `packages/ui/src/config/create-config.ts` (new)
- `packages/ui/src/config/tamagui.compiler.native.ts` (new)
- `packages/ui/src/config/tamagui.ts`
- `packages/ui/src/config/fonts.ts`
- `packages/ui/src/config/fonts.native.ts`
- `packages/ui/package.json`
- `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`
- `packages/ui/src/primitives/PekuloInput.native.tsx`
- `packages/ui/src/primitives/PekuloTextarea.native.tsx`
- `apps/mobile/tamagui.config.ts`
- `apps/mobile/jest.config.js`
- `apps/mobile/__tests__/helpers/native-fonts.tsx` (new)
- `apps/mobile/__tests__/native-fonts.test.tsx` (new)
- `apps/mobile/__tests__/android/native-fonts.test.tsx` (new)
- `apps/mobile/__tests__/native-font-config.test.ts` (new)
- `apps/mobile/__tests__/ds-token-parity.test.tsx`
- `apps/mobile/.maestro/goldens/ios/*.png`
- `apps/mobile/.maestro/goldens/android/*.png`
- `docs/epics.md`
- `docs/state.yaml`
- `docs/epics-context/epic-10-context.md`
- `docs/stories/10-8-native-geist-font.md`

## Dev Agent Record

- **Model:** Claude Opus 5.5 (claude-opus-5-5)
- **Started:** 2026-11-26T09:30:00Z
- **Completed:** 2026-11-26T10:45:00Z

### Summary

Every `@pekulo/ui` text now resolves to a weight-matched Geist face on iOS and Android, in both the runtime path and the compiler-flattened path. A shared `createPekuloConfig()` feeds both the runtime config and a native compiler config that imports `fonts.native` explicitly. Native `Text` defaults to `$body`, and the inputs and the breadcrumb link set the face directly. Web output is byte-identical. All 42 golden cases were recaptured on each platform, and the user reviewed and approved them.

### Files changed

- `packages/ui/src/config/create-config.ts` (new)
- `packages/ui/src/config/tamagui.compiler.native.ts` (new)
- `packages/ui/src/config/tamagui.ts`
- `packages/ui/src/config/fonts.ts`
- `packages/ui/src/config/fonts.native.ts`
- `packages/ui/package.json`
- `packages/ui/src/primitives/PekuloBreadcrumb.native.tsx`
- `packages/ui/src/primitives/PekuloInput.native.tsx`
- `packages/ui/src/primitives/PekuloTextarea.native.tsx`
- `apps/mobile/tamagui.config.ts`
- `apps/mobile/jest.config.js`
- `apps/mobile/__tests__/helpers/native-fonts.tsx` (new)
- `apps/mobile/__tests__/native-fonts.test.tsx` (new)
- `apps/mobile/__tests__/android/native-fonts.test.tsx` (new)
- `apps/mobile/__tests__/native-font-config.test.ts` (new)
- `apps/mobile/__tests__/ds-token-parity.test.tsx`
- `apps/mobile/.maestro/goldens/ios/*.png` (36 changed; 6 byte-identical: no text in them)
- `apps/mobile/.maestro/goldens/android/*.png` (36 changed; 6 byte-identical: no text in them)
- `docs/epics.md`, `docs/state.yaml`, `docs/epics-context/epic-10-context.md`, `docs/stories/10-8-native-geist-font.md`

### Deviations

- `native-fonts` helper: on Android, `expo-symbols` renders `SearchField`'s magnifier as a `<Text>` in the `MaterialSymbols_400Regular` icon font. The helper excludes icon-font glyphs (an explicit `ICON_FONT_PREFIXES` list) from the "every text node is Geist" assertion, because they are icons, not text.
- `native-font-config.test.ts` uses the typed `require("node:fs")` pattern of the other script suites (`native-surface-guards.test.ts`), because `apps/mobile` has no `@types/node`. Commit `e8090c7` went in with a failing typecheck: the commands had been chained with `;`, so the commit ran anyway. The fix-up commit `8a776ce` corrects it.
- The guard test was written after the T3 code. Its RED was witnessed by temporarily restoring the old `apps/mobile/tamagui.config.ts`, which failed at `native-font-config.test.ts:20`.
- The first cold-cache full mobile run timed out in 3 unrelated suites (`navigation-tabs`, `sheets-transactions-cap`, `sheets-monthly-portfolio-realestate`). Re-run warm, all 34 suites pass.
- The e2e-mobile job "Android — smoke / navigation / preview-guard / action sheet" fails on this PR. It also fails on `main` (post-merge run 45786645967 at `1dbabd1`, before this story): all 4 flows fail with `"Patrimoine total" is visible`. This failure predates the story and is out of scope. The Android and iOS gallery shards and the iOS core flows pass.
- React Grab is unavailable on React Native, so the visual verification was the user's review of before/after golden sheets on both platforms.

### Test output

- `cd apps/mobile && bunx jest --no-cache --selectProjects ios android --testPathPatterns "native-fonts|native-font-config"`: `Test Suites: 3 passed, 3 total` / `Tests: 29 passed, 29 total`.
- `cd apps/mobile && bunx jest --no-cache --selectProjects ios --testPathPatterns ds-token-parity`: `Tests: 59 passed, 59 total`, with no allow-list change.
- `cd apps/mobile && bunx jest` (full, warm): `Test Suites: 34 passed, 34 total` / `Tests: 282 passed, 282 total`, exit 0.
- `bun --filter='@pekulo/ui' run test`: `Test Files 162 passed (162)` / `Tests 352 passed | 1 skipped (353)`.
- `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css`: exit 0.
- `bun run typecheck`: `Tasks: 10 successful, 10 total`. `bun run lint`: 0 errors (3 warnings, all in unrelated web files that predate the story). `bun run format:check`: all files formatted.
- e2e-mobile run 45794481785 (`maestro:update-goldens`): all 8 gallery shards succeeded and the 72 changed goldens were recaptured.

## Review Record

**Date:** 2026-11-26
**Auditors:** Spec, Code, Edge & Hallucination (Aria not dispatched: React Grab is unavailable on React Native; visual verification = user review of recaptured goldens)
**Verdict:** done

- **Override:** AC gap accepted — reason: "User chose to fix every finding inside the review instead of returning the story to dev (`fix tout ici`)." All Spec findings were then fixed and re-verified, so no AC gap remains.

### Findings

#### Resolved
- [MAJOR] `PekuloPagination.native.tsx` passed a ternary `fontWeight` to Tamagui `Text`. The compiler emits it as a separate style entry WITHOUT the native face swap, so page numbers carried `Geist_400Regular` + `fontWeight` (active page never semibold; Android trap). [packages/ui/src/components/PekuloPagination/PekuloPagination.native.tsx]
  - Source: Edge & Hallucination (confirmed by Lead probe on the android Jest project)
  - Resolution: `e7adbfb` — named `styled(Text)` `PageNumberText` with an `active` variant; case added to `renderNativeFontCases()`. Goldens recaptured in `be74f66` (only `PekuloPagination.mid` changed, both platforms; user-approved).
- [MAJOR] AC-3 guard did not exercise the compiler path: two source-regex tests, and an in-process comparison that Jest's `.native` resolver made equal by construction. [apps/mobile/__tests__/native-font-config.test.ts]
  - Source: Spec, Code
  - Resolution: `70000f0` — `__tests__/helpers/load-compiler-config.cjs` loads `tamagui.config.ts` in a child Node process through `@tamagui/static`'s `registerRequire` (as `loadTamaguiSync` does). RED witnessed by pointing the config back at `@pekulo/ui/tamagui-config` (web stack + empty defaultProps, 3 failures). `a20009d` extends the agreement check to tokens and themes; `248a9ad` marker-prefixes the helper output.
- [MINOR] Jest transform cache key ignored the compiler config, so a warm cache stayed green after a config regression. [apps/mobile/jest.config.js]
  - Source: Code
  - Resolution: `3486653` — `apps/mobile/jest/tamagui-babel-transformer.js` wraps babel-jest and appends a hash of `tamagui.config.ts` + `packages/ui/src/{config,tokens,themes}`. Witnessed: warm cache + broken compiler config → 2 failures; restore → green. `--no-cache` no longer required.
- [MINOR] AC-1 `$mono` proven at 700 only. [apps/mobile/__tests__/helpers/native-fonts.tsx]
  - Source: Spec
  - Resolution: `e7adbfb` — `t-mono`, `t-mono-500`, `t-mono-600` added.
- [NIT] `PEKULO_NATIVE_FACE_WEIGHT` exported from production only for the parity test. [packages/ui/src/config/fonts.native.ts]
  - Source: Code
  - Resolution: `e7adbfb` removes the export; the parity test derives `NATIVE_FACE_WEIGHT` from `createPekuloFonts()`. Re-verification found the derivation reported `Geist_700Bold` as `"900"` (createFont back-fills 800/900); fixed in `248a9ad` (weight read from the face name) with a pinning assertion. The task text above (T2.4/T5.2) still describes the original export — superseded by this record.
- [NIT] Keyword weights `normal` / `bold` had no face, so they kept the family + weight pair. [packages/ui/src/config/fonts.native.ts]
  - Source: Edge & Hallucination
  - Resolution: `e7adbfb` — `normal`/`bold` aliases added to `geistFace` and `geistMonoFace`; `t-normal`/`t-bold` cases added.
- [NIT] Compiler config keeps the CSS animation driver, unguarded. [packages/ui/src/config/tamagui.compiler.native.ts]
  - Source: Code
  - Resolution: driver kept (it plays no part in flattening; switching it would touch every release bundle). `a20009d` guards what flattening does read — fonts, defaultProps, tokens, themes.

#### Dismissed
- [NIT] Golden asymmetry: `CategoryPicker.closed` changed on Android only, `PekuloSkeleton.lines` on iOS only.
  - Source: Lead
  - Rationale: measured as capture noise, not typography — Android: 57 px, max delta 11, 2-px band at (122,42); iOS: max delta 4 (shimmer phase).
- [NIT] RED summary of T1.4/T5.1 not pasted in the Dev Agent Record.
  - Source: Spec
  - Rationale: the RED commit `8bfc2d1` is in history; review fixes witnessed their own REDs (above).
- [LOW] git-audit "files listed but not changed" / "changed but not listed".
  - Source: git-audit.sh
  - Rationale: false positive — the File List uses `goldens/{ios,android}/*.png` globs the script does not expand.
- [LOW] `ICON_FONT_PREFIXES` exclusion could hide real text.
  - Source: Spec
  - Rationale: Edge auditor verified the `MaterialSymbols` prefix is tight; no text uses that family.

### Verification
- Test command: `cd apps/mobile && bunx jest` (full) → `Test Suites: 34 passed, 34 total` / `Tests: 295 passed, 295 total`; targeted `--testPathPatterns "native-fonts|native-font-config|ds-token-parity"` (ios + android) after the last fix → `Tests: 102 passed, 102 total`.
- `bun --filter='@pekulo/ui' run test` → `Test Files 162 passed (162)` / `Tests 352 passed | 1 skipped (353)`.
- `bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css` → exit 0.
- `bun run typecheck` → `Tasks: 10 successful`; `bun run lint` → 0 errors; `bun run format:check` → all formatted.
- CI on `be74f66`: PR workflow green (`test-unit`, `typecheck`, `lint`, `tamagui-css-fresh`, …); e2e-mobile run 45819850439 green on all 8 DS gallery shards and iOS core flows. "Android — smoke / navigation / preview-guard / action sheet" fails as on `main` before this story (fixed separately in PR #169).
- Visual verification: React Grab unavailable on React Native; user reviewed and approved the before/after `PekuloPagination.mid` goldens (iOS + Android) on 2026-11-26.

### Ticket sync
- Ticket comment posted: https://github.com/yabafre/pekulo/issues/166#issuecomment-7192503305
- PR updated: https://github.com/yabafre/pekulo/pull/167
