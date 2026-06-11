# Story: 7-3-hypothesis-domain — Hypothesis projection: record inputs + pure projection-curve derivation

**Epic:** Epic 7 — Dashboard & projection
**Status:** ready-for-dev
**Ticket:** [#40](https://github.com/yabafre/pekulo/issues/40)
**Branch:** feature/40-7-3-hypothesis-domain

## User Story

**As a** Pekulo user, **I want** to record a projection hypothesis (capital cible + horizon + versement mensuel + taux annuel supposé) and get a year-by-year projected-wealth curve, **so that** I can gut-check whether my plan reaches my cap.

## Acceptance Criteria

- **AC-1 (FR-58)** — **Given** `currentWealthEur = 60_000`, `monthlyContribution = 1_000`, `annualRate = 0.05`, `horizonYears = 30`, **When** `computeProjectionCurve` runs, **Then** for every `k ∈ 0..30` `points[k].eur` equals the monthly-compounded closed-form annuity `60_000·(1+i)^(12k) + 1_000·((1+i)^(12k) − 1)/i` with `i = 0.05/12` (within 1e-6 relative), `points` has length 31, `points[0].eur === 60_000`, and `finalEur === points[30].eur`.
- **AC-2 (FR-58, zero-rate edge)** — **Given** `annualRate = 0` (others as AC-1), **When** the curve computes, **Then** `points[k].eur === 60_000 + 1_000·12·k` exactly (no division by zero).
- **AC-3 (FR-58, signed start)** — **Given** `currentWealthEur = -5_000` (underwater net wealth), `monthlyContribution = 500`, `annualRate = 0.04`, `horizonYears = 10`, **When** the curve computes, **Then** it does NOT throw, `points[0].eur === -5_000`, and the series follows the annuity formula from the negative start.
- **AC-4 (FR-58, guards)** — **Given** any of `currentWealthEur` non-finite, `monthlyContribution < 0` or non-finite, `annualRate` outside `[0,1]` or non-finite, or `horizonYears` not an integer in `[1,50]`, **When** the curve computes, **Then** it throws `HypothesisError("HYPOTHESIS_INVALID_INPUT", …)`.
- **AC-5 (FR-57, record)** — **Given** an authenticated user, **When** `hypothesis.recordProjection({ objectif, horizonYears, monthlyContribution, perfEtfAnnuelle })` runs, **Then** the four columns are upserted under that user's row (`where: { userId }`, ADR-0013), the other budget columns are untouched, and the persisted projection inputs are returned. The existing brownfield `get`/`save` behaviour is unchanged.
- **AC-6 (FR-58, getProjection)** — **Given** a stored hypothesis row and a `currentWealthEur` input, **When** `hypothesis.getProjection({ currentWealthEur })` runs, **Then** it reads `{ objectif, horizonYears, perfEtfAnnuelle, monthlyContribution }` from the row (coerced via `.toNumber()`), feeds `{ currentWealthEur, monthlyContribution, annualRate: perfEtfAnnuelle, horizonYears }` to `computeProjectionCurve`, and returns the `HypothesisProjection`. With no row, it falls back to `defaultHypotheses` values + `monthlyContribution = 0`.
- **AC-7 (web)** — **Given** the `recordHypothesisProjection` server action, **When** it returns, **Then** it yields a `{ ok: true } | { ok: false; code; message }` envelope with **`output:` omitted** on `defineAction` (lesson 2026-05-20, [BLOCKER]) and its hook calls `useActionMutation(action, { invalidateWithTags: [hypothesesTags.current()] })`; **When** `getHypothesisProjection` runs, **Then** it mirrors `getDashboardOverview` (read-only, no envelope).

## Tasks

- [ ] **T1 — Add `monthlyContribution` column to `hypotheses` + hand-written migration [AC: AC-5, AC-6]**
  Edit `apps/api/prisma/schema/hypothesis.prisma` — add the column directly after `objectif` (line 35), before `createdAt`:
  ```prisma
  objectif            Decimal   @default(100000) @db.Decimal
  monthlyContribution Decimal?  @default(0) @map("monthly_contribution") @db.Decimal
  createdAt           DateTime? @default(now()) @map("created_at") @db.Timestamptz
  ```
  Create the migration folder `apps/api/prisma/migrations/20260611120000_add_hypothesis_monthly_contribution/migration.sql` with:
  ```sql
  -- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
  -- against the Supabase pooler). Apply via
  -- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
  -- Story 7-3 (FR-57): the monthly contribution input of the projection
  -- hypothesis. Nullable + default 0 so existing rows and getProjection get a
  -- sane value. No RLS change — adds a column, not a table; db:rls-audit count
  -- unchanged. Hypothesis is registered `null` in id-prefixes.config.ts (a
  -- column add needs no registration change).

  ALTER TABLE "hypotheses" ADD COLUMN IF NOT EXISTS "monthly_contribution" DECIMAL DEFAULT 0;
  ```
  Then run the inseparable generate→typecheck→deploy step (lessons 2026-06-01 / 2026-06-05):
  Run: `bun --filter='@pekulo/api' run prisma:format && bun --filter='@pekulo/api' run prisma:generate && bun --filter='@pekulo/api' run typecheck`
  Then: `bun --filter='@pekulo/api' run prisma:migrate:deploy`
  Expected: `prisma:format` rewrites the schema idempotently; `prisma:generate` succeeds; `typecheck` exits 0; `migrate:deploy` prints `1 migration found` / `Applying migration 20260611120000_add_hypothesis_monthly_contribution` and exits 0 (or "No pending migrations" if already applied — idempotent).
  Commit: `git add apps/api/prisma/schema/hypothesis.prisma apps/api/prisma/migrations/20260611120000_add_hypothesis_monthly_contribution && git commit -m "feat(#40): add monthly_contribution column to hypotheses (FR-57)"`

- [ ] **T2 — Add `HypothesisProjection` + `HypothesisProjectionPoint` to `@pekulo/types` [AC: AC-1, AC-6]**
  Append to the domain-types file in `packages/types/src/` (the file that already exports `CompassCurve` / `HypothesisProjection` placeholder — locate it with `grep -rn "CompassCurve" packages/types/src`; add there to keep the barrel export intact):
  ```ts
  /**
   * Year-by-year projected-wealth curve (story 7-3, FR-58). Offset-indexed and
   * clock-free: `year` is the number of whole years from now (0 = today,
   * horizonYears = the final year). The web/UI layer maps the offset to a
   * calendar year (e.g. 2026 + year) at render time — the derive never reads a
   * clock. `eur` is the projected total wealth at the end of that year.
   */
  export interface HypothesisProjectionPoint {
    year: number;
    eur: number;
  }

  /**
   * Output of `computeProjectionCurve` (apps/api/src/common/derive/projection-curve.ts).
   * `points` has length `horizonYears + 1`; `points[0].eur === currentWealthEur`;
   * `finalEur === points[horizonYears].eur`. Iso with `hypothesisProjectionSchema`
   * in @pekulo/validators (kept in lock-step by hand, like CompassCurve).
   */
  export interface HypothesisProjection {
    currentWealthEur: number;
    monthlyContribution: number;
    annualRate: number;
    horizonYears: number;
    points: HypothesisProjectionPoint[];
    finalEur: number;
  }
  ```
  Run: `bun --filter='@pekulo/types' run typecheck`
  Expected: exit 0, no type errors.
  Commit: `git add packages/types/src && git commit -m "feat(#40): add HypothesisProjection domain type (FR-58)"`

- [ ] **T3 — Add projection Zod schemas to `@pekulo/validators` [AC: AC-1, AC-5, AC-6]**
  Append to `packages/validators/src/hypothesis/hypothesis.schemas.ts` (after `defaultHypotheses`, reusing the file's `ratio`/`positive` style):
  ```ts
  // ── Story 7-3 (FR-57/FR-58) — projection hypothesis ──────────────────────
  // Narrow projection-input write surface, separate from the 25-field brownfield
  // budget `hypothesesSchema` above. The four fields map to columns on the same
  // `hypotheses` row: objectif (capital cible), horizonYears (horizon),
  // monthlyContribution (versement mensuel — new column, story 7-3 T1),
  // perfEtfAnnuelle (taux annuel supposé).
  export const recordProjectionSchema = z.object({
    objectif: positive,
    horizonYears: z.number().int().min(1).max(50),
    monthlyContribution: positive,
    perfEtfAnnuelle: ratio,
  });
  export type RecordProjectionInput = z.infer<typeof recordProjectionSchema>;

  // Input to the getProjection read. currentWealthEur is supplied by the caller
  // (the 7-1 dashboard overview total) — NOT clamped: net wealth can be negative
  // (underwater real-estate, 7-1 lesson 2026-06-04), and the annuity formula is
  // defined for negative P. Only finiteness is enforced (the derive guards it).
  export const getProjectionInputSchema = z.object({
    currentWealthEur: z.number(),
  });
  export type GetProjectionInput = z.infer<typeof getProjectionInputSchema>;

  // Iso with @pekulo/types#HypothesisProjection (kept in lock-step by hand).
  export const hypothesisProjectionPointSchema = z.object({
    year: z.number().int().min(0),
    eur: z.number(),
  });
  export const hypothesisProjectionSchema = z.object({
    currentWealthEur: z.number(),
    monthlyContribution: positive,
    annualRate: ratio,
    horizonYears: z.number().int().min(1).max(50),
    points: z.array(hypothesisProjectionPointSchema),
    finalEur: z.number(),
  });
  export type HypothesisProjectionDto = z.infer<typeof hypothesisProjectionSchema>;
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/validators/src/hypothesis && git commit -m "feat(#40): add projection Zod schemas (FR-57/FR-58)"`

- [ ] **T4 — Register `HYPOTHESIS_INVALID_INPUT` error code + `HypothesisError` class [AC: AC-4]**
  (a) Edit `apps/api/src/common/errors/pekulo-error.ts` — add `"HYPOTHESIS_INVALID_INPUT"` to BOTH the `PekuloErrorCode` union AND the `PEKULO_ERROR_CODES` Set, alphabetically between `"HOLDING_NOT_FOUND"` and `"INTERNAL"` (the file comment mandates updating both in the same commit). In the union:
  ```ts
    | "HOLDING_NOT_FOUND"
    | "HYPOTHESIS_INVALID_INPUT"
    | "INTERNAL"
  ```
  In the `PEKULO_ERROR_CODES` Set:
  ```ts
    "HOLDING_NOT_FOUND",
    "HYPOTHESIS_INVALID_INPUT",
    "INTERNAL",
  ```
  (b) Edit `apps/api/src/platform/http/error-mapper.ts` — add the status mapping inside `ORPC_HTTP_STATUS_BY_CODE` (the `Record<PekuloErrorCode, number>` type forces this to compile). Place it after the `HOLDING_CLOSED: 409,` cluster's comment block, e.g. right before `MORTGAGE_ALREADY_ATTACHED`:
  ```ts
    // Hypothesis projection (story 7-3, FR-57/FR-58): malformed projection
    // inputs (non-finite wealth, negative contribution, rate ∉ [0,1], horizon
    // ∉ [1,50] int) surface as 400 — defense-in-depth behind the Zod contract
    // boundary which already rejects bad wire input.
    HYPOTHESIS_INVALID_INPUT: 400,
  ```
  (c) Create `apps/api/src/modules/hypothesis/hypothesis.errors.ts`:
  ```ts
  // Typed error class for the hypothesis module. Extends PekuloError so the
  // Elysia error mapper translates it to a 400 (HYPOTHESIS_INVALID_INPUT is
  // registered in ORPC_HTTP_STATUS_BY_CODE). Mirrors compass.errors.ts.

  import { PekuloError } from "../../common/errors";

  export type HypothesisErrorCode = "HYPOTHESIS_INVALID_INPUT";

  export class HypothesisError extends PekuloError {
    override readonly name = "HypothesisError";

    // Narrows `code` from PekuloErrorCode to HypothesisErrorCode (TS-level).
    // oxlint-disable-next-line no-useless-constructor
    constructor(code: HypothesisErrorCode, message: string, options?: { cause?: unknown }) {
      super(code, message, options);
    }
  }
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0 (the `Record<PekuloErrorCode, number>` compiles only because both union + map carry the new code).
  Commit: `git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts apps/api/src/modules/hypothesis/hypothesis.errors.ts && git commit -m "feat(#40): register HYPOTHESIS_INVALID_INPUT error code (FR-58)"`

- [ ] **T5 — RED→GREEN: pure `projection-curve.ts` derive + tests [AC: AC-1, AC-2, AC-3, AC-4]**
  Create `apps/api/src/common/derive/projection-curve.ts`:
  ```ts
  // Pure helper for the hypothesis projection curve (FR-58, story 7-3). Consumes
  // the projection inputs and returns a year-by-year wealth curve. No I/O, no
  // clock reads — the curve is OFFSET-indexed (point.year = years from now), so
  // the caller (web/dashboard, story 7-4) maps offsets to calendar years.
  //
  // Compounding (story 7-3 §"Scope & decisions", locked for AC-1/AC-2):
  //   i           = annualRate / 12                      (monthly rate)
  //   FV(m)       = P·(1+i)^m + C·((1+i)^m − 1)/i         (ordinary monthly annuity)
  //   point[k]    = { year: k, eur: FV(12·k) }  for k = 0..horizonYears
  //   edge i = 0  → eur = P + C·(12·k)                    (linear, no /0)
  // where P = currentWealthEur, C = monthlyContribution.
  //
  // currentWealthEur is NOT clamped: net wealth can be negative (underwater
  // real-estate, 7-1 lesson 2026-06-04) and the annuity is defined for P < 0.
  // Only finiteness/range guards throw (mirrors compass-curve.ts defense-in-depth).

  import type { HypothesisProjection } from "@pekulo/types";
  import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

  export interface ComputeProjectionCurveInput {
    currentWealthEur: number;
    monthlyContribution: number;
    annualRate: number;
    horizonYears: number;
  }

  const MONTHS_PER_YEAR = 12;

  export function computeProjectionCurve(
    input: ComputeProjectionCurveInput,
  ): HypothesisProjection {
    const { currentWealthEur, monthlyContribution, annualRate, horizonYears } = input;

    if (!Number.isFinite(currentWealthEur)) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "currentWealthEur must be a finite number",
      );
    }
    if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "monthlyContribution must be a finite number >= 0",
      );
    }
    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "annualRate must be a finite number in [0, 1]",
      );
    }
    if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 50) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "horizonYears must be an integer in [1, 50]",
      );
    }

    const i = annualRate / MONTHS_PER_YEAR;
    const points = Array.from({ length: horizonYears + 1 }, (_unused, k) => {
      const m = MONTHS_PER_YEAR * k;
      const eur =
        i === 0
          ? currentWealthEur + monthlyContribution * m
          : currentWealthEur * (1 + i) ** m + monthlyContribution * (((1 + i) ** m - 1) / i);
      return { year: k, eur };
    });

    return {
      currentWealthEur,
      monthlyContribution,
      annualRate,
      horizonYears,
      points,
      finalEur: points[horizonYears]!.eur,
    };
  }
  ```
  Create `apps/api/src/common/derive/projection-curve.test.ts` (re-derives the formula inline, mirroring compass-curve.test.ts — no magic numbers):
  ```ts
  // Pure-helper unit tests for computeProjectionCurve. No I/O, no clock reads.
  // Re-implements the monthly-annuity formula inline for AC-1/AC-3 assertions
  // (per story 7-3 §"Compounding") so the test compares helper output against an
  // in-test re-derivation using the same constants as the helper.

  import { describe, expect, test } from "bun:test";
  import { computeProjectionCurve } from "./projection-curve";
  import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

  // FV(12k) = P·(1+i)^(12k) + C·((1+i)^(12k) − 1)/i, i = rate/12. i = 0 → linear.
  function fvAtYear(P: number, C: number, rate: number, k: number): number {
    const i = rate / 12;
    const m = 12 * k;
    if (i === 0) return P + C * m;
    return P * (1 + i) ** m + C * (((1 + i) ** m - 1) / i);
  }

  describe("computeProjectionCurve", () => {
    // AC-1 (verbatim from story 7-3): 60_000 / 1_000 / 5% / 30y, monthly annuity.
    test("AC-1: year-by-year series matches the monthly closed-form annuity", () => {
      const out = computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 30,
      });
      expect(out.points).toHaveLength(31);
      expect(out.points[0]!.eur).toBe(60_000);
      for (let k = 0; k <= 30; k++) {
        expect(out.points[k]!.year).toBe(k);
        const expected = fvAtYear(60_000, 1_000, 0.05, k);
        // Relative tolerance 1e-6 — float compounding over 360 months.
        expect(out.points[k]!.eur).toBeCloseTo(expected, 4);
      }
      expect(out.finalEur).toBe(out.points[30]!.eur);
    });

    // AC-2: zero-rate → exact linear accumulation, no division by zero.
    test("AC-2: annualRate = 0 produces an exact linear series", () => {
      const out = computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0,
        horizonYears: 30,
      });
      for (let k = 0; k <= 30; k++) {
        expect(out.points[k]!.eur).toBe(60_000 + 1_000 * 12 * k);
      }
    });

    // AC-3: negative current wealth (underwater) does NOT throw; starts negative.
    test("AC-3: negative currentWealthEur passes through (no clamp)", () => {
      const out = computeProjectionCurve({
        currentWealthEur: -5_000,
        monthlyContribution: 500,
        annualRate: 0.04,
        horizonYears: 10,
      });
      expect(out.points[0]!.eur).toBe(-5_000);
      for (let k = 0; k <= 10; k++) {
        expect(out.points[k]!.eur).toBeCloseTo(fvAtYear(-5_000, 500, 0.04, k), 4);
      }
    });

    // AC-1 determinism — same inputs, deeply-equal outputs, no clock/random.
    test("deterministic: same inputs produce deeply-equal outputs", () => {
      const args = {
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 30,
      };
      expect(computeProjectionCurve(args)).toEqual(computeProjectionCurve(args));
    });

    // AC-4 guards.
    test("guard: non-finite currentWealthEur throws HypothesisError", () => {
      expect(() =>
        computeProjectionCurve({
          currentWealthEur: Number.NaN,
          monthlyContribution: 1_000,
          annualRate: 0.05,
          horizonYears: 30,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: negative monthlyContribution throws HypothesisError", () => {
      expect(() =>
        computeProjectionCurve({
          currentWealthEur: 60_000,
          monthlyContribution: -1,
          annualRate: 0.05,
          horizonYears: 30,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: annualRate > 1 throws HypothesisError", () => {
      expect(() =>
        computeProjectionCurve({
          currentWealthEur: 60_000,
          monthlyContribution: 1_000,
          annualRate: 1.5,
          horizonYears: 30,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: non-integer horizonYears throws HypothesisError", () => {
      expect(() =>
        computeProjectionCurve({
          currentWealthEur: 60_000,
          monthlyContribution: 1_000,
          annualRate: 0.05,
          horizonYears: 30.5,
        }),
      ).toThrow(HypothesisError);
    });

    test("guard: horizonYears out of [1,50] throws HypothesisError", () => {
      expect(() =>
        computeProjectionCurve({
          currentWealthEur: 60_000,
          monthlyContribution: 1_000,
          annualRate: 0.05,
          horizonYears: 51,
        }),
      ).toThrow(HypothesisError);
    });
  });
  ```
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the full api `bun test` suite is green; the new file reports `✓ computeProjectionCurve > AC-1: year-by-year series matches the monthly closed-form annuity` and the other 8 cases pass, exit 0.
  Commit: `git add apps/api/src/common/derive/projection-curve.ts apps/api/src/common/derive/projection-curve.test.ts && git commit -m "feat(#40): pure projection-curve derive + tests (FR-58)"`

- [ ] **T6 — RED→GREEN: `hypothesis.service` recordProjection + getProjection + tests [AC: AC-5, AC-6]**
  Edit `apps/api/src/modules/hypothesis/hypothesis.service.ts`. (a) Add imports at the top alongside the existing ones:
  ```ts
  import type { HypothesisProjection } from "@pekulo/types";
  import { type RecordProjectionInput, defaultHypotheses, type Hypotheses } from "@pekulo/validators";
  import { computeProjectionCurve } from "../../common/derive/projection-curve";
  ```
  (Merge the `@pekulo/validators` import with the existing one — do not duplicate the import line.) (b) Extend the `HypothesisService` interface (add the two methods, keep `get`/`save`):
  ```ts
  export interface HypothesisService {
    get(userId: string): Promise<Hypotheses>;
    save(userId: string, input: Hypotheses): Promise<Hypotheses>;
    recordProjection(userId: string, input: RecordProjectionInput): Promise<RecordProjectionInput>;
    getProjection(userId: string, currentWealthEur: number): Promise<HypothesisProjection>;
  }
  ```
  (c) Add the two methods inside the object returned by `createHypothesisService` (after `save`, reusing the in-file `decimalToNumber` helper — it is already the `.toNumber()` pattern, lesson 2026-05-04):
  ```ts
      async recordProjection(userId, input) {
        // Upsert only the four projection columns — the budget columns are left
        // untouched (ADR-0013: explicit where:{userId} even under the service role).
        const writeData = {
          objectif: input.objectif,
          horizonYears: input.horizonYears,
          monthlyContribution: input.monthlyContribution,
          perfEtfAnnuelle: input.perfEtfAnnuelle,
        };
        await deps.client.hypothesis.upsert({
          where: { userId },
          update: writeData,
          create: { userId, ...writeData } as unknown as Parameters<
            typeof deps.client.hypothesis.upsert
          >[0]["create"],
        });
        return input;
      },
      async getProjection(userId, currentWealthEur) {
        const row = await deps.client.hypothesis.findUnique({
          where: { userId },
          select: {
            objectif: true,
            horizonYears: true,
            perfEtfAnnuelle: true,
            monthlyContribution: true,
          },
        });
        const objectif = decimalToNumber(row?.objectif, defaultHypotheses.objectif);
        const horizonYears = decimalToNumber(row?.horizonYears, defaultHypotheses.horizonYears);
        const annualRate = decimalToNumber(row?.perfEtfAnnuelle, defaultHypotheses.perfEtfAnnuelle);
        // monthlyContribution is the new nullable column (defaults to 0 when the
        // row predates story 7-3 or has never recorded a projection).
        const monthlyContribution = decimalToNumber(
          (row as { monthlyContribution?: unknown } | null)?.monthlyContribution,
          0,
        );
        // objectif is carried for downstream 7-4 (gap vs compass) but is not a
        // projection-curve input; the curve needs current wealth + contribution
        // + rate + horizon only.
        void objectif;
        return computeProjectionCurve({
          currentWealthEur,
          monthlyContribution,
          annualRate,
          horizonYears,
        });
      },
  ```
  Add to `apps/api/src/modules/hypothesis/hypothesis.service.test.ts` a new `describe` block (extend the `fakeClient` type to allow `findUnique` to return the projection columns; the existing `fakeClient` already mocks `findUnique`/`upsert`). Append inside the file:
  ```ts
  describe("hypothesis.service — projection (story 7-3)", () => {
    test("recordProjection upserts only the four projection columns", async () => {
      const { client, mocks } = fakeClient({ upsertResult: {} });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const input = { objectif: 800_000, horizonYears: 30, monthlyContribution: 1_000, perfEtfAnnuelle: 0.05 };
      const result = await service.recordProjection("user-uuid", input);
      expect(result).toEqual(input);
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
      const call = mocks.upsert.mock.calls[0]?.[0];
      expect(call?.where).toEqual({ userId: "user-uuid" });
      expect(call?.update).toEqual(input);
      expect(call?.create.userId).toBe("user-uuid");
      expect(call?.create.monthlyContribution).toBe(1_000);
      // Budget columns are NOT in the write payload — only the 4 projection fields.
      expect(Object.keys(call?.update ?? {}).sort()).toEqual(
        ["horizonYears", "monthlyContribution", "objectif", "perfEtfAnnuelle"].sort(),
      );
    });

    test("getProjection reads Decimal columns and returns the curve", async () => {
      const row = {
        objectif: new Prisma.Decimal(800_000),
        horizonYears: 30,
        perfEtfAnnuelle: new Prisma.Decimal("0.05"),
        monthlyContribution: new Prisma.Decimal(1_000),
      };
      const { client } = fakeClient({ findUniqueResult: row });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const out = await service.getProjection("user-uuid", 60_000);
      expect(out.horizonYears).toBe(30);
      expect(out.monthlyContribution).toBe(1_000);
      expect(out.annualRate).toBe(0.05);
      expect(out.points).toHaveLength(31);
      expect(out.points[0]!.eur).toBe(60_000);
    });

    test("getProjection falls back to defaults + 0 contribution when row missing", async () => {
      const { client } = fakeClient({ findUniqueResult: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createHypothesisService({ client: client as any });
      const out = await service.getProjection("user-uuid", 1_000);
      expect(out.monthlyContribution).toBe(0);
      expect(out.annualRate).toBe(defaultHypotheses.perfEtfAnnuelle);
      expect(out.horizonYears).toBe(defaultHypotheses.horizonYears);
      expect(out.points[0]!.eur).toBe(1_000);
    });
  });
  ```
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the 3 new `hypothesis.service — projection` cases pass alongside the existing 4, exit 0.
  Commit: `git add apps/api/src/modules/hypothesis/hypothesis.service.ts apps/api/src/modules/hypothesis/hypothesis.service.test.ts && git commit -m "feat(#40): hypothesis recordProjection + getProjection (FR-57/FR-58)"`

- [ ] **T7 — Extend `hypothesisContract` with recordProjection + getProjection [AC: AC-5, AC-6]**
  Edit `packages/contracts/src/hypothesis/hypothesis.contract.ts` — add the two procedures (keep `get`/`save`):
  ```ts
  import { oc } from "@orpc/contract";
  import {
    hypothesesSchema,
    recordProjectionSchema,
    getProjectionInputSchema,
    hypothesisProjectionSchema,
  } from "@pekulo/validators";

  export const hypothesisContractV1 = {
    get: oc.output(hypothesesSchema),
    save: oc.input(hypothesesSchema).output(hypothesesSchema),
    // Story 7-3 (FR-57) — record the projection inputs (4 fields).
    recordProjection: oc.input(recordProjectionSchema).output(recordProjectionSchema),
    // Story 7-3 (FR-58) — project the wealth curve. currentWealthEur is supplied
    // by the caller (the 7-1 dashboard overview total).
    getProjection: oc.input(getProjectionInputSchema).output(hypothesisProjectionSchema),
  } as const;

  export const hypothesisContract = hypothesisContractV1;
  export const hypothesisContractMeta = {
    moduleKey: "hypothesis",
    mountPath: "/rpc/v1/hypothesis",
    version: "v1",
  } as const;
  ```
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: exit 0.
  Commit: `git add packages/contracts/src/hypothesis/hypothesis.contract.ts && git commit -m "feat(#40): hypothesis contract recordProjection + getProjection (FR-57/FR-58)"`

- [ ] **T8 — RED→GREEN: route handlers + integration test [AC: AC-5, AC-6]**
  Edit `apps/api/src/modules/hypothesis/hypothesis.routes.ts` — add the two handlers inside `impl.router({ ... })` (keep `get`/`save`):
  ```ts
      recordProjection: impl.recordProjection.handler(async ({ context, input }) => {
        if (!context.userId) {
          throw new PekuloError("UNAUTHORIZED", "user context missing");
        }
        return deps.service.recordProjection(context.userId, input);
      }),
      getProjection: impl.getProjection.handler(async ({ context, input }) => {
        if (!context.userId) {
          throw new PekuloError("UNAUTHORIZED", "user context missing");
        }
        return deps.service.getProjection(context.userId, input.currentWealthEur);
      }),
  ```
  No `hypothesis.module.ts` change is needed — `getProjection` reads `currentWealthEur` from its input, so the module factory keeps its `{ prismaService }` signature and the `orpcRouter.hypothesis` mount in `runtime-dependencies.ts` is unchanged. Extend `apps/api/src/modules/hypothesis/hypothesis.integration.test.ts` with a case asserting `recordProjection` then `getProjection` round-trips through the router (mirror the existing integration cases in that file for the harness shape — read it first and copy its router-construction + context-injection pattern).
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the hypothesis integration suite passes including the new recordProjection→getProjection round-trip, exit 0.
  Commit: `git add apps/api/src/modules/hypothesis/hypothesis.routes.ts apps/api/src/modules/hypothesis/hypothesis.integration.test.ts && git commit -m "feat(#40): hypothesis projection route handlers + integration test (FR-57/FR-58)"`

- [ ] **T9 — Web thin action/hook wrappers + keys [AC: AC-7]**
  (a) Edit `apps/web/src/lib/zapaction/keys.ts` — add a `projection` key factory to `hypothesesKeys` and extend the registry edge so a recorded projection invalidates it. Replace the `hypothesesKeys` block (L12-14) with:
  ```ts
  export const hypothesesKeys = createFeatureKeys("hypotheses", {
    current: () => ["current"] as const,
    // Story 7-3 — the projection curve read. currentWealth is part of the key
    // (like milestonesKeys.statuses) so a wealth change refetches naturally.
    projection: (currentWealth: number) => ["projection", currentWealth] as const,
  });
  ```
  And in the `setTagRegistry({ ... })` block, replace the two hypotheses edges (L171-172) with:
  ```ts
    [hypothesesTags.all()]: [hypothesesKeys.current(), ["hypotheses", "projection"]],
    [hypothesesTags.current()]: [hypothesesKeys.current(), ["hypotheses", "projection"]],
  ```
  (the bare `["hypotheses","projection"]` prefix invalidates every `projection(currentWealth)` entry — TanStack prefix-match).
  (b) Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-actions.ts`:
  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import { z } from "@pekulo/zod";
  import {
    recordProjectionSchema,
    getProjectionInputSchema,
    type RecordProjectionInput,
    type HypothesisProjectionDto,
  } from "@pekulo/validators";
  import { hypothesisClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 7-3 — thin oRPC delegators (ADR-0010, mirror 7-1 dashboard-actions).
  // The write returns a { ok } envelope so the typed error code survives Next's
  // prod Error sanitisation; `output:` is OMITTED (lesson 2026-05-20 [BLOCKER] —
  // a success-only output schema would reject the { ok: false } branch).
  type RecordResult =
    | { ok: true; projection: RecordProjectionInput }
    | { ok: false; code: string; message: string };

  export const recordHypothesisProjection = defineAction<
    RecordProjectionInput,
    RecordResult,
    ActionContext
  >({
    name: "recordHypothesisProjection",
    input: recordProjectionSchema,
    tags: [], // server-side revalidateTag is not used; client invalidates via the hook
    handler: async (input) => {
      await ensureRequestContext();
      try {
        const projection = await hypothesisClient.recordProjection(input);
        return { ok: true, projection };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "INTERNAL";
        const message = err instanceof Error ? err.message : "record failed";
        return { ok: false, code, message };
      }
    },
  });

  // Read-only (mirror getDashboardOverview): no envelope, direct return.
  export const getHypothesisProjection = defineAction<
    z.infer<typeof getProjectionInputSchema>,
    HypothesisProjectionDto,
    ActionContext
  >({
    name: "getHypothesisProjection",
    input: getProjectionInputSchema,
    handler: async (input) => {
      await ensureRequestContext();
      return hypothesisClient.getProjection(input);
    },
  });
  ```
  (c) Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-projection.ts`:
  ```ts
  "use client";

  import { useActionQuery } from "@zapaction/query";
  import { hypothesesKeys } from "@/lib/zapaction/keys";
  import { getHypothesisProjection } from "../_actions/hypothesis-actions";

  // Story 7-3 — projection read hook (FR-58). currentWealthEur comes from the
  // 7-1 dashboard overview (story 7-4 wires the two together). Gated on a finite
  // wealth so it doesn't fire before the overview resolves (load-time-gate
  // pattern, lesson 2026-06-03). read-only per R4.
  export function useHypothesisProjection(currentWealthEur: number | undefined) {
    return useActionQuery(getHypothesisProjection, {
      input: { currentWealthEur: currentWealthEur ?? 0 },
      queryKey: hypothesesKeys.projection(currentWealthEur ?? 0),
      readPolicy: "read-only",
      enabled: typeof currentWealthEur === "number" && Number.isFinite(currentWealthEur),
      staleTime: 30_000,
    });
  }
  ```
  (d) Create `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-record-hypothesis-projection.ts`:
  ```ts
  "use client";

  import { useActionMutation } from "@zapaction/query";
  import { hypothesesTags } from "@/lib/zapaction/keys";
  import { recordHypothesisProjection } from "../_actions/hypothesis-actions";

  // Story 7-3 — record-projection mutation (FR-57). Registry-SSOT invalidation
  // (R4): invalidateWithTags drives the refetch of hypothesesKeys.current() AND
  // every hypothesesKeys.projection(*) via the edge in keys.ts. No optimistic
  // onMutate (opt-in only, lesson 2026-05-25).
  export function useRecordHypothesisProjection() {
    return useActionMutation(recordHypothesisProjection, {
      invalidateWithTags: [hypothesesTags.current()],
    });
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0 (the `hypothesisClient.recordProjection`/`.getProjection` calls type-check against the contract from T7).
  Commit: `git add apps/web/src/lib/zapaction/keys.ts "apps/web/src/app/(cap)/dashboard/_hypothesis" && git commit -m "feat(#40): web hypothesis projection action + hooks (FR-57/FR-58)"`

- [ ] **T10 — Doc-sync [AC: AC-5]**
  Update the architecture driver lines so the realized FR-57/FR-58 surface matches the code (lesson 2026-05-31): in `docs/architecture.md`, the Group J table rows for FR-57/FR-58 already name `hypothesis.service.ts#record` and `projection-curve.ts` — refresh FR-57 to `#recordProjection` + note the new `monthly_contribution` column on `hypotheses`, and FR-58 to note `getProjection(currentWealthEur)` returns `HypothesisProjection` (offset-indexed, monthly compounding). Add no new ADR (no new subsystem — a column + two procedures on an existing module). The epic-7 context cache is already recompiled (this story's prep). If any step-04 decision was deviated from during dev, record it in `docs/lessons.md` per the mid-flight-scope rule.
  Run: `git diff --stat docs/architecture.md`
  Expected: only the two Group J driver lines changed.
  Commit: `git add docs/architecture.md docs/epics-context/epic-7-context.md && git commit -m "docs(#40): sync architecture Group J + epic-7 cache for hypothesis projection"`

## Dev Notes

- **Commit prefix:** `feat(#40): …` / `docs(#40): …` (github-issues, see `.aped/aped-dev/references/ticket-git-workflow.md`).
- **Architecture:** Domain API on `apps/api` (Elysia + oRPC), web keeps the zapaction bridge (ADR-0009). Component → Hook → Server Action boundary (ADR-0010). Hooks consume `useActionQuery`/`useActionMutation` only — never raw `@tanstack/react-query` (R3/R4/R9). Registry-SSOT cache invalidation via `setTagRegistry` (R4/R12). Decimal → number via `.toNumber()` (lesson 2026-05-04, names 7-3). Domain types live in `@pekulo/types`, never a module `*.types.ts` (lesson 2026-05-09). Elysia type is invariant — infer, never annotate the concrete generic (lesson 2026-05-04, names 7-3).
- **Testing:** `bun:test` for apps/api (the existing `hypothesis.service.test.ts` / `compass-curve.test.ts` are the idiom — `mock(...)` fakes, real `Prisma.Decimal` fixtures, inline formula re-derivation, no magic numbers). Targeted: the package test script is `bun test`; run the whole api suite via `bun --filter='@pekulo/api' run test`. `tsc` is NOT in the commit gate — run `typecheck` manually before every commit; after the T1 schema change, `prisma:generate && typecheck` is one inseparable step (lesson 2026-06-01).
- **Dependencies:** no new external libs. Reuses `@orpc/contract`, `@orpc/server`, `@zapaction/core`, `@zapaction/query`, `@pekulo/{zod,types,validators,contracts}`.

### Scope & decisions (locked at step-04 design gate)

- **Backend-pure story, mirrors 7-1.** Ships the derive + oRPC procedures + thin web action/hook wrappers. **NO UI component.** The Hypothèse card, `ProjectionChart`, `HypothesisVerdict`, the FR-59 gap, and the read-only parametres `SettingRow` are **all 7-4**.
- **`monthlyContribution` is a new column** on the brownfield `hypotheses` table (decision: not derived from the budget fields, not a runtime-only param). The other three FR-57 inputs reuse existing columns: `objectif` (capital cible), `horizonYears` (horizon), `perfEtfAnnuelle` (taux annuel supposé).
- **`getProjection(currentWealthEur)`** is a server procedure that takes current wealth as an **input** (the caller passes it from the 7-1 dashboard overview) — the hypothesis module stays decoupled from the dashboard aggregator (no cycle).
- **Compounding = monthly, sampled annually.** `i = annualRate / 12`; `FV(m) = P·(1+i)^m + monthlyContribution·((1+i)^m − 1)/i`, sampled at `m = 12·k` for `k = 0..horizonYears`. Edge `annualRate = 0` → linear `P + monthlyContribution·m`.
- **Curve is offset-indexed** (`point.year` = 0..horizonYears, years from now) so the derive is pure + clock-free. 7-4 maps the offset to a calendar year (2026 → 2055) at render. No clock infra is created.
- `currentWealthEur` is **not** clamped to ≥ 0 — net wealth can be negative (underwater real-estate; 7-1 lesson 2026-06-04). The annuity formula is well-defined for negative `P`; only `Number.isFinite` is guarded. This contrasts deliberately with 7-1's `computeProgress` clamp (that helper has a `≥ 0` precondition; this one does not).

### Existing code at write time (Step-0 quotes)

`apps/api/prisma/schema/hypothesis.prisma:4-40` — brownfield `Hypothesis`, `@@map("hypotheses")`, PK native `gen_random_uuid()` (registered `Hypothesis: null` in `id-prefixes.config.ts:35` → skips the prefixed-ids extension; **a column add needs no registration change**), `userId @unique` (one row/user). Carries `objectif` (default 100000), `horizonYears` (SmallInt, default 5), `perfEtfAnnuelle` (Decimal, default 0.07) — the three reused FR-57 inputs. **No `monthlyContribution` column** → T1 adds it.

`apps/api/src/modules/hypothesis/hypothesis.service.ts` (current): `HypothesisService` has exactly `get(userId)` + `save(userId, input)`; `createHypothesisService({ client })` returns those two; an in-file `decimalToNumber(value, fallback)` (identical to `common/derive/decimal-to-number.ts`) does the `.toNumber()` coercion; `save` upserts via `upsert({ where:{userId}, update: writeData, create: { userId, ...writeData } as unknown as … })`. T6 ADDS `recordProjection`/`getProjection` and leaves `get`/`save` + the in-file helper untouched.

`packages/contracts/src/hypothesis/hypothesis.contract.ts` (current): `hypothesisContractV1 = { get: oc.output(hypothesesSchema), save: oc.input(hypothesesSchema).output(hypothesesSchema) }`. T7 adds `recordProjection` + `getProjection`.

`apps/api/src/modules/hypothesis/hypothesis.routes.ts` (current): `impl = implement(hypothesisContract).$context<{ userId: string; email: string | null }>()`; router has `get` + `save`, each guarding `if (!context.userId) throw new PekuloError("UNAUTHORIZED", …)`. T8 adds the two projection handlers in the same shape.

`apps/api/src/common/errors/pekulo-error.ts:16-58` — `PekuloErrorCode` union (alphabetical) + the `PEKULO_ERROR_CODES` Set at L60-103; the file comment mandates updating BOTH the union AND `ORPC_HTTP_STATUS_BY_CODE` in the same commit for any new code (review F9). T4 inserts `"HYPOTHESIS_INVALID_INPUT"` between `HOLDING_NOT_FOUND` and `INTERNAL` in both.

`apps/api/src/platform/http/error-mapper.ts:39-157` — `ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number>` (compile-time guard: every code must appear). T4 adds `HYPOTHESIS_INVALID_INPUT: 400`.

`apps/web/src/lib/zapaction/keys.ts:12-17` — `hypothesesKeys.current()` + `hypothesesTags.{all,current}()` already exist; registry edges at L171-172 map both tags to `[hypothesesKeys.current()]`. `hypothesisClient` exists in `apps/web/src/lib/orpc/modules.ts:58`. T9 adds `hypothesesKeys.projection(currentWealth)` and extends the edges to also invalidate the `["hypotheses","projection"]` prefix.

### File decision template (per file)

- `apps/api/prisma/schema/hypothesis.prisma` *(M)* — the user's hypothesis row. In: Prisma schema. Out: `Hypothesis` model + `monthly_contribution` column.
- `apps/api/prisma/migrations/20260611120000_add_hypothesis_monthly_contribution/migration.sql` *(C)* — apply the column to the DB. In: none. Out: `ALTER TABLE` SQL.
- `packages/types/src/<domain-types>.ts` *(M)* — domain type contracts. In: none. Out: `HypothesisProjection` + `HypothesisProjectionPoint`.
- `packages/validators/src/hypothesis/hypothesis.schemas.ts` *(M)* — Zod SSOT for hypothesis I/O. In: `@pekulo/zod`. Out: `recordProjectionSchema`, `getProjectionInputSchema`, `hypothesisProjectionSchema` + types.
- `apps/api/src/common/errors/pekulo-error.ts` *(M)* — error-code union. Out: `HYPOTHESIS_INVALID_INPUT` registered.
- `apps/api/src/platform/http/error-mapper.ts` *(M)* — code→HTTP status. Out: `HYPOTHESIS_INVALID_INPUT: 400`.
- `apps/api/src/modules/hypothesis/hypothesis.errors.ts` *(C)* — typed module error. In: `PekuloError`. Out: `HypothesisError`.
- `apps/api/src/common/derive/projection-curve.ts` (+`.test.ts`) *(C)* — pure FR-58 curve. In: `@pekulo/types`, `HypothesisError`. Out: `computeProjectionCurve`.
- `apps/api/src/modules/hypothesis/hypothesis.service.ts` (+`.test.ts`) *(M)* — module service. In: Prisma client, derive, validators. Out: `recordProjection`, `getProjection`.
- `packages/contracts/src/hypothesis/hypothesis.contract.ts` *(M)* — oRPC contract. Out: `recordProjection`, `getProjection` procedures.
- `apps/api/src/modules/hypothesis/hypothesis.routes.ts` (+`.integration.test.ts`) *(M)* — oRPC handlers. Out: two new handlers.
- `apps/web/src/lib/zapaction/keys.ts` *(M)* — cache keys/tags/registry. Out: `hypothesesKeys.projection` + edges.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-actions.ts` *(C)* — thin SAs. Out: `recordHypothesisProjection` (envelope), `getHypothesisProjection`.
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-projection.ts` + `use-record-hypothesis-projection.ts` *(C)* — read + write hooks.
- `docs/architecture.md` *(M)* — Group J driver-line sync.

## File List

- `apps/api/prisma/schema/hypothesis.prisma` *(M)*
- `apps/api/prisma/migrations/20260611120000_add_hypothesis_monthly_contribution/migration.sql` *(C)*
- `packages/types/src/*` (HypothesisProjection) *(M)*
- `packages/validators/src/hypothesis/hypothesis.schemas.ts` *(M)*
- `apps/api/src/common/errors/pekulo-error.ts` *(M)*
- `apps/api/src/platform/http/error-mapper.ts` *(M)*
- `apps/api/src/modules/hypothesis/hypothesis.errors.ts` *(C)*
- `apps/api/src/common/derive/projection-curve.ts` *(C)*
- `apps/api/src/common/derive/projection-curve.test.ts` *(C)*
- `apps/api/src/modules/hypothesis/hypothesis.service.ts` *(M)*
- `apps/api/src/modules/hypothesis/hypothesis.service.test.ts` *(M)*
- `packages/contracts/src/hypothesis/hypothesis.contract.ts` *(M)*
- `apps/api/src/modules/hypothesis/hypothesis.routes.ts` *(M)*
- `apps/api/src/modules/hypothesis/hypothesis.integration.test.ts` *(M)*
- `apps/web/src/lib/zapaction/keys.ts` *(M)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_actions/hypothesis-actions.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-hypothesis-projection.ts` *(C)*
- `apps/web/src/app/(cap)/dashboard/_hypothesis/_hooks/use-record-hypothesis-projection.ts` *(C)*
- `docs/architecture.md` *(M)*
- `docs/epics-context/epic-7-context.md` *(already recompiled in story prep)*

## Dev Agent Record

_Populated by aped-dev during implementation (Summary / Files changed / Deviations / Test output)._

### Summary

### Files changed

### Deviations

### Test output
