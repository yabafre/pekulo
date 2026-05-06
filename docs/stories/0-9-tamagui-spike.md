# Story: 0-9-tamagui-spike — Tamagui pre-flight spike (RSC + a11y)

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#9](https://github.com/yabafre/pekulo/issues/9)
**Branch:** `feature/9-0-9-tamagui-spike`
**Commit prefix:** `feat(#9): ...` (or `chore(#9):` / `docs(#9):` / `test(#9):` per task type)
**Closes:** #9
**StepsCompleted:** 0/6 (T1–T6)
**Reference ADRs:** [ADR-0007 — Design system migrate apps/web to Tamagui Core now](../adr/0007-design-system-tamagui-migration-now.md)
**Reference architecture sections:** `docs/architecture.md` L213–L215 (UI primitives & DS decision), L283 (pre-flight checks for B), L644–L649 (Tamagui migration discipline), L1143 (W2 watch item), L1170 (E0.9 epic-zero story)
**Reference NFRs:** NFR-22 (WCAG 2.2 AA gating), NFR-23 (keyboard nav), NFR-24 (screen-reader labels), NFR-3 (Lighthouse ≥ 90 — soft target on the spike route, hard gate from 0-10 onward)
**Reference watch item:** **W2** — Tamagui Core ↔ Next 16 RSC integration. This story IS the spike that resolves W2.

**Lessons enforced:**

- **L9** (2026-05-05) — Next.js workspaces MUST declare `typescript` per-package. `apps/web/package.json#devDependencies."typescript"` is already `^6.0.3` (verified at write time). Adding Tamagui MUST NOT introduce a transitive peer-dep that re-hoists `typescript` away from `apps/web/node_modules/typescript`. Verification step lives in T1's expected output (`bun install` clean + `bun --cwd apps/web run typecheck` exits 0 — both inside `apps/web` workspace context).
- **L1** (2026-05-04) — Bun `--frozen-lockfile` workspace coverage. Non-applicable on this story because (a) the spike does NOT touch `apps/api/Dockerfile`, (b) `apps/web` is NOT containerised at V1 (Vercel handles it). Documented here so a future reviewer doesn't propose "harden the Dockerfile" as a sub-task — that's deferred to story 11-X if/when `apps/web` ever migrates off Vercel.
- **L8** (2026-05-05) — Prisma 7 `defineConfig` env-load at config-load time. Non-applicable (no Prisma changes in this story). Mentioned only because T1 runs `bun install` — the existing `apps/api/postinstall: prisma generate` will still fire; the workflow `DATABASE_URL` stub from PR #61 remains in place. No action needed.

**Pivot conditions (ADR-0007 reference):** if T3's RSC sentinel grep returns `'use client'` in any file other than `provider.tsx`, OR if T5's contrast test reports any pair below the AA threshold, the decision doc (T6) MUST recommend **pivot to A** (Tailwind status quo + V1.5 rebuild) and downstream story 0-10 stays blocked until `aped-course` re-evaluates.

---

## User Story

**As a** Pekulo developer, **I want** a pre-flight spike that (a) renders Tamagui Core primitives inside a Next 16 App Router RSC tree with the `'use client'` boundary contained to a single provider component, (b) ports a representative slice of `docs/ux-preview/src/App.tsx` (the HeroBlock surface) onto Tamagui themed primitives without violating Pekulo's strict palette discipline (zero card borders, emerald only on monetary deltas), and (c) measures the WCAG 2.2 AA contrast preservation across every text/surface pair of the ported `pekulo-dark` and `pekulo-light` themes — captured in a checked-in JSON report and a markdown decision doc, **so that** watch-item W2 is resolved with reproducible evidence and story 0-10 (`@pekulo/ui` Tamagui DS migration) either green-lights or the team pivots back to ADR-0007 option A (Tailwind status quo + V1.5 rebuild) before any feature epic invests in `@pekulo/ui` primitives.

---

## Acceptance Criteria

- **AC-1 (RSC boundary).** **Given** a Next 16 App Router subtree rendering Tamagui Core primitives transitively through a single client-bounded provider, **When** the production build runs over the spike route, **Then** no Server Component leaf is forced to declare `'use client'` (the directive lives only on the dedicated provider component) and the build completes without RSC-serialisation errors.

- **AC-2 (Contrast preservation).** **Given** the ported `pekulo-dark` and `pekulo-light` themes, **When** a WCAG 2.2 AA contrast measurement runs over every text/surface pair declared by the spike for both themes, **Then** every body pair clears the ≥ 4.5:1 ratio, every large-text pair clears the ≥ 3:1 ratio, and the measurements are persisted as a machine-readable JSON report committed under the spike artefacts directory with one row per pair (theme, pair label, foreground hex, background hex, size class, ratio, threshold, pass).

- **AC-3 (Palette discipline).** **Given** the ported HeroBlock proto-slice rendered in `pekulo-dark`, **When** the dev inspects the rendered surface and audits the proto-slice source for decoration tokens, **Then** the card surface relies on background contrast alone (no border, outline or box-shadow declarations), the emerald accent appears on exactly one element (the monetary delta line — never on labels, headings, neutral chrome, or non-monetary CTAs), and a screenshot of the rendered dark-mode surface is committed alongside the spike artefacts for traceability.

- **AC-4 (Decision document).** **Given** the spike outputs from the build, contrast measurement, and palette audit, **When** the dev authors the decision document, **Then** it contains an explicit single-line verdict (green-light story 0-10 OR pivot to ADR-0007 option A), a measurements table reflecting the AC-1/AC-2/AC-3 outcomes, an informational build-time delta vs the existing Tailwind-only build, explicit references to W2 + ADR-0007 pivot conditions, and a next-action that names the downstream skill to invoke (`aped-story` for 0-10 on green-light, `aped-course` to revert ADR-0007 on pivot).

---

## Tasks

### T1 — Install Tamagui Core 2.0.0-rc.41 deps + wire `withTamagui` in `next.config.ts` [AC: AC-1]

