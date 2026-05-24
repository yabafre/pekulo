# Story: 5-1-transactions-record — Transactions CRUD module + manual record UI

**Epic:** Epic 5 — Transactions & monthly tracking (V1)
**Status:** review
**Ticket:** [#27](https://github.com/yabafre/pekulo/issues/27)
**Branch:** `feature/27-5-1-transactions-record`
**Commit prefix:** `feat(#27): …`
**Depends on:** 0-4-prisma-setup (done), 0-5-orpc-contracts-scaffold (done), 0-6-zapaction-orpc-bridge (done), 2-1-accounts-orpc-port (done), 0-10-pekulo-ui-migration (done — added per user D1 decision 2026-05-24, scope bumped to API+UI)
**Complexity:** L (bumped from M in epics.md after the four step-04 decisions: API+UI, FK migration, ID wipe-and-replay, full CRUD)

## User Story

**As a** Pekulo user, **I want** to record a transaction (date, amount, type, category, parent account, free-form label, optional notes), see it in the Récentes list of the transactions screen, and edit or delete it later, **so that** my manual transaction flow is preserved end-to-end while the LLM-driven flows (5-2 CSV import, 5-3 transfer-rule, 6-X categorise) are built on top of a stable CRUD surface with a proper `accountId` FK.

## Acceptance Criteria

- **AC-1 (createTransaction + prefixed id):** **Given** a fresh DB + account `acc_aaa…` for user A, **When** A calls `createTransaction({ accountId: "acc_aaa…", occurredOn: "2026-05-15", label: "Courses Carrefour", amount: 87.50, type: "outflow", category: "courses", isImprevu: false, notes: null })`, **Then** a `transactions` row persists with `id` matching `/^tx_[0-9A-Za-z]{21}$/`, `user_id = A`, `account_id = acc_aaa…`, `amount = 87.50`, `occurred_on = 2026-05-15`, `created_at` populated by Postgres default. Repository test asserts each column.
- **AC-2 (cross-account guard — `ACCOUNT_NOT_FOUND`):** **Given** user A owns `acc_aaa…` and user B owns `acc_bbb…`, **When** A calls `createTransaction({ accountId: "acc_bbb…", … })`, **Then** the service rejects with `ACCOUNT_NOT_FOUND` → HTTP **404**. **And When** A calls `updateTransaction({ id: "tx_aaa…", accountId: "acc_bbb…" })` switching to B's account, **Then** same rejection. The guard pre-flights `accountOwnershipProbe.exists(userId, accountId)` BEFORE any Prisma write.
- **AC-3 (updateTransaction — partial update + empty-patch reject):** **Given** A's transaction `tx_aaa…`, **When** A calls `updateTransaction({ id: "tx_aaa…", amount: 92.00, notes: "ajustement" })`, **Then** only `amount`, `notes`, `updated_at` mutate; `occurred_on`, `label`, `category`, `type`, `account_id`, `is_imprevu` stay untouched. **And When** A calls `updateTransaction({ id: "tx_aaa…" })` with no field beyond `id`, **Then** the validator rejects with `ZodError` → HTTP **400** (refine guard at the schema level).
- **AC-4 (deleteTransaction — non-idempotent 404):** **Given** A's `tx_aaa…`, **When** A calls `deleteTransaction({ id: "tx_aaa…" })`, **Then** the row is removed and the response is `{ ok: true }`. **And When** A calls it again on the now-gone id, **Then** the service rejects with `TRANSACTION_NOT_FOUND` → HTTP **404** (per D4 — NOT idempotent like `detachMortgage`; a stale id should fail loudly).
- **AC-5 (listTransactions — cursor pagination):** **Given** A owns 250 transactions across 3 accounts, **When** A calls `listTransactions({ limit: 50 })`, **Then** the response is `{ items: Transaction[50], nextCursor: "<base64>" }` ordered by `(occurred_on desc, id desc)`. **And When** A calls `listTransactions({ limit: 50, cursor: <previousNextCursor> })`, **Then** the next 50 rows are returned with the original sort preserved and zero overlap. The last page returns `nextCursor: null`. Cursor format = base64url of `${occurredOnISO}|${id}` (opaque to clients). Satisfies architecture L129 + NFR-16.
- **AC-6 (getTransaction — cross-user 404):** **Given** A's `tx_aaa…`, **When** B calls `getTransaction({ id: "tx_aaa…" })`, **Then** the service rejects with `TRANSACTION_NOT_FOUND` → HTTP **404** (no row leak — the explicit `where: { id, userId: B }` guard short-circuits before Prisma's RLS check).
- **AC-7 (RLS quartet preserved):** **Given** the migration applied, **When** `bun --filter='@pekulo/api' run db:rls-audit` runs, **Then** the script exits 0 AND reports `transactions: 4` unchanged. The migration ALTERs the id column type + adds `account_id` FK; RLS policies stay in place — no policy delta. `EXPECTED_POLICY_COUNTS` already declares `transactions: 4` (no edit to `rls-audit.ts`).
- **AC-8 (Decimal coercion at row → DTO):** **Given** `amount` is `@db.Decimal NOT NULL`, **When** any read returns a DTO, **Then** `amount` is a JS `number` — never a `Prisma.Decimal`. AC grep: `grep -rn 'Number(.*Decimal' apps/api/src/modules/transactions | wc -l` returns `0`. Coercion goes through `decimalToNumber(value, fallback)` from `apps/api/src/common/derive/decimal-to-number.ts` (L24). Tests seed `Prisma.Decimal` instances (NOT JS numbers — lessons.md 2026-05-04 explicitly names 5-1 in scope list at L438).
- **AC-9 (no Prisma query without `userId` — lint-enforced):** **Given** `.oxlintrc.json` runs `pekulo/no-prisma-query-without-user-id`, **When** `bun --filter='@pekulo/api' run lint` runs, **Then** lint exits 0 for the transactions module. Every `prisma.transaction.*` and `tx.*` call carries `where: { userId }` or `where: { id, userId }`. The `prismaIdentifier: ["prisma","tx","client"]` override is already in `.oxlintrc.json`.
- **AC-10 (Elysia invariance + zero `*.types.ts` — L1 + L8):** **Given** the story shipped, **When** the dev runs `bun --filter='@pekulo/api' run typecheck` AND `grep -rEn ':\s*Elysia\b|as\s+Elysia\b|<Elysia\b' apps/api/src/modules/transactions | wc -l` AND `find apps/api/src/modules/transactions -name '*.types.ts'`, **Then** typecheck exits 0 AND the grep returns `0` AND find returns empty. Domain types re-exported from `@pekulo/validators` via `@pekulo/types/transaction/transaction.types.ts`; internal adapter interfaces (`TransactionsRepository`, `TransactionsService`, `AccountOwnershipProbe`) co-located in their respective `*.ts` files.
- **AC-11 (oRPC HTTP boundary — 200 / 400 / 401 / 404):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls each of `POST /rpc/v1/transactions/{createTransaction, updateTransaction, deleteTransaction, getTransaction, listTransactions}` with a valid body, **Then** every response is HTTP **200**. **And** missing JWT → HTTP **401** within 100 ms (NFR-9). **And** cross-user read/mutation on A's transaction by B → HTTP **404** (`TRANSACTION_NOT_FOUND`). **And** invalid input (negative amount, invalid category enum, malformed id, occurredOn outside `YYYY-MM-DD`) → HTTP **400** from Zod.
- **AC-12 (validator boundary — 8 rejection cases):** **Given** the Zod schemas from `@pekulo/validators/transactions`, **When** parsing any of: `{ amount: -0.01 }`, `{ amount: "not-a-number" }`, `{ type: "invalid" }`, `{ category: "invalid" }`, `{ label: "" }`, `{ label: "x".repeat(121) }`, `{ accountId: "not-prefixed" }`, `{ occurredOn: "2026-13-01" }`, `{ notes: "x".repeat(501) }`, **Then** each invocation throws `ZodError`. AC verified by 9 `expect(() => schema.parse(...)).toThrow(ZodError)` assertions in `transactions.repository.test.ts`. `amount: 0` IS allowed (zero-EUR annotation — confirmed by Alex in step-04).
- **AC-13 (Récentes UI — form + list ship in same story):** **Given** A is on `/dashboard/transactions`, **When** the page loads, **Then** the `Récentes` Section renders the 50 latest transactions as `ActivityRow` rows ordered by `occurredOn desc`. **And When** A opens the `Ajouter une transaction` form, fills valid input + submits, **Then** the new transaction appears at the top of Récentes within 500 ms (optimistic UI via `useActionMutation.onMutate` + invalidation through `transactionsTags.list()`).
- **AC-14 (form Zod surface — error rendering):** **Given** the form, **When** A submits with an invalid amount (negative, non-numeric) or empty label, **Then** `PekuloFieldError` renders the message inline ; no crash, no toast spam. Pattern mirrors `account-create-form.tsx` (uses `useAppForm` + `validators.onSubmit` returning the error string).
- **AC-15 (cache invalidation graph — re-introduce):** **Given** the story shipped, **When** `apps/web/src/lib/zapaction/keys.ts` is read, **Then** it declares `TRANSACTIONS_KEY = "transactions"`, `transactionsKeys.{list, byId(id)}`, `transactionsTags.{list, all}`, AND the `setTagRegistry({...})` block wires `transactionsTags.list()` → `[transactionsKeys.list(), accountsKeys.list()]` (a new/edited/deleted transaction affects the cash-balance display on the Patrimoine tab). Forward-pointer for 5-3 / 5-4 / 6-2 / 7-1 to add their own edges without further touching this file.

## Tasks

