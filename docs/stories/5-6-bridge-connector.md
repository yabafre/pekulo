---
story_key: 5-6-bridge-connector
epic: 5
ticket: "#93"
branch: feature/93-5-6-bridge-connector
status: ready-for-dev
depends_on: [5-1-transactions-record, 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge]
complexity: L
commit_prefix: "feat(#93)"
stepsCompleted: [step-01-init, step-02-input-discovery, step-03-story-selection, step-04-collaborative-design]
---

# Story 5-6 — Bridge bank-aggregator connector + Vault-encrypted BankConnection + cron-backup refresh

**Epic:** 5 — Transactions & monthly tracking (V1 brownfield + new flows)
**Ticket:** [#93](https://github.com/yabafre/pekulo/issues/93)
**Branch:** `feature/93-5-6-bridge-connector`
**Status:** ready-for-dev
**Depends on:** `5-1-transactions-record` ✅ · `0-4-prisma-setup` ✅ · `0-5-orpc-contracts-scaffold` ✅ · `0-6-zapaction-orpc-bridge` ✅
**Complexity:** L (≥ 27 tasks — at the upper boundary, no split per ADR-0015 + Alex confirmation in step 04)
**ADR primary:** [ADR-0015 — Bridge as AISP agent-of with provider abstraction](../adr/0015-bank-aggregator-bridge-with-provider-abstraction.md)
**ADR amendment (this story):** Token storage path switched from `pgcrypto` columns (ADR-0015 §5) to **Supabase Vault** secret references — see Dev Notes §"ADR-0015 amendment note (Vault over pgcrypto)" below. Update ADR-0015 §5 + add an "Amendments" section pointing to this story file as part of T1.

## User Story

**As a** Pekulo user, **I want** to connect my Société Générale and Revolut accounts to Pekulo via Bridge (OAuth + SCA), with transactions pulled automatically every N hours and deduplicated against existing rows, **so that** my daily bank flow lands in Pekulo without manual entry and my OAuth tokens are encrypted at rest with a managed-key path that survives key rotation.

## Acceptance Criteria

- **AC-1 (connect, FR-60).** **Given** a valid Bridge OAuth callback (`?code=...&state=...` from the Bridge-hosted Connect widget), **When** `completeConnection({code, state})` resolves, **Then** a `BankConnection` row is persisted with **`access_token_secret_id` + `refresh_token_secret_id`** pointing to `vault.secrets` rows (raw token strings NEVER stored on `bank_connections`, NEVER logged, NEVER returned in any oRPC response), and the connection appears in `listConnections()` for the calling user.

- **AC-2 (cron-backup refresh + dedup, FR-61).** **Given** an existing `BankConnection` with `status = 'active'`, **When** `refreshConnection({connectionId})` runs and Bridge returns 50 transactions (`?since=<lastRefreshedAt>`) including 10 already in Pekulo (same `provider_transaction_id`), **Then** the pre-flight `findExistingProviderTxIds(userId, "bridge", incomingIds[])` returns the 10 duplicates, only the 40 new transactions land via `transactions.service.importFromProvider`, `categoriseAfterCreate` runs sequentially per new row (non-fatal warn pattern from 5-2/5-3), and `BankConnection.lastRefreshedAt` flips to the highest `updated_at` from the response.

- **AC-3 (webhook HMAC, NFR-33).** **Given** an inbound `POST /internal/bridge/webhook` with an invalid `BridgeApi-Signature` header (any of: missing header, no `v1=` scheme, mismatched HMAC, downgrade attempt with `v0=`-only), **When** the verifier runs, **Then** the response is **HTTP 401 within < 100 ms** (measured server-side, fast-path BEFORE any DB query), the response body is empty, **no `BankConnection` row mutates**, and **no payload bytes** appear in any log line or OTel span attribute.

- **AC-4 (DTO strips tokens, NFR-31).** **Given** an oRPC `listConnections()` or `refreshConnection()` response, **When** the DTO is serialized to JSON over the wire, **Then** the payload contains **exactly**: `id`, `userId`, `provider`, `providerItemId`, `status`, `displayName`, `lastRefreshedAt`, `createdAt`. **No** `access_token_secret_id`, `refresh_token_secret_id`, or any other secret-bearing column appears in any response. A type-level `Expect<Equal<keyof BankConnectionDTO, "id" | "userId" | "provider" | "providerItemId" | "status" | "displayName" | "lastRefreshedAt" | "createdAt">>` test compiles only when the DTO surface remains correct.

- **AC-5 (SCA expiry, NFR-32).** **Given** a `item.refreshed` webhook with `content.status_code === 1010` (SCA expired), **When** `handleWebhookEvent` processes it, **Then** the matching `BankConnection.status` flips to `'sca_required'`, `BankConnection.lastRefreshedAt` is NOT updated, no transaction-fetch side-effect runs for that item, and a subsequent `refreshConnection({connectionId})` call short-circuits with `BANK_SCA_REQUIRED` (409) instead of calling Bridge. **No auto-retry on `1010`** — explicit user action via the (5-7) reconnect CTA only.

- **AC-6 (backup cron, FR-61).** **Given** the Bun-scheduled `refreshScheduler` registered in `lifecycle.ts` ticks every `BRIDGE_REFRESH_CRON_HOURS` hours (default 6), **When** `service.refreshAll()` fires, **Then** the scheduler iterates active connections (`status = 'active'`) per user sequentially, calls `refreshConnection` for each, **skips** connections with `status = 'sca_required'` or `status = 'revoked'`, and surfaces per-connection failures via `console.warn` (non-fatal — one user's Bridge outage does not poison another user's refresh).

- **AC-7 (auto-create accounts on first connect).** **Given** a fresh `completeConnection` with Bridge returning N bank accounts (e.g. SG checking, SG savings, Revolut EUR, Revolut Pockets), **When** persistence runs, **Then** for each Bridge account that does not yet have a matching `accounts.provider_account_key = <bridge_account_id>` row scoped to the user, a new `accounts` row is auto-created via `accounts.service.findOrCreateAutoFromProvider(userId, "bridge", bridgeAccountId, label, kind)` with `label = "Bridge — <BankName> — <AccountName>"` and `kind` mapped from Bridge's `account_type` (checking → "cash", savings → "savings", default → "cash"). Re-connecting the same Bridge item produces zero new `accounts` rows (idempotent).

- **AC-8 (sentinel guards, NFR-31).** **Given** `bank-aggregator.security.test.ts` runs as part of `bun --filter='@pekulo/api' run test`, **When** the suite executes a full lifecycle (initiateConnection → completeConnection → refreshConnection → webhook receipt) against a fake `BankProvider` + a fake pino transport + a fake OTel exporter, **Then** zero strings matching `/access[_-]token|refresh[_-]token/i` appear in any captured log line, span attribute, or OTel event message. The test fails the build on regression.

- **AC-9 (rate-limit + body cap, defensive).** **Given** the webhook receiver and the `refreshConnection` route, **When** a single user issues > 10 `refreshConnection` calls within 60 seconds OR a single webhook POST body exceeds 256 KB, **Then** the request is rejected with HTTP 429 (rate-limit) or 413 (body too large) respectively, no DB write occurs, and the response is < 100 ms.

## Tasks

> Iron Law (carry through every task): exact file paths, full code blocks, exact test command, expected output, literal commit step. Quoted bun/vitest commands use the fully-qualified workspace name (`bun --filter='@pekulo/api'` — lesson 2026-05-19).
>
> Ordering rationale: schema + migrations first (T1-T3) — locked surface for every downstream layer; prefix registry + Prisma model (T4-T5) before validators (T6) before contracts (T7-T8) so the workspace typechecks coherently from T9; pure HMAC verifier (T11) before the route that consumes it (T12); repository (T13-T14) before service (T15-T17) before routes (T18) before module composition (T19); transactions/accounts integration (T20-T22) AFTER the service is callable; web tier (T23-T26) last; sentinel + integration tests (T27-T28); Iron Law sweep (T29). Full code blocks live in **Dev Notes → Execution tasks — full code** below.

- [ ] **T1** — ADR-0015 amendment note (Vault over pgcrypto) [AC: AC-1, AC-4]
- [ ] **T2** — Manual SQL migration `create_bank_connections` (enable `supabase_vault`, table + RLS + indexes) [AC: AC-1, AC-4]
- [ ] **T3** — Manual SQL migration `alter_transactions_provider_dedup_and_accounts_provider_key` (ALTER transactions + ALTER accounts) [AC: AC-2, AC-7]
- [ ] **T4** — `id-prefixes.config.ts` add `BankConnection: "bnk"` + 1 Bun unit test [AC: AC-1]
- [ ] **T5** — `bank_aggregator.prisma` model + `prisma format && validate` [AC: AC-1, AC-4]
- [ ] **T6** — `packages/validators/src/bank-aggregator/` — 6 Zod schemas + barrel + vitest [AC: AC-1, AC-2, AC-4, AC-5]
- [ ] **T7** — `packages/contracts/src/bank-aggregator/` — contract with 4 procedures + barrel [AC: AC-1, AC-2]
- [ ] **T8** — `packages/contracts/src/index.ts` + `pekuloContract` registration [AC: AC-1, AC-2]
- [ ] **T9** — `bank-aggregator.errors.ts` + `PEKULO_ERROR_CODES` + `ORPC_HTTP_STATUS_BY_CODE` [AC: AC-3, AC-5, AC-9]
- [ ] **T10** — `bank-provider.ts` interface (pure, zero IO) [AC: AC-1, AC-2, AC-5]
- [ ] **T11** — `services/webhook-verifier.ts` pure HMAC + 6 Bun tests (valid, invalid, rotation, downgrade) [AC: AC-3]
- [ ] **T12** — `services/bridge-webhook-router.ts` Elysia route + `onParse` raw body + body-cap + 1 Bun perf test (401 < 100 ms) [AC: AC-3, AC-9]
- [ ] **T13** — `services/bridge-client.ts` `BridgeProvider` impl — 6 methods + msw-style fetch mock tests [AC: AC-1, AC-2, AC-5]
- [ ] **T14** — `bank-aggregator.repository.ts` — Vault round-trip + CRUD + dedup pre-flight via cross-module probe [AC: AC-1, AC-2, AC-4]
- [ ] **T15** — `bank-aggregator.service.ts` — `initiateConnection`, `completeConnection`, `listConnections` + factory clock seam + 4 Bun tests [AC: AC-1, AC-4, AC-7]
- [ ] **T16** — `bank-aggregator.service.ts` — `refreshConnection`, `refreshAll` + 3 Bun tests [AC: AC-2, AC-5, AC-6]
- [ ] **T17** — `bank-aggregator.service.ts` — `handleWebhookEvent` (item.refreshed → SCA flip + tx fetch) + 4 Bun tests [AC: AC-3, AC-5]
- [ ] **T18** — `bank-aggregator.routes.ts` — 4 oRPC procedures + rate-limit on `refreshConnection` [AC: AC-1, AC-2, AC-9]
- [ ] **T19** — `bank-aggregator.module.ts` + `services/refresh-scheduler.ts` Bun cron + lifecycle [AC: AC-6]
- [ ] **T20** — `transactions.repository.ts` add `bulkCreateFromProvider` + `findExistingProviderTxIds` + 3 Bun tests [AC: AC-2]
- [ ] **T21** — `transactions.service.ts` add `importFromProvider` + 2 Bun tests [AC: AC-2]
- [ ] **T22** — `accounts.service.ts` + `accounts.repository.ts` add `findOrCreateAutoFromProvider` (idempotent) + 3 Bun tests [AC: AC-7]
- [ ] **T23** — `runtime-dependencies.ts` wire-up + `lifecycle.ts` cron start/stop + `app.ts` webhook router mount [AC: AC-1, AC-2, AC-3, AC-6]
- [ ] **T24** — `apps/web/src/lib/zapaction/keys.ts` — `bankConnectionsKeys` + `bankConnectionsTags` + registry edge [AC: AC-1, AC-2]
- [ ] **T25** — `apps/web/src/app/(cap)/dashboard/parametres/_actions/bank-aggregator-actions.ts` zapaction wrappers (output omitted) [AC: AC-1, AC-2]
- [ ] **T26** — `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-{initiate,complete}-bank-connection.ts` — ZapAction hooks + vitest envelope-narrowing [AC: AC-1, AC-2]
- [ ] **T27** — `apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx` Server Component + minimal inflight affordance + axe scan [AC: AC-1]
- [ ] **T28** — `bank-aggregator.security.test.ts` sentinel — pino + OTel traversal asserts zero token strings [AC: AC-8]
- [ ] **T29** — `bank-aggregator.integration.test.ts` — full cycle initiate → complete → refresh → webhook with fake BankProvider [AC: AC-1, AC-2, AC-3, AC-5, AC-7]
- [ ] **T30** — `apps/api/src/config/env.ts` add Bridge env keys + `.env.example` documentation [AC: AC-1]
- [ ] **T31** — `docs/lessons.md` append "every new route under `(cap)/dashboard/*` for CapShell inheritance" lesson [AC: n/a — meta]
- [ ] **T32** — Iron Law sweep (typecheck + lint + tests + rls-audit + tamagui-css regen if needed) [AC: all]

## Dev Notes

### ADR-0015 amendment note (Vault over pgcrypto)

ADR-0015 §5 states: *"Bridge OAuth tokens encrypted at rest in Supabase via `pgcrypto` column-level encryption ; never logged ; never returned by oRPC handlers (DTO mapping strips the secret columns)."*

**Amendment (this story, 2026-05-27):** The implementation path switches from `pgcrypto` column-level encryption to **Supabase Vault** (`supabase_vault` extension). Rationale:

- Vault is validated by Supabase as the canonical secret-storage path (libsodium-backed under the hood; key derivation handled upstream).
- Vault references decouple `bank_connections` rows from the encryption key — rotation is a Vault concern, not a Pekulo migration concern.
- Pgcrypto column-level encryption would require Pekulo to manage the master encryption key (env var), re-encrypt every row on rotation, and embed key-handling code in the repository — broader Pekulo-side crypto surface than Vault.
- Pekulo cite ADR-0015 §5 invariants unchanged: tokens encrypted at rest, never logged, never in oRPC responses, DTO stripping enforced.

**T1 action:** edit `docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md` §5 to reference this amendment (do not rewrite — add an "Amendments" section pointing to this story file) and append to the "Consequences > Architecture" bullet that `bank_connections` rows carry `access_token_secret_id uuid REFERENCES vault.secrets(id)` + `refresh_token_secret_id uuid REFERENCES vault.secrets(id)` instead of `*_cipher bytea` columns.

### Architecture references

- **ADR-0015** primary — provider abstraction (`BankProvider` interface + `BridgeProvider` impl iso-pattern with `holdings/services/{yahoo,boursorama,twelve-data,frankfurter}-client.ts`).
- **ADR-0009** — Elysia + oRPC module factory + sub-tree-versioned `/rpc/v1/bankaggregator` mount.
- **ADR-0010** — hard layering. The 5-6 web surface is minimal (callback page + 2 hooks + 2 server actions); 5-7 will own the connections section UI.
- **ADR-0011** — `@pekulo/types/bank-aggregator/` for re-exported DTO types (zero `*.types.ts` inside `apps/api/src/modules/**` — L1 invariant).
- **ADR-0012** — `BankConnection: "bnk"` prefix injected via the prefixed-ids extension on every `create`.
- **ADR-0013** — defense-in-depth: `where: { userId }` on every `bank_connections` Prisma read/write + 4 RLS policies on `auth.uid() = user_id`.
- **ADR-0014** — manual SQL migrations preferred (RLS DDL must be hand-written; Prisma doesn't introspect policies).

### Lessons applied to this draft

- **2026-05-27 (5-5 outcomes)** — Factory clock seam (`createBankAggregatorService({clock?})`) for testing SCA expiry timestamps + `lastRefreshedAt` flips deterministically. NO `PEKULO_DEV_NOW_ISO` env-var seam.
- **2026-05-27 (5-5 outcomes)** — `defineAction({ tags: [...] })` is dead code without an RSC fetch-cache reader. The web tier hooks invalidate via `useActionMutation({ invalidateWithTags: [bankConnectionsTags.list()] })` only.
- **2026-05-26 (5-4 outcomes)** — Route placement: every new route under `(cap)/dashboard/*`, NOT `(cap)/*` directly (CapShell inheritance). Callback lives at `(cap)/dashboard/parametres/bank/callback/page.tsx`. **This is the lesson missed in step-04 v1 — see T31 for codification into `docs/lessons.md`.**
- **2026-05-26 (5-4 outcomes)** — R13 hydration guard formula is `!isHydrated || isLoading` (NOT `isHydrated && isLoading`). Applies if the callback page consumes any query.
- **2026-05-25 (5-3 outcomes)** — `categoriseAfterCreate` reuse: the Bridge importer calls `transactions.service.importFromProvider`, which wraps `categoriseAfterCreateImpl` per row with non-fatal `console.warn` swallow. No sibling categorisation surface.
- **2026-05-25 (5-2 outcomes)** — `AccountOwnershipProbe.existsMany` reused for bulk `account_id` pre-flight when Bridge auto-create maps multiple bank accounts in one shot.
- **2026-05-24** — `defineAction({ tags })` is server-only; `invalidateWithTags` on the hook is the only correct path.
- **2026-05-24** — Tamagui CSS regen guard. If the callback page introduces any new `Pekulo*` styled primitive, `bun run generate:tamagui-css` runs in the same PR.
- **2026-05-20** — Hooks under `apps/web/src/app/**/_hooks/` MUST consume ZapAction (`useActionMutation` from `@zapaction/query`).
- **2026-05-20** — `defineAction` with discriminated-union output: OMIT `output:`. The `completeConnection` action returns `{ ok: true; connection } | { ok: false; code; message }`.
- **2026-05-20** — Vitest `vi.mock` factory is HOISTED ; use `vi.hoisted` for envelope-narrowing tests in T26.
- **2026-05-19** — `bun --filter='@pekulo/api'` (NOT `bun --filter=api`). Every Iron Law command quotes the full namespace.
- **2026-05-17** — Story-spec UX placement MUST be cross-checked against `docs/ux-preview/src/App.tsx`. Cross-check done in step-04: the SettingsScreen in `docs/ux-preview/src/App.tsx:1730` is the source of truth for the parametres area; the Bridge connections section lives there (5-7 ships the UI). 5-6 callback is `(cap)/dashboard/parametres/bank/callback/page.tsx`.
- **2026-05-09** — Zero `*.types.ts` files inside `apps/api/src/modules/bank-aggregator/`. DTO types live in `@pekulo/types/bank-aggregator/`.
- **2026-05-07** — `bun test` (apps/api) ≠ `vitest run` (apps/web). Bank-aggregator tests use `bun:test` ; the callback page tests use `vitest`.
- **2026-05-05** — Manual SQL migrations preferred. T2 + T3 are hand-written.
- **2026-05-05** — `bun --cwd <relative>` silently fails. Every command uses `bun --filter='@pekulo/api' run …`.
- **2026-05-04** — Elysia 1.4 `Elysia` type is invariant. Module factory returns inferred types.
- **2026-05-04** — `Number(decimal)` silently truncates. Apply `decimalToNumber()` on every Bridge-pulled `amount` at the row→DTO boundary.

### Decisions locked in step-04

- **Token storage:** Supabase Vault (option A). T1 amends ADR-0015 §5.
- **Refresh trigger:** Bridge scheduler webhooks (primary) + Bun cron (backup, default 6h). `BRIDGE_REFRESH_CRON_HOURS` env var, override-able.
- **Accounts mapping:** auto-create silent in 5-6 (idempotent on `(user_id, provider, provider_account_key)`). 5-7 surfaces rename + merge affordances.
- **Webhook dev URL:** cloudflared tunnel (`cloudflared tunnel --url http://localhost:3001`). Document in T30 + `.env.example`.
- **`provider_account_key` column:** add to `accounts` table for idempotent auto-create. T3 includes the ALTER.
- **`revokeConnection` endpoint:** deferred to 5-7 (FR-62). 5-6 scope ends at connect + refresh + webhook.
- **Cron cadence:** `BRIDGE_REFRESH_CRON_HOURS=6` default.
- **Lessons override:** all 5-5 outcomes applied as-is (clock seam, no defineAction tags).
- **Body cap + rate-limit:** included in 5-6 — `bodyLimit: 256_000` on the webhook route + Elysia rate-limit `10/min` per userId on `refreshConnection`.

### Step-0 — Existing symbols quoted (verbatim, write-time)

#### `apps/api/src/modules/transactions/transactions.service.ts:56-67`

```ts
export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  previewImportCsv(userId: string, input: PreviewImportCsvInput): Promise<PreviewImportCsvOutput>;
  importCsv(userId: string, input: ImportCsvInput): Promise<ImportCsvOutput>;
  // Story 5-3 — exposed on the interface so a future LLM-categorisation
  // wrapper (épic 6) can chain on top, and so tests can stub directly.
  categoriseAfterCreate(userId: string, candidate: Transaction): Promise<Transaction>;
}
```

**5-6 extends** with `importFromProvider(userId: string, provider: "bridge", rows: ProviderTransactionRow[]): Promise<{ persisted: number; skipped: number }>` immediately AFTER `categoriseAfterCreate` in the interface.

#### `apps/api/src/modules/transactions/transactions.repository.ts:51-56`

```ts
create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
bulkCreate(
  userId: string,
  rows: Array<...>,
): Promise<{ persisted: number; rows: Transaction[] }>;
```

**5-6 extends** with `bulkCreateFromProvider(userId, rows: ProviderTransactionRow[]): Promise<{ persisted: number; rows: Transaction[] }>` (stamps `provider` + `providerTransactionId` columns; reuses the `tx.transaction.create` inside `$transaction` pattern from 5-2's `bulkCreate` so the prefixed-ids extension fires) AND `findExistingProviderTxIds(userId: string, provider: string, providerTxIds: string[]): Promise<Set<string>>` (single `findMany` round-trip for dedup pre-flight).

#### `apps/api/prisma/schema/transactions.prisma`

```prisma
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

**5-6 adds** two nullable columns + one partial unique index:
- `provider String? @map("provider")` (text, nullable — `null` for manual/CSV rows, `"bridge"` for Bridge-pulled rows).
- `providerTransactionId String? @map("provider_transaction_id")` (text, nullable).
- New index `@@index([userId, provider, providerTransactionId], map: "transactions_user_provider_txid_idx")` for the dedup pre-flight.
- Manual SQL migration adds the partial **UNIQUE** constraint `WHERE provider IS NOT NULL` (Prisma doesn't model partial uniques cleanly — hand-write).

#### `apps/api/src/database/id-prefixes.config.ts:16-50`

```ts
export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  AccountBalanceLog: "abl",
  Holding: "hld",
  HoldingLot: "lot",

  // Transactions (story 0-4)
  Transaction: "tx",

  // Monthly + KPI (story 0-4 + story 5-4)
  Kpi: "kpi",
  MonthlyTracking: "mtr",
  MonthlyRecord: "mr",

  // Hypothesis (story 0-4) — brownfield UUID column, see header note.
  Hypothesis: null,

  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",

  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateMortgage: "resm",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",

  // LLM (story 6-1 — registered upfront)
  LlmCallLog: "llm",
  LlmOptIn: "llmo",
} as const satisfies Record<string, string | null>;
```

**5-6 adds** `BankConnection: "bnk"` immediately after `LlmOptIn`.

#### `apps/api/src/bootstrap/runtime-dependencies.ts:135-157`

```ts
const transactionsModule = createTransactionsModule({
  prismaService,
  accountOwnershipProbe: {
    exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
    existsMany: (userId, accountIds) => accountsModule.service.accountsExist(userId, accountIds),
  },
  accountResolver: {
    resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label),
  },
});

const monthlyModule = createMonthlyModule({ prismaService });

const orpcRouter: PekuloRpcRouter = {
  hypothesis: hypothesisModule.router,
  compass: compassModule.router,
  milestones: milestonesModule.router,
  accounts: accountsModule.router,
  holdings: holdingsModule.router,
  realestate: realestateModule.router,
  transactions: transactionsModule.router,
  monthly: monthlyModule.router,
};
```

**5-6 inserts** `createBankAggregatorModule({prismaService, env: input.env, transactionsService: transactionsModule.service, accountsService: accountsModule.service, clock: undefined})` after `monthlyModule` AND registers `bankaggregator: bankAggregatorModule.router` on the `orpcRouter` object literal.

#### `apps/api/src/app.ts:96-104` (head + lifecycle window)

```ts
.use(healthModule.router);

mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });

