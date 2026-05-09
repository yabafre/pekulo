# Story: 1-3-compass-curve — Compass-progress curve from MonthlyTracking history

**Epic:** Epic 1 — Compass & milestones (V1 differentiator)
**Status:** done
**Ticket:** [#15](https://github.com/yabafre/pekulo/issues/15)
**Branch:** `feature/15-1-3-compass-curve`
**Commit prefix:** `feat(#15): …`
**Depends on:** 1-1-compass-domain (done), 1-2-milestones-domain (done)

## User Story

**As a** Pekulo user, **I want** a curve plotting my projected vs actual wealth from the compass start date to today, **so that** the trajectory is visible at a glance on the Cap dashboard.

## Acceptance Criteria

- **AC-1 (≥3 snapshots, aligned series):** **Given** user A has a compass `(objectif=800_000, horizonYears=25)` whose earliest `compass_history.valuedOn` is `2024-01-15T00:00:00Z`, AND 3 `MonthlyTracking` rows for user A — `(year=2024, monthNum=12, capitalTotal=10_000)`, `(year=2025, monthNum=6, capitalTotal=20_000)`, `(year=2026, monthNum=4, capitalTotal=35_000)` — **When** `compassService.getCompassCurve("user-A")` runs at injected `today=2026-05-09T12:00:00Z`, **Then** the response is ordered-by-date-ascending and shape-matches `{ startedAt: 2024-01-15T00:00:00Z, actual: [{at: 2024-12-28T00:00:00Z, eur: 10_000}, {at: 2025-06-28T00:00:00Z, eur: 20_000}, {at: 2026-04-28T00:00:00Z, eur: 35_000}], plan: [point@2024-01-15 (eur=0), point@2024-12-28 (eur=computeLinearPlan(at)), point@2025-06-28 (eur=computeLinearPlan(at)), point@2026-04-28 (eur=computeLinearPlan(at)), point@2026-05-09 (today), point@2049-01-15 (startDate+25y, eur=800_000)] }`. Every plan `eur` value is finite and matches `objectif × clamp((at - startDate) / horizonInDays, 0, 1)` to within 1e-6. `actual[].at` and the matching `plan[].at` for the 3 snapshot dates are deeply equal (`getTime()` equality).
- **AC-2 (zero snapshots, plan-only):** **Given** user A has a compass `(objectif=800_000, horizonYears=25)` with earliest `valuedOn = 2024-01-15T00:00:00Z` AND 0 `MonthlyTracking` rows, **When** `getCompassCurve("user-A")` runs at injected `today=2026-05-09T12:00:00Z`, **Then** the response is `{ startedAt: 2024-01-15T00:00:00Z, actual: [], plan: [{at: 2024-01-15T00:00:00Z, eur: 0}, {at: 2026-05-09T12:00:00Z, eur: <linearPlanEur>}, {at: 2049-01-15T00:00:00Z, eur: 800_000}] }`. `<linearPlanEur>` equals `800_000 × ((2026-05-09 - 2024-01-15) / (2049-01-15 - 2024-01-15))` to within 1e-6.
- **AC-3 (no compass row):** **Given** user A has NO `Hypothesis` row, **When** `getCompassCurve("user-A")` runs, **Then** it rejects with `CompassError("COMPASS_NOT_FOUND", "compass not set")`. The Elysia error-mapper translates that to HTTP 404 (`ORPC_HTTP_STATUS_BY_CODE.COMPASS_NOT_FOUND === 404`).
- **AC-4 (compass row but no compass_history — invariant violation):** **Given** user A has a `Hypothesis` row for the compass but `compass_history` returns `null` for the start date (impossible by 1-1's atomic upsert; defensive guard), **When** `getCompassCurve("user-A")` runs, **Then** it rejects with `CompassError("TRANSACTION_FAILED", "compass history missing — invariant violation")` → HTTP 500.
- **AC-5 (cross-user isolation):** **Given** user A has compass + 3 snapshots AND user B has compass `(objectif=200_000, horizonYears=10)` + 0 snapshots, **When** `getCompassCurve("user-B")` runs, **Then** the response uses user B's compass and start date AND `actual === []` AND no row from user A leaks. The `where: { userId }` clause on `findCompassStartDate` and on the wealth provider's `findMany` is the defense-in-depth proof; RLS at the SQL layer is the second line.
- **AC-6 (lint guard active on the new repository method):** **Given** the new `findCompassStartDate` method is in place, **When** `oxlint apps/api/src/modules/compass/compass.repository.ts` runs, **Then** it exits 0 — `compassHistory.findFirst({ where: { userId }, … })` carries the `userId` clause. The `prismaIdentifier: ["prisma","tx"]` override from `.oxlintrc.json` (story 1-1) is inherited; no `.oxlintrc.json` edit needed.
- **AC-7 (oRPC happy path):** **Given** a valid Supabase HS256 JWT for user A whose stub service returns `{ startedAt: 2024-01-15T00:00:00Z, actual: [], plan: [{at: 2024-01-15T00:00:00Z, eur: 0}, {at: 2026-05-09T12:00:00Z, eur: 74438.36}, {at: 2049-01-15T00:00:00Z, eur: 800_000}] }`, **When** the integration test calls `POST /rpc/v1/compass/getCompassCurve` with empty body wrapped as `{ json: {} }`, **Then** the response is HTTP 200 with body `{ json: { startedAt: <ISO>, actual: [], plan: [<3 points>] } }` — Zod-validated against `compassCurveSchema` on the egress side.
- **AC-8 (oRPC unauth):** **Given** no JWT (or a mangled `Bearer` header), **When** `POST /rpc/v1/compass/getCompassCurve` is called, **Then** the response is HTTP 401 within 100 ms with body `{ error: { code: "UNAUTHORIZED", requestId: <uuid> } }`. Reuses the existing JWT verifier mounting; same wire shape as story 1-1's AC-7 unauth.
- **AC-9 (Decimal coercion at the wealth provider boundary):** **Given** a `MonthlyTracking` row with `capitalTotal = new Prisma.Decimal("1500000000000.99")` (above `Number.MAX_SAFE_INTEGER` × 0.166 — beyond JS safe-integer territory but representable as Decimal), **When** the wealth provider reads it, **Then** the value is coerced via `decimalToNumber(row.capitalTotal, 0)` (the helper extracted in story 1-1, located at `apps/api/src/common/derive/decimal-to-number.ts`) and surfaces as a finite JS number; `Number(decimal)` is NOT used. The unit test asserts `Number.isFinite` and the `.toString()` of the coerced number ≠ `"1500000000000.99"` (precision is naturally lost when leaving Decimal — but the value must be finite, not `NaN` or `Infinity`).
- **AC-10 (`computeCompassCurve` purity / determinism):** **Given** the same `(compass, startDate, today, snapshots)` inputs, **When** `computeCompassCurve` is called twice in succession, **Then** the two outputs are deeply equal (`expect(out1).toEqual(out2)`). The helper does NOT call `new Date()`, `Date.now()`, `Math.random`, or any I/O; `today` is an injected parameter. NaN/Infinity in `compass.objectif`, `snapshots[].totalEur`, or a `today < startDate` clock skew throws `CompassError("INVALID_TARGET", …)` / `CompassError("INVALID_WEALTH", …)` — same code-set as story 1-1's `computeProgress` (no new code introduced).

## Tasks

- [x] T1 — Add `compassCurvePointSchema` + `compassCurveSchema` to `packages/validators/src/compass.ts`; barrel re-export from `packages/validators/src/index.ts` [AC: AC-1, AC-2, AC-7]
- [x] T2 — Re-export `CompassCurve` + `CompassCurvePoint` types from `packages/types/src/index.ts`; declare `WealthHistoryProvider` + `WealthSnapshot` interfaces in the same file [AC: AC-1, AC-2, AC-9]
- [x] T3 — Add the `getCompassCurve` procedure to `packages/contracts/src/compass.contract.ts` (`oc.output(compassCurveSchema)`, no input) [AC: AC-7]
- [x] T4 — Implement `apps/api/src/common/derive/compass-curve.ts` (pure helper) + `compass-curve.test.ts` (≥ 6 tests covering AC-1, AC-2, AC-10, NaN/Infinity guards, today-before-startDate clamp, dedup of identical adjacent dates) [AC: AC-1, AC-2, AC-10]
- [x] T5 — Add `findCompassStartDate(userId): Promise<Date | null>` to `apps/api/src/modules/compass/compass.repository.ts`; cover in `compass.repository.test.ts` (existing-user happy path + zero-row null + cross-user isolation) [AC: AC-5, AC-6]
- [x] T6 — Add `getCompassCurve(userId)` to `apps/api/src/modules/compass/compass.service.ts` orchestrating compass read → start-date read → wealth-provider read → pure helper. Update factory signature to accept `wealthHistoryProvider`. Cover in `compass.service.test.ts` (AC-1 happy path, AC-2 empty snapshots, AC-3 no compass row, AC-4 missing start date, AC-9 Decimal-style fake input) [AC: AC-1, AC-2, AC-3, AC-4, AC-9]
- [x] T7 — Add `getCompassCurve` oRPC handler to `apps/api/src/modules/compass/compass.routes.ts` (mirrors `getCompass`: `context.userId?.trim()` guard → `service.getCompassCurve`) [AC: AC-7, AC-8]
- [x] T8 — Update `apps/api/src/modules/compass/compass.module.ts` factory to accept + forward `wealthHistoryProvider`; extend `compass.module.test.ts` with a wired AC-1 + AC-2 flow on a fake Prisma client + fake wealth provider [AC: AC-1, AC-2, AC-7]
- [x] T9 — Wire the Prisma-backed `WealthHistoryProvider` in `apps/api/src/bootstrap/runtime-dependencies.ts` (closure over `prismaService.client.monthlyTracking.findMany`); pass it into `createCompassModule` [AC: AC-1, AC-9]
- [x] T10 — Extend `apps/api/src/modules/compass/compass.integration.test.ts` with AC-7 happy + AC-8 unauth cases hitting `POST /rpc/v1/compass/getCompassCurve`. Stub the service surface so AC-7 returns a deterministic curve. Run the full module suite; assert green [AC: AC-7, AC-8]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009)** — every change stays inside `apps/api/src/modules/compass/`. The factory return shape is unchanged at the interface level (`{ service, router }`) — only `createCompassModule` and `createCompassService` gain a new `wealthHistoryProvider` parameter. **L8 (Elysia 1.4 invariant — explicitly listed in epic-1-context.md for the compass module)** still applies: never annotate `Elysia` or the router type; let TS infer via `ReturnType<typeof createCompassRouter>` (already in place at `compass.module.ts:15`).
- **Hard layering (ADR-0010, lint-enforced)** — Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. This story is API-only (UI work is owned by `1-4-compass-ui-cap`). The chain ends at Elysia; the service stays free of Prisma imports; the repository's new `findCompassStartDate` is the single new Prisma touchpoint inside the compass module. The wealth-history adapter (T9) is wired in `runtime-dependencies.ts`, NOT inside the module — same pattern as story 1-2's `CompassReader` so the compass module stays decoupled from `MonthlyTracking`.
- **Audit history pattern (ADR-0001)** — `compass_history` is append-only with INSERT + SELECT-only RLS. `findCompassStartDate` does an `orderBy: { valuedOn: 'asc' }` + `take: 1` read; SELECT policy already grants this. No migration / no policy change.
- **RLS defense in depth (ADR-0013)** — every Prisma query carries explicit `where: { userId }`. `findCompassStartDate` follows the rule. The wealth-history adapter (T9) on `monthlyTracking.findMany` does the same. Story 0-12's lint rule (`pekulo/no-prisma-query-without-user-id`, `prismaIdentifier: ["prisma","tx"]`) blocks any omission; the override from `.oxlintrc.json` is inherited — **no `.oxlintrc.json` edit needed** for this story.
- **Decimal coercion (L24, story 1-1 explicit)** — `MonthlyTracking.capitalTotal` is `Decimal`. Use `decimalToNumber(row.capitalTotal, 0)` from `apps/api/src/common/derive/decimal-to-number.ts` (extracted in story 1-1). DO NOT inline `Number(decimal)`. DO NOT duplicate the helper.
- **No new migration** — `monthly_tracking` and `compass_history` already exist (brownfield baseline + story 1-1). No ADR amendment.
- **No new `PekuloErrorCode`** — `COMPASS_NOT_FOUND` (HTTP 404), `TRANSACTION_FAILED` (HTTP 500), `INVALID_TARGET` (HTTP 400), `INVALID_WEALTH` (HTTP 400) are all registered in story 1-1's union and `ORPC_HTTP_STATUS_BY_CODE`. AC-3, AC-4, AC-10 reuse them. No edit to `apps/api/src/common/errors/pekulo-error.ts` or `apps/api/src/platform/http/error-mapper.ts`.
- **Naming (Phase 3, architecture L370)** — module key `compass`; mount path `/rpc/v1/compass`; new procedure `getCompassCurve`; pure helper `apps/api/src/common/derive/compass-curve.ts`.
- **oRPC handler shape** — mirror `compass.routes.ts:26-30` (the existing `getCompass` handler). Use `impl.getCompassCurve.handler(async ({ context }) => { … })`. Verify `context.userId?.trim()` and throw `new PekuloError("UNAUTHORIZED", "user context missing")` when absent.

### Plan formula (locked for AC-1, AC-2, AC-10)

The pure helper computes:

- **`horizonInDays = compass.horizonYears × 365.25`** (ISO-julian year approximation; consistent with frontend display libraries and avoids leap-year drift across the 25-year span).
- **`endDate = new Date(startDate.getTime() + horizonInDays × 86_400_000)`**.
- **`planEur(at) = compass.objectif × clamp((at - startDate) / (endDate - startDate), 0, 1)`**.
- **Plan sample dates** (deduped, sorted ascending):
  - `startDate` (always — `eur = 0`).
  - `today` (always — `eur = planEur(today)`).
  - `endDate` (always — `eur = compass.objectif`).
  - Each `snapshots[i].at` (only if AC-1 path — keeps `actual[]` and `plan[]` aligned at the same dates).
- **Dedup rule**: two adjacent points whose `at.getTime()` are equal → keep the first occurrence (insertion order: `startDate` < snapshots < `today` < `endDate`). This handles the edge case where a snapshot date coincides with `today` or `startDate`.
- **`actual[]`** is `snapshots.map(s => ({ at: s.at, eur: s.totalEur }))`, sorted ascending by `at.getTime()`.
- **Guards** (defense in depth, identical to `compute-progress.ts`):
  - `!Number.isFinite(compass.objectif) || compass.objectif <= 0` → throw `CompassError("INVALID_TARGET", …)`.
  - `compass.horizonYears <= 0` → throw `CompassError("INVALID_TARGET", …)`.
  - any `snapshots[i].totalEur` not finite or `< 0` → throw `CompassError("INVALID_WEALTH", …)`.
  - `today.getTime() < startDate.getTime()` → clamp `planEur(today) = 0` (do NOT throw — clock skew is recoverable; the curve degenerates to a flat zero-line at `today`).

### AC-1 fixture math (linear-plan derivation — for the test author)

For AC-1 with `compass=(objectif=800_000, horizonYears=25)`, `startDate=2024-01-15T00:00:00Z`, `today=2026-05-09T12:00:00Z`:

- `horizonInDays = 25 × 365.25 = 9131.25`.
- `endDate = 2024-01-15T00:00:00Z + 9131.25 × 86_400_000 ms = 2049-01-15T06:00:00Z` (close enough to `2049-01-15T00:00:00Z` — the test asserts `eur` to within 1e-6 and date with `Math.abs(t1 - t2) < 1000` ms tolerance on the end anchor).
- For an arbitrary snapshot at `at = 2024-12-28T00:00:00Z` (≈ 348 days post-start):
  - `(at - startDate) / (endDate - startDate) = 348 / 9131.25 ≈ 0.03811`.
  - `planEur ≈ 800_000 × 0.03811 ≈ 30_491` (the test computes the exact value via the same formula — no hardcoded magic).
- The test asserts equality of plan formula output to the helper's own output for each snapshot date — i.e., the test re-implements the formula with the same constants as the helper, then compares. **Do NOT hardcode `30_491.xx` in the test** — the rounding makes it brittle.

### Existing code at write time (Step-0 quote — verbatim, do not paraphrase)

`apps/api/src/modules/compass/compass.service.ts` (current):

```ts
// Domain service for the compass module. Owns:
//   - updateCompass(userId, input): delegates to repository (atomic write)
//   - getCompass(userId): returns the user's compass or null
//   - getSetupState(userId): 'incomplete' if no compass row OR no milestone
//   - computeProgress(input): pure wrapper around derive/compass-progress.ts

import type { Compass, CompassSetupState, MilestonePresenceProbe } from "@pekulo/types";
import type { UpdateCompassInput } from "@pekulo/validators";
import {
  computeProgress,
  type ComputeProgressInput,
  type ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import type { CompassRepository } from "./compass.repository";

export interface CompassService {
  updateCompass(userId: string, input: UpdateCompassInput): Promise<Compass>;
  getCompass(userId: string): Promise<Compass | null>;
  getSetupState(userId: string): Promise<CompassSetupState>;
  computeProgress(input: ComputeProgressInput): ComputeProgressOutput;
}

export function createCompassService(deps: {
  repository: CompassRepository;
  milestonePresenceProbe: MilestonePresenceProbe;
}): CompassService {
  return {
    async updateCompass(userId, input) {
      return deps.repository.upsertCompassWithHistory(userId, input);
    },

    async getCompass(userId) {
      return deps.repository.findCompass(userId);
    },

    async getSetupState(userId) {
      const compass = await deps.repository.findCompass(userId);
      if (!compass) return "incomplete";
      const hasMilestone = await deps.milestonePresenceProbe.hasAny(userId);
      return hasMilestone ? "complete" : "incomplete";
    },

    computeProgress(input) {
      return computeProgress(input);
    },
  };
}
```

This story extends the `CompassService` interface with `getCompassCurve(userId): Promise<CompassCurve>`, adds `wealthHistoryProvider: WealthHistoryProvider` to the `createCompassService` deps, and adds the `getCompassCurve` implementation alongside the existing methods. The four existing methods are NOT modified.

`apps/api/src/modules/compass/compass.repository.ts` (current — abridged to the contract surface):

```ts
export interface CompassRepository {
  findCompass(userId: string): Promise<Compass | null>;
  upsertCompassWithHistory(
    userId: string,
    input: { objectif: number; horizonYears: number },
  ): Promise<Compass>;
  listHistory(userId: string, opts?: { limit?: number }): Promise<CompassHistoryEntry[]>;
}
```

This story extends the interface with `findCompassStartDate(userId: string): Promise<Date | null>`. Implementation reads `compassHistory.findFirst({ where: { userId }, orderBy: { valuedOn: 'asc' }, select: { valuedOn: true } })` and returns `row?.valuedOn ?? null`.

`apps/api/src/modules/compass/compass.module.ts` (current):

```ts
export interface CompassModule {
  service: CompassService;
  router: ReturnType<typeof createCompassRouter>;
}

export function createCompassModule(deps: {
  prismaService: PrismaService;
  milestonePresenceProbe: MilestonePresenceProbe;
}): CompassModule {
  const repository = createCompassRepository({ client: deps.prismaService.client });
  const service = createCompassService({
    repository,
    milestonePresenceProbe: deps.milestonePresenceProbe,
  });
  const router = createCompassRouter({ service });
  return { service, router };
}
```

This story adds `wealthHistoryProvider: WealthHistoryProvider` to the deps object and forwards it to `createCompassService`. The export shape is unchanged.

`apps/api/src/modules/compass/compass.routes.ts` (current — relevant block):

```ts
const impl = implement(compassContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createCompassRouter(deps: { service: CompassService }) {
  return impl.router({
    updateCompass: impl.updateCompass.handler(async ({ context, input }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.updateCompass(context.userId, input);
    }),
    getCompass: impl.getCompass.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.getCompass(context.userId);
    }),
    getSetupState: impl.getSetupState.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      const state = await deps.service.getSetupState(context.userId);
      return { state };
    }),
  });
}
```

This story adds a fourth handler `getCompassCurve` — same context-guard shape, no input, returns `service.getCompassCurve(context.userId)` (which already returns a `CompassCurve`).

`packages/contracts/src/compass.contract.ts` (current):

```ts
import { oc } from "@orpc/contract";
import {
  compassSchema,
  compassSetupStateOutputSchema,
  updateCompassInputSchema,
} from "@pekulo/validators";

export const compassContractV1 = {
  updateCompass: oc.input(updateCompassInputSchema).output(compassSchema),
  getCompass: oc.output(compassSchema.nullable()),
  getSetupState: oc.output(compassSetupStateOutputSchema),
} as const;
```

This story adds `getCompassCurve: oc.output(compassCurveSchema)` (no input) to `compassContractV1`. Imports are extended to include `compassCurveSchema` from `@pekulo/validators`.

`packages/validators/src/compass.ts` (current ends at L63):

```ts
export const compassHorizonAbsoluteYearSchema = z
  .number()
  .int()
  .min(currentYear + 1)
  .max(currentYear + MAX_HORIZON_YEARS);
```

This story appends `compassCurvePointSchema` (`{ at: z.date(), eur: z.number() }`) and `compassCurveSchema` (`{ startedAt: z.date(), actual: z.array(compassCurvePointSchema), plan: z.array(compassCurvePointSchema) }`). Both are exported and re-exported from `packages/validators/src/index.ts`.

`packages/types/src/index.ts` (current — relevant compass block at L130–L162):

```ts
// ─── Compass (story 1-1) ─────────────────────────────────────────────────
export type { Compass, CompassSetupState } from "@pekulo/validators";
export { MAX_OBJECTIF_EUR, MIN_HORIZON_YEARS, MAX_HORIZON_YEARS } from "@pekulo/validators";

// Append-only audit row written when the compass is updated (ADR-0001).
export interface CompassHistoryEntry { … }

// Probe consumed by the compass module's getSetupState handler …
export interface MilestonePresenceProbe { hasAny(userId: string): Promise<boolean>; }

// Read-only contract the milestones service needs from the compass aggregate …
export interface CompassReader {
  read(userId: string): Promise<{ objectif: number; horizonYears: number } | null>;
}
```

This story appends:

```ts
// Re-exports from @pekulo/validators (Zod-inferred, runtime SSOT).
export type { CompassCurve, CompassCurvePoint } from "@pekulo/validators";

// Time-series of wealth snapshots consumed by compass.getCompassCurve.
// V1 source: brownfield monthly_tracking via the runtime-dependencies adapter.
// Epic 5 will swap the adapter for a proper module wiring.
export interface WealthSnapshot {
  at: Date;
  totalEur: number;
}

export interface WealthHistoryProvider {
  read(userId: string): Promise<WealthSnapshot[]>;
}
```

`apps/api/src/bootstrap/runtime-dependencies.ts` (current — relevant block at L62–L80):

```ts
const compassReader: CompassReader = { … };
const milestonesModule = createMilestonesModule({ prismaService, compassReader });
const milestonePresenceProbe: MilestonePresenceProbe = milestonesModule.presenceProbe;
const compassModule = createCompassModule({
  prismaService,
  milestonePresenceProbe,
});
```

This story adds a `wealthHistoryProvider` constant before `compassModule` is built and threads it through the `createCompassModule` deps:

```ts
const wealthHistoryProvider: WealthHistoryProvider = {
  async read(userId) {
    const rows = await prismaService.client.monthlyTracking.findMany({
      where: { userId },
      orderBy: [{ year: "asc" }, { monthNum: "asc" }],
      select: { year: true, monthNum: true, capitalTotal: true },
    });
    return rows.map((row) => ({
      // 28 UTC: safe last-of-month proxy (valid in every month, no leap concerns).
      at: new Date(Date.UTC(row.year, row.monthNum - 1, 28)),
      totalEur: decimalToNumber(row.capitalTotal, 0),
    }));
  },
};
const compassModule = createCompassModule({
  prismaService,
  milestonePresenceProbe,
  wealthHistoryProvider,
});
```

The `WealthHistoryProvider` import is added alongside the existing `CompassReader` / `MilestonePresenceProbe` imports from `@pekulo/types`.

### Lessons re-applied

- **L8 — 2026-05-04 — Elysia 1.4 `Elysia` type is invariant** (Scope: aped-arch, aped-story, aped-dev — explicitly lists story 1-1, applies forward to every compass-module change including this one). The router type continues to be inferred via `ReturnType<typeof createCompassRouter>` in `compass.module.ts:15`. The new handler in `compass.routes.ts` does not annotate any Elysia / oRPC implementation type.
- **L24 — 2026-05-04 — `Number(decimal)` silently truncates above MAX_SAFE_INTEGER** (Scope: aped-arch, aped-dev — applies to every `Decimal` boundary). The wealth provider adapter (T9) uses `decimalToNumber(row.capitalTotal, 0)`. The pure helper does NOT touch Decimal — it operates on already-coerced JS numbers. Test AC-9 pins the boundary.
- **L23 — 2026-05-04 — Bun `--frozen-lockfile` workspace coverage** — N/A: no new workspace member added; only new files inside existing `apps/api`, `packages/validators`, `packages/types`, `packages/contracts`.
- **L25 — 2026-05-04 — `AsyncLocalStorage.enterWith` correctness rests on Next.js per-request isolation** — N/A: API-only story, no `apps/web` work.
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s package script `test` runs `bun test` (Bun's native runner). All new `*.test.ts` under `apps/api/src/**` use `import { describe, expect, test } from "bun:test"`.
- **Story 0-12 lint rule active** — `pekulo/no-prisma-query-without-user-id` runs on `apps/api/**/*.ts` with `prismaIdentifier: ["prisma","tx"]`. T5's `compassHistory.findFirst` and T9's `monthlyTracking.findMany` MUST include `where: { userId }`. The lint will fail CI if a query omits the guard. AC-6 explicitly asserts the lint passes on the modified repository file.
- **Story 1-1 outcome — extracted `decimalToNumber`** at `apps/api/src/common/derive/decimal-to-number.ts` is the single mechanism for L24. T9 imports it. DO NOT inline `Number(decimal)`. DO NOT duplicate the helper.
- **Story 1-2 outcome — domain constants in `@pekulo/types`** — no new constants are introduced by this story; reusing the existing `Compass` shape from `@pekulo/validators` (re-exported in `@pekulo/types`).
- **Story 1-2 outcome — `CompassReader` injection pattern** — `WealthHistoryProvider` mirrors this pattern: the compass module declares the interface, the runtime wires a Prisma-backed adapter as a closure (NOT as a dependency on a sibling module's service). Keeps the compass module decoupled from `MonthlyTracking` / Epic 5's eventual port.

### Testing approach

- **Pure helper tests** (`compass-curve.test.ts`) — fast, no Bun-test asynchrony, deterministic. Re-implement the linear-plan formula inside the test for AC-1 to avoid hardcoded magic numbers (the test compares helper output against an in-test re-derivation using the same constants).
- **Repository tests** (`compass.repository.test.ts`) — fake Prisma client (mirroring story 1-1's existing fake), exercise `findCompassStartDate` happy path + cross-user isolation + zero-row null.
- **Service tests** (`compass.service.test.ts`) — fake repo + fake `WealthHistoryProvider`. Cover AC-1, AC-2, AC-3 (`COMPASS_NOT_FOUND`), AC-4 (`TRANSACTION_FAILED`), AC-9 (Decimal-coerced large value). Inject `today` indirectly: the service reads `new Date()` — to keep tests deterministic, expose an optional `today` param on `getCompassCurve` OR (cleaner) inject `clock: () => Date` into the service deps. **Decision: add a private `clock` dep with default `() => new Date()`**; tests pass `() => new Date('2026-05-09T12:00:00Z')`.
- **Module test** (`compass.module.test.ts`) — wired flow on fake Prisma + fake wealth provider; assert AC-1 round-trip + AC-2 zero-snapshots round-trip.
- **Integration test** (`compass.integration.test.ts`) — boots Elysia + JWT verifier + oRPC bridge with a stub service. Adds AC-7 (200 with deterministic curve body) + AC-8 (401 unauth). Reuses the existing `inMemoryService()` helper extended with a stub `getCompassCurve` that returns a hardcoded curve (the integration test does NOT exercise the helper math — that's the unit test's job).

### Dependencies

- **Internal:** `@pekulo/validators` (existing `compassSchema`, new curve schemas), `@pekulo/types` (existing `Compass` re-export, new `WealthHistoryProvider`), `@pekulo/contracts` (existing `compassContract`, new procedure), `apps/api/src/common/derive/decimal-to-number.ts` (story 1-1 extract), `apps/api/src/common/errors/pekulo-error.ts` (existing codes).
- **External:** `zod` (existing), `@orpc/contract` + `@orpc/server` (existing), `@generated/prisma/client` (existing — the `MonthlyTracking` model was generated from `monthly.prisma` at workspace bootstrap; no migration / no regen).
- **Brownfield tables consumed:** `compass_history` (story 1-1 — new audit sister table), `monthly_tracking` (brownfield baseline — read-only via the wealth provider adapter).

## File List

**Created (new):**

- `apps/api/src/common/derive/compass-curve.ts` — pure helper `computeCompassCurve({ compass, startDate, today, snapshots })`.
  - **Single responsibility:** linear-plan + actual-series alignment for the compass-progress curve.
  - **Inputs:** `Compass`, `startDate: Date`, `today: Date`, `snapshots: WealthSnapshot[]`.
  - **Outputs:** `CompassCurve` with deduped, sorted plan + actual arrays. No I/O. No clock reads.
- `apps/api/src/common/derive/compass-curve.test.ts` — `bun:test` unit tests covering AC-1, AC-2, AC-10, NaN/Infinity guards, today-before-startDate clamp, dedup of identical adjacent dates.

**Modified (existing):**

- `packages/validators/src/compass.ts` — append `compassCurvePointSchema` + `compassCurveSchema`.
  - **Single responsibility:** Zod source-of-truth for the compass aggregate (extended to include the curve shape).
  - **Inputs:** `zod`. **Outputs:** schema constants + Zod-inferred TS types `CompassCurve` / `CompassCurvePoint`.
- `packages/validators/src/index.ts` — *not touched at write time*: the barrel already re-exports via `export * from "./compass"` (wildcard auto-covers the two new schemas + types). Listed here so the contract is explicit; the file itself is unchanged.
- `packages/types/src/index.ts` — re-export `CompassCurve` + `CompassCurvePoint`; declare `WealthSnapshot` + `WealthHistoryProvider` interfaces.
  - **Single responsibility:** typed import surface for downstream apps. **Inputs:** `@pekulo/validators`. **Outputs:** typed types + provider interfaces (no Zod, no runtime).
- `packages/contracts/src/compass.contract.ts` — add `getCompassCurve` procedure to `compassContractV1`.
  - **Single responsibility:** oRPC contract surface for the compass module. **Inputs:** `@pekulo/validators` schemas. **Outputs:** procedure metadata consumed by `apps/api` (server) + `apps/web` (client).
- `apps/api/src/modules/compass/compass.repository.ts` — add `findCompassStartDate(userId)`.
  - **Single responsibility:** Prisma touchpoint for the compass module's tables (`hypotheses` + `compass_history`). **Inputs:** `ExtendedPrismaClient`. **Outputs:** `CompassRepository` interface methods.
- `apps/api/src/modules/compass/compass.repository.test.ts` — cover the new method (happy path + zero-row null + cross-user isolation).
- `apps/api/src/modules/compass/compass.service.ts` — add `getCompassCurve(userId)` orchestrator + accept `wealthHistoryProvider` in factory deps.
  - **Single responsibility:** domain logic for the compass aggregate. **Inputs:** `CompassRepository`, `MilestonePresenceProbe`, `WealthHistoryProvider`. **Outputs:** `CompassService` interface methods.
- `apps/api/src/modules/compass/compass.service.test.ts` — service tests with fake repo + fake provider (AC-1, AC-2, AC-3, AC-4, AC-9 paths).
- `apps/api/src/modules/compass/compass.routes.ts` — add `getCompassCurve` oRPC handler.
- `apps/api/src/modules/compass/compass.module.ts` — accept + forward `wealthHistoryProvider`.
- `apps/api/src/modules/compass/compass.module.test.ts` — wired AC-1 + AC-2 flow on fake Prisma + fake wealth provider.
- `apps/api/src/modules/compass/compass.integration.test.ts` — extend with AC-7 (happy 200) + AC-8 (unauth 401) on `POST /rpc/v1/compass/getCompassCurve`.
- `apps/api/src/bootstrap/runtime-dependencies.ts` — wire Prisma-backed `WealthHistoryProvider` over `monthly_tracking`; pass into `createCompassModule`.

**No new migration. No new `PekuloErrorCode`. No `.oxlintrc.json` edit.**

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-09T19:00:00Z
- **Completed:** 2026-05-09T19:24:00Z

### Debug Log

- T6 typecheck cascade: making `wealthHistoryProvider` a required service dep broke `compass.module.ts` and `compass.integration.test.ts` typecheck mid-commit. Resolved by bundling T6+T8+T9 in one commit (service contract change naturally cascades to factory + runtime adapter) and adding a stub `getCompassCurve` to the integration test's `inMemoryService` so typecheck stayed green between commits.
- Module-level wired curve test (T8) initially asserted exact plan-length (6 / 3) under real wall clock — `startDate ≈ today` collapsed via dedup making the assertion flaky. Resolved by relaxing module-level assertions to wiring/alignment invariants and keeping plan-length pinned at the service-test layer where the clock is injected.

### Completion Notes

- One commit per task is the target; bundled into 4 commits due to typecheck-coupling between layered changes:
  - `d3a47be` T1 + T2 + T4 — validators schemas, types re-export, pure helper (helper test imports types from @pekulo/types so T1/T2 land alongside T4's RED→GREEN).
  - `f8449c1` T5 — repository.findCompassStartDate.
  - `aae0694` T6 + T8 + T9 — service contract change + module factory thread-through + Prisma-backed wealth adapter (forced by typecheck).
  - `3fc750d` T3 + T7 + T10 — contract procedure + route handler + AC-7/AC-8 integration tests (T3 deferred from the T1/T2 commit so the contract+handler land together).
- Decision: `clock` is an optional service dep with default `() => new Date()` (story 1-3 §"Testing approach"). Tests inject `() => new Date('2026-05-09T12:00:00Z')` for determinism.
- AC-9 is pinned at the service layer (large finite totalEur surfaces unchanged through the curve). Decimal coercion itself is exercised by L24's `decimalToNumber` helper test in story 1-1; the wealth-provider closure in `runtime-dependencies.ts` consumes that helper — no live-DB harness invoked.
- AC-6 lint pass: `bunx oxlint apps/api/src/modules/compass/compass.repository.ts apps/api/src/bootstrap/runtime-dependencies.ts` — 0 warnings / 0 errors. The `prismaIdentifier: ["prisma","tx"]` override from story 0-12's `.oxlintrc.json` is inherited; no `.oxlintrc.json` edit needed.
- No new migration, no new `PekuloErrorCode`, no `.oxlintrc.json` edit (as planned).

**Test verification (fresh, step 07 evidence):**

```
$ bun test  # in apps/api
 168 pass
 0 fail
 421 expect() calls
Ran 168 tests across 22 files. [200.00ms]
```

Workspace typecheck: `bun run typecheck` → 8/8 successful.

### File List

**Created:**

- `apps/api/src/common/derive/compass-curve.ts` — pure helper.
- `apps/api/src/common/derive/compass-curve.test.ts` — 13 unit tests (AC-1, AC-2, AC-10, NaN/Infinity guards, today-before-startDate clamp, dedup, sort).

**Modified:**

- `packages/validators/src/compass.ts` — `compassCurvePointSchema` + `compassCurveSchema`.
- `packages/types/src/index.ts` — `CompassCurve` / `CompassCurvePoint` re-export + `WealthSnapshot` / `WealthHistoryProvider` interfaces.
- `packages/contracts/src/compass.contract.ts` — `getCompassCurve` procedure.
- `apps/api/src/modules/compass/compass.repository.ts` — `findCompassStartDate(userId)`.
- `apps/api/src/modules/compass/compass.repository.test.ts` — `findFirst` on fake client + 3 new tests (happy / null / AC-5 isolation).
- `apps/api/src/modules/compass/compass.service.ts` — `getCompassCurve(userId)` orchestrator + `wealthHistoryProvider` + `clock` deps.
- `apps/api/src/modules/compass/compass.service.test.ts` — `fakeWealth` + `fixedClock` helpers + 6 new tests (AC-1, AC-2, AC-3, AC-4, AC-9, determinism); existing tests updated to inject the new dep.
- `apps/api/src/modules/compass/compass.routes.ts` — `getCompassCurve` oRPC handler with `context.userId?.trim()` guard.
- `apps/api/src/modules/compass/compass.module.ts` — factory accepts + forwards `wealthHistoryProvider`.
- `apps/api/src/modules/compass/compass.module.test.ts` — `findFirst` on fake client + 2 new wired curve tests.
- `apps/api/src/modules/compass/compass.integration.test.ts` — `inMemoryService.getCompassCurve` stub + AC-7 (200 with deterministic curve) + AC-8 (401 + UNAUTHORIZED + <100 ms).
- `apps/api/src/bootstrap/runtime-dependencies.ts` — Prisma-backed `WealthHistoryProvider` closure over `monthlyTracking.findMany` (uses `decimalToNumber`, 28-of-month UTC anchor).
- `docs/state.yaml` — story `1-3-compass-curve` flipped `ready-for-dev` → `in-progress` → `review` → `done`; `started_at` recorded.

**Added during aped-review (commit `fcebf70`, F5 in-scope override accepted):**

- `apps/api/prisma/migrations/20260510130000_index_monthly_tracking_curve/migration.sql` — index `(user_id, year, month_num)` on `monthly_tracking` to align with the wealth-provider `orderBy [year asc, monthNum asc]`. RLS policy count unchanged (3); rls-audit untouched.
- `apps/api/prisma/schema/monthly.prisma` — `@@index([userId, year, monthNum])` declaration.

## Review Record

**Date:** 2026-05-09
**Auditors:** Spec, Code, Edge & Hallucination
**Verdict:** done

### Findings

#### Resolved

- [MINOR] Untested boundary `today === startDate` exactly [`apps/api/src/common/derive/compass-curve.test.ts`]
  - Source: Edge & Hallucination auditor
  - Resolution: commit `fcebf70` — boundary test added; assert dedup-collapse + `eur ≈ 0`.
- [MINOR] Untested boundary `today === endDate` exactly [`apps/api/src/common/derive/compass-curve.test.ts`]
  - Source: Edge & Hallucination auditor
  - Resolution: commit `fcebf70` — boundary test added; assert dedup-collapse + `eur ≈ objectif`.
- [MINOR] Untested boundary `today > endDate` (clock far in future) [`apps/api/src/common/derive/compass-curve.test.ts`]
  - Source: Edge & Hallucination auditor
  - Resolution: commit `fcebf70` — boundary test added; assert upper-clamp `eur ≈ objectif`.
- [MINOR] Untested dedup edge `snapshot === endDate` [`apps/api/src/common/derive/compass-curve.test.ts`]
  - Source: Edge & Hallucination auditor
  - Resolution: commit `fcebf70` — dedup test added; assert single point at endDate, eur ≈ objectif (snapshot-derived plan point clamped at horizon).
- [NIT] Index column order on `monthly_tracking` not aligned with curve orderBy [`apps/api/prisma/schema/monthly.prisma`]
  - Source: Code auditor
  - Resolution: commit `fcebf70` — F5 in-scope override accepted; new migration `20260510130000_index_monthly_tracking_curve` adds `(user_id, year, month_num)` index. Story's "no new migration" rule deliberately overridden after user confirmation. RLS audit policy count unchanged (3).
- [NIT] File List doc discrepancy on `packages/validators/src/index.ts` [`docs/stories/1-3-compass-curve.md`]
  - Source: git-audit
  - Resolution: commit `fcebf70` — File List entry annotated; the barrel re-exports via `export * from "./compass"` wildcard, so the file is unchanged at write time despite being listed.

#### Dismissed

(none)

#### Unresolved

(none)

### Verification

- Test command: `bun test` in `apps/api`
- Test output (final pass): `172 pass / 0 fail / 429 expect() calls / 22 files [417ms]` (was 168 pre-review; +4 boundary tests from F1–F4)
- Lint evidence (AC-6 fresh): `bunx oxlint apps/api/src/modules/compass/compass.repository.ts apps/api/src/bootstrap/runtime-dependencies.ts` → `Found 0 warnings and 0 errors. (158 rules, 75ms)`
- Workspace typecheck: `bun run typecheck` → `8 successful, 8 total` (turbo).
- Prisma schema validation: `bunx prisma validate` → `The schemas at prisma/schema are valid 🚀`; `bunx prisma generate` → client regenerated.
- Visual verification: N/A — backend-only story (no preview app surface).

### Ticket sync

- Ticket comment posted: https://github.com/yabafre/pekulo/issues/15#issuecomment-4413191466
- PR opened/updated: https://github.com/yabafre/pekulo/pull/75 (title + body refreshed post-review)
