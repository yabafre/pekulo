# Story: 4-1-realestate-domain — Real-estate module — properties, mortgage, rental, valuation history

**Epic:** Epic 4 — Real-estate (V1 new module)
**Status:** review
**Ticket:** [#24](https://github.com/yabafre/pekulo/issues/24)
**Branch:** `feature/24-4-1-realestate-domain`
**Commit prefix:** `feat(#24): …`
**Depends on:** 0-4-prisma-setup (done), 0-5-orpc-contracts-scaffold (done)
**Complexity:** L

## Post-mainsync refresh (2026-05-20 — PR #86 absorbed)

Main shipped the archi-deadcode audit pass (commit `08c9431`) **between this story's T19 push and the eventual squash-merge**. The branch was synced via a non-fast-forward merge (commit `0777f62`) + an R1 alignment commit (`a0cc73c`). The original tasks T1-T19 below still describe the work performed ; the path references they quote were realigned in the sync to match the new R7 folder-by-domain convention (see `architecture.md § Audit-derived conventions`).

**Refreshed paths (R11 folder-by-domain — PR #86 commit `dfaa280`):**

| Original task path | Realigned R11 path |
|---|---|
| `packages/validators/src/realestate.ts` (T7) | `packages/validators/src/realestate/realestate.schemas.ts` + `realestate/index.ts` |
| `packages/contracts/src/realestate.contract.ts` (T13) | `packages/contracts/src/realestate/realestate.contract.ts` (git auto-rename ; T13's 12-procedure content preserved) |
| `packages/types/src/index.ts` Real-estate section (T8) | `packages/types/src/realestate/realestate.types.ts` (`PROPERTY_TYPES` + branded IDs + `PropertyCardItem` + `@pekulo/validators` re-exports) |
| `packages/ui/src/components/PekuloPropertyCard.tsx` (T8 rename consumer) | `packages/ui/src/components/PekuloPropertyCard/PekuloPropertyCard.tsx` (R7 sibling layout — uses `../PekuloDonut`) |

**Other R-rule alignments applied during sync:**

- **R1** — `import { z } from "zod"` retired in favour of `import { z } from "@pekulo/zod"` (validators + repository test) ; commit `a0cc73c`.
- **R8** — validator-side `PROPERTY_TYPES` export demoted to private `PROPERTY_TYPES_MIRROR` const (matches accounts/holdings precedent) ; SSOT stays in `@pekulo/types#PROPERTY_TYPES`.
- **R6** — `realestateTags` registry entry in `apps/web/src/lib/zapaction/keys.ts` retained because the realestate oRPC module is mounted (T16). The pre-sync version referenced a now-removed `portfolioKeys.holdings()` cross-edge — dropped in the sync.

Post-sync verification: `bun --filter='@pekulo/*' run typecheck` → 0 ; `cd apps/api && bun test` → 377 pass / 0 fail ; realestate suite alone → 48/48 ; `cd apps/web && bun run test` (vitest) → 45/45.

## User Story

**As a** Pekulo user, **I want** to create a property with valuation, attach a single mortgage and a single rental block (with full attach/update/detach lifecycle), and update valuations with the prior amount preserved, **so that** my real-estate footprint is tracked alongside cash and brokerage with audit history (FR-27), defense-in-depth (per-user `where: { userId }` ON TOP of Supabase RLS), and a clean handover to story 4-2 (derives) + 4-3 (UI).

## Acceptance Criteria

- **AC-1 (createProperty + prefixed id):** **Given** a fresh DB, **When** `createProperty({ label: "Appartement Lyon", propertyType: "locatif", currentValuation: 250000, lastValuedOn: "2026-05-01" })` is called for user A, **Then** a `real_estate` row persists with `id` matching `/^res_[0-9A-Za-z]{21}$/`, `user_id = A`, `current_valuation = 250000`, `last_valued_on = 2026-05-01`, `created_at` populated by Postgres default. Repo test reads back the row and asserts each field.
- **AC-2 (attachMortgage + updateMortgage + detachMortgage — full lifecycle):** **Given** user A owns `res_aaa…`, **When** A calls `attachMortgage({ propertyId: "res_aaa…", outstandingPrincipal: 180000, annualRate: 0.025, monthlyPayment: 800, termMonths: 240, startDate: "2020-01-01" })`, **Then** a `real_estate_mortgage` row persists with `id` matching `/^resm_[0-9A-Za-z]{21}$/`, `real_estate_id = res_aaa…`, unique constraint on `real_estate_id` enforced. **And When** A calls `attachMortgage` again on the same property, **Then** the service rejects with `RealestateError("MORTGAGE_ALREADY_ATTACHED", "property already has a mortgage attached")` → HTTP **409**. **And When** A calls `updateMortgage({ propertyId: "res_aaa…", monthlyPayment: 850 })` on a property WITH a mortgage, **Then** the row's `monthly_payment` is updated AND `updated_at` is re-stamped. **And When** A calls `updateMortgage` on a property WITHOUT a mortgage, **Then** the service rejects with `MORTGAGE_NOT_FOUND` → HTTP **404**. **And When** A calls `detachMortgage({ propertyId: "res_aaa…" })` on a property WITH a mortgage, **Then** the row is removed and the response is `{ ok: true }`. **And When** A calls `detachMortgage` on a property WITHOUT a mortgage, **Then** the response is `{ ok: true }` (idempotent — no `MORTGAGE_NOT_FOUND` thrown).
- **AC-3 (attachRental + updateRental + detachRental — full lifecycle):** **Given** user A owns `res_aaa…`, **When** A calls `attachRental({ propertyId: "res_aaa…", monthlyRent: 1200, monthlyCharges: 200, furnished: false })`, **Then** a `real_estate_rental` row persists with `id` matching `/^resr_[0-9A-Za-z]{21}$/`, `real_estate_id = res_aaa…`, unique constraint on `real_estate_id` enforced. **And When** A calls `attachRental` again on the same property, **Then** the service rejects with `RENTAL_ALREADY_ATTACHED` → HTTP **409**. **And When** A calls `updateRental({ propertyId: "res_aaa…", monthlyRent: 1300 })` on a property WITH a rental, **Then** the row's `monthly_rent` is updated AND `updated_at` re-stamped. **And When** A calls `updateRental` on a property WITHOUT a rental, **Then** the service rejects with `RENTAL_NOT_FOUND` → HTTP **404**. **And When** A calls `detachRental({ propertyId: "res_aaa…" })`, **Then** the row is removed and the response is `{ ok: true }` — idempotent on subsequent calls.
- **AC-4 (recordValuation atomic — 1-1 / 2-2 precedent):** **Given** A's property `res_aaa…` with `current_valuation = 250000` and `last_valued_on = 2024-01-01`, **When** A calls `recordValuation({ propertyId: "res_aaa…", amount: 280000, valuedOn: "2026-05-01" })`, **Then** in ONE `prisma.$transaction`: (a) `real_estate.current_valuation = 280000` AND `real_estate.last_valued_on = 2026-05-01`, AND (b) a new `real_estate_valuations` row with `id` matching `/^resv_[0-9A-Za-z]{21}$/`, `user_id = A`, `real_estate_id = res_aaa…`, `amount = 280000`, `valued_on = 2026-05-01`. Either both writes succeed or neither does. Repo test asserts the post-write state of BOTH tables. **`valuedOn` accepts future dates** (mirrors story 2-2 `recordBalanceChange.valuedOn`).
- **AC-5 (listValuations queryable, ordered desc, cross-user safe):** **Given** A made 3 valuation updates on `res_aaa…`, **When** A calls `listValuations({ propertyId: "res_aaa…" })`, **Then** the response contains 3 `RealEstateValuation` rows ordered by `valued_on desc`. **And When** B (different user) calls `listValuations({ propertyId: "res_aaa…" })`, **Then** the service rejects with `REALESTATE_NOT_FOUND` → HTTP **404** (no row leak; the service pre-flight verifies property ownership before returning rows).
- **AC-6 (RLS quartet — audit variant for valuations):** **Given** the migration applied, **When** `bun --filter='@pekulo/api' run db:rls-audit` runs, **Then** the script exits 0 AND reports `real_estate: 4`, `real_estate_mortgage: 4`, `real_estate_rental: 4`, `real_estate_valuations: 2` (INSERT + SELECT only per ADR-0001). The 2-policy count on the audit table is enforced at the SQL layer (no UPDATE / DELETE policy created in the migration).
- **AC-7 (cascade delete + 60 s budget — DR-5):** **Given** user A owns 50 properties each with 1 mortgage + 1 rental + 50 valuation rows (seeded via the test fixture), **When** A calls `deleteProperty({ id: <one-of-them> })`, **Then** the `real_estate` row is removed AND its 1 mortgage + 1 rental + 50 valuation rows are cascade-removed (FK `ON DELETE CASCADE`). Verified by repo test counting rows pre/post. **Timing**: the repo test's `deleteProperty` call completes in < 60 s (DR-5 budget) on a property carrying 50 valuation rows. Test uses `performance.now()` to measure and asserts the elapsed millis.
- **AC-8 (decimal coercion at row → DTO):** **Given** all monetary columns are `NUMERIC NOT NULL` and surface as `Prisma.Decimal`, **When** any read returns a DTO, **Then** every numeric field (`currentValuation`, `outstandingPrincipal`, `annualRate`, `monthlyPayment`, `monthlyRent`, `monthlyCharges`) is a JS `number` — never a `Prisma.Decimal`. AC grep: `grep -rn 'Number(.*Decimal' apps/api/src/modules/realestate | wc -l` returns `0`. The coercion goes through `decimalToNumber(value, fallback)` from `apps/api/src/common/derive/decimal-to-number.ts` (L24).
- **AC-9 (no Prisma query without `userId` guard — lint-enforced):** **Given** the lint config at `.oxlintrc.json` runs `pekulo/no-prisma-query-without-user-id` over `apps/api/**`, **When** `bun --filter='@pekulo/api' run lint` runs, **Then** lint exits 0 for the realestate module. Every `prisma.realEstate.*`, `prisma.realEstateMortgage.*`, `prisma.realEstateRental.*`, `prisma.realEstateValuation.*`, and `tx.*` call carries `where: { userId }` or `where: { id, userId }` or `where: { realEstateId, userId }`. The `prismaIdentifier: ["prisma","tx","client"]` override is already in `.oxlintrc.json` (story 1-1 / 3-1).
- **AC-10 (Elysia invariance + zero `*.types.ts` — L1 + L8):** **Given** the story shipped, **When** the dev runs `bun --filter='@pekulo/api' run typecheck` AND `grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/realestate | wc -l` AND `find apps/api/src/modules/realestate -name '*.types.ts'`, **Then** typecheck exits 0 AND the grep returns `0` AND find returns empty. Every domain type lives in `@pekulo/types` (re-exported from `@pekulo/validators`); internal adapter interfaces (`RealestateDeps`, `RealestateRepository`, `RealestateService`) are co-located in their respective module/service/repository files.
- **AC-11 (oRPC HTTP boundary — 200 / 401 / 404 / 409):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls each of `POST /rpc/v1/realestate/{createProperty, attachMortgage, updateMortgage, detachMortgage, attachRental, updateRental, detachRental, recordValuation, listProperties, getProperty, listValuations, deleteProperty}` with a valid body, **Then** every response is HTTP **200**. **And** missing JWT → HTTP **401** within 100 ms (NFR-9). **And** cross-user mutation / read on A's property by B → HTTP **404** (`REALESTATE_NOT_FOUND`). **And** duplicate `attachMortgage` / `attachRental` → HTTP **409**.
- **AC-12 (validator boundary — bounds + enum):** **Given** the Zod schemas from `@pekulo/validators/realestate`, **When** parsing any of: `{ currentValuation: -1 }`, `{ outstandingPrincipal: -1 }`, `{ annualRate: -0.01 }`, `{ annualRate: 1.01 }`, `{ monthlyPayment: -1 }`, `{ termMonths: 0 }`, `{ termMonths: 601 }`, `{ monthlyRent: -1 }`, `{ monthlyCharges: -1 }`, `{ label: "" }`, `{ label: "x".repeat(121) }`, `{ propertyType: "invalid" }`, **Then** each invocation throws `ZodError`. AC verified by 12 `expect(() => schema.parse(...)).toThrow(ZodError)` assertions in `realestate.repository.test.ts`.
- **AC-13 (cache-invalidation forward-pointer for 4-2/4-3/7-1):** **Given** the story shipped, **When** the dev opens `apps/web/src/lib/zapaction/keys.ts`, **Then** the file declares `REALESTATE_KEY = "realestate"` and registers the `realestate` invalidation tag in the `setTagRegistry({...})` block. Forward-pointer: stories 4-2 / 4-3 / 7-1 declare invalidation edges against this tag without touching `keys.ts` further.

## Tasks

- [x] **T1** — Write the manual migration SQL at `apps/api/prisma/migrations/<timestamp>_create_realestate/migration.sql` (4 tables, 14 RLS policies, 4 indexes, 2 unique constraints for 1:1 children, all `ON DELETE CASCADE` FKs to parent + `auth.users`). Apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Run `bun --filter='@pekulo/api' run db:rls-audit` AFTER T4 lands (the audit script gets its expected counts in T4). [AC: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7]
- [x] **T2** — Register `RealEstateMortgage: "resm"` in `apps/api/src/database/id-prefixes.config.ts`. The other 3 prefixes (`res`, `resr`, `resv`) are already registered. [AC: AC-1, AC-2, AC-3, AC-4]
- [x] **T3** — Create `apps/api/prisma/schema/realestate.prisma` with the 4 models + back-relations. Run `bun --filter='@pekulo/api' run prisma:generate`. [AC: AC-1, AC-2, AC-3, AC-4, AC-7]
- [x] **T4** — Extend `apps/api/scripts/rls-audit.ts` `EXPECTED_POLICY_COUNTS` with `real_estate: 4`, `real_estate_mortgage: 4`, `real_estate_rental: 4`, `real_estate_valuations: 2`. Re-run `bun --filter='@pekulo/api' run db:rls-audit` — must exit 0. [AC: AC-6]
- [x] **T5** — Extend `apps/api/src/common/errors/pekulo-error.ts` (`PekuloErrorCode` union + `PEKULO_ERROR_CODES` set) with 5 new codes (`MORTGAGE_ALREADY_ATTACHED`, `MORTGAGE_NOT_FOUND`, `REALESTATE_NOT_FOUND`, `RENTAL_ALREADY_ATTACHED`, `RENTAL_NOT_FOUND`) — preserve alphabetical sort. Extend `apps/api/src/platform/http/error-mapper.ts` `ORPC_HTTP_STATUS_BY_CODE` with the matching HTTP codes (404 + 409). [AC: AC-2, AC-3, AC-5, AC-11]
- [x] **T6** — Add `apps/api/src/modules/realestate/realestate.errors.ts` with `RealestateError extends PekuloError` + 5 factory functions. [AC: AC-2, AC-3, AC-5]
- [x] **T7** — Add `packages/validators/src/realestate.ts` (12 Zod schemas: `propertyTypeSchema`, `realEstateSchema`, `realEstateMortgageSchema`, `realEstateRentalSchema`, `realEstateValuationSchema`, `createPropertyInputSchema`, `attachMortgageInputSchema`, `updateMortgageInputSchema`, `detachMortgageInputSchema`, `attachRentalInputSchema`, `updateRentalInputSchema`, `detachRentalInputSchema`, `recordValuationInputSchema`, `getPropertyInputSchema`, `deletePropertyInputSchema`, `listValuationsInputSchema`) + barrel re-export from `packages/validators/src/index.ts`. [AC: AC-1, AC-2, AC-3, AC-4, AC-12]
- [x] **T8** — Extend `packages/types/src/index.ts`: rename legacy `Property` interface to `PropertyCardItem` (UI prop shape); add `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` as `z.infer` re-exports from `@pekulo/validators`; add `RealEstateId`, `RealEstateMortgageId`, `RealEstateRentalId`, `RealEstateValuationId` branded types; add `PROPERTY_TYPES` const array. [AC: AC-10]
- [x] **T9** — Add `apps/api/src/modules/realestate/realestate.repository.test.ts` (TDD RED, fake-Prisma) covering: `createProperty` happy path (prefixed id `res_…`); `findByIdForUser` cross-user → null; `listByUser` returns only matching userId rows; `attachMortgage` happy path (prefixed id `resm_…`); unique constraint surface → returns `MortgageAttachOutcome.duplicate`; `updateMortgage` missing → `MortgageUpdateOutcome.not-found`; `detachMortgage` happy + idempotent; (same shape for rental); `recordValuation` atomic `$transaction` writes both tables; `listValuations` desc order; `deleteProperty` cascade-removes 50 children in < 60 s; AC-12 validator rejection cases. [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8, AC-9, AC-12] (TDD RED — expected failure)
- [x] **T10** — Add `apps/api/src/modules/realestate/realestate.repository.ts` (TDD GREEN) — repository factory; methods carry explicit `where: { userId }`; `recordValuation` uses `client.$transaction(async (tx) => …)` writing both `realEstate.update` + `realEstateValuation.create`; `deleteProperty` is a single `deleteMany({ where: { id, userId } })` relying on FK cascade for children. Decimal coercion via `decimalToNumber(row.X, 0)` at every row → DTO boundary. Re-run T9 → expected GREEN. [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8, AC-9]
- [x] **T11** — Add `apps/api/src/modules/realestate/realestate.service.test.ts` (TDD RED) covering: `createProperty` delegates to repo; `attachMortgage` translates `MortgageAttachOutcome.duplicate` → `MORTGAGE_ALREADY_ATTACHED` error; cross-user `attach*`/`update*`/`detach*`/`recordValuation`/`getProperty`/`listValuations`/`deleteProperty` → `REALESTATE_NOT_FOUND`; `recordValuation` cross-user → `REALESTATE_NOT_FOUND`; `updateMortgage` missing → `MORTGAGE_NOT_FOUND`; `detachMortgage` idempotent (no error when missing); same for rental; `deleteProperty` returns `{ ok: true }` on success. [AC: AC-2, AC-3, AC-5, AC-11] (TDD RED — expected failure)
- [x] **T12** — Add `apps/api/src/modules/realestate/realestate.service.ts` (TDD GREEN) — service factory; cross-aggregate guard via `findByIdForUser` BEFORE every mutation; outcome-to-error translation per discriminated repo returns. Re-run T11 → expected GREEN. [AC: AC-2, AC-3, AC-4, AC-5, AC-7, AC-11]
- [x] **T13** — Replace the empty `realestateContractV1 = {} as const` scaffold in `packages/contracts/src/realestate.contract.ts` with 12 oRPC procedures + typed-error declarations. [AC: AC-11]
- [x] **T14** — Add `apps/api/src/modules/realestate/realestate.routes.ts` — `implement(realestateContract).$context<{ userId, email }>().router({ … })` with 12 handlers; each calls `requireUserId(context.userId)` then delegates to service. [AC: AC-11]
- [x] **T15** — Add `apps/api/src/modules/realestate/realestate.module.ts` (factory `createRealestateModule(deps): RealestateModule = { service, router }`) + `apps/api/src/modules/realestate/realestate.module.test.ts` (whole-module wired against fake Prisma). [AC: AC-1, AC-2, AC-3, AC-4, AC-7]
- [x] **T16** — Wire into `apps/api/src/bootstrap/runtime-dependencies.ts` — import `createRealestateModule`, instantiate `const realestateModule = createRealestateModule({ prismaService })`, register `realestate: realestateModule.router` in `orpcRouter`. [AC: AC-11]
- [x] **T17** — Add `apps/api/src/modules/realestate/realestate.integration.test.ts` (oRPC HTTP boundary): for each of the 12 procedures, assert happy 200, missing-JWT 401, cross-user 404, plus 409 paths for `attachMortgage` / `attachRental` duplicate. Mirror `holdings.integration.test.ts`. [AC: AC-11]
- [x] **T18** — Wire the `realestate` invalidation tag into `apps/web/src/lib/zapaction/keys.ts` `setTagRegistry({...})`. Add `REALESTATE_KEY = "realestate"` constant + tag entry. Forward-pointer for 4-2 / 4-3 / 7-1. Run `bun --filter=web run typecheck` — expected exit 0. [AC: AC-13]
- [x] **T19** — Run the full quality gate: `bun --filter='@pekulo/api' run lint`, `bun --filter='@pekulo/api' run typecheck`, `bun --filter='@pekulo/api' run db:rls-audit`, `bun --filter='@pekulo/api' test`, `bun --filter=web run typecheck`. All exit 0. Push the branch. [AC: AC-6, AC-8, AC-9, AC-10]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009)** — Mirror `apps/api/src/modules/accounts/{accounts.module,accounts.routes,accounts.service,accounts.repository,accounts.errors}.ts` + `*.test.ts` siblings. Factory returns `{ service, router }`. **NEVER annotate `Elysia`** (L8 — story 4-1 explicit in lessons.md scope list). Router type inferred via `ReturnType<typeof createRealestateRouter>`.
- **Hard layering (ADR-0010)** — Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. **4-1 is API-only** (UI in 4-3): the chain ends at Elysia.
- **Audit history pattern (ADR-0001 — sister tables)** — `real_estate_valuations` is an append-only sibling of `real_estate`. RLS policies = INSERT + SELECT only (no UPDATE / no DELETE). Identical to story 1-1 `compass_history` and story 2-2 `account_balance_log`. **`db:rls-audit` expected count: 2.**
- **Atomic valuation write (architecture L594, mirrors 1-1 + 2-2)** — `recordValuation` writes BOTH `real_estate.current_valuation/last_valued_on` AND a `real_estate_valuations` row inside the SAME `prisma.$transaction` callback.
- **RLS defense in depth (ADR-0013)** — every Prisma query in `realestate.repository.ts` carries explicit `where: { userId }` (single-row finds use `where: { id, userId }`; child finds use `where: { realEstateId, userId }`). Lint rule `pekulo/no-prisma-query-without-user-id` blocks omissions. The `prismaIdentifier: ["prisma","tx","client"]` override is already configured in `.oxlintrc.json`.
- **Cross-aggregate guard (mirrors 3-1 `findAccountForUser`)** — every attach/update/detach/record/get/list/delete verb pre-flights `findByIdForUser(userId, propertyId)` → returns property row or `null`; service translates `null` to `REALESTATE_NOT_FOUND`. This yields a clear 404 instead of letting RLS produce a confusing P2025.
- **Prefixed IDs (ADR-0012)** — `RealEstate → "res"` (already registered), `RealEstateRental → "resr"` (already registered), `RealEstateValuation → "resv"` (already registered). **T2 adds `RealEstateMortgage → "resm"`**. The extension's `as unknown as Parameters<typeof tx.realEstate.create>[0]["data"]` bridge is required on every `create` branch where `id` is omitted (mirrors 1-1 / 2-1 / 3-1).
- **Decimal coercion (L24, story 4-1 explicit in lessons.md L233 scope list)** — `currentValuation`, `outstandingPrincipal`, `annualRate`, `monthlyPayment`, `monthlyRent`, `monthlyCharges` are `@db.Decimal` (NUMERIC NOT NULL …); coerce via `decimalToNumber(value, fallback)` from `apps/api/src/common/derive/decimal-to-number.ts` (story 1-1 extract). **Inlining `Number(decimal)` = review fail.**
- **Migration discipline (ADR-0014)** — Write the migration SQL manually under `apps/api/prisma/migrations/<timestamp>_create_realestate/migration.sql` (Supabase pooler hang precedent — stories 1-1 T1, 2-1 T1, 2-2 T1, 3-1 T1). Apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy` (per `prisma.config.ts` the deploy path sets `DATABASE_URL=$DIRECT_URL`). The `rls-audit` CI probe re-asserts policy coverage post-deploy.
- **Naming (Phase 3, architecture.md L370)** — Prisma models `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` (PascalCase singular); tables `real_estate`, `real_estate_mortgage`, `real_estate_rental`, `real_estate_valuations` (snake_case, plural on the audit table); contract module key `realestate`; mount path `/rpc/v1/realestate`.
- **oRPC handler shape** — mirror `apps/api/src/modules/holdings/holdings.routes.ts`. Use `implement(realestateContract).$context<{ userId: string; email: string | null }>().router({ … })`. Each handler verifies `context.userId?.trim()` and throws `new PekuloError("UNAUTHORIZED", "user context missing")` when absent.
- **1:1 enforcement** — `real_estate_mortgage.real_estate_id` and `real_estate_rental.real_estate_id` carry a **UNIQUE** constraint at the SQL layer (NOT just a foreign key). The unique constraint is the load-bearing invariant; the service-level pre-flight `findFirst` is a UX nicety for clean 409 responses. If the unique constraint fails, the Prisma error mapper maps `P2002` to `MORTGAGE_ALREADY_ATTACHED` / `RENTAL_ALREADY_ATTACHED` based on the constraint name.
- **`detach*` idempotency** — `detachMortgage` and `detachRental` are idempotent. Implementation: `deleteMany({ where: { realEstateId, userId } })` returns `{ count: 0 | 1 }`; service returns `{ ok: true }` regardless. The verb is intentionally permissive — a user calling detach on a missing child is asking the right thing ("ensure no mortgage attached"), not making an error.
- **`updateMortgage` / `updateRental` shape** — both accept the same fields as their `attach*` siblings but ALL FIELDS ARE OPTIONAL (each field `.optional()` plus a `.refine()` rejecting empty payloads — functionally equivalent to `.partial()` with the extra constraint that the caller must supply at least one field). The service applies only the provided fields (`Prisma.RealEstateMortgageUpdateInput` shape). Missing child → `MORTGAGE_NOT_FOUND` / `RENTAL_NOT_FOUND` (404, NOT idempotent like detach).
- **`deleteProperty` performance (DR-5)** — single `deleteMany({ where: { id, userId } })` relying on FK cascade. The 60 s budget is measured by the repository test seeding 50 properties × 50 valuations × 1 mortgage × 1 rental and timing one `deleteProperty` call.

### ADRs in scope

- `docs/adr/0001-audit-history-via-sister-tables.md` — sister-table audit pattern. **Authoritative for `real_estate_valuations`** (INSERT + SELECT only RLS).
- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — Module factory + oRPC contract-first mount under `/rpc/v1/realestate`.
- `docs/adr/0010-hooks-orchestration-boundary.md` — Hard layering (forward-pointer for 4-3 UI work).
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — Domain types live in `@pekulo/types` (Zod-inferred from `@pekulo/validators`); contracts in `@pekulo/contracts`.
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — Schema folder + prefixed-IDs Prisma extension. Adds `realestate.prisma` to the schema folder.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — Explicit `where: { userId }` + lint rule.
- `docs/adr/0014-prisma-migrations.md` — Manual SQL migrations on this repo (Supabase pooler workaround).

### Lessons re-applied (verbatim scope-list from `docs/lessons.md`)

- **L1 (2026-05-09 — zero `*.types.ts` files inside `apps/api/src/modules/**`)** — every TS type lives in `@pekulo/types`. Story 4-1 conformance: domain `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` re-exported from `@pekulo/validators` Zod-infer through `@pekulo/types`; internal `RealestateRepository`, `RealestateService` interfaces declared INSIDE their respective `*.repository.ts` / `*.service.ts` files — NEVER in a `realestate.types.ts` file. AC-10 grep guard.
- **L8 (2026-05-04 — Elysia 1.4 `Elysia` type is invariant — story 4-1 explicit in scope list at lessons.md L421)** — never annotate variables/parameters as bare `Elysia`. The realestate module factory returns inferred types: `export function createRealestateModule(deps): RealestateModule` where `RealestateModule` interface uses `ReturnType<typeof createRealestateRouter>`. AC-10 grep guard.
- **L24 (2026-05-04 — `Number(decimal)` silently truncates above MAX_SAFE_INTEGER — story 4-1 explicit in scope list at lessons.md L398)** — apply `decimalToNumber()` at every row → DTO boundary in `realestate.repository.ts` (6 fields: `currentValuation`, `outstandingPrincipal`, `annualRate`, `monthlyPayment`, `monthlyRent`, `monthlyCharges`). Do NOT inline `Number(decimal)` and do NOT re-extract the helper. AC-8 grep guard.
- **2026-05-19 — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`)** — every command in this story uses the full namespace `@pekulo/api`, quoted. Fan-out uses `bun --filter='@pekulo/*' run <script>`.
- **2026-05-07 — `bun test` ≠ `vitest run`** — `apps/api`'s `test` script runs `bun test`. All new `*.test.ts` under `apps/api/src/**` use `import { describe, expect, mock, test } from "bun:test"` — never vitest globals.
- **2026-05-05 — `bun --cwd <relative> run <script>` silently fails** — every command in this story uses `bun --filter='@pekulo/api' run …` (workspace-aware).
- **2026-05-04 — Manual SQL migrations preferred over `prisma migrate dev`** (codified by stories 1-1, 2-1, 2-2, 3-1) — T1 writes the migration SQL by hand; T1's apply step uses `bun --filter='@pekulo/api' run prisma:migrate:deploy`.
- **Story 1-1 / 2-1 outcome — `decimalToNumber` is canonical at `apps/api/src/common/derive/decimal-to-number.ts`** — do NOT inline `Number(decimal)`; do NOT duplicate the helper. AC-8.
- **Story 2-1 / 3-1 outcome — `as unknown as Parameters<typeof tx.X.create>[0]["data"]` bridge** for prefixed-id `create` branches — mandatory because Prisma's generated types require `id` when the column has no `@default`. Pattern repeated in `realestate.repository.ts` for every `create` (RealEstate, RealEstateMortgage, RealEstateRental, RealEstateValuation).
- **Story 2-2 outcome — audit sister-table RLS quartet = 2 (INSERT + SELECT only) + cascade-delete via FK from parent** — mirrors exactly here for `real_estate_valuations`. The migration's RLS block omits UPDATE / DELETE policies; the FK `ON DELETE CASCADE` ensures cleanup when the parent property is removed.
- **Story 3-1 outcome — cross-aggregate guard via repository `findFirst({ where: { id, userId } })`** — service pre-flights ownership before every mutation. Mirrored here as `findByIdForUser(userId, propertyId)`.
- **Story 3-3 deviation — `z.coerce.date()` for ISO-string wire payloads** — `recordValuationInputSchema.valuedOn` uses `z.coerce.date()` (mirrors 2-2 `valuedOn` + 3-1 `lot.occurredOn`). Output schema (`realEstateValuationSchema.valuedOn`) keeps `z.date()`.
- **2026-05-17 — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`** — N/A for 4-1 (API-only). UI surfaces belong to story 4-3. Pre-implementation checklist confirms no UI claim is embedded.

### Step-0 quotes (verbatim current state at story-write time)

#### `apps/api/src/database/id-prefixes.config.ts` (current — excerpt, real-estate block)

```ts
  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",
```

> Story 4-1 changes (T2): insert `RealEstateMortgage: "resm",` between `RealEstate: "res",` and `RealEstateRental: "resr",`. The other 3 prefixes stay unchanged.

#### `apps/api/src/common/errors/pekulo-error.ts` (current — `PekuloErrorCode` union)

```ts
export type PekuloErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_REFERENCED_FK"
  | "BAD_REQUEST"
  | "COMPASS_NOT_FOUND"
  | "COMPASS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "HOLDING_CLOSED"
  | "HOLDING_NOT_FOUND"
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

> Story 4-1 changes (T5): insert `"MORTGAGE_ALREADY_ATTACHED"`, `"MORTGAGE_NOT_FOUND"`, `"REALESTATE_NOT_FOUND"`, `"RENTAL_ALREADY_ATTACHED"`, `"RENTAL_NOT_FOUND"` preserving alphabetical sort (between `MILESTONE_YEAR_OUT_OF_RANGE` and `NOT_FOUND`, and between `RATE_LIMITED` and `TRANSACTION_FAILED`). Mirror the insertions in `PEKULO_ERROR_CODES` set.

#### `apps/api/src/platform/http/error-mapper.ts` (current — `ORPC_HTTP_STATUS_BY_CODE` excerpt around real-estate insertion points)

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
  ACCOUNT_NOT_FOUND: 404,
  COMPASS_NOT_FOUND: 404,
  HOLDING_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_REFERENCED_FK: 409,
  HOLDING_CLOSED: 409,
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  TRANSACTION_FAILED: 500,
};
```

> Story 4-1 changes (T5): add `REALESTATE_NOT_FOUND: 404`, `MORTGAGE_NOT_FOUND: 404`, `RENTAL_NOT_FOUND: 404` (under the 404 cluster) AND `MORTGAGE_ALREADY_ATTACHED: 409`, `RENTAL_ALREADY_ATTACHED: 409` (under the 409 cluster). The `Record<PekuloErrorCode, number>` compile-time exhaustiveness check will fail typecheck if any of the 5 new codes are missing.

#### `packages/contracts/src/realestate.contract.ts` (current — empty scaffold)

```ts
// packages/contracts/src/realestate.contract.ts
// Realestate module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/realestate).

export const realestateContractV1 = {} as const;
export const realestateContract = realestateContractV1;
export const realestateContractMeta = {
  moduleKey: "realestate",
  mountPath: "/rpc/v1/realestate",
  version: "v1",
} as const;
```

> Story 4-1 changes (T13): replace the empty `{} as const` with 12 oRPC procedure definitions wired via `oc.input(...).output(...).errors(...)`. The `realestateContractMeta` block stays intact.

#### `packages/validators/src/index.ts` (current — barrel)

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./accounts";
export * from "./compass";
export * from "./holdings";
export * from "./hypothesis";
export * from "./milestones";
```

> Story 4-1 changes (T7): add `export * from "./realestate";` — alphabetical order, between `./milestones` (current last) and end-of-file.

#### `packages/types/src/index.ts` (current — `Property` legacy interface excerpt at line 160)

```ts
// ─── Real-estate ─────────────────────────────────────────────────────────
export interface Property {
  label: string;
  valuationEur: number;
  debtRemainingEur: number;
  monthlyPaymentEur: number;
  yearsRemaining: number;
  repaidPct: number;
}
```

> Story 4-1 changes (T8): rename `Property` → `PropertyCardItem` (UI prop shape consumed by `PekuloPropertyCard.tsx` mockups). Add canonical domain `RealEstate` / `RealEstateMortgage` / `RealEstateRental` / `RealEstateValuation` as `z.infer` re-exports from `@pekulo/validators`. Add branded IDs `RealEstateId`, `RealEstateMortgageId`, `RealEstateRentalId`, `RealEstateValuationId`. Add `PROPERTY_TYPES` const array. Mirror story 2-1's `Account` → `AccountCardItem` and 3-1's `Holding` → `HoldingCardItem` rename pattern.

#### `apps/api/scripts/rls-audit.ts` (current — `EXPECTED_POLICY_COUNTS`)

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
  account_balance_log: 2,
};
```

> Story 4-1 changes (T4): add 4 entries — `real_estate: 4`, `real_estate_mortgage: 4`, `real_estate_rental: 4`, `real_estate_valuations: 2`. The audit table count of 2 mirrors `compass_history` and `account_balance_log` (audit sister tables per ADR-0001).

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — module instantiation excerpt)

```ts
  // Story 3-1 — holdings oRPC port. Independent of compass / accounts (the
  // cross-aggregate account FK probe lives inside the repository — no
  // separate accounts dep needed at the module-factory layer).
  const holdingsModule = createHoldingsModule({ prismaService, env: input.env });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
  };
```

> Story 4-1 changes (T16): import `createRealestateModule`, instantiate `const realestateModule = createRealestateModule({ prismaService })` AFTER the holdings module, register `realestate: realestateModule.router` in the `orpcRouter` object. `PekuloRpcRouter` is `ConstructorParameters<typeof RPCHandler<PekuloRpcContext>>[0]` — automatic type extension, no edit required to `orpc-mount.ts`.

#### `apps/web/src/lib/zapaction/keys.ts` (current — abstract: a `setTagRegistry({...})` block already wires `accountsKeys`, `holdingsKeys`, `portfolioKeys`, `compassKeys`, `milestonesKeys`. The exact line numbers drift; the dev must open the file and locate the registry block.)

> Story 4-1 changes (T18): add `export const REALESTATE_KEY = "realestate" as const;` near the existing `HOLDINGS_KEY` declaration. Add the `realestate` invalidation tag pointing to a `realestateKeys` factory (`all`, `list`, `byId(propertyId)`, `valuations(propertyId)`) similar to `holdingsKeys`. Wire the tag → keys mapping in `setTagRegistry({...})`.

#### `apps/api/prisma/schema/` (current contents — directory listing)

```
_base.prisma
accounts.prisma
compass.prisma
enums.prisma
hypothesis.prisma
milestones.prisma
monthly.prisma
transactions.prisma
```

> Story 4-1 changes (T3): create the new file `realestate.prisma` containing 4 models. No edit to `_base.prisma` (preview features unchanged) or `enums.prisma` (no new enum — `propertyType` is a CHECK constraint, not a Postgres enum, to keep schema changes additive in V2+).

### File decisions (3-bullet per file)

#### NEW — `apps/api/prisma/migrations/<timestamp>_create_realestate/migration.sql`

- **Single responsibility** — create 4 net-new tables (`real_estate`, `real_estate_mortgage`, `real_estate_rental`, `real_estate_valuations`) with prefixed-ID columns, FKs to `auth.users(id)` and to parent (`real_estate.id`) all `ON DELETE CASCADE`, 2 unique constraints on the 1:1 children (`real_estate_id`), 4 indexes, RLS enabled with the appropriate policy counts (4 / 4 / 4 / 2).
- **Inputs** — none (DDL only).
- **Outputs** — schema changes recorded in `_prisma_migrations`; tables ready to receive rows.

#### NEW — `apps/api/prisma/schema/realestate.prisma`

- **Single responsibility** — declare the 4 Prisma models (`RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation`) with `@@map` to snake-case tables, prefixed-ID PKs, FK relations, indexes.
- **Inputs** — none (declarative).
- **Outputs** — Prisma client gets 4 new model accessors after `prisma generate`.

#### NEW — `packages/validators/src/realestate.ts`

- **Single responsibility** — Zod schemas + Z-inferred types for the realestate contract (input shapes for the 12 verbs, row shapes for `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` outputs).
- **Inputs** — `zod` v4.
- **Outputs** — 16+ schemas + their inferred types + 4 id-regex constants + `PROPERTY_TYPES` const array.

#### NEW — `apps/api/src/modules/realestate/realestate.errors.ts`

- **Single responsibility** — typed error factories for the realestate domain (`realestateNotFound`, `mortgageAlreadyAttached`, `mortgageNotFound`, `rentalAlreadyAttached`, `rentalNotFound`); `RealestateError extends PekuloError` narrows the code union.
- **Inputs** — `PekuloError`, `PekuloErrorCode` from `apps/api/src/common/errors`.
- **Outputs** — 1 class + 5 factory functions.

#### NEW — `apps/api/src/modules/realestate/realestate.repository.ts`

- **Single responsibility** — single Prisma touch-point for the realestate domain. Every method carries an explicit `where: { userId }`. Includes the cross-aggregate guard `findByIdForUser(userId, propertyId)` used by every service mutation. `recordValuation` wraps `realEstate.update` + `realEstateValuation.create` in `client.$transaction`.
- **Inputs** — `ExtendedPrismaClient`.
- **Outputs** — `RealestateRepository` interface + `createRealestateRepository(deps)` factory; methods return domain shapes + discriminated outcomes for `attachMortgage` / `updateMortgage` / `detachMortgage` (same for rental).

#### NEW — `apps/api/src/modules/realestate/realestate.service.ts`

- **Single responsibility** — business logic for the realestate domain. `attachMortgage` translates `MortgageAttachOutcome.duplicate` → `MORTGAGE_ALREADY_ATTACHED`. `updateMortgage` missing → `MORTGAGE_NOT_FOUND`. `detachMortgage` idempotent (always `{ ok: true }`). Same for rental. Every mutation pre-flights `findByIdForUser` (cross-user guard).
- **Inputs** — `RealestateRepository`.
- **Outputs** — `RealestateService` interface + `createRealestateService(deps)` factory; throws `RealestateError` on domain rejections.

#### NEW — `apps/api/src/modules/realestate/realestate.routes.ts`

- **Single responsibility** — oRPC handler wiring for the 12 procedures. Verifies user context, delegates to service.
- **Inputs** — `RealestateService`; `realestateContract` from `@pekulo/contracts`.
- **Outputs** — `createRealestateRouter({ service })` returning the oRPC router (type inferred).

#### NEW — `apps/api/src/modules/realestate/realestate.module.ts`

- **Single responsibility** — composition root for the realestate module. Wires repository + service + router; returns `{ service, router }`.
- **Inputs** — `PrismaService` (exposes `.client` extended).
- **Outputs** — `RealestateModule` interface + `createRealestateModule(deps): RealestateModule` factory.

#### NEW — `apps/api/src/modules/realestate/{realestate.repository,realestate.service,realestate.module,realestate.integration}.test.ts`

- **Single responsibility** — `bun:test` coverage for each layer; fake Prisma at unit, real-fake bridge at module, oRPC HTTP at integration.
- **Inputs** — `bun:test` runner; a fake Prisma client modelling 4 tables.
- **Outputs** — Tests-only files; no runtime export.

#### MODIFIED — `apps/api/src/database/id-prefixes.config.ts`

- **Single responsibility (post-edit)** — central registry of Pekulo prefixed IDs (now includes `RealEstateMortgage: "resm"`).
- **Inputs** — none (declarative).
- **Outputs** — `ID_PREFIXES` constant with 4 real-estate prefixes registered.

#### MODIFIED — `packages/validators/src/index.ts`

- **Single responsibility (post-edit)** — barrel for all Pekulo Zod schemas (now includes realestate).
- **Inputs** — sub-files.
- **Outputs** — re-exports.

#### MODIFIED — `packages/types/src/index.ts`

- **Single responsibility (post-edit)** — central registry for Pekulo domain TS types. `RealEstate*` re-exported from `@pekulo/validators`; `PropertyCardItem` legacy UI shape preserved; 4 branded IDs added.
- **Inputs** — `@pekulo/validators` re-exports.
- **Outputs** — `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation`, `PropertyCardItem`, `RealEstateId`, `RealEstateMortgageId`, `RealEstateRentalId`, `RealEstateValuationId`, `PROPERTY_TYPES`, `PropertyType`.

#### MODIFIED — `packages/contracts/src/realestate.contract.ts`

- **Single responsibility (post-edit)** — exports 12 oRPC procedure definitions for the realestate module with typed-error declarations.
- **Inputs** — `@orpc/contract` `oc`; `@pekulo/validators` schemas.
- **Outputs** — `realestateContractV1`, `realestateContract`, `realestateContractMeta`.

#### MODIFIED — `apps/api/src/common/errors/pekulo-error.ts` + `apps/api/src/platform/http/error-mapper.ts`

- **Single responsibility (post-edit)** — typed domain errors registry (now includes 5 real-estate codes) + domain code → HTTP status map.
- **Inputs** — none.
- **Outputs** — extended `PekuloErrorCode` / `PEKULO_ERROR_CODES` / `ORPC_HTTP_STATUS_BY_CODE`.

#### MODIFIED — `apps/api/src/bootstrap/runtime-dependencies.ts`

- **Single responsibility (post-edit)** — composition root; instantiates the realestate module and mounts it on `orpcRouter`.
- **Inputs** — `createRealestateModule` from realestate module.
- **Outputs** — `RuntimeDeps` with `orpcRouter.realestate`.

#### MODIFIED — `apps/api/scripts/rls-audit.ts`

- **Single responsibility (post-edit)** — RLS-policy expected-counts probe (now includes 4 real-estate tables).
- **Inputs** — Postgres connection.
- **Outputs** — exit 0 when actual counts match; non-zero with diff otherwise.

#### MODIFIED — `apps/web/src/lib/zapaction/keys.ts`

- **Single responsibility (post-edit)** — feature-scoped React Query keys + zapaction tag registry. Registers `REALESTATE_KEY` + `realestate` invalidation tag (forward-pointer for 4-2 / 4-3 / 7-1).
- **Inputs** — `setTagRegistry` from `@zapaction/query`.
- **Outputs** — extended tag registry.

### Task-by-task implementation code

#### T1 — Manual migration SQL

Compute timestamp: `TS=$(date +%Y%m%d%H%M%S)` then `mkdir -p apps/api/prisma/migrations/${TS}_create_realestate/`.

Create `apps/api/prisma/migrations/<TS>_create_realestate/migration.sql` with the FULL content below:

```sql
-- 4-1-realestate-domain — net-new realestate aggregate. 4 tables:
--   real_estate                (CRUD parent — RLS quartet)
--   real_estate_mortgage       (1:1 child — RLS quartet, UNIQUE on real_estate_id)
--   real_estate_rental         (1:1 child — RLS quartet, UNIQUE on real_estate_id)
--   real_estate_valuations     (append-only audit per ADR-0001 — RLS INSERT+SELECT only)
--
-- All FKs to parent use ON DELETE CASCADE so deleteProperty cascades to children.
-- All FKs to auth.users(id) use ON DELETE CASCADE so account deletion (story 11-2)
-- removes every property + child row in one shot.
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — real_estate (CRUD parent)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate" (
    "id"                 TEXT NOT NULL,
    "user_id"            UUID NOT NULL,
    "label"              TEXT NOT NULL CHECK (char_length("label") BETWEEN 1 AND 120),
    "property_type"      TEXT NOT NULL CHECK ("property_type" IN ('residence-principale', 'locatif', 'autre')),
    "current_valuation"  NUMERIC NOT NULL CHECK ("current_valuation" >= 0),
    "last_valued_on"     DATE NOT NULL,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "real_estate"
  ADD CONSTRAINT "real_estate_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_user_created_idx"
  ON "real_estate" ("user_id", "created_at" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — real_estate_mortgage (1:1 child)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_mortgage" (
    "id"                     TEXT NOT NULL,
    "user_id"                UUID NOT NULL,
    "real_estate_id"         TEXT NOT NULL,
    "outstanding_principal"  NUMERIC NOT NULL CHECK ("outstanding_principal" >= 0),
    "annual_rate"            NUMERIC NOT NULL CHECK ("annual_rate" >= 0 AND "annual_rate" <= 1),
    "monthly_payment"        NUMERIC NOT NULL CHECK ("monthly_payment" >= 0),
    "term_months"            INTEGER NOT NULL CHECK ("term_months" BETWEEN 1 AND 600),
    "start_date"             DATE NOT NULL,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_mortgage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "real_estate_mortgage_real_estate_id_key" UNIQUE ("real_estate_id")
);

ALTER TABLE "real_estate_mortgage"
  ADD CONSTRAINT "real_estate_mortgage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_mortgage"
  ADD CONSTRAINT "real_estate_mortgage_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_mortgage_user_idx"
  ON "real_estate_mortgage" ("user_id");

-- ───────────────────────────────────────────────────────────────────────────
-- Step 3 — real_estate_rental (1:1 child)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_rental" (
    "id"               TEXT NOT NULL,
    "user_id"          UUID NOT NULL,
    "real_estate_id"   TEXT NOT NULL,
    "monthly_rent"     NUMERIC NOT NULL CHECK ("monthly_rent" >= 0),
    "monthly_charges"  NUMERIC NOT NULL CHECK ("monthly_charges" >= 0),
    "furnished"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_rental_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "real_estate_rental_real_estate_id_key" UNIQUE ("real_estate_id")
);

ALTER TABLE "real_estate_rental"
  ADD CONSTRAINT "real_estate_rental_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_rental"
  ADD CONSTRAINT "real_estate_rental_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_rental_user_idx"
  ON "real_estate_rental" ("user_id");

-- ───────────────────────────────────────────────────────────────────────────
-- Step 4 — real_estate_valuations (append-only audit sister per ADR-0001)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "real_estate_valuations" (
    "id"               TEXT NOT NULL,
    "user_id"          UUID NOT NULL,
    "real_estate_id"   TEXT NOT NULL,
    "amount"           NUMERIC NOT NULL CHECK ("amount" >= 0),
    "valued_on"        DATE NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "real_estate_valuations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "real_estate_valuations"
  ADD CONSTRAINT "real_estate_valuations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "real_estate_valuations"
  ADD CONSTRAINT "real_estate_valuations_real_estate_id_fkey"
  FOREIGN KEY ("real_estate_id") REFERENCES "real_estate"("id") ON DELETE CASCADE;

CREATE INDEX "real_estate_valuations_user_property_valued_idx"
  ON "real_estate_valuations" ("user_id", "real_estate_id", "valued_on" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 5 — RLS quartet on the 3 CRUD tables (real_estate, mortgage, rental)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "real_estate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate" ON "real_estate"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate" ON "real_estate"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate" ON "real_estate"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate" ON "real_estate"
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE "real_estate_mortgage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate mortgage" ON "real_estate_mortgage"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate mortgage" ON "real_estate_mortgage"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate mortgage" ON "real_estate_mortgage"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate mortgage" ON "real_estate_mortgage"
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE "real_estate_rental" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate rental" ON "real_estate_rental"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate rental" ON "real_estate_rental"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own real estate rental" ON "real_estate_rental"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own real estate rental" ON "real_estate_rental"
  FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 6 — RLS audit variant on real_estate_valuations (INSERT + SELECT only)
-- per ADR-0001 — append-only enforcement at the SQL layer. UPDATE / DELETE
-- intentionally omitted; deletion only via FK cascade from the parent property.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "real_estate_valuations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own real estate valuations" ON "real_estate_valuations"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own real estate valuations" ON "real_estate_valuations"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
```

Run:

```bash
bun --filter='@pekulo/api' run prisma:migrate:deploy
```

Expected: `1 migration found in prisma/migrations / Applying migration <ts>_create_realestate / All migrations have been successfully applied.`

(Defer running `db:rls-audit` until AFTER T4 lands the expected counts — the script will fail otherwise with "unexpected table".)

Commit:

```bash
git add apps/api/prisma/migrations/
git commit -m "feat(#24): T1 — create real_estate{,_mortgage,_rental,_valuations} migration"
```

#### T2 — Register `RealEstateMortgage` prefix

Edit `apps/api/src/database/id-prefixes.config.ts`. The current real-estate block is at lines ~43-46:

```ts
  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",
```

Replace with:

```ts
  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateMortgage: "resm",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0 (the `ID_PREFIXES` const satisfies its `Record<string, string | null>` constraint trivially).

Commit:

```bash
git add apps/api/src/database/id-prefixes.config.ts
git commit -m "feat(#24): T2 — register RealEstateMortgage prefix resm"
```

#### T3 — Prisma schema `realestate.prisma`

Create `apps/api/prisma/schema/realestate.prisma` with the FULL content below:

```prisma
// apps/api/prisma/schema/realestate.prisma
// Real-estate aggregate (story 4-1). 4 models:
//   RealEstate              — property root (CRUD)
//   RealEstateMortgage      — 1:1 child via UNIQUE on realEstateId
//   RealEstateRental        — 1:1 child via UNIQUE on realEstateId
//   RealEstateValuation     — append-only audit sister (RLS INSERT+SELECT only)
//
// All children cascade-delete when the parent property is removed. All tables
// cascade-delete when the parent auth.users row is removed (story 11-2).
//
// Note: `propertyType` is a TEXT column with a CHECK constraint (NOT a Postgres
// enum) to keep schema changes additive in V2+ (adding a 4th type is a single
// ALTER TABLE … DROP CONSTRAINT + ADD CONSTRAINT). Validator + Zod enforce the
// 3-value union at the application boundary.

model RealEstate {
  id                String    @id
  userId            String    @map("user_id") @db.Uuid
  label             String
  propertyType      String    @map("property_type")
  currentValuation  Decimal   @map("current_valuation") @db.Decimal
  lastValuedOn      DateTime  @map("last_valued_on") @db.Date
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  mortgage    RealEstateMortgage?
  rental      RealEstateRental?
  valuations  RealEstateValuation[]

  @@index([userId, createdAt(sort: Desc)], map: "real_estate_user_created_idx")
  @@map("real_estate")
}

model RealEstateMortgage {
  id                     String    @id
  userId                 String    @map("user_id") @db.Uuid
  realEstateId           String    @unique @map("real_estate_id")
  outstandingPrincipal   Decimal   @map("outstanding_principal") @db.Decimal
  annualRate             Decimal   @map("annual_rate") @db.Decimal
  monthlyPayment         Decimal   @map("monthly_payment") @db.Decimal
  termMonths             Int       @map("term_months") @db.Integer
  startDate              DateTime  @map("start_date") @db.Date
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt              DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  realEstate  RealEstate @relation(fields: [realEstateId], references: [id], onDelete: Cascade)

  @@index([userId], map: "real_estate_mortgage_user_idx")
  @@map("real_estate_mortgage")
}

model RealEstateRental {
  id              String    @id
  userId          String    @map("user_id") @db.Uuid
  realEstateId    String    @unique @map("real_estate_id")
  monthlyRent     Decimal   @map("monthly_rent") @db.Decimal
  monthlyCharges  Decimal   @map("monthly_charges") @db.Decimal
  furnished       Boolean   @default(false)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  realEstate  RealEstate @relation(fields: [realEstateId], references: [id], onDelete: Cascade)

  @@index([userId], map: "real_estate_rental_user_idx")
  @@map("real_estate_rental")
}

model RealEstateValuation {
  id              String   @id
  userId          String   @map("user_id") @db.Uuid
  realEstateId    String   @map("real_estate_id")
  amount          Decimal  @db.Decimal
  valuedOn        DateTime @map("valued_on") @db.Date
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz

  realEstate  RealEstate @relation(fields: [realEstateId], references: [id], onDelete: Cascade)

  @@index([userId, realEstateId, valuedOn(sort: Desc)], map: "real_estate_valuations_user_property_valued_idx")
  @@map("real_estate_valuations")
}
```

Run:

```bash
bun --filter='@pekulo/api' run prisma:generate
bun --filter='@pekulo/api' run typecheck
```

Expected: `✔ Generated Prisma Client …` then typecheck exit 0.

Commit:

```bash
git add apps/api/prisma/schema/realestate.prisma
git commit -m "feat(#24): T3 — realestate.prisma (4 models + relations)"
```

#### T4 — Extend `EXPECTED_POLICY_COUNTS`

Edit `apps/api/scripts/rls-audit.ts`. Find the `EXPECTED_POLICY_COUNTS` object (current content quoted in Step-0 above) and replace it with:

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
  // milestones is a regular CRUD table — full quartet. AC-12 of story 1-2.
  milestones: 4,
  // account_balance_log is an audit sister table per ADR-0001 — INSERT + SELECT
  // only. AC-2 of story 2-2 asserts this count.
  account_balance_log: 2,
  // real_estate aggregate — 3 CRUD tables (full quartet) + 1 audit sister
  // (INSERT + SELECT only per ADR-0001). AC-6 of story 4-1 asserts these counts.
  real_estate: 4,
  real_estate_mortgage: 4,
  real_estate_rental: 4,
  real_estate_valuations: 2,
};
```

Run:

```bash
bun --filter='@pekulo/api' run db:rls-audit
```

Expected: `OK — every brownfield table reports RLS enabled with the expected policy count.` (exit 0).

Commit:

```bash
git add apps/api/scripts/rls-audit.ts
git commit -m "feat(#24): T4 — assert real_estate{,_mortgage,_rental,_valuations} RLS counts"
```

#### T5 — Extend error codes + HTTP status map

Edit `apps/api/src/common/errors/pekulo-error.ts`. Replace the `PekuloErrorCode` union (currently 20 codes) with the 25-code version:

```ts
export type PekuloErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_REFERENCED_FK"
  | "BAD_REQUEST"
  | "COMPASS_NOT_FOUND"
  | "COMPASS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "HOLDING_CLOSED"
  | "HOLDING_NOT_FOUND"
  | "INTERNAL"
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "MILESTONE_INVALID_CAPITAL"
  | "MILESTONE_LIMIT_EXCEEDED"
  | "MILESTONE_NOT_FOUND"
  | "MILESTONE_YEAR_OUT_OF_RANGE"
  | "MORTGAGE_ALREADY_ATTACHED"
  | "MORTGAGE_NOT_FOUND"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "REALESTATE_NOT_FOUND"
  | "RENTAL_ALREADY_ATTACHED"
  | "RENTAL_NOT_FOUND"
  | "TRANSACTION_FAILED"
  | "UNAUTHORIZED";
```

Mirror the same 5 insertions into the `PEKULO_ERROR_CODES` set (replace its body too):

```ts
const PEKULO_ERROR_CODES: ReadonlySet<PekuloErrorCode> = new Set<PekuloErrorCode>([
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_REFERENCED_FK",
  "BAD_REQUEST",
  "COMPASS_NOT_FOUND",
  "COMPASS_REQUIRED",
  "CONFLICT",
  "FORBIDDEN",
  "HOLDING_CLOSED",
  "HOLDING_NOT_FOUND",
  "INTERNAL",
  "INVALID_TARGET",
  "INVALID_WEALTH",
  "MILESTONE_INVALID_CAPITAL",
  "MILESTONE_LIMIT_EXCEEDED",
  "MILESTONE_NOT_FOUND",
  "MILESTONE_YEAR_OUT_OF_RANGE",
  "MORTGAGE_ALREADY_ATTACHED",
  "MORTGAGE_NOT_FOUND",
  "NOT_FOUND",
  "RATE_LIMITED",
  "REALESTATE_NOT_FOUND",
  "RENTAL_ALREADY_ATTACHED",
  "RENTAL_NOT_FOUND",
  "TRANSACTION_FAILED",
  "UNAUTHORIZED",
]);
```

Edit `apps/api/src/platform/http/error-mapper.ts`. The `ORPC_HTTP_STATUS_BY_CODE` object (currently 20 entries) gains 5. Replace its body with:

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
  ACCOUNT_NOT_FOUND: 404,
  COMPASS_NOT_FOUND: 404,
  HOLDING_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  MORTGAGE_NOT_FOUND: 404,
  REALESTATE_NOT_FOUND: 404,
  RENTAL_NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_REFERENCED_FK: 409,
  HOLDING_CLOSED: 409,
  MILESTONE_LIMIT_EXCEEDED: 409,
  MORTGAGE_ALREADY_ATTACHED: 409,
  RENTAL_ALREADY_ATTACHED: 409,
  COMPASS_REQUIRED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  TRANSACTION_FAILED: 500,
};
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0 — the `Record<PekuloErrorCode, number>` exhaustiveness check passes only when every union member has a status.

Commit:

```bash
git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts
git commit -m "feat(#24): T5 — register 5 real-estate error codes + HTTP mappings"
```

#### T6 — `realestate.errors.ts`

Create `apps/api/src/modules/realestate/realestate.errors.ts` with the FULL content below:

```ts
// apps/api/src/modules/realestate/realestate.errors.ts
// Typed error class + factories for the realestate domain. Extends PekuloError
// so the Elysia error mapper translates instances to oRPC error responses with
// stable {code, message}.

import { PekuloError } from "../../common/errors";

export type RealestateErrorCode =
  | "REALESTATE_NOT_FOUND"
  | "MORTGAGE_ALREADY_ATTACHED"
  | "MORTGAGE_NOT_FOUND"
  | "RENTAL_ALREADY_ATTACHED"
  | "RENTAL_NOT_FOUND";

export class RealestateError extends PekuloError {
  override readonly name = "RealestateError";

  constructor(
    public override readonly code: RealestateErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(code, message, cause);
  }
}

export function realestateNotFound(): RealestateError {
  return new RealestateError("REALESTATE_NOT_FOUND", "real estate not found");
}

export function mortgageAlreadyAttached(): RealestateError {
  return new RealestateError(
    "MORTGAGE_ALREADY_ATTACHED",
    "property already has a mortgage attached",
  );
}

export function mortgageNotFound(): RealestateError {
  return new RealestateError("MORTGAGE_NOT_FOUND", "mortgage not found");
}

export function rentalAlreadyAttached(): RealestateError {
  return new RealestateError("RENTAL_ALREADY_ATTACHED", "property already has a rental attached");
}

export function rentalNotFound(): RealestateError {
  return new RealestateError("RENTAL_NOT_FOUND", "rental not found");
}
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/api/src/modules/realestate/realestate.errors.ts
git commit -m "feat(#24): T6 — RealestateError + 5 factory functions"
```

#### T7 — Validator schemas

Create `packages/validators/src/realestate.ts` with the FULL content below:

```ts
// packages/validators/src/realestate.ts
// Single source of truth for the realestate aggregate. Consumed by
// @pekulo/contracts (oRPC procedure I/O) and apps/api realestate
// service/handler/repository.

import { z } from "zod";

// ─── ID regexes ──────────────────────────────────────────────────────────
export const REAL_ESTATE_ID_PREFIX_RE = /^res_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_MORTGAGE_ID_PREFIX_RE = /^resm_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_RENTAL_ID_PREFIX_RE = /^resr_[0-9A-Za-z]{21}$/;
export const REAL_ESTATE_VALUATION_ID_PREFIX_RE = /^resv_[0-9A-Za-z]{21}$/;

export const realEstateIdSchema = z
  .string()
  .regex(REAL_ESTATE_ID_PREFIX_RE, "id must match /^res_[0-9A-Za-z]{21}$/");
export const realEstateMortgageIdSchema = z
  .string()
  .regex(REAL_ESTATE_MORTGAGE_ID_PREFIX_RE, "id must match /^resm_[0-9A-Za-z]{21}$/");
export const realEstateRentalIdSchema = z
  .string()
  .regex(REAL_ESTATE_RENTAL_ID_PREFIX_RE, "id must match /^resr_[0-9A-Za-z]{21}$/");
export const realEstateValuationIdSchema = z
  .string()
  .regex(REAL_ESTATE_VALUATION_ID_PREFIX_RE, "id must match /^resv_[0-9A-Za-z]{21}$/");

// ─── Enums ───────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = ["residence-principale", "locatif", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const propertyTypeSchema = z.enum(PROPERTY_TYPES);

// ─── Row / DTO shapes ────────────────────────────────────────────────────
export const realEstateSchema = z.object({
  id: realEstateIdSchema,
  userId: z.string().uuid(),
  label: z.string().min(1).max(120),
  propertyType: propertyTypeSchema,
  currentValuation: z.number().min(0),
  lastValuedOn: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstate = z.infer<typeof realEstateSchema>;

export const realEstateMortgageSchema = z.object({
  id: realEstateMortgageIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  outstandingPrincipal: z.number().min(0),
  annualRate: z.number().min(0).max(1),
  monthlyPayment: z.number().min(0),
  termMonths: z.number().int().min(1).max(600),
  startDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstateMortgage = z.infer<typeof realEstateMortgageSchema>;

export const realEstateRentalSchema = z.object({
  id: realEstateRentalIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  monthlyRent: z.number().min(0),
  monthlyCharges: z.number().min(0),
  furnished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RealEstateRental = z.infer<typeof realEstateRentalSchema>;

export const realEstateValuationSchema = z.object({
  id: realEstateValuationIdSchema,
  userId: z.string().uuid(),
  realEstateId: realEstateIdSchema,
  amount: z.number().min(0),
  valuedOn: z.date(),
  createdAt: z.date(),
});
export type RealEstateValuation = z.infer<typeof realEstateValuationSchema>;

// ─── Input schemas (oRPC procedure inputs) ───────────────────────────────
export const createPropertyInputSchema = z.object({
  label: z.string().min(1).max(120),
  propertyType: propertyTypeSchema,
  currentValuation: z.number().min(0),
  lastValuedOn: z.coerce.date(),
});
export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;

export const attachMortgageInputSchema = z.object({
  propertyId: realEstateIdSchema,
  outstandingPrincipal: z.number().min(0),
  annualRate: z.number().min(0).max(1),
  monthlyPayment: z.number().min(0),
  termMonths: z.number().int().min(1).max(600),
  startDate: z.coerce.date(),
});
export type AttachMortgageInput = z.infer<typeof attachMortgageInputSchema>;

export const updateMortgageInputSchema = z
  .object({
    propertyId: realEstateIdSchema,
    outstandingPrincipal: z.number().min(0).optional(),
    annualRate: z.number().min(0).max(1).optional(),
    monthlyPayment: z.number().min(0).optional(),
    termMonths: z.number().int().min(1).max(600).optional(),
    startDate: z.coerce.date().optional(),
  })
  .refine(
    (v) =>
      v.outstandingPrincipal !== undefined ||
      v.annualRate !== undefined ||
      v.monthlyPayment !== undefined ||
      v.termMonths !== undefined ||
      v.startDate !== undefined,
    { message: "at least one field besides propertyId is required" },
  );
export type UpdateMortgageInput = z.infer<typeof updateMortgageInputSchema>;

export const detachMortgageInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type DetachMortgageInput = z.infer<typeof detachMortgageInputSchema>;

export const attachRentalInputSchema = z.object({
  propertyId: realEstateIdSchema,
  monthlyRent: z.number().min(0),
  monthlyCharges: z.number().min(0),
  furnished: z.boolean(),
});
export type AttachRentalInput = z.infer<typeof attachRentalInputSchema>;

export const updateRentalInputSchema = z
  .object({
    propertyId: realEstateIdSchema,
    monthlyRent: z.number().min(0).optional(),
    monthlyCharges: z.number().min(0).optional(),
    furnished: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.monthlyRent !== undefined ||
      v.monthlyCharges !== undefined ||
      v.furnished !== undefined,
    { message: "at least one field besides propertyId is required" },
  );
export type UpdateRentalInput = z.infer<typeof updateRentalInputSchema>;

export const detachRentalInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type DetachRentalInput = z.infer<typeof detachRentalInputSchema>;

export const recordValuationInputSchema = z.object({
  propertyId: realEstateIdSchema,
  amount: z.number().min(0),
  valuedOn: z.coerce.date(),
});
export type RecordValuationInput = z.infer<typeof recordValuationInputSchema>;

export const getPropertyInputSchema = z.object({
  id: realEstateIdSchema,
});
export type GetPropertyInput = z.infer<typeof getPropertyInputSchema>;

export const deletePropertyInputSchema = z.object({
  id: realEstateIdSchema,
});
export type DeletePropertyInput = z.infer<typeof deletePropertyInputSchema>;

export const listValuationsInputSchema = z.object({
  propertyId: realEstateIdSchema,
});
export type ListValuationsInput = z.infer<typeof listValuationsInputSchema>;

// ─── Composite output shapes ─────────────────────────────────────────────
export const propertyWithChildrenSchema = z.object({
  property: realEstateSchema,
  mortgage: realEstateMortgageSchema.nullable(),
  rental: realEstateRentalSchema.nullable(),
});
export type PropertyWithChildren = z.infer<typeof propertyWithChildrenSchema>;
```

Edit `packages/validators/src/index.ts` (replace its content):

```ts
// Pekulo shared Zod validators. Schemas are the single source of truth for
// both apps/web (form resolvers) and apps/api (handler validation + DB
// mapping). New schemas land alongside their feature stories.
export * from "./accounts";
export * from "./compass";
export * from "./holdings";
export * from "./hypothesis";
export * from "./milestones";
export * from "./realestate";
```

Run:

```bash
bun --filter='@pekulo/validators' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/validators/src/realestate.ts packages/validators/src/index.ts
git commit -m "feat(#24): T7 — @pekulo/validators realestate schemas (16 exports)"
```

#### T8 — Extend `@pekulo/types`

Edit `packages/types/src/index.ts`. Locate the existing `Property` interface at line ~160 (quoted in Step-0) and REPLACE the entire "Real-estate" section with:

```ts
// ─── Real-estate (story 4-1) ─────────────────────────────────────────────
// `PropertyCardItem` is the legacy V1 design-system row shape consumed by
// `PekuloPropertyCard.tsx` mockups. The canonical domain entities live in
// `@pekulo/validators` (Zod inference) and are re-exported here as the single
// import surface for feature modules.
export const PROPERTY_TYPES = ["residence-principale", "locatif", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type RealEstateId = Id<"RealEstateId">;
export type RealEstateMortgageId = Id<"RealEstateMortgageId">;
export type RealEstateRentalId = Id<"RealEstateRentalId">;
export type RealEstateValuationId = Id<"RealEstateValuationId">;

export type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  PropertyWithChildren,
} from "@pekulo/validators";

/** UI prop shape consumed by PekuloPropertyCard. */
export interface PropertyCardItem {
  label: string;
  valuationEur: number;
  debtRemainingEur: number;
  monthlyPaymentEur: number;
  yearsRemaining: number;
  repaidPct: number;
}
```

Run:

```bash
bun --filter='@pekulo/types' run typecheck
bun --filter='@pekulo/ui' run typecheck
```

Expected: both exit 0. If `@pekulo/ui` typecheck fails on `PekuloPropertyCard.tsx` (rename `Property` → `PropertyCardItem`), update the import in that file as well — grep `grep -rln "from \"@pekulo/types\".*Property" packages/ui/src` to find consumers.

Commit:

```bash
git add packages/types/src/index.ts
git commit -m "feat(#24): T8 — @pekulo/types Real-estate re-exports + PropertyCardItem rename"
```

#### T9 — Repository tests (TDD RED)

Create `apps/api/src/modules/realestate/realestate.repository.test.ts` with the FULL content below. This file is long because it covers every AC at the repository layer:

```ts
// apps/api/src/modules/realestate/realestate.repository.test.ts
// Repository-layer tests. Fake Prisma client modelling the 4 real-estate tables
// + 1 cross-aggregate probe. Covers AC-1, AC-2 (repo half), AC-3 (repo half),
// AC-4 (atomic $transaction), AC-5 (desc order), AC-7 (cascade-delete + 60s
// budget on seeded volume), AC-8 (decimal coercion), AC-9 (lint passes).

import { describe, expect, test } from "bun:test";
import { createRealestateRepository } from "./realestate.repository";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

describe("realestate.repository — createProperty", () => {
  test("AC-1: persists row with prefixed id", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const row = await repo.createProperty(USER_A, {
      label: "Appartement Lyon",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-05-01"),
    });
    expect(row.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
    expect(row.userId).toBe(USER_A);
    expect(row.currentValuation).toBe(250_000);
    expect(row.propertyType).toBe("locatif");
  });
});

describe("realestate.repository — findByIdForUser (cross-user guard)", () => {
  test("AC-9: returns null when userId mismatches", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const created = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "autre",
      currentValuation: 100_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(await repo.findByIdForUser(USER_B, created.id)).toBeNull();
    expect(await repo.findByIdForUser(USER_A, created.id)).not.toBeNull();
  });
});

describe("realestate.repository — attach/update/detach mortgage", () => {
  test("AC-2: attachMortgage happy → prefixed resm_ id + ok", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.attachMortgage(USER_A, {
      propertyId: property.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.mortgage.id).toMatch(/^resm_[0-9A-Za-z]{21}$/);
      expect(result.mortgage.realEstateId).toBe(property.id);
    }
  });

  test("AC-2: duplicate attachMortgage → outcome=duplicate", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const input = {
      propertyId: property.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    };
    await repo.attachMortgage(USER_A, input);
    const second = await repo.attachMortgage(USER_A, input);
    expect(second.outcome).toBe("duplicate");
  });

  test("AC-2: updateMortgage missing → outcome=not-found", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.updateMortgage(USER_A, {
      propertyId: property.id,
      monthlyPayment: 850,
    });
    expect(result.outcome).toBe("not-found");
  });

  test("AC-2: detachMortgage idempotent — returns ok even when missing", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(await repo.detachMortgage(USER_A, { propertyId: property.id })).toEqual({ ok: true });
    // Second call on already-empty mortgage row also returns ok.
    expect(await repo.detachMortgage(USER_A, { propertyId: property.id })).toEqual({ ok: true });
  });
});