- [ ] **T1.1** — Add deps to `apps/web/package.json`. Edit the `dependencies` block to include the Tamagui packages, leaving every other line intact:

  ```json
  {
    "name": "web",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "typecheck": "tsc --noEmit",
      "test:contrast": "bun test src/app/(spike)/tamagui-spike/contrast.test.ts"
    },
    "dependencies": {
      "@base-ui/react": "^1.4.1",
      "@opentelemetry/api": "1.9.0",
      "@opentelemetry/exporter-trace-otlp-http": "0.205.0",
      "@opentelemetry/instrumentation-fetch": "0.205.0",
      "@opentelemetry/resources": "2.1.0",
      "@opentelemetry/sdk-node": "0.205.0",
      "@opentelemetry/sdk-trace-node": "2.1.0",
      "@opentelemetry/semantic-conventions": "1.40.0",
      "@orpc/client": "1.14.1",
      "@orpc/contract": "1.14.1",
      "@pekulo/contracts": "workspace:*",
      "@pekulo/validators": "workspace:*",
      "@supabase/ssr": "^0.10.2",
      "@supabase/supabase-js": "^2.104.1",
      "@tamagui/config": "2.0.0-rc.41",
      "@tamagui/core": "2.0.0-rc.41",
      "@tamagui/next-theme": "2.0.0-rc.41",
      "@tanstack/react-form": "^1.29.1",
      "@tanstack/react-query": "^5.100.5",
      "@zapaction/core": "^0.2.2",
      "@zapaction/query": "^0.2.2",
      "class-variance-authority": "^0.7.1",
      "clsx": "^2.1.1",
      "lucide-react": "^1.11.0",
      "next": "16.2.4",
      "react": "19.2.4",
      "react-dom": "19.2.4",
      "react-native-web": "^0.19.13",
      "recharts": "^3.8.0",
      "shadcn": "^4.5.0",
      "tailwind-merge": "^3.5.0",
      "tailwindcss-animate": "^1.0.7",
      "tamagui": "2.0.0-rc.41",
      "tw-animate-css": "^1.4.0",
      "yahoo-finance2": "^3.14.0",
      "zod": "^4.3.6"
    },
    "devDependencies": {
      "@pekulo/tsconfig": "workspace:*",
      "@tailwindcss/postcss": "^4",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@types/react-native": "^0.73.0",
      "supabase": "^2.95.4",
      "tailwindcss": "^4",
      "typescript": "^6.0.3"
    },
    "trustedDependencies": [
      "unrs-resolver"
    ]
  }
  ```

  Note the alphabetical ordering — keep it. `tamagui`, `@tamagui/core`, `@tamagui/config`, `@tamagui/next-theme`, `react-native-web` go in `dependencies` (runtime-loaded). `@types/react-native` goes in `devDependencies` (build-time only). The webpack-flavoured `@tamagui/next-plugin` is intentionally NOT installed — see T1.2 for the Turbopack-native wiring that replaces it.

  **Pin discipline.** Tamagui v2 is currently in RC (`2.0.0-rc.41` is the npm `latest` tag at story-write time). RC builds get exact pins — no caret — because semver ranges over pre-release identifiers behave inconsistently across resolvers and a silent jump from `rc.41` to `rc.42` could ship a new breaking change mid-spike. The dev verifies the current RC tag via `npm view tamagui dist-tags` before T1.1 — if `latest` has rolled past `rc.41`, update all five Tamagui pins together (atomic) and note the upgrade in the decision doc (T6.1) under "Tamagui version".

  Run from repo root:
  ```bash
  bun install
  ```
  Expected output ends with `Saved lockfile` and a non-zero `+ N packages installed` line. No `lockfile had changes, but lockfile is frozen` errors.

- [ ] **T1.2** — Wire `apps/web/next.config.ts` for Tamagui under **Turbopack** (Next 16 default). Replace the current file content (verbatim quote in Dev Notes) with:

  ```ts
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    transpilePackages: [
      "tamagui",
      "@tamagui/core",
      "@tamagui/config",
      "@tamagui/next-theme",
      "react-native-web",
    ],
    turbopack: {
      resolveAlias: {
        "react-native": "react-native-web",
      },
      resolveExtensions: [
        ".web.tsx",
        ".web.ts",
        ".web.js",
        ".web.jsx",
        ".tsx",
        ".ts",
        ".js",
        ".jsx",
        ".json",
      ],
    },
  };

  export default nextConfig;
  ```

  Key choices (sourced from `https://tamagui.dev/docs/guides/next-js` — the official guide does NOT use the webpack plugin):
  - `@tamagui/next-plugin` is NOT used — it imports `webpack` directly (`node_modules/@tamagui/next-plugin/src/withTamagui.ts:8`) and is incompatible with the project's Turbopack-only stance under Next 16.
  - `transpilePackages` lists every Tamagui runtime package + `react-native-web` so Turbopack compiles them through the project's TS/JSX pipeline (Tamagui ships RN-flavoured ESM that Turbopack would otherwise refuse).
  - `turbopack.resolveAlias['react-native']: 'react-native-web'` is the cross-platform stub: any `import { View } from 'react-native'` (transitive in tamagui core) resolves to `react-native-web`'s implementation, which Turbopack then tree-shakes out at build time.
  - `resolveExtensions` adds the `.web.{ts,tsx,js,jsx}` priority so files with platform-specific suffixes win on the web target. Default Next behaviour ignores them under Turbopack.
  - SSR style insertion is handled at runtime by the provider (T3.1) via `useServerInsertedHTML` + `config.getCSS()` — no build-time CSS extraction is required for the spike's AC-1/AC-2/AC-3 contract.

  Run:
  ```bash
  bun --filter=web typecheck
  ```
  Expected: exit 0, no output (tsc --noEmit silent on success).

- [ ] **T1.3** — Smoke build to confirm the plugin doesn't break the existing Tailwind app. Run:
  ```bash
  bun --filter=web build
  ```
  Expected output ends with `✓ Compiled successfully` (or the Next 16 equivalent) and exit 0. The build should NOT print any "RSC serialisation" or "could not resolve tamagui" errors. If it does, surface the exact error in the Debug Log section and HALT — do not proceed to T2 until this is green.

- [ ] **T1.4** — Commit:
  ```bash
  git add apps/web/package.json apps/web/next.config.ts bun.lock .gitignore && git commit -m "chore(#9): install tamagui core 2.0.0-rc.41 + wire turbopack config (W2 spike)"
  ```

### T2 — Port `docs/ux-preview/src/tokens/` into `apps/web/tamagui.config.ts` (pekulo-dark + pekulo-light) [AC: AC-2, AC-3]

- [ ] **T2.1** — Create the tokens module that both the Tamagui config AND the contrast test will import. Write `apps/web/src/app/(spike)/tamagui-spike/tokens.ts` with the full content below (verbatim — do not omit any color, do not paraphrase the keys). Source: `docs/ux-preview/src/tokens/colors.ts`, `spacing.ts`, `typography.ts` (ported, not deep-cloned, so the spike can be deleted in 0-10 without orphan files):

  ```ts
  // apps/web/src/app/(spike)/tamagui-spike/tokens.ts
  // Pekulo design tokens, ported from docs/ux-preview/src/tokens/ for the W2 spike.
  // Pure data — no React, no Tamagui imports — so the contrast test (bun:test)
  // and the Tamagui config can both consume this file.

  export const pekuloColors = {
    dark: {
      surface: {
        bg: "#07090E",
        card: "#0E1117",
        elevated: "#161A22",
        muted: "#1A1F29",
      },
      text: {
        primary: "#F1F5F9",
        secondary: "#CBD5E1",
        tertiary: "#94A3B8",
        muted: "#64748B",
        onAccent: "#042818",
      },
      border: {
        default: "#1E2533",
        strong: "#2A3344",
        focus: "#34D399",
      },
      accent: {
        500: "#10B981",
        400: "#34D399",
      },
      semantic: {
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",
      },
    },
    light: {
      surface: {
        bg: "#FAFAFA",
        card: "#FFFFFF",
        elevated: "#FFFFFF",
        muted: "#F1F5F9",
      },
      text: {
        primary: "#0F172A",
        secondary: "#334155",
        tertiary: "#475569",
        muted: "#64748B",
        onAccent: "#FFFFFF",
      },
      border: {
        default: "#E2E8F0",
        strong: "#CBD5E1",
        focus: "#059669",
      },
      accent: {
        500: "#059669",
        600: "#047857",
      },
      semantic: {
        success: "#059669",
        warning: "#D97706",
        danger: "#DC2626",
        info: "#2563EB",
      },
    },
  } as const;

  export const pekuloSpacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
  } as const;

  export const pekuloRadius = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  } as const;

  export type PekuloMode = keyof typeof pekuloColors;
  ```