- [x] **T1** — Write the manual migration SQL at `apps/api/prisma/migrations/<TS>_alter_transactions_prefixed_ids_and_account_fk/migration.sql`. Apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. [AC: AC-1, AC-2, AC-7]
- [x] **T2** — Update `apps/api/prisma/schema/transactions.prisma` (drop UUID default, add `accountId` field + relation) + update `apps/api/prisma/schema/accounts.prisma` (add `transactions Transaction[]` back-relation). Regenerate Prisma client. [AC: AC-1, AC-2]
- [x] **T3** — Extend `apps/api/src/common/errors/pekulo-error.ts` (add `TRANSACTION_NOT_FOUND` to alphabetical union + Set) + `apps/api/src/platform/http/error-mapper.ts` (add `TRANSACTION_NOT_FOUND: 404` in the 404 cluster). [AC: AC-4, AC-6, AC-11]
- [x] **T4** — Create `apps/api/src/modules/transactions/transactions.errors.ts` (`TransactionsError extends PekuloError` + `transactionNotFound()` factory). [AC: AC-4, AC-6]
- [x] **T5** — Replace the legacy `transactionInputSchema` in `packages/validators/src/transactions/transactions.schemas.ts` with 8 new schemas: `transactionIdSchema` (flipped to `tx_` regex), `transactionSchema` (DTO), `createTransactionInputSchema`, `updateTransactionInputSchema` (refine: at-least-one-field beyond id), `getTransactionInputSchema`, `deleteTransactionInputSchema`, `listTransactionsInputSchema`, `listTransactionsOutputSchema`, `transactionsOkSchema`. Keep `TRANSACTION_CATEGORIES` + `TRANSACTION_CATEGORY_LABELS` exported (consumed by UI in T15). [AC: AC-1, AC-3, AC-5, AC-12]
- [x] **T6** — Update `packages/types/src/transaction/transaction.types.ts`: add `TransactionId` branded type, re-export `CreateTransactionInput / UpdateTransactionInput / Transaction (DTO) / ListTransactionsInput / ListTransactionsOutput` from `@pekulo/validators`, drop the legacy inline `Transaction` interface (replaced by Zod-inferred DTO). [AC: AC-10]
- [x] **T7** — Replace the empty scaffold in `packages/contracts/src/transactions/transactions.contract.ts` with 5 oRPC procedures + typed-error declarations (`TRANSACTION_NOT_FOUND`, `ACCOUNT_NOT_FOUND`). [AC: AC-11]
- [x] **T8** — Write `apps/api/src/modules/transactions/transactions.repository.test.ts` (TDD RED) + `apps/api/src/modules/transactions/transactions.repository.ts` (TDD GREEN — Prisma layer with explicit `where: { userId }` on every query, cursor pagination via base64url `(occurredOn, id)`). Re-run test → expected GREEN. [AC: AC-1, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-12]
- [x] **T9** — Add `accountExists(userId, accountId): Promise<boolean>` to `apps/api/src/modules/accounts/accounts.service.ts` (delegates to a new repository method) + extend repository with `accountExistsForUser`. Minimal interface for the transactions module's cross-aggregate probe. [AC: AC-2]
- [x] **T10** — Write `apps/api/src/modules/transactions/transactions.service.test.ts` (TDD RED) + `apps/api/src/modules/transactions/transactions.service.ts` (TDD GREEN — business logic: `AccountOwnershipProbe` injection, `TRANSACTION_NOT_FOUND` translation, `BAD_REQUEST` for empty patch wrapped at the validator level). Re-run test → expected GREEN. [AC: AC-2, AC-3, AC-4, AC-6, AC-11]
- [x] **T11** — Create `apps/api/src/modules/transactions/transactions.routes.ts` — `implement(transactionsContract).$context<{ userId, email }>().router({ … })` with 5 handlers; each calls `requireUserId(context.userId)` then delegates to service. [AC: AC-11]
- [x] **T12** — Create `apps/api/src/modules/transactions/transactions.module.ts` (`createTransactionsModule({ prismaService, accountOwnershipProbe }) → { service, router }`) + `apps/api/src/modules/transactions/transactions.module.test.ts` (whole-module wired against fake Prisma + fake probe). [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]
- [x] **T13** — Wire into `apps/api/src/bootstrap/runtime-dependencies.ts` — instantiate `transactionsModule` AFTER `accountsModule`, pass `accountOwnershipProbe = { exists: (uid, aid) => accountsModule.service.accountExists(uid, aid) }`, register `transactions: transactionsModule.router` in `orpcRouter`. Add `apps/api/src/modules/transactions/transactions.integration.test.ts` (oRPC HTTP boundary). [AC: AC-2, AC-11]
- [x] **T14** — Re-introduce `transactionsKeys` + `transactionsTags` in `apps/web/src/lib/zapaction/keys.ts` (removed in D3 audit pass per the inline comment) + wire the registry edges. [AC: AC-15]
- [x] **T15** — apps/web base wiring: create `apps/web/src/app/(cap)/dashboard/transactions/{page.tsx, loading.tsx, error.tsx}` + `_actions/transactions-actions.ts` (3 actions: `createTransaction`, `updateTransaction`, `deleteTransaction` — omit `output:` per lessons.md 2026-05-20) + `_hooks/{use-transactions.ts, use-create-transaction.ts, use-update-transaction.ts, use-delete-transaction.ts}` (ZapAction hooks per R3/R4) + `_components/transactions-recent-section.tsx` + `_components/transaction-create-form.tsx`. [AC: AC-13, AC-14, AC-15]
- [x] **T16** — apps/web finalisation: `_components/transaction-edit-form.tsx` + `_components/transaction-delete-confirm.tsx` + a11y + envelope tests (`*.a11y.test.tsx`, `*.envelope.test.tsx`) + full quality gate (`bun --filter='@pekulo/api' run lint`, `… typecheck`, `… test`, `… db:rls-audit`, `bun --filter=web run typecheck`, `bun --filter='@pekulo/ui' run test:axe`). Push the branch. [AC: AC-7, AC-8, AC-9, AC-10, AC-13, AC-14]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009).** Mirror `apps/api/src/modules/realestate/{realestate.module,realestate.routes,realestate.service,realestate.repository,realestate.errors}.ts` + `*.test.ts` siblings. Factory returns `{ service, router }`. **NEVER annotate `Elysia`** (L8 — lessons.md 2026-05-04 explicitly names story 5-1 in scope list at L461). Router type inferred via `ReturnType<typeof createTransactionsRouter>`.
- **Hard layering (ADR-0010).** Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. The chain ends in the API in T1–T13; T14–T16 ship the web tier following the same chain.
- **Folder-by-domain in packages (R11 — PR #86 audit codification).** Already in place for the transactions slice — preserve when extending:
  - `packages/validators/src/transactions/transactions.schemas.ts` (existing, brownfield-port — extend in T5)
  - `packages/contracts/src/transactions/transactions.contract.ts` (existing empty scaffold — fill in T7)
  - `packages/types/src/transaction/transaction.types.ts` (existing — note SINGULAR `transaction/`, not plural — update in T6)
- **`@pekulo/zod` SOLE zod entry point (R1).** NEVER `import { z } from "zod"`. Always `import { z } from "@pekulo/zod"`. Already applied in `transactions.schemas.ts:11`; preserve when extending.
- **Defense in depth (ADR-0013).** Every Prisma query in `transactions.repository.ts` carries explicit `where: { userId }`. Single-row finds use `where: { id, userId }`. Lint rule `pekulo/no-prisma-query-without-user-id` blocks omissions. The `prismaIdentifier: ["prisma","tx","client"]` override is already configured in `.oxlintrc.json`.
- **Cross-aggregate guard for `accountId` (mirrors 3-1 `findAccountForUser` + 4-1 `findByIdForUser`).** The transactions module DOES NOT import `AccountsRepository` directly. Instead, the service depends on a narrow interface `AccountOwnershipProbe { exists(userId, accountId): Promise<boolean> }` declared inside `transactions.service.ts`. The runtime composition root injects an adapter wrapping `accountsModule.service.accountExists` (added in T9). This keeps L1 conformance (no cross-module type leakage) and avoids a coupling cycle.
- **Prefixed IDs (ADR-0012).** `Transaction → "tx"` is **already registered** at `apps/api/src/database/id-prefixes.config.ts:24` (story 0-4). The Prisma model in T2 drops the UUID default; the prefixed-ids extension injects `tx_<base62>` on every `prisma.transaction.create(...)`. The repository `create` branch needs the `as unknown as Parameters<typeof tx.transaction.create>[0]["data"]` bridge (mirrors 2-1 / 3-1 / 4-1 precedent — Prisma's generated types require `id` when the column has no `@default`).
- **Decimal → number boundary (L24, lessons.md 2026-05-04 explicit scope for 5-1).** `amount` is `@db.Decimal`. Coerce via `decimalToNumber(value, fallback)` from `apps/api/src/common/derive/decimal-to-number.ts`. NEVER `Number(decimal)`. Tests seed `Prisma.Decimal` instances — JS numbers slip through and hide the production coercion path.
- **Pagination convention (architecture L129 + NFR-16).** Cursor-based keyset `(occurred_on desc, id desc)` — the brownfield index `transactions_user_date_idx` already supports this. Cursor format = `base64url(${occurredOnISO}|${id})` (opaque to clients). Last page returns `nextCursor: null`. **NO offset pagination** — forbidden by architecture L129.
- **oRPC routing convention.** Kebab-case, resource-oriented, plural. `/rpc/v1/transactions` mount path is already declared in `packages/contracts/src/transactions/transactions.contract.ts:8` (meta block). The 5 procedures land at `transactions.{createTransaction, updateTransaction, deleteTransaction, getTransaction, listTransactions}`.
- **Error envelope discipline (lessons.md 2026-05-20).** The 3 `defineAction` wrappers in T15 (`transactions-actions.ts`) return `{ ok: true; ... } | { ok: false; code; message }` envelopes. They MUST omit `output:` — zapaction core runs `output.parse(result)` unconditionally and rejects the error branch otherwise. Positive precedent: `parametres/_actions/accounts-actions.ts#deleteAccount`, `portefeuille/_actions/holdings-actions.ts#createHolding/recordLot`.

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — module factory + contract-first mount under `/rpc/v1/transactions`. Amended by PR #86 (R3/R4 — ZapAction is the only allowed React-Query consumer in `apps/web` hooks; tag registry centralises invalidation).
- `docs/adr/0010-hooks-orchestration-boundary.md` — hard layering. Relevant in T15/T16 for the UI tier.
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — domain types in `@pekulo/types`; folder-by-domain layout (R11).
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — schema folder + prefixed-IDs extension. The id-type switch in T1/T2 is the load-bearing change.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — explicit `where: { userId }` + lint rule.
- `docs/adr/0014-prisma-migrations.md` — manual SQL migrations on this repo (Supabase pooler hang precedent — stories 1-1, 2-1, 2-2, 3-1, 4-1).

### Lessons re-applied (verbatim scope-list from `docs/lessons.md`)

- **L1 (2026-05-09 — zero `*.types.ts` files inside `apps/api/src/modules/**`).** Every TS type lives in `@pekulo/types`. 5-1 conformance: domain `Transaction` (DTO), `CreateTransactionInput`, `UpdateTransactionInput`, `ListTransactionsInput`, `ListTransactionsOutput` are re-exported from `@pekulo/validators` through `@pekulo/types/transaction/transaction.types.ts`; internal interfaces `TransactionsRepository`, `TransactionsService`, `AccountOwnershipProbe` co-located in their respective `*.repository.ts` / `*.service.ts` files — NEVER in a `transactions.types.ts`. AC-10 grep guard.
- **L8 (2026-05-04 — Elysia 1.4 `Elysia` type is invariant — story 5-1 explicit in scope list at lessons.md L461).** Never annotate variables/parameters as bare `Elysia`. The module factory returns inferred types: `export function createTransactionsModule(deps): TransactionsModule` where `TransactionsModule` uses `ReturnType<typeof createTransactionsRouter>`. AC-10 grep guard.
- **L24 (2026-05-04 — `Number(decimal)` silently truncates — story 5-1 explicit in scope list at lessons.md L438).** Apply `decimalToNumber()` at every row → DTO boundary in `transactions.repository.ts` (single field: `amount`). Do NOT inline `Number(decimal)` and do NOT re-extract the helper. AC-8 grep guard.
- **2026-05-20 — `@pekulo/zod` is the SOLE zod entry point (R1, PR #86).** Already applied in `transactions.schemas.ts`; preserve when extending (T5).
- **2026-05-20 — Hooks under `apps/web/src/app/**/_hooks/` MUST consume ZapAction (R3/R4).** T15 hooks use `useActionQuery` / `useActionMutation` from `@zapaction/query`. NEVER `import { useQuery, useMutation } from "@tanstack/react-query"` in hook bodies.
- **2026-05-20 — `defineAction` with discriminated-union output: OMIT `output:`.** T15 server actions in `transactions-actions.ts` omit the `output:` slot.
- **2026-05-20 — Vitest `vi.mock` factory is HOISTED ; use `vi.hoisted`.** T16 envelope tests use `const { createTransactionMock } = vi.hoisted(() => ({ createTransactionMock: vi.fn() }));` then `vi.mock(...)`.
- **2026-05-20 — `fireEvent.submit(form)` over `fireEvent.click(button)` in vitest form tests.** T16 envelope tests use `fireEvent.submit(getByRole("form", { name: "Ajouter une transaction" }))`.
- **2026-05-19 — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`).** Every command in this story uses the full namespace, quoted.
- **2026-05-17 — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`.** T15: verify the Transactions screen layout (Récentes Section, no Card wrapper on mobile, Section card on desktop bento) against ux-preview JSX BEFORE implementing. The screen lives in ux-preview; cross-reference the dual mobile-flat / desktop-bento pattern.
- **2026-05-17 — Per-row CRUD actions on mobile MUST hide behind a kebab menu (lessons.md 2026-05-17, second entry).** T16: each Récentes row carries inline buttons on desktop (`$lg={{ display: "flex" }}`) AND a kebab `MoreHorizontal` trigger inside a `PekuloPopover` on mobile (`$lg={{ display: "none" }}`).
- **2026-05-17 — Tamagui v5 media keys = sm:640 md:768 lg:1024 xl:1280.** Use `$lg` for the mobile/desktop split — NOT `$md`. Verify via `@tamagui/config/v5-media.ts` before quoting any media key.
- **2026-05-09 — Zero `*.types.ts` files inside `apps/api/src/modules/**`.** (See L1 above.)
- **2026-05-07 — `bun test` ≠ `vitest run`.** `apps/api` uses `bun test`. All new `*.test.ts` under `apps/api/src/modules/transactions/` import from `"bun:test"`. `apps/web` uses `vitest run`.
- **2026-05-05 — `bun --cwd <relative> run <script>` silently fails.** Every command uses `bun --filter='@pekulo/api' run …` (workspace-aware).
- **2026-05-05 — Manual SQL migrations preferred over `prisma migrate dev`** (Supabase pooler hang). T1 writes the migration SQL by hand; apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`.
- **2026-05-04 — Elysia 1.4 `Elysia` type is invariant.** (See L8 above.)
- **Story 4-1 outcome — `as unknown as Parameters<typeof tx.X.create>[0]["data"]` bridge** for prefixed-id `create` branches. Repeated in `transactions.repository.ts#create`.
- **Story 3-1 outcome — cross-aggregate guard via repository `findFirst({ where: { id, userId } })`.** Service pre-flights ownership before every mutation. Mirrored here as `accountOwnershipProbe.exists(userId, accountId)` BEFORE create/update.

### Step-0 quotes (verbatim current state at story-write time)

#### `apps/api/prisma/schema/transactions.prisma` (current)

```prisma
// transactions.prisma — brownfield Transaction model.

model Transaction {
  id         String          @id
  userId     String          @map("user_id") @db.Uuid
  occurredOn DateTime        @map("occurred_on") @db.Date
  label      String
  amount     Decimal         @db.Decimal
  type       TransactionType
  category   String
  isImprevu  Boolean         @default(false) @map("is_imprevu")
  notes      String?
  createdAt  DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@map("transactions")
}
```

> 5-1 changes (T2): the `id` column declaration stays `id String @id` (the prefixed-ids extension already injects `tx_<base62>` on insert — only the brownfield DB-side UUID default needs to drop in T1's SQL). Add `accountId String @map("account_id")` field + `account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)` + index `@@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")`.

#### `apps/api/prisma/schema/accounts.prisma` (current — back-relation block)

```prisma
// (relevant excerpt — full file untouched besides the addition below)
model Account {
  // … existing fields …
  holdings  Holding[]
  balanceLog AccountBalanceLog[]
  @@map("accounts")
}
```

> 5-1 changes (T2): add `transactions Transaction[]` to the back-relations block. No field / index change.

#### `apps/api/src/database/id-prefixes.config.ts` (current — transactions line)

```ts
  // Transactions (story 0-4)
  Transaction: "tx",
```

> 5-1 changes: **NONE.** Already registered. (Cache had said otherwise — corrected in step 04.)

#### `apps/api/scripts/rls-audit.ts` (current — transactions line)

```ts
const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  // …
  transactions: 4,
  // …
};
```

> 5-1 changes: **NONE.** Migration in T1 preserves the existing 4 RLS policies (no DROP + CREATE — only ALTER COLUMN + ADD COLUMN). AC-7.

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

> 5-1 changes (T3): insert `"TRANSACTION_NOT_FOUND"` between `"TRANSACTION_FAILED"` and `"UNAUTHORIZED"` (alphabetical). Mirror in `PEKULO_ERROR_CODES` set.

#### `apps/api/src/platform/http/error-mapper.ts` (current — `ORPC_HTTP_STATUS_BY_CODE` 404 cluster)

```ts
  NOT_FOUND: 404,
  COMPASS_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  ACCOUNT_NOT_FOUND: 404,
  HOLDING_NOT_FOUND: 404,
  REALESTATE_NOT_FOUND: 404,
  MORTGAGE_NOT_FOUND: 404,
  RENTAL_NOT_FOUND: 404,
```

> 5-1 changes (T3): add `TRANSACTION_NOT_FOUND: 404` at the end of the 404 cluster, before `CONFLICT: 409`.

#### `packages/validators/src/transactions/transactions.schemas.ts` (current — full file)

```ts
import { z } from "@pekulo/zod";

export const TRANSACTION_CATEGORIES = [
  "salaire", "freelance", "remote", "bonus", "loyer", "courses",
  "transport", "sorties", "voyage", "sante", "imprevu", "autre",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> = {
  salaire: "Salaire", freelance: "Freelance", remote: "Remote", bonus: "Bonus",
  loyer: "Loyer", courses: "Courses", transport: "Transport", sorties: "Sorties",
  voyage: "Voyage", sante: "Santé", imprevu: "Imprévu", autre: "Autre",
};

export const transactionTypeSchema = z.enum(["inflow", "outflow"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export type TransactionCategory = z.infer<typeof transactionCategorySchema>;

export const transactionInputSchema = z.object({
  id: z.string().uuid().optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD requise"),
  label: z.string().min(1, "Libellé requis").max(120),
  amount: z.number().min(0, "Montant ≥ 0"),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transactionIdSchema = z.object({ id: z.string().uuid() });
export type TransactionId = z.infer<typeof transactionIdSchema>;

export const transactionFiltersSchema = z.object({
  year: z.number().int().optional(),
  monthNum: z.number().int().min(1).max(12).optional(),
  type: transactionTypeSchema.optional(),
  categories: z.array(transactionCategorySchema).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
```

> 5-1 changes (T5): REPLACE the entire file content. `transactionInputSchema` and `transactionFiltersSchema` are removed (legacy brownfield form — superseded by the new create/update/list inputs). `transactionIdSchema` flipped from UUID to prefixed-id regex. New: `transactionSchema` (DTO), `createTransactionInputSchema`, `updateTransactionInputSchema`, `getTransactionInputSchema`, `deleteTransactionInputSchema`, `listTransactionsInputSchema`, `listTransactionsOutputSchema`, `transactionsOkSchema`. `TRANSACTION_CATEGORIES` + `TRANSACTION_CATEGORY_LABELS` + `transactionTypeSchema` + `transactionCategorySchema` preserved verbatim.

#### `packages/types/src/transaction/transaction.types.ts` (current)

```ts
export type { TransactionType, TransactionCategory } from "@pekulo/validators";

import type { TransactionType, TransactionCategory } from "@pekulo/validators";

export interface Transaction {
  id: string;
  occurredOn: string;
  label: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  isImprevu: boolean;
  notes: string | null;
  createdAt: string;
}

export const TX_DIRECTIONS = ["in", "out"] as const;
export type TxDirection = (typeof TX_DIRECTIONS)[number];

export interface Activity { /* UI display row */ }

export const LLM_ROUTES = ["ios", "ollama", "cloud"] as const;
export type LlmRoute = (typeof LLM_ROUTES)[number];

export interface Suggestion { /* UI display row */ }
```

> 5-1 changes (T6): replace the inline `Transaction` interface with `export type { Transaction } from "@pekulo/validators"` (the Zod-inferred DTO is the SSOT going forward; the legacy interface was a brownfield placeholder before the API existed). Add `TransactionId` branded via `Id<"TransactionId">`. Re-export `CreateTransactionInput`, `UpdateTransactionInput`, `ListTransactionsInput`, `ListTransactionsOutput`. The `Activity`, `Suggestion`, `TX_DIRECTIONS`, `LLM_ROUTES` blocks STAY — they're UI-display shapes consumed by `@pekulo/ui` rows.

#### `packages/contracts/src/transactions/transactions.contract.ts` (current — empty scaffold)

```ts
export const transactionsContractV1 = {} as const;
export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = {
  moduleKey: "transactions",
  mountPath: "/rpc/v1/transactions",
  version: "v1",
} as const;
```

> 5-1 changes (T7): replace the empty `{} as const` with 5 oRPC procedure definitions wired via `oc.input(...).output(...).errors(...)`. The `transactionsContractMeta` block stays intact.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — module wiring block)

```ts
  // Story 2-1 — accounts oRPC port.
  const accountsModule = createAccountsModule({ prismaService });
  // Story 3-1 — holdings oRPC port.
  const holdingsModule = createHoldingsModule({ prismaService, env: input.env });
  // Story 4-1 — realestate domain.
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

> 5-1 changes (T13): import `createTransactionsModule`; instantiate `const transactionsModule = createTransactionsModule({ prismaService, accountOwnershipProbe: { exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId) } })` AFTER `realestateModule`. Register `transactions: transactionsModule.router` in the `orpcRouter` object. `PekuloRpcRouter` is `ConstructorParameters<typeof RPCHandler<PekuloRpcContext>>[0]` — automatic type extension, no edit required to `orpc-mount.ts`.

#### `apps/web/src/lib/zapaction/keys.ts` (current — transactions removal note)

```ts
// Tag registry — only features whose hooks actually consume the keys live
// here. Forward-pointer features (monthly, transactions, portfolio aggregate,
// lots) were removed during the D3 audit pass: their api routes aren't
// mounted (see lib/orpc/modules.ts), no hook reads from them, and their
// setTagRegistry entries fired no-op invalidations. Each story that adds
// the corresponding read/write path re-introduces its keys + tags + registry
// edges here.
```

> 5-1 changes (T14): re-introduce `TRANSACTIONS_KEY = "transactions"` + `transactionsKeys.{list, byId(id)}` + `transactionsTags.{list, all}` near the existing `REALESTATE_KEY` block. Wire `transactionsTags.list()` → `[transactionsKeys.list(), accountsKeys.list()]` in `setTagRegistry({...})` (a transaction affects the cash-balance display on Patrimoine).

### File decisions (3-bullet per file)

#### NEW — `apps/api/prisma/migrations/<TS>_alter_transactions_prefixed_ids_and_account_fk/migration.sql`

- **Single responsibility** — wipe & replay (TRUNCATE + ALTER) the brownfield `transactions` table to switch `id` from UUID-with-default to plain TEXT, add NOT NULL FK `account_id REFERENCES accounts(id) ON DELETE CASCADE`, and add the cursor-pagination index. RLS policies are preserved verbatim (no DROP + CREATE).
- **Inputs** — none (DDL only).
- **Outputs** — schema change recorded in `_prisma_migrations`; transactions table now ready to receive prefixed-id rows linked to accounts.

#### NEW — `apps/api/src/modules/transactions/transactions.errors.ts`

- **Single responsibility** — typed error factory for the transactions domain (`transactionNotFound(id)`); `TransactionsError extends PekuloError` narrows the code union for the single 5-1 error case (`ACCOUNT_NOT_FOUND` is reused from `apps/api/src/modules/accounts/accounts.errors.ts` for the cross-aggregate guard).
- **Inputs** — `PekuloError`, `PekuloErrorCode` from `apps/api/src/common/errors`.
- **Outputs** — 1 class + 1 factory function.

#### NEW — `apps/api/src/modules/transactions/transactions.repository.ts`

- **Single responsibility** — single Prisma touch-point for the transactions domain. Every method carries explicit `where: { userId }`. Cursor pagination via base64url `(occurredOn, id)`.
- **Inputs** — `ExtendedPrismaClient`.
- **Outputs** — `TransactionsRepository` interface + `createTransactionsRepository(deps)` factory; methods return domain DTOs.

#### NEW — `apps/api/src/modules/transactions/transactions.service.ts`

- **Single responsibility** — business logic for the transactions domain. Cross-aggregate `accountId` ownership pre-flight via injected `AccountOwnershipProbe`. `TRANSACTION_NOT_FOUND` translation on missing rows. Cursor decode + bounded `limit` enforcement.
- **Inputs** — `TransactionsRepository`, `AccountOwnershipProbe`.
- **Outputs** — `TransactionsService` interface + `createTransactionsService(deps)` factory; throws `TransactionsError` / `AccountsError` on domain rejections.

#### NEW — `apps/api/src/modules/transactions/transactions.routes.ts`

- **Single responsibility** — oRPC handler wiring for the 5 procedures. Verifies user context, delegates to service.
- **Inputs** — `TransactionsService`; `transactionsContract` from `@pekulo/contracts`.
- **Outputs** — `createTransactionsRouter({ service })` returning the oRPC router (type inferred).

#### NEW — `apps/api/src/modules/transactions/transactions.module.ts`

- **Single responsibility** — composition root for the transactions module. Wires repository + service + router; returns `{ service, router }`.
- **Inputs** — `PrismaService`, `AccountOwnershipProbe`.
- **Outputs** — `TransactionsModule` interface + `createTransactionsModule(deps): TransactionsModule` factory.

#### NEW — `apps/api/src/modules/transactions/{transactions.repository,transactions.service,transactions.module,transactions.integration}.test.ts`

- **Single responsibility** — `bun:test` coverage for each layer; fake Prisma at unit, fake-bridge at module, oRPC HTTP at integration.
- **Inputs** — `bun:test` runner; a fake Prisma client modelling the `transaction` table.
- **Outputs** — tests-only files; no runtime export.

#### NEW (apps/web — per D1)

- `apps/web/src/app/(cap)/dashboard/transactions/page.tsx` — RSC entry rendering `<TransactionCreateForm>` + `<TransactionsRecentSection>`.
- `apps/web/src/app/(cap)/dashboard/transactions/loading.tsx` — `<PekuloSkeleton>` placeholders.
- `apps/web/src/app/(cap)/dashboard/transactions/error.tsx` — `<PekuloErrorBoundary>` consumer.
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx` — `useAppForm` + Pekulo* primitives. Account `<PekuloSelect>` reads from `useAccounts` (existing hook, story 2-1).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` — Section with `ActivityRow` rows + kebab menu (mobile) / inline buttons (desktop).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx` — modal form, reuses the create form's field components.
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.tsx` — destructive variant.
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/{use-transactions,use-create-transaction,use-update-transaction,use-delete-transaction}.ts` — ZapAction hooks (R3/R4).
- `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` — 3 `defineAction` server actions (`createTransaction`, `updateTransaction`, `deleteTransaction`); list is read via `useActionQuery` directly on the oRPC client (no SA wrap needed).
- A11y + envelope test files per component (`.a11y.test.tsx`, `.envelope.test.tsx`).

#### MODIFIED — `packages/validators/src/transactions/transactions.schemas.ts`

- **Single responsibility (post-edit)** — Zod source of truth for the transactions aggregate (DTO + 5 inputs + cursor pagination shape).
- **Inputs** — `@pekulo/zod`.
- **Outputs** — 9 schemas + their inferred types + `TRANSACTION_CATEGORIES` + `TRANSACTION_CATEGORY_LABELS`.

#### MODIFIED — `packages/types/src/transaction/transaction.types.ts`

- **Single responsibility (post-edit)** — central registry for transactions domain types. Zod-inferred DTOs re-exported from `@pekulo/validators`; UI-display shapes (`Activity`, `Suggestion`, `LLM_ROUTES`, `TX_DIRECTIONS`) preserved.
- **Inputs** — `@pekulo/validators`.
- **Outputs** — `TransactionId` branded type + 5 re-exports + UI shapes.

#### MODIFIED — `packages/contracts/src/transactions/transactions.contract.ts`

- **Single responsibility (post-edit)** — exports 5 oRPC procedure definitions for the transactions module with typed-error declarations.
- **Inputs** — `@orpc/contract` `oc`; `@pekulo/validators` schemas.
- **Outputs** — `transactionsContractV1`, `transactionsContract`, `transactionsContractMeta`.

#### MODIFIED — `apps/api/prisma/schema/transactions.prisma` + `apps/api/prisma/schema/accounts.prisma`

- **Single responsibility (post-edit)** — Prisma model declarations with the `Transaction ↔ Account` 1:N relation wired both ways.
- **Inputs** — none (declarative).
- **Outputs** — `prisma.transaction` accessor gets an `accountId` field; `prisma.account` gets a `transactions` back-relation.

#### MODIFIED — `apps/api/src/common/errors/pekulo-error.ts` + `apps/api/src/platform/http/error-mapper.ts`

- **Single responsibility (post-edit)** — typed domain errors registry + domain code → HTTP status map (now includes `TRANSACTION_NOT_FOUND: 404`).
- **Inputs** — none.
- **Outputs** — extended `PekuloErrorCode` / `PEKULO_ERROR_CODES` / `ORPC_HTTP_STATUS_BY_CODE`.

#### MODIFIED — `apps/api/src/modules/accounts/accounts.service.ts` + `accounts.repository.ts`

- **Single responsibility (post-edit)** — accounts business logic + Prisma layer (now exposes `accountExists(userId, accountId): Promise<boolean>` for cross-aggregate probes).
- **Inputs** — `AccountsRepository`.
- **Outputs** — extended `AccountService` interface.

#### MODIFIED — `apps/api/src/bootstrap/runtime-dependencies.ts`

- **Single responsibility (post-edit)** — composition root; instantiates the transactions module and mounts it on `orpcRouter`.
- **Inputs** — `createTransactionsModule`.
- **Outputs** — `RuntimeDeps` with `orpcRouter.transactions`.

#### MODIFIED — `apps/web/src/lib/zapaction/keys.ts`

- **Single responsibility (post-edit)** — feature-scoped React Query keys + ZapAction tag registry. Registers `TRANSACTIONS_KEY` + `transactionsKeys` + `transactionsTags`. Wires `transactionsTags.list()` → `[transactionsKeys.list(), accountsKeys.list()]`.
- **Inputs** — `@zapaction/core` + `@zapaction/query`.
- **Outputs** — extended tag registry.

### Task-by-task implementation code

#### T1 — Manual migration SQL (wipe & replay + FK)

Compute timestamp: `TS=$(date +%Y%m%d%H%M%S)` then `mkdir -p apps/api/prisma/migrations/${TS}_alter_transactions_prefixed_ids_and_account_fk/`.

Create the file with the FULL content below:

```sql
-- 5-1-transactions-record — id-type switch (UUID → prefixed) + account FK.
-- Per Alex D3 (2026-05-24): wipe & replay since the brownfield transactions
-- are in (a) personal-use phase and re-entry is trivial.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — wipe brownfield rows so the id-type switch doesn't need a UPDATE
-- ───────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE "transactions" RESTART IDENTITY CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — flip id from UUID-with-default to plain TEXT
-- The prefixed-ids extension (ADR-0012) injects `tx_<base62>` at insert time.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 3 — add account_id FK (NOT NULL, CASCADE on parent delete)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  ADD COLUMN "account_id" TEXT NOT NULL;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 4 — cursor-pagination index (user_id, account_id, occurred_on desc)
-- supplements the existing transactions_user_date_idx for account-scoped queries.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX "transactions_user_account_date_idx"
  ON "transactions" ("user_id", "account_id", "occurred_on" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS policies preserved verbatim — no DROP, no re-CREATE. AC-7.
-- ───────────────────────────────────────────────────────────────────────────

COMMIT;
```

Apply:

```bash
bun --filter='@pekulo/api' run prisma:migrate:deploy
```

Expected: `1 migration found in prisma/migrations / Applying migration <TS>_alter_transactions_prefixed_ids_and_account_fk / All migrations have been successfully applied.`

Verify RLS unchanged:

```bash
bun --filter='@pekulo/api' run db:rls-audit
```

Expected: `[rls-audit] OK — N tables checked: …, transactions (4 policies), …`

Commit:

```bash
git add apps/api/prisma/migrations/
git commit -m "feat(#27): T1 — wipe & replay transactions for prefixed ids + account FK"
```

#### T2 — Prisma schema updates

Edit `apps/api/prisma/schema/transactions.prisma` to the FULL content below (replaces the file):

```prisma
// transactions.prisma — Transaction model (story 5-1).
// id: TEXT, no @default — prefixed-ids extension injects `tx_<base62>`.
// account_id: NOT NULL FK to accounts(id) with ON DELETE CASCADE.

model Transaction {
  id         String          @id
  userId     String          @map("user_id") @db.Uuid
  accountId  String          @map("account_id")
  occurredOn DateTime        @map("occurred_on") @db.Date
  label      String
  amount     Decimal         @db.Decimal
  type       TransactionType
  category   String
  isImprevu  Boolean         @default(false) @map("is_imprevu")
  notes      String?
  createdAt  DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  account    Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")
  @@map("transactions")
}
```

Edit `apps/api/prisma/schema/accounts.prisma` to ADD `transactions Transaction[]` to the `Account` model's back-relations (locate the existing `holdings Holding[]` and `balanceLog AccountBalanceLog[]` lines, add the new line alongside them).

Run:

```bash
bun --filter='@pekulo/api' run prisma:generate
bun --filter='@pekulo/api' run typecheck
```

Expected: both exit 0. The generated client now exposes `prisma.transaction.account` relation accessor.

Commit:

```bash
git add apps/api/prisma/schema/transactions.prisma apps/api/prisma/schema/accounts.prisma
git commit -m "feat(#27): T2 — prisma schema — Transaction.accountId + Account.transactions back-relation"
```

#### T3 — Add `TRANSACTION_NOT_FOUND` error code + HTTP status

Edit `apps/api/src/common/errors/pekulo-error.ts`. Insert `| "TRANSACTION_NOT_FOUND"` in the `PekuloErrorCode` union (alphabetical — between `TRANSACTION_FAILED` and `UNAUTHORIZED`), AND insert `"TRANSACTION_NOT_FOUND",` in the `PEKULO_ERROR_CODES` set (same position).

Edit `apps/api/src/platform/http/error-mapper.ts`. In the `ORPC_HTTP_STATUS_BY_CODE` object, add the following entry at the end of the 404 cluster (after `RENTAL_NOT_FOUND: 404,`):

```ts
  // Transactions 404 (story 5-1): cross-user probe or stale id on get / update /
  // delete. Defense-in-depth shape: the explicit { id, userId } guard surfaces
  // this rather than letting RLS produce a confusing P2025.
  TRANSACTION_NOT_FOUND: 404,
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0 (the `Record<PekuloErrorCode, number>` compile-time exhaustiveness check is satisfied).

Commit:

```bash
git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts
git commit -m "feat(#27): T3 — register TRANSACTION_NOT_FOUND code + 404 status"
```

#### T4 — `transactions.errors.ts`

Create `apps/api/src/modules/transactions/transactions.errors.ts` with the FULL content below:

```ts
// apps/api/src/modules/transactions/transactions.errors.ts
// Typed error factories for the transactions domain (story 5-1).
// 5-1 ships a single domain error (TRANSACTION_NOT_FOUND); ACCOUNT_NOT_FOUND
// is reused from apps/api/src/modules/accounts/accounts.errors.ts for the
// cross-aggregate guard.

import { PekuloError } from "../../common/errors";

export class TransactionsError extends PekuloError {
  override readonly name = "PekuloError";
}

export function transactionNotFound(id: string): TransactionsError {
  return new TransactionsError("TRANSACTION_NOT_FOUND", `transaction not found: ${id}`);
}
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.errors.ts
git commit -m "feat(#27): T4 — TransactionsError factory"
```

#### T5 — Validator schemas (replace `transactions.schemas.ts`)

Replace the FULL content of `packages/validators/src/transactions/transactions.schemas.ts` with:

```ts
// packages/validators/src/transactions/transactions.schemas.ts
// Zod source of truth for the transactions aggregate (story 5-1). 9 schemas
// covering the DTO + 5 inputs + cursor pagination + ok envelope. Categories
// (12 closed enum) + French labels exported for UI consumers.
//
// R1: every zod import goes through @pekulo/zod (not "zod" direct).
// Prefixed IDs (ADR-0012): transaction ids match /^tx_[0-9A-Za-z]{21}$/.

import { z } from "@pekulo/zod";

// ─── Closed enums + label maps ───────────────────────────────────────────
export const TRANSACTION_CATEGORIES = [
  "salaire", "freelance", "remote", "bonus", "loyer", "courses",
  "transport", "sorties", "voyage", "sante", "imprevu", "autre",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<
  (typeof TRANSACTION_CATEGORIES)[number],
  string
> = {
  salaire: "Salaire", freelance: "Freelance", remote: "Remote", bonus: "Bonus",
  loyer: "Loyer", courses: "Courses", transport: "Transport", sorties: "Sorties",
  voyage: "Voyage", sante: "Santé", imprevu: "Imprévu", autre: "Autre",
};

export const transactionTypeSchema = z.enum(["inflow", "outflow"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export type TransactionCategory = z.infer<typeof transactionCategorySchema>;

// ─── ID regexes ───────────────────────────────────────────────────────────
const TRANSACTION_ID_REGEX = /^tx_[0-9A-Za-z]{21}$/;
const ACCOUNT_ID_REGEX = /^acc_[0-9A-Za-z]{21}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── DTO (row shape returned by reads) ───────────────────────────────────
export const transactionSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
  accountId: z.string().regex(ACCOUNT_ID_REGEX),
  occurredOn: z.string().regex(ISO_DATE_REGEX, "Date YYYY-MM-DD requise"),
  label: z.string().min(1).max(120),
  amount: z.number().min(0),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

// ─── Inputs ───────────────────────────────────────────────────────────────
export const createTransactionInputSchema = z.object({
  accountId: z.string().regex(ACCOUNT_ID_REGEX, "accountId invalide"),
  occurredOn: z.string().regex(ISO_DATE_REGEX, "Date YYYY-MM-DD requise"),
  label: z.string().min(1, "Libellé requis").max(120, "Libellé > 120 caractères"),
  amount: z.number().min(0, "Montant ≥ 0"),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500, "Notes > 500 caractères").nullable(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionInputSchema = z
  .object({
    id: z.string().regex(TRANSACTION_ID_REGEX, "id invalide"),
    accountId: z.string().regex(ACCOUNT_ID_REGEX).optional(),
    occurredOn: z.string().regex(ISO_DATE_REGEX).optional(),
    label: z.string().min(1).max(120).optional(),
    amount: z.number().min(0).optional(),
    type: transactionTypeSchema.optional(),
    category: transactionCategorySchema.optional(),
    isImprevu: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) => {
      const { id: _id, ...rest } = v;
      return Object.values(rest).some((x) => x !== undefined);
    },
    { message: "updateTransaction requires at least one field beyond id" },
  );
export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

export const getTransactionInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
});
export type GetTransactionInput = z.infer<typeof getTransactionInputSchema>;

export const deleteTransactionInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
});
export type DeleteTransactionInput = z.infer<typeof deleteTransactionInputSchema>;

export const listTransactionsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(), // opaque base64url(`${occurredOnISO}|${id}`)
  accountId: z.string().regex(ACCOUNT_ID_REGEX).optional(),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsInputSchema>;

export const listTransactionsOutputSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().nullable(),
});
export type ListTransactionsOutput = z.infer<typeof listTransactionsOutputSchema>;

// ─── Envelope ─────────────────────────────────────────────────────────────
export const transactionsOkSchema = z.object({ ok: z.literal(true) });
```

Run:

```bash
bun --filter='@pekulo/validators' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/validators/src/transactions/transactions.schemas.ts
git commit -m "feat(#27): T5 — transactions validator schemas — DTO + 5 inputs + cursor pagination"
```

#### T6 — Types (`@pekulo/types/transaction/transaction.types.ts`)

Replace the FULL content of `packages/types/src/transaction/transaction.types.ts` with:

```ts
// packages/types/src/transaction/transaction.types.ts
// Transactions domain types — Zod-inferred DTO + inputs re-exported from
// @pekulo/validators. UI-display shapes (Activity, Suggestion, LLM_ROUTES,
// TX_DIRECTIONS) preserved as inline interfaces consumed by @pekulo/ui rows.

import type { Id } from "../shared/shared.types";

export type TransactionId = Id<"TransactionId">;

export type {
  TransactionType,
  TransactionCategory,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  GetTransactionInput,
  DeleteTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
} from "@pekulo/validators";

// ─── UI display shapes (unchanged from pre-5-1) ──────────────────────────
export const TX_DIRECTIONS = ["in", "out"] as const;
export type TxDirection = (typeof TX_DIRECTIONS)[number];

export interface Activity {
  label: string;
  account: string;
  category: string;
  direction: TxDirection;
  amountEur: number;
}

export const LLM_ROUTES = ["ios", "ollama", "cloud"] as const;
export type LlmRoute = (typeof LLM_ROUTES)[number];

export interface Suggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: TxDirection;
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: LlmRoute;
}
```

Run:

```bash
bun --filter='@pekulo/types' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/types/src/transaction/transaction.types.ts
git commit -m "feat(#27): T6 — transaction types — DTO/inputs re-exported from validators + TransactionId brand"
```

#### T7 — oRPC contract (5 procedures)

Replace the FULL content of `packages/contracts/src/transactions/transactions.contract.ts` with:

```ts
// packages/contracts/src/transactions/transactions.contract.ts
// Transactions module oRPC contract (story 5-1). 5 procedures: CRUD on
// transactions with cross-account ownership guard (ACCOUNT_NOT_FOUND) and
// non-idempotent delete (TRANSACTION_NOT_FOUND). Mount under
// /rpc/v1/transactions per ADR-0009.

