# Story: 10-2-mobile-app-bootstrap — Bootstrap `apps/mobile` (Expo SDK 58 Dev Build + React 19.3 + `expo-router` + `@pekulo/ui` native + Maestro smoke)

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** #47
**Branch:** feature/47-10-2-mobile-app-bootstrap
**Complexity:** M _(rescoped via Option A split — user-approved at Step 04 on 2026-11-16)_
**Covered FRs:** FR-56 (mobile substrate, Tamagui native compiler/provider & pilot components; full 41-file DS port and pixel-diff parity split to `10-3` / `10-5`)

> **Scope decision (2026-11-16, Step 04 Option A, user-approved):**
>
> 1. **Why split (`docs/lessons.md` 2026-06-05):** An upfront codebase audit found **41 source files** in `packages/ui/src/` coupled to web-only APIs (`@tamagui/animations-css`, `@tamagui/next-theme` / `next/script`, `lucide-react`, CSS custom properties `var(--...)`, inline `<style href>` blocks, HTML `<svg>`, `render="..."`, `vaul`, `react-day-picker`, `react-resizable-panels`). Meanwhile `eas` and `maestro` CLIs are not yet installed locally, `.github/workflows/pr.yml` runs on `ubuntu-latest` only, and the V1.5 `aped-arch` re-run (G1) had not run yet. Per lesson 2026-06-05, absorbing four new subsystems (`apps/mobile` bootstrap + 41-file DS rewrite + Supabase/oRPC mobile wiring + CI iOS/Android emulators) into one story would produce an unreviewable XL drop.
> 2. **What `10-2` delivers:**
>    - **`@pekulo/ui` dual web/native foundation** without breaking `apps/web`, `tamagui-css-fresh`, or `ds-coverage.meta.test.ts`: platform-split `animations.{ts,native.ts}` (`@tamagui/config/v5-reanimated` on native, `@tamagui/config/v5-css` on web), `fonts.{ts,native.ts}` (Geist + Geist Mono pixel metrics via `createFont`), `provider/index.native.tsx`, and `index.native.ts` via the `"react-native"` export condition in `packages/ui/package.json`.
>    - **Cross-platform Tamagui optimization in one config:** `apps/mobile` (`@pekulo/mobile`, Expo SDK 58 paired with monorepo alignment to `react@19.3.0` + `next@16.4.6`, **`expo-dev-client`** Dev Build, `expo-router` SDK 58 with stable `expo-router/native-tabs` + `Stack`, Geist fonts, `@tamagui/babel-plugin` + `@tamagui/metro-plugin` compiling both `tamagui` and `@pekulo/ui`).
>    - **Two live cross-platform pilot components from `@pekulo/ui`:** `PekuloHero` and `PekuloStat` rendered inside `apps/mobile` with zero duplication.
>    - **Automated Jest suite + Maestro smoke flow** (`.maestro/smoke.yaml` + local Dev Build / iOS simulator runbook).
> 3. **What is split to sibling V1.5 stories (documented in `docs/epics.md`):**
>    - `10-3-ui-native-parity`: port the remaining `@pekulo/ui` components/primitives to native (`lucide-react-native`, `react-native-svg` for `PekuloDonut`/charts, native sheets/pickers) and extend `index.native.ts`.
>    - `10-4-mobile-auth-and-orpc`: Supabase Auth (`expo-secure-store`) + `@pekulo/contracts` oRPC client + live domain screens.
>    - `10-5-mobile-parity-and-maestro`: automated iOS/Android pixel-diff parity assertions against web snapshots (FR-56) + full Maestro CI workflow.

**Out of scope — deliberate, do not absorb:**

- **No changes to existing web snapshots or `packages/ui/public/tamagui.generated.css`.** `bun run generate:tamagui-css` must leave `packages/ui/public/tamagui.generated.css` byte-identical, and `bun --filter='@pekulo/ui' run test` must pass without touching any web snapshot.
- **No porting of `lucide-react`, `<svg>`, `vaul`, `react-day-picker`, or `react-resizable-panels` components.** Those 41 web-coupled files stay untouched for `10-3`.
- **No Supabase Auth, SecureStore, or oRPC API calls in `apps/mobile`.** Screens use static placeholder figures while proving navigation and `@pekulo/ui` native rendering (`10-4` wires live data).
- **No iOS/Android emulator job in `.github/workflows/pr.yml`.** CI runs Jest (`bun --filter='@pekulo/mobile' run test`), `typecheck`, `lint`, and `format-check` on Ubuntu; Maestro runs locally against the iOS Dev Build simulator.

## User Story

**As a** Pekulo user and developer, **I want** a runnable, typechecked, and tested `apps/mobile` Expo Dev Build application (`expo-router` + `NativeTabs` + Tamagui optimizing compiler) wired directly to `@pekulo/ui`'s native entrypoint, themes, tokens, and pilot components, **so that** Pekulo shares one Tamagui design system across web and mobile and has a clean, verified substrate for V1.5 feature stories.

## Acceptance Criteria

