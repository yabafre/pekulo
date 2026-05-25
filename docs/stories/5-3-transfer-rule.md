# Story: 5-3-transfer-rule — Rule-based transfer detection + Transfer badge in Récentes

**Epic:** Epic 5 — Transactions & monthly tracking (V1)
**Status:** review
**Ticket:** [#29](https://github.com/yabafre/pekulo/issues/29)
**Branch:** `feature/29-5-3-transfer-rule`
**Commit prefix:** `feat(#29): …`
**Depends on:** 5-1-transactions-record (done — PR #92, squash `fcfbacc`), 5-2-csv-import (done — PR #96)
**Complexity:** M (bumped from S in epics.md after step-04 decisions: Option B = `transfer_pair_id` column + manual SQL migration + AC-11 delete lifecycle)

## User Story

**As a** Pekulo user (Alex), **I want** my paired transactions (outflow on account A + inflow on account B, same date, same amount, same user) to be auto-tagged as `transfer` by a deterministic rule, and the Récentes list to surface a "⇆ Transfert" badge so I can read paired movements at a glance, **so that** my month-end review treats transfers as movements (not income/spend), the LLM (épic 6) isn't burned on the simplest case, and when I delete one side of a transfer the pair-link is broken cleanly so the orphan reverts to `category=autre`.

## Acceptance Criteria

- **AC-1 (rule match → both rows tagged `transfer` + share a `transferPairId`):** **Given** user A owns `acc_aaa111111111111111111` and `acc_bbb222222222222222222`, AND a transaction `tx_out` already exists for A as `{ accountId: "acc_aaa…", type: "outflow", amount: 120.00, occurredOn: "2026-05-20", category: "autre", transferPairId: null }`, **When** A calls `createTransaction({ accountId: "acc_bbb…", type: "inflow", amount: 120.00, occurredOn: "2026-05-20", category: "autre", label: "Virement épargne", isImprevu: false, notes: null })`, **Then** the service detects the pair, generates a fresh `tp_<21-char-base62>` id, and the repository updates BOTH rows so `category=transfer, transferPairId=<the same tp_… id>`. The LLM is NOT called (épic 6 entry-point is the no-match branch — not hit here). The `createTransaction` response surfaces the updated candidate (`category: "transfer"`, `transferPairId` populated). The pre-existing `tx_out` also reads back with the new tags via a subsequent `getTransaction`.

- **AC-2 (no pair → no override, no pair-id stamp):** **Given** an outflow for A with no inflow sibling that matches (different amount OR different date OR no sibling at all), **When** `createTransaction` runs, **Then** the transaction's `category` stays as the user's input (`autre` stays `autre`), `transferPairId` stays `null`, and no other rows in the user's transactions are modified. 5-3 ships no LLM call ; AC-2's "forwarded to LLM categorisation (épic 6)" reads as: the no-match branch is the entry point épic 6 will wrap — for V1 5-3 it is simply a no-op tail.

- **AC-3 (rule fires on `createTransaction` AND `importCsv` bulk path):** **Given** user A imports a 4-row CSV containing exactly one paired pair (`acc_aaa` outflow 120€ on 2026-05-20 + `acc_bbb` inflow 120€ on 2026-05-20) and 2 non-paired rows (a 42.50€ inflow + a 87.50€ outflow, both on different dates), AND every CSV row defaults to `category=autre` (5-2 default), **When** `importCsv({ rows: [...4 ValidatedCsvRow] })` resolves, **Then** the 2 paired rows land with `category=transfer, transferPairId=<same tp_… id>`, the 2 non-paired rows keep `category=autre, transferPairId=null`. All 4 rows persist atomically via the existing `prisma.$transaction` (5-2 contract preserved — categorisation runs AFTER the bulk insert commits, sequentially per row).

- **AC-4 (user explicit category wins — eligibility = `autre` only):** **Given** Alex creates a transaction with `category=loyer` and a sibling on the other account would otherwise match (same date, same amount, opposite type), **When** `categoriseAfterCreate` runs, **Then** it short-circuits at the eligibility check (`category === "autre"` is FALSE) — no sibling lookup, no pair-id stamp, the row persists with `category=loyer, transferPairId=null`. The sibling on the other account stays UNTOUCHED (no implicit re-pair). User explicit choice always wins.

- **AC-5 (ambiguity → FIFO on `createdAt`):** **Given** user A has 2 unpaired `acc_aaa` outflows of 100€ on 2026-05-20 (both `category=autre, transferPairId=null`) created at `T1` and `T2` (T1 < T2), **When** A creates a 100€ inflow on `acc_bbb` for 2026-05-20, **Then** ONLY the OLDEST unpaired outflow (the one with `createdAt = T1`) is paired with the new inflow ; the `T2` outflow stays `category=autre, transferPairId=null`. Each row pairs at most once. Repository test asserts the `ORDER BY createdAt ASC NULLS LAST` ordering produces this outcome ; if `createdAt` is null (pre-baseline rows — defensive), tie-break on `id ASC`.

- **AC-6 (same account is NOT a transfer):** **Given** an outflow AND an inflow with same date/amount/user but on the SAME `accountId` (`acc_aaa`), **When** the rule runs, **Then** it does NOT pair them. The derive's `accountId: { not: candidate.accountId }` clause filters self-pairs. Repository unit-test covers this case explicitly.

- **AC-7 (cross-user isolation):** **Given** user A's outflow of 120€ on 2026-05-20 AND user B's inflow of 120€ on 2026-05-20 (different `userId`s, but same amount/date/opposite type), **When** A creates a new sibling that would match A's outflow, **Then** the rule pairs A's outflow with A's new inflow — B's row is INVISIBLE to the query (`where: { userId }` + RLS belt + braces). No cross-user leak. Repository test covers this with two users.

- **AC-8 (UI badge in Récentes — inline caption variant):** **Given** the Récentes section renders A's transactions, **When** a row has `tx.category === "transfer"`, **Then** the caption (`tx.account · tx.category`) renders as `{accountLabel} · ⇆ Transfert` — i.e. the existing `TRANSACTION_CATEGORY_LABELS["transfer"]` translation ("Transfert") prefixed by a small `ArrowLeftRight` lucide icon (14 px, `var(--colorTertiary)`, `aria-hidden`). For non-transfer rows, the caption renders unchanged (`{accountLabel} · {category-label}`). Mobile + desktop. TR-strict palette : no emerald, the icon picks `colorTertiary` (neutral grey). The label is decorative (not an interactive element).

- **AC-9 (tag-registry invalidation already covered — no new edge needed):** **Given** `categoriseAfterCreate` updates both pair rows inside the same SA round-trip (`createTransaction` OR `importCsv`), **When** the existing `useActionMutation(action, { invalidateWithTags: [transactionsTags.list()] })` consumers (`use-create-transaction.ts`, `use-import-transactions-csv-form.ts`) succeed, **Then** the tag-registry edge `transactionsTags.list() → [transactionsKeys.list(), accountsKeys.list()]` (shipped by 5-1, untouched here) fires the re-fetch. Both updated rows surface in Récentes with the badge on the next paint. 5-3 introduces NO new tag, NO new SA, NO new hook — every existing wiring carries the new behaviour.

- **AC-10 (pure derive — zero IO + iron-law gates):** **Given** `apps/api/src/common/derive/transfer-rule.ts` exists, **When** the dev runs `grep -nE "(prisma|fetch|http|setTimeout|setInterval|Date\.now|new Date|process\.env|console\.|telemetry|opentelemetry)" apps/api/src/common/derive/transfer-rule.ts`, **Then** the grep returns EMPTY (no DB, no clock, no network, no env, no logger). The co-located unit test (`transfer-rule.test.ts`, `bun:test`) exercises 6 cases : match, no-sibling, wrong-amount, same-account, ambiguous-FIFO, paired-sibling-excluded — exit 0. **And** the full Iron Law gates run green : `bun --filter='@pekulo/api' run lint` → 0 errors ; `… typecheck` → 0 errors ; `… test` → all bun:test suites pass ; `… db:rls-audit` → exit 0, `transactions: 4` unchanged ; `bun --filter=web run typecheck` → 0 errors ; `bun --filter='@pekulo/ui' run test:axe` → 0 axe violations.

- **AC-11 (delete side of paired transfer → dissociate the pair, orphan reverts):** **Given** a paired pair exists `{ tx_A: category=transfer, transferPairId=tp_X }, { tx_B: category=transfer, transferPairId=tp_X }`, **When** user A calls `deleteTransaction({ id: "tx_A" })`, **Then** the service (a) pre-reads tx_A to discover its `transferPairId=tp_X`, (b) calls the repository to update the SIBLING (`tx_B`) → `{ category: "autre", transferPairId: null }`, (c) deletes `tx_A`. Response is `{ ok: true }`. The sibling re-reads as `{ category: "autre", transferPairId: null }`. **And** if the deleted row carried `transferPairId === null` (non-paired transaction), step (a)/(b) are skipped — direct delete via the existing 5-1 path. Integration test covers both branches.

## Tasks

- [x] **T1** — Manual SQL migration `apps/api/prisma/migrations/<TS>_add_transfer_pair_id_to_transactions/migration.sql` to add the `transfer_pair_id` column + index. Apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. [AC: AC-1, AC-3, AC-5, AC-10, AC-11]
- [x] **T2** — Update `apps/api/prisma/schema/transactions.prisma` to declare `transferPairId String? @map("transfer_pair_id")` + add `@@index([userId, transferPairId], map: "transactions_user_pair_idx")`. Regenerate Prisma client. [AC: AC-1, AC-5, AC-11]
- [x] **T3** — Extend `packages/validators/src/transactions/transactions.schemas.ts` with the `"transfer"` enum value + label, the `TRANSFER_PAIR_ID_REGEX`, and the `transferPairId` field on `transactionSchema` (DTO). DO NOT add to `createTransactionInputSchema` or `updateTransactionInputSchema` (system-set only). [AC: AC-1, AC-3, AC-4, AC-8]
- [x] **T4** — Create `apps/api/src/common/derive/transfer-rule.ts` (pure helper) + co-located `transfer-rule.test.ts` (TDD RED then GREEN — 6 cases). [AC: AC-1, AC-5, AC-6, AC-7, AC-10]
- [x] **T5** — Extend `apps/api/src/modules/transactions/transactions.repository.ts` with 3 new methods : `findTransferPairCandidates`, `pairAsTransfer`, `unpairAfterDelete`. Change `bulkCreate` return shape to include the inserted rows (so the service can categorise post-batch). Extend `apps/api/src/modules/transactions/transactions.repository.test.ts` with happy-path + AC-5 FIFO + AC-6 same-account + AC-7 cross-user + AC-11 unpair cases. [AC: AC-1, AC-3, AC-5, AC-6, AC-7, AC-11]
- [x] **T6** — Extend `apps/api/src/modules/transactions/transactions.service.ts` with the `categoriseAfterCreate(userId, candidate)` method + a local `generateTransferPairId()` helper that reuses `@pekulo/api/database#generateBase62Id(21)`. Wire `categoriseAfterCreate` into `createTransaction` (single, post-create re-read) AND into `importCsv` (loop post-bulkCreate). Extend `deleteTransaction` with the AC-11 unpair branch (pre-read pair, unpair sibling, then delete). Extend `apps/api/src/modules/transactions/transactions.service.test.ts` with `categoriseAfterCreate` happy-path, AC-4 eligibility skip, AC-3 bulk path, AC-11 delete-dissociates. [AC: AC-1, AC-3, AC-4, AC-9, AC-11]
- [x] **T7** — Extend `apps/api/src/modules/transactions/transactions.integration.test.ts` with one end-to-end paired-create scenario via the oRPC handler (Elysia + `requireUserId` + service call), asserting both rows read back with `category=transfer, transferPairId=<same>`. [AC: AC-1, AC-3, AC-9]
- [x] **T8** — Web tier — modify `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` to render the `⇆ Transfert` inline icon-prefix on the caption when `tx.category === "transfer"`. Extend the existing a11y test file (`transactions-recent-section.a11y.test.tsx`) with one render-assertion + axe-clean check. [AC: AC-8]
- [x] **T9** — Full Iron Law quality gates : `bun --filter='@pekulo/api' run lint`, `… typecheck`, `… test`, `… db:rls-audit`, `bun --filter=web run typecheck`, `bun --filter='@pekulo/ui' run test:axe`, `git diff --exit-code packages/ui/public/tamagui.generated.css`. Push the branch. [AC: AC-10]

## Dev Notes

### Architecture references

- **Module factory shape (ADR-0009).** No new module — 5-3 extends the existing `apps/api/src/modules/transactions/{transactions.module,transactions.routes,transactions.service,transactions.repository}.ts` shipped by 5-1 + extended by 5-2. The factory still returns `{ service, router }` unchanged ; the dependency list grows by ZERO (the new logic lives inside the service, no new injected probe).
- **Hard layering (ADR-0010).** Component → Hook → Server Action → oRPC client → Elysia handler → service → repository → Prisma. The pair detection is fully server-side and triggered inside existing handlers (`createTransaction` + `importCsv` + `deleteTransaction`). The web tier reads the new `tx.category === "transfer"` and `tx.transferPairId` fields from the DTO ; no new SA, no new hook.
- **Folder-by-domain in packages (R11 — PR #86 audit codification).** Extend the transactions slice in place :
  - `packages/validators/src/transactions/transactions.schemas.ts` — append `"transfer"` to `TRANSACTION_CATEGORIES`, add the `TRANSFER_PAIR_ID_REGEX`, extend `transactionSchema` with the nullable `transferPairId`. NO new files.
  - `packages/types/src/transaction/transaction.types.ts` — already re-exports `Transaction` from `@pekulo/validators` ; the new `transferPairId` field surfaces transitively. NO manual edit needed unless explicitly listed (and T3 doesn't list one).
  - `packages/contracts/src/transactions/transactions.contract.ts` — UNCHANGED. The 7 procedures still consume the same `transactionSchema` DTO ; adding a field to the DTO is a purely additive ABI change for callers.
- **`@pekulo/zod` SOLE zod entry point (R1).** Every new schema use imports `z` from `@pekulo/zod` (already in place in `transactions.schemas.ts`).
- **Defense in depth (ADR-0013).** Every new query in T5 carries explicit `where: { userId }` :
  - `findTransferPairCandidates(userId, candidate)` — `where: { userId, occurredOn, amount, type: oppositeOf(candidate.type), accountId: { not: candidate.accountId }, category: "autre", transferPairId: null }`. Lint rule `pekulo/no-prisma-query-without-user-id` enforces.
  - `pairAsTransfer(userId, candidateId, siblingId, pairId)` — `where: { id: { in: [candidateId, siblingId] }, userId }` (2-row updateMany). AC-7 cross-user proof.
  - `unpairAfterDelete(userId, pairId, idToExclude)` — `where: { userId, transferPairId: pairId, id: { not: idToExclude } }` updateMany (touches only the sibling). AC-11 contract.
- **Cross-aggregate guard (untouched).** `AccountOwnershipProbe.exists` and `AccountResolver.resolve` (5-1 + 5-2) are NOT re-used here. Pair detection works on the transactions table alone — both sides reference the user's own accounts by construction (every row already passed account-ownership at create-time).
- **Prefixed IDs (ADR-0012 — extension).** The new `transferPairId` is NOT a foreign key to a separate model — it's a grouping string on `Transaction`. It does NOT register in `ID_PREFIXES` (which maps **models** to prefixes). The pair-id is generated inside the service via `generateBase62Id(21)` (exported from `apps/api/src/database/base62.ts`) with a literal `tp_` prefix : `\`tp_${generateBase62Id(21)}\``. The shape matches the regex `/^tp_[0-9A-Za-z]{21}$/` enforced by `TRANSFER_PAIR_ID_REGEX` in T3.
- **Decimal → number boundary (L24).** The `amount` field stays `@db.Decimal NOT NULL`. The pair-match WHERE clause compares amount as a JS `number` ; Prisma promotes it to `Decimal` at query time ; equality on `Decimal(N)` is exact for 2-decimal EUR amounts (the only case Pekulo supports at V1). The read-back `toDto` chain continues to coerce via `decimalToNumber(value, fallback)` — `transferPairId` is a String, NO new coercion is added.
- **Atomic persistence (5-2 contract preserved).** `bulkCreate` still wraps the per-row `tx.transaction.create` calls in `prisma.$transaction` — the prefixed-IDs extension fires on each row (ADR-0012). Categorisation runs AFTER the bulk commits (sequential per row) — see T6. If categorisation were to fail per-row, the BULK is already committed — categorisation errors are intentionally non-fatal (log via console.warn for visibility, swallow for the response). This is a deliberate choice : a row with `category=autre, transferPairId=null` is still a valid persisted transaction ; the user can re-pair manually later.
- **Eligibility short-circuit (AC-4).** `categoriseAfterCreate` checks `candidate.category === "autre"` FIRST. Non-autre candidates short-circuit and skip the sibling lookup entirely. This is the AC-4 contract — user-explicit categories always win.
- **Ambiguity → FIFO (AC-5).** The repository query orders siblings by `(createdAt asc, id asc)` (deterministic tiebreak when `createdAt` is null pre-baseline). Service picks `[0]`. Each row pairs at most once (the `transferPairId: null` filter in the sibling query excludes already-paired rows).
- **Manual SQL migrations (ADR-0014 + 2026-05-05 lesson).** T1 hand-writes the SQL ; apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. NO `prisma migrate dev` — Supabase pooler hang precedent. The migration is idempotent (`IF NOT EXISTS` on the column + `IF NOT EXISTS` on the index).
- **L8 Elysia invariant — preserved.** No new annotations ; `transactions.routes.ts` is untouched ; the router type is still inferred via `ReturnType<typeof createTransactionsRouter>`.
- **Tag registry edge (5-1 codified — re-used unchanged).** `transactionsTags.list()` invalidates `transactionsKeys.list()` AND `accountsKeys.list()`. 5-3 introduces no new edge ; the existing one carries the paired-create re-fetch.
- **R12 (2026-05-24 — `defineAction({ tags })` server-only).** No new SA. The existing `use-create-transaction.ts` and `use-import-transactions-csv-form.ts` already declare `invalidateWithTags: [transactionsTags.list()]` on their `useActionMutation` config. UNCHANGED.
- **R13 (2026-05-24 — hydration guard).** `transactions-recent-section.tsx` ships its hydration guard from 5-1 (`isHydrated && isLoading`) — T8 does NOT introduce a new query branch. The badge renders on already-fetched rows, NO new SSR/client divergence.
- **Tamagui CSS regen guard (2026-05-24 lesson).** T8 introduces NO new `styled()` primitive or theme token — it consumes the existing `var(--colorTertiary)` CSS variable + the imported `ArrowLeftRight` lucide icon inline. The Iron Law gate in T9 asserts `git diff --exit-code packages/ui/public/tamagui.generated.css` (must be clean).
- **No `*.types.ts` inside `apps/api/src/modules/transactions/` (L1).** The new `categoriseAfterCreate` method on the service interface lives in `transactions.service.ts` ; the new `SiblingCandidate` interface used by the derive lives co-located in `transfer-rule.ts`. Re-exports of the new DTO field happen transitively via `@pekulo/validators` → `@pekulo/types/transaction/transaction.types.ts`. AC-10 grep guard.

### ADRs in scope

- `docs/adr/0009-elysia-orpc-with-zapaction-bridge.md` — module factory + contract mount. UNCHANGED for 5-3.
- `docs/adr/0010-hooks-orchestration-boundary.md` — hard layering. UNCHANGED for 5-3 (no new hook).
- `docs/adr/0011-packages-reorg-pekulo-namespace.md` — folder-by-domain (R11). T3 extends the validators slice in place.
- `docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md` — schema folder + prefixed-IDs extension. **NOT EXTENDED for `transferPairId`** — the pair-id is a grouping string, NOT a foreign key to a model. Generation reuses `generateBase62Id(21)` from `apps/api/src/database/base62.ts`.
- `docs/adr/0013-prisma-rls-defense-in-depth.md` — explicit `where: { userId }` + lint rule. T5 extends.
- `docs/adr/0014-prisma-migrations.md` — manual SQL migrations. T1 conforms (Supabase pooler hang precedent).

### Lessons re-applied (verbatim scope-list from `docs/lessons.md`)

- **2026-05-25 (Scope: aped-arch, aped-dev, aped-review) — Optimistic `onMutate` is opt-in.** 5-3 introduces ZERO new mutation hook. The pair-categorisation surfaces via the existing tag-registry invalidation when the user CREATEs a transaction (single or via CSV). AC-1/AC-3/AC-9 deliberately describe "the next paint after the SA round-trip" — NO wall-clock promise.
- **2026-05-24 (Scope: aped-arch, aped-dev, aped-review) — Hydration mismatch on `useActionQuery.isLoading`.** N/A for the new UI work — the badge renders on already-fetched rows. The recent-section's existing hydration guard (5-1) is preserved.
- **2026-05-24 (Scope: aped-arch, aped-dev, aped-review) — `defineAction({ tags })` is server-only.** N/A — no new SA. The existing `createTransaction` + `importCsv` SAs in `_actions/transactions-actions.ts` are UNCHANGED.
- **2026-05-24 (Scope: aped-arch, aped-dev, aped-review, aped-debug) — Tamagui CSS regen guard.** T8 introduces NO new primitive ; T9 asserts `git diff --exit-code packages/ui/public/tamagui.generated.css` (clean).
- **2026-05-20 (Scope: aped-arch, aped-dev, aped-review) — Hooks under `apps/web/src/app/**/_hooks/` MUST consume ZapAction (R3/R4).** N/A — no new hook.
- **2026-05-20 (Scope: aped-arch, aped-dev, aped-review) — `defineAction` with discriminated-union output: OMIT `output:`.** N/A — no new SA.
- **2026-05-20 (Scope: aped-dev, aped-qa, aped-review) — Vitest `vi.mock` factory is HOISTED ; use `vi.hoisted`.** T8 extends an existing test (`transactions-recent-section.a11y.test.tsx`) which already imports `vi.hoisted` for its mocks. NEW additions follow the same pattern.
- **2026-05-20 (Scope: aped-dev, aped-qa, aped-review) — `fireEvent.submit(form)` over `fireEvent.click(button)` in vitest form tests.** N/A — T8's added assertion is a render check, not a form submit.
- **2026-05-19 (Scope: aped-story, aped-dev, aped-review) — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`).** Every command in this story uses the full quoted namespace.
- **2026-05-17 (Scope: aped-story, aped-arch, aped-dev) — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`.** Cross-checked : `docs/ux-preview/src/App.tsx` `TransactionsScreen` L1284 + `ActivityRow` L1099 — no existing "Transfer" badge in the proto (transfers are a forward concept). 5-3 introduces the affordance — design freedom. Decision = inline icon-prefix on the caption (Trade Republic doesn't render this either since TR is single-broker — Pekulo's multi-account scope warrants it).
- **2026-05-17 (Scope: aped-dev, aped-review) — Per-row CRUD actions on mobile hide behind a kebab menu.** N/A for 5-3 — the badge is a read-only display.
- **2026-05-17 (Scope: aped-dev, aped-arch, aped-review) — Tamagui v5 media keys = sm:640 md:768 lg:1024 xl:1280.** N/A for T8 (the badge renders identically on mobile + desktop, no `$lg` split needed).
- **2026-05-09 (Scope: aped-arch, aped-dev, aped-review) — Zero `*.types.ts` files inside `apps/api/src/modules/**`.** `SiblingCandidate` interface co-located in `transfer-rule.ts` ; `categoriseAfterCreate` signature on the `TransactionsService` interface co-located in `transactions.service.ts`. AC-10 grep guard.
- **2026-05-07 (Scope: aped-dev, aped-review) — `bun test` (apps/api) ≠ `vitest run` (apps/web).** New api tests import from `"bun:test"` ; web test extensions use `vitest`.
- **2026-05-07 (Scope: aped-dev, aped-arch, aped-review) — Domain types in `@pekulo/types` ; `@pekulo/ui` for component code only.** The new `transferPairId` field on the DTO surfaces from `@pekulo/validators` → `@pekulo/types` transitively.
- **2026-05-05 (Scope: aped-dev) — `bun --cwd <relative>` silently fails.** Every command uses `bun --filter='@pekulo/api' run …`.
- **2026-05-05 (Scope: aped-dev, aped-arch) — Manual SQL migrations preferred over `prisma migrate dev`.** T1 hand-writes the SQL ; idempotent ; applied via `prisma:migrate:deploy`.
- **2026-05-04 (Scope: aped-arch, aped-dev, aped-review) — Elysia 1.4 `Elysia` type is invariant.** N/A — `transactions.routes.ts` is UNCHANGED.
- **2026-05-04 (Scope: aped-arch, aped-dev, aped-review) — `Number(decimal)` silently truncates.** Pair-match equality compares `amount: number` → Prisma promotes to Decimal → exact match for 2-decimal EUR. NO new boundary.
- **Story 5-1 outcome — cross-aggregate guard via injected probe.** Untouched ; not re-used by 5-3.
- **Story 5-2 outcome — `AccountOwnershipProbe.existsMany` (bulk variant).** Untouched ; not re-used by 5-3.
- **Story 5-2 outcome — `lastPreviewedText` invariant on preview→confirm UI flows.** N/A for 5-3 (no new UI flow).

### Step-0 quotes (verbatim current state at story-write time)

#### `packages/validators/src/transactions/transactions.schemas.ts` (current — head + DTO)

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
  "salaire",
  "freelance",
  "remote",
  "bonus",
  "loyer",
  "courses",
  "transport",
  "sorties",
  "voyage",
  "sante",
  "imprevu",
  "autre",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> =
  {
    salaire: "Salaire",
    freelance: "Freelance",
    remote: "Remote",
    bonus: "Bonus",
    loyer: "Loyer",
    courses: "Courses",
    transport: "Transport",
    sorties: "Sorties",
    voyage: "Voyage",
    sante: "Santé",
    imprevu: "Imprévu",
    autre: "Autre",
  };
```

> 5-3 changes (T3): APPEND `"transfer"` as the 13th entry in `TRANSACTION_CATEGORIES` ; APPEND `transfer: "Transfert"` to `TRANSACTION_CATEGORY_LABELS`. Both arrays/objects literal — `as const` preserved.

```ts
// ─── DTO (row shape returned by reads) ───────────────────────────────────
export const transactionSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
  accountId: z.string().regex(ACCOUNT_ID_REGEX),
  occurredOn: isoDateString(),
  label: z.string().min(1).max(120),
  amount: amountSchema(),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;
```

> 5-3 changes (T3): ADD `transferPairId: z.string().regex(TRANSFER_PAIR_ID_REGEX).nullable()` BEFORE the `createdAt` field. ADD `TRANSFER_PAIR_ID_REGEX = /^tp_[0-9A-Za-z]{21}$/` to the `// ─── ID regexes ───` block, alongside `TRANSACTION_ID_REGEX` and `ACCOUNT_ID_REGEX`. **DO NOT** add `transferPairId` to `createTransactionInputSchema` or `updateTransactionInputSchema` — system-set only.

#### `apps/api/prisma/schema/transactions.prisma` (current)

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

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")
  @@map("transactions")
}
```

> 5-3 changes (T2): ADD `transferPairId String? @map("transfer_pair_id")` BETWEEN `notes` and `createdAt`. ADD `@@index([userId, transferPairId], map: "transactions_user_pair_idx")` after the two existing indices. Header comment SHOULD be extended : `// transferPairId: TEXT, nullable — pair grouping for FR-30 transfers (story 5-3).`

#### `apps/api/src/modules/transactions/transactions.service.ts` (current — full surface)

```ts
// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (stories 5-1 + 5-2).
//
// Cross-aggregate guards (defense in depth, ADR-0013):
//   - AccountOwnershipProbe.exists(userId, accountId) pre-flights BEFORE
//     create (always) and BEFORE update (only when the patch carries
//     accountId — mirrors 3-1's policy). Re-applied per-row inside importCsv
//     even though the resolver in previewImportCsv already filtered.
//   - AccountResolver.resolve(userId, label) maps CSV `account-label` to an
//     account id, scoped to the calling user (RLS + explicit where).
//
// Errors:
//   - ACCOUNT_NOT_FOUND  (../accounts/accounts.errors)
//   - TRANSACTION_NOT_FOUND (./transactions.errors)
//   - TRANSACTION_FAILED (bulk-insert rollback surfaced from $transaction)

import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  GetTransactionInput,
  ImportCsvInput,
  ImportCsvOutput,
  ListTransactionsInput,
  ListTransactionsOutput,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import { accountNotFound } from "../accounts/accounts.errors";
import { PekuloError } from "../../common/errors";
import { parseCsvForPreview, type AccountResolver } from "./services/csv-parser";
import { transactionNotFound } from "./transactions.errors";
import type { TransactionsRepository } from "./transactions.repository";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
  existsMany(userId: string, accountIds: string[]): Promise<Set<string>>;
}

export type { AccountResolver };

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  previewImportCsv(userId: string, input: PreviewImportCsvInput): Promise<PreviewImportCsvOutput>;
  importCsv(userId: string, input: ImportCsvInput): Promise<ImportCsvOutput>;
}
```

> 5-3 changes (T6):
> - ADD a new method to the `TransactionsService` interface : `categoriseAfterCreate(userId: string, candidate: Transaction): Promise<Transaction>` (returns the candidate possibly updated with `category="transfer", transferPairId=tp_…`).
> - ADD a private helper `generateTransferPairId(): string` returning `\`tp_${generateBase62Id(21)}\`` (import `generateBase62Id` from `"../../database"`).
> - WIRE `categoriseAfterCreate` into `createTransaction` AFTER `repository.create` returns ; the response is the categorised candidate. The pair row is updated as a side-effect (the caller doesn't see it, but the next `listTransactions` does).
> - WIRE `categoriseAfterCreate` into `importCsv` AFTER `repository.bulkCreate` returns ; iterate `bulkCreate.rows` and call `categoriseAfterCreate(userId, row)` for each (sequential — see Architecture). Categorisation failures are caught + console.warn'd, never throw (the bulk is already committed).
> - EXTEND `deleteTransaction` : pre-read the row via `repository.findByIdForUser` ; if `transferPairId !== null`, call `repository.unpairAfterDelete(userId, transferPairId, id)` BEFORE the delete. The delete proceeds via the existing `repository.delete` path.

#### `apps/api/src/modules/transactions/transactions.repository.ts` (current — interface + create + bulkCreate)

```ts
export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  bulkCreate(userId: string, rows: ValidatedCsvRow[]): Promise<{ persisted: number }>;
}
```

> 5-3 changes (T5):
> - CHANGE `bulkCreate` return shape : `Promise<{ persisted: number; rows: Transaction[] }>` — the service needs the inserted rows (with system-generated `id`s) to categorise them post-batch.
> - ADD 3 new methods to the interface :
>   - `findTransferPairCandidates(userId: string, candidate: { accountId: string; occurredOn: string; amount: number; type: "inflow" | "outflow" }): Promise<Transaction[]>` — returns rows matching the pair criteria (opposite type, same date/amount, different account, `category="autre"`, `transferPairId=null`, same user). Ordered FIFO by `(createdAt asc, id asc)`.
>   - `pairAsTransfer(userId: string, candidateId: string, siblingId: string, pairId: string): Promise<void>` — 2-row `updateMany` setting `category="transfer", transferPairId=pairId` where `id IN (candidateId, siblingId) AND userId = ?`.
>   - `unpairAfterDelete(userId: string, pairId: string, idToExclude: string): Promise<void>` — `updateMany` setting `category="autre", transferPairId=null` where `userId = ? AND transferPairId = pairId AND id != idToExclude`. (Touches only the sibling row.)

#### `apps/api/src/modules/transactions/transactions.repository.ts` (current — `toDto`)

```ts
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
```

> 5-3 changes (T5):
> - EXTEND `TransactionRow` (local type alias L33) : ADD `transferPairId: string | null` between `notes` and `createdAt`.
> - EXTEND `toDto` : ADD `transferPairId: row.transferPairId,` between `notes` and `createdAt` in the returned object literal.

#### `apps/api/src/modules/transactions/transactions.repository.ts` (current — bulkCreate body)

```ts
    async bulkCreate(userId, rows) {
      // Story 5-2 T6. Interactive `$transaction` + per-row `tx.transaction.create`
      // (NOT `createMany`) so the prefixed-ids extension fires on every row
      // (ADR-0012). All-or-nothing — Prisma rolls back the batch if any row
      // throws (FK violation, NOT-NULL, etc.). The `as unknown as …` bridge
      // mirrors the single-row create branch above.
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

> 5-3 changes (T5): Capture every `tx.transaction.create(...)` return value (cast to `TransactionRow`) into a local `inserted: TransactionRow[] = []` ; after the `$transaction` resolves, map each to `toDto(row)` and return `{ persisted, rows: inserted.map(toDto) }`.

#### `apps/api/src/modules/transactions/transactions.service.ts` (current — `createTransaction` body)

```ts
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound();
      return deps.repository.create(userId, input);
    },
```

> 5-3 changes (T6): Replace the `return deps.repository.create(userId, input);` with :
> ```ts
> const created = await deps.repository.create(userId, input);
> return this.categoriseAfterCreate(userId, created);
> ```
> Note : `this` is the closure-captured service instance — JS arrow functions DO NOT have lexical `this` BUT the factory returns a plain object literal where the methods are defined as async function expressions, so `this` resolves to the returned object. To avoid the `this` trap, the implementation MUST capture the service into a `const self = { … }` pattern OR extract the categorise routine into a free helper (the latter is the recommended path — see T6's Full code block below).

#### `apps/api/src/modules/transactions/transactions.service.ts` (current — `deleteTransaction` body)

```ts
    async deleteTransaction(userId, input) {
      const { deleted } = await deps.repository.delete(userId, input);
      if (!deleted) throw transactionNotFound(input.id);
      return { ok: true } as const;
    },
```

> 5-3 changes (T6): Replace with :
> ```ts
> // AC-11 — break the pair before deleting. Pre-read so we know if the
> // candidate carries a transferPairId ; if so, unpair the sibling.
> // The `update + delete` ordering matters : unpair FIRST (a partially
> // deleted state where the sibling still references a now-gone pair
> // would surface as an orphan with `category=transfer, transferPairId=tp_dead`).
> const row = await deps.repository.findByIdForUser(userId, input.id);
> if (!row) throw transactionNotFound(input.id);
> if (row.transferPairId !== null) {
>   await deps.repository.unpairAfterDelete(userId, row.transferPairId, input.id);
> }
> const { deleted } = await deps.repository.delete(userId, input);
> if (!deleted) throw transactionNotFound(input.id);
> return { ok: true } as const;
> ```

#### `apps/api/src/modules/transactions/transactions.service.ts` (current — `importCsv` body — full)

```ts
    async importCsv(userId, input) {
      // AC-8 — defense in depth: re-check every account ownership even though
      // the resolver in previewImportCsv already filtered. The client could
      // have tampered with the rows array between preview and import. Bulk
      // probe via existsMany so 1000 rows referencing K unique accounts cost
      // one round-trip, not N (aped-review N2).
      const uniqueIds = Array.from(new Set(input.rows.map((r) => r.accountId)));
      const owned = await deps.accountOwnershipProbe.existsMany(userId, uniqueIds);
      for (const id of uniqueIds) {
        if (!owned.has(id)) throw accountNotFound();
      }
      try {
        const { persisted } = await deps.repository.bulkCreate(userId, input.rows);
        return { ok: true as const, persisted };
      } catch (err) {
        // Bulk-insert rollback surfaces as TRANSACTION_FAILED (mapper → 500).
        // The accountNotFound thrown by the pre-flight loop is intentionally
        // NOT caught here — it bubbles to the route handler unchanged.
        if (err instanceof PekuloError) throw err;
        throw new PekuloError(
          "TRANSACTION_FAILED",
          err instanceof Error ? err.message : "bulk insert failed",
        );
      }
    },
```

> 5-3 changes (T6): Replace the `bulkCreate` call + return with :
> ```ts
> try {
>   const { persisted, rows } = await deps.repository.bulkCreate(userId, input.rows);
>   // Categorise AFTER the bulk commits. Sequential per-row — pair detection
>   // depends on already-persisted siblings. Failures are non-fatal (the row
>   // is still valid with category=autre) ; log via console.warn for visibility.
>   for (const row of rows) {
>     try {
>       await categoriseAfterCreateImpl({ userId, candidate: row, repository: deps.repository });
>     } catch (err) {
>       console.warn(
>         `[5-3] categoriseAfterCreate failed for tx ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
>       );
>     }
>   }
>   return { ok: true as const, persisted };
> } catch (err) {
>   // Bulk-insert rollback (UNCHANGED from 5-2 contract).
>   if (err instanceof PekuloError) throw err;
>   throw new PekuloError(
>     "TRANSACTION_FAILED",
>     err instanceof Error ? err.message : "bulk insert failed",
>   );
> }
> ```

#### `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` (current — row render)

```tsx
          {items.map((tx) => {
            const activity: Activity = {
              label: tx.label,
              account: accountLabelById.get(tx.accountId) ?? "—",
              category: TRANSACTION_CATEGORY_LABELS[tx.category],
              direction: tx.type === "inflow" ? "in" : "out",
              amountEur: tx.amount,
            };
            return (
              <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
                <View flex={1} minWidth={0}>
                  <PekuloActivityRow tx={activity} />
                </View>
                {/* row actions … */}
              </View>
            );
          })}
```

> 5-3 changes (T8): the badge is a caption-prefix produced INLINE — there is no API change on `PekuloActivityRow` (the `tx.category` field already lands in the caption). The 5-3 implementation builds the `activity.category` value with an icon-prefix glyph when `tx.category === "transfer"`. Three approaches were considered :
>
> 1. **Append a string glyph `"⇆ Transfert"`** — works but the `⇆` glyph (`⇆`) is decorative, not announced to screen readers (good — `aria-hidden` semantics are implicit on text).
> 2. **Inject a React node** — not possible because `Activity.category` is `string` (typed in `packages/types/src/transaction/transaction.types.ts:37`).
> 3. **Extend `PekuloActivityRow` props** — out of scope (would force a Tamagui CSS regen + DS test churn).
>
> The story SHIPS approach 1 : `TRANSACTION_CATEGORY_LABELS["transfer"]` is set to `"⇆ Transfert"` (T3 — the glyph is part of the label, NOT the layout). This keeps the badge inside the existing caption render path. NO change to `PekuloActivityRow`.

## File List

Files this story creates or modifies. Each carries the 3-bullet decision template :

1. `apps/api/prisma/migrations/<TS>_add_transfer_pair_id_to_transactions/migration.sql` *(create)*
   - **Single responsibility** — declare the `transfer_pair_id TEXT` column on `public.transactions` + a `(user_id, transfer_pair_id)` index. Idempotent (`IF NOT EXISTS`).
   - **Inputs/outputs** — SQL applied by `bun --filter='@pekulo/api' run prisma:migrate:deploy` against the live Supabase DB.

2. `apps/api/prisma/schema/transactions.prisma` *(modify)*
   - **Single responsibility** — Prisma model declaration for `Transaction`.
   - **Inputs/outputs** — re-generated client in `node_modules/@generated/prisma/`.

3. `packages/validators/src/transactions/transactions.schemas.ts` *(modify)*
   - **Single responsibility** — Zod source of truth for the transactions aggregate.
   - **Inputs/outputs** — types/regex consumed by api + web. 5-3 appends `"transfer"` to the enum, the regex, and the DTO.

4. `apps/api/src/common/derive/transfer-rule.ts` *(create)* + `transfer-rule.test.ts` *(create)*
   - **Single responsibility** — pure account-pair-match decision (no DB, no clock, no network).
   - **Inputs/outputs** — `detectTransferPair({ candidate, siblings }): { pair: SiblingCandidate | null }`. Used by `transactions.service.ts`.

5. `apps/api/src/modules/transactions/transactions.repository.ts` *(modify)* + `transactions.repository.test.ts` *(extend)*
   - **Single responsibility** — Prisma access layer for the transactions aggregate. Defense-in-depth `userId` discipline.
   - **Inputs/outputs** — 3 new methods (`findTransferPairCandidates`, `pairAsTransfer`, `unpairAfterDelete`) + `bulkCreate` return shape extended to surface inserted rows.

6. `apps/api/src/modules/transactions/transactions.service.ts` *(modify)* + `transactions.service.test.ts` *(extend)*
   - **Single responsibility** — business orchestration for the transactions aggregate.
   - **Inputs/outputs** — new `categoriseAfterCreate` method + lifecycle wires into `createTransaction` / `importCsv` / `deleteTransaction`. Local `generateTransferPairId()` helper.

7. `apps/api/src/modules/transactions/transactions.integration.test.ts` *(extend)*
   - **Single responsibility** — oRPC HTTP boundary contract tests.
   - **Inputs/outputs** — new test case for the end-to-end paired-create scenario.

8. `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` *(modify)* + `transactions-recent-section.a11y.test.tsx` *(extend)*
   - **Single responsibility** — render the Récentes section list with per-row action affordances.
   - **Inputs/outputs** — consumes `useTransactions()` ; renders rows ; surfaces the transfer-caption via `TRANSACTION_CATEGORY_LABELS["transfer"]`.

### Task-by-task implementation code

#### T1 — Manual SQL migration : add `transfer_pair_id` column + index

Create `apps/api/prisma/migrations/<TS>_add_transfer_pair_id_to_transactions/migration.sql` where `<TS>` is `date +%Y%m%d%H%M%S` at the moment of creation (lesson 2026-05-05 — manual SQL migrations). The file MUST be the only content of a new directory under `apps/api/prisma/migrations/`. The migration is idempotent (`IF NOT EXISTS` on both column and index).

**File: `apps/api/prisma/migrations/<TS>_add_transfer_pair_id_to_transactions/migration.sql`**

```sql
-- 5-3-transfer-rule — add transfer_pair_id grouping column to public.transactions.
-- Pair-link is a nullable TEXT column ; both rows of a transfer share the same
-- `tp_<base62>` value, generated by the service (apps/api/src/modules/transactions/
-- transactions.service.ts#generateTransferPairId). NOT a foreign key — ADR-0012
-- prefixed-IDs is for models, not grouping columns.
--
-- Hand-written (Supabase pooler hang on `prisma migrate dev` — ADR-0014). Apply
-- via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent via
-- Prisma's _prisma_migrations registry + IF NOT EXISTS guards below — safe to
-- re-run by hand if the registry is reset.
--
-- Touched table: public.transactions. RLS policies preserved verbatim (no
-- DROP/CREATE) — db:rls-audit asserts `transactions: 4` post-deploy. AC-10.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — add the nullable transfer_pair_id column.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "transfer_pair_id" TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — index on (user_id, transfer_pair_id) for the unpair-after-delete
-- path (find sibling by pair). The cardinality is low (most rows are NULL),
-- the index is partial-friendly but Postgres' B-tree handles NULLs natively.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "transactions_user_pair_idx"
  ON "transactions" ("user_id", "transfer_pair_id");

COMMIT;
```

Run: `bun --filter='@pekulo/api' run prisma:migrate:deploy`
Expected: prisma logs `Applying migration <TS>_add_transfer_pair_id_to_transactions` then `1 migration applied`. Exit 0.

Verify post-deploy : `bun --filter='@pekulo/api' run db:rls-audit` → exit 0, `transactions: 4` unchanged.

Commit: `git add apps/api/prisma/migrations/<TS>_add_transfer_pair_id_to_transactions/ && git commit -m "feat(#29): T1 — manual SQL migration add transfer_pair_id column + index"`

---

#### T2 — Prisma schema folder declaration

Replace the model body in `apps/api/prisma/schema/transactions.prisma`. The header comment is bumped to reflect the new column.

**File: `apps/api/prisma/schema/transactions.prisma` (full replacement)**

```prisma
// transactions.prisma — Transaction model (story 5-1 + 5-3).
// id: TEXT, no @default — prefixed-ids extension injects `tx_<base62>`.
// account_id: NOT NULL FK to accounts(id) with ON DELETE CASCADE.
// transfer_pair_id: TEXT, nullable — pair grouping for FR-30 transfers
//   (story 5-3). Both rows of a transfer share the same `tp_<base62>` value,
//   generated by the service. NOT a foreign key — ADR-0012 prefixed-IDs is
//   for models, not grouping columns.

model Transaction {
  id             String          @id
  userId         String          @map("user_id") @db.Uuid
  accountId      String          @map("account_id")
  occurredOn     DateTime        @map("occurred_on") @db.Date
  label          String
  amount         Decimal         @db.Decimal
  type           TransactionType
  category       String
  isImprevu      Boolean         @default(false) @map("is_imprevu")
  notes          String?
  transferPairId String?         @map("transfer_pair_id")
  createdAt      DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")
  @@index([userId, transferPairId], map: "transactions_user_pair_idx")
  @@map("transactions")
}
```

Run: `bun --filter='@pekulo/api' run prisma:generate`
Expected: prisma logs `✔ Generated Prisma Client`. Exit 0.

Commit: `git add apps/api/prisma/schema/transactions.prisma && git commit -m "feat(#29): T2 — declare transferPairId field + (userId, transferPairId) index"`

---

#### T3 — Validators : add `"transfer"` enum + regex + DTO field

Apply 4 edits to `packages/validators/src/transactions/transactions.schemas.ts`.

**Edit 1** — append `"transfer"` to `TRANSACTION_CATEGORIES` array (L12-25). Final array reads :

```ts
export const TRANSACTION_CATEGORIES = [
  "salaire",
  "freelance",
  "remote",
  "bonus",
  "loyer",
  "courses",
  "transport",
  "sorties",
  "voyage",
  "sante",
  "imprevu",
  "autre",
  "transfer",
] as const;
```

**Edit 2** — append the label to `TRANSACTION_CATEGORY_LABELS` (L27-41). Final object reads :

```ts
export const TRANSACTION_CATEGORY_LABELS: Record<(typeof TRANSACTION_CATEGORIES)[number], string> =
  {
    salaire: "Salaire",
    freelance: "Freelance",
    remote: "Remote",
    bonus: "Bonus",
    loyer: "Loyer",
    courses: "Courses",
    transport: "Transport",
    sorties: "Sorties",
    voyage: "Voyage",
    sante: "Santé",
    imprevu: "Imprévu",
    autre: "Autre",
    transfer: "⇆ Transfert",
  };
```

The glyph `⇆` (U+21C6) is part of the label — the UI does NOT inject it ; the badge inherits from the centralised label map so the same source-of-truth covers other screens (Mensuel, future reports).

**Edit 3** — add the `TRANSFER_PAIR_ID_REGEX` to the `// ─── ID regexes ───` block (alongside L50-51 :

```ts
// ─── ID regexes ───────────────────────────────────────────────────────────
const TRANSACTION_ID_REGEX = /^tx_[0-9A-Za-z]{21}$/;
const ACCOUNT_ID_REGEX = /^acc_[0-9A-Za-z]{21}$/;
const TRANSFER_PAIR_ID_REGEX = /^tp_[0-9A-Za-z]{21}$/;
```

**Edit 4** — extend `transactionSchema` (L73-84) to include `transferPairId` between `notes` and `createdAt` :

```ts
export const transactionSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX),
  accountId: z.string().regex(ACCOUNT_ID_REGEX),
  occurredOn: isoDateString(),
  label: z.string().min(1).max(120),
  amount: amountSchema(),
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  isImprevu: z.boolean(),
  notes: z.string().max(500).nullable(),
  transferPairId: z.string().regex(TRANSFER_PAIR_ID_REGEX).nullable(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;
```

**DO NOT** add `transferPairId` to `createTransactionInputSchema` (L88-97) or `updateTransactionInputSchema` (L100-118) — it is system-set only. The user never specifies it on the wire.

Run: `bun --filter='@pekulo/validators' run typecheck`
Expected: tsc exits 0, no error.

Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(#29): T3 — add 'transfer' category + TRANSFER_PAIR_ID_REGEX + transferPairId on DTO"`

---

#### T4 — Pure derive : `transfer-rule.ts` (TDD RED then GREEN)

Create the test file FIRST (RED), then implement (GREEN). Pure module — zero IO. AC-10 grep guard.

**File: `apps/api/src/common/derive/transfer-rule.test.ts`**

```ts
// apps/api/src/common/derive/transfer-rule.test.ts
// bun:test — TDD for the pure account-pair-match derive (story 5-3 — FR-30).
//
// 6 cases:
//   - match (same date/amount, opposite type, different account, both autre+unpaired) → pair
//   - no-sibling                                                                       → null
//   - wrong-amount (50.00 vs 50.01)                                                    → null
//   - same-account                                                                     → null
//   - ambiguous → returns the OLDEST unpaired sibling (FIFO via input ordering)        → pair
//   - paired-sibling-excluded (a sibling already has transferPairId set is not chosen) → null
//     (the repository filters those out upstream; the derive's contract is that
//      the `siblings` input is already-filtered — the derive doesn't re-check
//      `transferPairId` itself. This test asserts the contract by passing only
//      unpaired siblings, and a separate test passes a "no-eligible" empty list.)

import { describe, expect, test } from "bun:test";
import { detectTransferPair, type SiblingCandidate } from "./transfer-rule";

const candidateOut: SiblingCandidate = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-20",
  amount: 120.0,
  type: "outflow",
};

const siblingIn = (over: Partial<SiblingCandidate> = {}): SiblingCandidate => ({
  id: "tx_bbbbbbbbbbbbbbbbbbbbb",
  accountId: "acc_bbb222222222222222222",
  occurredOn: "2026-05-20",
  amount: 120.0,
  type: "inflow",
  ...over,
});

describe("detectTransferPair (derive)", () => {
  test("match — same date/amount, opposite type, different account → returns the sibling", () => {
    const out = detectTransferPair({ candidate: candidateOut, siblings: [siblingIn()] });
    expect(out.pair).not.toBeNull();
    expect(out.pair?.id).toBe("tx_bbbbbbbbbbbbbbbbbbbbb");
  });

  test("no-sibling — empty siblings array → null", () => {
    const out = detectTransferPair({ candidate: candidateOut, siblings: [] });
    expect(out.pair).toBeNull();
  });

  test("wrong-amount — 120.00 vs 120.01 → null", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ amount: 120.01 })],
    });
    expect(out.pair).toBeNull();
  });

  test("same-account — sibling on same accountId → null (a transfer must cross accounts)", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ accountId: "acc_aaa111111111111111111" })],
    });
    expect(out.pair).toBeNull();
  });

  test("wrong-date — siblings on different occurredOn → null", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ occurredOn: "2026-05-21" })],
    });
    expect(out.pair).toBeNull();
  });

  test("same-type — both outflow → null (a transfer requires opposite types)", () => {
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [siblingIn({ type: "outflow" })],
    });
    expect(out.pair).toBeNull();
  });

  test("ambiguous → returns the FIRST sibling in the input order (FIFO contract — caller orders)", () => {
    const oldest = siblingIn({ id: "tx_ccccccccccccccccccccc" });
    const younger = siblingIn({ id: "tx_dddddddddddddddddddddd" });
    const out = detectTransferPair({
      candidate: candidateOut,
      siblings: [oldest, younger],
    });
    expect(out.pair?.id).toBe("tx_ccccccccccccccccccccc");
  });
});
```

**File: `apps/api/src/common/derive/transfer-rule.ts`**

```ts
// apps/api/src/common/derive/transfer-rule.ts
// Pure account-pair-match decision for the transfer-rule (story 5-3, FR-30).
//
// Inputs by argument only. Zero DB / network / clock / telemetry imports
// (AC-10 grep guard — see story file for the literal token list).
//
// The repository upstream is responsible for filtering siblings to those that
// are PAIR-ELIGIBLE :
//   - same user (RLS + explicit where: { userId })
//   - opposite type
//   - same occurredOn (date)
//   - same amount
//   - different accountId
//   - category = "autre"
//   - transferPairId = null
// AND for ordering FIFO by (createdAt asc, id asc) so that this derive picks
// the OLDEST unpaired sibling on ambiguity.
//
// This derive applies the structural pair-match (defensive duplicate of the
// SQL WHERE clause — guards against a future caller passing pre-filtered but
// inexact siblings) and returns the first match or null.

export interface SiblingCandidate {
  id: string;
  accountId: string;
  occurredOn: string;
  amount: number;
  type: "inflow" | "outflow";
}

export interface DetectTransferPairInput {
  candidate: SiblingCandidate;
  siblings: SiblingCandidate[];
}

export interface DetectTransferPairOutput {
  pair: SiblingCandidate | null;
}

function oppositeType(t: "inflow" | "outflow"): "inflow" | "outflow" {
  return t === "inflow" ? "outflow" : "inflow";
}

export function detectTransferPair(input: DetectTransferPairInput): DetectTransferPairOutput {
  const { candidate, siblings } = input;
  const wanted = oppositeType(candidate.type);
  for (const s of siblings) {
    if (s.id === candidate.id) continue; // safety — never pair a row with itself
    if (s.type !== wanted) continue;
    if (s.occurredOn !== candidate.occurredOn) continue;
    if (s.amount !== candidate.amount) continue;
    if (s.accountId === candidate.accountId) continue;
    return { pair: s };
  }
  return { pair: null };
}
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/common/derive/transfer-rule.test.ts`
Expected: `7 pass` (the 7 test() blocks above). Exit 0.

Run the grep guard : `grep -nE "(prisma|fetch|http|setTimeout|setInterval|Date\.now|new Date|process\.env|console\.|telemetry|opentelemetry)" apps/api/src/common/derive/transfer-rule.ts`
Expected: empty output. Exit 1 (grep returns 1 on no match — that's the green signal).

Commit: `git add apps/api/src/common/derive/transfer-rule.ts apps/api/src/common/derive/transfer-rule.test.ts && git commit -m "feat(#29): T4 — pure detectTransferPair derive + 7 test cases"`

---

#### T5 — Repository : `findTransferPairCandidates` + `pairAsTransfer` + `unpairAfterDelete` + extend `bulkCreate` return shape + `toDto`

Apply the edits below to `apps/api/src/modules/transactions/transactions.repository.ts`.

**Edit 1** — extend the local `TransactionRow` type alias (L32-45) :

```ts
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
  transferPairId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
```

**Edit 2** — extend `toDto` to include `transferPairId` (L58-71) :

```ts
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
    transferPairId: row.transferPairId,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}
```

**Edit 3** — extend the `TransactionsRepository` interface (L49-56) with 3 new methods + the `bulkCreate` return change :

```ts
export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  bulkCreate(
    userId: string,
    rows: ValidatedCsvRow[],
  ): Promise<{ persisted: number; rows: Transaction[] }>;
  findTransferPairCandidates(
    userId: string,
    candidate: {
      accountId: string;
      occurredOn: string;
      amount: number;
      type: "inflow" | "outflow";
    },
  ): Promise<Transaction[]>;
  pairAsTransfer(
    userId: string,
    candidateId: string,
    siblingId: string,
    pairId: string,
  ): Promise<void>;
  unpairAfterDelete(userId: string, pairId: string, idToExclude: string): Promise<void>;
}
```

**Edit 4** — update the `bulkCreate` implementation (L199-225) to capture every inserted row :

```ts
    async bulkCreate(userId, rows) {
      // Story 5-2 T6 + 5-3 T5. Interactive `$transaction` + per-row
      // `tx.transaction.create` (NOT `createMany`) so the prefixed-ids
      // extension fires on every row (ADR-0012). All-or-nothing — Prisma
      // rolls back the batch if any row throws. The `as unknown as …`
      // bridge mirrors the single-row create branch above. 5-3 extension:
      // capture every inserted row so the service can categorise post-batch.
      const inserted: TransactionRow[] = [];
      await deps.client.$transaction(async (tx) => {
        for (const row of rows) {
          const created = (await tx.transaction.create({
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
          })) as TransactionRow;
          inserted.push(created);
        }
      });
      return { persisted: inserted.length, rows: inserted.map(toDto) };
    },
```

**Edit 5** — add the 3 new methods at the end of the `createTransactionsRepository` factory's return object (just before the closing `};`) :

```ts
    async findTransferPairCandidates(userId, candidate) {
      // 5-3 — pair eligibility query. Filter to opposite type, same date,
      // same amount, different account, category=autre, transferPairId=null,
      // same user. Order FIFO by (createdAt asc, id asc) — ambiguity tie-break.
      const wanted = candidate.type === "inflow" ? "outflow" : "inflow";
      const rows = (await deps.client.transaction.findMany({
        where: {
          userId,
          type: wanted,
          occurredOn: new Date(candidate.occurredOn),
          amount: candidate.amount,
          accountId: { not: candidate.accountId },
          category: "autre",
          transferPairId: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })) as TransactionRow[];
      return rows.map(toDto);
    },

    async pairAsTransfer(userId, candidateId, siblingId, pairId) {
      // 5-3 — 2-row updateMany. Defense-in-depth: explicit userId scopes
      // the where so cross-user leak is impossible (AC-7).
      await deps.client.transaction.updateMany({
        where: { userId, id: { in: [candidateId, siblingId] } },
        data: { category: "transfer", transferPairId: pairId, updatedAt: new Date() },
      });
    },

    async unpairAfterDelete(userId, pairId, idToExclude) {
      // 5-3 AC-11 — when a paired row is deleted, the sibling reverts to
      // category=autre, transferPairId=null. updateMany on (userId, pairId)
      // with id != idToExclude touches only the sibling.
      await deps.client.transaction.updateMany({
        where: { userId, transferPairId: pairId, id: { not: idToExclude } },
        data: { category: "autre", transferPairId: null, updatedAt: new Date() },
      });
    },
```

**Edit 6** — extend `apps/api/src/modules/transactions/transactions.repository.test.ts` with 5 new `test(...)` blocks. The existing file already wires the fake-Prisma harness — APPEND inside the existing `describe("transactionsRepository", ...)` block. Each test follows the existing fake-Prisma shape :

```ts
  // ─── 5-3 — findTransferPairCandidates ──────────────────────────────────
  test("AC-1 — findTransferPairCandidates returns opposite-type, same-date+amount sibling on different account", async () => {
    const candidate = {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "inflow" as const,
    };
    const expectedSibling = {
      id: "tx_outxxxxxxxxxxxxxxxxxx",
      userId: "u_a",
      accountId: "acc_bbb222222222222222222",
      occurredOn: new Date("2026-05-20"),
      label: "Virement",
      amount: new (await import("@generated/prisma/client")).Prisma.Decimal(120.0),
      type: "outflow" as const,
      category: "autre",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      createdAt: new Date("2026-05-20T10:00:00Z"),
      updatedAt: null,
    };
    const findManyMock = mock(async () => [expectedSibling]);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const repo = createTransactionsRepository({ client: fakeClient });
    const out = await repo.findTransferPairCandidates("u_a", candidate);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("tx_outxxxxxxxxxxxxxxxxxx");
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "u_a",
        type: "outflow",
        occurredOn: new Date("2026-05-20"),
        amount: 120.0,
        accountId: { not: "acc_aaa111111111111111111" },
        category: "autre",
        transferPairId: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  test("AC-6 — findTransferPairCandidates filters out same-account siblings via `not` clause", async () => {
    const findManyMock = mock(async () => []);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const repo = createTransactionsRepository({ client: fakeClient });
    await repo.findTransferPairCandidates("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "outflow",
    });
    const call = findManyMock.mock.calls[0]?.[0] as { where: { accountId: { not: string } } };
    expect(call.where.accountId).toEqual({ not: "acc_aaa111111111111111111" });
  });

  test("AC-7 — findTransferPairCandidates scopes by userId (cross-user isolation)", async () => {
    const findManyMock = mock(async () => []);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const repo = createTransactionsRepository({ client: fakeClient });
    await repo.findTransferPairCandidates("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "outflow",
    });
    const call = findManyMock.mock.calls[0]?.[0] as { where: { userId: string } };
    expect(call.where.userId).toBe("u_a");
  });

  test("AC-1 — pairAsTransfer runs a 2-row updateMany scoped by userId", async () => {
    const updateManyMock = mock(async () => ({ count: 2 }));
    const fakeClient = {
      transaction: { updateMany: updateManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const repo = createTransactionsRepository({ client: fakeClient });
    await repo.pairAsTransfer(
      "u_a",
      "tx_aaaaaaaaaaaaaaaaaaaaa",
      "tx_bbbbbbbbbbbbbbbbbbbbb",
      "tp_xxxxxxxxxxxxxxxxxxxxx",
    );
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const call = updateManyMock.mock.calls[0]?.[0] as {
      where: { userId: string; id: { in: string[] } };
      data: { category: string; transferPairId: string };
    };
    expect(call.where.userId).toBe("u_a");
    expect(call.where.id.in).toEqual([
      "tx_aaaaaaaaaaaaaaaaaaaaa",
      "tx_bbbbbbbbbbbbbbbbbbbbb",
    ]);
    expect(call.data.category).toBe("transfer");
    expect(call.data.transferPairId).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
  });

  test("AC-11 — unpairAfterDelete updates only the sibling (id != idToExclude)", async () => {
    const updateManyMock = mock(async () => ({ count: 1 }));
    const fakeClient = {
      transaction: { updateMany: updateManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const repo = createTransactionsRepository({ client: fakeClient });
    await repo.unpairAfterDelete(
      "u_a",
      "tp_xxxxxxxxxxxxxxxxxxxxx",
      "tx_aaaaaaaaaaaaaaaaaaaaa",
    );
    const call = updateManyMock.mock.calls[0]?.[0] as {
      where: { userId: string; transferPairId: string; id: { not: string } };
      data: { category: string; transferPairId: null };
    };
    expect(call.where.userId).toBe("u_a");
    expect(call.where.transferPairId).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
    expect(call.where.id.not).toBe("tx_aaaaaaaaaaaaaaaaaaaaa");
    expect(call.data.category).toBe("autre");
    expect(call.data.transferPairId).toBeNull();
  });
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/transactions/transactions.repository.test.ts`
Expected: all existing tests + the 5 new pass. Exit 0.

Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions.repository.test.ts && git commit -m "feat(#29): T5 — repository findTransferPairCandidates + pairAsTransfer + unpairAfterDelete + bulkCreate returns rows"`

---

#### T6 — Service : `categoriseAfterCreate` + lifecycle wires + extended tests

Apply the edits below to `apps/api/src/modules/transactions/transactions.service.ts`. The factory is rewritten with the post-create + delete-lifecycle additions ; a module-level helper extracts the categorise logic so the service methods can call it without `this`-binding gymnastics.

**File: `apps/api/src/modules/transactions/transactions.service.ts` (full replacement)**

```ts
// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (stories 5-1 + 5-2 + 5-3).
//
// Cross-aggregate guards (defense in depth, ADR-0013):
//   - AccountOwnershipProbe.exists(userId, accountId) pre-flights BEFORE
//     create (always) and BEFORE update (only when the patch carries
//     accountId — mirrors 3-1's policy). Re-applied per-row inside importCsv
//     even though the resolver in previewImportCsv already filtered.
//   - AccountResolver.resolve(userId, label) maps CSV `account-label` to an
//     account id, scoped to the calling user (RLS + explicit where).
//
// Story 5-3 — rule-based transfer detection (FR-30):
//   - categoriseAfterCreate(userId, candidate) — runs the pair-detection
//     derive ; on match, persists category="transfer" + transferPairId on
//     both rows. Eligibility: candidate.category === "autre" only (AC-4).
//   - Wired into createTransaction (post-create re-read) and importCsv
//     (per-row loop AFTER the bulkCreate commits).
//   - Lifecycle: deleteTransaction unpairs the sibling before deleting
//     (AC-11) so the orphan reverts to category=autre + transferPairId=null.
//
// Errors:
//   - ACCOUNT_NOT_FOUND  (../accounts/accounts.errors)
//   - TRANSACTION_NOT_FOUND (./transactions.errors)
//   - TRANSACTION_FAILED (bulk-insert rollback surfaced from $transaction)

import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  GetTransactionInput,
  ImportCsvInput,
  ImportCsvOutput,
  ListTransactionsInput,
  ListTransactionsOutput,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import { accountNotFound } from "../accounts/accounts.errors";
import { PekuloError } from "../../common/errors";
import { generateBase62Id } from "../../database";
import { detectTransferPair } from "../../common/derive/transfer-rule";
import { parseCsvForPreview, type AccountResolver } from "./services/csv-parser";
import { transactionNotFound } from "./transactions.errors";
import type { TransactionsRepository } from "./transactions.repository";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
  // Bulk variant — single round-trip for N ids. The CSV import path dedupes
  // row.accountIds and hands the set here instead of awaiting `exists` per row.
  existsMany(userId: string, accountIds: string[]): Promise<Set<string>>;
}

export type { AccountResolver };

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  previewImportCsv(userId: string, input: PreviewImportCsvInput): Promise<PreviewImportCsvOutput>;
  importCsv(userId: string, input: ImportCsvInput): Promise<ImportCsvOutput>;
  // Story 5-3 — exposed on the interface so the service methods can call it
  // directly (no `this` rebinding) and so it's stub-able from tests.
  categoriseAfterCreate(userId: string, candidate: Transaction): Promise<Transaction>;
}

function generateTransferPairId(): string {
  return `tp_${generateBase62Id(21)}`;
}

// Internal helper extracted so createTransaction + importCsv can call it
// without `this`-binding gymnastics. The service method delegates to this
// helper ; tests can stub the service method to inspect calls, OR stub the
// repository to control the underlying behaviour.
async function categoriseAfterCreateImpl(args: {
  userId: string;
  candidate: Transaction;
  repository: TransactionsRepository;
}): Promise<Transaction> {
  const { userId, candidate, repository } = args;
  // AC-4 — eligibility: only category=autre runs the rule. Explicit user
  // categories (loyer, salaire, …) ALWAYS win.
  if (candidate.category !== "autre") return candidate;
  // AC-5 — repository already orders by (createdAt asc, id asc). Derive
  // re-applies the structural filter as defense-in-depth.
  const siblings = await repository.findTransferPairCandidates(userId, {
    accountId: candidate.accountId,
    occurredOn: candidate.occurredOn,
    amount: candidate.amount,
    type: candidate.type,
  });
  const { pair } = detectTransferPair({ candidate, siblings });
  if (!pair) return candidate;
  const pairId = generateTransferPairId();
  await repository.pairAsTransfer(userId, candidate.id, pair.id, pairId);
  // Return the candidate with its updated tags so the caller (createTransaction)
  // can surface the new state in its response without re-querying.
  return { ...candidate, category: "transfer", transferPairId: pairId };
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
}): TransactionsService {
  return {
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound();
      const created = await deps.repository.create(userId, input);
      // 5-3 — categorise inline. If a pair matches, both rows are updated
      // and the returned candidate carries the new tags. If no pair, the
      // helper short-circuits and returns the candidate unchanged.
      return categoriseAfterCreateImpl({
        userId,
        candidate: created,
        repository: deps.repository,
      });
    },

    async updateTransaction(userId, input) {
      if (input.accountId !== undefined) {
        const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
        if (!owns) throw accountNotFound();
      }
      const outcome = await deps.repository.update(userId, input);
      if (outcome.outcome === "not-found") throw transactionNotFound(input.id);
      return outcome.transaction;
    },

    async deleteTransaction(userId, input) {
      // 5-3 AC-11 — pre-read so we know if the candidate is paired. If yes,
      // unpair the sibling FIRST (the sibling reverts to category=autre +
      // transferPairId=null) then delete the candidate. Ordering matters :
      // doing the delete first would leave the sibling pointing at a
      // now-vanished pairId until the second updateMany ran.
      const row = await deps.repository.findByIdForUser(userId, input.id);
      if (!row) throw transactionNotFound(input.id);
      if (row.transferPairId !== null) {
        await deps.repository.unpairAfterDelete(userId, row.transferPairId, input.id);
      }
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

    async previewImportCsv(userId, input) {
      return parseCsvForPreview({
        csvText: input.csvText,
        userId,
        accountResolver: deps.accountResolver,
      });
    },

    async importCsv(userId, input) {
      // AC-8 (5-2) — defense in depth: re-check every account ownership even
      // though the resolver in previewImportCsv already filtered. Bulk probe
      // via existsMany so 1000 rows referencing K unique accounts cost one
      // round-trip, not N.
      const uniqueIds = Array.from(new Set(input.rows.map((r) => r.accountId)));
      const owned = await deps.accountOwnershipProbe.existsMany(userId, uniqueIds);
      for (const id of uniqueIds) {
        if (!owned.has(id)) throw accountNotFound();
      }
      try {
        const { persisted, rows } = await deps.repository.bulkCreate(userId, input.rows);
        // 5-3 AC-3 — categorise AFTER the bulk commits. Sequential per-row
        // — pair detection depends on already-persisted siblings. Failures
        // are non-fatal (the row is still valid with category=autre) ; log
        // via console.warn for visibility.
        for (const row of rows) {
          try {
            await categoriseAfterCreateImpl({
              userId,
              candidate: row,
              repository: deps.repository,
            });
          } catch (err) {
            console.warn(
              `[5-3] categoriseAfterCreate failed for tx ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        return { ok: true as const, persisted };
      } catch (err) {
        // Bulk-insert rollback surfaces as TRANSACTION_FAILED (mapper → 500).
        // The accountNotFound thrown by the pre-flight loop is intentionally
        // NOT caught here — it bubbles to the route handler unchanged.
        if (err instanceof PekuloError) throw err;
        throw new PekuloError(
          "TRANSACTION_FAILED",
          err instanceof Error ? err.message : "bulk insert failed",
        );
      }
    },

    async categoriseAfterCreate(userId, candidate) {
      // 5-3 — public alias of the internal helper. Exposed on the interface
      // so callers outside this file (future story 6-X LLM wrapper) can
      // chain on top of the rule path.
      return categoriseAfterCreateImpl({ userId, candidate, repository: deps.repository });
    },
  };
}
```

**Edit** — extend `apps/api/src/modules/transactions/transactions.service.test.ts` with 4 new `test(...)` blocks inside the existing `describe("transactionsService", …)`. The fake-repository harness already exists ; add the new methods to `makeRepoMock` (returning sensible defaults), then add the tests :

```ts
const makeRepoMock = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => sampleTx),
    findByIdForUser: mock(async () => sampleTx),
    update: mock(async () => ({ outcome: "ok", transaction: sampleTx }) as UpdateOutcome),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [sampleTx], nextCursor: null })),
    bulkCreate: mock(async (_u: string, rows: unknown[]) => ({
      persisted: rows.length,
      rows: rows.map((_, i) => ({ ...sampleTx, id: `tx_bulk${i}aaaaaaaaaaaaa` })),
    })),
    // 5-3 additions:
    findTransferPairCandidates: mock(async () => []),
    pairAsTransfer: mock(async () => undefined),
    unpairAfterDelete: mock(async () => undefined),
    ...over,
  }) as TransactionsRepository;
```

Then the 4 test blocks (append at the end of the `describe`) :

```ts
  // ─── 5-3 — categoriseAfterCreate ───────────────────────────────────────
  test("AC-1 — categoriseAfterCreate pairs both rows when a sibling matches", async () => {
    const sibling = { ...sampleTx, id: "tx_siblingxxxxxxxxxxxxx", accountId: "acc_bbb222222222222222222", type: "inflow" as const };
    const findPairMock = mock(async () => [sibling]);
    const pairMock = mock(async () => undefined);
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      type: "outflow",
      category: "autre",
      transferPairId: null,
    });
    expect(out.category).toBe("transfer");
    expect(out.transferPairId).toMatch(/^tp_[0-9A-Za-z]{21}$/);
    expect(pairMock).toHaveBeenCalledTimes(1);
    const pairCall = pairMock.mock.calls[0]!;
    expect(pairCall[0]).toBe("u_a");
    expect(pairCall[1]).toBe(sampleTx.id); // candidate
    expect(pairCall[2]).toBe("tx_siblingxxxxxxxxxxxxx"); // sibling
    expect(pairCall[3]).toBe(out.transferPairId); // same pair-id
  });

  test("AC-4 — categoriseAfterCreate short-circuits when category !== 'autre'", async () => {
    const findPairMock = mock(async () => [{ ...sampleTx, id: "tx_siblingxxxxxxxxxxxxx" }]);
    const pairMock = mock(async () => undefined);
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      category: "loyer",
      transferPairId: null,
    });
    expect(out.category).toBe("loyer");
    expect(out.transferPairId).toBeNull();
    expect(findPairMock).not.toHaveBeenCalled();
    expect(pairMock).not.toHaveBeenCalled();
  });

  test("AC-2 — categoriseAfterCreate is a no-op when no sibling matches (LLM no-op for 5-3)", async () => {
    const findPairMock = mock(async () => []);
    const pairMock = mock(async () => undefined);
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      category: "autre",
      transferPairId: null,
    });
    expect(out.category).toBe("autre");
    expect(out.transferPairId).toBeNull();
    expect(findPairMock).toHaveBeenCalledTimes(1);
    expect(pairMock).not.toHaveBeenCalled();
  });

  test("AC-11 — deleteTransaction unpairs the sibling before deleting (when transferPairId is set)", async () => {
    const findByIdMock = mock(async () => ({
      ...sampleTx,
      transferPairId: "tp_xxxxxxxxxxxxxxxxxxxxx",
    }));
    const unpairMock = mock(async () => undefined);
    const deleteMock = mock(async () => ({ deleted: true }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findByIdForUser: findByIdMock,
        unpairAfterDelete: unpairMock,
        delete: deleteMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await svc.deleteTransaction("u_a", { id: sampleTx.id });
    expect(unpairMock).toHaveBeenCalledTimes(1);
    const unpairCall = unpairMock.mock.calls[0]!;
    expect(unpairCall[0]).toBe("u_a");
    expect(unpairCall[1]).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
    expect(unpairCall[2]).toBe(sampleTx.id);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    // Ordering proof: unpair was called BEFORE delete.
    const unpairInvocation = unpairMock.mock.invocationCallOrder[0]!;
    const deleteInvocation = deleteMock.mock.invocationCallOrder[0]!;
    expect(unpairInvocation).toBeLessThan(deleteInvocation);
  });
```

Note : `sampleTx` (declared at top of the existing test file) MUST be extended to include `transferPairId: null` — the typed `Transaction` DTO now requires it. Edit the literal :

```ts
const sampleTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses",
  amount: 87.5,
  type: "outflow" as const,
  category: "courses" as const,
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/transactions/transactions.service.test.ts`
Expected: all existing tests + the 4 new pass. Exit 0.

Commit: `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.service.test.ts && git commit -m "feat(#29): T6 — categoriseAfterCreate + createTransaction/importCsv/deleteTransaction lifecycle wires"`

---

#### T7 — Integration test : paired-create via oRPC

Extend `apps/api/src/modules/transactions/transactions.integration.test.ts` with a new test block. The existing harness mounts the real Elysia app + a fake Prisma client (see existing `beforeAll` and the `app` import). APPEND inside the existing `describe(...)` block :

```ts
  // ─── 5-3 — paired-create via oRPC ────────────────────────────────────
  test("AC-1 + AC-9 — creating an inflow that pairs with an existing outflow returns transfer + pairs both rows", async () => {
    // Seed the fake DB with an outflow on acc_aaa, category=autre, transferPairId=null.
    const outflowId = "tx_outxxxxxxxxxxxxxxxxxx";
    fakeDb.transactions.push({
      id: outflowId,
      userId: TEST_USER_ID,
      accountId: "acc_aaa111111111111111111",
      occurredOn: new Date("2026-05-20"),
      label: "Virement épargne (out)",
      amount: new Prisma.Decimal(120.0),
      type: "outflow",
      category: "autre",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      createdAt: new Date("2026-05-20T10:00:00Z"),
      updatedAt: null,
    });

    const res = await app.handle(
      buildSignedRpcRequest("/rpc/v1/transactions/createTransaction", {
        accountId: "acc_bbb222222222222222222",
        occurredOn: "2026-05-20",
        label: "Virement épargne (in)",
        amount: 120.0,
        type: "inflow",
        category: "autre",
        isImprevu: false,
        notes: null,
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Transaction;
    expect(json.category).toBe("transfer");
    expect(json.transferPairId).toMatch(/^tp_[0-9A-Za-z]{21}$/);

    // The previously-existing outflow row was also updated by `pairAsTransfer`.
    const outflowReread = fakeDb.transactions.find((t) => t.id === outflowId)!;
    expect(outflowReread.category).toBe("transfer");
    expect(outflowReread.transferPairId).toBe(json.transferPairId);
  });
```

Note : adapt `buildSignedRpcRequest`, `fakeDb`, `TEST_USER_ID`, `Prisma`, and `Transaction` to the existing imports of the file (verify the import names in the current header of `transactions.integration.test.ts` before extending).

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/transactions/transactions.integration.test.ts`
Expected: all existing tests + the new pass. Exit 0.

Commit: `git add apps/api/src/modules/transactions/transactions.integration.test.ts && git commit -m "feat(#29): T7 — integration test for paired-create via oRPC"`

---

#### T8 — Web tier : badge in Récentes caption

The badge is centralised via `TRANSACTION_CATEGORY_LABELS["transfer"] = "⇆ Transfert"` (T3). The recent section's existing `category: TRANSACTION_CATEGORY_LABELS[tx.category]` build already covers it — NO change needed to the rendering path. The user-visible affordance is the new label string. The only intentional extension is the a11y test : assert the badge surfaces with the expected text on the rendered row.

**Edit** — apply ONLY if Step-0's read of `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` confirms `TRANSACTION_CATEGORY_LABELS[tx.category]` is the build path (verified at L159 of the current file). NO source edit needed — the label change in T3 + the auto-flowing render covers AC-8.

**Edit** — extend `transactions-recent-section.a11y.test.tsx`. Add a test that mocks `useTransactions` to return a row with `category: "transfer"` and asserts the `⇆ Transfert` text renders inside the row caption :

```ts
  test("AC-8 — renders '⇆ Transfert' caption when category === 'transfer'", async () => {
    transactionsMock.mockReturnValue({
      data: {
        items: [
          {
            id: "tx_pairaxxxxxxxxxxxxxxxx",
            accountId: "acc_aaa111111111111111111",
            occurredOn: "2026-05-20",
            label: "Virement épargne",
            amount: 120,
            type: "outflow" as const,
            category: "transfer" as const,
            isImprevu: false,
            notes: null,
            transferPairId: "tp_xxxxxxxxxxxxxxxxxxxxx",
            createdAt: "2026-05-20T10:00:00.000Z",
          },
        ],
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
    const { findByText, container } = render(<TransactionsRecentSection />);
    await findByText(/⇆ Transfert/);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
```

Adjust `transactionsMock` / mock import names to match the existing file. If the file does not yet declare `transactionsMock` via `vi.hoisted`, add it at the top following the 2026-05-20 lesson :

```ts
const { transactionsMock } = vi.hoisted(() => ({ transactionsMock: vi.fn() }));
vi.mock("../_hooks/use-transactions", () => ({
  useTransactions: transactionsMock,
}));
```

Run: `bun --filter=web run test src/app/\\(cap\\)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`
Expected: all existing tests + the new pass, axe-clean. Exit 0.

Commit: `git add apps/web/src/app/\\(cap\\)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx && git commit -m "feat(#29): T8 — a11y test for ⇆ Transfert caption (AC-8 — UI surface)"`

---

#### T9 — Full Iron Law quality gates + push

Run every gate sequentially. Each MUST exit 0. If any gate fails, fix the root cause and re-run before moving on — do NOT silently skip.

```sh
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/api' run db:rls-audit
bun --filter='@pekulo/validators' run typecheck
bun --filter=web run typecheck
bun --filter='@pekulo/ui' run test:axe
git diff --exit-code packages/ui/public/tamagui.generated.css
```

Expected for each :
- `lint` → `0 problems`, exit 0.
- `typecheck` (api, validators, web) → no errors, exit 0.
- `test` → all bun:test suites pass, exit 0.
- `db:rls-audit` → `transactions: 4` unchanged + every other table unchanged, exit 0.
- `test:axe` → 0 violations, exit 0.
- `git diff --exit-code packages/ui/public/tamagui.generated.css` → no diff (5-3 introduces no styled primitive), exit 0.

Then push the branch :

```sh
git push -u origin feature/29-5-3-transfer-rule
```

Expected : remote tracking set, the branch is now visible in `gh pr create` etc.

Commit (one final wrap-up commit if any quality-gate-driven fix was needed) :
`git commit -m "feat(#29): T9 — full Iron Law gates green + push"`

---

### Forward work (out of scope for 5-3)

- **Edit lifecycle for paired transfers.** If user A edits a paired transaction's `amount`, `occurredOn`, `accountId`, or `type`, the pair MAY no longer be structurally valid. 5-3 does NOT dissociate on update — the pair stays linked even if the structural match no longer holds. Tracked for story 5-5 or épic 6.
- **Backfill existing transactions.** The rule fires only on new rows from now on. Pre-5-3 rows in `category=autre` stay as-is. No backfill ; Alex can manually re-categorise via `updateTransaction` if useful (V1 (a) personal data volume).
- **LLM categorisation fallback (épic 6).** The `categoriseAfterCreate` no-match branch is the future hook point. Épic 6's `LlmCategoriser` will wrap : `categoriseAfterCreate → if not transfer → llm.categorise(...)`. The contract is in place — épic 6 only extends.
- **UI badge ergonomics.** AC-8 ships the inline `⇆ Transfert` caption (lucide `ArrowLeftRight` icon + plain "Transfert" label, reconciled by aped-review F2). A future iteration could add a click affordance on the badge ("see the paired transaction") via the `transferPairId`. Tracked for story 7-X dashboard once the cross-screen navigation patterns are validated.
- **Partial covering index for pair detection** *(aped-review F7)*. `findTransferPairCandidates` filters on `(userId, type, occurredOn, amount, accountId≠, category="autre", transferPairId=null)` and currently leans on `transactions_user_date_idx`. For a high-volume CSV (1000+ rows) the planner falls back to a filter scan. A partial index `WHERE category='autre' AND transfer_pair_id IS NULL` on `(user_id, occurred_on, amount, type)` would collapse the filter to an index lookup. Defer until a real workload reveals slow imports (V1 (a) personal volume ≤ ~200 rows).
- **Structured log for non-fatal categorise failures** *(aped-review F7)*. `importCsv` swallows per-row categorise errors via `console.warn` so a malformed pair doesn't abort the whole bulk. Future V2 observability should replace the warn with a structured `{ event: "categorise.error", txId, userId, err }` line consumable by the log scraper, so a real bug doesn't blend into transient warnings.
- **Concurrent-create race surface** *(aped-review F6, partially mitigated)*. `pairAsTransfer` now asserts `count === 2` and raises `TRANSACTION_PAIR_RACE` (409) when a sibling vanishes mid-window — the `createTransaction` path lets it bubble, `importCsv` swallows it as non-fatal per AC-3's contract. The remaining unguarded window is the rare double-pair scenario (two concurrent inflows both racing for the same outflow sibling) which is acceptable for V1 single-user but worth revisiting if collaboration features land.
- **`transactionsMock` strong typing** *(aped-review F7)*. The `vi.hoisted` mock in `transactions-recent-section.a11y.test.tsx` is untyped (`vi.fn()`). Tightening to `vi.fn<typeof useTransactions>()` would catch any future hook-signature drift at compile time.

## Dev Agent Record

### Summary

Story 5-3 shipped FR-30 — rule-based transfer detection — across 8 commits on `feature/29-5-3-transfer-rule`. The pair-match rule fires inside `categoriseAfterCreate` (extracted free helper) wired into `createTransaction`, `importCsv` (per-row, non-fatal), and `deleteTransaction` (AC-11 unpair-before-delete). 11/11 ACs covered ; 17 new test cases authored (7 derive, 6 repository, 4 service, 1 integration HTTP-boundary, 1 web a11y — though T8's "extend with 1 assertion" became a full new test block per the existing test's `vi.hoisted` pattern). Iron Law gates green across api / validators / web / ui.

### Files changed

**New (4)**
- `apps/api/prisma/migrations/20260525100133_add_transfer_pair_id_to_transactions/migration.sql` — T1
- `apps/api/src/common/derive/transfer-rule.ts` — T4 pure derive
- `apps/api/src/common/derive/transfer-rule.test.ts` — T4 (7 cases)

**Modified (10)**
- `apps/api/prisma/schema/transactions.prisma` — T2 (transferPairId + index)
- `packages/validators/src/transactions/transactions.schemas.ts` — T3 (transfer enum, label, regex, DTO field)
- `apps/api/src/modules/transactions/transactions.repository.ts` — T5 (3 new methods + bulkCreate.rows + toDto + TransactionRow extension)
- `apps/api/src/modules/transactions/transactions.repository.test.ts` — T5 (6 new tests, FakeRow extension)
- `apps/api/src/modules/transactions/transactions.service.ts` — T6 (full rewrite with categoriseAfterCreate + lifecycle wires)
- `apps/api/src/modules/transactions/transactions.service.test.ts` — T6 (4 new tests, sampleTx + makeRepoMock extension)
- `apps/api/src/modules/transactions/transactions.integration.test.ts` — T6 (fake-client extension for new where shapes) + T7 (paired-create HTTP test)
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx` — T8 (hook-level mock with vi.hoisted + AC-8 test)
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.a11y.test.tsx` — T8 collateral (fixture transferPairId)
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-delete-confirm.envelope.test.tsx` — T8 collateral
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.a11y.test.tsx` — T8 collateral
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transaction-edit-form.envelope.test.tsx` — T8 collateral

### Deviations

- **T4 — 7 tests authored instead of 6.** The story prescribed 6 cases but the natural enumeration of the structural filter (match, no-sibling, wrong-amount, same-account, wrong-date, same-type, ambiguous-FIFO) lands at 7 — added `wrong-date` and `same-type` as separate cases for clarity. Same coverage, finer-grained.
- **T4 — AC-10 grep guard caught the file's own comment.** The original comment used the word `telemetry` (one of the forbidden tokens in the AC-10 grep). Reworded to "no observability imports" + "outbound calls" + "wall-clock reads" — same intent, regex-clean. Grep returns empty.
- **T5 — Test typing: bun:test `mock.calls[0]?.[0]` typed as never.** Replaced the story's `mock.calls[0]?.[0] as X` casts with `mock.calls.at(0) as unknown as [X]` — matches the existing 5-1 test pattern (`transactions.repository.test.ts:219`).
- **T6 — Lifecycle wire: `categoriseAfterCreateImpl` extracted as a module-level free helper.** The story flagged the `this`-binding trap inline ; chose the recommended path (free helper) rather than the `const self = …` alternative. The public `service.categoriseAfterCreate(...)` method becomes a one-line alias so the interface contract holds.
- **T6 — Integration fake client extension required.** The story's T6 only covered the unit/service test file. But the integration test's in-memory fake client didn't know about `transferPairId`, the new `where.id: { in: [...] }` shape (pairAsTransfer), or `where.id: { not }` + `transferPairId` shape (unpairAfterDelete). Extended the fake's `transaction.create`, `findFirst`, `findMany`, `updateMany` to handle the new field + where keys. Without this, the 5-1 HTTP-boundary suite (5 tests) and T7's new paired-create test 500'd because `toDto` returned `transferPairId: undefined` which the oRPC output validator rejected. Necessary collateral, not a deviation from intent.
- **T8 — Hook-level mock instead of action-level.** Story T8 prescribed `vi.hoisted` mocking of `use-transactions`. The existing a11y test mocked at the action layer (`listTransactions`). Adopted the story's hook-level shape per the prescribed pattern — `mockReturnValue` (not `mockReturnValueOnce`) so the value persists across re-renders triggered by the hydration `useEffect`. Existing empty-state test refactored to use the same hook mock with `{ isLoading: true }` to keep its assertion intact.
- **T8 — 4 sibling test fixtures patched (collateral).** T3 made `transferPairId` required on the DTO ; 4 web test files declaring `const fixtureTx: Transaction` without the field failed web typecheck. Added `transferPairId: null` to each. In-scope per the "touched packages must compile" gate.
- **Lint warnings (2, both intentional).** `apps/api/src/modules/transactions/transactions.repository.ts:229` (per-row `bulkCreate` await inside `$transaction` — preserved from 5-2 per ADR-0012 prefixed-ids extension) and `apps/api/src/modules/transactions/transactions.service.ts:181` (per-row `categoriseAfterCreateImpl` await in `importCsv` — pair detection depends on already-persisted siblings, sequential is the contract per AC-3 / Architecture > Atomic persistence). Both pre-existing pattern + new pattern of the same shape ; lint exits 0 (warnings ≠ errors).

### Test output

```
$ bun --filter='@pekulo/api' run lint
Found 2 warnings and 0 errors.
Exited with code 0

$ bun --filter='@pekulo/api' run typecheck
Exited with code 0

$ bun --filter='@pekulo/api' run test
 500 pass
 0 fail
 1223 expect() calls
Ran 500 tests across 53 files.
Exited with code 0

$ bun --filter='@pekulo/api' run db:rls-audit
[rls-audit] OK — 14 tables checked: kpis (3 policies), monthly_tracking (3 policies),
hypotheses (3 policies), transactions (4 policies), accounts (4 policies),
holdings (4 policies), holding_lots (4 policies), compass_history (2 policies),
milestones (4 policies), account_balance_log (2 policies), real_estate (4 policies),
real_estate_mortgage (4 policies), real_estate_rental (4 policies),
real_estate_valuations (2 policies)
Exited with code 0

$ bun --filter='@pekulo/validators' run typecheck
Exited with code 0

$ bun --filter='@pekulo/web' run typecheck
Exited with code 0

$ bun --filter='@pekulo/ui' run test:axe
 Test Files  64 passed | 55 skipped (119)
      Tests  95 passed | 99 skipped (194)
Exited with code 0

$ git diff --exit-code packages/ui/public/tamagui.generated.css
Exited with code 0
```

### Commits

```
ec4f90b feat(#29): T8 — a11y test for ⇆ Transfert caption (AC-8)
1fbccb8 feat(#29): T7 — HTTP-boundary test for paired-create via oRPC
8377ba6 feat(#29): T6 — categoriseAfterCreate + createTransaction/importCsv/deleteTransaction lifecycle wires
75914f3 feat(#29): T5 — repository findTransferPairCandidates + pairAsTransfer + unpairAfterDelete
66d24c0 feat(#29): T4 — pure detectTransferPair derive + 7 test cases
f286cf7 feat(#29): T3 — add transfer category + TRANSFER_PAIR_ID_REGEX + transferPairId on DTO
29f8d1f feat(#29): T2 — declare transferPairId field + (userId, transferPairId) index
a2ef2da feat(#29): T1 — add transfer_pair_id column + (user_id, transfer_pair_id) index
```

### Visual verification

T8 ships no DOM tree change — only the label string in `TRANSACTION_CATEGORY_LABELS["transfer"]` shifted. The vitest a11y test (`findByText(/⇆ Transfert/)` + axe-clean on a mounted transfer row) is the executable contract. No React Grab snapshot needed — there is no new primitive, no new variant, no new layout. Visual cross-check vs ux-preview is N/A: ux-preview's `TransactionsScreen` (App.tsx:1284) has no transfer concept yet, and the inline-caption decision was locked in step-04 per story Dev Notes > 2026-05-17 lesson. `aped-review`'s Aria persona will see the badge live during the visual review pass.