import { oc } from "@orpc/contract";
import {
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  getTransactionInputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  transactionSchema,
  transactionsOkSchema,
  updateTransactionInputSchema,
} from "@pekulo/validators";

const transactionNotFoundError = {
  status: 404 as const,
  message: "transaction not found",
};
const accountNotFoundError = {
  status: 404 as const,
  message: "account not found",
};

export const transactionsContractV1 = {
  createTransaction: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(createTransactionInputSchema)
    .output(transactionSchema),
  updateTransaction: oc
    .errors({
      TRANSACTION_NOT_FOUND: transactionNotFoundError,
      ACCOUNT_NOT_FOUND: accountNotFoundError,
    })
    .input(updateTransactionInputSchema)
    .output(transactionSchema),
  deleteTransaction: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(deleteTransactionInputSchema)
    .output(transactionsOkSchema),
  getTransaction: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(getTransactionInputSchema)
    .output(transactionSchema),
  listTransactions: oc
    .input(listTransactionsInputSchema)
    .output(listTransactionsOutputSchema),
} as const;

export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = {
  moduleKey: "transactions",
  mountPath: "/rpc/v1/transactions",
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
git add packages/contracts/src/transactions/transactions.contract.ts
git commit -m "feat(#27): T7 — transactions oRPC contract — 5 procedures with typed errors"
```

#### T8 — Repository TDD (RED + GREEN)

Create `apps/api/src/modules/transactions/transactions.repository.test.ts` with the FULL content below (TDD RED — file under test does not exist yet):

```ts
// apps/api/src/modules/transactions/transactions.repository.test.ts
// bun:test — TDD RED for the transactions repository (story 5-1).
// Asserts: prefixed-id create, userId guard, cursor pagination, Decimal
// coercion via decimalToNumber, AC-12 validator rejection cases.

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Decimal } from "@prisma/client/runtime/library";
import {
  createTransactionInputSchema,
  type CreateTransactionInput,
} from "@pekulo/validators";
import { createTransactionsRepository } from "./transactions.repository";

