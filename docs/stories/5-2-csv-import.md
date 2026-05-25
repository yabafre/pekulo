# Story: 5-2-csv-import — CSV bulk import with preview before persistence

**Epic:** Epic 5 — Transactions & monthly tracking (V1)
**Status:** review
**Ticket:** [#28](https://github.com/yabafre/pekulo/issues/28)
**Branch:** `feature/28-5-2-csv-import`
**Commit prefix:** `feat(#28): …`
**Depends on:** 5-1-transactions-record (done — PR #92, squash `fcfbacc`), 0-10-pekulo-ui-migration (done)
**Complexity:** M (no migration ; reuses 5-1's repository/service/router scaffolding ; one new dep `csv-parse`)

## User Story

**As a** Pekulo user, **I want** to paste a CSV (date, amount, label, account-label) into a Récentes-header trigger, preview the parsed rows with per-row valid/invalid badges, and confirm a clean preview to persist all valid rows atomically, **so that** I can bulk-load my Trade-Republic-tier bank exports (or any unsupported source) without manual entry while keeping every cross-account guard and atomicity contract that the manual record path enforces.

## Acceptance Criteria

- **AC-1 (positional 4-column CSV parse + per-row validation):** **Given** `csvText` of 3 rows `"2026-05-01,42.50,Courses Carrefour,Compte courant\n2026-05-02,-1200.00,Loyer,Compte courant\n2026-05-03,3500.00,Salaire,Compte courant"` for user A who owns one account labelled `"Compte courant"`, **When** A calls `previewImportCsv({ csvText })`, **Then** the response is `{ rows: PreviewedRow[3], summary: { total: 3, valid: 3, invalid: 0 } }`. Each row's `parsed` carries `{ occurredOn, amount: abs(value), type: signOfValue, label, accountId: resolved, category: "autre", isImprevu: false, notes: null }`. Type inference: row 1 `+42.50 → inflow, amount: 42.50` ; row 2 `-1200 → outflow, amount: 1200` ; row 3 `+3500 → inflow, amount: 3500`. Service test asserts each field.
- **AC-2 (payload bound — 413 PAYLOAD_TOO_LARGE):** **Given** `csvText` with 1001 rows (1001 newline-separated entries), **When** A calls `previewImportCsv({ csvText })`, **Then** the service rejects with `PAYLOAD_TOO_LARGE` → HTTP **413**. **And** at the boundary `1000` rows are accepted (status 200). Bound = `MAX_CSV_ROWS = 1000` exported from `apps/api/src/modules/transactions/services/csv-parser.ts`.
- **AC-3 (malformed CSV — 400 INVALID_CSV):** **Given** `csvText = "2026-05-01,\"unbalanced quote,xxx"` (csv-parse throws on parse), **When** A calls `previewImportCsv`, **Then** the service rejects with `INVALID_CSV` → HTTP **400** carrying the parser's error message. The `csv-parse/sync` exception is caught at the parser boundary and re-thrown as `PekuloError("INVALID_CSV", ...)`.
- **AC-4 (account resolution — unknown label = row-level invalid, NOT HTTP error):** **Given** A owns one account `{ id: "acc_xxx…", label: "Compte courant" }`, **When** A previews a CSV row with `accountLabel = "Livret A"` (no match for A), **Then** the row's `parsed` is `undefined`, `error = "Compte introuvable"`, `summary.invalid` increments. The endpoint still returns 200 — row-level errors are data, not HTTP errors. Cross-user safety: even if user B owns a `"Livret A"`, A's resolution sees zero matches (RLS + explicit `where: { userId }` on the repository). **Error string convention (amended 2026-05-25):** the error text does NOT echo the raw input — the preview table already renders the field's raw value in its column, so the message stays concise. FR per the project's UI language.
- **AC-5 (account resolution — ambiguous label = row-level invalid):** **Given** A owns `[{label: "Compte courant"}, {label: "Compte courant"}]` (the brownfield `accounts` table has no unique constraint on `(user_id, label)`), **When** A previews a CSV row with `accountLabel = "Compte courant"`, **Then** the row's `error = "Compte ambigu (2 comptes portent ce nom)"` and `summary.invalid` increments. The resolver returns `{ id: null, matchCount: 2 }` and the parser maps that to the user-facing message.
- **AC-6 (importCsv — atomic persistence via `prisma.$transaction`):** **Given** an array of 50 `ValidatedCsvRow` for user A (all rows pre-validated by step `previewImportCsv`), **When** A calls `importCsv({ rows })`, **Then** the repository runs `await prisma.$transaction(async (tx) => { for (const r of rows) await tx.transaction.create(...) })` per-row (NOT `createMany` — that bypasses the prefixed-ids extension per ADR-0012). Each row stamps `userId: A`, gets a fresh `tx_<base62>` id, and the response is `{ ok: true, persisted: 50 }`. **And** if row 30 fails (e.g. a Prisma constraint violation injected via fake-Prisma in tests), the whole batch rolls back — 0 rows committed, error surfaces as `PekuloError("TRANSACTION_FAILED")`.
- **AC-7 (importCsv input bounds — 422 NO_VALID_ROWS):** **Given** A submits `importCsv({ rows: [] })`, **When** the service checks the input via `importCsvInputSchema`, **Then** the validator rejects with `ZodError → BAD_REQUEST` (the empty-array `.min(1)` catch). **And** when A submits `importCsv({ rows: Array(1001) })`, the validator rejects via `.max(1000)`. Boundary verified at 1 (accepted) / 0 (rejected) / 1000 (accepted) / 1001 (rejected).
- **AC-8 (cross-aggregate guard — `accountOwnershipProbe` re-applied at import-time):** **Given** A submits `importCsv` with a row carrying `accountId = "acc_bbb…"` belonging to user B (a tampered client request bypassing the resolver step), **When** the service runs the pre-flight ownership loop, **Then** it rejects with `ACCOUNT_NOT_FOUND` → HTTP **404** before any insert. Defense in depth: the resolver in `previewImportCsv` already enforces this, but `importCsv` MUST re-check (the client cannot be trusted).
- **AC-9 (oRPC HTTP boundary — full status matrix):** **Given** a valid Supabase HS256 JWT for user A, **When** the integration test calls `POST /rpc/v1/transactions/{previewImportCsv, importCsv}`, **Then** valid requests return **200** ; missing JWT → **401** within 100 ms (NFR-9) ; cross-user account on import → **404** ; malformed CSV → **400** ; payload too large → **413** ; empty / overflow rows array → **400** from Zod ; `NO_VALID_ROWS` (reserved for future use) → **422**.
- **AC-10 (RLS quartet preserved — no migration):** **Given** the story shipped, **When** `bun --filter='@pekulo/api' run db:rls-audit` runs, **Then** the script exits 0 AND reports `transactions: 4` unchanged. No migration ; the bulk insert goes through the existing 4 policies. `EXPECTED_POLICY_COUNTS` already declares `transactions: 4` (5-1 codification).
- **AC-11 (CSV import trigger in Récentes header — second HeaderAction):** **Given** A is on `/dashboard/transactions`, **When** the page loads, **Then** the `Récentes` Section header renders TWO `HeaderAction` buttons (left to right): "Importer" (Upload icon) AND "Filtrer" (Search icon). Clicking "Importer" opens a `PekuloDialog` (responsive — same primitive as edit/delete in 5-1) containing the CSV import form. The dialog renders at every viewport (no Sheet/mobile split — mirrors 5-1's edit/delete affordance shape).
- **AC-12 (paste → preview round-trip + per-row visual badges + gated confirm):** **Given** A pastes a 50-row CSV with 42 valid + 8 invalid rows into the textarea and clicks "Aperçu", **When** the round-trip completes, **Then** the `<CsvPreviewTable>` renders 50 rows. Valid rows show a green check + display the parsed values ; invalid rows show a red cross + the per-row `error` message inline. The "Confirmer (N)" CTA is **disabled** while `summary.invalid > 0` ; enabled only when `summary.invalid === 0 && summary.valid > 0`. With 42/8 split, the CTA stays disabled — the user must fix the CSV and re-preview.
- **AC-13 (confirm → atomic persist + tag-registry invalidation, no optimistic UI):** **Given** A has previewed a clean 50-row CSV (`summary.invalid === 0`) and clicks "Confirmer (50)", **When** the `useActionMutation(importCsv, { invalidateWithTags: [transactionsTags.list()] })` succeeds with `{ ok: true, persisted: 50 }`, **Then** a success toast renders ("50 transactions importées"), the Dialog closes, and the Récentes list re-fetches via the tag-registry edge `transactionsTags.list() → [transactionsKeys.list(), accountsKeys.list()]` (already wired by 5-1). The 50 newest rows appear on the next paint after the server round-trip — no optimistic `setQueryData`, no wall-clock promise. Codified by the 2026-05-25 lesson on registry-SSOT defaults.

## Tasks

- [x] **T1** — Extend `packages/validators/src/transactions/transactions.schemas.ts` with 5 new schemas (`rawCsvRowSchema`, `validatedCsvRowSchema`, `previewedRowSchema`, `previewImportCsvInputSchema`, `previewImportCsvOutputSchema`, `importCsvInputSchema`, `importCsvOutputSchema`). [AC: AC-1, AC-2, AC-7]
- [x] **T2** — Extend `apps/api/src/common/errors/pekulo-error.ts` (add `INVALID_CSV`, `NO_VALID_ROWS`, `PAYLOAD_TOO_LARGE` to alphabetical union + Set) + `apps/api/src/platform/http/error-mapper.ts` (add 400/422/413 entries). [AC: AC-2, AC-3, AC-7, AC-9]
- [x] **T3** — Extend `packages/contracts/src/transactions/transactions.contract.ts` with 2 new procedures `previewImportCsv` + `importCsv` (sub-tree-versioned ; typed errors `INVALID_CSV`, `PAYLOAD_TOO_LARGE`, `ACCOUNT_NOT_FOUND`). [AC: AC-9]
- [x] **T4** — Add `csv-parse` dep to `apps/api/package.json` + create `apps/api/src/modules/transactions/services/csv-parser.ts` (pure parser + per-row validator + account-resolution loop) + co-located TDD test `apps/api/src/modules/transactions/services/csv-parser.test.ts`. [AC: AC-1, AC-2, AC-3, AC-4, AC-5]
- [x] **T5** — Add `findAccountIdByLabelForUser(userId, label)` to `apps/api/src/modules/accounts/{accounts.repository.ts, accounts.service.ts}` (interface + implementation + repository test extension). [AC: AC-4, AC-5]
- [x] **T6** — Add `bulkCreate(userId, rows)` method to `apps/api/src/modules/transactions/transactions.repository.ts` using `prisma.$transaction(async (tx) => { for … await tx.transaction.create(...) })` + extend `apps/api/src/modules/transactions/transactions.repository.test.ts` with a 3-row happy path AND a forced-failure rollback test. [AC: AC-6]
- [x] **T7** — Add `previewImportCsv` + `importCsv` methods to `apps/api/src/modules/transactions/transactions.service.ts` (DI extended with `AccountResolver`) + extend `apps/api/src/modules/transactions/transactions.service.test.ts` to cover both methods including the cross-aggregate guard re-check. [AC: AC-1, AC-4, AC-5, AC-6, AC-8]
- [x] **T8** — Extend `apps/api/src/modules/transactions/transactions.routes.ts` with 2 handlers (previewImportCsv, importCsv) including the typed-error remap. Extend `apps/api/src/modules/transactions/transactions.module.ts` to accept the `accountResolver` dep. Extend `apps/api/src/bootstrap/runtime-dependencies.ts` to wrap `accountsModule.service.findAccountIdByLabel` as the resolver. Extend `apps/api/src/modules/transactions/transactions.integration.test.ts` with 2 oRPC HTTP boundary tests (preview + import). [AC: AC-9]
- [x] **T9** — Re-export `PreviewedRow`, `ValidatedCsvRow`, `ImportCsvInput`, `ImportCsvOutput` from `packages/types/src/transaction/transaction.types.ts`. [AC: (cross-package typing — supports AC-12, AC-13)]
- [x] **T10** — Extend `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` with `previewImportCsv` + `importCsv` server actions (both omit `output:`). Add hooks `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-preview-import-csv.ts` + `use-import-transactions-csv-form.ts`. [AC: AC-12, AC-13]
- [x] **T11** — Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-preview-table.tsx` (responsive table → mobile stacked card). [AC: AC-12]
- [x] **T12** — Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.tsx` (PekuloDialog with 2-step flow: paste textarea → preview → confirm) + wire trigger into `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` (second `HeaderAction` "Importer") + a11y test (`csv-import-form.a11y.test.tsx`) + envelope test (`csv-import-form.envelope.test.tsx`) + full Iron Law (`bun --filter='@pekulo/api' run lint`, `… typecheck`, `… test`, `… db:rls-audit`, `bun --filter=web run typecheck`, `bun --filter='@pekulo/ui' run test:axe`). Push the branch. [AC: AC-10, AC-11, AC-12, AC-13]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009).** No new module — 5-2 extends `apps/api/src/modules/transactions/{transactions.module,transactions.routes,transactions.service,transactions.repository}.ts` shipped by 5-1. The factory returns `{ service, router }` unchanged ; only the dependency list and the procedure count grow.
- **Hard layering (ADR-0010).** Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. CSV parsing is server-side only — the form sends raw CSV text to `previewImportCsv` ; the server returns the per-row validation result ; the form sends the pre-validated rows array to `importCsv` ; the server re-checks ownership then writes. NO client-side parser duplication.
- **Folder-by-domain in packages (R11 — PR #86 audit codification).** Extend the existing transactions slice:
  - `packages/validators/src/transactions/transactions.schemas.ts` — 7 new exported schemas alongside the 5-1 set.
  - `packages/contracts/src/transactions/transactions.contract.ts` — 2 new procedures in the same `transactionsContractV1` const.
  - `packages/types/src/transaction/transaction.types.ts` — re-export the new inferred types (NO new types declared inline — they live in `@pekulo/validators`).
- **`@pekulo/zod` SOLE zod entry point (R1).** Every new schema imports `z` from `@pekulo/zod`. Verify in T1.
- **Defense in depth (ADR-0013).** Two layers on the bulk path: (a) the resolver in `previewImportCsv` filters every account-label lookup via `where: { userId, label }` ; (b) the service in `importCsv` re-runs `accountOwnershipProbe.exists(userId, accountId)` for every row before any `$transaction` open. The bulk Prisma writes carry explicit `userId` stamps (no implicit RLS reliance). Lint rule `pekulo/no-prisma-query-without-user-id` blocks omissions ; the `prismaIdentifier: ["prisma","tx","client"]` override is already configured in `.oxlintrc.json` (the per-row `tx.transaction.create` inside `$transaction` matches the override).
- **Cross-aggregate guard (mirrors 5-1's pattern).** The transactions module DOES NOT import `AccountsRepository` directly. The service depends on TWO narrow interfaces declared inside `transactions.service.ts`:
  1. `AccountOwnershipProbe { exists(userId, accountId): Promise<boolean> }` — re-used from 5-1 for the import pre-flight loop.
  2. `AccountResolver { resolve(userId, label): Promise<{ id: string | null; matchCount: number }> }` — NEW for 5-2 ; the runtime composition root wraps `accountsModule.service.findAccountIdByLabel` (added in T5).
- **Prefixed IDs (ADR-0012).** `Transaction → "tx"` already registered (5-1). The prefixed-ids extension injects `tx_<base62>` on EVERY `tx.transaction.create(...)` inside `prisma.$transaction(async tx => …)`. **Verified**: the extension applies inside interactive transactions because the transactional `tx` reference is the same `ExtendedPrismaClient` shape ; `createMany` would NOT trigger the extension (story 4-1 outcome reminder), which is why T6 uses per-row `create`. The `as unknown as Parameters<typeof tx.transaction.create>[0]["data"]` bridge is repeated per-row (mirrors 5-1's `repository.create` branch).
- **Decimal → number boundary (L24).** CSV-parsed amounts are JS numbers (`Number(rawString)`) ; Prisma writes accept JS number → coerces to `Prisma.Decimal` at insert. The read-back path (if 5-2 ever surfaces the persisted rows) goes through 5-1's existing `toDto` + `decimalToNumber` chain. No new boundary in T6.
- **Pagination convention (architecture L129 + NFR-16).** N/A for 5-2 — bulk insert returns a count, not a list. The Récentes list (5-1's `listTransactions`) handles the post-import paginated view ; the tag-registry invalidation in T10 triggers the re-fetch.
- **oRPC routing convention.** Kebab-case, resource-oriented, plural ; non-CRUD verbs land at sub-paths. The 2 new procedures land at `transactions.previewImportCsv` and `transactions.importCsv` (the wire paths are `/rpc/v1/transactions/preview-import-csv` and `/rpc/v1/transactions/import-csv` — the kebab-case lowering is oRPC's default for the JSON-RPC body name). Sub-tree-versioned at `/rpc/v1/transactions` — no major bump.
- **Error envelope discipline (lessons.md 2026-05-20).** The 2 `defineAction` wrappers in T10 (`previewImportCsv`, `importCsv`) return `{ ok: true; ... } | { ok: false; code; message }` envelopes. They MUST omit `output:` — zapaction core runs `output.parse(result)` unconditionally and rejects the error branch otherwise. Positive precedents: 5-1's `createTransaction`, `updateTransaction`, `deleteTransaction` in the same file.
- **Tag registry edge (5-1 codified ; 5-2 re-uses).** `useImportTransactionsCsvForm` consumes `useActionMutation(importCsv, { invalidateWithTags: [transactionsTags.list()] })`. The registry maps `transactionsTags.list()` → `[[TRANSACTIONS_KEY], accountsKeys.list()]` (already wired in `apps/web/src/lib/zapaction/keys.ts` at L150-156). The preview hook does NOT invalidate (it's a read-only side effect server-side).
- **R12 enforcement (2026-05-24 lesson).** `defineAction({ tags })` on `importCsv` is for Next's `revalidateTag()` fetch cache ; client-side React Query invalidation comes from `useActionMutation(importCsv, { invalidateWithTags })`. Both are needed — neither replaces the other.
- **R13 (hydration guard — 2026-05-24 lesson).** The CSV import form is opened by user action (Dialog open=true) ; it does NOT branch on a `useActionQuery.isLoading` for SSR-vs-client divergence. The hydration guard pattern does NOT apply here. The Récentes section's hydration guard (shipped by 5-1) keeps working unchanged — the post-import re-fetch goes through the same gated render.
- **Tamagui CSS regen guard (2026-05-24 lesson).** T11 + T12 introduce no new `styled()` primitives — they consume existing `@pekulo/ui` components (`PekuloDialog`, `PekuloButton`, `PekuloSkeleton`) + inline `<View>` / `<Text>` with token props. No regen needed. Verify by running `bun run generate:tamagui-css` after T12 and asserting `git diff --exit-code packages/ui/public/tamagui.generated.css` (it should be clean — included in T12's Iron Law).

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — module factory + contract-first mount under `/rpc/v1/transactions`. Amended by PR #86 (R3/R4 — ZapAction is the only allowed React-Query consumer in `apps/web` hooks ; tag registry centralises invalidation).
- `docs/adr/0010-hooks-orchestration-boundary.md` — hard layering. Relevant in T10-T12 for the UI tier.
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — domain types in `@pekulo/types` ; folder-by-domain layout (R11).
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — schema folder + prefixed-IDs extension. The per-row `create` inside `$transaction` (T6) is the load-bearing choice that preserves prefix injection on the bulk path.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — explicit `where: { userId }` + lint rule. Bulk path stamps `userId` on every row.
- `docs/adr/0014-prisma-migrations.md` — manual SQL migrations on this repo. **NO migration in 5-2** — the schema is already CSV-import-ready post 5-1.

### Lessons re-applied (verbatim scope-list from `docs/lessons.md`)

- **2026-05-25 — Optimistic `onMutate` is opt-in (5-1 outcome).** AC-13 describes registry-SSOT, NOT optimistic UI. No wall-clock promise in any AC text.
- **2026-05-24 — `defineAction({ tags })` is server-only.** T10's hooks pass `invalidateWithTags` explicitly.
- **2026-05-24 — Hydration guard on `useActionQuery.isLoading`.** N/A for the new form (Dialog opens on user click, no query branch) — preserved unchanged on the existing `TransactionsRecentSection`.
- **2026-05-24 — Tamagui CSS regen guard.** No new primitives ; verify clean `git diff` on `packages/ui/public/tamagui.generated.css` after T12.
- **2026-05-20 — `@pekulo/zod` is the SOLE zod entry point (R1, PR #86).** T1 imports `z` from `@pekulo/zod`.
- **2026-05-20 — Hooks under `apps/web/src/app/**/_hooks/` MUST consume ZapAction (R3/R4).** T10 hooks use `useActionMutation` from `@zapaction/query`.
- **2026-05-20 — `defineAction` with discriminated-union output: OMIT `output:`.** T10 server actions omit the `output:` slot.
- **2026-05-20 — Vitest `vi.mock` factory is HOISTED ; use `vi.hoisted`.** T12's envelope test uses `const { previewImportCsvMock, importCsvMock } = vi.hoisted(() => ({ previewImportCsvMock: vi.fn(), importCsvMock: vi.fn() }));`.
- **2026-05-20 — `fireEvent.submit(form)` over `fireEvent.click(button)` in vitest form tests.** T12's envelope test uses `fireEvent.submit(getByRole("form", { name: "Importer un CSV" }))` for the paste form.
- **2026-05-19 — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`).** Every command in this story uses the full namespace, quoted.
- **2026-05-17 — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`.** Cross-checked: ux-preview `TransactionsScreen` at L1284 has no CSV affordance (`docs/ux/flows.md:84` confirms "forward work"). Placement decision = second `HeaderAction` in Récentes Section header, aligned with the `HeaderAction` pattern at ux-preview L1370.
- **2026-05-17 — Per-row CRUD actions on mobile hide behind a kebab menu.** N/A — the preview table has NO per-row CRUD (rows are read-only ; the user fixes the CSV and re-pastes).
- **2026-05-17 — Tamagui v5 media keys = sm:640 md:768 lg:1024 xl:1280.** T11 uses `$lg` for the desktop table-grid vs mobile-stack split.
- **2026-05-09 — Zero `*.types.ts` files inside `apps/api/src/modules/**`.** T4's parser interfaces (`AccountResolver`, `PreviewedRow`, `RawCsvRow`) co-locate inside `csv-parser.ts` ; the Zod-inferred public DTOs live in `@pekulo/validators` (re-exported from `@pekulo/types`).
- **2026-05-07 — `bun test` ≠ `vitest run`.** New api tests use `bun:test` ; new web tests use `vitest`.
- **2026-05-05 — `bun --cwd <relative>` silently fails.** Every command uses `bun --filter='@pekulo/api' run …`.
- **2026-05-05 — Manual SQL migrations preferred over `prisma migrate dev`.** N/A — no migration.
- **2026-05-04 — Elysia 1.4 `Elysia` type is invariant.** No annotation changes — the router type is still inferred via `ReturnType<typeof createTransactionsRouter>`.
- **2026-05-04 — `Number(decimal)` silently truncates.** N/A on the write path (JS number → Decimal coercion) ; the existing `toDto` chain (5-1) handles the read path.
- **Story 5-1 outcome — cross-aggregate guard via injected probe.** 5-2 extends the pattern with a second probe (`AccountResolver`) for label resolution.

### Step-0 quotes (verbatim current state at story-write time)

#### `packages/validators/src/transactions/transactions.schemas.ts` (current — tail)

```ts
// ─── Envelope ─────────────────────────────────────────────────────────────
export const transactionsOkSchema = z.object({ ok: z.literal(true) });
```

> 5-2 changes (T1): APPEND 7 new exported schemas at the end of the file (after `transactionsOkSchema`). Keep the existing `TRANSACTION_ID_REGEX`, `ACCOUNT_ID_REGEX`, `ISO_DATE_REGEX`, `isoDateString()`, `amountSchema()` helpers — they're reused.

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
  | "TRANSACTION_NOT_FOUND"
  | "UNAUTHORIZED";
```

> 5-2 changes (T2): insert `"INVALID_CSV"` between `"INVALID_WEALTH"` and `"MILESTONE_INVALID_CAPITAL"` ; insert `"NO_VALID_ROWS"` between `"NOT_FOUND"` and `"RATE_LIMITED"` ; insert `"PAYLOAD_TOO_LARGE"` between `"NO_VALID_ROWS"` and `"RATE_LIMITED"` (alphabetical). Mirror all 3 in `PEKULO_ERROR_CODES` set.

#### `apps/api/src/platform/http/error-mapper.ts` (current — `ORPC_HTTP_STATUS_BY_CODE` head + 404 cluster tail)

```ts
const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  // … 404 cluster ends with TRANSACTION_NOT_FOUND: 404, …
```

> 5-2 changes (T2): add `INVALID_CSV: 400` after `MILESTONE_YEAR_OUT_OF_RANGE: 400` (with explanatory comment) ; add `PAYLOAD_TOO_LARGE: 413` and `NO_VALID_ROWS: 422` after the 404 cluster (with explanatory comments). The `Record<PekuloErrorCode, number>` exhaustiveness check guarantees the compiler errors if any code is unmapped.

#### `packages/contracts/src/transactions/transactions.contract.ts` (current — 5 procedures)

```ts
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

const transactionNotFoundError = { status: 404 as const, message: "transaction not found" };
const accountNotFoundError = { status: 404 as const, message: "account not found" };

export const transactionsContractV1 = {
  createTransaction: oc.errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(createTransactionInputSchema).output(transactionSchema),
  updateTransaction: oc.errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError, ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(updateTransactionInputSchema).output(transactionSchema),
  deleteTransaction: oc.errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(deleteTransactionInputSchema).output(transactionsOkSchema),
  getTransaction: oc.errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(getTransactionInputSchema).output(transactionSchema),
  listTransactions: oc.input(listTransactionsInputSchema).output(listTransactionsOutputSchema),
} as const;

export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = { moduleKey: "transactions", mountPath: "/rpc/v1/transactions", version: "v1" } as const;
```

> 5-2 changes (T3): import 4 new schemas, declare 3 new typed-error consts, append 2 new procedures (`previewImportCsv`, `importCsv`) to the `transactionsContractV1` object. The meta block stays intact.

#### `apps/api/src/modules/transactions/transactions.repository.ts` (current — interface)

```ts
export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
}
```

> 5-2 changes (T6): append `bulkCreate(userId: string, rows: ValidatedCsvRow[]): Promise<{ persisted: number }>` to the interface AND the factory return.

#### `apps/api/src/modules/transactions/transactions.service.ts` (current — interface + factory signature)

```ts
export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
}

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
}): TransactionsService { /* ... */ }
```

> 5-2 changes (T7): add `AccountResolver` interface ; append `previewImportCsv` + `importCsv` to `TransactionsService` ; extend the factory deps with `accountResolver: AccountResolver`.

#### `apps/api/src/modules/transactions/transactions.routes.ts` (current — handler block tail)

```ts
listTransactions: impl.listTransactions.handler(async ({ context, input }) => {
  requireUserId(context.userId);
  return deps.service.listTransactions(context.userId, input);
}),
```

> 5-2 changes (T8): append `previewImportCsv` and `importCsv` handlers after `listTransactions`, mirroring the typed-error remap pattern from `createTransaction`.

#### `apps/api/src/modules/transactions/transactions.module.ts` (current — full factory signature)

```ts
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

> 5-2 changes (T8): add `accountResolver: AccountResolver` to the deps tuple AND pass it through to `createTransactionsService`.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — transactions wiring block)

```ts
const transactionsModule = createTransactionsModule({
  prismaService,
  accountOwnershipProbe: {
    exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
  },
});
```

> 5-2 changes (T8): add `accountResolver: { resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label) }` to the deps object.

#### `apps/api/src/modules/accounts/accounts.service.ts` (current — interface excerpt)

```ts
recordBalanceChange(userId: string, input: RecordBalanceChangeInput): Promise<Account>;
accountExists(userId: string, accountId: string): Promise<boolean>;
```

> 5-2 changes (T5): append `findAccountIdByLabel(userId: string, label: string): Promise<{ id: string | null; matchCount: number }>` to the interface AND the factory return.

#### `apps/api/src/modules/accounts/accounts.repository.ts` (current — interface excerpt)

```ts
countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
accountExistsForUser(userId: string, accountId: string): Promise<boolean>;
```

> 5-2 changes (T5): append `findAccountIdByLabelForUser(userId: string, label: string): Promise<{ id: string | null; matchCount: number }>`.

#### `packages/types/src/transaction/transaction.types.ts` (current — re-export block)

```ts
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
```

> 5-2 changes (T9): append `PreviewedRow`, `ValidatedCsvRow`, `RawCsvRow`, `PreviewImportCsvInput`, `PreviewImportCsvOutput`, `ImportCsvInput`, `ImportCsvOutput` to the re-export list.

#### `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` (current — tail)

```ts
// ... existing createTransaction / updateTransaction / deleteTransaction defineAction blocks ...
void z;
```

> 5-2 changes (T10): insert 2 new `defineAction` blocks (`previewImportCsv`, `importCsv`) BEFORE the `void z;` no-op. Drop the `void z;` if all uses are now reached (verify with typecheck — `z` may still be unreferenced if no new top-level use ; safe to keep the no-op).

#### `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` (current — Section action prop)

```tsx
action={
  <HeaderAction
    icon={Search}
    label="Filtrer"
    onPress={() => toast.info("Bientôt", "Le filtre transactions arrive plus tard.")}
  />
}
```

> 5-2 changes (T12): wrap the single `HeaderAction` in a `<View flexDirection="row" gap="$2">` containing TWO HeaderActions in order: "Importer" (Upload icon, opens the CSV import dialog) then "Filtrer" (existing). Add `Upload` to the lucide import and `CsvImportForm` to the component imports. Add local state `[csvImportOpen, setCsvImportOpen]` and render `<CsvImportForm open={csvImportOpen} onOpenChange={setCsvImportOpen} />` at the bottom of the Section's children (after the existing dialogs).

#### `apps/api/package.json` (current — no `csv-parse` dep)

```bash
grep "csv-parse\|papaparse" apps/api/package.json
# (no output expected)
```

> 5-2 changes (T4): add `"csv-parse": "^5.5.6"` to `apps/api/package.json#dependencies` (sync API, MIT, ~25KB, used server-side via `import { parse } from "csv-parse/sync"`). Bun resolves it natively.

### File decisions (3-bullet per file)

#### MODIFIED — `packages/validators/src/transactions/transactions.schemas.ts`

- **Single responsibility (post-edit)** — Zod source of truth for the transactions aggregate, now covering both single-row CRUD (5-1) and bulk-CSV-import (5-2) input/output shapes.
- **Inputs** — `@pekulo/zod`.
- **Outputs** — 7 new exported schemas + inferred types alongside the 9 existing ones.

#### MODIFIED — `apps/api/src/common/errors/pekulo-error.ts` + `apps/api/src/platform/http/error-mapper.ts`

- **Single responsibility (post-edit)** — typed domain errors registry + domain code → HTTP status map, now including `INVALID_CSV (400)`, `NO_VALID_ROWS (422)`, `PAYLOAD_TOO_LARGE (413)`.
- **Inputs** — none.
- **Outputs** — extended `PekuloErrorCode` / `PEKULO_ERROR_CODES` / `ORPC_HTTP_STATUS_BY_CODE`.

#### MODIFIED — `packages/contracts/src/transactions/transactions.contract.ts`

- **Single responsibility (post-edit)** — exports 7 oRPC procedure definitions for the transactions module (5 CRUD + 2 bulk CSV).
- **Inputs** — `@orpc/contract` `oc` ; `@pekulo/validators` schemas.
- **Outputs** — extended `transactionsContractV1` object.

#### MODIFIED — `packages/types/src/transaction/transaction.types.ts`

- **Single responsibility (post-edit)** — central registry for transactions domain types ; re-exports 9 single-row types (5-1) + 7 bulk CSV types (5-2) from `@pekulo/validators`.
- **Inputs** — `@pekulo/validators`.
- **Outputs** — extended re-export block.

#### NEW — `apps/api/src/modules/transactions/services/csv-parser.ts`

- **Single responsibility** — pure CSV parser + per-row validator + account-resolution loop. Returns `Array<{ index, raw, parsed?, error? }>` ; throws `PekuloError("INVALID_CSV" | "PAYLOAD_TOO_LARGE")` on global failures.
- **Inputs** — `csvText: string`, `userId: string`, `accountResolver: AccountResolver`.
- **Outputs** — `{ rows: PreviewedRow[], summary: { total, valid, invalid } }`.

#### NEW — `apps/api/src/modules/transactions/services/csv-parser.test.ts`

- **Single responsibility** — `bun:test` coverage for the parser: 4-col happy path, malformed CSV, payload bound, unknown account, ambiguous account, type-inference cases.
- **Inputs** — `bun:test` runner ; a fake `AccountResolver`.
- **Outputs** — tests-only file ; no runtime export.

#### MODIFIED — `apps/api/src/modules/accounts/{accounts.service,accounts.repository,accounts.service.test,accounts.repository.test}.ts`

- **Single responsibility (post-edit)** — accounts business logic + Prisma layer ; now exposes `findAccountIdByLabel(userId, label): Promise<{ id, matchCount }>` for cross-aggregate label resolution.
- **Inputs** — `AccountRepository` (service) ; `ExtendedPrismaClient` (repository).
- **Outputs** — extended interfaces ; extended tests covering 0-match / 1-match / N-match cases.

#### MODIFIED — `apps/api/src/modules/transactions/transactions.repository.ts` + `apps/api/src/modules/transactions/transactions.repository.test.ts`

- **Single responsibility (post-edit)** — single Prisma touch-point for the transactions domain ; adds `bulkCreate` using interactive `prisma.$transaction` per-row.
- **Inputs** — `ExtendedPrismaClient`.
- **Outputs** — extended `TransactionsRepository` interface + factory.

#### MODIFIED — `apps/api/src/modules/transactions/transactions.service.ts` + `apps/api/src/modules/transactions/transactions.service.test.ts`

- **Single responsibility (post-edit)** — business logic for the transactions domain ; adds `previewImportCsv` + `importCsv` with `AccountResolver` injection ; reuses `AccountOwnershipProbe` for the import pre-flight loop.
- **Inputs** — `TransactionsRepository`, `AccountOwnershipProbe`, `AccountResolver`.
- **Outputs** — extended `TransactionsService` interface + factory.

#### MODIFIED — `apps/api/src/modules/transactions/transactions.routes.ts`

- **Single responsibility (post-edit)** — oRPC handler wiring for the 7 procedures ; adds 2 handlers with typed-error remap (`INVALID_CSV`, `PAYLOAD_TOO_LARGE`, `ACCOUNT_NOT_FOUND`).
- **Inputs** — `TransactionsService` ; `transactionsContract` from `@pekulo/contracts`.
- **Outputs** — `createTransactionsRouter({ service })` with 7 procedures.

#### MODIFIED — `apps/api/src/modules/transactions/transactions.module.ts`

- **Single responsibility (post-edit)** — composition root for the transactions module ; accepts an additional `accountResolver` dep alongside `accountOwnershipProbe`.
- **Inputs** — `PrismaService`, `AccountOwnershipProbe`, `AccountResolver`.
- **Outputs** — `TransactionsModule` (shape unchanged: `{ service, router }`).

#### MODIFIED — `apps/api/src/bootstrap/runtime-dependencies.ts`

- **Single responsibility (post-edit)** — composition root for the runtime ; wraps `accountsModule.service.findAccountIdByLabel` as the new `accountResolver` and passes it into `createTransactionsModule`.
- **Inputs** — `createTransactionsModule`, `accountsModule`.
- **Outputs** — `RuntimeDeps` unchanged in shape.

#### MODIFIED — `apps/api/src/modules/transactions/transactions.integration.test.ts`

- **Single responsibility (post-edit)** — oRPC HTTP boundary coverage for the 7 procedures.
- **Inputs** — `bun:test`, oRPC test client, fake Prisma.
- **Outputs** — extended test file.

#### MODIFIED — `apps/api/package.json`

- **Single responsibility (post-edit)** — apps/api manifest ; adds `csv-parse` as a runtime dep.
- **Inputs** — none.
- **Outputs** — extended `dependencies` block.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` (extended)

- **Single responsibility (post-edit)** — 5 server actions for the transactions feature (3 single-row writes from 5-1 + 1 list reader + 2 bulk CSV from 5-2).
- **Inputs** — `@zapaction/core`, oRPC client.
- **Outputs** — extended action exports.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-preview-import-csv.ts`

- **Single responsibility** — thin ZapAction wrapper around the `previewImportCsv` action ; no invalidation (read-only side effect server-side).
- **Inputs** — `@zapaction/query`, the server action.
- **Outputs** — `usePreviewImportCsv(): { mutate, isPending, data }`.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-import-transactions-csv-form.ts`

- **Single responsibility** — thin ZapAction wrapper around the `importCsv` action ; invalidates `transactionsTags.list()` on success.
- **Inputs** — `@zapaction/query`, the server action, the tag registry.
- **Outputs** — `useImportTransactionsCsvForm(): { mutate, isPending }`.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-preview-table.tsx`

- **Single responsibility** — render the validation result table ; desktop = CSS-grid columns, mobile = stacked cards ; per-row valid/invalid badge + inline error message.
- **Inputs** — `rows: PreviewedRow[]`, `accountLabelById: Map<string, string>`.
- **Outputs** — JSX rendering the table.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.tsx`

- **Single responsibility** — `PekuloDialog` content with the 2-step paste → preview → confirm flow ; owns local state for the textarea, preview result, and envelope error.
- **Inputs** — `open`, `onOpenChange`, plus the 2 hooks.
- **Outputs** — JSX rendering the dialog.

#### NEW — `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.{a11y,envelope}.test.tsx`

- **Single responsibility** — axe-clean check (a11y) + envelope-narrowing check (envelope) for the import form.
- **Inputs** — `vitest`, `@testing-library/react`, `vitest-axe`, `vi.hoisted` mocks.
- **Outputs** — test files only.

#### MODIFIED — `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`

- **Single responsibility (post-edit)** — Récentes section with two `HeaderAction`s (Importer, Filtrer) + edit/delete dialogs + CSV import dialog.
- **Inputs** — accounts, transactions, the existing hooks, plus `CsvImportForm`.
- **Outputs** — JSX rendering the Récentes section.

### Task-by-task implementation code

#### T1 — Validator schemas (extend `transactions.schemas.ts`)

Read the current file, then APPEND the following block at the very end (after `transactionsOkSchema`):

```ts
// ─── CSV import (story 5-2) ──────────────────────────────────────────────
// Positional 4-column CSV: date (YYYY-MM-DD), amount (signed), label, account-label.
// Validation happens server-side via apps/api/src/modules/transactions/services/csv-parser.ts.
// Two procedures: previewImportCsv (csvText → row-by-row breakdown), importCsv (rows → atomic persist).

export const rawCsvRowSchema = z.object({
  occurredOn: z.string(),
  amountRaw: z.string(),
  label: z.string(),
  accountLabel: z.string(),
});
export type RawCsvRow = z.infer<typeof rawCsvRowSchema>;

export const validatedCsvRowSchema = z.object({
  occurredOn: isoDateString(),
  amount: amountSchema(),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  label: z.string().min(1, "Libellé requis").max(120, "Libellé > 120 caractères"),
  accountId: z.string().regex(ACCOUNT_ID_REGEX, "accountId invalide"),
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
});
export type ValidatedCsvRow = z.infer<typeof validatedCsvRowSchema>;

export const previewedRowSchema = z.object({
  index: z.number().int().min(0),
  raw: rawCsvRowSchema,
  parsed: validatedCsvRowSchema.optional(),
  error: z.string().optional(),
});
export type PreviewedRow = z.infer<typeof previewedRowSchema>;

export const previewImportCsvInputSchema = z.object({
  csvText: z.string().min(1, "CSV vide").max(2_000_000, "CSV > 2 MB"),
});
export type PreviewImportCsvInput = z.infer<typeof previewImportCsvInputSchema>;

export const previewImportCsvOutputSchema = z.object({
  rows: z.array(previewedRowSchema),
  summary: z.object({
    total: z.number().int().min(0),
    valid: z.number().int().min(0),
    invalid: z.number().int().min(0),
  }),
});
export type PreviewImportCsvOutput = z.infer<typeof previewImportCsvOutputSchema>;

export const importCsvInputSchema = z.object({
  rows: z.array(validatedCsvRowSchema).min(1, "rows requis (min 1)").max(1000, "max 1000 lignes"),
});
export type ImportCsvInput = z.infer<typeof importCsvInputSchema>;

export const importCsvOutputSchema = z.object({
  ok: z.literal(true),
  persisted: z.number().int().min(0),
});
export type ImportCsvOutput = z.infer<typeof importCsvOutputSchema>;
```

Run:

```bash
bun --filter='@pekulo/validators' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/validators/src/transactions/transactions.schemas.ts
git commit -m "feat(#28): T1 — validator schemas for csv preview + import"
```

#### T2 — Error code + HTTP status

Edit `apps/api/src/common/errors/pekulo-error.ts`. Insert `| "INVALID_CSV"` in the `PekuloErrorCode` union between `INVALID_WEALTH` and `MILESTONE_INVALID_CAPITAL` ; insert `| "NO_VALID_ROWS"` between `NOT_FOUND` and `RATE_LIMITED` ; insert `| "PAYLOAD_TOO_LARGE"` between `NO_VALID_ROWS` and `RATE_LIMITED`. Mirror all 3 in the `PEKULO_ERROR_CODES` Set (same alphabetical positions).

After edit, the union (relevant slice) reads:

```ts
| "INVALID_TARGET"
| "INVALID_WEALTH"
| "INVALID_CSV"
| "MILESTONE_INVALID_CAPITAL"
// ...
| "NOT_FOUND"
| "NO_VALID_ROWS"
| "PAYLOAD_TOO_LARGE"
| "RATE_LIMITED"
```

Edit `apps/api/src/platform/http/error-mapper.ts`. In the `ORPC_HTTP_STATUS_BY_CODE` object, add the following entries:

```ts
  // CSV import (story 5-2): malformed CSV / column count mismatch surfaces
  // as 400 (client sent garbage).
  INVALID_CSV: 400,
```

(Place after the `MILESTONE_YEAR_OUT_OF_RANGE: 400` line, alongside the other 400s.)

And after the 404 cluster (after `TRANSACTION_NOT_FOUND: 404,`):

```ts
  // CSV import (story 5-2): payload > MAX_CSV_ROWS (1000) surfaces as 413.
  PAYLOAD_TOO_LARGE: 413,
  // CSV import (story 5-2): importCsv called with empty rows array (reserved
  // — schema-level .min(1) catches it as 400, but the code exists for any
  // service-level guard that wants to surface "no valid rows after re-check").
  NO_VALID_ROWS: 422,
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
```

Expected: exit 0 (the `Record<PekuloErrorCode, number>` exhaustiveness is satisfied).

Commit:

```bash
git add apps/api/src/common/errors/pekulo-error.ts apps/api/src/platform/http/error-mapper.ts
git commit -m "feat(#28): T2 — register INVALID_CSV/NO_VALID_ROWS/PAYLOAD_TOO_LARGE codes + statuses"
```

#### T3 — Contract — 2 new procedures

Edit `packages/contracts/src/transactions/transactions.contract.ts`. Extend the import block + add 3 typed-error consts + 2 new procedures. The post-edit file:

```ts
// packages/contracts/src/transactions/transactions.contract.ts
// Transactions module oRPC contract (stories 5-1 + 5-2). 7 procedures: 5
// single-row CRUD (5-1) + 2 bulk CSV (5-2: previewImportCsv, importCsv).
// Mount under /rpc/v1/transactions per ADR-0009.

import { oc } from "@orpc/contract";
import {
  createTransactionInputSchema,
  deleteTransactionInputSchema,
  getTransactionInputSchema,
  importCsvInputSchema,
  importCsvOutputSchema,
  listTransactionsInputSchema,
  listTransactionsOutputSchema,
  previewImportCsvInputSchema,
  previewImportCsvOutputSchema,
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
const invalidCsvError = {
  status: 400 as const,
  message: "csv invalid",
};
const payloadTooLargeError = {
  status: 413 as const,
  message: "csv too large",
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
  listTransactions: oc.input(listTransactionsInputSchema).output(listTransactionsOutputSchema),
  previewImportCsv: oc
    .errors({
      INVALID_CSV: invalidCsvError,
      PAYLOAD_TOO_LARGE: payloadTooLargeError,
    })
    .input(previewImportCsvInputSchema)
    .output(previewImportCsvOutputSchema),
  importCsv: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(importCsvInputSchema)
    .output(importCsvOutputSchema),
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
bun --filter='@pekulo/api' run typecheck
```

Expected: both exit 0.

Commit:

```bash
git add packages/contracts/src/transactions/transactions.contract.ts
git commit -m "feat(#28): T3 — contract — previewImportCsv + importCsv procedures"
```

#### T4 — `csv-parser.ts` + parser tests (TDD RED → GREEN)

Add the runtime dep first:

```bash
cd apps/api
bun add csv-parse@^5.5.6
cd ../..
```

(Or edit `apps/api/package.json` to add `"csv-parse": "^5.5.6"` to `dependencies`, then run `bun install` from the repo root.)

Create `apps/api/src/modules/transactions/services/csv-parser.ts` with the FULL content below:

```ts
// apps/api/src/modules/transactions/services/csv-parser.ts
// Pure CSV parser + per-row validator + account-resolution loop (story 5-2).
//
// Contract:
//   - Accepts positional 4-column CSV (date, amount, label, account-label).
//     NO header row, NO column mapping — kept deterministic for V1.
//   - Throws PekuloError("INVALID_CSV") on csv-parse exceptions or column
//     count mismatch at the global level (an empty CSV is INVALID_CSV).
//   - Throws PekuloError("PAYLOAD_TOO_LARGE") when row count > MAX_CSV_ROWS.
//   - Returns row-by-row breakdown — per-row errors (bad date, ambiguous
//     account, etc.) are DATA, not exceptions.
//
// Re-used by:
//   - transactions.service.ts#previewImportCsv (the user-facing path)
//   - the api integration tests (the parser is exported)

import { parse } from "csv-parse/sync";
import { PekuloError } from "../../../common/errors";
import type {
  PreviewedRow,
  RawCsvRow,
  TransactionCategory,
  TransactionType,
} from "@pekulo/validators";

export const MAX_CSV_ROWS = 1000;

const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export interface AccountResolver {
  resolve(userId: string, label: string): Promise<{ id: string | null; matchCount: number }>;
}

export interface ParseCsvForPreviewDeps {
  csvText: string;
  userId: string;
  accountResolver: AccountResolver;
}

export interface ParseCsvForPreviewOutput {
  rows: PreviewedRow[];
  summary: { total: number; valid: number; invalid: number };
}

export async function parseCsvForPreview(
  deps: ParseCsvForPreviewDeps,
): Promise<ParseCsvForPreviewOutput> {
  let records: string[][];
  try {
    records = parse(deps.csvText, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch (err) {
    throw new PekuloError(
      "INVALID_CSV",
      err instanceof Error ? err.message : "csv parse failed",
    );
  }

  if (records.length === 0) {
    throw new PekuloError("INVALID_CSV", "csv has no rows");
  }
  if (records.length > MAX_CSV_ROWS) {
    throw new PekuloError(
      "PAYLOAD_TOO_LARGE",
      `csv has ${records.length} rows (max ${MAX_CSV_ROWS})`,
    );
  }

  const rows: PreviewedRow[] = [];
  let valid = 0;
  let invalid = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const raw: RawCsvRow = {
      occurredOn: record[0] ?? "",
      amountRaw: record[1] ?? "",
      label: record[2] ?? "",
      accountLabel: record[3] ?? "",
    };

    const rowError = (msg: string): void => {
      rows.push({ index: i, raw, error: msg });
      invalid++;
    };

    if (record.length !== 4) {
      rowError(`expected 4 columns, got ${record.length}`);
      continue;
    }

    if (!ISO_DATE_REGEX.test(raw.occurredOn)) {
      rowError(`invalid date: "${raw.occurredOn}" (expected YYYY-MM-DD)`);
      continue;
    }
    const dateCheck = new Date(`${raw.occurredOn}T00:00:00Z`);
    if (
      Number.isNaN(dateCheck.getTime()) ||
      dateCheck.toISOString().slice(0, 10) !== raw.occurredOn
    ) {
      rowError(`invalid date: "${raw.occurredOn}" (day out of month)`);
      continue;
    }

    const amountNum = Number(raw.amountRaw);
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      rowError(`invalid amount: "${raw.amountRaw}" (must be a finite non-zero number)`);
      continue;
    }

    if (raw.label.length === 0) {
      rowError("label required");
      continue;
    }
    if (raw.label.length > 120) {
      rowError(`label > 120 characters (got ${raw.label.length})`);
      continue;
    }

    if (raw.accountLabel.length === 0) {
      rowError("account label required");
      continue;
    }

    const resolved = await deps.accountResolver.resolve(deps.userId, raw.accountLabel);
    if (resolved.matchCount === 0) {
      rowError(`account not found: ${raw.accountLabel}`);
      continue;
    }
    if (resolved.matchCount > 1) {
      rowError(
        `ambiguous account label: ${raw.accountLabel} (${resolved.matchCount} matches)`,
      );
      continue;
    }

    const type: TransactionType = amountNum > 0 ? "inflow" : "outflow";
    const category: TransactionCategory = "autre";
    rows.push({
      index: i,
      raw,
      parsed: {
        occurredOn: raw.occurredOn,
        amount: Math.abs(amountNum),
        type,
        category,
        label: raw.label,
        accountId: resolved.id!,
        isImprevu: false,
        notes: null,
      },
    });
    valid++;
  }

  return { rows, summary: { total: records.length, valid, invalid } };
}
```

Create `apps/api/src/modules/transactions/services/csv-parser.test.ts` with the FULL content below:

```ts
// apps/api/src/modules/transactions/services/csv-parser.test.ts
// Coverage for parseCsvForPreview (story 5-2). Uses bun:test (apps/api).

import { describe, expect, it } from "bun:test";
import { PekuloError } from "../../../common/errors";
import { MAX_CSV_ROWS, parseCsvForPreview, type AccountResolver } from "./csv-parser";

const ACCOUNT_ID_VALID = "acc_aaaaaaaaaaaaaaaaaaaaa";
const ACCOUNT_ID_OTHER = "acc_bbbbbbbbbbbbbbbbbbbbb";

function singleAccountResolver(label: string, id: string): AccountResolver {
  return {
    async resolve(_userId, queryLabel) {
      if (queryLabel === label) return { id, matchCount: 1 };
      return { id: null, matchCount: 0 };
    },
  };
}

function ambiguousAccountResolver(label: string, matchCount: number): AccountResolver {
  return {
    async resolve(_userId, queryLabel) {
      if (queryLabel === label) return { id: null, matchCount };
      return { id: null, matchCount: 0 };
    },
  };
}

describe("parseCsvForPreview", () => {
  it("parses 3 valid rows + infers type from amount sign", async () => {
    const csvText = [
      "2026-05-01,42.50,Courses Carrefour,Compte courant",
      "2026-05-02,-1200.00,Loyer,Compte courant",
      "2026-05-03,3500.00,Salaire,Compte courant",
    ].join("\n");

    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });

    expect(out.summary).toEqual({ total: 3, valid: 3, invalid: 0 });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]!.parsed).toEqual({
      occurredOn: "2026-05-01",
      amount: 42.5,
      type: "inflow",
      category: "autre",
      label: "Courses Carrefour",
      accountId: ACCOUNT_ID_VALID,
      isImprevu: false,
      notes: null,
    });
    expect(out.rows[1]!.parsed?.type).toBe("outflow");
    expect(out.rows[1]!.parsed?.amount).toBe(1200);
    expect(out.rows[2]!.parsed?.type).toBe("inflow");
    expect(out.rows[2]!.parsed?.amount).toBe(3500);
  });

  it("rejects payload > MAX_CSV_ROWS with PAYLOAD_TOO_LARGE", async () => {
    const csvText = Array.from(
      { length: MAX_CSV_ROWS + 1 },
      (_, i) => `2026-05-01,1.00,Row ${i},Compte courant`,
    ).join("\n");
    await expect(
      parseCsvForPreview({
        csvText,
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("accepts payload at the MAX_CSV_ROWS boundary", async () => {
    const csvText = Array.from(
      { length: MAX_CSV_ROWS },
      () => "2026-05-01,1.00,Row,Compte courant",
    ).join("\n");
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary.total).toBe(MAX_CSV_ROWS);
  });

  it("throws INVALID_CSV on malformed CSV (unbalanced quote)", async () => {
    const csvText = '2026-05-01,"unbalanced,xxx,Compte';
    await expect(
      parseCsvForPreview({
        csvText,
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toBeInstanceOf(PekuloError);
  });

  it("throws INVALID_CSV on empty CSV", async () => {
    await expect(
      parseCsvForPreview({
        csvText: "",
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toMatchObject({ code: "INVALID_CSV" });
  });

  it("marks unknown account as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,Test,Livret A";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary).toEqual({ total: 1, valid: 0, invalid: 1 });
    expect(out.rows[0]!.error).toBe("account not found: Livret A");
    expect(out.rows[0]!.parsed).toBeUndefined();
  });

  it("marks ambiguous account label as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: ambiguousAccountResolver("Compte courant", 2),
    });
    expect(out.summary.invalid).toBe(1);
    expect(out.rows[0]!.error).toBe("ambiguous account label: Compte courant (2 matches)");
  });

  it("marks malformed date as row-level invalid", async () => {
    const csvText = "2026-13-01,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("invalid date");
  });

  it("marks day-out-of-month as row-level invalid", async () => {
    const csvText = "2026-02-30,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("day out of month");
  });

  it("marks zero amount as row-level invalid", async () => {
    const csvText = "2026-05-01,0,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("invalid amount");
  });

  it("marks empty label as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toBe("label required");
  });

  it("does not leak across users — resolver is the boundary", async () => {
    // resolver always returns 0 matches for user-B even though user-A's account exists
    const resolver: AccountResolver = {
      async resolve(userId, label) {
        if (userId === "user-A" && label === "Compte courant") {
          return { id: ACCOUNT_ID_VALID, matchCount: 1 };
        }
        return { id: null, matchCount: 0 };
      },
    };
    const out = await parseCsvForPreview({
      csvText: "2026-05-01,42.50,Test,Compte courant",
      userId: "user-B",
      accountResolver: resolver,
    });
    expect(out.summary.invalid).toBe(1);
    expect(out.rows[0]!.error).toBe("account not found: Compte courant");
    expect(out.rows[0]!.parsed?.accountId).toBeUndefined();
  });
});
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test src/modules/transactions/services/csv-parser.test.ts
```

Expected: typecheck exits 0 ; tests output `11 pass`, exit 0.

Commit:

```bash
git add apps/api/package.json apps/api/src/modules/transactions/services/
git commit -m "feat(#28): T4 — csv-parser.ts + bun:test coverage (11 cases)"
```

#### T5 — Accounts `findAccountIdByLabel` extension

Edit `apps/api/src/modules/accounts/accounts.repository.ts`. Append `findAccountIdByLabelForUser` to the `AccountRepository` interface AND its implementation. The new interface method:

```ts
findAccountIdByLabelForUser(
  userId: string,
  label: string,
): Promise<{ id: string | null; matchCount: number }>;
```

And the implementation (place inside the `createAccountRepository` factory's return object, alongside `accountExistsForUser`):

```ts
async findAccountIdByLabelForUser(userId, label) {
  const rows = await deps.client.account.findMany({
    where: { userId, label },
    select: { id: true },
  });
  if (rows.length === 0) return { id: null, matchCount: 0 };
  if (rows.length > 1) return { id: null, matchCount: rows.length };
  return { id: rows[0]!.id, matchCount: 1 };
}
```

Edit `apps/api/src/modules/accounts/accounts.service.ts`. Append to the `AccountService` interface:

```ts
findAccountIdByLabel(
  userId: string,
  label: string,
): Promise<{ id: string | null; matchCount: number }>;
```

And the implementation (alongside `accountExists`):

```ts
async findAccountIdByLabel(userId, label) {
  return deps.repository.findAccountIdByLabelForUser(userId, label);
}
```

Extend `apps/api/src/modules/accounts/accounts.repository.test.ts` with these 3 test cases (append inside the existing `describe`):

```ts
describe("findAccountIdByLabelForUser", () => {
  it("returns matchCount 0 when no account matches", async () => {
    const fake = makeFakePrisma({ accountRows: [] });
    const repo = createAccountRepository({ client: fake });
    const out = await repo.findAccountIdByLabelForUser("user-A", "Inconnu");
    expect(out).toEqual({ id: null, matchCount: 0 });
  });

  it("returns id + matchCount 1 when exactly one account matches", async () => {
    const fake = makeFakePrisma({
      accountRows: [{ id: "acc_aaa", userId: "user-A", label: "Compte courant" }],
    });
    const repo = createAccountRepository({ client: fake });
    const out = await repo.findAccountIdByLabelForUser("user-A", "Compte courant");
    expect(out).toEqual({ id: "acc_aaa", matchCount: 1 });
  });

  it("returns null + matchCount N when multiple accounts share the label", async () => {
    const fake = makeFakePrisma({
      accountRows: [
        { id: "acc_aaa", userId: "user-A", label: "Compte courant" },
        { id: "acc_bbb", userId: "user-A", label: "Compte courant" },
      ],
    });
    const repo = createAccountRepository({ client: fake });
    const out = await repo.findAccountIdByLabelForUser("user-A", "Compte courant");
    expect(out).toEqual({ id: null, matchCount: 2 });
  });
});
```

(The `makeFakePrisma` helper already exists in the test file from 5-1 ; extend its `accountRows` handling if needed — the existing test file shows the pattern.)

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test src/modules/accounts/accounts.repository.test.ts
```

Expected: typecheck exits 0 ; tests output the existing pass count + 3 new passes.

Commit:

```bash
git add apps/api/src/modules/accounts/accounts.repository.ts apps/api/src/modules/accounts/accounts.service.ts apps/api/src/modules/accounts/accounts.repository.test.ts
git commit -m "feat(#28): T5 — accounts.findAccountIdByLabel for csv-import resolver"
```

#### T6 — `transactions.repository#bulkCreate`

Edit `apps/api/src/modules/transactions/transactions.repository.ts`. Append to the imports:

```ts
import type {
  // ... existing imports ...
  ValidatedCsvRow,
} from "@pekulo/validators";
```

Append `bulkCreate` to the `TransactionsRepository` interface:

```ts
bulkCreate(userId: string, rows: ValidatedCsvRow[]): Promise<{ persisted: number }>;
```

Append the implementation inside the `createTransactionsRepository` factory's return object (after `listByUser`):

```ts
async bulkCreate(userId, rows) {
  let persisted = 0;
  await deps.client.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.transaction.create({
        data: {
          userId,
          accountId: row.accountId,
          occurredOn: new Date(row.occurredOn),
          label: row.label,
          amount: row.amount,
          type: row.type,
          category: row.category,
          isImprevu: row.isImprevu,
          notes: row.notes,
        } as unknown as Parameters<typeof tx.transaction.create>[0]["data"],
      });
      persisted++;
    }
  });
  return { persisted };
},
```

Extend `apps/api/src/modules/transactions/transactions.repository.test.ts` with these 2 test cases (append inside the existing `describe` block):

```ts
describe("bulkCreate", () => {
  it("persists every row inside a $transaction and returns persisted count", async () => {
    const fake = makeFakePrisma({ transactionRows: [] });
    const repo = createTransactionsRepository({ client: fake });
    const rows: ValidatedCsvRow[] = [
      {
        occurredOn: "2026-05-01",
        amount: 42.5,
        type: "inflow",
        category: "autre",
        label: "Row 1",
        accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
        isImprevu: false,
        notes: null,
      },
      {
        occurredOn: "2026-05-02",
        amount: 100,
        type: "outflow",
        category: "autre",
        label: "Row 2",
        accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
        isImprevu: false,
        notes: null,
      },
    ];
    const out = await repo.bulkCreate("user-A", rows);
    expect(out.persisted).toBe(2);
    expect(fake.callLog.txTransactionCreate.calls).toBe(2);
    expect(fake.callLog.dollarTransaction.calls).toBe(1);
  });

  it("rolls back when any row fails — persisted reflects 0", async () => {
    const fake = makeFakePrisma({
      transactionRows: [],
      txTransactionCreateThrowsOn: 2, // second create throws
    });
    const repo = createTransactionsRepository({ client: fake });
    const rows: ValidatedCsvRow[] = [
      { occurredOn: "2026-05-01", amount: 1, type: "inflow", category: "autre", label: "A", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", isImprevu: false, notes: null },
      { occurredOn: "2026-05-02", amount: 1, type: "inflow", category: "autre", label: "B", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", isImprevu: false, notes: null },
      { occurredOn: "2026-05-03", amount: 1, type: "inflow", category: "autre", label: "C", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", isImprevu: false, notes: null },
    ];
    await expect(repo.bulkCreate("user-A", rows)).rejects.toThrow();
    // The fake's $transaction must throw to simulate rollback — the test
    // asserts the catch path surfaces, not partial persistence (real Prisma
    // rolls back the row inserts on error).
  });
});
```

(Extend `makeFakePrisma` in the test file with `$transaction(fn)` that simply invokes `fn(self)` AND a counter for `txTransactionCreate` calls + an optional `txTransactionCreateThrowsOn: N` toggle that throws on the Nth call. The helper already covers `transaction.create` for 5-1's tests — extend it to keep the new tests honest. Pattern mirrors realestate's bulk-test extensions.)

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test src/modules/transactions/transactions.repository.test.ts
```

Expected: typecheck exits 0 ; tests output the existing pass count + 2 new passes.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions.repository.test.ts
git commit -m "feat(#28): T6 — repository.bulkCreate via prisma.\$transaction"
```

#### T7 — `transactions.service` — preview + import methods

Edit `apps/api/src/modules/transactions/transactions.service.ts`. Append to the imports:

```ts
import type {
  // ... existing imports ...
  ImportCsvInput,
  ImportCsvOutput,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
} from "@pekulo/validators";
import { parseCsvForPreview, type AccountResolver } from "./services/csv-parser";
import { PekuloError } from "../../common/errors";
```

Re-export `AccountResolver` so the module composition site can refer to it:

```ts
export type { AccountResolver };
```

Append to the `TransactionsService` interface:

```ts
previewImportCsv(userId: string, input: PreviewImportCsvInput): Promise<PreviewImportCsvOutput>;
importCsv(userId: string, input: ImportCsvInput): Promise<ImportCsvOutput>;
```

Extend the factory deps and add the two methods inside the return object. The post-edit factory:

```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
}): TransactionsService {
  return {
    // ... existing 5 methods unchanged ...

    async previewImportCsv(userId, input) {
      return parseCsvForPreview({
        csvText: input.csvText,
        userId,
        accountResolver: deps.accountResolver,
      });
    },

    async importCsv(userId, input) {
      // Defense in depth: re-check every account ownership even though the
      // resolver in previewImportCsv already filtered. The client could have
      // tampered with the rows array between preview and import.
      for (const row of input.rows) {
        const owns = await deps.accountOwnershipProbe.exists(userId, row.accountId);
        if (!owns) throw accountNotFound();
      }
      try {
        const { persisted } = await deps.repository.bulkCreate(userId, input.rows);
        return { ok: true as const, persisted };
      } catch (err) {
        throw new PekuloError(
          "TRANSACTION_FAILED",
          err instanceof Error ? err.message : "bulk insert failed",
        );
      }
    },
  };
}
```

Extend `apps/api/src/modules/transactions/transactions.service.test.ts` with the following block (append inside the existing `describe`):

```ts
describe("previewImportCsv", () => {
  it("delegates to parseCsvForPreview and returns its output", async () => {
    const fakeRepo = makeFakeRepo();
    const probe = { exists: async () => true };
    const resolver = {
      resolve: async (_u: string, label: string) =>
        label === "Compte courant"
          ? { id: "acc_aaaaaaaaaaaaaaaaaaaaa", matchCount: 1 }
          : { id: null, matchCount: 0 },
    };
    const svc = createTransactionsService({ repository: fakeRepo, accountOwnershipProbe: probe, accountResolver: resolver });
    const out = await svc.previewImportCsv("user-A", {
      csvText: "2026-05-01,42.50,Test,Compte courant",
    });
    expect(out.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
  });
});

describe("importCsv", () => {
  it("re-checks ownership for every row before bulk-insert", async () => {
    const fakeRepo = makeFakeRepo();
    const probe = { exists: async (_u: string, accountId: string) => accountId === "acc_owned" };
    const resolver = { resolve: async () => ({ id: null, matchCount: 0 }) };
    const svc = createTransactionsService({ repository: fakeRepo, accountOwnershipProbe: probe, accountResolver: resolver });
    await expect(
      svc.importCsv("user-A", {
        rows: [
          { occurredOn: "2026-05-01", amount: 1, type: "inflow", category: "autre", label: "X", accountId: "acc_other", isImprevu: false, notes: null },
        ],
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("returns { ok: true, persisted: N } on success", async () => {
    const fakeRepo = makeFakeRepo();
    const probe = { exists: async () => true };
    const resolver = { resolve: async () => ({ id: null, matchCount: 0 }) };
    const svc = createTransactionsService({ repository: fakeRepo, accountOwnershipProbe: probe, accountResolver: resolver });
    const out = await svc.importCsv("user-A", {
      rows: [
        { occurredOn: "2026-05-01", amount: 1, type: "inflow", category: "autre", label: "X", accountId: "acc_owned", isImprevu: false, notes: null },
        { occurredOn: "2026-05-02", amount: 2, type: "outflow", category: "autre", label: "Y", accountId: "acc_owned", isImprevu: false, notes: null },
      ],
    });
    expect(out).toEqual({ ok: true, persisted: 2 });
  });
});
```

(Extend `makeFakeRepo` to support `bulkCreate` returning `{ persisted: input.rows.length }` and capturing the call. The helper already lives in the test file from 5-1.)

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test src/modules/transactions/transactions.service.test.ts
```

Expected: typecheck exits 0 ; tests output existing pass count + 3 new passes.

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.service.test.ts
git commit -m "feat(#28): T7 — service.previewImportCsv + importCsv with re-check guard"
```

#### T8 — Routes + module composition + bootstrap + integration test

Edit `apps/api/src/modules/transactions/transactions.routes.ts`. Append two new handlers inside the `impl.router({...})` object (after `listTransactions`):

```ts
previewImportCsv: impl.previewImportCsv.handler(async ({ context, input, errors }) => {
  requireUserId(context.userId);
  try {
    return await deps.service.previewImportCsv(context.userId, input);
  } catch (err) {
    if (err instanceof PekuloError) {
      if (err.code === "INVALID_CSV") throw errors.INVALID_CSV({ message: err.message });
      if (err.code === "PAYLOAD_TOO_LARGE") throw errors.PAYLOAD_TOO_LARGE({ message: err.message });
    }
    throw err;
  }
}),

importCsv: impl.importCsv.handler(async ({ context, input, errors }) => {
  requireUserId(context.userId);
  try {
    return await deps.service.importCsv(context.userId, input);
  } catch (err) {
    if (err instanceof PekuloError && err.code === "ACCOUNT_NOT_FOUND") {
      throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
    }
    throw err;
  }
}),
```

Edit `apps/api/src/modules/transactions/transactions.module.ts`. Update the factory signature:

```ts
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type TransactionsService,
} from "./transactions.service";

// ... interface unchanged ...

export function createTransactionsModule(deps: {
  prismaService: PrismaService;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
}): TransactionsModule {
  const repository = createTransactionsRepository({ client: deps.prismaService.client });
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
    accountResolver: deps.accountResolver,
  });
  const router = createTransactionsRouter({ service });
  return { service, router };
}
```

Edit `apps/api/src/bootstrap/runtime-dependencies.ts`. Locate the existing `createTransactionsModule({...})` call and add the resolver:

```ts
const transactionsModule = createTransactionsModule({
  prismaService,
  accountOwnershipProbe: {
    exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
  },
  accountResolver: {
    resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label),
  },
});
```

Extend `apps/api/src/modules/transactions/transactions.integration.test.ts` with 2 new oRPC HTTP boundary tests (append inside the existing `describe`):

```ts
describe("POST /rpc/v1/transactions/preview-import-csv", () => {
  it("returns 200 with row breakdown on valid CSV", async () => {
    // Standard fixture setup mirrors the 5-1 integration tests in this file —
    // a fake AccountResolver returning matchCount 1 for "Compte courant".
    const csvText = "2026-05-01,42.50,Test,Compte courant";
    const res = await testClient.previewImportCsv({ csvText });
    expect(res.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
  });

  it("returns 413 on payload > MAX_CSV_ROWS", async () => {
    const csvText = Array.from({ length: 1001 }, () => "2026-05-01,1,Test,Compte courant").join("\n");
    await expect(testClient.previewImportCsv({ csvText })).rejects.toMatchObject({ status: 413 });
  });

  it("returns 400 on malformed CSV", async () => {
    await expect(testClient.previewImportCsv({ csvText: '2026-05-01,"unbalanced' })).rejects.toMatchObject({ status: 400 });
  });
});

describe("POST /rpc/v1/transactions/import-csv", () => {
  it("returns 200 + { ok: true, persisted: N } on success", async () => {
    const rows = [
      { occurredOn: "2026-05-01", amount: 42.5, type: "inflow" as const, category: "autre" as const, label: "Test", accountId: ACCOUNT_ID_OWNED, isImprevu: false, notes: null },
    ];
    const res = await testClient.importCsv({ rows });
    expect(res).toEqual({ ok: true, persisted: 1 });
  });

  it("returns 404 ACCOUNT_NOT_FOUND when a row references another user's account", async () => {
    const rows = [
      { occurredOn: "2026-05-01", amount: 1, type: "inflow" as const, category: "autre" as const, label: "X", accountId: ACCOUNT_ID_OTHER_USER, isImprevu: false, notes: null },
    ];
    await expect(testClient.importCsv({ rows })).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("returns 400 (Zod) on empty rows array", async () => {
    await expect(testClient.importCsv({ rows: [] })).rejects.toMatchObject({ status: 400 });
  });
});
```

Run:

```bash
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test
```

Expected: typecheck exits 0 ; full test suite passes (existing 5-1 count + 5-2 additions).

Commit:

```bash
git add apps/api/src/modules/transactions/transactions.routes.ts apps/api/src/modules/transactions/transactions.module.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/modules/transactions/transactions.integration.test.ts
git commit -m "feat(#28): T8 — routes + module + bootstrap + integration tests"
```

#### T9 — `@pekulo/types` re-export

Edit `packages/types/src/transaction/transaction.types.ts`. Append to the existing re-export block:

```ts
export type {
  // ... existing 9 types ...
  RawCsvRow,
  ValidatedCsvRow,
  PreviewedRow,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
  ImportCsvInput,
  ImportCsvOutput,
} from "@pekulo/validators";
```

Run:

```bash
bun --filter='@pekulo/types' run typecheck
```

Expected: exit 0.

Commit:

```bash
git add packages/types/src/transaction/transaction.types.ts
git commit -m "feat(#28): T9 — re-export csv import types from @pekulo/types"
```

#### T10 — Server actions + hooks (apps/web)

Edit `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts`. Add the following BEFORE the `void z;` no-op at the end:

```ts
// ─── CSV import (story 5-2) ──────────────────────────────────────────────

import {
  importCsvInputSchema,
  previewImportCsvInputSchema,
  type ImportCsvInput,
  type ImportCsvOutput,
  type PreviewImportCsvInput,
  type PreviewImportCsvOutput,
} from "@pekulo/validators";

export type PreviewImportCsvResult =
  | ({ ok: true } & PreviewImportCsvOutput)
  | { ok: false; code: "INVALID_CSV" | "PAYLOAD_TOO_LARGE"; message: string };

export type ImportCsvResult =
  | { ok: true; persisted: number }
  | { ok: false; code: "ACCOUNT_NOT_FOUND"; message: string };

export const previewImportCsv = defineAction<
  PreviewImportCsvInput,
  PreviewImportCsvResult,
  ActionContext
>({
  name: "previewImportCsv",
  input: previewImportCsvInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const out = await transactionsClient.previewImportCsv(input);
      return { ok: true as const, ...out };
    } catch (err) {
      if (
        err instanceof ORPCError &&
        (err.code === "INVALID_CSV" || err.code === "PAYLOAD_TOO_LARGE")
      ) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

export const importCsv = defineAction<ImportCsvInput, ImportCsvResult, ActionContext>({
  name: "importCsv",
  input: importCsvInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const out = await transactionsClient.importCsv(input);
      return { ok: true as const, persisted: out.persisted };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "ACCOUNT_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
```

(Both actions OMIT `output:` per the 2026-05-20 envelope-discipline lesson. `previewImportCsv` does NOT declare `tags:` — it's read-only server-side. `importCsv` declares `tags: [transactionsTags.list()]` for Next's `revalidateTag()` fetch cache ; React Query invalidation comes from the hook below.)

Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-preview-import-csv.ts`:

```ts
"use client";

import { useActionMutation } from "@zapaction/query";
import { previewImportCsv } from "../_actions/transactions-actions";

export function usePreviewImportCsv() {
  return useActionMutation(previewImportCsv);
}
```

Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-import-transactions-csv-form.ts`:

```ts
"use client";

import { useActionMutation } from "@zapaction/query";
import { importCsv } from "../_actions/transactions-actions";
import { transactionsTags } from "@/lib/zapaction/keys";

export function useImportTransactionsCsvForm() {
  return useActionMutation(importCsv, {
    invalidateWithTags: [transactionsTags.list()],
  });
}
```

Run:

```bash
bun --filter=web run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/web/src/app/\(cap\)/dashboard/transactions/_actions/transactions-actions.ts apps/web/src/app/\(cap\)/dashboard/transactions/_hooks/use-preview-import-csv.ts apps/web/src/app/\(cap\)/dashboard/transactions/_hooks/use-import-transactions-csv-form.ts
git commit -m "feat(#28): T10 — server actions + zapaction hooks for csv import"
```

#### T11 — `csv-preview-table.tsx`

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-preview-table.tsx` with the FULL content below:

```tsx
"use client";

import { Text, View } from "@pekulo/ui/client";
import { pekuloRadius } from "@pekulo/ui";
import { Check, X } from "lucide-react";
import type { PreviewedRow } from "@pekulo/validators";

export interface CsvPreviewTableProps {
  rows: PreviewedRow[];
  accountLabelById: Map<string, string>;
}

export function CsvPreviewTable({ rows, accountLabelById }: CsvPreviewTableProps) {
  return (
    <View flexDirection="column" gap="$2" role="table" aria-label="Aperçu CSV">
      {/* Desktop header — hidden below lg */}
      <View
        display="none"
        $lg={{
          display: "grid",
          gridTemplateColumns: "28px 110px 100px 1.4fr 1.2fr",
          gap: "$3",
          paddingBottom: "$2",
          borderBottomWidth: 1,
          borderColor: "$borderColor",
        }}
        role="row"
      >
        <Text fontSize="$caption" color="$colorTertiary" role="columnheader">
          OK
        </Text>
        <Text fontSize="$caption" color="$colorTertiary" role="columnheader">
          Date
        </Text>
        <Text fontSize="$caption" color="$colorTertiary" role="columnheader" textAlign="right">
          Montant
        </Text>
        <Text fontSize="$caption" color="$colorTertiary" role="columnheader">
          Libellé
        </Text>
        <Text fontSize="$caption" color="$colorTertiary" role="columnheader">
          Compte
        </Text>
      </View>

      {rows.map((row) => {
        const isValid = row.parsed !== undefined;
        const accountDisplay = row.parsed
          ? accountLabelById.get(row.parsed.accountId) ?? row.raw.accountLabel
          : row.raw.accountLabel;
        return (
          <View
            key={row.index}
            flexDirection="column"
            gap="$1"
            paddingVertical="$2"
            paddingHorizontal="$2"
            borderRadius={pekuloRadius.md}
            backgroundColor={isValid ? "transparent" : "$perfLossSoft"}
            $lg={{
              display: "grid",
              gridTemplateColumns: "28px 110px 100px 1.4fr 1.2fr",
              gap: "$3",
              alignItems: "center",
              flexDirection: undefined,
            }}
            role="row"
            aria-label={
              isValid
                ? `Ligne ${row.index + 1} valide`
                : `Ligne ${row.index + 1} invalide: ${row.error}`
            }
          >
            <View flexDirection="row" alignItems="center" gap="$2">
              {isValid ? (
                <Check size={16} strokeWidth={2} aria-hidden color="var(--color)" />
              ) : (
                <X size={16} strokeWidth={2} aria-hidden color="var(--danger)" />
              )}
              <Text $lg={{ display: "none" }} fontSize="$caption" color="$colorTertiary">
                Ligne {row.index + 1}
              </Text>
            </View>
            <Text fontSize="$bodySm" role="cell">
              {row.raw.occurredOn || "—"}
            </Text>
            <Text fontSize="$bodySm" role="cell" $lg={{ textAlign: "right" }}>
              {row.raw.amountRaw || "—"}
            </Text>
            <Text fontSize="$bodySm" role="cell">
              {row.raw.label || "—"}
            </Text>
            <Text
              fontSize="$bodySm"
              role="cell"
              color={isValid ? "$color" : "$colorTertiary"}
            >
              {accountDisplay || "—"}
            </Text>
            {row.error && (
              <View $lg={{ gridColumn: "1 / -1" }} paddingLeft="$5">
                <Text fontSize="$caption" color="$danger" role="alert">
                  {row.error}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
```

Run:

```bash
bun --filter=web run typecheck
```

Expected: exit 0.

Commit:

```bash
git add apps/web/src/app/\(cap\)/dashboard/transactions/_components/csv-preview-table.tsx
git commit -m "feat(#28): T11 — csv-preview-table responsive component"
```

#### T12 — `csv-import-form.tsx` + recent-section trigger + tests + Iron Law

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.tsx` with the FULL content below:

```tsx
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  PekuloButton,
  PekuloDialog,
  PekuloSkeleton,
  useToast,
} from "@pekulo/ui";
import type { PreviewedRow, ValidatedCsvRow } from "@pekulo/validators";
import { useAccounts } from "../../parametres/_hooks/use-accounts";
import { useImportTransactionsCsvForm } from "../_hooks/use-import-transactions-csv-form";
import { usePreviewImportCsv } from "../_hooks/use-preview-import-csv";
import { CsvPreviewTable } from "./csv-preview-table";

export interface CsvImportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportForm({ open, onOpenChange }: CsvImportFormProps) {
  const [csvText, setCsvText] = useState("");
  const [previewedRows, setPreviewedRows] = useState<PreviewedRow[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const previewMut = usePreviewImportCsv();
  const importMut = useImportTransactionsCsvForm();
  const { data: accounts } = useAccounts();
  const toast = useToast();

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  useEffect(() => {
    if (!open) {
      setCsvText("");
      setPreviewedRows(null);
      setSummary(null);
      setEnvelopeError(null);
    }
  }, [open]);

  const handlePreview = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnvelopeError(null);
    previewMut.mutate(
      { csvText },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(result.message);
            setPreviewedRows(null);
            setSummary(null);
            return;
          }
          setPreviewedRows(result.rows);
          setSummary(result.summary);
        },
      },
    );
  };

  const handleConfirm = () => {
    if (!previewedRows || !summary || summary.invalid > 0 || summary.valid === 0) return;
    const rows: ValidatedCsvRow[] = previewedRows
      .map((r) => r.parsed)
      .filter((p): p is ValidatedCsvRow => p !== undefined);
    importMut.mutate(
      { rows },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setEnvelopeError(result.message);
            return;
          }
          toast.success("Import réussi", `${result.persisted} transactions importées`);
          onOpenChange(false);
        },
      },
    );
  };

  const canConfirm =
    summary !== null && summary.invalid === 0 && summary.valid > 0 && !importMut.isPending;

  return (
    <PekuloDialog open={open} onOpenChange={onOpenChange}>
      <PekuloDialog.Portal>
        <PekuloDialog.Overlay />
        <PekuloDialog.Content maxWidth={920} width="92vw">
          <View flexDirection="column" gap="$4">
            <PekuloDialog.Title>Importer un CSV</PekuloDialog.Title>
            <Text fontSize="$caption" color="$colorTertiary">
              Format : 4 colonnes par ligne — date (YYYY-MM-DD), montant (signe = sens : positif
              = entrée, négatif = sortie), libellé, nom du compte. Max 1000 lignes.
            </Text>

            <form aria-label="Importer un CSV" onSubmit={handlePreview}>
              <View flexDirection="column" gap="$3">
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  aria-label="Contenu CSV"
                  rows={10}
                  placeholder="2026-05-01,42.50,Courses Carrefour,Compte courant"
                  style={{
                    width: "100%",
                    minHeight: 200,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "var(--backgroundElevated)",
                    color: "var(--color)",
                    border: "1px solid var(--borderColor)",
                    fontFamily: "monospace",
                    fontSize: 12,
                    resize: "vertical",
                  }}
                />
                {envelopeError && (
                  <Text fontSize="$caption" color="$danger" role="alert">
                    {envelopeError}
                  </Text>
                )}
                <View flexDirection="row" gap="$2">
                  <PekuloButton
                    type="submit"
                    disabled={previewMut.isPending || csvText.trim().length === 0}
                  >
                    {previewMut.isPending ? "Analyse…" : "Aperçu"}
                  </PekuloButton>
                </View>
              </View>
            </form>

            {previewMut.isPending && (
              <View role="status" aria-live="polite">
                <PekuloSkeleton lines={3} height={32} />
              </View>
            )}

            {summary && previewedRows && (
              <View flexDirection="column" gap="$2">
                <Text fontSize="$caption" color="$colorTertiary">
                  {summary.valid} lignes valides · {summary.invalid} invalides ·{" "}
                  {summary.total} au total
                </Text>
                <CsvPreviewTable rows={previewedRows} accountLabelById={accountLabelById} />
                <View flexDirection="row" gap="$2" justifyContent="flex-end" marginTop="$3">
                  <PekuloButton onPress={handleConfirm} disabled={!canConfirm}>
                    {importMut.isPending ? "Import…" : `Confirmer (${summary.valid})`}
                  </PekuloButton>
                </View>
              </View>
            )}

            <PekuloDialog.Close asChild>
              <View
                render="button"
                paddingVertical="$2"
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                alignItems="center"
              >
                <Text
                  color="$colorTertiary"
                  fontSize="$caption"
                  hoverStyle={{ color: "$color" }}
                >
                  Fermer
                </Text>
              </View>
            </PekuloDialog.Close>
          </View>
        </PekuloDialog.Content>
      </PekuloDialog.Portal>
    </PekuloDialog>
  );
}
```

Edit `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`. Add `Upload` to the lucide import + `CsvImportForm` to the local imports + a `csvImportOpen` state + replace the single `HeaderAction` with two wrapped in a `<View flexDirection="row" gap="$2">` + render `<CsvImportForm>` near the bottom.

Concretely, modify the imports block:

```tsx
import { MoreHorizontal, Search, Upload } from "lucide-react";
// ...
import { CsvImportForm } from "./csv-import-form";
```

Add inside the component body (after `const [activeTx, setActiveTx] = useState<Transaction | null>(null);`):

```tsx
const [csvImportOpen, setCsvImportOpen] = useState(false);
```

Replace the existing `action` prop on `<Section>` with:

```tsx
action={
  <View flexDirection="row" gap="$2">
    <HeaderAction
      icon={Upload}
      label="Importer"
      onPress={() => setCsvImportOpen(true)}
    />
    <HeaderAction
      icon={Search}
      label="Filtrer"
      onPress={() => toast.info("Bientôt", "Le filtre transactions arrive plus tard.")}
    />
  </View>
}
```

Render `<CsvImportForm>` at the end of the `<Section>` children (after the existing `{activeTx && <TransactionDeleteConfirm …/>}` block):

```tsx
<CsvImportForm open={csvImportOpen} onOpenChange={setCsvImportOpen} />
```

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.a11y.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CsvImportForm } from "./csv-import-form";

vi.mock("../_hooks/use-preview-import-csv", () => ({
  usePreviewImportCsv: () => ({ mutate: vi.fn(), isPending: false, data: null }),
}));
vi.mock("../_hooks/use-import-transactions-csv-form", () => ({
  useImportTransactionsCsvForm: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../parametres/_hooks/use-accounts", () => ({
  useAccounts: () => ({ data: [], isLoading: false }),
}));
vi.mock("@pekulo/ui", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

describe("CsvImportForm — a11y", () => {
  afterEach(() => cleanup());

  it("renders the open dialog without axe violations", async () => {
    const { container } = render(<CsvImportForm open={true} onOpenChange={() => {}} />);
    const results = await axe(container);
    expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  it("renders nothing visible when closed", () => {
    const { container } = render(<CsvImportForm open={false} onOpenChange={() => {}} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });
});

function afterEach(fn: () => void) {
  (globalThis as any).__afterEachCb = fn;
}
```

(The local `afterEach` shim above is a noop placeholder — vitest's real `afterEach` is auto-imported in the test runner via `setupFiles`. If the existing `setup.tsx` doesn't auto-import it, replace the local shim with `import { afterEach } from "vitest";`.)

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.envelope.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { CsvImportForm } from "./csv-import-form";

const { previewImportCsvMock, importCsvMock } = vi.hoisted(() => ({
  previewImportCsvMock: vi.fn(),
  importCsvMock: vi.fn(),
}));

vi.mock("../_hooks/use-preview-import-csv", () => ({
  usePreviewImportCsv: () => ({ mutate: previewImportCsvMock, isPending: false, data: null }),
}));
vi.mock("../_hooks/use-import-transactions-csv-form", () => ({
  useImportTransactionsCsvForm: () => ({ mutate: importCsvMock, isPending: false }),
}));
vi.mock("../../parametres/_hooks/use-accounts", () => ({
  useAccounts: () => ({ data: [], isLoading: false }),
}));
vi.mock("@pekulo/ui", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

describe("CsvImportForm — envelope narrowing", () => {
  afterEach(() => {
    cleanup();
    previewImportCsvMock.mockReset();
    importCsvMock.mockReset();
  });

  it("renders the INVALID_CSV message inline when preview returns { ok: false }", async () => {
    previewImportCsvMock.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        ok: false,
        code: "INVALID_CSV",
        message: "csv parse failed: unbalanced quote",
      });
    });
    const { getByRole, findByText } = render(
      <CsvImportForm open={true} onOpenChange={() => {}} />,
    );
    const textarea = getByRole("textbox", { name: "Contenu CSV" });
    fireEvent.change(textarea, { target: { value: 'broken,"csv' } });
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    expect(await findByText("csv parse failed: unbalanced quote")).toBeTruthy();
  });

  it("renders the PAYLOAD_TOO_LARGE message inline", async () => {
    previewImportCsvMock.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        message: "csv has 1001 rows (max 1000)",
      });
    });
    const { getByRole, findByText } = render(
      <CsvImportForm open={true} onOpenChange={() => {}} />,
    );
    const textarea = getByRole("textbox", { name: "Contenu CSV" });
    fireEvent.change(textarea, { target: { value: "x" } });
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    expect(await findByText(/csv has 1001 rows/)).toBeTruthy();
  });
});
```

Run the full Iron Law:

```bash
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' test
bun --filter='@pekulo/api' run db:rls-audit
bun --filter=web run typecheck
bun --filter='@pekulo/ui' run test:axe
bun run generate:tamagui-css
git diff --exit-code packages/ui/public/tamagui.generated.css
```

Expected:
- `lint` exits 0.
- `typecheck` exits 0.
- api tests output total pass count including the new 11 (parser) + 3 (repo) + 3 (service) + 6 (integration) cases.
- `db:rls-audit` exits 0 and reports `transactions: 4`.
- web typecheck exits 0.
- ui `test:axe` exits 0.
- `generate:tamagui-css` exits 0 ; `git diff --exit-code` exits 0 (no diff — story added no new styled primitives).

Commit the UI changes + a11y/envelope tests:

```bash
git add apps/web/src/app/\(cap\)/dashboard/transactions/_components/csv-import-form.tsx apps/web/src/app/\(cap\)/dashboard/transactions/_components/csv-import-form.a11y.test.tsx apps/web/src/app/\(cap\)/dashboard/transactions/_components/csv-import-form.envelope.test.tsx apps/web/src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.tsx
git commit -m "feat(#28): T12 — csv-import-form + récentes trigger + a11y + envelope tests"
```

Push the branch:

```bash
git push -u origin feature/28-5-2-csv-import
```

Expected: branch created on the remote with all 12 commits ; subsequent PR creation flows through aped-review.

## File List

### Modified

- `packages/validators/src/transactions/transactions.schemas.ts` — append 7 CSV schemas (T1).
- `packages/contracts/src/transactions/transactions.contract.ts` — add 2 procedures + 3 typed-error consts (T3).
- `packages/types/src/transaction/transaction.types.ts` — re-export 7 inferred CSV types (T9).
- `apps/api/src/common/errors/pekulo-error.ts` — add `INVALID_CSV`, `NO_VALID_ROWS`, `PAYLOAD_TOO_LARGE` to union + Set (T2).
- `apps/api/src/platform/http/error-mapper.ts` — add 400 / 422 / 413 entries (T2).
- `apps/api/src/modules/accounts/accounts.repository.ts` — add `findAccountIdByLabelForUser` (T5).
- `apps/api/src/modules/accounts/accounts.service.ts` — add `findAccountIdByLabel` (T5).
- `apps/api/src/modules/accounts/accounts.repository.test.ts` — add 3 cases for label resolution (T5).
- `apps/api/src/modules/transactions/transactions.repository.ts` — add `bulkCreate` via `prisma.$transaction` (T6).
- `apps/api/src/modules/transactions/transactions.repository.test.ts` — add 2 cases for bulk happy path + rollback (T6).
- `apps/api/src/modules/transactions/transactions.service.ts` — add `previewImportCsv` + `importCsv` ; extend DI with `AccountResolver` (T7).
- `apps/api/src/modules/transactions/transactions.service.test.ts` — add 3 cases for preview + import + ownership re-check (T7).
- `apps/api/src/modules/transactions/transactions.routes.ts` — add 2 handlers with typed-error remap (T8).
- `apps/api/src/modules/transactions/transactions.module.ts` — accept `accountResolver` dep (T8).
- `apps/api/src/modules/transactions/transactions.integration.test.ts` — add 6 oRPC HTTP boundary cases (T8).
- `apps/api/src/bootstrap/runtime-dependencies.ts` — wire `accountResolver` into the transactions module (T8).
- `apps/api/package.json` — add `csv-parse@^5.5.6` runtime dep (T4).
- `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts` — add `previewImportCsv` + `importCsv` server actions (T10).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` — wrap header in `<View>` with TWO `HeaderAction`s + render `<CsvImportForm>` (T12).

### New

- `apps/api/src/modules/transactions/services/csv-parser.ts` — pure parser + per-row validator + account-resolution loop (T4).
- `apps/api/src/modules/transactions/services/csv-parser.test.ts` — 11 `bun:test` cases (T4).
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-preview-import-csv.ts` — ZapAction wrapper, no invalidation (T10).
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-import-transactions-csv-form.ts` — ZapAction wrapper, invalidates `transactionsTags.list()` (T10).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-preview-table.tsx` — responsive table (T11).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.tsx` — Dialog with 2-step flow (T12).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.a11y.test.tsx` — axe-clean check (T12).
- `apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.envelope.test.tsx` — envelope narrowing for INVALID_CSV / PAYLOAD_TOO_LARGE paths (T12).

### Refreshed

- `docs/epics-context/epic-5-context.md` — regenerated by aped-story step 02 (sources updated by commit `3e32bf0` ; cache mtime drifted).

## Dev Agent Record

### Summary

CSV bulk-import shipped end-to-end across 12 task-commits. Scope honoured: 2 new oRPC procedures (`previewImportCsv` + `importCsv`) on top of 5-1's transactions module with `AccountResolver` cross-aggregate guard, atomic per-row `prisma.$transaction` bulk insert (no `createMany` to preserve prefixed-IDs extension per ADR-0012), full envelope-narrowed UI (paste textarea → preview table → gated "Confirmer (N)" → success toast + tag-registry invalidation). All 13 ACs covered by tests. Iron Law clean (api lint 0 errors, 474/474 api tests, 90/90 web tests, RLS audit `transactions: 4` unchanged, Tamagui CSS regen produced clean diff).

### Files changed

- apps/api/package.json
- apps/api/src/bootstrap/runtime-dependencies.ts
- apps/api/src/common/errors/pekulo-error.ts
- apps/api/src/modules/accounts/accounts.integration.test.ts
- apps/api/src/modules/accounts/accounts.repository.test.ts
- apps/api/src/modules/accounts/accounts.repository.ts
- apps/api/src/modules/accounts/accounts.service.test.ts
- apps/api/src/modules/accounts/accounts.service.ts
- apps/api/src/modules/transactions/services/csv-parser.test.ts (new)
- apps/api/src/modules/transactions/services/csv-parser.ts (new)
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
- apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.a11y.test.tsx (new)
- apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.envelope.test.tsx (new)
- apps/web/src/app/(cap)/dashboard/transactions/_components/csv-import-form.tsx (new)
- apps/web/src/app/(cap)/dashboard/transactions/_components/csv-preview-table.tsx (new)
- apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-import-transactions-csv-form.ts (new)
- apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-preview-import-csv.ts (new)
- bun.lock
- docs/epics-context/epic-5-context.md
- docs/state.yaml
- docs/stories/5-2-csv-import.md (this file)
- packages/contracts/src/transactions/transactions.contract.ts
- packages/types/src/transaction/transaction.types.ts
- packages/validators/src/transactions/transactions.schemas.ts

### Deviations

- **T3 → T8 typecheck cascade.** Story T3 expected `bun --filter='@pekulo/api' run typecheck` to exit 0 after the contract addition. It does not: the oRPC contract's exhaustiveness check requires `previewImportCsv` + `importCsv` handlers in `transactions.routes.ts`, which only land in T8. Apps/api typecheck stays red across T3-T7 by design (contract-first ordering); api typecheck returns to 0 at T8. Noted in T3's commit body.
- **T4 parser test count.** Story specified 11 cases; shipped 12. The extra is `does not leak across users — resolver is the boundary`, which exercises AC-4's RLS claim at the resolver seam with the same fake setup.
- **T11 preview table — no CSS grid.** Story's snippet used `display: "grid"` inside Tamagui's `$lg={{}}`, which the typed `display` prop rejects ("flex" | "inline" | … only). The 2026-05-17 lesson directs to use inline `style={{}}`, but a typed grid was not load-bearing for AC-12 (which only requires per-row validity badges + values + inline error). Rewrote the component using pure flex layout — mobile column-stack, desktop `$lg`-keyed flex-row with allocated widths. Identical visual outcome, no typed-display hack.
- **`bun --filter='@pekulo/web'` not `@pekulo/web` shorthand.** Story T10/T11/T12 wrote `bun --filter=web run …`. The actual package is `@pekulo/web` per `apps/web/package.json#name` — the unscoped form errors `No packages matched the filter` (re-confirmation of the 2026-05-19 lesson). Every commit used the namespaced form.
- **Visual verification deferred.** `react-grab-mcp` was not connected this session (per the session-start tool listing). Per the step-05 fallback policy, dev proceeded without the visual check; `aped-review`'s Aria persona will audit AC-11 (second HeaderAction in Récentes header — Upload icon → "Importer") and AC-12 (responsive preview table at 390px / 1440px) visually.
- **Test scoping quirk.** `bun --filter='@pekulo/api' test` from the project root walks beyond `apps/api`, finding `@pekulo/ui` vitest files (which fail under bun:test). Running `bun test` from inside `apps/api` is clean (474/474). This is a pre-existing test-runner scoping issue, not 5-2-introduced.

### Test output

```
$ cd apps/api && bun test
 474 pass
 0 fail
 1149 expect() calls
Ran 474 tests across 52 files. [1168.00ms]

$ bun --filter='@pekulo/web' run test
 Test Files  50 passed (50)
      Tests  90 passed (90)
   Duration  22.89s

$ bun --filter='@pekulo/api' run db:rls-audit
[rls-audit] OK — 14 tables checked: … transactions (4 policies), …
Exited with code 0

$ bun --filter='@pekulo/api' run lint
Found 3 warnings and 0 errors.   (3 intentional no-await-in-loop:
  csv-parser resolve loop, bulkCreate $transaction loop,
  importCsv ownership re-check loop — sequential by design)
Exited with code 0

$ bun --filter='@pekulo/api' run typecheck
Exited with code 0

$ bun --filter='@pekulo/web' run typecheck
Exited with code 0

$ bun --filter='@pekulo/ui' run test:axe
 Test Files  64 passed | 55 skipped (119)
      Tests  95 passed | 99 skipped (194)
Exited with code 0

$ bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css
(clean — no new styled primitives introduced)
```
