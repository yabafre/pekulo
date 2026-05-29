# Pekulo — V1 (a) Definition of Done → gate to the V1.5 mobile app

**Purpose.** This is the gate that says _"V1 (a) is stabilised → you may run `aped-arch` for `apps/mobile`"_. Running that `aped-arch` re-run clears **gate G1** and unblocks story **`10-2-mobile-app-bootstrap` (#47)**. **Do not run the mobile `aped-arch` before every box below is checked** — designing the native architecture against a moving web surface / unsettled DS produces rework (the plan defers it on purpose — epics.md:1190).

Status legend: ✅ done · ⬜ remaining (as of 2026-05-29).

## 1. V1 (a) feature scope complete (web PWA)

- ✅ Epic 0 — Foundations
- ✅ Epic 1 — Compass & milestones
- ✅ Epic 2 — Accounts
- ✅ Epic 3 — Holdings & portfolio
- ✅ Epic 4 — Real-estate
- ✅ Epic 5 — Transactions & monthly + Bridge
- ⬜ Epic 6 — LLM auto-categorisation (6-1…6-6)
- ⬜ Epic 7 — Dashboard & projection (7-1…7-4)
- ⬜ Epic 8 — Auth & preferences (8-1, 8-2) — _auth core already shipped via 11-7; close/formalise these two_
- ⬜ Epic 9 — PWA install + offline (9-1, 9-2)
- ⬜ 10-1 — visual snapshot suite (the web visual baseline the mobile app ports against)
- ⬜ 11-4 — axe + WCAG gates (a11y quality bar)

## 2. Shared foundations stable (hard prereqs for mobile)

- ✅ Pekulo DS in `packages/ui` (Tamagui Core) — 0-10 done. Must be **stable, no churn** when mobile starts (PRD:71 — hard prerequisite for V1.5).
- ⬜ `10-1` snapshot suite green — locks the web visual baseline.
- ✅ Domain API (`apps/api`) + oRPC contracts (`@pekulo/contracts`) — the mobile app reuses the **same** client + endpoints; they must be V1-stable, not mid-refactor.

## 3. Stability / dogfooding

- ⬜ App dogfooded in real use (Alex + a first _proche_) for a sustained period.
- ⬜ No open P0 / P1 bug.
- ⬜ CI green across the board (lint, typecheck, tests, rls-audit, tamagui-css-fresh).

## 4. Security baseline (done — must not regress)

- ✅ Perimeter (#102) · isolation (11-3) · auth httpOnly + nonce CSP (11-7) — merged.
- ⬜ _If proches are onboarded in V1:_ RGPD #48 / #49 + DPAs + privacy notice (see `docs/rgpd-readiness.md`). Orthogonal to the mobile gate, but required before real proches.

## 5. THEN — the mobile gate (G1)

Once §1–§3 are ✅:

- ⬜ Acquire the **Apple Developer licence** (App Store) + Play Store account — needed to publish (grill-summary:23).
- ⬜ **Run `aped-arch`** (the V1.5 re-run) to design `apps/mobile` — Expo + expo-router, Tamagui native consumer, port the `Pekulo*` components, Maestro E2E. This clears **gate G1**.
- ⬜ Then `aped-story 10-2-mobile-app-bootstrap` → `aped-dev` → `aped-review` → Expo app.

## When NOT to run `aped-arch`

Any time §1–§3 still have open boxes. The mobile architecture must be designed against a **stable** web surface + a **frozen** DS, or you port a moving target. This is why the plan defers it to the V1 → V1.5 boundary, not earlier.

---

_References: epics.md (Epic 10, G1), prd.md:74 (Growth = Phase 2 = V1.5), grill-summary.md:23, `docs/rgpd-readiness.md`._