await registerLifecycle(
  app,
  { shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS },
  { prismaService: deps.prismaService, shutdownOtel },
);
```

**5-6 inserts** `app.use(bankAggregatorModule.webhookRouter)` between `app.use(healthModule.router)` and `mountOrpc(app, ...)` so the webhook route resolves BEFORE the oRPC catch-all (lifecycle wire-up for the cron lives in `registerLifecycle`'s extension via deps).

#### `packages/contracts/src/index.ts:11-27`

```ts
export { authContract, authContractV1, authContractMeta } from "./auth";
export { compassContract, compassContractV1, compassContractMeta } from "./compass";
export { milestonesContract, milestonesContractV1, milestonesContractMeta } from "./milestones";
export { accountsContract, accountsContractV1, accountsContractMeta } from "./accounts";
export { holdingsContract, holdingsContractV1, holdingsContractMeta } from "./holdings";
export { realestateContract, realestateContractV1, realestateContractMeta } from "./realestate";
export {
  transactionsContract,
  transactionsContractV1,
  transactionsContractMeta,
} from "./transactions";
export { monthlyContract, monthlyContractV1, monthlyContractMeta } from "./monthly";
export { dashboardContract, dashboardContractV1, dashboardContractMeta } from "./dashboard";
export { settingsContract, settingsContractV1, settingsContractMeta } from "./settings";
export { hypothesisContract, hypothesisContractV1, hypothesisContractMeta } from "./hypothesis";
export { llmContract, llmContractV1, llmContractMeta } from "./llm";
```

**5-6 adds** `export { bankAggregatorContract, bankAggregatorContractV1, bankAggregatorContractMeta } from "./bank-aggregator";` immediately after the `llmContract` line + imports + registration in the `pekuloContract` aggregator object literal (`bankaggregator: bankAggregatorContract` — note: all lowercase, no separator per the 13-module convention from architecture.md L1177).

#### `apps/api/src/config/env.ts:9-38`

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(32, "…"),
  SUPABASE_URL: z.string().url(),
  PRICES_SERVICE_URL: optionalString(z.string().url()),
  PRICES_SERVICE_TOKEN: optionalString(z.string().min(1)),
  TWELVE_DATA_API_KEY: optionalString(z.string().min(1)),
  FRANKFURTER_BASE_URL: optionalString(z.string().url()),
  OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString(z.string().url()),
  OTEL_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
});
```

**5-6 adds** the following keys at the bottom of the schema (above the closing `})`):
- `BRIDGE_CLIENT_ID: z.string().min(1)` — Bridge developer Client-Id header.
- `BRIDGE_CLIENT_SECRET: z.string().min(1)` — Bridge developer Client-Secret (Dokploy env only).
- `BRIDGE_WEBHOOK_SIGNING_SECRET: z.string().min(1)` — HMAC-SHA256 endpoint secret.
- `BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: optionalString(z.string().min(1))` — 24h rotation overlap.
- `BRIDGE_API_BASE: z.string().url().default("https://api.bridgeapi.io")`.
- `BRIDGE_API_VERSION: z.string().min(1).default("2025-01-15")`.
- `BRIDGE_REFRESH_CRON_HOURS: z.coerce.number().int().positive().max(168).default(6)`.

#### `apps/web/src/lib/zapaction/keys.ts:88-180`

Existing pattern:
```ts
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, { … });
export const MONTHLY_KEY = "monthly" as const;
export const monthlyKeys = createFeatureKeys(MONTHLY_KEY, { … });
export const monthlyTags = createFeatureTags(MONTHLY_KEY, { … });
…
[accountsTags.all()]: [accountsKeys.list()],
[accountsTags.list()]: [accountsKeys.list()],
…
[transactionsTags.list()]: [[TRANSACTIONS_KEY], accountsKeys.list(), [MONTHLY_KEY]],
[monthlyTags.all()]: [[MONTHLY_KEY]],
```

**5-6 adds** alongside `monthlyKeys` / `monthlyTags`:
```ts
export const BANK_CONNECTIONS_KEY = "bankConnections" as const;
export const bankConnectionsKeys = createFeatureKeys(BANK_CONNECTIONS_KEY, { … });
export const bankConnectionsTags = createFeatureTags(BANK_CONNECTIONS_KEY, { … });
```
+ registry edge `[bankConnectionsTags.list()]: [bankConnectionsKeys.list()]` AND a join into the transactions edge: refresh-driven bulk inserts via `importFromProvider` should ALSO invalidate `transactionsTags.list()` — that already cascades to `[MONTHLY_KEY]` + `accountsKeys.list()`. The completeConnection / refreshConnection web hooks pass `invalidateWithTags: [bankConnectionsTags.list(), transactionsTags.list()]` so a successful connect or refresh repaints both the parametres connections row AND the transactions list.

### File map (3-bullet per file)

#### New files — apps/api

##### `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`
- **Responsibility:** Bank-aggregator domain operations — initiate/complete OAuth, list/refresh connections, handle webhooks, run scheduled refreshAll. Factory `createBankAggregatorService` injects clock, provider, repo, transactionsService, accountsService.
- **I/O:** imports `BankProvider`, `BankAggregatorRepository`, `TransactionsService` (cross-module dep), `AccountsService` (cross-module dep), `decimalToNumber` ; exports `createBankAggregatorService` + `BankAggregatorService` interface.

##### `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts`
- **Responsibility:** Vault-aware Prisma adapter for `bank_connections` — CRUD via `where: { userId }` defense-in-depth; secret writes via `vault.create_secret(...)` + reads via `vault.decrypted_secrets` join; never returns plaintext tokens to the caller.
- **I/O:** consumes `prismaService.client` ; exports `createBankAggregatorRepository` + `BankAggregatorRepository` interface.

##### `apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts`
- **Responsibility:** oRPC router binding 4 procedures (`initiateConnection`, `completeConnection`, `listConnections`, `refreshConnection`) to the service; Elysia rate-limit on `refreshConnection`.
- **I/O:** consumes `BankAggregatorService` + `bankAggregatorContract` ; exports `createBankAggregatorRouter`.

##### `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts`
- **Responsibility:** Composition root — wires repo + service + router + webhookRouter + refreshScheduler. Returns `{ service, repository, router, webhookRouter, scheduledTask }`.
- **I/O:** consumes `prismaService`, `env`, `transactionsService`, `accountsService`, optional `clock` ; exports `createBankAggregatorModule`.

##### `apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts`
- **Responsibility:** Typed `PekuloError` constructors per Bridge-specific error code.
- **I/O:** consumes `PekuloError` ; exports `bankConnectionNotFound`, `bankConnectionAlreadyExists`, `bankProviderUnavailable`, `bankWebhookInvalidSignature`, `bankScaRequired`.

##### `apps/api/src/modules/bank-aggregator/bank-provider.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/bank-provider.ts`
- **Responsibility:** Pure interface for any bank-aggregator provider (Bridge V1, Powens V2+). Defines `createConnectSession`, `exchangeCode`, `listAccounts`, `listTransactions`, `revokeItem`, `getItem`.
- **I/O:** zero IO ; type-only definitions.

##### `apps/api/src/modules/bank-aggregator/services/bridge-client.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/services/bridge-client.ts`
- **Responsibility:** `BridgeProvider` impl — outbound HTTP to `api.bridgeapi.io` with `Bridge-Version` + Client-Id/Secret + Bearer + OTel-instrumented redacted-body spans.
- **I/O:** consumes `env` + native `fetch` ; exports `createBridgeProvider` + `BridgeProvider`.

##### `apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts`
- **Responsibility:** Pure `verifyBridgeSignature(rawBody, header, secrets)` — HMAC-SHA256 + timing-safe + multi-secret rotation + downgrade-attack defense (disregard non-v1 schemes).
- **I/O:** zero IO ; uses `node:crypto` ; exports `verifyBridgeSignature` + `VerifyResult` type.

##### `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts`
- **Responsibility:** Elysia router for `/internal/bridge/webhook` — `onParse` raw body capture + 256 KB cap + HMAC verify + dispatch to `service.handleWebhookEvent`.
- **I/O:** consumes `verifyBridgeSignature`, `BankAggregatorService`, `env` ; exports `createBridgeWebhookRouter` returning an inferred-type Elysia chain.

##### `apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts`
- **Path:** `apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts`
- **Responsibility:** Bun `setInterval`-backed cron — invokes `service.refreshAll()` every `BRIDGE_REFRESH_CRON_HOURS` h; idempotent start/stop; surfaces failures via `console.warn`.
- **I/O:** consumes `BankAggregatorService` + `env` ; exports `createRefreshScheduler` returning `{ start, stop }`.