interface FakeRow {
  id: string;
  userId: string;
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: Decimal;
  type: "inflow" | "outflow";
  category: string;
  isImprevu: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const sampleInput = (over: Partial<CreateTransactionInput> = {}): CreateTransactionInput => ({
  accountId: "acc_aaa11111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses Carrefour",
  amount: 87.5,
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  ...over,
});

const fakeRow = (over: Partial<FakeRow> = {}): FakeRow => ({
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  userId: "u_a",
  accountId: "acc_aaa11111111111111111",
  occurredOn: new Date("2026-05-15"),
  label: "Courses Carrefour",
  amount: new Decimal(87.5),
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  createdAt: new Date("2026-05-15T10:00:00Z"),
  updatedAt: new Date("2026-05-15T10:00:00Z"),
  ...over,
});

const createFakeClient = () => {
  const create = mock(async ({ data }: { data: FakeRow }) => fakeRow(data));
  const findFirst = mock(async () => null as FakeRow | null);
  const findMany = mock(async () => [] as FakeRow[]);
  const updateMany = mock(async () => ({ count: 1 }));
  const deleteMany = mock(async () => ({ count: 1 }));
  return {
    transaction: { create, findFirst, findMany, updateMany, deleteMany },
  } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
};

describe("transactionsRepository", () => {
  let client: ReturnType<typeof createFakeClient>;
  let repo: ReturnType<typeof createTransactionsRepository>;

  beforeEach(() => {
    client = createFakeClient();
    repo = createTransactionsRepository({ client });
  });

  test("create returns a DTO with the prefixed id + coerced amount as JS number", async () => {
    const row = fakeRow();
    (client.transaction.create as ReturnType<typeof mock>).mockResolvedValueOnce(row);
    const out = await repo.create("u_a", sampleInput());
    expect(out.id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
    expect(out.amount).toBe(87.5);
    expect(typeof out.amount).toBe("number");
  });

  test("findByIdForUser returns null on cross-user probe", async () => {
    (client.transaction.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce(null);
    const out = await repo.findByIdForUser("u_b", "tx_aaaaaaaaaaaaaaaaaaaaa");
    expect(out).toBeNull();
    expect(client.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: "tx_aaaaaaaaaaaaaaaaaaaaa", userId: "u_b" },
    });
  });

  test("listByUser returns { items, nextCursor=null } on under-limit page", async () => {
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([fakeRow()]);
    const out = await repo.listByUser("u_a", { limit: 50 });
    expect(out.items).toHaveLength(1);
    expect(out.nextCursor).toBeNull();
  });

  test("listByUser returns a nextCursor when limit+1 rows surface", async () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      fakeRow({ id: `tx_${String(i).padStart(21, "0")}`, occurredOn: new Date(`2026-05-${10 + (i % 20)}`) }),
    );
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce(rows);
    const out = await repo.listByUser("u_a", { limit: 50 });
    expect(out.items).toHaveLength(50);
    expect(out.nextCursor).not.toBeNull();
    expect(typeof out.nextCursor).toBe("string");
  });

