# Story: 2-1-accounts-orpc-port — Port accounts module to oRPC + Prisma

**Epic:** Epic 2 — Accounts (extended brownfield)
**Status:** ready-for-dev
**Ticket:** [#17](https://github.com/yabafre/pekulo/issues/17)
**Branch:** `feature/17-2-1-accounts-orpc-port`
**Commit prefix:** `feat(#17): …`
**Depends on:** 0-4-prisma-setup (done), 0-5-orpc-contracts-scaffold (done), 0-6-zapaction-orpc-bridge (done)
**Complexity:** M+ (M baseline upgraded by the column-type migration scope)

## User Story

**As a** Pekulo user, **I want** to create, edit, delete, and list my accounts through the new oRPC layer with deletion blocked when a holding still references the account, and with per-user isolation, **so that** my account inventory stays consistent and isolated under defense-in-depth (`apps/api`'s explicit `where: { userId }` guard ON TOP of Supabase RLS).

## Acceptance Criteria

- **AC-1 (CRUD happy path, native-UUID-or-prefixed):** **Given** a freshly-migrated database, **When** `create({ label: "Livret A", type: "livret", currency: "EUR", cashBalance: 5000 })` is called for user A, **Then** an `accounts` row is inserted with an `id` matching `/^acc_[0-9A-Za-z]{21}$/` AND `list()` for user A returns exactly that row with the `cashBalance` field as the JS number `5000`. The repository's `where: { userId }` clause is asserted by the lint rule `pekulo/no-prisma-query-without-user-id` (story 0-12).
- **AC-2 (FK guard on delete — holdings):** **Given** user A has an account with id `acc_abc…` AND ≥ 1 row in `holdings` with `account_id = acc_abc…` AND `user_id = userA`, **When** `delete({ id: "acc_abc…" })` is called, **Then** the service rejects with `AccountError("ACCOUNT_REFERENCED_FK", "account is referenced by 1 holding")` → HTTP **409**. **And** the `accounts` row remains in the database. **And** the holdings row remains untouched.
- **AC-3 (delete happy path):** **Given** user A has an account with no referencing holdings, **When** `delete({ id })` is called, **Then** the call returns `{ ok: true }`, the `accounts` row is gone, and a subsequent `list()` does not return it.
- **AC-4 (RLS isolation — defense in depth):** **Given** user B owns one account `acc_xyz…`, **When** user A calls `list()`, **Then** A's response does NOT contain `acc_xyz…`. **And When** user A calls `update({ id: "acc_xyz…", label: "stolen" })` or `delete({ id: "acc_xyz…" })`, **Then** the service rejects with `AccountError("ACCOUNT_NOT_FOUND", "account not found")` → HTTP **404** (the `updateMany`/`deleteMany` scoped by `{ id, userId }` returns count 0, the service translates that to NOT_FOUND).
- **AC-5 (decimal coercion at row → DTO boundary):** **Given** a stored `cashBalance` of `1_500_000.50` (Prisma `Decimal`), **When** `list()` returns the row, **Then** the surfaced `Account.cashBalance` equals exactly `1500000.5` (JS number). The boundary uses `decimalToNumber(row.cashBalance, 0)` from `apps/api/src/common/derive/decimal-to-number.ts`; no `Number(decimal)` anywhere in the diff.
- **AC-6 (Elysia type invariance + zero `*.types.ts` invariant):** **Given** the story is shipped, **When** the dev runs `bun --filter=api run typecheck` AND grep for `Elysia` annotations in `apps/api/src/modules/accounts/`, **Then** typecheck exits 0 AND no file is annotated with bare `Elysia`. AND no file named `accounts.types.ts` exists inside `apps/api/src/modules/accounts/` (L1 invariant — every type lives in `@pekulo/types` or as Zod-inferred re-export from `@pekulo/validators`).
- **AC-7 (unauthorized handler rejection):** **Given** an oRPC request reaches the accounts router with `context.userId` empty / blank / undefined, **When** any handler (`create`, `update`, `delete`, `list`) runs, **Then** it throws `PekuloError("UNAUTHORIZED", "user context missing")` AND the Elysia error mapper translates it to HTTP **401** within 100 ms (NFR-9).
- **AC-8 (no Prisma query without `userId` guard, lint-enforced):** **Given** the lint config at `.oxlintrc.json` runs `pekulo/no-prisma-query-without-user-id` over `apps/api/**`, **When** the dev runs `bun --filter=api run lint`, **Then** lint exits 0 for the accounts module (every `prisma.account.*`, `prisma.holding.*` (FK probe), and `tx.*` call carries `where: { userId }` or `where: { id, userId }`).
- **AC-9 (validator boundary — cashBalance ≥ 0):** **Given** the Zod `createAccountInputSchema` is invoked with `cashBalance: -1`, **When** parsing runs, **Then** parsing rejects with `ZodError` (defense in depth over the brownfield `CHECK (cash_balance >= 0)` constraint).
- **AC-10 (RLS audit + new prefix surface, build-failing check):** **Given** the migration applied and a freshly-created account has id `acc_<base62-21>`, **When** the dev runs `bun --filter=api run db:rls-audit`, **Then** the script exits 0 (`accounts: 4` policy count remains intact post-migration — no policy was dropped by the column-type flip). **And** the integration test asserts that a `prisma.account.create({ data: { userId, label, type, currency, cashBalance, notes } })` (no `id` field) returns a row with `id` matching `/^acc_[0-9A-Za-z]{21}$/`.

## Tasks

- [ ] **T1** — Write the migration SQL at `apps/api/prisma/migrations/<timestamp>_accounts_uuid_to_text/migration.sql` (UUID → TEXT column flip on `accounts.id` + `holdings.account_id`, re-id all existing rows to `acc_<base62-21>` via PL/pgSQL helper, drop `gen_random_uuid()` default, FK constraint dance). Manual SQL — `prisma migrate dev` is bypassed (Supabase pooler hang precedent from story 1-1 deviation). [AC: AC-1, AC-10]
- [ ] **T2** — Add `packages/validators/src/accounts.ts` (5 Zod schemas: `accountSchema`, `createAccountInputSchema`, `updateAccountInputSchema`, `deleteAccountInputSchema`, `listAccountsOutputSchema`) + re-export from `packages/validators/src/index.ts`. Includes `ACCOUNT_TYPES` re-export from `@pekulo/types` (do NOT duplicate the const array). [AC: AC-1, AC-9]
- [ ] **T3** — Extend `PekuloErrorCode` union + `PEKULO_ERROR_CODES` set at `apps/api/src/common/errors/pekulo-error.ts` with `ACCOUNT_NOT_FOUND` and `ACCOUNT_REFERENCED_FK`. Extend `ORPC_HTTP_STATUS_BY_CODE` at `apps/api/src/platform/http/error-mapper.ts` with the matching statuses (`ACCOUNT_NOT_FOUND: 404`, `ACCOUNT_REFERENCED_FK: 409`). [AC: AC-2, AC-4, AC-7]
- [ ] **T4** — Rename `Account` → `AccountCardItem` at `packages/types/src/index.ts` (UI shape — `{ label, type, institution?, balanceEur }`), add canonical domain `Account` = `z.infer<typeof accountSchema>`, update consumers `PekuloAccountRow.tsx` and `PekuloAccountsSection.tsx` to import `AccountCardItem` (story 1-2 precedent — `Milestone` → `MilestoneCardItem`). [AC: AC-6]
- [ ] **T5** — Add `apps/api/src/modules/accounts/accounts.errors.ts` with `AccountError extends PekuloError` + factory functions `accountNotFound()` and `accountReferencedFk(holdingCount: number)`. [AC: AC-2, AC-4]
- [ ] **T6** — Add `apps/api/src/modules/accounts/accounts.repository.test.ts` (fake-Prisma — TDD RED) covering: `create` happy path → prefixed id matches `/^acc_/`; `update` returns null on cross-user attempt; `delete` returns false on cross-user; `findByIdForUser` returns null cross-user; `listByUser` returns only matching userId rows; `countHoldingsReferencing` counts only holdings with both `accountId` AND `userId` match. Run `bun --filter=api test src/modules/accounts/accounts.repository.test.ts` — expected RED (file does not exist yet). [AC: AC-1, AC-4, AC-5, AC-8]
- [ ] **T7** — Add `apps/api/src/modules/accounts/accounts.repository.ts` (TDD GREEN) — repository factory with `create`, `update`, `delete`, `findByIdForUser`, `listByUser`, `countHoldingsReferencing` methods, each with explicit `where: { userId }`. Decimal coercion via `decimalToNumber()` at row → DTO boundary. Run `bun --filter=api test src/modules/accounts/accounts.repository.test.ts` — expected GREEN. [AC: AC-1, AC-4, AC-5, AC-8]
- [ ] **T8** — Add `apps/api/src/modules/accounts/accounts.service.test.ts` (TDD RED) covering: `create` delegates to repo; `update` throws `ACCOUNT_NOT_FOUND` when repo returns null; `delete` probes holdings count via `$transaction`, throws `ACCOUNT_REFERENCED_FK` when count > 0, deletes when count = 0; `list` delegates to repo. Run `bun --filter=api test src/modules/accounts/accounts.service.test.ts` — expected RED. [AC: AC-2, AC-3, AC-4, AC-7]
- [ ] **T9** — Add `apps/api/src/modules/accounts/accounts.service.ts` (TDD GREEN) — service factory; `delete` wraps `countHoldingsReferencing` + `delete` in a single `$transaction` to avoid TOCTOU between FK probe and delete (mirror `milestones.repository.ts#addEnforcingCap` pattern). Run `bun --filter=api test src/modules/accounts/accounts.service.test.ts` — expected GREEN. [AC: AC-2, AC-3, AC-4, AC-7]
- [ ] **T10** — Add `apps/api/src/modules/accounts/accounts.routes.ts` — `implement(accountsContract).$context<{ userId, email }>().router({ create, update, delete, list })`. Each handler calls `requireUserId(context.userId)` then `service.<method>(context.userId, …)`. Mirror `apps/api/src/modules/milestones/milestones.routes.ts`. [AC: AC-7]
- [ ] **T11** — Populate `packages/contracts/src/accounts.contract.ts` with 4 oRPC procedures `create`, `update`, `delete`, `list` (replace the empty scaffold). Wire Zod I/O via `oc.input(…).output(…)`. [AC: AC-1]
- [ ] **T12** — Add `apps/api/src/modules/accounts/accounts.module.ts` (factory returning `{ service, router }`) + `apps/api/src/modules/accounts/accounts.module.test.ts` (whole-module wired flow on fake Prisma) + wire into `apps/api/src/bootstrap/runtime-dependencies.ts` (instantiate `createAccountsModule({ prismaService })`, register `accounts: module.router` in `orpcRouter`). [AC: AC-1, AC-2, AC-3, AC-4]
- [ ] **T13** — Add `apps/api/src/modules/accounts/accounts.integration.test.ts` (oRPC HTTP boundary, mirrors `milestones.integration.test.ts`): create-list happy path; 401 on missing bearer; FK-guard 409 path; cross-user RLS 404 path. Run `bun --filter=api test src/modules/accounts/accounts.integration.test.ts` — expected GREEN. [AC: AC-1, AC-2, AC-4, AC-7]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009)** — Mirror `apps/api/src/modules/milestones/{milestones.module.ts, milestones.routes.ts, milestones.service.ts, milestones.repository.ts, milestones.errors.ts}` plus `*.test.ts` siblings. Factory returns `{ service, router }`. **NEVER annotate `Elysia` (L8 — story 1-1 / 1-2 explicit, propagates to 2-1 per epic-2-context.md).** The router type is inferred via `ReturnType<typeof createAccountsRouter>`.
- **Hard layering (ADR-0010)** — Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. **Story 2-1 is API-only** (UI in 2-3): the chain ends at Elysia; the service stays free of Prisma imports; the repository is the single Prisma touch-point.
- **RLS defense in depth (ADR-0013)** — every Prisma query in `accounts.repository.ts` AND the FK probe queries (`prisma.holding.count`, `prisma.holding.findFirst` if used) carry explicit `where: { userId }` (single-row finds use `where: { id, userId }`). Lint rule `pekulo/no-prisma-query-without-user-id` (story 0-12) blocks omissions. The `prismaIdentifier: ["prisma","tx"]` override from `.oxlintrc.json` is inherited — the `$transaction` callback's `tx` is covered.
- **Decimal coercion (L24, story 2-1 explicit in lessons.md L233 scope list)** — `Account.cashBalance` is `@db.Decimal` (NUMERIC NOT NULL DEFAULT 0); coerce via `decimalToNumber(row.cashBalance, 0)` from `apps/api/src/common/derive/decimal-to-number.ts` (story 1-1 extract). Inlining `Number(decimal)` OR re-extracting the helper = review fail.
- **Prefixed IDs (ADR-0012) + brownfield UUID migration** — Account.id was originally `UUID DEFAULT gen_random_uuid()` (brownfield). The user picked the **migrate-to-prefixed-IDs path** (override of story 1-4's `null`-prefix-for-Hypothesis precedent). Post-migration: `accounts.id` is TEXT, the `gen_random_uuid()` default is dropped, and the prefixed-ids extension at `apps/api/src/database/prefixed-ids.extension.ts` mints `acc_<base62-21>` on every `prisma.account.create` where `id` is undefined. **All existing rows are re-id'd in-place during the migration via PL/pgSQL helper** (see T1 below). The `holdings.account_id` column is also flipped UUID → TEXT and updated to match the new account ids (FK referent type must match).
- **Migration discipline (ADR-0014)** — Write the migration SQL manually under `apps/api/prisma/migrations/<timestamp>_accounts_uuid_to_text/migration.sql` (Supabase pooler hangs on `prisma migrate dev` — documented in story 1-1 deviation T1). Apply via `bun --filter=api run prisma:deploy` (or equivalent `prisma migrate deploy`). The `db:rls-audit` CI probe re-asserts policy coverage post-deploy.
- **Naming (Phase 3, architecture.md L370)** — Prisma model `Account` (already declared, PascalCase singular); table `accounts` (brownfield, `@@map("accounts")` already in place); contract module key `accounts`; mount path `/rpc/v1/accounts`.
- **oRPC handler shape** — mirror `apps/api/src/modules/milestones/milestones.routes.ts:22-44`. Use `implement(accountsContract).$context<{ userId: string; email: string | null }>().router({ … })`. Each handler verifies `context.userId?.trim()` and throws `new PekuloError("UNAUTHORIZED", "user context missing")` when absent.
- **FK guard scope — holdings only (epic 2-1 scoping decision)** — Brownfield SQL has `holdings.account_id FK REFERENCES accounts(id) ON DELETE CASCADE` but **NO `transactions.account_id` column** today. Story 2-1 enforces the FK guard against `holdings` only. The `transactions.account_id` column + extension of the FK guard ships in **story 5-1** (`5-1-transactions-record`). The service-level FK probe returns `{ count: number; referencingTables: string[] }` shape so the extension is a one-line change in 5-1.
- **`$transaction`-wrapped delete (TOCTOU avoidance, mirrors milestones precedent)** — The FK probe (`tx.holding.count`) and the `tx.account.deleteMany` MUST run inside the same `$transaction` callback to avoid the case where a concurrent insert of a `holding` lands between the probe and the delete. Mirrors `milestones.repository.ts#addEnforcingCap` (count + create wrapped in `$transaction`). See `apps/api/src/modules/milestones/milestones.repository.ts:90-109` for the canonical shape.

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — Module factory + oRPC contract-first mount.
- `docs/adr/0010-hooks-orchestration-boundary.md` — Hard layering (forward-pointer for story 2-3 UI work).
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — `Account: "acc"` prefix registration + the brownfield UUID exception note. Post-migration in this story, Account becomes a fully prefixed-id model.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — Explicit `where: { userId }` clause + lint rule.
- `docs/adr/0014-prisma-migrations.md` — Prisma migrate + manual RLS policy append. **No RLS policies change in this story**; only the column type flip is migrated, the 4 policies on `accounts` table stay intact.

### Lessons re-applied (verbatim from `docs/lessons.md`)

- **L1 (2026-05-09 — zero `*.types.ts` files inside `apps/api/src/modules/**`)** — every TS type lives in `@pekulo/types`, including internal API adapter interfaces. Story 2-1 conformance: domain `Account` re-exported from `@pekulo/validators` Zod-infer through `@pekulo/types`; internal `AccountsDeps` interface lives in `accounts.module.ts` or `accounts.service.ts` — NEVER in a `accounts.types.ts` file.
- **L8 (2026-05-04 — Elysia 1.4 `Elysia` type is invariant — scope list explicitly cites story 2-1)** — never annotate variables/parameters as bare `Elysia`. The accounts module factory returns inferred types: `export function createAccountsModule(deps): AccountsModule` where `AccountsModule` interface uses `ReturnType<typeof createAccountsRouter>` — same shape as `milestones.module.ts:16-20`.
- **L24 (2026-05-04 — `Number(decimal)` silently truncates above MAX_SAFE_INTEGER — scope list explicitly cites story 2-1)** — apply `decimalToNumber()` at the row → DTO boundary in `accounts.repository.ts`. The extracted helper from `apps/api/src/common/derive/decimal-to-number.ts` is the single mechanism. Do NOT re-extract.
- **L23 (2026-05-04 — Bun `--frozen-lockfile` workspace coverage)** — N/A: no new workspace member added; only new files inside existing `apps/api`, `packages/validators`, `packages/contracts`.
- **L25 (2026-05-04 — AsyncLocalStorage / Next minor bumps)** — N/A: API-only story; no `apps/web` work.
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s `test` script runs `bun test` (Bun's native runner). All new `*.test.ts` under `apps/api/src/**` use `import { describe, expect, mock, test } from "bun:test"`.
- **Story 0-12 lint rules active** — `pekulo/no-prisma-query-without-user-id` runs on `apps/api/**/*.ts` with `prismaIdentifier: ["prisma","tx"]`. Every method in `accounts.repository.ts` MUST include `where: { userId }` (or `where: { id, userId }`). Lint failure on omission.
- **Story 1-1 / 1-2 outcome — `decimalToNumber` is the canonical helper (extracted at `apps/api/src/common/derive/decimal-to-number.ts`)** — DO NOT inline `Number(decimal)` and DO NOT duplicate the helper.
- **Story 1-4 outcome — brownfield UUID column pattern (Hypothesis precedent)** — Story 2-1 OVERRIDES this precedent for `Account`. Instead of registering `Account: null`, the story migrates the column to TEXT and keeps `Account: "acc"` so the prefixed-ids extension fires on every new account. The override is documented in this story's File List (no change to `id-prefixes.config.ts`).

### Step-0 quotes (verbatim current state at story-write time)

#### `apps/api/prisma/schema/accounts.prisma` (current)

```prisma
// accounts.prisma — Account aggregate (Account → Holding → HoldingLot).
// Maps the three brownfield tables `accounts`, `holdings`, `holding_lots`.

model Account {
  id          String      @id
  userId      String      @map("user_id") @db.Uuid
  label       String
  type        AccountType
  currency    String      @default("EUR")
  cashBalance Decimal     @default(0) @map("cash_balance") @db.Decimal
  notes       String?
  createdAt   DateTime?   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime?   @default(now()) @map("updated_at") @db.Timestamptz

  holdings Holding[]

  @@map("accounts")
}
```

> Story 2-1 changes: NO schema edit. The model already declares `id String @id` (Prisma sees TEXT). The migration aligns the database column type accordingly.

#### `packages/contracts/src/accounts.contract.ts` (current — empty scaffold)

```ts
// packages/contracts/src/accounts.contract.ts
// Accounts module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/accounts).

export const accountsContractV1 = {} as const;
export const accountsContract = accountsContractV1;
export const accountsContractMeta = {
  moduleKey: "accounts",
  mountPath: "/rpc/v1/accounts",
  version: "v1",
} as const;
```

> Story 2-1 changes: replace the empty `{} as const` with 4 oRPC procedure definitions (create / update / delete / list). Keep the meta block intact.

#### `apps/api/src/database/id-prefixes.config.ts` (current — Account entry kept verbatim)

```ts
export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  Holding: "hld",
  HoldingLot: "lot",
  // ... unchanged ...
} as const satisfies Record<string, string | null>;
```

> Story 2-1 changes: **NO edit**. The `Account: "acc"` line stays; the migration makes the database column type compatible with the extension's output.

#### `apps/api/src/common/errors/pekulo-error.ts` (current — union sorted alphabetically)

```ts
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
  // ... same list ...
]);
```

> Story 2-1 changes: insert `"ACCOUNT_NOT_FOUND"` AND `"ACCOUNT_REFERENCED_FK"` into BOTH the union AND the set, preserving alphabetical sort. The sub-rule from `pekulo-error.ts` header comment: "every new code MUST update both `PekuloErrorCode` AND `ORPC_HTTP_STATUS_BY_CODE` in the same commit".

#### `apps/api/src/platform/http/error-mapper.ts` (current — status map excerpt)

```ts
export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  COMPASS_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  CONFLICT: 409,
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  // …
};
```

> Story 2-1 changes: add `ACCOUNT_NOT_FOUND: 404` (under the 404 cluster, next to `MILESTONE_NOT_FOUND`) AND `ACCOUNT_REFERENCED_FK: 409` (under the 409 cluster, next to `MILESTONE_LIMIT_EXCEEDED`). The `Record<PekuloErrorCode, number>` type forces compile-time exhaustiveness — forgetting one will fail typecheck.

#### `packages/validators/src/index.ts` (current — barrel)

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./hypothesis";
export * from "./compass";
export * from "./milestones";
```

> Story 2-1 changes: add `export * from "./accounts";` (alphabetical order — between `./hypothesis` and `./compass`).

#### `packages/types/src/index.ts` (current — Account UI shape excerpt)

```ts
// ─── Account (Comptes / Patrimoine) ──────────────────────────────────────
export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  label: string;
  type: AccountType;
  institution?: string;
  balanceEur: number;
}
```

> Story 2-1 changes: rename `Account` → `AccountCardItem` (the UI prop shape consumed by `PekuloAccountRow.tsx` + `PekuloAccountsSection.tsx`). Add canonical domain `Account` as `z.infer<typeof accountSchema>` re-export from `@pekulo/validators`. Story 1-2 precedent — `Milestone` → `MilestoneCardItem`.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — module wiring excerpt)

```ts
import { createHypothesisModule } from "../modules/hypothesis/hypothesis.module";
import { createCompassModule } from "../modules/compass/compass.module";
import { createMilestonesModule } from "../modules/milestones/milestones.module";

// ... composition body ...

const orpcRouter: PekuloRpcRouter = {
  hypothesis: hypothesisModule.router,
  compass: compassModule.router,
  milestones: milestonesModule.router,
};
```

> Story 2-1 changes: import `createAccountsModule`, instantiate `const accountsModule = createAccountsModule({ prismaService })`, register `accounts: accountsModule.router` in the `orpcRouter` object. Mirror the milestones / compass pattern.

#### `apps/api/scripts/rls-audit.ts` (current — expected counts)

```ts
const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
  compass_history: 2,
  milestones: 4,
};
```

> Story 2-1 changes: **NO edit**. The `accounts: 4` policy count is preserved post-migration (the migration flips column types but does NOT touch the 4 policies on the `accounts` table — they reference `auth.uid() = user_id`, not the `id` column).

### File decisions (3-bullet per file)

#### NEW — `apps/api/prisma/migrations/<timestamp>_accounts_uuid_to_text/migration.sql`

- **Single responsibility** — flip `accounts.id` AND `holdings.account_id` from UUID to TEXT; re-id all existing accounts in-place to `acc_<base62-21>` format; drop the `gen_random_uuid()` default so the prefixed-ids extension is the sole id minter going forward.
- **Inputs** — none (DDL + DML, idempotent via Prisma's `_prisma_migrations` registry).
- **Outputs** — schema changes recorded in `_prisma_migrations`; existing data preserved with new id format.

#### NEW — `packages/validators/src/accounts.ts`

- **Single responsibility** — Zod schemas + Z-inferred types for the accounts contract (input shapes for create / update / delete; row shape for list output).
- **Inputs** — `@pekulo/types#ACCOUNT_TYPES` (the closed enum literal); zod v4.
- **Outputs** — `accountSchema`, `createAccountInputSchema`, `updateAccountInputSchema`, `deleteAccountInputSchema`, `listAccountsOutputSchema`, plus the corresponding `*Input` / `Account` z-infer types.

#### NEW — `apps/api/src/modules/accounts/accounts.errors.ts`

- **Single responsibility** — typed error factories for the accounts domain (`accountNotFound`, `accountReferencedFk`); `AccountError` subclass override sets `name = "AccountError"`.
- **Inputs** — `PekuloError`, `PekuloErrorCode` from `apps/api/src/common/errors`.
- **Outputs** — `AccountError` class + 2 factory functions.

#### NEW — `apps/api/src/modules/accounts/accounts.repository.ts`

- **Single responsibility** — single Prisma touch-point for the accounts domain. Every method carries an explicit `where: { userId }`. Includes the FK probe `countHoldingsReferencing(userId, accountId): Promise<number>` used by the service-side delete guard.
- **Inputs** — `ExtendedPrismaClient` (the Prisma client extended with prefixedIds extension).
- **Outputs** — `AccountRepository` interface + `createAccountRepository(deps)` factory; methods return domain shapes (`Account | null`, `Account[]`, `boolean` for delete success, `number` for count).

#### NEW — `apps/api/src/modules/accounts/accounts.service.ts`

- **Single responsibility** — business logic for the accounts domain. `delete` wraps the FK probe + delete in a `$transaction` to avoid TOCTOU. Translates repo nulls to `AccountError("ACCOUNT_NOT_FOUND")`; translates `countHoldingsReferencing > 0` to `AccountError("ACCOUNT_REFERENCED_FK")`.
- **Inputs** — `AccountRepository`, `ExtendedPrismaClient` (the latter for `$transaction` orchestration).
- **Outputs** — `AccountService` interface + `createAccountService(deps)` factory; methods return DTO-shaped `Account`, throw `AccountError` on domain rejections.

#### NEW — `apps/api/src/modules/accounts/accounts.routes.ts`

- **Single responsibility** — oRPC handler wiring for the 4 procedures. Verifies user context, delegates to service.
- **Inputs** — `AccountService`; the `accountsContract` from `@pekulo/contracts`.
- **Outputs** — `createAccountsRouter({ service })` returning the oRPC router (type inferred — never `Elysia` annotated).

#### NEW — `apps/api/src/modules/accounts/accounts.module.ts`

- **Single responsibility** — composition root for the accounts module. Wires repository + service + router; returns `{ service, router }`.
- **Inputs** — `PrismaService` (exposes `.client` extended).
- **Outputs** — `AccountsModule` interface + `createAccountsModule(deps): AccountsModule` factory.

#### NEW — `apps/api/src/modules/accounts/accounts.repository.test.ts`

- **Single responsibility** — fake-Prisma unit tests for repository methods. Asserts the `where: { userId }` clause is present on every query (via the fake's call assertions); asserts decimal coercion at the boundary; asserts cross-user finds return null.
- **Inputs** — `bun:test` runner; a fake Prisma client (in-memory) modelling `account` and `holding` tables.
- **Outputs** — Tests-only file; no runtime export.

#### NEW — `apps/api/src/modules/accounts/accounts.service.test.ts`

- **Single responsibility** — service unit tests on a fake repository + a fake `$transaction` orchestrator. Asserts the FK guard throws ACCOUNT_REFERENCED_FK with count > 0; asserts happy delete returns ok on count = 0; asserts ACCOUNT_NOT_FOUND on cross-user.
- **Inputs** — `bun:test`; fake repo (in-memory), fake `$transaction` (callback-runner).
- **Outputs** — Tests-only file.

#### NEW — `apps/api/src/modules/accounts/accounts.module.test.ts`

- **Single responsibility** — whole-module wired test on fake Prisma. Verifies the create → list → update → delete flow end-to-end inside the module factory.
- **Inputs** — `bun:test`; fake Prisma client.
- **Outputs** — Tests-only file.

#### NEW — `apps/api/src/modules/accounts/accounts.integration.test.ts`

- **Single responsibility** — oRPC HTTP boundary test. Spins an Elysia app via the runtime composition root, signs JWTs for user A + user B, asserts: (1) happy create-list; (2) 401 on missing bearer; (3) 409 on FK-guarded delete; (4) 404 on cross-user update / delete.
- **Inputs** — `bun:test`; Elysia app from `bootstrap/runtime-dependencies.ts`; a fake `PrismaService` (the integration test wires the same fake-Prisma as the module test — story 1-1/1-2 precedent for "live-DB harness deferred").
- **Outputs** — Tests-only file.

#### MODIFIED — `packages/contracts/src/accounts.contract.ts`

- **Single responsibility (post-edit)** — exports the 4 oRPC procedure definitions for the accounts module.
- **Inputs** — `@orpc/contract` `oc`; `@pekulo/validators` schemas.
- **Outputs** — `accountsContractV1`, `accountsContract`, `accountsContractMeta`.

#### MODIFIED — `packages/validators/src/index.ts`

- **Single responsibility (post-edit)** — barrel for all Pekulo Zod schemas (now includes accounts).
- **Inputs** — sub-files.
- **Outputs** — re-exports.

#### MODIFIED — `packages/types/src/index.ts`

- **Single responsibility (post-edit)** — central registry for Pekulo domain TS types. `Account` becomes the canonical domain entity (z-infer from accountSchema); `AccountCardItem` is the UI prop shape.
- **Inputs** — `@pekulo/validators` re-export of `Account` type.
- **Outputs** — `Account` (domain), `AccountCardItem` (UI), `ACCOUNT_TYPES`, `AccountType`.

#### MODIFIED — `packages/ui/src/components/PekuloAccountRow.tsx`

- **Single responsibility (post-edit)** — render a single account row in the Patrimoine view; consumes `AccountCardItem` prop shape (not the domain `Account`).
- **Inputs** — `@pekulo/types#AccountCardItem`, `@pekulo/types#AccountType`.
- **Outputs** — `PekuloAccountRow` component.

#### MODIFIED — `packages/ui/src/components/PekuloAccountsSection.tsx`

- **Single responsibility (post-edit)** — accounts list section component; consumes `AccountCardItem[]` prop array.
- **Inputs** — `@pekulo/types#AccountCardItem`; `./PekuloAccountRow`.
- **Outputs** — `PekuloAccountsSection` component.

#### MODIFIED — `apps/api/src/database/id-prefixes.config.test.ts`

- **Single responsibility (post-edit)** — assert the prefix registry; **add a new test asserting `Account` has prefix `"acc"`** (post-migration the column accepts the prefixed format).
- **Inputs** — `ID_PREFIXES`, `getPrefix` from `id-prefixes.config.ts`.
- **Outputs** — Tests-only file.

#### MODIFIED — `apps/api/src/bootstrap/runtime-dependencies.ts`

- **Single responsibility (post-edit)** — composition root; instantiates the accounts module and mounts it on `orpcRouter`.
- **Inputs** — `createAccountsModule` from accounts module.
- **Outputs** — `RuntimeDeps` with `orpcRouter.accounts`.

#### MODIFIED — `apps/api/src/common/errors/pekulo-error.ts`

- **Single responsibility (post-edit)** — typed domain errors registry; now includes ACCOUNT_NOT_FOUND + ACCOUNT_REFERENCED_FK.
- **Inputs** — none.
- **Outputs** — `PekuloErrorCode`, `PEKULO_ERROR_CODES`, `PekuloError`, `isPekuloError`.

#### MODIFIED — `apps/api/src/platform/http/error-mapper.ts`

- **Single responsibility (post-edit)** — domain code → HTTP status map; now includes ACCOUNT_NOT_FOUND: 404 + ACCOUNT_REFERENCED_FK: 409.
- **Inputs** — `PekuloErrorCode`.
- **Outputs** — `ORPC_HTTP_STATUS_BY_CODE` typed as `Record<PekuloErrorCode, number>`.

### Task-by-task implementation code

> Junior persona reminder — every code block below is COMPLETE. Do not invent imports, do not omit lines. Run the exact test command after each task. Each task ends with a `git commit` — do not batch.

---

#### T1 — Migration SQL (UUID → TEXT + re-id)

**File:** `apps/api/prisma/migrations/<TIMESTAMP>_accounts_uuid_to_text/migration.sql`

Compute `<TIMESTAMP>` as `date -u +%Y%m%d%H%M%S` at task start (e.g. `20260515150000`). Create the directory then write the file.

**Full SQL content:**

```sql
-- 2-1-accounts-orpc-port — flip accounts.id and holdings.account_id from UUID
-- to TEXT, re-id all existing accounts in-place to acc_<base62-21>, drop the
-- gen_random_uuid() default so the prefixed-ids extension becomes the sole
-- id minter going forward.
--
-- This migration is hand-written (Supabase pooler hang on `prisma migrate dev`,
-- story 1-1 deviation T1). Apply via `bun --filter=api run prisma:deploy`
-- (which calls `prisma migrate deploy`).
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.
--
-- Touched tables:
--   - public.accounts (id column type flip + re-id + drop default)
--   - public.holdings (account_id column type flip + cascade re-id)
--
-- RLS policies preserved (they reference auth.uid() = user_id, NOT the id
-- column — column-type flip does not invalidate them). The db:rls-audit
-- script asserts `accounts: 4` and `holdings: 4` post-deploy.

BEGIN;

-- Step 1 — install a one-shot PL/pgSQL helper for base62-21 generation that
-- mirrors apps/api/src/database/base62.ts. Uses pgcrypto's gen_random_bytes()
-- which Supabase ships pre-enabled. Same modulo-bias trade-off as the TS
-- helper (negligible for ID purposes).
CREATE OR REPLACE FUNCTION pekulo_migration_acc_id() RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes BYTEA;
  result TEXT := '';
  idx INTEGER;
BEGIN
  bytes := gen_random_bytes(21);
  FOR idx IN 0..20 LOOP
    result := result || substr(alphabet, 1 + (get_byte(bytes, idx) % 62), 1);
  END LOOP;
  RETURN 'acc_' || result;
END;
$$ LANGUAGE plpgsql;

-- Step 2 — drop the FK from holdings.account_id so we can flip both columns
-- independently. The FK constraint name comes from Supabase's default naming
-- (`<table>_<column>_fkey`). The CASCADE on the constraint drop only removes
-- the constraint itself, not the dependent rows.
ALTER TABLE public.holdings
  DROP CONSTRAINT IF EXISTS holdings_account_id_fkey;

-- Step 3 — drop the gen_random_uuid() default on accounts.id. The
-- prefixed-ids extension takes over as the sole id minter post-migration.
ALTER TABLE public.accounts
  ALTER COLUMN id DROP DEFAULT;

-- Step 4 — flip the column types UUID → TEXT. Postgres auto-casts existing
-- UUID values to their canonical text form (e.g. '550e8400-e29b-...'). After
-- this step, both columns are TEXT but the rows still carry the old UUID
-- string format.
ALTER TABLE public.accounts
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.holdings
  ALTER COLUMN account_id TYPE TEXT USING account_id::text;

-- Step 5 — re-id all existing accounts in-place to acc_<base62-21>, cascading
-- the mapping to holdings.account_id. Use a CTE with a temporary mapping
-- table so each old id maps to exactly one new id (no double-mint per
-- account row).
DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.accounts LOOP
    new_id := pekulo_migration_acc_id();
    -- Cascade FIRST (holdings.account_id) then update accounts.id so a
    -- transient state where a holding points at a non-existent account
    -- never occurs (the FK is currently dropped so this ordering is purely
    -- defensive — re-add at the end re-enforces).
    UPDATE public.holdings SET account_id = new_id WHERE account_id = rec.id;
    UPDATE public.accounts SET id = new_id WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 6 — re-add the FK constraint. ON DELETE CASCADE preserved (matches
-- the brownfield behaviour the FK guard at the service layer protects
-- against — the cascade is the dangerous default that AC-2 enforces against).
ALTER TABLE public.holdings
  ADD CONSTRAINT holdings_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Step 7 — drop the one-shot helper. The base62 generator lives in TS
-- (apps/api/src/database/base62.ts) for runtime use; the migration helper is
-- a transient migration concern only.
DROP FUNCTION pekulo_migration_acc_id();

COMMIT;
```

**Run:** `bun --filter=api run prisma:deploy` (or equivalent). Inspect Supabase logs / `_prisma_migrations` table to confirm the row landed.

**Expected output:** migration row inserted in `_prisma_migrations` with `migration_name = '<timestamp>_accounts_uuid_to_text'`, `applied_steps_count = 7`, `finished_at` not null. `SELECT id FROM accounts` shows all ids matching `^acc_[0-9A-Za-z]{21}$`.

**Commit:**

```bash
git add apps/api/prisma/migrations/<TIMESTAMP>_accounts_uuid_to_text/migration.sql
git commit -m "feat(#17): T1 migrate accounts.id UUID → TEXT + reid"
```

---

#### T2 — `packages/validators/src/accounts.ts` + barrel re-export

**File:** `packages/validators/src/accounts.ts` (NEW)

**Full content:**

```ts
// packages/validators/src/accounts.ts
// Accounts module validators — Zod schemas + Zod-inferred TS types.
//
// Conventions (story 1-1 / 1-2 precedent):
//   - camelCase schema names + `Schema` suffix.
//   - Closed enum literal (ACCOUNT_TYPES) imported from @pekulo/types — never
//     duplicate the const array.
//   - The DOMAIN `Account` shape is z.infer<typeof accountSchema>; the UI
//     shape lives at @pekulo/types#AccountCardItem (renamed in this story).
//
// Defense-in-depth at the validator layer (AC-9):
//   - cashBalance >= 0 mirrors the brownfield CHECK (cash_balance >= 0).
//   - label length 1..120 (matches brownfield TEXT NOT NULL guarded by app
//     code — no DB-level length constraint).
//   - notes optional, max 500.

import { z } from "zod";
import { ACCOUNT_TYPES } from "@pekulo/types";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;

// Row / DTO shape (output of list, output of create / update / get).
// id matches /^acc_[0-9A-Za-z]{21}$/ after the 2-1 migration; existing
// rows pre-migration have been re-id'd in-place so every id in the DB
// now matches this pattern.
export const accountSchema = z.object({
  id: z.string().regex(/^acc_[0-9A-Za-z]{21}$/),
  userId: z.string().uuid(),
  label: z.string().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.enum(CURRENCIES),
  cashBalance: z.number().min(0),
  notes: z.string().max(500).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Account = z.infer<typeof accountSchema>;

// Input shapes.
export const createAccountInputSchema = z.object({
  label: z.string().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.enum(CURRENCIES),
  cashBalance: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

export const updateAccountInputSchema = z.object({
  id: z.string().regex(/^acc_[0-9A-Za-z]{21}$/),
  label: z.string().min(1).max(120).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  cashBalance: z.number().min(0).optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;

export const deleteAccountInputSchema = z.object({
  id: z.string().regex(/^acc_[0-9A-Za-z]{21}$/),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const deleteAccountOutputSchema = z.object({
  ok: z.literal(true),
});

export const listAccountsOutputSchema = z.array(accountSchema);
```

**File:** `packages/validators/src/index.ts` (MODIFIED)

**Full content after edit:**

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./accounts";
export * from "./compass";
export * from "./hypothesis";
export * from "./milestones";
```

**Run:** `bun --filter=@pekulo/validators run typecheck` (or `bun --filter=@pekulo/validators run build` if there's no typecheck script).

**Expected output:** exit 0; no `tsc` errors.

**Commit:**

```bash
git add packages/validators/src/accounts.ts packages/validators/src/index.ts
git commit -m "feat(#17): T2 accounts Zod schemas + barrel re-export"
```

---

#### T3 — `PekuloErrorCode` + `ORPC_HTTP_STATUS_BY_CODE` additions

**File:** `apps/api/src/common/errors/pekulo-error.ts` (MODIFIED — patch both the union AND the runtime set in the same diff)

**Edit lines 16–32 (union) — insert `"ACCOUNT_NOT_FOUND"` and `"ACCOUNT_REFERENCED_FK"` in alphabetical order:**

```ts
export type PekuloErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_REFERENCED_FK"
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
```

**Edit lines 34–51 (set) — mirror the union additions:**

```ts
const PEKULO_ERROR_CODES: ReadonlySet<PekuloErrorCode> = new Set<PekuloErrorCode>([
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_REFERENCED_FK",
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
```

**File:** `apps/api/src/platform/http/error-mapper.ts` (MODIFIED — add 2 entries to `ORPC_HTTP_STATUS_BY_CODE`)

**Edit the map (preserve the existing comments + sort by status code cluster):**

```ts
export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  // Compass domain validation (story 1-1, FR-5): both surface as 400 …
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  COMPASS_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  // Accounts domain (story 2-1, FR-10): NOT_FOUND fires when an update or
  // delete probe walks off the userId guard (cross-user attempt or stale id).
  // Distinct code so future telemetry can separate it from generic NOT_FOUND
  // and from compass/milestone-specific 404s.
  ACCOUNT_NOT_FOUND: 404,
  CONFLICT: 409,
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  // Accounts FK guard (story 2-1, AC-2): an account with at least one
  // referencing holding cannot be deleted — the API surfaces this as 409
  // (state-shape conflict), not as 400 (the request itself is well-formed).
  ACCOUNT_REFERENCED_FK: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  TRANSACTION_FAILED: 500,
};
```

**Run:** `bun --filter=api run typecheck && bun --filter=api test src/common/errors/`

**Expected output:** typecheck exit 0; existing error tests still pass (the new codes don't break the `isPekuloError` duck-type — they're added to the set in the same commit).

**Commit:**

```bash
git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts
git commit -m "feat(#17): T3 PekuloErrorCode ACCOUNT_NOT_FOUND/REFERENCED_FK + statuses"
```

---

#### T4 — Rename `Account` → `AccountCardItem` + add domain `Account` re-export

**File:** `packages/types/src/index.ts` (MODIFIED — rename the existing UI shape; add canonical domain re-export)

Locate the `// ─── Account (Comptes / Patrimoine) ───…` block and replace with:

```ts
// ─── Account (Comptes / Patrimoine) ──────────────────────────────────────
// Domain TS contract lives in @pekulo/validators (z.infer<typeof accountSchema>).
// The UI prop shape is kept here under the rename AccountCardItem (story 1-2
// precedent — Milestone → MilestoneCardItem). The canonical domain Account
// is re-exported from @pekulo/validators below.
export const ACCOUNT_TYPES = ["livret", "pea", "cto", "av", "autre"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** UI prop shape consumed by PekuloAccountRow / PekuloAccountsSection. */
export interface AccountCardItem {
  label: string;
  type: AccountType;
  institution?: string;
  balanceEur: number;
}

/** Canonical domain entity (z.infer from @pekulo/validators#accountSchema). */
export type { Account } from "@pekulo/validators";
```

> Note: if there is no `// ─── Account (Comptes / Patrimoine) ───` block in current `types/src/index.ts` (the file may have been reorganised), search for `export interface Account` and `export const ACCOUNT_TYPES` — those two declarations are the move targets.

**File:** `packages/ui/src/components/PekuloAccountRow.tsx` (MODIFIED — single-line import + prop type fix)

Change line 4 from:

```ts
import type { Account, AccountType } from "@pekulo/types";
```

to:

```ts
import type { AccountCardItem, AccountType } from "@pekulo/types";
```

Change line 8 from:

```ts
export type PekuloAccountRowProps = Account;
```

to:

```ts
export type PekuloAccountRowProps = AccountCardItem;
```

**File:** `packages/ui/src/components/PekuloAccountsSection.tsx` (MODIFIED — same rename)

Change line 7 from:

```ts
import type { Account } from "@pekulo/types";
```

to:

```ts
import type { AccountCardItem } from "@pekulo/types";
```

Change line 18 from:

```ts
  accounts: Account[];
```

to:

```ts
  accounts: AccountCardItem[];
```

**Run:** `bun --filter=@pekulo/types run typecheck && bun --filter=@pekulo/ui run typecheck`

**Expected output:** exit 0 on both. No new test failures (these UI components don't have unit tests asserting the prop type literal).

**Commit:**

```bash
git add packages/types/src/index.ts packages/ui/src/components/PekuloAccountRow.tsx packages/ui/src/components/PekuloAccountsSection.tsx
git commit -m "feat(#17): T4 rename @pekulo/types#Account → AccountCardItem + re-export domain Account"
```

---

#### T5 — `AccountError` class + factories

**File:** `apps/api/src/modules/accounts/accounts.errors.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.errors.ts
// Typed errors for the accounts domain. AccountError extends PekuloError with
// a literal `name` override; factory functions ensure messages are stable
// (so the error-mapper + telemetry can group them safely).

import { PekuloError } from "../../common/errors";

export class AccountError extends PekuloError {
  override readonly name: string = "AccountError";
}

export function accountNotFound(): AccountError {
  return new AccountError("ACCOUNT_NOT_FOUND", "account not found");
}

export function accountReferencedFk(holdingCount: number): AccountError {
  return new AccountError(
    "ACCOUNT_REFERENCED_FK",
    `account is referenced by ${holdingCount} holding${holdingCount === 1 ? "" : "s"}`,
  );
}
```

**Run:** `bun --filter=api run typecheck`

**Expected output:** exit 0.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.errors.ts
git commit -m "feat(#17): T5 AccountError class + factories"
```

---

#### T6 — Repository RED (fake-Prisma tests)

**File:** `apps/api/src/modules/accounts/accounts.repository.test.ts` (NEW)

**Full content (test structure — fill in fake-Prisma bodies from `apps/api/src/modules/milestones/milestones.repository.test.ts` shape):**

```ts
// apps/api/src/modules/accounts/accounts.repository.test.ts
// Fake-Prisma unit tests for AccountRepository. Mirrors
// milestones.repository.test.ts shape — in-memory rows + jest-like spies on
// the Prisma client method calls.
//
// What we assert here (binds AC-1, AC-4, AC-5, AC-8):
//   - create: returns a row with id matching /^acc_[0-9A-Za-z]{21}$/; the
//     Prisma client.account.create call carries no `where` (it's a write —
//     userId is in `data`).
//   - findByIdForUser: cross-user attempt returns null.
//   - update: cross-user attempt returns null (updateMany count=0).
//   - delete: cross-user attempt returns false (deleteMany count=0).
//   - listByUser: returns only rows where userId matches; Decimal cashBalance
//     is coerced via decimalToNumber.
//   - countHoldingsReferencing: counts holdings where BOTH accountId AND
//     userId match (defense in depth probe).

import { describe, expect, test } from "bun:test";
import { Prisma } from "../../../generated/prisma";
import { createAccountRepository } from "./accounts.repository";

type FakeAccountRow = {
  id: string;
  userId: string;
  label: string;
  type: "livret" | "pea" | "cto" | "av" | "autre";
  currency: string;
  cashBalance: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FakeHoldingRow = {
  id: string;
  userId: string;
  accountId: string;
};

function makeFakeClient(seed: {
  accounts?: FakeAccountRow[];
  holdings?: FakeHoldingRow[];
}) {
  const accounts = [...(seed.accounts ?? [])];
  const holdings = [...(seed.holdings ?? [])];
  return {
    account: {
      async create({ data }: { data: Omit<FakeAccountRow, "id"> & { id?: string } }) {
        // The prefixed-ids extension would inject `id` at runtime; the fake
        // simulates it here.
        const id = data.id ?? `acc_${Math.random().toString(36).slice(2, 23).padEnd(21, "x")}`;
        const row: FakeAccountRow = {
          id,
          userId: data.userId,
          label: data.label,
          type: data.type,
          currency: data.currency ?? "EUR",
          cashBalance: data.cashBalance ?? new Prisma.Decimal(0),
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        accounts.push(row);
        return row;
      },
      async updateMany({ where, data }: { where: { id: string; userId: string }; data: Partial<FakeAccountRow> }) {
        let count = 0;
        for (const row of accounts) {
          if (row.id === where.id && row.userId === where.userId) {
            Object.assign(row, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      async findFirst({ where }: { where: { id?: string; userId: string } }) {
        return accounts.find((row) =>
          row.userId === where.userId && (where.id === undefined || row.id === where.id),
        ) ?? null;
      },
      async findMany({ where }: { where: { userId: string } }) {
        return accounts
          .filter((row) => row.userId === where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async deleteMany({ where }: { where: { id: string; userId: string } }) {
        const before = accounts.length;
        for (let i = accounts.length - 1; i >= 0; i--) {
          if (accounts[i]!.id === where.id && accounts[i]!.userId === where.userId) {
            accounts.splice(i, 1);
          }
        }
        return { count: before - accounts.length };
      },
    },
    holding: {
      async count({ where }: { where: { accountId: string; userId: string } }) {
        return holdings.filter(
          (h) => h.accountId === where.accountId && h.userId === where.userId,
        ).length;
      },
    },
    async $transaction<T>(fn: (tx: ReturnType<typeof makeFakeClient>) => Promise<T>): Promise<T> {
      return fn(this as unknown as ReturnType<typeof makeFakeClient>);
    },
  };
}

describe("createAccountRepository", () => {
  test("create assigns a prefixed id and returns the row", async () => {
    const client = makeFakeClient({});
    const repo = createAccountRepository({ client: client as never });
    const account = await repo.create("user-a", {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(account.id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
    expect(account.userId).toBe("user-a");
    expect(account.cashBalance).toBe(5000);
  });

  test("findByIdForUser returns null on cross-user attempt", async () => {
    const seed: FakeAccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: "user-b",
      label: "B's account",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const client = makeFakeClient({ accounts: [seed] });
    const repo = createAccountRepository({ client: client as never });
    const found = await repo.findByIdForUser("user-a", "acc_zzzzzzzzzzzzzzzzzzzzz");
    expect(found).toBeNull();
  });

  test("update returns null on cross-user attempt (count=0)", async () => {
    const seed: FakeAccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: "user-b",
      label: "B's account",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const client = makeFakeClient({ accounts: [seed] });
    const repo = createAccountRepository({ client: client as never });
    const updated = await repo.update("user-a", "acc_zzzzzzzzzzzzzzzzzzzzz", {
      label: "stolen",
    });
    expect(updated).toBeNull();
  });

  test("delete returns false on cross-user attempt", async () => {
    const seed: FakeAccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: "user-b",
      label: "B's account",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const client = makeFakeClient({ accounts: [seed] });
    const repo = createAccountRepository({ client: client as never });
    const ok = await repo.delete("user-a", "acc_zzzzzzzzzzzzzzzzzzzzz");
    expect(ok).toBe(false);
  });

  test("listByUser returns only matching rows; Decimal cashBalance is coerced", async () => {
    const big = new Prisma.Decimal("1500000.50");
    const rowA: FakeAccountRow = {
      id: "acc_aaaaaaaaaaaaaaaaaaaaa",
      userId: "user-a",
      label: "A1",
      type: "livret",
      currency: "EUR",
      cashBalance: big,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date(),
    };
    const rowB: FakeAccountRow = {
      ...rowA,
      id: "acc_bbbbbbbbbbbbbbbbbbbbb",
      userId: "user-b",
    };
    const client = makeFakeClient({ accounts: [rowA, rowB] });
    const repo = createAccountRepository({ client: client as never });
    const list = await repo.listByUser("user-a");
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("acc_aaaaaaaaaaaaaaaaaaaaa");
    expect(list[0]!.cashBalance).toBe(1500000.5);
  });

  test("countHoldingsReferencing scopes by BOTH accountId AND userId", async () => {
    const accountId = "acc_aaaaaaaaaaaaaaaaaaaaa";
    const holdingsSeed: FakeHoldingRow[] = [
      { id: "hld_1", userId: "user-a", accountId },
      { id: "hld_2", userId: "user-a", accountId },
      { id: "hld_3", userId: "user-b", accountId }, // different user
    ];
    const client = makeFakeClient({ holdings: holdingsSeed });
    const repo = createAccountRepository({ client: client as never });
    const count = await repo.countHoldingsReferencing("user-a", accountId);
    expect(count).toBe(2);
  });
});
```

**Run:** `bun --filter=api test src/modules/accounts/accounts.repository.test.ts`

**Expected output:** RED — file does not exist yet (`createAccountRepository` is undefined). Output should be a module-not-found error.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.repository.test.ts
git commit -m "test(#17): T6 RED accounts.repository.test.ts (fake-Prisma)"
```

---

#### T7 — Repository GREEN (impl)

**File:** `apps/api/src/modules/accounts/accounts.repository.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.repository.ts
// Prisma layer for the accounts module. Six responsibilities:
//   - create(userId, input): insert; id minted by prefixedIds extension (acc_*).
//   - update(userId, id, patch): updateMany scoped by { id, userId } → null on count=0.
//   - delete(userId, id): deleteMany scoped by { id, userId } → false on count=0.
//   - listByUser(userId): all rows for the user, ordered by createdAt asc.
//   - findByIdForUser(userId, id): single-row probe for service-side preconditions.
//   - countHoldingsReferencing(userId, accountId): FK-guard probe used by the
//     service-side delete in $transaction.
//
// Every query carries an explicit `where: { userId }` (ADR-0013, defense in
// depth). Single-row finds use `where: { id, userId }`. Decimal coercion via
// the shared helper at apps/api/src/common/derive/decimal-to-number.ts (L24).
//
// L24 invariant: cashBalance is Prisma.Decimal — coerce via decimalToNumber,
// never `Number(decimal)`. Story 2-1 explicit scope (lessons.md L233).

import type { Account } from "@pekulo/validators";
import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";

export interface CreateAccountRepoInput {
  label: string;
  type: "livret" | "pea" | "cto" | "av" | "autre";
  currency: string;
  cashBalance: number;
  notes: string | null;
}

export interface UpdateAccountRepoInput {
  label?: string;
  type?: "livret" | "pea" | "cto" | "av" | "autre";
  currency?: string;
  cashBalance?: number;
  notes?: string | null;
}

export interface AccountRepository {
  create(userId: string, input: CreateAccountRepoInput): Promise<Account>;
  update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listByUser(userId: string): Promise<Account[]>;
  findByIdForUser(userId: string, id: string): Promise<Account | null>;
  countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
}

type AccountRow = {
  id: string;
  userId: string;
  label: string;
  type: "livret" | "pea" | "cto" | "av" | "autre";
  currency: string;
  cashBalance: unknown;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    type: row.type,
    currency: row.currency,
    cashBalance: decimalToNumber(row.cashBalance, 0),
    notes: row.notes,
    createdAt: row.createdAt ?? new Date(0),
    updatedAt: row.updatedAt ?? new Date(0),
  };
}

export function createAccountRepository(deps: {
  client: ExtendedPrismaClient;
}): AccountRepository {
  return {
    async create(userId, input) {
      const created = await deps.client.account.create({
        data: {
          userId,
          label: input.label,
          type: input.type,
          currency: input.currency,
          cashBalance: input.cashBalance,
          notes: input.notes,
        } as unknown as Parameters<typeof deps.client.account.create>[0]["data"],
      });
      return rowToAccount(created as unknown as AccountRow);
    },

    async update(userId, id, patch) {
      const result = await deps.client.account.updateMany({
        where: { id, userId },
        data: {
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          ...(patch.cashBalance !== undefined ? { cashBalance: patch.cashBalance } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return null;
      const row = await deps.client.account.findFirst({ where: { id, userId } });
      return row ? rowToAccount(row as unknown as AccountRow) : null;
    },

    async delete(userId, id) {
      const result = await deps.client.account.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async listByUser(userId) {
      const rows = await deps.client.account.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => rowToAccount(r as unknown as AccountRow));
    },

    async findByIdForUser(userId, id) {
      const row = await deps.client.account.findFirst({ where: { id, userId } });
      return row ? rowToAccount(row as unknown as AccountRow) : null;
    },

    async countHoldingsReferencing(userId, accountId) {
      // Defense in depth — count only holdings that BOTH reference this
      // account AND belong to the user. RLS would block cross-user rows
      // anyway; the explicit userId guard satisfies story 0-12's lint rule
      // and protects against accidental service-role bypass.
      return deps.client.holding.count({
        where: { accountId, userId },
      });
    },
  };
}
```

**Run:** `bun --filter=api test src/modules/accounts/accounts.repository.test.ts`

**Expected output:** GREEN — all 6 tests pass. `Tests: 6 passed` (or bun-test equivalent).

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.repository.ts
git commit -m "feat(#17): T7 GREEN accounts.repository (where:{userId} + decimalToNumber)"
```

---

#### T8 — Service RED (test)

**File:** `apps/api/src/modules/accounts/accounts.service.test.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.service.test.ts
// Service unit tests on a fake repository + a fake $transaction orchestrator.
// Binds AC-2 (FK guard 409), AC-3 (happy delete), AC-4 (cross-user 404),
// AC-7 (input → service rejection paths).

import { beforeEach, describe, expect, test } from "bun:test";
import type { Account } from "@pekulo/validators";
import { createAccountService } from "./accounts.service";
import type { AccountRepository } from "./accounts.repository";

function fakeRepo(seed?: {
  accounts?: Account[];
  holdingCountByAccount?: Record<string, number>;
}): AccountRepository {
  const accounts = [...(seed?.accounts ?? [])];
  const countMap = seed?.holdingCountByAccount ?? {};
  return {
    async create(userId, input) {
      const created: Account = {
        id: `acc_${Math.random().toString(36).slice(2, 23).padEnd(21, "x")}`,
        userId,
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: input.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      accounts.push(created);
      return created;
    },
    async update(userId, id, patch) {
      const row = accounts.find((a) => a.id === id && a.userId === userId);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date() });
      return row;
    },
    async delete(userId, id) {
      const idx = accounts.findIndex((a) => a.id === id && a.userId === userId);
      if (idx === -1) return false;
      accounts.splice(idx, 1);
      return true;
    },
    async listByUser(userId) {
      return accounts.filter((a) => a.userId === userId);
    },
    async findByIdForUser(userId, id) {
      return accounts.find((a) => a.id === id && a.userId === userId) ?? null;
    },
    async countHoldingsReferencing(_userId, accountId) {
      return countMap[accountId] ?? 0;
    },
  };
}

const fakeTxRunner = {
  $transaction: async <T>(fn: (tx: AccountRepository) => Promise<T>, repo: AccountRepository) =>
    fn(repo),
};

describe("createAccountService", () => {
  let accounts: Account[];
  let countMap: Record<string, number>;
  let repo: AccountRepository;
  let service: ReturnType<typeof createAccountService>;

  beforeEach(() => {
    accounts = [];
    countMap = {};
    repo = fakeRepo({ accounts, holdingCountByAccount: countMap });
    // Fake $transaction: the service calls deps.runTx((tx) => ...) where tx
    // is "the repository for this transaction". We give it the same repo.
    service = createAccountService({
      repository: repo,
      runTx: (fn) => fn(repo),
    });
  });

  test("create delegates to repo and returns the new row", async () => {
    const account = await service.create("user-a", {
      label: "L",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(account.id).toMatch(/^acc_/);
    expect(account.userId).toBe("user-a");
  });

  test("update throws ACCOUNT_NOT_FOUND on cross-user attempt", async () => {
    accounts.push({
      id: "acc_xxxxxxxxxxxxxxxxxxxxx",
      userId: "user-b",
      label: "B",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      service.update("user-a", { id: "acc_xxxxxxxxxxxxxxxxxxxxx", label: "stolen" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  test("delete throws ACCOUNT_REFERENCED_FK when holdings count > 0", async () => {
    accounts.push({
      id: "acc_yyyyyyyyyyyyyyyyyyyyy",
      userId: "user-a",
      label: "A",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    countMap["acc_yyyyyyyyyyyyyyyyyyyyy"] = 2;
    await expect(
      service.delete("user-a", { id: "acc_yyyyyyyyyyyyyyyyyyyyy" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REFERENCED_FK", message: /referenced by 2/ });
    // And the row is still there.
    expect(accounts).toHaveLength(1);
  });

  test("delete happy path returns { ok: true } when no holdings reference", async () => {
    accounts.push({
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: "user-a",
      label: "A",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const out = await service.delete("user-a", { id: "acc_zzzzzzzzzzzzzzzzzzzzz" });
    expect(out).toEqual({ ok: true });
    expect(accounts).toHaveLength(0);
  });

  test("delete throws ACCOUNT_NOT_FOUND on cross-user attempt (count=0 + delete fails)", async () => {
    accounts.push({
      id: "acc_xxxxxxxxxxxxxxxxxxxxx",
      userId: "user-b",
      label: "B",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Holdings count is 0 (user-a's namespace), but the delete will return
    // false because the account belongs to user-b.
    await expect(
      service.delete("user-a", { id: "acc_xxxxxxxxxxxxxxxxxxxxx" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  test("list returns only the user's accounts", async () => {
    accounts.push(
      {
        id: "acc_a",
        userId: "user-a",
        label: "A",
        type: "livret",
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "acc_b",
        userId: "user-b",
        label: "B",
        type: "livret",
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const list = await service.list("user-a");
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("acc_a");
  });
});
```

**Run:** `bun --filter=api test src/modules/accounts/accounts.service.test.ts`

**Expected output:** RED — `createAccountService` undefined; module not found.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.service.test.ts
git commit -m "test(#17): T8 RED accounts.service.test.ts (FK guard + cross-user)"
```

---

#### T9 — Service GREEN (impl with `$transaction`-wrapped delete)

**File:** `apps/api/src/modules/accounts/accounts.service.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.service.ts
// Business logic for the accounts domain. The service is the boundary that
// (a) raises AccountError("ACCOUNT_NOT_FOUND") when the repository returns
// null (cross-user attempt or stale id) and (b) wraps the FK probe + delete
// in a single $transaction to avoid TOCTOU between probing for holdings and
// removing the account row.
//
// The runTx dep is the composition-root-provided $transaction runner. In
// production, runtime-dependencies.ts injects `(fn) =>
// prismaService.client.$transaction((tx) => fn(createAccountRepository({ client: tx })))`.
// In tests, fakeTxRunner.runTx just passes the same repo back through.

import type {
  Account,
  CreateAccountInput,
  DeleteAccountInput,
  UpdateAccountInput,
} from "@pekulo/validators";
import { accountNotFound, accountReferencedFk } from "./accounts.errors";
import type { AccountRepository } from "./accounts.repository";

export interface AccountService {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, input: UpdateAccountInput): Promise<Account>;
  delete(userId: string, input: DeleteAccountInput): Promise<{ ok: true }>;
  list(userId: string): Promise<Account[]>;
}

export interface AccountServiceDeps {
  repository: AccountRepository;
  /**
   * Transaction runner. The service uses it to wrap the FK probe and the
   * delete in a single $transaction so a concurrent holdings insert cannot
   * land between the probe and the delete (TOCTOU). The injected `tx` is a
   * repository scoped to the transaction context.
   */
  runTx<T>(fn: (tx: AccountRepository) => Promise<T>): Promise<T>;
}

export function createAccountService(deps: AccountServiceDeps): AccountService {
  return {
    async create(userId, input) {
      return deps.repository.create(userId, {
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: input.notes ?? null,
      });
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      const updated = await deps.repository.update(userId, id, patch);
      if (!updated) throw accountNotFound();
      return updated;
    },

    async delete(userId, input) {
      // FK guard: probe holdings + delete inside one transaction so a
      // concurrent holding insert cannot slip past the guard. Mirrors
      // milestones.repository.ts#addEnforcingCap shape.
      return deps.runTx(async (tx) => {
        const count = await tx.countHoldingsReferencing(userId, input.id);
        if (count > 0) throw accountReferencedFk(count);
        const ok = await tx.delete(userId, input.id);
        if (!ok) throw accountNotFound();
        return { ok: true as const };
      });
    },

    async list(userId) {
      return deps.repository.listByUser(userId);
    },
  };
}
```

**Run:** `bun --filter=api test src/modules/accounts/accounts.service.test.ts`

**Expected output:** GREEN — `Tests: 6 passed`.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.service.ts
git commit -m "feat(#17): T9 GREEN accounts.service ($tx-wrapped delete + FK guard)"
```

---

#### T10 — `accounts.routes.ts` (oRPC handlers)

**File:** `apps/api/src/modules/accounts/accounts.routes.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.routes.ts
// oRPC handlers for the accounts module. Mirrors milestones.routes.ts:
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError
// when context is missing — the Elysia error mapper translates it to 401.
//
// L8 invariant (story 2-1 explicit): the returned router type is inferred
// via ReturnType<typeof createAccountsRouter>; never annotate as `Elysia`
// or any concrete oRPC implementation type.

import { implement } from "@orpc/server";
import { accountsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { AccountService } from "./accounts.service";

const impl = implement(accountsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createAccountsRouter(deps: { service: AccountService }) {
  return impl.router({
    create: impl.create.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.create(context.userId, input);
    }),
    update: impl.update.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.update(context.userId, input);
    }),
    delete: impl.delete.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.delete(context.userId, input);
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
  });
}
```

**Run:** `bun --filter=api run typecheck`

**Expected output:** exit 0 — the file fails to compile if `accountsContract` is still the empty scaffold (no `.create`, `.update`, etc.). This is INTENTIONAL — T11 fixes the contract in the next commit. If you want a clean typecheck pass before T11, swap T10 and T11.

> Decision: ship T11 (contract) BEFORE T10 (routes) so the typecheck passes at every commit. Renumber accordingly when running. The story keeps the logical ordering "routes then contract" because the routes' shape is what drives the contract's procedure list.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.routes.ts
git commit -m "feat(#17): T10 accounts.routes oRPC handlers"
```

---

#### T11 — Populate `packages/contracts/src/accounts.contract.ts`

**File:** `packages/contracts/src/accounts.contract.ts` (MODIFIED — full replacement)

**Full content:**

```ts
// packages/contracts/src/accounts.contract.ts
// Accounts module oRPC contract. Four procedures:
//   - create: insert an account; returns the new Account.
//   - update: patch label/type/currency/cashBalance/notes of an existing account.
//   - delete: remove an account scoped by id+userId (FK-guarded at service layer).
//   - list: read all accounts for the user, ordered by createdAt asc.
// See ADR-0009 (mount under /rpc/v1/accounts).

import { oc } from "@orpc/contract";
import {
  accountSchema,
  createAccountInputSchema,
  deleteAccountInputSchema,
  deleteAccountOutputSchema,
  listAccountsOutputSchema,
  updateAccountInputSchema,
} from "@pekulo/validators";

export const accountsContractV1 = {
  create: oc.input(createAccountInputSchema).output(accountSchema),
  update: oc.input(updateAccountInputSchema).output(accountSchema),
  delete: oc.input(deleteAccountInputSchema).output(deleteAccountOutputSchema),
  list: oc.output(listAccountsOutputSchema),
} as const;

export const accountsContract = accountsContractV1;
export const accountsContractMeta = {
  moduleKey: "accounts",
  mountPath: "/rpc/v1/accounts",
  version: "v1",
} as const;
```

**Run:** `bun --filter=@pekulo/contracts run typecheck && bun --filter=api run typecheck`

**Expected output:** exit 0 on both. The routes file from T10 now compiles cleanly.

**Commit:**

```bash
git add packages/contracts/src/accounts.contract.ts
git commit -m "feat(#17): T11 accounts oRPC contract (4 procedures)"
```

---

#### T12 — Module factory + module test + runtime wiring

**File:** `apps/api/src/modules/accounts/accounts.module.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.module.ts
// Module factory wiring repository + service + router for the accounts
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 invariant (story 2-1 explicit): the router type is inferred via
// ReturnType<typeof createAccountsRouter>; never annotate as `Elysia`.

import type { PrismaService } from "../../database";
import { createAccountRepository, type AccountRepository } from "./accounts.repository";
import { createAccountService, type AccountService } from "./accounts.service";
import { createAccountsRouter } from "./accounts.routes";

export interface AccountsModule {
  service: AccountService;
  router: ReturnType<typeof createAccountsRouter>;
}

export function createAccountsModule(deps: {
  prismaService: PrismaService;
}): AccountsModule {
  const repository = createAccountRepository({ client: deps.prismaService.client });
  // The transaction runner closes over prismaService.client.$transaction.
  // Inside the callback, we build a tx-scoped repository so every query
  // (including the FK probe) runs against the same transaction.
  const service = createAccountService({
    repository,
    async runTx<T>(fn: (tx: AccountRepository) => Promise<T>): Promise<T> {
      return deps.prismaService.client.$transaction(async (tx) =>
        fn(createAccountRepository({ client: tx as unknown as typeof deps.prismaService.client })),
      );
    },
  });
  const router = createAccountsRouter({ service });
  return { service, router };
}
```

**File:** `apps/api/src/modules/accounts/accounts.module.test.ts` (NEW)

**Full content:**

```ts
// apps/api/src/modules/accounts/accounts.module.test.ts
// Whole-module wired flow on fake Prisma. Asserts the module composes
// repository + service + router correctly: a create → list → delete cycle
// resolves the same way it would in production (modulo Prisma client
// substitution).
//
// Note (story 1-1 / 1-2 precedent): live-DB harness was deferred. AC-1, AC-4
// are covered by the lint rule `pekulo/no-prisma-query-without-user-id` +
// the fake-Prisma asserts here. The integration test (T13) further pins the
// HTTP boundary.

import { describe, expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import { createAccountsModule } from "./accounts.module";

function makeFakePrismaService(): PrismaService {
  const accounts: Array<{
    id: string;
    userId: string;
    label: string;
    type: string;
    currency: string;
    cashBalance: number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const holdings: Array<{ id: string; userId: string; accountId: string }> = [];
  const client = {
    account: {
      async create({ data }: { data: { userId: string; label: string; type: string; currency: string; cashBalance: number; notes: string | null } }) {
        const row = {
          id: `acc_${(accounts.length + 1).toString().padStart(21, "0")}`,
          userId: data.userId,
          label: data.label,
          type: data.type,
          currency: data.currency,
          cashBalance: data.cashBalance,
          notes: data.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        accounts.push(row);
        return row;
      },
      async updateMany({ where, data }: { where: { id: string; userId: string }; data: Record<string, unknown> }) {
        let count = 0;
        for (const row of accounts) {
          if (row.id === where.id && row.userId === where.userId) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
      async deleteMany({ where }: { where: { id: string; userId: string } }) {
        const before = accounts.length;
        for (let i = accounts.length - 1; i >= 0; i--) {
          if (accounts[i]!.id === where.id && accounts[i]!.userId === where.userId) {
            accounts.splice(i, 1);
          }
        }
        return { count: before - accounts.length };
      },
      async findFirst({ where }: { where: { id: string; userId: string } }) {
        return accounts.find((r) => r.id === where.id && r.userId === where.userId) ?? null;
      },
      async findMany({ where }: { where: { userId: string } }) {
        return accounts.filter((r) => r.userId === where.userId);
      },
    },
    holding: {
      async count({ where }: { where: { accountId: string; userId: string } }) {
        return holdings.filter((h) => h.accountId === where.accountId && h.userId === where.userId).length;
      },
    },
    async $transaction<T>(fn: (tx: typeof client) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };
  return { client } as unknown as PrismaService;
}

describe("createAccountsModule", () => {
  test("create → list → update → delete happy path", async () => {
    const prismaService = makeFakePrismaService();
    const mod = createAccountsModule({ prismaService });
    const created = await mod.service.create("user-a", {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(created.id).toMatch(/^acc_/);
    let list = await mod.service.list("user-a");
    expect(list).toHaveLength(1);
    const updated = await mod.service.update("user-a", { id: created.id, label: "Livret renamed" });
    expect(updated.label).toBe("Livret renamed");
    const out = await mod.service.delete("user-a", { id: created.id });
    expect(out).toEqual({ ok: true });
    list = await mod.service.list("user-a");
    expect(list).toHaveLength(0);
  });
});
```

**File:** `apps/api/src/bootstrap/runtime-dependencies.ts` (MODIFIED — add accounts wiring)

Add the import near the other module imports (top of file):

```ts
import { createAccountsModule } from "../modules/accounts/accounts.module";
```

Inside `createRuntimeDependencies`, AFTER `const milestonesModule = …` and BEFORE the `wealthHistoryProvider` block (or wherever logically convenient, but BEFORE the final `orpcRouter` assembly), add:

```ts
  const accountsModule = createAccountsModule({ prismaService });
```

Update the `orpcRouter` assembly to include accounts:

```ts
  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
  };
```

> Note: `PekuloRpcRouter` (from `apps/api/src/platform/http/orpc-mount.ts`) must declare `accounts: ReturnType<typeof createAccountsRouter>` — if it doesn't, add that property. Inspect the type before editing; the milestones / compass entries are precedent for the shape.

**Run:** `bun --filter=api test src/modules/accounts/accounts.module.test.ts && bun --filter=api run typecheck && bun --filter=api run lint`

**Expected output:** module test passes; typecheck exit 0; lint exit 0 (no `pekulo/no-prisma-query-without-user-id` violations).

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.module.ts apps/api/src/modules/accounts/accounts.module.test.ts apps/api/src/bootstrap/runtime-dependencies.ts
git commit -m "feat(#17): T12 accounts.module factory + runtime wiring"
```

---

#### T13 — Integration test

**File:** `apps/api/src/modules/accounts/accounts.integration.test.ts` (NEW)

**Full content (mirror `apps/api/src/modules/milestones/milestones.integration.test.ts` — see its shape; the structure below is the binding contract):**

```ts
// apps/api/src/modules/accounts/accounts.integration.test.ts
// oRPC HTTP boundary test. Spins an Elysia app with a fake-Prisma backed
// runtime composition, signs JWTs for user A and user B, asserts:
//   1. create → list happy path returns the new account.
//   2. Missing/invalid bearer → HTTP 401 within 100 ms (NFR-9).
//   3. Cross-user update/delete → HTTP 404 with code ACCOUNT_NOT_FOUND.
//   4. Delete with referencing holdings → HTTP 409 with code
//      ACCOUNT_REFERENCED_FK and message mentioning the holding count.
//
// Live-DB harness deferred per story 1-1 outcome. The fake-Prisma here is
// the same shape as accounts.module.test.ts's fake — DRY between the two
// tests is intentional: each one pins a different boundary (module vs HTTP).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
// Re-use the integration test scaffold from milestones — JWT signing,
// app bootstrap, fetch helper — by importing from the shared helpers if
// they exist, or inline the setup mirroring milestones.integration.test.ts
// otherwise. The story leaves the import path to the dev: check
// apps/api/src/test/helpers/ first, fall back to inlining.

// Test bodies follow the same shape as milestones.integration.test.ts;
// see that file for the canonical JWT signing helper, app spin-up, and
// oRPC-call helper.
//
// ASSERTIONS:
//   - POST /rpc/v1/accounts/create with valid JWT → 200 + body matches
//     accountSchema (regex on id, type union, etc.)
//   - POST /rpc/v1/accounts/list with no Authorization header → 401
//   - POST /rpc/v1/accounts/update with userA's JWT against userB's
//     account id → 404 { code: "ACCOUNT_NOT_FOUND" }
//   - POST /rpc/v1/accounts/delete with userA's JWT against userA's
//     account that has 2 holdings → 409 { code: "ACCOUNT_REFERENCED_FK",
//     message: /referenced by 2 holdings/ }

describe.todo("accounts integration (oRPC HTTP boundary)", () => {
  test.todo("create + list happy path (200)");
  test.todo("missing bearer → 401");
  test.todo("cross-user update → 404 ACCOUNT_NOT_FOUND");
  test.todo("delete with referencing holdings → 409 ACCOUNT_REFERENCED_FK");
});
```

> **Dev guidance:** The `.todo` markers above are intentional — they tell the dev which test names to fill in, while the file passes typecheck and `bun test` (todos are skipped, not failures). The dev's actual implementation drops the `.todo` and fills the bodies by mirroring `milestones.integration.test.ts` (JWT signing via `apps/api/src/platform/security/jwt-verifier`, app bootstrap via `createRuntimeDependencies`, fetch helper either inlined or via existing test helpers). If a shared `apps/api/src/test/helpers/orpc-fetch.ts` exists from earlier stories, prefer it; otherwise inline.

**Run:** `bun --filter=api test src/modules/accounts/accounts.integration.test.ts`

**Expected output:** GREEN — all 4 tests pass (post-implementation). The `.todo` placeholder version produces output like `4 todo`, which is acceptable but the AC binds the implementation to be filled.

**Commit:**

```bash
git add apps/api/src/modules/accounts/accounts.integration.test.ts
git commit -m "feat(#17): T13 accounts integration test (HTTP boundary)"
```

---

### Closing checks before review

Run all of the following from the repo root after every task lands. Final pre-PR pass:

```bash
bun --filter=api run typecheck
bun --filter=api run lint
bun --filter=api test
bun --filter=@pekulo/contracts run typecheck
bun --filter=@pekulo/validators run typecheck
bun --filter=@pekulo/types run typecheck
bun --filter=@pekulo/ui run typecheck
```

All must exit 0. The integration test's `.todo` markers must be replaced by actual test bodies before the story flips to `done`.

## File List

### Created

- `apps/api/prisma/migrations/<timestamp>_accounts_uuid_to_text/migration.sql`
- `packages/validators/src/accounts.ts`
- `apps/api/src/modules/accounts/accounts.errors.ts`
- `apps/api/src/modules/accounts/accounts.repository.ts`
- `apps/api/src/modules/accounts/accounts.service.ts`
- `apps/api/src/modules/accounts/accounts.routes.ts`
- `apps/api/src/modules/accounts/accounts.module.ts`
- `apps/api/src/modules/accounts/accounts.repository.test.ts`
- `apps/api/src/modules/accounts/accounts.service.test.ts`
- `apps/api/src/modules/accounts/accounts.module.test.ts`
- `apps/api/src/modules/accounts/accounts.integration.test.ts`

### Modified

- `packages/contracts/src/accounts.contract.ts`
- `packages/validators/src/index.ts`
- `packages/types/src/index.ts`
- `packages/ui/src/components/PekuloAccountRow.tsx`
- `packages/ui/src/components/PekuloAccountsSection.tsx`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/common/errors/pekulo-error.ts`
- `apps/api/src/platform/http/error-mapper.ts`

### Untouched (defensively documented)

- `apps/api/prisma/schema/accounts.prisma` — already declares `id String @id` (Prisma-side TEXT). The migration aligns the DB column type to match.
- `apps/api/src/database/id-prefixes.config.ts` — `Account: "acc"` stays. The migration makes the column compatible with the extension's output.
- `apps/api/scripts/rls-audit.ts` — `accounts: 4` policy count is preserved post-migration (the column-type flip does not affect `auth.uid() = user_id` policies).

## Dev Agent Record

- **Model:** claude-opus-4-7 (1M context)
- **Started:** 2026-05-15T15:00:00Z
- **Completed:** 2026-05-15T15:55:00Z

### Debug Log

- T6 → T7 RED witnessed: `Cannot find module './accounts.repository'` before impl landed.
- T8 → T9 first GREEN pass surfaced two test issues: (1) `toMatchObject({ code, message })` mishandles `AccountError` instance props in Bun's reject matcher, and (2) `stubRepo` was spreading the `seed.accounts` array so external `.push()` calls didn't propagate to the repository view. Fixed via a `expectRejection` catch-helper + holding the seed array by reference.
- Migration (T1) applied 2026-05-15T16:00:00Z. Two deviations hit during deploy:
  1. **Transaction pooler hang**: `DATABASE_URL` points to `aws-0-eu-west-1.pooler.supabase.com:6543` (transaction pooler) — `prisma migrate deploy` hangs there indefinitely with zero output. Workaround: export `DATABASE_URL="$DIRECT_URL"` (session pooler, port 5432) for the deploy command. This is the documented story-1-1 deviation now extended to `migrate deploy` (not just `migrate dev`).
  2. **P3005 brownfield baseline drift**: prior story migrations (compass / milestones / monthly index) had been applied out-of-band (Supabase SQL editor) and were never recorded in `_prisma_migrations`. Resolved by `prisma migrate resolve --applied <name>` on each of the 4 prior migrations (baseline + 3 story migrations) before the actual deploy. Future stories should use `prisma migrate deploy` normally — the tracker is now in sync with the live DB.
- Post-deploy RLS audit (`bun run scripts/rls-audit.ts` against DIRECT_URL): drift list does NOT include `accounts` or `holdings` — both retain `rowsecurity=true` AND `policy count = 4` post-migration (AC-10 satisfied). Pre-existing drift on `kpis` / `monthly_tracking` / `hypotheses` (RLS disabled on those tables) is unrelated to this story — to be triaged separately.
- Pre-existing 22 test failures in `bun test` from `apps/api` (compass + milestones modules) are NOT introduced by this story. Confirmed by `git stash` baseline: same 22 fail / 5 errors / 143 pass / 165 total before and after my changes. Looks like a test-ordering bug (`Cannot access 'impl' before initialization` in compass.routes.ts + milestones.routes.ts when run AFTER certain other suites). All 4 new accounts test files pass cleanly in isolation AND together (22/22).
- Lint script note: the story references `bun --filter=api run lint`, but `apps/api/package.json` has no `lint` script — `oxlint` runs from repo root. Confirmed scoped `oxlint apps/api/src/modules/accounts …` exits 0 with zero warnings/errors.

### Completion Notes

- All 13 tasks land as planned. T10/T11 shipped in swapped order (contract first → routes second) per the story's own dev guidance so typecheck stayed at exit 0 every commit.
- Migration column-type flip (T1) overrides the story-1-4 brownfield-UUID precedent: `Account` keeps its `"acc"` registration in `id-prefixes.config.ts` and the existing rows are re-id'd in-place via PL/pgSQL. Story-1-4's `Hypothesis: null` precedent is the alternative and remains valid for stories 3-1 (Holdings) and 5-1 (Transactions) per their own scope.
- HTTP-boundary FK guard (AC-2, 409) and cross-user (AC-4, 404) paths stay covered at the **service/module** test layer rather than the integration test layer — `RPCHandler` wraps handler-thrown errors before the Elysia error mapper sees them (same constraint the milestones integration test documents on its delete path). The unit + module tests prove `AccountError("ACCOUNT_REFERENCED_FK")` is raised with the correct count-aware message and that the repo `delete` returns `false` cross-user → service raises `ACCOUNT_NOT_FOUND`.
- L24 (Decimal coercion) applied at the row → DTO boundary via `decimalToNumber(row.cashBalance, 0)` in `accounts.repository.ts#rowToAccount`. No `Number(decimal)` anywhere in the diff; the helper was not re-extracted.
- L8 (`Elysia` invariance) honoured — `AccountsModule.router` is `ReturnType<typeof createAccountsRouter>`, never an `Elysia` annotation. Zero `accounts.types.ts` file inside `apps/api/src/modules/accounts/` (L1 invariant): every type lives in `@pekulo/types` (via re-export from `@pekulo/validators`) or as locally inferred `interface AccountServiceDeps`-style internals colocated with their factory.

### File List

**Created**
- `apps/api/prisma/migrations/20260515150000_accounts_uuid_to_text/migration.sql` — UUID → TEXT flip + re-id (T1)
- `packages/validators/src/accounts.ts` — Zod schemas (T2)
- `apps/api/src/modules/accounts/accounts.errors.ts` — AccountError + factories (T5)
- `apps/api/src/modules/accounts/accounts.repository.ts` — Prisma layer (T7)
- `apps/api/src/modules/accounts/accounts.repository.test.ts` — fake-Prisma unit tests (T6 RED → T7 GREEN)
- `apps/api/src/modules/accounts/accounts.service.ts` — business logic w/ `$transaction`-wrapped delete (T9)
- `apps/api/src/modules/accounts/accounts.service.test.ts` — service unit tests (T8 RED → T9 GREEN)
- `apps/api/src/modules/accounts/accounts.routes.ts` — oRPC handlers (T10)
- `apps/api/src/modules/accounts/accounts.module.ts` — module factory (T12)
- `apps/api/src/modules/accounts/accounts.module.test.ts` — wired-flow module test (T12)
- `apps/api/src/modules/accounts/accounts.integration.test.ts` — HTTP boundary integration test (T13)

**Modified**
- `packages/contracts/src/accounts.contract.ts` — 4 oRPC procedures (T11)
- `packages/validators/src/index.ts` — `export * from "./accounts"` (T2)
- `packages/types/src/index.ts` — rename `Account` → `AccountCardItem` + re-export domain `Account` from `@pekulo/validators` (T4)
- `packages/ui/src/components/PekuloAccountRow.tsx` — import rename (T4)
- `packages/ui/src/components/PekuloAccountsSection.tsx` — import rename (T4)
- `apps/api/src/bootstrap/runtime-dependencies.ts` — wire `createAccountsModule` + register `accounts:` on `orpcRouter` (T12)
- `apps/api/src/common/errors/pekulo-error.ts` — add `ACCOUNT_NOT_FOUND` + `ACCOUNT_REFERENCED_FK` to union AND set (T3)
- `apps/api/src/platform/http/error-mapper.ts` — map new codes → 404 / 409 (T3)
- `docs/state.yaml` — flip `2-1-accounts-orpc-port` to `in-progress` (auto-flipped to `done` by aped-review on merge)

**Untouched (defensively documented in story plan)**
- `apps/api/prisma/schema/accounts.prisma` — already declares `id String @id`.
- `apps/api/src/database/id-prefixes.config.ts` — `Account: "acc"` stays.
- `apps/api/scripts/rls-audit.ts` — `accounts: 4` policy count preserved post-migration.
