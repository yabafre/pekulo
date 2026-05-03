# Test pyramid — Vitest + Playwright + axe + Lighthouse CI + pytest

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

`docs/project-context.md` flags the absence of any test framework as a known gap. PRD NFRs 1, 2, 4, 5, 6, 7, 8, 18, 21, 22 all require measurable validation. Architecture must prescribe a single coherent toolchain so `aped-qa` and `aped-dev` have an unambiguous target.

## Decision

- **Unit + integration:** Vitest (Node + jsdom/happy-dom envs) for `apps/web` and `packages/ui`.
- **E2E web:** Playwright (Chromium, Firefox, Webkit). Smoke tier on PR ; full tier on `main`.
- **E2E mobile (V1.5):** Maestro on Expo.
- **Accessibility:** vitest-axe (component-level) + 1 manual screen-reader pass before (b).
- **Performance budgets:** Lighthouse CI against the Vercel preview URL on every PR.
- **`apps/prices`:** pytest with `pytest-asyncio`.

## Why

- **NFR-3 (Lighthouse ≥ 90), NFR-4 (TTFMP < 2.5 s)** — Lighthouse CI gates regression at the budget level.
- **NFR-22 (WCAG 2.2 AA)** — vitest-axe catches contrast/role/label regressions per component ; manual screen-reader pass covers focus management and announcement order.
- **NFR-8 (RLS coverage)** — covered by a dedicated SQL probe in CI, not by test framework choice.
- **Vitest** pairs natively with Vite (proto already on Vite) and ships ESM-first — fits Next 16 + React 19 + Bun without a Babel/Jest transformer detour.
- **Playwright over Cypress** — Webkit support + better parallelism + first-class trace viewer.

## Considered options

- **Jest + RTL** — rejected: heavier, slower, ESM friction with Bun + Next 16.
- **Cypress** — rejected: no Webkit, slower in CI, weaker trace tooling.

## Consequences

- New devDeps in three workspaces ; CI pipeline grows by ~3–5 min per PR (acceptable trade-off vs the present zero-coverage state).
- A11y is enforced at component-level — DS components in `packages/ui` MUST ship with a passing vitest-axe spec.