  test("delete on cross-user returns { deleted: false }", async () => {
    (client.transaction.deleteMany as ReturnType<typeof mock>).mockResolvedValueOnce({ count: 0 });
    const out = await repo.delete("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" });
    expect(out).toEqual({ deleted: false });
  });

  test("AC-12: validator rejects negative amount, invalid enum, empty label, etc.", () => {
    expect(() => createTransactionInputSchema.parse(sampleInput({ amount: -0.01 }))).toThrow();
    expect(() => createTransactionInputSchema.parse({ ...sampleInput(), type: "invalid" as unknown as never })).toThrow();
    expect(() => createTransactionInputSchema.parse({ ...sampleInput(), category: "invalid" as unknown as never })).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ label: "" }))).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ label: "x".repeat(121) }))).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ accountId: "not-prefixed" }))).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ occurredOn: "2026-13-01" }))).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ notes: "x".repeat(501) }))).toThrow();
    // amount = 0 IS allowed (Alex D-step04 confirmation)
    expect(() => createTransactionInputSchema.parse(sampleInput({ amount: 0 }))).not.toThrow();
  });
});
```

Run (RED — file under test missing, expected failure):

```bash
cd apps/api && bun test src/modules/transactions/transactions.repository.test.ts
```

Expected: import error `Cannot find module './transactions.repository'`.

Create `apps/api/src/modules/transactions/transactions.repository.ts` (TDD GREEN) with the FULL content below:

```ts
// apps/api/src/modules/transactions/transactions.repository.ts
// Prisma layer for the transactions domain (story 5-1).
//
// Discipline:
//   - Every query carries explicit where: { userId } (ADR-0013).
//   - The `as unknown as Parameters<typeof tx.transaction.create>[0]["data"]`
//     bridge on create is mandatory — the column has no @default so Prisma's
//     generated type demands `id`; the prefixed-ids extension injects it at
//     runtime (story 2-1 / 3-1 / 4-1 outcome).
//   - amount: Decimal coerced via decimalToNumber(value, fallback) — never
//     Number(decimal) (L24, lessons.md scope list explicitly names 5-1).
//   - Cursor pagination via base64url(`${occurredOnISO}|${id}`); last page
//     returns nextCursor: null (architecture L129 + NFR-16).

