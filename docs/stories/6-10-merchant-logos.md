# Story: 6-10-merchant-logos — Transaction logos (merchant → bank → category)

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** ready-for-dev
**Ticket:** none (assigned at ship time)
**Branch:** feature/none-6-10-merchant-logos
**Covered FR:** FR-65
**Complexity:** L (multi-session — granularity-cap [O]verride accepted by Alex 2026-06-01: one PR, 3-tier in a single shipment)

## User Story

**As a** Pekulo user, **I want** a relevant logo on every transaction — the merchant's logo when recognised, otherwise my bank's logo, otherwise the category icon — **so that** I recognise my spending at a glance, without any merchant data leaking from my browser.

**Scope premise correction (READ FIRST — supersedes the epics.md summary).**

The epics.md/PRD wording ("capture the provider-supplied merchant logo (Bridge `logo_url`)") is **factually wrong** against the canonical Bridge reference `docs/ressources/Bridge API.postman_collection.json`. Verified at story time (lessons 2026-05-27 / 2026-05-28 — the Postman collection is the source of truth, not the prose):

- The `GET /v3/aggregation/transactions` response carries **NO** logo/merchant/brand field. Real shape:
  ```json
  { "id": 33000191035700, "clean_description": "CB Mad Cours Marjane M.m G",
    "provider_description": "PAIEMENT PAR CARTE ...", "amount": -6.92, "date": "2024-11-09",
    "category_id": 249, "operation_type": "card", "account_id": 48178050 }
  ```
- The **only** logo Bridge exposes is the **bank/institution** logo: `Providers / Get a single provider` → `images.logo` (e.g. `https://web.bridgeapi.io/img/banks-logo/fr/creditagricole-dsp2.png`), keyed by `provider_id`. `provider_id` is present on items AND accounts, and is already encoded in our `account.providerAccountKey = pid:{provider_id}:{name}`.

So FR-65 is delivered as a **3-tier fallback** (Alex's call, 2026-06-01):

| Tier | Source | Resolution site |
|------|--------|-----------------|
| 1. **Merchant** logo | Brandfetch (Brand Search → logo), **server-side**, cached | new `logos` module |
| 2. **Bank** logo | Bridge `GET /v3/aggregation/providers/{id}` → `images.logo`, via `provider_id` | `BankProvider.getProviderLogo` |
| 3. **Category** icon | existing `@pekulo/ui#CategoryIcon` (story 6-8) | UI — final + `<img onError>` fallback |

**Privacy model (Alex's call):** the transaction DTO carries an **opaque Pekulo proxy URL** (`/v1/logos?ref=<token>`). The browser only ever talks to `apps/api`, which streams the bytes from its cache (fetched server-side once). The `ref` is an **opaque key into the cache, never a client-supplied URL** (anti-SSRF). Logos are resolved **only for provider-sourced transactions** (`provider != null`); manually-created transactions always fall to the category icon (honours "no logo for manual transactions").

## Acceptance Criteria

- **AC-1** — **Given** a Bridge-sourced transaction whose merchant is recognised, **When** the row renders, **Then** the **merchant logo** is shown (tier 1).
- **AC-2** — **Given** a Bridge-sourced transaction whose merchant is NOT recognised but whose bank IS, **When** the row renders, **Then** the **bank logo** is shown (tier 2).
- **AC-3** — **Given** no resolvable logo source (or a manually-created transaction, `provider == null`), **When** the row renders, **Then** the **category icon** (6-8) is shown (tier 3).
- **AC-4** — **Given** a transaction that has a resolved logo, **When** it is sent for LLM categorisation, **Then** the prompt contains only the transaction's label, amount, currency, occurred-on date and optional merchant name — the logo is never included (NFR-12).
- **AC-5** — **Given** the logo proxy endpoint, **When** the request reference is unknown or forged (e.g. a URL), **Then** the endpoint responds `404` and never fetches a caller-supplied address (anti-SSRF). A merchant that fails to resolve is remembered as "no logo" and not looked up again before its refresh window elapses.
- **AC-6** — **Given** the merchant and bank logo caches, **When** the schema, RLS and lint gates run, **Then** they pass: the caches hold no user identifier (they are public reference data, not user-scoped) and the build stays green.

## Tasks

> Test-command conventions (lessons 2026-05-19 / 2026-05-07): API tests use `bun --filter='@pekulo/api' run test <file>` (`bun:test`); UI tests `bun --filter='@pekulo/ui' run test <file>`; web tests `bun --filter='@pekulo/web' run test <file>` (vitest). NEVER `bun --filter=api` / `bun --cwd <rel>`. `tsc` is a MANDATORY manual gate before every commit (lesson 2026-06-01): after any Prisma edit run `prisma:generate` THEN `typecheck` THEN commit, inseparably.

**P0 — Schema & types**

- [x] **T1** — Create the cache schema + hand-written migration [AC: AC-6]
- [x] **T2** — Add `logoUrl` to the transaction DTO + UI display types [AC: AC-1, AC-2, AC-3]

**P1 — Server-side resolution**

- [x] **T3** — `merchant-key.ts` (pure normaliser) + tests [AC: AC-1, AC-5]
- [x] **T4** — `services/brandfetch-client.ts` (outbound HTTP) + tests [AC: AC-1, AC-5]
- [x] **T5** — `logos.errors.ts` — **DROPPED (YAGNI, see Dev Agent Record)** [AC: AC-1]
- [x] **T6** — `logos.repository.ts` (cache I/O over unscoped models) [AC: AC-5, AC-6]
- [x] **T7** — `logos.service.ts` (resolve + negative cache + provider-gate + enrich) + tests [AC: AC-1, AC-2, AC-3, AC-5]

**P2 — Bank logo**

- [x] **T8** — `BankProvider.getProviderLogo` interface + bridge-client impl + live smoke + test [AC: AC-2]

**P3 — Proxy route & wiring**

- [x] **T9** — `logos.routes.ts` streaming proxy (`/v1/logos?ref=`) + SSRF/404 tests [AC: AC-5]
- [x] **T10** — `logos.module.ts` factory [AC: AC-1]
- [x] **T11** — `env.ts` Brandfetch config [AC: AC-1]
- [x] **T12** — wire `createLogosModule` in `runtime-dependencies.ts` + mount route in `app.ts` [AC: AC-1, AC-5]
- [x] **T13** — add the cache models to `.oxlintrc.json` `unscopedModels` [AC: AC-6]

**P4 — Ingestion warm-up & read enrichment**

- [x] **T14** — warm caches after `importFromProvider` in `bank-aggregator.service.ts` [AC: AC-1, AC-2]
- [x] **T15** — enrich list reads with `logoUrl` in `transactions.service.ts` + repository relation select [AC: AC-1, AC-2, AC-3]
- [x] **T16** — NFR-12 regression test: `logoUrl` never enters the prompt envelope [AC: AC-4]

**P5 — UI**

- [x] **T17** — `@pekulo/ui#TransactionLogo` primitive + tests + regenerate `tamagui.generated.css` [AC: AC-1, AC-2, AC-3]
- [x] **T18** — `logo?` slot on `PekuloSuggestionRow` + `PekuloActivityRow` + barrel export [AC: AC-1, AC-2, AC-3]
- [x] **T19** — wire `<TransactionLogo>` into the web suggestions + recent sections [AC: AC-1, AC-2, AC-3]
- [x] **T20** — axe pass on the new primitive [AC: AC-3]

**P6 — Gates & record**

- [x] **T21** — full gate sweep (`prisma:check`, `db:rls-audit`, `oxlint`, `typecheck` api+ui+web) + visual verification + Dev Agent Record [AC: AC-1..AC-6]

---

## Dev Notes

### Architecture

- **Module shape (real repo, not the idealised tree)** — mirror `bank-aggregator/`: `<name>.module.ts` factory returning an **inferred** chain (NEVER annotate `: Elysia` — lesson 2026-05-04), `services/` for external clients, `<name>.errors.ts` extending `PekuloError`, `<name>.repository.ts` with Prisma. Layer order (ADR-0010): route → service → repository → Prisma. Folder-by-domain (ADR-0011).
- **Reference (non-user) tables** — `merchant_logo_cache` + `provider_logo_cache` are global brand/bank reference data, NOT user data. They carry **no `user_id`**, no FK to `auth.users`, **no user-RLS** (NFR-8 binds user-data tables only). The `apps/api` service-role connection bypasses RLS anyway (ADR-0013); the protective layer for these tables is simply that they hold no PII. The `no-prisma-query-without-user-id` lint rule (story 0-12) is satisfied by adding both model names to `unscopedModels` in `.oxlintrc.json` (it already lists `fxRate`, `country`).
- **Negative caching** — a `logoUrl` of `NULL` with a fresh `fetched_at` means "resolved, none found" — do NOT re-hit Brandfetch/Bridge for it before TTL. Distinguish from "never attempted" (no row). This bounds Brandfetch cost and protects AC-5.
- **Anti-SSRF (AC-5)** — the proxy `ref` is an opaque base64url token encoding a cache selector (`m:<merchantKey>` or `b:<providerId>`), NEVER a URL. The route decodes `ref`, looks the row up in the cache, and streams the **server-resolved** upstream URL. A `ref` that does not resolve → `404`. The route must never `fetch()` a URL taken from the request.
- **NFR-12 (AC-4)** — `buildPromptEnvelope` (`apps/api/src/modules/llm/llm-prompt-builder.ts`) is already airtight: it does an explicit allowlist pick `{label, amount, currency, occurredOn, merchant?}` then `llmPromptEnvelopeSchema.parse(...)` with `.strict()`. Adding `logoUrl` to the transaction DTO cannot leak into a prompt. The AC is a **regression guard**, not new enforcement code.
- **Off the hot path (NFR-1)** — logo resolution runs inside the existing background refresh (cron/webhook) path, never on `createTransaction`. The read path only does cache LOOKUPS (no external I/O).
- **TR fidelity (lesson 2026-05-07)** — the logo avatar chrome stays grayscale; `$accent` emerald is reserved for ± monetary deltas only. The category-icon fallback is `aria-hidden` (the row already announces the label).
- **Tamagui CSS artifact (lesson 2026-05-24)** — `TransactionLogo` is a new primitive; regenerate `packages/ui/public/tamagui.generated.css` (`bun run generate:tamagui-css`) or its styles silently won't paint despite green typecheck/lint.
- **Bridge premise (lessons 2026-05-27/28)** — `getProviderLogo` must be validated against `docs/ressources/Bridge API.postman_collection.json` (`Providers / Get a single provider`) AND a live smoke curl (paste output in the PR). `Providers` is **app-level auth** (Client-Id/Secret headers only) — NO user Bearer.

### Existing code at write time (Step-0 verbatim quotes)

**`apps/api/src/modules/bank-aggregator/bank-provider.ts:33-46`** (`ProviderTransaction` — the import row source; `label` = `clean_description`):
```ts
export interface ProviderTransaction {
  providerTransactionId: string;
  /** Volatile per-item Bridge account id (raw `account_id` on the txn). */
  providerAccountId: string;
  /** STABLE account key (matches ProviderBankAccount.accountKey) ... */
  accountKey: string;
  occurredOn: Date;
  amount: number; // signed: positive for inflow, negative for outflow
  label: string;
  rawCategory: string | null;
  updatedAt: Date;
}
```
This story ADDS `getProviderLogo(providerId)` to the `BankProvider` interface (T8). The `ProviderTransaction` shape is unchanged.

**`apps/api/src/modules/bank-aggregator/services/bridge-client.ts:47-84`** (factory + `req`/`reqJson` — the pattern T8's `getProviderLogo` follows; `Providers` needs no Bearer):
```ts
export function createBridgeProvider(args: { env: Env }): BankProvider {
  const { env } = args;
  const base = env.BRIDGE_API_BASE.replace(/\/$/, "");

  async function req<T>(
    path: string,
    init: RequestInit & { bearer?: string; allowStatuses?: number[]; timeoutMs?: number },
  ): Promise<{ data: T; status: number }> { /* ...timeout + typed-error envelope... */ }

  async function reqJson<T>(path: string, init: RequestInit & { bearer?: string }): Promise<T> {
    return (await req<T>(path, init)).data;
  }
  // ... mintUserAccessToken / fetchItemAccounts / bridgeAccountKey ...
```
T8 adds `getProviderLogo` to the returned object — a `reqJson` GET on `/v3/aggregation/providers/{id}` with `allowStatuses: [404]` (no Bearer).

**`apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts:171-219`** (`refreshConnectionImpl` tail — the warm-up site, T14 inserts AFTER `importFromProvider`):
```ts
    const accountIdMap = await resolveAccountIds(userId, transactions);
    const rows: ProviderTransactionImportRow[] = transactions
      .map((t) => { /* ...accountId, occurredOn, label, amount, type, category:"autre", providerTransactionId... */ })
      .filter((r): r is ProviderTransactionImportRow => r !== null);

    const { persisted, skipped } = await deps.transactionsService.importFromProvider(
      userId, "bridge", rows,
    );
    // ↑ T14 inserts the best-effort logo warm-up call HERE (after importFromProvider, before the lastRefreshedAt stamp). Errors swallowed.
    let stampIso: string | null = found.connection.lastRefreshedAt;
    if (latestUpdatedAt) { /* setLastRefreshedAt ... */ }
    // ...
    return { fetched: transactions.length, persisted, skipped, lastRefreshedAt: stampIso };
```

**`apps/api/src/modules/transactions/transactions.repository.ts:166-184`** (`toDto` — T2 adds `logoUrl: null` here; T15 fills it in the service after enrich):
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
    suggestedCategory: (row.suggestedCategory as Transaction["suggestedCategory"]) ?? null,
    suggestedConfidence: row.suggestedConfidence ?? null,
    suggestedRoute: row.suggestedRoute ?? null,
    suggestedAt: row.suggestedAt ? row.suggestedAt.toISOString() : null,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}
```

**`apps/api/src/modules/transactions/transactions.service.ts:304-310`** (factory deps — T15 adds the optional `logos?` port):
```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
  llmAudit?: LlmOverrideAuditPort;
}): TransactionsService {
```

**`packages/validators/src/transactions/transactions.schemas.ts:87-109`** (`transactionSchema` — T2 adds `logoUrl`):
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
  suggestedCategory: transactionCategorySchema.nullable().optional(),
  suggestedConfidence: z.number().min(0).max(1).nullable().optional(),
  suggestedRoute: z.string().nullable().optional(),
  suggestedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;
```

**`packages/types/src/transaction/transaction.types.ts:34-60`** (`Activity` + `Suggestion` UI shapes — T2 adds `logoUrl?`):
```ts
export interface Activity {
  label: string;
  account: string;
  category: string;
  direction: TxDirection;
  amountEur: number;
}
export interface Suggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: TxDirection;
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: LlmRouteBadge;
}
```

**`packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx:58-67`** (current props — T18 adds `logo?: ReactNode`):
```ts
export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  categoryIcon?: ReactNode;
}
```

**`packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx:14-23`** (current props — T18 adds `logo?: ReactNode`):
```ts
export interface PekuloActivityRowProps {
  tx: Activity;
  categoryPrefix?: ReactNode;
}
export function PekuloActivityRow({ tx, categoryPrefix }: PekuloActivityRowProps) {
```

**`.oxlintrc.json:69`** (rule config — T13 adds the two models to its `unscopedModels`):
```jsonc
        "pekulo/no-prisma-query-without-user-id": [
          // ... currently: { "prismaIdentifier": [...], "unscopedModels": ["fxRate", "country"] }
        ]
```

**`apps/api/src/config/env.ts:59-68`** (Bridge env block — T11 appends `BRANDFETCH_*` in the same style):
```ts
  BRIDGE_CLIENT_ID: z.string().min(1, "BRIDGE_CLIENT_ID is required (Bridge developer Client-Id)"),
  BRIDGE_CLIENT_SECRET: z.string().min(1, "BRIDGE_CLIENT_SECRET is required (Dokploy env only)"),
  // ...
  BRIDGE_API_BASE: z.string().url().default("https://api.bridgeapi.io"),
  BRIDGE_API_VERSION: z.string().min(1).default("2025-01-15"),
```

**`@pekulo/ui#CategoryIcon` (`packages/ui/src/components/CategoryIcon/CategoryIcon.tsx`)** — the tier-3 fallback (unchanged). Keyed by RAW category string, `<Tag>` for unknown keys, always `aria-hidden`. `TransactionLogo` (T17) composes it.

**Migration format reference** — `apps/api/prisma/migrations/20260530120000_create_llm_call_log_and_opt_in/migration.sql`: hand-written, idempotent `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$;` for enums/FKs/constraints, `CREATE TABLE IF NOT EXISTS`, applied via `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Cache tables OMIT the FK + RLS blocks (reference data).

**`apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts:20-52`** (factory — the Bridge `provider` is currently created INSIDE this module at L28; T12 makes it an INJECTABLE dep so logos + bank-aggregator share one provider, and adds an optional `logos`):
```ts
export function createBankAggregatorModule(deps: {
  prismaService: PrismaService;
  env: Env;
  transactionsService: TransactionsService;
  accountsService: AccountService;
  clock?: () => Date;
}) {
  const repository = createBankAggregatorRepository({ prismaService: deps.prismaService });
  const provider = createBridgeProvider({ env: deps.env });
  const service = createBankAggregatorService({
    repository, provider, transactionsService: deps.transactionsService,
    accountsService: deps.accountsService, clock: deps.clock,
    listAllActiveConnections: async () => { /* cross-user scheduler iteration */ },
  });
  // ... router / webhookRouter / scheduledTask ...
  return { service, repository, router, webhookRouter, scheduledTask };
}
```

**`apps/api/src/modules/transactions/transactions.module.ts:26-43`** (factory — T15 adds an optional `logos` dep and threads it into `createTransactionsService`):
```ts
export function createTransactionsModule(deps: {
  prismaService: PrismaService;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
  llmAudit?: LlmOverrideAuditPort;
}): TransactionsModule {
  const repository = createTransactionsRepository({ client: deps.prismaService.client });
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
    accountResolver: deps.accountResolver,
    categoriser: deps.categoriser,
    llmAudit: deps.llmAudit,
  });
  const router = createTransactionsRouter({ service });
  return { service, router };
}
```

**`apps/api/src/bootstrap/runtime-dependencies.ts:204-224`** (the wiring block — T12 inserts the standalone `bankProvider` + `logosModule` BEFORE `transactionsModule`, then injects `logos` into both modules + the shared `provider` into bank-aggregator):
```ts
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: { /* ...accountsModule adapters... */ },
    accountResolver: { /* ... */ },
    categoriser: transactionCategoriser,
    llmAudit: llmOverrideAudit,
  });
  const monthlyModule = createMonthlyModule({ prismaService });
  const bankAggregatorModule = createBankAggregatorModule({
    prismaService,
    env: input.env,
    transactionsService: transactionsModule.service,
    accountsService: accountsModule.service,
  });
  // ... return { ..., bankAggregatorModule, transactionsModule, ... }
