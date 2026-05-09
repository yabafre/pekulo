# Story: 1-2-milestones-domain — Milestones CRUD + reorder + per-milestone status

**Epic:** Epic 1 — Compass & milestones (V1 differentiator)
**Status:** review
**Ticket:** [#14](https://github.com/yabafre/pekulo/issues/14)
**Branch:** `feature/14-1-2-milestones-domain`
**Commit prefix:** `feat(#14): …`
**Depends on:** 1-1-compass-domain (done)

## User Story

**As a** Pekulo user, **I want** to add up to 20 intermediate milestones (capital + year), reorder/edit/delete them, and see each one tagged `ahead | on-track | behind`, **so that** the long-horizon compass is decomposed into actionable checkpoints I can act on.

## Acceptance Criteria

- **AC-1 (CRUD happy path):** **Given** user A has a compass `(objectif=800_000, horizonYears=25)`, **When** the service `add({ targetCapital: 100_000, targetYear: currentYear+5, label: "First flat" })` is called for user A, **Then** a `Milestone` row is inserted with prefixed `id` matching `/^mst_[0-9A-Za-z]{21}$/` AND `list()` for user A returns exactly that row in the response. The repository's `where: { userId }` clause is asserted by the lint rule.
- **AC-2 (≤ 20 cap):** **Given** user A has 20 milestones, **When** `add(...)` is called for user A, **Then** the call rejects with `MilestoneError("MILESTONE_LIMIT_EXCEEDED", "milestones cap is 20 per user")` → HTTP 409. **And** `list()` for user A still returns exactly 20 rows.
- **AC-3 (year < compass horizon, strict):** **Given** user A has compass `(horizonYears=25)`, **When** `add({ targetYear: currentYear+25 })` is called, **Then** the call rejects with `MilestoneError("MILESTONE_YEAR_OUT_OF_RANGE", "targetYear must be in [currentYear+1, currentYear+horizonYears-1]")` → HTTP 400. **And** `add({ targetYear: currentYear+24 })` succeeds (boundary inside).
- **AC-4 (year > current year, strict):** **Given** user A has compass, **When** `add({ targetYear: currentYear })` is called, **Then** the call rejects with `MilestoneError("MILESTONE_YEAR_OUT_OF_RANGE", ...)` → HTTP 400. **And** `add({ targetYear: currentYear+1 })` succeeds (boundary inside).
- **AC-5 (compass required):** **Given** user A has NO compass row in `hypotheses`, **When** `add(...)` is called, **Then** the call rejects with `MilestoneError("COMPASS_REQUIRED", "compass must be set before adding milestones")` → HTTP 409.
- **AC-6 (auto-sort by year asc):** **Given** user A adds milestones in this order — `(year=currentYear+8, capital=200_000)`, `(year=currentYear+3, capital=80_000)`, `(year=currentYear+5, capital=120_000)`, **When** `list()` is called, **Then** the response is in year-ascending order: `[currentYear+3, currentYear+5, currentYear+8]`. **And When** the middle one (currentYear+5) is deleted via `delete({ id })`, **Then** `list()` returns `[currentYear+3, currentYear+8]`.
- **AC-7 (update + reorder via year change):** **Given** user A has milestones at years `[currentYear+3, currentYear+8]`, **When** `update({ id: id_of_currentYear+3, targetYear: currentYear+10 })` is called, **Then** the call succeeds AND `list()` returns the rows in order `[currentYear+8, currentYear+10]`.
- **AC-8 (cross-user isolation):** **Given** user A owns a milestone with id `M`, **When** user B calls `delete({ id: M })`, **Then** the call rejects with `MilestoneError("MILESTONE_NOT_FOUND", ...)` → HTTP 404 AND user A's `list()` still returns the row (no deletion happened). The `where: { id, userId }` clause is the defense-in-depth proof; RLS at the SQL layer is the second line.
- **AC-9 (`computeStatuses` determinism — Q3=A formula):** **Given** `currentWealth = 60_000`, `currentYear = 2026`, compass `(objectif=800_000, horizonYears=25)`, and milestones `[ (capital=80_000, year=2030), (capital=200_000, year=2035), (capital=500_000, year=2045) ]`, **When** `computeStatuses({ currentWealth, currentYear, compass, milestones })` runs, **Then** it returns deterministically (same inputs → same outputs across calls) the statuses `["ahead", "ahead", "ahead"]` with `expectedAt` values `[178_400, 326_400, 622_400]` and `delta` values `[-98_400, -126_400, -122_400]` — see Dev Notes "AC-9 fixture math" for the linear-plan derivation.
- **AC-10 (`computeStatuses` edge cases):** **Given** compass is missing → throws `MilestoneError("COMPASS_REQUIRED", ...)`. **Given** `horizonYears <= 0`, `currentWealth < 0`, or `compass.objectif <= 0` → throws `MilestoneError("INVALID_TARGET", ...)` (re-used from compass codes). **Given** an empty milestones array → returns `[]`. **Given** `milestone.targetYear <= currentYear` → throws `MilestoneError("MILESTONE_YEAR_OUT_OF_RANGE", ...)` (defense in depth — service validates before persisting, but the helper guards too).
- **AC-11 (`MilestonePresenceProbe` swap):** **Given** the milestones module is wired in `runtime-dependencies.ts`, **When** `compass.getSetupState(userId)` is called for a user with compass + ≥ 1 milestone, **Then** the response is `'complete'`. **And When** the same user has compass but 0 milestones, **Then** the response is `'incomplete'`. The probe is `milestonesModule.presenceProbe`, NOT the stub from story 1-1.
- **AC-12 (RLS — 4 policies):** **Given** the migration `<timestamp>_create_milestones` is applied, **When** `psql` reports policies on `milestones`, **Then** exactly 4 policies exist (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — full quartet (regular CRUD, not audit). Asserted by the `db:rls-audit` script extended with `milestones: 4`.
- **AC-13 (oRPC HTTP boundary):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls `POST /rpc/v1/milestones/add` with body `{ targetCapital: 100_000, targetYear: 2030, label: "First flat" }`, **Then** the response is HTTP 200 with body matching `{ id: /^mst_/, userId: "...", targetCapital: 100000, targetYear: 2030, label: "First flat", position: 0 }`. **And Given** no JWT, **When** the same call is made, **Then** the response is HTTP 401 within 100 ms with body shape `{ error: { code: "UNAUTHORIZED", … } }`.
- **AC-14 (lint guard active):** **Given** the milestones module ships, **When** `oxlint apps/api/src/modules/milestones/milestones.repository.ts` runs, **Then** it exits 0 — every Prisma query carries `where: { userId }` (or `where: { id, userId }` for single-row finds). The `prismaIdentifier: ["prisma","tx"]` override from `.oxlintrc.json` (story 1-1) is inherited; no `.oxlintrc.json` edit needed.

## Tasks

- [x] T1 — Add `MilestoneStatus` enum to `enums.prisma` + `Milestone` model in `milestones.prisma` + migration with full RLS quartet [AC: AC-12, AC-1]
- [x] T2 — Add `@pekulo/validators` milestones schemas + barrel re-export [AC: AC-1, AC-2, AC-3, AC-4, AC-7, AC-9, AC-13]
- [x] T3 — Implement `apps/api/src/common/derive/milestone-status.ts` (pure helper) + unit test [AC: AC-9, AC-10]
- [x] T4 — Extend `PekuloErrorCode` union + `PEKULO_ERROR_CODES` set + `ORPC_HTTP_STATUS_BY_CODE` with the 5 new milestone codes [AC: AC-2, AC-3, AC-4, AC-5, AC-8, AC-10]
- [x] T5 — Implement `milestones.errors.ts` + `milestones.types.ts` (`Milestone`, `MilestoneStatusEntry`, `CompassReader`, `MilestonePresenceProbe`) [AC: AC-2, AC-3, AC-4, AC-5, AC-8, AC-9, AC-11]
- [x] T6 — Implement `milestones.repository.ts` (`add`, `update`, `delete`, `listByUser`, `findByIdForUser`, `countByUser`, `hasAny`) + repository.test.ts (fake-Prisma) [AC: AC-1, AC-6, AC-7, AC-8, AC-11, AC-14]
- [x] T7 — Implement `milestones.service.ts` (cap + year-range + compass-existence enforcement, `computeStatuses` delegation) + service.test.ts [AC: AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10]
- [x] T8 — Populate `packages/contracts/src/milestones.contract.ts` (5 procedures with Zod I/O) [AC: AC-13]
- [x] T9 — Implement `milestones.routes.ts` (oRPC handlers, mirror `compass.routes.ts`) [AC: AC-13]
- [x] T10 — Implement `milestones.module.ts` factory + `presenceProbe` export [AC: AC-11, AC-13]
- [x] T11 — Wire `runtime-dependencies.ts`: instantiate `milestonesModule` with a Prisma-backed `compassReader`, replace stub probe with `milestonesModule.presenceProbe`, register `milestones` in `orpcRouter` [AC: AC-11, AC-13]
- [x] T12 — Update `apps/api/scripts/rls-audit.ts`: `milestones: 4` in `EXPECTED_POLICY_COUNTS` [AC: AC-12]
- [x] T13 — Add `milestones.module.test.ts` (whole-module wired flow on fake Prisma) [AC: AC-1, AC-2, AC-6, AC-7, AC-11]
- [x] T14 — Add `milestones.integration.test.ts` (oRPC HTTP boundary, mirrors `compass.integration.test.ts`) [AC: AC-13]

## Dev Notes

### AC-9 fixture math (linear-plan derivation)

For AC-9 with `currentWealth=60_000`, `compass=(objectif=800_000, horizonYears=25)`, `currentYear=2026`:

- slope = `(800_000 - 60_000) / 25 = 29_600` €/year
- 2030 (offset 4): `expectedAt = 60_000 + 29_600 × 4 = 178_400` ; `delta = 80_000 - 178_400 = -98_400` ; tolerance = `5% × 80_000 = 4_000` ; `|delta| > tolerance` ∧ `delta < 0` → `'ahead'`.
- 2035 (offset 9): `expectedAt = 60_000 + 29_600 × 9 = 326_400` ; `delta = 200_000 - 326_400 = -126_400` ; tolerance = `10_000` ; → `'ahead'`.
- 2045 (offset 19): `expectedAt = 60_000 + 29_600 × 19 = 622_400` ; `delta = 500_000 - 622_400 = -122_400` ; tolerance = `25_000` ; → `'ahead'`.

### Architecture references

- **Module factory shape (ADR-0009)** — `apps/api/src/modules/milestones/{milestones.module.ts, milestones.routes.ts, milestones.service.ts, milestones.repository.ts, milestones.errors.ts, milestones.types.ts}` plus `milestones.{module,service,repository,integration}.test.ts`. Factory returns `{ service, router, presenceProbe }` (the third member exposes the Prisma-backed `MilestonePresenceProbe` so `runtime-dependencies.ts` can wire it back into the compass module — closes AC-11). **Never annotate `Elysia` or the router type — let TS infer (L8, story 1-1 explicit).** Mirror `apps/api/src/modules/compass/compass.module.ts`.
- **Hard layering (ADR-0010)** — Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. This story is API-only (UI in 1-4), so the chain ends at Elysia; the service stays free of Prisma imports, the repository is the single Prisma touch-point.
- **RLS defense in depth (ADR-0013)** — every Prisma query in `milestones.repository.ts` carries explicit `where: { userId }` (single-row finds use `where: { id, userId }`). Lint rule `pekulo/no-prisma-query-without-user-id` (story 0-12) blocks omissions; the `prismaIdentifier: ["prisma","tx"]` override from `.oxlintrc.json` is inherited (no edit needed — milestones repository does not use `$transaction` in this story).
- **Decimal coercion (L24, story 1-2 explicit)** — Postgres `Decimal` columns surface as `Prisma.Decimal` instances; coerce via the extracted `decimalToNumber` helper at `apps/api/src/common/derive/decimal-to-number.ts` (extracted in story 1-1). DO NOT inline `Number(decimal)`. DO NOT duplicate the helper.
- **Prefixed IDs (ADR-0012)** — `Milestone.id` = `mst_{base62-21}` injected by the prefixed-ids extension. Prefix `mst` is already registered at `apps/api/src/database/id-prefixes.config.ts:30`. **No edit to id-prefixes.config.ts required.**
- **Migration discipline (ADR-0014)** — `prisma migrate dev --name create_milestones --create-only` writes `apps/api/prisma/migrations/<timestamp>_create_milestones/`. Forward-only. **The 4 RLS policies (full CRUD quartet — regular table, NOT audit) are appended manually to the migration SQL — Prisma does not introspect policies.** `db:rls-audit` re-asserts coverage. **If `prisma migrate dev` hangs (Supabase pooler issue documented in story 1-1's deviation), write the SQL manually under `apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql` and run `prisma migrate deploy` at apply time.**
- **Naming (Phase 3, architecture.md L370)** — Prisma model `Milestone` (PascalCase singular); table `milestones` (plural snake_case for new tables — `@@map("milestones")`); contract module key `milestones`; mount path `/rpc/v1/milestones`.
- **oRPC handler shape** — mirror `apps/api/src/modules/compass/compass.routes.ts:18-39`. Use `implement(milestonesContract).$context<{ userId: string; email: string | null }>().router({ ... })`. Each handler verifies `context.userId?.trim()` and throws `new PekuloError("UNAUTHORIZED", "user context missing")` when absent.
- **MilestoneStatus Postgres enum (Q2=B forward-compat)** — declared in `enums.prisma` as `enum MilestoneStatus { ahead on_track behind @@map("milestone_status") }`. **Postgres identifiers cannot contain hyphens**, hence `on_track` (snake) at the DB layer. The TS-side validator `milestoneStatusSchema` keeps the kebab form `'on-track'` (matches PRD/AC literal). **No DB column references the enum at V1** — pure forward-compat: if a future story persists status (e.g. `last_status MilestoneStatus`), an explicit `'on-track' ↔ 'on_track'` mapping is added at write time. Document this asymmetry in the validator file's header comment.
- **`position Int` column (Q6=B forward-compat)** — added to `Milestone` for V2 drag-and-drop. **No `reorder({ id, position })` procedure ships in this story** (would conflict with FR-4's auto-sort by year ascending). The column defaults to `0`; sort order at V1 is `[targetYear asc, position asc, createdAt asc]`. Repository never writes `position` from input — it's `Prisma.skip`-equivalent on every `add` / `update`.

### Lessons re-applied

- **L8 (Elysia 1.4 invariant — explicitly listed for story 1-2 territory in epic-1-context.md, lessons.md L233)** — never annotate variables/parameters as bare `Elysia`. The milestones module factory returns inferred types: `export function createMilestonesModule(deps): MilestonesModule` where `MilestonesModule` interface uses `ReturnType<typeof createMilestonesRouter>` — same shape as `compass.module.ts:13-16`.
- **L24 (`Number(decimal)` truncates above MAX_SAFE_INTEGER — explicitly listed in epic-1 cache for story 1-2)** — apply `decimalToNumber()` at the row→DTO boundary in `milestones.repository.ts`. The extracted helper from `apps/api/src/common/derive/decimal-to-number.ts` (story 1-1) is the single mechanism. Do NOT re-extract.
- **L23 (Bun frozen-lockfile workspace coverage)** — N/A: no new workspace member added; only new files inside existing `apps/api`, `packages/validators`, `packages/contracts`.
- **L25 (AsyncLocalStorage / Next minor bumps)** — N/A: this story is API-only; no `apps/web` work.
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s package script `test` runs `bun test` (Bun's native runner). All `*.test.ts` under `apps/api/src/**` use `import { describe, expect, mock, test } from "bun:test"`.
- **0-12 lint rule active** — `pekulo/no-prisma-query-without-user-id` runs on `apps/api/**/*.ts` with `prismaIdentifier: ["prisma","tx"]`. Every method in `milestones.repository.ts` MUST include `where: { userId }` (or `where: { id, userId }`). The lint will fail CI if a query omits the guard.
- **Story 1-1 outcome — CompassReader pattern (Q4=A)** — milestones service must read compass `(objectif, horizonYears)` for AC-3/AC-5/AC-9. Decision: a `CompassReader` interface declared in `milestones.types.ts`; the adapter is wired in `runtime-dependencies.ts` with a closure on `prismaService.client.hypothesis.findUnique` (NOT on `compassService`) — keeps the milestones module decoupled from compass internals AND avoids a circular instantiation risk (compass depends on `milestonePresenceProbe`; milestones must NOT depend on `compassService` at construction time).

### Existing code at write time (Step-0 quote — verbatim, do not paraphrase)

`apps/api/prisma/schema/enums.prisma` (current):

```prisma
// enums.prisma — the four brownfield Postgres enums.
// Pekulo enum NAMES are PascalCase in TS (Prisma generated client) and bound to
// the lower-case Postgres enum names via @@map.

enum AccountType {
  livret
  pea
  cto
  av
  autre

  @@map("account_type")
}

enum HoldingKind {
  // V1 brownfield only — the 'crypto' extension is owned by story 3-1.
  etf
  action
  autre

  @@map("holding_kind")
}

enum TransactionType {
  inflow
  outflow

  @@map("transaction_type")
}

enum LotType {
  buy
  sell

  @@map("lot_type")
}
```

`packages/validators/src/index.ts` (current):

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./hypothesis";
export * from "./compass";
```

`packages/contracts/src/milestones.contract.ts` (current — empty scaffold from story 0-5; T8 replaces it):

```ts
// packages/contracts/src/milestones.contract.ts
// Milestones module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/milestones).

export const milestonesContractV1 = {} as const;
export const milestonesContract = milestonesContractV1;
export const milestonesContractMeta = {
  moduleKey: "milestones",
  mountPath: "/rpc/v1/milestones",
  version: "v1",
} as const;
```

`apps/api/src/common/errors/pekulo-error.ts` (current — T4 extends both the `PekuloErrorCode` union and the `PEKULO_ERROR_CODES` runtime set with the 5 new codes):

```ts
export type PekuloErrorCode =
  | "BAD_REQUEST"
  | "COMPASS_NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL"
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TRANSACTION_FAILED"
  | "UNAUTHORIZED";

const PEKULO_ERROR_CODES: ReadonlySet<PekuloErrorCode> = new Set<PekuloErrorCode>([
  "BAD_REQUEST",
  "COMPASS_NOT_FOUND",
  "CONFLICT",
  "FORBIDDEN",
  "INTERNAL",
  "INVALID_TARGET",
  "INVALID_WEALTH",
  "NOT_FOUND",
  "RATE_LIMITED",
  "TRANSACTION_FAILED",
  "UNAUTHORIZED",
]);
```

`apps/api/src/platform/http/error-mapper.ts` (current — `ORPC_HTTP_STATUS_BY_CODE` lookup that T4 extends with the 5 new codes):

```ts
export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  // Compass domain validation (story 1-1, FR-5): both surface as 400 — they
  // signal invalid client input to computeProgress (capitalTarget <= 0 /
  // currentWealth < 0). Keep distinct codes so clients can localise messages.
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  // Compass-specific 404 (story 1-1) — distinguishes "compass row missing"
  // from generic NOT_FOUND so dashboard can branch on the setup CTA (FR-8).
  COMPASS_NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  // Compass repository $transaction failure surfaces as 500 — the audit
  // write and the upsert must commit atomically; partial state is unrecoverable.
  TRANSACTION_FAILED: 500,
};
```

`apps/api/src/bootstrap/runtime-dependencies.ts` (current — T11 replaces the stub probe block + adds the milestones module wiring):

```ts
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createCompassModule } from "../modules/compass/compass.module";
import type { MilestonePresenceProbe } from "../modules/compass/compass.types";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
  orpcRouter: PekuloRpcRouter;
  milestonePresenceProbe: MilestonePresenceProbe;
}

// … readiness + jwtVerifier setup unchanged …

  const hypothesisModule = createHypothesisModule({ prismaService });
  // Story 1-2 swaps this stub for a Prisma-backed probe wired through the
  // milestones repository. Until then the compass setup is reported
  // 'incomplete' whenever a milestone presence is required (FR-8).
  const milestonePresenceProbe: MilestonePresenceProbe = {
    async hasAny() {
      return false;
    },
  };
  const compassModule = createCompassModule({ prismaService, milestonePresenceProbe });
  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
  };
```

`apps/api/scripts/rls-audit.ts` (excerpt — T12 adds `milestones: 4` to the lookup):

```ts
const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
  // compass_history is an audit sister table per ADR-0001 — INSERT + SELECT
  // only, no UPDATE/DELETE policies. AC-6 of story 1-1 asserts this count.
  compass_history: 2,
};
```

`apps/api/src/database/id-prefixes.config.ts` (excerpt — `mst` already registered, no edit needed):

```ts
export const ID_PREFIXES = {
  // … other prefixes
  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",
  // …
} as const satisfies Record<string, string>;
```

`apps/api/src/modules/compass/compass.types.ts` (current — `MilestonePresenceProbe` lives here; the milestones module **imports** it from compass to keep the contract single-source):

```ts
// Probe used by getSetupState to decide whether at least one milestone exists
// for the given user. Story 1-1 ships a stub that always returns false (no
// milestone domain yet — FR-8). Story 1-2 swaps it for a real Prisma-backed
// probe wired via runtime-dependencies.ts.
export interface MilestonePresenceProbe {
  hasAny(userId: string): Promise<boolean>;
}
```

### File decisions (3-bullet template per file — full list in `## File List` below)