import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import type { Prisma } from "@generated/prisma/client";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { ExtendedPrismaClient } from "../../database";

type TransactionRow = {
  id: string;
  userId: string;
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: Prisma.Decimal;
  type: "inflow" | "outflow";
  category: string;
  isImprevu: boolean;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UpdateOutcome =
  | { outcome: "ok"; transaction: Transaction }
  | { outcome: "not-found" };

export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
}

function toDto(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    label: row.label,
    amount: decimalToNumber(row.amount, 0),
    type: row.type,
    category: row.category as Transaction["category"],
    isImprevu: row.isImprevu,
    notes: row.notes,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function encodeCursor(occurredOnISO: string, id: string): string {
  return Buffer.from(`${occurredOnISO}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { occurredOn: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [occurredOn, id] = raw.split("|");
    if (!occurredOn || !id) return null;
    return { occurredOn, id };
  } catch {
    return null;
  }
}

export function createTransactionsRepository(deps: {
  client: ExtendedPrismaClient;
}): TransactionsRepository {
  return {
    async create(userId, input) {
      const row = (await deps.client.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          occurredOn: new Date(input.occurredOn),
          label: input.label,
          amount: input.amount,
          type: input.type,
          category: input.category,
          isImprevu: input.isImprevu,
          notes: input.notes,
        } as unknown as Parameters<typeof deps.client.transaction.create>[0]["data"],
      })) as TransactionRow;
      return toDto(row);
    },

    async findByIdForUser(userId, id) {
      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow | null;
      return row ? toDto(row) : null;
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.accountId !== undefined) data["accountId"] = patch.accountId;
      if (patch.occurredOn !== undefined) data["occurredOn"] = new Date(patch.occurredOn);
      if (patch.label !== undefined) data["label"] = patch.label;
      if (patch.amount !== undefined) data["amount"] = patch.amount;
      if (patch.type !== undefined) data["type"] = patch.type;
      if (patch.category !== undefined) data["category"] = patch.category;
      if (patch.isImprevu !== undefined) data["isImprevu"] = patch.isImprevu;
      if (patch.notes !== undefined) data["notes"] = patch.notes;

      const result = await deps.client.transaction.updateMany({
        where: { id, userId },
        data: data as Prisma.TransactionUpdateInput,
      });
      if (result.count === 0) return { outcome: "not-found" };

      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow;
      return { outcome: "ok", transaction: toDto(row) };
    },

    async delete(userId, input) {
      const result = await deps.client.transaction.deleteMany({
        where: { id: input.id, userId },
      });
      return { deleted: result.count > 0 };
    },

    async listByUser(userId, input) {
      const limit = input.limit ?? 50;
      const decoded = input.cursor ? decodeCursor(input.cursor) : null;

      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(decoded
          ? {
              OR: [
                { occurredOn: { lt: new Date(decoded.occurredOn) } },
                { occurredOn: new Date(decoded.occurredOn), id: { lt: decoded.id } },
              ],
            }
          : {}),
      };

      const rows = (await deps.client.transaction.findMany({
        where,
        orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
        take: limit + 1,
      })) as TransactionRow[];

      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map(toDto);
      const last = items.at(-1);
      const nextCursor = hasMore && last ? encodeCursor(last.occurredOn, last.id) : null;

      return { items, nextCursor };
    },
  };
}
```

Re-run T8 test:

```bash
cd apps/api && bun test src/modules/transactions/transactions.repository.test.ts
```

Expected: `7 pass, 0 fail`.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions.repository.test.ts
git commit -m "feat(#27): T8 — transactions repository — CRUD + cursor pagination + decimal coercion"
```

#### T9 — `accountExists` on AccountsService

Edit `apps/api/src/modules/accounts/accounts.repository.ts`. Locate the `AccountsRepository` interface block and ADD this method to the interface:

```ts
  accountExistsForUser(userId: string, accountId: string): Promise<boolean>;
```

In the same file, ADD this method inside the `return { … }` object of `createAccountRepository`:

```ts
    async accountExistsForUser(userId, accountId) {
      const row = await deps.client.account.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });
      return row !== null;
    },
```

Edit `apps/api/src/modules/accounts/accounts.service.ts`. ADD this method to the `AccountService` interface AND to the returned object of `createAccountService`:

```ts
// In the interface:
  accountExists(userId: string, accountId: string): Promise<boolean>;

// In the factory:
    async accountExists(userId, accountId) {
      return repository.accountExistsForUser(userId, accountId);
    },
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
cd apps/api && bun test src/modules/accounts
```

Expected: typecheck exit 0; accounts test suite still all pass (no regression — the new method is additive).

Commit:

```bash
git add apps/api/src/modules/accounts/accounts.repository.ts apps/api/src/modules/accounts/accounts.service.ts
git commit -m "feat(#27): T9 — accountExists probe on AccountsService for cross-aggregate guard"
```

#### T10 — Service TDD (RED + GREEN)

Create `apps/api/src/modules/transactions/transactions.service.test.ts` (TDD RED):

```ts
// apps/api/src/modules/transactions/transactions.service.test.ts
// bun:test — TDD RED for the transactions service (story 5-1).
// Asserts: ACCOUNT_NOT_FOUND on cross-aggregate, TRANSACTION_NOT_FOUND on
// stale id, delete non-idempotent, update partial.

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { PekuloError } from "../../common/errors";
import type { TransactionsRepository, UpdateOutcome } from "./transactions.repository";
import { createTransactionsService, type AccountOwnershipProbe } from "./transactions.service";

const sampleTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa11111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses",
  amount: 87.5,
  type: "outflow" as const,
  category: "courses" as const,
  isImprevu: false,
  notes: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

const makeRepoMock = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => sampleTx),
    findByIdForUser: mock(async () => sampleTx),
    update: mock(async () => ({ outcome: "ok", transaction: sampleTx }) as UpdateOutcome),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [sampleTx], nextCursor: null })),
    ...over,
  }) as TransactionsRepository;

const makeProbe = (exists: boolean): AccountOwnershipProbe => ({
  exists: mock(async () => exists),
});

describe("transactionsService", () => {
  test("create — cross-account → ACCOUNT_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: makeProbe(false),
    });
    await expect(
      svc.createTransaction("u_a", {
        accountId: "acc_bbb22222222222222222",
        occurredOn: "2026-05-15",
        label: "x",
        amount: 1,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  test("create — happy path returns DTO", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: makeProbe(true),
    });
    const out = await svc.createTransaction("u_a", {
      accountId: "acc_aaa11111111111111111",
      occurredOn: "2026-05-15",
      label: "x",
      amount: 1,
      type: "outflow",
      category: "courses",
      isImprevu: false,
      notes: null,
    });
    expect(out.id).toBe(sampleTx.id);
  });

  test("update — not-found → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({
        update: mock(async () => ({ outcome: "not-found" }) as UpdateOutcome),
      }),
      accountOwnershipProbe: makeProbe(true),
    });
    await expect(
      svc.updateTransaction("u_a", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", amount: 5 }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  test("update — patch with switched accountId pre-flights probe", async () => {
    const probe = makeProbe(false);
    const svc = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: probe,
    });
    await expect(
      svc.updateTransaction("u_a", {
        id: "tx_aaaaaaaaaaaaaaaaaaaaa",
        accountId: "acc_bbb22222222222222222",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    expect(probe.exists).toHaveBeenCalled();
  });

  test("delete — non-idempotent: gone id → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({
        delete: mock(async () => ({ deleted: false })),
      }),
      accountOwnershipProbe: makeProbe(true),
    });
    await expect(
      svc.deleteTransaction("u_a", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  test("get — cross-user → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findByIdForUser: mock(async () => null),
      }),
      accountOwnershipProbe: makeProbe(true),
    });
    await expect(
      svc.getTransaction("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  test("PekuloError instances surface for assertions", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({ findByIdForUser: mock(async () => null) }),
      accountOwnershipProbe: makeProbe(true),
    });
    try {
      await svc.getTransaction("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(PekuloError);
    }
  });
});
```

Run RED:

```bash
cd apps/api && bun test src/modules/transactions/transactions.service.test.ts
```

Expected: import error.

Create `apps/api/src/modules/transactions/transactions.service.ts` (TDD GREEN):

```ts
// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (story 5-1).
//
// Cross-aggregate guard: AccountOwnershipProbe.exists(userId, accountId)
// pre-flights BEFORE create (always) and BEFORE update (only when the patch
// includes accountId — mirrors 3-1's pre-flight policy).
//
// Errors:
//   - ACCOUNT_NOT_FOUND  (from @pekulo/api/modules/accounts/accounts.errors)
//   - TRANSACTION_NOT_FOUND (from ./transactions.errors)