- [ ] **T2.2** — Create `apps/web/tamagui.config.ts` (root-level, alongside `next.config.ts`). **Tamagui v2 dropped the `createTheme()` helper** — themes are plain objects mapping theme keys to color values, passed straight to `createTamagui`. The block below is the v2-RC.41 form (see Debug Log "T2.2 v2 API patch"); the original story spec used `createTheme(...)` calls which are v1 API and resolve to `undefined` at runtime in v2. Full content:

  ```ts
  // apps/web/tamagui.config.ts
  // Tamagui v2-rc.41 config for the W2 pre-flight spike. Layered on top of
  // @tamagui/config/v5 so we inherit a working font stack, transitions,
  // shorthands and breakpoints. Only the themes are overridden with Pekulo
  // tokens. Tamagui v2 dropped the createTheme() helper — themes are plain
  // objects mapping theme keys to color values, passed straight to createTamagui.

  import { defaultConfig } from "@tamagui/config/v5";
  import { animations } from "@tamagui/config/v5-css";
  import { createTamagui } from "@tamagui/core";

  import { pekuloColors } from "./src/app/(spike)/tamagui-spike/tokens";

  const pekuloDark = {
    background: pekuloColors.dark.surface.bg,
    backgroundCard: pekuloColors.dark.surface.card,
    backgroundElevated: pekuloColors.dark.surface.elevated,
    backgroundMuted: pekuloColors.dark.surface.muted,
    color: pekuloColors.dark.text.primary,
    colorSecondary: pekuloColors.dark.text.secondary,
    colorTertiary: pekuloColors.dark.text.tertiary,
    colorMuted: pekuloColors.dark.text.muted,
    colorOnAccent: pekuloColors.dark.text.onAccent,
    accent: pekuloColors.dark.accent[500],
    accentHover: pekuloColors.dark.accent[400],
    success: pekuloColors.dark.semantic.success,
    warning: pekuloColors.dark.semantic.warning,
    danger: pekuloColors.dark.semantic.danger,
    info: pekuloColors.dark.semantic.info,
  } as const;

  const pekuloLight = {
    background: pekuloColors.light.surface.bg,
    backgroundCard: pekuloColors.light.surface.card,
    backgroundElevated: pekuloColors.light.surface.elevated,
    backgroundMuted: pekuloColors.light.surface.muted,
    color: pekuloColors.light.text.primary,
    colorSecondary: pekuloColors.light.text.secondary,
    colorTertiary: pekuloColors.light.text.tertiary,
    colorMuted: pekuloColors.light.text.muted,
    colorOnAccent: pekuloColors.light.text.onAccent,
    accent: pekuloColors.light.accent[500],
    accentHover: pekuloColors.light.accent[600],
    success: pekuloColors.light.semantic.success,
    warning: pekuloColors.light.semantic.warning,
    danger: pekuloColors.light.semantic.danger,
    info: pekuloColors.light.semantic.info,
  } as const;

  export const config = createTamagui({
    ...defaultConfig,
    animations,
    themes: {
      ...defaultConfig.themes,
      "pekulo-dark": pekuloDark,
      "pekulo-light": pekuloLight,
    },
    defaultTheme: "pekulo-dark",
  });

  export type AppConfig = typeof config;

  declare module "@tamagui/core" {
    // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
    interface TamaguiCustomConfig extends AppConfig {}
  }

  export default config;
  ```

- [ ] **T2.3** — Run typecheck to confirm both files type-clean:
  ```bash
  bun --filter=web run typecheck
  ```
  Expected: exit 0, no output. If a theme key flags as unknown, do NOT widen the theme — surface in the Debug Log; the v5 default config schema is the authority.

- [ ] **T2.4** — Commit:
  ```bash
  git add apps/web/tamagui.config.ts "apps/web/src/app/(spike)/tamagui-spike/tokens.ts" && git commit -m "feat(#9): port pekulo tokens + tamagui config (pekulo-dark/light themes)"
  ```

### T3 — Build the spike route — RSC sentinel + isolated `'use client'` provider [AC: AC-1]

- [ ] **T3.1** — Create the client-bounded provider. This file is the ONLY place `'use client'` is allowed in the spike. Write `apps/web/src/app/(spike)/tamagui-spike/provider.tsx` exactly as below:

  ```tsx
  "use client";

  // apps/web/src/app/(spike)/tamagui-spike/provider.tsx
  // The single client boundary for the W2 spike. All Tamagui runtime context
  // (theme switching, animation driver, media-query watcher) lives behind this
  // wall. Children render as Server Components and consume the theme via Tamagui's
  // SSR-extracted CSS — no per-leaf 'use client' required.

  import { useServerInsertedHTML } from "next/navigation";
  import { useState, type ReactNode } from "react";
  import { TamaguiProvider } from "tamagui";

  import config from "../../../../tamagui.config";

  export function PekuloTamaguiProvider({ children }: { children: ReactNode }) {
    const [styleInserted, setStyleInserted] = useState(false);

    useServerInsertedHTML(() => {
      if (styleInserted) return null;
      setStyleInserted(true);
      const style = config.getCSS({
        exclude: process.env.NODE_ENV === "production" ? "design-system" : undefined,
      });
      return <style dangerouslySetInnerHTML={{ __html: style }} />;
    });

    return (
      <TamaguiProvider config={config} defaultTheme="pekulo-dark">
        {children}
      </TamaguiProvider>
    );
  }
  ```

  Why `useServerInsertedHTML`: Tamagui's CSS extraction emits a global stylesheet at build time, but at request time the SSR pass needs to inject the per-page slice. Without this hook, dark/light theme switches flash unstyled content on the first paint.

- [ ] **T3.2** — Create the spike layout (RSC). Write `apps/web/src/app/(spike)/tamagui-spike/layout.tsx`:

  ```tsx
  // apps/web/src/app/(spike)/tamagui-spike/layout.tsx
  // Server Component. Wraps the spike subtree with the single Tamagui client
  // provider. NO 'use client' here — this file MUST stay an RSC.

  import type { ReactNode } from "react";

  import { PekuloTamaguiProvider } from "./provider";

  export default function TamaguiSpikeLayout({ children }: { children: ReactNode }) {
    return <PekuloTamaguiProvider>{children}</PekuloTamaguiProvider>;
  }
  ```

