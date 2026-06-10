# Quick Spec: Cap progress = live investable wealth (exclude primary residence)

**Date:** 2026-06-10
**Author:** Alex
**Type:** fix
**Status:** done

## What

The Cap donut shows **0 % / Restant 200 000 €** while the hero shows **Patrimoine
total 2 682 130 €**. The donut (and `useCapDashboardState`) read `currentWealth`
from `getCurrentProgress` (compass.service), which derives it from the last
**monthly wealth snapshot** — empty here → `currentWealth = 0`. Meanwhile the
dashboard overview already computes a live compass progress, but on **total**
wealth (real estate included).

Two changes: (1) source the donut's progress from the **live** overview, and (2)
base it on **investable** wealth (`capitalTotal = liquide + placements`, i.e.
`totalWealthEur − immobilierEur`), per Alex's product decision — the cap measures
investable wealth, excluding the primary residence.

## Why

`currentWealth = 0` is wrong and cascades: donut 0 %, Restant = full cap, Plan/an =
full gap, and milestone statuses all computed against 0 €. The user reads "2 M€ but
cap at 0 %". Investable-live makes the cap meaningful: 52 130 € / 200 000 € ≈ **26 %**.

## Acceptance Criteria

- [ ] **AC-1** — `overview.compass.currentWealth` = `Math.max(0, snapshot.kpi.capitalTotal)` (investable; real estate excluded), and `percent`/`gap` derive from it.
- [ ] **AC-2** — `overview.compass` exposes `currentWealth` (DTO `dashboardCompassSchema` gains `currentWealth: number`).
- [ ] **AC-3** — `CompassSection` donut reads `percent`/`gap`/`currentWealth` from `useDashboardOverview().data.compass` (live), not from `getCurrentProgress`.
- [ ] **AC-4** — `useCapDashboardState` returns `currentWealth` (investable) from the overview; `horizonYears`/`objectif` still resolved (objectif from overview.compass, horizonYears from the compass row query). Milestones + Plan/an therefore use the same investable-live figure.
- [ ] **AC-5** — Setup/loading/error branches still work: the donut renders only when setup is complete and the overview has resolved; an overview error degrades to the existing "Cap indisponible" alert.
- [ ] **AC-6** — No compass row → `overview.compass = null` (unchanged); donut falls back to the setup/incomplete branch.

## Files to Change

1. `apps/api/src/modules/dashboard/dashboard.service.ts` — compass `currentWealth` = `Math.max(0, snapshot.kpi.capitalTotal)`; include `currentWealth` in the `compass` object.
2. `packages/validators/src/dashboard/dashboard.schemas.ts` — add `currentWealth: z.number()` to `dashboardCompassSchema` (+ comment: investable, not total).
3. `apps/web/src/app/(cap)/dashboard/_compass/_components/compass-section.tsx` — rewire `CompassSection` donut + `useCapDashboardState` to `useDashboardOverview`; keep `setup`/`compass` (branching + `horizonYears`).
4. `apps/api/src/modules/dashboard/dashboard.service.test.ts` — update AC-3 + M1 expected `compass` (investable currentWealth + new field).
5. `apps/web/src/app/(cap)/dashboard/_compass/_components/compass-section.a11y.test.tsx` — mock `useDashboardOverview` for the donut render.
6. `apps/api/src/modules/dashboard/dashboard.integration.test.ts` — only if it asserts the `compass` shape.

> **Scope note:** ~6 files (3 source + 3 test). Just over the aped-quick 5-file guideline; single cohesive change, no new patterns/deps, one session. No DB migration.
>
> **Note:** `getCurrentProgress` (compass.service, snapshot path) becomes redundant for the donut. Left in place for now (still wired for the future trajectory/curve); not removed in this fix.

## Test Plan

- **API (dashboard.service.test, bun):** with cash+marketValue (investable) X and real-estate equity Y, `overview.compass.currentWealth === X` (NOT X+Y); percent/gap derive from X; `compass` object includes `currentWealth`. Negative-investable clamps to 0 % (M1).
- **Web (compass-section.a11y):** donut renders against a mocked `useDashboardOverview` returning `compass:{percent,gap,objectif,currentWealth}`; zero axe violations.
- **Regression:** full api dashboard suite + web `_compass` suite green; `tsc` api+web clean.

## Result

**Done 2026-06-10.** The Cap donut now reflects live investable wealth.

- `dashboard.service.ts` — `overview.compass` derives from `investableWealthEur =
Math.max(0, snapshot.kpi.capitalTotal)` (cash + market value; real-estate equity
  excluded) and exposes `currentWealth`.
- `dashboard.schemas.ts` — `dashboardCompassSchema` gains `currentWealth: number`.
- `compass-section.tsx` — `CompassSection` donut + `useCapDashboardState` read
  `useDashboardOverview().data.compass` (live); `horizonYears`/`objectif` from the
  compass row. The snapshot-based `getCurrentProgress`/`progress` query is no longer
  consumed by the donut (left wired for the future trajectory curve).
- **Tests:** api dashboard 20/20 (AC-3 recomputed to investable 26 000 → 3.3 %; M1
  retargeted to a negative-investable overdraft clamp; integration recomputed);
  full api 830/830; web `_compass` + dashboard components 45/45; `tsc` api+web clean;
  oxlint 0/0.
- **Effect:** with cash 3 958 + placements 48 172 = ~52 130 € investable against a
  200 000 € cap, the donut reads ≈ **26 %** (Restant ≈ 147 870 €); Plan/an and
  milestone statuses use the same investable-live figure. Real estate (2,63 M€) no
  longer pegs the cap.