import { accountNotFound } from "../accounts/accounts.errors";
import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  GetTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import type { TransactionsRepository } from "./transactions.repository";
import { transactionNotFound } from "./transactions.errors";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
}

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(
    userId: string,
    input: ListTransactionsInput,
  ): Promise<ListTransactionsOutput>;
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
}): TransactionsService {
  return {
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound(input.accountId);
      return deps.repository.create(userId, input);
    },

    async updateTransaction(userId, input) {
      if (input.accountId !== undefined) {
        const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
        if (!owns) throw accountNotFound(input.accountId);
      }
      const outcome = await deps.repository.update(userId, input);
      if (outcome.outcome === "not-found") throw transactionNotFound(input.id);
      return outcome.transaction;
    },

    async deleteTransaction(userId, input) {
      const { deleted } = await deps.repository.delete(userId, input);
      if (!deleted) throw transactionNotFound(input.id);
      return { ok: true } as const;
    },

    async getTransaction(userId, input) {
      const row = await deps.repository.findByIdForUser(userId, input.id);
      if (!row) throw transactionNotFound(input.id);
      return row;
    },

    async listTransactions(userId, input) {
      return deps.repository.listByUser(userId, input);
    },
  };
}
```

Re-run T10 test:

```bash
cd apps/api && bun test src/modules/transactions/transactions.service.test.ts
```

Expected: `7 pass, 0 fail`.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.service.test.ts
git commit -m "feat(#27): T10 — transactions service — cross-aggregate guard + error translation"
```

#### T11 — oRPC routes

Create `apps/api/src/modules/transactions/transactions.routes.ts` with the FULL content below:

```ts
// apps/api/src/modules/transactions/transactions.routes.ts
// oRPC handler wiring for the 5 procedures (story 5-1).
// Mirrors apps/api/src/modules/realestate/realestate.routes.ts shape.

import { implement } from "@orpc/server";
import { transactionsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { TransactionsService } from "./transactions.service";

const base = implement(transactionsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): string {
  if (!userId?.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
  return userId;
}

export function createTransactionsRouter(deps: { service: TransactionsService }) {
  return base.router({
    createTransaction: base.createTransaction.handler(async ({ input, context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.createTransaction(userId, input);
    }),
    updateTransaction: base.updateTransaction.handler(async ({ input, context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.updateTransaction(userId, input);
    }),
    deleteTransaction: base.deleteTransaction.handler(async ({ input, context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.deleteTransaction(userId, input);
    }),
    getTransaction: base.getTransaction.handler(async ({ input, context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.getTransaction(userId, input);
    }),
    listTransactions: base.listTransactions.handler(async ({ input, context }) => {
      const userId = requireUserId(context.userId);
      return deps.service.listTransactions(userId, input);
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
git add apps/api/src/modules/transactions/transactions.routes.ts
git commit -m "feat(#27): T11 — transactions oRPC router — 5 handlers wired to service"
```

#### T12 — Module factory + test

Create `apps/api/src/modules/transactions/transactions.module.ts` with:

```ts
// apps/api/src/modules/transactions/transactions.module.ts
// Composition root for the transactions module (story 5-1). Mirrors
// realestate.module.ts shape.

import type { PrismaService } from "../../database";
import { createTransactionsRepository } from "./transactions.repository";
import { createTransactionsService, type AccountOwnershipProbe, type TransactionsService } from "./transactions.service";
import { createTransactionsRouter } from "./transactions.routes";

export interface TransactionsModule {
  service: TransactionsService;
  router: ReturnType<typeof createTransactionsRouter>;
}

export function createTransactionsModule(deps: {
  prismaService: PrismaService;
  accountOwnershipProbe: AccountOwnershipProbe;
}): TransactionsModule {
  const repository = createTransactionsRepository({ client: deps.prismaService.client });
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
  });
  const router = createTransactionsRouter({ service });
  return { service, router };
}
```

Create `apps/api/src/modules/transactions/transactions.module.test.ts`:

```ts
// apps/api/src/modules/transactions/transactions.module.test.ts
// Whole-module smoke (story 5-1). Asserts the factory wires the chain.

import { describe, expect, test, mock } from "bun:test";
import { createTransactionsModule } from "./transactions.module";

describe("transactionsModule", () => {
  test("factory returns { service, router }", () => {
    const fakeClient = {
      transaction: {
        create: mock(),
        findFirst: mock(),
        findMany: mock(),
        updateMany: mock(),
        deleteMany: mock(),
      },
    };
    const mod = createTransactionsModule({
      prismaService: { client: fakeClient as unknown as never } as unknown as never,
      accountOwnershipProbe: { exists: mock(async () => true) },
    });
    expect(mod.service).toBeDefined();
    expect(mod.router).toBeDefined();
    expect(typeof mod.service.createTransaction).toBe("function");
  });
});
```

Run:

```bash
cd apps/api && bun test src/modules/transactions/transactions.module.test.ts
```

Expected: `1 pass, 0 fail`.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.module.ts apps/api/src/modules/transactions/transactions.module.test.ts
git commit -m "feat(#27): T12 — transactions module factory + smoke"
```

#### T13 — Wire into runtime-dependencies + integration test

Edit `apps/api/src/bootstrap/runtime-dependencies.ts`. ADD the import:

```ts
import { createTransactionsModule } from "../modules/transactions/transactions.module";
```

In the body, AFTER the `const realestateModule = …` line and BEFORE the `const orpcRouter: PekuloRpcRouter = {` line, ADD:

```ts
  // Story 5-1 — transactions domain. Cross-aggregate guard via
  // AccountOwnershipProbe adapter wrapping accountsModule.service.accountExists.
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: {
      exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
    },
  });
```

In the `orpcRouter` object literal, ADD a line after `realestate: realestateModule.router,`:

```ts
    transactions: transactionsModule.router,
```

Create `apps/api/src/modules/transactions/transactions.integration.test.ts`. Mirror the shape of `apps/api/src/modules/realestate/realestate.integration.test.ts` (read the realestate version verbatim with `cat apps/api/src/modules/realestate/realestate.integration.test.ts` and adapt: 5 procedures, 401 missing-JWT, 404 cross-user). Keep the test file under ~250 lines.

Run:

```bash
bun --filter='@pekulo/api' run typecheck
cd apps/api && bun test src/modules/transactions/
```

Expected: typecheck exit 0; all transactions tests pass.

Commit:

```bash
git add apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/modules/transactions/transactions.integration.test.ts
git commit -m "feat(#27): T13 — mount transactions module + oRPC HTTP boundary tests"
```

#### T14 — Tag registry (`apps/web/src/lib/zapaction/keys.ts`)

Edit `apps/web/src/lib/zapaction/keys.ts`. Near the existing `REALESTATE_KEY` block, ADD:

```ts
// Story 5-1 — transactions feature key set + tag registry. The block was
// removed during the D3 audit pass; re-introduced now that the transactions
// oRPC module is mounted. Stories 5-3 (transfer rule), 5-4 (monthly agg),
// 6-2 (LLM categorise), 7-1 (dashboard) declare their invalidation edges
// against `transactionsTags.list()` without further touching this file.
export const TRANSACTIONS_KEY = "transactions" as const;
export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
  byId: (id: string) => ["byId", id] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
});
```

In the existing `setTagRegistry({...})` block, ADD these entries (cash-balance cross-edge — a transaction affects the Patrimoine tab):

```ts
  [transactionsTags.all()]: [transactionsKeys.list(), accountsKeys.list()],
  [transactionsTags.list()]: [transactionsKeys.list(), accountsKeys.list()],