- [ ] **T3.3** — Create the RSC sentinel page. Write `apps/web/src/app/(spike)/tamagui-spike/page.tsx`:

  ```tsx
  // apps/web/src/app/(spike)/tamagui-spike/page.tsx
  // Server Component. Renders Tamagui primitives transitively through the provider.
  // If Tamagui forces 'use client' here, AC-1 fails and the decision doc records pivot.

  import { ProtoSlice } from "./proto-slice";

  export default function TamaguiSpikePage() {
    return (
      <main style={{ minHeight: "100vh", padding: "24px" }}>
        <h1 style={{ marginBottom: "16px", fontSize: "1.5rem" }}>
          Tamagui spike — W2 pre-flight
        </h1>
        <ProtoSlice
          totalWealthEur={147_320}
          compassPercentage={18.4}
          nextMilestoneDeltaEur={12_340}
          nextMilestoneLabel="Etape 2030 · 200 000 €"
        />
      </main>
    );
  }
  ```

  Note: the outer `<main>` uses inline styles (no Tailwind, no Tamagui) so the page itself does not depend on either toolchain — it's a thin RSC shell whose ONLY job is to mount `ProtoSlice` (the actual Tamagui surface). This isolates the AC-1 measurement: if `'use client'` is forced anywhere outside `provider.tsx`, the cause is unambiguously Tamagui, not Tailwind/shadcn co-tenancy.

- [ ] **T3.4** — Run the build + grep gate. Run:
  ```bash
  bun --filter=web build && grep -rE "^['\"]use client['\"]" apps/web/src/app/\(spike\)/tamagui-spike/
  ```
  Expected:
  - Build exits 0 with `✓ Compiled successfully` (or Next 16 equivalent).
  - Grep returns exactly one line: `apps/web/src/app/(spike)/tamagui-spike/provider.tsx:"use client";` (or `'use client';` — whichever quote style was used in T3.1).

  If the grep returns more than one match, AC-1 is **failing**. Document the offending file(s) in the Debug Log section, do NOT silently add `'use client'` to "fix" it, and surface the finding for the decision doc (T6) — this is the canonical W2 pivot signal.

- [ ] **T3.5** — Commit:
  ```bash
  git add "apps/web/src/app/(spike)/tamagui-spike/provider.tsx" "apps/web/src/app/(spike)/tamagui-spike/layout.tsx" "apps/web/src/app/(spike)/tamagui-spike/page.tsx" && git commit -m "feat(#9): RSC spike route with isolated client provider boundary"
  ```

### T4 — Port HeroBlock proto-slice from `docs/ux-preview/src/App.tsx` to Tamagui primitives [AC: AC-3]

- [ ] **T4.1** — Create `apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx`. This is the AC-3 canary — every line is auditable by grep. Full content:

  ```tsx
  // apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx
  // Server Component. Ports the HeroBlock surface from docs/ux-preview/src/App.tsx
  // onto Tamagui primitives. Discipline contract:
  //   1. ZERO card borders — surfaces rely on backgroundCard contrast against background.
  //   2. accent.500 (emerald) appears on EXACTLY one element: the monetary delta.
  //      Labels, headings, neutral chrome must use color / colorSecondary / colorTertiary.
  //   3. No shadowColor / boxShadow / outline — flat dark surfaces only (Trade Republic
  //      fidelity per project_pekulo_style_references memory).
  //
  // grep audit (run in T4.3):
  //   grep -nE "(borderColor|borderWidth|outline|boxShadow|shadowColor)" proto-slice.tsx
  //   → must return ZERO matches.

  import { Text, View } from "tamagui";

  export interface ProtoSliceProps {
    totalWealthEur: number;
    compassPercentage: number;
    nextMilestoneDeltaEur: number;
    nextMilestoneLabel: string;
  }

  function formatEur(value: number): string {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatPercentage(value: number): string {
    return `${value.toFixed(1).replace(".", ",")} %`;
  }

  export function ProtoSlice(props: ProtoSliceProps) {
    const { totalWealthEur, compassPercentage, nextMilestoneDeltaEur, nextMilestoneLabel } = props;
    const deltaSign = nextMilestoneDeltaEur >= 0 ? "+" : "−";
    const deltaAbsoluteEur = formatEur(Math.abs(nextMilestoneDeltaEur));

    return (
      <View
        backgroundColor="$backgroundCard"
        borderRadius={16}
        padding={24}
        width="100%"
        maxWidth={520}
      >
        <View gap={4}>
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
            PATRIMOINE TOTAL
          </Text>
          <Text color="$color" fontSize={44} fontWeight="600" letterSpacing={-0.5}>
            {formatEur(totalWealthEur)}
          </Text>
        </View>

        <View gap={4} marginTop={20}>
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
            CAP
          </Text>
          <Text color="$colorSecondary" fontSize={20}>
            {formatPercentage(compassPercentage)}
          </Text>
        </View>

        <View gap={4} marginTop={20}>
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
            PROCHAINE ÉTAPE
          </Text>
          <View flexDirection="row" alignItems="baseline" gap={8}>
            <Text color="$colorSecondary" fontSize={16}>
              {nextMilestoneLabel}
            </Text>
            <Text color="$accent" fontSize={16} fontWeight="600">
              {deltaSign}
              {deltaAbsoluteEur}
            </Text>
          </View>
        </View>
      </View>
    );
  }
  ```

  Decision rationale embedded in code:
  - `backgroundColor="$backgroundCard"` — Tamagui token reference, NOT a hex value. Theme-switch is automatic.
  - No `borderColor` / `borderWidth` anywhere. The card is distinguished from the page background by `$backgroundCard` vs `$background` contrast alone (the AC-3 grep enforces this).
  - The single `color="$accent"` usage is on the delta line. Labels (`PATRIMOINE TOTAL`, `CAP`, `PROCHAINE ÉTAPE`) all use `$colorTertiary`; the milestone label uses `$colorSecondary`; the wealth headline uses `$color`. Emerald is reserved.

- [ ] **T4.2** — Run the dev server and capture the dark-mode screenshot. Run:
  ```bash
  bun --filter=web dev
  ```
  Then visit `http://localhost:3000/tamagui-spike` in a browser. Verify visually:
  - Card background sits at `#0E1117` against the page `#07090E` background (faint but distinguishable, no border line).
  - The wealth headline (`147 320 €`) is white-ish (`#F1F5F9`).
  - The label `PATRIMOINE TOTAL` is mid-grey (`#94A3B8`).
  - The delta `+12 340 €` is emerald (`#10B981`) — and it is the ONLY emerald element on the screen.

  Capture the screenshot via the running `react-grab-mcp` instance (already wired in `apps/web/src/app/layout.tsx` for dev). Save the resulting PNG to `docs/spikes/0-9-proto-slice-dark.png`. Stop the dev server (Ctrl+C).

