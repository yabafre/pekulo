# Spike decision — 0-9 Tamagui pre-flight (W2)

**Date:** 2026-05-06
**Author:** fred
**Branch:** `feature/9-0-9-tamagui-spike`
**Tamagui version:** `tamagui@2.0.0-rc.41` + `@tamagui/core@2.0.0-rc.41` + `@tamagui/config@2.0.0-rc.41` + `@tamagui/next-theme@2.0.0-rc.41` (verified at T1.1 via `npm view tamagui dist-tags` → `latest: 2.0.0-rc.41`; no atomic bump required)
**Next.js version:** `next@16.2.4` (Turbopack default)
**React version:** `react@19.2.4`

## Decision

**Decision: pivot to ADR-0007 option A (Tailwind status quo + V1.5 rebuild).**

Per the story's pivot conditions, two independent triggers fired:

1. **AC-1 strict-fail.** The RSC sentinel grep returned `'use client'` in `proto-slice.tsx` (the Tamagui-consuming leaf), not just `provider.tsx`. Tamagui v2-rc.41 cannot render its `<View>`/`<Text>` primitives inside a Server Component under Next 16 Turbopack — the SSR pass throws `(0 , j.createContext) is not a function` because Tamagui's runtime pulls React's context API through a bundle path Turbopack rewrites incorrectly. Tamagui's own App-Router example in `https://tamagui.dev/docs/guides/next-js` puts `'use client'` on `app/page.tsx`, confirming the practical pattern is provider + every Tamagui-consuming component as client. The story's pivot rule does not distinguish strict-fail from practical-pattern; it triggers on any `'use client'` outside `provider.tsx`.

2. **AC-2 fail (2 / 16 pairs).** Two pekulo-light pairs miss the WCAG 2.2 AA body-text 4.5:1 threshold: `accent.500 (#059669)` on `surface.card (#FFFFFF)` at 3.77:1, and `semantic.warning (#D97706)` on `#FFFFFF` at 3.19:1. These are token-design issues independent of Tamagui (raw hex values flow through `createTamagui` unaltered) but the story's pivot rule mechanically triggers on any sub-threshold pair regardless of cause.

A third softer signal also surfaced: the documented Turbopack optimization path (`tamagui build --target web ./src -- next build` via `@tamagui/cli`) cannot resolve `@tamagui/web` through bun's nested `.bun` package layout — the build CLI bails with `Cannot find module '@tamagui/web'` even with the dependency installed. This isn't a story-defined pivot trigger, but it removes the build-time CSS extraction lever that ADR-0007 leaned on for V1 perf budgets.

A fourth signal surfaced during T4.2 manual review: **runtime theme application is fragile**. The first dev render came back fully light — white body, invisible card (surface.card `#FFFFFF` matched the white body), emerald delta line nearly illegible against white. Three layered problems contributed:

1. `NextThemeProvider` defaults its `themes` prop to `["light", "dark"]`. Our themes are `pekulo-light` / `pekulo-dark`, so next-theme never raised the matching `data-theme` attribute and Tamagui's runtime stayed in "no theme" state. Fix: pass `themes={["pekulo-light", "pekulo-dark"]}` explicitly.
2. `TamaguiProvider` was wired with `disableRootThemeClass` (per the official docs example), so even after the previous fix the wrapping `<View>` carried no `t_pekulo-dark` class and descendants resolved `$backgroundCard` against an empty token map. Fix: drop `disableRootThemeClass`.
3. With both fixes applied, the first SSR pass still raced next-theme's hydration on the browser side, so the very first paint flashed unstyled before next-theme caught up. Fix: wrap the proto-slice content in an explicit `<Theme name="pekulo-dark">` (the canonical Tamagui pattern for components that must paint correctly on the very first SSR pass without depending on client-side theme negotiation).

This isn't a formally-defined pivot trigger either, but it's the third independent rough edge on the Tamagui v2-rc.41 ↔ Next 16 ↔ React 19 surface — together they say the substrate is not yet stable enough to absorb. The fix shipped in commit `e0ecc0f`; the dev render now carries the correct hex values (`#07090E` / `#0E1117` / `#10B981` / `#F1F5F9`) per the curl-confirmed payload at T6 time.

The next action below routes to `aped-course` to revert ADR-0007 and unblock story 0-10 with a Tailwind-only ramp.

## Measurements

### AC-1 — RSC `'use client'` boundary

| File | `'use client'` present | Required by AC-1 |
| --- | --- | --- |
| `provider.tsx` | yes | yes |
| `layout.tsx` | no | no |
| `page.tsx` | no | no |
| `proto-slice.tsx` | **yes** | **no** ← fail |
| `tokens.ts` | no | no |
| `contrast.ts` | no | no |