```

**`apps/api/src/app.ts:103-112`** (route mounting — Elysia-native routers are `.use(...)`-mounted BEFORE the oRPC catch-all; T12 mounts the logo proxy here):
```ts
    .use(healthModule.router)
    // Story 5-6 — Bridge webhook receiver mounted BEFORE mountOrpc so the
    // /internal/bridge/webhook path resolves before the oRPC catch-all.
    .use(deps.bankAggregatorModule.webhookRouter)
    // Story 6-1 — /internal/llm/attest listener mounted BEFORE mountOrpc.
    .use(deps.llmModule.attestRouter);
```

**`apps/api/src/bootstrap/runtime-dependencies.ts:34-44` + `:247-258`** (the `RuntimeDeps` type + return object — T12 adds `logosModule` to both so `app.ts` can read `deps.logosModule.routes`).

**`packages/ui/src/components/index.ts:1-12`** (alphabetical barrel — T17 inserts `export * from "./TransactionLogo";` in alpha order, after the `Pekulo*` block):
```ts
// Pekulo* domain components barrel. ... keep alphabetical order ...
export * from "./CategoryIcon";
export * from "./CategoryPicker";
export * from "./PekuloAccountRow";
// ... (Pekulo* components) ...
```

**`apps/web/.../transactions/_components/transactions-suggestions-section.tsx:148-177`** (the suggestion map — `tx` is the transaction DTO, so `tx.logoUrl` (T2/T15) + `tx.suggestedCategory` (raw key) are available; T19 adds the `logo` prop next to the existing `categoryIcon`):
```tsx
{items.map((tx) => {
  const suggestion: Suggestion = {
    label: tx.label,
    account: accountLabelById.get(tx.accountId) ?? "—",
    dateLabel: formatDay(tx.occurredOn),
    direction: tx.type === "inflow" ? "in" : "out",
    amountEur: tx.amount,
    suggestedCategory: tx.suggestedCategory ? TRANSACTION_CATEGORY_LABELS[tx.suggestedCategory] : "—",
    confidence: tx.suggestedConfidence ?? 0,
    route: ROUTE_BADGE[tx.suggestedRoute ?? "ollama"] ?? "ollama",
  };
  return (
    <View key={tx.id} role="listitem">
      <PekuloSuggestionRow
        tx={suggestion}
        categoryIcon={tx.suggestedCategory ? (<CategoryIcon category={tx.suggestedCategory} size={12} color="var(--colorSecondary)" />) : undefined}
        // ...onConfirm / onEdit / disabled...
```

**`apps/web/.../transactions/_components/transactions-recent-section.tsx:168-191`** (the recent map — `tx.category` is the RAW key; T19 adds the `logo` prop alongside the existing `categoryPrefix`):
```tsx
{items.map((tx) => {
  const activity: Activity = {
    label: tx.label,
    account: accountLabelById.get(tx.accountId) ?? "—",
    category: TRANSACTION_CATEGORY_LABELS[tx.category],
    direction: tx.type === "inflow" ? "in" : "out",
    amountEur: tx.amount,
  };
  const categoryPrefix = (
    <CategoryIcon category={tx.category} size={14} color="var(--colorTertiary)" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
  );
  return (
    <View key={tx.id} role="listitem" flexDirection="row" alignItems="center" gap="$3">
      <View flex={1} minWidth={0}>
        <PekuloActivityRow tx={activity} categoryPrefix={categoryPrefix} />
```

### Wiring order (cycle break — read before T10/T12/T14/T15)

There is a dependency cycle: `logos.service` needs `BankProvider.getProviderLogo`; `transactions.service` needs `logos.service` (enrich); `bank-aggregator.service` needs BOTH `transactions.service` (existing) AND `logos.service` (warm-up). Today `createBankAggregatorModule` builds the Bridge `provider` internally (L28). **Break the cycle by extracting the provider to `runtime-dependencies.ts` and injecting it.** Acyclic order:

1. `bankProvider = createBridgeProvider({ env })`
2. `logosModule = createLogosModule({ prismaService, env, getBankLogo: (id) => bankProvider.getProviderLogo(id).then(r => r.logoUrl) })`
3. `transactionsModule = createTransactionsModule({ ..., logos: logosModule.service })`
4. `bankAggregatorModule = createBankAggregatorModule({ ..., provider: bankProvider, transactionsService: transactionsModule.service, logos: logosModule.service })`

`createBankAggregatorModule` gains an OPTIONAL `provider?` dep (default `createBridgeProvider({ env })`) so its existing unit tests stay green without passing one.

### File responsibilities (3-bullet decision template — new files)

- **`logos.prisma`** — *Responsibility:* declare the two global logo-cache reference tables. *In:* none. *Out:* `MerchantLogoCache` + `ProviderLogoCache` Prisma models.
- **`merchant-key.ts`** — *Responsibility:* turn a raw bank label into a stable merchant key (cache key + search query). *In:* `label: string`. *Out:* `normalizeMerchantKey`, `isResolvableMerchantKey`. Pure.
- **`services/brandfetch-client.ts`** — *Responsibility:* the ONLY outbound HTTP to Brandfetch (server-side). *In:* `env`, a merchant query. *Out:* `{ resolveLogoUrl }` → `string | null` (never throws).
- **`logos.errors.ts`** — *Responsibility:* typed logo-subsystem error. *In:* `PekuloError`. *Out:* `logoUpstreamUnavailable`.
- **`logos.repository.ts`** — *Responsibility:* cache I/O over the two reference tables. *In:* `client`. *Out:* `get/upsert` merchant + provider.
- **`logos.service.ts`** — *Responsibility:* 3-tier resolution + opaque proxy ref + negative cache. *In:* `{ repository, brandfetch, getBankLogo }`. *Out:* `resolveMerchantLogo/resolveProviderLogo/enrich/refToUpstreamUrl` + `providerIdFromAccountKey`.
- **`logos.routes.ts`** — *Responsibility:* the public streaming proxy `GET /v1/logos?ref=`. *In:* `{ service }`. *Out:* an Elysia router (inferred).
- **`logos.module.ts`** — *Responsibility:* compose the module. *In:* `{ prismaService, env, getBankLogo }`. *Out:* `{ service, routes }`.
- **`TransactionLogo.tsx`** — *Responsibility:* the 3-tier avatar (logo `<img>` + `onError`/no-src → `CategoryIcon`). *In:* `{ src?, category, size? }`. *Out:* a decorative avatar.

---

### Execution tasks (full code)

#### T1 — Cache schema + migration [AC-6]

**File (create):** `apps/api/prisma/schema/logos.prisma`
```prisma
// logos.prisma — Story 6-10 (FR-65). Logo caches for the 3-tier transaction
// logo fallback (merchant → bank → category icon).
//
// REFERENCE DATA, NOT user data: these tables hold public brand/bank logo URLs
// keyed by a normalised merchant key / Bridge provider_id. They carry NO
// user_id, NO FK to auth.users, and NO user-RLS (NFR-8 binds user-data tables
// only; ADR-0013 service-role bypass applies). Both model names are listed in
// .oxlintrc.json `unscopedModels` so no-prisma-query-without-user-id passes.
//
// Negative caching: logoUrl == null + a fresh fetchedAt == "resolved, none
// found" — never re-fetched before TTL. A missing row == "never attempted".

model MerchantLogoCache {
  merchantKey String   @id @map("merchant_key")
  logoUrl     String?  @map("logo_url")
  fetchedAt   DateTime @default(now()) @map("fetched_at") @db.Timestamptz

  @@map("merchant_logo_cache")
}

model ProviderLogoCache {
  providerId String   @id @map("provider_id")
  logoUrl    String?  @map("logo_url")
  fetchedAt  DateTime @default(now()) @map("fetched_at") @db.Timestamptz

  @@map("provider_logo_cache")
}
```

**File (create):** `apps/api/prisma/migrations/20260601150000_add_logo_caches/migration.sql`
```sql
-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-10: logo caches (merchant + provider). REFERENCE DATA — no user_id,
-- no FK to auth.users, NO RLS (not user-scoped). See logos.prisma header.

CREATE TABLE IF NOT EXISTS "merchant_logo_cache" (
    "merchant_key" TEXT NOT NULL,
    "logo_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_logo_cache_pkey" PRIMARY KEY ("merchant_key")
);

CREATE TABLE IF NOT EXISTS "provider_logo_cache" (
    "provider_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_logo_cache_pkey" PRIMARY KEY ("provider_id")
);
```

Run: `bun --filter='@pekulo/api' run prisma:generate && bun --filter='@pekulo/api' run typecheck`
Expected: prisma generates the `MerchantLogoCache` + `ProviderLogoCache` delegates; `tsc` exits 0.
Commit: `git add apps/api/prisma/schema/logos.prisma apps/api/prisma/migrations/20260601150000_add_logo_caches/migration.sql && git commit -m "feat(6-10): logo cache schema + migration (FR-65)"`

---

### T2 — `logoUrl` on the DTO + UI display types  [AC-1, AC-2, AC-3]

**File (modify):** `packages/validators/src/transactions/transactions.schemas.ts` — add `logoUrl` to `transactionSchema` (after `suggestedAt`, before `createdAt`):
```ts
  suggestedAt: z.string().nullable().optional(),
  // Story 6-10 (FR-65) — resolved 3-tier logo as an OPAQUE Pekulo proxy URL
  // (/v1/logos?ref=...). null = no merchant/bank logo resolved → UI falls to
  // the category icon. System-set on read (logos.service.enrich); never an
  // input field. NOT a real URL on the wire that the browser hits a 3rd party
  // for — it points at apps/api's streaming proxy.
  logoUrl: z.string().nullable().optional(),
  createdAt: z.string(),
```

**File (modify):** `packages/types/src/transaction/transaction.types.ts` — add `logoUrl?` to both UI shapes:
```ts
export interface Activity {
  label: string;
  account: string;
  category: string;
  direction: TxDirection;
  amountEur: number;
  // Story 6-10 — opaque Pekulo proxy URL for the merchant/bank logo, or
  // null/undefined → row renders the category icon.
  logoUrl?: string | null;
}
```
```ts
export interface Suggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: TxDirection;
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: LlmRouteBadge;
  // Story 6-10 — opaque Pekulo proxy URL for the merchant/bank logo, or
  // null/undefined → row renders the category icon.
  logoUrl?: string | null;
}
```

**File (modify):** `apps/api/src/modules/transactions/transactions.repository.ts` — in `toDto`, default the new field (the service overwrites it post-enrich):
```ts
    suggestedAt: row.suggestedAt ? row.suggestedAt.toISOString() : null,
    // Story 6-10 — null by default; transactions.service.enrich fills it on the
    // list reads (the repository has no logo cache access — module boundary).
    logoUrl: null,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
```

Run: `bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/types' run typecheck && bun --filter='@pekulo/api' run typecheck`
Expected: all three exit 0.
Commit: `git add packages/validators/src/transactions/transactions.schemas.ts packages/types/src/transaction/transaction.types.ts apps/api/src/modules/transactions/transactions.repository.ts && git commit -m "feat(6-10): thread logoUrl through transaction DTO + UI types (FR-65)"`

---

### T3 — `merchant-key.ts` pure normaliser + tests  [AC-1, AC-5]

**File (create):** `apps/api/src/modules/logos/merchant-key.ts`
```ts
// apps/api/src/modules/logos/merchant-key.ts
// Story 6-10 (FR-65). PURE — no I/O, no clock, no env. Normalises a raw bank
// transaction label ("CB Mad Cours Marjane M.m G", "PAIEMENT PAR CARTE 09/11
// CARREFOUR CITY") into a stable lower-case merchant key used BOTH as the
// merchant_logo_cache primary key AND as the Brandfetch Brand Search query.
// Deterministic: same label → same key (cache hit rate + reproducibility).

// Tokens that are pure bank/card noise, never part of a merchant name.
const NOISE = new Set([
  "cb", "paiement", "par", "carte", "virement", "vir", "prlv", "prelevement",
  "prélèvement", "achat", "retrait", "dab", "sepa", "facture", "ref",
]);

// Strip leading "CB", card-payment prose, dates (dd/mm[/yy[yy]]), standalone
// numbers/amounts and 1-char tokens, then keep the first 3 meaningful tokens.
export function normalizeMerchantKey(label: string): string {
  const cleaned = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, " ") // dates
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+$/.test(t));
  return cleaned.slice(0, 3).join(" ").trim();
}

// True when the normalised key is too thin to be a usable Brandfetch query
// (e.g. label was all noise). Callers skip resolution → tier-2/tier-3 fallback.
export function isResolvableMerchantKey(key: string): boolean {
  return key.length >= 3;
}
```

**File (create):** `apps/api/src/modules/logos/merchant-key.test.ts`
```ts
import { describe, expect, test } from "bun:test";
import { isResolvableMerchantKey, normalizeMerchantKey } from "./merchant-key";

describe("normalizeMerchantKey (story 6-10 / FR-65)", () => {
  test("strips card-payment prose + dates, keeps the merchant tokens", () => {
    expect(normalizeMerchantKey("CB Mad Cours Marjane M.m G")).toBe("mad cours marjane");
    expect(normalizeMerchantKey("PAIEMENT PAR CARTE 09/11/2024 CARREFOUR CITY")).toBe(
      "carrefour city",
    );
  });

  test("is deterministic + accent/case-insensitive", () => {
    expect(normalizeMerchantKey("Sàrl Pâtisserie")).toBe(normalizeMerchantKey("SARL PATISSERIE"));
  });

  test("all-noise labels normalise to an unresolvable key", () => {
    const k = normalizeMerchantKey("CB PAIEMENT PAR CARTE 09/11");
    expect(isResolvableMerchantKey(k)).toBe(false);
  });
});
```

Run: `bun --filter='@pekulo/api' run test src/modules/logos/merchant-key.test.ts`
Expected: `3 pass`, exit 0.
Commit: `git add apps/api/src/modules/logos/merchant-key.ts apps/api/src/modules/logos/merchant-key.test.ts && git commit -m "feat(6-10): pure merchant-key normaliser + tests (FR-65)"`

---

### T4 — `services/brandfetch-client.ts` + tests  [AC-1, AC-5]

**File (create):** `apps/api/src/modules/logos/services/brandfetch-client.ts`
```ts
// apps/api/src/modules/logos/services/brandfetch-client.ts
// Story 6-10 (FR-65). Outbound HTTP to Brandfetch — iso-pattern with
// bank-aggregator/services/bridge-client.ts. SERVER-SIDE ONLY: the API key
// lives in Dokploy env (apps/api), never in apps/web, never in fixtures
// (gitleaks pre-commit covers leaks). Brand Search API: free-text name → best
// brand match → icon/logo URL.
//
// Returns null (never throws) on miss / non-2xx / timeout so the caller can
// negative-cache and fall through to the bank logo. Errors are swallowed to a
// null result + an OTel-friendly reason; logo resolution must never break a
// transaction read.

import type { Env } from "../../../config/env";

const BRANDFETCH_TIMEOUT_MS = 5_000;

export interface BrandfetchClient {
  /** Resolve a merchant query to a logo URL, or null when unresolved. */
  resolveLogoUrl(merchantQuery: string): Promise<string | null>;
}

interface BrandSearchHit {
  name: string;
  domain: string;
  icon?: string | null;
  // Brandfetch search returns `icon` (favicon-grade) on the search hit; the
  // brand logo CDN link is derivable from the domain. We prefer `icon` when
  // present, else the domain logo-link CDN URL.
}

export function createBrandfetchClient(args: { env: Env }): BrandfetchClient {
  const { env } = args;
  return {
    async resolveLogoUrl(merchantQuery) {
      if (!env.BRANDFETCH_API_KEY) return null; // unconfigured → graceful no-op
      const base = env.BRANDFETCH_SEARCH_BASE.replace(/\/$/, "");
      const url = `${base}/${encodeURIComponent(merchantQuery)}`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${env.BRANDFETCH_API_KEY}`, accept: "application/json" },
          signal: AbortSignal.timeout(BRANDFETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const hits = (await res.json()) as BrandSearchHit[];
        const top = Array.isArray(hits) ? hits[0] : undefined;
        if (!top) return null;
        if (top.icon) return top.icon;
        if (top.domain && env.BRANDFETCH_LOGO_CLIENT_ID) {
          return `${env.BRANDFETCH_LOGO_BASE.replace(/\/$/, "")}/${top.domain}?c=${env.BRANDFETCH_LOGO_CLIENT_ID}`;
        }
        return null;
      } catch {
        return null; // timeout / network — negative-cache, fall through to bank logo
      }
    },
  };
}
```

**File (create):** `apps/api/src/modules/logos/services/brandfetch-client.test.ts`
```ts
import { afterEach, describe, expect, test } from "bun:test";
import { createBrandfetchClient } from "./brandfetch-client";
import type { Env } from "../../../config/env";

const baseEnv = {
  BRANDFETCH_API_KEY: "test-key",
  BRANDFETCH_SEARCH_BASE: "https://api.brandfetch.io/v2/search",
  BRANDFETCH_LOGO_BASE: "https://cdn.brandfetch.io",
  BRANDFETCH_LOGO_CLIENT_ID: "cid",
} as unknown as Env;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("brandfetch-client (story 6-10 / FR-65)", () => {
  test("returns the top hit's icon on a 200", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ name: "Carrefour", domain: "carrefour.fr", icon: "https://x/c.png" }]), {
        status: 200,
      })) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("carrefour")).toBe("https://x/c.png");
  });

  test("returns null on non-2xx (negative-cacheable)", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("unknownmerchant")).toBeNull();
  });

  test("returns null (never throws) on a thrown fetch / timeout", async () => {
    globalThis.fetch = (async () => {
      throw new Error("TimeoutError");
    }) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("slow")).toBeNull();
  });

  test("no-op (null) when the API key is unconfigured", async () => {
    const c = createBrandfetchClient({ env: { ...baseEnv, BRANDFETCH_API_KEY: undefined } as unknown as Env });
    expect(await c.resolveLogoUrl("carrefour")).toBeNull();
  });
});
```

Run: `bun --filter='@pekulo/api' run test src/modules/logos/services/brandfetch-client.test.ts`
Expected: `4 pass`, exit 0.
Commit: `git add apps/api/src/modules/logos/services/brandfetch-client.ts apps/api/src/modules/logos/services/brandfetch-client.test.ts && git commit -m "feat(6-10): brandfetch client (server-side, never-throws) + tests (FR-65)"`

---

### T5 — `logos.errors.ts`  [AC-1]

**File (create):** `apps/api/src/modules/logos/logos.errors.ts`
```ts
// apps/api/src/modules/logos/logos.errors.ts
// Story 6-10. Typed error envelope for the logos module, extending PekuloError
// (iso with bank-aggregator.errors.ts). Resolution failures are NON-fatal and
// handled inline (null + negative cache); this error exists for the rare case
// a caller wants to surface an explicit logo-subsystem fault (e.g. proxy
// upstream stream failure mapped to a 502).