- **AC-1 (Monorepo install, quality gates & zero web regression)** — **Given** the mobile workspace and the cross-platform design-system additions, **When** workspace installation, typechecking, linting, formatting, design-system tests, and Tamagui CSS regeneration checks run, **Then** every check exits 0 with zero regressions and zero drift on the pre-generated web stylesheet.
- **AC-2 (Cross-platform design-system & theme parity)** — **Given** the shared design-system configuration and native theme provider, **When** the mobile application compiles with the Tamagui optimizing compiler and mounts its root screen, **Then** both dark and light Pekulo themes apply cleanly and the shared hero and stat components render without web-only runtime errors.
- **AC-3 (Primary navigation & 1-tap settings access)** — **Given** the mobile navigation shell, **When** the application launches at the root route, **Then** the Cap tab renders as the initial screen, all five primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`, `Immobilier`) are navigable, and `Paramètres` opens in one tap from the Cap header.
- **AC-4 (Automated mobile test suite)** — **Given** the mobile unit and navigation test suites, **When** the monorepo test suite runs, **Then** all mobile component-rendering and route-navigation assertions pass cleanly without requiring a native simulator.
- **AC-5 (Dev Build & Maestro smoke readiness)** — **Given** the Expo Dev Client configuration, Maestro smoke flow, and local runbook, **When** a developer prepares a local iOS Dev Build and executes the smoke flow, **Then** the application launches under its configured bundle identifier, verifies Cap rendering, traverses all five tabs, and opens `Paramètres`.

## Tasks

Task order is load-bearing: **monorepo React 19.3 / Next 16.4 alignment (T0), ignores (T1), and `@pekulo/ui` native entrypoint (T2–T3) first**, so `@pekulo/mobile` (T4–T10) resolves against a single `react@19.3.0` graph on `bun install` and `tsc --noEmit`. Follow every command literally.

- [x] **T0 — Align monorepo on `react@19.3.0`, `react-dom@19.3.0`, and `next@16.4.6` (for Expo SDK 58 compatibility)** [AC: AC-1]

  In `apps/web/package.json`, update `"next"`, `"react"`, and `"react-dom"` under `"dependencies"`:

  ```json
      "next": "16.4.6",
      "next-intl": "4.13.0",
      "nuqs": "2.8.9",
      "react": "19.3.0",
      "react-dom": "19.3.0",
  ```

  In `packages/ui/package.json`, update `"react"` and `"react-dom"` in both `"devDependencies"` and `"peerDependencies"`:

  ```json
      "react": "19.3.0",
      "react-dom": "19.3.0",
      "typescript": "^6.0.3",
      "vitest": "^3.2.6",
      "vitest-axe": "^0.1.0"
    },
    "peerDependencies": {
      "react": "19.3.0",
      "react-dom": "19.3.0"
    }
  ```

  In `.oxlintrc.json`, update `"settings.react.version"` in lockstep with `apps/web/package.json` (Lesson 2026-05-04):

  ```json
      "react": {
        "version": "19.3.0"
      }
  ```

  Run (including `apps/web` unit + request-context isolation verification per Lesson 2026-05-04 on Next minor bump):

  ```bash
  bun install && bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test && bun --filter='@pekulo/ui' run test
  ```

  Expected: `bun install` resolves `react@19.3.0` + `next@16.4.6` across workspaces with zero peer conflicts; `@pekulo/web` typecheck + Vitest (including `request-context` isolation) and `@pekulo/ui` Vitest exit 0.
  Commit: `git add apps/web/package.json packages/ui/package.json .oxlintrc.json bun.lock && git commit -m "chore(#47): bump react to 19.3.0 and next to 16.4.6 for Expo SDK 58"`

- [x] **T1 — Add Expo CNG ignores to `.gitignore`, `.oxlintrc.json`, and `.oxfmtrc.json`** [AC: AC-1]

  Edit `.gitignore` to append the Expo mobile build/native artefact ignores at the bottom of the file:

  ```gitignore

  # Expo mobile CNG / Dev Build artefacts (apps/mobile)
  apps/mobile/.expo/
  apps/mobile/ios/
  apps/mobile/android/
  apps/mobile/*.jks
  apps/mobile/*.p8
  apps/mobile/*.p12
  apps/mobile/*.key
  apps/mobile/*.mobileprovision
  apps/mobile/*.orig.*
  ```

  Edit `.oxlintrc.json` to add `"apps/mobile/.expo/"`, `"apps/mobile/ios/"`, and `"apps/mobile/android/"` to `ignorePatterns` (keep all existing entries verbatim):

  ```json
    "ignorePatterns": [
      "node_modules/",
      ".next/",
      ".turbo/",
      "build/",
      "dist/",
      "out/",
      "coverage/",
      "apps/prices/",
      "apps/mobile/.expo/",
      "apps/mobile/ios/",
      "apps/mobile/android/",
      "docs/ux-preview/",
      ".aped/",
      ".agents/",
      "docs/sync-logs/",
      "packages/oxlint-config/tests/integration/fixtures/"
    ],
  ```

  Edit `.oxfmtrc.json` to add `"apps/mobile/.expo/"`, `"apps/mobile/ios/"`, `"apps/mobile/android/"`, and `"apps/mobile/expo-env.d.ts"` to `ignorePatterns`:

  ```json
    "ignorePatterns": [
      "node_modules/",
      ".next/",
      ".turbo/",
      "build/",
      "dist/",
      "out/",
      "coverage/",
      "apps/prices/",
      "apps/mobile/.expo/",
      "apps/mobile/ios/",
      "apps/mobile/android/",
      "apps/mobile/expo-env.d.ts",
      "docs/ux-preview/dist/",
      "bun.lock",
      "*.lock",
      "apps/web/supabase-schema.sql",
      ".aped/",
      ".agents/",
      "docs/state.yaml",
      "docs/state-corrections.yaml",
      "docs/sync-logs/",
      "docs/stories/"
    ]
  ```

  Run: `bun run lint && bun run format:check`
  Expected: `oxlint` exits 0 (`Found 4 warnings and 0 errors.` or fewer) and `oxfmt --check` exits 0 (`All matched files use the correct format.`).
  Commit: `git add .gitignore .oxlintrc.json .oxfmtrc.json && git commit -m "chore(#47): add Expo CNG ignores for apps/mobile"`

- [x] **T2 — Split `@pekulo/ui` animations and fonts into web + `.native` platform modules** [AC: AC-1, AC-2]

  Create `packages/ui/src/config/animations.ts`:

  ```ts
  // packages/ui/src/config/animations.ts
  // Web animation driver (CSS transitions, RSC-safe, honours prefers-reduced-motion).
  // Metro resolves `animations.native.ts` for React Native.
  export { animations } from "@tamagui/config/v5-css";
  ```

  Create `packages/ui/src/config/animations.native.ts`:

  ```ts
  // packages/ui/src/config/animations.native.ts
  // Native animation driver (Reanimated v4, resolved automatically by Metro).
  export { animations } from "@tamagui/config/v5-reanimated";
  ```

  Create `packages/ui/src/config/fonts.ts`:

  ```ts
  // packages/ui/src/config/fonts.ts
  // Web font configuration for Tamagui — preserves exact V1 web theme/snapshot shape.
  import { defaultConfig } from "@tamagui/config/v5";

  import {
    pekuloFonts,
    pekuloFontSizes,
    pekuloFontWeights,
    pekuloLineHeights,
  } from "../tokens";

  export function createPekuloFonts() {
    return {
      ...defaultConfig.fonts,
      body: {
        family: pekuloFonts.sans,
        size: pekuloFontSizes as never,
        weight: pekuloFontWeights as never,
        lineHeight: pekuloLineHeights as never,
      },
      heading: {
        family: pekuloFonts.sans,
        size: pekuloFontSizes as never,
        weight: pekuloFontWeights as never,
        lineHeight: pekuloLineHeights as never,
      },
      mono: {
        family: pekuloFonts.mono,
        size: pekuloFontSizes as never,
        weight: pekuloFontWeights as never,
        lineHeight: pekuloLineHeights as never,
      },
    };
  }
  ```

  Create `packages/ui/src/config/fonts.native.ts`:

  ```ts
  // packages/ui/src/config/fonts.native.ts
  // React Native font configuration for Tamagui — uses pixel lineHeights and
  // explicit weight→fontFace mappings loaded via @expo-google-fonts/geist.
  import { defaultConfig } from "@tamagui/config/v5";
  import { createFont } from "@tamagui/core";

  import { pekuloFontSizes, pekuloFontWeights, pekuloLetterSpacings } from "../tokens";

  function computeNativeLineHeights(ratio: number): Record<keyof typeof pekuloFontSizes, number> {
    return Object.fromEntries(
      Object.entries(pekuloFontSizes).map(([key, px]) => [key, Math.round(px * ratio)]),
    ) as Record<keyof typeof pekuloFontSizes, number>;
  }

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
  };

  export function createPekuloFonts() {
    return {
      ...defaultConfig.fonts,
      body: createFont({
        family: "Geist_400Regular",
        size: pekuloFontSizes,
        lineHeight: computeNativeLineHeights(1.4),
        weight: pekuloFontWeights,
        letterSpacing: pekuloLetterSpacings,
        face: geistFace,
      }),
      heading: createFont({
        family: "Geist_600SemiBold",
        size: pekuloFontSizes,
        lineHeight: computeNativeLineHeights(1.25),
        weight: pekuloFontWeights,
        letterSpacing: pekuloLetterSpacings,
        face: geistFace,
      }),
      mono: createFont({
        family: "GeistMono_400Regular",
        size: pekuloFontSizes,
        lineHeight: computeNativeLineHeights(1.4),
        weight: pekuloFontWeights,
        letterSpacing: pekuloLetterSpacings,
        face: geistMonoFace,
      }),
    };
  }
  ```

  Replace `packages/ui/src/config/tamagui.ts` with:

  ```ts
  // packages/ui/src/config/tamagui.ts
  // createTamagui() invocation shared by apps/web and apps/mobile.
  // Platform-specific modules (`./animations`, `./fonts`) resolve to
  // `*.native.ts` under Metro (Reanimated + Geist native faces) and to the
  // CSS/web variants on Next.js / Vitest / `@tamagui/cli`.
  //
  // Both `pekulo-dark` and `pekulo-light` are registered (story 8-2, AC-2).
  // @tamagui/cli rc.42 STILL collides two custom themes onto one `.tm_*` class
  // (the rc.41 bug persists), so the generated theme blocks are re-keyed to
  // `[data-theme="pekulo-dark"]` / `[data-theme="pekulo-light"]` by
  // scripts/fix-tamagui-css.mjs — the attribute NextThemeProvider + the layout
  // anti-FOUC script both write. See that script's header for the full rationale.
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
    // Token overrides — Pekulo spacing/radius/font scales replace defaultConfig's.
    tokens: {
      ...defaultConfig.tokens,
      space: pekuloSpacing as never,
      size: pekuloSpacing as never,
      radius: pekuloRadius as never,
    },
    fonts: createPekuloFonts() as never,
  });

  export type AppConfig = typeof config;

  declare module "@tamagui/web" {
    // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
    interface TamaguiCustomConfig extends AppConfig {}
  }
  ```

  Update `packages/ui/tsconfig.json` to exclude `*.native.*` from the web/node package check (the mobile app typechecks the `.native` graph with `"customConditions": ["react-native"]`):

  ```json
  {
    "$schema": "https://json.schemastore.org/tsconfig",
    "extends": "@pekulo/tsconfig/packages.json",
    "compilerOptions": {
      "rootDir": "src",
      "lib": ["dom", "dom.iterable", "esnext"],
      "jsx": "react-jsx",
      "noEmit": true
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx", "**/*.native.ts", "**/*.native.tsx"]
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test && bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css`
  Expected: `typecheck` exits 0, all `@pekulo/ui` Vitest suites pass (`158 passed`), and `tamagui.generated.css` has zero diff.
  Commit: `git add packages/ui/src/config/animations.ts packages/ui/src/config/animations.native.ts packages/ui/src/config/fonts.ts packages/ui/src/config/fonts.native.ts packages/ui/src/config/tamagui.ts packages/ui/tsconfig.json && git commit -m "feat(#47): platform-split Tamagui animations and fonts for native"`

- [x] **T3 — Add native `PekuloRootProvider` and `@pekulo/ui` `"react-native"` export barrel** [AC: AC-1, AC-2]

  Create `packages/ui/src/provider/index.native.tsx`:

  ```tsx
  // packages/ui/src/provider/index.native.tsx
  // Native root provider for @pekulo/ui consumers (apps/mobile).
  // Mounts TamaguiProvider with Pekulo themes (`pekulo-dark` / `pekulo-light`)
  // driven by OS color scheme or an explicit theme override.
  // Excludes @tamagui/next-theme (next/script) and web-only CSS injection flags.

  import type { ReactNode } from "react";
  import { useColorScheme } from "react-native";
  import { TamaguiProvider } from "tamagui";

  import { config } from "../config/tamagui";

  export interface PekuloRootProviderProps {
    children: ReactNode;
    /** Optional explicit theme override; defaults to OS color scheme ("pekulo-dark" fallback). */
    theme?: "pekulo-dark" | "pekulo-light" | "system";
  }

  export function PekuloRootProvider({
    children,
    theme = "system",
  }: PekuloRootProviderProps) {
    const colorScheme = useColorScheme();
    const resolvedTheme =
      theme === "system"
        ? colorScheme === "light"
          ? "pekulo-light"
          : "pekulo-dark"
        : theme;

    return (
      <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
        {children}
      </TamaguiProvider>
    );
  }
  ```

  Create `packages/ui/src/index.native.ts`:

  ```ts
  // packages/ui/src/index.native.ts
  // React Native public barrel for @pekulo/ui (resolved via package.json
  // "react-native" export condition by Metro and apps/mobile tsconfig).
  //
  // Exposes only native-safe modules and ported pilot components so Metro never
  // pulls web-only DOM dependencies (lucide-react, vaul, react-day-picker,
  // react-resizable-panels, @tamagui/next-theme) before story 10-3 completes
  // the full 41-file native parity pass.

  export { PekuloRootProvider, type PekuloRootProviderProps } from "./provider/index.native";

  // Pure design tokens and theme maps
  export * from "./tokens";
  export * from "./themes";

  // Native-safe animation hook (guards window.matchMedia)
  export { useCountUp, type UseCountUpOptions } from "./animations/use-count-up";

  // Cross-platform pilot components (pure Tamagui Text + View)
  export { PekuloStat, type PekuloStatProps } from "./components/PekuloStat";
  export { PekuloHero, type PekuloHeroProps } from "./components/PekuloHero";
  ```

  Update `packages/ui/package.json` `exports["."]` to expose the `"react-native"` condition without altering web resolution (`types` / `default` remain `./src/index.ts`):

  ```json
    "exports": {
      ".": {
        "react-native": {
          "types": "./src/index.native.ts",
          "default": "./src/index.native.ts"
        },
        "types": "./src/index.ts",
        "default": "./src/index.ts"
      },
      "./client": "./src/client.ts",
      "./tamagui-config": "./src/config/tamagui.ts",
      "./reset.css": "./public/reset.css",
      "./generated.css": "./public/tamagui.generated.css"
    },
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:visual && bun --filter='@pekulo/ui' run test:axe && bun --filter='@pekulo/ui' run test`
  Expected: `typecheck` exits 0; `ds-coverage.meta.test.ts` passes (`PekuloRootProvider` is already exempt; `index.ts` barrel unchanged); `test` passes with zero errors.
  Commit: `git add packages/ui/package.json packages/ui/src/provider/index.native.tsx packages/ui/src/index.native.ts && git commit -m "feat(#47): add native PekuloRootProvider and react-native barrel in @pekulo/ui"`

- [x] **T4 — Scaffold `apps/mobile` workspace manifest, TypeScript config, Expo Dev Build config, and EAS profiles** [AC: AC-1, AC-2, AC-5]

  Create `apps/mobile/package.json`:

  ```json
  {
    "name": "@pekulo/mobile",
    "version": "0.1.0",
    "private": true,
    "main": "expo-router/entry",
    "scripts": {
      "dev": "expo start --dev-client",
      "ios": "expo run:ios",
      "android": "expo run:android",
      "prebuild": "expo prebuild",
      "typecheck": "tsc --noEmit",
      "lint": "bunx oxlint app components __tests__",
      "test": "jest"
    },
    "dependencies": {
      "@expo-google-fonts/geist": "^0.4.2",
      "@expo-google-fonts/geist-mono": "^0.4.3",
      "@pekulo/types": "workspace:*",
      "@pekulo/ui": "workspace:*",
      "@react-navigation/native": "^7.1.6",
      "expo": "~58.0.25",
      "expo-constants": "~58.0.16",
      "expo-dev-client": "~58.0.20",
      "expo-font": "~58.0.12",
      "expo-linking": "~58.0.17",
      "expo-router": "~58.0.31",
      "expo-splash-screen": "~58.0.14",
      "expo-status-bar": "~58.0.5",
      "expo-symbols": "~58.0.5",
      "expo-system-ui": "~58.0.7",
      "react": "19.3.0",
      "react-native": "0.88.1",
      "react-native-gesture-handler": "~3.3.0",
      "react-native-reanimated": "4.7.1",
      "react-native-safe-area-context": "~5.11.1",
      "react-native-screens": "~4.30.1",
      "react-native-worklets": "0.13.0",
      "tamagui": "2.3.1"
    },
    "devDependencies": {
      "@babel/core": "^7.29.7",
      "@pekulo/tsconfig": "workspace:*",
      "@tamagui/babel-plugin": "2.3.1",
      "@tamagui/metro-plugin": "2.3.1",
      "@testing-library/react-native": "^14.1.0",
      "@types/jest": "30.0.0",
      "@types/react": "~19.3.0",
      "babel-plugin-transform-inline-environment-variables": "^0.4.4",
      "jest": "~30.5.2",
      "jest-expo": "~58.0.14",
      "react-test-renderer": "19.3.0",
      "test-renderer": "^1.3.1",
      "typescript": "^6.0.3"
    }
  }
  ```

  Create `apps/mobile/tsconfig.json`:

  ```json
  {
    "$schema": "https://json.schemastore.org/tsconfig",
    "extends": "@pekulo/tsconfig/apps.json",
    "compilerOptions": {
      "jsx": "react-jsx",
      "customConditions": ["react-native"],
      "moduleSuffixes": [".native", ".ios", ".android", ""],
      "types": ["jest"],
      "baseUrl": ".",
      "paths": {
        "@/*": ["./*"]
      }
    },
    "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
    "exclude": ["node_modules", "ios", "android"]
  }
  ```

  Create `apps/mobile/app.json`:

  ```json
  {
    "expo": {
      "name": "Pekulo",
      "slug": "pekulo",
      "version": "0.1.0",
      "scheme": "pekulo",
      "orientation": "portrait",
      "userInterfaceStyle": "automatic",
      "backgroundColor": "#000000",
      "ios": {
        "supportsTablet": true,
        "bundleIdentifier": "app.pekulo.mobile"
      },
      "android": {
        "package": "app.pekulo.mobile",
        "softwareKeyboardLayoutMode": "resize",
        "adaptiveIcon": {
          "backgroundColor": "#000000"
        }
      },
      "plugins": [
        "expo-router",
        "expo-dev-client",
        "expo-font",
        [
          "expo-splash-screen",
          {
            "backgroundColor": "#000000",
            "dark": {
              "backgroundColor": "#000000"
            }
          }
        ]
      ],
      "experiments": {
        "typedRoutes": true,
        "reactCompiler": true
      }
    }
  }
  ```

  Create `apps/mobile/eas.json`:

  ```json
  {
    "cli": {
      "version": ">= 16.0.1",
      "appVersionSource": "remote"
    },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal",
        "autoIncrement": true
      },
      "preview": {
        "distribution": "internal",
        "autoIncrement": true
      },
      "production": {
        "autoIncrement": true
      }
    },
    "submit": {
      "production": {},
      "development": {}
    }
  }
  ```

  Run: `bun install` (from repo root) then `bun --filter='@pekulo/mobile' run --help` (or `ls apps/mobile/node_modules/expo`)
  Expected: `bun install` resolves `@pekulo/mobile` alongside all existing workspaces with zero peer conflicts; `apps/mobile/node_modules/expo` exists. Note: commit updated `bun.lock` with this slice.
  Commit: `git add apps/mobile/package.json apps/mobile/tsconfig.json apps/mobile/app.json apps/mobile/eas.json bun.lock && git commit -m "chore(#47): scaffold @pekulo/mobile Expo SDK 58 Dev Build workspace"`

- [x] **T5 — Configure Tamagui optimizing compiler (`tamagui.config.ts`, `babel.config.js`, `metro.config.js`) and Jest (`jest.config.js`, `jest.setup.ts`)** [AC: AC-1, AC-2, AC-4]

  Create `apps/mobile/tamagui.config.ts`:

  ```ts
  // apps/mobile/tamagui.config.ts
  // Local root entrypoint for @tamagui/babel-plugin and @tamagui/metro-plugin.
  // Re-exports the single shared Pekulo Tamagui configuration from @pekulo/ui.
  export { config as default } from "@pekulo/ui/tamagui-config";
  ```

  Create `apps/mobile/babel.config.js` (note: `babel-preset-expo` in SDK 58 wires Reanimated/worklets automatically — do NOT add a duplicate `react-native-reanimated/plugin` or `react-native-worklets/plugin`):

  ```js
  module.exports = function (api) {
    api.cache(true);
    return {
      presets: ["babel-preset-expo"],
      plugins: [
        [
          "transform-inline-environment-variables",
          {
            include: ["TAMAGUI_TARGET", "EXPO_ROUTER_APP_ROOT"],
          },
        ],
        [
          "@tamagui/babel-plugin",
          {
            components: ["tamagui", "@pekulo/ui"],
            config: "./tamagui.config.ts",
            logTimings: true,
            disableExtraction: process.env.NODE_ENV === "development",
          },
        ],
      ],
    };
  };
  ```

  Create `apps/mobile/metro.config.js`:

  ```js
  const { getDefaultConfig } = require("expo/metro-config");
  const { withTamagui } = require("@tamagui/metro-plugin");

  const config = getDefaultConfig(__dirname);

  module.exports = withTamagui(config, {
    components: ["tamagui", "@pekulo/ui"],
    config: "./tamagui.config.ts",
  });
  ```

  Create `apps/mobile/jest.setup.ts`:

  ```ts
  // apps/mobile/jest.setup.ts
  // Mock Reanimated v4 for Jest unit/navigation tests without a native runtime.
  jest.mock("react-native-reanimated", () => {
    const Reanimated = require("react-native-reanimated/mock");
    Reanimated.default.call = () => {};
    return Reanimated;
  });

  // Ensure expo-font resolves immediately in tests.
  jest.mock("expo-font", () => ({
    useFonts: () => [true, null],
    isLoaded: () => true,
    loadAsync: jest.fn().mockResolvedValue(undefined),
  }));

  jest.mock("expo-splash-screen", () => ({
    preventAutoHideAsync: jest.fn().mockResolvedValue(true),
    hideAsync: jest.fn().mockResolvedValue(true),
  }));
  ```

  Create `apps/mobile/jest.config.js`:

  ```js
  /** @type {import("jest").Config} */
  module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
    moduleNameMapper: {
      "^@/(.*)$": "<rootDir>/$1",
    },
    transformIgnorePatterns: [
      "node_modules/(?!((?:\\.bun/[^/]+/node_modules/)?(?:(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|tamagui|@tamagui/.*|@pekulo/.*)))",
    ],
  };
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck`
  Expected: exits 0 (note: no test files exist yet until T9/T10).
  Commit: `git add apps/mobile/tamagui.config.ts apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/jest.config.js apps/mobile/jest.setup.ts && git commit -m "chore(#47): configure Tamagui babel/metro plugins and jest-expo in apps/mobile"`

- [x] **T6 — Create shared mobile `ScreenShell` component consuming `@pekulo/ui/client`** [AC: AC-2, AC-3]

  Create `apps/mobile/components/screen-shell.tsx`:

  ```tsx
  // apps/mobile/components/screen-shell.tsx
  // Scrollable safe-area wrapper for mobile tab/stack screens. Uses Tamagui's
  // View/Text via @pekulo/ui/client and React Native's ScrollView with
  // automatic content inset adjustment (Apple HIG / Expo Router guideline).

  import type { ReactNode } from "react";
  import { ScrollView } from "react-native";
  import { Text, View } from "@pekulo/ui/client";

  export interface ScreenShellProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
  }

  export function ScreenShell({ title, subtitle, children }: ScreenShellProps) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 24 }}
      >
        <View gap="$1">
          <Text color="$color" fontSize="$h1" fontWeight="600">
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text color="$colorSecondary" fontSize="$bodySm">
              {subtitle}
            </Text>
          )}
        </View>
        {children}
      </ScrollView>
    );
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: exits 0 with zero type or lint errors (note `no-tailwind-outside-ui` does not trigger because zero Tailwind classes exist).
  Commit: `git add apps/mobile/components/screen-shell.tsx && git commit -m "feat(#47): add ScreenShell wrapper in apps/mobile"`