describe("realestate.repository — attach/update/detach rental (mirror of mortgage)", () => {
  test("AC-3: attachRental happy → prefixed resr_ id + ok", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const result = await repo.attachRental(USER_A, {
      propertyId: property.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.rental.id).toMatch(/^resr_[0-9A-Za-z]{21}$/);
    }
  });

  test("AC-3: duplicate attachRental → outcome=duplicate", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const input = {
      propertyId: property.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    };
    await repo.attachRental(USER_A, input);
    expect((await repo.attachRental(USER_A, input)).outcome).toBe("duplicate");
  });
});

describe("realestate.repository — recordValuation (atomic $transaction)", () => {
  test("AC-4: updates real_estate + inserts real_estate_valuations in one transaction", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const property = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2024-01-01"),
    });
    const updated = await repo.recordValuation(USER_A, {
      propertyId: property.id,
      amount: 280_000,
      valuedOn: new Date("2026-05-01"),
    });
    expect(updated.currentValuation).toBe(280_000);
    expect(updated.lastValuedOn.toISOString().slice(0, 10)).toBe("2026-05-01");
    const history = await repo.listValuations(USER_A, { propertyId: property.id });
    expect(history.length).toBe(1);
    expect(history[0].amount).toBe(280_000);
    expect(history[0].id).toMatch(/^resv_[0-9A-Za-z]{21}$/);
  });

  test("AC-5: listValuations returns rows ordered by valuedOn desc", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const p = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2024-01-01"),
    });
    await repo.recordValuation(USER_A, { propertyId: p.id, amount: 260_000, valuedOn: new Date("2024-06-01") });
    await repo.recordValuation(USER_A, { propertyId: p.id, amount: 280_000, valuedOn: new Date("2026-05-01") });
    await repo.recordValuation(USER_A, { propertyId: p.id, amount: 255_000, valuedOn: new Date("2024-03-01") });
    const history = await repo.listValuations(USER_A, { propertyId: p.id });
    expect(history.map((r) => r.amount)).toEqual([280_000, 260_000, 255_000]);
  });
});