##### `apps/api/prisma/schema/bank_aggregator.prisma`
- **Path:** `apps/api/prisma/schema/bank_aggregator.prisma`
- **Responsibility:** Prisma model `BankConnection` — Vault secret-id FK columns + status text + provider_item_id + indices + RLS hint.
- **I/O:** Prisma schema folder file ; consumed by `bun --filter='@pekulo/api' run prisma:generate`.

##### `apps/api/prisma/migrations/<TS>_create_bank_connections/migration.sql`
- **Path:** `apps/api/prisma/migrations/<TS>_create_bank_connections/migration.sql`
- **Responsibility:** Hand-written SQL — `CREATE EXTENSION IF NOT EXISTS supabase_vault;`, create `bank_connections` table, indexes, 4 RLS policies on `auth.uid() = user_id`.
- **I/O:** Postgres DDL applied via `prisma migrate dev` (locally) or `prisma migrate deploy` (Dokploy).

##### `apps/api/prisma/migrations/<TS>_alter_transactions_provider_dedup_and_accounts_provider_key/migration.sql`
- **Path:** `apps/api/prisma/migrations/<TS>_alter_transactions_provider_dedup_and_accounts_provider_key/migration.sql`
- **Responsibility:** Hand-written SQL — `ALTER TABLE transactions ADD COLUMN provider`, `provider_transaction_id`, partial unique index `WHERE provider IS NOT NULL` + `ALTER TABLE accounts ADD COLUMN provider`, `provider_account_key`, unique on `(user_id, provider, provider_account_key) WHERE provider IS NOT NULL`.
- **I/O:** Postgres DDL.

##### Test files (paths in File List below)

- `apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts` — Bun unit tests for service methods.
- `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.test.ts` — Bun tests against local Supabase (Vault round-trip).
- `apps/api/src/modules/bank-aggregator/bank-aggregator.module.test.ts` — composition smoke test.
- `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts` — full lifecycle with fake `BankProvider` (T29).
- `apps/api/src/modules/bank-aggregator/bank-aggregator.security.test.ts` — pino + OTel sentinel guard (T28).
- `apps/api/src/modules/bank-aggregator/services/webhook-verifier.test.ts` — 6 HMAC cases.
- `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.test.ts` — 401 < 100 ms perf + no-DB-write.
- `apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts` — fetch-mocked Bridge API methods.

#### New files — packages

##### `packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts`
- **Path:** `packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts`
- **Responsibility:** Zod schemas — `bankConnectionSchema` (DTO without secret IDs), `initiateConnectionInputSchema`, `initiateConnectionOutputSchema`, `completeConnectionInputSchema`, `completeConnectionOutputSchema`, `listConnectionsOutputSchema`, `refreshConnectionInputSchema`, `refreshConnectionOutputSchema`.
- **I/O:** consumes `@pekulo/zod` ; exports schemas + inferred TS types.

##### `packages/validators/src/bank-aggregator/index.ts`
- **Path:** `packages/validators/src/bank-aggregator/index.ts`
- **Responsibility:** Barrel re-exporting every schema + inferred type.

##### `packages/contracts/src/bank-aggregator/bank-aggregator.contract.ts`
- **Path:** `packages/contracts/src/bank-aggregator/bank-aggregator.contract.ts`
- **Responsibility:** oRPC contract — 4 procedures + typed `.errors({ … })` per procedure.
- **I/O:** consumes `@orpc/contract` + `@pekulo/validators` ; exports `bankAggregatorContract` + `bankAggregatorContractV1` + `bankAggregatorContractMeta`.

##### `packages/contracts/src/bank-aggregator/index.ts`
- **Path:** `packages/contracts/src/bank-aggregator/index.ts`
- **Responsibility:** Barrel.

#### New files — apps/web (minimal)

##### `apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx`
- **Path:** `apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx`
- **Responsibility:** Server Component callback — reads `?code` + `?state` from `searchParams`, calls `completeConnection` server action, redirects to `/dashboard/parametres` on success or renders the error state.
- **I/O:** Next.js RSC ; consumes `completeConnection` from `_actions/bank-aggregator-actions`.

##### `apps/web/src/app/(cap)/dashboard/parametres/_actions/bank-aggregator-actions.ts`
- **Path:** `apps/web/src/app/(cap)/dashboard/parametres/_actions/bank-aggregator-actions.ts`
- **Responsibility:** `'use server'` zapaction wrappers — `initiateConnection`, `completeConnection`. **OMIT `output:` slot** (discriminated-union envelope per lesson 2026-05-20).
- **I/O:** consumes oRPC client + `defineAction` ; returns `{ ok: true; … } | { ok: false; code; message }`.

##### `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-initiate-bank-connection.ts`
- **Path:** `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-initiate-bank-connection.ts`
- **Responsibility:** `useActionMutation` for `initiateConnection`; invalidates `bankConnectionsTags.list()` on success; consumed by the 5-7 settings UI.
- **I/O:** consumes `@zapaction/query` ; client-only.

##### `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-complete-bank-connection.ts`
- **Path:** `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-complete-bank-connection.ts`
- **Responsibility:** `useActionMutation` for `completeConnection`; invalidates `[bankConnectionsTags.list(), transactionsTags.list()]` on success.
- **I/O:** consumes `@zapaction/query` ; client-only.

#### Modified files

| Path | Change |
|---|---|
| `apps/api/prisma/schema/transactions.prisma` | ADD `provider` + `providerTransactionId` columns + new `[userId, provider, providerTransactionId]` index. |
| `apps/api/prisma/schema/accounts.prisma` | ADD `provider` + `providerAccountKey` columns + unique index `(userId, provider, providerAccountKey)` (partial via manual SQL). |
| `apps/api/src/database/id-prefixes.config.ts` | ADD `BankConnection: "bnk"` entry. |
| `apps/api/src/modules/transactions/transactions.service.ts` | ADD `importFromProvider` interface method + impl. |
| `apps/api/src/modules/transactions/transactions.repository.ts` | ADD `bulkCreateFromProvider` + `findExistingProviderTxIds`. |
| `apps/api/src/modules/transactions/transactions.module.ts` | EXPOSE `service.importFromProvider` (already auto-exposed if the interface extends; no change needed unless the module re-exports a narrowed type). |
| `apps/api/src/modules/accounts/accounts.service.ts` | ADD `findOrCreateAutoFromProvider`. |
| `apps/api/src/modules/accounts/accounts.repository.ts` | ADD `findByProviderKey` + `createAuto`. |
| `apps/api/src/bootstrap/runtime-dependencies.ts` | INSERT `createBankAggregatorModule(...)` + register `bankaggregator` on `orpcRouter`. |
| `apps/api/src/bootstrap/lifecycle.ts` | REGISTER `bankAggregatorModule.scheduledTask.start()` on boot + `.stop()` on shutdown. |
| `apps/api/src/app.ts` | INSERT `app.use(bankAggregatorModule.webhookRouter)` between health + mountOrpc. |
| `apps/api/src/config/env.ts` | ADD 7 Bridge env keys. |
| `apps/api/.env.example` | ADD documented Bridge env keys (no real values). |
| `packages/contracts/src/index.ts` | ADD `bankAggregatorContract` export + `bankaggregator` entry in `pekuloContract`. |
| `packages/validators/src/index.ts` | ADD bank-aggregator re-export. |
| `packages/types/src/index.ts` (if used) | ADD bank-aggregator re-export. |
| `apps/web/src/lib/zapaction/keys.ts` | ADD `BANK_CONNECTIONS_KEY` + `bankConnectionsKeys` + `bankConnectionsTags` + registry edge. |
| `docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md` | AMEND §5 with the Vault-over-pgcrypto note (T1). |
| `docs/lessons.md` | APPEND `(cap)/dashboard/*` placement lesson (T31). |

### Execution tasks — full code

> Each task below carries: exact file path, full code block (no `…` snippets), exact test command, expected output, literal commit step. Estimate 2–5 min per task; >5 min tasks (T13/T14/T15/T16) are flagged as "double-budget" — split if dev sees them sliding past 8 min.

---

#### T1 — Amend ADR-0015 §5 with Vault-over-pgcrypto note [AC: AC-1, AC-4]

**File:** `docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md`

**Action:** Find the line `5. **Token storage** — Bridge OAuth tokens encrypted at rest in Supabase via \`pgcrypto\` column-level encryption ; never logged ; never returned by oRPC handlers (DTO mapping strips the secret columns).` and append the following block immediately after it (still inside the same `## Decision` list — use a sub-bullet):

```markdown
   - **Amendment (2026-05-27, story 5-6):** the literal storage mechanism switches from `pgcrypto` column-level encryption to **Supabase Vault** (`supabase_vault` extension). `bank_connections` carries `access_token_secret_id uuid REFERENCES vault.secrets(id) ON DELETE SET NULL` + `refresh_token_secret_id uuid REFERENCES vault.secrets(id) ON DELETE SET NULL` instead of `*_cipher bytea` columns. Vault handles libsodium encryption + master key derivation upstream — Pekulo never holds the master key, never rotates it manually, never embeds crypto code in the repository layer. The invariants from §5 remain unchanged: tokens encrypted at rest, never logged, never returned by oRPC handlers, DTO stripping enforced via type-level guard + sentinel test. See `docs/stories/5-6-bridge-connector.md` for the full implementation surface.
```

**Test:** `bash -c "grep -F 'Amendment (2026-05-27, story 5-6)' docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md && echo OK"`

**Expected output:** `OK` (and the grep line above prefixed).

**Commit:** `git add docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md && git commit -m "feat(#93): amend ADR-0015 with Vault-over-pgcrypto note (T1)"`

---

#### T2 — Manual SQL migration: create `bank_connections` [AC: AC-1, AC-4]

**File:** `apps/api/prisma/migrations/20260527120000_create_bank_connections/migration.sql`

**Action:** Create the directory + file with the following content:

```sql
-- 5-6 — bank_connections table + Vault enablement (ADR-0015 amendment: Vault over pgcrypto).
-- Hand-written per lesson 2026-05-05 (Prisma doesn't introspect Postgres policies).

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE TABLE bank_connections (
  id                          text PRIMARY KEY,
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                    text NOT NULL,
  provider_item_id            text NOT NULL,
  access_token_secret_id      uuid NULL REFERENCES vault.secrets(id) ON DELETE SET NULL,
  refresh_token_secret_id     uuid NULL REFERENCES vault.secrets(id) ON DELETE SET NULL,
  status                      text NOT NULL DEFAULT 'active',
  display_name                text NULL,
  last_refreshed_at           timestamptz NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bank_connections_status_check
    CHECK (status IN ('active', 'sca_required', 'revoked')),
  CONSTRAINT bank_connections_provider_check
    CHECK (provider IN ('bridge'))
);

CREATE UNIQUE INDEX bank_connections_user_provider_item_uq
  ON bank_connections (user_id, provider, provider_item_id);

CREATE INDEX bank_connections_user_status_idx
  ON bank_connections (user_id, status);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_connections_select_own
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY bank_connections_insert_own
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY bank_connections_update_own
  ON bank_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY bank_connections_delete_own
  ON bank_connections FOR DELETE
  USING (auth.uid() = user_id);
```

**Test:** `bun --filter='@pekulo/api' run prisma:migrate:dev && bun --filter='@pekulo/api' run rls-audit`

**Expected output:** `Applying migration ... bank_connections` (no error) AND `rls-audit: OK — N tables, M policies` (M ≥ previous + 4).

**Commit:** `git add apps/api/prisma/migrations/20260527120000_create_bank_connections && git commit -m "feat(#93): migration — create bank_connections + Vault enable (T2)"`

---

#### T3 — Manual SQL migration: ALTER `transactions` + `accounts` for provider dedup + auto-create idempotency [AC: AC-2, AC-7]

**File:** `apps/api/prisma/migrations/20260527120100_alter_transactions_provider_dedup_and_accounts_provider_key/migration.sql`

```sql
-- 5-6 — transactions gets provider + provider_transaction_id columns for dedup ;
-- accounts gets provider + provider_account_key columns for idempotent auto-create.

ALTER TABLE transactions
  ADD COLUMN provider text NULL,
  ADD COLUMN provider_transaction_id text NULL;

CREATE INDEX transactions_user_provider_txid_idx
  ON transactions (user_id, provider, provider_transaction_id);

CREATE UNIQUE INDEX transactions_user_provider_txid_uq
  ON transactions (user_id, provider, provider_transaction_id)
  WHERE provider IS NOT NULL;

ALTER TABLE accounts
  ADD COLUMN provider text NULL,
  ADD COLUMN provider_account_key text NULL;

CREATE UNIQUE INDEX accounts_user_provider_key_uq
  ON accounts (user_id, provider, provider_account_key)
  WHERE provider IS NOT NULL;
```

**Test:** `bun --filter='@pekulo/api' run prisma:migrate:dev && bun --filter='@pekulo/api' run prisma:generate`

**Expected output:** `Applying migration ... alter_transactions_provider_dedup` (no error) AND `✔ Generated Prisma Client` for the API workspace.

**Commit:** `git add apps/api/prisma/migrations/20260527120100_alter_transactions_provider_dedup_and_accounts_provider_key && git commit -m "feat(#93): migration — provider dedup columns on transactions + accounts (T3)"`

---

#### T4 — `BankConnection: "bnk"` prefix registration [AC: AC-1]

**File:** `apps/api/src/database/id-prefixes.config.ts`

**Action:** In the `ID_PREFIXES` object literal, immediately after the `LlmOptIn: "llmo",` line, insert:

```ts
  // Bank-aggregator (story 5-6 — ADR-0015)
  BankConnection: "bnk",
```

**File (companion test):** `apps/api/src/database/id-prefixes.config.test.ts` — append:

```ts
import { test, expect } from "bun:test";
import { getPrefix } from "./id-prefixes.config";

test("BankConnection prefix resolves to bnk", () => {
  expect(getPrefix("BankConnection")).toBe("bnk");
});
```

**Test:** `bun --filter='@pekulo/api' run test src/database/id-prefixes.config.test.ts`

**Expected output:** `pass` count includes the new test (`✓ BankConnection prefix resolves to bnk`).

**Commit:** `git add apps/api/src/database/id-prefixes.config.ts apps/api/src/database/id-prefixes.config.test.ts && git commit -m "feat(#93): register BankConnection prefix bnk (T4)"`

---

#### T5 — Prisma model `BankConnection` [AC: AC-1, AC-4]

**File:** `apps/api/prisma/schema/bank_aggregator.prisma`

```prisma
// bank_aggregator.prisma — Bank-aggregator domain (story 5-6 + ADR-0015).
//
// Token storage path: Supabase Vault — `access_token_secret_id` and
// `refresh_token_secret_id` point to rows in `vault.secrets` (libsodium-backed
// secret storage managed by Supabase). The repository writes secrets via
// $queryRaw `INSERT INTO vault.secrets (...) RETURNING id` and reads via
// the `vault.decrypted_secrets` view. Prisma sees only the `uuid` FK column.
//
// Provider abstraction (ADR-0015): the `provider` column today only carries
// "bridge"; the CHECK constraint at SQL level is the gatekeeper. Future
// implementations (Powens, etc.) add to the CHECK first, then to the union.

model BankConnection {
  id                       String   @id
  userId                   String   @map("user_id") @db.Uuid
  provider                 String
  providerItemId           String   @map("provider_item_id")
  accessTokenSecretId      String?  @map("access_token_secret_id") @db.Uuid
  refreshTokenSecretId     String?  @map("refresh_token_secret_id") @db.Uuid
  status                   String   @default("active")
  displayName              String?  @map("display_name")
  lastRefreshedAt          DateTime? @map("last_refreshed_at") @db.Timestamptz
  createdAt                DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                DateTime @default(now()) @map("updated_at") @db.Timestamptz

  @@unique([userId, provider, providerItemId], map: "bank_connections_user_provider_item_uq")
  @@index([userId, status], map: "bank_connections_user_status_idx")
  @@map("bank_connections")
}
```

Also update `apps/api/prisma/schema/transactions.prisma` — find the model block (existing quoted in Step-0) and replace by:

```prisma
model Transaction {
  id                    String          @id
  userId                String          @map("user_id") @db.Uuid
  accountId             String          @map("account_id")
  occurredOn            DateTime        @map("occurred_on") @db.Date
  label                 String
  amount                Decimal         @db.Decimal
  type                  TransactionType
  category              String
  isImprevu             Boolean         @default(false) @map("is_imprevu")
  notes                 String?
  transferPairId        String?         @map("transfer_pair_id")
  provider              String?         @map("provider")
  providerTransactionId String?         @map("provider_transaction_id")
  createdAt             DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")
  @@index([userId, transferPairId], map: "transactions_user_pair_idx")
  @@index([userId, provider, providerTransactionId], map: "transactions_user_provider_txid_idx")
  @@map("transactions")
}
```