```

Run:

```bash
bun --filter=web run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/web/src/lib/zapaction/keys.ts
git commit -m "feat(#27): T14 — re-introduce transactionsKeys/Tags + cross-edge to accountsKeys"
```

#### T15 — apps/web base wiring (page + actions + hooks + form + section)

Create the following files (full content per template — mirror `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.tsx` for the form, and `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holdings-section.tsx` for the section shape):

1. `apps/web/src/app/(cap)/dashboard/transactions/page.tsx` — RSC page rendering `<TransactionCreateForm />` + `<TransactionsRecentSection />` inside the standard `<Section>` shell.
2. `apps/web/src/app/(cap)/dashboard/transactions/loading.tsx` — 3-row `<PekuloSkeleton>` placeholder.
3. `apps/web/src/app/(cap)/dashboard/transactions/error.tsx` — `<PekuloErrorBoundary>` consumer.
4. `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` — 3 server actions:
   ```ts
   "use server";
   import { defineAction } from "@zapaction/core";
   import {
     createTransactionInputSchema,
     updateTransactionInputSchema,
     deleteTransactionInputSchema,
     type Transaction,
   } from "@pekulo/validators";
   import { orpcClient } from "@/lib/orpc/client";
   import { ORPCError } from "@orpc/client";
   import { transactionsTags } from "@/lib/zapaction/keys";

   type Envelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

   // PER LESSONS.MD 2026-05-20: omit `output:` — discriminated envelope.
   export const createTransaction = defineAction({
     name: "createTransaction",
     input: createTransactionInputSchema,
     tags: [transactionsTags.list()],
     async handler(input): Promise<Envelope<Transaction>> {
       try {
         const tx = await orpcClient.transactions.createTransaction(input);
         return { ok: true, data: tx };
       } catch (err) {
         if (err instanceof ORPCError) {
           return { ok: false, code: err.code ?? "INTERNAL", message: err.message };
         }
         throw err;
       }
     },
   });

   export const updateTransaction = defineAction({
     name: "updateTransaction",
     input: updateTransactionInputSchema,
     tags: [transactionsTags.list()],
     async handler(input): Promise<Envelope<Transaction>> {
       try {
         const tx = await orpcClient.transactions.updateTransaction(input);
         return { ok: true, data: tx };
       } catch (err) {
         if (err instanceof ORPCError) {
           return { ok: false, code: err.code ?? "INTERNAL", message: err.message };
         }
         throw err;
       }
     },
   });

   export const deleteTransaction = defineAction({
     name: "deleteTransaction",
     input: deleteTransactionInputSchema,
     tags: [transactionsTags.list()],
     async handler(input): Promise<Envelope<{ ok: true }>> {
       try {
         await orpcClient.transactions.deleteTransaction(input);
         return { ok: true, data: { ok: true } };
       } catch (err) {
         if (err instanceof ORPCError) {
           return { ok: false, code: err.code ?? "INTERNAL", message: err.message };
         }
         throw err;
       }
     },
   });
   ```
5. `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-transactions.ts` — `useActionQuery` reading the list via `orpcClient.transactions.listTransactions({ limit: 50 })`.
6. `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-create-transaction.ts` — `useActionMutation(createTransaction, { invalidateOnSuccess: true })`.
7. `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-update-transaction.ts` — same shape.
8. `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-delete-transaction.ts` — same shape.
9. `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx` — `useAppForm` + Pekulo* primitives. Account `<PekuloSelect>` reads `useAccounts()` (existing hook from `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-accounts.ts`). Category `<PekuloSelect>` reads `TRANSACTION_CATEGORIES` + `TRANSACTION_CATEGORY_LABELS` from `@pekulo/validators`. Form-level `aria-label="Ajouter une transaction"`.
10. `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` — Section wrapping a `<ul>` of `ActivityRow` rows fed by `useTransactions().data.items`. Each row carries a kebab `MoreHorizontal` button (mobile) / inline Modifier+Supprimer buttons (desktop) per lessons.md 2026-05-17.

Run:

```bash
bun --filter=web run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/web/src/app/\(cap\)/dashboard/transactions/
git commit -m "feat(#27): T15 — transactions screen — page + actions + hooks + create form + recent section"
```

#### T16 — Edit/Delete + tests + full quality gate

Create:
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx` — modal form reusing the create-form fields; mounts via `PekuloDialog`.
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.tsx` — destructive confirm via `PekuloAlertDialog`.
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.a11y.test.tsx` — vitest-axe (mirror `account-create-form.a11y.test.tsx`).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.envelope.test.tsx` — vitest envelope-narrowing test covering the `ACCOUNT_NOT_FOUND` path:
  ```ts
  // Use vi.hoisted per lessons.md 2026-05-20
  const { createTransactionMock } = vi.hoisted(() => ({ createTransactionMock: vi.fn() }));
  vi.mock("../_actions/transactions-actions", () => ({ createTransaction: createTransactionMock }));
  // … assert ACCOUNT_NOT_FOUND envelope branch renders the inline error
  // … fireEvent.submit(getByRole("form", { name: "Ajouter une transaction" }))
  ```
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.a11y.test.tsx`.
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`.

Run the full quality gate:

```bash
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run db:rls-audit
cd apps/api && bun test
cd ../.. && bun --filter=web run typecheck
bun --filter='@pekulo/ui' run test
bun --filter=web run test
```

Expected: every command exits 0. `bun test` in apps/api shows ALL existing tests pass + the new transactions tests pass.

Push the branch:

```bash
git add apps/web/src/app/\(cap\)/dashboard/transactions/
git commit -m "feat(#27): T16 — transaction edit/delete + a11y + envelope tests + quality gate"
git push -u origin feature/27-5-1-transactions-record
```

Expected: branch pushed; PR can be opened via `gh pr create --title "feat(#27): Story 5-1 — Transactions CRUD module + manual record UI" --body "Closes #27"`.

## File List

_Targeted by this story (NEW = create, MODIFIED = edit, NOT TOUCHED = verified in step 04). `Files changed` under Dev Agent Record below is what aped-dev actually writes at execution time._

**NEW (apps/api)**

- `apps/api/prisma/migrations/<TS>_alter_transactions_prefixed_ids_and_account_fk/migration.sql`
- `apps/api/src/modules/transactions/transactions.errors.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/transactions.repository.test.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.service.test.ts`
- `apps/api/src/modules/transactions/transactions.routes.ts`
- `apps/api/src/modules/transactions/transactions.module.ts`
- `apps/api/src/modules/transactions/transactions.module.test.ts`
- `apps/api/src/modules/transactions/transactions.integration.test.ts`

**NEW (apps/web — per D1 UI scope)**

- `apps/web/src/app/(cap)/dashboard/transactions/page.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/loading.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/error.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-transactions.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-create-transaction.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-update-transaction.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-delete-transaction.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.envelope.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`

**MODIFIED**

- `apps/api/prisma/schema/transactions.prisma` (drop UUID default, add `accountId` field + relation)
- `apps/api/prisma/schema/accounts.prisma` (add `transactions Transaction[]` back-relation)
- `apps/api/src/common/errors/pekulo-error.ts` (add `TRANSACTION_NOT_FOUND` to union + Set)
- `apps/api/src/platform/http/error-mapper.ts` (add `TRANSACTION_NOT_FOUND: 404` mapping)
- `apps/api/src/modules/accounts/accounts.repository.ts` (add `accountExistsForUser`)
- `apps/api/src/modules/accounts/accounts.service.ts` (add `accountExists` delegating method)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (instantiate + mount transactionsModule)
- `packages/validators/src/transactions/transactions.schemas.ts` (replace legacy schemas with 9 new ones)
- `packages/types/src/transaction/transaction.types.ts` (re-export DTO/inputs from validators + `TransactionId` brand)
- `packages/contracts/src/transactions/transactions.contract.ts` (replace empty scaffold with 5 procedures)
- `apps/web/src/lib/zapaction/keys.ts` (re-introduce `transactionsKeys`/`transactionsTags` + cross-edges)

**NOT TOUCHED (verified at step-0)**

- `apps/api/src/database/id-prefixes.config.ts` — `Transaction: "tx"` already at line 24 (story 0-4).
- `apps/api/scripts/rls-audit.ts` — `transactions: 4` already at line 35.
- `packages/contracts/src/index.ts` — `transactionsContract` already wired into `pekuloContract`.
- `packages/types/src/transaction/index.ts` — barrel already in place.
- `packages/validators/src/transactions/index.ts` — barrel already in place.

## Dev Agent Record

- **Model:** claude-opus-4-7 (1M context)
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T02:55:00Z

### Summary

Shipped the full Transactions CRUD module end-to-end — API tier (T1-T13: migration, Prisma schema, error code, validators, types, contract, repository, service, routes, module, runtime wiring, integration tests) plus the `/dashboard/transactions` web surface (T14-T16: zapaction keys, page/loading/error, 3 server actions with discriminated envelopes, 4 ZapAction hooks, create/edit forms, delete confirm, Récentes section with kebab-mobile / inline-desktop CRUD, a11y + envelope tests). Migration applied destructively (TRUNCATE + ALTER) per D3 — RLS quartet preserved (4 policies on `transactions` confirmed via `db:rls-audit` pre- and post-flight).

### Files changed

- apps/api/prisma/migrations/20260524021837_alter_transactions_prefixed_ids_and_account_fk/migration.sql
- apps/api/prisma/schema/accounts.prisma
- apps/api/prisma/schema/transactions.prisma
- apps/api/src/bootstrap/runtime-dependencies.ts
- apps/api/src/common/errors/pekulo-error.ts
- apps/api/src/modules/accounts/accounts.integration.test.ts
- apps/api/src/modules/accounts/accounts.repository.ts
- apps/api/src/modules/accounts/accounts.service.test.ts
- apps/api/src/modules/accounts/accounts.service.ts
- apps/api/src/modules/transactions/transactions.errors.ts
- apps/api/src/modules/transactions/transactions.integration.test.ts
- apps/api/src/modules/transactions/transactions.module.test.ts
- apps/api/src/modules/transactions/transactions.module.ts
- apps/api/src/modules/transactions/transactions.repository.test.ts
- apps/api/src/modules/transactions/transactions.repository.ts
- apps/api/src/modules/transactions/transactions.routes.ts
- apps/api/src/modules/transactions/transactions.service.test.ts
- apps/api/src/modules/transactions/transactions.service.ts
- apps/api/src/platform/http/error-mapper.ts
- apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.envelope.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-create-form.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-create-transaction.ts
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-delete-transaction.ts
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-transactions.ts
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-update-transaction.ts
- apps/web/src/app/(cap)/dashboard/transactions/error.tsx
- apps/web/src/app/(cap)/dashboard/transactions/loading.tsx
- apps/web/src/app/(cap)/dashboard/transactions/page.tsx
- apps/web/src/lib/orpc/modules.ts
- apps/web/src/lib/zapaction/keys.ts
- docs/epics-context/epic-5-context.md
- docs/state.yaml
- docs/stories/5-1-transactions-record.md
- packages/contracts/src/transactions/transactions.contract.ts
- packages/types/src/transaction/transaction.types.ts
- packages/validators/src/transactions/transactions.schemas.ts

### Deviations

- **T4 — `TransactionsError.name`:** spec wrote `override readonly name = "PekuloError"` (apparent typo). Implementation uses `"TransactionsError"` to match the AccountError precedent; constructor narrows `code` from `PekuloErrorCode` to `TransactionErrorCode`. Rationale: R4 ("Existing Patterns Are Law"). No AC affected.
- **T10/T15 — `accountNotFound()` signature:** spec called it as `accountNotFound(input.accountId)`; the existing factory in `apps/api/src/modules/accounts/accounts.errors.ts` takes no args. Followed the existing signature (no arg) rather than widening it. AC-2 still satisfied (the `code` field is what surfaces on the wire).
- **T5 — `ISO_DATE_REGEX` tightened:** spec regex `/^\d{4}-\d{2}-\d{2}$/` accepted `2026-13-01` which AC-12 explicitly required to reject. Tightened to `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/` (validates month + day-of-month range; day-in-month semantics like Feb 30 still pass — out of AC-12 scope). Caught during T8 GREEN run.
- **T15 — date input:** spec implied `PekuloInput type="date"` but `PekuloInput`'s `AllowedInputType` doesn't include `"date"`. Switched to `PekuloDatePicker` (Date object + ISO conversion at submit). Same UX, better DS conformance.
- **T15 — type field:** spec implied a radio group via `PekuloRadioGroup`; the available `PekuloRadioGroup.Item` exposes no `.Indicator` subcomponent (indicator rendered internally). Switched to `PekuloSelect` for the two-option inflow/outflow choice — simpler, fully a11y-clean. Story 5-3/5-4 can revisit if a segmented control is preferred.
- **T15/T16 split:** T15 originally ended at "create form + section"; T16 had "edit/delete + tests". Since `transactions-recent-section.tsx` imports `TransactionEditForm` and `TransactionDeleteConfirm`, those two components ship in T15's commit (so the section compiles). T16 covers only the a11y/envelope tests + full quality gate.
- **T11 — typed-error rethrow:** spec showed simple `try { ... } catch (err) { throw err }`. Followed the realestate precedent (rethrow via `errors.X({ message })`) so oRPC's RPCHandler propagates typed defined-error JSON instead of masking as INTERNAL.
- **Spec artefacts (state.yaml + epic-5-context.md + story file):** bundled into T1's commit per user choice (offered the alternative of a separate `docs(#27)` commit; user picked T1 bundle).
- **T13 — integration test body shape:** error body is `{ json: { code, message, ... } }` (oRPC wraps under `json`), not flat `{ code, ... }`. Initial test assertion failed; fixed after a one-shot `console.log` probe.

### Test output

```
# API — all transactions tests (T8 + T10 + T12 + T13)
$ cd apps/api && bun test src/modules/transactions/
 23 pass / 0 fail / 56 expect() calls / 4 files / 78 ms

# API — full suite (no regression)
$ cd apps/api && bun test
 440 pass / 0 fail / 1067 expect() calls / 51 files / 1098 ms

# RLS audit (AC-7) — pre-flight + post-flight both report transactions: 4
$ bun --filter='@pekulo/api' run db:rls-audit
[rls-audit] OK — 14 tables checked: …, transactions (4 policies), …

# Web — transactions tests
$ bun --filter='@pekulo/web' run test -- src/app/(cap)/dashboard/transactions
 4 passed (4) test files / 5 passed (5) tests

# Web — full suite (no regression)
$ bun --filter='@pekulo/web' run test
 44 passed (44) test files / 77 passed (77) tests

# UI — full suite
$ bun --filter='@pekulo/ui' run test
 193 passed | 1 skipped / 194 tests

# Lint — monorepo
$ bun run lint
Found 0 warnings and 0 errors. 625 files / 158 rules

# Typecheck
$ bun --filter='@pekulo/api' run typecheck  → exit 0
$ bun --filter='@pekulo/web' run typecheck  → exit 0
```