- [x] **T7 — Wire root layout (`PekuloRootProvider` + Geist fonts) and 5-tab `NativeTabs` + Cap Stack** [AC: AC-2, AC-3]

  Create `apps/mobile/app/_layout.tsx`:

  ```tsx
  // apps/mobile/app/_layout.tsx
  // Root Expo Router layout: loads Geist + Geist Mono fonts, mounts
  // PekuloRootProvider (@pekulo/ui), syncs React Navigation ThemeProvider with OS
  // scheme, and mounts the (tabs) navigator plus the Paramètres modal route.

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
  } from "@expo-google-fonts/geist-mono";
  import { PekuloRootProvider } from "@pekulo/ui";
  import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
  import { useFonts } from "expo-font";
  import * as SplashScreen from "expo-splash-screen";
  import Stack from "expo-router/stack";
  import { StatusBar } from "expo-status-bar";
  import { useEffect } from "react";
  import { useColorScheme } from "react-native";

  void SplashScreen.preventAutoHideAsync();

  export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [fontsLoaded, fontError] = useFonts({
      Geist_400Regular,
      Geist_500Medium,
      Geist_600SemiBold,
      Geist_700Bold,
      GeistMono_400Regular,
      GeistMono_500Medium,
      GeistMono_600SemiBold,
    });

    useEffect(() => {
      if (fontsLoaded || fontError) {
        void SplashScreen.hideAsync();
      }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) {
      return null;
    }

    const navTheme =
      colorScheme === "light"
        ? {
            ...DefaultTheme,
            colors: { ...DefaultTheme.colors, background: "#ffffff", card: "#fafafa" },
          }
        : {
            ...DarkTheme,
            colors: { ...DarkTheme.colors, background: "#000000", card: "#0a0a0a" },
          };

    return (
      <PekuloRootProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={colorScheme === "light" ? "dark" : "light"} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="parametres"
              options={{
                headerShown: true,
                title: "Paramètres",
                presentation: "modal",
              }}
            />
          </Stack>
        </ThemeProvider>
      </PekuloRootProvider>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/_layout.tsx` (SDK 58 stable `expo-router/native-tabs` syntax: `NativeTabs.Trigger.Icon` with SF Symbols `sf` for iOS and Material Symbols `md` for Android, plus `NativeTabs.Trigger.Label` — strictly 5 tabs matching Android Material's 5-tab ceiling and Pekulo's UX navigation graph):

  ```tsx
  // apps/mobile/app/(tabs)/_layout.tsx
  import { NativeTabs } from "expo-router/native-tabs";

  export default function TabsLayout() {
    return (
      <NativeTabs minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="(cap)">
          <NativeTabs.Trigger.Icon
            sf={{ default: "safari", selected: "safari.fill" }}
            md="explore"
          />
          <NativeTabs.Trigger.Label>Cap</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="transactions">
          <NativeTabs.Trigger.Icon sf="arrow.up.arrow.down" md="swap_vert" />
          <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="mensuel">
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
          <NativeTabs.Trigger.Label>Mensuel</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="portefeuille">
          <NativeTabs.Trigger.Icon
            sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
            md="show_chart"
          />
          <NativeTabs.Trigger.Label>Portefeuille</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="immobilier">
          <NativeTabs.Trigger.Icon
            sf={{ default: "building.2", selected: "building.2.fill" }}
            md="apartment"
          />
          <NativeTabs.Trigger.Label>Immobilier</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/(cap)/_layout.tsx` (Stack inside the Cap tab exposing a 1-tap header link to `/parametres`):

  ```tsx
  // apps/mobile/app/(tabs)/(cap)/_layout.tsx
  import { Link } from "expo-router";
  import Stack from "expo-router/stack";
  import { Pressable } from "react-native";
  import { Text, View } from "@pekulo/ui/client";

  function SettingsAvatarLink() {
    return (
      <Link href="/parametres" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir les paramètres" testID="open-settings-btn">
          <View
            width={34}
            height={34}
            borderRadius="$full"
            backgroundColor="$backgroundMuted"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="$color" fontSize="$bodySm" fontWeight="600">
              A
            </Text>
          </View>
        </Pressable>
      </Link>
    );
  }

  export default function CapStackLayout() {
    return (
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerLargeTitle: true,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Cap",
            headerRight: SettingsAvatarLink,
          }}
        />
      </Stack>
    );
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: exits 0 with zero errors.
  Commit: `git add apps/mobile/app/_layout.tsx "apps/mobile/app/(tabs)/_layout.tsx" "apps/mobile/app/(tabs)/(cap)/_layout.tsx" && git commit -m "feat(#47): wire RootLayout, NativeTabs, and CapStackLayout in apps/mobile"`

- [x] **T8 — Add Cap, Transactions, Mensuel, Portefeuille, Immobilier, Paramètres, and NotFound screens** [AC: AC-2, AC-3]

  Create `apps/mobile/app/(tabs)/(cap)/index.tsx` (renders the two cross-platform `@pekulo/ui` pilot components `PekuloHero` and `PekuloStat` inside `View` tokens):

  ```tsx
  // apps/mobile/app/(tabs)/(cap)/index.tsx
  // Cap root screen (matches "/"). Renders cross-platform @pekulo/ui pilot
  // components (PekuloHero + PekuloStat) with baseline V1.5 preview metrics
  // until story 10-4 wires @pekulo/contracts oRPC data.

  import { PekuloHero, PekuloStat } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../../components/screen-shell";

  export default function CapScreen() {
    return (
      <ScreenShell title="Cap" subtitle="Trajectoire vers votre objectif patrimonial">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$5">
          <PekuloHero
            variant="card"
            totalEur={180400}
            aheadEur={2781}
            targetCapital={800000}
            targetYear={2055}
            requiredYearlyEur={20653}
          />
          <View flexDirection="row" gap="$4">
            <View flex={1}>
              <PekuloStat label="Avancement" value="22,6 %" tone="gain" />
            </View>
            <View flex={1}>
              <PekuloStat label="Prochain palier" value="100 k€ · 2032" tone="neutral" />
            </View>
          </View>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/transactions.tsx`:

  ```tsx
  import { PekuloStat } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";

  export default function TransactionsScreen() {
    return (
      <ScreenShell title="Transactions" subtitle="Flux mensuels et catégorisation IA">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Solde du mois" value="+1 050 €" tone="gain" />
          <Text color="$colorSecondary" fontSize="$bodySm">
            Les transactions synchronisées et suggestions IA seront branchées dans la story 10-4.
          </Text>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/mensuel.tsx`:

  ```tsx
  import { PekuloStat } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";

  export default function MensuelScreen() {
    return (
      <ScreenShell title="Mensuel" subtitle="Bilan et clôture du mois en cours">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Épargne nette" value="+1 240 €" tone="gain" />
          <Text color="$colorSecondary" fontSize="$bodySm">
            Le suivi mensuel et la clôture seront branchés dans la story 10-4.
          </Text>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/portefeuille.tsx`:

  ```tsx
  import { PekuloStat } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";

  export default function PortefeuilleScreen() {
    return (
      <ScreenShell title="Portefeuille" subtitle="ETF, actions et crypto">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Plus-value latente" value="+12 450 €" tone="gain" />
          <Text color="$colorSecondary" fontSize="$bodySm">
            Les lignes, lots et cotations multi-devises seront branchés dans la story 10-4.
          </Text>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/(tabs)/immobilier.tsx`:

  ```tsx
  import { PekuloStat } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../../components/screen-shell";

  export default function ImmobilierScreen() {
    return (
      <ScreenShell title="Immobilier" subtitle="Biens, crédits et équité nette">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Équité nette" value="70 000 €" tone="neutral" />
          <Text color="$colorSecondary" fontSize="$bodySm">
            Le suivi immobilier et le cash-flow locatif seront branchés dans la story 10-4.
          </Text>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/parametres.tsx`:

  ```tsx
  import { PekuloStat } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";

  import { ScreenShell } from "../components/screen-shell";

  export default function ParametresScreen() {
    return (
      <ScreenShell title="Paramètres" subtitle="Apparence, compte et préférences">
        <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
          <PekuloStat label="Design System" value="Pekulo Tamagui v2" tone="neutral" />
          <Text color="$colorSecondary" fontSize="$bodySm">
            La session Supabase, le thème persisté et les préférences seront branchés dans la story
            10-4.
          </Text>
        </View>
      </ScreenShell>
    );
  }
  ```

  Create `apps/mobile/app/+not-found.tsx`:

  ```tsx
  import { Link } from "expo-router";
  import { Text, View } from "@pekulo/ui/client";

  export default function NotFoundScreen() {
    return (
      <View
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        padding="$6"
        gap="$4"
      >
        <Text color="$color" fontSize="$h2" fontWeight="600">
          Page introuvable
        </Text>
        <Link href="/">
          <Text color="$colorSecondary" fontSize="$bodySm">
            Retour au Cap
          </Text>
        </Link>
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/mobile' run typecheck && bun --filter='@pekulo/mobile' run lint`
  Expected: exits 0 with zero errors.
  Commit: `git add "apps/mobile/app/(tabs)/(cap)/index.tsx" "apps/mobile/app/(tabs)/transactions.tsx" "apps/mobile/app/(tabs)/mensuel.tsx" "apps/mobile/app/(tabs)/portefeuille.tsx" "apps/mobile/app/(tabs)/immobilier.tsx" apps/mobile/app/parametres.tsx apps/mobile/app/+not-found.tsx && git commit -m "feat(#47): add tab screens, Paramètres modal, and NotFound route"`

- [x] **T9 — Add unit/render test for `@pekulo/ui` native pilot components (`PekuloRootProvider`, `PekuloHero`, `PekuloStat`)** [AC: AC-2, AC-4]

  Create `apps/mobile/__tests__/cap-screen.test.tsx`:

  ```tsx
  import { PekuloRootProvider } from "@pekulo/ui";
  import { render, screen } from "@testing-library/react-native";

  import CapScreen from "../app/(tabs)/(cap)/index";

  describe("CapScreen with @pekulo/ui native", () => {
    it("renders PekuloHero and PekuloStat inside PekuloRootProvider (dark)", () => {
      render(
        <PekuloRootProvider theme="pekulo-dark">
          <CapScreen />
        </PekuloRootProvider>,
      );

      expect(screen.getByText("Cap")).toBeTruthy();
      expect(screen.getByText("Patrimoine total")).toBeTruthy();
      expect(screen.getByText("Avancement")).toBeTruthy();
      expect(screen.getByText("22,6 %")).toBeTruthy();
      expect(screen.getByText("Prochain palier")).toBeTruthy();
      expect(screen.getByText("100 k€ · 2032")).toBeTruthy();
    });

    it("supports switching explicitly to pekulo-light theme", () => {
      render(
        <PekuloRootProvider theme="pekulo-light">
          <CapScreen />
        </PekuloRootProvider>,
      );

      expect(screen.getByText("Patrimoine total")).toBeTruthy();
    });
  });
  ```

  Run: `bun --filter='@pekulo/mobile' run test __tests__/cap-screen.test.tsx`
  Expected: `Tests: 2 passed, 2 total`, exit 0.
  Commit: `git add apps/mobile/__tests__/cap-screen.test.tsx && git commit -m "test(#47): verify native PekuloRootProvider, PekuloHero, and PekuloStat render"`

- [x] **T10 — Add `expo-router/testing-library` navigation test covering all 5 tabs + Paramètres** [AC: AC-3, AC-4]

  Create `apps/mobile/__tests__/navigation-tabs.test.tsx`:

  ```tsx
  import { renderRouter, screen } from "expo-router/testing-library";
  import { act } from "react";

  describe("apps/mobile navigation graph", () => {
    it("boots on / (Cap) and navigates to all 5 tabs + /parametres", () => {
      renderRouter("./app", {
        initialUrl: "/",
      });

      expect(screen).toHavePathname("/");
      expect(screen.getByText("Patrimoine total")).toBeTruthy();

      act(() => {
        screen.router.push("/transactions");
      });
      expect(screen).toHavePathname("/transactions");
      expect(screen.getByText("Solde du mois")).toBeTruthy();

      act(() => {
        screen.router.push("/mensuel");
      });
      expect(screen).toHavePathname("/mensuel");
      expect(screen.getByText("Épargne nette")).toBeTruthy();

      act(() => {
        screen.router.push("/portefeuille");
      });
      expect(screen).toHavePathname("/portefeuille");
      expect(screen.getByText("Plus-value latente")).toBeTruthy();

      act(() => {
        screen.router.push("/immobilier");
      });
      expect(screen).toHavePathname("/immobilier");
      expect(screen.getByText("Équité nette")).toBeTruthy();

      act(() => {
        screen.router.push("/parametres");
      });
      expect(screen).toHavePathname("/parametres");
      expect(screen.getByText("Design System")).toBeTruthy();
    });
  });
  ```

  Note: If `NativeTabs` from `expo-router/native-tabs` requires a Jest stub under `jest-expo` (because `NativeTabs` accesses native screen views on mount), verify by running the test; if Jest throws on `expo-router/native-tabs`, mock `expo-router/native-tabs` in `apps/mobile/jest.setup.ts` using `Tabs` from `expo-router` (so all `NativeTabs.Trigger` routes still register and switch cleanly in `renderRouter`).

  Run: `bun --filter='@pekulo/mobile' run test`
  Expected: `Test Files: 2 passed` / `Test Suites: 2 passed`, exit 0.
  Commit: `git add apps/mobile/__tests__/navigation-tabs.test.tsx && git commit -m "test(#47): add expo-router navigation test for 5 tabs + Paramètres"`

- [x] **T11 — Add Maestro smoke flow, local Dev Build runbook, and sync `docs/epics.md` + full sweep** [AC: AC-1, AC-5]

  Create `.maestro/smoke.yaml`:

  ```yaml
  appId: app.pekulo.mobile
  ---
  - launchApp:
      clearState: true
  - assertVisible: "Patrimoine total"
  - tapOn: "Transactions"
  - assertVisible: "Solde du mois"
  - tapOn: "Mensuel"
  - assertVisible: "Épargne nette"
  - tapOn: "Portefeuille"
  - assertVisible: "Plus-value latente"
  - tapOn: "Immobilier"
  - assertVisible: "Équité nette"
  - tapOn: "Cap"
  - tapOn:
      id: "open-settings-btn"
  - assertVisible: "Design System"
  ```

  Create `apps/mobile/README.md`:

  ````markdown
  # `@pekulo/mobile` — Pekulo V1.5 Native App (Expo Dev Build)

  Expo SDK 58 + `expo-router` + Tamagui v2 (`@pekulo/ui` native entrypoint) on React 19.3.0.

  ## Prerequisites

  - Xcode + iOS Simulator (macOS) and CocoaPods (`pod`)
  - Bun (`bun@1.3.13`)
  - Optional for E2E smoke: Maestro CLI (`curl -Ls "https://get.maestro.mobile.dev" | bash`)

  ## Local Dev Build (iOS Simulator)

  ```bash
  # 1. Generate native ios/ project (Expo CNG — gitignored) and build Dev Client
  bun --filter='@pekulo/mobile' run ios

  # 2. Start Metro with Dev Client + clear cache after babel/metro changes
  bun --filter='@pekulo/mobile' run dev -- --clear
  ```

  ## Verification

  ```bash
  # Unit & navigation tests (runs in CI via bun --filter='*' run test)
  bun --filter='@pekulo/mobile' run test

  # Typecheck (uses "react-native" export condition against @pekulo/ui)
  bun --filter='@pekulo/mobile' run typecheck

  # Lint
  bun --filter='@pekulo/mobile' run lint

  # Maestro E2E smoke (requires booted iOS Simulator with Dev Build installed)
  maestro test .maestro/smoke.yaml
  ```
  ````

  Update `docs/epics.md` right after `**Complexity:** L` of `#### Story 10-2-mobile-app-bootstrap` by appending this exact block (preserving the original summary per Lesson 2026-06-05 / 2026-05-31):

  ```markdown
  > **Realized scope (2026-11-16, Option A split) — supersedes the summary above without deleting it.** Rescoped at `aped-story` step-04 (user-approved) per Lesson 2026-06-05: `10-2` aligns the monorepo on `react@19.3.0` + `next@16.4.6` and delivers the `@pekulo/mobile` Expo SDK 58 Dev Build (`expo-dev-client`) + `expo-router` (`expo-router/native-tabs` + `Stack`, 5 tabs + Paramètres modal), the `@pekulo/ui` dual web/native foundation (`animations.{ts,native.ts}`, `fonts.{ts,native.ts}`, `provider/index.native.tsx`, `index.native.ts` via `"react-native"` export condition), Tamagui optimizing compiler (`@tamagui/babel-plugin` + `@tamagui/metro-plugin`), two cross-platform pilot components (`PekuloHero`, `PekuloStat`), Jest 30 / RNTL tests, and `.maestro/smoke.yaml`. Remaining V1.5 work is split into three follow-up stories below.

  **Complexity:** M (rescoped from L via Option A split)

  #### Story 10-3-ui-native-parity

  **Ticket:** unscheduled (split from #47)
  **Title:** Port remaining 41 web-coupled `@pekulo/ui` files to cross-platform React Native

  **Depends on:** 10-2-mobile-app-bootstrap

  **As a** Pekulo developer, **I want** all remaining `@pekulo/ui` primitives and `Pekulo*` components (`lucide-react-native`, `react-native-svg` for `PekuloDonut`/charts, native sheets/pickers, removal of `var(--)` / `<style>`) ported to native and re-exported from `index.native.ts`, **so that** mobile screens consume the complete Pekulo Design System without web-DOM forks.

  **Covered FRs:** FR-55, FR-56 (native DS component parity)
  **Complexity:** L

  #### Story 10-4-mobile-auth-and-orpc

  **Ticket:** unscheduled (split from #47)
  **Title:** Wire Supabase Auth (`expo-secure-store`) and `@pekulo/contracts` oRPC client in `apps/mobile`

  **Depends on:** 10-2-mobile-app-bootstrap, 10-3-ui-native-parity

  **As a** Pekulo user, **I want** to sign in on mobile and view my live Cap, Transactions, Mensuel, Portefeuille, and Immobilier data via `@pekulo/contracts`, **so that** my mobile app mirrors my live Pekulo account.

  **Covered FRs:** FR-46, FR-56 (live mobile data)
  **Complexity:** L

  #### Story 10-5-mobile-parity-and-maestro

  **Ticket:** unscheduled (split from #47)
  **Title:** Automated iOS/Android pixel-diff parity assertions and CI Maestro E2E suite

  **Depends on:** 10-3-ui-native-parity, 10-4-mobile-auth-and-orpc

  **As a** Pekulo developer, **I want** visual parity checks against the `10-1` web snapshots and the full Maestro E2E suite wired into CI, **so that** visual regressions and navigation breaks are caught before App Store / Play Store release.

  **Covered FRs:** FR-56 (parity verification & Maestro CI)
  **Complexity:** M
  ```

  Run full verification sweep from repo root (Lesson 2026-06-01 + Lesson 2026-05-04):

  ```bash
  cd "$(git rev-parse --show-toplevel)"
  bun run format
  bun run format:check
  bun run lint
  bun run typecheck
  bun --filter='@pekulo/web' run test
  bun --filter='@pekulo/web' run build
  bun --filter='@pekulo/ui' run test
  bun --filter='@pekulo/mobile' run test
  bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
  ```

  Expected: every command exits 0; `packages/ui/public/tamagui.generated.css` has zero diff; `@pekulo/web` build + tests (with `next@16.4.6`), `@pekulo/ui` Vitest tests, and `@pekulo/mobile` Jest 30 tests all pass.
  Commit: `git add .maestro/smoke.yaml apps/mobile/README.md docs/epics.md && git commit -m "docs(#47): add Maestro smoke flow, mobile Dev Build README, and Option A split sync"`

## Dev Notes

### Existing code at write time (Step-0 verbatim quotes)

Every modified file is quoted verbatim from the working tree at story-write time:

**1. `packages/ui/package.json:15-21` & `65-78` (current):**

```json
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./tamagui-config": "./src/config/tamagui.ts",
    "./reset.css": "./public/reset.css",
    "./generated.css": "./public/tamagui.generated.css"
  },
```

```json
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "typescript": "^6.0.3",
    "vitest": "^3.2.6",
    "vitest-axe": "^0.1.0"
  },
  "peerDependencies": {
    "react": "19.2.4",
    "react-dom": "19.2.4"
  }
```

**1b. `apps/web/package.json:45-50` (current):**

```json
    "next": "16.2.9",
    "next-intl": "4.13.0",
    "nuqs": "2.8.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
```

**2. `packages/ui/tsconfig.json:1-12` (current):**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

**3. `packages/ui/src/config/tamagui.ts:12-70` (current):**

```ts
import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-css";
import { createTamagui } from "@tamagui/core";

import { pekuloDark } from "../themes/pekulo-dark";
import { pekuloLight } from "../themes/pekulo-light";
import {
  pekuloFonts,
  pekuloFontSizes,
  pekuloFontWeights,
  pekuloLineHeights,
  pekuloRadius,
  pekuloSpacing,
} from "../tokens";

export const config = createTamagui({
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
  // Token overrides — Pekulo spacing/radius/font scales replace defaultConfig's.
  tokens: {
    ...defaultConfig.tokens,
    space: pekuloSpacing as never,
    size: pekuloSpacing as never,
    radius: pekuloRadius as never,
  },
  fonts: {
    ...defaultConfig.fonts,
    body: {
      family: pekuloFonts.sans,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
    heading: {
      family: pekuloFonts.sans,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
    mono: {
      family: pekuloFonts.mono,
      size: pekuloFontSizes as never,
      weight: pekuloFontWeights as never,
      lineHeight: pekuloLineHeights as never,
    },
  },
});
```

**4. `.gitignore:89-92` (tail, current):**

```gitignore
# Playwright E2E artefacts (story 11-4 — local auth storageState, reports, traces)
apps/web/e2e/.auth/
apps/web/playwright-report/
apps/web/test-results/
```

**5. `.oxlintrc.json:30-52` (current):**

```json
  "settings": {
    "next": {
      "rootDir": "apps/web/"
    },
    "react": {
      "version": "19.2.4"
    }
  },
  "ignorePatterns": [
    "node_modules/",
    ".next/",
    ".turbo/",
    "build/",
    "dist/",
    "out/",
    "coverage/",
    "apps/prices/",
    "docs/ux-preview/",
    ".aped/",
    ".agents/",
    "docs/sync-logs/",
    "packages/oxlint-config/tests/integration/fixtures/"
  ],
```

**6. `.oxfmtrc.json:9-28` (current):**

```json
  "ignorePatterns": [
    "node_modules/",
    ".next/",
    ".turbo/",
    "build/",
    "dist/",
    "out/",
    "coverage/",
    "apps/prices/",
    "docs/ux-preview/dist/",
    "bun.lock",
    "*.lock",
    "apps/web/supabase-schema.sql",
    ".aped/",
    ".agents/",
    "docs/state.yaml",
    "docs/state-corrections.yaml",
    "docs/sync-logs/",
    "docs/stories/"
  ]
```

**7. `docs/epics.md:1272-1290` (current):**

```markdown
#### Story 10-2-mobile-app-bootstrap

**Ticket:** [#47](https://github.com/yabafre/pekulo/issues/47)
**Title:** **(V1.5 deferred)** Expo + expo-router skeleton + Tamagui native consumer + Maestro

**Depends on:** 10-1-visual-snapshot-suite, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the Pekulo native app to render the same Pekulo\* components as the web PWA with visual parity validated by Maestro, **so that** my experience is consistent across devices.

**Summary:** **Deferred to V1.5.** Bootstrap `apps/mobile` (Expo + expo-router), wire the Tamagui native consumer, port the Pekulo\* components to native, write the Maestro E2E suite. The architecture explicitly defers detailed structure to a V1.5 `aped-arch` re-run (G1).

**Covered FRs:** FR-56 (mobile parity)

**Acceptance Criteria:**

- **Given** the V1.5 mobile bootstrap, **When** I render any Pekulo\* component on iOS, **Then** the visual diff against the web snapshot is below the agreed pixel threshold.
- **Given** the Maestro suite, **When** CI runs, **Then** the E2E happy-path passes on iOS + Android emulators.

**Complexity:** L
```

**8. `docs/state.yaml:258-259` (current):**

```yaml
    10-1-visual-snapshot-suite: {status: done, depends_on: [0-10-pekulo-ui-migration, 0-12-custom-oxlint-rules], ticket: "#46", worktree: null, started_at: "2026-08-25T12:00:00Z", completed_at: "2026-08-25T18:35:00Z"}
    10-2-mobile-app-bootstrap: {status: pending, depends_on: [10-1-visual-snapshot-suite, 0-10-pekulo-ui-migration], ticket: "#47", worktree: null}
```

### File structure design (3-bullet decision template per file)

- **`apps/web/package.json`**
  - Single responsibility: Align the web app on `react@19.3.0`, `react-dom@19.3.0`, and `next@16.4.6` (which natively ships with React 19.3) so the monorepo resolves one React version.
  - Inputs + outputs: Updates `dependencies.next`, `dependencies.react`, and `dependencies.react-dom`.
- **`.gitignore`**
  - Single responsibility: Prevent generated Expo native folders (`ios/`, `android/`, `.expo/`) and signing keys from entering git history.
  - Inputs + outputs: Appends mobile ignore patterns; leaves all existing web/API/APED rules intact.
- **`.oxlintrc.json` / `.oxfmtrc.json`**
  - Single responsibility: Exclude generated Expo directories from repo-wide oxlint and oxfmt scans.
  - Inputs + outputs: Updates `ignorePatterns` arrays; leaves rule overrides and formatting options unchanged.
- **`packages/ui/src/config/animations.ts`**
  - Single responsibility: Export the web CSS animation driver for Tamagui.
  - Inputs + outputs: Imports `animations` from `@tamagui/config/v5-css` and re-exports it.
- **`packages/ui/src/config/animations.native.ts`**
  - Single responsibility: Export the React Native Reanimated animation driver for Tamagui under Metro resolution.
  - Inputs + outputs: Imports `animations` from `@tamagui/config/v5-reanimated` and re-exports it.
- **`packages/ui/src/config/fonts.ts`**
  - Single responsibility: Build web Tamagui font definitions matching V1 web snapshots.
  - Inputs + outputs: Consumes `@tamagui/config/v5` + `../tokens`; exports `createPekuloFonts()`.
- **`packages/ui/src/config/fonts.native.ts`**
  - Single responsibility: Build React Native Tamagui font definitions with pixel lineHeights and Geist font-face mappings.
  - Inputs + outputs: Consumes `@tamagui/core#createFont` + `../tokens`; exports `createPekuloFonts()`.
- **`packages/ui/src/config/tamagui.ts`**
  - Single responsibility: Compose the single cross-platform `createTamagui` config shared by web and mobile.
  - Inputs + outputs: Imports `./animations`, `./fonts`, `../themes/*`, `../tokens`; exports `config` and `AppConfig`.
- **`packages/ui/tsconfig.json`**
  - Single responsibility: Typecheck web/shared `@pekulo/ui` sources without requiring `react-native` types in the web package graph.
  - Inputs + outputs: Excludes `**/*.native.{ts,tsx}` (verified by `@pekulo/mobile` with `"react-native"` condition).
- **`packages/ui/src/provider/index.native.tsx`**
  - Single responsibility: Provide the native Tamagui theme/runtime root (`PekuloRootProvider`) without web-only `next-theme`.
  - Inputs + outputs: Consumes `react-native#useColorScheme`, `tamagui#TamaguiProvider`, `../config/tamagui`; exports `PekuloRootProvider`.
- **`packages/ui/src/index.native.ts`**
  - Single responsibility: Expose the native-safe public surface of `@pekulo/ui` so Metro avoids web-only DOM components until `10-3`.
  - Inputs + outputs: Re-exports `PekuloRootProvider`, `tokens`, `themes`, `useCountUp`, `PekuloStat`, and `PekuloHero`.
- **`packages/ui/package.json`**
  - Single responsibility: Route React Native consumers of `@pekulo/ui` to `./src/index.native.ts` via export conditions.
  - Inputs + outputs: Adds `"react-native"` condition under `exports["."]` while keeping `"types"` / `"default"` pointing to `./src/index.ts`.
- **`apps/mobile/package.json`**
  - Single responsibility: Declare `@pekulo/mobile` dependencies pinned to Expo SDK 58 (`react@19.3.0`, `react-native@0.88.1`), `expo-dev-client`, `tamagui@2.3.1`, and `jest-expo` (Jest 30).
  - Inputs + outputs: Workspace manifest consumed by Bun, Turborepo, Expo CLI, and CI `test-unit`.
- **`apps/mobile/tsconfig.json`**
  - Single responsibility: Configure strict TypeScript resolution for React Native using `"customConditions": ["react-native"]`.
  - Inputs + outputs: Extends `@pekulo/tsconfig/apps.json`; enforces that `@pekulo/mobile` only imports native-exported `@pekulo/ui` symbols.
- **`apps/mobile/app.json` & `apps/mobile/eas.json`**
  - Single responsibility: Declare Expo CNG metadata (`app.pekulo.mobile`), Dev Client / Router / Font plugins, and EAS Dev Build profiles.
  - Inputs + outputs: Consumed by `expo prebuild`, `expo run:ios`, and `eas build`.
- **`apps/mobile/tamagui.config.ts`**
  - Single responsibility: Provide the package-root Tamagui config re-export required by `@tamagui/babel-plugin` and `@tamagui/metro-plugin`.
  - Inputs + outputs: Re-exports `config as default` from `@pekulo/ui/tamagui-config`.
- **`apps/mobile/babel.config.js` & `apps/mobile/metro.config.js`**
  - Single responsibility: Enable Tamagui's optimizing compiler extraction and CSS/platform resolution for both `tamagui` and `@pekulo/ui`.
  - Inputs + outputs: Consumed by Metro and `babel-jest`; compiles `apps/mobile` and `@pekulo/ui` views.
- **`apps/mobile/jest.config.js` & `apps/mobile/jest.setup.ts`**
  - Single responsibility: Run `@pekulo/mobile` unit and router tests under `jest-expo` with Bun `.bun/` transform allowlisting.
  - Inputs + outputs: Consumed by `bun --filter='@pekulo/mobile' run test`.
- **`apps/mobile/components/screen-shell.tsx`**
  - Single responsibility: Provide a scrollable, safe-area-inset-aware screen frame using `@pekulo/ui/client`.
  - Inputs + outputs: Accepts `{ title, subtitle?, children }`; renders `ScrollView` + `View`/`Text`.
- **`apps/mobile/app/_layout.tsx`**
  - Single responsibility: Load Geist fonts, mount `PekuloRootProvider` and Navigation `ThemeProvider`, and declare `(tabs)` + `parametres` modal routes.
  - Inputs + outputs: Root layout component for `expo-router`.
- **`apps/mobile/app/(tabs)/_layout.tsx`**
  - Single responsibility: Render the 5-tab `NativeTabs` bar (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`, `Immobilier`).
  - Inputs + outputs: Expo Router tab layout using SDK 58 stable `expo-router/native-tabs` (`NativeTabs.Trigger.*`) APIs.
- **`apps/mobile/app/(tabs)/(cap)/_layout.tsx`**
  - Single responsibility: Provide the Cap tab Stack header with a 1-tap `Link` to `/parametres`.
  - Inputs + outputs: Stack layout wrapping `(cap)/index.tsx`.
- **`apps/mobile/app/(tabs)/(cap)/index.tsx`**
  - Single responsibility: Render the Cap landing route (`/`) with `PekuloHero` and `PekuloStat` from `@pekulo/ui`.
  - Inputs + outputs: Screen component consuming `ScreenShell` + `@pekulo/ui`.
- **`apps/mobile/app/(tabs)/{transactions,mensuel,portefeuille,immobilier}.tsx` & `apps/mobile/app/parametres.tsx` & `apps/mobile/app/+not-found.tsx`**
  - Single responsibility: Implement the remaining 4 primary tabs, the Paramètres modal, and the 404 fallback route.
  - Inputs + outputs: Each renders `ScreenShell` + `PekuloStat` (or centered `View` for `+not-found`).
- **`apps/mobile/__tests__/cap-screen.test.tsx` & `apps/mobile/__tests__/navigation-tabs.test.tsx`**
  - Single responsibility: Verify `@pekulo/ui` native rendering (`PekuloRootProvider`, `PekuloHero`, `PekuloStat`) and `expo-router` navigation across all routes.
  - Inputs + outputs: Jest test suites run locally and in CI.
- **`.maestro/smoke.yaml` & `apps/mobile/README.md`**
  - Single responsibility: Define the Maestro UI smoke flow and local Dev Build / simulator execution steps.
  - Inputs + outputs: Run locally via `maestro test .maestro/smoke.yaml` against a booted iOS Dev Build simulator.
- **`docs/epics.md`**
  - Single responsibility: Record the Option A `10-2` realized scope and register split follow-up stories (`10-3`, `10-4`, `10-5`).
  - Inputs + outputs: Keeps epic documentation synchronized with `10-2` (Lesson 2026-05-31 / 2026-06-05).

### Architecture & Dependency Notes

- **React 19.3.0 + Next.js 16.4.6 + Expo SDK 58 alignment:** **Expo SDK 58 (`expo@~58.0.25`, `react-native@0.88.1`, `expo-router@~58.0.31`, `expo-dev-client@~58.0.20`)** requires `react@^19.3.0`, and **Next.js 16.4 (`16.4.6`)** is the 16.x release built for React 19.3 natively (re-verifying `apps/web/src/lib/orpc/request-context.ts` per Lesson 2026-05-04). Bumping `apps/web` and `packages/ui` in lockstep with `.oxlintrc.json` (`settings.react.version: "19.3.0"`) keeps a single `react@19.3.0` resolution across the whole monorepo.
- **Tamagui optimizing compiler (`@tamagui/babel-plugin@2.3.1` + `@tamagui/metro-plugin@2.3.1`):** Configured with `components: ["tamagui", "@pekulo/ui"]` and `config: "./tamagui.config.ts"` (re-exporting `@pekulo/ui/tamagui-config`) so both `tamagui` primitives and `@pekulo/ui` components share one configuration and benefit from static optimization on mobile and web.
- **Worklets & Reanimated v4:** `babel-preset-expo` in SDK 58 wires Reanimated/worklets automatically when `react-native-reanimated` (`4.7.1`) and `react-native-worklets` (`0.13.0`) are present — do NOT manually add `react-native-reanimated/plugin` in `babel.config.js`.
- **Palette discipline (`docs/ux/design-spec.md` §1):** Surfaces use `#000000` / `#0a0a0a` (dark) and `#ffffff` / `#fafafa` (light) via Tamagui theme tokens (`$background`, `$backgroundCard`); `$accent` / `$success` / `$danger` remain strictly scoped to monetary deltas (`PekuloHero`, `PekuloStat`).
- **Testing:** `@pekulo/ui` and `@pekulo/web` run `vitest` (`bun --filter='@pekulo/ui' run test`); `apps/mobile` runs `jest` (`jest@~30.5.2`, `jest-expo@~58.0.14`, `bun --filter='@pekulo/mobile' run test`) so CI's `bun --filter='*' run test` executes both runners cleanly (Lesson 2026-05-07).
- **Workspace filter convention (Lesson 2026-05-19):** Always run `bun --filter='@pekulo/mobile'`, `bun --filter='@pekulo/web'`, and `bun --filter='@pekulo/ui'`; never `--filter=mobile` or `bun --cwd <relative>`.
- **Manual typecheck gate (Lesson 2026-06-01):** Lefthook pre-commit does not run `tsc`; run `bun run typecheck` explicitly before committing and before final sweep.
- **Commit prefix:** `feat(#47): …` / `chore(#47): …` / `test(#47): …` / `docs(#47): …`. Final PR body: `Closes #47`.

## File List

**Modified:**

- `.gitignore`
- `.oxlintrc.json`
- `.oxfmtrc.json`
- `bun.lock`
- `apps/web/package.json`
- `packages/tsconfig/base.json`
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/src/config/tamagui.ts`
- `docs/epics-context/epic-10-context.md`
- `docs/epics.md`
- `docs/state.yaml`

**Created (`@pekulo/ui` native layer):**

- `packages/ui/src/config/animations.ts`
- `packages/ui/src/config/animations.native.ts`
- `packages/ui/src/config/fonts.ts`
- `packages/ui/src/config/fonts.native.ts`
- `packages/ui/src/provider/index.native.tsx`
- `packages/ui/src/index.native.ts`

**Created (`apps/mobile`, Maestro & Story):**

- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/tamagui.config.ts`
- `apps/mobile/babel.config.js`
- `apps/mobile/metro.config.js`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/components/screen-shell.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/index.tsx`
- `apps/mobile/app/(tabs)/transactions.tsx`
- `apps/mobile/app/(tabs)/mensuel.tsx`
- `apps/mobile/app/(tabs)/portefeuille.tsx`
- `apps/mobile/app/(tabs)/immobilier.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/app/+not-found.tsx`
- `apps/mobile/__tests__/cap-screen.test.tsx`
- `apps/mobile/__tests__/navigation-tabs.test.tsx`
- `apps/mobile/README.md`
- `.maestro/smoke.yaml`
- `docs/stories/10-2-mobile-app-bootstrap.md`

## Dev Agent Record

- **Model:** Gemini 4 Argon (High)
- **Started:** 2026-11-16T12:29:30Z
- **Completed:** 2026-11-16T13:07:00Z

### Summary

Aligned the monorepo on `react@19.3.0`, `react-dom@19.3.0`, and `next@16.4.6` (`T0`), added Expo CNG ignore rules (`T1`), split `@pekulo/ui` Tamagui animations/fonts and native `PekuloRootProvider` behind a `"react-native"` export barrel with zero drift on `packages/ui/public/tamagui.generated.css` (`T2`–`T3`), and bootstrapped `@pekulo/mobile` on Expo SDK 58 Dev Build + `expo-router/native-tabs` + Tamagui optimizing compiler (`@tamagui/babel-plugin` / `@tamagui/metro-plugin`) rendering `PekuloHero` and `PekuloStat` across the 5 primary tabs (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`, `Immobilier`) plus the 1-tap `Paramètres` modal (`T4`–`T11`). Covered all 5 ACs with automated Jest 30 / `@testing-library/react-native` v14 / `expo-router/testing-library` suites and `.maestro/smoke.yaml`.

### Files changed

- `.gitignore`
- `.maestro/smoke.yaml`
- `.oxfmtrc.json`
- `.oxlintrc.json`
- `apps/mobile/README.md`
- `apps/mobile/__tests__/cap-screen.test.tsx`
- `apps/mobile/__tests__/navigation-tabs.test.tsx`
- `apps/mobile/app.json`
- `apps/mobile/app/(tabs)/(cap)/_layout.tsx`
- `apps/mobile/app/(tabs)/(cap)/index.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/immobilier.tsx`
- `apps/mobile/app/(tabs)/mensuel.tsx`
- `apps/mobile/app/(tabs)/portefeuille.tsx`
- `apps/mobile/app/(tabs)/transactions.tsx`
- `apps/mobile/app/+not-found.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/babel.config.js`
- `apps/mobile/components/screen-shell.tsx`
- `apps/mobile/eas.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/metro.config.js`
- `apps/mobile/package.json`
- `apps/mobile/tamagui.config.ts`
- `apps/mobile/tsconfig.json`
- `apps/web/package.json`
- `bun.lock`
- `docs/epics-context/epic-10-context.md`
- `docs/epics.md`
- `docs/state.yaml`
- `docs/stories/10-2-mobile-app-bootstrap.md`
- `packages/tsconfig/base.json`
- `packages/ui/package.json`
- `packages/ui/src/config/animations.native.ts`
- `packages/ui/src/config/animations.ts`
- `packages/ui/src/config/fonts.native.ts`
- `packages/ui/src/config/fonts.ts`
- `packages/ui/src/config/tamagui.ts`
- `packages/ui/src/index.native.ts`
- `packages/ui/src/provider/index.native.tsx`
- `packages/ui/tsconfig.json`

### Deviations

1. **TypeScript 6.0 `baseUrl` deprecation & React Native 0.88.1 `View` type condition (`packages/tsconfig/base.json`, `apps/mobile/tsconfig.json`):** TypeScript 6.0 rejects `"baseUrl": "."` (`TS5101`), so `paths` is declared directly without `baseUrl`. In addition, once `react-native@0.88.1` is installed in Bun's shared `node_modules/.bun/node_modules/` store, `@tamagui/web@2.3.1`'s `import type { View } from 'react-native'` resolves to RN 0.88's new `types_generated/index.d.ts` (where `View` is typed as a function component rather than a class instance with `.focus()`), breaking `apps/web/.../delete-account-row.tsx:52`. Adding `"customConditions": ["react-native-legacy-deep-imports"]` in `packages/tsconfig/base.json` (and `"react-native": ["./node_modules/react-native/types_DEPRECATED/index.d.ts"]` + `"lib": ["dom", "esnext"]` in `apps/mobile/tsconfig.json`) selects RN 0.88's class-based `types_DEPRECATED/index.d.ts` export condition that `@tamagui/web@2.3.1` expects, keeping all 10 workspace `typecheck` jobs green.
2. **Bun isolated `.bun` resolution for `babel-preset-expo`, `@babel/runtime`, and Reanimated v4 in Jest (`apps/mobile/babel.config.js`, `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`):** Under Bun's isolated linker, `babel-preset-expo` and `@babel/runtime` live inside `expo`'s / `react-native`'s package closure rather than top-level `apps/mobile/node_modules`. `babel.config.js` resolves `babel-preset-expo` via `require.resolve("babel-preset-expo", { paths: [require.resolve("expo/package.json")] })`; `jest.config.js` maps `@babel/runtime`, `react-native`, `react-native-reanimated`, `react-native-worklets`, and `@pekulo/ui` subpaths in `moduleNameMapper` and includes `standard-navigation` in `transformIgnorePatterns`; `jest.setup.ts` mocks `react-native-worklets` (`src/mock`) and `react-native-reanimated/src/initializers` (`initializeReanimatedModule` no-op so `JSReanimated.setCSSEventHandler` does not throw in Reanimated 4.7.1).
3. **`PekuloStat` neutral tone & RNTL v14 async `render` / `renderRouter` (`apps/mobile/app/**`, `apps/mobile/__tests__/**`):** `@pekulo/types` defines `StatTone = "gain" | "loss"` (neutral is the default when `tone` is omitted), so neutral `PekuloStat` instances omit `tone`. `@testing-library/react-native` v14 (`14.1.0`) and `expo-router/testing-library` (`58.0.31`) return Promises from `render(...)`, `renderRouter(...)`, and `testRouter.push(...)` for React 19 concurrent `act`; the two Jest suites `await` these calls and assert `getAllByText("Cap")` (since both `ScreenShell` and `PekuloHero` card variant render `"Cap"`).
4. **Visual dev loop (`Step 5`):** `mcp__react-grab-mcp__get_element_context` is unavailable in this session; visual verification is deferred to `aped-review`.

### Test output

```text
$ bun --filter='@pekulo/mobile' run test
@pekulo/mobile test $ jest
  🐥 [tamagui]  native PekuloStat                 ·    3 found   ·    2 opt   ·    2 flat    14ms
  🐥 [tamagui]  native PekuloHero                 ·   15 found   ·   15 opt   ·   15 flat    33ms
PASS __tests__/cap-screen.test.tsx
PASS __tests__/navigation-tabs.test.tsx

Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        2.037 s
Ran all test suites.

$ bun run typecheck
Tasks:    10 successful, 10 total
Cached:    0 cached, 10 total
Time:     7.217s

$ bun run lint
Found 3 warnings and 0 errors.
Finished in 801ms on 1115 files with 158 rules using 11 threads.

$ bun run format:check
All matched files use the correct format.
Finished in 1502ms on 1304 files using 11 threads.

$ bun --filter='@pekulo/ui' run test
Test Files  159 passed (159)
Tests       341 passed | 1 skipped (342)

$ bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
Exit code: 0 (zero diff)
```
