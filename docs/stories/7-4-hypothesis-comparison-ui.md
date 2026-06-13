# Story: 7-4-hypothesis-comparison-ui — Hypothèse card: projection vs compass-required curve + €/month gap

**Epic:** Epic 7 — Dashboard & projection
**Status:** ready-for-dev
**Ticket:** [#41](https://github.com/yabafre/pekulo/issues/41)
**Branch:** feature/41-7-4-hypothesis-comparison-ui

## User Story

**As a** Pekulo user, **I want** the Hypothèse card on the Cap dashboard — my projected wealth curve drawn against the compass-required curve, the gap surfaced in EUR per month, and a read-only view of my projection inputs in Paramètres — **so that** I see at a glance whether my current plan reaches my cap, and exactly how much more I'd need to put in per month if it doesn't.

## Acceptance Criteria

- **AC-1 (FR-59 — €/month gap math)** — **Given** `objectif = 800_000`, `projectedFinalEur = 700_000`, `horizonYears = 30`, `annualRate = 0.05`, **When** `computeMonthlyGap` runs, **Then** it returns `reachesCap = false` and `gapEurPerMonth = shortfall · i / ((1+i)^m − 1)` with `shortfall = 100_000`, `i = 0.05/12`, `m = 360` (within 1e-6 relative); **And Given** `projectedFinalEur = 820_000` (≥ objectif), **Then** `gapEurPerMonth = 0` and `reachesCap = true`; **And Given** `annualRate = 0`, **Then** `gapEurPerMonth = shortfall / m` exactly (no division by zero).
- **AC-2 (FR-59 — compass-required ramp)** — **Given** `currentWealthEur = 180_400`, `objectif = 800_000`, `horizonYears = 29`, **When** `computeRequiredCurve` runs, **Then** it returns `horizonYears + 1` points, offset-indexed (`points[k].year === k`), with `points[0].eur === 180_400`, `points[29].eur === 800_000`, and each interior point on the straight line `currentWealthEur + (objectif − currentWealthEur)·(k/horizonYears)`.
- **AC-3 (FR-59 — server `getHypothesisGap`)** — **Given** a user with a compass `objectif` and a stored projection, and a `currentWealthEur` input, **When** `dashboard.getHypothesisGap` runs, **Then** it returns `HypothesisGap` with `requiredFinalEur === objectif`, `projectedFinalEur === projection.finalEur`, `deltaAtCapEur === projectedFinalEur − objectif`, `requiredPoints` from `computeRequiredCurve`, and `gapEurPerMonth`/`reachesCap` from `computeMonthlyGap`; **And Given** no compass, **Then** it returns `null`. The procedure is mounted at `/rpc/v1/dashboard` and round-trips over the oRPC HTTP boundary.
- **AC-4 (card render)** — **Given** the Cap view with a configured compass, **When** the Hypothèse card mounts, **Then** `PekuloProjectionChart` renders both series (`actual` = projected curve, `required` = compass ramp) with a filled `nowMarker` at today and an outlined `capMarker` at the horizon, `PekuloHypothesisVerdict` shows the signed delta at the cap, and the "Il manque X € / mois" line shows iff `reachesCap === false`.
- **AC-5 (card states)** — **Given** the projection/gap reads are loading, **Then** the card shows a `PekuloSkeleton`; **Given** the user has no compass (cap state null), **Then** the widget shows "En attente de la configuration du cap" instead of a misleading chart; **Given** `reachesCap === true`, **Then** the verdict reads "Tu atteins ton cap …" with no shortfall line.
- **AC-6 (FR-57 — read-only Paramètres)** — **Given** Paramètres, **Then** a "Hypothèse de projection" section shows two read-only rows — "Versement mensuel" (EUR) and "Rendement annuel supposé" (%) — with no edit affordance.
- **AC-7 (widget integration)** — **Given** the Cap view widget grid, **When** it renders, **Then** the `hypothesis` widget renders the live `HypothesisCard` (the `PlaceholderCard` is gone), keeps `colSpan: 12 / rowSpan: 1`, and stays drag-reorderable / hideable through the 7-2 layout system (no registry contract change beyond the `render`).
- **AC-8 (TR-strict palette)** — **Given** the card, **Then** the only non-grayscale colour is the verdict's signed delta (`$success` / `$danger`); the chart strokes use the `--chartActual` / `--chartPlan` tokens; no emerald appears anywhere else on the card.
- **AC-9 (offset → calendar at render)** — **Given** the projection/required points are offset-indexed (`year` = 0..horizonYears), **When** the card builds the chart model, **Then** it maps each offset to `currentCalendarYear + offset`; the api derives never read a clock.

## Tasks

> Commit prefix: `feat(#41): …` / `docs(#41): …` (github-issues — see `.aped/aped-dev/references/ticket-git-workflow.md`).
> `tsc` is NOT in the commit gate — run the package `typecheck` before every commit (lesson 2026-06-01).

- [ ] **T1 — Add `HypothesisGap` to `@pekulo/types` [AC: AC-3]**
  Append to `packages/types/src/hypothesis/hypothesis.types.ts` (after `HypothesisProjection`, keeping the barrel export intact):
  ```ts
  /**
   * FR-59 comparison output (story 7-4). The projected-vs-compass gap, surfaced
   * as the extra €/month needed to reach the cap. `requiredPoints` is the LINEAR
   * compass-required ramp, offset-indexed like HypothesisProjection.points
   * (point[0].eur === currentWealthEur, point[horizonYears].eur === requiredFinalEur).
   * The projected curve itself stays the 7-3 HypothesisProjection (the web card
   * reads it from useHypothesisProjection). Iso with `hypothesisGapSchema` in
   * @pekulo/validators (kept in lock-step by hand, like HypothesisProjection).
   */
  export interface HypothesisGap {
    /** Extra monthly contribution to close the shortfall; 0 when reachesCap. */
    gapEurPerMonth: number;
    /** projectedFinalEur >= requiredFinalEur. */
    reachesCap: boolean;
    /** Projected wealth at the horizon (= HypothesisProjection.finalEur). */
    projectedFinalEur: number;
    /** The compass target capital (objectif). */
    requiredFinalEur: number;
    /** Signed: projectedFinalEur − requiredFinalEur. */
    deltaAtCapEur: number;
    horizonYears: number;
    /** Linear compass-required ramp, offset-indexed (length horizonYears + 1). */
    requiredPoints: HypothesisProjectionPoint[];
  }
  ```
  Run: `bun --filter='@pekulo/types' run typecheck`
  Expected: exit 0, no type errors.
  Commit: `git add packages/types/src/hypothesis && git commit -m "feat(#41): add HypothesisGap domain type (FR-59)"`

- [ ] **T2 — Add `hypothesisGapSchema` to `@pekulo/validators` [AC: AC-3]**
  Append to `packages/validators/src/hypothesis/hypothesis.schemas.ts` (after `hypothesisProjectionSchema`, reusing the file's `positive` helper + `hypothesisProjectionPointSchema`):
  ```ts
  // ── Story 7-4 (FR-59) — projection-vs-compass gap ─────────────────────────
  // Iso with @pekulo/types#HypothesisGap (kept in lock-step by hand). The read
  // input is the SAME { currentWealthEur } shape as getProjection (the caller
  // passes the 7-1 dashboard overview investable wealth) — reuse
  // getProjectionInputSchema rather than declaring a second identical schema.
  export const hypothesisGapSchema = z.object({
    gapEurPerMonth: positive,
    reachesCap: z.boolean(),
    projectedFinalEur: z.number(),
    requiredFinalEur: z.number(),
    deltaAtCapEur: z.number(),
    horizonYears: z.number().int().min(1).max(50),
    requiredPoints: z.array(hypothesisProjectionPointSchema),
  });
  export type HypothesisGapDto = z.infer<typeof hypothesisGapSchema>;
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/validators/src/hypothesis && git commit -m "feat(#41): add hypothesisGapSchema (FR-59)"`

- [ ] **T3 — RED→GREEN: pure `derive/hypothesis-gap.ts` + tests [AC: AC-1, AC-2]**
  Create `apps/api/src/common/derive/hypothesis-gap.ts`:
  ```ts
  // apps/api/src/common/derive/hypothesis-gap.ts
  // Pure helpers for the FR-59 projection-vs-compass comparison (story 7-4). No
  // I/O, no clock reads — like projection-curve.ts (7-3), the required curve is
  // OFFSET-indexed (point.year = years from now); the web card maps offsets to
  // calendar years at render.
  //
  //   shortfall      = objectif − projectedFinalEur                (€ at horizon)
  //   gapEurPerMonth = the ordinary monthly annuity whose future value over the
  //                    horizon equals the shortfall, at i = annualRate/12:
  //                      gap = shortfall · i / ((1+i)^m − 1)        (m = 12·horizon)
  //                      (1+i)^m === 1 (i ≈ 0 / underflow) → gap = shortfall / m
  //                    shortfall ≤ 0 → gap 0, reachesCap true.
  //   requiredPoints = the LINEAR compass-required ramp from currentWealthEur to
  //                    objectif: point[k].eur = currentWealthEur
  //                      + (objectif − currentWealthEur)·(k / horizonYears).
  //
  // Guards throw HypothesisError("HYPOTHESIS_INVALID_INPUT") → 400 (mirrors
  // projection-curve.ts defense-in-depth behind the Zod contract boundary).

  import type { HypothesisProjectionPoint } from "@pekulo/types";
  import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

  const MONTHS_PER_YEAR = 12;

  function assertObjectif(objectif: number): void {
    if (!Number.isFinite(objectif) || objectif < 0) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "objectif must be a finite number >= 0",
      );
    }
  }

  function assertHorizon(horizonYears: number): void {
    if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 50) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "horizonYears must be an integer in [1, 50]",
      );
    }
  }

  export interface ComputeRequiredCurveInput {
    currentWealthEur: number;
    objectif: number;
    horizonYears: number;
  }

  export function computeRequiredCurve(
    input: ComputeRequiredCurveInput,
  ): HypothesisProjectionPoint[] {
    const { currentWealthEur, objectif, horizonYears } = input;
    if (!Number.isFinite(currentWealthEur)) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "currentWealthEur must be a finite number",
      );
    }
    assertObjectif(objectif);
    assertHorizon(horizonYears);
    return Array.from({ length: horizonYears + 1 }, (_unused, k) => ({
      year: k,
      eur: currentWealthEur + (objectif - currentWealthEur) * (k / horizonYears),
    }));
  }

  export interface ComputeMonthlyGapInput {
    projectedFinalEur: number;
    objectif: number;
    horizonYears: number;
    annualRate: number;
  }

  export interface MonthlyGap {
    gapEurPerMonth: number;
    shortfallEur: number;
    reachesCap: boolean;
  }

  export function computeMonthlyGap(input: ComputeMonthlyGapInput): MonthlyGap {
    const { projectedFinalEur, objectif, horizonYears, annualRate } = input;
    if (!Number.isFinite(projectedFinalEur)) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "projectedFinalEur must be a finite number",
      );
    }
    assertObjectif(objectif);
    assertHorizon(horizonYears);
    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "annualRate must be a finite number in [0, 1]",
      );
    }

    const shortfall = objectif - projectedFinalEur;
    if (shortfall <= 0) {
      return { gapEurPerMonth: 0, shortfallEur: 0, reachesCap: true };
    }

    const i = annualRate / MONTHS_PER_YEAR;
    const m = MONTHS_PER_YEAR * horizonYears;
    const factor = (1 + i) ** m;
    // Branch on the COMPOUNDING FACTOR, not i === 0 — a sub-epsilon rate underflows
    // (1+i)^m → 1, driving the annuity divisor → 0 (7-3 review lesson 2026-06-12).
    const gapEurPerMonth = factor === 1 ? shortfall / m : (shortfall * i) / (factor - 1);
    if (!Number.isFinite(gapEurPerMonth)) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "gap computation overflowed to a non-finite value",
      );
    }
    return { gapEurPerMonth, shortfallEur: shortfall, reachesCap: false };
  }
  ```
  Create `apps/api/src/common/derive/hypothesis-gap.test.ts` (re-derives the formulas inline + one out-of-band oracle, mirroring projection-curve.test.ts — no magic numbers):
  ```ts
  // Pure-helper unit tests for the FR-59 gap derives. No I/O, no clock reads.
  // Re-implements the annuity + linear-ramp formulas inline so the test compares
  // helper output against an in-test re-derivation using the same constants.

  import { describe, expect, test } from "bun:test";
  import { computeMonthlyGap, computeRequiredCurve } from "./hypothesis-gap";
  import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

  // gap = shortfall · i / ((1+i)^m − 1), i = rate/12, m = 12·H. factor 1 → linear.
  function monthlyGapFor(shortfall: number, rate: number, horizonYears: number): number {
    const i = rate / 12;
    const m = 12 * horizonYears;
    const factor = (1 + i) ** m;
    return factor === 1 ? shortfall / m : (shortfall * i) / (factor - 1);
  }

  describe("computeMonthlyGap", () => {
    // AC-1 (verbatim from story 7-4): objectif 800k, projected 700k, 30y @ 5%.
    test("AC-1: returns the monthly annuity that closes the shortfall", () => {
      const out = computeMonthlyGap({
        projectedFinalEur: 700_000,
        objectif: 800_000,
        horizonYears: 30,
        annualRate: 0.05,
      });
      expect(out.reachesCap).toBe(false);
      expect(out.shortfallEur).toBe(100_000);
      expect(out.gapEurPerMonth).toBeCloseTo(monthlyGapFor(100_000, 0.05, 30), 6);
      // Out-of-band oracle: 100_000 · (0.05/12) / ((1+0.05/12)^360 − 1).
      expect(out.gapEurPerMonth).toBeCloseTo(120.1500447, 4);
    });

    // AC-1: projected >= objectif → no gap.
    test("AC-1: reaching the cap yields gap 0 / reachesCap true", () => {
      const out = computeMonthlyGap({
        projectedFinalEur: 820_000,
        objectif: 800_000,
        horizonYears: 30,
        annualRate: 0.05,
      });
      expect(out.reachesCap).toBe(true);
      expect(out.gapEurPerMonth).toBe(0);
    });

    // AC-1: zero rate → exact linear share, no division by zero.
    test("AC-1: annualRate 0 splits the shortfall linearly", () => {
      const out = computeMonthlyGap({
        projectedFinalEur: 700_000,
        objectif: 800_000,
        horizonYears: 30,
        annualRate: 0,
      });
      expect(out.gapEurPerMonth).toBe(100_000 / 360);
    });

    test("guard: non-finite projectedFinalEur throws HypothesisError", () => {
      expect(() =>
        computeMonthlyGap({
          projectedFinalEur: Number.NaN,
          objectif: 800_000,
          horizonYears: 30,
          annualRate: 0.05,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: annualRate > 1 throws HypothesisError", () => {
      expect(() =>
        computeMonthlyGap({
          projectedFinalEur: 700_000,
          objectif: 800_000,
          horizonYears: 30,
          annualRate: 1.5,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: horizonYears out of [1,50] throws HypothesisError", () => {
      expect(() =>
        computeMonthlyGap({
          projectedFinalEur: 700_000,
          objectif: 800_000,
          horizonYears: 51,
          annualRate: 0.05,
        }),
      ).toThrow(HypothesisError);
    });
  });

  describe("computeRequiredCurve", () => {
    // AC-2: linear ramp from current wealth to objectif over the horizon.
    test("AC-2: offset-indexed linear ramp, endpoints exact", () => {
      const points = computeRequiredCurve({
        currentWealthEur: 180_400,
        objectif: 800_000,
        horizonYears: 29,
      });
      expect(points).toHaveLength(30);
      expect(points[0]!.year).toBe(0);
      expect(points[0]!.eur).toBe(180_400);
      expect(points[29]!.eur).toBe(800_000);
      for (let k = 0; k <= 29; k++) {
        expect(points[k]!.year).toBe(k);
        expect(points[k]!.eur).toBeCloseTo(180_400 + (800_000 - 180_400) * (k / 29), 6);
      }
    });

    test("AC-2: negative current wealth ramps from the negative start (no clamp)", () => {
      const points = computeRequiredCurve({
        currentWealthEur: -5_000,
        objectif: 100_000,
        horizonYears: 10,
      });
      expect(points[0]!.eur).toBe(-5_000);
      expect(points[10]!.eur).toBe(100_000);
    });

    test("guard: non-integer horizonYears throws HypothesisError", () => {
      expect(() =>
        computeRequiredCurve({ currentWealthEur: 180_400, objectif: 800_000, horizonYears: 29.5 }),
      ).toThrow(HypothesisError);
    });
  });
  ```
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the full api suite is green; the new file reports `✓ computeMonthlyGap > AC-1: returns the monthly annuity that closes the shortfall` and the other cases pass, exit 0.
  Commit: `git add apps/api/src/common/derive/hypothesis-gap.ts apps/api/src/common/derive/hypothesis-gap.test.ts && git commit -m "feat(#41): pure hypothesis-gap derives + tests (FR-59)"`

- [ ] **T4 — RED→GREEN: `dashboard.service` getHypothesisProjection port + getHypothesisGap + tests [AC: AC-3]**
  Edit `apps/api/src/modules/dashboard/dashboard.service.ts`.
  (a) Add the type import near the top (a new line — `HypothesisGap`/`HypothesisProjection` live in `@pekulo/types`, NOT `@pekulo/validators`):
  ```ts
  import type { HypothesisGap, HypothesisProjection } from "@pekulo/types";
  import { computeMonthlyGap, computeRequiredCurve } from "../../common/derive/hypothesis-gap";
  ```
  (b) Add the new port to the `DashboardPorts` interface (after `listRecentActivity`):
  ```ts
    // Story 7-4 (FR-59) — the 7-3 hypothesis projection read, injected as a port
    // so the dashboard composes the gap WITHOUT a dashboard↔hypothesis cycle: the
    // caller passes currentWealthEur (the overview investable wealth), exactly as
    // getProjection takes it (7-3 decoupling).
    getHypothesisProjection: (
      userId: string,
      currentWealthEur: number,
    ) => Promise<HypothesisProjection>;
  ```
  (c) Add the method to the `DashboardService` interface (after `getOverview`):
  ```ts
    getHypothesisGap(userId: string, currentWealthEur: number): Promise<HypothesisGap | null>;
  ```
  (d) Add the method to the object returned by `createDashboardService` (after the `getOverview` method, before the closing `}`):
  ```ts
      async getHypothesisGap(userId, currentWealthEur) {
        // The compass objectif is the cap target; the projection supplies the
        // final wealth + horizon + rate. Both reads are user-scoped (ADR-0013 is
        // enforced inside the underlying module services).
        const [compassRow, projection] = await Promise.all([
          // Compass is optional: no compass → no target → no gap (the card shows
          // the "configure ton cap" hint). Mirror getOverview's degrade-to-null.
          deps.getCompass(userId).catch(() => null),
          deps.getHypothesisProjection(userId, currentWealthEur),
        ]);
        if (!compassRow) return null;
        const { objectif } = compassRow;
        const { finalEur: projectedFinalEur, horizonYears, annualRate } = projection;
        const requiredPoints = computeRequiredCurve({ currentWealthEur, objectif, horizonYears });
        const { gapEurPerMonth, reachesCap } = computeMonthlyGap({
          projectedFinalEur,
          objectif,
          horizonYears,
          annualRate,
        });
        return {
          gapEurPerMonth,
          reachesCap,
          projectedFinalEur,
          requiredFinalEur: objectif,
          deltaAtCapEur: projectedFinalEur - objectif,
          horizonYears,
          requiredPoints,
        };
      },
  ```
  Append a `describe` block to `apps/api/src/modules/dashboard/dashboard.service.test.ts` (self-contained stub ports — only `getCompass` + `getHypothesisProjection` matter for `getHypothesisGap`; stub the rest as no-ops):
  ```ts
  describe("dashboard.service — getHypothesisGap (story 7-4)", () => {
    const baseProjection = {
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 30,
      points: [{ year: 0, eur: 60_000 }],
      finalEur: 700_000,
    };
    // Minimal port set — getHypothesisGap only touches getCompass + getHypothesisProjection.
    function ports(overrides: Partial<Parameters<typeof createDashboardService>[0]>) {
      return {
        listAccounts: async () => [],
        listHoldings: async () => [],
        resolveQuote: async () => {
          throw new Error("unused");
        },
        getRates: async () => ({ base: "EUR" as const, date: "2026-06-13", rates: { EUR: 1 } }),
        getTotalEquity: async () => ({ totalEquityEur: 0 }),
        getCompass: async () => ({ objectif: 800_000 }),
        computeProgress: () => ({ percent: 0, gap: 0 }),
        listRecentActivity: async () => [],
        getHypothesisProjection: async () => baseProjection,
        ...overrides,
      } as Parameters<typeof createDashboardService>[0];
    }

    test("composes objectif + projection into the gap (AC-3)", async () => {
      const service = createDashboardService(ports({}));
      const gap = await service.getHypothesisGap("user-uuid", 60_000);
      expect(gap).not.toBeNull();
      expect(gap!.requiredFinalEur).toBe(800_000);
      expect(gap!.projectedFinalEur).toBe(700_000);
      expect(gap!.deltaAtCapEur).toBe(-100_000);
      expect(gap!.reachesCap).toBe(false);
      expect(gap!.gapEurPerMonth).toBeGreaterThan(0);
      expect(gap!.requiredPoints).toHaveLength(31);
      expect(gap!.requiredPoints[0]!.eur).toBe(60_000);
      expect(gap!.requiredPoints[30]!.eur).toBe(800_000);
    });

    test("returns null when the user has no compass (AC-3)", async () => {
      const service = createDashboardService(ports({ getCompass: async () => null }));
      const gap = await service.getHypothesisGap("user-uuid", 60_000);
      expect(gap).toBeNull();
    });
  });
  ```
  (If `createDashboardService`/`describe`/`test`/`expect` are not already imported at the top of the test file, add them — read the file's existing import header first and extend it; do not duplicate import lines.)
  Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test`
  Expected: typecheck exit 0; the 2 new `getHypothesisGap` cases pass alongside the existing dashboard service suite, exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard.service.ts apps/api/src/modules/dashboard/dashboard.service.test.ts && git commit -m "feat(#41): dashboard getHypothesisGap + projection port (FR-59)"`

- [ ] **T5 — Extend `dashboardContract` with getHypothesisGap [AC: AC-3]**
  Edit `packages/contracts/src/dashboard/dashboard.contract.ts` — extend the imports and add the procedure (keep `getOverview`/`getLayout`/`saveLayout`):
  ```ts
  import { oc } from "@orpc/contract";
  import {
    dashboardOverviewSchema,
    dashboardLayoutSchema,
    saveDashboardLayoutInputSchema,
    getProjectionInputSchema,
    hypothesisGapSchema,
  } from "@pekulo/validators";

  export const dashboardContractV1 = {
    getOverview: oc.output(dashboardOverviewSchema),
    getLayout: oc.output(dashboardLayoutSchema.nullable()),
    saveLayout: oc.input(saveDashboardLayoutInputSchema).output(dashboardLayoutSchema),
    // Story 7-4 (FR-59) — projection-vs-compass gap. Input { currentWealthEur }
    // (reused from getProjection); null output when the user has no compass.
    getHypothesisGap: oc.input(getProjectionInputSchema).output(hypothesisGapSchema.nullable()),
  } as const;
  ```
  (Leave `dashboardContract` / `dashboardContractMeta` unchanged.)
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/contracts/src/dashboard/dashboard.contract.ts && git commit -m "feat(#41): dashboard contract getHypothesisGap (FR-59)"`

- [ ] **T6 — RED→GREEN: route handler + integration round-trip [AC: AC-3]**
  Edit `apps/api/src/modules/dashboard/dashboard.routes.ts` — add the handler inside `impl.router({ ... })` (keep the three existing handlers):
  ```ts
      getHypothesisGap: impl.getHypothesisGap.handler(async ({ context, input }) => {
        return deps.service.getHypothesisGap(requireUserId(context.userId), input.currentWealthEur);
      }),
  ```
  Edit `apps/api/src/modules/dashboard/dashboard.integration.test.ts`:
  (a) In `buildApp()`, add the projection port stub to the `createDashboardModule({ ... })` call (so the gap procedure has a projection source):
  ```ts
      getHypothesisProjection: async () => ({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 30,
        points: [{ year: 0, eur: 60_000 }],
        finalEur: 700_000,
      }),
  ```
  (b) Add a test asserting the HTTP round-trip (mirror the existing `getOverview` case in this file — read it first for the exact `{ json: ... }` envelope + Bearer header shape):
  ```ts
  test("getHypothesisGap round-trips the gap over the oRPC HTTP boundary", async () => {
    const token = await signFor(USER);
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getHypothesisGap`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { currentWealthEur: 60_000 } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { requiredFinalEur: number; projectedFinalEur: number; reachesCap: boolean } };
    expect(body.json.requiredFinalEur).toBe(800_000);
    expect(body.json.projectedFinalEur).toBe(700_000);
    expect(body.json.reachesCap).toBe(false);
  });
  ```
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the dashboard integration suite passes including the new `getHypothesisGap` round-trip, exit 0.
  Commit: `git add apps/api/src/modules/dashboard/dashboard.routes.ts apps/api/src/modules/dashboard/dashboard.integration.test.ts && git commit -m "feat(#41): dashboard getHypothesisGap route + integration test (FR-59)"`

- [ ] **T7 — Wire the `getHypothesisProjection` port in runtime-dependencies [AC: AC-3]**
  Edit `apps/api/src/bootstrap/runtime-dependencies.ts` — inside the `createDashboardModule({ ... })` call (currently ending at `listRecentActivity`), add the projection port (the `hypothesisModule` is already constructed above — `orpcRouter.hypothesis = hypothesisModule.router`):
  ```ts
      // story 7-4 (FR-59) — projection read port for the gap composition. Same
      // service the /rpc/v1/hypothesis getProjection procedure uses; passing it
      // as a port keeps the dashboard decoupled from the hypothesis module.
      getHypothesisProjection: (userId, currentWealthEur) =>
        hypothesisModule.service.getProjection(userId, currentWealthEur),
  ```
  Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test`
  Expected: typecheck exit 0 (the port now satisfies `DashboardPorts`); api suite green.
  Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#41): wire dashboard getHypothesisProjection port (FR-59)"`

- [ ] **T8 — Extend `PekuloHypothesisVerdict` with the €/month gap line + tests [AC: AC-4, AC-8]**
  Edit `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.tsx`.
  (a) Add the optional prop to the interface:
  ```ts
  export interface PekuloHypothesisVerdictProps {
    /** Capital projeté à l'horizon. */
    projectedEur: number;
    /** Cap demandé. */
    requiredEur: number;
    /** Année cible. */
    targetYear: number;
    /**
     * Story 7-4 (FR-59) — extra €/month to reach the cap. Renders the shortfall
     * line when present AND the cap is NOT reached. Omit to keep the 7-3 shape.
     */
    gapEurPerMonth?: number;
  }
  ```
  (b) Destructure it and render the shortfall line after the delta `Text` (the `eur0` formatter already exists in the file):
  ```ts
  export function PekuloHypothesisVerdict({
    projectedEur,
    requiredEur,
    targetYear,
    gapEurPerMonth,
  }: PekuloHypothesisVerdictProps) {
    const delta = projectedEur - requiredEur;
    const sign = delta >= 0 ? "+" : "−";
    const reaches = delta >= 0;
    return (
      <View flexDirection="column" gap="$1">
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {reaches
            ? `Tu atteins ton cap en ${targetYear}.`
            : `Tu n'atteins pas ton cap en ${targetYear}.`}
        </Text>
        <Text
          color={(reaches ? "$success" : "$danger") as never}
          fontSize="$caption"
          fontWeight="500"
        >
          {sign}
          {eur0.format(Math.abs(delta))} vs cap requis
        </Text>
        {!reaches && gapEurPerMonth != null && gapEurPerMonth > 0 && (
          <Text color="$colorTertiary" fontSize="$caption">
            Il manque {eur0.format(gapEurPerMonth)} / mois pour atteindre le cap.
          </Text>
        )}
      </View>
    );
  }
  ```
  Add a snapshot case to `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.snapshot.test.tsx` (inside the existing `describe`, after `renders not-reaches`). Run the test ONCE with a placeholder snapshot string, then let `vitest -u` fill the real inline snapshot:
  ```tsx
    it("renders the €/month gap line when not reaching", () => {
      const { container } = renderWithTamagui(
        <PekuloHypothesisVerdict
          projectedEur={650000}
          requiredEur={800000}
          targetYear={2055}
          gapEurPerMonth={120}
        />,
      );
      // The shortfall line is present and grayscale ($colorTertiary), the delta
      // stays $danger. Assert structurally so the snapshot stays the SSOT.
      expect(container.innerHTML).toContain("Il manque");
      expect(container.innerHTML).toContain("/ mois pour atteindre le cap.");
      expect(container.innerHTML).toContain("_col-danger");
    });
  ```
  Add an a11y case to `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.a11y.test.tsx` (inside the existing `describe`):
  ```tsx
    it("gap-line variant has no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloHypothesisVerdict
          projectedEur={650000}
          requiredEur={800000}
          targetYear={2055}
          gapEurPerMonth={120}
        />,
      );
      const r = await axe(container);
      expect(
        (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    });
  ```
  Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test`
  Expected: typecheck exit 0; the two pre-existing `PekuloHypothesisVerdict` snapshots are UNCHANGED (the prop is optional), the new snapshot + a11y cases pass, exit 0.
  Commit: `git add packages/ui/src/components/PekuloHypothesisVerdict && git commit -m "feat(#41): PekuloHypothesisVerdict €/month gap line (FR-59)"`

- [ ] **T9 — keys.ts: `dashboardKeys.hypothesisGap` + registry edges [AC: AC-4]**
  Edit `apps/web/src/lib/zapaction/keys.ts`.
  (a) Add the gap key factory to `dashboardKeys` (replace the existing `dashboardKeys` block, L156-159):
  ```ts
  export const DASHBOARD_KEY = "dashboard" as const;
  export const dashboardKeys = createFeatureKeys(DASHBOARD_KEY, {
    overview: () => ["overview"] as const,
    // Story 7-4 (FR-59) — the projection-vs-compass gap read. currentWealth is
    // part of the key (like hypothesesKeys.projection) so a wealth change
    // refetches naturally without a registry edge.
    hypothesisGap: (currentWealth: number) => ["hypothesisGap", currentWealth] as const,
  });
  ```
  (b) In `setTagRegistry({ ... })`, append the bare `["dashboard", "hypothesisGap"]` prefix to the FOUR edges whose source changes the gap WITHOUT changing currentWealth — the two hypotheses edges (a recorded projection) and the two compass edges (objectif change). Replace the hypotheses edges (L174-175):
  ```ts
    [hypothesesTags.all()]: [
      hypothesesKeys.current(),
      ["hypotheses", "projection"],
      ["dashboard", "hypothesisGap"],
    ],
    [hypothesesTags.current()]: [
      hypothesesKeys.current(),
      ["hypotheses", "projection"],
      ["dashboard", "hypothesisGap"],
    ],
  ```
  And add `["dashboard", "hypothesisGap"]` as the last element of BOTH compass edge arrays (`[compassTags.all()]` and `[compassTags.current()]`, L181-198) — after `dashboardKeys.overview()` in each:
  ```ts
      milestonesKeys.list(),
      dashboardKeys.overview(),
      ["dashboard", "hypothesisGap"],
    ],
  ```
  (Do this for both the `compassTags.all()` and `compassTags.current()` arrays; the wealth edges — accounts/holdings/realestate/transactions/bankConnections — do NOT need the gap key because a wealth change already produces a new `hypothesisGap(currentWealth)` queryKey.)
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test`
  Expected: typecheck exit 0; the existing zapaction registry tests stay green.
  Commit: `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#41): dashboardKeys.hypothesisGap + registry edges (FR-59)"`

- [ ] **T10 — Web read action `getHypothesisGap` [AC: AC-4]**
  Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-gap-actions.ts`:
  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import type { z } from "@pekulo/zod";
  import { getProjectionInputSchema, type HypothesisGapDto } from "@pekulo/validators";
  import { dashboardClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 7-4 (FR-59) — thin read-only delegator (mirror getDashboardOverview).
  // The gap is computed server-side in dashboard.service.getHypothesisGap; the
  // output is null when the user has no compass. Read path → no { ok } envelope.
  export const getHypothesisGap = defineAction<
    z.infer<typeof getProjectionInputSchema>,
    HypothesisGapDto | null,
    ActionContext
  >({
    name: "getHypothesisGap",
    input: getProjectionInputSchema,
    handler: async ({ input }) => {
      await ensureRequestContext();
      return dashboardClient.getHypothesisGap(input);
    },
  });
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0 (the `dashboardClient.getHypothesisGap` call type-checks against the T5 contract).
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-gap-actions.ts" && git commit -m "feat(#41): web getHypothesisGap action (FR-59)"`

- [ ] **T11 — `useHypothesisGap` hook [AC: AC-4]**
  Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-gap.ts`:
  ```ts
  "use client";

  import { useActionQuery } from "@zapaction/query";
  import { dashboardKeys } from "@/lib/zapaction/keys";
  import { getHypothesisGap } from "../_actions/hypothesis-gap-actions";

  // Story 7-4 (FR-59) — projection-vs-compass gap read. currentWealthEur comes
  // from the 7-1 overview (via useCapDashboardState); it is part of the queryKey
  // so a wealth change refetches naturally (mirrors useHypothesisProjection /
  // 7-3). Gated on a finite wealth (load-time-gate, lesson 2026-06-03). The data
  // is null when the user has no compass. read-only (R4).
  export function useHypothesisGap(currentWealthEur: number | undefined) {
    return useActionQuery(getHypothesisGap, {
      input: { currentWealthEur: currentWealthEur ?? 0 },
      queryKey: dashboardKeys.hypothesisGap(currentWealthEur ?? 0),
      readPolicy: "read-only",
      enabled: typeof currentWealthEur === "number" && Number.isFinite(currentWealthEur),
      staleTime: 30_000,
    });
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-gap.ts" && git commit -m "feat(#41): useHypothesisGap hook (FR-59)"`

- [ ] **T12 — Hypothèse card: pure chart-model helper + test + the card component [AC: AC-4, AC-5, AC-8, AC-9]**
  > Read `node_modules/next/dist/docs/` for any App-Router/RSC convention before writing web components (apps/web/AGENTS.md — "this is NOT the Next.js you know").

  Create the PURE mapping helper `apps/web/src/app/(cap)/dashboard/_hypothesis/_lib/build-chart-model.ts` (offset → calendar at render, AC-9; no hooks, fully unit-testable):
  ```ts
  import type { HypothesisGapDto, HypothesisProjectionDto } from "@pekulo/validators";

  export interface ProjectionChartModel {
    years: number[];
    actual: number[];
    required: number[];
    nowMarker: { year: number; value: number };
    capMarker: { year: number; value: number };
  }

  // Story 7-4 (AC-9) — map the offset-indexed 7-3 projection + the FR-59 required
  // ramp onto a calendar-year axis. baseYear is the current calendar year (the
  // ONLY clock read, in the web layer; the api derives stay clock-free). actual
  // = projected curve; required = compass ramp. Both are length horizonYears + 1.
  export function buildChartModel(
    projection: HypothesisProjectionDto,
    gap: HypothesisGapDto,
    baseYear: number,
    currentWealthEur: number,
  ): ProjectionChartModel {
    const years = gap.requiredPoints.map((p) => baseYear + p.year);
    return {
      years,
      actual: projection.points.map((p) => p.eur),
      required: gap.requiredPoints.map((p) => p.eur),
      nowMarker: { year: baseYear, value: currentWealthEur },
      capMarker: { year: baseYear + gap.horizonYears, value: gap.requiredFinalEur },
    };
  }
  ```
  Create its test `apps/web/src/app/(cap)/dashboard/_hypothesis/_lib/build-chart-model.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { buildChartModel } from "./build-chart-model";

  describe("buildChartModel", () => {
    it("maps offsets to calendar years and splits the two series (AC-9)", () => {
      const projection = {
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 2,
        points: [
          { year: 0, eur: 60_000 },
          { year: 1, eur: 80_000 },
          { year: 2, eur: 100_000 },
        ],
        finalEur: 100_000,
      };
      const gap = {
        gapEurPerMonth: 120,
        reachesCap: false,
        projectedFinalEur: 100_000,
        requiredFinalEur: 200_000,
        deltaAtCapEur: -100_000,
        horizonYears: 2,
        requiredPoints: [
          { year: 0, eur: 60_000 },
          { year: 1, eur: 130_000 },
          { year: 2, eur: 200_000 },
        ],
      };
      const model = buildChartModel(projection, gap, 2026, 60_000);
      expect(model.years).toEqual([2026, 2027, 2028]);
      expect(model.actual).toEqual([60_000, 80_000, 100_000]);
      expect(model.required).toEqual([60_000, 130_000, 200_000]);
      expect(model.nowMarker).toEqual({ year: 2026, value: 60_000 });
      expect(model.capMarker).toEqual({ year: 2028, value: 200_000 });
    });
  });
  ```
  Create the card `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-card.tsx`:
  ```tsx
  "use client";

  import { PekuloProjectionChart, PekuloHypothesisVerdict, PekuloSkeleton, Section } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { useHypothesisProjection } from "../_hooks/use-hypothesis-projection";
  import { useHypothesisGap } from "../_hooks/use-hypothesis-gap";
  import { buildChartModel } from "../_lib/build-chart-model";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  // Story 7-4 (FR-57/58/59) — the Cap-view Hypothèse card. Composes the 7-3
  // projected curve (useHypothesisProjection) with the FR-59 server gap
  // (useHypothesisGap): projected vs compass-required curve, the €/month gap, and
  // the verdict. currentWealth is the LIVE investable wealth threaded from
  // useCapDashboardState (the widget wrapper passes it). The card holds ZERO
  // financial arithmetic — every number is server-derived; buildChartModel only
  // maps offsets → calendar years (AC-9).
  export function HypothesisCard({ currentWealth }: { currentWealth: number }) {
    const projection = useHypothesisProjection(currentWealth);
    const gap = useHypothesisGap(currentWealth);

    if (projection.isLoading || gap.isLoading) {
      return (
        <Section title="Hypothèse" ariaLabel="Hypothèse (chargement)">
          <View role="status" aria-live="polite" $lg={{ flex: 1, minHeight: 0 }}>
            <Text
              color="$colorTertiary"
              fontSize="$caption"
              position="absolute"
              width={1}
              height={1}
              overflow="hidden"
            >
              Chargement de la projection…
            </Text>
            <PekuloSkeleton block height={160} />
          </View>
        </Section>
      );
    }
    // No compass (gap null) or a read error → invite setup rather than draw a
    // misleading chart (AC-5). The widget wrapper already short-circuits the
    // no-cap case; this is the defensive in-card branch.
    if (projection.isError || gap.isError || !projection.data || !gap.data) {
      return (
        <Section title="Hypothèse" ariaLabel="Hypothèse indisponible">
          <Text role="alert" color="$colorTertiary" fontSize="$caption">
            Configure ton cap pour voir ta projection.
          </Text>
        </Section>
      );
    }

    const proj = projection.data;
    const g = gap.data;
    const baseYear = new Date().getFullYear();
    const model = buildChartModel(proj, g, baseYear, currentWealth);
    const ratePct = (proj.annualRate * 100).toFixed(1);

    return (
      <Section
        title="Hypothèse"
        ariaLabel="Hypothèse de projection"
        action={
          <Text color="$colorTertiary" fontSize="$caption">
            {eur0.format(proj.monthlyContribution)} / mois · {ratePct} % / an
          </Text>
        }
      >
        <View flexDirection="column" gap="$4" $lg={{ flex: 1, minHeight: 0 }}>
          <PekuloProjectionChart
            years={model.years}
            actual={model.actual}
            required={model.required}
            nowMarker={model.nowMarker}
            capMarker={model.capMarker}
          />
          <PekuloHypothesisVerdict
            projectedEur={g.projectedFinalEur}
            requiredEur={g.requiredFinalEur}
            targetYear={baseYear + g.horizonYears}
            gapEurPerMonth={g.reachesCap ? undefined : g.gapEurPerMonth}
          />
        </View>
      </Section>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test`
  Expected: typecheck exit 0; `✓ buildChartModel > maps offsets to calendar years and splits the two series (AC-9)` passes, web suite green.
  **Visual verification (CLAUDE.md — frontend = visual verification):** at GREEN, run the app and confirm the card via `mcp__react-grab-mcp__get_element_context` — both curves draw, the cap marker is outlined, the verdict + €/month line read correctly, and the card fills its desktop bento cell without collapsing the mobile column ($lg gate).
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_hypothesis/_lib" "apps/web/src/app/(cap)/dashboard/_hypothesis/_components" && git commit -m "feat(#41): Hypothèse card + chart-model helper (FR-57/58/59)"`

- [ ] **T13 — Plug the live card into the widget registry [AC: AC-7]**
  Edit `apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx`.
  (a) Add the import (after the `MilestonesSection` import):
  ```ts
  import { HypothesisCard } from "../_hypothesis/_components/hypothesis-card";
  ```
  (b) Add a `HypothesisWidget` wrapper (after `NextMilestoneWidget`, before `WIDGET_REGISTRY`) — it threads the live investable wealth from the cap state, exactly like `MilestonesWidget`, keeping the registry `render` a plain element factory:
  ```ts
  // Hypothèse card needs the LIVE investable wealth (currentWealth) to feed both
  // the 7-3 projection read and the FR-59 gap read; a wrapper keeps the registry
  // render a plain element factory (mirrors MilestonesWidget). No cap → the same
  // "en attente du cap" hint the milestones widget shows.
  function HypothesisWidget() {
    const cap = useCapDashboardState();
    if (!cap) {
      return (
        <Section title="Hypothèse" ariaLabel="Hypothèse (en attente du cap)">
          <Text color="$colorTertiary" fontSize="$caption">
            En attente de la configuration du cap.
          </Text>
        </Section>
      );
    }
    return <HypothesisCard currentWealth={cap.currentWealth} />;
  }
  ```
  (c) Replace the `hypothesis` registry entry's `render` (L141) — swap the placeholder for the live widget (keep `id/label/defaultOrder/defaultVisible/colSpan/rowSpan`):
  ```ts
      render: () => <HypothesisWidget />,
  ```
  (Leave the `PlaceholderCard` import in place — the `trajectory` widget still uses it.)
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test`
  Expected: typecheck exit 0; web suite green; the registry test (if it asserts `WIDGET_REGISTRY` ids) is unchanged (ids/spans untouched).
  **Visual verification:** at GREEN, open `/dashboard`, confirm the Hypothèse cell renders the real card and still drag-reorders / hides via the 7-2 edit layer.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx" && git commit -m "feat(#41): render live Hypothèse widget (FR-59, AC-7)"`

- [ ] **T14 — Read-only Hypothèse section in Paramètres [AC: AC-6]**
  Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-settings.tsx`:
  ```tsx
  "use client";

  import { PekuloSettingRow, Section } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";
  import { useHypothesisProjection } from "../_hooks/use-hypothesis-projection";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  // Story 7-4 (FR-57) — READ-ONLY hypothesis inputs in Paramètres. Reads the
  // stored projection inputs (monthlyContribution + assumed annual rate) via the
  // 7-3 projection read; currentWealthEur is irrelevant to these two fields, so
  // it passes 0. Editing is OUT of scope for 7-4 (a later story may add a form
  // using useRecordHypothesisProjection — decision D2).
  export function HypothesisSettings() {
    const projection = useHypothesisProjection(0);
    const monthly = projection.data?.monthlyContribution ?? 0;
    const ratePct = ((projection.data?.annualRate ?? 0) * 100).toFixed(2);
    return (
      <Section title="Hypothèse de projection" ariaLabel="Hypothèse de projection">
        <View flexDirection="column">
          <PekuloSettingRow label="Versement mensuel" value={eur0.format(monthly)} />
          <PekuloSettingRow label="Rendement annuel supposé" value={`${ratePct} %`} />
        </View>
      </Section>
    );
  }
  ```
  Edit `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — add the import and render the section after `<LlmActivityLogLink />`:
  ```tsx
  import { HypothesisSettings } from "../_hypothesis/_components/hypothesis-settings";
  ```
  and inside the inner column `<div>` (after `<LlmActivityLogLink />`):
  ```tsx
          <LlmActivityLogLink />
          <HypothesisSettings />
  ```
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test`
  Expected: typecheck exit 0; web suite green.
  **Visual verification:** at GREEN, open `/dashboard/parametres`, confirm the "Hypothèse de projection" section shows the two read-only rows (no edit affordance).
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-settings.tsx" "apps/web/src/app/(cap)/dashboard/parametres/page.tsx" && git commit -m "feat(#41): read-only Hypothèse section in Paramètres (FR-57)"`

- [ ] **T15 — Doc-sync: architecture Group J FR-59 (DEFERRED to aped-review) [AC: AC-3]**
  The upstream-doc write guard blocks `docs/architecture.md` while a story is in-progress (7-1 T11 / 7-2 / 7-3 T10 precedent, lessons 2026-05-31 / 06-05). The epic-7 cache is already refreshed (this story's prep). **Do NOT edit `architecture.md` during dev** — queue the exact edit here for `aped-review` to apply:
  - **FR-59** (Group J table, `docs/architecture.md:1133`): API module → `dashboard.service.ts#getHypothesisGap(userId, currentWealthEur)` → full `HypothesisGap` (gapEurPerMonth + reachesCap + projectedFinalEur + requiredFinalEur + deltaAtCapEur + horizonYears + linear `requiredPoints`), null when no compass; pure math in `derive/hypothesis-gap.ts` (`computeMonthlyGap` + `computeRequiredCurve`); web surface → `dashboard/_hypothesis/_components/hypothesis-card.tsx` (`PekuloProjectionChart` + `PekuloHypothesisVerdict` with the new `gapEurPerMonth` line) + read-only `hypothesis-settings.tsx` in Paramètres.
  - No new ADR (a derive + one procedure on an existing module + a DS prop — no new subsystem).
  - If any step-04 decision was deviated from during dev, record it in `docs/lessons.md` per the mid-flight-scope rule (lesson 2026-05-31).
  No commit in this task (the deferred edit lands in aped-review; the epic-7 cache was committed with the story prep).

## Dev Notes

- **Architecture.** Domain API on `apps/api` (Elysia + oRPC), web keeps the zapaction bridge (ADR-0009). Component → Hook → Server Action boundary (ADR-0010); hooks consume `useActionQuery`/`useActionMutation` only, never raw `@tanstack/react-query` (R3/R4/R9). Registry-SSOT cache invalidation via `setTagRegistry` (R4/R12) — never a manual `queryClient.invalidateQueries`. Domain types live in `@pekulo/types`, validators in `@pekulo/validators`, kept iso by hand. The dashboard module owns no tables — it is a pure composition layer over narrow read ports (the gap adds a `getHypothesisProjection` port, not a Prisma read). **Deterministic engine owns every number** — the card holds zero financial arithmetic (project AI strategy).
- **Web framework.** `apps/web/AGENTS.md`: "this is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing web components.
- **New cap-view UI stays under `(cap)/dashboard/_hypothesis/`** (the 7-3 slice) — never `(cap)/` directly (lesson 2026-05-27, CapShell mounts at `dashboard/layout.tsx`). No new route is added (the card is a widget; Paramètres already exists).
- **TR-strict palette.** Only the verdict's signed delta is non-grayscale (`$success`/`$danger`); chart strokes use `--chartActual`/`--chartPlan` tokens (already inside `PekuloProjectionChart`). No emerald anywhere else (memory: Trade Republic fidelity).
- **Desktop bento cell-fill** (`flex:1 + minHeight:0`) MUST be `$lg`-gated or it collapses the mobile flat column to 0 px (lesson 2026-06-09, story 7-2) — the card's content `View` follows the `placeholder-card.tsx` pattern.
- **Testing.** api = `bun:test` (`bun --filter='@pekulo/api' run test`); pure derives re-derive the formula inline + an out-of-band oracle, no magic numbers (mirrors `projection-curve.test.ts`). `@pekulo/ui` + `@pekulo/web` = vitest (`bun --filter='@pekulo/ui' run test` / `bun --filter='@pekulo/web' run test`). `--filter` targets the **package name** (`@pekulo/<pkg>`, quoted) with `run <script>`, never the folder (lessons 2026-05-19 / pekulo_bun_filter_gotchas). `tsc` is NOT in the commit gate — run the package `typecheck` before every commit (lesson 2026-06-01).
- **Dependencies.** No new external libs. Reuses `@orpc/contract`, `@orpc/server`, `@zapaction/core`, `@zapaction/query`, `@pekulo/{zod,types,validators,contracts,ui}`. The DS components (`PekuloProjectionChart`/`PekuloHypothesisVerdict`/`PekuloSettingRow`/`PekuloSkeleton`/`Section`) are all already re-exported from `@pekulo/ui` (`packages/ui/src/components/index.ts` L23-43 + `primitives`).

### Scope & decisions (locked at step-04 design gate)

- **FR-59 is server-authoritative (decision D1 — "comparaison complète").** A new `dashboard.service.getHypothesisGap(userId, currentWealthEur)` composes the 7-3 projection (injected as a port — no dashboard↔hypothesis cycle, mirrors 7-3's `currentWealthEur`-as-input decoupling) + the compass `objectif`, and returns the full `HypothesisGap`: `{ gapEurPerMonth, reachesCap, projectedFinalEur, requiredFinalEur, deltaAtCapEur, horizonYears, requiredPoints[] }`. The deterministic engine owns every number (project AI strategy: numbers never live in React). The **projected** curve still comes from the 7-3 `useHypothesisProjection` hook (the chart's `actual[]`); the gap read supplies the **required** ramp + verdict numbers + €/month.
- **FR-57 in Paramètres is READ-ONLY (decision D2).** Two read-only `PekuloSettingRow` (versement mensuel, taux supposé). No edit form in 7-4 — `useRecordHypothesisProjection` (7-3) stays unconsumed until a later editing story. Consequence: versement/taux stay at their stored values (defaults: `monthlyContribution = 0`, `perfEtfAnnuelle = 0.07`).
- **The €/month gap is rendered by EXTENDING the DS verdict (decision D3).** `PekuloHypothesisVerdict` gains an optional `gapEurPerMonth?` prop that renders the "Il manque X € / mois pour atteindre le cap" line (back-compat: the two existing 7-x snapshots are unchanged when the prop is absent).
- **One story, M→L (decision D4).** Vertical FR-59 slice (derive + service + contract + card + paramètres + DS). No new subsystem (≠ 7-2's widget system), so one story is defensible — but the size is honestly L, not the epic's M.
- **The DS components already exist** (ported in 0-10, never consumed): `PekuloProjectionChart` (`years[]/actual[]/required[]` + `nowMarker`/`capMarker`), `PekuloHypothesisVerdict` (`projectedEur/requiredEur/targetYear`), `Section`, `PekuloSettingRow`, `PekuloSkeleton` — all re-exported from `@pekulo/ui`. 7-4 WIRES them with live data; it does not recreate them.
- **The `hypothesis` widget slot already exists** in `WIDGET_REGISTRY` (`DASHBOARD_WIDGET_IDS` already contains `"hypothesis"`); 7-4 only replaces its placeholder `render`.
- **Offset → calendar at render.** The 7-3 derive is clock-free (`point.year` = years from now). 7-4 maps `point.year` → `new Date().getFullYear() + point.year` in the web layer only.

### Existing code at write time (Step-0 quotes)

`apps/api/src/modules/dashboard/dashboard.service.ts` — `DashboardPorts` carries `getCompass: (userId) => Promise<{ objectif: number } | null>` + `computeProgress` (no horizon — horizon comes from the projection). `DashboardService` is exactly `getOverview(userId)`. `getOverview` computes `investableWealthEur = Math.max(0, snapshot.kpi.capitalTotal)` and exposes `compass: { ...computeProgress, currentWealth: investableWealthEur, objectif }`. T4 ADDS the `getHypothesisProjection` port + `getHypothesisGap` method; `getOverview` is untouched.

`apps/api/src/modules/dashboard/dashboard.routes.ts` — `impl = implement(dashboardContract).$context<{ userId; email }>()`; `createDashboardRouter({ service, layoutService })` returns `impl.router({ getOverview, getLayout, saveLayout })`, each guarding via `requireUserId(context.userId)`. T6 adds `getHypothesisGap` in the same shape (with `input`).

`apps/api/src/modules/dashboard/dashboard.module.ts` — `createDashboardModule(deps: DashboardPorts & { prismaService })` destructures `{ prismaService, ...ports }` → `createDashboardService(ports)`. Adding a port to `DashboardPorts` automatically threads it through (T7 supplies it at the runtime call site).

`apps/api/src/bootstrap/runtime-dependencies.ts:259-271` — `createDashboardModule({ prismaService, listAccounts, listHoldings, resolveQuote, getRates, getTotalEquity, getCompass, computeProgress, listRecentActivity })`. `hypothesisModule` is constructed above (`orpcRouter.hypothesis = hypothesisModule.router`) and exposes `.service.getProjection`. T7 adds the `getHypothesisProjection` port here.

`apps/api/src/modules/hypothesis/hypothesis.service.ts` — `getProjection(userId, currentWealthEur): Promise<HypothesisProjection>` reads `{ objectif, horizonYears, perfEtfAnnuelle, monthlyContribution }`, returns `HypothesisProjection { currentWealthEur, monthlyContribution, annualRate, horizonYears, points, finalEur }` (no `objectif` field — the gap reads objectif from `getCompass`).

`packages/contracts/src/dashboard/dashboard.contract.ts` — `dashboardContractV1 = { getOverview, getLayout, saveLayout }`, mounted `/rpc/v1/dashboard`. T5 adds `getHypothesisGap`.

`packages/types/src/hypothesis/hypothesis.types.ts` — exports `HypothesisProjectionPoint { year; eur }` + `HypothesisProjection { currentWealthEur; monthlyContribution; annualRate; horizonYears; points; finalEur }`. T1 appends `HypothesisGap`.

`packages/validators/src/hypothesis/hypothesis.schemas.ts` — `getProjectionInputSchema = z.object({ currentWealthEur: z.number() })` (reused as the gap input), `hypothesisProjectionPointSchema`, `hypothesisProjectionSchema`, helpers `positive`/`ratio`. T2 appends `hypothesisGapSchema`.

`packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.tsx` — `PekuloProjectionChart({ years: number[]; actual: number[]; required: number[]; nowMarker?: { year; value }; capMarker?: { year; value } })`; inline SVG (600×220), strokes `--chartPlan` (dashed required) + `--chartActual` (solid actual), markers via `years.indexOf(year)`. No charting lib.

`packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.tsx` — `PekuloHypothesisVerdict({ projectedEur; requiredEur; targetYear })`; `delta = projectedEur − requiredEur`; renders the reach/miss line + a `$success`/`$danger` "±X € vs cap requis" line. `eur0` formatter in-file. T8 adds the optional `gapEurPerMonth?` + the shortfall line; the two existing snapshots (`renders reaches` / `renders not-reaches`) stay byte-identical because the prop is optional.

`packages/ui/src/components/PekuloHypothesisCard/PekuloHypothesisCard.tsx` — wraps ONLY `PekuloHypothesisVerdict` in a `Section` (NO chart). 7-4 does NOT use this component; the web `hypothesis-card.tsx` composes `Section` + `PekuloProjectionChart` + `PekuloHypothesisVerdict` itself.

`apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx:135-142` — the `hypothesis` entry: `{ id: "hypothesis", label: "Hypothèse", defaultOrder: 5, defaultVisible: true, colSpan: 12, rowSpan: 1, render: () => <PlaceholderCard variant="hypothesis" ownerStory="6-x" /> }`. T13 replaces only the `render`. `useCapDashboardState` is already imported (used by `MilestonesWidget`/`NextMilestoneWidget`).

`apps/web/src/app/(cap)/dashboard/_compass/_components/compass-section.tsx:216-230` — `useCapDashboardState()` returns `{ currentWealth, horizonAbsoluteYearMax, compassObjectif, compassHorizonYears }` or `null` (when setup ≠ complete / error). `currentWealth` is the LIVE investable wealth from the overview (real-estate excluded). T13's `HypothesisWidget` reads `cap.currentWealth`.

`apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx:119-132` — the `$lg`-gated bento cell-fill pattern (`$lg={{ flex: 1, justifyContent: "space-between", minHeight: 0 }}`) the card's content View mirrors.

`apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-projection.ts` — `useHypothesisProjection(currentWealthEur?)` → `useActionQuery(getHypothesisProjection, { input: { currentWealthEur ?? 0 }, queryKey: hypothesesKeys.projection(currentWealthEur ?? 0), readPolicy: "read-only", enabled: finite, staleTime: 30_000 })`. Returns the 7-3 `HypothesisProjectionDto` (`points`, `finalEur`, `monthlyContribution`, `annualRate`, `horizonYears`). The card's chart `actual[]` + the Paramètres read both consume it.

`apps/web/src/app/(cap)/dashboard/_actions/dashboard-actions.ts` — `getDashboardOverview = defineAction<void, DashboardOverview, ActionContext>({ ..., handler: async () => { await ensureRequestContext(); return dashboardClient.getOverview(); } })`. T10's gap action mirrors this (read-only, `dashboardClient.getHypothesisGap(input)`).

`apps/web/src/lib/zapaction/keys.ts:156-159` — `dashboardKeys = createFeatureKeys("dashboard", { overview })` (read-only — no `dashboardTags`). `setTagRegistry` (L172-278): hypotheses edges at L174-175 → `[hypothesesKeys.current(), ["hypotheses","projection"]]`; compass edges at L181-198 end with `dashboardKeys.overview()`. T9 adds `hypothesisGap(currentWealth)` + appends `["dashboard","hypothesisGap"]` to those 4 edges.

`apps/web/src/lib/orpc/modules.ts` — `dashboardClient: ContractRouterClient<typeof dashboardContract>` (L83) + `hypothesisClient` (L57) already exist; `dashboardClient.getHypothesisGap` is available once T5 lands.

`apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — RSC shell rendering `<CompassEditForm/><CompassHistoryPanel/><LlmOptInToggle/><LlmActivityLogLink/>` in a `maxWidth:720` flex column. T14 appends `<HypothesisSettings/>`.

`apps/api/src/modules/dashboard/dashboard.integration.test.ts` — `buildApp()` constructs `createDashboardModule({ ...stub ports..., getCompass: async () => ({ objectif: 800_000 }), prismaService: { client: {} } })`; oRPC RPCHandler envelopes payloads as `{ json: <payload> }`, POST to `/rpc/v1/dashboard/<proc>` with `Authorization: Bearer <token>`. T6 adds the `getHypothesisProjection` stub + the gap round-trip case.

### File decision template (per file)

- `packages/types/src/hypothesis/hypothesis.types.ts` *(M)* — domain type contracts. In: none. Out: `HypothesisGap`.
- `packages/validators/src/hypothesis/hypothesis.schemas.ts` *(M)* — Zod SSOT. In: `@pekulo/zod`. Out: `hypothesisGapSchema` + `HypothesisGapDto`.
- `apps/api/src/common/derive/hypothesis-gap.ts` (+`.test.ts`) *(C)* — pure FR-59 math. In: `@pekulo/types`, `HypothesisError`. Out: `computeMonthlyGap`, `computeRequiredCurve`.
- `apps/api/src/modules/dashboard/dashboard.service.ts` (+`.test.ts`) *(M)* — composition layer. In: derives, `@pekulo/types`. Out: `getHypothesisProjection` port + `getHypothesisGap`.
- `packages/contracts/src/dashboard/dashboard.contract.ts` *(M)* — oRPC contract. Out: `getHypothesisGap` procedure.
- `apps/api/src/modules/dashboard/dashboard.routes.ts` (+`.integration.test.ts`) *(M)* — oRPC handler. Out: `getHypothesisGap` handler.
- `apps/api/src/bootstrap/runtime-dependencies.ts` *(M)* — wiring. Out: `getHypothesisProjection` port bound to `hypothesisModule.service.getProjection`.
- `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.tsx` (+snapshot/a11y) *(M)* — DS verdict. Out: optional `gapEurPerMonth` + €/month line.
- `apps/web/src/lib/zapaction/keys.ts` *(M)* — cache keys/registry. Out: `dashboardKeys.hypothesisGap` + 4 edges.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-gap-actions.ts` *(C)* — thin read SA. Out: `getHypothesisGap`.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-gap.ts` *(C)* — read hook. Out: `useHypothesisGap`.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_lib/build-chart-model.ts` (+`.test.ts`) *(C)* — pure offset→calendar mapping. Out: `buildChartModel`.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-card.tsx` *(C)* — the Cap-view card. In: hooks + DS + helper. Out: `HypothesisCard`.
- `apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx` *(M)* — widget SSOT. Out: live `HypothesisWidget` render.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-settings.tsx` *(C)* — read-only Paramètres section. Out: `HypothesisSettings`.
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` *(M)* — Paramètres shell. Out: renders `<HypothesisSettings/>`.
- `docs/architecture.md` *(M — deferred to aped-review)* — Group J FR-59 driver-line sync.

## File List

- `packages/types/src/hypothesis/hypothesis.types.ts` *(M)*
- `packages/validators/src/hypothesis/hypothesis.schemas.ts` *(M)*
- `apps/api/src/common/derive/hypothesis-gap.ts` *(C)*
- `apps/api/src/common/derive/hypothesis-gap.test.ts` *(C)*
- `apps/api/src/modules/dashboard/dashboard.service.ts` *(M)*
- `apps/api/src/modules/dashboard/dashboard.service.test.ts` *(M)*
- `packages/contracts/src/dashboard/dashboard.contract.ts` *(M)*
- `apps/api/src/modules/dashboard/dashboard.routes.ts` *(M)*
- `apps/api/src/modules/dashboard/dashboard.integration.test.ts` *(M)*
- `apps/api/src/bootstrap/runtime-dependencies.ts` *(M)*
- `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.tsx` *(M)*
- `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.snapshot.test.tsx` *(M)*
- `packages/ui/src/components/PekuloHypothesisVerdict/PekuloHypothesisVerdict.a11y.test.tsx` *(M)*
- `apps/web/src/lib/zapaction/keys.ts` *(M)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-gap-actions.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-gap.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_lib/build-chart-model.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_lib/build-chart-model.test.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-card.tsx` *(C)*
- `apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx` *(M)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_components/hypothesis-settings.tsx` *(C)*
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` *(M)*
- `docs/architecture.md` *(M — deferred to aped-review)*
- `docs/epics-context/epic-7-context.md` *(already refreshed in story prep)*

## Dev Agent Record

_Populated by aped-dev during implementation (Summary / Files changed / Deviations / Test output)._

- **Agent model:** _TBD by aped-dev_
- **Mode:** _TBD by aped-dev_
- **Started:** _TBD_ · **Dev complete:** _TBD_

### Summary

### Files changed

### Deviations

### Test output

## Review Record

_Populated by aped-review._

### Findings

### Verification