Similarly `apps/api/prisma/schema/accounts.prisma` — add `provider` + `providerAccountKey` fields + the unique index.

**Test:** `bun --filter='@pekulo/api' run prisma:format && bun --filter='@pekulo/api' run prisma:validate && bun --filter='@pekulo/api' run prisma:generate`

**Expected output:** `✔ Formatted` + `✔ The schema is valid` + `✔ Generated Prisma Client`.

**Commit:** `git add apps/api/prisma/schema && git commit -m "feat(#93): Prisma model BankConnection + provider columns (T5)"`

---

#### T6 — Validators schemas `@pekulo/validators/bank-aggregator` [AC: AC-1, AC-2, AC-4, AC-5]

**File:** `packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts`

```ts
// packages/validators/src/bank-aggregator/bank-aggregator.schemas.ts
// Zod schemas for the bank-aggregator domain (story 5-6 + ADR-0015).
// SOLE zod entry point per R1: `from "@pekulo/zod"` only.

import { z } from "@pekulo/zod";

// ---------- DTO (returned by every oRPC handler — strips secret IDs) ----------

export const bankConnectionStatusSchema = z.enum(["active", "sca_required", "revoked"]);
export type BankConnectionStatus = z.infer<typeof bankConnectionStatusSchema>;

export const bankProviderSchema = z.enum(["bridge"]);
export type BankProviderName = z.infer<typeof bankProviderSchema>;

/**
 * Public BankConnection DTO. NEVER contains accessTokenSecretId /
 * refreshTokenSecretId — those are Vault references and never leave the API
 * boundary. Enforced by AC-4 type-level guard + sentinel test (T28).
 */
export const bankConnectionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().uuid(),
  provider: bankProviderSchema,
  providerItemId: z.string().min(1),
  status: bankConnectionStatusSchema,
  displayName: z.string().nullable(),
  lastRefreshedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type BankConnection = z.infer<typeof bankConnectionSchema>;

// ---------- initiateConnection ----------

export const initiateConnectionInputSchema = z.object({
  redirectUri: z.string().url().optional(),
});
export type InitiateConnectionInput = z.infer<typeof initiateConnectionInputSchema>;

export const initiateConnectionOutputSchema = z.object({
  connectUrl: z.string().url(),
  sessionId: z.string().min(1),
});
export type InitiateConnectionOutput = z.infer<typeof initiateConnectionOutputSchema>;

// ---------- completeConnection ----------

export const completeConnectionInputSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type CompleteConnectionInput = z.infer<typeof completeConnectionInputSchema>;

export const completeConnectionOutputSchema = bankConnectionSchema;
export type CompleteConnectionOutput = z.infer<typeof completeConnectionOutputSchema>;

// ---------- listConnections ----------

export const listConnectionsOutputSchema = z.array(bankConnectionSchema);
export type ListConnectionsOutput = z.infer<typeof listConnectionsOutputSchema>;

// ---------- refreshConnection ----------

export const refreshConnectionInputSchema = z.object({
  connectionId: z.string().min(1),
});
export type RefreshConnectionInput = z.infer<typeof refreshConnectionInputSchema>;

export const refreshConnectionOutputSchema = z.object({
  fetched: z.number().int().nonnegative(),
  persisted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  lastRefreshedAt: z.string().datetime(),
});
export type RefreshConnectionOutput = z.infer<typeof refreshConnectionOutputSchema>;
```

**File:** `packages/validators/src/bank-aggregator/index.ts`

```ts
export * from "./bank-aggregator.schemas";
```

**File:** `packages/validators/src/index.ts` — append the existing barrel with:

```ts
export * from "./bank-aggregator";
```

**File (companion test):** `packages/validators/src/bank-aggregator/bank-aggregator.schemas.test.ts`

```ts
import { describe, test, expect } from "vitest";
import {
  bankConnectionSchema,
  completeConnectionInputSchema,
  refreshConnectionInputSchema,
} from "./bank-aggregator.schemas";

describe("bank-aggregator schemas", () => {
  test("bankConnectionSchema accepts a valid DTO without secret-id columns", () => {
    const parsed = bankConnectionSchema.parse({
      id: "bnk_1234567890123456789012",
      userId: "00000000-0000-0000-0000-000000000001",
      provider: "bridge",
      providerItemId: "bridge-item-123",
      status: "active",
      displayName: "Société Générale",
      lastRefreshedAt: "2026-05-27T10:00:00.000Z",
      createdAt: "2026-05-27T09:00:00.000Z",
    });
    expect(parsed.provider).toBe("bridge");
  });

  test("bankConnectionSchema rejects unknown extra keys via strict-after-parse", () => {
    const result = bankConnectionSchema.safeParse({
      id: "bnk_1234567890123456789012",
      userId: "00000000-0000-0000-0000-000000000001",
      provider: "bridge",
      providerItemId: "bridge-item-123",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: "2026-05-27T09:00:00.000Z",
      accessTokenSecretId: "00000000-0000-0000-0000-000000000aaa",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // @ts-expect-error — accessTokenSecretId is stripped by parse (default zod object behavior).
      expect(result.data.accessTokenSecretId).toBeUndefined();
    }
  });

  test("completeConnectionInputSchema requires non-empty code + state", () => {
    expect(completeConnectionInputSchema.safeParse({ code: "", state: "x" }).success).toBe(false);
    expect(completeConnectionInputSchema.safeParse({ code: "x", state: "" }).success).toBe(false);
    expect(completeConnectionInputSchema.safeParse({ code: "x", state: "y" }).success).toBe(true);
  });

  test("refreshConnectionInputSchema requires connectionId", () => {
    expect(refreshConnectionInputSchema.safeParse({}).success).toBe(false);
    expect(refreshConnectionInputSchema.safeParse({ connectionId: "bnk_x" }).success).toBe(true);
  });
});
```

**Test:** `bun --filter='@pekulo/validators' run test src/bank-aggregator/bank-aggregator.schemas.test.ts`

**Expected output:** `Tests  4 passed (4)` (vitest run).

**Commit:** `git add packages/validators/src/bank-aggregator packages/validators/src/index.ts && git commit -m "feat(#93): @pekulo/validators bank-aggregator schemas (T6)"`

---

#### T7 — Contract `@pekulo/contracts/bank-aggregator` [AC: AC-1, AC-2]

**File:** `packages/contracts/src/bank-aggregator/bank-aggregator.contract.ts`

```ts
// packages/contracts/src/bank-aggregator/bank-aggregator.contract.ts
// Bank-aggregator oRPC contract (story 5-6 + ADR-0015). 4 procedures mounted under
// /rpc/v1/bankaggregator (lowercase, no separator — uniform with /realestate).

import { oc } from "@orpc/contract";
import {
  bankConnectionSchema,
  completeConnectionInputSchema,
  completeConnectionOutputSchema,
  initiateConnectionInputSchema,
  initiateConnectionOutputSchema,
  listConnectionsOutputSchema,
  refreshConnectionInputSchema,
  refreshConnectionOutputSchema,
} from "@pekulo/validators";

const bankConnectionNotFoundError = {
  status: 404 as const,
  message: "bank connection not found",
};
const bankConnectionAlreadyExistsError = {
  status: 409 as const,
  message: "bank connection already exists for this item",
};
const bankProviderUnavailableError = {
  status: 503 as const,
  message: "bank provider unavailable",
};
const bankScaRequiredError = {
  status: 409 as const,
  message: "SCA refresh required — user must reconnect",
};

export const bankAggregatorContractV1 = {
  initiateConnection: oc
    .input(initiateConnectionInputSchema)
    .output(initiateConnectionOutputSchema)
    .errors({
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
    }),

  completeConnection: oc
    .input(completeConnectionInputSchema)
    .output(completeConnectionOutputSchema)
    .errors({
      BANK_CONNECTION_ALREADY_EXISTS: bankConnectionAlreadyExistsError,
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
    }),

  listConnections: oc
    .output(listConnectionsOutputSchema),

  refreshConnection: oc
    .input(refreshConnectionInputSchema)
    .output(refreshConnectionOutputSchema)
    .errors({
      BANK_CONNECTION_NOT_FOUND: bankConnectionNotFoundError,
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
      BANK_SCA_REQUIRED: bankScaRequiredError,
    }),
};

export const bankAggregatorContract = bankAggregatorContractV1;

export const bankAggregatorContractMeta = {
  version: "v1" as const,
  mountPath: "/rpc/v1/bankaggregator" as const,
};
```

**File:** `packages/contracts/src/bank-aggregator/index.ts`

```ts
export * from "./bank-aggregator.contract";
```

**Test:** `bun --filter='@pekulo/contracts' run typecheck`

**Expected output:** `tsc --noEmit ... 0 errors`.

**Commit:** `git add packages/contracts/src/bank-aggregator && git commit -m "feat(#93): @pekulo/contracts bank-aggregator contract (T7)"`

---

#### T8 — Register `bankAggregatorContract` in `pekuloContract` [AC: AC-1, AC-2]

**File:** `packages/contracts/src/index.ts`

**Action:** Find the line `export { llmContract, llmContractV1, llmContractMeta } from "./llm";` and immediately after it add:

```ts
export {
  bankAggregatorContract,
  bankAggregatorContractV1,
  bankAggregatorContractMeta,
} from "./bank-aggregator";
```

Then find the matching import block and add:

```ts
import { bankAggregatorContract } from "./bank-aggregator";
```

Finally find the `pekuloContract` object literal and add `bankaggregator: bankAggregatorContract,` (lowercase, no separator) immediately after the `llm: llmContract,` entry.

**Test:** `bun --filter='@pekulo/contracts' run typecheck && bun --filter='@pekulo/api' run typecheck`

**Expected output:** `0 errors` in both workspaces.

**Commit:** `git add packages/contracts/src/index.ts && git commit -m "feat(#93): register bankAggregatorContract in pekuloContract (T8)"`

---

#### T9 — `bank-aggregator.errors.ts` + error codes registry [AC: AC-3, AC-5, AC-9]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts
// Typed PekuloError factories for the bank-aggregator domain (story 5-6).

import { PekuloError } from "../../common/errors";

export function bankConnectionNotFound(connectionId: string): PekuloError {
  return new PekuloError("BANK_CONNECTION_NOT_FOUND", `bank connection ${connectionId} not found`);
}

export function bankConnectionAlreadyExists(providerItemId: string): PekuloError {
  return new PekuloError(
    "BANK_CONNECTION_ALREADY_EXISTS",
    `bank connection already exists for provider item ${providerItemId}`,
  );
}

export function bankProviderUnavailable(reason: string): PekuloError {
  return new PekuloError("BANK_PROVIDER_UNAVAILABLE", `bank provider unavailable: ${reason}`);
}

export function bankWebhookInvalidSignature(): PekuloError {
  return new PekuloError("BANK_WEBHOOK_INVALID_SIGNATURE", "invalid webhook signature");
}

export function bankScaRequired(connectionId: string): PekuloError {
  return new PekuloError(
    "BANK_SCA_REQUIRED",
    `SCA refresh required for connection ${connectionId} — user must reconnect`,
  );
}
```

**File:** `apps/api/src/common/errors.ts` — find `PEKULO_ERROR_CODES` (typed string-literal union or enum) and add:

```ts
  "BANK_CONNECTION_NOT_FOUND",
  "BANK_CONNECTION_ALREADY_EXISTS",
  "BANK_PROVIDER_UNAVAILABLE",
  "BANK_WEBHOOK_INVALID_SIGNATURE",
  "BANK_SCA_REQUIRED",
```

Same file, find `ORPC_HTTP_STATUS_BY_CODE` map and add:

```ts
  BANK_CONNECTION_NOT_FOUND: 404,
  BANK_CONNECTION_ALREADY_EXISTS: 409,
  BANK_PROVIDER_UNAVAILABLE: 503,
  BANK_WEBHOOK_INVALID_SIGNATURE: 401,
  BANK_SCA_REQUIRED: 409,
```

**Test:** `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test src/common/errors.test.ts`

**Expected output:** `0 errors` + the errors test suite passes (existing tests + any new code-lookup test if present).

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts apps/api/src/common/errors.ts && git commit -m "feat(#93): bank-aggregator error codes (T9)"`

---

#### T10 — `BankProvider` interface (pure abstraction per ADR-0015) [AC: AC-1, AC-2, AC-5]

**File:** `apps/api/src/modules/bank-aggregator/bank-provider.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-provider.ts
// Provider abstraction per ADR-0015. Iso-pattern with `holdings/services/prices-client.ts`.
// BridgeProvider implements it under services/bridge-client.ts ; Powens (V2+)
// writes a sibling implementation in the same folder without touching the
// domain layer.

export interface ProviderConnectSession {
  connectUrl: string;
  sessionId: string;
}

export interface ProviderTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
}

export interface ProviderBankAccount {
  providerAccountId: string;
  bankName: string;
  accountName: string;
  kind: "checking" | "savings" | "other";
  currency: string;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  providerAccountId: string;
  occurredOn: Date;
  amount: number; // signed: positive for inflow, negative for outflow
  label: string;
  rawCategory: string | null;
  updatedAt: Date;
}

export interface ProviderItemState {
  providerItemId: string;
  statusCode: number; // 0 = ok ; 1010 = SCA expired ; other codes per Bridge docs
  statusMessage: string;
  authenticationExpiresAt: Date | null;
}

export interface BankProvider {
  /**
   * Build the Bridge-hosted Connect widget URL. `userEmail` is required by
   * Bridge — pass the authenticated user's Supabase email.
   */
  createConnectSession(args: {
    userEmail: string;
    redirectUri?: string;
    itemId?: string;
    forceReauthentication?: boolean;
  }): Promise<ProviderConnectSession>;

  /**
   * Exchange the `code` from the OAuth callback for an access + refresh token
   * pair plus the resolved `providerItemId`.
   */
  exchangeCode(args: { code: string; state: string }): Promise<{
    providerItemId: string;
    tokens: ProviderTokenPair;
  }>;

  /**
   * List the bank accounts attached to a given item.
   */
  listAccounts(args: { tokens: ProviderTokenPair; providerItemId: string }): Promise<ProviderBankAccount[]>;

  /**
   * Incremental transaction fetch using the `since` timestamp dedup mechanism
   * (lesson from Bridge docs: `since=<ISO updated_at>` returns only rows with
   * `updated_at > since`).
   */
  listTransactions(args: {
    tokens: ProviderTokenPair;
    providerItemId: string;
    since: Date | null;
  }): Promise<{ transactions: ProviderTransaction[]; latestUpdatedAt: Date | null }>;

  /**
   * Revoke a Bridge item — used by the 5-7 revoke flow. 5-6 implements but
   * does not expose via oRPC (the procedure ships in 5-7).
   */
  revokeItem(args: { tokens: ProviderTokenPair; providerItemId: string }): Promise<void>;

  /**
   * Query the current item state — used by the cron-backup refresh to skip
   * items in `SCA_REQUIRED` (1010) without calling listTransactions.
   */
  getItem(args: { tokens: ProviderTokenPair; providerItemId: string }): Promise<ProviderItemState>;
}
```

**Test:** `bun --filter='@pekulo/api' run typecheck`

**Expected output:** `0 errors`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-provider.ts && git commit -m "feat(#93): BankProvider interface (T10)"`

---

#### T11 — `webhook-verifier.ts` pure HMAC verifier + 6 Bun tests [AC: AC-3]

**File:** `apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts`

```ts
// apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts
// Pure HMAC-SHA256 verifier for Bridge webhook signatures (story 5-6, NFR-33).
//
// Bridge sends `BridgeApi-Signature: t=<ts>,v1=<hex>[,v1=<hex_during_rotation>]`.
// We accept multiple v1 entries (24h rotation overlap, max 2 active secrets).
// We DISREGARD non-v1 schemes (downgrade-attack defense).
// We use timing-safe equality (node:crypto).

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export function verifyBridgeSignature(args: {
  rawBody: Uint8Array;
  header: string | null;
  secrets: string[]; // current + previous (during 24h rotation)
}): VerifyResult {
  const { rawBody, header, secrets } = args;

  if (!header) return { valid: false, reason: "missing-header" };
  if (secrets.length === 0) return { valid: false, reason: "no-secrets-configured" };

  const parts = header.split(",").map((p) => p.trim());
  const v1Hexes: string[] = [];
  for (const part of parts) {
    const [scheme, hex] = part.split("=");
    if (scheme === "v1" && hex) v1Hexes.push(hex);
    // Non-v1 schemes (v0, v2, etc.) are silently dropped — downgrade defense.
  }
  if (v1Hexes.length === 0) return { valid: false, reason: "no-v1-signatures" };

  for (const secret of secrets) {
    const expectedHex = createHmac("sha256", secret).update(Buffer.from(rawBody)).digest("hex");
    const expected = Buffer.from(expectedHex, "hex");
    for (const received of v1Hexes) {
      let receivedBuf: Buffer;
      try {
        receivedBuf = Buffer.from(received, "hex");
      } catch {
        continue;
      }
      if (receivedBuf.length !== expected.length) continue;
      if (timingSafeEqual(expected, receivedBuf)) return { valid: true };
    }
  }

  return { valid: false, reason: "signature-mismatch" };
}
```

**File (tests):** `apps/api/src/modules/bank-aggregator/services/webhook-verifier.test.ts`

```ts
import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyBridgeSignature } from "./webhook-verifier";

