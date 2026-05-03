# Design system — migrate apps/web to Tamagui Core now

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex (against 3-1 Council consensus on option A)

## Context

PRD T2 demands "no per-app Tailwind / NativeWind divergence from V1.5". `apps/web` currently runs Tailwind v4 + shadcn `base-nova` + `@base-ui/react`; the grill locked Tamagui Core (MIT) as the cross-platform substrate for `packages/ui`. V1 = personal use (Persona #1) ; V1.5 = public ramp + Expo mobile in ~2 months. Three options were weighed by the Architecture Council (Winston, Lena, Nina, Maya).

## Decision

Migrate `apps/web` to Tamagui Core **before V1 feature work resumes**. Pekulo Design System (`packages/ui`) is built on Tamagui Core from day 1 ; web routes consume `packages/ui` exclusively. Tailwind v4 + shadcn + `@base-ui/react` are removed from `apps/web` in the same PR sequence. Mobile (V1.5) drops in cleanly with zero further DS migration.

## Why

- **B1 (≥ 60 days personal-use before any (b) decision)** — V1 ship date carries no business pressure; the cost of pausing 2–4 weeks for DS work is absorbed entirely by Persona #1.
- **PRD T2 + FR-55 / FR-56** — paying the unification debt now eliminates the collision the Council unanimously identified as the primary risk of option A: web UI rewrite landing in the same 2-week window as the V1.5 mobile launch.
- **Grill alignment** — Tamagui Core was already locked (Tamagui Pro explicitly rejected) ; the in-house Pekulo DS layered on Tamagui primitives is the agreed long-term substrate.
- **DS discipline already strong** — Pekulo's UX rules (zero card borders, palette strict to monetary deltas, dark-first) are recorded in user feedback memories and `docs/ux/design-spec.md` ; the migration carries the discipline forward without re-debate.

## Considered options

- **(A) Status quo + V1.5 rebuild** — Council 3-1 favourite. Rejected: introduces a UI rewrite collision at V1.5 mobile launch, the universally-flagged primary risk.
- **(C) Tamagui primitives + Tailwind adapter shim** — single Council vote (Nina). Rejected: 3 of 4 specialists called it a "graveyard trap" — adapter becomes dead weight at V1.5 when web migrates anyway, plus risks coupling two incompatible animation runtimes (Framer Motion + Tamagui's animation prop).

## Consequences

- **2–4 week pause on V1 feature work** while `packages/ui` is built and `apps/web` migrates. Accepted.
- **Pre-flight checks required before starting** (treat as gating the migration kick-off):
  - Spike that Tamagui v2 compiler integrates cleanly with Next 16 RSC.
  - Spike that the proto's `App.tsx` components port to Tamagui without losing the strict-palette / banned-decoration discipline from `docs/ux/design-spec.md`.
  - Spike that Tamagui's theme system honours the WCAG 2.2 AA contrast tokens already validated in dark + light modes.
- **Pivot conditions** (if hit, fall back to ADR-superseded option A):
  - Tamagui migration runs longer than 4 weeks (compiler regressions, RSC integration bugs).
  - V1 feature freeze creates external business pressure (early (b) interest) — fall back to option C adapter shim as fastest unblock.
- **Animation strategy locked**: Tamagui's `animations` prop on web AND mobile, removing Framer Motion 12 from the web stack. Skia reservation for the donut hot-path on mobile (V1.5+) carried forward.
- **`oxlint` rule added in Phase 3 process rules**: forbid `tailwindcss` imports outside `packages/ui` once the migration completes ; forbid app-local Tailwind utility classes in `apps/web/src/app/**`.
