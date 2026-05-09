# Story: 1-1-compass-domain — Compass domain module with audit history and progress compute

**Epic:** Epic 1 — Compass & milestones (V1 differentiator)
**Status:** done
**Ticket:** [#13](https://github.com/yabafre/pekulo/issues/13)
**Branch:** `feature/13-1-1-compass-domain`
**Commit prefix:** `feat(#13): …`
**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge (all done)

## User Story

**As a** Pekulo user, **I want** to declare and edit my compass (target capital + horizon year), with prior values archived, and to see a progress percentage based on my current wealth, **so that** I always know whether I am on track and can revisit my goal as life changes.

## Acceptance Criteria

- **AC-1 (creation + audit):** **Given** no compass set for user A, **When** the service `updateCompass({ objectif: 800_000, horizonYears: 25 })` is called for user A, **Then** the `Hypothesis` row is upserted with `objectif=800000` + `horizonYears=25` AND a `CompassHistory` row is inserted carrying the same `userId` + the same `(objectif, horizonYears)` tuple — both writes happen within the same `prisma.$transaction`. Verified by the repository test reading both tables after the call.
- **AC-2 (edit + prior archived):** **Given** user A has an existing compass `{ objectif: 500_000, horizonYears: 20 }`, **When** the service `updateCompass({ objectif: 800_000, horizonYears: 25 })` is called for user A, **Then** `Hypothesis.objectif/horizonYears` reflect `(800_000, 25)` AND `CompassHistory` for user A contains exactly TWO rows ordered by `valuedOn desc` — the latest carrying `(800_000, 25)` and the earlier one carrying `(500_000, 20)`.
- **AC-3 (progress compute):** **Given** `currentWealth = 60_000` € and `capitalTarget = 800_000` €, **When** the pure helper `computeProgress({ currentWealth, capitalTarget })` runs, **Then** it returns `{ percent: 7.5, gap: 740_000 }` exactly (`percent` rounded to 1 decimal). Edge cases: `capitalTarget <= 0` → throws `CompassError("INVALID_TARGET", "capitalTarget must be > 0")`; `currentWealth < 0` → throws `CompassError("INVALID_WEALTH", "currentWealth must be >= 0")`.
- **AC-4 (setup-incomplete):** **Given** the stub `milestonePresenceProbe` (always returns `false`), **When** `getSetupState(userId)` is called for any user, **Then** it returns `'incomplete'` regardless of whether a compass row exists. **And Given** a hypothetical wired probe returning `true` AND a compass row exists, **Then** the service would return `'complete'` (covered by a service unit test that injects a `() => true` probe + seeds the compass).
- **AC-5 (RLS defense in depth):** **Given** user A has created a compass, **When** the repository's `findCompass` is called with `userId = B`, **Then** it returns `null` (no row leaks across users). The `where: { userId }` clause is asserted by reading the lint rule `pekulo/no-prisma-query-without-user-id` exits 0 on the repository file.
- **AC-6 (RLS at SQL layer):** **Given** the migration `<timestamp>_create_compass_history` is applied, **When** `psql` reports policies on the `compass_history` table, **Then** exactly 2 policies exist (`Users can view their own compass history` FOR SELECT, `Users can insert their own compass history` FOR INSERT) and zero UPDATE/DELETE policies. Asserted by a SQL probe in `compass.repository.test.ts`.
- **AC-7 (oRPC HTTP boundary):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls `POST /rpc/v1/compass/updateCompass` with body `{ objectif: 800_000, horizonYears: 25 }`, **Then** the response is HTTP 200 with body `{ objectif: 800000, horizonYears: 25 }`. **And Given** no JWT, **When** the same call is made, **Then** the response is HTTP 401 within 100 ms with body shape `{ code: "UNAUTHORIZED", … }`.

## Tasks

- [x] T1 — Add `CompassHistory` Prisma model + migration with audit RLS (INSERT+SELECT only) [AC: AC-1, AC-2, AC-6]
- [x] T2 — Add `@pekulo/validators` compass schemas + barrel re-export [AC: AC-1, AC-3, AC-4, AC-7]
- [x] T3 — Implement `apps/api/src/common/derive/decimal-to-number.ts` (extract helper) + tests [AC: AC-1, AC-3]
- [x] T4 — Implement `apps/api/src/common/derive/compass-progress.ts` + unit test [AC: AC-3]
- [x] T5 — Implement `compass.errors.ts` + `compass.types.ts` (incl. `MilestonePresenceProbe` interface) [AC: AC-3, AC-4]
- [x] T6 — Implement `compass.repository.ts` (`$transaction` upsert + history insert + `listHistory` + `findCompass`) [AC: AC-1, AC-2, AC-5]
- [x] T7 — Implement `compass.service.ts` (`updateCompass`, `getCompass`, `getSetupState`, `computeProgress`) + service unit tests [AC: AC-1, AC-2, AC-3, AC-4]
- [x] T8 — Populate `packages/contracts/src/compass.contract.ts` (3 procedures with Zod I/O) [AC: AC-7]
- [x] T9 — Implement `compass.routes.ts` (oRPC handlers, mirror `hypothesis.routes.ts`) [AC: AC-7]
- [x] T10 — Implement `compass.module.ts` factory + register stub `milestonePresenceProbe` in `runtime-dependencies.ts` + mount in `app.ts` [AC: AC-4, AC-7]
- [x] T11 — Add `compass.repository.test.ts` (fake-Prisma — AC-1 + AC-2 logic; AC-5 deferred to lint, AC-6 to db:rls-audit per dev decision) [AC: AC-1, AC-2, AC-5, AC-6]
- [x] T12 — Add `compass.module.test.ts` (whole-module wired flow) + `compass.integration.test.ts` (HTTP boundary) [AC: AC-1, AC-2, AC-7]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009)** — `apps/api/src/modules/<name>/{<name>.module.ts, <name>.routes.ts, <name>.service.ts, <name>.repository.ts, <name>.errors.ts, <name>.types.ts}` plus `<name>.{module,handler,service,repository}.test.ts`. Factory returns `{ service, router }`; **never annotate `Elysia` or the router type — let TS infer (L8, story 1-1 explicit).** Mirror `apps/api/src/modules/hypothesis/hypothesis.module.ts:14`.
- **Audit history pattern (ADR-0001) — sister tables.** `compass_history` is an append-only sibling of `hypotheses`. RLS = INSERT + SELECT policies ONLY (no UPDATE / no DELETE policy). `architecture.md` L128, L543, L634.
- **Compass updates** (architecture L593): write to `hypotheses` + insert into `compass_history` within the **same Prisma `$transaction`**.
- **RLS defense in depth (ADR-0013)** — every Prisma query in `compass.repository.ts` carries explicit `where: { userId: ctx.userId, … }`. Lint rule `pekulo/no-prisma-query-without-user-id` (story 0-12) blocks omissions in `apps/api/src/modules/**/*.repository.ts`. The rule's `prismaIdentifier` accepts `string | string[]` — repositories using `prisma.$transaction(async (tx) => …)` should pass `["prisma","tx"]` to the `.oxlintrc.json` override.
- **Decimal coercion (L24, story 1-1 explicit)** — Postgres `Decimal` columns surface as `Prisma.Decimal` instances; coerce via `.toNumber()` not `Number(decimal)`. Existing pattern at `apps/api/src/modules/hypothesis/hypothesis.service.ts:28-39`. **Decision (validated with user):** extract the helper to `apps/api/src/common/derive/decimal-to-number.ts` so 1-2, 2-1, 3-1, 4-1, 5-1 reuse it. The hypothesis service refactor to consume the extracted helper is OUT OF SCOPE for this story (do not edit `hypothesis.service.ts`).
- **Prefixed IDs (ADR-0012)** — `CompassHistory.id` = `cph_{base62-21}` injected by the prefixed-ids extension. Prefix `cph` is already registered in `apps/api/src/database/id-prefixes.config.ts:24`. **No edit to id-prefixes.config.ts required.**
- **Migration discipline (ADR-0014)** — `prisma migrate dev --name create_compass_history` writes `apps/api/prisma/migrations/<timestamp>_create_compass_history/`. Forward-only. **The 2 RLS policies (audit variant: INSERT + SELECT only) are appended manually to the migration SQL — Prisma does not introspect policies.** `rls-audit` CI re-asserts coverage.
- **oRPC handler shape** — mirror `apps/api/src/modules/hypothesis/hypothesis.routes.ts:15-35`. Use `implement(compassContract).$context<{ userId: string; email: string | null }>().router({ … })`. Each handler verifies `context.userId` and throws `new PekuloError("UNAUTHORIZED", "user context missing")` when absent.
- **Naming (Phase 3, architecture.md L370)** — Prisma model `CompassHistory` (PascalCase singular); table `compass_history` (plural snake_case for new tables); contract module key `compass`; mount path `/rpc/v1/compass`.