**NEW:**

- **F1 — `apps/api/prisma/schema/milestones.prisma`** (NEW)
  - Responsibility: declare `Milestone` Prisma model + `@@map("milestones")`. References the `MilestoneStatus` enum forward-compat (no column uses it; declared in F2).
  - I/O: schema folder picks it up; no runtime imports.

- **F2 — `apps/api/prisma/schema/enums.prisma`** (MOD — append `MilestoneStatus` enum block; existing 4 enums unchanged)
  - Responsibility: forward-compat declaration of `MilestoneStatus { ahead on_track behind }` mapped to `milestone_status`.
  - I/O: no column references it at V1; future stories may persist a status column.

- **F3 — `apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql`** (NEW, written manually if `prisma migrate dev` hangs on Supabase pooler)
  - Responsibility: DDL for the `milestone_status` Postgres enum + `milestones` table + index + manually-appended **4 RLS policies** (SELECT / INSERT / UPDATE / DELETE — full quartet).
  - I/O: consumed by `prisma migrate deploy` (Dokploy hook).

- **F4 — `packages/validators/src/milestones.ts`** (NEW)
  - Responsibility: Zod schemas — `addMilestoneInputSchema`, `updateMilestoneInputSchema`, `deleteMilestoneInputSchema`, `milestoneSchema`, `milestoneStatusSchema`, `milestoneStatusEntrySchema`, `getStatusesInputSchema`, `listMilestonesOutputSchema`, `getStatusesOutputSchema`.
  - I/O: imports `zod`; exports schemas + inferred types.

- **F5 — `apps/api/src/common/derive/milestone-status.ts`** (NEW, pure helper)
  - Responsibility: pure compute `computeStatuses({ currentWealth, currentYear, compass, milestones }) → MilestoneStatusEntry[]`. Implements the linear-plan formula + ±5 % tolerance band (Q3=A).
  - I/O: imports `MilestoneError` from `../../modules/milestones/milestones.errors` + types from `milestones.types`; exports the function and its I/O types.

- **F6 — `apps/api/src/common/derive/milestone-status.test.ts`** (NEW)
  - Responsibility: unit tests for F5 (AC-9 fixture + edge cases AC-10).
  - I/O: imports F5 + `bun:test`.

- **F7 — `apps/api/src/modules/milestones/milestones.errors.ts`** (NEW)
  - Responsibility: typed `MilestoneError` extending `PekuloError`. Codes: `MILESTONE_LIMIT_EXCEEDED`, `MILESTONE_YEAR_OUT_OF_RANGE`, `MILESTONE_NOT_FOUND`, `MILESTONE_INVALID_CAPITAL`, `COMPASS_REQUIRED`. Re-uses `INVALID_TARGET` / `INVALID_WEALTH` from compass codes for AC-10 helper guards.
  - I/O: imports `PekuloError`; exports `MilestoneError` + `MilestoneErrorCode`.