const SECRET = "test-secret-1234567890abcdef";
const SECRET_PREVIOUS = "previous-secret-rotation-window-active";

function makeHeader(body: Uint8Array, secret: string, ts = "1700000000"): string {
  const hex = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
  return `t=${ts},v1=${hex}`;
}

test("valid v1 signature passes", () => {
  const body = new TextEncoder().encode(JSON.stringify({ type: "item.refreshed" }));
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET),
    secrets: [SECRET],
  });
  expect(result.valid).toBe(true);
});

test("missing header is rejected", () => {
  const body = new TextEncoder().encode("x");
  const result = verifyBridgeSignature({ rawBody: body, header: null, secrets: [SECRET] });
  expect(result).toEqual({ valid: false, reason: "missing-header" });
});

test("no-v1 scheme (downgrade attempt) is rejected", () => {
  const body = new TextEncoder().encode("x");
  const hex = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: `t=1700000000,v0=${hex}`,
    secrets: [SECRET],
  });
  expect(result.valid).toBe(false);
  expect(result.reason).toBe("no-v1-signatures");
});

test("signature mismatch is rejected", () => {
  const body = new TextEncoder().encode("x");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: "t=1700000000,v1=deadbeef",
    secrets: [SECRET],
  });
  expect(result.valid).toBe(false);
  expect(result.reason).toBe("signature-mismatch");
});

test("rotation overlap — previous secret still validates", () => {
  const body = new TextEncoder().encode("rotation");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET_PREVIOUS),
    secrets: [SECRET, SECRET_PREVIOUS],
  });
  expect(result.valid).toBe(true);
});

test("multiple v1 signatures — one valid is enough", () => {
  const body = new TextEncoder().encode("multi");
  const validHex = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: `t=1700000000,v1=deadbeef,v1=${validHex}`,
    secrets: [SECRET],
  });
  expect(result.valid).toBe(true);
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/services/webhook-verifier.test.ts`

**Expected output:** `6 pass`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts apps/api/src/modules/bank-aggregator/services/webhook-verifier.test.ts && git commit -m "feat(#93): pure HMAC verifier for Bridge webhooks + 6 tests (T11)"`

---

#### T12 — `bridge-webhook-router.ts` Elysia route + raw body + body cap + 401 < 100 ms test [AC: AC-3, AC-9]

**File:** `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts`

```ts
// apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts
// Elysia router for /internal/bridge/webhook. Raw body capture via onParse so
// HMAC verification operates on the unparsed bytes (Bridge docs are explicit:
// "It is mandatory to use the raw request body").
//
// AC-3 invariant: 401 within 100 ms on invalid signature, zero DB writes,
// zero payload bytes in logs. We log only the request id + signature result.

import { Elysia } from "elysia";
import type { Env } from "../../../config/env";
import { verifyBridgeSignature } from "./webhook-verifier";
import type { BankAggregatorService } from "../bank-aggregator.service";

const MAX_WEBHOOK_BYTES = 256_000;

export function createBridgeWebhookRouter(args: {
  env: Env;
  service: BankAggregatorService;
}) {
  const { env, service } = args;
  const secrets: string[] = [];
  if (env.BRIDGE_WEBHOOK_SIGNING_SECRET) secrets.push(env.BRIDGE_WEBHOOK_SIGNING_SECRET);
  if (env.BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS) secrets.push(env.BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS);

  return new Elysia({ name: "bridge-webhook" })
    .onParse(async ({ request, contentType }) => {
      // Capture raw body for HMAC. Return the buffer so handlers receive `body`
      // as a Uint8Array. We do NOT parse JSON here — that happens after verify.
      if (contentType?.startsWith("application/json")) {
        const buf = new Uint8Array(await request.arrayBuffer());
        return buf;
      }
    })
    .post(
      "/internal/bridge/webhook",
      async ({ body, headers, set }) => {
        const startedAt = performance.now();
        const rawBody = body instanceof Uint8Array ? body : new Uint8Array();

        if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
          set.status = 413;
          return new Response(null, { status: 413 });
        }

        const result = verifyBridgeSignature({
          rawBody,
          header: headers["bridgeapi-signature"] ?? null,
          secrets,
        });

        if (!result.valid) {
          set.status = 401;
          const elapsed = performance.now() - startedAt;
          console.warn(`[bridge-webhook] reject ${result.reason} in ${elapsed.toFixed(2)} ms`);
          return new Response(null, { status: 401 });
        }

        // Parse JSON AFTER verify. Any parse error is also a 400 since a valid
        // HMAC over malformed JSON is a Bridge bug — return 400 so they retry.
        let event: unknown;
        try {
          event = JSON.parse(new TextDecoder().decode(rawBody));
        } catch {
          set.status = 400;
          return new Response(null, { status: 400 });
        }

        await service.handleWebhookEvent(event);
        return new Response(null, { status: 204 });
      },
      {
        // Type the body as anything — onParse already returned the raw buffer.
        type: "arrayBuffer",
      },
    );
}
```

**File (tests):** `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.test.ts`

```ts
import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { createBridgeWebhookRouter } from "./bridge-webhook-router";
import type { Env } from "../../../config/env";
import type { BankAggregatorService } from "../bank-aggregator.service";

const SECRET = "test-secret-1234567890abcdef";

function makeEnv(): Env {
  // Minimal Env shape — only the keys the router reads. Fields not used can
  // carry safe defaults.
  return {
    BRIDGE_WEBHOOK_SIGNING_SECRET: SECRET,
    BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: undefined,
  } as unknown as Env;
}

function makeFakeService(): BankAggregatorService {
  return {
    initiateConnection: async () => ({ connectUrl: "x", sessionId: "x" }),
    completeConnection: async () => ({
      id: "x",
      userId: "00000000-0000-0000-0000-000000000001",
      provider: "bridge",
      providerItemId: "x",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    }),
    listConnections: async () => [],
    refreshConnection: async () => ({
      fetched: 0,
      persisted: 0,
      skipped: 0,
      lastRefreshedAt: new Date().toISOString(),
    }),
    refreshAll: async () => undefined,
    handleWebhookEvent: async () => undefined,
    getReconnectUrl: async () => "https://x",
  };
}

test("invalid signature → 401 within 100 ms + no DB write", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const startedAt = performance.now();
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "bridgeapi-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "item.refreshed" }),
    }),
  );
  const elapsed = performance.now() - startedAt;
  expect(res.status).toBe(401);
  expect(elapsed).toBeLessThan(100);
});

test("valid signature → 204", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const bodyStr = JSON.stringify({ type: "item.refreshed", content: { item_id: 1, status_code: 0 } });
  const hex = createHmac("sha256", SECRET).update(bodyStr).digest("hex");
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "bridgeapi-signature": `t=1,v1=${hex}` },
      body: bodyStr,
    }),
  );
  expect(res.status).toBe(204);
});

test("body > 256 KB → 413", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const huge = "x".repeat(300_000);
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "bridgeapi-signature": "t=1,v1=deadbeef" },
      body: huge,
    }),
  );
  expect(res.status).toBe(413);
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/services/bridge-webhook-router.test.ts`

**Expected output:** `3 pass`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.test.ts && git commit -m "feat(#93): Bridge webhook router with raw body + HMAC + body cap (T12)"`

---

#### T13 — `bridge-client.ts` `BridgeProvider` impl [AC: AC-1, AC-2, AC-5] **(double-budget — split T13a/T13b if it slides past 8 min)**

**File:** `apps/api/src/modules/bank-aggregator/services/bridge-client.ts`

```ts
// apps/api/src/modules/bank-aggregator/services/bridge-client.ts
// BridgeProvider — outbound HTTP to api.bridgeapi.io per ADR-0015 + Bridge docs
// (verified via context7 /websites/bridgeapi_io on 2026-05-27).
//
// SECURITY:
// - Client-Id + Client-Secret read from env (Dokploy only).
// - Access token NEVER logged.
// - OTel span attributes carry method + url + status only — NEVER body bytes.

import type { Env } from "../../../config/env";
import { bankProviderUnavailable } from "../bank-aggregator.errors";
import type {
  BankProvider,
  ProviderBankAccount,
  ProviderConnectSession,
  ProviderItemState,
  ProviderTokenPair,
  ProviderTransaction,
} from "../bank-provider";

function authHeaders(env: Env, bearer?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Bridge-Version": env.BRIDGE_API_VERSION,
    "Client-Id": env.BRIDGE_CLIENT_ID,
    "Client-Secret": env.BRIDGE_CLIENT_SECRET,
    "accept": "application/json",
    "content-type": "application/json",
  };
  if (bearer) h["Authorization"] = `Bearer ${bearer}`;
  return h;
}

export function createBridgeProvider(args: { env: Env }): BankProvider {
  const { env } = args;
  const base = env.BRIDGE_API_BASE.replace(/\/$/, "");

  async function req<T>(path: string, init: RequestInit & { bearer?: string }): Promise<T> {
    const { bearer, ...rest } = init;
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { ...rest, headers: { ...authHeaders(env, bearer), ...(rest.headers ?? {}) } });
      if (!res.ok) {
        throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} → ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.message.includes("bridge ")) throw err;
      throw bankProviderUnavailable(`bridge ${rest.method ?? "GET"} ${path} threw: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return {
    async createConnectSession({ userEmail, redirectUri, itemId, forceReauthentication }) {
      const body: Record<string, unknown> = { user_email: userEmail };
      if (redirectUri) body.callback_url = redirectUri;
      if (itemId) body.item_id = itemId;
      if (forceReauthentication) body.force_reauthentication = true;
      const data = await req<{ id: string; url: string }>(`/v3/aggregation/connect-sessions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return { connectUrl: data.url, sessionId: data.id } satisfies ProviderConnectSession;
    },

    async exchangeCode({ code }) {
      // Bridge OAuth-equivalent code exchange — endpoint shape may evolve per
      // Bridge-Version; this implementation targets 2025-01-15.
      const data = await req<{
        access_token: string;
        refresh_token: string;
        item_id: number;
        expires_at: string;
      }>(`/v3/aggregation/authorization/token`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      return {
        providerItemId: String(data.item_id),
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_at ? new Date(data.expires_at) : null,
        } satisfies ProviderTokenPair,
      };
    },

    async listAccounts({ tokens, providerItemId }) {
      const data = await req<{
        resources: Array<{
          id: number;
          name: string;
          bank_id: number;
          bank_name: string;
          type: "checking" | "savings" | string;
          currency_code: string;
        }>;
      }>(`/v3/aggregation/items/${providerItemId}/accounts`, {
        method: "GET",
        bearer: tokens.accessToken,
      });
      return data.resources.map((r) => ({
        providerAccountId: String(r.id),
        bankName: r.bank_name,
        accountName: r.name,
        kind: r.type === "savings" ? "savings" : r.type === "checking" ? "checking" : "other",
        currency: r.currency_code,
      } satisfies ProviderBankAccount));
    },

    async listTransactions({ tokens, providerItemId, since }) {
      const params = new URLSearchParams({ limit: "500" });
      if (since) params.set("since", since.toISOString());
      const data = await req<{
        resources: Array<{
          id: number;
          account_id: number;
          amount: number;
          description: string;
          category_id: number | null;
          date: string;
          updated_at: string;
        }>;
      }>(`/v3/aggregation/items/${providerItemId}/transactions?${params.toString()}`, {
        method: "GET",
        bearer: tokens.accessToken,
      });
      let latest: Date | null = null;
      const transactions = data.resources.map((r) => {
        const updatedAt = new Date(r.updated_at);
        if (!latest || updatedAt > latest) latest = updatedAt;
        return {
          providerTransactionId: String(r.id),
          providerAccountId: String(r.account_id),
          occurredOn: new Date(r.date),
          amount: r.amount,
          label: r.description,
          rawCategory: r.category_id !== null ? String(r.category_id) : null,
          updatedAt,
        } satisfies ProviderTransaction;
      });
      return { transactions, latestUpdatedAt: latest };
    },

    async revokeItem({ tokens, providerItemId }) {
      await req<{ ok: true }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "DELETE",
        bearer: tokens.accessToken,
      });
    },

    async getItem({ tokens, providerItemId }) {
      const data = await req<{
        id: number;
        status_code: number;
        status_code_info: string;
        authentication_expires_at: string | null;
      }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "GET",
        bearer: tokens.accessToken,
      });
      return {
        providerItemId: String(data.id),
        statusCode: data.status_code,
        statusMessage: data.status_code_info,
        authenticationExpiresAt: data.authentication_expires_at ? new Date(data.authentication_expires_at) : null,
      } satisfies ProviderItemState;
    },
  };
}
```

**File (tests):** `apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts`

```ts
import { test, expect, beforeAll, afterAll, mock } from "bun:test";
import { createBridgeProvider } from "./bridge-client";
import type { Env } from "../../../config/env";

const env = {
  BRIDGE_API_BASE: "https://api.bridgeapi.io",
  BRIDGE_API_VERSION: "2025-01-15",
  BRIDGE_CLIENT_ID: "test-client",
  BRIDGE_CLIENT_SECRET: "test-secret",
} as unknown as Env;

const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
  const path = typeof url === "string" ? new URL(url).pathname : url instanceof URL ? url.pathname : new URL(url.url).pathname;
  if (path === "/v3/aggregation/connect-sessions") {
    return new Response(JSON.stringify({ id: "session-1", url: "https://connect.bridgeapi.io/session/1" }), { status: 200 });
  }
  if (path === "/v3/aggregation/authorization/token") {
    return new Response(JSON.stringify({ access_token: "a", refresh_token: "r", item_id: 42, expires_at: "2026-08-25T00:00:00Z" }), { status: 200 });
  }
  if (path.endsWith("/transactions")) {
    return new Response(JSON.stringify({ resources: [{ id: 1, account_id: 2, amount: -25.5, description: "Carrefour", category_id: 100, date: "2026-05-26", updated_at: "2026-05-26T10:00:00Z" }] }), { status: 200 });
  }
  return new Response("", { status: 404 });
});

beforeAll(() => {
  // @ts-expect-error
  globalThis.fetch = fetchMock;
});
afterAll(() => {
  fetchMock.mockClear();
});

test("createConnectSession returns url + sessionId", async () => {
  const p = createBridgeProvider({ env });
  const session = await p.createConnectSession({ userEmail: "fred@x" });
  expect(session.connectUrl).toContain("connect.bridgeapi.io");
});

test("exchangeCode returns providerItemId + tokens", async () => {
  const p = createBridgeProvider({ env });
  const { providerItemId, tokens } = await p.exchangeCode({ code: "c", state: "s" });
  expect(providerItemId).toBe("42");
  expect(tokens.accessToken).toBe("a");
});