Build outcome under root `dotenv -c -e .env -e .env.local -- turbo run build --filter=web`: exit 0 with `✓ Compiled successfully in 2.9s`, `○ /tamagui-spike` prerendered as static content, 9/9 static pages generated, 1 task successful.

Errors surfaced when `'use client'` was OMITTED from `proto-slice.tsx` (verified diagnostic):

```
Error: Failed to collect configuration for /tamagui-spike
  [cause]: TypeError: (0 , j.createContext) is not a function
      at module evaluation (.next/server/chunks/ssr/_0~itw_a._.js:1:7794)
      at instantiateModule (.next/server/chunks/ssr/[turbopack]_runtime.js:853:9)
      ...
      at J.children.children.children.page (.next/server/chunks/ssr/0thq_next_dist_esm_build_templates_app-page_0kf2n7b.js:1:659)
```

The error happens at `Collecting page data` (Turbopack's SSR pass, after compile success) — Tamagui's runtime context is unsuitable for RSC bundling on this RC.

### AC-2 — Contrast (WCAG 2.2 AA)

Source: `docs/spikes/0-9-contrast-report.json` (16 rows = 8 pairs × 2 themes; `body` threshold = 4.5, `large` threshold = 3.0).

| Theme | Pairs tested | Pairs passing | Worst pair | Worst ratio | Worst pass |
| --- | --- | --- | --- | --- | --- |
| `pekulo-dark` | 8 | 8 | `text.tertiary on surface.card` (large) | 3.45:1 | yes (≥ 3.0) |
| `pekulo-light` | 8 | 6 | `semantic.warning on surface.card` (body) | 3.19:1 | **no (< 4.5)** |

Failing pairs (pekulo-light only):

| Pair | foreground | background | size | ratio | threshold | gap |
| --- | --- | --- | --- | --- | --- | --- |
| `accent.500 on surface.card` | `#059669` | `#FFFFFF` | body | 3.77:1 | 4.5 | 0.73 |
| `semantic.warning on surface.card` | `#D97706` | `#FFFFFF` | body | 3.19:1 | 4.5 | 1.31 |

Both failures are **token-design issues**, not Tamagui-introduced contrast loss. The fix is to darken the pekulo-light accent/warning tokens (e.g. `accent.500` → `#047857`, `semantic.warning` → `#B45309`) or to apply emerald/amber on `surface.muted (#F1F5F9)` instead of `surface.card (#FFFFFF)`. Out of scope for this spike — captured for the post-pivot 0-10 (or whichever story re-evaluates the design system).

### AC-3 — Palette discipline

| Audit | Expected | Observed |
| --- | --- | --- |
| `borderColor`/`borderWidth`/`outline`/`boxShadow`/`shadowColor` count in `proto-slice.tsx` (code only) | 0 | 0 ✓ |
| `$accent` token usages in `proto-slice.tsx` | 1 (delta line only) | 1 ✓ |
| Visual smoke (dark mode) | zero card borders, emerald only on delta | **pass** (manual capture by reviewer at `http://localhost:3000/tamagui-spike` post-fix `e0ecc0f`) |

The two grep gates pass cleanly (the raw grep matches the documentation comments in the file header that *mention* the forbidden tokens; refining the grep with `grep -v -E "^\s*[0-9]+:\s*//"` returns the canonical zero-match outcome). The proxy middleware was patched (commit `07e01fe`) to allowlist `/tamagui-spike` so the route is reviewable without auth; after the runtime theme fix in `e0ecc0f` the reviewer confirmed the canonical dark surface manually at `http://localhost:3000/tamagui-spike` — body `#07090E`, card `#0E1117` with no border, text primary `#F1F5F9` on the headline + `147 320 €`, labels (`PATRIMOINE TOTAL`, `CAP`, `PROCHAINE ÉTAPE`) at `#94A3B8`, milestone label at `#CBD5E1`, **delta `+12 340 €` emerald `#10B981` and the only emerald element on the surface**. Strict-palette discipline holds.

### Build-time delta (informational)

Not measured. The pre-spike build was already broken for the dev's local env (the pre-existing `/auth/login` Supabase-prerender failure reproduces on `HEAD~6` per the `git stash` diagnostic in T1's Debug Log), so a clean wall-time / bundle-size delta would have required env-stub work outside the spike's scope. The Turbopack compile under root `dotenv` env reports `✓ Compiled successfully in 2.9s` post-spike; the corresponding pre-spike compile was `✓ Compiled successfully in 2.6s` (also Turbopack, no Tamagui in tree). The +0.3s delta is within noise for a 9-page app and is dwarfed by the pre-existing Supabase prerender error.