- **F8 — `apps/api/src/modules/milestones/milestones.types.ts`** (NEW)
  - Responsibility: domain types — `Milestone`, `MilestoneStatus`, `MilestoneStatusEntry`, `CompassReader`, re-export `MilestonePresenceProbe` from compass module for downstream callers.
  - I/O: imports types only; exports types only.

- **F9 — `apps/api/src/modules/milestones/milestones.repository.ts`** (NEW)
  - Responsibility: Prisma layer — `add(userId, input)`, `update(userId, id, input)`, `delete(userId, id)`, `listByUser(userId)`, `findByIdForUser(userId, id)`, `countByUser(userId)`, `hasAny(userId)`. Sort: `[targetYear asc, position asc, createdAt asc]`.
  - I/O: imports `ExtendedPrismaClient`, `decimalToNumber`, types from F8; exports repository factory.

- **F10 — `apps/api/src/modules/milestones/milestones.repository.test.ts`** (NEW)
  - Responsibility: repository unit tests against fake Prisma — AC-1 / AC-6 / AC-7 / AC-8 / AC-11 (`hasAny`).
  - I/O: imports F9 + `bun:test` + `Prisma.Decimal` from `@generated/prisma/client`.

- **F11 — `apps/api/src/modules/milestones/milestones.service.ts`** (NEW)
  - Responsibility: business logic — `add` (cap + year-range + compass-existence checks), `update`, `delete`, `list`, `computeStatuses` (delegates to F5).
  - I/O: imports F5, F7, F8, F9; exports service factory.

- **F12 — `apps/api/src/modules/milestones/milestones.service.test.ts`** (NEW)
  - Responsibility: service unit tests with stubbed repo + stubbed `CompassReader` (AC-2..7, AC-9, AC-10 logic branches).
  - I/O: imports F11 + `bun:test`.

- **F13 — `apps/api/src/modules/milestones/milestones.routes.ts`** (NEW)
  - Responsibility: oRPC handlers bound to `milestonesContract` (5 procedures: `add`, `update`, `delete`, `list`, `getStatuses`).
  - I/O: imports F11, `milestonesContract` from `@pekulo/contracts`, `PekuloError`; exports `createMilestonesRouter`.

- **F14 — `apps/api/src/modules/milestones/milestones.module.ts`** (NEW)
  - Responsibility: factory `createMilestonesModule({ prismaService, compassReader })` returning `{ service, router, presenceProbe }`. The `presenceProbe` adapts the repository's `hasAny` into the `MilestonePresenceProbe` shape from compass.
  - I/O: imports F9, F11, F13, F8 (`MilestonePresenceProbe`); exports `MilestonesModule` interface + factory.

- **F15 — `apps/api/src/modules/milestones/milestones.module.test.ts`** (NEW)
  - Responsibility: whole-module wired flow against fake Prisma.
  - I/O: imports F14 + `bun:test`.

- **F16 — `apps/api/src/modules/milestones/milestones.integration.test.ts`** (NEW)
  - Responsibility: oRPC HTTP boundary (AC-13) — mirrors `compass.integration.test.ts`.
  - I/O: imports F13 + Elysia + jose + `mountOrpc`.

**MODIFIED:**

- **F17 — `packages/validators/src/index.ts`** — append `export * from "./milestones";`.
- **F18 — `packages/contracts/src/milestones.contract.ts`** — replace empty scaffold with 5 procedures.
- **F19 — `apps/api/src/common/errors/pekulo-error.ts`** — extend `PekuloErrorCode` union + `PEKULO_ERROR_CODES` set with the 5 new codes.
- **F20 — `apps/api/src/platform/http/error-mapper.ts`** — register HTTP statuses for the 5 new codes (409 / 400 / 404 / 400 / 409).
- **F21 — `apps/api/src/bootstrap/runtime-dependencies.ts`** — instantiate milestonesModule first, replace stub probe, add `milestones` to `orpcRouter`.
- **F22 — `apps/api/scripts/rls-audit.ts`** — add `milestones: 4` to `EXPECTED_POLICY_COUNTS`.

---

### Execution Tasks (full granularity — exact paths, full code blocks, exact test commands, expected output, commit step)

#### T1 — Add `MilestoneStatus` enum + `Milestone` model + migration with full RLS quartet

**Step 1.1** — Append `MilestoneStatus` to `apps/api/prisma/schema/enums.prisma` (do NOT edit the existing four enums):

```prisma
// MilestoneStatus — forward-compat enum (Q2=B, story 1-2). No column references it
// at V1 — declared so a future story can persist a snapshot status without a
// schema-level migration. Postgres identifiers do not allow hyphens, hence
// `on_track` (snake) at the DB layer; the API/UI surface uses kebab `'on-track'`
// via @pekulo/validators (mapping at write time when a column lands).
enum MilestoneStatus {
  ahead
  on_track
  behind

  @@map("milestone_status")
}
```

**Step 1.2** — Create `apps/api/prisma/schema/milestones.prisma`:

```prisma
// apps/api/prisma/schema/milestones.prisma
// Milestone — intermediate checkpoints between today's wealth and the compass.
// FR-3 / FR-4 / FR-6. Regular CRUD table (NOT audit) — full RLS quartet.
// `position` ships as forward-compat for V2 drag-and-drop (Q6=B, story 1-2);
// at V1 the sort order is [targetYear asc, position asc, createdAt asc] and
// the column is never written from input (defaults to 0 for every row).

model Milestone {
  id            String   @id
  userId        String   @map("user_id") @db.Uuid
  targetCapital Decimal  @map("target_capital") @db.Decimal
  targetYear    Int      @map("target_year") @db.SmallInt
  label         String?  @db.VarChar(120)
  position      Int      @default(0) @db.SmallInt
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@index([userId, targetYear(sort: Asc)])
  @@map("milestones")
}
```

**Step 1.3** — Generate the migration scaffold (DO NOT apply yet):

```bash
cd apps/api && bun x prisma migrate dev --name create_milestones --create-only
```

If this hangs (Supabase pooler issue documented in story 1-1's deviation), abort with Ctrl-C and create the file manually at `apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql` with the contents below. Otherwise open the generated `<timestamp>_create_milestones/migration.sql` and **append** the RLS block at the end of the file.

**Step 1.4** — The migration file must contain (literal SQL):

```sql
-- CreateEnum
CREATE TYPE "milestone_status" AS ENUM ('ahead', 'on_track', 'behind');

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "target_capital" DECIMAL NOT NULL,
    "target_year" SMALLINT NOT NULL,
    "label" VARCHAR(120),
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_user_id_target_year_idx" ON "milestones"("user_id", "target_year" ASC);

-- RLS policies (manually appended — Prisma does not introspect policies).
-- milestones is a regular CRUD table — full quartet (SELECT / INSERT / UPDATE / DELETE).
-- AC-12 of story 1-2: db:rls-audit asserts exactly 4 policies on this table.
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own milestones" ON "milestones"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own milestones" ON "milestones"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own milestones" ON "milestones"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own milestones" ON "milestones"
  FOR DELETE USING (auth.uid() = user_id);
```

**Step 1.5** — Apply the migration locally:

```bash
cd apps/api && bun x prisma migrate dev
```

Expected: `Database is now in sync with your schema. Generated Prisma Client (...) to ./generated/prisma`.

If `migrate dev` hangs again, run `bun x prisma migrate deploy` instead; both apply forward.

Run: `cd apps/api && bun x prisma format --check && bun x prisma validate`
Expected: both exit 0.

Commit:
```bash
git add apps/api/prisma/schema/enums.prisma apps/api/prisma/schema/milestones.prisma apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql
git commit -m "feat(#14): Milestone model + MilestoneStatus enum + RLS quartet (T1)"
```

#### T2 — Add `@pekulo/validators` milestones schemas + barrel re-export

Create `packages/validators/src/milestones.ts`:

```ts
// Zod source of truth for the milestone domain. Consumed by @pekulo/contracts
// (oRPC procedure I/O) and apps/api milestones service / handler.
//
// Note on MilestoneStatus (Q2=B, story 1-2): the Postgres enum (declared in
// apps/api/prisma/schema/enums.prisma forward-compat) uses `on_track` (snake),
// while the API/UI surface uses `'on-track'` (kebab) per PRD/AC literal.
// No DB column references the enum at V1 — the asymmetry only matters when a
// future story persists a snapshot status (then a write-time mapping kicks in).

import { z } from "zod";

// Upper bound on targetCapital matches compass MAX_OBJECTIF_EUR (1e12).
const MAX_TARGET_CAPITAL_EUR = 1_000_000_000_000;
const MAX_LABEL_LENGTH = 120;
const PREFIXED_ID_RE = /^mst_[0-9A-Za-z]{21}$/;

export const milestoneIdSchema = z
  .string()
  .regex(PREFIXED_ID_RE, "id must match /^mst_[0-9A-Za-z]{21}$/");

export const milestoneStatusSchema = z.enum(["ahead", "on-track", "behind"]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const addMilestoneInputSchema = z.object({
  targetCapital: z
    .number()
    .positive("targetCapital must be > 0")
    .max(MAX_TARGET_CAPITAL_EUR, `targetCapital must be <= ${MAX_TARGET_CAPITAL_EUR}`),
  targetYear: z.number().int().min(1, "targetYear must be a positive integer"),
  label: z
    .string()
    .trim()
    .min(1, "label cannot be empty whitespace")
    .max(MAX_LABEL_LENGTH, `label must be <= ${MAX_LABEL_LENGTH} chars`)
    .optional(),
});
export type AddMilestoneInput = z.infer<typeof addMilestoneInputSchema>;

export const updateMilestoneInputSchema = z
  .object({
    id: milestoneIdSchema,
    targetCapital: z
      .number()
      .positive("targetCapital must be > 0")
      .max(MAX_TARGET_CAPITAL_EUR)
      .optional(),
    targetYear: z.number().int().min(1).optional(),
    label: z.string().trim().min(1).max(MAX_LABEL_LENGTH).nullable().optional(),
  })
  .refine(
    (v) => v.targetCapital !== undefined || v.targetYear !== undefined || v.label !== undefined,
    { message: "at least one of targetCapital / targetYear / label must be provided" },
  );
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>;

export const deleteMilestoneInputSchema = z.object({ id: milestoneIdSchema });
export type DeleteMilestoneInput = z.infer<typeof deleteMilestoneInputSchema>;

export const milestoneSchema = z.object({
  id: milestoneIdSchema,
  userId: z.string().uuid(),
  targetCapital: z.number(),
  targetYear: z.number().int(),
  label: z.string().nullable(),
  position: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const milestoneStatusEntrySchema = z.object({
  id: milestoneIdSchema,
  status: milestoneStatusSchema,
  expectedAt: z.number(),
  delta: z.number(),
});
export type MilestoneStatusEntry = z.infer<typeof milestoneStatusEntrySchema>;

export const listMilestonesOutputSchema = z.array(milestoneSchema);

export const getStatusesInputSchema = z.object({
  currentWealth: z.number().min(0, "currentWealth must be >= 0"),
});
export type GetStatusesInput = z.infer<typeof getStatusesInputSchema>;

export const getStatusesOutputSchema = z.array(milestoneStatusEntrySchema);

export const deleteMilestoneOutputSchema = z.object({ id: milestoneIdSchema });
export type DeleteMilestoneOutput = z.infer<typeof deleteMilestoneOutputSchema>;
```

Update `packages/validators/src/index.ts` (replace the file with):

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./hypothesis";
export * from "./compass";
export * from "./milestones";
```

Run: `bun --filter='@pekulo/validators' run build && bun --filter='@pekulo/validators' run lint`
Expected: both exit 0.

Commit:
```bash
git add packages/validators/src/milestones.ts packages/validators/src/index.ts
git commit -m "feat(#14): @pekulo/validators milestones schemas (T2)"
```

#### T3 — Implement `apps/api/src/common/derive/milestone-status.ts` + unit test

Create `apps/api/src/common/derive/milestone-status.ts`:

```ts
// Pure helper for FR-6 — per-milestone status against a linear plan from
// today's wealth to the compass target. Q3=A formula:
//
//   expectedAt(year) = currentWealth + (compass.objectif - currentWealth)
//                       × (year - currentYear) / compass.horizonYears
//   delta            = milestone.targetCapital - expectedAt(milestone.targetYear)
//   tolerance        = 0.05 × milestone.targetCapital   // ±5% band
//
//   |delta| ≤ tolerance       → 'on-track'
//   delta < 0                 → 'ahead'   (target sits below the line — comfortable margin)
//   delta > 0                 → 'behind'  (target sits above the line — needs out-performance)
//
// Pure: no I/O. Defense-in-depth guards (NaN / negative / out-of-range) match
// the route boundary's Zod validation but are also asserted here because the
// helper is callable from any module (dashboard composition, service tests).

import { MilestoneError } from "../../modules/milestones/milestones.errors";
import type { MilestoneStatus, MilestoneStatusEntry } from "../../modules/milestones/milestones.types";

export interface ComputeStatusesInput {
  currentWealth: number;
  currentYear: number;
  compass: { objectif: number; horizonYears: number };
  milestones: ReadonlyArray<{ id: string; targetCapital: number; targetYear: number }>;
}

const TOLERANCE_RATIO = 0.05;

export function computeStatuses(input: ComputeStatusesInput): MilestoneStatusEntry[] {
  if (!Number.isFinite(input.currentWealth) || input.currentWealth < 0) {
    throw new MilestoneError("INVALID_WEALTH", "currentWealth must be a finite number >= 0");
  }
  if (!Number.isFinite(input.currentYear) || !Number.isInteger(input.currentYear)) {
    throw new MilestoneError("INVALID_TARGET", "currentYear must be a finite integer");
  }
  if (!Number.isFinite(input.compass.objectif) || input.compass.objectif <= 0) {
    throw new MilestoneError("INVALID_TARGET", "compass.objectif must be a finite number > 0");
  }
  if (
    !Number.isFinite(input.compass.horizonYears) ||
    !Number.isInteger(input.compass.horizonYears) ||
    input.compass.horizonYears <= 0
  ) {
    throw new MilestoneError("INVALID_TARGET", "compass.horizonYears must be a positive integer");
  }

  const slope = (input.compass.objectif - input.currentWealth) / input.compass.horizonYears;

  return input.milestones.map((m) => {
    if (!Number.isFinite(m.targetCapital) || m.targetCapital <= 0) {
      throw new MilestoneError(
        "MILESTONE_INVALID_CAPITAL",
        `milestone ${m.id}: targetCapital must be > 0`,
      );
    }
    if (!Number.isInteger(m.targetYear) || m.targetYear <= input.currentYear) {
      throw new MilestoneError(
        "MILESTONE_YEAR_OUT_OF_RANGE",
        `milestone ${m.id}: targetYear must be a future integer year`,
      );
    }
    const yearOffset = m.targetYear - input.currentYear;
    const expectedAt = input.currentWealth + slope * yearOffset;
    const delta = m.targetCapital - expectedAt;
    const tolerance = TOLERANCE_RATIO * m.targetCapital;
    let status: MilestoneStatus;
    if (Math.abs(delta) <= tolerance) status = "on-track";
    else if (delta < 0) status = "ahead";
    else status = "behind";
    return { id: m.id, status, expectedAt, delta };
  });
}
```

Create `apps/api/src/common/derive/milestone-status.test.ts`:

```ts
// Unit tests for milestone-status.ts (FR-6). AC-9 fixture + AC-10 edge cases.

import { describe, expect, test } from "bun:test";
import { computeStatuses } from "./milestone-status";

const COMPASS = { objectif: 800_000, horizonYears: 25 };
const CURRENT_WEALTH = 60_000;
const CURRENT_YEAR = 2026;

describe("computeStatuses (AC-9 fixture)", () => {
  test("returns deterministic ahead/on-track/behind per milestone", () => {
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [
        { id: "mst_a".padEnd(25, "x"), targetCapital: 80_000, targetYear: 2030 },
        { id: "mst_b".padEnd(25, "x"), targetCapital: 200_000, targetYear: 2035 },
        { id: "mst_c".padEnd(25, "x"), targetCapital: 500_000, targetYear: 2045 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["ahead", "ahead", "ahead"]);
    expect(result[0]!.expectedAt).toBeCloseTo(178_400, 1);
    expect(result[0]!.delta).toBeCloseTo(-98_400, 1);
  });

  test("returns 'on-track' when target sits inside ±5% band", () => {
    // Linear plan at year+10 from (60k, year=2026) toward 800k at horizon=25:
    //   expectedAt = 60_000 + 740_000 × 10/25 = 356_000
    // Pick a target inside ±5% of itself around 356k → e.g. target = 350_000
    // |350_000 - 356_000| = 6_000 ; 5% × 350_000 = 17_500 → on-track.
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [{ id: "mst_b".padEnd(25, "x"), targetCapital: 350_000, targetYear: 2036 }],
    });
    expect(result[0]!.status).toBe("on-track");
  });

  test("returns 'behind' when target sits above the line (beyond +5%)", () => {
    // expectedAt at year+5 = 60_000 + 740_000 × 5/25 = 208_000
    // Target = 300_000 → delta = +92_000 ; 5% × 300_000 = 15_000 → behind.
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [{ id: "mst_c".padEnd(25, "x"), targetCapital: 300_000, targetYear: 2031 }],
    });
    expect(result[0]!.status).toBe("behind");
  });
});