import { PekuloError } from "../../platform/errors/pekulo-error";

export function logoUpstreamUnavailable(detail: string): PekuloError {
  return new PekuloError("LOGO_UPSTREAM_UNAVAILABLE", `logo upstream unavailable: ${detail}`, 502);
}
```
> Dev note: confirm the `PekuloError` import path + constructor signature against `apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts` before writing (it is the canonical example). Match its `(code, message, httpStatus)` arity exactly.

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.
Commit: `git add apps/api/src/modules/logos/logos.errors.ts && git commit -m "feat(6-10): logos error envelope (FR-65)"`

---

### T6 — `logos.repository.ts`  [AC-5, AC-6]

**File (create):** `apps/api/src/modules/logos/logos.repository.ts`
```ts
// apps/api/src/modules/logos/logos.repository.ts
// Story 6-10. Cache I/O over the two REFERENCE tables (no user_id — see
// logos.prisma). Both model names are in .oxlintrc.json `unscopedModels`, so
// the no-prisma-query-without-user-id rule does not fire here.
//
// Cache semantics: a row with logoUrl=null is a NEGATIVE cache entry ("resolved
// once, none found"); a missing row is "never attempted". Callers use
// `getMerchant`/`getProvider` returning `undefined` (no row) vs `{ logoUrl }`
// (row, possibly null) to tell them apart.