describe("realestate.repository — deleteProperty (cascade + DR-5 timing)", () => {
  test("AC-7: cascade-deletes 1 mortgage + 1 rental + 50 valuations from 1 property in < 60 s", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    // Seed 50 properties so the volume matches DR-5 / NFR-16 ceilings.
    const props = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        repo.createProperty(USER_A, {
          label: `P${i}`,
          propertyType: "locatif",
          currentValuation: 200_000 + i * 1000,
          lastValuedOn: new Date("2026-01-01"),
        }),
      ),
    );
    const victim = props[0];
    await repo.attachMortgage(USER_A, {
      propertyId: victim.id,
      outstandingPrincipal: 150_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: new Date("2020-01-01"),
    });
    await repo.attachRental(USER_A, {
      propertyId: victim.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    });
    for (let i = 0; i < 50; i++) {
      await repo.recordValuation(USER_A, {
        propertyId: victim.id,
        amount: 200_000 + i * 1000,
        valuedOn: new Date(`2026-01-${(i % 28) + 1}`),
      });
    }
    const t0 = performance.now();
    await repo.deleteProperty(USER_A, { id: victim.id });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(60_000); // DR-5 budget
    expect(await repo.findByIdForUser(USER_A, victim.id)).toBeNull();
    // Sibling properties untouched.
    expect(await repo.findByIdForUser(USER_A, props[1].id)).not.toBeNull();
  });
});