describe("computeStatuses (AC-10 edge cases)", () => {
  test("returns [] for empty milestones array", () => {
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [],
    });
    expect(result).toEqual([]);
  });

  test("throws INVALID_WEALTH on negative currentWealth", () => {
    expect(() =>
      computeStatuses({
        currentWealth: -1,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [],
      }),
    ).toThrow(/currentWealth must be a finite number >= 0/);
  });

  test("throws INVALID_WEALTH on NaN currentWealth", () => {
    expect(() =>
      computeStatuses({
        currentWealth: NaN,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [],
      }),
    ).toThrow(/currentWealth must be a finite number >= 0/);
  });

  test("throws INVALID_TARGET on compass.objectif <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: { objectif: 0, horizonYears: 25 },
        milestones: [],
      }),
    ).toThrow(/compass.objectif must be a finite number > 0/);
  });

  test("throws INVALID_TARGET on horizonYears <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: { objectif: 800_000, horizonYears: 0 },
        milestones: [],
      }),
    ).toThrow(/compass.horizonYears must be a positive integer/);
  });

  test("throws MILESTONE_YEAR_OUT_OF_RANGE on targetYear <= currentYear", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [
          { id: "mst_z".padEnd(25, "x"), targetCapital: 100_000, targetYear: CURRENT_YEAR },
        ],
      }),
    ).toThrow(/targetYear must be a future integer year/);
  });

  test("throws MILESTONE_INVALID_CAPITAL on targetCapital <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [
          { id: "mst_z".padEnd(25, "x"), targetCapital: 0, targetYear: 2030 },
        ],
      }),
    ).toThrow(/targetCapital must be > 0/);
  });
});
```

Run: `cd apps/api && bun test src/common/derive/milestone-status.test.ts`
Expected: `Tests: 9 passed`, exit 0.

Commit:
```bash
git add apps/api/src/common/derive/milestone-status.ts apps/api/src/common/derive/milestone-status.test.ts
git commit -m "feat(#14): computeStatuses pure helper + unit tests (T3)"
```

#### T4 — Extend `PekuloErrorCode` + `ORPC_HTTP_STATUS_BY_CODE`

Edit `apps/api/src/common/errors/pekulo-error.ts` — replace the `PekuloErrorCode` union and the `PEKULO_ERROR_CODES` set with the extended versions. The full new file content:

```ts
// apps/api/src/common/errors/pekulo-error.ts
// Domain error base class — every typed error thrown by apps/api services
// (CompassError, MilestoneError, LlmRoutingError, …) extends PekuloError.
// The error-mapper matches on `code` to derive the HTTP status.

/**
 * Stable error codes for the V1 (a) personal-use phase. The list will grow
 * as feature stories add module-specific errors (e.g. `INVALID_LOT`,
 * `LLM_ROUTE_DOWN`). Keep the union sorted alphabetically for readability.
 *
 * Discipline (review F9): every new code MUST update both `PekuloErrorCode`
 * AND `ORPC_HTTP_STATUS_BY_CODE` in the same commit, with the HTTP status
 * reviewed against RFC-7231/RFC-6585. The `Record<PekuloErrorCode, number>`
 * type on `ORPC_HTTP_STATUS_BY_CODE` is the compile-time guard.
 */
export type PekuloErrorCode =
  | "BAD_REQUEST"
  | "COMPASS_NOT_FOUND"
  | "COMPASS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL"
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "MILESTONE_INVALID_CAPITAL"
  | "MILESTONE_LIMIT_EXCEEDED"
  | "MILESTONE_NOT_FOUND"
  | "MILESTONE_YEAR_OUT_OF_RANGE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TRANSACTION_FAILED"
  | "UNAUTHORIZED";

const PEKULO_ERROR_CODES: ReadonlySet<PekuloErrorCode> = new Set<PekuloErrorCode>([
  "BAD_REQUEST",
  "COMPASS_NOT_FOUND",
  "COMPASS_REQUIRED",
  "CONFLICT",
  "FORBIDDEN",
  "INTERNAL",
  "INVALID_TARGET",
  "INVALID_WEALTH",
  "MILESTONE_INVALID_CAPITAL",
  "MILESTONE_LIMIT_EXCEEDED",
  "MILESTONE_NOT_FOUND",
  "MILESTONE_YEAR_OUT_OF_RANGE",
  "NOT_FOUND",
  "RATE_LIMITED",
  "TRANSACTION_FAILED",
  "UNAUTHORIZED",
]);

export class PekuloError extends Error {
  override readonly name: string = "PekuloError";
  readonly code: PekuloErrorCode;

  constructor(code: PekuloErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

export function isPekuloError(err: unknown): err is PekuloError {
  if (err instanceof PekuloError) return true;
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    "code" in err &&
    "message" in err &&
    (err as { name: unknown }).name === "PekuloError" &&
    typeof (err as { message: unknown }).message === "string" &&
    typeof (err as { code: unknown }).code === "string" &&
    PEKULO_ERROR_CODES.has((err as { code: PekuloErrorCode }).code)
  ) {
    return true;
  }
  return false;
}
```

Edit `apps/api/src/platform/http/error-mapper.ts` — replace the `ORPC_HTTP_STATUS_BY_CODE` literal with the extended one:

```ts
export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  // Compass domain validation (story 1-1, FR-5): both surface as 400 — they
  // signal invalid client input to computeProgress (capitalTarget <= 0 /
  // currentWealth < 0). Keep distinct codes so clients can localise messages.
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  // Milestones domain (story 1-2, FR-3 / FR-4): malformed capital and
  // out-of-range year both surface as 400.
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  // Compass-specific 404 (story 1-1) — distinguishes "compass row missing"
  // from generic NOT_FOUND so dashboard can branch on the setup CTA (FR-8).
  COMPASS_NOT_FOUND: 404,
  // Milestones 404 — preserved when a cross-user delete probe walks off the
  // userId guard (AC-8). Distinct from NOT_FOUND so future telemetry can
  // separate "row missing" from "route missing".
  MILESTONE_NOT_FOUND: 404,
  CONFLICT: 409,
  // Milestones cap (FR-3, ≤ 20/user) and missing compass (FR-8 precondition)
  // both surface as 409 — they signal a state-shape conflict, not malformed
  // input.
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  // Compass repository $transaction failure surfaces as 500 — the audit
  // write and the upsert must commit atomically; partial state is unrecoverable.
  TRANSACTION_FAILED: 500,
};
```

Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run lint`
Expected: both exit 0 (the `Record<PekuloErrorCode, number>` constraint forces all 16 codes to be present — TS catches any omission).

Commit:
```bash
git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts
git commit -m "feat(#14): extend PekuloErrorCode with 5 milestones codes + HTTP statuses (T4)"
```

#### T5 — Implement `milestones.errors.ts` + `milestones.types.ts`

