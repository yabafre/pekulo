# Story: 0-10-pekulo-ui-migration — `@pekulo/ui` Tamagui DS migration

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** done
**Ticket:** [#10](https://github.com/yabafre/pekulo/issues/10)
**Branch:** `feature/10-0-10-pekulo-ui-migration`
**Commit prefix:** `feat(#10): ...` (or `chore(#10):` / `docs(#10):` / `test(#10):` / `refactor(#10):` / `build(#10):` per task type)
**Closes:** #10
**StepsCompleted:** 9/9 (T0–T8)
**Reference ADRs:** [ADR-0007 — Design system migrate apps/web to Tamagui Core now](../adr/0007-design-system-tamagui-migration-now.md), [ADR-0010 — Component → Hook → Server Action — hard orchestration boundary](../adr/0010-hooks-orchestration-boundary.md), [ADR-0011 — Packages reorg under @pekulo/* namespace](../adr/0011-packages-reorg-pekulo-namespace.md)
**Reference architecture sections:** `docs/architecture.md` L186–L224 (Frontend), L213 (UI primitives & DS), L329–L390 (Naming conventions, `Pekulo*` prefix), L477–L555 (Code Structure — `@pekulo/ui` tree at L870–L883), L539–L555 (Layering), L555–L558 (Test placement: `<comp>.snapshot.test.tsx` + `<comp>.a11y.test.tsx` co-located in `@pekulo/ui`), L600–L650 (Process Rules — Tamagui migration discipline), L1056–L1060 (Shared Code Inventory `@pekulo/ui`), L644–L649 (Tamagui migration discipline)
**Reference NFRs:** NFR-22 (WCAG 2.2 AA gating), NFR-23 (keyboard nav), NFR-24 (screen-reader labels), NFR-3 (Lighthouse ≥ 90 — soft target on `@pekulo/ui` shell, hard gate from feature epics onward)
**Reference watch items:** **W2** (resolved by 0-9, retrofit baseline inherited — see `docs/spikes/0-9-tamagui-decision.md` post-review revision), **`@pekulo/ui` lib overrides** (deferred from 0-1, resolved here in T0).
**Path:** **C — décommission brutale** (validated 2026-05-06 by Alex; see "Path C scope" in Dev Notes).

**Lessons enforced:**

- **L1 (2026-05-06, starter cross-check)** — inherited from 0-9's retrofit. The Tamagui spike route at `apps/web/src/app/(spike)/tamagui-spike/` IS the validated reference wire-up against `tamagui/starter-free`. This story extracts the spike artefacts into `@pekulo/ui` rather than re-deriving them from scratch. The three retrofit divergences already applied in 0-9 (slim `transpilePackages`, `dev: next dev`, `import "@tamagui/core/reset.css"`, `@tamagui/web` hoisted) are non-negotiable baselines and must remain in place after `apps/web/package.json` is rewritten in T7.1.
- **L6 (2026-05-05, typescript per-package)** — `packages/ui/package.json` MUST declare `typescript: "^6.0.3"` in `devDependencies` (matches `apps/web` and the version in `@pekulo/tsconfig`). Verified at T1.1 by `bun --filter='@pekulo/ui' run typecheck` exiting 0 on a fresh `bun install`.
- **L8 (2026-05-05, `bun --cwd` silent fail)** — Every cross-workspace invocation in this story uses either `bun --filter='@pekulo/ui' run <script>` (workspace-name addressed) or `cd packages/ui && bun run <script>` (relative-path with explicit `cd`). NEVER `bun --cwd packages/ui run <script>` — it silently exits 0.

**No-pivot discipline (sub-rule of L1, surfaced in 0-9 review):** This story does NOT introduce a new spike or verdict. AC-1/2/3/4 are objective gates; if any AC fails, the dev surfaces the failure to the user (not a unilateral pivot decision) and the story HALTs at T8 awaiting user direction.

---

## User Story

**As a** Pekulo developer, **I want** the `@pekulo/ui` package built on Tamagui Core 2.0.0-rc.41 with the `docs/ux-preview/src/tokens/` palette ported into `pekulo-dark` + `pekulo-light` themes, with all 30 component primitives + domain rows + shell affordances from the UX catalog (`docs/ux/components.md`) implemented as `Pekulo*` prefixed exports each carrying a colocated visual snapshot test and a vitest-axe a11y test, **and** with `apps/web` decommissioned of every Tailwind / shadcn / `@base-ui/react` dependency (Path C — feature routes deleted, dashboard reduced to a Pekulo-themed scaffold awaiting feature epics 1–9, auth flows ported onto `@pekulo/ui`, the spike subtree retired), **so that** every UI story in epics 1–9 + 11 has a single, stable, visually-validated, accessibility-validated component vocabulary and the `apps/web` repository is permanently free of the legacy DS layer that the architecture L213 mandates removed.

---

## Acceptance Criteria

- **AC-1 (Single styling surface in `apps/web`).** **Given** the `@pekulo/ui` package is built and `apps/web` has been migrated through T7, **When** the dev runs the audit script `bash scripts/check-no-tailwind.sh` from the repo root, **Then** the script exits 0 with output `apps/web is @pekulo/ui-only ✓` because (a) `apps/web/package.json` declares zero of the legacy deps `@base-ui/react` / `shadcn` / `tailwindcss` / `@tailwindcss/postcss` / `class-variance-authority` / `clsx` / `tailwind-merge` / `tailwindcss-animate` / `tw-animate-css`, (b) the files `apps/web/src/app/globals.css`, `apps/web/postcss.config.mjs`, `apps/web/components.json`, `apps/web/src/components/ui/`, `apps/web/src/components/auth-form.tsx`, `apps/web/src/components/theme-provider.tsx`, `apps/web/src/components/theme-toggle.tsx`, `apps/web/src/components/nav.tsx`, `apps/web/src/components/kpi-card.tsx`, `apps/web/src/components/phases.tsx`, `apps/web/src/components/detail-cards.tsx`, `apps/web/src/components/annual-table.tsx`, `apps/web/src/components/charts/` no longer exist, (c) the directory `apps/web/src/app/(spike)/` no longer exists, (d) the directories `apps/web/src/app/dashboard/{mensuel,parametres,portefeuille,transactions}/` no longer exist, (e) `grep -rE 'className=' apps/web/src` returns zero matches, and (f) the only files importing styling-related symbols are `apps/web/src/app/layout.tsx` (importing `@tamagui/core/reset.css` and the `@pekulo/ui` provider barrel) and `apps/web/src/components/providers.tsx` (re-exporting `@pekulo/ui`'s `<PekuloRootProvider>`).
- **AC-2 (Visual snapshot suite, every export covered).** **Given** the `@pekulo/ui` public surface defined by `packages/ui/src/index.ts`, **When** the dev runs `bun --filter='@pekulo/ui' run test:visual` from the repo root, **Then** every named export listed in `packages/ui/src/index.ts` whose value is a React component (i.e. `Pekulo*` components, primitives `Section` / `HeaderAction` / `PekuloRootProvider`, animation hooks excluded since hooks are non-rendering) has at least one matching `*.snapshot.test.tsx` file under `packages/ui/src/`, the run exits 0, the output line `Snapshots:` reports `<N> matched, <M> written, 0 unmatched` with `<N> + <M>` equal to the number of `Pekulo*` + primitive component exports, and `git status` reports zero unstaged changes under `packages/ui/src/__snapshots__/` and zero unstaged changes inline (the snapshots are committed alongside the test files via `toMatchSnapshot()` and are therefore inline-strings under `*.snapshot.test.tsx`, not under a `__snapshots__/` directory).
- **AC-3 (a11y suite, zero serious violations).** **Given** the same `@pekulo/ui` public surface and the harness `renderWithTamagui()` provided by `packages/ui/test/setup.ts`, **When** the dev runs `bun --filter='@pekulo/ui' run test:axe` from the repo root, **Then** every `Pekulo*` component + primitive has a matching `*.a11y.test.tsx` file, the run exits 0, the output reports `<K>` total tests matching the count of `*.a11y.test.tsx` files, and the aggregate `axe.run()` result for every test reports zero violations of `impact: "serious"` or `impact: "critical"` (warnings of `impact: "moderate"` or `"minor"` are allowed but logged to stdout for the dev's awareness).
- **AC-4 (Build + typecheck + lint clean across the monorepo).** **Given** the migration through T7 and the test runs from AC-2/AC-3, **When** the dev runs `bun run typecheck` (root), `bun run lint` (root), `bun run build` (root, with `dotenv -c -e .env -e .env.local --` env loaded as in `package.json#scripts`), in that order, **Then** all three commands exit 0, the build output reports `apps/web` prerendering at least the public routes `/`, `/auth/login`, `/auth/signup`, `/dashboard` (the dashboard route is now a Pekulo-themed empty-state scaffold, not the brownfield page), the spike route `/tamagui-spike` is absent from the route table, and `curl -fsS -o /dev/null -w '%{http_code}' http://localhost:3000/tamagui-spike` returns `404` after `bun --filter=web run start` is run against the production build (verification step in T8.5).

## Tasks

- T0 — Resolve `@pekulo/ui` tsconfig override (deferred from 0-1) [AC: AC-4]
- T1 — `@pekulo/ui` foundation: deps, tokens, themes, Tamagui config [AC: AC-4]
- T2 — Test harness (vitest + happy-dom + RTL + axe + render helper) [AC: AC-2, AC-3]
- T3 — Animation hooks [AC: AC-3, AC-4]
- T4 — Provider + primitives (`Section`, `HeaderAction` — reference end-to-end) [AC: AC-1, AC-2, AC-3]
- T4-bis — Compound primitive wrappers (Tamagui sub-packages, shadcn-equivalent toolkit) [AC: AC-1, AC-2, AC-3]
- T5 — Cap dashboard components (12 components, each = 3 files: component + snapshot test + a11y test)
- T6 — Feature surface components (15 components)
- T7 — `apps/web` migration (Path C — décommission brutale) [AC: AC-1, AC-4]
- T8 — Verification matrix [AC: AC-1, AC-2, AC-3, AC-4]

## Dev Notes

### 1. Path C scope — what gets deleted, what survives

**Deleted (brownfield UI):**

- `apps/web/src/app/dashboard/page.tsx` (massive Tailwind+shadcn+Recharts dashboard) — replaced by a minimal Pekulo scaffold showing `<PekuloEmptyState>` "Tableau de bord en construction" until epics 1–7 fill it in.
- `apps/web/src/app/dashboard/loading.tsx` (shadcn skeleton grid) — replaced by `<PekuloSkeleton>` lines.
- `apps/web/src/app/dashboard/{mensuel,parametres,portefeuille,transactions}/` (full subtrees) — `git rm -rf` ; routes will be re-added per feature epic. Their server-side data layer survives intact (see "Surviving" below) so re-wiring is mechanical.
- `apps/web/src/components/{ui,charts}/` — all shadcn primitives (Button, Input, Label, Card, Skeleton, …) and Recharts wrappers (capital-chart, budget-chart, scenario-chart, revenu-chart, annual-chart) deleted.
- `apps/web/src/components/{annual-table,auth-form,detail-cards,kpi-card,nav,phases,theme-provider,theme-toggle}.tsx` — all brownfield UI deleted.
- `apps/web/src/app/globals.css` — Tailwind + shadcn CSS vars file deleted (replaced by `@tamagui/core/reset.css` import in `apps/web/src/app/layout.tsx` only).
- `apps/web/postcss.config.mjs`, `apps/web/components.json` — deleted.
- `apps/web/src/app/(spike)/` — entire spike subtree deleted (the `/tamagui-spike` route is decommissioned ; AC-4 verifies 404).
- `apps/web/tamagui.config.ts`, `apps/web/tamagui.build.ts`, `apps/web/public/tamagui.generated.css` — moved into `packages/ui/` (the package becomes the home for the Tamagui config + CLI build artefact).

**Surviving untouched (server-side, data layer, supabase wiring):**

- `apps/web/src/lib/{supabase,zapaction,services,data,derive*,hooks,actions,stores,llm,otel,types,config}.ts` and subdirs — server-only logic, derives, services, supabase clients, zapaction context/keys. These will be re-consumed by feature epics 2-1 (accounts), 3-1 (holdings), 5-1 (transactions), 7-1 (dashboard) when they land.
- `apps/web/src/proxy.ts` — Supabase auth gate. Stays as-is ; the spike route allowlist line is removed in T7.8 since the spike route no longer exists.
- `apps/web/src/instrumentation.ts` + `apps/web/src/instrumentation.node.ts` — OTel SDK wiring (story 0-7). Untouched.
- `apps/web/next.config.ts` — already in starter-free baseline shape (T7.7 keeps it as-is, no edits required).

**Newly created (Pekulo scaffold):**

- `apps/web/src/app/dashboard/page.tsx` — minimal RSC page rendering `<PekuloEmptyState>` "Tableau de bord en construction. Reviens après la story 1-1." Uses `@pekulo/ui` exclusively.
- `apps/web/src/app/auth/login/page.tsx` + `signup/page.tsx` — re-implemented with Pekulo primitives + `<PekuloPressable>` button, supabase auth call retained.
- `apps/web/src/components/providers.tsx` — re-export `<PekuloRootProvider>` from `@pekulo/ui` and wrap with `<QueryClientProvider>`. ThemeProvider deleted (Tamagui owns theme state via `@tamagui/next-theme`).

### 2. File map — every file the story creates or modifies

#### `@pekulo/ui` package (new files)

| File path | Single responsibility | I/O |
|---|---|---|
| `packages/ui/package.json` | Declare Tamagui v2-rc.41 deps + scripts + exports for the package. | Imports nothing ; exports nothing (manifest). |
| `packages/ui/tsconfig.json` | Local tsconfig override granting DOM + `jsx-react` for the package (resolves the `@pekulo/ui` lib override watch item from 0-1). | Extends `@pekulo/tsconfig/packages.json`, overrides `compilerOptions.lib` + `jsx`. |
| `packages/ui/tamagui.config.ts` | Front-door for `@tamagui/cli` — re-exports `packages/ui/src/config/tamagui.ts` so the CLI's config-bundler (`@tamagui/cli`) can find it at the package root. | Imports `./src/config/tamagui` ; default-exports `config`. |
| `packages/ui/tamagui.build.ts` | `@tamagui/cli` build options pointing to `./public/tamagui.generated.css`. | Default-exports `TamaguiBuildOptions`. |
| `packages/ui/public/tamagui.generated.css` | Pre-generated atomic CSS for Pekulo themes/tokens (committed). | Generated by `bun --filter='@pekulo/ui' run generate:tamagui-css`. |
| `packages/ui/vitest.config.ts` | Vitest config for `@pekulo/ui` — happy-dom env, alias `@/`. | Imports `defineConfig` from `vitest/config`. |
| `packages/ui/test/setup.ts` | Vitest setup hook — installs `@testing-library/jest-dom`, axe matcher, exports `renderWithTamagui()` helper. | Imports `@testing-library/jest-dom/vitest`, `vitest-axe/extend-expect`, the package's own `<PekuloRootProvider>`. |
| `packages/ui/src/index.ts` | Public barrel — re-exports tokens, themes, primitives, hooks, components, types, provider. | Re-exports from `./tokens`, `./themes`, `./primitives/*`, `./animations/*`, `./components/*`, `./provider`. |
| `packages/ui/src/tokens/colors.ts` | TR-strict color palette (1:1 port of `apps/web/src/app/(spike)/tamagui-spike/tokens.ts#pekuloColors`). | Pure data, no React/Tamagui imports. |
| `packages/ui/src/tokens/spacing.ts` | Pekulo spacing scale (1:1 port of `pekuloSpacing` from spike). | Pure data. |
| `packages/ui/src/tokens/radius.ts` | Pekulo radius scale (1:1 port of `pekuloRadius` from spike). | Pure data. |
| `packages/ui/src/tokens/typography.ts` | Geist font stack + type scale (port of `docs/ux/design-spec.md` § 2.2). | Pure data. |
| `packages/ui/src/tokens/index.ts` | Token barrel. | Re-exports `./colors`, `./spacing`, `./radius`, `./typography`. |
| `packages/ui/src/themes/pekulo-dark.ts` | Tamagui theme map for `pekulo-dark` (port of spike `tamagui.config.ts#pekuloDark` + extra slots for components). | Imports `pekuloColors` ; exports `pekuloDark` const. |
| `packages/ui/src/themes/pekulo-light.ts` | Tamagui theme map for `pekulo-light` — kept in TS for runtime registration, but *not* registered in `createTamagui#themes` until the v2-rc.41 CLI selector-emission bug for two themes is fixed upstream. | Imports `pekuloColors` ; exports `pekuloLight` const. |
| `packages/ui/src/themes/index.ts` | Theme barrel. | Re-exports `./pekulo-dark`, `./pekulo-light`. |
| `packages/ui/src/config/tamagui.ts` | `createTamagui()` invocation — wires defaultConfig + animations-css driver + Pekulo themes/tokens. | Imports `@tamagui/config/v5`, `@tamagui/core`, local themes/tokens ; default-exports `config` + ambient-augments `@tamagui/core`. |
| `packages/ui/src/provider/index.tsx` | `<PekuloRootProvider>` + `<NextThemeProvider>` integration — the *single* client boundary consumers must mount. | Imports `tamagui`, `@tamagui/next-theme` ; exports `PekuloRootProvider`. |
| `packages/ui/src/animations/use-count-up.ts` | rAF-based count-up hook honouring `prefers-reduced-motion`. | Imports `react` only. |
| `packages/ui/src/animations/use-stagger.ts` | rAF-based stagger-delay hook honouring `prefers-reduced-motion`. | Imports `react` only. |
| `packages/ui/src/animations/use-count-up.test.ts` | Vitest unit test for the hook. | — |
| `packages/ui/src/animations/use-stagger.test.ts` | Vitest unit test for the hook. | — |
| `packages/ui/src/primitives/Section.tsx` | The single section container primitive (uniform `bg-card p-5/6 rounded-xl`). | Imports `tamagui`, `react` ; exports `Section`. |
| `packages/ui/src/primitives/Section.snapshot.test.tsx` | HTML snapshot test for `<Section>`. | — |
| `packages/ui/src/primitives/Section.a11y.test.tsx` | vitest-axe test for `<Section>`. | — |
| `packages/ui/src/primitives/HeaderAction.tsx` | Inline pill button for section actions. | Imports `tamagui`, `lucide-react` ; exports `HeaderAction`. |
| `packages/ui/src/primitives/HeaderAction.snapshot.test.tsx` + `.a11y.test.tsx` | Tests. | — |
| `packages/ui/src/components/PekuloDonut.tsx` (+ tests) | TR-style ring with white stroke on dim track, animated sweep. | — |
| `packages/ui/src/components/PekuloHero.tsx` (+ tests) | Big patrimoine number + delta vs plan (`HeroBlock` — port from spike `proto-slice.tsx`). | — |
| `packages/ui/src/components/PekuloKpiTile.tsx` (+ tests) | Mobile mini-KPI card. | — |
| `packages/ui/src/components/PekuloMilestoneRow.tsx` (+ tests) | Palier row with mini-donut + status. | — |
| `packages/ui/src/components/PekuloCompositionRow.tsx` (+ tests) | Wealth-class row (mini-donut + label + amount + percent). | — |
| `packages/ui/src/components/PekuloTrajectoryChart.tsx` (+ tests) | Inline-SVG line chart (actual + plan). | — |
| `packages/ui/src/components/PekuloProjectionChart.tsx` (+ tests) | Hypothesis 2026→2055 projection vs cap-required. | — |
| `packages/ui/src/components/PekuloHypothesisVerdict.tsx` (+ tests) | Verdict text + signed delta at cap year. | — |
| `packages/ui/src/components/PekuloUserDot.tsx` (+ tests) | Avatar circle. | — |
| `packages/ui/src/components/PekuloNavRail.tsx` (+ tests) | Floating sidebar bubble (lg+ only). | — |
| `packages/ui/src/components/PekuloTopTabToggle.tsx` (+ tests) | Cap / Patrimoine bold-vs-dim text toggle. | — |
| `packages/ui/src/components/PekuloContextualAddButton.tsx` (+ tests) | Mobile-only primary "+" button. | — |
| `packages/ui/src/components/PekuloAccountRow.tsx` (+ tests) | Per-account row. | — |
| `packages/ui/src/components/PekuloHoldingRow.tsx` (+ tests) | Per-holding row with PnL. | — |
| `packages/ui/src/components/PekuloClassRow.tsx` (+ tests) | ETF/Actions/Crypto repartition row. | — |
| `packages/ui/src/components/PekuloPropertyCard.tsx` (+ tests) | Real-estate property card. | — |
| `packages/ui/src/components/PekuloSuggestionRow.tsx` (+ tests) | LLM-pending transaction row. | — |
| `packages/ui/src/components/PekuloActivityRow.tsx` (+ tests) | Confirmed transaction row. | — |
| `packages/ui/src/components/PekuloMonthlyRow.tsx` (+ tests) | Mois passé row. | — |
| `packages/ui/src/components/PekuloStat.tsx` (+ tests) | Reusable label + value pair with optional tone. | — |
| `packages/ui/src/components/PekuloSettingRow.tsx` (+ tests) | Settings label + value/sub + action. | — |
| `packages/ui/src/components/PekuloToggleRow.tsx` (+ tests) | iOS-style toggle row. | — |
| `packages/ui/src/components/PekuloSegmentedControl.tsx` (+ tests) | Generic typed segmented control. | — |
| `packages/ui/src/components/PekuloEmptyState.tsx` (+ tests) | First-run / no-results presentation. | — |
| `packages/ui/src/components/PekuloSkeleton.tsx` (+ tests) | Loading placeholder. | — |
| `packages/ui/src/components/PekuloErrorBoundary.tsx` (+ tests) | React-19 error boundary using `react-error-boundary` patterns inline (no new dep). | — |
| `packages/ui/src/components/PekuloToast.tsx` (+ tests) + `useToast.ts` + `PekuloToastViewport.tsx` | Toast hook + viewport. | — |

#### `apps/web` (modified or deleted)

| File path | Action | Single responsibility (after change) |
|---|---|---|
| `apps/web/package.json` | Modified | Strip Tailwind/shadcn/`@base-ui/react` deps + Tamagui deps (Tamagui now lives in `@pekulo/ui`); add `@pekulo/ui: workspace:*`. |
| `apps/web/src/app/layout.tsx` | Modified | Mount `<PekuloRootProvider>` from `@pekulo/ui` ; keep the noscript theme-bootstrap script ; import `@tamagui/core/reset.css` + the package's pre-generated CSS. |
| `apps/web/src/components/providers.tsx` | Modified | Re-export `<PekuloRootProvider>` wrapped with `<QueryClientProvider>`. |
| `apps/web/src/app/auth/login/page.tsx` | Modified | Renders `<PekuloAuthForm mode="login" />` (new auth-form ported to Pekulo primitives). |
| `apps/web/src/app/auth/signup/page.tsx` | Modified | Same, `mode="signup"`. |
| `apps/web/src/components/auth-form.tsx` | Replaced | `PekuloAuthForm` rebuilt on `@pekulo/ui` primitives. |
| `apps/web/src/app/dashboard/layout.tsx` | Modified | Auth gate retained ; `<Nav>` (legacy) removed in favour of an inline minimal Pekulo `<View>` shell — full nav lands in feature epic 1-4 (`compass-ui-cap`). |
| `apps/web/src/app/dashboard/page.tsx` | Modified | RSC scaffold rendering `<PekuloEmptyState>`. |
| `apps/web/src/app/dashboard/loading.tsx` | Modified | Pekulo `<PekuloSkeleton>` lines. |
| `apps/web/src/app/dashboard/{mensuel,parametres,portefeuille,transactions}/` | Deleted | — |
| `apps/web/src/app/globals.css` | Deleted | — |
| `apps/web/postcss.config.mjs` | Deleted | — |
| `apps/web/components.json` | Deleted | — |
| `apps/web/src/components/ui/` | Deleted (subtree) | — |
| `apps/web/src/components/{annual-table,detail-cards,kpi-card,nav,phases,theme-provider,theme-toggle}.tsx` | Deleted | — |
| `apps/web/src/components/charts/` | Deleted (subtree) | — |
| `apps/web/src/app/(spike)/` | Deleted (subtree) | — |
| `apps/web/tamagui.config.ts` | Deleted (moved to `packages/ui/`) | — |
| `apps/web/tamagui.build.ts` | Deleted (moved to `packages/ui/`) | — |
| `apps/web/public/tamagui.generated.css` | Deleted (regenerated under `packages/ui/public/`) | — |
| `apps/web/src/proxy.ts` | Modified | Remove the `/tamagui-spike` allowlist line (route no longer exists). |

#### Repo-root

| File path | Action | Responsibility |
|---|---|---|
| `package.json` (root) | Modified | Add proxy scripts `test:ui`, `test:ui:visual`, `test:ui:axe`, `generate:tamagui-css` using `bun --filter='@pekulo/ui'` (L8 discipline). |
| `scripts/check-no-tailwind.sh` | New | AC-1 audit script — exit-1 on any forbidden import or class. |

### 3. Step-0 quote — verbatim source state at write time

#### `packages/ui/package.json` (current)

```json
{
  "name": "@pekulo/ui",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo Design System (Tamagui Core) — placeholder; real DS lands in story 0-10 per ADR-0007.",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*"
  }
}
```

#### `packages/ui/tsconfig.json` (current)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

This excludes `.tsx` from `include` — must add `.tsx` glob in T0.

#### `packages/ui/src/index.ts` (current)

```ts
// Placeholder for @pekulo/ui. Real Tamagui-backed Pekulo Design System lands
// in story 0-10 (ADR-0007); tokens ported from docs/ux-preview/src/tokens/.
export {};
```

#### `packages/tsconfig/packages.json` (current — for reference, do NOT edit)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "noEmit": true,
    "declaration": true
  }
}
```

This preset exposes `lib: ["esnext"]` — no DOM, no jsx. The `@pekulo/ui` local override in T0 adds `["dom", "esnext"]` + `jsx: "react-jsx"`.

#### `apps/web/package.json` (current — relevant excerpts; full file in T7.1 patch)

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun --bun next dev",
    "build": "bun --bun next build",
    "generate:tamagui-css": "tamagui generate-css && bun run fix:tamagui-css",
    "fix:tamagui-css": "sed -i '' -e 's/^     {/:root {/g' -e 's/^, \\.tm_/:root, .tm_/g' public/tamagui.generated.css",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test:contrast": "bun test 'src/app/(spike)/tamagui-spike/contrast.test.ts'"
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
    "@tamagui/web": "2.0.0-rc.41",
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
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@tailwindcss/postcss": "^4",
    "@tamagui/cli": "2.0.0-rc.41",
    "@types/bun": "^1.3.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

To remove in T7.1: `@base-ui/react`, `@tamagui/config`, `@tamagui/core`, `@tamagui/next-theme`, `@tamagui/web`, `class-variance-authority`, `clsx`, `react-native-web`, `shadcn`, `tailwind-merge`, `tailwindcss-animate`, `tamagui`, `tw-animate-css`, `@tailwindcss/postcss`, `@tamagui/cli`. To add: `@pekulo/ui: workspace:*`. The web app no longer transpiles Tamagui directly — it consumes the package's pre-built ESM and pre-generated CSS.

#### `apps/web/src/app/layout.tsx` (current)

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "@tamagui/core/reset.css";
import "../../public/tamagui.generated.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Pekulo", template: "%s · Pekulo" },
  description: "Pekulo — pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
  applicationName: "Pekulo",
  keywords: ["pekulo", "plan financier", "épargne", "projection", "portefeuille", "ETF", "PEA"],
  authors: [{ name: "Pekulo" }],
  openGraph: { type: "website", locale: "fr_FR", siteName: "Pekulo", title: "Pekulo", description: "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses." },
  twitter: { card: "summary", title: "Pekulo", description: "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses." },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (!t || t === 'system') {
              t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            if (t === 'dark') document.documentElement.classList.add('dark');
          } catch (e) {}
        ` }} />
        {process.env.NEXT_PUBLIC_REACT_GRAB === "1" && (
          <Script src="//unpkg.com/react-grab/dist/index.global.js" crossOrigin="anonymous" strategy="beforeInteractive" />
        )}
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

T7.2 keeps the metadata + the noscript theme-bootstrap script (it remains useful — Tamagui's `data-theme` attribute is set on first paint by `<NextThemeProvider>`, but the script avoids the SSR-hydration flash). The `body className` and `globals.css` import are removed.

#### `apps/web/src/components/providers.tsx` (current)

```tsx
"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import "@/lib/zapaction/keys";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
```

T7.2 replaces `<ThemeProvider>` (legacy localStorage-based) with `<PekuloRootProvider>` from `@pekulo/ui`. The QueryClient + zapaction-keys import are retained.

#### `apps/web/src/app/(spike)/tamagui-spike/tokens.ts` (current — full file)

(See Step-0 quote in conversation transcript ; reproduced as the canonical source for `packages/ui/src/tokens/colors.ts` in T1.2.)

Key facts:

- `pekuloColors.dark.surface.{bg=#000000, card=#0a0a0a, elevated=#121212, muted=#161616}` and the corresponding light values come from `docs/ux-preview/src/index.css` (the runtime SSOT — see feedback memory `feedback_ssot_ux_preview`).
- `pekuloColors.dark.text.{primary=#ededed, secondary=#a1a1a1, tertiary=#707070, muted=#4d4d4d}` ; light mirrors with `{#0a0a0a, #404040, #737373, #a3a3a3}`.
- `pekuloColors.{dark,light}.accent.500 = {#00d26a, #00a852}` (the only chromatic accent ; perf-delta only).
- `pekuloColors.{dark,light}.semantic.{success, warning, danger, info}` — `success === accent` ; `warning` has no TR equivalent (kept for Tamagui slot completeness, surfaced in `<PekuloToast>` only) ; `danger === loss` (`#ff5c5c` / `#dc2626`) ; `info === data-blue` (`#2f73ff`).
- `pekuloSpacing` and `pekuloRadius` from the same file.

#### `apps/web/tamagui.config.ts` (current — full file in conversation Step-0; relevant excerpt)

The current config registers ONLY `pekulo-dark` in `themes:` because of the `@tamagui/cli` v2-rc.41 selector-emission bug for two custom-named themes. T1.5 carries the same constraint forward — `pekulo-light` lives in TS, exercised only by the contrast test, never registered in `createTamagui`. When a future Tamagui RC ships a fix, the dual-theme registration is a one-line change.

#### `apps/web/src/components/auth-form.tsx` (current — full Tailwind+shadcn version)

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else { setSuccess("Compte créé. Vérifie tes emails pour confirmer."); setLoading(false); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
      else { router.push("/dashboard"); router.refresh(); return; }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Pekulo</CardTitle>
          <CardDescription>{mode === "login" ? "Connecte-toi à ton dashboard" : "Crée ton compte"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.fr" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-muted-foreground">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer un compte"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? (<>Pas de compte ? <Link href="/auth/signup" className="text-primary hover:underline">S'inscrire</Link></>) : (<>Déjà un compte ? <Link href="/auth/login" className="text-primary hover:underline">Se connecter</Link></>)}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

T7.4 replaces this verbatim with a Pekulo-primitive version. The `supabase.auth.{signUp,signInWithPassword}()` calls + the error mapping + the `router.push("/dashboard"); router.refresh()` are preserved verbatim.

### 4. Test conventions — patterns referenced by every component task

#### 4.1 Snapshot test pattern (HTML stable across OS)

Snapshots use Vitest's inline `toMatchSnapshot()` against `container.innerHTML` (HTML strings, deterministic across Mac local + Linux CI — the visual PNG suite is deferred to story `10-1-visual-snapshot-suite`). Every component snapshot test follows this exact shape (substitute `<Component>` and `<defaultProps>`):

```tsx
import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup";
import { <Component> } from "./<Component>";

describe("<Component> snapshot", () => {
  it("renders default state", () => {
    const { container } = renderWithTamagui(<<Component> <defaultProps> />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  // Per-component variants (see each component task for the variant list).
});
```

The `renderWithTamagui()` helper wraps `render()` from `@testing-library/react` with `<PekuloRootProvider>` so theme tokens resolve in the test DOM.

#### 4.2 a11y test pattern

```tsx
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../test/setup";
import { <Component> } from "./<Component>";

describe("<Component> a11y", () => {
  it("has no serious or critical violations", async () => {
    const { container } = renderWithTamagui(<<Component> <defaultProps> />);
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
```

For interactive components (`<HeaderAction>`, `<PekuloPressable>`, `<PekuloToggleRow>`, `<PekuloSegmentedControl>`, `<PekuloContextualAddButton>`), an additional keyboard-nav test is required (focus + activate via Enter + Space):

```tsx
it("activates via keyboard (Enter + Space)", async () => {
  const onPress = vi.fn();
  const { getByRole } = renderWithTamagui(<<Component> onPress={onPress} ... />);
  const el = getByRole("button");
  el.focus();
  expect(document.activeElement).toBe(el);
  fireEvent.keyDown(el, { key: "Enter" });
  fireEvent.keyDown(el, { key: " " });
  expect(onPress).toHaveBeenCalledTimes(2);
});
```

### 5. Animation conventions

`@tamagui/config/v5-css` provides the `animations-css` driver (zero JS runtime, RSC-safe, honours `prefers-reduced-motion` natively via CSS `@media`). Use it for any component that animates on mount, hover, focus, or value change. The two custom hooks below replace Framer Motion's `useMotionValue` / `useSpring` / `motion.div` patterns:

- `useCountUp(target, opts?)` — returns the currently-animated number, ticking via `requestAnimationFrame`. `opts.durationMs` defaults `800`. Returns `target` immediately when `prefers-reduced-motion: reduce` is set.
- `useStagger(itemCount, delayMs?)` — returns an array of per-item `delayMs` values (0, delayMs, 2·delayMs, …). Returns `[0, 0, …]` when reduced motion is set.

Both are pure `useEffect` + `requestAnimationFrame` ; no external dep added.

### 6. Tamagui v2-rc.41 wire-up — non-negotiable baselines (from 0-9 retrofit)

1. **`<TamaguiProvider config={...} disableInjectCSS disableRootThemeClass>`** — `disableInjectCSS` because the package ships a pre-generated CSS file that consumers import ; `disableRootThemeClass` because the theme class is set by `<NextThemeProvider>` on `<html>` via `data-theme`.
2. **`<NextThemeProvider skipNextHead defaultTheme="pekulo-dark" themes={["pekulo-light", "pekulo-dark"]}>`** — `skipNextHead` because Next 16 RSC + `<html>` already lives in the root layout ; `themes` MUST be passed explicitly (omitting it defaults to `["light", "dark"]` and the `data-theme` never matches Pekulo's custom names).
3. **Single client boundary** — only `<PekuloRootProvider>` is `"use client"`. Every Tamagui-consuming component gets `"use client"` at its top (Tamagui's runtime context model on v2-rc.41 prevents RSC-rendering of `<View>`/`<Text>`).
4. **`@tamagui/web` peer dep** — must be a direct dep of `@pekulo/ui` (not pulled transitively) so `@tamagui/cli`'s config bundler can resolve it through `packages/ui/node_modules`. Same reason as the spike.
5. **`fix:tamagui-css` sed post-process** — keeps the two RC emit-bug workarounds (`prefers-color-scheme:light` empty selector, leading-comma `, .tm_xxt` selector). These are upstream Tamagui RC bugs ; the workaround is documented in the script header.
6. **Single registered theme** — `pekulo-dark` only is registered in `createTamagui#themes`. `pekulo-light` lives in TS (`packages/ui/src/themes/pekulo-light.ts`) for the contrast tests + future re-registration when the CLI bug is fixed. Surfaces `<Text color={...}>` against `pekulo-light` go through media queries in the generated CSS, NOT through Tamagui's runtime theme switcher.
7. **Slim `transpilePackages` in `apps/web/next.config.ts`** — `["@tamagui/next-theme", "react-native-web"]` only. `@pekulo/ui` itself ships pre-built (the package's `exports` map points at `./src/index.ts` for now ; a future story may add a build step, but for V1 perso Bun + Turbopack handle TS source workspaces natively).

### 7. Dependencies summary

`packages/ui/package.json` deps after T1.1:

- **`tamagui@2.0.0-rc.41`** + **`@tamagui/core@2.0.0-rc.41`** + **`@tamagui/config@2.0.0-rc.41`** + **`@tamagui/next-theme@2.0.0-rc.41`** + **`@tamagui/web@2.0.0-rc.41`** + **`@tamagui/animations-css@2.0.0-rc.41`** — exact pins, all five, atomic if a newer RC ships (verify `npm view tamagui dist-tags` per Pekulo `feedback_verify_npm_versions`).
- **`react@19.2.4`** + **`react-dom@19.2.4`** — peer deps, exact pin matching `apps/web`.
- **`react-native-web@^0.19.13`** — peer for Tamagui's RN-Web compat.
- **`lucide-react@^1.11.0`** — sole icon family.

`packages/ui/devDependencies`:

- **`@pekulo/tsconfig: workspace:*`** — already present.
- **`@types/react@^19`** + **`@types/react-dom@^19`** + **`@types/node@^20`** — types.
- **`@types/bun@^1.3.0`** — for bun globals in test setup.
- **`@tamagui/cli@2.0.0-rc.41`** — moved here from `apps/web` (the package owns CSS generation now).
- **`typescript@^6.0.3`** — L6.
- **`vitest@^2.0.0`** + **`happy-dom@^15.0.0`** + **`@testing-library/react@^16.0.0`** + **`@testing-library/jest-dom@^6.0.0`** + **`vitest-axe@^0.1.0`** — test stack.

`apps/web/package.json` deps after T7.1 — see the full patch in T7.1.

### 8. Layering rules to honour

- **`@pekulo/ui` is the sole styling surface** for `apps/web` (architecture L541) — enforced after T7 by `bash scripts/check-no-tailwind.sh` and (story 0-12) by oxlint rule `no-tailwind-outside-ui`.
- **No deep relatives beyond `../../`** within `@pekulo/ui`. Use the package's own barrel + relative imports within the src tree. (architecture L547)
- **`Pekulo*` prefix on top-level domain primitives** ; sub-parts unprefixed (architecture L364). E.g. `<PekuloDonut>` is the export ; if a sub-part `Donut.Track` is needed, it stays unprefixed.
- **`Section` and `HeaderAction` are unprefixed** because they are framework-agnostic primitives, not domain primitives (matches architecture's separation of "primitives" vs "domain components" at L873-L883).

---

### Implementation history

_Preserved verbatim from the pre-6.3.0 Tasks section._

> Each task is a self-contained unit ≤ 5 min for the dev. The dev MUST run the listed test command after edits and confirm the expected output before committing. Commit prefix is `feat(#10):` for new code, `chore(#10):` for config/scripts, `docs(#10):` for prose, `test(#10):` for tests-only changes, `refactor(#10):` for moves/renames, `build(#10):` for build artefacts (e.g. regenerated CSS).

### T0 — Resolve `@pekulo/ui` tsconfig override (deferred from 0-1) [AC: AC-4]

- [ ] **T0.1** — Replace `packages/ui/tsconfig.json` with the override below (adds `dom` to `lib`, `jsx: "react-jsx"`, and includes `.tsx` files in addition to `.ts`):

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

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0, no output (the source is still `export {};` — typecheck is trivially clean ; verifies the new tsconfig parses and applies).
  Commit: `git add packages/ui/tsconfig.json && git commit -m "chore(#10): resolve @pekulo/ui tsconfig override (DOM + jsx-react)"`

---

### T1 — `@pekulo/ui` foundation: deps, tokens, themes, Tamagui config [AC: AC-4]

- [ ] **T1.1** — Replace `packages/ui/package.json` with the manifest below. Tamagui RC is exact-pinned (`feedback_verify_npm_versions`: verify `npm view tamagui dist-tags` first ; if `latest` has rolled past `2.0.0-rc.41`, atomically bump all six Tamagui pins together).

  ```json
  {
    "name": "@pekulo/ui",
    "version": "0.0.0",
    "private": true,
    "description": "Pekulo Design System on Tamagui Core (ADR-0007). Sole styling surface for apps/web and apps/mobile (V1.5).",
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
      ".": "./src/index.ts",
      "./reset.css": "./node_modules/@tamagui/core/reset.css",
      "./generated.css": "./public/tamagui.generated.css"
    },
    "files": ["src", "public", "tamagui.config.ts", "tamagui.build.ts"],
    "scripts": {
      "typecheck": "tsc --noEmit",
      "test": "vitest run",
      "test:visual": "vitest run --testNamePattern='snapshot'",
      "test:axe": "vitest run --testNamePattern='a11y'",
      "test:watch": "vitest",
      "generate:tamagui-css": "tamagui generate-css && bun run fix:tamagui-css",
      "fix:tamagui-css": "sed -i '' -e 's/^     {/:root {/g' -e 's/^, \\.tm_/:root, .tm_/g' public/tamagui.generated.css"
    },
    "dependencies": {
      "@tamagui/animations-css": "2.0.0-rc.41",
      "@tamagui/avatar": "2.0.0-rc.41",
      "@tamagui/checkbox": "2.0.0-rc.41",
      "@tamagui/config": "2.0.0-rc.41",
      "@tamagui/core": "2.0.0-rc.41",
      "@tamagui/dialog": "2.0.0-rc.41",
      "@tamagui/next-theme": "2.0.0-rc.41",
      "@tamagui/popover": "2.0.0-rc.41",
      "@tamagui/progress": "2.0.0-rc.41",
      "@tamagui/radio-group": "2.0.0-rc.41",
      "@tamagui/select": "2.0.0-rc.41",
      "@tamagui/separator": "2.0.0-rc.41",
      "@tamagui/sheet": "2.0.0-rc.41",
      "@tamagui/slider": "2.0.0-rc.41",
      "@tamagui/switch": "2.0.0-rc.41",
      "@tamagui/tooltip": "2.0.0-rc.41",
      "@tamagui/web": "2.0.0-rc.41",
      "lucide-react": "^1.11.0",
      "react-native-web": "^0.19.13",
      "tamagui": "2.0.0-rc.41"
    },
    "peerDependencies": {
      "react": "19.2.4",
      "react-dom": "19.2.4"
    },
    "devDependencies": {
      "@pekulo/tsconfig": "workspace:*",
      "@tamagui/cli": "2.0.0-rc.41",
      "@testing-library/jest-dom": "^6.0.0",
      "@testing-library/react": "^16.0.0",
      "@types/bun": "^1.3.0",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "happy-dom": "^15.0.0",
      "react": "19.2.4",
      "react-dom": "19.2.4",
      "typescript": "^6.0.3",
      "vitest": "^2.0.0",
      "vitest-axe": "^0.1.0"
    }
  }
  ```

  `react` and `react-dom` are duplicated in `peerDependencies` AND `devDependencies` intentionally — peer for consumers, dev for the test runner (lesson L6: workspaces must declare what they actually `import`).

  Note the `sed -i ''` form is **mac-specific** — on Linux CI runners, the GNU sed accepts `-i` without the `''` arg, which on Mac fails silently. The dev currently runs Mac (per `Platform: darwin` in `aped/config.yaml`); when CI for `@pekulo/ui` lands (story 10-1 at the latest), this script needs an OS-detection wrapper. For V1 perso, mac-only is fine. Story 10-1 (`visual-snapshot-suite`) will upstream the wrapper.

  Run: `bun install` (root)
  Expected: `Saved lockfile`, `+ <N> packages installed`, exit 0.
  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0 (still trivial — src/index.ts unchanged).
  Commit: `git add packages/ui/package.json bun.lock && git commit -m "feat(#10): @pekulo/ui deps — Tamagui v2-rc.41 + vitest stack"`

- [ ] **T1.2** — Create `packages/ui/src/tokens/colors.ts` (1:1 port of the spike `pekuloColors`, sole authoritative copy):

  ```ts
  // packages/ui/src/tokens/colors.ts
  // Pekulo design tokens — TR-strict (Trade Republic fidelity layer). Mirrors
  // docs/ux-preview/src/index.css (the runtime SSOT for ux-preview) and
  // docs/ux-preview/src/tokens/colors.ts (the typed TS mirror).
  //
  // Discipline contract (memory feedback_trade_republic_fidelity):
  //   - Background = pure #000 in dark, pure #FFF in light
  //   - Cards = barely darker than bg (no borders, no decoration)
  //   - Chrome (focus, neutral text) = grayscale only
  //   - Color (emerald/red) = reserved for performance deltas ONLY
  //
  // Pure data — no React, no Tamagui imports — so contrast tests, the Tamagui
  // config, and consumer code can all consume this file.

  export const pekuloColors = {
    dark: {
      surface: { bg: "#000000", card: "#0a0a0a", elevated: "#121212", muted: "#161616" },
      text: {
        primary: "#ededed",
        secondary: "#a1a1a1",
        tertiary: "#707070",
        muted: "#4d4d4d",
        // onAccent — text color on a gain (#00d26a) surface. TR doesn't put text
        // on emerald, but Tamagui's theme slot needs a value. #000 = max contrast.
        onAccent: "#000000",
      },
      border: {
        default: "rgba(255, 255, 255, 0.10)",
        strong: "rgba(255, 255, 255, 0.16)",
        focus: "#ededed",
      },
      accent: { 500: "#00d26a", 400: "#00d26a" },
      semantic: {
        success: "#00d26a",
        warning: "#FBBF24",
        danger: "#ff5c5c",
        info: "#2f73ff",
      },
      // chart series — strict grayscale + 1 white actual line
      chart: {
        actual: "#ffffff",
        plan: "rgba(255, 255, 255, 0.32)",
        projection: "rgba(255, 255, 255, 0.16)",
        grid: "rgba(255, 255, 255, 0.06)",
      },
      donut: { track: "rgba(255, 255, 255, 0.08)", fill: "#ffffff" },
    },
    light: {
      surface: { bg: "#ffffff", card: "#fafafa", elevated: "#ffffff", muted: "#f2f2f2" },
      text: {
        primary: "#0a0a0a",
        secondary: "#404040",
        tertiary: "#737373",
        muted: "#a3a3a3",
        onAccent: "#ffffff",
      },
      border: {
        default: "rgba(0, 0, 0, 0.08)",
        strong: "rgba(0, 0, 0, 0.14)",
        focus: "#0a0a0a",
      },
      accent: { 500: "#00a852", 600: "#00a852" },
      semantic: {
        success: "#00a852",
        warning: "#D97706",
        danger: "#dc2626",
        info: "#2f73ff",
      },
      chart: {
        actual: "#0a0a0a",
        plan: "rgba(10, 10, 10, 0.32)",
        projection: "rgba(10, 10, 10, 0.16)",
        grid: "rgba(10, 10, 10, 0.06)",
      },
      donut: { track: "rgba(0, 0, 0, 0.08)", fill: "#0a0a0a" },
    },
  } as const;

  export type PekuloMode = keyof typeof pekuloColors;
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/tokens/colors.ts && git commit -m "feat(#10): port TR-strict color tokens to @pekulo/ui"`

- [ ] **T1.3** — Create `packages/ui/src/tokens/spacing.ts`, `radius.ts`, `typography.ts`, `index.ts`:

  ```ts
  // packages/ui/src/tokens/spacing.ts
  // Pekulo spacing scale — port from docs/ux-preview/src/tokens/spacing.ts.
  // Values are in pixels (Tamagui consumes them as raw numbers).

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
    16: 64,
    20: 80,
  } as const;
  ```

  ```ts
  // packages/ui/src/tokens/radius.ts
  // Pekulo radius scale — port from docs/ux-preview/src/index.css --radius-*.

  export const pekuloRadius = {
    none: 0,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  } as const;
  ```

  ```ts
  // packages/ui/src/tokens/typography.ts
  // Pekulo type scale — port from docs/ux/design-spec.md § 2.2.
  // Geist + Geist Mono ; weights 300/400/500/600/700.

  export const pekuloFonts = {
    sans: "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
  } as const;

  export const pekuloFontSizes = {
    "11": 11,
    caption: 13,
    bodySm: 14,
    body: 16,
    h3: 16,
    bodyLg: 17,
    h2: 20,
    h1: 26,
    display: 32,
    hero: 42,
  } as const;

  export const pekuloFontWeights = {
    light: "300",
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  } as const;

  export const pekuloLineHeights = {
    tight: 1.1,
    snug: 1.25,
    normal: 1.4,
    relaxed: 1.6,
  } as const;

  export const pekuloLetterSpacings = {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  } as const;
  ```

  ```ts
  // packages/ui/src/tokens/index.ts — token barrel
  export * from "./colors";
  export * from "./spacing";
  export * from "./radius";
  export * from "./typography";
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/tokens && git commit -m "feat(#10): port spacing/radius/typography tokens"`

- [ ] **T1.4** — Create `packages/ui/src/themes/pekulo-dark.ts`, `pekulo-light.ts`, `index.ts`:

  ```ts
  // packages/ui/src/themes/pekulo-dark.ts
  import { pekuloColors } from "../tokens/colors";

  export const pekuloDark = {
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
    borderDefault: pekuloColors.dark.border.default,
    borderStrong: pekuloColors.dark.border.strong,
    borderFocus: pekuloColors.dark.border.focus,
    chartActual: pekuloColors.dark.chart.actual,
    chartPlan: pekuloColors.dark.chart.plan,
    chartProjection: pekuloColors.dark.chart.projection,
    chartGrid: pekuloColors.dark.chart.grid,
    donutTrack: pekuloColors.dark.donut.track,
    donutFill: pekuloColors.dark.donut.fill,
  } as const;
  ```

  ```ts
  // packages/ui/src/themes/pekulo-light.ts
  // NOTE: NOT registered in createTamagui#themes due to @tamagui/cli@2.0.0-rc.41
  // selector-emission bug (see W2 spike T6, finding 3). Kept in TS for the
  // contrast tests + future re-registration when the CLI is fixed.
  import { pekuloColors } from "../tokens/colors";

  export const pekuloLight = {
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
    borderDefault: pekuloColors.light.border.default,
    borderStrong: pekuloColors.light.border.strong,
    borderFocus: pekuloColors.light.border.focus,
    chartActual: pekuloColors.light.chart.actual,
    chartPlan: pekuloColors.light.chart.plan,
    chartProjection: pekuloColors.light.chart.projection,
    chartGrid: pekuloColors.light.chart.grid,
    donutTrack: pekuloColors.light.donut.track,
    donutFill: pekuloColors.light.donut.fill,
  } as const;
  ```

  ```ts
  // packages/ui/src/themes/index.ts
  export * from "./pekulo-dark";
  export * from "./pekulo-light";
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/themes && git commit -m "feat(#10): pekulo-dark + pekulo-light theme maps"`

- [ ] **T1.5** — Create `packages/ui/src/config/tamagui.ts` + `packages/ui/tamagui.config.ts` (front-door for `@tamagui/cli`) + `packages/ui/tamagui.build.ts`:

  ```ts
  // packages/ui/src/config/tamagui.ts
  // createTamagui() invocation. Wires defaultConfig + animations-css driver
  // (web-only, RSC-safe, honours prefers-reduced-motion natively) + Pekulo
  // themes/tokens.
  //
  // Only `pekulo-dark` is registered in `themes:` due to the @tamagui/cli
  // v2-rc.41 selector-emission bug for two custom-named themes (finding 3
  // of W2 spike). `pekulo-light` exists in TS for the contrast tests +
  // future re-registration. When the CLI bug ships a fix, add
  // `"pekulo-light": pekuloLight` here in one line.
  import { defaultConfig } from "@tamagui/config/v5";
  import { animations } from "@tamagui/config/v5-css";
  import { createTamagui } from "@tamagui/core";

  import { pekuloDark } from "../themes/pekulo-dark";
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

  export type AppConfig = typeof config;

  declare module "@tamagui/core" {
    // biome-ignore lint/style/useNamingConvention: Tamagui module-augmentation contract
    interface TamaguiCustomConfig extends AppConfig {}
  }
  ```

  ```ts
  // packages/ui/tamagui.config.ts — front-door for @tamagui/cli's config bundler.
  // The CLI requires the config file at the package root ; the actual definition
  // lives in src/config/tamagui.ts.
  export { config as default } from "./src/config/tamagui";
  ```

  ```ts
  // packages/ui/tamagui.build.ts — @tamagui/cli build options.
  import type { TamaguiBuildOptions } from "@tamagui/core";

  export default {
    components: ["tamagui"],
    config: "./tamagui.config.ts",
    outputCSS: "./public/tamagui.generated.css",
  } satisfies TamaguiBuildOptions;
  ```

  Run: `mkdir -p packages/ui/public && bun --filter='@pekulo/ui' run generate:tamagui-css`
  Expected: file `packages/ui/public/tamagui.generated.css` exists with `--t0..--t<N>`, `--c-radius-*`, `--c-size-*`, `--c-space-*` CSS variables ; exit 0.
  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/config packages/ui/tamagui.config.ts packages/ui/tamagui.build.ts packages/ui/public/tamagui.generated.css && git commit -m "feat(#10): @pekulo/ui Tamagui config + pre-generated CSS"`

---

### T2 — Test harness (vitest + happy-dom + RTL + axe + render helper) [AC: AC-2, AC-3]

- [ ] **T2.1** — Create `packages/ui/vitest.config.ts`:

  ```ts
  // packages/ui/vitest.config.ts
  import { defineConfig } from "vitest/config";
  import { resolve } from "node:path";

  export default defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      setupFiles: ["./test/setup.ts"],
      css: true,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
  });
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0 (no test files yet so vitest skip).
  Commit: `git add packages/ui/vitest.config.ts && git commit -m "chore(#10): vitest config for @pekulo/ui (happy-dom env)"`

- [ ] **T2.2** — Create `packages/ui/test/setup.ts`:

  ```ts
  // packages/ui/test/setup.ts
  // Vitest setup hook for @pekulo/ui.
  // - Installs @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
  // - Installs vitest-axe matchers (toHaveNoViolations)
  // - Exports renderWithTamagui() — wraps render() with <PekuloRootProvider>
  //   so theme tokens resolve in the test DOM.
  //
  // Note: the import of "../public/tamagui.generated.css" makes the atomic
  // class definitions available to happy-dom — without it, computed-style
  // assertions (when later added) wouldn't see Pekulo tokens.

  import "@testing-library/jest-dom/vitest";
  import * as matchers from "vitest-axe/matchers";
  import { expect } from "vitest";
  import { render, type RenderOptions } from "@testing-library/react";
  import type { ReactElement, ReactNode } from "react";

  expect.extend(matchers);

  // Lazy import to avoid loading Tamagui at config-evaluation time.
  function PekuloTestProvider({ children }: { children: ReactNode }): ReactElement {
    // Imported inside the component so the module graph in vitest.config.ts
    // doesn't pull Tamagui into setup before happy-dom is ready.
    const { PekuloRootProvider } = require("../src/provider");
    return PekuloRootProvider({ children });
  }

  export function renderWithTamagui(ui: ReactElement, options?: RenderOptions) {
    return render(ui, { wrapper: PekuloTestProvider, ...options });
  }

  // Re-export common testing utilities for convenience.
  export { fireEvent, screen, waitFor } from "@testing-library/react";
  export { axe } from "vitest-axe";
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0 (provider barrel created in T4.0 below — until then typecheck passes thanks to `require()` runtime resolution + `as never` cast on the imported symbol).

  **Important caveat:** the `require("../src/provider")` form resolves at test-runtime, so the typecheck doesn't fail when `provider/` doesn't exist yet. Once `provider/index.tsx` lands in T4.0, this resolves naturally. The reason for `require()` over `import`: vitest's setupFiles run in the test worker after `vitest.config.ts` loads, and a top-level static import would force Tamagui to load before happy-dom is initialised, which causes "window is not defined" in Tamagui's media-query bootstrap.

  Commit: `git add packages/ui/test/setup.ts && git commit -m "test(#10): vitest setup with renderWithTamagui + axe matcher"`

- [ ] **T2.3** — Add proxy scripts to root `package.json`. Read the current root `package.json` first ; locate the `"scripts"` block ; add the four lines below alphabetically:

  ```json
  "test:ui": "bun --filter='@pekulo/ui' run test",
  "test:ui:visual": "bun --filter='@pekulo/ui' run test:visual",
  "test:ui:axe": "bun --filter='@pekulo/ui' run test:axe",
  "generate:tamagui-css": "bun --filter='@pekulo/ui' run generate:tamagui-css"
  ```

  L8 discipline: `bun --filter='<workspace-name>' run <script>` — never `bun --cwd <path> run <script>` (silent fail).

  Run: `bun run test:ui` (root)
  Expected: vitest output `No test files found, exiting with code 0` (no test files yet — added in T4.1+) ; exit 0.
  Commit: `git add package.json && git commit -m "chore(#10): root proxy scripts for @pekulo/ui test + css generation"`

---

### T3 — Animation hooks [AC: AC-3, AC-4]

- [ ] **T3.1** — Create `packages/ui/src/animations/use-count-up.ts`:

  ```ts
  // packages/ui/src/animations/use-count-up.ts
  // rAF-based count-up. Replaces framer-motion's useMotionValue + useSpring.
  // Returns the currently-animated number, ticking on requestAnimationFrame.
  // Returns the target immediately when prefers-reduced-motion: reduce is set.
  //
  // Pure React + DOM ; no external deps.

  import { useEffect, useRef, useState } from "react";

  export interface UseCountUpOptions {
    /** Animation duration in milliseconds. Default 800. */
    durationMs?: number;
    /** Easing function (t in [0, 1] → eased t). Default: ease-out cubic. */
    easing?: (t: number) => number;
  }

  const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

  export function useCountUp(target: number, opts: UseCountUpOptions = {}): number {
    const { durationMs = 800, easing = easeOutCubic } = opts;
    const [value, setValue] = useState(target);
    const fromRef = useRef(target);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
      if (typeof window === "undefined") {
        setValue(target);
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setValue(target);
        fromRef.current = target;
        return;
      }

      const from = fromRef.current;
      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = easing(t);
        const next = from + (target - from) * eased;
        setValue(next);
        if (t < 1) {
          rafRef.current = window.requestAnimationFrame(tick);
        } else {
          fromRef.current = target;
          rafRef.current = null;
        }
      };

      rafRef.current = window.requestAnimationFrame(tick);

      return () => {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, [target, durationMs, easing]);

    return value;
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/animations/use-count-up.ts && git commit -m "feat(#10): useCountUp hook (rAF, prefers-reduced-motion aware)"`

- [ ] **T3.2** — Create `packages/ui/src/animations/use-count-up.test.ts`:

  ```ts
  // packages/ui/src/animations/use-count-up.test.ts
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  import { renderHook, act } from "@testing-library/react";
  import { useCountUp } from "./use-count-up";

  describe("useCountUp", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Default: prefers-reduced-motion NOT set (animation runs).
      window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("returns target immediately when prefers-reduced-motion: reduce", () => {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
      const { result } = renderHook(() => useCountUp(100));
      expect(result.current).toBe(100);
    });

    it("starts at the initial target on first render", () => {
      const { result } = renderHook(() => useCountUp(50));
      expect(result.current).toBe(50);
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/animations/use-count-up.test.ts`
  Expected: `Tests  2 passed`, exit 0.
  Commit: `git add packages/ui/src/animations/use-count-up.test.ts && git commit -m "test(#10): useCountUp — reduced-motion + initial target"`

- [ ] **T3.3** — Create `packages/ui/src/animations/use-stagger.ts`:

  ```ts
  // packages/ui/src/animations/use-stagger.ts
  // Computes per-item delays for a staggered list animation. Returns
  // [0, delayMs, 2·delayMs, ...] under normal motion ; [0, 0, ...] under
  // prefers-reduced-motion: reduce.
  //
  // The component consuming this hook applies the delays via Tamagui's
  // `enterStyle` + `animation` props (animations-css driver).

  import { useMemo, useSyncExternalStore } from "react";

  function getReducedMotion(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function subscribeReducedMotion(cb: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }

  export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
      subscribeReducedMotion,
      getReducedMotion,
      () => false /* SSR-safe default */,
    );
  }

  export function useStagger(itemCount: number, delayMs = 40): number[] {
    const reduced = usePrefersReducedMotion();
    return useMemo(() => {
      if (reduced) return Array.from({ length: itemCount }, () => 0);
      return Array.from({ length: itemCount }, (_, i) => i * delayMs);
    }, [itemCount, delayMs, reduced]);
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/animations/use-stagger.ts && git commit -m "feat(#10): useStagger + usePrefersReducedMotion hooks"`

- [ ] **T3.4** — Create `packages/ui/src/animations/use-stagger.test.ts`:

  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { renderHook } from "@testing-library/react";
  import { useStagger } from "./use-stagger";

  describe("useStagger", () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
    });

    it("returns linear stagger [0, 40, 80] for 3 items @ 40ms", () => {
      const { result } = renderHook(() => useStagger(3, 40));
      expect(result.current).toEqual([0, 40, 80]);
    });

    it("returns zeros when reduced motion is set", () => {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
      const { result } = renderHook(() => useStagger(4, 40));
      expect(result.current).toEqual([0, 0, 0, 0]);
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/animations/use-stagger.test.ts`
  Expected: `Tests  2 passed`, exit 0.
  Commit: `git add packages/ui/src/animations/use-stagger.test.ts && git commit -m "test(#10): useStagger — linear + reduced-motion"`

- [ ] **T3.5** — Create `packages/ui/src/animations/index.ts` barrel:

  ```ts
  export * from "./use-count-up";
  export * from "./use-stagger";
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/animations/index.ts && git commit -m "feat(#10): animations barrel"`

---

### T4 — Provider + primitives (`Section`, `HeaderAction` — reference end-to-end) [AC: AC-1, AC-2, AC-3]

- [ ] **T4.0** — Create `packages/ui/src/provider/index.tsx` — the single client boundary consumers must mount:

  ```tsx
  "use client";

  // packages/ui/src/provider/index.tsx
  // Single client boundary for @pekulo/ui consumers. Mounts Tamagui's runtime
  // context (theme switching, animation driver, media-query watcher) +
  // next-themes integration for SSR-correct first paint.
  //
  // Wire-up baselines (inherited from W2 spike retrofit, non-negotiable):
  //   - <NextThemeProvider skipNextHead defaultTheme="pekulo-dark"
  //       themes={["pekulo-light", "pekulo-dark"]}>
  //     The themes prop MUST be explicit — omitting it defaults to ["light",
  //     "dark"] and the data-theme attribute never matches Pekulo's custom
  //     names.
  //   - <TamaguiProvider config={config} disableInjectCSS disableRootThemeClass>
  //     disableInjectCSS — the package ships a pre-generated CSS file that
  //     consumers import (apps/web/src/app/layout.tsx imports
  //     "@pekulo/ui/generated.css"); the runtime does not re-emit atomic CSS
  //     on every render.
  //     disableRootThemeClass — the theme class is set by NextThemeProvider on
  //     <html> via data-theme, not by TamaguiProvider's wrapping <View>.
  //
  // Ref: https://tamagui.dev/docs/guides/next-js section "App Router"
  //      docs/spikes/0-9-tamagui-decision.md (post-review revision).

  import type { ReactNode } from "react";
  import { NextThemeProvider } from "@tamagui/next-theme";
  import { TamaguiProvider } from "tamagui";

  import config from "../config/tamagui";

  export function PekuloRootProvider({ children }: { children: ReactNode }) {
    return (
      <NextThemeProvider
        skipNextHead
        defaultTheme="pekulo-dark"
        themes={["pekulo-light", "pekulo-dark"]}
      >
        <TamaguiProvider
          config={config}
          defaultTheme="pekulo-dark"
          disableInjectCSS
          disableRootThemeClass
        >
          {children}
        </TamaguiProvider>
      </NextThemeProvider>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/provider/index.tsx && git commit -m "feat(#10): PekuloRootProvider (single client boundary)"`

- [ ] **T4.1** — Create `packages/ui/src/primitives/Section.tsx`:

  ```tsx
  "use client";

  // packages/ui/src/primitives/Section.tsx
  // The single section container primitive. Uniform `bg-card p-5/6 rounded-xl`
  // (UX spec § Section). Optional header with title + action.

  import type { ReactNode } from "react";
  import { Text, View } from "tamagui";

  export interface SectionProps {
    /** Class name escape hatch for parent grid placement (Tamagui passes through). */
    className?: string;
    /** Accessible label — applied as aria-label. */
    ariaLabel?: string;
    /** Section title rendered in the header. */
    title?: string;
    /** Optional action element rendered right-aligned in the header. */
    action?: ReactNode;
    children: ReactNode;
  }

  export function Section({ className, ariaLabel, title, action, children }: SectionProps) {
    return (
      <View
        tag="section"
        className={className}
        aria-label={ariaLabel}
        backgroundColor="$backgroundCard"
        borderRadius={16}
        padding={20}
        $gtMd={{ padding: 24 }}
      >
        {(title || action) && (
          <View
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            marginBottom={16}
          >
            {title ? (
              <Text color="$color" fontSize={16} fontWeight="600">
                {title}
              </Text>
            ) : (
              <View />
            )}
            {action}
          </View>
        )}
        {children}
      </View>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/primitives/Section.tsx && git commit -m "feat(#10): Section primitive"`

- [ ] **T4.2** — Create `packages/ui/src/primitives/Section.snapshot.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { Section } from "./Section";

  describe("Section snapshot", () => {
    it("renders default (no header)", () => {
      const { container } = renderWithTamagui(
        <Section ariaLabel="default">
          <span>child</span>
        </Section>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });

    it("renders with title only", () => {
      const { container } = renderWithTamagui(
        <Section ariaLabel="titled" title="Trajectoire">
          <span>child</span>
        </Section>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });

    it("renders with title + action", () => {
      const { container } = renderWithTamagui(
        <Section
          ariaLabel="titled-with-action"
          title="Paliers"
          action={<button type="button">Voir tout</button>}
        >
          <span>child</span>
        </Section>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/primitives/Section.snapshot.test.tsx -u`
  Expected: `Snapshots  3 written`, exit 0. Then run again WITHOUT `-u`:
  Run: `bun --filter='@pekulo/ui' run test -- src/primitives/Section.snapshot.test.tsx`
  Expected: `Snapshots  3 passed`, `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/Section.snapshot.test.tsx && git commit -m "test(#10): Section snapshot — default/title/title+action"`

- [ ] **T4.3** — Create `packages/ui/src/primitives/Section.a11y.test.tsx`:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { Section } from "./Section";

  describe("Section a11y", () => {
    it("has no serious or critical violations (default)", async () => {
      const { container } = renderWithTamagui(
        <Section ariaLabel="audit-default">
          <p>content</p>
        </Section>,
      );
      const results = await axe(container);
      const blocking = (results.violations ?? []).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });

    it("has no violations with title + action", async () => {
      const { container } = renderWithTamagui(
        <Section
          ariaLabel="audit-titled"
          title="Mes comptes"
          action={<button type="button">Ajouter</button>}
        >
          <p>content</p>
        </Section>,
      );
      const results = await axe(container);
      const blocking = (results.violations ?? []).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/primitives/Section.a11y.test.tsx`
  Expected: `Tests  2 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/Section.a11y.test.tsx && git commit -m "test(#10): Section a11y — zero serious violations"`

- [ ] **T4.4** — Create `packages/ui/src/primitives/HeaderAction.tsx`:

  ```tsx
  "use client";

  // packages/ui/src/primitives/HeaderAction.tsx
  // Inline pill button for section actions ("+ Ajouter", "Filtrer", "Voir
  // tout", "12 mois ▾"). UX spec § HeaderAction.

  import type { ComponentType } from "react";
  import { Text, View, styled } from "tamagui";

  type LucideIcon = ComponentType<{ size?: number | string; color?: string }>;

  export interface HeaderActionProps {
    /** Optional left icon. */
    icon?: LucideIcon;
    /** Optional right icon (e.g. ChevronDown). */
    iconRight?: LucideIcon;
    /** Label text. */
    label: string;
    /** Press handler. */
    onPress?: () => void;
    /** Disabled state. */
    disabled?: boolean;
  }

  const PillButton = styled(View, {
    name: "HeaderActionPill",
    tag: "button",
    role: "button",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: "$backgroundMuted",
    cursor: "pointer",
    hoverStyle: {
      backgroundColor: "$backgroundElevated",
    },
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineOffset: 2,
    },
    pressStyle: {
      backgroundColor: "$backgroundElevated",
      scale: 0.97,
    },
    disabledStyle: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  });

  export function HeaderAction({ icon: Icon, iconRight: IconRight, label, onPress, disabled }: HeaderActionProps) {
    const handleClick = () => {
      if (disabled) return;
      onPress?.();
    };

    return (
      <PillButton
        onPress={handleClick}
        disabled={disabled}
        aria-disabled={disabled || undefined}
      >
        {Icon && <Icon size={14} color="currentColor" />}
        <Text color="$color" fontSize={13} fontWeight="500">
          {label}
        </Text>
        {IconRight && <IconRight size={14} color="currentColor" />}
      </PillButton>
    );
  }
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/primitives/HeaderAction.tsx && git commit -m "feat(#10): HeaderAction primitive (pill button with focus ring)"`

- [ ] **T4.5** — Create `packages/ui/src/primitives/HeaderAction.snapshot.test.tsx` + `HeaderAction.a11y.test.tsx`:

  ```tsx
  // packages/ui/src/primitives/HeaderAction.snapshot.test.tsx
  import { describe, it, expect } from "vitest";
  import { Plus, ChevronDown } from "lucide-react";
  import { renderWithTamagui } from "../../test/setup";
  import { HeaderAction } from "./HeaderAction";

  describe("HeaderAction snapshot", () => {
    it("renders label only", () => {
      const { container } = renderWithTamagui(<HeaderAction label="Voir tout" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders with left icon", () => {
      const { container } = renderWithTamagui(<HeaderAction icon={Plus} label="Ajouter" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders with right icon", () => {
      const { container } = renderWithTamagui(
        <HeaderAction iconRight={ChevronDown} label="12 mois" />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders disabled state", () => {
      const { container } = renderWithTamagui(<HeaderAction label="Ajouter" disabled />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  // packages/ui/src/primitives/HeaderAction.a11y.test.tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { HeaderAction } from "./HeaderAction";

  describe("HeaderAction a11y", () => {
    it("has no serious or critical violations", async () => {
      const { container } = renderWithTamagui(<HeaderAction label="Ajouter" />);
      const results = await axe(container);
      const blocking = (results.violations ?? []).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });

    it("activates on click", () => {
      const onPress = vi.fn();
      const { getByRole } = renderWithTamagui(
        <HeaderAction label="Click me" onPress={onPress} />,
      );
      fireEvent.click(getByRole("button"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not fire onPress when disabled", () => {
      const onPress = vi.fn();
      const { getByRole } = renderWithTamagui(
        <HeaderAction label="Disabled" onPress={onPress} disabled />,
      );
      fireEvent.click(getByRole("button"));
      expect(onPress).not.toHaveBeenCalled();
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/primitives/HeaderAction -u && bun --filter='@pekulo/ui' run test -- src/primitives/HeaderAction`
  Expected: `Snapshots  4 written` then on second run `Snapshots  4 passed`, `Tests  7 passed` (4 snapshot + 3 a11y), exit 0.
  Commit: `git add packages/ui/src/primitives/HeaderAction.snapshot.test.tsx packages/ui/src/primitives/HeaderAction.a11y.test.tsx && git commit -m "test(#10): HeaderAction snapshot + a11y"`

- [ ] **T4.6** — Create `packages/ui/src/primitives/index.ts` barrel:

  ```ts
  export * from "./Section";
  export * from "./HeaderAction";
  ```

  Commit: `git add packages/ui/src/primitives/index.ts && git commit -m "feat(#10): primitives barrel"`

- [ ] **T4.7** — Create `packages/ui/src/index.ts` (replace placeholder):

  ```ts
  // packages/ui/src/index.ts
  // Public barrel for @pekulo/ui. Consumers import everything from here.

  // Provider (single client boundary)
  export * from "./provider";

  // Tokens (raw data — for build tooling, contrast tests, charts that need
  // typed access to colors)
  export * from "./tokens";

  // Themes (Tamagui theme maps)
  export * from "./themes";

  // Animation hooks
  export * from "./animations";

  // Primitives (framework-agnostic — Section, HeaderAction)
  export * from "./primitives";

  // Domain components (Pekulo* prefixed) land in T5/T6.
  // Re-exported from ./components/index.ts as they are added.
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/index.ts && git commit -m "feat(#10): @pekulo/ui public barrel — provider/tokens/themes/animations/primitives"`

---

> **Reference shape for T5 + T6 component tasks.** Each `Pekulo*` component task has the same five-step structure:
>
> 1. Create the component file `packages/ui/src/components/<Component>.tsx` with full Tamagui code.
> 2. Create `<Component>.snapshot.test.tsx` covering at minimum the default state + every variant prop.
> 3. Create `<Component>.a11y.test.tsx` covering the default state ; for interactive components (with `onPress` / `onChange` / role="switch" / role="button"), also cover keyboard activation.
> 4. Run `bun --filter='@pekulo/ui' run test -- src/components/<Component> -u && bun --filter='@pekulo/ui' run test -- src/components/<Component>` ; expect snapshot count = N variants, a11y test count = M cases, all pass, exit 0.
> 5. Append the component to `packages/ui/src/components/index.ts` (created in T4.7-bis).
>
> Each component task in T5/T6 inlines (a) the full component code, (b) the snapshot test variants list, (c) the a11y test cases, (d) the Section 4 patterns are referenced by name (`renderWithTamagui()`, the snapshot template, the a11y template) — the dev does NOT re-derive them. The exact-test-command per task references the test file glob.

- [ ] **T4.8** — Create `packages/ui/src/components/index.ts` barrel (initially empty, populated by T5/T6 tasks as components land):

  ```ts
  // packages/ui/src/components/index.ts
  // Pekulo* domain components barrel. Each component is added by its T5/T6
  // task — keep alphabetical order to make merge conflicts trivial.

  // (T5/T6 components inserted alphabetically — see each task for the export line)
  export {};
  ```

  Then update `packages/ui/src/index.ts` to also re-export from `./components`:

  ```ts
  // ... existing exports ...
  export * from "./components";
  ```

  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/components/index.ts packages/ui/src/index.ts && git commit -m "feat(#10): components barrel scaffold (populated by T5/T6)"`

---

### T4-bis — Compound primitive wrappers (Tamagui sub-packages, shadcn-equivalent toolkit) [AC: AC-1, AC-2, AC-3]

> **Goal.** Wrap Tamagui's compound sub-package primitives (`@tamagui/dialog`, `@tamagui/sheet`, `@tamagui/popover`, …) into Pekulo-themed wrappers that expose the same compound API (`<PekuloDialog>`, `<PekuloDialog.Trigger>`, `<PekuloDialog.Content>`, …). Each wrapper applies Pekulo tokens (TR-strict palette, no decoration borders, white focus rings, animations-css driver) and re-exports the underlying compound parts so consumers get full shadcn-style ergonomics.
>
> **Scope.** 12 primitives. Each task delivers (a) the wrapper file `packages/ui/src/primitives/<Name>.tsx` (note: `primitives/` folder, not `components/` — these are framework-agnostic interactive primitives, distinct from `Pekulo*` domain components), (b) snapshot test, (c) a11y test (incl. keyboard/focus where relevant), (d) barrel update.
>
> **Compound API discipline.** Re-export every part as a property on the main export (e.g. `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Content`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`). Use the `withStaticProperties()` helper from `@tamagui/web` (or the manual `Object.assign(Dialog, { Trigger, ... })` form) to attach parts.
>
> **DropdownMenu note.** Tamagui v2-rc.41 does NOT ship a stand-alone DropdownMenu primitive. Pattern: compose a `<PekuloDropdownMenu>` from `<PekuloPopover>` + items in a `<YStack>` — left as a trivial composition for the consuming feature epics ; not a separate primitive in this phase.

- [ ] **T4bis.1** — `<PekuloDialog>` (`packages/ui/src/primitives/PekuloDialog.tsx`):

  ```tsx
  "use client";

  // packages/ui/src/primitives/PekuloDialog.tsx
  // Pekulo-themed wrapper around @tamagui/dialog. Compound API matches Radix
  // / shadcn convention: PekuloDialog (root) + .Trigger + .Portal + .Overlay
  // + .Content + .Title + .Description + .Close. Animation driver is the
  // package's animations-css (RSC-safe). Surfaces honour TR-strict palette
  // (zero hairline borders, $backgroundElevated for the content surface).

  import { Dialog as TamaDialog, type DialogProps } from "@tamagui/dialog";
  import type { ComponentProps, ReactNode } from "react";

  function Root(props: DialogProps) {
    return <TamaDialog modal {...props} />;
  }

  const Trigger = TamaDialog.Trigger;
  const Portal = TamaDialog.Portal;

  function Overlay(props: ComponentProps<typeof TamaDialog.Overlay>) {
    return (
      <TamaDialog.Overlay
        backgroundColor="rgba(0, 0, 0, 0.6)"
        animation="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        {...props}
      />
    );
  }

  function Content({ children, ...props }: ComponentProps<typeof TamaDialog.Content> & { children: ReactNode }) {
    return (
      <TamaDialog.Content
        backgroundColor="$backgroundElevated"
        borderRadius={16}
        padding={24}
        gap={12}
        animation="quick"
        enterStyle={{ opacity: 0, scale: 0.96, y: 8 }}
        exitStyle={{ opacity: 0, scale: 0.96, y: 8 }}
        maxWidth={520}
        width="100%"
        {...props}
      >
        {children}
      </TamaDialog.Content>
    );
  }

  function Title(props: ComponentProps<typeof TamaDialog.Title>) {
    return <TamaDialog.Title color="$color" fontSize={18} fontWeight="600" {...props} />;
  }

  function Description(props: ComponentProps<typeof TamaDialog.Description>) {
    return <TamaDialog.Description color="$colorSecondary" fontSize={14} {...props} />;
  }

  const Close = TamaDialog.Close;

  export const PekuloDialog = Object.assign(Root, {
    Trigger,
    Portal,
    Overlay,
    Content,
    Title,
    Description,
    Close,
  });
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloDialog } from "./PekuloDialog";

  describe("PekuloDialog snapshot", () => {
    it("renders open with title + description", () => {
      const { container } = renderWithTamagui(
        <PekuloDialog open>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <PekuloDialog.Title>Confirmer la suppression</PekuloDialog.Title>
              <PekuloDialog.Description>Cette action est irréversible.</PekuloDialog.Description>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloDialog } from "./PekuloDialog";

  describe("PekuloDialog a11y", () => {
    it("open dialog has no serious/critical violations + role=dialog", async () => {
      const { container, getByRole } = renderWithTamagui(
        <PekuloDialog open>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <PekuloDialog.Title>Confirmer</PekuloDialog.Title>
              <PekuloDialog.Description>Action irréversible.</PekuloDialog.Description>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>,
      );
      expect(getByRole("dialog")).toBeInTheDocument();
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to `packages/ui/src/primitives/index.ts`: `export * from "./PekuloDialog";`
  Run: `bun --filter='@pekulo/ui' run test -- src/primitives/PekuloDialog -u && bun --filter='@pekulo/ui' run test -- src/primitives/PekuloDialog`
  Expected: `Tests  2 passed`, exit 0.
  Commit: `git add packages/ui/src/primitives/PekuloDialog.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/primitives/index.ts && git commit -m "feat(#10): PekuloDialog (Tamagui-thin compound wrapper) + tests"`

- [ ] **T4bis.2** — `<PekuloSheet>` (mobile bottom sheet):

  ```tsx
  "use client";

  // packages/ui/src/primitives/PekuloSheet.tsx
  // Pekulo-themed wrapper around @tamagui/sheet. Bottom sheet for mobile with
  // multiple snap points. Compound: PekuloSheet (root) + .Frame + .Handle
  // + .Overlay.

  import { Sheet as TamaSheet, type SheetProps } from "@tamagui/sheet";
  import type { ComponentProps, ReactNode } from "react";

  function Root({ snapPoints = [85, 50, 25], dismissOnSnapToBottom = true, ...props }: SheetProps & { children: ReactNode }) {
    return <TamaSheet modal animation="medium" snapPoints={snapPoints} dismissOnSnapToBottom={dismissOnSnapToBottom} {...props} />;
  }

  function Overlay(props: ComponentProps<typeof TamaSheet.Overlay>) {
    return (
      <TamaSheet.Overlay
        backgroundColor="rgba(0, 0, 0, 0.6)"
        animation="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        {...props}
      />
    );
  }

  function Frame({ children, ...props }: ComponentProps<typeof TamaSheet.Frame> & { children: ReactNode }) {
    return (
      <TamaSheet.Frame
        backgroundColor="$backgroundElevated"
        borderTopLeftRadius={20}
        borderTopRightRadius={20}
        padding={20}
        gap={12}
        {...props}
      >
        {children}
      </TamaSheet.Frame>
    );
  }

  function Handle(props: ComponentProps<typeof TamaSheet.Handle>) {
    return (
      <TamaSheet.Handle
        backgroundColor="$colorTertiary"
        opacity={0.5}
        height={4}
        width={48}
        borderRadius={9999}
        alignSelf="center"
        marginBottom={12}
        {...props}
      />
    );
  }

  export const PekuloSheet = Object.assign(Root, { Overlay, Frame, Handle });
  ```

  Snapshot + a11y (same template, default open + 1 snap point):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { Text } from "tamagui";
  import { PekuloSheet } from "./PekuloSheet";

  describe("PekuloSheet snapshot", () => {
    it("renders open at first snap point", () => {
      const { container } = renderWithTamagui(
        <PekuloSheet open snapPoints={[50]}>
          <PekuloSheet.Overlay />
          <PekuloSheet.Frame>
            <PekuloSheet.Handle />
            <Text color="$color">Sheet content</Text>
          </PekuloSheet.Frame>
        </PekuloSheet>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { Text } from "tamagui";
  import { PekuloSheet } from "./PekuloSheet";

  describe("PekuloSheet a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloSheet open snapPoints={[50]}>
          <PekuloSheet.Overlay />
          <PekuloSheet.Frame>
            <PekuloSheet.Handle />
            <Text color="$color">Sheet</Text>
          </PekuloSheet.Frame>
        </PekuloSheet>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloSheet + tests`.

- [ ] **T4bis.3** — `<PekuloPopover>`:

  ```tsx
  "use client";

  import { Popover as TamaPopover, type PopoverProps } from "@tamagui/popover";
  import type { ComponentProps, ReactNode } from "react";

  function Root({ placement = "bottom", ...props }: PopoverProps & { children: ReactNode }) {
    return <TamaPopover placement={placement} {...props} />;
  }

  const Trigger = TamaPopover.Trigger;

  function Content({ children, ...props }: ComponentProps<typeof TamaPopover.Content> & { children: ReactNode }) {
    return (
      <TamaPopover.Content
        backgroundColor="$backgroundElevated"
        borderRadius={12}
        padding={12}
        gap={8}
        animation="quick"
        enterStyle={{ opacity: 0, y: -4 }}
        exitStyle={{ opacity: 0, y: -4 }}
        {...props}
      >
        {children}
      </TamaPopover.Content>
    );
  }

  function Arrow(props: ComponentProps<typeof TamaPopover.Arrow>) {
    return <TamaPopover.Arrow backgroundColor="$backgroundElevated" {...props} />;
  }

  const Close = TamaPopover.Close;

  export const PekuloPopover = Object.assign(Root, { Trigger, Content, Arrow, Close });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloPopover } from "./PekuloPopover";

  describe("PekuloPopover snapshot", () => {
    it("renders open content", () => {
      const { container } = renderWithTamagui(
        <PekuloPopover open>
          <PekuloPopover.Trigger>
            <Text color="$color">Open</Text>
          </PekuloPopover.Trigger>
          <PekuloPopover.Content>
            <Text color="$color">Popover body</Text>
          </PekuloPopover.Content>
        </PekuloPopover>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloPopover } from "./PekuloPopover";

  describe("PekuloPopover a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloPopover open>
          <PekuloPopover.Trigger><Text color="$color">Open</Text></PekuloPopover.Trigger>
          <PekuloPopover.Content><Text color="$color">Body</Text></PekuloPopover.Content>
        </PekuloPopover>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloPopover + tests`.

- [ ] **T4bis.4** — `<PekuloTooltip>`:

  ```tsx
  "use client";

  import { Tooltip as TamaTooltip, type TooltipProps } from "@tamagui/tooltip";
  import type { ComponentProps, ReactNode } from "react";

  function Root({ delay = 400, ...props }: TooltipProps & { children: ReactNode }) {
    return <TamaTooltip delay={delay} {...props} />;
  }

  const Trigger = TamaTooltip.Trigger;

  function Content({ children, ...props }: ComponentProps<typeof TamaTooltip.Content> & { children: ReactNode }) {
    return (
      <TamaTooltip.Content
        backgroundColor="$backgroundElevated"
        borderRadius={8}
        paddingHorizontal={10}
        paddingVertical={6}
        animation="quick"
        enterStyle={{ opacity: 0, y: -4 }}
        exitStyle={{ opacity: 0, y: -4 }}
        {...props}
      >
        {children}
      </TamaTooltip.Content>
    );
  }

  function Arrow(props: ComponentProps<typeof TamaTooltip.Arrow>) {
    return <TamaTooltip.Arrow backgroundColor="$backgroundElevated" {...props} />;
  }

  export const PekuloTooltip = Object.assign(Root, { Trigger, Content, Arrow });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloTooltip } from "./PekuloTooltip";

  describe("PekuloTooltip snapshot", () => {
    it("renders open content", () => {
      const { container } = renderWithTamagui(
        <PekuloTooltip open>
          <PekuloTooltip.Trigger><Text color="$color">trigger</Text></PekuloTooltip.Trigger>
          <PekuloTooltip.Content><Text color="$color">tip</Text></PekuloTooltip.Content>
        </PekuloTooltip>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloTooltip } from "./PekuloTooltip";

  describe("PekuloTooltip a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloTooltip open>
          <PekuloTooltip.Trigger><Text color="$color">t</Text></PekuloTooltip.Trigger>
          <PekuloTooltip.Content><Text color="$color">c</Text></PekuloTooltip.Content>
        </PekuloTooltip>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloTooltip + tests`.

- [ ] **T4bis.5** — `<PekuloSelect>`:

  ```tsx
  "use client";

  import { Select as TamaSelect, type SelectProps } from "@tamagui/select";
  import type { ComponentProps, ReactNode } from "react";

  function Root(props: SelectProps & { children: ReactNode }) {
    return <TamaSelect {...props} />;
  }

  function Trigger({ children, ...props }: ComponentProps<typeof TamaSelect.Trigger> & { children: ReactNode }) {
    return (
      <TamaSelect.Trigger
        backgroundColor="$backgroundMuted"
        borderRadius={8}
        paddingHorizontal={12}
        paddingVertical={10}
        gap={8}
        flexDirection="row"
        alignItems="center"
        cursor="pointer"
        focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 }}
        {...props}
      >
        {children}
      </TamaSelect.Trigger>
    );
  }

  const Value = TamaSelect.Value;

  function Content({ children, ...props }: ComponentProps<typeof TamaSelect.Content> & { children: ReactNode }) {
    return (
      <TamaSelect.Content zIndex={200000} {...props}>
        <TamaSelect.Viewport
          backgroundColor="$backgroundElevated"
          borderRadius={12}
          padding={4}
          minWidth={200}
        >
          {children}
        </TamaSelect.Viewport>
      </TamaSelect.Content>
    );
  }

  function Item({ children, ...props }: ComponentProps<typeof TamaSelect.Item> & { children: ReactNode }) {
    return (
      <TamaSelect.Item
        paddingHorizontal={10}
        paddingVertical={8}
        borderRadius={6}
        cursor="pointer"
        hoverStyle={{ backgroundColor: "$backgroundMuted" }}
        focusStyle={{ backgroundColor: "$backgroundMuted" }}
        {...props}
      >
        <TamaSelect.ItemText color="$color" fontSize={13}>{children}</TamaSelect.ItemText>
      </TamaSelect.Item>
    );
  }

  export const PekuloSelect = Object.assign(Root, { Trigger, Value, Content, Item });
  ```

  Snapshot + a11y (default closed) :

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSelect } from "./PekuloSelect";

  describe("PekuloSelect snapshot", () => {
    it("renders trigger with value", () => {
      const { container } = renderWithTamagui(
        <PekuloSelect value="eur" onValueChange={vi.fn()}>
          <PekuloSelect.Trigger>
            <PekuloSelect.Value />
          </PekuloSelect.Trigger>
        </PekuloSelect>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSelect } from "./PekuloSelect";

  describe("PekuloSelect a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloSelect value="eur" onValueChange={vi.fn()}>
          <PekuloSelect.Trigger><PekuloSelect.Value /></PekuloSelect.Trigger>
        </PekuloSelect>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloSelect + tests`.

- [ ] **T4bis.6** — `<PekuloRadioGroup>`:

  ```tsx
  "use client";

  import { RadioGroup as TamaRadioGroup, type RadioGroupProps } from "@tamagui/radio-group";
  import type { ComponentProps, ReactNode } from "react";

  function Root(props: RadioGroupProps & { children: ReactNode }) {
    return <TamaRadioGroup {...props} />;
  }

  function Item({ children, ...props }: ComponentProps<typeof TamaRadioGroup.Item> & { children?: ReactNode }) {
    return (
      <TamaRadioGroup.Item
        size="$3"
        backgroundColor="$backgroundMuted"
        borderWidth={0}
        cursor="pointer"
        focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 }}
        {...props}
      >
        <TamaRadioGroup.Indicator backgroundColor="$accent" />
        {children}
      </TamaRadioGroup.Item>
    );
  }

  export const PekuloRadioGroup = Object.assign(Root, { Item });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloRadioGroup } from "./PekuloRadioGroup";

  describe("PekuloRadioGroup snapshot", () => {
    it("renders 3 options, second selected", () => {
      const { container } = renderWithTamagui(
        <PekuloRadioGroup value="b" onValueChange={vi.fn()}>
          <PekuloRadioGroup.Item value="a" id="a" />
          <PekuloRadioGroup.Item value="b" id="b" />
          <PekuloRadioGroup.Item value="c" id="c" />
        </PekuloRadioGroup>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloRadioGroup } from "./PekuloRadioGroup";

  describe("PekuloRadioGroup a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloRadioGroup value="a" onValueChange={vi.fn()} aria-label="Choix">
          <PekuloRadioGroup.Item value="a" id="a" aria-label="A" />
          <PekuloRadioGroup.Item value="b" id="b" aria-label="B" />
        </PekuloRadioGroup>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloRadioGroup + tests`.

- [ ] **T4bis.7** — `<PekuloSwitch>` (primitive — distinct from `PekuloToggleRow` which is the label+sub+switch compose-up):

  ```tsx
  "use client";

  import { Switch as TamaSwitch, type SwitchProps } from "@tamagui/switch";
  import type { ComponentProps } from "react";

  function Root(props: SwitchProps) {
    return (
      <TamaSwitch
        backgroundColor="$backgroundMuted"
        borderWidth={0}
        cursor="pointer"
        focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 }}
        {...props}
      />
    );
  }

  function Thumb(props: ComponentProps<typeof TamaSwitch.Thumb>) {
    return <TamaSwitch.Thumb backgroundColor="$colorOnAccent" {...props} />;
  }

  export const PekuloSwitch = Object.assign(Root, { Thumb });
  ```

  Snapshot + a11y (incl. role="switch" + click toggle) :

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSwitch } from "./PekuloSwitch";

  describe("PekuloSwitch snapshot", () => {
    it("renders unchecked", () => {
      const { container } = renderWithTamagui(
        <PekuloSwitch checked={false} onCheckedChange={vi.fn()}>
          <PekuloSwitch.Thumb />
        </PekuloSwitch>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSwitch } from "./PekuloSwitch";

  describe("PekuloSwitch a11y", () => {
    it("has no serious/critical violations + role=switch", async () => {
      const { container, getByRole } = renderWithTamagui(
        <PekuloSwitch aria-label="Notifications" checked onCheckedChange={vi.fn()}>
          <PekuloSwitch.Thumb />
        </PekuloSwitch>,
      );
      expect(getByRole("switch")).toBeInTheDocument();
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloSwitch + tests`.

- [ ] **T4bis.8** — `<PekuloSlider>`:

  ```tsx
  "use client";

  import { Slider as TamaSlider, type SliderProps } from "@tamagui/slider";
  import type { ComponentProps } from "react";

  function Root(props: SliderProps) {
    return <TamaSlider {...props} />;
  }

  function Track(props: ComponentProps<typeof TamaSlider.Track>) {
    return <TamaSlider.Track backgroundColor="$backgroundMuted" height={4} {...props} />;
  }

  function TrackActive(props: ComponentProps<typeof TamaSlider.TrackActive>) {
    return <TamaSlider.TrackActive backgroundColor="$accent" {...props} />;
  }

  function Thumb(props: ComponentProps<typeof TamaSlider.Thumb>) {
    return (
      <TamaSlider.Thumb
        backgroundColor="$color"
        borderWidth={0}
        size={16}
        circular
        focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 }}
        {...props}
      />
    );
  }

  export const PekuloSlider = Object.assign(Root, { Track, TrackActive, Thumb });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSlider } from "./PekuloSlider";

  describe("PekuloSlider snapshot", () => {
    it("renders default value", () => {
      const { container } = renderWithTamagui(
        <PekuloSlider value={[40]} max={100} step={1} onValueChange={vi.fn()}>
          <PekuloSlider.Track>
            <PekuloSlider.TrackActive />
          </PekuloSlider.Track>
          <PekuloSlider.Thumb index={0} />
        </PekuloSlider>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSlider } from "./PekuloSlider";

  describe("PekuloSlider a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloSlider value={[40]} max={100} onValueChange={vi.fn()} aria-label="Versement mensuel">
          <PekuloSlider.Track>
            <PekuloSlider.TrackActive />
          </PekuloSlider.Track>
          <PekuloSlider.Thumb index={0} />
        </PekuloSlider>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloSlider + tests`.

- [ ] **T4bis.9** — `<PekuloProgress>`:

  ```tsx
  "use client";

  import { Progress as TamaProgress, type ProgressProps } from "@tamagui/progress";
  import type { ComponentProps } from "react";

  function Root(props: ProgressProps) {
    return (
      <TamaProgress
        backgroundColor="$backgroundMuted"
        borderRadius={9999}
        height={6}
        overflow="hidden"
        {...props}
      />
    );
  }

  function Indicator(props: ComponentProps<typeof TamaProgress.Indicator>) {
    return <TamaProgress.Indicator backgroundColor="$color" animation="quick" {...props} />;
  }

  export const PekuloProgress = Object.assign(Root, { Indicator });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloProgress } from "./PekuloProgress";

  describe("PekuloProgress snapshot", () => {
    it("renders 60%", () => {
      const { container } = renderWithTamagui(
        <PekuloProgress value={60}>
          <PekuloProgress.Indicator />
        </PekuloProgress>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloProgress } from "./PekuloProgress";

  describe("PekuloProgress a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloProgress value={60} aria-label="Progression cap">
          <PekuloProgress.Indicator />
        </PekuloProgress>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloProgress + tests`.

- [ ] **T4bis.10** — `<PekuloSeparator>`:

  ```tsx
  "use client";

  import { Separator as TamaSeparator, type SeparatorProps } from "@tamagui/separator";

  export function PekuloSeparator(props: SeparatorProps) {
    return (
      <TamaSeparator
        borderColor="$borderDefault"
        opacity={1}
        {...props}
      />
    );
  }
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSeparator } from "./PekuloSeparator";

  describe("PekuloSeparator snapshot", () => {
    it("renders horizontal", () => {
      const { container } = renderWithTamagui(<PekuloSeparator />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders vertical", () => {
      const { container } = renderWithTamagui(<PekuloSeparator vertical />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSeparator } from "./PekuloSeparator";

  describe("PekuloSeparator a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloSeparator />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloSeparator + tests`.

- [ ] **T4bis.11** — `<PekuloAvatar>`:

  ```tsx
  "use client";

  import { Avatar as TamaAvatar, type AvatarProps } from "@tamagui/avatar";
  import type { ComponentProps, ReactNode } from "react";

  function Root({ size = 40, ...props }: AvatarProps & { size?: number; children: ReactNode }) {
    return <TamaAvatar size={size} circular {...props} />;
  }

  function Image(props: ComponentProps<typeof TamaAvatar.Image>) {
    return <TamaAvatar.Image accessibilityLabel="" {...props} />;
  }

  function Fallback({ children, ...props }: ComponentProps<typeof TamaAvatar.Fallback> & { children: ReactNode }) {
    return (
      <TamaAvatar.Fallback
        backgroundColor="$backgroundMuted"
        alignItems="center"
        justifyContent="center"
        {...props}
      >
        {children}
      </TamaAvatar.Fallback>
    );
  }

  export const PekuloAvatar = Object.assign(Root, { Image, Fallback });
  ```

  Snapshot + a11y :

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloAvatar } from "./PekuloAvatar";

  describe("PekuloAvatar snapshot", () => {
    it("renders fallback only", () => {
      const { container } = renderWithTamagui(
        <PekuloAvatar size={44}>
          <PekuloAvatar.Fallback><Text color="$color" fontSize={16}>A</Text></PekuloAvatar.Fallback>
        </PekuloAvatar>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { Text } from "tamagui";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloAvatar } from "./PekuloAvatar";

  describe("PekuloAvatar a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloAvatar size={44}>
          <PekuloAvatar.Fallback><Text color="$color">A</Text></PekuloAvatar.Fallback>
        </PekuloAvatar>,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Commit `feat(#10): PekuloAvatar + tests`.

- [ ] **T4bis.12** — `<PekuloCheckbox>`:

  ```tsx
  "use client";

  import { Checkbox as TamaCheckbox, type CheckboxProps } from "@tamagui/checkbox";
  import { Check } from "lucide-react";
  import type { ComponentProps } from "react";

  function Root(props: CheckboxProps) {
    return (
      <TamaCheckbox
        size="$3"
        backgroundColor="$backgroundMuted"
        borderWidth={0}
        focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 }}
        {...props}
      />
    );
  }

  function Indicator(props: ComponentProps<typeof TamaCheckbox.Indicator>) {
    return (
      <TamaCheckbox.Indicator {...props}>
        <Check size={14} color="var(--colorOnAccent)" />
      </TamaCheckbox.Indicator>
    );
  }

  export const PekuloCheckbox = Object.assign(Root, { Indicator });
  ```

  Snapshot + a11y (incl. role=checkbox + toggle) :

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloCheckbox } from "./PekuloCheckbox";

  describe("PekuloCheckbox snapshot", () => {
    it("renders unchecked", () => {
      const { container } = renderWithTamagui(
        <PekuloCheckbox checked={false} onCheckedChange={vi.fn()}>
          <PekuloCheckbox.Indicator />
        </PekuloCheckbox>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders checked", () => {
      const { container } = renderWithTamagui(
        <PekuloCheckbox checked onCheckedChange={vi.fn()}>
          <PekuloCheckbox.Indicator />
        </PekuloCheckbox>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloCheckbox } from "./PekuloCheckbox";

  describe("PekuloCheckbox a11y", () => {
    it("has no serious/critical violations + role=checkbox", async () => {
      const { container, getByRole } = renderWithTamagui(
        <PekuloCheckbox checked={false} onCheckedChange={vi.fn()} aria-label="Accept">
          <PekuloCheckbox.Indicator />
        </PekuloCheckbox>,
      );
      expect(getByRole("checkbox")).toBeInTheDocument();
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("toggles on click", () => {
      const onCheckedChange = vi.fn();
      const { getByRole } = renderWithTamagui(
        <PekuloCheckbox checked={false} onCheckedChange={onCheckedChange} aria-label="x">
          <PekuloCheckbox.Indicator />
        </PekuloCheckbox>,
      );
      fireEvent.click(getByRole("checkbox"));
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
  });
  ```

  Commit `feat(#10): PekuloCheckbox + tests`.

- [ ] **T4bis.13** — Finalize the primitives barrel and verify all 12 wrappers exported. Update `packages/ui/src/primitives/index.ts` (add to existing T4.6 barrel):

  ```ts
  // packages/ui/src/primitives/index.ts
  export * from "./Section";
  export * from "./HeaderAction";
  export * from "./PekuloAvatar";
  export * from "./PekuloCheckbox";
  export * from "./PekuloDialog";
  export * from "./PekuloPopover";
  export * from "./PekuloProgress";
  export * from "./PekuloRadioGroup";
  export * from "./PekuloSelect";
  export * from "./PekuloSeparator";
  export * from "./PekuloSheet";
  export * from "./PekuloSlider";
  export * from "./PekuloSwitch";
  export * from "./PekuloTooltip";
  ```

  Run: `bun --filter='@pekulo/ui' run test`
  Expected: all primitives + components tests pass, exit 0.
  Commit: `git add packages/ui/src/primitives/index.ts && git commit -m "chore(#10): finalize primitives barrel (Section + HeaderAction + 12 compound wrappers)"`

---

### T5 — Cap dashboard components (12 components, each = 3 files: component + snapshot test + a11y test)

> **Compact form for T5/T6.** Per-component task gives (a) full component file, (b) full snapshot test (single default-prop case — the AC requires "every component has an approved snapshot", singular ; per-variant coverage is optional and added by the dev only if a variant prop changes the rendered tree meaningfully), (c) full a11y test (default-prop + keyboard for interactive). Each task ends with one combined test command + commit.

- [ ] **T5.1** — `PekuloDonut` (`packages/ui/src/components/PekuloDonut.tsx`):

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloDonut.tsx
  // TR-style ring — white stroke on dim track. Animated sweep on mount via
  // useCountUp. Dark mode = white fill on white-08 track ; light mode = ink
  // fill on black-08 track (driven by Pekulo theme tokens donutFill/donutTrack).

  import { View, Text } from "tamagui";
  import { useCountUp } from "../animations/use-count-up";

  export interface PekuloDonutProps {
    /** Progress fraction (0..1). */
    pct: number;
    /** Outer diameter (px). Default 96. */
    size?: number;
    /** Stroke width (px). Default 8. */
    stroke?: number;
    /** Render the percentage label centered. */
    centered?: boolean;
  }

  export function PekuloDonut({ pct, size = 96, stroke = 8, centered }: PekuloDonutProps) {
    const clamped = Math.max(0, Math.min(1, pct));
    const animated = useCountUp(clamped, { durationMs: 900 });
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - animated);
    const labelPct = Math.round(animated * 100);

    return (
      <View width={size} height={size} alignItems="center" justifyContent="center" position="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable={false}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--donutTrack)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--donutFill)"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        {centered && (
          <View position="absolute" alignItems="center" justifyContent="center">
            <Text color="$color" fontSize={size * 0.34} fontWeight="600">
              {labelPct}%
            </Text>
          </View>
        )}
      </View>
    );
  }
  ```

  Snapshot test (`packages/ui/src/components/PekuloDonut.snapshot.test.tsx`):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloDonut } from "./PekuloDonut";

  describe("PekuloDonut snapshot", () => {
    it("renders default (50% no label)", () => {
      const { container } = renderWithTamagui(<PekuloDonut pct={0.5} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders centered label variant", () => {
      const { container } = renderWithTamagui(<PekuloDonut pct={0.72} centered />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y test (`packages/ui/src/components/PekuloDonut.a11y.test.tsx`):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloDonut } from "./PekuloDonut";

  describe("PekuloDonut a11y", () => {
    it("has no serious/critical violations (decorative SVG)", async () => {
      const { container } = renderWithTamagui(<PekuloDonut pct={0.4} centered />);
      const results = await axe(container);
      const blocking = (results.violations ?? []).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });
  });
  ```

  Then add to `packages/ui/src/components/index.ts`: `export * from "./PekuloDonut";`

  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloDonut -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloDonut`
  Expected: `Snapshots  2 passed`, `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloDonut.tsx packages/ui/src/components/PekuloDonut.snapshot.test.tsx packages/ui/src/components/PekuloDonut.a11y.test.tsx packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloDonut + snapshot + a11y"`

- [ ] **T5.2** — `PekuloHero` (`packages/ui/src/components/PekuloHero.tsx`) — port of `HeroBlock` from spike `proto-slice.tsx`:

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloHero.tsx
  // HeroBlock — patrimoine total + delta vs plan. Two variants:
  //   - mobile: bare hero (no container — caller wraps in Section)
  //   - card: hero + Cap target + Plan/an stats below (used by HeroCard
  //     bento cell on desktop)

  import { Text, View } from "tamagui";
  import { useCountUp } from "../animations/use-count-up";

  export interface PekuloHeroProps {
    variant?: "mobile" | "card";
    totalEur: number;
    aheadEur: number;
    targetCapital?: number;
    targetYear?: number;
    requiredYearlyEur?: number;
    label?: string;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const eurCompact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  const formatEur = (v: number) => eur0.format(v);
  const formatCompactEur = (v: number) => `${eurCompact.format(v)} €`;

  export function PekuloHero({
    variant = "mobile",
    totalEur,
    aheadEur,
    targetCapital,
    targetYear,
    requiredYearlyEur,
    label = "Patrimoine total",
  }: PekuloHeroProps) {
    const animated = useCountUp(totalEur, { durationMs: 900 });
    const aheadSign = aheadEur >= 0 ? "+" : "−";
    const aheadAbs = formatEur(Math.abs(aheadEur));

    return (
      <View width="100%">
        <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>{label}</Text>
        <Text color="$color" fontSize={44} fontWeight="600" letterSpacing={-0.5} marginTop={8}>
          {formatEur(animated)}
        </Text>
        <View flexDirection="row" alignItems="baseline" gap={6} marginTop={8}>
          <Text color="$accent" fontSize={14} fontWeight="500">{aheadSign}{aheadAbs}</Text>
          <Text color="$colorTertiary" fontSize={14}>vs plan · 12 mois</Text>
        </View>
        {variant === "card" && targetCapital !== undefined && targetYear !== undefined && requiredYearlyEur !== undefined && (
          <View flexDirection="row" gap={32} marginTop={32}>
            <View flex={1}>
              <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>Cap</Text>
              <Text color="$color" fontSize={20} fontWeight="600" marginTop={4}>{formatEur(targetCapital)}</Text>
              <Text color="$colorTertiary" fontSize={12}>en {targetYear}</Text>
            </View>
            <View flex={1}>
              <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>Plan / an</Text>
              <Text color="$color" fontSize={20} fontWeight="600" marginTop={4}>{formatCompactEur(requiredYearlyEur)}</Text>
              <Text color="$colorTertiary" fontSize={12}>linéaire</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
  ```

  Snapshot (`packages/ui/src/components/PekuloHero.snapshot.test.tsx`):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloHero } from "./PekuloHero";

  describe("PekuloHero snapshot", () => {
    it("renders mobile variant", () => {
      const { container } = renderWithTamagui(<PekuloHero totalEur={180400} aheadEur={21383} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders card variant with cap stats", () => {
      const { container } = renderWithTamagui(
        <PekuloHero variant="card" totalEur={180400} aheadEur={21383} targetCapital={800000} targetYear={2055} requiredYearlyEur={21383} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders negative delta", () => {
      const { container } = renderWithTamagui(<PekuloHero totalEur={140000} aheadEur={-5000} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y (`packages/ui/src/components/PekuloHero.a11y.test.tsx`):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloHero } from "./PekuloHero";

  describe("PekuloHero a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloHero variant="card" totalEur={180400} aheadEur={21383} targetCapital={800000} targetYear={2055} requiredYearlyEur={21383} />,
      );
      const results = await axe(container);
      const blocking = (results.violations ?? []).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });
  });
  ```

  Add to barrel: `export * from "./PekuloHero";`

  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloHero -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloHero`
  Expected: `Snapshots  3 passed`, `Tests  4 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloHero.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloHero (port HeroBlock from spike) + tests"`

- [ ] **T5.3** — `PekuloKpiTile`:

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloKpiTile.tsx
  // Mobile mini-KPI card. Label top, optional mini-donut top-right, value
  // bottom-left, sub-caption bottom.

  import { Text, View } from "tamagui";
  import { PekuloDonut } from "./PekuloDonut";

  export interface PekuloKpiTileProps {
    label: string;
    valueTop: string;
    valueBottom?: string;
    /** Optional progress fraction (0..1) — shows a 32px donut top-right. */
    progress?: number;
  }

  export function PekuloKpiTile({ label, valueTop, valueBottom, progress }: PekuloKpiTileProps) {
    return (
      <View
        backgroundColor="$backgroundCard"
        borderRadius={12}
        padding={16}
        flex={1}
        minWidth={140}
      >
        <View flexDirection="row" justifyContent="space-between" alignItems="flex-start">
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>{label}</Text>
          {progress !== undefined && <PekuloDonut pct={progress} size={32} stroke={3} />}
        </View>
        <Text color="$color" fontSize={20} fontWeight="600" marginTop={12}>{valueTop}</Text>
        {valueBottom && <Text color="$colorTertiary" fontSize={12} marginTop={2}>{valueBottom}</Text>}
      </View>
    );
  }
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloKpiTile } from "./PekuloKpiTile";

  describe("PekuloKpiTile snapshot", () => {
    it("renders without donut", () => {
      const { container } = renderWithTamagui(<PekuloKpiTile label="Cap" valueTop="22%" valueBottom="objectif 2055" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders with donut", () => {
      const { container } = renderWithTamagui(<PekuloKpiTile label="Cap" valueTop="22%" progress={0.22} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloKpiTile } from "./PekuloKpiTile";

  describe("PekuloKpiTile a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloKpiTile label="Plan / an" valueTop="21,4 k €" valueBottom="linéaire" progress={0.3} />,
      );
      const results = await axe(container);
      expect((results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel.
  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloKpiTile -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloKpiTile`
  Expected: `Snapshots  2 passed`, `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloKpiTile.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloKpiTile + tests"`

- [ ] **T5.4** — `PekuloMilestoneRow`:

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloMilestoneRow.tsx
  // Palier row — mini-donut + label + target/year + signed delta + status verbose.
  // Status determines delta color: gain (early/on-track) / loss (late) / neutral.

  import { Text, View } from "tamagui";
  import { PekuloDonut } from "./PekuloDonut";

  export type MilestoneStatus = "ahead" | "on-track" | "behind";

  export interface PekuloMilestone {
    label: string;
    targetEur: number;
    targetYear: number;
    progressPct: number;
    deltaEur: number;
    status: MilestoneStatus;
  }

  export interface PekuloMilestoneRowProps {
    milestone: PekuloMilestone;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const STATUS_LABEL: Record<MilestoneStatus, string> = {
    ahead: "en avance",
    "on-track": "sur la trajectoire",
    behind: "en retard",
  };

  export function PekuloMilestoneRow({ milestone }: PekuloMilestoneRowProps) {
    const { label, targetEur, targetYear, progressPct, deltaEur, status } = milestone;
    const tone =
      status === "ahead" ? "$success" : status === "behind" ? "$danger" : "$colorSecondary";
    const sign = deltaEur >= 0 ? "+" : "−";
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={12}>
        <PekuloDonut pct={progressPct} size={32} stroke={3} />
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500">{label}</Text>
          <Text color="$colorTertiary" fontSize={12}>{eur0.format(targetEur)} · {targetYear}</Text>
        </View>
        <View alignItems="flex-end">
          <Text color={tone as never} fontSize={14} fontWeight="500">{sign}{eur0.format(Math.abs(deltaEur))}</Text>
          <Text color="$colorTertiary" fontSize={12}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>
    );
  }
  ```

  Snapshot + a11y (default, on-track ; same template as T5.1) ; add to barrel.
  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloMilestoneRow -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloMilestoneRow`
  Expected: `Snapshots  ≥1 passed`, `Tests  ≥2 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloMilestoneRow.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloMilestoneRow + tests"`

  Snapshot file:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

  describe("PekuloMilestoneRow snapshot", () => {
    it("renders ahead status", () => {
      const { container } = renderWithTamagui(
        <PekuloMilestoneRow milestone={{ label: "1er palier", targetEur: 50000, targetYear: 2030, progressPct: 0.55, deltaEur: 1500, status: "ahead" }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders behind status", () => {
      const { container } = renderWithTamagui(
        <PekuloMilestoneRow milestone={{ label: "2e palier", targetEur: 100000, targetYear: 2035, progressPct: 0.20, deltaEur: -2300, status: "behind" }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y file:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

  describe("PekuloMilestoneRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloMilestoneRow milestone={{ label: "Palier", targetEur: 75000, targetYear: 2032, progressPct: 0.5, deltaEur: 0, status: "on-track" }} />,
      );
      const results = await axe(container);
      expect((results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T5.5** — `PekuloCompositionRow` (`packages/ui/src/components/PekuloCompositionRow.tsx`):

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { PekuloDonut } from "./PekuloDonut";

  export interface PekuloCompositionRowProps {
    label: string;
    amount: number;
    pct: number;
    sub?: string;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export function PekuloCompositionRow({ label, amount, pct, sub }: PekuloCompositionRowProps) {
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={10}>
        <PekuloDonut pct={pct} size={28} stroke={3} />
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500">{label}</Text>
          {sub && <Text color="$colorTertiary" fontSize={12}>{sub}</Text>}
        </View>
        <View alignItems="flex-end">
          <Text color="$color" fontSize={14} fontWeight="500">{eur0.format(amount)}</Text>
          <Text color="$colorTertiary" fontSize={12}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
    );
  }
  ```

  Snapshot + a11y (template ; default props `label="Liquide" amount={45000} pct={0.25}`).
  Add to barrel.
  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloCompositionRow -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloCompositionRow`
  Expected: `Tests  ≥2 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloCompositionRow.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloCompositionRow + tests"`

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloCompositionRow } from "./PekuloCompositionRow";
  describe("PekuloCompositionRow snapshot", () => {
    it("renders with sub", () => {
      const { container } = renderWithTamagui(
        <PekuloCompositionRow label="Placements" amount={89000} pct={0.49} sub="ETF + Actions + Crypto" />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloCompositionRow } from "./PekuloCompositionRow";
  describe("PekuloCompositionRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloCompositionRow label="Liquide" amount={45000} pct={0.25} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T5.6** — `PekuloTrajectoryChart` (inline SVG, 2 lines: actual solid + plan dashed):

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloTrajectoryChart.tsx
  // Inline SVG — actual (white solid) + plan (dim dashed). Coordinates passed
  // as { months: number[]; actual: number[]; plan: number[] }; the chart
  // normalises to a 600 × {180|220} viewBox.

  import { View } from "tamagui";

  export interface PekuloTrajectoryChartProps {
    months: number[];
    actual: number[];
    plan: number[];
    /** 220 px height variant (vs default 180). */
    tall?: boolean;
    /** Wrap in card surface (false = parent already a Section). */
    inCard?: boolean;
  }

  export function PekuloTrajectoryChart({ months, actual, plan, tall, inCard }: PekuloTrajectoryChartProps) {
    const width = 600;
    const height = tall ? 220 : 180;
    const padding = 8;
    const all = [...actual, ...plan];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = Math.max(max - min, 1);
    const xStep = (width - 2 * padding) / Math.max(months.length - 1, 1);
    const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
    const toPath = (data: number[]) =>
      data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding + i * xStep} ${toY(v)}`).join(" ");
    const inner = (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trajectoire patrimoine">
        <path d={toPath(plan)} stroke="var(--chartPlan)" strokeWidth={2} strokeDasharray="4 4" fill="none" />
        <path d={toPath(actual)} stroke="var(--chartActual)" strokeWidth={2} fill="none" />
      </svg>
    );
    if (inCard) {
      return (
        <View backgroundColor="$backgroundCard" borderRadius={16} padding={20}>{inner}</View>
      );
    }
    return inner;
  }
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloTrajectoryChart } from "./PekuloTrajectoryChart";
  describe("PekuloTrajectoryChart snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(
        <PekuloTrajectoryChart months={[1,2,3,4,5,6]} actual={[100,110,115,123,130,140]} plan={[100,108,116,124,132,140]} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloTrajectoryChart } from "./PekuloTrajectoryChart";
  describe("PekuloTrajectoryChart a11y", () => {
    it("has no serious/critical violations (svg has aria-label)", async () => {
      const { container } = renderWithTamagui(
        <PekuloTrajectoryChart months={[1,2,3]} actual={[100,110,120]} plan={[100,105,110]} />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloTrajectoryChart.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloTrajectoryChart + tests"`

- [ ] **T5.7** — `PekuloProjectionChart` (same shape as TrajectoryChart but adds end markers + projection range):

  ```tsx
  "use client";

  import { View, Text } from "tamagui";

  export interface PekuloProjectionChartProps {
    years: number[];
    actual: number[];
    required: number[];
    /** Filled marker year value (where the user is now). */
    nowMarker?: { year: number; value: number };
    /** Outlined marker at horizon (the cap). */
    capMarker?: { year: number; value: number };
  }

  export function PekuloProjectionChart({ years, actual, required, nowMarker, capMarker }: PekuloProjectionChartProps) {
    const width = 600;
    const height = 220;
    const padding = 12;
    const all = [...actual, ...required];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = Math.max(max - min, 1);
    const xStep = (width - 2 * padding) / Math.max(years.length - 1, 1);
    const toX = (i: number) => padding + i * xStep;
    const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
    const toPath = (d: number[]) => d.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
    const idxOf = (y: number) => Math.max(0, years.indexOf(y));
    return (
      <View>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projection vs cap-required">
          <path d={toPath(required)} stroke="var(--chartPlan)" strokeWidth={2} strokeDasharray="4 4" fill="none" />
          <path d={toPath(actual)} stroke="var(--chartActual)" strokeWidth={2} fill="none" />
          {nowMarker && (
            <circle cx={toX(idxOf(nowMarker.year))} cy={toY(nowMarker.value)} r={5} fill="var(--chartActual)" />
          )}
          {capMarker && (
            <circle cx={toX(idxOf(capMarker.year))} cy={toY(capMarker.value)} r={5} fill="none" stroke="var(--chartActual)" strokeWidth={2} />
          )}
        </svg>
        <View flexDirection="row" justifyContent="space-between" marginTop={4}>
          <Text color="$colorTertiary" fontSize={11}>{years[0]}</Text>
          <Text color="$colorTertiary" fontSize={11}>{years[years.length - 1]}</Text>
        </View>
      </View>
    );
  }
  ```

  Snapshot + a11y (template ; default props with 4-year arrays + both markers).
  Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloProjectionChart.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloProjectionChart + tests"`

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloProjectionChart } from "./PekuloProjectionChart";
  describe("PekuloProjectionChart snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(
        <PekuloProjectionChart years={[2026,2030,2040,2055]} actual={[180,250,400,650]} required={[180,260,420,800]} nowMarker={{ year: 2026, value: 180 }} capMarker={{ year: 2055, value: 800 }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloProjectionChart } from "./PekuloProjectionChart";
  describe("PekuloProjectionChart a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloProjectionChart years={[2026,2055]} actual={[180,650]} required={[180,800]} />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T5.8** — `PekuloHypothesisVerdict`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";

  export interface PekuloHypothesisVerdictProps {
    /** Capital projeté à l'horizon. */
    projectedEur: number;
    /** Cap demandé. */
    requiredEur: number;
    /** Année cible. */
    targetYear: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export function PekuloHypothesisVerdict({ projectedEur, requiredEur, targetYear }: PekuloHypothesisVerdictProps) {
    const delta = projectedEur - requiredEur;
    const sign = delta >= 0 ? "+" : "−";
    const reaches = delta >= 0;
    return (
      <View flexDirection="column" gap={4}>
        <Text color="$color" fontSize={14} fontWeight="500">
          {reaches ? `Tu atteins ton cap en ${targetYear}.` : `Tu n'atteins pas ton cap en ${targetYear}.`}
        </Text>
        <Text color={(reaches ? "$success" : "$danger") as never} fontSize={13} fontWeight="500">
          {sign}{eur0.format(Math.abs(delta))} vs cap requis
        </Text>
      </View>
    );
  }
  ```

  Snapshot + a11y (default+negative). Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloHypothesisVerdict.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloHypothesisVerdict + tests"`

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";
  describe("PekuloHypothesisVerdict snapshot", () => {
    it("renders reaches", () => {
      const { container } = renderWithTamagui(<PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders not-reaches", () => {
      const { container } = renderWithTamagui(<PekuloHypothesisVerdict projectedEur={650000} requiredEur={800000} targetYear={2055} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";
  describe("PekuloHypothesisVerdict a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T5.9** — `PekuloUserDot`:

  ```tsx
  "use client";

  import { Text, View, styled } from "tamagui";

  export interface PekuloUserDotProps {
    /** First letter (uppercased internally). */
    initial: string;
    onPress?: () => void;
  }

  const Bubble = styled(View, {
    name: "PekuloUserDotBubble",
    tag: "button",
    role: "button",
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: "$backgroundMuted",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    hoverStyle: { backgroundColor: "$backgroundElevated" },
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineOffset: 2,
    },
    $gtMd: { width: 40, height: 40 },
  });

  export function PekuloUserDot({ initial, onPress }: PekuloUserDotProps) {
    return (
      <Bubble onPress={onPress} aria-label="Compte utilisateur">
        <Text color="$color" fontSize={16} fontWeight="600">{initial.charAt(0).toUpperCase()}</Text>
      </Bubble>
    );
  }
  ```

  Snapshot + a11y (incl. keyboard activation — clickable). Add to barrel.
  Commit similarly.

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloUserDot } from "./PekuloUserDot";
  describe("PekuloUserDot snapshot", () => {
    it("renders initial", () => {
      const { container } = renderWithTamagui(<PekuloUserDot initial="a" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloUserDot } from "./PekuloUserDot";
  describe("PekuloUserDot a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloUserDot initial="A" />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("activates onPress via click", () => {
      const onPress = vi.fn();
      const { getByRole } = renderWithTamagui(<PekuloUserDot initial="A" onPress={onPress} />);
      fireEvent.click(getByRole("button"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
  ```

  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloUserDot -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloUserDot`
  Expected: `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloUserDot.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloUserDot + tests"`

- [ ] **T5.10** — `PekuloNavRail` (floating sidebar bubble, lg+ only). Per UX `<NavRail>` 64px wide, fixed `left-4 top-4 bottom-4`, `bg-card rounded-xl`. Brand icon top, 5 nav items middle, settings bottom.

  ```tsx
  "use client";

  import type { ComponentType } from "react";
  import { View, Text, styled } from "tamagui";
  import { Compass, Receipt, LineChart, Wallet, Building2, Settings } from "lucide-react";

  export type PekuloNavKey = "cap" | "transactions" | "monthly" | "portfolio" | "realestate" | "settings";

  type LucideIcon = ComponentType<{ size?: number; color?: string }>;

  interface NavItem { key: PekuloNavKey; label: string; icon: LucideIcon }

  const NAV_ITEMS: NavItem[] = [
    { key: "cap", label: "Cap", icon: Compass },
    { key: "transactions", label: "Transactions", icon: Receipt },
    { key: "monthly", label: "Mensuel", icon: LineChart },
    { key: "portfolio", label: "Portefeuille", icon: Wallet },
    { key: "realestate", label: "Immobilier", icon: Building2 },
  ];

  const NavButton = styled(View, {
    name: "PekuloNavRailButton",
    tag: "button",
    role: "button",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    hoverStyle: { backgroundColor: "$backgroundMuted" },
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
    },
    variants: {
      active: {
        true: { backgroundColor: "$backgroundMuted" },
      },
    } as const,
  });

  export interface PekuloNavRailProps {
    activeKey: PekuloNavKey;
    onSelect: (key: PekuloNavKey) => void;
  }

  export function PekuloNavRail({ activeKey, onSelect }: PekuloNavRailProps) {
    return (
      <View
        tag="nav"
        aria-label="Navigation principale"
        position="fixed"
        left={16}
        top={16}
        bottom={16}
        width={64}
        backgroundColor="$backgroundCard"
        borderRadius={16}
        paddingVertical={16}
        flexDirection="column"
        alignItems="center"
        justifyContent="space-between"
        $md={{ display: "none" }}
      >
        <Text color="$color" fontSize={18} fontWeight="600">P</Text>
        <View flexDirection="column" gap={8}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <NavButton key={key} active={activeKey === key} onPress={() => onSelect(key)} aria-label={label} aria-current={activeKey === key ? "page" : undefined}>
              <Icon size={20} color="currentColor" />
            </NavButton>
          ))}
        </View>
        <NavButton active={activeKey === "settings"} onPress={() => onSelect("settings")} aria-label="Paramètres" aria-current={activeKey === "settings" ? "page" : undefined}>
          <Settings size={20} color="currentColor" />
        </NavButton>
      </View>
    );
  }
  ```

  Snapshot + a11y (default + interactive — click on a nav item):

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloNavRail } from "./PekuloNavRail";
  describe("PekuloNavRail snapshot", () => {
    it("renders cap active", () => {
      const { container } = renderWithTamagui(<PekuloNavRail activeKey="cap" onSelect={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloNavRail } from "./PekuloNavRail";
  describe("PekuloNavRail a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloNavRail activeKey="cap" onSelect={vi.fn()} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("calls onSelect when a nav item is clicked", () => {
      const onSelect = vi.fn();
      const { getByLabelText } = renderWithTamagui(<PekuloNavRail activeKey="cap" onSelect={onSelect} />);
      fireEvent.click(getByLabelText("Transactions"));
      expect(onSelect).toHaveBeenCalledWith("transactions");
    });
  });
  ```

  Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloNavRail.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloNavRail + tests"`

- [ ] **T5.11** — `PekuloTopTabToggle`:

  ```tsx
  "use client";

  import { Text, View, styled } from "tamagui";

  export type PekuloTopTab = "cap" | "patrimoine";

  const TabButton = styled(View, {
    name: "PekuloTopTabButton",
    tag: "button",
    role: "tab",
    cursor: "pointer",
    paddingHorizontal: 4,
    paddingVertical: 4,
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineOffset: 2,
      borderRadius: 4,
    },
  });

  export interface PekuloTopTabToggleProps {
    topTab: PekuloTopTab;
    onChange: (t: PekuloTopTab) => void;
  }

  export function PekuloTopTabToggle({ topTab, onChange }: PekuloTopTabToggleProps) {
    return (
      <View flexDirection="row" gap={16} role="tablist" aria-label="Vue cap ou patrimoine">
        <TabButton onPress={() => onChange("cap")} aria-selected={topTab === "cap"}>
          <Text color={(topTab === "cap" ? "$color" : "$colorTertiary") as never} fontSize={20} fontWeight="600">Cap</Text>
        </TabButton>
        <TabButton onPress={() => onChange("patrimoine")} aria-selected={topTab === "patrimoine"}>
          <Text color={(topTab === "patrimoine" ? "$color" : "$colorTertiary") as never} fontSize={20} fontWeight="600">Patrimoine</Text>
        </TabButton>
      </View>
    );
  }
  ```

  Snapshot + a11y (default + click switches):

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloTopTabToggle } from "./PekuloTopTabToggle";
  describe("PekuloTopTabToggle snapshot", () => {
    it("renders cap active", () => {
      const { container } = renderWithTamagui(<PekuloTopTabToggle topTab="cap" onChange={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders patrimoine active", () => {
      const { container } = renderWithTamagui(<PekuloTopTabToggle topTab="patrimoine" onChange={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloTopTabToggle } from "./PekuloTopTabToggle";
  describe("PekuloTopTabToggle a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloTopTabToggle topTab="cap" onChange={vi.fn()} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("calls onChange on click", () => {
      const onChange = vi.fn();
      const { getAllByRole } = renderWithTamagui(<PekuloTopTabToggle topTab="cap" onChange={onChange} />);
      fireEvent.click(getAllByRole("tab")[1]);
      expect(onChange).toHaveBeenCalledWith("patrimoine");
    });
  });
  ```

  Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloTopTabToggle.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloTopTabToggle + tests"`

- [ ] **T5.12** — `PekuloContextualAddButton`:

  ```tsx
  "use client";

  // Mobile-only primary "+" button, white circle 44 × 44, hidden on lg+.
  // Renders only when activeNav ∈ {transactions, portfolio, realestate}.

  import { View, styled } from "tamagui";
  import { Plus } from "lucide-react";
  import type { PekuloNavKey } from "./PekuloNavRail";

  const FAB = styled(View, {
    name: "PekuloContextualAddFab",
    tag: "button",
    role: "button",
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: "$color",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    pressStyle: { scale: 0.95 },
    focusVisibleStyle: {
      outlineColor: "$borderFocus",
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineOffset: 2,
    },
    $gtMd: { display: "none" },
  });

  const SHOW_FOR: PekuloNavKey[] = ["transactions", "portfolio", "realestate"];

  export interface PekuloContextualAddButtonProps {
    activeNav: PekuloNavKey;
    label: string;
    onPress: () => void;
  }

  export function PekuloContextualAddButton({ activeNav, label, onPress }: PekuloContextualAddButtonProps) {
    if (!SHOW_FOR.includes(activeNav)) return null;
    return (
      <FAB onPress={onPress} aria-label={label}>
        <Plus size={22} color="var(--background)" />
      </FAB>
    );
  }
  ```

  Snapshot + a11y:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloContextualAddButton } from "./PekuloContextualAddButton";
  describe("PekuloContextualAddButton snapshot", () => {
    it("renders for transactions", () => {
      const { container } = renderWithTamagui(<PekuloContextualAddButton activeNav="transactions" label="Ajouter une transaction" onPress={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders nothing for cap", () => {
      const { container } = renderWithTamagui(<PekuloContextualAddButton activeNav="cap" label="..." onPress={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloContextualAddButton } from "./PekuloContextualAddButton";
  describe("PekuloContextualAddButton a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloContextualAddButton activeNav="transactions" label="Ajouter" onPress={vi.fn()} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("activates on click", () => {
      const onPress = vi.fn();
      const { getByRole } = renderWithTamagui(<PekuloContextualAddButton activeNav="portfolio" label="Ajouter" onPress={onPress} />);
      fireEvent.click(getByRole("button"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
  ```

  Add to barrel.
  Commit: `git add packages/ui/src/components/PekuloContextualAddButton.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloContextualAddButton + tests"`

---

### T6 — Feature surface components (15 components)

> Same per-component shape as T5 (component file + snapshot test + a11y test, add to barrel, single commit). All test files use `renderWithTamagui()` + the snapshot/a11y conventions from §4.

- [ ] **T6.1** — `PekuloAccountRow` (`packages/ui/src/components/PekuloAccountRow.tsx`):

  ```tsx
  "use client";

  import { Text, View } from "tamagui";

  export type PekuloAccountType = "livret" | "pea" | "cto" | "av" | "autre";

  export interface PekuloAccountRowProps {
    label: string;
    type: PekuloAccountType;
    institution?: string;
    balanceEur: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const TYPE_LABEL: Record<PekuloAccountType, string> = {
    livret: "Livret",
    pea: "PEA",
    cto: "CTO",
    av: "Assurance vie",
    autre: "Autre",
  };

  export function PekuloAccountRow({ label, type, institution, balanceEur }: PekuloAccountRowProps) {
    const sub = institution ? `${TYPE_LABEL[type]} · ${institution}` : TYPE_LABEL[type];
    return (
      <View flexDirection="row" alignItems="center" justifyContent="space-between" paddingVertical={12}>
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500">{label}</Text>
          <Text color="$colorTertiary" fontSize={12}>{sub}</Text>
        </View>
        <Text color="$color" fontSize={14} fontWeight="500">{eur0.format(balanceEur)}</Text>
      </View>
    );
  }
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloAccountRow } from "./PekuloAccountRow";
  describe("PekuloAccountRow snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(<PekuloAccountRow label="PEA Bourso" type="pea" institution="Boursorama" balanceEur={45200} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloAccountRow } from "./PekuloAccountRow";
  describe("PekuloAccountRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloAccountRow label="Livret A" type="livret" balanceEur={12500} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel.
  Run: `bun --filter='@pekulo/ui' run test -- src/components/PekuloAccountRow -u && bun --filter='@pekulo/ui' run test -- src/components/PekuloAccountRow`
  Expected: `Tests  2 passed`, exit 0.
  Commit: `git add packages/ui/src/components/PekuloAccountRow.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloAccountRow + tests"`

- [ ] **T6.2** — `PekuloHoldingRow`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";

  export type PekuloHoldingKind = "etf" | "action" | "crypto" | "autre";

  export interface PekuloHolding {
    ticker: string;
    label: string;
    account: string;
    kind: PekuloHoldingKind;
    quantity: number;
    pricePerUnit: number;
    marketValueEur: number;
    pnlEur: number;
    pnlPct: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  const KIND_LABEL: Record<PekuloHoldingKind, string> = { etf: "ETF", action: "Action", crypto: "Crypto", autre: "Autre" };

  export interface PekuloHoldingRowProps { holding: PekuloHolding }

  export function PekuloHoldingRow({ holding }: PekuloHoldingRowProps) {
    const sign = holding.pnlEur >= 0 ? "+" : "−";
    const tone = holding.pnlEur >= 0 ? "$success" : "$danger";
    const pctSign = holding.pnlPct >= 0 ? "+" : "−";
    return (
      <View flexDirection="row" alignItems="flex-start" justifyContent="space-between" paddingVertical={12} gap={12}>
        <View flex={1}>
          <View flexDirection="row" alignItems="baseline" gap={6}>
            <Text color="$color" fontSize={14} fontWeight="600">{holding.ticker}</Text>
            <Text color="$colorTertiary" fontSize={11} fontWeight="500">{KIND_LABEL[holding.kind].toUpperCase()}</Text>
          </View>
          <Text color="$colorTertiary" fontSize={12}>{holding.label} · {holding.account}</Text>
          <Text color="$colorTertiary" fontSize={11} display="none" $gtMd={{ display: "flex" }}>
            {holding.quantity} × {eur2.format(holding.pricePerUnit)}
          </Text>
        </View>
        <View alignItems="flex-end">
          <Text color="$color" fontSize={14} fontWeight="500">{eur0.format(holding.marketValueEur)}</Text>
          <Text color={tone as never} fontSize={12}>{sign}{eur0.format(Math.abs(holding.pnlEur))} ({pctSign}{Math.abs(holding.pnlPct).toFixed(1)}%)</Text>
        </View>
      </View>
    );
  }
  ```

  Snapshot + a11y (default):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloHoldingRow } from "./PekuloHoldingRow";
  describe("PekuloHoldingRow snapshot", () => {
    it("renders gain", () => {
      const { container } = renderWithTamagui(
        <PekuloHoldingRow holding={{ ticker: "CW8.PA", label: "MSCI World", account: "PEA", kind: "etf", quantity: 142, pricePerUnit: 532.5, marketValueEur: 75615, pnlEur: 8420, pnlPct: 12.5 }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders loss", () => {
      const { container } = renderWithTamagui(
        <PekuloHoldingRow holding={{ ticker: "BTC", label: "Bitcoin", account: "Crypto.com", kind: "crypto", quantity: 0.45, pricePerUnit: 56000, marketValueEur: 25200, pnlEur: -3800, pnlPct: -13.1 }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloHoldingRow } from "./PekuloHoldingRow";
  describe("PekuloHoldingRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloHoldingRow holding={{ ticker: "CW8.PA", label: "MSCI World", account: "PEA", kind: "etf", quantity: 100, pricePerUnit: 500, marketValueEur: 50000, pnlEur: 5000, pnlPct: 11 }} />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel ; commit.
  Commit: `git add packages/ui/src/components/PekuloHoldingRow.{tsx,snapshot.test.tsx,a11y.test.tsx} packages/ui/src/components/index.ts && git commit -m "feat(#10): PekuloHoldingRow + tests"`

- [ ] **T6.3** — `PekuloClassRow`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { PekuloDonut } from "./PekuloDonut";

  export interface PekuloClassRowProps {
    label: string;
    amountEur: number;
    pct: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export function PekuloClassRow({ label, amountEur, pct }: PekuloClassRowProps) {
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={10}>
        <PekuloDonut pct={pct} size={28} stroke={3} />
        <Text color="$color" fontSize={14} fontWeight="500" flex={1}>{label}</Text>
        <Text color="$color" fontSize={14} fontWeight="500">{eur0.format(amountEur)}</Text>
        <Text color="$colorTertiary" fontSize={12}>{Math.round(pct * 100)}%</Text>
      </View>
    );
  }
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloClassRow } from "./PekuloClassRow";
  describe("PekuloClassRow snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(<PekuloClassRow label="ETF" amountEur={62000} pct={0.55} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloClassRow } from "./PekuloClassRow";
  describe("PekuloClassRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloClassRow label="Crypto" amountEur={12000} pct={0.08} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloClassRow + tests`.

- [ ] **T6.4** — `PekuloPropertyCard`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { PekuloDonut } from "./PekuloDonut";

  export interface PekuloProperty {
    label: string;
    valuationEur: number;
    debtRemainingEur: number;
    monthlyPaymentEur: number;
    yearsRemaining: number;
    repaidPct: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export interface PekuloPropertyCardProps { property: PekuloProperty }

  export function PekuloPropertyCard({ property }: PekuloPropertyCardProps) {
    const equity = property.valuationEur - property.debtRemainingEur;
    return (
      <View backgroundColor="$backgroundCard" borderRadius={16} padding={20}>
        <Text color="$color" fontSize={16} fontWeight="600">{property.label}</Text>
        <View flexDirection="column" $gtMd={{ flexDirection: "row" }} gap={20} marginTop={16}>
          <View flex={1}>
            <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>VALORISATION</Text>
            <Text color="$color" fontSize={20} fontWeight="600" marginTop={4}>{eur0.format(property.valuationEur)}</Text>
            <Text color="$colorTertiary" fontSize={12} marginTop={8}>EQUITY</Text>
            <Text color="$color" fontSize={16} fontWeight="500">{eur0.format(equity)}</Text>
          </View>
          <View flex={1}>
            <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>DETTE RESTANTE</Text>
            <Text color="$color" fontSize={16} fontWeight="500" marginTop={4}>{eur0.format(property.debtRemainingEur)}</Text>
            <Text color="$colorTertiary" fontSize={12} marginTop={8}>MENSUALITÉ · {property.yearsRemaining} ans restants</Text>
            <Text color="$color" fontSize={14} fontWeight="500">{eur0.format(property.monthlyPaymentEur)}</Text>
          </View>
        </View>
        <View flexDirection="row" alignItems="center" gap={12} marginTop={16} paddingTop={16}>
          <PekuloDonut pct={property.repaidPct} size={32} stroke={3} />
          <Text color="$colorSecondary" fontSize={13}>{Math.round(property.repaidPct * 100)}% remboursé</Text>
        </View>
      </View>
    );
  }
  ```

  Snapshot:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloPropertyCard } from "./PekuloPropertyCard";
  describe("PekuloPropertyCard snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(
        <PekuloPropertyCard property={{ label: "Appartement Lyon", valuationEur: 320000, debtRemainingEur: 180000, monthlyPaymentEur: 1240, yearsRemaining: 18, repaidPct: 0.31 }} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloPropertyCard } from "./PekuloPropertyCard";
  describe("PekuloPropertyCard a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloPropertyCard property={{ label: "Appartement", valuationEur: 320000, debtRemainingEur: 180000, monthlyPaymentEur: 1240, yearsRemaining: 18, repaidPct: 0.31 }} />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloPropertyCard + tests`.

- [ ] **T6.5** — `PekuloSuggestionRow`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";

  export type PekuloLlmRoute = "ios" | "ollama" | "cloud";

  export interface PekuloSuggestion {
    label: string;
    account: string;
    dateLabel: string;
    direction: "in" | "out";
    amountEur: number;
    suggestedCategory: string;
    confidence: number;
    route: PekuloLlmRoute;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const ROUTE_LABEL: Record<PekuloLlmRoute, string> = { ios: "iOS", ollama: "Ollama", cloud: "Cloud" };

  export interface PekuloSuggestionRowProps {
    tx: PekuloSuggestion;
    onConfirm?: () => void;
    onEdit?: () => void;
  }

  export function PekuloSuggestionRow({ tx, onConfirm, onEdit }: PekuloSuggestionRowProps) {
    const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
    const sign = tx.direction === "in" ? "+" : "−";
    return (
      <View flexDirection="column" gap={8} paddingVertical={12}>
        <View flexDirection="row" alignItems="center" gap={12}>
          <Arrow size={18} color="var(--colorSecondary)" />
          <View flex={1}>
            <Text color="$color" fontSize={14} fontWeight="500">{tx.label}</Text>
            <Text color="$colorTertiary" fontSize={12}>{tx.account} · {tx.dateLabel}</Text>
          </View>
          <Text color="$color" fontSize={14} fontWeight="500">{sign}{eur0.format(tx.amountEur)}</Text>
        </View>
        <View flexDirection="row" alignItems="center" gap={8} flexWrap="wrap">
          <View flexDirection="row" alignItems="center" gap={4} paddingHorizontal={8} paddingVertical={3} borderRadius={9999} backgroundColor="$backgroundMuted">
            <Sparkles size={12} color="var(--accent)" />
            <Text color="$colorSecondary" fontSize={12}>{tx.suggestedCategory}</Text>
          </View>
          <Text color={(tx.confidence < 0.75 ? "$warning" : "$colorTertiary") as never} fontSize={12}>{Math.round(tx.confidence * 100)}%</Text>
          <Text color="$colorTertiary" fontSize={12} display="none" $gtSm={{ display: "flex" }}>· {ROUTE_LABEL[tx.route]}</Text>
          <View flex={1} />
          <View
            tag="button"
            role="button"
            onPress={onConfirm}
            paddingHorizontal={12}
            paddingVertical={6}
            borderRadius={9999}
            backgroundColor="$color"
            cursor="pointer"
            focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 }}
            aria-label="Confirmer la catégorie"
          >
            <Text color="$colorOnAccent" fontSize={12} fontWeight="600">✓ Confirmer</Text>
          </View>
          <View
            tag="button"
            role="button"
            onPress={onEdit}
            paddingHorizontal={8}
            paddingVertical={6}
            cursor="pointer"
            aria-label="Modifier la catégorie"
          >
            <Text color="$colorSecondary" fontSize={12}>Modifier</Text>
          </View>
        </View>
      </View>
    );
  }
  ```

  Snapshot + a11y:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSuggestionRow } from "./PekuloSuggestionRow";
  describe("PekuloSuggestionRow snapshot", () => {
    it("renders pending suggestion", () => {
      const { container } = renderWithTamagui(
        <PekuloSuggestionRow
          tx={{ label: "Carrefour", account: "CB Bourso", dateLabel: "12 mai", direction: "out", amountEur: 87, suggestedCategory: "Courses", confidence: 0.91, route: "ios" }}
          onConfirm={vi.fn()}
          onEdit={vi.fn()}
        />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders low-confidence (<75%) warning tone", () => {
      const { container } = renderWithTamagui(
        <PekuloSuggestionRow
          tx={{ label: "AMZN MKTPL", account: "CB", dateLabel: "10 mai", direction: "out", amountEur: 42, suggestedCategory: "Maison", confidence: 0.62, route: "cloud" }}
          onConfirm={vi.fn()}
          onEdit={vi.fn()}
        />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSuggestionRow } from "./PekuloSuggestionRow";
  describe("PekuloSuggestionRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloSuggestionRow
          tx={{ label: "Tx", account: "PEA", dateLabel: "1 jan", direction: "in", amountEur: 100, suggestedCategory: "Salaire", confidence: 0.9, route: "ios" }}
          onConfirm={vi.fn()} onEdit={vi.fn()}
        />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("calls onConfirm + onEdit", () => {
      const onConfirm = vi.fn();
      const onEdit = vi.fn();
      const { getByLabelText } = renderWithTamagui(
        <PekuloSuggestionRow
          tx={{ label: "Tx", account: "PEA", dateLabel: "1 jan", direction: "in", amountEur: 100, suggestedCategory: "Salaire", confidence: 0.9, route: "ios" }}
          onConfirm={onConfirm} onEdit={onEdit}
        />,
      );
      fireEvent.click(getByLabelText("Confirmer la catégorie"));
      fireEvent.click(getByLabelText("Modifier la catégorie"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloSuggestionRow + tests`.

- [ ] **T6.6** — `PekuloActivityRow`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { ArrowDownRight, ArrowUpRight } from "lucide-react";

  export interface PekuloActivity {
    label: string;
    account: string;
    category: string;
    direction: "in" | "out";
    amountEur: number;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export interface PekuloActivityRowProps { tx: PekuloActivity }

  export function PekuloActivityRow({ tx }: PekuloActivityRowProps) {
    const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
    const arrowColor = tx.direction === "in" ? "var(--success)" : "var(--colorTertiary)";
    const sign = tx.direction === "in" ? "+" : "−";
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={10}>
        <Arrow size={18} color={arrowColor} />
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500">{tx.label}</Text>
          <Text color="$colorTertiary" fontSize={12}>{tx.account} · {tx.category}</Text>
        </View>
        <Text color="$color" fontSize={14} fontWeight="500">{sign}{eur0.format(tx.amountEur)}</Text>
      </View>
    );
  }
  ```

  Snapshot + a11y standard.
  Commit `feat(#10): PekuloActivityRow + tests`.

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloActivityRow } from "./PekuloActivityRow";
  describe("PekuloActivityRow snapshot", () => {
    it("renders inflow", () => {
      const { container } = renderWithTamagui(<PekuloActivityRow tx={{ label: "Salaire", account: "Compte courant", category: "Revenus", direction: "in", amountEur: 3200 }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders outflow", () => {
      const { container } = renderWithTamagui(<PekuloActivityRow tx={{ label: "Carrefour", account: "CB", category: "Courses", direction: "out", amountEur: 87 }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloActivityRow } from "./PekuloActivityRow";
  describe("PekuloActivityRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloActivityRow tx={{ label: "Salaire", account: "CC", category: "Revenus", direction: "in", amountEur: 3200 }} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T6.7** — `PekuloMonthlyRow`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";
  import { Check } from "lucide-react";

  export interface PekuloMonthlyRecord {
    monthLabel: string;
    incomeEur: number;
    spendingEur: number;
    netEur: number;
    closed?: boolean;
  }

  const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  export interface PekuloMonthlyRowProps { month: PekuloMonthlyRecord }

  export function PekuloMonthlyRow({ month }: PekuloMonthlyRowProps) {
    const sign = month.netEur >= 0 ? "+" : "−";
    const tone = month.netEur >= 0 ? "$success" : "$danger";
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={12}>
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500" textTransform="capitalize">{month.monthLabel}</Text>
          <Text color="$colorTertiary" fontSize={12}>+{eur0.format(month.incomeEur)} · −{eur0.format(month.spendingEur)}</Text>
        </View>
        <Text color={tone as never} fontSize={14} fontWeight="500">{sign}{eur0.format(Math.abs(month.netEur))}</Text>
        {month.closed && (
          <View flexDirection="row" alignItems="center" gap={4} paddingHorizontal={8} paddingVertical={3} borderRadius={9999} backgroundColor="$backgroundMuted">
            <Check size={12} color="currentColor" />
            <Text color="$colorSecondary" fontSize={11}>Clôturé</Text>
          </View>
        )}
      </View>
    );
  }
  ```

  Snapshot + a11y standard. Commit `feat(#10): PekuloMonthlyRow + tests`.

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloMonthlyRow } from "./PekuloMonthlyRow";
  describe("PekuloMonthlyRow snapshot", () => {
    it("renders open positive net", () => {
      const { container } = renderWithTamagui(<PekuloMonthlyRow month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders closed negative net", () => {
      const { container } = renderWithTamagui(<PekuloMonthlyRow month={{ monthLabel: "avril 2026", incomeEur: 3200, spendingEur: 3500, netEur: -300, closed: true }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloMonthlyRow } from "./PekuloMonthlyRow";
  describe("PekuloMonthlyRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloMonthlyRow month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T6.8** — `PekuloStat`:

  ```tsx
  "use client";

  import { Text, View } from "tamagui";

  export interface PekuloStatProps {
    label: string;
    value: string;
    tone?: "gain" | "loss";
  }

  export function PekuloStat({ label, value, tone }: PekuloStatProps) {
    const valueColor = tone === "gain" ? "$success" : tone === "loss" ? "$danger" : "$color";
    return (
      <View>
        <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>{label}</Text>
        <Text color={valueColor as never} fontSize={20} fontWeight="600" marginTop={4}>{value}</Text>
      </View>
    );
  }
  ```

  Snapshot + a11y. Commit `feat(#10): PekuloStat + tests`.

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloStat } from "./PekuloStat";
  describe("PekuloStat snapshot", () => {
    it("renders neutral", () => {
      const { container } = renderWithTamagui(<PekuloStat label="Net" value="+1 050 €" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders gain tone", () => {
      const { container } = renderWithTamagui(<PekuloStat label="Net" value="+1 050 €" tone="gain" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloStat } from "./PekuloStat";
  describe("PekuloStat a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloStat label="Sorties" value="−2 150 €" tone="loss" />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T6.9** — `PekuloSettingRow`:

  ```tsx
  "use client";

  import type { ReactNode } from "react";
  import { Text, View } from "tamagui";

  export interface PekuloSettingRowProps {
    label: string;
    value?: string;
    sub?: string;
    action?: ReactNode;
    destructive?: boolean;
  }

  export function PekuloSettingRow({ label, value, sub, action, destructive }: PekuloSettingRowProps) {
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={12}>
        <View flex={1}>
          <Text color={(destructive ? "$danger" : "$color") as never} fontSize={14} fontWeight="500">{label}</Text>
          {sub && <Text color="$colorTertiary" fontSize={12}>{sub}</Text>}
        </View>
        {value && <Text color="$colorSecondary" fontSize={14}>{value}</Text>}
        {action}
      </View>
    );
  }
  ```

  Snapshot + a11y. Commit `feat(#10): PekuloSettingRow + tests`.

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSettingRow } from "./PekuloSettingRow";
  describe("PekuloSettingRow snapshot", () => {
    it("renders default", () => {
      const { container } = renderWithTamagui(<PekuloSettingRow label="Email" value="alex@example.fr" />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders destructive", () => {
      const { container } = renderWithTamagui(<PekuloSettingRow label="Supprimer le compte" sub="Action irréversible" destructive />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSettingRow } from "./PekuloSettingRow";
  describe("PekuloSettingRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloSettingRow label="Email" value="alex@example.fr" />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

- [ ] **T6.10** — `PekuloToggleRow`:

  ```tsx
  "use client";

  import { useId } from "react";
  import { Text, View, styled } from "tamagui";

  export interface PekuloToggleRowProps {
    label: string;
    sub?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }

  const Switch = styled(View, {
    name: "PekuloToggleRowSwitch",
    tag: "button",
    width: 44,
    height: 26,
    borderRadius: 9999,
    cursor: "pointer",
    focusVisibleStyle: { outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 },
    variants: {
      checked: {
        true: { backgroundColor: "$accent" },
        false: { backgroundColor: "$backgroundMuted" },
      },
      disabled: { true: { opacity: 0.5, cursor: "not-allowed" } },
    } as const,
  });

  const Knob = styled(View, {
    name: "PekuloToggleRowKnob",
    width: 22,
    height: 22,
    borderRadius: 9999,
    backgroundColor: "$colorOnAccent",
    position: "absolute",
    top: 2,
  });

  export function PekuloToggleRow({ label, sub, checked, onChange, disabled }: PekuloToggleRowProps) {
    const id = useId();
    return (
      <View flexDirection="row" alignItems="center" gap={12} paddingVertical={12}>
        <View flex={1}>
          <Text color="$color" fontSize={14} fontWeight="500" htmlFor={id} tag="label">{label}</Text>
          {sub && <Text color="$colorTertiary" fontSize={12}>{sub}</Text>}
        </View>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled || undefined}
          aria-label={label}
          onPress={() => { if (!disabled) onChange(!checked); }}
        >
          <Knob left={checked ? 20 : 2} />
        </Switch>
      </View>
    );
  }
  ```

  Snapshot + a11y (incl. keyboard activation):

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloToggleRow } from "./PekuloToggleRow";
  describe("PekuloToggleRow snapshot", () => {
    it("renders unchecked", () => {
      const { container } = renderWithTamagui(<PekuloToggleRow label="LLM tiers" sub="Activer le routage cloud" checked={false} onChange={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders checked", () => {
      const { container } = renderWithTamagui(<PekuloToggleRow label="LLM tiers" checked onChange={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloToggleRow } from "./PekuloToggleRow";
  describe("PekuloToggleRow a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloToggleRow label="LLM tiers" checked={false} onChange={vi.fn()} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("toggles on click", () => {
      const onChange = vi.fn();
      const { getByRole } = renderWithTamagui(<PekuloToggleRow label="LLM tiers" checked={false} onChange={onChange} />);
      fireEvent.click(getByRole("switch"));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloToggleRow + tests`.

- [ ] **T6.11** — `PekuloSegmentedControl<T>`:

  ```tsx
  "use client";

  import type { ComponentType } from "react";
  import { Text, View, styled } from "tamagui";

  type LucideIcon = ComponentType<{ size?: number; color?: string }>;

  export interface PekuloSegmentedOption<T extends string> {
    value: T;
    label: string;
    icon: LucideIcon;
  }

  export interface PekuloSegmentedControlProps<T extends string> {
    value: T;
    onChange: (v: T) => void;
    options: PekuloSegmentedOption<T>[];
    ariaLabel: string;
  }

  const Segment = styled(View, {
    name: "PekuloSegmented",
    tag: "button",
    role: "radio",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    height: 36,
    borderRadius: 8,
    cursor: "pointer",
    focusVisibleStyle: { outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 },
    variants: {
      active: {
        true: { backgroundColor: "$backgroundElevated" },
      },
    } as const,
  });

  export function PekuloSegmentedControl<T extends string>({ value, onChange, options, ariaLabel }: PekuloSegmentedControlProps<T>) {
    return (
      <View role="radiogroup" aria-label={ariaLabel} flexDirection="row" gap={4} padding={4} backgroundColor="$backgroundMuted" borderRadius={10}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <Segment key={opt.value} active={active} onPress={() => onChange(opt.value)} aria-checked={active}>
              <Icon size={14} color="currentColor" />
              <Text color={(active ? "$color" : "$colorSecondary") as never} fontSize={13} fontWeight="500">{opt.label}</Text>
            </Segment>
          );
        })}
      </View>
    );
  }
  ```

  Snapshot + a11y:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { Sun, Moon, Monitor } from "lucide-react";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSegmentedControl } from "./PekuloSegmentedControl";
  describe("PekuloSegmentedControl snapshot", () => {
    it("renders 3 options, dark active", () => {
      const { container } = renderWithTamagui(
        <PekuloSegmentedControl<"system"|"dark"|"light">
          value="dark" onChange={vi.fn()}
          ariaLabel="Thème"
          options={[
            { value: "system", label: "Système", icon: Monitor },
            { value: "dark", label: "Sombre", icon: Moon },
            { value: "light", label: "Clair", icon: Sun },
          ]}
        />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { Sun, Moon, Monitor } from "lucide-react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSegmentedControl } from "./PekuloSegmentedControl";
  describe("PekuloSegmentedControl a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloSegmentedControl value="system" onChange={vi.fn()} ariaLabel="Thème"
          options={[
            { value: "system", label: "Système", icon: Monitor },
            { value: "dark", label: "Sombre", icon: Moon },
            { value: "light", label: "Clair", icon: Sun },
          ]}
        />,
      );
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("emits onChange on segment click", () => {
      const onChange = vi.fn();
      const { getAllByRole } = renderWithTamagui(
        <PekuloSegmentedControl<"a"|"b"> value="a" onChange={onChange} ariaLabel="x"
          options={[
            { value: "a", label: "A", icon: Sun },
            { value: "b", label: "B", icon: Moon },
          ]}
        />,
      );
      fireEvent.click(getAllByRole("radio")[1]);
      expect(onChange).toHaveBeenCalledWith("b");
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloSegmentedControl + tests`.

- [ ] **T6.12** — `PekuloEmptyState`:

  ```tsx
  "use client";

  import type { ComponentType } from "react";
  import { Text, View, styled } from "tamagui";

  type LucideIcon = ComponentType<{ size?: number; color?: string }>;

  export interface PekuloEmptyStateProps {
    icon: LucideIcon;
    title: string;
    message: string;
    ctaLabel?: string;
    onCta?: () => void;
  }

  const CtaPill = styled(View, {
    name: "PekuloEmptyStateCta",
    tag: "button",
    role: "button",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: "$color",
    cursor: "pointer",
    focusVisibleStyle: { outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 },
  });

  export function PekuloEmptyState({ icon: Icon, title, message, ctaLabel, onCta }: PekuloEmptyStateProps) {
    return (
      <View alignItems="center" gap={12} paddingVertical={32} paddingHorizontal={24}>
        <View width={56} height={56} borderRadius={9999} backgroundColor="$backgroundMuted" alignItems="center" justifyContent="center">
          <Icon size={24} color="var(--colorSecondary)" />
        </View>
        <Text color="$color" fontSize={16} fontWeight="600">{title}</Text>
        <Text color="$colorSecondary" fontSize={13} textAlign="center">{message}</Text>
        {ctaLabel && onCta && (
          <CtaPill onPress={onCta} aria-label={ctaLabel}>
            <Text color="$colorOnAccent" fontSize={13} fontWeight="600">{ctaLabel}</Text>
          </CtaPill>
        )}
      </View>
    );
  }
  ```

  Snapshot + a11y:

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { Check } from "lucide-react";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloEmptyState } from "./PekuloEmptyState";
  describe("PekuloEmptyState snapshot", () => {
    it("renders without CTA", () => {
      const { container } = renderWithTamagui(<PekuloEmptyState icon={Check} title="Tout est catégorisé" message="Aucune transaction en attente." />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders with CTA", () => {
      const { container } = renderWithTamagui(<PekuloEmptyState icon={Check} title="Pas de cap" message="Définis un cap pour commencer." ctaLabel="Définir un cap" onCta={vi.fn()} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { fireEvent } from "@testing-library/react";
  import { Check } from "lucide-react";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloEmptyState } from "./PekuloEmptyState";
  describe("PekuloEmptyState a11y", () => {
    it("has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(<PekuloEmptyState icon={Check} title="Tout est catégorisé" message="Aucune transaction en attente." />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
    it("CTA fires onCta", () => {
      const onCta = vi.fn();
      const { getByRole } = renderWithTamagui(<PekuloEmptyState icon={Check} title="t" message="m" ctaLabel="Go" onCta={onCta} />);
      fireEvent.click(getByRole("button"));
      expect(onCta).toHaveBeenCalledTimes(1);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloEmptyState + tests`.

- [ ] **T6.13** — `PekuloSkeleton`:

  ```tsx
  "use client";

  import { View } from "tamagui";

  export interface PekuloSkeletonProps {
    /** Number of grey lines (decreasing width). Default 1. */
    lines?: number;
    /** Single-block height (px). Default 16. */
    height?: number;
    /** Render as a single block instead of N lines. */
    block?: boolean;
  }

  export function PekuloSkeleton({ lines = 1, height = 16, block }: PekuloSkeletonProps) {
    if (block) {
      return (
        <View
          width="100%"
          height={height}
          borderRadius={8}
          backgroundColor="$backgroundMuted"
          opacity={0.6}
          aria-hidden
        />
      );
    }
    return (
      <View flexDirection="column" gap={6} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <View
            key={i}
            height={height}
            width={`${100 - i * 12}%`}
            borderRadius={6}
            backgroundColor="$backgroundMuted"
            opacity={0.6}
          />
        ))}
      </View>
    );
  }
  ```

  Snapshot + a11y:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloSkeleton } from "./PekuloSkeleton";
  describe("PekuloSkeleton snapshot", () => {
    it("renders single line", () => {
      const { container } = renderWithTamagui(<PekuloSkeleton />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders 3 lines", () => {
      const { container } = renderWithTamagui(<PekuloSkeleton lines={3} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders block", () => {
      const { container } = renderWithTamagui(<PekuloSkeleton block height={120} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloSkeleton } from "./PekuloSkeleton";
  describe("PekuloSkeleton a11y", () => {
    it("has no serious/critical violations (decorative)", async () => {
      const { container } = renderWithTamagui(<PekuloSkeleton lines={3} />);
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloSkeleton + tests`.

- [ ] **T6.14** — `PekuloErrorBoundary`:

  ```tsx
  "use client";

  // packages/ui/src/components/PekuloErrorBoundary.tsx
  // React 19 error boundary using a class component (still the only way to
  // catch render errors). No external dep.

  import { Component, type ErrorInfo, type ReactNode } from "react";
  import { Text, View } from "tamagui";

  export interface PekuloErrorBoundaryProps {
    fallback?: ReactNode;
    onError?: (error: Error, info: ErrorInfo) => void;
    children: ReactNode;
  }

  interface State {
    hasError: boolean;
    error: Error | null;
  }

  export class PekuloErrorBoundary extends Component<PekuloErrorBoundaryProps, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
      this.props.onError?.(error, info);
    }

    render() {
      if (this.state.hasError) {
        if (this.props.fallback) return this.props.fallback;
        return (
          <View
            backgroundColor="$backgroundCard"
            borderRadius={12}
            padding={20}
            role="alert"
            aria-live="polite"
          >
            <Text color="$danger" fontSize={14} fontWeight="600">Une erreur s'est produite.</Text>
            <Text color="$colorSecondary" fontSize={13} marginTop={4}>
              {this.state.error?.message ?? "Détails indisponibles."}
            </Text>
          </View>
        );
      }
      return this.props.children;
    }
  }
  ```

  Snapshot + a11y (test that fallback renders on a thrown error):

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloErrorBoundary } from "./PekuloErrorBoundary";

  function Boom(): never { throw new Error("kaboom"); }

  describe("PekuloErrorBoundary snapshot", () => {
    it("renders children when no error", () => {
      const { container } = renderWithTamagui(
        <PekuloErrorBoundary><span>ok</span></PekuloErrorBoundary>,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders default fallback when child throws", () => {
      // Suppress the React error log noise during this assertion.
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { container } = renderWithTamagui(<PekuloErrorBoundary><Boom /></PekuloErrorBoundary>);
      expect(container.innerHTML).toMatchSnapshot();
      spy.mockRestore();
    });
  });
  ```

  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloErrorBoundary } from "./PekuloErrorBoundary";

  function Boom(): never { throw new Error("kaboom"); }

  describe("PekuloErrorBoundary a11y", () => {
    it("fallback has role=alert and no serious violations", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { container, getByRole } = renderWithTamagui(<PekuloErrorBoundary><Boom /></PekuloErrorBoundary>);
      expect(getByRole("alert")).toBeInTheDocument();
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
      spy.mockRestore();
    });
  });
  ```

  Add to barrel ; commit `feat(#10): PekuloErrorBoundary + tests`.

- [ ] **T6.15** — `PekuloToast` + `useToast` + `<PekuloToastViewport>`:

  ```tsx
  // packages/ui/src/components/toast.tsx
  // Lightweight toast hook + viewport. No external dep ; pattern inspired by
  // sonner/Tamagui-Bento, but custom-built to avoid runtime deps.
  "use client";

  import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
  import { Text, View } from "tamagui";

  export type ToastIntent = "success" | "info" | "warning" | "danger";

  export interface ToastEntry {
    id: number;
    title: string;
    description?: string;
    intent: ToastIntent;
    durationMs: number;
  }

  interface ToastContextValue {
    show: (e: Omit<ToastEntry, "id" | "durationMs"> & { durationMs?: number }) => void;
    entries: ToastEntry[];
  }

  const ToastContext = createContext<ToastContextValue | null>(null);

  let toastSeq = 0;

  export function ToastProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<ToastEntry[]>([]);

    const show = useCallback<ToastContextValue["show"]>((e) => {
      const id = ++toastSeq;
      const entry: ToastEntry = { id, intent: e.intent, title: e.title, description: e.description, durationMs: e.durationMs ?? 4000 };
      setEntries((prev) => [...prev, entry]);
      const t = setTimeout(() => {
        setEntries((prev) => prev.filter((x) => x.id !== id));
      }, entry.durationMs);
      return () => clearTimeout(t);
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ show, entries }), [show, entries]);
    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
  }

  export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside <ToastProvider> (mounted by PekuloRootProvider).");
    const { show } = ctx;
    return useMemo(() => ({
      success: (title: string, description?: string, durationMs?: number) => show({ intent: "success", title, description, durationMs }),
      info: (title: string, description?: string, durationMs?: number) => show({ intent: "info", title, description, durationMs }),
      warning: (title: string, description?: string, durationMs?: number) => show({ intent: "warning", title, description, durationMs }),
      danger: (title: string, description?: string, durationMs?: number) => show({ intent: "danger", title, description, durationMs }),
    }), [show]);
  }

  function intentColor(intent: ToastIntent): string {
    return intent === "success" ? "$success" : intent === "danger" ? "$danger" : intent === "warning" ? "$warning" : "$info";
  }

  export function PekuloToast({ entry }: { entry: ToastEntry }) {
    return (
      <View
        backgroundColor="$backgroundElevated"
        borderRadius={12}
        padding={12}
        minWidth={280}
        role="status"
        aria-live="polite"
      >
        <View flexDirection="row" alignItems="flex-start" gap={8}>
          <View width={6} height={6} borderRadius={9999} marginTop={6} backgroundColor={intentColor(entry.intent) as never} />
          <View flex={1}>
            <Text color="$color" fontSize={13} fontWeight="600">{entry.title}</Text>
            {entry.description && <Text color="$colorSecondary" fontSize={12} marginTop={2}>{entry.description}</Text>}
          </View>
        </View>
      </View>
    );
  }

  export function PekuloToastViewport() {
    const ctx = useContext(ToastContext);
    if (!ctx) return null;
    return (
      <View position="fixed" bottom={16} right={16} flexDirection="column" gap={8} zIndex={1000}>
        {ctx.entries.map((e) => <PekuloToast key={e.id} entry={e} />)}
      </View>
    );
  }
  ```

  Then update `packages/ui/src/provider/index.tsx` (T4.0) to wrap children with `<ToastProvider>` and mount `<PekuloToastViewport />` next to children — patch:

  ```tsx
  // Inside <TamaguiProvider> body, replace `{children}` with:
  // <ToastProvider>
  //   {children}
  //   <PekuloToastViewport />
  // </ToastProvider>
  ```

  Snapshot + a11y on the standalone component:

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui } from "../../test/setup";
  import { PekuloToast } from "./toast";

  describe("PekuloToast snapshot", () => {
    it("renders success", () => {
      const { container } = renderWithTamagui(<PekuloToast entry={{ id: 1, title: "Sauvegardé", description: "Cap mis à jour", intent: "success", durationMs: 4000 }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
    it("renders danger", () => {
      const { container } = renderWithTamagui(<PekuloToast entry={{ id: 2, title: "Erreur", intent: "danger", durationMs: 4000 }} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
  ```

  ```tsx
  import { describe, it, expect } from "vitest";
  import { renderWithTamagui, axe } from "../../test/setup";
  import { PekuloToast } from "./toast";

  describe("PekuloToast a11y", () => {
    it("has role=status + no serious violations", async () => {
      const { container, getByRole } = renderWithTamagui(<PekuloToast entry={{ id: 3, title: "ok", intent: "info", durationMs: 4000 }} />);
      expect(getByRole("status")).toBeInTheDocument();
      const r = await axe(container);
      expect((r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    });
  });
  ```

  Add to barrel: `export * from "./toast";`. Update `provider/index.tsx` per the patch above.
  Run: `bun --filter='@pekulo/ui' run test -- src/components/toast -u && bun --filter='@pekulo/ui' run test -- src/components/toast`
  Expected: `Snapshots  2 passed`, `Tests  3 passed`, exit 0.
  Commit: `git add packages/ui/src/components/toast.tsx packages/ui/src/components/toast.snapshot.test.tsx packages/ui/src/components/toast.a11y.test.tsx packages/ui/src/components/index.ts packages/ui/src/provider/index.tsx && git commit -m "feat(#10): PekuloToast + useToast + viewport (mounted in provider)"`

- [ ] **T6.16** — Final barrel sanity check + full `@pekulo/ui` test sweep:

  Verify `packages/ui/src/components/index.ts` exports every component added in T5/T6 in alphabetical order. Final form:

  ```ts
  export * from "./PekuloAccountRow";
  export * from "./PekuloActivityRow";
  export * from "./PekuloClassRow";
  export * from "./PekuloCompositionRow";
  export * from "./PekuloContextualAddButton";
  export * from "./PekuloDonut";
  export * from "./PekuloEmptyState";
  export * from "./PekuloErrorBoundary";
  export * from "./PekuloHero";
  export * from "./PekuloHoldingRow";
  export * from "./PekuloHypothesisVerdict";
  export * from "./PekuloKpiTile";
  export * from "./PekuloMilestoneRow";
  export * from "./PekuloMonthlyRow";
  export * from "./PekuloNavRail";
  export * from "./PekuloProjectionChart";
  export * from "./PekuloPropertyCard";
  export * from "./PekuloSegmentedControl";
  export * from "./PekuloSettingRow";
  export * from "./PekuloSkeleton";
  export * from "./PekuloStat";
  export * from "./PekuloSuggestionRow";
  export * from "./PekuloToggleRow";
  export * from "./PekuloTopTabToggle";
  export * from "./PekuloTrajectoryChart";
  export * from "./PekuloUserDot";
  export * from "./toast";
  ```

  Run: `bun --filter='@pekulo/ui' run test`
  Expected: aggregate `Test Files  N passed`, `Tests  M passed`, `Snapshots  K passed`, exit 0 with N = number of test files (≈54: 27 components × 2 + 2 hooks + 2 primitives × 2 = 56), zero unmatched snapshots.
  Run: `bun --filter='@pekulo/ui' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/ui/src/components/index.ts && git commit -m "chore(#10): finalize @pekulo/ui components barrel (alphabetical)"`

---

### T7 — `apps/web` migration (Path C — décommission brutale) [AC: AC-1, AC-4]

- [ ] **T7.1** — Replace `apps/web/package.json` with the migrated manifest. The diff: remove `@base-ui/react`, all five `@tamagui/*` direct deps + `@tamagui/cli` devDep, `class-variance-authority`, `clsx`, `react-native-web`, `shadcn`, `tailwind-merge`, `tailwindcss-animate`, `tamagui`, `tw-animate-css`, `tailwindcss`, `@tailwindcss/postcss` ; add `@pekulo/ui: workspace:*` ; remove the `generate:tamagui-css` + `fix:tamagui-css` + `test:contrast` scripts (CSS generation now lives in `@pekulo/ui`):

  ```json
  {
    "name": "web",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "bun --bun next dev",
      "build": "bun --bun next build",
      "start": "next start",
      "typecheck": "tsc --noEmit"
    },
    "dependencies": {
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
      "@pekulo/ui": "workspace:*",
      "@pekulo/validators": "workspace:*",
      "@supabase/ssr": "^0.10.2",
      "@supabase/supabase-js": "^2.104.1",
      "@tanstack/react-form": "^1.29.1",
      "@tanstack/react-query": "^5.100.5",
      "@zapaction/core": "^0.2.2",
      "@zapaction/query": "^0.2.2",
      "lucide-react": "^1.11.0",
      "next": "16.2.4",
      "react": "19.2.4",
      "react-dom": "19.2.4",
      "recharts": "^3.8.0",
      "yahoo-finance2": "^3.14.0",
      "zod": "4.3.6"
    },
    "devDependencies": {
      "@pekulo/tsconfig": "workspace:*",
      "@types/bun": "^1.3.0",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "supabase": "^2.95.4",
      "typescript": "^6.0.3"
    },
    "trustedDependencies": [
      "unrs-resolver"
    ]
  }
  ```

  Note `recharts` retained — architecture L213 keeps it for non-trivial charts (compass curve + trajectory chart stay inline SVG, but feature epics may use recharts elsewhere). `lucide-react` retained — single icon family.

  Run: `bun install` (root)
  Expected: `Saved lockfile`, dependencies removed/added accordingly, exit 0.
  Run: `bun --filter=web run typecheck`
  Expected: **EXPECTED TO FAIL** at this step — the brownfield UI files (T7.x deletions) still import the removed deps. T7.2–T7.8 will progressively make typecheck green again. **Do NOT commit yet — proceed to T7.2 first**, then commit T7.1+T7.2 together.

- [ ] **T7.2** — Replace `apps/web/src/components/providers.tsx`:

  ```tsx
  // apps/web/src/components/providers.tsx
  "use client";

  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState, type ReactNode } from "react";
  import { PekuloRootProvider } from "@pekulo/ui";
  import "@/lib/zapaction/keys";

  export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
      () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
    );
    return (
      <PekuloRootProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PekuloRootProvider>
    );
  }
  ```

  Replace `apps/web/src/app/layout.tsx`:

  ```tsx
  // apps/web/src/app/layout.tsx
  import type { Metadata } from "next";
  import Script from "next/script";
  import "@pekulo/ui/reset.css";
  import "@pekulo/ui/generated.css";
  import { Providers } from "@/components/providers";

  export const metadata: Metadata = {
    title: { default: "Pekulo", template: "%s · Pekulo" },
    description: "Pekulo — pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
    applicationName: "Pekulo",
    keywords: ["pekulo", "plan financier", "épargne", "projection", "portefeuille", "ETF", "PEA"],
    authors: [{ name: "Pekulo" }],
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Pekulo",
      title: "Pekulo",
      description: "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses.",
    },
    twitter: { card: "summary", title: "Pekulo", description: "Pilote ton plan financier : épargne, projection de capital, portefeuille et hypothèses." },
    robots: { index: false, follow: false },
  };

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="fr" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  var t = localStorage.getItem('theme');
                  if (!t || t === 'system') {
                    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'pekulo-dark' : 'pekulo-light';
                  } else if (t === 'dark') t = 'pekulo-dark';
                  else if (t === 'light') t = 'pekulo-light';
                  document.documentElement.setAttribute('data-theme', t);
                } catch (e) {}
              `,
            }}
          />
          {process.env.NEXT_PUBLIC_REACT_GRAB === "1" && (
            <Script src="//unpkg.com/react-grab/dist/index.global.js" crossOrigin="anonymous" strategy="beforeInteractive" />
          )}
        </head>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    );
  }
  ```

  Notes on the layout change vs Step-0 quote:

  - The noscript theme bootstrap now writes `data-theme="pekulo-dark"` / `"pekulo-light"` (matching `<NextThemeProvider themes={...}>`) instead of toggling `class="dark"`.
  - The `body className="min-h-screen bg-background text-foreground"` is removed — Tailwind's `bg-background` is gone with the dep ; Tamagui's themed surfaces handle their own backgrounds, and the `<body>` background falls through to `--background` defined in `@pekulo/ui/generated.css`.
  - The legacy storage values (`light` / `dark` / `system`) are mapped to Pekulo's theme names ; if a user has a stale `localStorage.theme === "dark"` from before, this still resolves correctly.

  Run: `bun --filter=web run typecheck`
  Expected: **STILL EXPECTED TO FAIL** until T7.4–T7.8 land. Do NOT commit yet.

- [ ] **T7.3** — Delete brownfield UI files (no edits, just `git rm`):

  ```bash
  cd apps/web && rm -rf \
    src/app/globals.css \
    postcss.config.mjs \
    components.json \
    src/components/ui \
    src/components/charts \
    src/components/auth-form.tsx \
    src/components/theme-provider.tsx \
    src/components/theme-toggle.tsx \
    src/components/nav.tsx \
    src/components/kpi-card.tsx \
    src/components/phases.tsx \
    src/components/detail-cards.tsx \
    src/components/annual-table.tsx \
    src/app/dashboard/page.tsx \
    src/app/dashboard/loading.tsx \
    src/app/dashboard/mensuel \
    src/app/dashboard/parametres \
    src/app/dashboard/portefeuille \
    src/app/dashboard/transactions \
    "src/app/(spike)" \
    tamagui.config.ts \
    tamagui.build.ts \
    public/tamagui.generated.css
  ```

  (Use absolute paths or run from `apps/web/` ; the parens in `(spike)` are quoted to survive zsh.)

  Run: `git status`
  Expected: ~30 deletions staged.
  Commit: `git add -A apps/web && git commit -m "refactor(#10): Path C — decommission brownfield UI (Tailwind + shadcn + spike)"`

- [ ] **T7.4** — Create the new `apps/web/src/components/auth-form.tsx` (Pekulo-primitive port):

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import { Loader2 } from "lucide-react";
  import { Text, View } from "tamagui";
  import { Section, useToast } from "@pekulo/ui";
  import { createClient } from "@/lib/supabase/client";

  export function AuthForm({ mode }: { mode: "login" | "signup" }) {
    const router = useRouter();
    const toast = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setLoading(true);
      try {
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) {
            toast.danger("Inscription refusée", error.message);
          } else {
            toast.success("Compte créé", "Vérifie tes emails pour confirmer.");
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            toast.danger("Connexion refusée", error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
          } else {
            router.push("/dashboard");
            router.refresh();
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    }

    return (
      <View minHeight="100vh" alignItems="center" justifyContent="center" padding={16}>
        <View width="100%" maxWidth={420}>
          <Section ariaLabel={mode === "login" ? "Connexion" : "Inscription"}>
            <View alignItems="center" gap={4} marginBottom={16}>
              <Text color="$color" fontSize={20} fontWeight="600">Pekulo</Text>
              <Text color="$colorSecondary" fontSize={13}>
                {mode === "login" ? "Connecte-toi à ton dashboard" : "Crée ton compte"}
              </Text>
            </View>
            <form onSubmit={handleSubmit}>
              <View flexDirection="column" gap={12}>
                <View flexDirection="column" gap={6}>
                  <Text color="$color" fontSize={13} fontWeight="500" tag="label" htmlFor="email">Email</Text>
                  <View
                    tag="input"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jean@exemple.fr"
                    required
                    backgroundColor="$backgroundMuted"
                    borderRadius={8}
                    paddingHorizontal={12}
                    paddingVertical={10}
                    color="$color"
                    fontSize={14}
                    focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 }}
                  />
                </View>
                <View flexDirection="column" gap={6}>
                  <Text color="$color" fontSize={13} fontWeight="500" tag="label" htmlFor="password">Mot de passe</Text>
                  <View
                    tag="input"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    backgroundColor="$backgroundMuted"
                    borderRadius={8}
                    paddingHorizontal={12}
                    paddingVertical={10}
                    color="$color"
                    fontSize={14}
                    focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2 }}
                  />
                </View>
                <View
                  tag="button"
                  type="submit"
                  role="button"
                  disabled={loading}
                  backgroundColor="$color"
                  borderRadius={9999}
                  paddingHorizontal={16}
                  paddingVertical={10}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="center"
                  gap={8}
                  cursor="pointer"
                  pressStyle={{ scale: 0.98 }}
                  focusVisibleStyle={{ outlineColor: "$borderFocus", outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 }}
                  marginTop={4}
                >
                  {loading && <Loader2 size={16} color="var(--colorOnAccent)" />}
                  <Text color="$colorOnAccent" fontSize={14} fontWeight="600">
                    {mode === "login" ? "Se connecter" : "Créer un compte"}
                  </Text>
                </View>
              </View>
            </form>
            <View alignItems="center" marginTop={16}>
              <Text color="$colorTertiary" fontSize={13}>
                {mode === "login" ? (
                  <>Pas de compte ? <Link href="/auth/signup" style={{ color: "var(--color)" }}>S'inscrire</Link></>
                ) : (
                  <>Déjà un compte ? <Link href="/auth/login" style={{ color: "var(--color)" }}>Se connecter</Link></>
                )}
              </Text>
            </View>
          </Section>
        </View>
      </View>
    );
  }
  ```

  The native `<input>` is rendered via Tamagui's `tag="input"` shorthand on `<View>` — Tamagui passes through HTML props. This avoids a new `<Input>` primitive in 0-10 ; a future story can extract it if reused enough.

  Run: `bun --filter=web run typecheck`
  Expected: zero errors related to the deleted shadcn imports ; some errors may persist for the other dashboard files until T7.5–T7.8 land. Do NOT commit yet.

- [ ] **T7.5** — Replace `apps/web/src/app/dashboard/layout.tsx`:

  ```tsx
  // apps/web/src/app/dashboard/layout.tsx
  import { redirect } from "next/navigation";
  import { Text, View } from "tamagui";
  import { createClient } from "@/lib/supabase/server";

  export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    return (
      <View minHeight="100vh" backgroundColor="$background">
        <View
          tag="header"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal={16}
          paddingVertical={12}
        >
          <Text color="$color" fontSize={16} fontWeight="600">Pekulo</Text>
          <Text color="$colorTertiary" fontSize={12}>{user.email}</Text>
        </View>
        <View tag="main" flex={1}>
          {children}
        </View>
      </View>
    );
  }
  ```

  Notes: the brownfield `<Nav>` legacy navigation is gone ; the full `PekuloNavRail` integration lands in story 1-4 (`compass-ui-cap`). For 0-10, the dashboard layout shows a minimal header + email only.

- [ ] **T7.6** — Create `apps/web/src/app/dashboard/page.tsx` (placeholder Pekulo-themed scaffold):

  ```tsx
  // apps/web/src/app/dashboard/page.tsx
  import { View } from "tamagui";
  import { Compass } from "lucide-react";
  import { PekuloEmptyState, Section } from "@pekulo/ui";

  export default function DashboardPage() {
    return (
      <View padding={16} alignItems="center">
        <View width="100%" maxWidth={720}>
          <Section ariaLabel="Tableau de bord en construction">
            <PekuloEmptyState
              icon={Compass}
              title="Tableau de bord en construction"
              message="Définis ton cap dans la story 1-1 ; le dashboard se branche dans 7-1. La couche données reste prête côté serveur."
            />
          </Section>
        </View>
      </View>
    );
  }
  ```

- [ ] **T7.7** — Create `apps/web/src/app/dashboard/loading.tsx` (Pekulo skeleton):

  ```tsx
  // apps/web/src/app/dashboard/loading.tsx
  import { View } from "tamagui";
  import { PekuloSkeleton, Section } from "@pekulo/ui";

  export default function DashboardLoading() {
    return (
      <View padding={16} alignItems="center">
        <View width="100%" maxWidth={720}>
          <Section ariaLabel="Chargement">
            <PekuloSkeleton lines={3} height={20} />
            <View height={16} />
            <PekuloSkeleton block height={140} />
          </Section>
        </View>
      </View>
    );
  }
  ```

  And update `apps/web/src/proxy.ts` — remove the `/tamagui-spike` allowlist line (the route no longer exists). Read the file first ; locate the line that allowlists `/tamagui-spike` (added by spike commit `07e01fe`) ; delete it. The diff should be the smallest possible — only the line that mentions `/tamagui-spike`.

  Run: `bun --filter=web run typecheck`
  Expected: exit 0 (the previously failing imports are now all resolved).
  Commit: `git add apps/web && git commit -m "feat(#10): apps/web Path C migration — Pekulo provider, scaffold dashboard, ported auth form"`

- [ ] **T7.8** — Verify `apps/web/next.config.ts` is unchanged from the spike's slim form. The current state should match Step-0 quote (slim `transpilePackages: ["@tamagui/next-theme", "react-native-web"]`). No edits required ; if for any reason `transpilePackages` was widened by another change, narrow it back.

  Run: `bun --filter=web run typecheck && bun --filter=web run build` (the second command runs Next's full build). The build needs the env loaded ; from repo root use `dotenv -c -e .env -e .env.local -- bun --filter=web run build`.
  Expected: exit 0 ; build report shows static pages: `/`, `/auth/login`, `/auth/signup`, `/dashboard` (the dashboard prerenders a Pekulo scaffold). Spike route absent.
  Commit (only if any minor adjustments needed) — otherwise no-op.

---

### T8 — Verification matrix [AC: AC-1, AC-2, AC-3, AC-4]

- [ ] **T8.1** — Create the AC-1 audit script `scripts/check-no-tailwind.sh`:

  ```bash
  #!/usr/bin/env bash
  # scripts/check-no-tailwind.sh
  # AC-1 audit — verify apps/web is @pekulo/ui-only (no Tailwind / shadcn /
  # @base-ui leftovers).
  #
  # Exit codes:
  #   0 = clean (apps/web is @pekulo/ui-only)
  #   1 = leftover detected — story 0-10 AC-1 violated

  set -euo pipefail

  fail=0

  # 1. apps/web/package.json must not declare any forbidden dep.
  forbidden_deps=(
    "@base-ui/react"
    "shadcn"
    "tailwindcss"
    "@tailwindcss/postcss"
    "class-variance-authority"
    "clsx"
    "tailwind-merge"
    "tailwindcss-animate"
    "tw-animate-css"
  )
  for dep in "${forbidden_deps[@]}"; do
    if grep -q "\"$dep\"" apps/web/package.json; then
      echo "FAIL: $dep present in apps/web/package.json"
      fail=1
    fi
  done

  # 2. Forbidden files must be absent.
  forbidden_files=(
    "apps/web/src/app/globals.css"
    "apps/web/postcss.config.mjs"
    "apps/web/components.json"
    "apps/web/src/components/auth-form.tsx" # superseded — but the new version is OK ; this check is permissive on its existence
    "apps/web/src/components/theme-provider.tsx"
    "apps/web/src/components/theme-toggle.tsx"
    "apps/web/src/components/nav.tsx"
    "apps/web/src/components/kpi-card.tsx"
    "apps/web/src/components/phases.tsx"
    "apps/web/src/components/detail-cards.tsx"
    "apps/web/src/components/annual-table.tsx"
    "apps/web/tamagui.config.ts"
    "apps/web/tamagui.build.ts"
    "apps/web/public/tamagui.generated.css"
  )
  # Note: auth-form.tsx is recreated in T7.4 with Pekulo primitives ; we
  # therefore do NOT check it as forbidden — only as forbidden-shape (no
  # className= usage in its body, see check 4).
  forbidden_files_strict=(
    "apps/web/src/app/globals.css"
    "apps/web/postcss.config.mjs"
    "apps/web/components.json"
    "apps/web/src/components/theme-provider.tsx"
    "apps/web/src/components/theme-toggle.tsx"
    "apps/web/src/components/nav.tsx"
    "apps/web/src/components/kpi-card.tsx"
    "apps/web/src/components/phases.tsx"
    "apps/web/src/components/detail-cards.tsx"
    "apps/web/src/components/annual-table.tsx"
    "apps/web/tamagui.config.ts"
    "apps/web/tamagui.build.ts"
    "apps/web/public/tamagui.generated.css"
  )
  for f in "${forbidden_files_strict[@]}"; do
    if [ -e "$f" ]; then
      echo "FAIL: $f still exists"
      fail=1
    fi
  done

  # 3. Forbidden directories must be absent.
  forbidden_dirs=(
    "apps/web/src/components/ui"
    "apps/web/src/components/charts"
    "apps/web/src/app/(spike)"
    "apps/web/src/app/dashboard/mensuel"
    "apps/web/src/app/dashboard/parametres"
    "apps/web/src/app/dashboard/portefeuille"
    "apps/web/src/app/dashboard/transactions"
  )
  for d in "${forbidden_dirs[@]}"; do
    if [ -d "$d" ]; then
      echo "FAIL: $d still exists"
      fail=1
    fi
  done

  # 4. No `className=` anywhere in apps/web/src.
  if grep -rE "className=" apps/web/src 2>/dev/null; then
    echo "FAIL: className= usage found in apps/web/src"
    fail=1
  fi

  if [ "$fail" -eq 0 ]; then
    echo "apps/web is @pekulo/ui-only ✓"
    exit 0
  fi
  exit 1
  ```

  Make it executable: `chmod +x scripts/check-no-tailwind.sh`.
  Run: `bash scripts/check-no-tailwind.sh`
  Expected: `apps/web is @pekulo/ui-only ✓`, exit 0.
  Commit: `git add scripts/check-no-tailwind.sh && git commit -m "chore(#10): AC-1 audit script (no-tailwind)"`

- [ ] **T8.2** — Run the full `@pekulo/ui` test suite:

  Run: `bun --filter='@pekulo/ui' run test`
  Expected: aggregate pass — `Test Files  ≥30 passed`, `Tests  ≥60 passed`, `Snapshots  ≥40 passed`, exit 0.
  Run: `bun --filter='@pekulo/ui' run test:visual`
  Expected: every snapshot test reports `Snapshots  N passed`, exit 0.
  Run: `bun --filter='@pekulo/ui' run test:axe`
  Expected: every a11y test reports `0 violations` (impact serious/critical), exit 0.
  No commit at this step — verification only.

- [ ] **T8.3** — Root-level checks:

  Run: `bun run typecheck` (root, runs across all workspaces via Turbo)
  Expected: exit 0.
  Run: `bun run lint` (root, oxlint)
  Expected: exit 0 ; warnings allowed but no errors.
  No commit.

- [ ] **T8.4** — Production build:

  Run: `bun run build` (root — uses the dotenv prefix from root `package.json`)
  Expected: exit 0 ; Next.js build output reports `apps/web` static pages prerendering at least `/`, `/auth/login`, `/auth/signup`, `/dashboard`. No `/tamagui-spike` route in the output table.
  No commit.

- [ ] **T8.5** — Manual smoke + 404 verification:

  Run: `bun --filter=web run start` (must follow a successful T8.4 build) — leave running in a separate shell.
  Then in another shell:
  Run: `curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/tamagui-spike`
  Expected: `404`.
  Run: `curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/login`
  Expected: `200`.
  Run: `curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/`
  Expected: `307` (redirect to `/auth/login` since no session).

  Then visually inspect in browser at `http://localhost:3000/auth/login` :
  - Pekulo logo + form rendered in `pekulo-dark`
  - Card surface `#0a0a0a` against pure black `#000` page bg
  - Text primary `#ededed`
  - No emerald anywhere except, eventually, in toast intent dots
  - Tab order email → password → submit ; focus rings white, 2px outline
  - Try a wrong password ; toast appears bottom-right with danger intent

  Stop the dev server (Ctrl-C). No commit (verification only).

- [ ] **T8.6** — Update `docs/state.yaml` `sprint.stories."0-10-pekulo-ui-migration".status` from `pending` to `in-progress` is owned by `aped-dev` ; this story's writeup keeps `pending → ready-for-dev` for `aped-story` step 5. The status flip to `ready-for-dev` is performed at the end of step 5 — see step-05.md.

  Run: `git status` final sweep — all commits made, working tree clean except possibly `docs/state.yaml` (handled by step 5 script).
  Commit: none in this task — the state flip is the final write of step 5.

---

> **Definition of Done (story-level).** All eight phases T0–T8 complete ; all four ACs verified ; `git status` clean ; `bun run build` exits 0 ; the AC-1 script returns `apps/web is @pekulo/ui-only ✓` ; all `Pekulo*` components export from `packages/ui/src/index.ts` ; every component has a passing snapshot + axe test. The dev hands the branch over for `aped-review`.

---

## File List

**Created (`@pekulo/ui` package — `packages/ui/`):**

- `package.json` (rewritten — Tamagui RC pins + vitest stack + scripts)
- `tsconfig.json` (DOM lib + jsx-react override — T0)
- `tamagui.config.ts` + `tamagui.build.ts` (CLI front-doors)
- `vitest.config.ts`
- `test/setup.tsx`
- `public/tamagui.generated.css` (committed atomic CSS)
- `src/index.ts` (public barrel)
- `src/tokens/{colors,spacing,radius,typography,index}.ts` — TR-strict palette + scales
- `src/themes/{pekulo-dark,pekulo-light,index}.ts`
- `src/config/tamagui.ts` — `createTamagui()` invocation + `@tamagui/web` augmentation
- `src/provider/index.tsx` — `<PekuloRootProvider>` with `NextThemeProvider` + `TamaguiProvider` + `ToastProvider` + `PekuloToastViewport`
- `src/animations/{use-count-up,use-stagger,index}.ts(.test.ts)` — rAF hooks + tests
- `src/primitives/{Section,HeaderAction,index}.{tsx,snapshot.test.tsx,a11y.test.tsx}` — 2 framework primitives
- `src/primitives/Pekulo{Avatar,Checkbox,Dialog,Popover,Progress,RadioGroup,Select,Separator,Sheet,Slider,Switch,Tooltip}.{tsx,snapshot.test.tsx,a11y.test.tsx}` — 12 compound primitives
- `src/components/Pekulo{AccountRow,ActivityRow,ClassRow,CompositionRow,ContextualAddButton,Donut,EmptyState,ErrorBoundary,Hero,HoldingRow,HypothesisVerdict,KpiTile,MilestoneRow,MonthlyRow,NavRail,ProjectionChart,PropertyCard,SegmentedControl,SettingRow,Skeleton,Stat,SuggestionRow,ToggleRow,TopTabToggle,TrajectoryChart,UserDot}.{tsx,snapshot.test.tsx,a11y.test.tsx}` + `toast.{tsx,snapshot.test.tsx,a11y.test.tsx}` + `index.ts` — 27 domain components
- `src/{primitives,components}/__snapshots__/*.snap` — committed visual snapshots

**Modified (`apps/web/`):**

- `package.json` (stripped Tailwind/shadcn/@base-ui/Tamagui deps; added `@pekulo/ui: workspace:*`)
- `src/app/layout.tsx` (mount `<Providers>`, import `@pekulo/ui/{reset,generated}.css`)
- `src/components/providers.tsx` (re-export `<PekuloRootProvider>` wrapped with `<QueryClientProvider>`)
- `src/components/auth-form.tsx` (rebuilt on Pekulo primitives + locally-styled input/button)
- `src/app/dashboard/layout.tsx` (plain HTML chrome at RSC boundary)
- `src/app/dashboard/page.tsx` (Pekulo `<Section>` + `<PekuloEmptyState>` scaffold)
- `src/app/dashboard/loading.tsx` (Pekulo `<Section>` + `<PekuloSkeleton>` lines + block)
- `src/proxy.ts` (`/tamagui-spike` allowlist removed)

**Deleted (apps/web brownfield UI):**

- `src/app/globals.css`, `postcss.config.mjs`, `components.json`
- `src/components/{ui,charts}/` (subtrees)
- `src/components/{auth-form,theme-provider,theme-toggle,nav,kpi-card,phases,detail-cards,annual-table}.tsx` (re-created or removed)
- `src/app/(spike)/` (entire subtree — tamagui-spike route)
- `src/app/dashboard/{mensuel,parametres,portefeuille,transactions}/` (subtrees)
- `tamagui.config.ts`, `tamagui.build.ts`
- `public/tamagui.generated.css`

**Created (repo-root):**

- `scripts/check-no-tailwind.sh` (AC-1 audit)
- `package.json` (root) — added `test:ui`, `test:ui:visual`, `test:ui:axe`, `generate:tamagui-css` proxy scripts

---

## Dev Agent Record

- **Model:** Claude Opus 4.7 (1M context)
- **Started:** 2026-05-06T00:00:00Z
- **Completed:** 2026-05-06T23:30:00Z

### Debug Log

- **3 deviations from story T-spec** caught at typecheck/test time, all rooted in Tamagui v2-rc.41 API drift vs the story's v1-flavoured prop syntax. All resolved per official v2 docs (context7 cross-checked). Lessons L13-L18 captured in `docs/lessons.md`.
- **No-pivot discipline upheld** — when v2 API conflicts surfaced, fixed using v2-recommended patterns rather than downgrading or skipping. Per Alex: "on ne rétrograd rien, on fix avec ce qui est recommandé pour la v2".
- **Token-discipline pass** — initial transcription kept several hardcoded values from the story spec (paddings, radii, fontSizes). Caught by Alex's review ("pourquoi certains on des valeurs en dure au lieu des tokens?"); swept all primitives + components to use `$tokens` (commit `abd41c6`). Outliers (6/10/18 spacings, 20-radius, 200/520 layout constraints) documented inline.
- **Test snapshots regenerated** twice: once after the token sweep (atomic CSS class hashes shift when token-references replace literal values), and once after `pekuloFontSizes.xs = 12` was added (Tamagui CLI re-hashes the entire token map on modification).

### Completion Notes

**Scope delivered (T0 → T8, 75+ commits):**

- `@pekulo/ui` package built on Tamagui Core 2.0.0-rc.41 with TR-strict palette (`pekulo-dark` registered, `pekulo-light` defined but not registered — pending v2-rc.41 CLI selector-emission fix).
- **2 framework primitives** (`Section`, `HeaderAction`) — non-domain, framework-agnostic.
- **12 compound primitives** wrapping `@tamagui/{dialog,sheet,popover,tooltip,select,radio-group,switch,slider,progress,separator,avatar,checkbox}` with shadcn-style compound API (`Object.assign` pattern).
- **27 `Pekulo*` domain components** — 12 cap-dashboard (T5) + 15 feature-surface (T6) including the Toast suite (`PekuloToast` + `useToast` hook + `<PekuloToastViewport>` + `ToastProvider`, mounted by `PekuloRootProvider`).
- **Test harness**: vitest + happy-dom + RTL + vitest-axe + `renderWithTamagui()` helper using a TamaguiProvider-only test wrapper (no NextThemeProvider — avoids `next/script` peer pulled by `@tamagui/next-theme`).
- **Test suite total: 84 files / 125 tests passing / 68 snapshots / 53 a11y assertions (zéro `serious` ou `critical`).**
- `apps/web` Path C migration:
  - All Tailwind / shadcn / `@base-ui/react` / `class-variance-authority` / `clsx` / `tailwind-merge` / `tailwindcss-animate` / `tw-animate-css` / `tailwindcss` / `@tailwindcss/postcss` deps removed from `apps/web/package.json`.
  - `react-native-web` + Tamagui dep cluster removed from `apps/web` (now hoisted from `@pekulo/ui`).
  - `(spike)/`, `dashboard/{mensuel,parametres,portefeuille,transactions}/`, `components/{ui,charts}/`, `globals.css`, `postcss.config.mjs`, `components.json`, `tamagui.config.ts`, `tamagui.build.ts`, `public/tamagui.generated.css`, plus 8 brownfield `.tsx` files in `components/` deleted.
  - `auth-form.tsx` rebuilt on Pekulo primitives + locally-styled `<input>`/`<button>` (text-style props via inline `style` referencing `var(--color)`, `var(--borderFocus)`).
  - `dashboard/{layout,page,loading}.tsx` use plain HTML/CSS chrome at the RSC boundary (Tamagui in a pure Server Component crashes Next 16's "Collecting page data" with `createContext is not a function`); inner Pekulo client primitives mounted on plain `<div>` wrappers.
  - `proxy.ts` `/tamagui-spike` allowlist line removed.

**AC verification (T8):**

- **AC-1 ✓** — `bash scripts/check-no-tailwind.sh` exit 0, output `apps/web is @pekulo/ui-only ✓`.
- **AC-2 ✓** — `bun --filter='@pekulo/ui' run test:visual` reports 41 test files / 68 snapshots passing, exit 0.
- **AC-3 ✓** — `bun --filter='@pekulo/ui' run test:axe` reports 41 test files / 53 a11y assertions passing, **zéro `impact: serious`** ou **`impact: critical`** violations, exit 0.
- **AC-4 ✓** — `bun run typecheck` exit 0 (8 workspaces); `bun run lint` exit 0 (0 errors, 6 warnings hors-scope dans apps/api+apps/web pré-existantes); `bun run build` exit 0; build's route table prerenders `/`, `/auth/login`, `/auth/signup`, `/dashboard` (the dashboard is dynamic ƒ because of the layout's `await supabase.auth.getUser()` — auth-gated route, conforme au security model). `/tamagui-spike` absent du route table. `curl /tamagui-spike` retourne 307 (proxy auth-gate redirect) en mode unauth ; en authentifié retournerait 404 (route source inexistante).

**Deviations from story spec (all documented in lessons.md L13-L18):**

1. Tamagui v1 → v2 prop renames applied: `tag` → `render`, `animation` → `transition`.
2. `TamaguiCustomConfig` augmentation target moved from `@tamagui/core` (v1) to `@tamagui/web` (v2-rc.41).
3. v1's `$gtMd` replaced by v2's `$lg` (mobile-first Tailwind-aligned default media); `$max-md` for max-width queries.
4. `vitest run` scripts in `packages/ui/package.json` carry `--passWithNoTests` (vitest 2.1.9 exits 1 on no-files, was 0 in older versions).
5. `test/setup.ts` → `test/setup.tsx`; CommonJS `require()` lazy-import replaced by static ESM import; test wrapper uses `TamaguiProvider` directly (no `<NextThemeProvider>`) because `@tamagui/next-theme` pulls `next/script` which only resolves under `apps/web`.
6. `Select.Content` style props moved to `.Viewport` (Content is FocusScope wrapper in v2).
7. `@tamagui/separator` does not export `SeparatorProps` in v2-rc.41 — use `ComponentProps<typeof Separator>`.
8. Popover/Tooltip Triggers force `render="button" unstyled` so axe-core accepts auto-injected `aria-expanded` / `aria-haspopup` / `aria-controls`.
9. RSC routes (`dashboard/{layout,page,loading}.tsx`) use plain HTML/CSS, not Tamagui, at the server boundary.
10. Animation hooks (`use-count-up.ts`, `use-stagger.ts`) gained `"use client"` directives so the @pekulo/ui barrel doesn't pull React-hooks code into Next's RSC server graph.
11. `auth-form.tsx` `<input>` text-style (color, fontSize, outline) applied via inline `style={...}` because Tamagui v2's StackStyle disallows them on `styled.input`.
12. **Token-discipline sweep** — all `borderRadius={N}` / `padding={N}` / `gap={N}` / `fontSize={N}` literals replaced with `$tokens` (`$xl`, `$5`, `$caption`, etc.) across primitives + components. `pekuloFontSizes.xs = 12` added to fill the recurring "12px label" gap.

**No-pivot discipline maintained** — every divergence above is a v2-rc.41-canonical fix, not a feature-skip or scope-reduction. The 4 ACs are satisfied as specified.

## Review Record

**Date:** 2026-05-07
**Reviewer:** APED Lead Reviewer (Eva — ac-validator + 4 Stage-2 specialists: Marcus / Rex / Lucas / Aria)
**Verdict:** done

### Specialists dispatched

- Eva (ac-validator) — initial verdict CHANGES_REQUESTED → fixed inline → re-gated APPROVED
- Marcus (code-quality + 5-anti-pattern audit) — APPROVED with 1 HIGH, 3 LOW (all resolved)
- Rex (git-auditor) — APPROVED (80 commits, all `(#10)`-scoped, no merge / amend / `--no-verify`)
- Lucas (frontend-specialist) — CHANGES_REQUESTED → 2 HIGH + 3 MEDIUM + 2 LOW (all resolved)
- Aria (visual-reviewer; React Grab MCP unavailable — deep visual deferred) — CHANGES_REQUESTED → 2 HIGH + 3 MEDIUM + 2 LOW (all resolved)

### Findings (consolidated)

#### Resolved — Eva gate (fixed inline before Stage 2)

- **[CRITICAL] AC-2 — snapshot format violated spec** (file-based `__snapshots__/*.snap` vs spec-mandated inline strings). Fix: 68 calls converted `toMatchSnapshot()` → `toMatchInlineSnapshot()`, regenerated via `vitest -u`, `__snapshots__/` directories deleted.
- **[MAJOR] AC-1(f) — `scripts/check-no-tailwind.sh` did not enforce only-2-files-importing-styling rule.** Fix: added check #5 (allowed importers = `apps/web/src/app/layout.tsx` + `apps/web/src/components/providers.tsx`).
- **[MINOR] L14 — `--passWithNoTests` redundant on `test` script.** Fix: removed (kept on `test:visual` / `test:axe` as defensive on `--testNamePattern` empty matches).

#### Resolved — Stage 2 (HIGH)

- **F1 — TR-strict fidelity: emerald `$accent` on control chrome** (Lucas + Aria, cross-confirmed) [`PekuloToggleRow.tsx:29`, `PekuloRadioGroup.tsx:28`, `PekuloSlider.tsx:15`, `PekuloSuggestionRow.tsx:66`]. Fix: `$accent` → `$color` (white) on the four chrome surfaces; Sparkles icon → `var(--colorSecondary)`. `$accent` is now strictly reserved for ± monetary deltas (Hero `aheadEur`, HypothesisVerdict `delta`).
- **F2 — dead `tailwind-merge` dep imported by `apps/web/src/lib/utils.ts`** despite Path C decommission (Lucas). Fix: file deleted (`git rm`); 0 callers.
- **F3 — `<PekuloErrorBoundary>` exported but never wired** in `apps/web` (Marcus, arch L578 / L1104). Fix: wrapped `<QueryClientProvider>` in `apps/web/src/components/providers.tsx` with stub `onError` console reporter (full GlitchTip pipe lands at epic 11 per architecture L242–L252).
- **[Architecture violation] Domain types inlined in `@pekulo/ui`** instead of `@pekulo/types` (user surfaced mid-review — arch L366). Fix: extracted `Account / AccountType / Holding / HoldingKind / Activity / Suggestion / LlmRoute / Milestone / MilestoneStatus / MonthlyRecord / Property / CompositionItem / TxDirection / StatTone` + literal arrays (`ACCOUNT_TYPES / HOLDING_KINDS / TX_DIRECTIONS / LLM_ROUTES / MILESTONE_STATUSES / STAT_TONES`) into `packages/types/src/index.ts`. `@pekulo/ui` consumes from `@pekulo/types` (added as workspace dep). Components keep `Pekulo*` prefix; types lose the prefix per arch L366 ("Domain TS types: PascalCase").

#### Resolved — Stage 2 (MEDIUM)

- **F4 — `PekuloSelect.Trigger` shipped Tamagui ListItem default 1px hairline border** (Aria; violates TR-strict "zero card borders"). Fix: `borderWidth={0}` added to Trigger.
- **F5 — UX-spec components missing from public barrel** (Lucas; `docs/ux/components.md` catalog). Fix: 11 components shipped with snapshot + a11y tests = 33 new files: `PekuloHeroCard`, `PekuloDonutCard`, `PekuloTrajectoryCard`, `PekuloMilestonesCard`, `PekuloCompositionCard`, `PekuloRecentActivityCard`, `PekuloHypothesisCard`, `PekuloAccountsSection`, `PekuloStaggerList`, `PekuloCountUpEUR`, `PekuloCountUpPct`.
- **F6 — `PekuloSuggestionRow` Confirm/Edit buttons rendered as `<View render="button">` without `type="button"` or `disabled`** (Lucas). Fix: refactored to `styled.button(...)` with proper HTML attributes (`type`, `disabled`, `onClick`); inline `focusVisibleStyle` to keep Tamagui token narrowing.
- **F7 — token discipline drift** (Lucas + Aria): `paddingVertical={10}` literals in `PekuloActivityRow` / `PekuloClassRow` / `PekuloCompositionRow`; `fontSize={44}` in `PekuloHero` (vs `$hero=42`). Fix: `paddingVertical="$3"` (12px) and `fontSize="$hero"`.
- **F8 — `pekuloColors` was a structural fork of the SSOT** (Aria; violates `feedback_ssot_ux_preview` "subset OK, fork no"). Fix: full re-port to align 1:1 with `docs/ux-preview/src/tokens/colors.ts`. New structure: `surface.{bg,card,elevated,muted,overlay}`, `perf.{gain,gainSoft,loss,lossSoft,neutral}`, `dataBlue`, `warning`. Theme files keep ergonomic aliases (`$accent` / `$success` → `perf.gain`, `$danger` → `perf.loss`, `$info` → `dataBlue`) and add new SSOT-aligned keys (`$perfGain`, `$perfGainSoft`, `$perfLoss`, `$perfLossSoft`, `$perfNeutral`, `$dataBlue`, `$backgroundOverlay`).
- **F9 — `#FBBF24` warning amber invented** in pekulo TS mirror with no SSOT origin (Aria). Fix: added `--warning` to `docs/ux-preview/src/index.css` (`:root` + `.light` + `@theme inline`) AND `docs/ux-preview/src/tokens/colors.ts`, then re-mirrored to `packages/ui/src/tokens/colors.ts`. Documented in file headers as a Pekulo extension (NOT a TR primitive — used only by `PekuloSuggestionRow` for LLM-confidence labels < 75 %).

#### Resolved — Stage 2 (LOW)

- **F10 — `auth-form.tsx` echoed raw Supabase `error.message`** for non-credential errors (Marcus; minor info-disclosure). Fix: collapsed unknown errors to generic `"Connexion impossible. Réessaie plus tard."`
- **F11 — `PekuloEmptyState` icon rendered without `aria-hidden`** (Marcus). Fix: extended `LucideIcon` type, passed `aria-hidden={true}` (icon decorative; title text conveys meaning).
- **F12 — `defaultTheme="pekulo-dark"` duplicated** on NextThemeProvider + TamaguiProvider (Lucas). Fix: kept duplication with explanatory comment (TamaguiProvider TS contract requires `defaultTheme` — both held in lock-step until light is registered).
- **F13 — `pekuloFontWeights.light = "300"` declared but Geist 300 not bundled** (Aria). Fix: removed dead token + updated header comment.
- **F14 — `useCountUp` rAF cleanup branch uncovered by tests** (Marcus backlog). Fix: added vitest spy test asserting `cancelAnimationFrame(lastFrameId)` on unmount.

#### Resolved — F15 (added during fix cycle on user request)

- **Coverage gate** — `@vitest/coverage-v8` installed in `@pekulo/ui` devDeps. `vitest.config.ts` thresholds: lines/functions/statements 70 %, branches 60 %. New script `bun --filter='@pekulo/ui' run test:coverage`. `coverage/` added to root `.gitignore`. Current coverage: **92.81 % lines / 93.1 % branches / 89.09 % functions / 92.81 % statements** (well above thresholds).

#### Dismissed

- **[LOW]** Rex — `git-audit.sh` parser limitation on bracket-glob expansion in story File List (script tooling, not story scope). Rationale: tracked as backlog improvement to `.aped/aped-review/scripts/git-audit.sh`; manual cross-check confirmed the File List globs hydrate to actual files on disk.

### Verification (fresh evidence — captured this session)

| Command | Result |
|---|---|
| `bun run typecheck` | **exit 0** (8 packages, FULL TURBO cache hit on 6) |
| `bun run lint` | **exit 0**, 9 warnings (hors-scope: pre-existing in `apps/api/src/platform/observability/otel-sdk.ts`, `apps/web/src/instrumentation.node.ts`, `apps/web/src/lib/actions/portfolio.ts`) |
| `bash scripts/check-no-tailwind.sh` | **exit 0** → `apps/web is @pekulo/ui-only ✓` (with new AC-1(f) check #5) |
| `bun --filter='@pekulo/ui' run test:visual` | **exit 0**, 52 files / 81 inline snapshots (vs 41 / 68 pre-fix; +11 components × ~1.2 variants) |
| `bun --filter='@pekulo/ui' run test:axe` | **exit 0**, 52 files / 64 tests, **zéro `impact: serious` ou `critical` violation** |
| `bun --filter='@pekulo/ui' run test:coverage` | **exit 0**, 92.81 % / 93.1 % / 89.09 % / 92.81 % (gate: 70/60/70/70) |

**Visual review:** deferred — React Grab MCP unavailable at 2026-05-07T00:00:00Z (Aria fell back to static code review + design-spec cross-reference; documented in Aria report).

### Ticket sync

- Ticket comment posted on issue #10
- PR #69 body / comments updated with Review Record reference
