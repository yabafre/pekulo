# Quick Spec: Full-screen dark error boundary (top-level)

**Date:** 2026-06-10
**Author:** Alex
**Type:** fix
**Status:** done

## What

`PekuloErrorBoundary` renders a small `$backgroundCard` card with no page layout.
It is mounted at the **top level** in `apps/web` `providers.tsx` (under
`PekuloRootProvider`). When a render error bubbles all the way up, the dark shell
(`min-height: 100dvh` + background) inside `children` is replaced by this small
card, so the default white `<body>` shows with a tiny dark box top-left — a broken
full-page error screen.

Add a `fullScreen` variant to `PekuloErrorBoundary` that wraps the **same** content
(title + error message) in a dark, full-viewport, centered container
(`$background`, `minHeight: 100dvh`, centered). Pass `fullScreen` to the top-level
boundary in `providers.tsx`. Inline usages (`transactions/error.tsx`) keep the
small card.

## Why

A top-level render error currently produces a white, unstyled page with a stray
dark box — looks broken and off-brand (the app is pure-dark, TR fidelity). The
error UI should fill the viewport in the dark theme and stay readable.

## Acceptance Criteria

- [ ] **AC-1** — `PekuloErrorBoundary` accepts `fullScreen?: boolean`. When set and an error is caught (and no `fallback` prop), it renders the title + message centered inside a `$background`, `minHeight: 100dvh` container.
- [ ] **AC-2** — Default (no `fullScreen`) behaviour is **byte-identical**: the small `$backgroundCard` card. Inline usages and the existing default snapshot are unchanged.
- [ ] **AC-3** — A `fallback` prop still short-circuits both variants (unchanged).
- [ ] **AC-4** — The top-level boundary in `apps/web` `providers.tsx` passes `fullScreen`; the error message stays visible (useful in dev).

## Files to Change

1. `packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.tsx` — add `fullScreen?: boolean`; in error state, wrap the existing card in a dark full-viewport centered container when `fullScreen` is true.
2. `apps/web/src/components/providers.tsx` — `<PekuloErrorBoundary onError={reportClientError} fullScreen>`.
3. `packages/ui/src/components/PekuloErrorBoundary/PekuloErrorBoundary.snapshot.test.tsx` — add a `fullScreen` snapshot (asserts the dark `$background` wrapper around the same card); existing default snapshot left untouched.

> **Scope:** 3 files, no migration, no new deps, one session.

## Test Plan

- **Snapshot (vitest):** new case — `<PekuloErrorBoundary fullScreen><Boom/></PekuloErrorBoundary>` → wrapper carries `$background` + `min-height:100dvh` + centering, with the same title/message inside. The existing "default fallback" snapshot must remain green (proves AC-2).
- **Regression:** `@pekulo/ui` test suite + `apps/web` typecheck green.

## Result

**Done 2026-06-10.** `PekuloErrorBoundary` gained a `fullScreen` prop; the
top-level boundary in `providers.tsx` sets it.

- `PekuloErrorBoundary.tsx` — in the error state, the same title+message card is
  wrapped (when `fullScreen`) in a `$background` / `minHeight: 100dvh` / centered
  container; the default (inline card) path is byte-identical.
- `providers.tsx` — `<PekuloErrorBoundary onError={…} fullScreen>`.
- **Tests:** `PekuloErrorBoundary` 4/4 — the existing default-fallback snapshot is
  unchanged (proves AC-2); new test asserts the fullScreen wrapper carries
  `min-height:100dvh`, centering, and `$background`. ui+web `tsc` clean; oxlint 0/0.
- **Effect:** a top-level render error now fills the viewport in the dark theme
  (centered card) instead of a white page with a stray box.