Create `apps/api/src/modules/milestones/milestones.errors.ts`:

```ts
// Typed error class for the milestones module. Extends PekuloError so the
// Elysia error mapper translates it to an oRPC error with the matching HTTP
// status — the milestone codes are registered in ORPC_HTTP_STATUS_BY_CODE.
//
// Story 1-2 reuses `INVALID_TARGET` and `INVALID_WEALTH` from the compass
// codes (both 400) for the pure-helper guards in milestone-status.ts —
// keeps the error vocabulary stable across the epic.

import { PekuloError } from "../../common/errors";

export type MilestoneErrorCode =
  | "MILESTONE_LIMIT_EXCEEDED"
  | "MILESTONE_YEAR_OUT_OF_RANGE"
  | "MILESTONE_NOT_FOUND"
  | "MILESTONE_INVALID_CAPITAL"
  | "COMPASS_REQUIRED"
  // Reused compass codes (declared in pekulo-error.ts) — surfaced from the
  // pure helper for consistency with computeProgress's input-guard semantics.
  | "INVALID_TARGET"
  | "INVALID_WEALTH";

export class MilestoneError extends PekuloError {
  override readonly name = "MilestoneError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to MilestoneErrorCode. Without it, `new MilestoneError("UNAUTHORIZED", ...)`
  // would type-check.
  // oxlint-disable-next-line no-useless-constructor
  constructor(code: MilestoneErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}
```

Create `apps/api/src/modules/milestones/milestones.types.ts`:

```ts
// Public type surface for the milestones module. Wired via the module factory.
//
// CompassReader is the small read-only contract the milestones service needs
// from the compass aggregate (Q4=A, story 1-2). The adapter is injected at
// module construction by runtime-dependencies.ts as a closure over Prisma —
// NOT over the compass service — to avoid a circular dependency at module
// instantiation (compass module needs MilestonePresenceProbe; if milestones
// also depended on compass.service, both modules would block on each other).
//
// MilestonePresenceProbe is re-exported from the compass module to keep the
// shape single-source. The milestones module produces an instance of it
// (presenceProbe member of the module factory output).

import type { Milestone, MilestoneStatus, MilestoneStatusEntry } from "@pekulo/validators";
import type { MilestonePresenceProbe } from "../compass/compass.types";

export type { Milestone, MilestoneStatus, MilestoneStatusEntry, MilestonePresenceProbe };

export interface CompassReader {
  /** Read the user's compass shape (objectif + horizonYears) or null. */
  read(userId: string): Promise<{ objectif: number; horizonYears: number } | null>;
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.errors.ts apps/api/src/modules/milestones/milestones.types.ts
git commit -m "feat(#14): MilestoneError + milestones types (T5)"
```

#### T6 — Implement `milestones.repository.ts` + `repository.test.ts` (fake-Prisma)

Create `apps/api/src/modules/milestones/milestones.repository.ts`:

```ts
// Prisma layer for the milestones module. Six responsibilities:
//   - add(userId, input): insert one row (id auto-injected by prefixedIds extension).
//   - update(userId, id, input): patch row, scoped by userId AND id.
//   - delete(userId, id): delete row, scoped by userId AND id.
//   - listByUser(userId): read rows ordered by [targetYear asc, position asc, createdAt asc].
//   - findByIdForUser(userId, id): single-row probe for update/delete preconditions.
//   - countByUser(userId): for the ≤ 20 cap (FR-3).
//   - hasAny(userId): for the MilestonePresenceProbe (FR-8).
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). Single-row finds use `where: { id, userId }`. The lint rule
// pekulo/no-prisma-query-without-user-id (story 0-12) gates this on every
// method below.

import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { Milestone } from "./milestones.types";
import type { AddMilestoneInput, UpdateMilestoneInput } from "@pekulo/validators";

export interface MilestoneRepository {
  add(userId: string, input: AddMilestoneInput): Promise<Milestone>;
  update(userId: string, id: string, input: Omit<UpdateMilestoneInput, "id">): Promise<Milestone | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listByUser(userId: string): Promise<Milestone[]>;
  findByIdForUser(userId: string, id: string): Promise<Milestone | null>;
  countByUser(userId: string): Promise<number>;
  hasAny(userId: string): Promise<boolean>;
}

type MilestoneRow = {
  id: string;
  userId: string;
  targetCapital: unknown;
  targetYear: number;
  label: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

function rowToMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    userId: row.userId,
    targetCapital: decimalToNumber(row.targetCapital, 0),
    targetYear: row.targetYear,
    label: row.label,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createMilestoneRepository(deps: {
  client: ExtendedPrismaClient;
}): MilestoneRepository {
  return {
    async add(userId, input) {
      const created = await deps.client.milestone.create({
        data: {
          userId,
          targetCapital: input.targetCapital,
          targetYear: input.targetYear,
          label: input.label ?? null,
          // position not written from input — Q6=B forward-compat (default 0).
        } as unknown as Parameters<typeof deps.client.milestone.create>[0]["data"],
      });
      return rowToMilestone(created as unknown as MilestoneRow);
    },

    async update(userId, id, input) {
      // updateMany scoped by { id, userId } so a cross-user attempt yields
      // count=0 (defense in depth on top of RLS). Returning null lets the
      // service raise MILESTONE_NOT_FOUND uniformly.
      const result = await deps.client.milestone.updateMany({
        where: { id, userId },
        data: {
          ...(input.targetCapital !== undefined ? { targetCapital: input.targetCapital } : {}),
          ...(input.targetYear !== undefined ? { targetYear: input.targetYear } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return null;
      const row = await deps.client.milestone.findFirst({ where: { id, userId } });
      return row ? rowToMilestone(row as unknown as MilestoneRow) : null;
    },

    async delete(userId, id) {
      const result = await deps.client.milestone.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async listByUser(userId) {
      const rows = await deps.client.milestone.findMany({
        where: { userId },
        orderBy: [{ targetYear: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      });
      return rows.map((r) => rowToMilestone(r as unknown as MilestoneRow));
    },

    async findByIdForUser(userId, id) {
      const row = await deps.client.milestone.findFirst({ where: { id, userId } });
      return row ? rowToMilestone(row as unknown as MilestoneRow) : null;
    },

    async countByUser(userId) {
      return deps.client.milestone.count({ where: { userId } });
    },

    async hasAny(userId) {
      const found = await deps.client.milestone.findFirst({
        where: { userId },
        select: { id: true },
      });
      return found !== null;
    },
  };
}
```

Create `apps/api/src/modules/milestones/milestones.repository.test.ts`:

```ts
// Repository unit tests against a fake Prisma client (no live DB) — same
// fake-client style as compass.repository.test.ts. AC coverage:
//   - AC-1 (add + list happy path)
//   - AC-6 (auto-sort by year asc + delete middle)
//   - AC-7 (update changes year + re-sort)
//   - AC-8 (cross-user delete returns false; row remains)
//   - AC-11 (hasAny returns true after add, false on empty)
//   - AC-14 (lint rule asserted statically by oxlint, not here)
//
// Live-DB integration harness still deferred (carry-over from story 1-1).

import { describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createMilestoneRepository } from "./milestones.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

interface Row {
  id: string;
  userId: string;
  targetCapital: Prisma.Decimal;
  targetYear: number;
  label: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function fakeClient() {
  const rows: Row[] = [];
  let now = Date.now();
  let nextId = 0;
  const ts = () => new Date(now++);
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;

  const create = mock(
    async (args: {
      data: { userId: string; targetCapital: number; targetYear: number; label: string | null };
    }) => {
      const row: Row = {
        id: mintId(),
        userId: args.data.userId,
        targetCapital: new Prisma.Decimal(args.data.targetCapital),
        targetYear: args.data.targetYear,
        label: args.data.label,
        position: 0,
        createdAt: ts(),
        updatedAt: ts(),
      };
      rows.push(row);
      return row;
    },
  );

  const updateMany = mock(
    async (args: {
      where: { id: string; userId: string };
      data: { targetCapital?: number; targetYear?: number; label?: string | null; updatedAt: Date };
    }) => {
      const idx = rows.findIndex((r) => r.id === args.where.id && r.userId === args.where.userId);
      if (idx < 0) return { count: 0 };
      const row = rows[idx]!;
      if (args.data.targetCapital !== undefined)
        row.targetCapital = new Prisma.Decimal(args.data.targetCapital);
      if (args.data.targetYear !== undefined) row.targetYear = args.data.targetYear;
      if (args.data.label !== undefined) row.label = args.data.label;
      row.updatedAt = args.data.updatedAt;
      return { count: 1 };
    },
  );

  const deleteMany = mock(async (args: { where: { id: string; userId: string } }) => {
    const before = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]!;
      if (r.id === args.where.id && r.userId === args.where.userId) rows.splice(i, 1);
    }
    return { count: before - rows.length };
  });

  const findMany = mock(
    async (args: {
      where: { userId: string };
      orderBy: Array<{ targetYear?: "asc" | "desc"; position?: "asc"; createdAt?: "asc" }>;
    }) => {
      return rows
        .filter((r) => r.userId === args.where.userId)
        .sort(
          (a, b) =>
            a.targetYear - b.targetYear ||
            a.position - b.position ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
    },
  );

  const findFirst = mock(
    async (args: { where: { id?: string; userId: string }; select?: unknown }) => {
      return (
        rows.find((r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id)) ??
        null
      );
    },
  );

  const count = mock(async (args: { where: { userId: string } }) => {
    return rows.filter((r) => r.userId === args.where.userId).length;
  });

  type FakeClient = {
    milestone: {
      create: typeof create;
      updateMany: typeof updateMany;
      deleteMany: typeof deleteMany;
      findMany: typeof findMany;
      findFirst: typeof findFirst;
      count: typeof count;
    };
  };

  const client: FakeClient = {
    milestone: { create, updateMany, deleteMany, findMany, findFirst, count },
  };
  return { client, rows };
}

describe("milestones.repository", () => {
  test("add + listByUser returns the row (AC-1)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const m = await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030, label: "First flat" });
    expect(m.id).toMatch(/^mst_/);
    expect(m.targetCapital).toBe(100_000);
    expect(m.label).toBe("First flat");
    const list = await repo.listByUser(USER_A);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(m.id);
  });

  test("listByUser sorts by year asc + delete middle re-sorts (AC-6)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const a = await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const b = await repo.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    const c = await repo.add(USER_A, { targetCapital: 120_000, targetYear: 2032 });
    const sorted = await repo.listByUser(USER_A);
    expect(sorted.map((m) => m.targetYear)).toEqual([2030, 2032, 2034]);
    const ok = await repo.delete(USER_A, c.id);
    expect(ok).toBe(true);
    const after = await repo.listByUser(USER_A);
    expect(after.map((m) => m.targetYear)).toEqual([2030, 2034]);
    expect(after.map((m) => m.id)).toEqual([b.id, a.id]);
  });

  test("update changes year and list re-sorts (AC-7)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const early = await repo.add(USER_A, { targetCapital: 80_000, targetYear: 2029 });
    await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const updated = await repo.update(USER_A, early.id, { targetYear: 2036 });
    expect(updated).not.toBeNull();
    expect(updated!.targetYear).toBe(2036);
    const list = await repo.listByUser(USER_A);
    expect(list.map((m) => m.targetYear)).toEqual([2034, 2036]);
  });

  test("delete with wrong userId returns false; row remains (AC-8)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const m = await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    const ok = await repo.delete(USER_B, m.id);
    expect(ok).toBe(false);
    const list = await repo.listByUser(USER_A);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(m.id);
  });

  test("hasAny is false on empty, true after add (AC-11)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    expect(await repo.hasAny(USER_A)).toBe(false);
    await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await repo.hasAny(USER_A)).toBe(true);
    expect(await repo.hasAny(USER_B)).toBe(false);
  });

  test("countByUser counts only own rows", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2035 });
    await repo.add(USER_B, { targetCapital: 50_000, targetYear: 2028 });
    expect(await repo.countByUser(USER_A)).toBe(2);
    expect(await repo.countByUser(USER_B)).toBe(1);
  });
});
```