import type { PrismaClient } from "@pekulo/db";

export interface LogosRepository {
  getMerchant(merchantKey: string): Promise<{ logoUrl: string | null } | undefined>;
  upsertMerchant(merchantKey: string, logoUrl: string | null): Promise<void>;
  getProvider(providerId: string): Promise<{ logoUrl: string | null } | undefined>;
  upsertProvider(providerId: string, logoUrl: string | null): Promise<void>;
}

export function createLogosRepository(deps: { client: PrismaClient }): LogosRepository {
  return {
    async getMerchant(merchantKey) {
      const row = await deps.client.merchantLogoCache.findUnique({
        where: { merchantKey },
        select: { logoUrl: true },
      });
      return row ?? undefined;
    },
    async upsertMerchant(merchantKey, logoUrl) {
      await deps.client.merchantLogoCache.upsert({
        where: { merchantKey },
        create: { merchantKey, logoUrl },
        update: { logoUrl, fetchedAt: new Date() },
      });
    },
    async getProvider(providerId) {
      const row = await deps.client.providerLogoCache.findUnique({
        where: { providerId },
        select: { logoUrl: true },
      });
      return row ?? undefined;
    },
    async upsertProvider(providerId, logoUrl) {
      await deps.client.providerLogoCache.upsert({
        where: { providerId },
        create: { providerId, logoUrl },
        update: { logoUrl, fetchedAt: new Date() },
      });
    },
  };
}
```
> Dev note: confirm the Prisma client import (`@pekulo/db` vs the repo's actual alias) against `transactions.repository.ts`'s import header before writing. `upsert`/`findUnique` are user-scoped methods in the lint rule's set — they pass ONLY because `merchantLogoCache`/`providerLogoCache` are in `unscopedModels` (T13). T13 must land before `oxlint` is green.

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.
Commit: `git add apps/api/src/modules/logos/logos.repository.ts && git commit -m "feat(6-10): logos cache repository (reference tables) (FR-65)"`

---

### T7 — `logos.service.ts` + tests  [AC-1, AC-2, AC-3, AC-5]

**File (create):** `apps/api/src/modules/logos/logos.service.ts`
```ts
// apps/api/src/modules/logos/logos.service.ts
// Story 6-10. Orchestrates the 3-tier resolution + the opaque proxy ref.
//   resolveMerchantLogo(label)  — tier 1, cache-first, negative-cached.
//   resolveProviderLogo(provId) — tier 2, cache-first, via BankProvider.
//   enrich(rows)                — read path: returns Map<txId, refToken|null>.
//   refToUpstreamUrl(ref)       — proxy: opaque ref → cached upstream URL (anti-SSRF).
// Resolution NEVER throws; misses negative-cache and fall through.

import { isResolvableMerchantKey, normalizeMerchantKey } from "./merchant-key";
import type { BrandfetchClient } from "./services/brandfetch-client";
import type { LogosRepository } from "./logos.repository";

// provider_id is encoded in account.providerAccountKey = "pid:{providerId}:{name}"
// (bridge-client bridgeAccountKey). IBAN-keyed accounts ("iban:...") have no
// provider_id here → no bank logo (tier-3 fallback). Pure parse, no I/O.
export function providerIdFromAccountKey(accountKey: string | null | undefined): string | null {
  if (!accountKey || !accountKey.startsWith("pid:")) return null;
  const parts = accountKey.split(":");
  const id = parts[1];
  return id && id !== "unknown" ? id : null;
}

// Opaque, URL-safe ref. "m:<merchantKey>" or "b:<providerId>" → base64url.
// NOT reversible to a URL by the client — it only indexes our cache.
function encodeRef(kind: "m" | "b", key: string): string {
  return Buffer.from(`${kind}:${key}`, "utf8").toString("base64url");
}
function decodeRef(ref: string): { kind: "m" | "b"; key: string } | null {
  try {
    const raw = Buffer.from(ref, "base64url").toString("utf8");
    const sep = raw.indexOf(":");
    if (sep < 1) return null;
    const kind = raw.slice(0, sep);
    const key = raw.slice(sep + 1);
    if ((kind !== "m" && kind !== "b") || !key) return null;
    return { kind, key };
  } catch {
    return null;
  }
}

export interface EnrichRow {
  id: string;
  label: string;
  provider: string | null;
  providerAccountKey: string | null;
}

export interface LogosService {
  resolveMerchantLogo(label: string): Promise<string | null>;
  resolveProviderLogo(providerId: string): Promise<string | null>;
  /** Read path — gated on provider != null; returns the opaque proxy ref or null. */
  enrich(rows: EnrichRow[]): Promise<Map<string, string | null>>;
  /** Proxy path — opaque ref → server-resolved upstream URL (anti-SSRF), or null. */
  refToUpstreamUrl(ref: string): Promise<string | null>;
}

export function createLogosService(deps: {
  repository: LogosRepository;
  brandfetch: BrandfetchClient;
  getBankLogo: (providerId: string) => Promise<string | null>; // BankProvider.getProviderLogo
}): LogosService {
  async function resolveMerchantLogo(label: string): Promise<string | null> {
    const key = normalizeMerchantKey(label);
    if (!isResolvableMerchantKey(key)) return null;
    const cached = await deps.repository.getMerchant(key);
    if (cached !== undefined) return cached.logoUrl; // hit (positive OR negative)
    const resolved = await deps.brandfetch.resolveLogoUrl(key);
    await deps.repository.upsertMerchant(key, resolved); // negative-cache on null
    return resolved;
  }

  async function resolveProviderLogo(providerId: string): Promise<string | null> {
    const cached = await deps.repository.getProvider(providerId);
    if (cached !== undefined) return cached.logoUrl;
    const resolved = await deps.getBankLogo(providerId);
    await deps.repository.upsertProvider(providerId, resolved);
    return resolved;
  }

  return {
    resolveMerchantLogo,
    resolveProviderLogo,
    async enrich(rows) {
      const out = new Map<string, string | null>();
      for (const row of rows) {
        if (row.provider == null) {
          out.set(row.id, null); // manual transaction → category icon (AC-3)
          continue;
        }
        const key = normalizeMerchantKey(row.label);
        let ref: string | null = null;
        if (isResolvableMerchantKey(key)) {
          const m = await deps.repository.getMerchant(key);
          if (m?.logoUrl) ref = encodeRef("m", key); // tier 1
        }
        if (!ref) {
          const providerId = providerIdFromAccountKey(row.providerAccountKey);
          if (providerId) {
            const p = await deps.repository.getProvider(providerId);
            if (p?.logoUrl) ref = encodeRef("b", providerId); // tier 2
          }
        }
        out.set(row.id, ref); // null → tier 3 (category icon) in the UI
      }
      return out;
    },
    async refToUpstreamUrl(ref) {
      const decoded = decodeRef(ref);
      if (!decoded) return null; // 404 — never fetch a client-supplied URL (AC-5)
      const row =
        decoded.kind === "m"
          ? await deps.repository.getMerchant(decoded.key)
          : await deps.repository.getProvider(decoded.key);
      return row?.logoUrl ?? null;
    },
  };
}
```
> Dev note (lesson 2026-05-05 / no-await-in-loop): `enrich`'s per-row cache reads are serial by readability; if oxlint flags `no-await-in-loop`, batch the distinct merchant keys + provider ids into two `findMany`-by-`in` lookups first, then map. The `in`-batched form is the preferred final shape for a page of ~20-50 rows — keep the serial form only if the rule is satisfied.

**File (create):** `apps/api/src/modules/logos/logos.service.test.ts`
```ts
import { describe, expect, test } from "bun:test";
import { createLogosService, providerIdFromAccountKey } from "./logos.service";
import type { LogosRepository } from "./logos.repository";