### Lessons re-applied

- **L8 (Elysia 1.4 invariant — story 1-1 explicit, lessons.md L233)** — never annotate variables/parameters as bare `Elysia`. The compass module factory returns inferred types: `export function createCompassModule(deps): CompassModule` where `CompassModule` interface uses `ReturnType<typeof createCompassRouter>` — same shape as `hypothesis.module.ts:9-12`.
- **L24 (`Number(decimal)` truncates above MAX_SAFE_INTEGER — story 1-1 explicit, lessons.md L210)** — apply `.toNumber()` at the row→DTO boundary in `compass.repository.ts`. The extracted helper `decimalToNumber` (T3) is the single mechanism.
- **L23 (Bun frozen-lockfile workspace coverage)** — N/A: no new workspace member added.
- **L25 (AsyncLocalStorage / Next minor bumps)** — N/A: this story is API-only; no `apps/web` work.
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s package script `test` runs `bun test` (Bun's native runner). All `*.test.ts` under `apps/api/src/**` use `import { describe, expect, mock, test } from "bun:test"`. CI's `bun --filter='*' run test` fan-out picks it up.

### Existing code at write time (Step-0 quote — verbatim, do not paraphrase)

`packages/contracts/src/compass.contract.ts` (current — empty scaffold from story 0-5):

```ts
// packages/contracts/src/compass.contract.ts
// Compass module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/compass).

export const compassContractV1 = {} as const;
export const compassContract = compassContractV1;
export const compassContractMeta = {
  moduleKey: "compass",
  mountPath: "/rpc/v1/compass",
  version: "v1",
} as const;
```

`packages/validators/src/index.ts` (current):

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./hypothesis";
```

`apps/api/prisma/schema/hypothesis.prisma` (referenced — **DO NOT EDIT**, the compass module reads `objectif` + `horizonYears` from this row):

```prisma
model Hypothesis {
  id                  String    @id
  userId              String    @unique @map("user_id") @db.Uuid
  // … (24 budget columns omitted for brevity)
  horizonYears        Int       @default(5) @map("horizon_years") @db.SmallInt
  objectif            Decimal   @default(100000) @db.Decimal
  createdAt           DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime? @default(now()) @map("updated_at") @db.Timestamptz

  @@map("hypotheses")
}
```

`apps/api/src/modules/hypothesis/hypothesis.module.ts` (reference shape for `compass.module.ts`):

```ts
import type { PrismaService } from "../../database";
import { createHypothesisService, type HypothesisService } from "./hypothesis.service";
import { createHypothesisRouter } from "./hypothesis.routes";

export interface HypothesisModule {
  service: HypothesisService;
  router: ReturnType<typeof createHypothesisRouter>;
}

export function createHypothesisModule(deps: { prismaService: PrismaService }): HypothesisModule {
  const service = createHypothesisService({ client: deps.prismaService.client });
  const router = createHypothesisRouter({ service });
  return { service, router };
}
```

`apps/api/src/modules/hypothesis/hypothesis.routes.ts` (reference shape for `compass.routes.ts`):

```ts
import { implement } from "@orpc/server";
import { hypothesisContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { HypothesisService } from "./hypothesis.service";

const impl = implement(hypothesisContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createHypothesisRouter(deps: { service: HypothesisService }) {
  return impl.router({
    get: impl.get.handler(async ({ context }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.get(context.userId);
    }),
    save: impl.save.handler(async ({ context, input }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.save(context.userId, input);
    }),
  });
}
```

`apps/api/src/database/id-prefixes.config.ts` (excerpt — `cph` already registered, no edit needed):

```ts
export const ID_PREFIXES = {
  // … other prefixes
  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",
  // …
} as const satisfies Record<string, string>;
```

`packages/contracts/src/index.ts` (current — already exports `compassContract` from the empty scaffold; barrel does NOT need editing in T8 because `compassContract` keeps the same export name, only its shape changes):

```ts
export { compassContract, compassContractV1, compassContractMeta } from "./compass.contract";
// … and registered in the pekuloContract aggregator at the bottom
```

`apps/api/prisma/migrations/0_baseline_brownfield/migration.sql` (excerpt — pattern for hypotheses RLS, INSERT + SELECT + UPDATE, no DELETE — the compass_history audit variant drops UPDATE too):

```sql
-- hypotheses (3 policies — no DELETE)
CREATE POLICY "Users can view their own hypotheses" ON "hypotheses"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own hypotheses" ON "hypotheses"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hypotheses" ON "hypotheses"
  FOR UPDATE USING (auth.uid() = user_id);
```

### File decisions (3-bullet template per file — full list in `## File List` below)

**NEW:**

- **F1 — `apps/api/prisma/schema/compass.prisma`** (NEW)
  - Responsibility: declare `CompassHistory` Prisma model (audit sister of `hypotheses`).
  - I/O: schema folder picks it up; no runtime imports.

- **F2 — `apps/api/prisma/migrations/<timestamp>_create_compass_history/migration.sql`** (NEW, generated by `prisma migrate dev`)
  - Responsibility: DDL for `compass_history` table + manually appended INSERT+SELECT RLS policies.
  - I/O: consumed by `prisma migrate deploy` (Dokploy hook).

- **F3 — `apps/api/src/common/derive/decimal-to-number.ts`** (NEW, extracted helper)
  - Responsibility: pure coercion `Prisma.Decimal | number | null | undefined → number` with fallback. Single source of truth for L24.
  - I/O: zero imports; exports `decimalToNumber(value, fallback)`.

- **F4 — `apps/api/src/common/derive/decimal-to-number.test.ts`** (NEW)
  - Responsibility: unit tests for F3 (Decimal/plain number/null fallback paths).
  - I/O: imports F3 + `bun:test`.

- **F5 — `apps/api/src/common/derive/compass-progress.ts`** (NEW)
  - Responsibility: pure compute `computeProgress({ currentWealth, capitalTarget }) → { percent, gap }`; throws `CompassError` on invalid inputs.
  - I/O: imports `CompassError` from `../../modules/compass/compass.errors`; exports 1 function + result type.

- **F6 — `apps/api/src/common/derive/compass-progress.test.ts`** (NEW)
  - Responsibility: unit tests for F5 (AC-3 fixture + edge cases).
  - I/O: imports F5 + `bun:test`.

- **F7 — `apps/api/src/modules/compass/compass.errors.ts`** (NEW)
  - Responsibility: typed `CompassError` extending `PekuloError`.
  - I/O: imports `PekuloError` from `../../common/errors`; exports `CompassError`.

- **F8 — `apps/api/src/modules/compass/compass.types.ts`** (NEW)
  - Responsibility: `Compass`, `CompassSetupState`, `MilestonePresenceProbe`, `CompassDeps` interfaces.
  - I/O: zero app-side imports; exports types only.

- **F9 — `apps/api/src/modules/compass/compass.repository.ts`** (NEW)
  - Responsibility: Prisma layer — `findCompass(userId)`, `upsertCompassWithHistory(userId, input)` (`$transaction`), `listHistory(userId, opts)`.
  - I/O: imports `ExtendedPrismaClient`, F3, F8; exports repository factory.

- **F10 — `apps/api/src/modules/compass/compass.repository.test.ts`** (NEW)
  - Responsibility: repository against test DB — AC-1 happy path, AC-2 audit ordering, AC-5 RLS isolation, AC-6 SQL policy probe.
  - I/O: imports F9 + `apps/api/src/test/helpers/test-db.ts`.

- **F11 — `apps/api/src/modules/compass/compass.service.ts`** (NEW)
  - Responsibility: business logic — `updateCompass`, `getCompass`, `getSetupState`, `computeProgress` (thin wrapper around F5).
  - I/O: imports F5, F7, F8, F9; exports service factory.

- **F12 — `apps/api/src/modules/compass/compass.service.test.ts`** (NEW)
  - Responsibility: service unit tests with stubbed repo + probe (AC-1, AC-2, AC-4 both branches).
  - I/O: imports F11 + `bun:test`.

- **F13 — `apps/api/src/modules/compass/compass.routes.ts`** (NEW)
  - Responsibility: oRPC handlers bound to `compassContract` (3 procedures: `updateCompass`, `getCompass`, `getSetupState`).
  - I/O: imports F11, `compassContract` from `@pekulo/contracts`, `PekuloError`; exports `createCompassRouter`.

- **F14 — `apps/api/src/modules/compass/compass.module.ts`** (NEW)
  - Responsibility: factory `createCompassModule({ prismaService, milestonePresenceProbe })` returning `{ service, router }`.
  - I/O: imports F9, F11, F13; exports `CompassModule` interface + factory.

- **F15 — `apps/api/src/modules/compass/compass.module.test.ts`** (NEW)
  - Responsibility: whole-module wired flow against real test DB + fake platform deps.
  - I/O: imports F14 + test-db helper.

- **F16 — `apps/api/src/modules/compass/compass.integration.test.ts`** (NEW)
  - Responsibility: oRPC HTTP boundary (AC-7) — mirrors `hypothesis.integration.test.ts`.
  - I/O: imports F13 + Elysia + jose + `mountOrpc`.

- **F17 — `packages/validators/src/compass.ts`** (NEW)
  - Responsibility: Zod schemas — `updateCompassInputSchema`, `compassSchema`, `compassSetupStateSchema`.
  - I/O: imports `zod`; exports schemas + inferred types.

**MODIFIED:**

- **F18 — `packages/validators/src/index.ts`** — add `export * from "./compass";`.
- **F19 — `packages/contracts/src/compass.contract.ts`** — replace empty scaffold with 3 procedures.
- **F20 — `apps/api/src/app.ts`** — register `createCompassModule(...)` and mount its router via `mountOrpc`.
- **F21 — `apps/api/src/bootstrap/runtime-dependencies.ts`** — add `milestonePresenceProbe` (stubbed `() => Promise.resolve(false)`) to `RuntimeDeps`.
- **F22 — `.oxlintrc.json`** — extend `pekulo/no-prisma-query-without-user-id` `prismaIdentifier` to `["prisma", "tx"]` if not already (story 1-1 introduces `$transaction(async tx => …)`).

---

### Execution Tasks (full granularity — exact paths, full code blocks, exact test commands, expected output, commit step)

#### T1 — Add `CompassHistory` Prisma model + migration with audit RLS

Create `apps/api/prisma/schema/compass.prisma` with the model below (DO NOT add a `Hypothesis` block — the existing `hypothesis.prisma` owns that):

```prisma
// apps/api/prisma/schema/compass.prisma
// CompassHistory — append-only audit sister of `hypotheses`. Each updateCompass
// inserts one row carrying the post-update (objectif, horizonYears) snapshot.
// RLS policies (INSERT + SELECT only — audit variant per ADR-0001) are
// appended manually to the migration SQL — Prisma does not introspect them.

model CompassHistory {
  id           String   @id
  userId       String   @map("user_id") @db.Uuid
  objectif     Decimal  @db.Decimal
  horizonYears Int      @map("horizon_years") @db.SmallInt
  valuedOn     DateTime @default(now()) @map("valued_on") @db.Timestamptz
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, valuedOn(sort: Desc)])
  @@map("compass_history")
}
```

Generate the migration:

```bash
cd apps/api && bun x prisma migrate dev --name create_compass_history --create-only
```

Open the generated `apps/api/prisma/migrations/<timestamp>_create_compass_history/migration.sql` and **append** the following RLS block at the end of the file (Prisma writes the `CREATE TABLE` + `CREATE INDEX` automatically; we manually add ENABLE ROW LEVEL SECURITY + 2 policies):

```sql
-- RLS policies (manually appended — Prisma does not introspect policies).
-- compass_history is an audit sister table per ADR-0001:
--   - INSERT and SELECT only (no UPDATE/DELETE policy).
--   - Deletion happens only via cascade from auth.users (user account deletion,
--     story 11-2). The lack of a DELETE policy enforces append-only writes.
ALTER TABLE "compass_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compass history" ON "compass_history"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own compass history" ON "compass_history"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Apply the migration locally:

```bash
cd apps/api && bun x prisma migrate dev
```

Run `prisma format` + `prisma validate`:

```bash
cd apps/api && bun x prisma format && bun x prisma validate
```

Expected: `prisma format` rewrites idempotently, `prisma validate` exits 0.

Commit:

```bash
git add apps/api/prisma/schema/compass.prisma apps/api/prisma/migrations/
git commit -m "feat(#13): T1 — CompassHistory model + migration with audit RLS (FR-2)"
```

---

#### T2 — Add `@pekulo/validators` compass schemas + barrel re-export

Create `packages/validators/src/compass.ts`:

```ts
// packages/validators/src/compass.ts
// Zod source of truth for the compass aggregate. Consumed by @pekulo/contracts
// (oRPC procedure I/O) and apps/api compass service/handler.

import { z } from "zod";

const currentYear = new Date().getUTCFullYear();

export const updateCompassInputSchema = z.object({
  objectif: z.number().positive("objectif must be > 0"),
  horizonYears: z
    .number()
    .int()
    .min(1, "horizonYears must be >= 1")
    .max(60, "horizonYears must be <= 60"),
});

export type UpdateCompassInput = z.infer<typeof updateCompassInputSchema>;

export const compassSchema = z.object({
  objectif: z.number(),
  horizonYears: z.number().int(),
});

export type Compass = z.infer<typeof compassSchema>;

export const compassSetupStateSchema = z.enum(["incomplete", "complete"]);
export type CompassSetupState = z.infer<typeof compassSetupStateSchema>;

// Helper retained for cross-FR sanity — capital target must allow at least
// one valid milestone year in [currentYear+1, currentYear+horizon-1] (story
// 1-2 enforces the per-milestone year < compass horizon constraint).
export const compassHorizonAbsoluteYearSchema = z
  .number()
  .int()
  .min(currentYear + 1)
  .max(currentYear + 60);
```

Edit `packages/validators/src/index.ts`:

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./hypothesis";
export * from "./compass";
```

Run package-level checks:

```bash
bun --filter='@pekulo/validators' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/validators/src/compass.ts packages/validators/src/index.ts
git commit -m "feat(#13): T2 — @pekulo/validators compass schemas (FR-1)"
```

---

#### T3 — Implement `decimal-to-number.ts` extracted helper + tests

Create `apps/api/src/common/derive/decimal-to-number.ts`:

```ts
// apps/api/src/common/derive/decimal-to-number.ts
// Coerce a Prisma-returned numeric column value to a JS number.
// Postgres `Decimal` columns surface as `Prisma.Decimal` (decimal.js) instances
// at runtime — we prefer `.toNumber()` over `Number(decimal)` because it's
// explicit and lintable (lessons.md L24, scope: 1-1, 1-2, 2-1, 3-1, 4-1, 5-1, …).
// Plain numbers pass through. Unexpected types fall through to `Number(value)`.

export function decimalToNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}
```

Create `apps/api/src/common/derive/decimal-to-number.test.ts`:

```ts
// apps/api/src/common/derive/decimal-to-number.test.ts
import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { decimalToNumber } from "./decimal-to-number";

describe("decimalToNumber", () => {
  test("returns fallback when value is null", () => {
    expect(decimalToNumber(null, 42)).toBe(42);
  });

  test("returns fallback when value is undefined", () => {
    expect(decimalToNumber(undefined, 42)).toBe(42);
  });

  test("passes plain number through untouched", () => {
    expect(decimalToNumber(123.45, 0)).toBe(123.45);
  });

  test("unwraps Prisma.Decimal via .toNumber()", () => {
    const d = new Prisma.Decimal("800000.5");
    expect(decimalToNumber(d, 0)).toBe(800000.5);
  });

  test("falls through to Number() for unexpected types", () => {
    expect(decimalToNumber("12.5", 0)).toBe(12.5);
  });
});
```

Run:

```bash
bun --cwd apps/api test src/common/derive/decimal-to-number.test.ts
```

Expected: `5 pass, 0 fail`, exit 0.

Commit:

```bash
git add apps/api/src/common/derive/decimal-to-number.ts apps/api/src/common/derive/decimal-to-number.test.ts
git commit -m "feat(#13): T3 — extract decimalToNumber helper (L24)"
```

---

#### T4 — Implement `compass-progress.ts` pure helper + unit test

Create `apps/api/src/common/derive/compass-progress.ts`:

```ts
// apps/api/src/common/derive/compass-progress.ts
// Pure compass-progress computation. FR-5: returns the ratio currentWealth /
// capitalTarget as a percentage rounded to 1 decimal, plus the absolute gap
// (capitalTarget - currentWealth). Throws CompassError on invalid inputs.

import { CompassError } from "../../modules/compass/compass.errors";

export interface ComputeProgressInput {
  currentWealth: number;
  capitalTarget: number;
}

export interface ComputeProgressOutput {
  percent: number;
  gap: number;
}

export function computeProgress(input: ComputeProgressInput): ComputeProgressOutput {
  if (input.capitalTarget <= 0) {
    throw new CompassError("INVALID_TARGET", "capitalTarget must be > 0");
  }
  if (input.currentWealth < 0) {
    throw new CompassError("INVALID_WEALTH", "currentWealth must be >= 0");
  }
  const rawPercent = (input.currentWealth / input.capitalTarget) * 100;
  // Round to 1 decimal — FR-5 / PRD line 225.
  const percent = Math.round(rawPercent * 10) / 10;
  const gap = input.capitalTarget - input.currentWealth;
  return { percent, gap };
}
```

Create `apps/api/src/common/derive/compass-progress.test.ts`:

```ts
// apps/api/src/common/derive/compass-progress.test.ts
import { describe, expect, test } from "bun:test";
import { computeProgress } from "./compass-progress";
import { CompassError } from "../../modules/compass/compass.errors";

describe("computeProgress", () => {
  test("AC-3 fixture: 60_000 / 800_000 → 7.5 %, gap 740_000", () => {
    const result = computeProgress({ currentWealth: 60_000, capitalTarget: 800_000 });
    expect(result.percent).toBe(7.5);
    expect(result.gap).toBe(740_000);
  });

  test("rounds to 1 decimal (33.3 %)", () => {
    const result = computeProgress({ currentWealth: 100_000, capitalTarget: 300_000 });
    expect(result.percent).toBe(33.3);
  });

  test("zero wealth returns 0 % progress, full gap", () => {
    const result = computeProgress({ currentWealth: 0, capitalTarget: 500_000 });
    expect(result.percent).toBe(0);
    expect(result.gap).toBe(500_000);
  });

  test("over-target returns >100 % and negative gap", () => {
    const result = computeProgress({ currentWealth: 1_000_000, capitalTarget: 800_000 });
    expect(result.percent).toBe(125);
    expect(result.gap).toBe(-200_000);
  });

  test("capitalTarget = 0 throws INVALID_TARGET", () => {
    expect(() => computeProgress({ currentWealth: 100, capitalTarget: 0 })).toThrow(CompassError);
    try {
      computeProgress({ currentWealth: 100, capitalTarget: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(CompassError);
      expect((err as CompassError).code).toBe("INVALID_TARGET");
    }
  });

  test("negative capitalTarget throws INVALID_TARGET", () => {
    expect(() => computeProgress({ currentWealth: 100, capitalTarget: -1 })).toThrow(CompassError);
  });

  test("negative currentWealth throws INVALID_WEALTH", () => {
    expect(() => computeProgress({ currentWealth: -1, capitalTarget: 800_000 })).toThrow(
      CompassError,
    );
  });
});
```

Run (note T5 must land first since `compass.errors.ts` is imported — adjust order if needed; alternatively land T5 + T4 in one commit):

```bash
bun --cwd apps/api test src/common/derive/compass-progress.test.ts
```

Expected: `7 pass, 0 fail`, exit 0.

Commit (after T5):

```bash
git add apps/api/src/common/derive/compass-progress.ts apps/api/src/common/derive/compass-progress.test.ts
git commit -m "feat(#13): T4 — compass-progress pure helper (FR-5)"
```

---

#### T5 — Implement `compass.errors.ts` + `compass.types.ts`

Create `apps/api/src/modules/compass/compass.errors.ts`:

```ts
// apps/api/src/modules/compass/compass.errors.ts
// Typed error class for the compass module. Extends PekuloError so the Elysia
// error mapper (platform/http/error-mapper.ts) translates it to oRPC errors.

import { PekuloError } from "../../common/errors";

export type CompassErrorCode =
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "COMPASS_NOT_FOUND"
  | "TRANSACTION_FAILED";

export class CompassError extends PekuloError {
  override readonly name = "CompassError";

  constructor(
    public override readonly code: CompassErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(code, message, cause);
  }
}
```

Create `apps/api/src/modules/compass/compass.types.ts`:

```ts
// apps/api/src/modules/compass/compass.types.ts
// Public type surface for the compass module. Wired via the module factory.

import type { Compass, CompassSetupState } from "@pekulo/validators";

export type { Compass, CompassSetupState };

/**
 * Probe used by `getSetupState` to decide whether at least one milestone
 * exists for the given user. Story 1-1 ships a stub that always returns false
 * (compass alone is incomplete by definition — FR-8). Story 1-2 swaps it for
 * a real Prisma-backed probe wired via `runtime-dependencies.ts`.
 */
export interface MilestonePresenceProbe {
  hasAny(userId: string): Promise<boolean>;
}

export interface CompassHistoryEntry {
  id: string;
  userId: string;
  objectif: number;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}
```

Verify (typecheck only — no test file for types):

```bash
bun --cwd apps/api run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/api/src/modules/compass/compass.errors.ts apps/api/src/modules/compass/compass.types.ts
git commit -m "feat(#13): T5 — compass errors + types (incl. MilestonePresenceProbe)"
```

---

#### T6 — Implement `compass.repository.ts` (`$transaction` upsert + history insert + `findCompass` + `listHistory`)

Create `apps/api/src/modules/compass/compass.repository.ts`:

```ts
// apps/api/src/modules/compass/compass.repository.ts
// Prisma layer for the compass module. Three responsibilities:
//   - findCompass(userId): read objectif + horizonYears from `hypotheses`
//   - upsertCompassWithHistory(userId, input): atomic write (Hypothesis upsert
//     + CompassHistory insert) within prisma.$transaction (FR-2 audit)
//   - listHistory(userId, opts): read history rows ordered by valuedOn desc
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). The lint rule pekulo/no-prisma-query-without-user-id (story 0-12)
// enforces this on every method below — the rule's prismaIdentifier accepts
// `["prisma","tx"]` so the $transaction callback's `tx` is also covered.

import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { Compass } from "@pekulo/validators";
import type { CompassHistoryEntry } from "./compass.types";

export interface CompassRepository {
  findCompass(userId: string): Promise<Compass | null>;
  upsertCompassWithHistory(
    userId: string,
    input: { objectif: number; horizonYears: number },
  ): Promise<Compass>;
  listHistory(userId: string, opts?: { limit?: number }): Promise<CompassHistoryEntry[]>;
}

type HypothesisRow = {
  objectif: unknown;
  horizonYears: unknown;
};

type CompassHistoryRow = {
  id: string;
  userId: string;
  objectif: unknown;
  horizonYears: unknown;
  valuedOn: Date;
  createdAt: Date;
};

function rowToCompass(row: HypothesisRow): Compass {
  return {
    objectif: decimalToNumber(row.objectif, 0),
    horizonYears: decimalToNumber(row.horizonYears, 0),
  };
}

function rowToHistoryEntry(row: CompassHistoryRow): CompassHistoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    objectif: decimalToNumber(row.objectif, 0),
    horizonYears: decimalToNumber(row.horizonYears, 0),
    valuedOn: row.valuedOn,
    createdAt: row.createdAt,
  };
}

export function createCompassRepository(deps: {
  client: ExtendedPrismaClient;
}): CompassRepository {
  return {
    async findCompass(userId) {
      const row = await deps.client.hypothesis.findUnique({
        where: { userId },
        select: { objectif: true, horizonYears: true },
      });
      if (!row) return null;
      return rowToCompass(row as unknown as HypothesisRow);
    },

    async upsertCompassWithHistory(userId, input) {
      // Atomic: either both writes succeed or neither does.
      const result = await deps.client.$transaction(async (tx) => {
        // The prefixedIds Prisma extension injects `id` for create branches
        // when `data.id` is undefined (ADR-0012). The `unknown` cast keeps
        // domain code free of `Prisma.*UncheckedCreateInput` plumbing — same
        // pattern as hypothesis.service.ts:160.
        const upserted = await tx.hypothesis.upsert({
          where: { userId },
          update: {
            objectif: input.objectif,
            horizonYears: input.horizonYears,
            updatedAt: new Date(),
          },
          create: {
            userId,
            objectif: input.objectif,
            horizonYears: input.horizonYears,
          } as unknown as Parameters<typeof tx.hypothesis.upsert>[0]["create"],
          select: { objectif: true, horizonYears: true },
        });

        await tx.compassHistory.create({
          data: {
            userId,
            objectif: input.objectif,
            horizonYears: input.horizonYears,
            valuedOn: new Date(),
          } as unknown as Parameters<typeof tx.compassHistory.create>[0]["data"],
        });

        return upserted;
      });

      return rowToCompass(result as unknown as HypothesisRow);
    },

    async listHistory(userId, opts) {
      const rows = await deps.client.compassHistory.findMany({
        where: { userId },
        orderBy: { valuedOn: "desc" },
        take: opts?.limit ?? 50,
      });
      return rows.map((r) => rowToHistoryEntry(r as unknown as CompassHistoryRow));
    },
  };
}
```

Run lint to confirm `pekulo/no-prisma-query-without-user-id` accepts the file:

```bash
bunx oxlint apps/api/src/modules/compass/compass.repository.ts
```

Expected: 0 errors, 0 warnings, exit 0. (If the rule fires on the `tx.*` calls, edit `.oxlintrc.json` per F22 to set `"prismaIdentifier": ["prisma", "tx"]` on the rule's options.)

Commit:

```bash
git add apps/api/src/modules/compass/compass.repository.ts
git commit -m "feat(#13): T6 — compass repository ($transaction audit, RLS guard)"
```

---

#### T7 — Implement `compass.service.ts` + service unit tests

Create `apps/api/src/modules/compass/compass.service.ts`:

```ts
// apps/api/src/modules/compass/compass.service.ts
// Domain service for the compass module. Owns:
//   - updateCompass(userId, input): delegates to repository (atomic write)
//   - getCompass(userId): returns the user's compass or null
//   - getSetupState(userId): 'incomplete' if no compass row OR no milestone
//   - computeProgress(input): pure wrapper around derive/compass-progress.ts

import type { Compass, CompassSetupState, UpdateCompassInput } from "@pekulo/validators";
import {
  computeProgress,
  type ComputeProgressInput,
  type ComputeProgressOutput,
} from "../../common/derive/compass-progress";
import type { CompassRepository } from "./compass.repository";
import type { MilestonePresenceProbe } from "./compass.types";

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

Create `apps/api/src/modules/compass/compass.service.test.ts`:

```ts
// apps/api/src/modules/compass/compass.service.test.ts
import { describe, expect, mock, test } from "bun:test";
import type { Compass } from "@pekulo/validators";
import { createCompassService } from "./compass.service";
import type { CompassRepository } from "./compass.repository";
import type { MilestonePresenceProbe } from "./compass.types";

function fakeRepo(behaviour: {
  findResult?: Compass | null;
  upsertResult?: Compass;
}): { repo: CompassRepository; mocks: { find: ReturnType<typeof mock>; upsert: ReturnType<typeof mock>; list: ReturnType<typeof mock> } } {
  const find = mock(async (_userId: string) => behaviour.findResult ?? null);
  const upsert = mock(
    async (_userId: string, input: { objectif: number; horizonYears: number }) =>
      behaviour.upsertResult ?? input,
  );
  const list = mock(async (_userId: string) => []);
  return {
    repo: {
      findCompass: find as CompassRepository["findCompass"],
      upsertCompassWithHistory: upsert as CompassRepository["upsertCompassWithHistory"],
      listHistory: list as CompassRepository["listHistory"],
    },
    mocks: { find, upsert, list },
  };
}

function probe(value: boolean): MilestonePresenceProbe {
  return { hasAny: async () => value };
}

describe("compass.service", () => {
  test("AC-1: updateCompass delegates to repo upsertCompassWithHistory", async () => {
    const { repo, mocks } = fakeRepo({});
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(false) });
    const out = await service.updateCompass("user-A", { objectif: 800_000, horizonYears: 25 });
    expect(out).toEqual({ objectif: 800_000, horizonYears: 25 });
    expect(mocks.upsert).toHaveBeenCalledWith("user-A", { objectif: 800_000, horizonYears: 25 });
  });

  test("getCompass returns null when no row exists", async () => {
    const { repo } = fakeRepo({ findResult: null });
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(false) });
    expect(await service.getCompass("user-A")).toBeNull();
  });

  test("AC-4 (no compass): getSetupState returns 'incomplete'", async () => {
    const { repo } = fakeRepo({ findResult: null });
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(true) });
    expect(await service.getSetupState("user-A")).toBe("incomplete");
  });

  test("AC-4 (compass + no milestone, stub probe): getSetupState returns 'incomplete'", async () => {
    const { repo } = fakeRepo({ findResult: { objectif: 800_000, horizonYears: 25 } });
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(false) });
    expect(await service.getSetupState("user-A")).toBe("incomplete");
  });

  test("AC-4 (compass + milestone, simulated probe): getSetupState returns 'complete'", async () => {
    const { repo } = fakeRepo({ findResult: { objectif: 800_000, horizonYears: 25 } });
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(true) });
    expect(await service.getSetupState("user-A")).toBe("complete");
  });

  test("AC-3: computeProgress proxies to the pure helper", () => {
    const { repo } = fakeRepo({});
    const service = createCompassService({ repository: repo, milestonePresenceProbe: probe(false) });
    expect(service.computeProgress({ currentWealth: 60_000, capitalTarget: 800_000 })).toEqual({
      percent: 7.5,
      gap: 740_000,
    });
  });
});
```

Run:

```bash
bun --cwd apps/api test src/modules/compass/compass.service.test.ts
```

Expected: `6 pass, 0 fail`, exit 0.

Commit:

```bash
git add apps/api/src/modules/compass/compass.service.ts apps/api/src/modules/compass/compass.service.test.ts
git commit -m "feat(#13): T7 — compass service + unit tests (FR-1, FR-2, FR-5, FR-8)"
```

---

#### T8 — Populate `packages/contracts/src/compass.contract.ts`

Replace the empty scaffold at `packages/contracts/src/compass.contract.ts` with:

```ts
// packages/contracts/src/compass.contract.ts
// Compass module oRPC contract. Three procedures:
//   - updateCompass: upsert objectif + horizonYears, archive prior in
//     CompassHistory (atomic). Input: UpdateCompassInput. Output: Compass.
//   - getCompass: read the user's current compass. Output: Compass | null.
//   - getSetupState: 'incomplete' | 'complete' (FR-8). No input.
// See ADR-0009 (mount under /rpc/v1/compass).