Run: `cd apps/api && bun test src/modules/milestones/milestones.repository.test.ts && bun x oxlint src/modules/milestones/milestones.repository.ts`
Expected: `Tests: 6 passed`, exit 0; oxlint exit 0 (AC-14).

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.repository.ts apps/api/src/modules/milestones/milestones.repository.test.ts
git commit -m "feat(#14): milestones repository + fake-Prisma tests (T6)"
```

#### T7 — Implement `milestones.service.ts` + `service.test.ts`

Create `apps/api/src/modules/milestones/milestones.service.ts`:

```ts
// Domain service for the milestones module. Owns:
//   - add: enforce ≤ 20 cap (FR-3), year ∈ [currentYear+1, currentYear+horizonYears-1] strict,
//          compass existence (FR-8 precondition).
//   - update: enforce existence (cross-user yields MILESTONE_NOT_FOUND), year-range guard
//             when targetYear is updated.
//   - delete: enforce existence (cross-user yields MILESTONE_NOT_FOUND).
//   - list: passthrough to repository.
//   - computeStatuses: thin wrapper around the pure helper, requires compass presence.

import type {
  AddMilestoneInput,
  Milestone,
  MilestoneStatusEntry,
  UpdateMilestoneInput,
} from "@pekulo/validators";
import { computeStatuses } from "../../common/derive/milestone-status";
import { MilestoneError } from "./milestones.errors";
import type { CompassReader, MilestonePresenceProbe } from "./milestones.types";
import type { MilestoneRepository } from "./milestones.repository";

export const MILESTONES_PER_USER_CAP = 20;

export interface MilestoneService {
  add(userId: string, input: AddMilestoneInput): Promise<Milestone>;
  update(userId: string, input: UpdateMilestoneInput): Promise<Milestone>;
  delete(userId: string, id: string): Promise<{ id: string }>;
  list(userId: string): Promise<Milestone[]>;
  computeStatuses(userId: string, currentWealth: number): Promise<MilestoneStatusEntry[]>;
  presenceProbe(): MilestonePresenceProbe;
}

function assertYearInRange(
  targetYear: number,
  currentYear: number,
  horizonYears: number,
): void {
  // Strict: targetYear must be in [currentYear+1, currentYear+horizonYears-1].
  // currentYear excluded (AC-4); compass horizon (currentYear+horizonYears)
  // excluded (AC-3).
  const minYear = currentYear + 1;
  const maxYear = currentYear + horizonYears - 1;
  if (!Number.isInteger(targetYear) || targetYear < minYear || targetYear > maxYear) {
    throw new MilestoneError(
      "MILESTONE_YEAR_OUT_OF_RANGE",
      `targetYear must be in [${minYear}, ${maxYear}] (got ${targetYear})`,
    );
  }
}

export function createMilestoneService(deps: {
  repository: MilestoneRepository;
  compassReader: CompassReader;
  now?: () => Date;
}): MilestoneService {
  const now = deps.now ?? (() => new Date());
  const currentYear = () => now().getUTCFullYear();

  return {
    async add(userId, input) {
      const compass = await deps.compassReader.read(userId);
      if (!compass) {
        throw new MilestoneError(
          "COMPASS_REQUIRED",
          "compass must be set before adding milestones",
        );
      }
      assertYearInRange(input.targetYear, currentYear(), compass.horizonYears);
      const count = await deps.repository.countByUser(userId);
      if (count >= MILESTONES_PER_USER_CAP) {
        throw new MilestoneError(
          "MILESTONE_LIMIT_EXCEEDED",
          `milestones cap is ${MILESTONES_PER_USER_CAP} per user`,
        );
      }
      return deps.repository.add(userId, input);
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      const existing = await deps.repository.findByIdForUser(userId, id);
      if (!existing) {
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      if (patch.targetYear !== undefined) {
        const compass = await deps.compassReader.read(userId);
        if (!compass) {
          throw new MilestoneError(
            "COMPASS_REQUIRED",
            "compass must be set before updating milestone year",
          );
        }
        assertYearInRange(patch.targetYear, currentYear(), compass.horizonYears);
      }
      const updated = await deps.repository.update(userId, id, patch);
      if (!updated) {
        // Race: row vanished between findByIdForUser and update — surface the
        // same not-found error rather than INTERNAL.
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      return updated;
    },

    async delete(userId, id) {
      const ok = await deps.repository.delete(userId, id);
      if (!ok) {
        throw new MilestoneError("MILESTONE_NOT_FOUND", `milestone ${id} not found`);
      }
      return { id };
    },

    async list(userId) {
      return deps.repository.listByUser(userId);
    },

    async computeStatuses(userId, currentWealth) {
      const compass = await deps.compassReader.read(userId);
      if (!compass) {
        throw new MilestoneError(
          "COMPASS_REQUIRED",
          "compass must be set before computing milestone statuses",
        );
      }
      const milestones = await deps.repository.listByUser(userId);
      return computeStatuses({
        currentWealth,
        currentYear: currentYear(),
        compass,
        milestones: milestones.map((m) => ({
          id: m.id,
          targetCapital: m.targetCapital,
          targetYear: m.targetYear,
        })),
      });
    },

    presenceProbe() {
      return {
        async hasAny(userId) {
          return deps.repository.hasAny(userId);
        },
      };
    },
  };
}
```

Create `apps/api/src/modules/milestones/milestones.service.test.ts`:

```ts
// Service unit tests with stubbed repository + stubbed CompassReader.
// AC coverage: AC-2 (cap), AC-3 (year range), AC-4 (year boundary), AC-5
// (compass required), AC-6/AC-7 (CRUD shape via repo), AC-8 (cross-user via
// repo not-found), AC-9 (computeStatuses delegation), AC-10 (helper edge
// cases re-asserted via service path).

import { describe, expect, test } from "bun:test";
import { createMilestoneService, MILESTONES_PER_USER_CAP } from "./milestones.service";
import type { MilestoneRepository } from "./milestones.repository";
import type { CompassReader, Milestone } from "./milestones.types";

const USER_A = "11111111-1111-1111-1111-111111111111";
const FIXED_NOW = () => new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
const CURRENT_YEAR = 2026;

function stubCompassReader(compass: { objectif: number; horizonYears: number } | null): CompassReader {
  return { async read() { return compass; } };
}

function stubRepo(initial: Milestone[] = []): MilestoneRepository {
  let rows = [...initial];
  let nextId = initial.length;
  return {
    async add(userId, input) {
      const m: Milestone = {
        id: `mst_${String(nextId++).padStart(21, "0")}`,
        userId,
        targetCapital: input.targetCapital,
        targetYear: input.targetYear,
        label: input.label ?? null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(m);
      return m;
    },
    async update(userId, id, input) {
      const idx = rows.findIndex((r) => r.id === id && r.userId === userId);
      if (idx < 0) return null;
      const row = rows[idx]!;
      const updated: Milestone = {
        ...row,
        targetCapital: input.targetCapital ?? row.targetCapital,
        targetYear: input.targetYear ?? row.targetYear,
        label: input.label !== undefined ? input.label : row.label,
        updatedAt: new Date(),
      };
      rows[idx] = updated;
      return updated;
    },
    async delete(userId, id) {
      const before = rows.length;
      rows = rows.filter((r) => !(r.id === id && r.userId === userId));
      return rows.length < before;
    },
    async listByUser(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => a.targetYear - b.targetYear);
    },
    async findByIdForUser(userId, id) {
      return rows.find((r) => r.userId === userId && r.id === id) ?? null;
    },
    async countByUser(userId) {
      return rows.filter((r) => r.userId === userId).length;
    },
    async hasAny(userId) {
      return rows.some((r) => r.userId === userId);
    },
  };
}

describe("milestones.service.add", () => {
  test("rejects when compass is missing (AC-5)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader(null),
      now: FIXED_NOW,
    });
    await expect(svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 })).rejects.toThrow(
      /compass must be set/,
    );
  });

  test("rejects when targetYear === currentYear (AC-4)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR })).rejects.toThrow(
      /targetYear must be in/,
    );
  });

  test("rejects when targetYear === currentYear + horizonYears (AC-3)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR + 25 }),
    ).rejects.toThrow(/targetYear must be in/);
  });

  test("accepts boundary targetYear === currentYear+1 (AC-4 inside)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    const m = await svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR + 1 });
    expect(m.targetYear).toBe(CURRENT_YEAR + 1);
  });

  test("accepts boundary targetYear === currentYear+horizonYears-1 (AC-3 inside)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    const m = await svc.add(USER_A, { targetCapital: 100_000, targetYear: CURRENT_YEAR + 24 });
    expect(m.targetYear).toBe(CURRENT_YEAR + 24);
  });

  test("rejects 21st add (AC-2)", async () => {
    const initial: Milestone[] = Array.from({ length: MILESTONES_PER_USER_CAP }, (_, i) => ({
      id: `mst_${String(i).padStart(21, "0")}`,
      userId: USER_A,
      targetCapital: 100_000 + i * 1000,
      targetYear: CURRENT_YEAR + i + 1,
      label: null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const svc = createMilestoneService({
      repository: stubRepo(initial),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(svc.add(USER_A, { targetCapital: 999_000, targetYear: CURRENT_YEAR + 22 })).rejects.toThrow(
      /milestones cap is 20 per user/,
    );
  });
});

describe("milestones.service.update", () => {
  test("returns MILESTONE_NOT_FOUND when row does not exist (AC-8)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(
      svc.update(USER_A, { id: "mst_" + "0".repeat(21), targetCapital: 100_000 }),
    ).rejects.toThrow(/not found/);
  });

  test("validates new targetYear against compass horizon (AC-3)", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({ repository: repo, compassReader: reader, now: FIXED_NOW });
    const m = await svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    await expect(svc.update(USER_A, { id: m.id, targetYear: CURRENT_YEAR + 25 })).rejects.toThrow(
      /targetYear must be in/,
    );
  });
});

describe("milestones.service.delete", () => {
  test("returns MILESTONE_NOT_FOUND on cross-user delete (AC-8)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader({ objectif: 800_000, horizonYears: 25 }),
      now: FIXED_NOW,
    });
    await expect(svc.delete(USER_A, "mst_" + "0".repeat(21))).rejects.toThrow(/not found/);
  });
});

describe("milestones.service.computeStatuses", () => {
  test("returns ahead/ahead/ahead for the AC-9 fixture", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({ repository: repo, compassReader: reader, now: FIXED_NOW });
    await svc.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    await svc.add(USER_A, { targetCapital: 200_000, targetYear: 2035 });
    await svc.add(USER_A, { targetCapital: 500_000, targetYear: 2045 });
    const result = await svc.computeStatuses(USER_A, 60_000);
    expect(result.map((r) => r.status)).toEqual(["ahead", "ahead", "ahead"]);
  });

  test("rejects when compass is missing (AC-10)", async () => {
    const svc = createMilestoneService({
      repository: stubRepo(),
      compassReader: stubCompassReader(null),
      now: FIXED_NOW,
    });
    await expect(svc.computeStatuses(USER_A, 60_000)).rejects.toThrow(/compass must be set/);
  });
});

describe("milestones.service.presenceProbe (AC-11)", () => {
  test("returns false on empty user, true after add", async () => {
    const repo = stubRepo();
    const reader = stubCompassReader({ objectif: 800_000, horizonYears: 25 });
    const svc = createMilestoneService({ repository: repo, compassReader: reader, now: FIXED_NOW });
    const probe = svc.presenceProbe();
    expect(await probe.hasAny(USER_A)).toBe(false);
    await svc.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await probe.hasAny(USER_A)).toBe(true);
  });
});
```

Run: `cd apps/api && bun test src/modules/milestones/milestones.service.test.ts`
Expected: `Tests: 11 passed`, exit 0.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.service.ts apps/api/src/modules/milestones/milestones.service.test.ts
git commit -m "feat(#14): milestones service + cap/year/compass guards + tests (T7)"
```

#### T8 — Populate `packages/contracts/src/milestones.contract.ts`

Replace `packages/contracts/src/milestones.contract.ts` with:

```ts
// packages/contracts/src/milestones.contract.ts
// Milestones module oRPC contract. Five procedures:
//   - add: insert a milestone (≤ 20/user, year ∈ [currentYear+1, horizon-1]).
//   - update: patch capital/year/label of an existing milestone.
//   - delete: remove a milestone scoped by id+userId.
//   - list: read all milestones for the user, sorted by year asc.
//   - getStatuses: compute per-milestone {ahead, on-track, behind} against the
//     linear plan from currentWealth (input) to compass target.
// See ADR-0009 (mount under /rpc/v1/milestones).

import { oc } from "@orpc/contract";
import {
  addMilestoneInputSchema,
  deleteMilestoneInputSchema,
  deleteMilestoneOutputSchema,
  getStatusesInputSchema,
  getStatusesOutputSchema,
  listMilestonesOutputSchema,
  milestoneSchema,
  updateMilestoneInputSchema,
} from "@pekulo/validators";

export const milestonesContractV1 = {
  add: oc.input(addMilestoneInputSchema).output(milestoneSchema),
  update: oc.input(updateMilestoneInputSchema).output(milestoneSchema),
  delete: oc.input(deleteMilestoneInputSchema).output(deleteMilestoneOutputSchema),
  list: oc.output(listMilestonesOutputSchema),
  getStatuses: oc.input(getStatusesInputSchema).output(getStatusesOutputSchema),
} as const;

export const milestonesContract = milestonesContractV1;
export const milestonesContractMeta = {
  moduleKey: "milestones",
  mountPath: "/rpc/v1/milestones",
  version: "v1",
} as const;
```

Run: `bun --filter='@pekulo/contracts' run typecheck && bun --filter='@pekulo/contracts' run lint`
Expected: both exit 0.

Commit:
```bash
git add packages/contracts/src/milestones.contract.ts
git commit -m "feat(#14): @pekulo/contracts milestones procedures (T8)"
```

#### T9 — Implement `milestones.routes.ts` (oRPC handlers)

Create `apps/api/src/modules/milestones/milestones.routes.ts`:

```ts
// oRPC handlers for the milestones module. Mirrors compass.routes.ts:
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401.

import { implement } from "@orpc/server";
import { milestonesContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { MilestoneService } from "./milestones.service";

const impl = implement(milestonesContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createMilestonesRouter(deps: { service: MilestoneService }) {
  return impl.router({
    add: impl.add.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.add(context.userId, input);
    }),
    update: impl.update.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.update(context.userId, input);
    }),
    delete: impl.delete.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.delete(context.userId, input.id);
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
    getStatuses: impl.getStatuses.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.computeStatuses(context.userId, input.currentWealth);
    }),
  });
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.routes.ts
git commit -m "feat(#14): milestones oRPC routes (5 procedures) (T9)"
```

#### T10 — Implement `milestones.module.ts` factory + `presenceProbe` export

Create `apps/api/src/modules/milestones/milestones.module.ts`:

```ts
// Module factory wiring repository + service + router for the milestones
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
// Exposes `presenceProbe` so runtime-dependencies.ts can wire it back into the
// compass module — closes story 1-2 AC-11.
//
// L8 (story 1-1 explicit, story 1-2 inherits): the router type is inferred via
// ReturnType<typeof createMilestonesRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createMilestoneRepository } from "./milestones.repository";
import { createMilestoneService, type MilestoneService } from "./milestones.service";
import { createMilestonesRouter } from "./milestones.routes";
import type { CompassReader, MilestonePresenceProbe } from "./milestones.types";

export interface MilestonesModule {
  service: MilestoneService;
  router: ReturnType<typeof createMilestonesRouter>;
  presenceProbe: MilestonePresenceProbe;
}

export function createMilestonesModule(deps: {
  prismaService: PrismaService;
  compassReader: CompassReader;
}): MilestonesModule {
  const repository = createMilestoneRepository({ client: deps.prismaService.client });
  const service = createMilestoneService({ repository, compassReader: deps.compassReader });
  const router = createMilestonesRouter({ service });
  return { service, router, presenceProbe: service.presenceProbe() };
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.module.ts
git commit -m "feat(#14): milestones module factory + presenceProbe export (T10)"
```

#### T11 — Wire `runtime-dependencies.ts`

Replace `apps/api/src/bootstrap/runtime-dependencies.ts` with:

```ts
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";
import { createJwtVerifier, type JwtVerifier } from "../platform/security";
import type { PekuloRpcRouter } from "../platform/http/orpc-mount";
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createCompassModule } from "../modules/compass/compass.module";
import { createMilestonesModule } from "../modules/milestones/milestones.module";
import { decimalToNumber } from "../common/derive/decimal-to-number";
import type { MilestonePresenceProbe } from "../modules/compass/compass.types";
import type { CompassReader } from "../modules/milestones/milestones.types";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
  orpcRouter: PekuloRpcRouter;
  milestonePresenceProbe: MilestonePresenceProbe;
}

// F10 (carry-over from 0-3): single transient probe failure should not yank
// traffic. Track consecutive failures and only flip ok:false after two in a
// row.
const PRISMA_PROBE_FAILURE_THRESHOLD = 2;

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

  let consecutivePrismaFailures = 0;
  readiness.register("prisma", async () => {
    try {
      await prismaService.client.$queryRaw`SELECT 1`;
      consecutivePrismaFailures = 0;
      return { ok: true };
    } catch (err) {
      consecutivePrismaFailures += 1;
      const reason = err instanceof Error ? err.message : String(err);
      if (consecutivePrismaFailures < PRISMA_PROBE_FAILURE_THRESHOLD) {
        return { ok: true, reason: `prisma transient (${reason})` };
      }
      return {
        ok: false,
        reason: `prisma down (${consecutivePrismaFailures} consecutive): ${reason}`,
      };
    }
  });

  const jwtVerifier = createJwtVerifier({
    secret: input.env.SUPABASE_JWT_SECRET,
    issuer: `${input.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
    audience: "authenticated",
  });
  const hypothesisModule = createHypothesisModule({ prismaService });

  // Story 1-2 wiring (Q4=A + Q5):
  //   - milestonesModule is built FIRST with a Prisma-backed CompassReader
  //     that closes over prismaService (NOT over compassService) — keeps the
  //     two modules instantiation-acyclic.
  //   - compassModule receives milestonesModule.presenceProbe (real probe,
  //     replacing the stub from story 1-1).
  const compassReader: CompassReader = {
    async read(userId) {
      const row = await prismaService.client.hypothesis.findUnique({
        where: { userId },
        select: { objectif: true, horizonYears: true },
      });
      if (!row) return null;
      return {
        objectif: decimalToNumber(row.objectif, 0),
        horizonYears: row.horizonYears,
      };
    },
  };
  const milestonesModule = createMilestonesModule({ prismaService, compassReader });
  const compassModule = createCompassModule({
    prismaService,
    milestonePresenceProbe: milestonesModule.presenceProbe,
  });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
  };

  return {
    env: input.env,
    readiness,
    prismaService,
    jwtVerifier,
    orpcRouter,
    milestonePresenceProbe: milestonesModule.presenceProbe,
  };
}
```

Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run lint`
Expected: both exit 0.

Commit:
```bash
git add apps/api/src/bootstrap/runtime-dependencies.ts
git commit -m "feat(#14): wire milestones module + real presence probe + compass reader (T11)"
```

#### T12 — Update `apps/api/scripts/rls-audit.ts`

Edit `apps/api/scripts/rls-audit.ts` — extend `EXPECTED_POLICY_COUNTS`:

```ts
const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
  // compass_history is an audit sister table per ADR-0001 — INSERT + SELECT
  // only, no UPDATE/DELETE policies. AC-6 of story 1-1 asserts this count.
  compass_history: 2,
  // milestones is a regular CRUD table — full quartet (SELECT/INSERT/UPDATE/DELETE).
  // AC-12 of story 1-2 asserts this count.
  milestones: 4,
};
```

Run (assumes the migration has been applied locally): `cd apps/api && bun run db:rls-audit`
Expected: `[rls-audit] OK — 9 tables checked: ..., compass_history (2 policies), milestones (4 policies)` and exit 0.

Commit:
```bash
git add apps/api/scripts/rls-audit.ts
git commit -m "feat(#14): db:rls-audit asserts milestones (4 policies) (T12)"
```

#### T13 — `milestones.module.test.ts` (whole-module wired flow)

Create `apps/api/src/modules/milestones/milestones.module.test.ts`:

```ts
// Whole-module wired flow on a fake Prisma client. Asserts AC-1, AC-6, AC-7,
// AC-11 end-to-end through the service surface (without Elysia/HTTP — the
// integration test covers that). Mirrors compass.module.test.ts.

import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createMilestonesModule } from "./milestones.module";
import type { PrismaService } from "../../database";
import type { CompassReader } from "./milestones.types";

const USER_A = "44444444-4444-4444-4444-444444444444";

interface Row {
  id: string;
  userId: string;
  targetCapital: Prisma.Decimal;
  targetYear: number;
  label: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function fakePrismaService() {
  const rows: Row[] = [];
  let nextId = 0;
  let now = Date.now();
  const ts = () => new Date(now++);
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;

  type FakeClient = {
    milestone: {
      create: (args: {
        data: { userId: string; targetCapital: number; targetYear: number; label: string | null };
      }) => Promise<Row>;
      updateMany: (args: {
        where: { id: string; userId: string };
        data: { targetCapital?: number; targetYear?: number; label?: string | null; updatedAt: Date };
      }) => Promise<{ count: number }>;
      deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
      findMany: (args: {
        where: { userId: string };
        orderBy: Array<{ targetYear?: "asc"; position?: "asc"; createdAt?: "asc" }>;
      }) => Promise<Row[]>;
      findFirst: (args: {
        where: { userId: string; id?: string };
        select?: unknown;
      }) => Promise<Row | null>;
      count: (args: { where: { userId: string } }) => Promise<number>;
    };
  };

  const client: FakeClient = {
    milestone: {
      async create(args) {
        const row: Row = {
          id: mintId(),
          userId: args.data.userId,
          targetCapital: new Prisma.Decimal(args.data.targetCapital),
          targetYear: args.data.targetYear,
          label: args.data.label,
          position: 0,
          createdAt: ts(),
          updatedAt: ts(),
        };
        rows.push(row);
        return row;
      },
      async updateMany(args) {
        const idx = rows.findIndex((r) => r.id === args.where.id && r.userId === args.where.userId);
        if (idx < 0) return { count: 0 };
        const row = rows[idx]!;
        if (args.data.targetCapital !== undefined)
          row.targetCapital = new Prisma.Decimal(args.data.targetCapital);
        if (args.data.targetYear !== undefined) row.targetYear = args.data.targetYear;
        if (args.data.label !== undefined) row.label = args.data.label;
        row.updatedAt = args.data.updatedAt;
        return { count: 1 };
      },
      async deleteMany(args) {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i]!;
          if (r.id === args.where.id && r.userId === args.where.userId) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      },
      async findMany(args) {
        return rows
          .filter((r) => r.userId === args.where.userId)
          .sort(
            (a, b) =>
              a.targetYear - b.targetYear ||
              a.position - b.position ||
              a.createdAt.getTime() - b.createdAt.getTime(),
          );
      },
      async findFirst(args) {
        return (
          rows.find(
            (r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id),
          ) ?? null
        );
      },
      async count(args) {
        return rows.filter((r) => r.userId === args.where.userId).length;
      },
    },
  };

  return { client: client as unknown as PrismaService["client"], rows };
}

const fixedCompass: CompassReader = {
  async read() {
    return { objectif: 800_000, horizonYears: 25 };
  },
};

describe("milestones.module — wired flow", () => {
  test("add → list → update → delete keeps year-asc order (AC-1, AC-6, AC-7)", async () => {
    const { client } = fakePrismaService();
    const { service } = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    const a = await service.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const b = await service.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    const c = await service.add(USER_A, { targetCapital: 120_000, targetYear: 2032 });
    expect((await service.list(USER_A)).map((m) => m.targetYear)).toEqual([2030, 2032, 2034]);
    await service.delete(USER_A, c.id);
    expect((await service.list(USER_A)).map((m) => m.id)).toEqual([b.id, a.id]);
    await service.update(USER_A, { id: b.id, targetYear: 2036 });
    expect((await service.list(USER_A)).map((m) => m.targetYear)).toEqual([2034, 2036]);
  });

  test("presenceProbe flips after first add (AC-11)", async () => {
    const { client } = fakePrismaService();
    const m = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    expect(await m.presenceProbe.hasAny(USER_A)).toBe(false);
    await m.service.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await m.presenceProbe.hasAny(USER_A)).toBe(true);
  });

  test("rejects 21st add (AC-2)", async () => {
    const { client } = fakePrismaService();
    const { service } = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    for (let i = 0; i < 20; i++) {
      await service.add(USER_A, { targetCapital: 100_000 + i * 1000, targetYear: 2027 + i });
    }
    await expect(service.add(USER_A, { targetCapital: 999_000, targetYear: 2049 })).rejects.toThrow(
      /milestones cap is 20/,
    );
  });
});
```