function fakeRepo(seed?: {
  merchant?: Record<string, string | null>;
  provider?: Record<string, string | null>;
}): LogosRepository & { brandfetchCalls: number } {
  const m = new Map(Object.entries(seed?.merchant ?? {}));
  const p = new Map(Object.entries(seed?.provider ?? {}));
  return {
    brandfetchCalls: 0,
    async getMerchant(k) {
      return m.has(k) ? { logoUrl: m.get(k) ?? null } : undefined;
    },
    async upsertMerchant(k, v) {
      m.set(k, v);
    },
    async getProvider(k) {
      return p.has(k) ? { logoUrl: p.get(k) ?? null } : undefined;
    },
    async upsertProvider(k, v) {
      p.set(k, v);
    },
  };
}

describe("logos.service (story 6-10 / FR-65)", () => {
  test("providerIdFromAccountKey parses pid:, ignores iban:/unknown", () => {
    expect(providerIdFromAccountKey("pid:574:Compte")).toBe("574");
    expect(providerIdFromAccountKey("iban:FR76...")).toBeNull();
    expect(providerIdFromAccountKey("pid:unknown:Carte")).toBeNull();
    expect(providerIdFromAccountKey(null)).toBeNull();
  });

  test("resolveMerchantLogo negative-caches a miss (no second brandfetch hit)", async () => {
    let calls = 0;
    const repo = fakeRepo();
    const svc = createLogosService({
      repository: repo,
      brandfetch: {
        async resolveLogoUrl() {
          calls += 1;
          return null;
        },
      },
      getBankLogo: async () => null,
    });
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(await svc.resolveMerchantLogo("Carrefour City")).toBeNull();
    expect(calls).toBe(1); // second call served from the negative cache
  });

  test("enrich: tier1 merchant, then tier2 bank, then null (AC-1/2/3)", async () => {
    const repo = fakeRepo({
      merchant: { "carrefour city": "https://x/carrefour.png" },
      provider: { "574": "https://x/sg.png" },
    });
    const svc = createLogosService({
      repository: repo,
      brandfetch: { async resolveLogoUrl() { return null; } },
      getBankLogo: async () => null,
    });
    const map = await svc.enrich([
      { id: "tx_a", label: "CB Carrefour City", provider: "bridge", providerAccountKey: "pid:574:Cpt" },
      { id: "tx_b", label: "Inconnu SARL", provider: "bridge", providerAccountKey: "pid:574:Cpt" },
      { id: "tx_c", label: "Café du coin", provider: null, providerAccountKey: null },
    ]);
    expect(map.get("tx_a")).toBeTruthy(); // tier 1 ref
    expect(map.get("tx_b")).toBeTruthy(); // tier 2 ref (bank cached)
    expect(map.get("tx_c")).toBeNull(); // manual → tier 3
  });

  test("refToUpstreamUrl: valid ref resolves, forged/garbage ref → null (AC-5)", async () => {
    const repo = fakeRepo({ provider: { "574": "https://x/sg.png" } });
    const svc = createLogosService({
      repository: repo,
      brandfetch: { async resolveLogoUrl() { return null; } },
      getBankLogo: async () => null,
    });
    const ref = Buffer.from("b:574", "utf8").toString("base64url");
    expect(await svc.refToUpstreamUrl(ref)).toBe("https://x/sg.png");
    expect(await svc.refToUpstreamUrl("http://169.254.169.254/")).toBeNull(); // not a ref → no fetch
    expect(await svc.refToUpstreamUrl("garbage!!")).toBeNull();
  });
});
```

Run: `bun --filter='@pekulo/api' run test src/modules/logos/logos.service.test.ts`
Expected: `4 pass`, exit 0.
Commit: `git add apps/api/src/modules/logos/logos.service.ts apps/api/src/modules/logos/logos.service.test.ts && git commit -m "feat(6-10): logos service (3-tier resolve + opaque ref + negative cache) + tests (FR-65)"`

---

### T8 — `BankProvider.getProviderLogo` + bridge-client impl + smoke + test  [AC-2]

**Smoke first (paste output into the PR — lessons 2026-05-27/28).** Against the live sandbox:
```bash
# mint app token already in env; Providers is app-level (no user Bearer):
curl -s -H "Client-Id: $BRIDGE_CLIENT_ID" -H "Client-Secret: $BRIDGE_CLIENT_SECRET" \
     -H "Bridge-Version: $BRIDGE_API_VERSION" \
     "$BRIDGE_API_BASE/v3/aggregation/providers/574" | python3 -m json.tool | grep -A2 images
# Expect: "images": { "logo": "https://web.bridgeapi.io/img/banks-logo/..." }
```

**File (modify):** `apps/api/src/modules/bank-aggregator/bank-provider.ts` — add to the `BankProvider` interface (after `getItem`, before the closing brace):
```ts
  /**
   * Story 6-10 (FR-65, tier 2) — the bank/institution logo for a Bridge
   * `provider_id`. App-level auth (Client-Id/Secret only, NO user Bearer):
   * Providers is the public bank directory. Returns null on 404 / missing
   * `images.logo` so the caller negative-caches and falls through to the
   * category icon. Validated against Providers/Get a single provider in
   * docs/ressources/Bridge API.postman_collection.json + a live smoke.
   */
  getProviderLogo(providerId: string): Promise<{ logoUrl: string | null }>;
```

**File (modify):** `apps/api/src/modules/bank-aggregator/services/bridge-client.ts` — add to the returned object (alongside `getItem`):
```ts
    async getProviderLogo(providerId) {
      // Providers is app-level — no Bearer. allowStatuses:[404] so an unknown
      // provider_id resolves to null instead of throwing bankProviderUnavailable.
      const { data, status } = await req<{ images?: { logo?: string | null } }>(
        `/v3/aggregation/providers/${encodeURIComponent(providerId)}`,
        { method: "GET", allowStatuses: [404] },
      );
      if (status === 404) return { logoUrl: null };
      return { logoUrl: data.images?.logo ?? null };
    },