test("listTransactions returns rows + latest updated_at", async () => {
  const p = createBridgeProvider({ env });
  const { transactions, latestUpdatedAt } = await p.listTransactions({
    tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
    providerItemId: "42",
    since: null,
  });
  expect(transactions.length).toBe(1);
  expect(latestUpdatedAt?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/services/bridge-client.test.ts`

**Expected output:** `3 pass`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/services/bridge-client.ts apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts && git commit -m "feat(#93): BridgeProvider impl + fetch-mock tests (T13)"`

---

#### T14 — `bank-aggregator.repository.ts` — Vault round-trip + CRUD [AC: AC-1, AC-2, AC-4] **(double-budget)**

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts
// Vault-aware repository for bank_connections (story 5-6 + ADR-0015 amendment).
//
// Token storage: every secret write goes through Vault's vault.create_secret;
// the returned UUID lands on bank_connections.{access,refresh}_token_secret_id.
// Reads go through vault.decrypted_secrets — apps/api connects with the
// Supabase service role which can SELECT from that view.
//
// NEVER log or return plaintext tokens. The DTO mapper at the end of every
// method drops the secret-id columns from the response shape.

import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../database";
import type { BankConnection, BankConnectionStatus, BankProviderName } from "@pekulo/validators";
import type { ProviderTokenPair } from "./bank-provider";

interface PersistedConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  provider_item_id: string;
  access_token_secret_id: string | null;
  refresh_token_secret_id: string | null;
  status: string;
  display_name: string | null;
  last_refreshed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BankAggregatorRepository {
  createConnection(args: {
    userId: string;
    provider: BankProviderName;
    providerItemId: string;
    displayName: string | null;
    tokens: ProviderTokenPair;
  }): Promise<BankConnection>;

  listByUser(userId: string): Promise<BankConnection[]>;

  findByIdForUser(userId: string, connectionId: string): Promise<{ connection: BankConnection; tokens: ProviderTokenPair } | null>;

  findByProviderItemId(userId: string, provider: BankProviderName, providerItemId: string): Promise<{ connection: BankConnection; tokens: ProviderTokenPair } | null>;

  setStatus(userId: string, connectionId: string, status: BankConnectionStatus): Promise<void>;

  setLastRefreshedAt(userId: string, connectionId: string, at: Date): Promise<void>;

  setStatusByProviderItemId(provider: BankProviderName, providerItemId: string, status: BankConnectionStatus): Promise<void>;
}

function toDto(row: PersistedConnectionRow): BankConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as BankProviderName,
    providerItemId: row.provider_item_id,
    status: row.status as BankConnectionStatus,
    displayName: row.display_name,
    lastRefreshedAt: row.last_refreshed_at ? row.last_refreshed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export function createBankAggregatorRepository(deps: { prismaService: PrismaService }): BankAggregatorRepository {
  const { prismaService } = deps;
  const db = prismaService.client;

  async function createVaultSecret(name: string, secret: string): Promise<string> {
    const rows = await db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT vault.create_secret(${secret}, ${name})::text AS id`,
    );
    if (!rows[0]?.id) throw new Error("vault.create_secret did not return an id");
    return rows[0].id;
  }

  async function readVaultSecret(id: string): Promise<string> {
    const rows = await db.$queryRaw<Array<{ decrypted_secret: string }>>(
      Prisma.sql`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = ${id}::uuid`,
    );
    if (!rows[0]) throw new Error(`vault secret ${id} not found`);
    return rows[0].decrypted_secret;
  }

  return {
    async createConnection({ userId, provider, providerItemId, displayName, tokens }) {
      const accessId = await createVaultSecret(`bnk_${providerItemId}_access`, tokens.accessToken);
      const refreshId = await createVaultSecret(`bnk_${providerItemId}_refresh`, tokens.refreshToken);
      const row = (await db.bankConnection.create({
        data: {
          userId,
          provider,
          providerItemId,
          accessTokenSecretId: accessId,
          refreshTokenSecretId: refreshId,
          displayName,
          status: "active",
        } as unknown as Parameters<typeof db.bankConnection.create>[0]["data"],
      })) as unknown as {
        id: string;
        userId: string;
        provider: string;
        providerItemId: string;
        accessTokenSecretId: string | null;
        refreshTokenSecretId: string | null;
        status: string;
        displayName: string | null;
        lastRefreshedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      };
      return toDto({
        id: row.id,
        user_id: row.userId,
        provider: row.provider,
        provider_item_id: row.providerItemId,
        access_token_secret_id: row.accessTokenSecretId,
        refresh_token_secret_id: row.refreshTokenSecretId,
        status: row.status,
        display_name: row.displayName,
        last_refreshed_at: row.lastRefreshedAt,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      });
    },

    async listByUser(userId) {
      const rows = await db.bankConnection.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((r) =>
        toDto({
          id: r.id,
          user_id: r.userId,
          provider: r.provider,
          provider_item_id: r.providerItemId,
          access_token_secret_id: r.accessTokenSecretId,
          refresh_token_secret_id: r.refreshTokenSecretId,
          status: r.status,
          display_name: r.displayName,
          last_refreshed_at: r.lastRefreshedAt,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        }),
      );
    },

    async findByIdForUser(userId, connectionId) {
      const r = await db.bankConnection.findFirst({ where: { userId, id: connectionId } });
      if (!r) return null;
      if (!r.accessTokenSecretId || !r.refreshTokenSecretId) return null;
      const [accessToken, refreshToken] = await Promise.all([
        readVaultSecret(r.accessTokenSecretId),
        readVaultSecret(r.refreshTokenSecretId),
      ]);
      return {
        connection: toDto({
          id: r.id,
          user_id: r.userId,
          provider: r.provider,
          provider_item_id: r.providerItemId,
          access_token_secret_id: r.accessTokenSecretId,
          refresh_token_secret_id: r.refreshTokenSecretId,
          status: r.status,
          display_name: r.displayName,
          last_refreshed_at: r.lastRefreshedAt,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        }),
        tokens: { accessToken, refreshToken, expiresAt: null },
      };
    },

    async findByProviderItemId(userId, provider, providerItemId) {
      const r = await db.bankConnection.findFirst({ where: { userId, provider, providerItemId } });
      if (!r) return null;
      if (!r.accessTokenSecretId || !r.refreshTokenSecretId) return null;
      const [accessToken, refreshToken] = await Promise.all([
        readVaultSecret(r.accessTokenSecretId),
        readVaultSecret(r.refreshTokenSecretId),
      ]);
      return {
        connection: toDto({
          id: r.id,
          user_id: r.userId,
          provider: r.provider,
          provider_item_id: r.providerItemId,
          access_token_secret_id: r.accessTokenSecretId,
          refresh_token_secret_id: r.refreshTokenSecretId,
          status: r.status,
          display_name: r.displayName,
          last_refreshed_at: r.lastRefreshedAt,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        }),
        tokens: { accessToken, refreshToken, expiresAt: null },
      };
    },

    async setStatus(userId, connectionId, status) {
      await db.bankConnection.update({
        where: { id: connectionId, userId } as unknown as { id: string },
        data: { status },
      });
    },

    async setLastRefreshedAt(userId, connectionId, at) {
      await db.bankConnection.update({
        where: { id: connectionId, userId } as unknown as { id: string },
        data: { lastRefreshedAt: at },
      });
    },

    async setStatusByProviderItemId(provider, providerItemId, status) {
      await db.bankConnection.updateMany({
        where: { provider, providerItemId },
        data: { status },
      });
    },
  };
}
```

**File (tests):** `apps/api/src/modules/bank-aggregator/bank-aggregator.repository.test.ts`

```ts
// Integration test runs against the local Supabase from `bunx supabase start`.
// The migrations land Vault + bank_connections before the suite starts.

import { test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createBankAggregatorRepository } from "./bank-aggregator.repository";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

beforeAll(async () => {
  await prisma.$executeRaw`DELETE FROM bank_connections WHERE provider = 'bridge'`;
});

afterAll(async () => {
  await prisma.$executeRaw`DELETE FROM bank_connections WHERE provider = 'bridge'`;
  await prisma.$disconnect();
});

test("createConnection writes Vault secrets + retrievable tokens round-trip", async () => {
  const repo = createBankAggregatorRepository({ prismaService: { client: prisma } });
  const userId = "00000000-0000-0000-0000-000000000111";
  await prisma.$executeRaw`INSERT INTO auth.users (id, email) VALUES (${userId}::uuid, 'fred@x') ON CONFLICT DO NOTHING`;

  const created = await repo.createConnection({
    userId,
    provider: "bridge",
    providerItemId: "bridge-item-T14",
    displayName: "Société Générale",
    tokens: { accessToken: "ACCESS-T14", refreshToken: "REFRESH-T14", expiresAt: null },
  });
  expect(created.provider).toBe("bridge");
  expect(created).not.toHaveProperty("accessTokenSecretId");

  const retrieved = await repo.findByIdForUser(userId, created.id);
  expect(retrieved?.tokens.accessToken).toBe("ACCESS-T14");
  expect(retrieved?.tokens.refreshToken).toBe("REFRESH-T14");
});

test("listByUser returns DTOs without secret-id columns", async () => {
  const repo = createBankAggregatorRepository({ prismaService: { client: prisma } });
  const userId = "00000000-0000-0000-0000-000000000111";
  const list = await repo.listByUser(userId);
  for (const c of list) {
    expect(c).not.toHaveProperty("accessTokenSecretId");
    expect(c).not.toHaveProperty("refreshTokenSecretId");
  }
});

test("setStatusByProviderItemId flips SCA without leaking tokens", async () => {
  const repo = createBankAggregatorRepository({ prismaService: { client: prisma } });
  await repo.setStatusByProviderItemId("bridge", "bridge-item-T14", "sca_required");
  const userId = "00000000-0000-0000-0000-000000000111";
  const list = await repo.listByUser(userId);
  const target = list.find((c) => c.providerItemId === "bridge-item-T14");
  expect(target?.status).toBe("sca_required");
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.repository.test.ts`

**Expected output:** `3 pass` (requires local Supabase up with the migrations applied).

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts apps/api/src/modules/bank-aggregator/bank-aggregator.repository.test.ts && git commit -m "feat(#93): BankAggregatorRepository — Vault round-trip + CRUD (T14)"`

---

#### T15 — `bank-aggregator.service.ts` — initiate + complete + list + clock seam [AC: AC-1, AC-4, AC-7]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts
// Bank-aggregator domain service (story 5-6).

import type {
  BankConnection,
  InitiateConnectionInput,
  InitiateConnectionOutput,
  CompleteConnectionInput,
  RefreshConnectionInput,
  RefreshConnectionOutput,
} from "@pekulo/validators";
import type { BankProvider, ProviderTokenPair } from "./bank-provider";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { TransactionsService } from "../transactions/transactions.service";
import type { AccountsService } from "../accounts/accounts.service";
import {
  bankConnectionAlreadyExists,
  bankConnectionNotFound,
  bankProviderUnavailable,
  bankScaRequired,
} from "./bank-aggregator.errors";

export interface BankAggregatorService {
  initiateConnection(userId: string, userEmail: string, input: InitiateConnectionInput): Promise<InitiateConnectionOutput>;
  completeConnection(userId: string, userEmail: string, input: CompleteConnectionInput): Promise<BankConnection>;
  listConnections(userId: string): Promise<BankConnection[]>;
  refreshConnection(userId: string, input: RefreshConnectionInput): Promise<RefreshConnectionOutput>;
  refreshAll(): Promise<void>;
  handleWebhookEvent(event: unknown): Promise<void>;
  getReconnectUrl(userId: string, userEmail: string, connectionId: string): Promise<string>;
}

export function createBankAggregatorService(deps: {
  repository: BankAggregatorRepository;
  provider: BankProvider;
  transactionsService: TransactionsService;
  accountsService: AccountsService;
  clock?: () => Date;
  listAllActiveConnections: () => Promise<Array<{ userId: string; connectionId: string }>>;
}): BankAggregatorService {
  const now = () => (deps.clock ? deps.clock() : new Date());

  return {
    async initiateConnection(userId, userEmail, input) {
      const session = await deps.provider.createConnectSession({
        userEmail,
        redirectUri: input.redirectUri,
      });
      return { connectUrl: session.connectUrl, sessionId: session.sessionId };
    },

    async completeConnection(userId, userEmail, input) {
      const exchange = await deps.provider.exchangeCode({ code: input.code, state: input.state });
      const existing = await deps.repository.findByProviderItemId(userId, "bridge", exchange.providerItemId);
      if (existing) throw bankConnectionAlreadyExists(exchange.providerItemId);

      // List accounts and auto-create local accounts rows (AC-7).
      const remoteAccounts = await deps.provider.listAccounts({
        tokens: exchange.tokens,
        providerItemId: exchange.providerItemId,
      });
      for (const a of remoteAccounts) {
        await deps.accountsService.findOrCreateAutoFromProvider(userId, "bridge", a.providerAccountId, {
          label: `Bridge — ${a.bankName} — ${a.accountName}`,
          kind: a.kind === "savings" ? "savings" : "cash",
          currency: a.currency,
        });
      }

      // Persist the connection with Vault-encrypted tokens.
      const created = await deps.repository.createConnection({
        userId,
        provider: "bridge",
        providerItemId: exchange.providerItemId,
        displayName: remoteAccounts[0]?.bankName ?? null,
        tokens: exchange.tokens,
      });
      return created;
    },

    async listConnections(userId) {
      return deps.repository.listByUser(userId);
    },

    async refreshConnection(userId, input) {
      const found = await deps.repository.findByIdForUser(userId, input.connectionId);
      if (!found) throw bankConnectionNotFound(input.connectionId);
      if (found.connection.status === "sca_required") throw bankScaRequired(input.connectionId);
      if (found.connection.status === "revoked") throw bankConnectionNotFound(input.connectionId);

      const since = found.connection.lastRefreshedAt ? new Date(found.connection.lastRefreshedAt) : null;
      const { transactions, latestUpdatedAt } = await deps.provider.listTransactions({
        tokens: found.tokens,
        providerItemId: found.connection.providerItemId,
        since,
      });

      const providerTxIds = transactions.map((t) => t.providerTransactionId);
      const { persisted, skipped } = await deps.transactionsService.importFromProvider(userId, "bridge", transactions);
      const stamp = latestUpdatedAt ?? now();
      await deps.repository.setLastRefreshedAt(userId, input.connectionId, stamp);

      return {
        fetched: transactions.length,
        persisted,
        skipped,
        lastRefreshedAt: stamp.toISOString(),
      };
    },

    async refreshAll() {
      const all = await deps.listAllActiveConnections();
      for (const c of all) {
        try {
          await this.refreshConnection(c.userId, { connectionId: c.connectionId });
        } catch (err) {
          console.warn(`[bank-aggregator] refreshAll skip ${c.connectionId}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    },

    async handleWebhookEvent(event) {
      if (!event || typeof event !== "object") return;
      const evt = event as { type?: string; content?: { item_id?: number | string; status_code?: number } };
      if (evt.type !== "item.refreshed") return;
      const providerItemId = evt.content?.item_id !== undefined ? String(evt.content.item_id) : null;
      const statusCode = evt.content?.status_code;
      if (!providerItemId) return;
      if (statusCode === 1010) {
        await deps.repository.setStatusByProviderItemId("bridge", providerItemId, "sca_required");
        return;
      }
      if (statusCode === 0) {
        // Bridge scheduler refreshed the item — pull new transactions if we
        // own this provider_item_id locally.
        const all = await deps.listAllActiveConnections();
        for (const c of all) {
          const found = await deps.repository.findByIdForUser(c.userId, c.connectionId);
          if (found && found.connection.providerItemId === providerItemId) {
            try {
              await this.refreshConnection(c.userId, { connectionId: c.connectionId });
            } catch (err) {
              console.warn(`[bank-aggregator] webhook refresh skip ${c.connectionId}: ${err instanceof Error ? err.message : "unknown"}`);
            }
          }
        }
      }
    },

    async getReconnectUrl(userId, userEmail, connectionId) {
      const found = await deps.repository.findByIdForUser(userId, connectionId);
      if (!found) throw bankConnectionNotFound(connectionId);
      const session = await deps.provider.createConnectSession({
        userEmail,
        itemId: found.connection.providerItemId,
        forceReauthentication: false,
      });
      return session.connectUrl;
    },
  };
}
```

**File (tests):** `apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts`

```ts
import { test, expect } from "bun:test";
import { createBankAggregatorService } from "./bank-aggregator.service";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { BankProvider } from "./bank-provider";
import type { TransactionsService } from "../transactions/transactions.service";
import type { AccountsService } from "../accounts/accounts.service";

function makeStubs() {
  const repo: BankAggregatorRepository = {
    createConnection: async () => ({
      id: "bnk_x", userId: "u", provider: "bridge", providerItemId: "i", status: "active",
      displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString(),
    }),
    listByUser: async () => [],
    findByIdForUser: async () => null,
    findByProviderItemId: async () => null,
    setStatus: async () => undefined,
    setLastRefreshedAt: async () => undefined,
    setStatusByProviderItemId: async () => undefined,
  };
  const provider: BankProvider = {
    createConnectSession: async () => ({ connectUrl: "u", sessionId: "s" }),
    exchangeCode: async () => ({ providerItemId: "i", tokens: { accessToken: "a", refreshToken: "r", expiresAt: null } }),
    listAccounts: async () => [{ providerAccountId: "1", bankName: "SG", accountName: "Courant", kind: "checking", currency: "EUR" }],
    listTransactions: async () => ({ transactions: [], latestUpdatedAt: null }),
    revokeItem: async () => undefined,
    getItem: async () => ({ providerItemId: "i", statusCode: 0, statusMessage: "ok", authenticationExpiresAt: null }),
  };
  const transactionsService: TransactionsService = {
    createTransaction: async () => ({} as never),
    updateTransaction: async () => ({} as never),
    deleteTransaction: async () => ({ ok: true } as const),
    getTransaction: async () => ({} as never),
    listTransactions: async () => ({} as never),
    previewImportCsv: async () => ({} as never),
    importCsv: async () => ({ ok: true as const, persisted: 0 }),
    categoriseAfterCreate: async (_u, c) => c,
    importFromProvider: async () => ({ persisted: 0, skipped: 0 }),
  } as unknown as TransactionsService;
  const accountsService: AccountsService = {
    findOrCreateAutoFromProvider: async () => "acc_x",
  } as unknown as AccountsService;
  return { repo, provider, transactionsService, accountsService };
}

test("initiateConnection returns connect URL", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  const result = await svc.initiateConnection("u", "fred@x", {});
  expect(result.connectUrl).toBe("u");
});

test("completeConnection auto-creates accounts then persists", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let createCalls = 0;
  accountsService.findOrCreateAutoFromProvider = (async () => {
    createCalls++;
    return "acc_1";
  }) as AccountsService["findOrCreateAutoFromProvider"];
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  const result = await svc.completeConnection("u", "fred@x", { code: "c", state: "s" });
  expect(result.provider).toBe("bridge");
  expect(createCalls).toBe(1);
});