Run: `cd apps/api && bun test src/modules/milestones/milestones.module.test.ts`
Expected: `Tests: 3 passed`, exit 0.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.module.test.ts
git commit -m "test(#14): milestones whole-module fake-Prisma flow (T13)"
```

#### T14 — `milestones.integration.test.ts` (oRPC HTTP boundary)

Create `apps/api/src/modules/milestones/milestones.integration.test.ts`:

```ts
// End-to-end wiring proof for the oRPC bridge — boots a real Elysia app
// with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real milestones routes pointed at a
// stubbed in-memory service. Mirrors compass.integration.test.ts.
//
// What this catches that unit tests don't:
//   - JWT verification + audience/issuer enforcement (AC-13 success branch)
//   - Wire body shape on UNAUTHORIZED (AC-13 failure branch)
//   - Round-trip type-safety: contract Zod runs on both ingress and egress
//   - oRPC RPC envelope: mutation inputs / outputs both wrap in { json: ... }

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { extractRequestId } from "../../common/errors";
import { createMilestonesRouter } from "./milestones.routes";
import type { MilestoneService } from "./milestones.service";
import type { Milestone, MilestoneStatusEntry } from "@pekulo/validators";
import type { MilestonePresenceProbe } from "./milestones.types";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "55555555-5555-5555-5555-555555555555";
const PORT_BASE = 13960;

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

function inMemoryService(): MilestoneService {
  const store = new Map<string, Milestone>();
  let nextId = 0;
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;
  return {
    async add(userId, input) {
      const m: Milestone = {
        id: mintId(),
        userId,
        targetCapital: input.targetCapital,
        targetYear: input.targetYear,
        label: input.label ?? null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(m.id, m);
      return m;
    },
    async update(userId, input) {
      const existing = store.get(input.id);
      if (!existing || existing.userId !== userId) {
        throw new Error("not found");
      }
      const updated: Milestone = {
        ...existing,
        targetCapital: input.targetCapital ?? existing.targetCapital,
        targetYear: input.targetYear ?? existing.targetYear,
        label: input.label !== undefined ? input.label : existing.label,
        updatedAt: new Date(),
      };
      store.set(updated.id, updated);
      return updated;
    },
    async delete(userId, id) {
      const existing = store.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("not found");
      }
      store.delete(id);
      return { id };
    },
    async list(userId) {
      return [...store.values()]
        .filter((m) => m.userId === userId)
        .sort((a, b) => a.targetYear - b.targetYear);
    },
    async computeStatuses(): Promise<MilestoneStatusEntry[]> {
      return [];
    },
    presenceProbe(): MilestonePresenceProbe {
      return { async hasAny(userId) { return [...store.values()].some((m) => m.userId === userId); } };
    },
  };
}

let app: Elysia | null = null;
let baseUrl = "";

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const router = createMilestonesRouter({ service: inMemoryService() });
  const orpcRouter: PekuloRpcRouter = { milestones: router };
  app = new Elysia()
    .onError(({ error, set }) => {
      const requestId = extractRequestId(error) ?? crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  const port = PORT_BASE + Math.floor(Math.random() * 30);
  app.listen(port);
  baseUrl = `http://localhost:${port}`;
  // tiny wait to let the server bind
  await new Promise((r) => setTimeout(r, 30));
});

afterAll(async () => {
  await app?.stop();
  app = null;
});

describe("milestones HTTP boundary (AC-13)", () => {
  test("POST /rpc/v1/milestones/add with valid JWT returns 200 + milestone body", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/add`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { targetCapital: 100_000, targetYear: 2030, label: "First flat" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Milestone };
    expect(body.json.id).toMatch(/^mst_/);
    expect(body.json.userId).toBe(USER_ID);
    expect(body.json.targetCapital).toBe(100_000);
    expect(body.json.targetYear).toBe(2030);
    expect(body.json.label).toBe("First flat");
    expect(body.json.position).toBe(0);
  });

  test("POST /rpc/v1/milestones/add without JWT returns 401 < 100 ms", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { targetCapital: 100_000, targetYear: 2030 } }),
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /rpc/v1/milestones/list with valid JWT returns 200 + array", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Milestone[] };
    expect(Array.isArray(body.json)).toBe(true);
    expect(body.json[0]?.userId).toBe(USER_ID);
  });
});
```

Run: `cd apps/api && bun test src/modules/milestones/milestones.integration.test.ts`
Expected: `Tests: 3 passed`, exit 0.

Run the full suite to confirm no regression:
```bash
cd apps/api && bun test
```
Expected: previous compass + hypothesis + 0-* tests still pass, plus the new milestones tests.

Commit:
```bash
git add apps/api/src/modules/milestones/milestones.integration.test.ts
git commit -m "test(#14): milestones integration HTTP boundary (T14)"
```

---

## File List

**NEW (created by this story):**

- `apps/api/prisma/schema/milestones.prisma`
- `apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql`
- `packages/validators/src/milestones.ts`
- `apps/api/src/common/derive/milestone-status.ts`
- `apps/api/src/common/derive/milestone-status.test.ts`
- `apps/api/src/modules/milestones/milestones.errors.ts`
- `apps/api/src/modules/milestones/milestones.types.ts`
- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/milestones/milestones.repository.test.ts`
- `apps/api/src/modules/milestones/milestones.service.ts`
- `apps/api/src/modules/milestones/milestones.service.test.ts`
- `apps/api/src/modules/milestones/milestones.routes.ts`
- `apps/api/src/modules/milestones/milestones.module.ts`
- `apps/api/src/modules/milestones/milestones.module.test.ts`
- `apps/api/src/modules/milestones/milestones.integration.test.ts`

**MODIFIED:**

- `apps/api/prisma/schema/enums.prisma` — append `MilestoneStatus` enum.
- `packages/validators/src/index.ts` — append `export * from "./milestones";`.
- `packages/contracts/src/milestones.contract.ts` — replace empty scaffold with 5 procedures.
- `apps/api/src/common/errors/pekulo-error.ts` — extend `PekuloErrorCode` union + `PEKULO_ERROR_CODES` set with 5 milestone codes.
- `apps/api/src/platform/http/error-mapper.ts` — register HTTP statuses for the 5 new codes.
- `apps/api/src/bootstrap/runtime-dependencies.ts` — instantiate milestonesModule, replace stub probe, add `milestones` to `orpcRouter`.
- `apps/api/scripts/rls-audit.ts` — `milestones: 4` in `EXPECTED_POLICY_COUNTS`.

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-09T17:00:00Z
- **Completed:** 2026-05-09T17:35:00Z

### Debug Log

- T1 migration written manually (Supabase pooler precedent from story 1-1) — applied via `prisma generate` locally; `prisma migrate deploy` runs at deploy time per ADR-0014. AC-12's `db:rls-audit` requires the live DB and is gated to deploy time.
- T14 first failure: `milestoneSchema.userId: z.string().uuid()` (Zod v4 strict RFC 4122) rejected the all-fives literal `55555555-5555-5555-5555-555555555555` borrowed from `compass.integration.test.ts` (compass output has no userId so it never tripped). Fixed by switching the test fixture to a v4-shaped UUID `55555555-5555-4555-8555-555555555555`.
- T13 lint hint: `no-await-in-loop` on the cap-test sequential `add` loop — silenced inline since the test must observe sequential count growth.

### Completion Notes

Implementation followed the story spec verbatim across T1–T14 and all 14 ACs map to runtime tests except AC-12 (asserted at deploy time via `db:rls-audit`) and AC-14 (asserted statically by oxlint). 135/135 apps/api tests green, full pipeline typecheck + lint clean.

**Out-of-spec deviation (commit `87f137d`):** mid-story user feedback flagged that types must live in `@pekulo/types`, not co-located in `apps/api/src/modules/**/*.types.ts`. Refactored: deleted `compass.types.ts` + `milestones.types.ts`, lifted `Compass`, `CompassSetupState`, `CompassHistoryEntry`, `MilestonePresenceProbe`, `CompassReader`, `Milestone` (DB row, re-exported from `@pekulo/validators`), `MilestoneStatusEntry` into `@pekulo/types`. The legacy V1 design-system row `Milestone` shape was renamed `MilestoneCardItem` to free the canonical name. Reversed the `@pekulo/types ↔ @pekulo/validators` workspace dependency direction so types depends on validators. Updated all `apps/api/src/modules/{compass,milestones}/**` imports + `packages/ui/src/components/PekuloMilestone*.tsx` consumers.

### File List

**NEW:**

- `apps/api/prisma/schema/milestones.prisma`
- `apps/api/prisma/migrations/20260510120000_create_milestones/migration.sql`
- `packages/validators/src/milestones.ts`
- `apps/api/src/common/derive/milestone-status.ts`
- `apps/api/src/common/derive/milestone-status.test.ts`
- `apps/api/src/modules/milestones/milestones.errors.ts`
- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/milestones/milestones.repository.test.ts`
- `apps/api/src/modules/milestones/milestones.service.ts`
- `apps/api/src/modules/milestones/milestones.service.test.ts`
- `apps/api/src/modules/milestones/milestones.routes.ts`
- `apps/api/src/modules/milestones/milestones.module.ts`
- `apps/api/src/modules/milestones/milestones.module.test.ts`
- `apps/api/src/modules/milestones/milestones.integration.test.ts`

**MODIFIED:**

- `apps/api/prisma/schema/enums.prisma` — append `MilestoneStatus` enum.
- `packages/validators/src/index.ts` — append `export * from "./milestones";`.
- `packages/contracts/src/milestones.contract.ts` — replace empty scaffold with 5 procedures.
- `apps/api/src/common/errors/pekulo-error.ts` — extend `PekuloErrorCode` union + `PEKULO_ERROR_CODES` set with 5 milestone codes.
- `apps/api/src/platform/http/error-mapper.ts` — register HTTP statuses for the 5 new codes.
- `apps/api/src/bootstrap/runtime-dependencies.ts` — instantiate milestonesModule, replace stub probe, add `milestones` to `orpcRouter`.
- `apps/api/scripts/rls-audit.ts` — `milestones: 4` in `EXPECTED_POLICY_COUNTS`.
- `apps/api/package.json` — add `@pekulo/types` workspace dep.
- `apps/api/src/modules/compass/compass.module.ts`, `compass.repository.ts`, `compass.service.ts`, `compass.service.test.ts` — re-route imports to `@pekulo/types` (types-centralization refactor).
- `packages/types/package.json` — add `@pekulo/validators` workspace dep.
- `packages/types/src/index.ts` — rename UI `Milestone` → `MilestoneCardItem`, add `Compass`/`CompassSetupState`/`CompassHistoryEntry`/`MilestonePresenceProbe`/`CompassReader`/`Milestone`/`MilestoneStatusEntry`.
- `packages/validators/package.json` — drop unused `@pekulo/types` workspace dep.
- `packages/ui/src/components/PekuloMilestonesCard.tsx`, `PekuloMilestoneRow.tsx` — switch to `MilestoneCardItem`.

**DELETED:**

- `apps/api/src/modules/compass/compass.types.ts` — types lifted to `@pekulo/types`.
- `apps/api/src/modules/milestones/milestones.types.ts` — types lifted to `@pekulo/types`.

### Test command output

```
$ cd apps/api && bun test
…
 135 pass
 0 fail
 314 expect() calls
Ran 135 tests across 21 files. [240.00ms]
```