## Pivot conditions (ADR-0007 reference)

Per ADR-0007 "Consequences" → "Pivot conditions", any of the following triggers a fall-back to option A. This spike triggered two:

- Tamagui compiler emits `'use client'` on every leaf, OR RSC context serialisation breaks → **triggered** (see AC-1 table; the practical Tamagui pattern requires `'use client'` on every primitive consumer, and the strict RSC path throws `createContext` errors under Turbopack).
- Any contrast pair below WCAG 2.2 AA → **triggered** (see AC-2 table; 2 / 16 pairs fail in pekulo-light, though the cause is token design rather than Tamagui's theming system).
- Migration runtime estimate balloons past 4 weeks → out of scope for this spike (covered at story 0-10 kick-off).

A fourth pragmatic concern surfaced outside the formal pivot list: **`@tamagui/cli` cannot bundle the config under bun monorepo layout** (see T3 commit body and the Debug Log entry "T1.2 Turbopack pivot"). This removes the `outputCSS` static-extraction lever Tamagui ships for production perf, leaving Pekulo on Tamagui's runtime style injection only — acceptable for a spike, not for V1's perf budgets.

## Next action

Open an `aped-course` correction proposing to revert ADR-0007 → status `superseded`, write a new ADR documenting the pivot rationale + the V1.5 rebuild plan, and unblock story 0-10 by re-scoping it to a Tailwind-only ramp. Tamagui deps from T1 (`tamagui`, `@tamagui/core`, `@tamagui/config`, `@tamagui/next-theme`, `react-native-web` in `dependencies`; `@tamagui/cli`, `@types/react-native` in `devDependencies`) are removed in the same correction PR, alongside `apps/web/tamagui.config.ts`, the spike subtree at `apps/web/src/app/(spike)/tamagui-spike/`, the `next.config.ts` `transpilePackages` + `turbopack.resolveAlias` block (Pekulo doesn't need RN-Web aliasing without Tamagui), the `apps/web/.tamagui/` `.gitignore` line, the proxy middleware allowlist for `/tamagui-spike`, and the `test:contrast` npm script. The two AC-2 failures (pekulo-light accent/warning vs surface.card) are independent of the pivot and should be folded into the post-pivot design-token revisit (likely 0-10 re-scoped or a sister sub-story under the same epic).

## References

- W2 watch item — `docs/architecture.md` L1143
- ADR-0007 — `docs/adr/0007-design-system-tamagui-migration-now.md`
- Tamagui v2 RC Next.js App Router guide (verified 2026-05-06) — `https://tamagui.dev/docs/guides/next-js`. Confirms the practical pattern is provider + 'use client' on every consumer; the optional `@tamagui/next-plugin` is webpack-only and incompatible with Pekulo's Turbopack-only stance under Next 16 (verified live at T1.2 via `node_modules/@tamagui/next-plugin/src/withTamagui.ts:8` — `import webpack from 'webpack'`).
- Tamagui v1 → v2 migration cheat-sheet — `<Stack>`→`<View>`, `@tamagui/config/v3`→`@tamagui/config/v5`, `createTheme()` → plain object literals (helper removed in v2; verified at T2.2 via `grep -r "createTheme" apps/web/node_modules/@tamagui` → zero hits).
- L7 (`bun --cwd <relative> run <script>` silent fail) — `docs/lessons.md` L53. Story body's `bun --cwd apps/web run …` invocations were rewritten to `bun --filter=web run …` (workspace name `web`, verified `apps/web/package.json#name`); the explicit `run` keyword is mandatory because `bun --filter=web build` invokes the `bun build` builtin (bundler) instead of the package.json script.
- Pekulo style fidelity rules — feedback memory `feedback_trade_republic_fidelity.md`.
- Spike commits on `feature/9-0-9-tamagui-spike` (delta vs `main`):
  - `e7e4e03` chore(#9): install tamagui core 2.0.0-rc.41 + wire turbopack config
  - `e1762af` feat(#9): port pekulo tokens + tamagui config (pekulo-dark/light themes)
  - `0ede627` feat(#9): RSC spike route + Tamagui consumers as 'use client' (W2 finding)
  - `db89517` test(#9): WCAG 2.2 AA contrast measurement for pekulo-dark/light (W2 finding)
  - `07e01fe` chore(#9): expose /tamagui-spike publicly through proxy middleware (W2 review)
  - `e0ecc0f` fix(#9): apply pekulo-dark theme on the spike route at runtime (W2 finding)
