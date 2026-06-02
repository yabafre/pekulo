# Quick Spec: Fix broken mobile layout on /dashboard/transactions

**Date:** 2026-06-02
**Author:** Alex
**Type:** fix
**Status:** done

## What

Two mobile layout breakages on `/dashboard/transactions` (both in `@pekulo/ui` primitives):

1. **Bottom tab bar** (`PekuloMobileBottomNav`) — the 5-column grid has no `min-width:0` on its buttons, so each `1fr` track inherits the `min-content` of its `whiteSpace:nowrap` label as a floor. The 12-char labels ("Transactions", "Portefeuille") at 11 px exceed a 1/5 column on phones ≤ ~393 px → labels overflow / clip into neighbours.
2. **Transaction rows** (`PekuloActivityRow`, `PekuloSuggestionRow`) — the secondary "account · date / category" line sits in a `flex:1` column with no `min-width:0` and no truncation, so a long Bridge account label ("Bridge — Banque — Carte Visa Classic - Mr J DOE 02Xx (Débitée Sur Compte Courant 2)") wraps to 3 lines, blowing out row height.

Out of fix scope (flagged, not touched): the centre floating pill (paper-plane/chat/palette) and the bottom-right "N" dot are the **react-grab dev overlay** (dev-only, never in prod) — they obscure the "Mensuel" tab in the screenshot but are not a production bug.

## Why

The transactions screen is unusable on a phone today: nav labels are clipped (can't tell tabs apart) and every list row is 3× too tall. Persona #1 (Alex) is mobile-first.

## Acceptance Criteria

- [ ] **AC-1** — On a 375 px viewport, all 5 nav labels (Cap / Transactions / Mensuel / Portefeuille / Immobilier) render **fully on one line within their own column** — no clipping, no bleed into neighbours, no horizontal scroll. (WIG: "flex/grid children need min-w-0"; ui-ux-pro-max `truncation-strategy`: nav labels fit, never truncate.)
- [ ] **AC-2** — Nav buttons stay ≥ 44 px tap target, grayscale chrome (active `$color`, inactive `$colorTertiary`), `:focus-visible` intact, `aria-label` + `aria-current` unchanged.
- [ ] **AC-3** — In both `PekuloActivityRow` and `PekuloSuggestionRow`, the primary label and the secondary "account · …" line each render on a **single line, ellipsis-truncated** (no 3-line wrap); the amount stays pinned right and is not squeezed/wrapped.
- [ ] **AC-4** — No new design tokens, no new deps, `packages/ui/public/tamagui.generated.css` unchanged; TR-strict preserved (grayscale, no card borders, dark contrast unchanged).
- [ ] **AC-5** — `@pekulo/ui` test suite green (a11y unchanged; snapshots updated to reflect the new structure).

## Files to Change

- `packages/ui/src/components/PekuloMobileBottomNav/PekuloMobileBottomNav.tsx` — `minWidth:0` per button; label → `numberOfLines={1}` + `maxWidth:"100%"`; reduce label font 11 → 10 px (inline style, no token) + keep tight letter-spacing so the longest labels fit a 1/5 column at 360–393 px.
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx` — `minWidth:0` on the `flex:1` column; label `numberOfLines={1}`; caption row truncates (account `flexShrink:1 minWidth:0 numberOfLines:1`, category glyph + label `flexShrink:0`); amount `flexShrink:0`.
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx` — `minWidth:0` on the `flex:1` column; label + caption `numberOfLines={1}`; amount `flexShrink:0`.
- (consequential) `PekuloActivityRow.snapshot.test.tsx` / `PekuloSuggestionRow.snapshot.test.tsx` — update snapshots if the rendered tree changes.

Pattern source: `holding-row.tsx` already uses `<View flex={1} minWidth={0}>` + `numberOfLines={1}` — same iso-pattern, just applied to the two shared row primitives + the nav.

## Test Plan

- `bun --filter='@pekulo/ui' run test` — a11y suites stay green; snapshot suites updated.
- `bun --filter='@pekulo/ui' run typecheck` + repo `lint` / `format:check`.
- Visual: react-grab MCP offline → static design-law pass (grayscale chrome, ≥44 px targets, single-line labels/rows) + reason about 375 / 393 px. Live verification waived, consistent with 6-3/6-4/6-8/6-10.

## Result

**Done.** Root cause confirmed in code (not just screenshots): the bottom-nav grid columns equalise fine (Tamagui `.is_View` already defaults `min-width:0`), but the 11 px `whiteSpace:nowrap` labels bled out of their ~75 px buttons; the row captions wrapped because the secondary `Text` had no single-line constraint (Tamagui `.is_Text` defaults `white-space:pre-wrap`).

**Changes (3 `@pekulo/ui` primitives + 3 mechanical snapshot updates):**

- `PekuloMobileBottomNav.tsx` — label font 11→10 px (inline style, no token) so the 12-char labels fit a 1/5 column at 360–393 px; `numberOfLines={1}` (ellipsis safety net) + explicit `minWidth={0}`.
- `PekuloActivityRow.tsx` — `minWidth={0}` column; label + caption `numberOfLines={1}`; account `flexShrink:1`/category `flexShrink:0` so the account ellipsizes and the category stays; amount `flexShrink:0`.
- `PekuloSuggestionRow.tsx` — `minWidth={0}` column; label + caption `numberOfLines={1}`; amount `flexShrink:0`.
- Snapshots updated: `PekuloActivityRow` (×2), `PekuloSuggestionRow` (×3), `PekuloRecentActivityCard` (×1, composes the row).

**Production-paint check (the disableInjectCSS landmine, lesson 2026-05-24):** apps/web has NO Tamagui compiler extractor (`next.config.ts` only transpiles `@tamagui/next-theme` + `react-native-web`) and imports the pre-generated base/theme CSS (`@pekulo/ui/generated.css`); component atomic classes inject at runtime. `generate:tamagui-css` produced **no diff** (these are inline props, not new `styled()`/variant/token), and `holding-row.tsx` already ships the identical `numberOfLines={1}` + `minWidth={0}` → the classes paint via the same path. The nav font is an inline style → always paints regardless.

**Out of fix scope:** the centre floating pill + bottom-right "N" are the react-grab dev overlay (dev-only); they obscured the "Mensuel" tab in the screenshot but are not a prod bug — untouched.

**Gate (fresh evidence):** `@pekulo/ui` test **212 pass / 1 skip / 0 fail** (125 files, 6 snapshots updated) · typecheck **8/8** · `bun run lint` **0/0** · `apps/web` production build **exit 0** · format clean for all touched files. Live visual verification waived (react-grab MCP offline, as 6-3/6-4/6-8/6-10); dev server hot-reloads so the fix is observable on refresh.

**AC:** AC-1 (font fits + ellipsis) ✓ static · AC-2 (~52 px target, grayscale, aria-\* unchanged) ✓ · AC-3 (single-line ellipsis rows) ✓ snapshots · AC-4 (no token/dep, generated.css unchanged, TR-strict) ✓ · AC-5 (ui suite green, snapshots updated) ✓.