```

**File (modify/append):** `apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts` — add:
```ts
test("getProviderLogo returns images.logo (app-level, no Bearer); 404 → null", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    if (url.endsWith("/providers/574")) {
      return new Response(JSON.stringify({ id: 574, images: { logo: "https://web/sg.png" } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
  const provider = createBridgeProvider({ env: testEnv });
  expect(await provider.getProviderLogo("574")).toEqual({ logoUrl: "https://web/sg.png" });
  expect(await provider.getProviderLogo("999")).toEqual({ logoUrl: null });
  // app-level: the providers GET carries no Authorization header path (no token mint call)
  expect(calls.some((u) => u.includes("/authorization/token"))).toBe(false);
});
```
> Dev note: reuse the file's existing `testEnv` + `afterEach(() => { globalThis.fetch = realFetch })` harness — match the surrounding test setup verbatim (do not re-declare a second `realFetch`).

Run: `bun --filter='@pekulo/api' run test src/modules/bank-aggregator/services/bridge-client.test.ts`
Expected: existing suite + the new test all pass, exit 0.
Commit: `git add apps/api/src/modules/bank-aggregator/bank-provider.ts apps/api/src/modules/bank-aggregator/services/bridge-client.ts apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts && git commit -m "feat(6-10): BankProvider.getProviderLogo + bridge impl (FR-65 tier 2)"`

---

### T9 — `logos.routes.ts` streaming proxy + SSRF/404 tests  [AC-5]

**File (create):** `apps/api/src/modules/logos/logos.routes.ts`
```ts
// apps/api/src/modules/logos/logos.routes.ts
// Story 6-10. PUBLIC-read streaming proxy: GET /v1/logos?ref=<opaque>. The
// browser only ever talks to apps/api (privacy: no merchant-domain/IP leak to
// Brandfetch/Bridge CDN). Elysia-native (NOT oRPC — binary stream). Returns
// inferred chain (no `: Elysia` annotation — lesson 2026-05-04).
//
// ANTI-SSRF (AC-5): `ref` is an opaque cache index, decoded by the service to a
// SERVER-RESOLVED upstream URL. A url-shaped or garbage ref does not decode →
// 404. The route NEVER fetches a URL taken from the query.

import { Elysia, t } from "elysia";
import type { LogosService } from "./logos.service";

const PROXY_TIMEOUT_MS = 5_000;

export function registerLogoRoutes(deps: { service: LogosService }) {
  return new Elysia().get(
    "/v1/logos",
    async ({ query, set }) => {
      const upstream = await deps.service.refToUpstreamUrl(query.ref);
      if (!upstream) {
        set.status = 404;
        return "logo not found";
      }
      try {
        const res = await fetch(upstream, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
        if (!res.ok || !res.body) {
          set.status = 404;
          return "logo not found";
        }
        set.headers["content-type"] = res.headers.get("content-type") ?? "image/png";
        // Reference data — long, immutable cache. The ref already pins the asset.
        set.headers["cache-control"] = "public, max-age=86400, immutable";
        return res.body; // stream the bytes through
      } catch {
        set.status = 404;
        return "logo not found";
      }
    },
    { query: t.Object({ ref: t.String({ minLength: 1, maxLength: 256 }) }) },
  );
}
```
> Dev note: confirm the Elysia `set.headers` streaming-body shape against an existing Elysia-native route in the repo (e.g. the bridge webhook router / `app.ts`). If `return res.body` (a `ReadableStream`) is not accepted by the installed Elysia version, fall back to `return new Response(res.body, { headers })`. Verify which against `apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts` before writing.

**File (create):** `apps/api/src/modules/logos/logos.routes.test.ts`
```ts
import { describe, expect, test } from "bun:test";
import { registerLogoRoutes } from "./logos.routes";
import type { LogosService } from "./logos.service";

function svcWith(refResolver: (ref: string) => Promise<string | null>): LogosService {
  return {
    resolveMerchantLogo: async () => null,
    resolveProviderLogo: async () => null,
    enrich: async () => new Map(),
    refToUpstreamUrl: refResolver,
  };
}

describe("logos.routes proxy (story 6-10 / AC-5)", () => {
  test("unknown/forged ref → 404, and no upstream fetch is attempted", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const app = registerLogoRoutes({ service: svcWith(async () => null) });
    const res = await app.handle(new Request("http://x/v1/logos?ref=http://169.254.169.254"));
    expect(res.status).toBe(404);
    expect(fetched).toBe(false); // SSRF guard: never fetch a client-supplied URL
  });

  test("valid ref streams the upstream bytes with an image content-type", async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      })) as unknown as typeof fetch;
    const app = registerLogoRoutes({ service: svcWith(async () => "https://cdn/sg.svg") });
    const res = await app.handle(new Request("http://x/v1/logos?ref=YjU3NA"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image");
  });
});
```

Run: `bun --filter='@pekulo/api' run test src/modules/logos/logos.routes.test.ts`
Expected: `2 pass`, exit 0.
Commit: `git add apps/api/src/modules/logos/logos.routes.ts apps/api/src/modules/logos/logos.routes.test.ts && git commit -m "feat(6-10): logo streaming proxy route + anti-SSRF tests (FR-65, AC-5)"`

---

### T10 — `logos.module.ts` factory  [AC-1]

**File (create):** `apps/api/src/modules/logos/logos.module.ts`
```ts
// apps/api/src/modules/logos/logos.module.ts
// Story 6-10. Factory wiring the logos module. Returns an INFERRED shape (no
// `: Elysia` annotation — lesson 2026-05-04). Mirrors createBankAggregatorModule.

import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import { createBrandfetchClient } from "./services/brandfetch-client";
import { createLogosRepository } from "./logos.repository";
import { createLogosService } from "./logos.service";
import { registerLogoRoutes } from "./logos.routes";

export function createLogosModule(deps: {
  prismaService: PrismaService;
  env: Env;
  getBankLogo: (providerId: string) => Promise<string | null>;
}) {
  const repository = createLogosRepository({ client: deps.prismaService.client });
  const brandfetch = createBrandfetchClient({ env: deps.env });
  const service = createLogosService({ repository, brandfetch, getBankLogo: deps.getBankLogo });
  const routes = registerLogoRoutes({ service });
  return { service, routes };
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.
Commit: `git add apps/api/src/modules/logos/logos.module.ts && git commit -m "feat(6-10): logos module factory (FR-65)"`

---

### T11 — `env.ts` Brandfetch config  [AC-1]

**File (modify):** `apps/api/src/config/env.ts` — add after the Bridge block (use `optionalString` so an unconfigured Brandfetch degrades to "no merchant logos", never a boot failure):
```ts
  // Story 6-10 (FR-65) — Brandfetch Brand Search + Logo Link. SERVER-SIDE ONLY:
  // BRANDFETCH_API_KEY lives in Dokploy env (apps/api), never apps/web, never
  // fixtures (gitleaks covers leaks). Unconfigured → merchant tier is a no-op
  // (bank logo / category icon still render).
  BRANDFETCH_API_KEY: optionalString(z.string().min(1)),
  BRANDFETCH_SEARCH_BASE: z.string().url().default("https://api.brandfetch.io/v2/search"),
  BRANDFETCH_LOGO_BASE: z.string().url().default("https://cdn.brandfetch.io"),
  BRANDFETCH_LOGO_CLIENT_ID: optionalString(z.string().min(1)),
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: exit 0.
Commit: `git add apps/api/src/config/env.ts && git commit -m "feat(6-10): Brandfetch env config (server-side only) (FR-65)"`

---

### T12 — wire the module + mount the route  [AC-1, AC-5]

Implements the "Wiring order (cycle break)" Dev Note above. Does NOT touch the two service signatures — T14/T15 thread `logos` into them. Run order T10 → T12 → T14 → T15 keeps every commit typecheck-green.

**File (modify):** `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts` — make the Bridge `provider` an INJECTABLE dep (defaults to the internal one so existing tests pass untouched):
```ts
// add to the deps object of createBankAggregatorModule:
  provider?: BankProvider;
// and change the provider line inside the factory:
  const provider = deps.provider ?? createBridgeProvider({ env: deps.env });
```
> Dev note: add `import type { BankProvider } from "./bank-provider";`. Only the deps-type line + the `provider` line change; the rest of the factory is unchanged.

**File (modify):** `apps/api/src/bootstrap/runtime-dependencies.ts` — create the standalone `bankProvider` + `logosModule` BEFORE `transactionsModule` (cycle-break order), inject the shared provider into bank-aggregator, surface `logosModule`:
```ts
  // Story 6-10 — standalone Bridge provider (shared by bank-aggregator + logos
  // to break the logos↔provider↔bank-aggregator cycle), then the logos module.
  const bankProvider = createBridgeProvider({ env: input.env });
  const logosModule = createLogosModule({
    prismaService,
    env: input.env,
    getBankLogo: async (providerId) => (await bankProvider.getProviderLogo(providerId)).logoUrl,
  });
  // ... existing transactionsModule (T15 adds `logos: logosModule.service` here) ...
  const bankAggregatorModule = createBankAggregatorModule({
    prismaService,
    env: input.env,
    provider: bankProvider, // share the provider (T14 also adds `logos`)
    transactionsService: transactionsModule.service,
    accountsService: accountsModule.service,
  });
```
Add `logosModule` to the `RuntimeDeps` interface and to the final `return`:
```ts
// in RuntimeDeps (near `bankAggregatorModule: ReturnType<typeof createBankAggregatorModule>;`):
  logosModule: ReturnType<typeof createLogosModule>;
// in the returned object:
    logosModule,
```
> Dev note: add imports `import { createBridgeProvider } from "../modules/bank-aggregator/services/bridge-client";` and `import { createLogosModule } from "../modules/logos/logos.module";`.

**File (modify):** `apps/api/src/app.ts` — append the proxy route to the Elysia `.use(...)` chain (same place the webhook/attest routers mount, BEFORE the oRPC catch-all). The chain currently ends `.use(deps.llmModule.attestRouter);`:
```ts
    .use(deps.bankAggregatorModule.webhookRouter)
    .use(deps.llmModule.attestRouter)
    // Story 6-10 — public logo proxy (GET /v1/logos?ref=). Elysia-native.
    .use(deps.logosModule.routes);
```

Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test src/modules/bank-aggregator`
Expected: exit 0; bank-aggregator suites stay green (the `provider?` dep defaults to the internal Bridge provider).
Commit: `git add apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/app.ts && git commit -m "feat(6-10): wire logos module (shared provider) + mount proxy route (FR-65)"`

---

### T13 — `.oxlintrc.json` unscopedModels  [AC-6]

**File (modify):** `.oxlintrc.json` — extend the `no-prisma-query-without-user-id` rule's `unscopedModels` with the two reference models:
```jsonc
        "pekulo/no-prisma-query-without-user-id": [
          "error",
          {
            "prismaIdentifier": ["prisma", "tx", "client"],
            "unscopedModels": ["fxRate", "country", "merchantLogoCache", "providerLogoCache"]
          }
        ]
```
> Dev note: read the current rule entry verbatim first; preserve its existing `prismaIdentifier` value exactly (do not invent the array above if the file uses a different one) — only APPEND the two model names to `unscopedModels`.

Run: `bunx oxlint apps/api/src/modules/logos`
Expected: 0 errors (no `no-prisma-query-without-user-id` on the cache repository), exit 0.
Commit: `git add .oxlintrc.json && git commit -m "chore(6-10): exempt logo cache reference tables from userId lint (AC-6)"`

---

### T14 — warm caches after import  [AC-1, AC-2]

**File (modify):** `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` — in `refreshConnectionImpl`, after the `importFromProvider` call (Step-0 quote above) and before the `lastRefreshedAt` stamp, add a best-effort warm-up. Requires injecting `logos` into the service deps (add `logos?: LogosWarmPort` to the factory deps object, iso the optional `categoriser` port pattern).
```ts
    const { persisted, skipped } = await deps.transactionsService.importFromProvider(
      userId, "bridge", rows,
    );

    // Story 6-10 (FR-65) — warm the logo caches off the user hot path (this is
    // the cron/webhook refresh). Best-effort: a Brandfetch/Bridge failure must
    // never fail a refresh. Resolve the connection's bank logo once + the
    // distinct new merchant labels. The read path only does cache lookups.
    if (deps.logos) {
      const logos = deps.logos;
      void (async () => {
        const providerId = providerIdFromAccountKey(transactions[0]?.accountKey ?? null);
        if (providerId) await logos.resolveProviderLogo(providerId);
        const distinctLabels = [...new Set(transactions.map((t) => t.label))];
        for (const label of distinctLabels) {
          // oxlint-disable-next-line no-await-in-loop -- serial by design: bounded per-tick label set, best-effort warm-up
          await logos.resolveMerchantLogo(label);
        }
      })().catch(() => {
        /* best-effort cache warm-up; read path falls through to bank/category */
      });
    }
```
> Dev note: import `providerIdFromAccountKey` from `../logos/logos.service`. Add `logos?: LogosWarmPort` to the `createBankAggregatorService` deps, where `LogosWarmPort = Pick<LogosService, "resolveProviderLogo" | "resolveMerchantLogo">` (import `LogosService` type-only from `../logos/logos.service`).

**File (modify):** `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts` — thread the optional `logos` from the module deps into `createBankAggregatorService`:
```ts
// add to createBankAggregatorModule deps (alongside the T12 `provider?`):
  logos?: Pick<LogosService, "resolveProviderLogo" | "resolveMerchantLogo">;
// pass it into the service:
  const service = createBankAggregatorService({
    repository, provider, transactionsService: deps.transactionsService,
    accountsService: deps.accountsService, clock: deps.clock,
    logos: deps.logos,
    listAllActiveConnections: async () => { /* unchanged */ },
  });
```
> Dev note: add `import type { LogosService } from "../logos/logos.service";` to the module file.

**File (modify):** `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `logos: logosModule.service` into the `createBankAggregatorModule({...})` call (the call introduced/edited in T12).

Run: `bun --filter='@pekulo/api' run test src/modules/bank-aggregator && bun --filter='@pekulo/api' run typecheck`
Expected: bank-aggregator suites pass (the new optional dep is backward-compatible), exit 0.
Commit: `git add apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(6-10): warm logo caches on bank refresh (FR-65)"`

---

### T15 — enrich list reads with `logoUrl`  [AC-1, AC-2, AC-3]

**File (modify):** `apps/api/src/modules/transactions/transactions.repository.ts` — the list queries (`listByUser`/`listPendingByUser`) must `select` the related account's `provider` + `providerAccountKey` so the service can resolve the bank tier. Add the relation select and surface it on a NON-DTO internal shape (do NOT add it to the public `Transaction` DTO). Simplest: expose a sibling method the service uses for enrichment context, or return the rows' `{id, label, account:{provider, providerAccountKey}}` from a small dedicated read. Keep `toDto` unchanged (logoUrl stays null there).
```ts
// add to TransactionsRepository:
  /**
   * Story 6-10 — minimal context for logo enrichment: the merchant label + the
   * owning account's provider + providerAccountKey, for a set of tx ids. Used
   * by the service AFTER it has the DTO page, so the public DTO stays clean.
   */
  listLogoContext(
    userId: string,
    txIds: string[],
  ): Promise<{ id: string; label: string; provider: string | null; providerAccountKey: string | null }[]>;
```
```ts
// impl:
    async listLogoContext(userId, txIds) {
      if (txIds.length === 0) return [];
      const rows = await deps.client.transaction.findMany({
        where: { userId, id: { in: txIds } },
        select: {
          id: true,
          label: true,
          account: { select: { provider: true, providerAccountKey: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        provider: r.account?.provider ?? null,
        providerAccountKey: r.account?.providerAccountKey ?? null,
      }));
    },
```
> Dev note: confirm the `Transaction` Prisma model has an `account` relation (it does — `account Account @relation(...)` in transactions.prisma). `findMany` here carries `where: { userId }` so the lint rule is satisfied.

**File (modify):** `apps/api/src/modules/transactions/transactions.service.ts` — add the optional `logos?` port to the factory deps, then enrich the DTOs returned by `listRecent` + `listPendingSuggestions`:
```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
  llmAudit?: LlmOverrideAuditPort;
  logos?: { enrich(rows: { id: string; label: string; provider: string | null; providerAccountKey: string | null }[]): Promise<Map<string, string | null>> };
}): TransactionsService {
```
```ts
// a private helper used by both list reads:
    async function attachLogos<T extends { id: string }>(userId: string, items: T[]): Promise<(T & { logoUrl: string | null })[]> {
      if (!deps.logos || items.length === 0) {
        return items.map((it) => ({ ...it, logoUrl: null }));
      }
      const ctx = await deps.repository.listLogoContext(userId, items.map((i) => i.id));
      const refs = await deps.logos.enrich(ctx);
      return items.map((it) => ({
        ...it,
        // proxy URL — the web tier passes this straight to <TransactionLogo>.
        logoUrl: refs.get(it.id) ? `/v1/logos?ref=${refs.get(it.id)}` : null,
      }));
    }
```
Then wrap the existing `listRecent` / `listPendingSuggestions` return values through `attachLogos(userId, items)`.
> Dev note: read both list methods in full first; the `items` arrays are `Transaction[]` (carrying `logoUrl: null` from `toDto`). Replace the `logoUrl: null` with the resolved ref. If `listRecent` is named differently, apply to whichever method feeds the Récentes section + `listPendingSuggestions`.

**File (modify):** `apps/api/src/modules/transactions/transactions.module.ts` — thread the optional `logos` from the module deps into `createTransactionsService`:
```ts
// add to createTransactionsModule deps:
  logos?: Pick<LogosService, "enrich">;
// pass it into the service:
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
    accountResolver: deps.accountResolver,
    categoriser: deps.categoriser,
    llmAudit: deps.llmAudit,
    logos: deps.logos,
  });
```
> Dev note: add `import type { LogosService } from "../logos/logos.service";` to the module file. The `logos?` dep type on `createTransactionsService` (above) can be tightened to `Pick<LogosService, "enrich">` to match.

**File (modify):** `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `logos: logosModule.service` into the `createTransactionsModule({...})` call.

Run: `bun --filter='@pekulo/api' run test src/modules/transactions && bun --filter='@pekulo/api' run typecheck`
Expected: all transactions suites pass (back-compatible — `logos` optional), exit 0.
Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.module.ts apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(6-10): enrich transaction reads with resolved logoUrl (FR-65)"`

---

### T16 — NFR-12 regression: logoUrl never enters the prompt  [AC-4]

**File (modify/append):** `apps/api/src/modules/llm/llm-prompt-builder.test.ts` — add:
```ts
test("FR-65/NFR-12 — a logoUrl on the source is stripped, never reaches the envelope", () => {
  const envelope = buildPromptEnvelope({
    label: "CB Carrefour",
    amount: 12.5,
    currency: "EUR",
    occurredOn: "2026-06-01",
    // smuggled fields — both must be dropped by the allowlist + .strict()
    logoUrl: "/v1/logos?ref=bXNvbWV0aGluZw",
    merchant: "Carrefour",
  } as unknown as Parameters<typeof buildPromptEnvelope>[0]);
  expect(JSON.stringify(envelope)).not.toContain("logoUrl");
  expect(JSON.stringify(envelope)).not.toContain("/v1/logos");
  expect(envelope).toEqual({
    label: "CB Carrefour",
    amount: 12.5,
    currency: "EUR",
    occurredOn: "2026-06-01",
    merchant: "Carrefour",
  });
});
```
> Dev note: match the file's existing import of `buildPromptEnvelope` and its `bun:test` header. This asserts the EXISTING allowlist (`{label, amount, currency, occurredOn, merchant?}`) holds — no production change needed for AC-4.

Run: `bun --filter='@pekulo/api' run test src/modules/llm/llm-prompt-builder.test.ts`
Expected: existing suite + the new test pass, exit 0.
Commit: `git add apps/api/src/modules/llm/llm-prompt-builder.test.ts && git commit -m "test(6-10): NFR-12 regression — logoUrl never enters the LLM prompt (AC-4)"`

---

### T17 — `@pekulo/ui#TransactionLogo` + tests + CSS regen  [AC-1, AC-2, AC-3]

**File (create):** `packages/ui/src/components/TransactionLogo/TransactionLogo.tsx`
```tsx
"use client";

import { View } from "tamagui";
import { CategoryIcon } from "../CategoryIcon/CategoryIcon";

// Story 6-10 (FR-65). 3-tier transaction avatar: when `src` is present render
// the (merchant/bank) logo image; on image load error OR no `src`, fall back to
// the category icon (story 6-8). Decorative: the row announces the label, so the
// avatar is aria-hidden + alt="" (NFR-22/24). Grayscale chrome (TR fidelity,
// lesson 2026-05-07) — no emerald. Fixed square so rows stay aligned.
export interface TransactionLogoProps {
  /** Opaque Pekulo proxy URL (/v1/logos?ref=...), or null/undefined → category icon. */
  src?: string | null;
  /** RAW category value for the fallback CategoryIcon (e.g. "courses"). */
  category: string;
  size?: number;
}

export function TransactionLogo({ src, category, size = 28 }: TransactionLogoProps) {
  return (
    <View
      width={size}
      height={size}
      borderRadius="$full"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      backgroundColor="$backgroundMuted"
      aria-hidden
    >
      {src ? (
        // Native <img> (not Tamagui Image): we need the onError fallback to swap
        // to the category icon when the proxy 404s a missing/broken logo (AC-3).
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: "contain", display: "block" }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const sib = el.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = "flex";
          }}
        />
      ) : null}
      {/* Fallback always in the tree; shown when no src, or revealed onError. */}
      <View display={src ? "none" : "flex"} alignItems="center" justifyContent="center">
        <CategoryIcon category={category} size={Math.round(size * 0.6)} />
      </View>
    </View>
  );
}
```

**File (create):** `packages/ui/src/components/TransactionLogo/TransactionLogo.snapshot.test.tsx`
```tsx
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { TransactionLogo } from "./TransactionLogo";

describe("TransactionLogo (story 6-10 / FR-65)", () => {
  test("renders the <img> when src is present (tier 1/2)", () => {
    const html = renderToString(<TransactionLogo src="/v1/logos?ref=abc" category="courses" />);
    expect(html).toContain("/v1/logos?ref=abc");
    expect(html).toContain('alt=""');
  });

  test("renders only the category icon when src is absent (tier 3)", () => {
    const html = renderToString(<TransactionLogo category="courses" />);
    expect(html).not.toContain("<img");
  });
});
```
> Dev note: match the existing `@pekulo/ui` test setup (the repo's snapshot tests render via the same harness used by `CategoryIcon.test.tsx` — confirm `renderToString` vs the project's test renderer and copy that import).

**File (modify):** `packages/ui/src/components/index.ts` — export the new primitive (after the `CategoryIcon` export):
```ts
export * from "./TransactionLogo";
```

Run: `bun --filter='@pekulo/ui' run test src/components/TransactionLogo && bun run generate:tamagui-css`
Expected: `2 pass`, exit 0; `tamagui.generated.css` regenerated (commit the diff — lesson 2026-05-24).
Commit: `git add packages/ui/src/components/TransactionLogo packages/ui/src/components/index.ts packages/ui/public/tamagui.generated.css && git commit -m "feat(6-10): TransactionLogo primitive (3-tier avatar) + CSS regen (FR-65)"`

---

### T18 — `logo?` slot on the rows + barrel  [AC-1, AC-2, AC-3]

**File (modify):** `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx` — add a `logo?: ReactNode` prop and render it as the leading avatar (keep the direction arrow next to it):
```ts
export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  categoryIcon?: ReactNode;
  // Story 6-10 (FR-65) — leading logo avatar (merchant/bank/category). The
  // consumer passes <TransactionLogo src={tx.logoUrl} category={rawCategory} />.
  logo?: ReactNode;
}
```
In the top row JSX, insert `{logo}` before the `<Arrow .../>` (so the avatar leads the row):
```tsx
      <View flexDirection="row" alignItems="center" gap="$3">
        {logo}
        <Arrow size={18} color="var(--colorSecondary)" />
```
> Dev note: add `logo` to the destructured props in the function signature (`{ tx, onConfirm, onEdit, disabled, categoryIcon, logo }`).

**File (modify):** `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx` — same pattern:
```ts
export interface PekuloActivityRowProps {
  tx: Activity;
  categoryPrefix?: ReactNode;
  // Story 6-10 (FR-65) — leading logo avatar.
  logo?: ReactNode;
}
export function PekuloActivityRow({ tx, categoryPrefix, logo }: PekuloActivityRowProps) {
```
Insert `{logo}` before `<Arrow .../>` in the row.

Run: `bun --filter='@pekulo/ui' run test src/components/PekuloSuggestionRow src/components/PekuloActivityRow && bun --filter='@pekulo/ui' run typecheck`
Expected: existing snapshot/a11y suites pass (snapshots update where the avatar slot is now present — review the diff), exit 0.
Commit: `git add packages/ui/src/components/PekuloSuggestionRow packages/ui/src/components/PekuloActivityRow && git commit -m "feat(6-10): leading logo slot on suggestion + activity rows (FR-65)"`

---

### T19 — wire `<TransactionLogo>` into the web sections  [AC-1, AC-2, AC-3]

**Files (modify):**
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`

In each map (Step-0 quotes above), `tx` IS the transaction DTO — so `tx.logoUrl` (the proxy URL from T2/T15) and the RAW category key are already in scope. Add `TransactionLogo` to the existing `@pekulo/ui` import and pass the `logo` prop on each row (no view-model change needed — the row reads the `logo` ReactNode, same pattern as 6-8's `categoryIcon`).

In `transactions-suggestions-section.tsx` — add to the existing `<PekuloSuggestionRow ...>` (raw key = `tx.suggestedCategory`, fallback `"autre"` when null):
```tsx
                  <PekuloSuggestionRow
                    tx={suggestion}
                    logo={<TransactionLogo src={tx.logoUrl} category={tx.suggestedCategory ?? "autre"} />}
                    categoryIcon={
                      tx.suggestedCategory ? (
                        <CategoryIcon category={tx.suggestedCategory} size={12} color="var(--colorSecondary)" />
                      ) : undefined
                    }
                    // ...existing disabled / onConfirm / onEdit unchanged...
```

In `transactions-recent-section.tsx` — add to the existing `<PekuloActivityRow ...>` (raw key = `tx.category`):
```tsx
                  <PekuloActivityRow
                    tx={activity}
                    categoryPrefix={categoryPrefix}
                    logo={<TransactionLogo src={tx.logoUrl} category={tx.category} />}
                  />
```
> Dev note: add `TransactionLogo` to the existing `import { CategoryIcon, PekuloSuggestionRow, ... } from "@pekulo/ui";` line in each file. `tx.logoUrl` is the new DTO field (T2/T15) — it is `null` for manual transactions and for unresolved provider rows, so `TransactionLogo` renders the category icon (AC-3). These are existing client components already guarded by the R13 hydration flag (lesson 2026-05-24) — do NOT add a new `isLoading` branch. The `Suggestion`/`Activity` view-models do NOT need a `logoUrl` field (the row consumes the `logo` ReactNode) — the optional field added to the types in T2 is harmless carry, not required here.

Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions && bun --filter='@pekulo/web' run typecheck`
Expected: section suites pass, exit 0.
Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx" && git commit -m "feat(6-10): render transaction logos in suggestions + recent sections (FR-65)"`

---

### T20 — axe pass on the new primitive  [AC-3]

**File (create):** `packages/ui/src/components/TransactionLogo/TransactionLogo.a11y.test.tsx`
```tsx
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { TransactionLogo } from "./TransactionLogo";

describe("TransactionLogo a11y (story 6-10)", () => {
  test("the avatar is decorative — aria-hidden, empty alt (label carries meaning)", () => {
    const html = renderToString(<TransactionLogo src="/v1/logos?ref=abc" category="courses" />);
    expect(html).toContain("aria-hidden");
    expect(html).toContain('alt=""');
  });
});
```
> Dev note: if the repo runs axe via `bun --filter='@pekulo/ui' run test:axe` against a component registry, register `TransactionLogo` there too (lesson 2026-05-06: any new interactive primitive must clear axe; this one is non-interactive/decorative, so the assertion is aria-hidden + empty alt). Match `PekuloActivityRow.a11y.test.tsx`'s harness.

Run: `bun --filter='@pekulo/ui' run test src/components/TransactionLogo/TransactionLogo.a11y.test.tsx`
Expected: `1 pass`, exit 0.
Commit: `git add packages/ui/src/components/TransactionLogo/TransactionLogo.a11y.test.tsx && git commit -m "test(6-10): TransactionLogo a11y (decorative avatar) (AC-3)"`

---

### T21 — full gate sweep + visual verification + record  [AC-1..AC-6]

Run, in order, and paste output into the Dev Agent Record:
```bash
bun --filter='@pekulo/api' run prisma:generate
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/ui' run typecheck
bun --filter='@pekulo/web' run typecheck
bunx oxlint apps packages
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/ui' run test
bun --filter='@pekulo/web' run test
bun --filter='@pekulo/api' run db:rls-audit
bun --filter='@pekulo/api' run prisma:check
```
Expected: every command exits 0. `db:rls-audit` confirms the two cache tables are reference (no user-RLS expected); `oxlint` confirms `no-prisma-query-without-user-id` does not fire on `apps/api/src/modules/logos` (AC-6).

**Visual verification (CLAUDE.md — frontend = visual at GREEN):** start the web app, open `/dashboard/transactions`, and use `mcp__react-grab-mcp__get_element_context` on a suggestion row + a recent row to confirm: a Bridge txn with a known merchant → merchant logo; a Bridge txn with unknown merchant → bank logo; a manual txn → category icon. *(If `react-grab-mcp` is offline — as in 6-4/6-8 — note the waiver and rely on the static design-law pass: grayscale avatar, aria-hidden, no emerald.)*

Commit: `git add docs/stories/6-10-merchant-logos.md && git commit -m "docs(6-10): Dev Agent Record + gate output (FR-65)"`

---

## File List

**Create**
- `apps/api/prisma/schema/logos.prisma`
- `apps/api/prisma/migrations/20260601150000_add_logo_caches/migration.sql`
- `apps/api/src/modules/logos/merchant-key.ts` (+ `.test.ts`)
- `apps/api/src/modules/logos/services/brandfetch-client.ts` (+ `.test.ts`)
- `apps/api/src/modules/logos/logos.errors.ts`
- `apps/api/src/modules/logos/logos.repository.ts`
- `apps/api/src/modules/logos/logos.service.ts` (+ `.test.ts`)
- `apps/api/src/modules/logos/logos.routes.ts` (+ `.test.ts`)
- `apps/api/src/modules/logos/logos.module.ts`
- `packages/ui/src/components/TransactionLogo/TransactionLogo.tsx` (+ `.snapshot.test.tsx`, `.a11y.test.tsx`)

**Modify**
- `packages/validators/src/transactions/transactions.schemas.ts` (`logoUrl` on `transactionSchema`)
- `packages/types/src/transaction/transaction.types.ts` (`logoUrl?` on `Activity` + `Suggestion`)
- `apps/api/src/modules/transactions/transactions.repository.ts` (`toDto` default + `listLogoContext`)
- `apps/api/src/modules/transactions/transactions.service.ts` (`logos?` dep + `attachLogos` on list reads)
- `apps/api/src/modules/transactions/transactions.module.ts` (thread `logos` into the service)
- `apps/api/src/modules/bank-aggregator/bank-provider.ts` (`getProviderLogo` on interface)
- `apps/api/src/modules/bank-aggregator/services/bridge-client.ts` (+ `.test.ts`) (`getProviderLogo` impl)
- `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` (warm-up after `importFromProvider`)
- `apps/api/src/modules/bank-aggregator/bank-aggregator.module.ts` (injectable `provider?` + thread `logos`)
- `apps/api/src/modules/llm/llm-prompt-builder.test.ts` (NFR-12 regression)
- `apps/api/src/config/env.ts` (`BRANDFETCH_*`)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (wire `createLogosModule`)
- `apps/api/src/app.ts` (mount proxy route)
- `.oxlintrc.json` (`unscopedModels += [merchantLogoCache, providerLogoCache]`)
- `packages/ui/src/components/index.ts` (export `TransactionLogo`)
- `packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx` (`logo?` slot)
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx` (`logo?` slot)
- `packages/ui/public/tamagui.generated.css` (regenerated)
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`

## Dev Agent Record

_Emitted by aped-dev/step-08 on completion. Left empty at story-write time._

### Summary

FR-65 shipped as the 3-tier transaction logo fallback (merchant via Brandfetch → bank via Bridge Providers → category icon), behind an opaque anti-SSRF proxy (`GET /v1/logos?ref=`). Resolution runs off the user hot path (warmed on bank refresh, cache-only on reads). The DTO carries a Pekulo proxy URL only — never a third-party address, never the logo in an LLM prompt.

- **Model:** claude-opus-4-8 (1M context) · **Started:** 2026-06-01T20:48Z · **Completed:** 2026-06-02T00:13Z
- **20 commits**, TDD per task (RED witnessed where the task added behaviour). All gates green (see Test output). 1 task dropped (T5, YAGNI).

### Files changed

**Create** — `apps/api/prisma/schema/logos.prisma` + migration `20260601150000_add_logo_caches/`; `apps/api/src/modules/logos/{merchant-key,logos.repository,logos.service,logos.routes,logos.module}.ts` (+ `services/brandfetch-client.ts`) with `merchant-key`/`brandfetch-client`/`logos.service`/`logos.routes` tests; `packages/ui/src/components/TransactionLogo/{TransactionLogo.tsx,index.ts,*.snapshot.test.tsx,*.a11y.test.tsx}`.

**Modify** — `packages/validators/.../transactions.schemas.ts` + `packages/types/.../transaction.types.ts` (`logoUrl`); `apps/api/.../transactions.{repository,service,module}.ts` (+ enrich test) + `bank-aggregator.{service,module}.ts` + `bank-provider.ts` + `services/bridge-client.ts` (+ tests) + 3 bank-aggregator fake-provider tests; `bootstrap/runtime-dependencies.ts`; `app.ts`; `config/env.ts`; `database/id-prefixes.config.ts` (+ test); `scripts/rls-migration-audit.ts`; `llm/llm-prompt-builder.test.ts`; `.oxlintrc.json`; `.env.example`; `packages/ui/src/components/{index.ts,PekuloSuggestionRow,PekuloActivityRow,public/tamagui.generated.css}`; `apps/web/.../transactions-{suggestions,recent}-section.tsx`; `apps/api/.../otel-sdk.test.ts` (env fixture).

### Deviations

- **T5 dropped (YAGNI).** The real `PekuloError` is a closed-union `(code, message, options?)` — adding `LOGO_UPSTREAM_UNAVAILABLE` would mean a cross-file change (union + set + `ORPC_HTTP_STATUS_BY_CODE`) for an error with **no consumer**: the service never throws, the brandfetch client returns null, and the proxy route returns 404 (the privacy-correct shape — a 502 would contradict it). Removed from scope rather than ship dead code.
- **T8 endpoint corrected.** The story's `/v3/aggregation/providers/{id}` is wrong; the canonical Postman collection (source of truth per lessons 2026-05-27/28) gives `GET /v3/providers/:id` → `images.logo`, app-level auth. Used the correct path. **Smoke waived** — Bridge sandbox creds are Dokploy-only (empty locally); shape validated against the Postman collection + the unit test.
- **T15 gate corrected.** Enrichment gates on the **transaction's own `provider`**, not the account's — so a manual row on a Bridge-connected account stays logo-less (AC-3). The story snippet used `account.provider`. Added a service-level enrich test (proxy-URL contract + manual-null).
- **T1 expanded.** Two integration requirements the story omitted: both cache models registered `null` in `id-prefixes.config.ts` (natural-key PK — else the upsert throws `MissingPrefixError`) with its drift-guard test updated, and both tables added to `rls-migration-audit`'s `NON_USER_TABLES`.
- **T9 route shape + test host.** Returns native `Response(res.body, …)` (iso the bridge webhook router) instead of `set.headers` streaming. The story test used `http://x/…`, which Elysia 404s — switched to `http://localhost/…`, which also turned the SSRF test from a false-pass into a real one.
- **T13 lint config.** The rule had no `unscopedModels` key (the story assumed `fxRate`/`country` were present); the custom rule defaults to `[]` with no merge, so added only the two cache models.
- **TransactionLogo fallback** uses `useState` on `<img onError>` (idiomatic React) rather than the story's imperative `nextElementSibling` DOM poke — identical behaviour, testable. `nextjs/no-img-element` scoped off for `packages/ui/**` (universal package, no `next/image`).
- **Task order.** T11 before T4 and T13 before T6, so every commit stays typecheck/lint-green (the env type and the lint exemption must precede their consumers).
- **`.env.example`** documented (added on Fred's request — T11 had only touched the Zod schema).
- **Visual verification (T21) waived** — `react-grab-mcp` offline (as in 6-3/6-4/6-8). Static design-law pass clean: grayscale `$backgroundMuted` chrome, no emerald, `aria-hidden` + `alt=""`; the axe test (T20) is green.
- **Post-record fix (live-surfaced).** Running the app before the migration was deployed 500'd `listTransactions`/`listPendingSuggestions` — the read-path enrich hit the not-yet-created cache tables and the error propagated. Made `attachLogos` **best-effort** (catch → serve a logo-less page) so a logo-subsystem failure can never break a transaction read (NFR-1); added a regression test. The fake-repo unit tests didn't catch it (they don't model a missing table). Fix in commit after T21.

### Deploy note

The migration `20260601150000_add_logo_caches` must be applied to each environment (`bun --filter='@pekulo/api' run prisma:migrate:deploy`) before logos resolve — until then the read path degrades gracefully to the category icon. Not yet applied to the shared Supabase DB at dev time.

### Test output

```
oxlint apps packages            0 warnings, 0 errors (800 files)
@pekulo/api test                763 pass, 0 fail (92 files, 1839 expect)
@pekulo/ui test                 pass, exit 0
@pekulo/web test                pass, exit 0 (incl. transactions sections)
@pekulo/api typecheck           exit 0
@pekulo/ui  typecheck           exit 0
@pekulo/web typecheck           exit 0
db:rls-migration-audit          OK — 19 user-data tables RLS-guarded (caches excluded)
db:rls-audit (live DB)          OK — 19 tables; logo caches absent = correctly not user-RLS'd (AC-6)
prisma:check                    schemas valid
```