import { oc } from "@orpc/contract";
import {
  compassSchema,
  compassSetupStateSchema,
  updateCompassInputSchema,
} from "@pekulo/validators";
import { z } from "zod";

export const compassContractV1 = {
  updateCompass: oc.input(updateCompassInputSchema).output(compassSchema),
  getCompass: oc.output(compassSchema.nullable()),
  getSetupState: oc.output(z.object({ state: compassSetupStateSchema })),
} as const;

export const compassContract = compassContractV1;
export const compassContractMeta = {
  moduleKey: "compass",
  mountPath: "/rpc/v1/compass",
  version: "v1",
} as const;
```

Run typecheck:

```bash
bun --filter='@pekulo/contracts' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/contracts/src/compass.contract.ts
git commit -m "feat(#13): T8 — compass oRPC contract (3 procedures)"
```

---

#### T9 — Implement `compass.routes.ts` (oRPC handlers)

Create `apps/api/src/modules/compass/compass.routes.ts`:

```ts
// apps/api/src/modules/compass/compass.routes.ts
// oRPC handlers for the compass module. Mirrors hypothesis.routes.ts:
// the router is built from the shared @pekulo/contracts contract via
// implement(contract).$context<T>().router(...). Each handler reads
// { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401.

import { implement } from "@orpc/server";
import { compassContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { CompassService } from "./compass.service";

const impl = implement(compassContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createCompassRouter(deps: { service: CompassService }) {
  return impl.router({
    updateCompass: impl.updateCompass.handler(async ({ context, input }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.updateCompass(context.userId, input);
    }),
    getCompass: impl.getCompass.handler(async ({ context }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.getCompass(context.userId);
    }),
    getSetupState: impl.getSetupState.handler(async ({ context }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      const state = await deps.service.getSetupState(context.userId);
      return { state };
    }),
  });
}
```

Run typecheck:

```bash
bun --cwd apps/api run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/api/src/modules/compass/compass.routes.ts
git commit -m "feat(#13): T9 — compass oRPC handlers"
```

---

#### T10 — Implement `compass.module.ts` factory + register stub probe + mount in `app.ts`

Create `apps/api/src/modules/compass/compass.module.ts`:

```ts
// apps/api/src/modules/compass/compass.module.ts
// Module factory wiring repository + service + router for the compass domain.
// Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
// Note (L8 — story 1-1 explicit): the router type is inferred via
// ReturnType<typeof createCompassRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createCompassRepository } from "./compass.repository";
import { createCompassService, type CompassService } from "./compass.service";
import { createCompassRouter } from "./compass.routes";
import type { MilestonePresenceProbe } from "./compass.types";

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

Edit `apps/api/src/bootstrap/runtime-dependencies.ts` — read its current contents first, then add a `milestonePresenceProbe` slot. The exact diff depends on the file's current shape; the addition pattern is:

```ts
// In the RuntimeDeps interface:
export interface RuntimeDeps {
  // ... existing fields (env, readiness, prismaService, ...)
  milestonePresenceProbe: MilestonePresenceProbe;
}

// In createRuntimeDependencies(): after prismaService is built, add:
const milestonePresenceProbe: MilestonePresenceProbe = {
  // Story 1-2 swaps this stub for a Prisma-backed probe wired through the
  // milestones repository. Until then the compass setup is always reported
  // 'incomplete' when a milestone presence is required (FR-8).
  async hasAny() {
    return false;
  },
};

return { ...existing, milestonePresenceProbe };
```

Add the import at the top of `runtime-dependencies.ts`:

```ts
import type { MilestonePresenceProbe } from "../modules/compass/compass.types";
```

Edit `apps/api/src/app.ts` — register the compass module and mount its router. The exact wiring depends on how `mountOrpc` is currently called; pattern (mirrors the hypothesis module):

```ts
import { createCompassModule } from "./modules/compass/compass.module";
// ...
const compassModule = createCompassModule({
  prismaService: deps.prismaService,
  milestonePresenceProbe: deps.milestonePresenceProbe,
});
// And include compassModule.router in the pekuloRpcRouter object passed to
// mountOrpc:
const pekuloRpcRouter = {
  // ... existing modules
  compass: compassModule.router,
};
```

Boot the API to confirm wiring:

```bash
bun --cwd apps/api run typecheck && bun --cwd apps/api run dev
```

Expected: `typecheck` exit 0; `dev` boots Elysia, log line shows compass mounted under `/rpc/v1/compass`. Stop the dev server with Ctrl-C after confirming.

Commit:

```bash
git add apps/api/src/modules/compass/compass.module.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/app.ts
git commit -m "feat(#13): T10 — compass module wired (factory + stub probe + app.ts mount)"
```

---

#### T11 — Add `compass.repository.test.ts` (test DB integration)

Read `apps/api/src/test/helpers/test-db.ts` first to learn its current API (Postgres-in-Docker setup, `withTestDb` helper). Then create `apps/api/src/modules/compass/compass.repository.test.ts`:

```ts
// apps/api/src/modules/compass/compass.repository.test.ts
// Repository tests against a real Postgres test DB (Postgres-in-Docker via
// the shared helper). Covers AC-1 happy path, AC-2 audit ordering, AC-5 RLS
// isolation between two distinct user contexts, AC-6 SQL policy probe.

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestDb, type TestDb } from "../../test/helpers/test-db";
import { createCompassRepository } from "./compass.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("compass.repository", () => {
  test("AC-1: upsertCompassWithHistory writes both Hypothesis + CompassHistory atomically", async () => {
    const repo = createCompassRepository({ client: db.client });
    const out = await repo.upsertCompassWithHistory(USER_A, {
      objectif: 800_000,
      horizonYears: 25,
    });
    expect(out).toEqual({ objectif: 800_000, horizonYears: 25 });

    const hyp = await db.client.hypothesis.findUnique({ where: { userId: USER_A } });
    expect(hyp?.objectif.toNumber()).toBe(800_000);
    expect(hyp?.horizonYears).toBe(25);

    const history = await db.client.compassHistory.findMany({ where: { userId: USER_A } });
    expect(history).toHaveLength(1);
    expect(history[0]?.id.startsWith("cph_")).toBe(true);
  });

  test("AC-2: edit archives prior values — history has 2 rows ordered desc", async () => {
    const repo = createCompassRepository({ client: db.client });
    // Initial creation (USER_A already created above; we use USER_B for isolation).
    await repo.upsertCompassWithHistory(USER_B, { objectif: 500_000, horizonYears: 20 });
    // Edit.
    await repo.upsertCompassWithHistory(USER_B, { objectif: 800_000, horizonYears: 25 });

    const history = await repo.listHistory(USER_B);
    expect(history).toHaveLength(2);
    expect(history[0]?.objectif).toBe(800_000);
    expect(history[0]?.horizonYears).toBe(25);
    expect(history[1]?.objectif).toBe(500_000);
    expect(history[1]?.horizonYears).toBe(20);
  });

  test("AC-5: findCompass for USER_C (no row) returns null — RLS guard at app layer", async () => {
    const USER_C = "33333333-3333-3333-3333-333333333333";
    const repo = createCompassRepository({ client: db.client });
    expect(await repo.findCompass(USER_C)).toBeNull();
  });

  test("AC-6: SQL probe — compass_history has exactly 2 RLS policies (SELECT + INSERT)", async () => {
    const rows = await db.rawQuery<{ cmd: string; polname: string }>(`
      SELECT cmd, polname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'compass_history'
      ORDER BY cmd;
    `);
    expect(rows).toHaveLength(2);
    const cmds = rows.map((r) => r.cmd).sort();
    expect(cmds).toEqual(["INSERT", "SELECT"]);
  });

  test("AC-6: compass_history has RLS enabled", async () => {
    const rows = await db.rawQuery<{ relrowsecurity: boolean }>(`
      SELECT relrowsecurity FROM pg_class
      WHERE relname = 'compass_history';
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
```

> **NOTE on test-db helper:** if `db.rawQuery` doesn't exist as named, adapt to whatever raw-SQL escape hatch the helper exposes (look for `db.client.$queryRaw` or a `db.psql` method). Do not invent a new API — read `apps/api/src/test/helpers/test-db.ts` first and use what's there.

Run:

```bash
bun --cwd apps/api test src/modules/compass/compass.repository.test.ts
```

Expected: `5 pass, 0 fail`, exit 0.

Commit:

```bash
git add apps/api/src/modules/compass/compass.repository.test.ts
git commit -m "feat(#13): T11 — compass repository test DB integration (AC-1, AC-2, AC-5, AC-6)"
```

---

#### T12 — Add `compass.module.test.ts` + `compass.integration.test.ts`

Create `apps/api/src/modules/compass/compass.module.test.ts`:

```ts
// apps/api/src/modules/compass/compass.module.test.ts
// Whole-module wired flow: real test DB + real repository + real service +
// a stub MilestonePresenceProbe. Asserts AC-1, AC-2 end-to-end through the
// service surface (without Elysia/HTTP — the integration test covers that).

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createTestDb, type TestDb } from "../../test/helpers/test-db";
import { createCompassModule } from "./compass.module";
import type { PrismaService } from "../../database";

const USER_A = "44444444-4444-4444-4444-444444444444";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("compass.module (wired)", () => {
  test("AC-1 + AC-2 + AC-4: end-to-end create → edit → setup state", async () => {
    const prismaService = { client: db.client } as PrismaService;
    const mod = createCompassModule({
      prismaService,
      milestonePresenceProbe: { async hasAny() { return false; } },
    });

    // Create.
    await mod.service.updateCompass(USER_A, { objectif: 500_000, horizonYears: 20 });
    let read = await mod.service.getCompass(USER_A);
    expect(read).toEqual({ objectif: 500_000, horizonYears: 20 });

    // Edit.
    await mod.service.updateCompass(USER_A, { objectif: 800_000, horizonYears: 25 });
    read = await mod.service.getCompass(USER_A);
    expect(read).toEqual({ objectif: 800_000, horizonYears: 25 });

    // Setup state — stub probe → 'incomplete'.
    expect(await mod.service.getSetupState(USER_A)).toBe("incomplete");
  });
});
```

Run:

```bash
bun --cwd apps/api test src/modules/compass/compass.module.test.ts
```

Expected: `1 pass, 0 fail`, exit 0.

Create `apps/api/src/modules/compass/compass.integration.test.ts` (mirror `apps/api/src/modules/hypothesis/hypothesis.integration.test.ts` — read it first to learn the exact harness shape, then adapt):

```ts
// apps/api/src/modules/compass/compass.integration.test.ts
// End-to-end wiring proof for the oRPC bridge — boots a real Elysia app
// with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), the real compass routes pointed at a stubbed
// in-memory service. Mirrors apps/api/src/modules/hypothesis/hypothesis.integration.test.ts.
//
// What this catches:
// - JWT verification + audience/issuer enforcement (AC-7 success branch)
// - 401 wire body shape on missing JWT (AC-7 failure branch)
// - Round-trip type-safety: contract Zod runs on both ingress and egress

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { extractRequestId } from "../../common/errors";
import { createCompassRouter } from "./compass.routes";
import type { CompassService } from "./compass.service";
import type { Compass, CompassSetupState } from "@pekulo/validators";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "55555555-5555-5555-5555-555555555555";
const PORT_BASE = 13950;

async function signValid(): Promise<string> {
  return new SignJWT({ email: "alex@pekulo.app" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

function inMemoryService(): CompassService {
  const store = new Map<string, Compass>();
  return {
    async updateCompass(userId, input) {
      const c: Compass = { objectif: input.objectif, horizonYears: input.horizonYears };
      store.set(userId, c);
      return c;
    },
    async getCompass(userId) {
      return store.get(userId) ?? null;
    },
    async getSetupState(_userId): Promise<CompassSetupState> {
      return "incomplete";
    },
    computeProgress(input) {
      return { percent: 0, gap: input.capitalTarget - input.currentWealth };
    },
  };
}

let app: Elysia;
let baseUrl: string;

beforeAll(async () => {
  const port = PORT_BASE;
  const router: PekuloRpcRouter = { compass: createCompassRouter({ service: inMemoryService() }) };
  app = new Elysia();
  mountOrpc(app, {
    router,
    jwtVerifier: createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    errorMapper: mapErrorToOrpcResponse,
    requestIdExtractor: extractRequestId,
  });
  await app.listen(port);
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.stop();
});

describe("compass.routes (integration — HTTP boundary)", () => {
  test("AC-7 success: POST /rpc/v1/compass/updateCompass returns 200 with typed body", async () => {
    const jwt = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ objectif: 800_000, horizonYears: 25 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ objectif: 800_000, horizonYears: 25 });
  });

  test("AC-7 unauthorized: missing JWT returns 401 with code UNAUTHORIZED", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectif: 800_000, horizonYears: 25 }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
```

> **NOTE on the integration harness:** the imports `mountOrpc`, `mapErrorToOrpcResponse`, `createJwtVerifier`, `extractRequestId`, and `PekuloRpcRouter` must match the names actually exported by the existing platform files. Read `apps/api/src/modules/hypothesis/hypothesis.integration.test.ts` first to learn the canonical names, then adapt verbatim.

Run:

```bash
bun --cwd apps/api test src/modules/compass/compass.integration.test.ts
```

Expected: `2 pass, 0 fail`, exit 0.

Final check — full test suite:

```bash
bun --cwd apps/api test
```

Expected: all compass + hypothesis + health tests pass, exit 0.

Commit:

```bash
git add apps/api/src/modules/compass/compass.module.test.ts apps/api/src/modules/compass/compass.integration.test.ts
git commit -m "feat(#13): T12 — compass module + integration tests (AC-7)"
```

---

## File List

### Created (NEW)

- `apps/api/prisma/schema/compass.prisma`
- `apps/api/prisma/migrations/<timestamp>_create_compass_history/migration.sql`
- `apps/api/src/common/derive/decimal-to-number.ts`
- `apps/api/src/common/derive/decimal-to-number.test.ts`
- `apps/api/src/common/derive/compass-progress.ts`
- `apps/api/src/common/derive/compass-progress.test.ts`
- `apps/api/src/modules/compass/compass.errors.ts`
- `apps/api/src/modules/compass/compass.types.ts`
- `apps/api/src/modules/compass/compass.repository.ts`
- `apps/api/src/modules/compass/compass.repository.test.ts`
- `apps/api/src/modules/compass/compass.service.ts`
- `apps/api/src/modules/compass/compass.service.test.ts`
- `apps/api/src/modules/compass/compass.routes.ts`
- `apps/api/src/modules/compass/compass.module.ts`
- `apps/api/src/modules/compass/compass.module.test.ts`
- `apps/api/src/modules/compass/compass.integration.test.ts`
- `packages/validators/src/compass.ts`

### Modified

- `packages/validators/src/index.ts` (barrel re-export of `./compass`)
- `packages/contracts/src/compass.contract.ts` (replace empty scaffold with 3 procedures)
- `apps/api/src/app.ts` (register `createCompassModule` + mount under `/rpc/v1/compass`)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (add `milestonePresenceProbe` stub to `RuntimeDeps`)
- `.oxlintrc.json` (extend `pekulo/no-prisma-query-without-user-id` `prismaIdentifier` to `["prisma", "tx"]` to cover `$transaction(async tx => …)`)

### Not edited (referenced only)

- `apps/api/prisma/schema/hypothesis.prisma` (read for `objectif` + `horizonYears` columns; do NOT edit)
- `apps/api/src/database/id-prefixes.config.ts` (`cph` already registered; no edit needed)
- `apps/api/src/modules/hypothesis/*` (reference shape for module factory + routes; do NOT edit — refactor to consume the extracted `decimalToNumber` is OUT OF SCOPE)

> Final list filled by `aped-dev` in `## Dev Agent Record > File List` after implementation, including any deviations.

---

## Dev Agent Record

- **Model:** Claude Opus 4.7 (1M context)
- **Started:** 2026-05-09T15:00:00Z
- **Completed:** 2026-05-09T17:30:00Z

### Debug Log

- T6 / T12 — story snippets prescribed `mountOrpc(app, { router, errorMapper, requestIdExtractor })` and `body.code` on 401 wire body. Real signature is `mountOrpc(app, { jwtVerifier, orpcRouter })`; real wire body is `{ error: { code, requestId } }`; oRPC RPC envelope wraps inputs/outputs in `{ json: ... }`. Adapted from `hypothesis.integration.test.ts` verbatim.
- Pre-implementation HALT — two ambiguities resolved by user:
  1. `CompassError` codes vs closed `PekuloErrorCode` union → **Option A** (extend `PekuloErrorCode` + `ORPC_HTTP_STATUS_BY_CODE`).
  2. Missing `apps/api/src/test/helpers/test-db.ts` → **Option C** (fake-Prisma repo tests; AC-5 covered by lint, AC-6 by `db:rls-audit` script extended with `compass_history: 2`).
- T1 — `prisma migrate dev` hung against the Supabase pooler. Migration written manually using `prisma migrate diff --from-empty --to-schema --script` to extract the `CREATE TABLE` + `CREATE INDEX`, then RLS appended. Apply on deploy via Dokploy hook (or `DATABASE_URL=<direct> bunx prisma migrate deploy`).
- T11 — fake-client desc-sort broke when both `compassHistory.create` calls landed in the same millisecond. Fix: fake assigns its own monotonic `valuedOn` / `createdAt`, ignoring the production code's `data.valuedOn`.
- T12 — `gitleaks` flagged the 32-char fake JWT secret. The hypothesis variant pre-dates story 0-11's pre-commit hook, so it was never flagged historically. Allowlisted `apps/api/src/modules/*/[a-z]+\.integration\.test\.ts` paths.
- Verification — typecheck regression on `compass.repository.test.ts` and `compass.module.test.ts` (TS2502 / TS7022, circular type ref via `$transaction`). Fixed with explicit fake-client shape types. oxlint warned on `CompassError`'s forwarding ctor (no-useless-constructor); kept ctor (it narrows `code` from `PekuloErrorCode` to `CompassErrorCode` at the call site, value the rule cannot see) with inline `oxlint-disable-next-line` + comment.

### Completion Notes

- **FR-1 (compass declare)** — `updateCompassInputSchema` enforces `objectif > 0` + `horizonYears ∈ [1, 60]`. `service.updateCompass` delegates to `repository.upsertCompassWithHistory`.
- **FR-2 (compass edit + audit)** — `repository.upsertCompassWithHistory` writes `Hypothesis.upsert` + `CompassHistory.create` inside one `prisma.$transaction`. Audit table is INSERT + SELECT-only (RLS). Prior values archived = older rows in `compass_history`.
- **FR-5 (compass progress compute)** — `derive/compass-progress.ts` is pure: returns `{ percent (1-decimal), gap }`, throws `CompassError("INVALID_TARGET")` / `CompassError("INVALID_WEALTH")` on bad inputs.
- **FR-8 (setup-incomplete CTA)** — `service.getSetupState` returns `'incomplete'` when no compass row OR no milestone (probe stub always returns `false` until story 1-2 swaps it).
- **NFR-8 (RLS coverage)** — all `prisma.*` and `tx.*` queries in `compass.repository.ts` carry `where: { userId }` (lint-enforced, prismaIdentifier extended to `["prisma","tx"]`). `compass_history` has 2 RLS policies (no UPDATE / no DELETE) — verified by `db:rls-audit` script.
- **DR-4 (audit table policies)** — `compass_history` ENABLE RLS + 2 policies (SELECT, INSERT) appended manually to the migration SQL.
- **L8 re-applied** — module factory + router types let TS infer (`ReturnType<typeof createCompassRouter>`); never `Elysia` annotation.
- **L24 re-applied** — `decimalToNumber()` extracted to `common/derive/decimal-to-number.ts` (was inline in hypothesis); applied at every Decimal → DTO boundary in `compass.repository.ts`. Hypothesis service refactor to consume the extracted helper is OUT OF SCOPE per the story.

**Deviations from spec:**
- T1 migration SQL written manually (Supabase pooler hang) instead of via `prisma migrate dev`. Functionally identical — migration directory + `migration.sql` exist on disk and will be applied at deploy.
- T11 ships fake-Prisma tests (no live DB harness) — AC-5 / AC-6 covered by complementary mechanisms (lint + db:rls-audit) per pre-implementation user decision.
- T8 — added `compassSetupStateOutputSchema` to `@pekulo/validators` instead of inlining `z.object({ state: ... })` in the contract (keeps `@pekulo/contracts` zod-free, mirrors `hypothesis.contract.ts`).
- Added `"test": "bun test"` to `apps/api/package.json` (was missing — CI fan-out `bun --filter='*' run test` was silently skipping it).
- `PekuloError.name` typing relaxed from `"PekuloError"` literal to `string` so `CompassError` can narrow it (TS2416). Runtime duck-type in `isPekuloError` still demands exact equality, so cross-realm payloads with mutated names cannot pass through.

**Follow-ups (none blocking review):**
- Live-DB integration harness (`test-db.ts` with Postgres-in-Docker + `db.rawQuery`) — pick up alongside the first downstream story that needs it (1-2 / 2-1 / etc.). Until then, AC-5 / AC-6 lean on lint + `db:rls-audit`.
- Hypothesis service refactor to consume `decimalToNumber` from `common/derive` — out of scope here per Dev Notes; track as a small refactor on a later story (1-2 plausibly).

### File List

**Created:**
- `apps/api/prisma/schema/compass.prisma`
- `apps/api/prisma/migrations/20260509150000_create_compass_history/migration.sql`
- `apps/api/src/common/derive/decimal-to-number.ts`
- `apps/api/src/common/derive/decimal-to-number.test.ts`
- `apps/api/src/common/derive/compass-progress.ts`
- `apps/api/src/common/derive/compass-progress.test.ts`
- `apps/api/src/modules/compass/compass.errors.ts`
- `apps/api/src/modules/compass/compass.types.ts`
- `apps/api/src/modules/compass/compass.repository.ts`
- `apps/api/src/modules/compass/compass.repository.test.ts`
- `apps/api/src/modules/compass/compass.service.ts`
- `apps/api/src/modules/compass/compass.service.test.ts`
- `apps/api/src/modules/compass/compass.routes.ts`
- `apps/api/src/modules/compass/compass.module.ts`
- `apps/api/src/modules/compass/compass.module.test.ts`
- `apps/api/src/modules/compass/compass.integration.test.ts`
- `packages/validators/src/compass.ts`

**Modified:**
- `packages/validators/src/index.ts` (re-export `./compass`)
- `packages/contracts/src/compass.contract.ts` (3 procedures replace empty scaffold)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (add `milestonePresenceProbe` + register `createCompassModule`)
- `apps/api/src/common/errors/pekulo-error.ts` (extend `PekuloErrorCode` with 4 compass codes; relax `name` type to `string`)
- `apps/api/src/platform/http/error-mapper.ts` (map 4 new codes to HTTP statuses)
- `apps/api/scripts/rls-audit.ts` (add `compass_history: 2`)
- `apps/api/package.json` (`"test": "bun test"`)
- `.oxlintrc.json` (`pekulo/no-prisma-query-without-user-id` `prismaIdentifier: ["prisma","tx"]` for apps/api)
- `.gitleaks.toml` (allowlist `apps/api/src/modules/*/[a-z]+\.integration\.test\.ts`)

**Not edited (referenced only):**
- `apps/api/prisma/schema/hypothesis.prisma`
- `apps/api/src/database/id-prefixes.config.ts` (`cph` already registered)
- `apps/api/src/modules/hypothesis/*` (refactor to consume extracted `decimalToNumber` is OUT OF SCOPE)

## Review Record

**Date:** 2026-05-09
**Auditors:** Spec, Code (backend), Edge & Hallucination
**Verdict:** done

Spec auditor APPROVED (7/7 ACs IMPLEMENTED, 12/12 tasks EVIDENT, HIGH confidence).
Code auditor APPROVED (security/performance/reliability/test-quality/architecture all green; 5 testing anti-patterns PASS).
Edge & Hallucination flagged 11 findings (0 BLOCKER, 5 MAJOR, 6 MINOR) — all RESOLVED in commit `2ba94eb`. Re-audit confirmed 11/11 RESOLVED, 0 regressions.

### Findings

#### Resolved

- **[MAJOR] M1 — `$transaction` rollback unprovable by tests** [`compass.repository.test.ts`]
  - Source: Edge — fake `$transaction` ran the callback without modelling rollback; AC-1 atomicity claim was untestable.
  - Resolution (`2ba94eb`): fake snapshots/restores in-memory stores around the callback; new test "AC-1 rollback" injects a `compassHistory.create` failure and asserts both rejection AND empty hypothesis store.

- **[MAJOR] M2 — `computeProgress` accepts `NaN`** [`compass-progress.ts:18-23`]
  - Source: Edge — `NaN <= 0` is `false`, returns `{percent: NaN, gap: NaN}` downstream.
  - Resolution (`2ba94eb`): `Number.isFinite()` guard on both `capitalTarget` and `currentWealth`; tests cover both NaN paths.

- **[MAJOR] M3 — `computeProgress` accepts `Infinity`** [`compass-progress.ts:18-28`]
  - Source: Edge — same root cause as M2.
  - Resolution (`2ba94eb`): covered by the same `Number.isFinite()` guard; explicit Infinity tests on both params.

- **[MAJOR] M4 — Rounding boundaries not pinned** [`compass-progress.ts:26`]
  - Source: Edge — only clean fixtures (7.5 / 33.3); no half-up boundary fixtures.
  - Resolution (`2ba94eb`): added 7.45 / 2.55 / 2.45 fixtures + comment documenting `Math.round` half-toward-+Infinity behaviour.

- **[MAJOR] M5 — Integration test missed JWT verifier branches** [`compass.integration.test.ts`]
  - Source: Edge — only missing-JWT and valid-JWT covered.
  - Resolution (`2ba94eb`): `signWith` helper + 3 tests (expired / wrong-issuer / wrong-audience) → all 401 UNAUTHORIZED.

- **[MINOR] m1 — `objectif` lacks upper bound** [`packages/validators/src/compass.ts`]
  - Resolution (`2ba94eb`): `.max(1e12)` cap (`MAX_OBJECTIF_EUR`); persona Alex caps ~1.5M, 1e12 is the float-precision guardrail.

- **[MINOR] m2 — Same-ms `valuedOn` collision in production** [`compass.repository.ts#listHistory`]
  - Resolution (`2ba94eb`): `orderBy: [{ valuedOn: "desc" }, { createdAt: "desc" }]` (createdAt has `@default(now())`, deterministic tie-break).

- **[MINOR] m3 — Whitespace `context.userId` slips through truthy guard** [`compass.routes.ts`]
  - Resolution (`2ba94eb`): `!context.userId?.trim()` on all three handlers (defense at route boundary; JWT verifier upstream produces clean UUIDs).

- **[MINOR] m4 — `listHistory(limit)` accepts 0 and negatives (Prisma reverse-pagination)** [`compass.repository.ts#listHistory`]
  - Resolution (`2ba94eb`): clamp to `[1, 200]` via `Math.min(200, Math.max(1, requested))`.

- **[MINOR] m5 — `getSetupState` doesn't pin probe-skip when compass is null** [`compass.service.test.ts`]
  - Resolution (`2ba94eb`): `mock` + `expect(probeMock).not.toHaveBeenCalled()`.

- **[MINOR] m6 — `getSetupState` probe-rejection contract not pinned** [`compass.service.test.ts`]
  - Resolution (`2ba94eb`): new test asserts probe rejection propagates (mapped to INTERNAL upstream).

#### Dismissed

None.

#### Unresolved

None.

### Verification

- Test command: `bun test` (in `apps/api`)
- Test output (final pass): **101 pass / 0 fail / 250 expect calls** (was 89 baseline; +12 hardening tests)
- Typecheck: `bun --filter='@pekulo/api' run typecheck` exit 0; `bun --filter='@pekulo/validators' run typecheck` exit 0
- Lint: `bunx oxlint apps/api/src/modules/compass/ apps/api/src/common/derive/ packages/validators/src/compass.ts` → 0 warnings, 0 errors (158 rules, 15 files)
- Lefthook pre-commit: gitleaks ✓, oxlint ✓, oxfmt ✓
- Visual verification: N/A — backend story (no UI surface).

### Ticket sync

- Ticket comment posted: https://github.com/yabafre/pekulo/issues/13#issuecomment-4412690399
- PR opened: https://github.com/yabafre/pekulo/pull/73 (base `main`)