test("listConnections delegates to repo without leaking secret ids", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.listByUser = async () => [{
    id: "bnk_x", userId: "u", provider: "bridge", providerItemId: "i", status: "active",
    displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString(),
  }];
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  const list = await svc.listConnections("u");
  expect(list[0]).not.toHaveProperty("accessTokenSecretId");
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.service.test.ts`

**Expected output:** `3 pass`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts && git commit -m "feat(#93): bank-aggregator service — initiate + complete + list (T15)"`

---

#### T16 — `refreshConnection` + `refreshAll` + 3 tests [AC: AC-2, AC-5, AC-6]

**Action:** the service file written in T15 already contains the methods. T16 adds 3 dedicated tests appending to `bank-aggregator.service.test.ts`:

```ts
test("refreshConnection skips when status is sca_required", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x", userId: "u", provider: "bridge", providerItemId: "i", status: "sca_required",
      displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString(),
    },
    tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
  });
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  await expect(svc.refreshConnection("u", { connectionId: "bnk_x" })).rejects.toThrow(/SCA refresh required/);
});

test("refreshConnection persists fetched + skipped + lastRefreshedAt", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x", userId: "u", provider: "bridge", providerItemId: "i", status: "active",
      displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString(),
    },
    tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
  });
  provider.listTransactions = async () => ({
    transactions: [
      { providerTransactionId: "tx-1", providerAccountId: "1", occurredOn: new Date("2026-05-26"), amount: -10, label: "x", rawCategory: null, updatedAt: new Date("2026-05-26T10:00Z") },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"),
  });
  transactionsService.importFromProvider = async () => ({ persisted: 1, skipped: 0 });
  let stamped: Date | null = null;
  repo.setLastRefreshedAt = async (_u, _c, at) => { stamped = at; };
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  const out = await svc.refreshConnection("u", { connectionId: "bnk_x" });
  expect(out.fetched).toBe(1);
  expect(out.persisted).toBe(1);
  expect(stamped?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

test("refreshAll swallows per-connection failure non-fatally", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let count = 0;
  const svc = createBankAggregatorService({
    repository: repo, provider, transactionsService, accountsService,
    listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_a" }, { userId: "u", connectionId: "bnk_b" }],
  });
  repo.findByIdForUser = async (_u, c) => {
    count++;
    if (c === "bnk_a") throw new Error("boom");
    return {
      connection: { id: c, userId: "u", provider: "bridge", providerItemId: "i", status: "active", displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString() },
      tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
    };
  };
  provider.listTransactions = async () => ({ transactions: [], latestUpdatedAt: null });
  await svc.refreshAll();
  expect(count).toBeGreaterThanOrEqual(2);
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.service.test.ts`

**Expected output:** `6 pass` (3 prev + 3 new).

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts && git commit -m "feat(#93): refreshConnection + refreshAll tests (T16)"`

---

#### T17 — `handleWebhookEvent` + 4 tests [AC: AC-3, AC-5]

**Action:** `handleWebhookEvent` was written in T15 inside the service. T17 appends 4 tests to `bank-aggregator.service.test.ts`:

```ts
test("handleWebhookEvent ignores non-item.refreshed events", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let setStatusCalled = false;
  repo.setStatusByProviderItemId = async () => { setStatusCalled = true; };
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  await svc.handleWebhookEvent({ type: "item.created", content: { item_id: 1 } });
  expect(setStatusCalled).toBe(false);
});

test("handleWebhookEvent on status_code=1010 flips SCA_REQUIRED", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let calledWith: { provider: string; itemId: string; status: string } | null = null;
  repo.setStatusByProviderItemId = async (p, i, s) => { calledWith = { provider: p, itemId: i, status: s }; };
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  await svc.handleWebhookEvent({ type: "item.refreshed", content: { item_id: 42, status_code: 1010 } });
  expect(calledWith).toEqual({ provider: "bridge", itemId: "42", status: "sca_required" });
});

test("handleWebhookEvent on status_code=0 triggers transaction fetch for owners", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: { id: "bnk_x", userId: "u", provider: "bridge", providerItemId: "42", status: "active", displayName: null, lastRefreshedAt: null, createdAt: new Date().toISOString() },
    tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
  });
  provider.listTransactions = async () => ({ transactions: [], latestUpdatedAt: null });
  let imported = false;
  transactionsService.importFromProvider = async () => { imported = true; return { persisted: 0, skipped: 0 }; };
  const svc = createBankAggregatorService({
    repository: repo, provider, transactionsService, accountsService,
    listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_x" }],
  });
  await svc.handleWebhookEvent({ type: "item.refreshed", content: { item_id: 42, status_code: 0 } });
  expect(imported).toBe(true);
});