- [ ] **T4.3** — Run the AC-3 discipline grep gate:
  ```bash
  grep -nE "(borderColor|borderWidth|outline|boxShadow|shadowColor)" "apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx"
  ```
  Expected: zero output, exit code 1 (grep returns 1 when no match — that's the success signal here).

  Then run the emerald-uniqueness check:
  ```bash
  grep -cE '\$accent\b' "apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx"
  ```
  Expected: exactly `1` printed to stdout (the single delta line). If the count is > 1, AC-3 fails — refactor before commit.

- [ ] **T4.4** — Commit:
  ```bash
  git add "apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx" docs/spikes/0-9-proto-slice-dark.png && git commit -m "feat(#9): port HeroBlock proto-slice with strict palette discipline"
  ```

### T5 — Contrast measurement test (`bun:test`) + JSON report dump [AC: AC-2]

- [ ] **T5.1** — Create the pure WCAG luminance helper. Write `apps/web/src/app/(spike)/tamagui-spike/contrast.ts`:

  ```ts
  // apps/web/src/app/(spike)/tamagui-spike/contrast.ts
  // Pure WCAG 2.x relative-luminance + contrast-ratio implementation.
  // No DOM, no React — runnable under bun:test or any Node-compatible runtime.
  // Spec: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleaned = hex.replace(/^#/, "");
    if (cleaned.length !== 6) {
      throw new Error(`contrast.ts: only 6-char hex supported, got "${hex}"`);
    }
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }

  function channelToLinear(channel8bit: number): number {
    const normalised = channel8bit / 255;
    return normalised <= 0.03928
      ? normalised / 12.92
      : Math.pow((normalised + 0.055) / 1.055, 2.4);
  }

  export function relativeLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    const rL = channelToLinear(r);
    const gL = channelToLinear(g);
    const bL = channelToLinear(b);
    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  }

  export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
    const fgL = relativeLuminance(foregroundHex);
    const bgL = relativeLuminance(backgroundHex);
    const lighter = Math.max(fgL, bgL);
    const darker = Math.min(fgL, bgL);
    return (lighter + 0.05) / (darker + 0.05);
  }
  ```

- [ ] **T5.2** — Create the test that runs the matrix. Write `apps/web/src/app/(spike)/tamagui-spike/contrast.test.ts`:

  ```ts
  // apps/web/src/app/(spike)/tamagui-spike/contrast.test.ts
  // WCAG 2.2 AA contrast preservation test for the W2 spike.
  // AC-2 binding: every text/surface pair declared in PAIRS_TO_TEST must clear
  // the size-appropriate threshold for both pekulo-dark and pekulo-light.
  //
  // Run: cd apps/web && bun test "src/app/(spike)/tamagui-spike/contrast.test.ts"

  import { writeFileSync, mkdirSync } from "node:fs";
  import { dirname, resolve } from "node:path";

  import { describe, expect, it, afterAll } from "bun:test";

  import { contrastRatio } from "./contrast";
  import { pekuloColors, type PekuloMode } from "./tokens";

  type Size = "body" | "large";

  interface Pair {
    label: string;
    fgPath: (mode: PekuloMode) => string;
    bgPath: (mode: PekuloMode) => string;
    size: Size;
  }

  const THRESHOLDS: Record<Size, number> = {
    body: 4.5,
    large: 3.0,
  };

  const PAIRS_TO_TEST: Pair[] = [
    {
      label: "text.primary on surface.bg",
      fgPath: (m) => pekuloColors[m].text.primary,
      bgPath: (m) => pekuloColors[m].surface.bg,
      size: "body",
    },
    {
      label: "text.primary on surface.card",
      fgPath: (m) => pekuloColors[m].text.primary,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
    {
      label: "text.secondary on surface.card",
      fgPath: (m) => pekuloColors[m].text.secondary,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
    {
      label: "text.tertiary on surface.card",
      fgPath: (m) => pekuloColors[m].text.tertiary,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "large",
    },
    {
      label: "accent.500 on surface.card",
      fgPath: (m) => pekuloColors[m].accent[500],
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
    {
      label: "semantic.danger on surface.card",
      fgPath: (m) => pekuloColors[m].semantic.danger,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
    {
      label: "semantic.warning on surface.card",
      fgPath: (m) => pekuloColors[m].semantic.warning,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
    {
      label: "semantic.info on surface.card",
      fgPath: (m) => pekuloColors[m].semantic.info,
      bgPath: (m) => pekuloColors[m].surface.card,
      size: "body",
    },
  ];

  interface ReportRow {
    theme: PekuloMode;
    pair: string;
    fg: string;
    bg: string;
    size: Size;
    ratio: number;
    threshold: number;
    pass: boolean;
  }

  const report: ReportRow[] = [];

  describe("WCAG 2.2 AA contrast — pekulo-dark", () => {
    for (const pair of PAIRS_TO_TEST) {
      it(`${pair.label} (${pair.size}) ≥ ${THRESHOLDS[pair.size]}`, () => {
        const fg = pair.fgPath("dark");
        const bg = pair.bgPath("dark");
        const ratio = contrastRatio(fg, bg);
        report.push({
          theme: "dark",
          pair: pair.label,
          fg,
          bg,
          size: pair.size,
          ratio,
          threshold: THRESHOLDS[pair.size],
          pass: ratio >= THRESHOLDS[pair.size],
        });
        expect(ratio).toBeGreaterThanOrEqual(THRESHOLDS[pair.size]);
      });
    }
  });

  describe("WCAG 2.2 AA contrast — pekulo-light", () => {
    for (const pair of PAIRS_TO_TEST) {
      it(`${pair.label} (${pair.size}) ≥ ${THRESHOLDS[pair.size]}`, () => {
        const fg = pair.fgPath("light");
        const bg = pair.bgPath("light");
        const ratio = contrastRatio(fg, bg);
        report.push({
          theme: "light",
          pair: pair.label,
          fg,
          bg,
          size: pair.size,
          ratio,
          threshold: THRESHOLDS[pair.size],
          pass: ratio >= THRESHOLDS[pair.size],
        });
        expect(ratio).toBeGreaterThanOrEqual(THRESHOLDS[pair.size]);
      });
    }
  });

  afterAll(() => {
    const reportPath = resolve(import.meta.dir, "../../../../../../docs/spikes/0-9-contrast-report.json");
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), thresholds: THRESHOLDS, rows: report }, null, 2) + "\n");
  });
  ```

  Path-resolution note: `import.meta.dir` is `apps/web/src/app/(spike)/tamagui-spike/`; six `..` segments back out to repo root. Verify by running the test once and checking the report file lands at `docs/spikes/0-9-contrast-report.json` — if it lands elsewhere, adjust the segment count and re-run.

- [ ] **T5.3** — Run the test (script `test:contrast` was added to `apps/web/package.json` in T1.1):
  ```bash
  bun --filter=web test:contrast
  ```
  Expected output ends with `Tests: 16 passed` (8 pairs × 2 themes), exit 0. The file `docs/spikes/0-9-contrast-report.json` exists and contains 16 rows with `pass: true` for all.

  If any row reports `pass: false`, AC-2 fails. Do NOT lower the thresholds — that's the W2 pivot signal. Capture the failing pair(s) in the Debug Log and surface in T6.

- [ ] **T5.4** — Commit:
  ```bash
  git add "apps/web/src/app/(spike)/tamagui-spike/contrast.ts" "apps/web/src/app/(spike)/tamagui-spike/contrast.test.ts" docs/spikes/0-9-contrast-report.json && git commit -m "test(#9): wcag 2.2 aa contrast measurement for pekulo-dark/light"
  ```

### T6 — Decision document + final wrap [AC: AC-4]

- [ ] **T6.1** — Author `docs/spikes/0-9-tamagui-decision.md` from the measurements collected in T1–T5. Use the template below — do not omit any section, do not paraphrase the verdict. Replace every `<…>` placeholder with concrete numbers from the actual runs. Pick exactly one of the two `**Decision:**` lines.

  ````markdown
  # Spike decision — 0-9 Tamagui pre-flight (W2)

  **Date:** <YYYY-MM-DD of T6 commit>
  **Author:** <git user.name>
  **Branch:** `feature/9-0-9-tamagui-spike`
  **Tamagui version:** `tamagui@2.0.0-rc.41` + `@tamagui/next-plugin@2.0.0-rc.41` (verify via `npm view tamagui dist-tags` — update if `latest` has rolled past)
  **Next.js version:** `next@16.2.4`
  **React version:** `react@19.2.4`

  ## Decision

  <Pick exactly one of the two lines below — keep only the chosen one in the final commit:>

  **Decision: green-light story 0-10 (`@pekulo/ui` Tamagui DS migration).**

  **Decision: pivot to ADR-0007 option A (Tailwind status quo + V1.5 rebuild).**

  ## Measurements

  ### AC-1 — RSC `'use client'` boundary

  | File | `'use client'` present | Required |
  | --- | --- | --- |
  | `provider.tsx` | <yes/no> | yes |
  | `layout.tsx` | <yes/no> | no |
  | `page.tsx` | <yes/no> | no |
  | `proto-slice.tsx` | <yes/no> | no |
  | `tokens.ts` | <yes/no> | no |
  | `contrast.ts` | <yes/no> | no |

  Build outcome: `bun --cwd apps/web run build` exited <0/non-zero>. Errors surfaced: <none / paste verbatim>.

  ### AC-2 — Contrast (WCAG 2.2 AA)

  Source: `docs/spikes/0-9-contrast-report.json`.

  | Theme | Pairs tested | Pairs passing | Worst pair | Worst ratio |
  | --- | --- | --- | --- | --- |
  | `pekulo-dark` | 8 | <N> | <pair label> | <ratio>:1 |
  | `pekulo-light` | 8 | <N> | <pair label> | <ratio>:1 |

  ### AC-3 — Palette discipline

  | Audit | Expected | Observed |
  | --- | --- | --- |
  | `borderColor`/`borderWidth`/`outline`/`boxShadow`/`shadowColor` count in `proto-slice.tsx` | 0 | <N> |
  | `$accent` token usages in `proto-slice.tsx` | 1 (delta line only) | <N> |
  | Visual smoke (`docs/spikes/0-9-proto-slice-dark.png`) | zero card borders, emerald only on delta | <pass/fail with notes> |

  ### Build-time delta (informational)

  | Build | Wall time | Bundle size hint |
  | --- | --- | --- |
  | Pre-spike (HEAD~6 — Tailwind only) | <Xs> | <Y kB> |
  | Post-spike (this branch — Tailwind + Tamagui spike) | <Xs> | <Y kB> |

  ## Pivot conditions (ADR-0007 reference)

  Per ADR-0007 "Consequences" → "Pivot conditions", any of the following triggers a fall-back to option A:

  - Tamagui compiler emits `'use client'` on every leaf, OR RSC context serialisation breaks → **<triggered/not triggered>** (see AC-1 table).
  - Any contrast pair below WCAG 2.2 AA → **<triggered/not triggered>** (see AC-2 table).
  - Migration runtime estimate balloons past 4 weeks → out of scope for this spike (covered at story 0-10 kick-off).

  ## Next action

  <If green-light:> Run `aped-story` for `0-10-pekulo-ui-migration` to scaffold the migration sub-stories. Tamagui deps installed in T1 stay in `apps/web/package.json` for 0-10 to consume; the spike route at `apps/web/src/app/(spike)/tamagui-spike/` is decommissioned in 0-10's wrap-up commit alongside the Tailwind/shadcn removal.

  <If pivot:> Open an `aped-course` correction proposing to revert ADR-0007 → status `superseded`, write a new ADR documenting the pivot rationale + the V1.5 rebuild plan, and unblock story 0-10 by re-scoping it to a Tailwind-only ramp. Tamagui deps from T1 are removed in the same correction PR.

  ## References

  - W2 watch item — `docs/architecture.md` L1143
  - ADR-0007 — `docs/adr/0007-design-system-tamagui-migration-now.md`
  - Tamagui v2 RC Next.js App Router guide (verified 2026-05-06) — confirms `appDir: true` + `useServerInsertedHTML` + `skipNextHead` pattern; `npm view tamagui dist-tags` → `latest: 2.0.0-rc.41`
  - Tamagui v1 → v2 migration cheat-sheet — `<Stack>`→`<View>`, `@tamagui/config/v3`→`@tamagui/config/v5`, `animation=`→`transition=`
  - Pekulo style fidelity rules — feedback memory `feedback_trade_republic_fidelity.md`
  ````

- [ ] **T6.2** — Final smoke pass before commit. Re-run, in order:
  ```bash
  bun --filter=web typecheck && bun --filter=web build && bun --filter=web test:contrast
  ```
  Expected: all three commands exit 0 in sequence. If any fails, do NOT commit T6 — go fix the failure (which means the decision line in T6.1 is incorrect or a regression slipped in).

- [ ] **T6.3** — Commit + push:
  ```bash
  git add docs/spikes/0-9-tamagui-decision.md && git commit -m "docs(#9): tamagui spike decision — <green-light|pivot>" && git push -u origin feature/9-0-9-tamagui-spike
  ```
  Replace `<green-light|pivot>` with the literal verdict word matching T6.1's chosen `**Decision:**` line.

---

## Dev Notes

### Existing code at write time (Step-0 quotes — verbatim, do not paraphrase)

`apps/web/next.config.ts` (current, full file):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

T1.2 replaces this entire file. The `/* config options here */` placeholder is preserved as `baseConfig` so any future Next config (rewrites, headers, image domains) lands in the same spot.

`apps/web/package.json` (current `dependencies` + `devDependencies` block — abbreviated to the lines T1.1 modifies):

```json
"dependencies": {
  "@base-ui/react": "^1.4.1",
  …
  "react-dom": "19.2.4",
  "recharts": "^3.8.0",
  "shadcn": "^4.5.0",
  "tailwind-merge": "^3.5.0",
  "tailwindcss-animate": "^1.0.7",
  "tw-animate-css": "^1.4.0",
  "yahoo-finance2": "^3.14.0",
  "zod": "^4.3.6"
},
"devDependencies": {
  "@pekulo/tsconfig": "workspace:*",
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "supabase": "^2.95.4",
  "tailwindcss": "^4",
  "typescript": "^6.0.3"
}
```

T1.1 inserts (alphabetically) into `dependencies`: `@tamagui/config`, `@tamagui/core`, `@tamagui/next-theme`, `react-native-web`, `tamagui`. Into `devDependencies`: `@tamagui/next-plugin`, `@types/react-native`. Every other line stays byte-identical — this is enforced by the `git diff --stat` output (review the diff before T1.4 commits).

`apps/web/src/app/layout.tsx` is read-only on this story. NOT modified — the spike route brings its own `layout.tsx` under `(spike)/tamagui-spike/`. Documented here so a future reviewer doesn't propose collapsing the two.

### File map (3-bullet decision per file)

- **`apps/web/package.json`** — *modify* — declares Tamagui Core 2.0.0-rc.41 runtime + plugin deps (exact pins, no caret on the RC line), alphabetical insertion preserves diff readability — inputs: lockfile, outputs: resolvable `tamagui` / `@tamagui/*` / `react-native-web` modules at typecheck and build time.
- **`apps/web/next.config.ts`** — *modify* — wires `withTamagui` so the Next compiler knows to flat-extract Tamagui CSS at build time and respect `appDir` boundaries — inputs: `apps/web/tamagui.config.ts`, outputs: a Next config object with the Tamagui plugin layered on.
- **`apps/web/tamagui.config.ts`** — *create* — Tamagui runtime config with `pekulo-dark` + `pekulo-light` themes layered on `@tamagui/config/v5` (the v2 RC entry) + animations driver from `@tamagui/config/v5-css` — inputs: `./src/app/(spike)/tamagui-spike/tokens.ts`, outputs: a `createTamagui()` config + module-augmented `TamaguiCustomConfig` type.
- **`apps/web/src/app/(spike)/tamagui-spike/tokens.ts`** — *create* — pure TS data file holding the ported `pekuloColors` / `pekuloSpacing` / `pekuloRadius` tables — inputs: none, outputs: typed const exports consumed by both the config and the contrast test.
- **`apps/web/src/app/(spike)/tamagui-spike/provider.tsx`** — *create* — the SINGLE `'use client'` boundary holding `<TamaguiProvider>` + `useServerInsertedHTML` SSR wiring — inputs: `tamagui.config.ts`, outputs: a React component wrapping its children with Tamagui context.
- **`apps/web/src/app/(spike)/tamagui-spike/layout.tsx`** — *create* — RSC layout mounting the provider once for the spike subtree — inputs: `provider.tsx`, outputs: the spike subtree with Tamagui context attached.
- **`apps/web/src/app/(spike)/tamagui-spike/page.tsx`** — *create* — RSC sentinel page mounting `<ProtoSlice>`, used by AC-1 to verify NO `'use client'` is forced at the leaf — inputs: `proto-slice.tsx`, outputs: the rendered spike route.
- **`apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx`** — *create* — RSC component porting one HeroBlock surface from `docs/ux-preview/src/App.tsx` to Tamagui primitives, enforcing the strict-palette discipline (zero borders, emerald only on monetary delta) — inputs: Tamagui `Stack` / `Text` / `View`, outputs: a single rendered card.
- **`apps/web/src/app/(spike)/tamagui-spike/contrast.ts`** — *create* — pure WCAG 2.x luminance + contrast-ratio helpers, no DOM, no React, no Tamagui — inputs: hex strings, outputs: floats.
- **`apps/web/src/app/(spike)/tamagui-spike/contrast.test.ts`** — *create* — `bun:test` matrix asserting AA thresholds across `pekuloColors` for both themes, dumps `0-9-contrast-report.json` via `afterAll` — inputs: `tokens.ts` + `contrast.ts`, outputs: test results + JSON report.
- **`docs/spikes/0-9-contrast-report.json`** — *create (generated, committed)* — measurements artefact for AC-2 traceability — inputs: contrast test, outputs: a JSON file readable by humans and `aped-review`.
- **`docs/spikes/0-9-proto-slice-dark.png`** — *create (committed)* — screenshot evidence for AC-3 visual smoke — inputs: dev server + react-grab-mcp, outputs: a single PNG.
- **`docs/spikes/0-9-tamagui-decision.md`** — *create* — the decision document referenced by AC-4; sole owner of the green-light vs pivot verdict — inputs: T1–T5 measurements, outputs: a markdown file with table-formatted evidence and the chosen next action.

### Architecture pointers

- **ADR-0007** is the binding architecture decision — re-read `docs/adr/0007-design-system-tamagui-migration-now.md` § "Consequences" before T6.1 to make sure the "Pivot conditions" wording in the decision doc matches the ADR's wording. If the ADR has been edited since this story was drafted, the ADR wins.
- **Architecture L213–L215** locks Tamagui Core (MIT) as the cross-platform substrate; this spike does NOT re-evaluate the choice of Tamagui Core vs Tamagui Pro — that argument is closed.
- **Architecture L644–L649** is the migration discipline section. The phrase "Pre-flight spikes (Tamagui ↔ Next 16 RSC ; proto port ; WCAG contrast) MUST land before any feature story resumes" is what makes 0-9 a hard gate to 0-10.
- **W2 watch item** (`docs/architecture.md` L1143) is the load-bearing pivot trigger; T6.1 must reference W2 by name.

### Dependencies & version pinning

- Tamagui Core is pinned at the **exact** RC tag `2.0.0-rc.41` for all five packages (`tamagui` umbrella, `@tamagui/core` runtime, `@tamagui/next-plugin` build-time, `@tamagui/config` v5 default themes, `@tamagui/next-theme` SSR theme switching). Verified at story-write time via `npm view tamagui dist-tags` → `latest: 2.0.0-rc.41`. RC builds are pinned exact (no caret) because semver ranges over pre-release identifiers behave inconsistently and a silent jump to `rc.42` could ship a new breaking change mid-spike.
- The architecture's "Tamagui v2 compiler" reference (`docs/architecture.md` L283 etc.) is now **current**, not forward-looking — the v2 RC is the substrate this spike measures. Architecture wording predates the RC roll-out and remains accurate.
- v2 brings breaking changes from v1 that this story already absorbs: `@tamagui/config/v3` → `@tamagui/config/v5` (animation driver split into `@tamagui/config/v5-css`), `<Stack>` → `<View>` (the layout primitive was renamed; `View` is the only flex container in v2), `animation=` → `transition=` (irrelevant here — no transitions used), `$2xl`/`$2xs` → `$xxl`/`$xxs` (irrelevant here — no responsive breakpoint props used), `themeInverse` → `theme="accent"` (irrelevant here). T6.1's decision doc references this v1→v2 migration list when discussing build-time delta.
- `react-native-web@^0.19.13` is the peer Tamagui requires for the web target. Adding it does NOT pull React Native into the bundle — `react-native-web` is a stub layer Tamagui statically extracts to CSS at build time.
- **Pre-flight RC verification.** Before T1.1 stages anything, the dev runs `npm view tamagui dist-tags` and `npm view @tamagui/next-plugin dist-tags`. If `latest` has rolled past `rc.41`, update all five Tamagui pins atomically to the new tag and note the exact RC measured in T6.1. If the `latest` tag has graduated to a stable `2.0.0` (no more `-rc` suffix), switch the pins to `^2.0.0` (caret restored — semver works again on stable releases) and note the graduation in T6.1.

### Testing strategy

- The contrast test uses `bun:test` (Bun's built-in runner), NOT Vitest. Reason: Vitest is not yet wired into `apps/web` (per `docs/project-context.md` § "Test framework"); installing it in this story would balloon scope and conflict with story 0-12's own Vitest wiring choices. `bun test` runs pure TS without ceremony and is sufficient for the AC-2 contract.
- The visual smoke (T4.2) uses the existing `react-grab-mcp` instance loaded by `apps/web/src/app/layout.tsx` in dev mode. No new tooling.
- The build-time delta in T6.1 is informational only — not a gate. Capturing it lets 0-10 plan against a known baseline.

### Lessons applied

| Lesson | Application in this story |
| --- | --- |
| **L9** (Next.js workspaces — `typescript` per-package) | T1.1 keeps `typescript: "^6.0.3"` declared explicitly in `apps/web/devDependencies`. Tamagui peer deps are added without disturbing this line. T1.2 runs `bun --cwd apps/web run typecheck` to confirm the workspace resolves its own TS. |
| **L1** (Bun `--frozen-lockfile` workspace coverage) | Documented as non-applicable (Vercel handles `apps/web`, no Docker). Flagged in the lessons-enforced header so a future reviewer doesn't propose unnecessary Dockerfile changes. |
| **L8** (Prisma 7 `defineConfig` env-load) | Non-applicable — no Prisma changes. The existing CI workflow `DATABASE_URL` stub remains; T1's `bun install` triggers the `apps/api/postinstall: prisma generate`, which the stub already covers. |
| **L4 / L5** (oxlint quirks) | Non-applicable — no oxlint config changes in this story. Any new lint rules belong in 0-12. |
| **L7** (`bun --cwd <relative> run <script>` silent fail) | Story originally drafted with `bun --cwd apps/web run …` for typecheck / build / dev. On dev pickup the form was substituted to `bun --filter=web …` (workspace-aware, exit codes propagate) and a `test:contrast` script was added to `apps/web/package.json` so the contrast test runs the same way (`bun --filter=web test:contrast`). Patch logged in Debug Log below. |

### Pivot decision flow (cheat-sheet for T6.1)

```
AC-1 grep returns >1 match?         → Decision: pivot to A
                |
                v no
AC-2 any pair < threshold?           → Decision: pivot to A
                |
                v no
AC-3 grep returns any match?         → Decision: pivot to A
                |
                v no
T6.2 final smoke fails?              → Decision: HALT (do not commit T6 yet)
                |
                v no
                                     → Decision: green-light story 0-10
```

---

## Dev Agent Record

- **Model:** {{model used}}
- **Started:** {{timestamp}}
- **Completed:** {{timestamp}}

### Debug Log

- **2026-05-06 — Pre-T1 story patch (L7 enforcement).** Story body originally used `bun --cwd apps/web run <script>` six times (T1.2, T1.3, T2.3, T3.4, T4.2, T6.2) and `cd apps/web && bun test …` once (T5.3). L7 (2026-05-05) prescribes `--filter` or `cd && run` because `bun --cwd <relative>` silently exits 0 on path-resolution failure. Per user instruction "tout depuis la racine" + filter, all invocations were rewritten to `bun --filter=web run <script>` (workspace name = `web`, verified in `apps/web/package.json#name`). Bun's `--filter` form requires the explicit `run` keyword: `bun --filter=web build` invokes the `bun build` builtin (bundler) instead of the package.json script — verified live, expanded the L7 rule to "always include `run`". T1.1's `apps/web/package.json` block gained a `"test:contrast": "bun test src/app/(spike)/tamagui-spike/contrast.test.ts"` script so T5.3/T6.2 run via the same `--filter` form. Tamagui RC pin verified pre-patch: `npm view tamagui dist-tags` → `latest: 2.0.0-rc.41` (matches story spec, no atomic bump required).
- **2026-05-06 — T2.2 v2 API patch (no `createTheme`).** Story T2.2 originally imported `createTheme` from `@tamagui/core` and wrapped each theme literal in `createTheme({...})`. Verified live: `createTheme` is **not exported** from `@tamagui/core@2.0.0-rc.41` (`grep -r "createTheme" apps/web/node_modules/@tamagui` → zero hits). v2 dropped the helper — themes are plain objects mapping theme keys to color values, passed straight to `createTamagui`. Patched the actual `apps/web/tamagui.config.ts` (and the story body) to use the plain-object form `const pekuloDark = { background: …, … } as const;`. Reference: Tamagui v2 docs (Context7 `/websites/tamagui_dev`, `/docs/intro/themes` + `/docs/core/configuration`) — themes are plain `{ token: value }` maps, `createTokens` is the only helper. Typecheck under `bun --filter=web run typecheck` → exit 0.
- **2026-05-06 — T1.2 Turbopack pivot (no webpack plugin).** Story originally drafted T1.2 with `withTamagui` from `@tamagui/next-plugin`. On dev pickup the plugin failed under Next 16: it injects via `nextConfig.webpack` (verified in `node_modules/@tamagui/next-plugin/src/withTamagui.ts:8` — `import webpack from 'webpack'`), incompatible with the project's Turbopack-only stance. Two attempts surfaced the conflict: (1) `next build` raised `This build is using Turbopack, with a webpack config and no turbopack config`; (2) forcing `next build --webpack` then failed in esbuild because `tamagui.config.ts` was not yet created (T2 not started) — but the bigger blocker was the user instruction "pas de webpack dans le projet". Pivoted to the Turbopack-native wiring documented in `https://tamagui.dev/docs/guides/next-js` (verified via Context7 `/websites/tamagui_dev` + `/tamagui/tamagui` v1.141.5 — the official guide does NOT use the plugin): `transpilePackages` for Tamagui packages + `react-native-web`, `turbopack.resolveAlias['react-native']: 'react-native-web'`, `turbopack.resolveExtensions` for `.web.{ts,tsx,js,jsx}` priority. Dropped `@tamagui/next-plugin` from devDependencies. Smoke build under Turbopack: `✓ Compiled successfully in 2.8s`. The unrelated `@supabase/ssr: Your project's URL and API key are required` prerender failure on `/auth/login` was verified pre-existing (reproduces on HEAD pre-T1 via `git stash` — `web build: Error: @supabase/ssr…`) and is out of scope for this spike. Trade-off captured for T6.1: build-time CSS extraction (the plugin's value-add) is deferred to a future Tamagui release with Turbopack support; for V1 the runtime `useServerInsertedHTML` + `config.getCSS()` path covers the spike's AC-1/AC-2/AC-3 contract. Added `apps/web/.tamagui/` (Tamagui build cache) to `.gitignore`.

### Completion Notes

### File List