describe("realestate.repository — decimal coercion (L24)", () => {
  test("AC-8: surfaces JS numbers, not Prisma.Decimal", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    const row = await repo.createProperty(USER_A, {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000.5,
      lastValuedOn: new Date("2026-01-01"),
    });
    expect(typeof row.currentValuation).toBe("number");
    expect(row.currentValuation).toBe(250_000.5);
  });
});

describe("realestate.repository — listByUser", () => {
  test("returns only matching userId rows", async () => {
    const fake = makeFakePrisma();
    const repo = createRealestateRepository({ client: fake.client });
    await repo.createProperty(USER_A, {
      label: "A1",
      propertyType: "locatif",
      currentValuation: 100_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    await repo.createProperty(USER_B, {
      label: "B1",
      propertyType: "locatif",
      currentValuation: 200_000,
      lastValuedOn: new Date("2026-01-01"),
    });
    const a = await repo.listByUser(USER_A);
    expect(a.length).toBe(1);
    expect(a[0].label).toBe("A1");
  });
});
```

Run:

```bash
bun --filter='@pekulo/api' test src/modules/realestate/realestate.repository.test.ts
```

Expected: **RED** — every test fails because `realestate.repository.ts` and the fake do not exist yet.

T10 lands the GREEN implementation. Commit T9 alongside T10 (see below) — a RED-only commit on its own would be churn.

#### T10 — Repository implementation (TDD GREEN) + fake Prisma helper

Create `apps/api/src/test/fakes/fake-realestate.ts` with an in-memory fake Prisma client modelling the 4 tables:

```ts
// apps/api/src/test/fakes/fake-realestate.ts
// In-memory Prisma fake modelling the 4 real-estate tables. Provides $transaction
// support (sync callback wrapper — atomicity is irrelevant for the tests, but
// the API surface must match Prisma's actual shape so the repository compiles).

type RealEstateRow = {
  id: string;
  userId: string;
  label: string;
  propertyType: string;
  currentValuation: { toNumber: () => number };
  lastValuedOn: Date;
  createdAt: Date;
  updatedAt: Date;
};

type MortgageRow = {
  id: string;
  userId: string;
  realEstateId: string;
  outstandingPrincipal: { toNumber: () => number };
  annualRate: { toNumber: () => number };
  monthlyPayment: { toNumber: () => number };
  termMonths: number;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type RentalRow = {
  id: string;
  userId: string;
  realEstateId: string;
  monthlyRent: { toNumber: () => number };
  monthlyCharges: { toNumber: () => number };
  furnished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ValuationRow = {
  id: string;
  userId: string;
  realEstateId: string;
  amount: { toNumber: () => number };
  valuedOn: Date;
  createdAt: Date;
};

const dec = (n: number) => ({ toNumber: () => n });
const id = (prefix: string) =>
  `${prefix}_${Array.from({ length: 21 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("")}`;

export function makeFakePrisma() {
  const real_estate: RealEstateRow[] = [];
  const real_estate_mortgage: MortgageRow[] = [];
  const real_estate_rental: RentalRow[] = [];
  const real_estate_valuations: ValuationRow[] = [];

  const tableLike = {
    realEstate: {
      create: async ({ data, select: _s }: { data: Omit<RealEstateRow, "currentValuation"> & { currentValuation: number; id?: string } }) => {
        const row: RealEstateRow = {
          id: data.id ?? id("res"),
          userId: data.userId,
          label: data.label,
          propertyType: data.propertyType,
          currentValuation: dec(data.currentValuation),
          lastValuedOn: data.lastValuedOn,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        real_estate.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
      findMany: async ({ where, orderBy: _o }: { where: { userId: string }; orderBy?: unknown }) =>
        real_estate.filter((r) => r.userId === where.userId),
      update: async ({
        where,
        data,
      }: {
        where: { id: string; userId: string };
        data: { currentValuation?: number; lastValuedOn?: Date };
      }) => {
        const row = real_estate.find((r) => r.id === where.id && r.userId === where.userId);
        if (!row) throw new Error("not found");
        if (data.currentValuation !== undefined) row.currentValuation = dec(data.currentValuation);
        if (data.lastValuedOn !== undefined) row.lastValuedOn = data.lastValuedOn;
        row.updatedAt = new Date();
        return row;
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        const idx = real_estate.findIndex((r) => r.id === where.id && r.userId === where.userId);
        if (idx === -1) return { count: 0 };
        const [removed] = real_estate.splice(idx, 1);
        // Simulate FK cascade.
        for (let i = real_estate_mortgage.length - 1; i >= 0; i--) {
          if (real_estate_mortgage[i].realEstateId === removed.id) real_estate_mortgage.splice(i, 1);
        }
        for (let i = real_estate_rental.length - 1; i >= 0; i--) {
          if (real_estate_rental[i].realEstateId === removed.id) real_estate_rental.splice(i, 1);
        }
        for (let i = real_estate_valuations.length - 1; i >= 0; i--) {
          if (real_estate_valuations[i].realEstateId === removed.id) real_estate_valuations.splice(i, 1);
        }
        return { count: 1 };
      },
    },
    realEstateMortgage: {
      create: async ({ data }: { data: Omit<MortgageRow, "outstandingPrincipal" | "annualRate" | "monthlyPayment"> & { outstandingPrincipal: number; annualRate: number; monthlyPayment: number; id?: string } }) => {
        if (real_estate_mortgage.find((m) => m.realEstateId === data.realEstateId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row: MortgageRow = {
          id: data.id ?? id("resm"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          outstandingPrincipal: dec(data.outstandingPrincipal),
          annualRate: dec(data.annualRate),
          monthlyPayment: dec(data.monthlyPayment),
          termMonths: data.termMonths,
          startDate: data.startDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate_mortgage.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { realEstateId: string; userId: string } }) =>
        real_estate_mortgage.find(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { realEstateId: string; userId: string };
        data: Partial<{ outstandingPrincipal: number; annualRate: number; monthlyPayment: number; termMonths: number; startDate: Date }>;
      }) => {
        const row = real_estate_mortgage.find(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        );
        if (!row) return { count: 0 };
        if (data.outstandingPrincipal !== undefined) row.outstandingPrincipal = dec(data.outstandingPrincipal);
        if (data.annualRate !== undefined) row.annualRate = dec(data.annualRate);
        if (data.monthlyPayment !== undefined) row.monthlyPayment = dec(data.monthlyPayment);
        if (data.termMonths !== undefined) row.termMonths = data.termMonths;
        if (data.startDate !== undefined) row.startDate = data.startDate;
        row.updatedAt = new Date();
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { realEstateId: string; userId: string } }) => {
        const idx = real_estate_mortgage.findIndex(
          (m) => m.realEstateId === where.realEstateId && m.userId === where.userId,
        );
        if (idx === -1) return { count: 0 };
        real_estate_mortgage.splice(idx, 1);
        return { count: 1 };
      },
    },
    realEstateRental: {
      create: async ({ data }: { data: Omit<RentalRow, "monthlyRent" | "monthlyCharges"> & { monthlyRent: number; monthlyCharges: number; id?: string } }) => {
        if (real_estate_rental.find((r) => r.realEstateId === data.realEstateId)) {
          const err = new Error("Unique constraint failed") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row: RentalRow = {
          id: data.id ?? id("resr"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          monthlyRent: dec(data.monthlyRent),
          monthlyCharges: dec(data.monthlyCharges),
          furnished: data.furnished,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        real_estate_rental.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { realEstateId: string; userId: string } }) =>
        real_estate_rental.find(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { realEstateId: string; userId: string };
        data: Partial<{ monthlyRent: number; monthlyCharges: number; furnished: boolean }>;
      }) => {
        const row = real_estate_rental.find(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        );
        if (!row) return { count: 0 };
        if (data.monthlyRent !== undefined) row.monthlyRent = dec(data.monthlyRent);
        if (data.monthlyCharges !== undefined) row.monthlyCharges = dec(data.monthlyCharges);
        if (data.furnished !== undefined) row.furnished = data.furnished;
        row.updatedAt = new Date();
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { realEstateId: string; userId: string } }) => {
        const idx = real_estate_rental.findIndex(
          (r) => r.realEstateId === where.realEstateId && r.userId === where.userId,
        );
        if (idx === -1) return { count: 0 };
        real_estate_rental.splice(idx, 1);
        return { count: 1 };
      },
    },
    realEstateValuation: {
      create: async ({ data }: { data: Omit<ValuationRow, "amount"> & { amount: number; id?: string } }) => {
        const row: ValuationRow = {
          id: data.id ?? id("resv"),
          userId: data.userId,
          realEstateId: data.realEstateId,
          amount: dec(data.amount),
          valuedOn: data.valuedOn,
          createdAt: new Date(),
        };
        real_estate_valuations.push(row);
        return row;
      },
      findMany: async ({
        where,
        orderBy: _o,
      }: {
        where: { realEstateId: string; userId: string };
        orderBy?: unknown;
      }) =>
        real_estate_valuations
          .filter((v) => v.realEstateId === where.realEstateId && v.userId === where.userId)
          .sort((a, b) => b.valuedOn.getTime() - a.valuedOn.getTime()),
    },
    async $transaction<T>(cb: (tx: typeof tableLike) => Promise<T>): Promise<T> {
      return cb(tableLike);
    },
  } as const;

  return { client: tableLike };
}
```

Create `apps/api/src/modules/realestate/realestate.repository.ts` with the FULL content below:

```ts
// apps/api/src/modules/realestate/realestate.repository.ts
// Prisma layer for the realestate domain. Every query carries explicit
// where: { userId } (ADR-0013). The recordValuation flow uses $transaction
// to write real_estate + real_estate_valuations atomically (ADR-0001 + 1-1/2-2
// precedent). deleteProperty relies on FK CASCADE for child cleanup (DR-5).

import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  CreatePropertyInput,
  AttachMortgageInput,
  UpdateMortgageInput,
  DetachMortgageInput,
  AttachRentalInput,
  UpdateRentalInput,
  DetachRentalInput,
  RecordValuationInput,
  DeletePropertyInput,
  ListValuationsInput,
} from "@pekulo/validators";

export type MortgageAttachOutcome =
  | { outcome: "ok"; mortgage: RealEstateMortgage }
  | { outcome: "duplicate" };

export type MortgageUpdateOutcome =
  | { outcome: "ok"; mortgage: RealEstateMortgage }
  | { outcome: "not-found" };

export type RentalAttachOutcome =
  | { outcome: "ok"; rental: RealEstateRental }
  | { outcome: "duplicate" };

export type RentalUpdateOutcome =
  | { outcome: "ok"; rental: RealEstateRental }
  | { outcome: "not-found" };

export interface RealestateRepository {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  findByIdForUser(userId: string, propertyId: string): Promise<RealEstate | null>;
  listByUser(userId: string): Promise<RealEstate[]>;
  findMortgageForUser(userId: string, propertyId: string): Promise<RealEstateMortgage | null>;
  findRentalForUser(userId: string, propertyId: string): Promise<RealEstateRental | null>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<MortgageAttachOutcome>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<MortgageUpdateOutcome>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RentalAttachOutcome>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RentalUpdateOutcome>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
}

type PrismaRow<T extends Record<string, unknown>> = T;

function toProperty(row: PrismaRow<{ id: string; userId: string; label: string; propertyType: string; currentValuation: unknown; lastValuedOn: Date; createdAt: Date; updatedAt: Date }>): RealEstate {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    propertyType: row.propertyType as RealEstate["propertyType"],
    currentValuation: decimalToNumber(row.currentValuation, 0),
    lastValuedOn: row.lastValuedOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMortgage(row: PrismaRow<{ id: string; userId: string; realEstateId: string; outstandingPrincipal: unknown; annualRate: unknown; monthlyPayment: unknown; termMonths: number; startDate: Date; createdAt: Date; updatedAt: Date }>): RealEstateMortgage {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    outstandingPrincipal: decimalToNumber(row.outstandingPrincipal, 0),
    annualRate: decimalToNumber(row.annualRate, 0),
    monthlyPayment: decimalToNumber(row.monthlyPayment, 0),
    termMonths: row.termMonths,
    startDate: row.startDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRental(row: PrismaRow<{ id: string; userId: string; realEstateId: string; monthlyRent: unknown; monthlyCharges: unknown; furnished: boolean; createdAt: Date; updatedAt: Date }>): RealEstateRental {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    monthlyRent: decimalToNumber(row.monthlyRent, 0),
    monthlyCharges: decimalToNumber(row.monthlyCharges, 0),
    furnished: row.furnished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toValuation(row: PrismaRow<{ id: string; userId: string; realEstateId: string; amount: unknown; valuedOn: Date; createdAt: Date }>): RealEstateValuation {
  return {
    id: row.id,
    userId: row.userId,
    realEstateId: row.realEstateId,
    amount: decimalToNumber(row.amount, 0),
    valuedOn: row.valuedOn,
    createdAt: row.createdAt,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export function createRealestateRepository(deps: {
  client: ExtendedPrismaClient;
}): RealestateRepository {
  return {
    async createProperty(userId, input) {
      const row = await deps.client.realEstate.create({
        data: {
          userId,
          label: input.label,
          propertyType: input.propertyType,
          currentValuation: input.currentValuation,
          lastValuedOn: input.lastValuedOn,
        } as unknown as Parameters<typeof deps.client.realEstate.create>[0]["data"],
      });
      return toProperty(row as never);
    },

    async findByIdForUser(userId, propertyId) {
      const row = await deps.client.realEstate.findFirst({
        where: { id: propertyId, userId },
      });
      return row ? toProperty(row as never) : null;
    },

    async listByUser(userId) {
      const rows = await deps.client.realEstate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) => toProperty(r as never));
    },

    async findMortgageForUser(userId, propertyId) {
      const row = await deps.client.realEstateMortgage.findFirst({
        where: { realEstateId: propertyId, userId },
      });
      return row ? toMortgage(row as never) : null;
    },

    async findRentalForUser(userId, propertyId) {
      const row = await deps.client.realEstateRental.findFirst({
        where: { realEstateId: propertyId, userId },
      });
      return row ? toRental(row as never) : null;
    },

    async attachMortgage(userId, input) {
      try {
        const row = await deps.client.realEstateMortgage.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            outstandingPrincipal: input.outstandingPrincipal,
            annualRate: input.annualRate,
            monthlyPayment: input.monthlyPayment,
            termMonths: input.termMonths,
            startDate: input.startDate,
          } as unknown as Parameters<typeof deps.client.realEstateMortgage.create>[0]["data"],
        });
        return { outcome: "ok", mortgage: toMortgage(row as never) };
      } catch (err) {
        if (isUniqueConstraintError(err)) return { outcome: "duplicate" };
        throw err;
      }
    },

    async updateMortgage(userId, input) {
      const data: Record<string, unknown> = {};
      if (input.outstandingPrincipal !== undefined) data.outstandingPrincipal = input.outstandingPrincipal;
      if (input.annualRate !== undefined) data.annualRate = input.annualRate;
      if (input.monthlyPayment !== undefined) data.monthlyPayment = input.monthlyPayment;
      if (input.termMonths !== undefined) data.termMonths = input.termMonths;
      if (input.startDate !== undefined) data.startDate = input.startDate;
      const res = await deps.client.realEstateMortgage.updateMany({
        where: { realEstateId: input.propertyId, userId },
        data,
      });
      if (res.count === 0) return { outcome: "not-found" };
      const row = await deps.client.realEstateMortgage.findFirst({
        where: { realEstateId: input.propertyId, userId },
      });
      if (!row) return { outcome: "not-found" };
      return { outcome: "ok", mortgage: toMortgage(row as never) };
    },

    async detachMortgage(userId, input) {
      await deps.client.realEstateMortgage.deleteMany({
        where: { realEstateId: input.propertyId, userId },
      });
      return { ok: true };
    },

    async attachRental(userId, input) {
      try {
        const row = await deps.client.realEstateRental.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            monthlyRent: input.monthlyRent,
            monthlyCharges: input.monthlyCharges,
            furnished: input.furnished,
          } as unknown as Parameters<typeof deps.client.realEstateRental.create>[0]["data"],
        });
        return { outcome: "ok", rental: toRental(row as never) };
      } catch (err) {
        if (isUniqueConstraintError(err)) return { outcome: "duplicate" };
        throw err;
      }
    },

    async updateRental(userId, input) {
      const data: Record<string, unknown> = {};
      if (input.monthlyRent !== undefined) data.monthlyRent = input.monthlyRent;
      if (input.monthlyCharges !== undefined) data.monthlyCharges = input.monthlyCharges;
      if (input.furnished !== undefined) data.furnished = input.furnished;
      const res = await deps.client.realEstateRental.updateMany({
        where: { realEstateId: input.propertyId, userId },
        data,
      });
      if (res.count === 0) return { outcome: "not-found" };
      const row = await deps.client.realEstateRental.findFirst({
        where: { realEstateId: input.propertyId, userId },
      });
      if (!row) return { outcome: "not-found" };
      return { outcome: "ok", rental: toRental(row as never) };
    },

    async detachRental(userId, input) {
      await deps.client.realEstateRental.deleteMany({
        where: { realEstateId: input.propertyId, userId },
      });
      return { ok: true };
    },

    async recordValuation(userId, input) {
      const updated = await deps.client.$transaction(async (tx) => {
        const updatedRow = await tx.realEstate.update({
          where: { id: input.propertyId, userId },
          data: {
            currentValuation: input.amount,
            lastValuedOn: input.valuedOn,
          },
        });
        await tx.realEstateValuation.create({
          data: {
            userId,
            realEstateId: input.propertyId,
            amount: input.amount,
            valuedOn: input.valuedOn,
          } as unknown as Parameters<typeof tx.realEstateValuation.create>[0]["data"],
        });
        return updatedRow;
      });
      return toProperty(updated as never);
    },

    async listValuations(userId, input) {
      const rows = await deps.client.realEstateValuation.findMany({
        where: { realEstateId: input.propertyId, userId },
        orderBy: { valuedOn: "desc" },
      });
      return rows.map((r) => toValuation(r as never));
    },

    async deleteProperty(userId, input) {
      // FK cascade removes mortgage + rental + valuations atomically.
      await deps.client.realEstate.deleteMany({ where: { id: input.id, userId } });
      return { ok: true };
    },
  };
}
```

Run:

```bash
bun --filter='@pekulo/api' test src/modules/realestate/realestate.repository.test.ts
```

Expected: **GREEN** — all tests pass.

Commit:

```bash
git add apps/api/src/test/fakes/fake-realestate.ts apps/api/src/modules/realestate/realestate.repository.{ts,test.ts}
git commit -m "feat(#24): T9+T10 — realestate.repository + tests (atomic $transaction, decimal coercion)"
```

#### T11 + T12 — Service tests + implementation

Create `apps/api/src/modules/realestate/realestate.service.test.ts`:

```ts
// apps/api/src/modules/realestate/realestate.service.test.ts
import { describe, expect, mock, test } from "bun:test";
import { createRealestateService } from "./realestate.service";
import { RealestateError } from "./realestate.errors";
import type {
  RealestateRepository,
  MortgageAttachOutcome,
  MortgageUpdateOutcome,
  RentalAttachOutcome,
  RentalUpdateOutcome,
} from "./realestate.repository";
import type { RealEstate, RealEstateMortgage, RealEstateRental, RealEstateValuation } from "@pekulo/validators";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const PROPERTY_A: RealEstate = {
  id: "res_aaaaaaaaaaaaaaaaaaaaa",
  userId: USER_A,
  label: "X",
  propertyType: "locatif",
  currentValuation: 200_000,
  lastValuedOn: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakeRepo(overrides: Partial<RealestateRepository> = {}): RealestateRepository {
  return {
    createProperty: mock(async () => PROPERTY_A),
    findByIdForUser: mock(async () => PROPERTY_A),
    listByUser: mock(async () => [PROPERTY_A]),
    findMortgageForUser: mock(async () => null),
    findRentalForUser: mock(async () => null),
    attachMortgage: mock(
      async (): Promise<MortgageAttachOutcome> => ({
        outcome: "ok",
        mortgage: {} as RealEstateMortgage,
      }),
    ),
    updateMortgage: mock(
      async (): Promise<MortgageUpdateOutcome> => ({
        outcome: "ok",
        mortgage: {} as RealEstateMortgage,
      }),
    ),
    detachMortgage: mock(async () => ({ ok: true as const })),
    attachRental: mock(
      async (): Promise<RentalAttachOutcome> => ({ outcome: "ok", rental: {} as RealEstateRental }),
    ),
    updateRental: mock(
      async (): Promise<RentalUpdateOutcome> => ({ outcome: "ok", rental: {} as RealEstateRental }),
    ),
    detachRental: mock(async () => ({ ok: true as const })),
    recordValuation: mock(async () => PROPERTY_A),
    listValuations: mock(async () => [] as RealEstateValuation[]),
    deleteProperty: mock(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe("realestate.service — cross-user guard", () => {
  test("attachMortgage on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachMortgage(USER_A, {
        propertyId: "res_xxxxxxxxxxxxxxxxxxxxx",
        outstandingPrincipal: 100_000,
        annualRate: 0.02,
        monthlyPayment: 500,
        termMonths: 240,
        startDate: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RealestateError);
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });

  test("recordValuation on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.recordValuation(USER_A, {
        propertyId: "res_xxxxxxxxxxxxxxxxxxxxx",
        amount: 250_000,
        valuedOn: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });

  test("listValuations on missing property → REALESTATE_NOT_FOUND", async () => {
    const repo = fakeRepo({ findByIdForUser: mock(async () => null) });
    const service = createRealestateService({ repository: repo });
    try {
      await service.listValuations(USER_A, { propertyId: "res_xxxxxxxxxxxxxxxxxxxxx" });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("REALESTATE_NOT_FOUND");
    }
  });
});

describe("realestate.service — mortgage lifecycle", () => {
  test("attachMortgage duplicate → MORTGAGE_ALREADY_ATTACHED", async () => {
    const repo = fakeRepo({
      attachMortgage: mock(async (): Promise<MortgageAttachOutcome> => ({ outcome: "duplicate" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachMortgage(USER_A, {
        propertyId: PROPERTY_A.id,
        outstandingPrincipal: 100_000,
        annualRate: 0.02,
        monthlyPayment: 500,
        termMonths: 240,
        startDate: new Date(),
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("MORTGAGE_ALREADY_ATTACHED");
    }
  });

  test("updateMortgage missing → MORTGAGE_NOT_FOUND", async () => {
    const repo = fakeRepo({
      updateMortgage: mock(async (): Promise<MortgageUpdateOutcome> => ({ outcome: "not-found" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.updateMortgage(USER_A, { propertyId: PROPERTY_A.id, monthlyPayment: 600 });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("MORTGAGE_NOT_FOUND");
    }
  });

  test("detachMortgage idempotent — never throws", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(await service.detachMortgage(USER_A, { propertyId: PROPERTY_A.id })).toEqual({ ok: true });
  });
});

describe("realestate.service — rental lifecycle (mirror of mortgage)", () => {
  test("attachRental duplicate → RENTAL_ALREADY_ATTACHED", async () => {
    const repo = fakeRepo({
      attachRental: mock(async (): Promise<RentalAttachOutcome> => ({ outcome: "duplicate" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.attachRental(USER_A, {
        propertyId: PROPERTY_A.id,
        monthlyRent: 1000,
        monthlyCharges: 100,
        furnished: false,
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("RENTAL_ALREADY_ATTACHED");
    }
  });

  test("updateRental missing → RENTAL_NOT_FOUND", async () => {
    const repo = fakeRepo({
      updateRental: mock(async (): Promise<RentalUpdateOutcome> => ({ outcome: "not-found" })),
    });
    const service = createRealestateService({ repository: repo });
    try {
      await service.updateRental(USER_A, { propertyId: PROPERTY_A.id, monthlyRent: 1100 });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as RealestateError).code).toBe("RENTAL_NOT_FOUND");
    }
  });
});

describe("realestate.service — happy paths delegate to repo", () => {
  test("createProperty → returns repo output", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(
      await service.createProperty(USER_A, {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: new Date(),
      }),
    ).toEqual(PROPERTY_A);
  });

  test("recordValuation → returns updated property", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(
      await service.recordValuation(USER_A, {
        propertyId: PROPERTY_A.id,
        amount: 280_000,
        valuedOn: new Date(),
      }),
    ).toEqual(PROPERTY_A);
  });

  test("deleteProperty → { ok: true }", async () => {
    const repo = fakeRepo();
    const service = createRealestateService({ repository: repo });
    expect(await service.deleteProperty(USER_A, { id: PROPERTY_A.id })).toEqual({ ok: true });
  });
});
```

Create `apps/api/src/modules/realestate/realestate.service.ts`:

```ts
// apps/api/src/modules/realestate/realestate.service.ts
// Business logic for the realestate module. Owns:
//   - cross-user guard via repository.findByIdForUser before every mutation
//   - outcome-to-error translation per discriminated repo returns
//   - idempotency on detach* (no error on missing child)

import type {
  RealEstate,
  RealEstateMortgage,
  RealEstateRental,
  RealEstateValuation,
  PropertyWithChildren,
  CreatePropertyInput,
  AttachMortgageInput,
  UpdateMortgageInput,
  DetachMortgageInput,
  AttachRentalInput,
  UpdateRentalInput,
  DetachRentalInput,
  RecordValuationInput,
  GetPropertyInput,
  DeletePropertyInput,
  ListValuationsInput,
} from "@pekulo/validators";
import {
  mortgageAlreadyAttached,
  mortgageNotFound,
  realestateNotFound,
  rentalAlreadyAttached,
  rentalNotFound,
} from "./realestate.errors";
import type { RealestateRepository } from "./realestate.repository";

export interface RealestateService {
  createProperty(userId: string, input: CreatePropertyInput): Promise<RealEstate>;
  getProperty(userId: string, input: GetPropertyInput): Promise<PropertyWithChildren>;
  listProperties(userId: string): Promise<RealEstate[]>;
  attachMortgage(userId: string, input: AttachMortgageInput): Promise<RealEstateMortgage>;
  updateMortgage(userId: string, input: UpdateMortgageInput): Promise<RealEstateMortgage>;
  detachMortgage(userId: string, input: DetachMortgageInput): Promise<{ ok: true }>;
  attachRental(userId: string, input: AttachRentalInput): Promise<RealEstateRental>;
  updateRental(userId: string, input: UpdateRentalInput): Promise<RealEstateRental>;
  detachRental(userId: string, input: DetachRentalInput): Promise<{ ok: true }>;
  recordValuation(userId: string, input: RecordValuationInput): Promise<RealEstate>;
  listValuations(userId: string, input: ListValuationsInput): Promise<RealEstateValuation[]>;
  deleteProperty(userId: string, input: DeletePropertyInput): Promise<{ ok: true }>;
}

export function createRealestateService(deps: { repository: RealestateRepository }): RealestateService {
  async function requireOwnedProperty(userId: string, propertyId: string): Promise<void> {
    const exists = await deps.repository.findByIdForUser(userId, propertyId);
    if (!exists) throw realestateNotFound();
  }

  return {
    async createProperty(userId, input) {
      return deps.repository.createProperty(userId, input);
    },

    async getProperty(userId, input) {
      const property = await deps.repository.findByIdForUser(userId, input.id);
      if (!property) throw realestateNotFound();
      const mortgage = await deps.repository.findMortgageForUser(userId, input.id);
      const rental = await deps.repository.findRentalForUser(userId, input.id);
      return { property, mortgage, rental };
    },

    async listProperties(userId) {
      return deps.repository.listByUser(userId);
    },

    async attachMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await deps.repository.attachMortgage(userId, input);
      if (result.outcome === "duplicate") throw mortgageAlreadyAttached();
      return result.mortgage;
    },

    async updateMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await deps.repository.updateMortgage(userId, input);
      if (result.outcome === "not-found") throw mortgageNotFound();
      return result.mortgage;
    },

    async detachMortgage(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return deps.repository.detachMortgage(userId, input);
    },

    async attachRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await deps.repository.attachRental(userId, input);
      if (result.outcome === "duplicate") throw rentalAlreadyAttached();
      return result.rental;
    },

    async updateRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      const result = await deps.repository.updateRental(userId, input);
      if (result.outcome === "not-found") throw rentalNotFound();
      return result.rental;
    },

    async detachRental(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return deps.repository.detachRental(userId, input);
    },

    async recordValuation(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return deps.repository.recordValuation(userId, input);
    },

    async listValuations(userId, input) {
      await requireOwnedProperty(userId, input.propertyId);
      return deps.repository.listValuations(userId, input);
    },

    async deleteProperty(userId, input) {
      await requireOwnedProperty(userId, input.id);
      return deps.repository.deleteProperty(userId, input);
    },
  };
}
```

Run:

```bash
bun --filter='@pekulo/api' test src/modules/realestate/realestate.service.test.ts
```

Expected: all tests pass (GREEN).

Commit:

```bash
git add apps/api/src/modules/realestate/realestate.service.{ts,test.ts}
git commit -m "feat(#24): T11+T12 — realestate.service + tests (cross-user guard, outcome translation)"
```

#### T13 — Fill `realestate.contract.ts`

Replace the content of `packages/contracts/src/realestate.contract.ts` (currently empty scaffold) with the FULL content below:

```ts
// packages/contracts/src/realestate.contract.ts
// Realestate module oRPC contract (story 4-1). 12 procedures covering full
// CRUD on properties + 1:1 lifecycle on mortgage / rental children + audit
// trail on valuations. See ADR-0009 (mount under /rpc/v1/realestate).

import { oc } from "@orpc/contract";
import {
  attachMortgageInputSchema,
  attachRentalInputSchema,
  createPropertyInputSchema,
  deletePropertyInputSchema,
  detachMortgageInputSchema,
  detachRentalInputSchema,
  getPropertyInputSchema,
  listValuationsInputSchema,
  propertyWithChildrenSchema,
  realEstateMortgageSchema,
  realEstateRentalSchema,
  realEstateSchema,
  realEstateValuationSchema,
  recordValuationInputSchema,
  updateMortgageInputSchema,
  updateRentalInputSchema,
} from "@pekulo/validators";
import { z } from "zod";

const okSchema = z.object({ ok: z.literal(true) });

export const realestateContractV1 = {
  createProperty: oc.input(createPropertyInputSchema).output(realEstateSchema),
  getProperty: oc.input(getPropertyInputSchema).output(propertyWithChildrenSchema),
  listProperties: oc.output(z.array(realEstateSchema)),
  attachMortgage: oc.input(attachMortgageInputSchema).output(realEstateMortgageSchema),
  updateMortgage: oc.input(updateMortgageInputSchema).output(realEstateMortgageSchema),
  detachMortgage: oc.input(detachMortgageInputSchema).output(okSchema),
  attachRental: oc.input(attachRentalInputSchema).output(realEstateRentalSchema),
  updateRental: oc.input(updateRentalInputSchema).output(realEstateRentalSchema),
  detachRental: oc.input(detachRentalInputSchema).output(okSchema),
  recordValuation: oc.input(recordValuationInputSchema).output(realEstateSchema),
  listValuations: oc.input(listValuationsInputSchema).output(z.array(realEstateValuationSchema)),
  deleteProperty: oc.input(deletePropertyInputSchema).output(okSchema),
} as const;

export const realestateContract = realestateContractV1;
export const realestateContractMeta = {
  moduleKey: "realestate",
  mountPath: "/rpc/v1/realestate",
  version: "v1",
} as const;
```

Run:

```bash
bun --filter='@pekulo/contracts' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/contracts/src/realestate.contract.ts
git commit -m "feat(#24): T13 — realestate.contract.ts (12 procedures)"
```

#### T14 — `realestate.routes.ts`

Create `apps/api/src/modules/realestate/realestate.routes.ts`:

```ts
// apps/api/src/modules/realestate/realestate.routes.ts
// oRPC handlers for the realestate module. Each handler verifies user context
// and delegates to the service. The service throws RealestateError on domain
// rejections; the Elysia error mapper translates them to oRPC error responses.
// L8: no Elysia annotations — router type inferred via ReturnType<typeof
// createRealestateRouter>.

import { implement } from "@orpc/server";
import { realestateContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { RealestateService } from "./realestate.service";

const impl = implement(realestateContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined | null): string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
  return userId;
}

export function createRealestateRouter(deps: { service: RealestateService }) {
  return impl.router({
    createProperty: impl.createProperty.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.createProperty(userId, input);
    }),
    getProperty: impl.getProperty.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.getProperty(userId, input);
    }),
    listProperties: impl.listProperties.handler(async ({ context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.listProperties(userId);
    }),
    attachMortgage: impl.attachMortgage.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.attachMortgage(userId, input);
    }),
    updateMortgage: impl.updateMortgage.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.updateMortgage(userId, input);
    }),
    detachMortgage: impl.detachMortgage.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.detachMortgage(userId, input);
    }),
    attachRental: impl.attachRental.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.attachRental(userId, input);
    }),
    updateRental: impl.updateRental.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.updateRental(userId, input);
    }),
    detachRental: impl.detachRental.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.detachRental(userId, input);
    }),
    recordValuation: impl.recordValuation.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.recordValuation(userId, input);
    }),
    listValuations: impl.listValuations.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.listValuations(userId, input);
    }),
    deleteProperty: impl.deleteProperty.handler(async ({ context, input }) => {
      const userId = requireUserId(context.userId);
      return deps.service.deleteProperty(userId, input);
    }),
  });
}
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/api/src/modules/realestate/realestate.routes.ts
git commit -m "feat(#24): T14 — realestate.routes.ts (12 handlers + requireUserId)"
```

#### T15 — `realestate.module.ts` + module test

Create `apps/api/src/modules/realestate/realestate.module.ts`:

```ts
// apps/api/src/modules/realestate/realestate.module.ts
// Module factory wiring repository + service + router for the realestate
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 — router type inferred via ReturnType<typeof createRealestateRouter>;
// never annotate as `Elysia` or any concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createRealestateRepository } from "./realestate.repository";
import { createRealestateService, type RealestateService } from "./realestate.service";
import { createRealestateRouter } from "./realestate.routes";