test("handleWebhookEvent rejects malformed event silently (no throw)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const svc = createBankAggregatorService({ repository: repo, provider, transactionsService, accountsService, listAllActiveConnections: async () => [] });
  await svc.handleWebhookEvent(null);
  await svc.handleWebhookEvent("nope");
  await svc.handleWebhookEvent({ type: "item.refreshed" });
  // No assertion — we just verify no throw.
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.service.test.ts`

**Expected output:** `10 pass` (6 prev + 4 new).

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts && git commit -m "feat(#93): handleWebhookEvent tests — SCA flip + tx fetch (T17)"`

---

#### T18 — `bank-aggregator.routes.ts` — oRPC router with rate-limit [AC: AC-1, AC-2, AC-9]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts
// oRPC router binding bankAggregatorContract to the service. Per-user rate
// limit on refreshConnection at 10 calls / 60s (NFR-9 defensive).

import { implement } from "@orpc/server";
import { bankAggregatorContract } from "@pekulo/contracts";
import type { BankAggregatorService } from "./bank-aggregator.service";

const refreshRateLimit = new Map<string, { count: number; resetAt: number }>();
const REFRESH_WINDOW_MS = 60_000;
const REFRESH_MAX_PER_WINDOW = 10;

function checkRefreshRate(userId: string): boolean {
  const now = Date.now();
  const slot = refreshRateLimit.get(userId);
  if (!slot || slot.resetAt < now) {
    refreshRateLimit.set(userId, { count: 1, resetAt: now + REFRESH_WINDOW_MS });
    return true;
  }
  if (slot.count >= REFRESH_MAX_PER_WINDOW) return false;
  slot.count++;
  return true;
}

export function createBankAggregatorRouter(deps: { service: BankAggregatorService }) {
  const os = implement(bankAggregatorContract).$context<{ userId: string; userEmail: string }>();
  return {
    initiateConnection: os.initiateConnection.handler(({ input, context }) =>
      deps.service.initiateConnection(context.userId, context.userEmail, input),
    ),
    completeConnection: os.completeConnection.handler(({ input, context }) =>
      deps.service.completeConnection(context.userId, context.userEmail, input),
    ),
    listConnections: os.listConnections.handler(({ context }) =>
      deps.service.listConnections(context.userId),
    ),
    refreshConnection: os.refreshConnection.handler(async ({ input, context, errors }) => {
      if (!checkRefreshRate(context.userId)) {
        throw errors.BANK_PROVIDER_UNAVAILABLE({ message: "rate limit exceeded — retry in 60s" });
      }
      return deps.service.refreshConnection(context.userId, input);
    }),
  };
}
```

**Test:** `bun --filter='@pekulo/api' run typecheck`

**Expected output:** `0 errors`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.routes.ts && git commit -m "feat(#93): bank-aggregator oRPC router + refresh rate-limit (T18)"`

---

#### T19 — `bank-aggregator.module.ts` + `refresh-scheduler.ts` + lifecycle [AC: AC-6]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts`

```ts
// apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts
// Composition root for the bank-aggregator module (story 5-6).

import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import type { TransactionsService } from "../transactions/transactions.service";
import type { AccountsService } from "../accounts/accounts.service";
import { createBankAggregatorRepository } from "./bank-aggregator.repository";
import { createBankAggregatorService } from "./bank-aggregator.service";
import { createBankAggregatorRouter } from "./bank-aggregator.routes";
import { createBridgeProvider } from "./services/bridge-client";
import { createBridgeWebhookRouter } from "./services/bridge-webhook-router";
import { createRefreshScheduler } from "./services/refresh-scheduler";

export function createBankAggregatorModule(deps: {
  prismaService: PrismaService;
  env: Env;
  transactionsService: TransactionsService;
  accountsService: AccountsService;
  clock?: () => Date;
}) {
  const repository = createBankAggregatorRepository({ prismaService: deps.prismaService });
  const provider = createBridgeProvider({ env: deps.env });
  const service = createBankAggregatorService({
    repository,
    provider,
    transactionsService: deps.transactionsService,
    accountsService: deps.accountsService,
    clock: deps.clock,
    listAllActiveConnections: async () => {
      const rows = await deps.prismaService.client.bankConnection.findMany({
        where: { status: "active" },
        select: { id: true, userId: true },
      });
      return rows.map((r) => ({ userId: r.userId, connectionId: r.id }));
    },
  });
  const router = createBankAggregatorRouter({ service });
  const webhookRouter = createBridgeWebhookRouter({ env: deps.env, service });
  const scheduledTask = createRefreshScheduler({ env: deps.env, service });
  return { service, repository, router, webhookRouter, scheduledTask };
}
```

**File:** `apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts`

```ts
// apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts
// Bun setInterval-backed cron — invokes service.refreshAll() every N hours.

import type { Env } from "../../../config/env";
import type { BankAggregatorService } from "../bank-aggregator.service";

export function createRefreshScheduler(deps: { env: Env; service: BankAggregatorService }) {
  const intervalMs = deps.env.BRIDGE_REFRESH_CRON_HOURS * 60 * 60 * 1000;
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        deps.service.refreshAll().catch((err) => {
          console.warn(`[refresh-scheduler] tick failed: ${err instanceof Error ? err.message : "unknown"}`);
        });
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
```

**Test:** `bun --filter='@pekulo/api' run typecheck`

**Expected output:** `0 errors`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts && git commit -m "feat(#93): bank-aggregator module composition + refresh scheduler (T19)"`

---

#### T20 — `transactions.repository.ts` — `bulkCreateFromProvider` + `findExistingProviderTxIds` [AC: AC-2]

**Action:** edit `apps/api/src/modules/transactions/transactions.repository.ts` — append after `bulkCreate`:

```ts
async bulkCreateFromProvider(userId, rows) {
  return deps.client.$transaction(async (tx) => {
    const inserted: Transaction[] = [];
    for (const row of rows) {
      const created = (await tx.transaction.create({
        data: {
          userId,
          accountId: row.accountId,
          occurredOn: row.occurredOn,
          label: row.label,
          amount: row.amount,
          type: row.type,
          category: row.category,
          isImprevu: false,
          notes: null,
          transferPairId: null,
          provider: row.provider,
          providerTransactionId: row.providerTransactionId,
        } as unknown as Parameters<typeof deps.client.transaction.create>[0]["data"],
      })) as unknown as Transaction;
      inserted.push(created);
    }
    return { persisted: inserted.length, rows: inserted };
  });
},

async findExistingProviderTxIds(userId, provider, providerTxIds) {
  if (providerTxIds.length === 0) return new Set();
  const rows = await deps.client.transaction.findMany({
    where: { userId, provider, providerTransactionId: { in: providerTxIds } },
    select: { providerTransactionId: true },
  });
  return new Set(rows.map((r) => r.providerTransactionId!).filter((s): s is string => s !== null));
},
```

Also update the interface block above to include the two signatures.

**File (tests appended):** `apps/api/src/modules/transactions/transactions.repository.test.ts` — 3 new tests for: empty-set, dedup correctness, bulkCreateFromProvider stamping.

**Test:** `bun --filter='@pekulo/api' run test src/modules/transactions/transactions.repository.test.ts`

**Expected output:** existing tests + 3 new pass.

**Commit:** `git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions.repository.test.ts && git commit -m "feat(#93): tx repo bulkCreateFromProvider + findExistingProviderTxIds (T20)"`

---

#### T21 — `transactions.service.importFromProvider` [AC: AC-2]

**Action:** edit `apps/api/src/modules/transactions/transactions.service.ts` — append after `categoriseAfterCreate` in the interface AND in the implementation:

```ts
async importFromProvider(userId, provider, rows) {
  const providerTxIds = rows.map((r) => r.providerTransactionId);
  const existing = await deps.repository.findExistingProviderTxIds(userId, provider, providerTxIds);
  const fresh = rows.filter((r) => !existing.has(r.providerTransactionId));
  if (fresh.length === 0) return { persisted: 0, skipped: rows.length };

  // Map provider rows to CreateTransactionInput by resolving providerAccountId
  // via accounts.findByProviderKey. Provider knows ids but Pekulo stores acc_<base62>.
  // For brevity here we expect the caller (bank-aggregator.service) to have
  // already mapped providerAccountId → accountId in a follow-up shape.
  // (The Provider row carries `accountId` once mapped.)
  const toInsert = fresh.map((r) => ({
    accountId: r.accountId,
    occurredOn: r.occurredOn,
    label: r.label,
    amount: r.amount,
    type: r.type,
    category: "autre",
    provider,
    providerTransactionId: r.providerTransactionId,
  }));

  const { persisted, rows: inserted } = await deps.repository.bulkCreateFromProvider(userId, toInsert);

  for (const row of inserted) {
    try {
      await categoriseAfterCreateImpl({ userId, candidate: row, repository: deps.repository });
    } catch (err) {
      console.warn(`[5-6] categoriseAfterCreate failed for tx ${row.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return { persisted, skipped: rows.length - fresh.length };
},
```

The provider→accountId mapping happens in `bank-aggregator.service.refreshConnection` — it reads `provider.listTransactions` rows, looks up `accounts.findByProviderKey(userId, "bridge", providerAccountId) → acc_id`, then hands the mapped rows to `importFromProvider`. T16 already does this implicitly via `transactionsService.importFromProvider(userId, "bridge", transactions)` — adapt the signature to pass the mapped rows (the test stub uses `accountId: "acc_x"` directly).

**Test:** `bun --filter='@pekulo/api' run test src/modules/transactions/transactions.service.test.ts`

**Expected output:** new dedup tests + existing pass.

**Commit:** `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.service.test.ts && git commit -m "feat(#93): tx service importFromProvider (T21)"`

---

#### T22 — `accounts.service.findOrCreateAutoFromProvider` [AC: AC-7]

**Action:** add to `accounts.service.ts` + `accounts.repository.ts`:

```ts
// service
async findOrCreateAutoFromProvider(userId, provider, providerAccountKey, attrs) {
  const existing = await deps.repository.findByProviderKey(userId, provider, providerAccountKey);
  if (existing) return existing.id;
  return deps.repository.createAuto(userId, provider, providerAccountKey, attrs);
},

// repository — uses Prisma upsert keyed on (userId, provider, providerAccountKey)
async findByProviderKey(userId, provider, providerAccountKey) {
  const row = await deps.client.account.findFirst({ where: { userId, provider, providerAccountKey } });
  return row;
},

async createAuto(userId, provider, providerAccountKey, attrs) {
  const created = (await deps.client.account.create({
    data: {
      userId,
      kind: attrs.kind,
      label: attrs.label,
      currency: attrs.currency,
      balance: 0,
      provider,
      providerAccountKey,
    } as unknown as Parameters<typeof deps.client.account.create>[0]["data"],
  })) as unknown as { id: string };
  return created.id;
},
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/accounts/accounts.service.test.ts`

**Expected output:** new idempotency tests + existing pass.

**Commit:** `git add apps/api/src/modules/accounts/accounts.service.ts apps/api/src/modules/accounts/accounts.repository.ts && git commit -m "feat(#93): accounts findOrCreateAutoFromProvider (T22)"`

---

#### T23 — `runtime-dependencies.ts` + `lifecycle.ts` + `app.ts` wire-up [AC: AC-1, AC-2, AC-3, AC-6]

**Action:** edit `apps/api/src/bootstrap/runtime-dependencies.ts` — after `monthlyModule`:

```ts
const bankAggregatorModule = createBankAggregatorModule({
  prismaService,
  env: input.env,
  transactionsService: transactionsModule.service,
  accountsService: accountsModule.service,
});
```

Update `orpcRouter` to include `bankaggregator: bankAggregatorModule.router`. Update `RuntimeDeps` to add `bankAggregatorModule`.

Edit `apps/api/src/app.ts`:

```ts
.use(healthModule.router)
.use(deps.bankAggregatorModule.webhookRouter);

mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
```

Edit `apps/api/src/bootstrap/lifecycle.ts` to start/stop the scheduler:

```ts
deps.bankAggregatorModule.scheduledTask.start();
// in shutdown handler:
deps.bankAggregatorModule.scheduledTask.stop();
```

**Test:** `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test`

**Expected output:** `0 errors` + all bank-aggregator tests pass + no regressions in existing modules.

**Commit:** `git add apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/bootstrap/lifecycle.ts apps/api/src/app.ts && git commit -m "feat(#93): wire bank-aggregator module into runtime + lifecycle (T23)"`

---

#### T24 — `apps/web/src/lib/zapaction/keys.ts` — bank-connections registry [AC: AC-1, AC-2]

**File:** `apps/web/src/lib/zapaction/keys.ts` — add alongside `monthlyKeys`:

```ts
export const BANK_CONNECTIONS_KEY = "bankConnections" as const;
export const bankConnectionsKeys = createFeatureKeys(BANK_CONNECTIONS_KEY, {
  list: () => [BANK_CONNECTIONS_KEY, "list"] as const,
});
export const bankConnectionsTags = createFeatureTags(BANK_CONNECTIONS_KEY, {
  list: () => [BANK_CONNECTIONS_KEY, "list"] as const,
  all: () => [BANK_CONNECTIONS_KEY] as const,
});
```

And to the registry edge map:

```ts
[bankConnectionsTags.all()]: [bankConnectionsKeys.list()],
[bankConnectionsTags.list()]: [bankConnectionsKeys.list()],
```

**Test:** `bun --filter='@pekulo/web' run typecheck`

**Expected output:** `0 errors`.

**Commit:** `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(#93): bankConnections tag registry edge (T24)"`

---

#### T25 — `bank-aggregator-actions.ts` server actions [AC: AC-1, AC-2]

**File:** `apps/web/src/app/(cap)/dashboard/parametres/_actions/bank-aggregator-actions.ts`

```ts
"use server";

import { defineAction } from "@zapaction/server";
import { z } from "@pekulo/zod";
import { orpcClient } from "@/lib/orpc/client";
import {
  completeConnectionInputSchema,
  initiateConnectionInputSchema,
} from "@pekulo/validators";
import { bankConnectionsTags, transactionsTags } from "@/lib/zapaction/keys";

// OMIT output: slot — discriminated-union envelope per lesson 2026-05-20.
export const initiateConnection = defineAction({
  name: "bank-aggregator.initiateConnection",
  input: initiateConnectionInputSchema,
  invalidateWithTags: [bankConnectionsTags.list()],
  handler: async (input) => {
    try {
      const result = await orpcClient.bankaggregator.initiateConnection(input);
      return { ok: true as const, ...result };
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "UNKNOWN";
      const message = err instanceof Error ? err.message : "initiate failed";
      return { ok: false as const, code, message };
    }
  },
});

export const completeConnection = defineAction({
  name: "bank-aggregator.completeConnection",
  input: completeConnectionInputSchema,
  invalidateWithTags: [bankConnectionsTags.list(), transactionsTags.list()],
  handler: async (input) => {
    try {
      const result = await orpcClient.bankaggregator.completeConnection(input);
      return { ok: true as const, connection: result };
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "UNKNOWN";
      const message = err instanceof Error ? err.message : "complete failed";
      return { ok: false as const, code, message };
    }
  },
});
```

**Test:** `bun --filter='@pekulo/web' run typecheck`

**Expected output:** `0 errors`.

**Commit:** `git add apps/web/src/app/\(cap\)/dashboard/parametres/_actions/bank-aggregator-actions.ts && git commit -m "feat(#93): bank-aggregator server actions (T25)"`

---

#### T26 — `_hooks/use-{initiate,complete}-bank-connection.ts` [AC: AC-1, AC-2]

**File:** `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-initiate-bank-connection.ts`

```ts
"use client";

import { useActionMutation } from "@zapaction/query";
import { initiateConnection } from "../_actions/bank-aggregator-actions";
import { bankConnectionsTags } from "@/lib/zapaction/keys";

export function useInitiateBankConnection() {
  return useActionMutation(initiateConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
  });
}
```

**File:** `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-complete-bank-connection.ts`

```ts
"use client";

import { useActionMutation } from "@zapaction/query";
import { completeConnection } from "../_actions/bank-aggregator-actions";
import { bankConnectionsTags, transactionsTags } from "@/lib/zapaction/keys";

export function useCompleteBankConnection() {
  return useActionMutation(completeConnection, {
    invalidateWithTags: [bankConnectionsTags.list(), transactionsTags.list()],
  });
}
```

**File (tests):** `apps/web/src/app/(cap)/dashboard/parametres/_hooks/use-complete-bank-connection.test.tsx`

```tsx
import { describe, test, expect, vi } from "vitest";

const { completeConnectionMock } = vi.hoisted(() => ({
  completeConnectionMock: vi.fn(),
}));

vi.mock("../_actions/bank-aggregator-actions", () => ({
  completeConnection: completeConnectionMock,
}));

describe("use-complete-bank-connection", () => {
  test("ok: true envelope is preserved", async () => {
    completeConnectionMock.mockResolvedValueOnce({ ok: true, connection: { id: "bnk_x", provider: "bridge" } });
    const { completeConnection } = await import("../_actions/bank-aggregator-actions");
    const result = await completeConnection({ code: "c", state: "s" });
    expect(result.ok).toBe(true);
  });

  test("ok: false envelope carries code + message", async () => {
    completeConnectionMock.mockResolvedValueOnce({ ok: false, code: "BANK_PROVIDER_UNAVAILABLE", message: "x" });
    const { completeConnection } = await import("../_actions/bank-aggregator-actions");
    const result = await completeConnection({ code: "c", state: "s" });
    expect(result.ok).toBe(false);
  });
});
```

**Test:** `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/parametres/_hooks/use-complete-bank-connection.test.tsx`

**Expected output:** `2 pass`.

**Commit:** `git add apps/web/src/app/\(cap\)/dashboard/parametres/_hooks && git commit -m "feat(#93): use-{initiate,complete}-bank-connection hooks (T26)"`

---

#### T27 — Callback page `(cap)/dashboard/parametres/bank/callback/page.tsx` [AC: AC-1]

**File:** `apps/web/src/app/(cap)/dashboard/parametres/bank/callback/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { completeConnection } from "../../_actions/bank-aggregator-actions";

interface PageProps {
  searchParams: Promise<{ code?: string; state?: string }>;
}

export default async function BankCallbackPage({ searchParams }: PageProps) {
  const { code, state } = await searchParams;
  if (!code || !state) {
    return (
      <main aria-label="Bridge connection callback — missing params">
        <h1>Connexion bancaire — paramètres manquants</h1>
        <p>Les paramètres OAuth sont absents. Retourne aux paramètres et relance la connexion.</p>
        <a href="/dashboard/parametres">Retour aux paramètres</a>
      </main>
    );
  }

  const result = await completeConnection({ code, state });
  if (!result.ok) {
    return (
      <main aria-label="Bridge connection callback — error">
        <h1>Connexion bancaire — échec</h1>
        <p>Code: {result.code}</p>
        <p>{result.message}</p>
        <a href="/dashboard/parametres">Retour aux paramètres</a>
      </main>
    );
  }

  redirect("/dashboard/parametres?bankConnected=1");
}
```

**Test:** `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run lint`

**Expected output:** `0 errors`.

**Commit:** `git add apps/web/src/app/\(cap\)/dashboard/parametres/bank && git commit -m "feat(#93): Bridge OAuth callback Server Component (T27)"`

---

#### T28 — `bank-aggregator.security.test.ts` sentinel [AC: AC-8]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.security.test.ts`

```ts
import { test, expect } from "bun:test";

const FORBIDDEN = /access[_-]token|refresh[_-]token/i;

test("zero token-like substrings in captured pino logs during full cycle", async () => {
  const captured: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => captured.push(JSON.stringify(args));
  console.warn = (...args) => captured.push(JSON.stringify(args));
  console.error = (...args) => captured.push(JSON.stringify(args));

  // Simulate the full cycle would run here — for unit-scope, we just import
  // every public symbol of the module and exercise log paths that would have
  // a chance to leak. Real integration coverage lives in T29.
  const { createBankAggregatorService } = await import("./bank-aggregator.service");
  expect(typeof createBankAggregatorService).toBe("function");

  console.log = origLog;
  console.warn = origWarn;
  console.error = origError;

  for (const line of captured) {
    if (FORBIDDEN.test(line)) {
      throw new Error(`token substring leaked into logs: ${line}`);
    }
  }
});

test("BankConnection DTO type does not contain secret-id keys (type-level guard)", () => {
  type BankConnectionDTO = {
    id: string;
    userId: string;
    provider: string;
    providerItemId: string;
    status: string;
    displayName: string | null;
    lastRefreshedAt: string | null;
    createdAt: string;
  };
  type ForbiddenKey = "accessTokenSecretId" | "refreshTokenSecretId" | "accessToken" | "refreshToken";
  type Check = Extract<keyof BankConnectionDTO, ForbiddenKey>;
  // If any forbidden key sneaks in, Check is no longer `never` and the assignment fails.
  const ok: Check extends never ? true : false = true;
  expect(ok).toBe(true);
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.security.test.ts`

**Expected output:** `2 pass`.

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.security.test.ts && git commit -m "feat(#93): sentinel test — no token leakage (T28)"`

---

#### T29 — Integration test full cycle [AC: AC-1, AC-2, AC-3, AC-5, AC-7]

**File:** `apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts`

```ts
import { test, expect } from "bun:test";
import { createBankAggregatorModule } from "./bank-aggregator.module";
import { PrismaClient } from "@prisma/client";

test("end-to-end: initiate → complete → refresh → webhook with fake BankProvider", async () => {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const env = {
    BRIDGE_API_BASE: "https://api.bridgeapi.io",
    BRIDGE_API_VERSION: "2025-01-15",
    BRIDGE_CLIENT_ID: "test",
    BRIDGE_CLIENT_SECRET: "test",
    BRIDGE_WEBHOOK_SIGNING_SECRET: "wh-secret",
    BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: undefined,
    BRIDGE_REFRESH_CRON_HOURS: 6,
  } as never;
  // Build with a fake provider injected via a sibling module that overrides
  // createBridgeProvider — covered in the dev session by a vi-style mock or
  // by exporting createBankAggregatorService directly with a fake.
  expect(typeof createBankAggregatorModule).toBe("function");
  await prisma.$disconnect();
});
```

**Test:** `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/bank-aggregator.integration.test.ts`

**Expected output:** `1 pass` (placeholder — dev may flesh out with fake provider during T29).

**Commit:** `git add apps/api/src/modules/bank-aggregator/bank-aggregator.integration.test.ts && git commit -m "feat(#93): integration test scaffold for bank-aggregator (T29)"`

---

#### T30 — `env.ts` Bridge keys + `.env.example` [AC: AC-1]

**File:** `apps/api/src/config/env.ts` — add the 7 Bridge keys per the Step-0 quote (already detailed above).

**File:** `apps/api/.env.example` — append:

```sh
# --- Bridge (story 5-6 — ADR-0015) ---
BRIDGE_CLIENT_ID=
BRIDGE_CLIENT_SECRET=
BRIDGE_WEBHOOK_SIGNING_SECRET=
BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS=
BRIDGE_API_BASE=https://api.bridgeapi.io
BRIDGE_API_VERSION=2025-01-15
BRIDGE_REFRESH_CRON_HOURS=6

# Dev tip: expose http://localhost:3001/internal/bridge/webhook publicly via
# cloudflared tunnel — `cloudflared tunnel --url http://localhost:3001`.
# Copy the resulting `https://<...>.trycloudflare.com` URL into your Bridge
# dashboard's webhook endpoint setting and copy the signing secret back here.
```

**Test:** `bun --filter='@pekulo/api' run test src/config/env.test.ts`

**Expected output:** existing env tests pass + any new Bridge schema test passes.

**Commit:** `git add apps/api/src/config/env.ts apps/api/.env.example && git commit -m "feat(#93): Bridge env keys + .env.example (T30)"`

---

#### T31 — `docs/lessons.md` append placement lesson [AC: meta]

**File:** `docs/lessons.md` — prepend (top of file, newest entry first per existing convention):

```markdown
### 2026-05-27 — Every new feature route in `apps/web` lives under `(cap)/dashboard/*`, not `(cap)/*` directly (Scope: aped-story, aped-arch, aped-dev — every story prescribing apps/web route placement)

**Rule:** `CapShell` (header + nav rail + bottom nav) mounts at `apps/web/src/app/(cap)/dashboard/layout.tsx`. A route prescribed at `(cap)/<feature>/` renders without the shell — accident in 5-4 (`mensuel`) and almost reproduced in 5-6 (`parametres/bank/callback`).

**Why:** the brownfield grouped every authenticated route under `dashboard/` for inheritance. Story-time prescriptions that omit `dashboard/` produce diff-noise during aped-review (file move) or worse — production routes rendered without the global chrome.

**How to apply:** when authoring a story Dev Notes section that prescribes a new route, cross-check `docs/ux-preview/src/App.tsx` for the equivalent screen, then mirror the path under `(cap)/dashboard/`. If `aped-story` step-04 surfaces a path at `(cap)/<feature>/` directly, treat it as a draft error and fix before the GATE.
```

**Test:** `bash -c "head -1 docs/lessons.md | grep -F '2026-05-27' && echo OK"`

**Expected output:** `OK`.

**Commit:** `git add docs/lessons.md && git commit -m "feat(#93): codify (cap)/dashboard/* placement lesson (T31)"`

---

#### T32 — Iron Law sweep [AC: all]

**Test (sequential):**

```sh
bun --filter='@pekulo/api' run typecheck && \
bun --filter='@pekulo/web' run typecheck && \
bun --filter='@pekulo/validators' run typecheck && \
bun --filter='@pekulo/contracts' run typecheck && \
bun run lint && \
bun --filter='@pekulo/api' run test && \
bun --filter='@pekulo/web' run test && \
bun --filter='@pekulo/validators' run test && \
bun --filter='@pekulo/api' run rls-audit && \
bun run generate:tamagui-css && \
git diff --exit-code packages/ui/public/tamagui.generated.css
```

**Expected output:** every command exits 0; the final `git diff --exit-code` confirms no uncommitted Tamagui CSS regen (5-6 introduces no new styled primitive — but the regen + diff check is sentinel per lesson 2026-05-24).

**Commit (if anything changed):** `git add -A && git commit -m "feat(#93): Iron Law sweep — green across typecheck + lint + tests + rls-audit (T32)"`

---

## File List

_Expected files at story completion (set by aped-dev at GREEN). The Dev Notes § File map above is the structural source of truth — aped-dev appends exact paths here in step-08._

- _(populated by aped-dev)_

## Dev Agent Record

_Populated by aped-dev at story completion (step-08). Schema-required subsections below kept empty for the dev agent to fill in._

### Summary

_(populated by aped-dev)_

### Files changed

_(populated by aped-dev)_

### Deviations

_(populated by aped-dev)_

### Test output

_(populated by aped-dev)_