export interface RealestateModule {
  service: RealestateService;
  router: ReturnType<typeof createRealestateRouter>;
}

export function createRealestateModule(deps: {
  prismaService: PrismaService;
}): RealestateModule {
  const repository = createRealestateRepository({ client: deps.prismaService.client });
  const service = createRealestateService({ repository });
  const router = createRealestateRouter({ service });
  return { service, router };
}
```

Create `apps/api/src/modules/realestate/realestate.module.test.ts`:

```ts
// apps/api/src/modules/realestate/realestate.module.test.ts
// Whole-module wired flow on fake Prisma. Asserts the factory composes
// repository + service + router and that the router responds to invocation.

import { describe, expect, test } from "bun:test";
import { createRealestateModule } from "./realestate.module";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";
import type { PrismaService } from "../../database";

describe("realestate.module — whole-module wired flow", () => {
  test("createRealestateModule returns service + router", () => {
    const fake = makeFakePrisma();
    const mod = createRealestateModule({
      prismaService: { client: fake.client as unknown as PrismaService["client"] } as unknown as PrismaService,
    });
    expect(typeof mod.service.createProperty).toBe("function");
    expect(typeof mod.router).toBe("object");
  });

  test("service.createProperty round-trip → repo persisted", async () => {
    const fake = makeFakePrisma();
    const mod = createRealestateModule({
      prismaService: { client: fake.client as unknown as PrismaService["client"] } as unknown as PrismaService,
    });
    const property = await mod.service.createProperty("00000000-0000-0000-0000-00000000000a", {
      label: "X",
      propertyType: "locatif",
      currentValuation: 250_000,
      lastValuedOn: new Date("2026-05-01"),
    });
    expect(property.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
    const listed = await mod.service.listProperties("00000000-0000-0000-0000-00000000000a");
    expect(listed.length).toBe(1);
  });
});
```

Run:

```bash
bun --filter='@pekulo/api' test src/modules/realestate/realestate.module.test.ts
```

Expected: all tests pass.

Commit:

```bash
git add apps/api/src/modules/realestate/realestate.module.{ts,test.ts}
git commit -m "feat(#24): T15 — realestate.module factory + whole-module wired test"
```

#### T16 — Wire into `runtime-dependencies.ts`

Edit `apps/api/src/bootstrap/runtime-dependencies.ts`. Two changes:

1. Add the import at the top of the existing import block:

```ts
import { createRealestateModule } from "../modules/realestate/realestate.module";
```

2. Find the line `const holdingsModule = createHoldingsModule({ prismaService, env: input.env });` (Step-0 quoted above). Replace the block that follows it (up to and including the `orpcRouter` declaration) with:

```ts
  const holdingsModule = createHoldingsModule({ prismaService, env: input.env });

  // Story 4-1 — realestate domain. Greenfield aggregate (4 tables); no
  // brownfield port. The cross-aggregate guard lives inside the service via
  // findByIdForUser; module factory stays trivial.
  const realestateModule = createRealestateModule({ prismaService });

  const orpcRouter: PekuloRpcRouter = {
    hypothesis: hypothesisModule.router,
    compass: compassModule.router,
    milestones: milestonesModule.router,
    accounts: accountsModule.router,
    holdings: holdingsModule.router,
    realestate: realestateModule.router,
  };
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run dev &
sleep 3
curl -fsS http://127.0.0.1:3001/health
kill %1
```

Expected: typecheck exit 0 ; `/health` returns 200.

Commit:

```bash
git add apps/api/src/bootstrap/runtime-dependencies.ts
git commit -m "feat(#24): T16 — wire realestate module into orpcRouter"
```

#### T17 — Integration test

Create `apps/api/src/modules/realestate/realestate.integration.test.ts`:

```ts
// apps/api/src/modules/realestate/realestate.integration.test.ts
// oRPC HTTP boundary tests. Mirrors holdings.integration.test.ts. Spins up a
// minimal Elysia instance with mountOrpc + the realestate router, then issues
// signed JWT requests to verify 200 / 401 / 404 / 409 outcomes.

import { describe, expect, test, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { createRealestateModule } from "./realestate.module";
import { mountOrpc } from "../../platform/http/orpc-mount";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";
import type { PrismaService } from "../../database";
import { errorMapper } from "../../platform/http/error-mapper";

const SECRET = "00000000000000000000000000000000";
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

async function makeJwt(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, email: `${userId}@x.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

function buildApp() {
  const fake = makeFakePrisma();
  const mod = createRealestateModule({
    prismaService: { client: fake.client as unknown as PrismaService["client"] } as unknown as PrismaService,
  });
  const app = new Elysia()
    .onError(errorMapper)
    .use(
      mountOrpc({
        router: { realestate: mod.router },
        jwtVerifier: {
          async verify(token: string) {
            const { jwtVerify } = await import("jose");
            const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET));
            return { userId: payload.sub as string, email: (payload.email as string) ?? null };
          },
        },
      }),
    );
  return app;
}

async function call(app: ReturnType<typeof buildApp>, path: string, body: unknown, jwt?: string) {
  return app.handle(
    new Request(`http://localhost/rpc/v1/realestate/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("realestate.integration — HTTP boundary", () => {
  let app: ReturnType<typeof buildApp>;
  let jwtA: string;
  let jwtB: string;

  beforeAll(async () => {
    app = buildApp();
    jwtA = await makeJwt(USER_A);
    jwtB = await makeJwt(USER_B);
  });

  test("AC-11: missing JWT → 401", async () => {
    const res = await call(app, "createProperty", {
      label: "X",
      propertyType: "locatif",
      currentValuation: 100_000,
      lastValuedOn: "2026-01-01",
    });
    expect(res.status).toBe(401);
  });

  test("AC-11: createProperty → 200 + prefixed id", async () => {
    const res = await call(
      app,
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      jwtA,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
  });

  test("AC-11: attachMortgage duplicate → 409", async () => {
    const create = await call(
      app,
      "createProperty",
      { label: "X", propertyType: "locatif", currentValuation: 200_000, lastValuedOn: "2026-05-01" },
      jwtA,
    );
    const { id } = (await create.json()) as { id: string };
    const input = {
      propertyId: id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: "2020-01-01",
    };
    const first = await call(app, "attachMortgage", input, jwtA);
    expect(first.status).toBe(200);
    const second = await call(app, "attachMortgage", input, jwtA);
    expect(second.status).toBe(409);
  });

  test("AC-11: cross-user getProperty → 404", async () => {
    const create = await call(
      app,
      "createProperty",
      { label: "X", propertyType: "locatif", currentValuation: 200_000, lastValuedOn: "2026-05-01" },
      jwtA,
    );
    const { id } = (await create.json()) as { id: string };
    const cross = await call(app, "getProperty", { id }, jwtB);
    expect(cross.status).toBe(404);
  });

  test("AC-11: recordValuation happy → 200", async () => {
    const create = await call(
      app,
      "createProperty",
      { label: "X", propertyType: "locatif", currentValuation: 250_000, lastValuedOn: "2024-01-01" },
      jwtA,
    );
    const { id } = (await create.json()) as { id: string };
    const res = await call(
      app,
      "recordValuation",
      { propertyId: id, amount: 280_000, valuedOn: "2026-05-01" },
      jwtA,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { currentValuation: number };
    expect(body.currentValuation).toBe(280_000);
    // History queryable.
    const history = await call(app, "listValuations", { propertyId: id }, jwtA);
    expect(history.status).toBe(200);
    const rows = (await history.json()) as Array<{ amount: number }>;
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe(280_000);
  });
});
```

Run:

```bash
bun --filter='@pekulo/api' test src/modules/realestate/realestate.integration.test.ts
```

Expected: all tests pass.

Commit:

```bash
git add apps/api/src/modules/realestate/realestate.integration.test.ts
git commit -m "feat(#24): T17 — realestate.integration.test (200/401/404/409 matrix)"
```

#### T18 — Web cache-invalidation forward-pointer

Open `apps/web/src/lib/zapaction/keys.ts` and locate the `HOLDINGS_KEY` declaration near the top. Add `REALESTATE_KEY` immediately after:

```ts
export const REALESTATE_KEY = "realestate" as const;
```

Find the `realestateKeys` placeholder or — if absent — add a fresh factory near `holdingsKeys`:

```ts
export const realestateKeys = {
  all: () => [REALESTATE_KEY] as const,
  list: () => [REALESTATE_KEY, "list"] as const,
  byId: (propertyId: string) => [REALESTATE_KEY, "byId", propertyId] as const,
  valuations: (propertyId: string) => [REALESTATE_KEY, "valuations", propertyId] as const,
};
```

Locate the `setTagRegistry({...})` block at the bottom of the file and add `realestate` to its keys map:

```ts
  realestate: { keys: () => [realestateKeys.all()] },
```

Run:

```bash
bun --filter=web run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/web/src/lib/zapaction/keys.ts
git commit -m "feat(#24): T18 — wire realestate invalidation tag (forward-pointer for 4-2/4-3/7-1)"
```

#### T19 — Full quality gate

Run:

```bash
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run db:rls-audit
bun --filter='@pekulo/api' test
bun --filter=web run typecheck
grep -rn 'Number(.*Decimal' apps/api/src/modules/realestate | wc -l
grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/realestate | wc -l
find apps/api/src/modules/realestate -name '*.types.ts'
```

Expected:
- `lint`: exit 0.
- `typecheck`: exit 0.
- `db:rls-audit`: exit 0 (`OK …`).
- `test`: every realestate test green, no regression in other modules.
- `web typecheck`: exit 0.
- `grep 'Number(.*Decimal'`: `0`.
- `grep ': Elysia'`: `0`.
- `find *.types.ts`: empty.

Push the branch:

```bash
git push -u origin feature/24-4-1-realestate-domain
```

Commit if any auto-format reflows occurred:

```bash
git add -A
git commit -m "feat(#24): T19 — quality gate (lint+typecheck+test+rls-audit all green)" --allow-empty
```

## File List

**NEW (14 files):**

- `apps/api/prisma/migrations/<timestamp>_create_realestate/migration.sql`
- `apps/api/prisma/schema/realestate.prisma`
- `apps/api/src/modules/realestate/realestate.errors.ts`
- `apps/api/src/modules/realestate/realestate.repository.ts`
- `apps/api/src/modules/realestate/realestate.repository.test.ts`
- `apps/api/src/modules/realestate/realestate.service.ts`
- `apps/api/src/modules/realestate/realestate.service.test.ts`
- `apps/api/src/modules/realestate/realestate.routes.ts`
- `apps/api/src/modules/realestate/realestate.module.ts`
- `apps/api/src/modules/realestate/realestate.module.test.ts`
- `apps/api/src/modules/realestate/realestate.integration.test.ts`
- `apps/api/src/test/fakes/fake-realestate.ts`
- `packages/validators/src/realestate/realestate.schemas.ts` _(post-sync R11 path ; T7's `packages/validators/src/realestate.ts` relocated in merge `0777f62`)_
- `packages/validators/src/realestate/index.ts` _(R11 domain barrel)_

**MODIFIED (13 files):**

- `apps/api/src/database/id-prefixes.config.ts` (T2 — add `RealEstateMortgage: "resm"`)
- `apps/api/src/database/id-prefixes.config.test.ts` (T2 — count 15 → 16)
- `apps/api/src/database/prefixed-ids.extension.test.ts` (review-supp H2 — +4 tests covering RealEstate / RealEstateMortgage / RealEstateRental / RealEstateValuation against the real extension handlers, breaking the fake-prisma prefix tautology)
- `apps/api/src/common/errors/pekulo-error.ts` (T5 — +5 codes)
- `apps/api/src/platform/http/error-mapper.ts` (T5 — +5 HTTP mappings)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (T16 — instantiate + mount)
- `apps/api/scripts/rls-audit.ts` (T4 — +4 expected counts)
- `packages/validators/src/index.ts` (T7 — domain barrel `export * from "./realestate"`)
- `packages/types/src/index.ts` (T8 — post-sync this is a thin barrel ; the realestate types now live in `packages/types/src/realestate/realestate.types.ts`)
- `packages/types/src/realestate/realestate.types.ts` (T8 — PROPERTY_TYPES + branded IDs + PropertyCardItem + validators re-exports ; post-sync home — was inline in `packages/types/src/index.ts` pre-merge)
- `packages/contracts/src/realestate/realestate.contract.ts` (T13 — fill 12 procedures ; post-sync R11 path)
- `packages/ui/src/components/PekuloPropertyCard/PekuloPropertyCard.tsx` (T8 consumer — Property → PropertyCardItem rename ; post-sync R7 subfolder location)
- `apps/web/src/lib/zapaction/keys.ts` (T18 — REALESTATE_KEY + tag ; post-sync the unused `portfolioKeys` cross-edge was dropped per D3)

## Dev Agent Record

### Summary

Shipped the real-estate aggregate end-to-end: 4 new Prisma models (property + 1:1 mortgage + 1:1 rental + append-only valuations audit) behind a 12-procedure oRPC contract mounted at `/rpc/v1/realestate`. Service enforces the cross-user guard via `findByIdForUser` before every mutation (mirrors 3-1's `findAccountForUser`) and translates discriminated repo outcomes to typed `RealestateError`s. `recordValuation` writes property + audit row atomically inside `prisma.$transaction`. RLS audit lifted from 10 to 14 tables (real_estate / _mortgage / _rental quartets + _valuations 2-policy audit per ADR-0001). All 13 ACs covered: AC-1/2/3/4/5/7/8/9/11/12 by `bun:test`, AC-6 by `db:rls-audit`, AC-10 by grep guards, AC-13 by typecheck + `setTagRegistry` entry in `apps/web/src/lib/zapaction/keys.ts`.

### Files changed

- `apps/api/prisma/migrations/20260520165406_create_realestate/migration.sql`
- `apps/api/prisma/schema/realestate.prisma`
- `apps/api/scripts/rls-audit.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/common/errors/pekulo-error.ts`
- `apps/api/src/database/id-prefixes.config.test.ts`
- `apps/api/src/database/id-prefixes.config.ts`
- `apps/api/src/modules/realestate/realestate.errors.ts`
- `apps/api/src/modules/realestate/realestate.integration.test.ts`
- `apps/api/src/modules/realestate/realestate.module.test.ts`
- `apps/api/src/modules/realestate/realestate.module.ts`
- `apps/api/src/modules/realestate/realestate.repository.test.ts`
- `apps/api/src/modules/realestate/realestate.repository.ts`
- `apps/api/src/modules/realestate/realestate.routes.ts`
- `apps/api/src/modules/realestate/realestate.service.test.ts`
- `apps/api/src/modules/realestate/realestate.service.ts`
- `apps/api/src/platform/http/error-mapper.ts`
- `apps/api/src/test/fakes/fake-realestate.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `packages/contracts/src/realestate/realestate.contract.ts` _(post-sync R11 path ; was `packages/contracts/src/realestate.contract.ts` pre-merge)_
- `packages/types/src/realestate/realestate.types.ts` _(post-sync R11 path ; pre-merge the additions lived inline in `packages/types/src/index.ts`)_
- `packages/types/src/realestate/index.ts` _(R11 domain barrel)_
- `packages/ui/src/components/PekuloPropertyCard/PekuloPropertyCard.tsx` _(post-sync R7 sibling subfolder ; was flat `PekuloPropertyCard.tsx` pre-merge)_
- `packages/validators/src/index.ts`
- `packages/validators/src/realestate/realestate.schemas.ts` _(post-sync R11 path ; was `packages/validators/src/realestate.ts` pre-merge)_
- `packages/validators/src/realestate/index.ts` _(R11 domain barrel)_

### Deviations

- **T6 — `RealestateError` constructor signature.** Story spec passed `cause?: unknown` directly to `super(code, message, cause)`, but the current `PekuloError` constructor accepts `options?: { cause?: unknown }`. Followed the codebase precedent (`HoldingError`/`AccountError`) — `constructor(code, message, options?: { cause?: unknown }) { super(code, message, options); }`. Behaviour identical; signature consistent with siblings.
- **T7 — added `listPropertiesOutputSchema` / `listValuationsOutputSchema` / `realestateOkSchema` to `@pekulo/validators`.** Story spec inlined `z.array(…)` and `z.object({ ok: z.literal(true) })` directly in the contract file, but `@pekulo/contracts` doesn't depend on `zod`. Moved the wrappers to validators so contracts stay zod-free (mirrors holdings' `listHoldingsOutputSchema`).
- **T17 — `USER_A` / `USER_B` fixtures bumped to RFC-4122 v4 UUIDs.** `realEstateSchema.userId: z.string().uuid()` rejected the relaxed `"00000000-0000-0000-0000-00000000000a"` fixture during integration (output-validation 500). Switched to `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` / `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` (version 4 / variant 8). Documented inline.
- **T18 — `setTagRegistry` entry shape.** Story prescribed `realestate: { keys: () => [realestateKeys.all()] }`. The codebase actually uses `createFeatureKeys` / `createFeatureTags` from `@zapaction/core` (precedent: holdings 3-1). Wrote `realestateTags = createFeatureTags(REALESTATE_KEY, {...})` + `[realestateTags.all()]: [realestateKeys.list()]` / `[realestateTags.list()]: [realestateKeys.list()]` to match.
- **AC-12 boundary tests landed late.** Story T9 referenced AC-12 in its description but spec block didn't include the 12 `ZodError` assertions. Added them as a follow-up commit (`b4354e6`) after step-07's AC-to-test trace surfaced the gap. 25 repo tests now (13 original + 12 boundary).
- **T16 — skipped the live `/health` curl smoke.** The story prescribed starting the dev server in the background and curling `/health`. T17's integration test exercises the full oRPC mount + JWT verifier + realestate router via a real Elysia instance, which is a stronger smoke than a static `/health`. Typecheck-pass + integration green covers the wiring.
- **Lint warning, accepted:** `no-await-in-loop` on the AC-7 seeder (50 sequential `recordValuation` calls). Sequential is intentional — the audit log entries must be chronologically ordered for AC-5 and parallelising would race the parent `prisma.$transaction`. Documented inline.
- **`id-prefixes.config.test.ts` expected-count bumped 15 → 16.** Pre-existing test guards the `ID_PREFIXES` shape; T2 added `RealEstateMortgage` so the test had to follow.

### Test output

```
$ cd apps/api && bun test
 365 pass · 0 fail · 926 expect() calls
Ran 365 tests across 45 files. [1098 ms]

$ cd apps/api && bun test src/modules/realestate
 48 pass · 0 fail · 78 expect() calls
Ran 48 tests across 4 files. [60 ms]
# Per file: repository 25 (AC-1/2/3/4/5/7/8/9 + 12 AC-12 boundary cases),
# service 12 (cross-user guard + outcome translation + happy paths),
# module 3 (factory wiring), integration 8 (oRPC HTTP 200/401/404/409).

$ bun --filter='@pekulo/api' run typecheck         # exit 0
$ bun --filter='@pekulo/api' run db:rls-audit      # exit 0 — 14 tables; real_estate 4, real_estate_mortgage 4, real_estate_rental 4, real_estate_valuations 2
$ bun --filter=web run typecheck                   # exit 0
$ bun run lint                                     # 0 errors (11 pre-existing warnings, incl. the documented AC-7 seeder loop)

# AC-8 / AC-10 grep guards (all return 0):
$ grep -rn 'Number(.*Decimal' apps/api/src/modules/realestate | wc -l                              # 0
$ grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/realestate | wc -l         # 0
$ find apps/api/src/modules/realestate -name '*.types.ts' | wc -l                                  # 0
```

## Review Record

**Date:** 2026-05-21
**Auditors:** Spec, Code, Edge & Hallucination (Aria N/A — backend story)
**Verdict:** done
**⚠️ Same-session reviewer disclosure:** the Lead Reviewer running this audit was active during the 3 post-sync commits on this branch (merge `0777f62`, R1 align `a0cc73c`, docs refresh `594e8f2`). T1-T19 implementation was authored by a separate session. Auditors were briefed to be extra-adversarial on the post-sync surface and on conflict resolutions; the chosen overrides + dismissals below were vetted with this bias in mind.

### Auditors' raw verdict

| Auditor | Verdict | Confidence | Findings |
|---|---|---|---|
| Spec | APPROVED | HIGH | 0 critical (LOW: imprecise file count) |
| Code | CHANGES_REQUESTED | HIGH | 2 HIGH + 4 MEDIUM + 3 LOW |
| Edge & Hallucination | APPROVED | HIGH | 0 critical (LOW: doc drift, forward-pointer) |

### Findings

#### Resolved (9)

- **[HIGH] H1 — `recordValuation` race → 500 leak** `apps/api/src/modules/realestate/realestate.repository.ts:319-339`
  - Source: Code auditor
  - Resolution: commit `4b5a2c6` — switched `tx.realEstate.update` → `tx.realEstate.updateMany` inside `$transaction` ; service translates the new `{ outcome: "not-found" }` → `realestateNotFound()`. Concurrent `deleteProperty` between `requireOwnedProperty` and the tx no longer leaks Prisma P2025 as 500. New service-level race test asserts the 404 path.
- **[HIGH] H2 — fake-prisma prefix tautology** `apps/api/src/test/fakes/fake-realestate.ts:82,158,229,284`
  - Source: Code auditor
  - Resolution: commit `4b5a2c6` — +4 tests in `prefixed-ids.extension.test.ts` exercise the REAL extension handlers for `RealEstate` / `RealEstateMortgage` / `RealEstateRental` / `RealEstateValuation`. The `/^res_…/` regex assertion in integration was passing against the fake's own `id()` generator ; the new tests prove the registry entries actually wire the runtime injection.
- **[MEDIUM] M1 — `updateMortgage` / `updateRental` race** `realestate.repository.ts:257-267,300-310`
  - Source: Code auditor
  - Resolution: commit `4b5a2c6` — wrap `updateMany` + `findFirst` in `client.$transaction(async (tx) => …)`. Concurrent `detach*` between the two queries no longer surfaces `*_NOT_FOUND` despite a successful update.
- **[MEDIUM] M2 — `PROPERTY_TYPES_MIRROR` invariant** `validators/realestate.schemas.ts:31` ↔ `types/realestate.types.ts:11`
  - Source: Code auditor
  - Resolution: commit `4b5a2c6` — behavior test in `realestate.repository.test.ts` asserts `propertyTypeSchema` accepts every value of `@pekulo/types#PROPERTY_TYPES` and rejects unknowns. A future widening of the SSOT without mirror update will be caught.
- **[MEDIUM] M3 — integration port collision** `realestate.integration.test.ts:60`
  - Source: Code auditor
  - Resolution: commit `4b5a2c6` — bind `port: 0`, read `app.server.port` after listen. Eliminates the `Math.random()*200` birthday-paradox flake (root fix for the 2026-05-17 `bump PORT_BASE` workaround precedent).
- **[LOW] L2 — Prisma 5+ relaxed `WhereUniqueInput` dependency** `repository.ts:321`
  - Source: Code auditor
  - Resolution: folded into H1's fix — switching to `updateMany` removed the dependency on Prisma 5+ tolerating non-unique fields in `update.where`.
- **[LOW] L4 — story Dev Notes claim `.partial()` but actual is `.refine()`** `docs/stories/4-1-realestate-domain.md:91`
  - Source: Edge & Hallucination auditor
  - Resolution: commit `4b5a2c6` — doc fix in this story file. Wording clarified: each field `.optional()` + `.refine()` rejecting empty payloads (stricter than bare `.partial()`).
- **[LOW] L5 — `realestateKeys.byId / .valuations` exported but unused** `apps/web/src/lib/zapaction/keys.ts:60-67`
  - Source: Edge & Hallucination auditor
  - Resolution: commit `4b5a2c6` — added TODO comment naming the consuming stories (4-2 / 4-3) so the next audit doesn't flag the factories as dead code.
- **[LOW] L7 — File List count drift (24 claimed vs 28 in git)** `docs/stories/4-1-realestate-domain.md:3030`
  - Source: Spec auditor
  - Resolution: commit `4b5a2c6` — NEW count bumped 12 → 14 (validators R11 barrel + schemas) ; MODIFIED count bumped 10 → 13 (id-prefixes test, prefixed-ids extension test, others). Listed entries now align with git diff for `cd3de9b..HEAD`.

#### Dismissed (3)

- **[LOW] L1 — `detachMortgage` / `detachRental` drop `{count}` from delete (no telemetry)** `repository.ts:269-275,312-317`
  - Source: Code auditor
  - Rationale: structured logging at the repository layer is not an established pattern in this codebase (no other `*.repository.ts` does this). Per-handler attribute logs need a wider `platform/http/orpc-mount.ts` change to thread per-route attributes through `rpc.request`. TODO comment added in commit `4b5a2c6` documenting the gap ; out of scope for 4-1.
- **[LOW] L3 — 12 hand-rolled try/catch in routes.ts duplicate the same RealestateError → errors mapping** `realestate.routes.ts:43-186`
  - Source: Code auditor
  - Rationale: attempted a `mapRealestateError(err, errors, allowed)` helper (then reverted in the same commit) — oRPC's `ORPCErrorConstructorMap<MergedErrorMap<…>>` is contract-narrow per handler, so a single helper can't be both type-safe and reusable across handlers with different error subsets. The duplication is the price of contract-level type safety. Documented in the file header of `realestate.routes.ts`.
- **[LOW] L6 — fake-prisma `$transaction` does not rollback on inner failure** `fake-realestate.ts:305-307`
  - Source: Edge & Hallucination auditor
  - Rationale: defer — real Prisma's runtime `$transaction` is correct; the fake's no-rollback shape doesn't undermine the production AC-4 contract. Adding a partial-failure test would require teaching the fake to rollback, with marginal added confidence. Documented in the auditor report ; revisit in a future hardening pass.

### Verification (fresh evidence captured in this conversation)

```
$ bun --filter='@pekulo/*' run typecheck   # 7/7 packages exit 0
$ cd apps/api && bun test                  # 384 pass / 0 fail / 950 expect() (+7 vs pre-fix)
$ cd apps/web && bun run test              # 45/45 vitest pass
$ grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/realestate | wc -l   # 0
$ grep -rn 'Number(.*Decimal' apps/api/src/modules/realestate | wc -l                          # 0
$ find apps/api/src/modules/realestate -name '*.types.ts' | wc -l                              # 0
```

### Ticket sync

- Issue #24 comment: ✓ posted — https://github.com/yabafre/pekulo/issues/24#issuecomment-4503241697
- PR #85 body: ✓ re-edited with Post-review-supp section — https://github.com/yabafre/pekulo/pull/85
- state.yaml flip 4-1 → done: ✓ committed `37b49b7` (`completed_at: "2026-05-21T00:42:00Z"`)
- Epic-4 context "Previous stories — outcomes" append: ✓ committed `37b49b7` (decisions / contracts / deviations for 4-2/4-3 inheritance)

