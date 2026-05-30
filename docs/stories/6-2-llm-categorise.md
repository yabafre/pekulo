# Story: 6-2-llm-categorise — LLM categorisation pipeline integrated into transactions

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** review
**Ticket:** [#33](https://github.com/yabafre/pekulo/issues/33)
**Branch:** feature/33-6-2-llm-categorise
**Covered FRs:** FR-32 (LLM-suggested category + confidence)
**Commit prefix:** `feat(#33): …`

## User Story

**As a** Pekulo user, **I want** my non-transfer transactions to receive an LLM-suggested category and a confidence score, **so that** the boring categorisation work is done for me.

> **Scope guard (locked at aped-story step 04):** this story ships FR-32 only — the `llm.service.categorise(intent) → {category, confidence}` method, its per-call **outcome** audit row, and the wiring that produces + **persists a pending suggestion** on a freshly-created non-transfer transaction. It does NOT ship: the suggestion confirmation/override UI (FR-33 → story 6-4), the third-party opt-in toggle (FR-34 → 6-3), the activity-log view (FR-36 → 6-5), bulk-import categorisation (deferred — see *Out of scope*), the ollama→third_party low-confidence escalation (deferred — see *Out of scope*), or the on-device FoundationModels client (V1.5 mobile, story 10-2).

## Acceptance Criteria

- **AC-1 (FR-32)** — **Given** a non-transfer transaction is categorised by the default server model (Ollama), **When** categorisation runs, **Then** the result is a suggested category drawn from the closed transaction category set (excluding the system values "transfer" and "autre") together with a confidence score in `[0, 1]`.
- **AC-2 (abstention is safe)** — **Given** the model returns text that cannot be parsed, a category outside the closed set, or the call fails or times out, **When** the result is interpreted, **Then** the system abstains (no suggested category, zero confidence), records a failed-call entry in the audit log, and never raises an error to the caller.
- **AC-3 (audit pairing, no PII — inherited from 6-1's deferred AC-4)** — **Given** a categorisation runs against a server model, **When** it completes, **Then** exactly one intent entry and one outcome entry are recorded for the same call, the outcome entry carries the model actually used plus its latency and result, and no audit entry stores the prompt text or the suggested category (only a non-reversible label digest — NFR-26).
- **AC-4 (suggestion persisted, final category deferred to FR-33)** — **Given** a freshly created transaction left uncategorised ("autre") that is not detected as a transfer, **When** a confident categorisation completes, **Then** the transaction carries a pending suggestion (suggested category, confidence, and originating model) while its own category stays "autre" until the user confirms it in story 6-4. **And** an explicitly-categorised transaction and a detected transfer never receive a suggestion.
- **AC-5 (zero-PII prompt — NFR-12)** — **Given** a prompt is assembled for any model, **When** it is sent, **Then** it contains only the allowlisted transaction fields (label, amount, currency, occurred-on date, optional merchant), serialises to ≤ 2 048 bytes, and no user identifier, account number, or suggested category is ever written to the audit log.
- **AC-6 (off the hot path — NFR-1)** — **Given** a transaction is created, **When** the create response returns, **Then** it is not delayed by the model call (the suggestion is produced in the background), **and** a slow or unreachable model is bounded by a hard timeout rather than hanging the request (NFR-5 budget: Ollama p95 ≤ 1.5 s).
- **AC-7 (Iron-Law gates)** — **Given** the branch, **When** the full gate set runs, **Then** all pass: lint → 0 ; typecheck (api + types + validators) → 0 ; `bun:test` suites → all pass ; `prisma:check` → valid ; `db:rls-audit` → exit 0 with **every table's policy count unchanged** (this story adds columns, not tables).

> **Ticket #33 AC reconciliation (recorded at step 03/04):** the ticket's AC-2 (*"Foundation Models p95 < 600 ms"*) is **not enforceable on the V1 (a) web tier** — Foundation Models is iOS-on-device (V1.5 mobile, story 10-2), and the web client never reports on-device model capability, so the router always selects the Ollama server route. It is re-expressed here as AC-6 (the selected server route honours its NFR-5 budget). The Foundation Models ≤ 600 ms budget is asserted in V1.5 mobile, out of scope for this story.

## Tasks

> Every task is self-contained — full code, the literal run command, the expected output and the literal commit live below. Run each task on `feature/33-6-2-llm-categorise`. `apps/api` tests are `bun:test` (NOT vitest). Every workspace command uses the fully-qualified name `bun --filter='@pekulo/api'` (NEVER `=api`, NEVER `--cwd`).

- [x] **T1** — Add `LlmCategorisation` type + `labelHash` to `LlmRouteDecision` (`@pekulo/types/llm`) [AC: AC-1, AC-3]
- [x] **T2** — `buildCategorisationPrompt` in `llm-prompt-builder.ts` (sole NFR-12 site) + test [AC: AC-5]
- [x] **T3** — `llm-categoriser.ts` pure parser (`raw → {category, confidence}`) + test [AC: AC-1, AC-2]
- [x] **T4** — `LlmProvider.complete(prompt: string)` interface + Ollama/third-party clients + their tests [AC: AC-1, AC-5]
- [x] **T5** — `llm.service.categorise()` + `route()` prompt composition + `RouteIntent.categories` + test [AC: AC-1, AC-2, AC-3]
- [x] **T6** — Prisma suggestion columns on `Transaction` + index [AC: AC-4]
- [x] **T7** — Hand-written migration: 4 nullable columns + index (no RLS change) [AC: AC-4, AC-7]
- [x] **T8** — Suggestion fields on `transactionSchema` DTO (`@pekulo/validators`) [AC: AC-4]
- [x] **T9** — `transactions.repository.saveSuggestion` + `TransactionRow`/`toDto` extension [AC: AC-4]
- [x] **T10** — `transactions.service`: `TransactionCategoriser` port + `suggestCategory` + fire-and-forget wiring + test [AC: AC-4, AC-6]
- [x] **T11** — `transactions.module` accepts the `categoriser` dep [AC: AC-4]
- [x] **T12** — `runtime-dependencies`: reorder `llmModule` before `transactionsModule` + categoriser adapter wiring [AC: AC-4, AC-6]
- [x] **T13** — Full Iron-Law gate + push [AC: AC-7]

## Dev Notes

### Architecture & decisions

- **PRIMARY ADR — `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md`.** The server is the audit authority; `route()` writes the **intent** row, the categorise pipeline writes the **outcome** row. `recordLlmCall` is the sole writer of `llm_call_log` (direct `llmCallLog.create` outside `llm.repository.ts` is forbidden — architecture L691). No prompt body, only a `labelHash` digest (NFR-26).
- **Decisions locked at step 04 (this story):**
  - **Q1 — suggestion storage = columns on `transactions`** (`suggested_category / suggested_confidence / suggested_route / suggested_at`, all nullable). `category` stays `"autre"` until the user confirms in 6-4 (FR-33). Reuses the existing transactions RLS + keyset reads; no new table.
  - **Q2 — categorisation is async fire-and-forget, `createTransaction` path only** (NFR-1: off the hot path). Bulk import (`importCsv` / `importFromProvider`) keeps transfer-rule categorisation only; LLM batch suggestions (DR-3) are a later story.
  - **Q3 — third_party escalation deferred.** 6-2 categorises via the route `route()` returns (always `ollama` at V1 (a) because the web client reports `iosFoundationModels: false` and `third_party` is opt-in-gated + has no write UI until 6-3). The ollama→third_party low-confidence escalation inherited from 6-1's review stays out of scope (see *Out of scope*).
  - **Q4 — `LlmProvider.complete(prompt: string)`.** The transport receives a fully-composed prompt string. `buildCategorisationPrompt(envelope, categories)` (added to `llm-prompt-builder.ts`, the sole NFR-12 site) composes instruction + closed category list + the zero-PII envelope; `route()` builds it for the provider thunk.
- **Routing on the web tier:** `route()`'s `decideRoute` returns `ollama` whenever `iosFoundationModels === false` (always true on web). `categorise` therefore only ever drives the Ollama transport at V1 (a); the `third_party` branch is reachable solely by an opted-in user (6-3) and is left wired-but-dormant.
- **Intent↔outcome route-mismatch (ADR-0008 L19):** in the server categorise pipeline the outcome row carries `decision.route`, identical to the intent row by construction — so no mismatch can arise here. Cross-route forgery is only possible on the `/internal/llm/attest` path, which 6-1 already pinned to the `foundation_models` literal (lesson 2026-05-30). 6-2 adds **no** extra detection mechanism; this is intentional and should not be flagged as missing.
- **Defense in depth (ADR-0013):** `apps/api` runs the service-role connection that BYPASSES RLS, so per-user isolation is the explicit `where: { userId }` clause + the `no-prisma-query-without-user-id` lint rule. `saveSuggestion` carries `where: { id, userId, category: "autre" }` — the `category: "autre"` guard also prevents a late suggestion from clobbering a category the user set meanwhile.
- **`@pekulo/zod` is the SOLE zod entry point (R1):** in `transactions.schemas.ts` keep `import { z } from "@pekulo/zod"`.
- **Zero `*.types.ts` inside `apps/api/src/modules/**`:** `LlmCategorisation` lives in `@pekulo/types/llm`. The `TransactionCategoriser` port and the `ParsedCategorisation` shape are local interfaces (a narrow cross-module port + a pure-function return), not domain DTOs — they stay in their module files, mirroring `AccountOwnershipProbe`.
- **Test commands:** `bun --filter='@pekulo/api'` (NEVER `bun --filter=api`; NEVER `bun --cwd <relative>`). `apps/api` tests import from `"bun:test"`.
- **Commit prefix:** `feat(#33): …`. The PR (after `aped-review`) carries `Fixes #33` in the body.

### Inherited from story 6-1 (done 2026-05-30)

6-1 shipped the routing policy, the two server provider clients, the zero-PII prompt builder, the per-call audit authority, the opt-in read + guard, and `/internal/llm/attest`. It explicitly deferred to 6-2:

- the server-route **outcome** row written by the categorise pipeline (→ **T5**, AC-3),
- the `{category, confidence}` parsing of the provider's raw text (→ **T3/T5**, AC-1),
- the `third_party`-selecting escalation policy + its egress integration test (→ **deferred again**, see *Out of scope* — unreachable until 6-3 ships the opt-in write UI).

Contracts consumed from 6-1 (do NOT re-create): `@pekulo/types#{LlmRoute, LlmRouteDecision, LlmProviderCompletion, LlmCallEvent, ClientCapabilities}`; `LlmService.{route, recordLlmCall, recordLlmCallPair}`; `LlmProvider`; `buildPromptEnvelope`/`hashLabel`; `LlmRepository.{recordCallEvent, recordCallEvents, isThirdPartyOptedIn, listRecentByUser}`.

### Lessons applied (filtered to this story)

- **2026-05-19 — `bun --filter='@pekulo/api'`, NOT `=api`.** Every command below uses the quoted workspace name.
- **2026-05-07 — `bun test` (apps/api) ≠ `vitest`.** New LLM + transactions tests import from `"bun:test"`.
- **2026-05-05 — `bun --cwd <relative>` silently fails / Prisma `defineConfig` evaluates `env("DATABASE_URL")` at load.** Use `--filter`; migration is hand-written + applied via `prisma:migrate:deploy` (ADR-0014).
- **2026-05-09 — Zero `*.types.ts` under `apps/api/src/modules/**`.** `LlmCategorisation` is added to `@pekulo/types/llm`.
- **2026-05-30 — narrow a domain enum to the legitimate subset at trust boundaries.** Not triggered here: 6-2's `categorise` legitimately uses the full `LlmRoute` (the wide enum IS correct for routing); the attest narrowing already lives in 6-1. The `category` returned by the model is validated against the closed `TRANSACTION_CATEGORIES` subset in `llm-categoriser` (AC-2) — the same "narrow to the legitimate set" discipline applied to the model's output.

### File decision template (3-bullet per created/modified file)

- **`packages/types/src/llm/llm.types.ts`** *(MODIFY)* — add `LlmCategorisation` + `labelHash` on `LlmRouteDecision`. Imports nothing new; exported via the package barrel.
- **`apps/api/src/modules/llm/llm-prompt-builder.ts`** *(MODIFY)* — add `buildCategorisationPrompt`. Pure; imports `LlmPromptEnvelope`. Sole prompt-composition site (NFR-12).
- **`apps/api/src/modules/llm/llm-categoriser.ts`** *(NEW)* — pure `parseCategorisation(raw, categories) → {category, confidence}`. Zero I/O; no imports beyond types-free local interface.
- **`apps/api/src/modules/llm/llm-provider.ts`** *(MODIFY)* — `complete(prompt: string)`. Imports `LlmProviderCompletion`.
- **`apps/api/src/modules/llm/services/{ollama,third-party}-client.ts`** *(MODIFY)* — accept the prompt string; transport only.
- **`apps/api/src/modules/llm/llm.service.ts`** *(MODIFY)* — `route()` composes the prompt + returns `labelHash`; new `categorise()` writes the outcome row. Composes repository + clients + prompt builder + categoriser.
- **`apps/api/prisma/schema/transactions.prisma`** *(MODIFY)* — 4 nullable suggestion columns + `transactions_user_suggestion_idx`.
- **`apps/api/prisma/migrations/20260530140000_add_transaction_suggestion_columns/migration.sql`** *(NEW)* — `ALTER TABLE … ADD COLUMN` ×4 + index. No RLS change.
- **`packages/validators/src/transactions/transactions.schemas.ts`** *(MODIFY)* — 4 `.nullable().optional()` fields on `transactionSchema`.
- **`apps/api/src/modules/transactions/transactions.repository.ts`** *(MODIFY)* — extend `TransactionRow` + `toDto`; add `saveSuggestion` (sole suggestion writer, `where { id, userId, category: "autre" }`).
- **`apps/api/src/modules/transactions/transactions.service.ts`** *(MODIFY)* — `TransactionCategoriser` port + `suggestCategory` + fire-and-forget in `createTransaction`.
- **`apps/api/src/modules/transactions/transactions.module.ts`** *(MODIFY)* — accept + forward the optional `categoriser` dep.
- **`apps/api/src/bootstrap/runtime-dependencies.ts`** *(MODIFY)* — reorder `llmModule` before `transactionsModule`; build the categoriser adapter; pass it in.

### Existing code at write time (Step-0 verbatim)

**`packages/types/src/llm/llm.types.ts:44-48`** — `LlmRouteDecision` (T1 adds `labelHash`; T1 appends `LlmCategorisation`):

```ts
export interface LlmRouteDecision {
  callId: string;
  route: LlmRoute;
  providerCall: (() => Promise<LlmProviderCompletion>) | null;
}
```

**`apps/api/src/modules/llm/llm-provider.ts:5-12`** — current interface (T4 changes the arg to a string):

```ts
export interface LlmProvider {
  /** The route this client serves — 'ollama' or 'third_party'. */
  readonly route: "ollama" | "third_party";
  /** Low-level completion. Story 6-1 ships the transport (raw text + latency);
   * the {category, confidence} parsing lands in story 6-2. Throws
   * LlmError(LLM_PROVIDER_UNAVAILABLE) on transport failure / timeout. */
  complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion>;
}
```

**`apps/api/src/modules/llm/services/ollama-client.ts:18-33`** — current `complete` body (T4 swaps `envelope`→`prompt`):

```ts
    async complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion> {
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: JSON.stringify(envelope), stream: false }),
          signal: controller.signal,
        });
```

**`apps/api/src/modules/llm/services/third-party-client.ts:20-41`** — current `complete` body (T4 swaps `envelope`→`prompt`):

```ts
    async complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion> {
      if (!apiKey) {
        throw llmProviderUnavailable("third_party", "THIRD_PARTY_LLM_API_KEY not configured");
      }
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), THIRD_PARTY_TIMEOUT_MS);
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 64,
            messages: [{ role: "user", content: JSON.stringify(envelope) }],
          }),
          signal: controller.signal,
        });
```

**`apps/api/src/modules/llm/llm.service.ts:24-104`** — current `RouteIntent`, `LlmService`, factory + `route()` (T5 rewrites the file; reproduced here verbatim so the rewrite is a delta, not a guess):

```ts
export interface RouteIntent {
  userId: string;
  clientCapabilities: ClientCapabilities;
  prompt: PromptBuilderInput;
}

export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
  /** Write an intent+outcome pair atomically (ADR-0008 attest path). Both
   * events are validated and persisted in one transaction so a crash can never
   * leave an orphan intent row. */
  recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
}

const VALID_ROUTES: ReadonlySet<LlmRoute> = new Set<LlmRoute>([
  "foundation_models",
  "ollama",
  "third_party",
]);

export function createLlmService(deps: {
  repository: LlmRepository;
  ollamaClient: LlmProvider;
  thirdPartyClient: LlmProvider;
  optInReader: ThirdPartyOptInReader;
  generateCallId: () => string;
}): LlmService {
  // Free helper avoids `this`-binding fragility (lesson 5-3).
  async function record(userId: string, event: LlmCallEvent): Promise<void> {
    if (!VALID_ROUTES.has(event.route)) {
      throw llmRoutingError(`unknown route ${String(event.route)}`);
    }
    await deps.repository.recordCallEvent(userId, event);
  }

  async function recordPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void> {
    for (const event of events) {
      if (!VALID_ROUTES.has(event.route)) {
        throw llmRoutingError(`unknown route ${String(event.route)}`);
      }
    }
    await deps.repository.recordCallEvents(userId, events);
  }

  function decideRoute(caps: ClientCapabilities): LlmRoute {
    if (caps.iosFoundationModels) return "foundation_models";
    return "ollama";
  }

  return {
    async route(intent) {
      const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
      const labelHash = hashLabel(envelope.label);
      const route = decideRoute(intent.clientCapabilities);
      const callId = deps.generateCallId();
      await record(intent.userId, { phase: "intent", callId, route, labelHash });

      let providerCall: LlmRouteDecision["providerCall"] = null;
      if (route === "ollama") {
        providerCall = () => deps.ollamaClient.complete(envelope);
      } else if (route === "third_party") {
        providerCall = async () => {
          await requireThirdPartyOptIn(deps.optInReader, intent.userId);
          return deps.thirdPartyClient.complete(envelope);
        };
      }
      return { callId, route, providerCall };
    },

    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
}
```

**`apps/api/src/modules/transactions/transactions.service.ts:102-154`** — `categoriseAfterCreateImpl` + `createTransaction` (T10 wraps a fire-and-forget call after `categoriseAfterCreateImpl` returns):

```ts
async function categoriseAfterCreateImpl(args: {
  userId: string;
  candidate: Transaction;
  repository: TransactionsRepository;
}): Promise<Transaction> {
  const { userId, candidate, repository } = args;
  if (candidate.category !== "autre") return candidate;
  const siblings = await repository.findTransferPairCandidates(userId, {
    accountId: candidate.accountId,
    occurredOn: candidate.occurredOn,
    amount: candidate.amount,
    type: candidate.type,
  });
  const { pair } = detectTransferPair({ candidate, siblings });
  if (!pair) return candidate;
  const pairId = generateTransferPairId();
  const { paired } = await repository.pairAsTransfer(userId, candidate.id, pair.id, pairId);
  if (paired !== 2) {
    throw new PekuloError(
      "TRANSACTION_PAIR_RACE",
      `pairAsTransfer expected count=2, got ${paired} (candidate=${candidate.id} sibling=${pair.id})`,
    );
  }
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
      return categoriseAfterCreateImpl({
        userId,
        candidate: created,
        repository: deps.repository,
      });
    },
```

**`apps/api/src/modules/transactions/transactions.repository.ts:32-46` + `114-128`** — `TransactionRow` + `toDto` (T9 extends both):

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

**`packages/validators/src/transactions/transactions.schemas.ts:78-92`** — `transactionSchema` (T8 inserts 4 fields before `createdAt`):

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

**`apps/api/prisma/schema/transactions.prisma:9-34`** — `Transaction` model (T6 adds 4 columns + 1 index):

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

**`apps/api/src/modules/transactions/transactions.module.ts:12-37`** — module factory (T11 adds the `categoriser` dep):

```ts
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type TransactionsService,
} from "./transactions.service";

export interface TransactionsModule {
  service: TransactionsService;
  router: ReturnType<typeof createTransactionsRouter>;
}

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

**`apps/api/src/bootstrap/runtime-dependencies.ts:139-148` + `159-167`** — `transactionsModule` then `llmModule` (T12 reorders: build `llmModule` first, then the adapter, then `transactionsModule` with `categoriser`):

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
```

```ts
  // Story 6-1 — LLM routing + audit module. No oRPC router (no client-facing
  // procedure in 6-1); the only HTTP surface is the /internal/llm/attest
  // Elysia listener mounted in app.ts. The service is consumed server-side by
  // story 6-2's categorise pipeline (wired then).
  const llmModule = createLlmModule({
    prismaService,
    env: input.env,
    jwtVerifier,
  });
```

---

### Task-by-task implementation code

#### T1 — `LlmCategorisation` type + `labelHash` on `LlmRouteDecision` [AC: AC-1, AC-3]

In `packages/types/src/llm/llm.types.ts`, **replace** the `LlmRouteDecision` interface (lines 41-48) with the version below (adds `labelHash`), then **append** the new `LlmCategorisation` interface immediately after it:

```ts
/** Routing decision returned by llm.service.route (FR-31). `providerCall` is a
 * thunk the categorisation pipeline (story 6-2) invokes for server routes;
 * null for foundation_models (the call is client-owned, attested async). */
export interface LlmRouteDecision {
  callId: string;
  route: LlmRoute;
  /** djb2 digest of the prompt label (NFR-26 de-dup key). Exposed so the
   * categorise pipeline (story 6-2) can stamp the outcome row without
   * rebuilding the envelope. NEVER the prompt body — only the hash. */
  labelHash: string;
  providerCall: (() => Promise<LlmProviderCompletion>) | null;
}

/** Result of llm.service.categorise (FR-32, story 6-2). `category` is null when
 * the model abstained or returned an unparseable / out-of-enum value — the
 * caller then leaves the transaction uncategorised. `confidence ∈ [0, 1]`.
 * `route` is the actual server route that produced the answer (route_actual). */
export interface LlmCategorisation {
  callId: string;
  route: LlmRoute;
  category: string | null;
  confidence: number;
}
```

Run: `bun --filter='@pekulo/types' run typecheck`
Expected: `tsc` exits 0, no error.
Commit: `git add packages/types/src/llm/llm.types.ts && git commit -m "feat(#33): LlmCategorisation type + labelHash on LlmRouteDecision (FR-32)"`

#### T2 — `buildCategorisationPrompt` (sole NFR-12 site) + test [AC: AC-5]

Append to `apps/api/src/modules/llm/llm-prompt-builder.ts` (after `hashLabel`):

```ts
/** Compose the full categorisation prompt (story 6-2, FR-32) from an
 * ALREADY-validated zero-PII envelope (NFR-12) + the closed category list.
 * Together with buildPromptEnvelope this is the SOLE site where any text sent
 * to a provider is assembled (architecture L690). The instruction asks for
 * STRICT JSON so llm-categoriser can parse deterministically. No PII enters
 * here — `envelope` already passed the allowlist + the 2 kB cap. */
export function buildCategorisationPrompt(
  envelope: LlmPromptEnvelope,
  categories: readonly string[],
): string {
  const allowed = categories.join(", ");
  return [
    "You are a personal-finance transaction categoriser.",
    `Classify the transaction below into EXACTLY ONE of these categories: ${allowed}.`,
    'Reply with STRICT JSON only, no prose: {"category":"<one-of-the-list>","confidence":<0..1>}.',
    "If unsure, pick the closest category and lower the confidence.",
    `Transaction: ${JSON.stringify(envelope)}`,
  ].join("\n");
}
```

Create `apps/api/src/modules/llm/llm-categorisation-prompt.test.ts`:

```ts
// bun:test — buildCategorisationPrompt (story 6-2, AC-5 / NFR-12).
import { test, expect } from "bun:test";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { buildCategorisationPrompt } from "./llm-prompt-builder";

const envelope: LlmPromptEnvelope = {
  label: "Carrefour",
  amount: -42.5,
  currency: "EUR",
  occurredOn: "2026-05-15",
};

test("embeds the closed category list and the envelope", () => {
  const prompt = buildCategorisationPrompt(envelope, ["courses", "transport"]);
  expect(prompt).toContain("courses, transport");
  expect(prompt).toContain('"label":"Carrefour"');
  expect(prompt).toContain("STRICT JSON");
});

test("carries no key outside the envelope allowlist (NFR-12)", () => {
  const prompt = buildCategorisationPrompt(envelope, ["courses"]);
  expect(prompt).not.toContain("userId");
  expect(prompt).not.toContain("accountNumber");
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm-categorisation-prompt.test.ts`
Expected: `2 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm-prompt-builder.ts apps/api/src/modules/llm/llm-categorisation-prompt.test.ts && git commit -m "feat(#33): buildCategorisationPrompt — sole NFR-12 categorise prompt site"`

#### T3 — `llm-categoriser.ts` pure parser + test [AC: AC-1, AC-2]

Create `apps/api/src/modules/llm/llm-categoriser.ts`:

```ts
// apps/api/src/modules/llm/llm-categoriser.ts
// Parse a provider's raw completion into {category, confidence} (story 6-2,
// FR-32). Pure: no I/O, no clock, no env. Tolerant — the model may wrap JSON in
// prose / code fences, so we slice the first balanced-looking {...} block before
// parsing. ABSTAINS to {category: null, confidence: 0} on ANY failure
// (unparseable, category outside the closed list, confidence not finite) so a
// bad completion never crashes the create path nor injects an out-of-enum
// category (AC-2). `categories` is the closed allowlist the caller permits.

export interface ParsedCategorisation {
  category: string | null;
  confidence: number;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function parseCategorisation(
  raw: string,
  categories: readonly string[],
): ParsedCategorisation {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { category: null, confidence: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { category: null, confidence: 0 };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { category: null, confidence: 0 };
  }
  const obj = parsed as { category?: unknown; confidence?: unknown };
  const category = typeof obj.category === "string" ? obj.category : null;
  if (category === null || !categories.includes(category)) {
    return { category: null, confidence: 0 };
  }
  return { category, confidence: clampConfidence(obj.confidence) };
}
```

Create `apps/api/src/modules/llm/llm-categoriser.test.ts`:

```ts
// bun:test — llm-categoriser pure parser (story 6-2, AC-1/AC-2).
import { test, expect } from "bun:test";
import { parseCategorisation } from "./llm-categoriser";

const CATS = ["courses", "transport", "sorties"] as const;

test("parses strict JSON into {category, confidence} (AC-1)", () => {
  expect(parseCategorisation('{"category":"courses","confidence":0.91}', CATS)).toEqual({
    category: "courses",
    confidence: 0.91,
  });
});

test("extracts JSON wrapped in code fences / prose", () => {
  const raw = '```json\n{"category":"transport","confidence":0.7}\n```';
  expect(parseCategorisation(raw, CATS)).toEqual({ category: "transport", confidence: 0.7 });
});

test("clamps confidence into [0, 1]", () => {
  expect(parseCategorisation('{"category":"courses","confidence":1.8}', CATS).confidence).toBe(1);
  expect(parseCategorisation('{"category":"courses","confidence":-0.5}', CATS).confidence).toBe(0);
});

test("abstains on a category outside the closed list (AC-2)", () => {
  expect(parseCategorisation('{"category":"crypto","confidence":0.99}', CATS)).toEqual({
    category: null,
    confidence: 0,
  });
});

test("abstains on unparseable garbage (AC-2)", () => {
  expect(parseCategorisation("not json at all", CATS)).toEqual({ category: null, confidence: 0 });
});

test("keeps the category but zeroes a missing / non-numeric confidence", () => {
  expect(parseCategorisation('{"category":"courses"}', CATS)).toEqual({
    category: "courses",
    confidence: 0,
  });
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm-categoriser.test.ts`
Expected: `6 pass`, `0 fail`, exit 0.
Verify zero-IO: `grep -nE "(prisma|fetch|http|setTimeout|setInterval|Date\.now|new Date|process\.env|console\.|opentelemetry)" apps/api/src/modules/llm/llm-categoriser.ts`
Expected: empty output, exit 1 (no match — green signal).
Commit: `git add apps/api/src/modules/llm/llm-categoriser.ts apps/api/src/modules/llm/llm-categoriser.test.ts && git commit -m "feat(#33): zero-IO categorisation parser + abstention (AC-1/AC-2)"`

#### T4 — `LlmProvider.complete(prompt: string)` + both clients + tests [AC: AC-1, AC-5]

**(a)** Replace the whole `apps/api/src/modules/llm/llm-provider.ts` with:

```ts
// apps/api/src/modules/llm/llm-provider.ts
// Provider abstraction for the LLM transport tier (Epic 6). Iso-pattern with
// bank-aggregator/bank-provider.ts. OllamaClient + ThirdPartyClient implement
// it under services/. FoundationModels is NOT a server provider — it runs
// on-device (apps/mobile, V1.5) and is attested via /internal/llm/attest.
// Story 6-2: `complete` takes a fully-composed prompt STRING (built by
// llm-prompt-builder — the sole NFR-12 site) so the transport stays task-
// agnostic; the {category, confidence} parsing lives in llm-categoriser.
import type { LlmProviderCompletion } from "@pekulo/types";

export interface LlmProvider {
  /** The route this client serves — 'ollama' or 'third_party'. */
  readonly route: "ollama" | "third_party";
  /** Low-level completion from a composed prompt string. Returns raw text +
   * latency. Throws LlmError(LLM_PROVIDER_UNAVAILABLE) on transport failure /
   * timeout. */
  complete(prompt: string): Promise<LlmProviderCompletion>;
}
```

**(b)** In `apps/api/src/modules/llm/services/ollama-client.ts`: drop the now-unused `LlmPromptEnvelope` import (keep `LlmProviderCompletion`) and replace the `complete` signature + body header so it sends the prompt string. Replace lines 6-7 and the `complete` opening:

Replace the import line:

```ts
import type { LlmProviderCompletion } from "@pekulo/types";
```

Replace the `complete` method header + fetch body (lines 18-28) with:

```ts
    async complete(prompt: string): Promise<LlmProviderCompletion> {
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false }),
          signal: controller.signal,
        });
```

**(c)** In `apps/api/src/modules/llm/services/third-party-client.ts`: same import swap, replace the `complete` signature + the `messages` body. Replace the import line:

```ts
import type { LlmProviderCompletion } from "@pekulo/types";
```

Replace the `complete` method header + fetch body (lines 20-40) with:

```ts
    async complete(prompt: string): Promise<LlmProviderCompletion> {
      if (!apiKey) {
        throw llmProviderUnavailable("third_party", "THIRD_PARTY_LLM_API_KEY not configured");
      }
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), THIRD_PARTY_TIMEOUT_MS);
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 64,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
```

**(d)** Replace the whole `apps/api/src/modules/llm/services/ollama-client.test.ts` with:

```ts
// bun:test — Ollama transport client (story 6-1; updated 6-2 → prompt string).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import { createOllamaClient } from "./ollama-client";
import { isPekuloError } from "../../../common/errors";

const fakeEnv = {
  OLLAMA_BASE_URL: "http://ollama.test",
  OLLAMA_MODEL: "test-model",
} as unknown as Env;
const prompt = "categorise: Carrefour -42.5 EUR 2026-05-15";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("returns raw text + latency on a 200 response", async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ response: "alimentation" }), { status: 200 }),
  ) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  const out = await client.complete(prompt);
  expect(out.raw).toBe("alimentation");
  expect(out.latencyMs).toBeGreaterThanOrEqual(0);
});

test("throws LLM_PROVIDER_UNAVAILABLE on a non-2xx response", async () => {
  globalThis.fetch = mock(async () => new Response(null, { status: 502 })) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  try {
    await client.complete(prompt);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});
```

**(e)** Replace the whole `apps/api/src/modules/llm/services/third-party-client.test.ts` with:

```ts
// bun:test — third-party transport client (story 6-1; updated 6-2 → prompt string).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import { createThirdPartyClient } from "./third-party-client";
import { isPekuloError } from "../../../common/errors";

const prompt = "categorise: Carrefour -42.5 EUR 2026-05-15";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("throws LLM_PROVIDER_UNAVAILABLE when no API key is configured", async () => {
  const client = createThirdPartyClient({ env: {} as unknown as Env });
  try {
    await client.complete(prompt);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});

test("returns raw text on a 200 response when keyed", async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ content: [{ text: "transport" }] }), { status: 200 }),
  ) as typeof fetch;
  const client = createThirdPartyClient({
    env: { THIRD_PARTY_LLM_API_KEY: "sk-test" } as unknown as Env,
  });
  const out = await client.complete(prompt);
  expect(out.raw).toBe("transport");
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/services/ollama-client.test.ts apps/api/src/modules/llm/services/third-party-client.test.ts`
Expected: `4 pass`, `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/llm/llm-provider.ts apps/api/src/modules/llm/services && git commit -m "feat(#33): LlmProvider.complete takes a composed prompt string"`

#### T5 — `llm.service.categorise()` + prompt-aware `route()` + test [AC: AC-1, AC-2, AC-3]

Replace the whole `apps/api/src/modules/llm/llm.service.ts` with:

```ts
// apps/api/src/modules/llm/llm.service.ts
// LLM routing policy (FR-31) + per-call audit authority (FR-35 / ADR-0008) +
// categorisation (FR-32, story 6-2). routeDecision(intent) decides the endpoint
// and writes the INTENT audit row, then returns a providerCall thunk bound to a
// composed prompt string. categorise(intent) invokes that thunk, parses the
// completion, writes the OUTCOME audit row, and returns {category, confidence}.
// recordLlmCall is the SOLE writer of llm_call_log (direct llmCallLog.create
// outside the repository is forbidden — architecture L691). callId is injected
// for deterministic tests (factory dep, no env seam).
import type {
  ClientCapabilities,
  LlmCallEvent,
  LlmCategorisation,
  LlmPromptEnvelope,
  LlmRoute,
  LlmRouteDecision,
} from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import {
  requireThirdPartyOptIn,
  type ThirdPartyOptInReader,
} from "../../platform/security/opt-in-guard";
import {
  buildCategorisationPrompt,
  buildPromptEnvelope,
  hashLabel,
  type PromptBuilderInput,
} from "./llm-prompt-builder";
import { parseCategorisation } from "./llm-categoriser";
import { llmRoutingError } from "./llm.errors";

export interface RouteIntent {
  userId: string;
  clientCapabilities: ClientCapabilities;
  prompt: PromptBuilderInput;
  /** Closed category list (story 6-2, FR-32). When present, route() composes the
   * categorisation prompt via buildCategorisationPrompt; when absent, the raw
   * envelope JSON is sent (back-compat with non-categorise callers). */
  categories?: readonly string[];
}

export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  /** Categorise a transaction (FR-32, story 6-2): routes (writes the intent
   * audit row), invokes the server provider, parses {category, confidence},
   * writes the outcome audit row, and returns the suggestion. Server-route only
   * — foundation_models abstains here (the iOS client owns + attests it).
   * NEVER throws on provider failure: abstains to {category: null} + records a
   * failure outcome. */
  categorise(intent: RouteIntent): Promise<LlmCategorisation>;
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
  /** Write an intent+outcome pair atomically (ADR-0008 attest path). Both
   * events are validated and persisted in one transaction so a crash can never
   * leave an orphan intent row. */
  recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
}

const VALID_ROUTES: ReadonlySet<LlmRoute> = new Set<LlmRoute>([
  "foundation_models",
  "ollama",
  "third_party",
]);

export function createLlmService(deps: {
  repository: LlmRepository;
  ollamaClient: LlmProvider;
  thirdPartyClient: LlmProvider;
  optInReader: ThirdPartyOptInReader;
  generateCallId: () => string;
}): LlmService {
  // Free helpers avoid `this`-binding fragility (lesson 5-3) — the factory
  // returns a plain object literal where `this` is unreliable across closures.
  async function record(userId: string, event: LlmCallEvent): Promise<void> {
    if (!VALID_ROUTES.has(event.route)) {
      throw llmRoutingError(`unknown route ${String(event.route)}`);
    }
    await deps.repository.recordCallEvent(userId, event);
  }

  async function recordPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void> {
    for (const event of events) {
      if (!VALID_ROUTES.has(event.route)) {
        throw llmRoutingError(`unknown route ${String(event.route)}`);
      }
    }
    await deps.repository.recordCallEvents(userId, events);
  }

  // FR-31 routing policy. iOS-capable → on-device FoundationModels. Otherwise
  // Ollama is the default server route. third_party is NEVER auto-selected at
  // V1 (a); the opt-in guard below is the second line of defence.
  function decideRoute(caps: ClientCapabilities): LlmRoute {
    if (caps.iosFoundationModels) return "foundation_models";
    return "ollama";
  }

  async function routeDecision(intent: RouteIntent): Promise<LlmRouteDecision> {
    const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
    const labelHash = hashLabel(envelope.label);
    const route = decideRoute(intent.clientCapabilities);
    const callId = deps.generateCallId();
    // Intent row written BEFORE the call (ADR-0008).
    await record(intent.userId, { phase: "intent", callId, route, labelHash });

    // Categorisation prompt when a closed list is supplied (story 6-2); else
    // the raw envelope JSON. Composed by the sole NFR-12 site.
    const promptString = intent.categories?.length
      ? buildCategorisationPrompt(envelope, intent.categories)
      : JSON.stringify(envelope);

    let providerCall: LlmRouteDecision["providerCall"] = null;
    if (route === "ollama") {
      providerCall = () => deps.ollamaClient.complete(promptString);
    } else if (route === "third_party") {
      providerCall = async () => {
        // DR-7 — server-side opt-in gate before any third-party egress.
        await requireThirdPartyOptIn(deps.optInReader, intent.userId);
        return deps.thirdPartyClient.complete(promptString);
      };
    }
    // foundation_models → providerCall stays null (client-owned, attested).
    return { callId, route, labelHash, providerCall };
  }

  async function categoriseImpl(intent: RouteIntent): Promise<LlmCategorisation> {
    const categories = intent.categories ?? [];
    const decision = await routeDecision(intent);
    // foundation_models (null providerCall) → the server cannot run the call;
    // the iOS client owns it and attests separately (ADR-0008). Abstain with
    // NO outcome row (no server call happened).
    if (!decision.providerCall) {
      return { callId: decision.callId, route: decision.route, category: null, confidence: 0 };
    }
    try {
      const completion = await decision.providerCall();
      const parsed = parseCategorisation(completion.raw, categories);
      await record(intent.userId, {
        phase: "outcome",
        callId: decision.callId,
        route: decision.route,
        labelHash: decision.labelHash,
        latencyMs: completion.latencyMs,
        outcome: parsed.category ? "success" : "failure",
      });
      return {
        callId: decision.callId,
        route: decision.route,
        category: parsed.category,
        confidence: parsed.confidence,
      };
    } catch {
      // Provider unavailable / timeout / opt-in refused → record a failure
      // outcome (latency unknown → 0) and abstain. NEVER rethrow: a suggestion
      // is best-effort and must not fail the caller's create path.
      await record(intent.userId, {
        phase: "outcome",
        callId: decision.callId,
        route: decision.route,
        labelHash: decision.labelHash,
        latencyMs: 0,
        outcome: "failure",
      });
      return { callId: decision.callId, route: decision.route, category: null, confidence: 0 };
    }
  }

  return {
    route: routeDecision,
    categorise: categoriseImpl,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
}
```

Create `apps/api/src/modules/llm/llm-categorise.test.ts`:

```ts
// bun:test — llm.service.categorise (story 6-2, AC-1/AC-2/AC-3).
import { test, expect } from "bun:test";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import { createLlmService, type RouteIntent } from "./llm.service";

const CATS = ["courses", "transport", "sorties"] as const;

function makeService(opts: { raw?: string; throws?: boolean } = {}) {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const repository: LlmRepository = {
    recordCallEvent: async (userId, event) => {
      events.push({ userId, event });
    },
    recordCallEvents: async (userId, evs) => {
      for (const event of evs) events.push({ userId, event });
    },
    isThirdPartyOptedIn: async () => false,
    listRecentByUser: async () => [],
  };
  const ollamaClient: LlmProvider = {
    route: "ollama",
    complete: async () => {
      if (opts.throws) throw new Error("boom");
      return { raw: opts.raw ?? '{"category":"courses","confidence":0.88}', latencyMs: 12 };
    },
  };
  const thirdPartyClient: LlmProvider = {
    route: "third_party",
    complete: async () => ({ raw: "{}", latencyMs: 1 }),
  };
  let n = 0;
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => `call_${++n}`,
  });
  return { service, events };
}

const intent = (): RouteIntent => ({
  userId: "u1",
  clientCapabilities: { iosFoundationModels: false },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
  categories: CATS,
});

test("AC-1: ollama route returns {category, confidence} in [0,1]", async () => {
  const { service } = makeService();
  const out = await service.categorise(intent());
  expect(out.route).toBe("ollama");
  expect(out.category).toBe("courses");
  expect(out.confidence).toBeGreaterThanOrEqual(0);
  expect(out.confidence).toBeLessThanOrEqual(1);
});

test("AC-3: one intent + one outcome row for the same callId, no PII", async () => {
  const { service, events } = makeService();
  await service.categorise(intent());
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(events[0]!.event.callId).toBe(events[1]!.event.callId);
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("success");
  expect(JSON.stringify(events)).not.toContain("Carrefour");
});

test("AC-2: out-of-enum completion abstains + records a failure outcome", async () => {
  const { service, events } = makeService({ raw: '{"category":"crypto","confidence":0.99}' });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("failure");
});

test("AC-2: provider failure abstains without throwing + records failure", async () => {
  const { service, events } = makeService({ throws: true });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.confidence).toBe(0);
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("failure");
});

test("foundation_models abstains with no outcome row (client-owned)", async () => {
  const { service, events } = makeService();
  const out = await service.categorise({
    ...intent(),
    clientCapabilities: { iosFoundationModels: true },
  });
  expect(out.route).toBe("foundation_models");
  expect(out.category).toBeNull();
  expect(events.map((e) => e.event.phase)).toEqual(["intent"]);
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/llm/llm-categorise.test.ts apps/api/src/modules/llm/llm.service.test.ts`
Expected: all pass (5 new categorise tests + the 6 pre-existing 6-1 routing tests), `0 fail`, exit 0. (The 6-1 tests still pass: `route` is unchanged behaviourally — `labelHash` is additive and `categories` is optional.)
Commit: `git add apps/api/src/modules/llm/llm.service.ts apps/api/src/modules/llm/llm-categorise.test.ts && git commit -m "feat(#33): llm.service.categorise — server-route parse + outcome row (AC-1/2/3)"`

#### T6 — Prisma suggestion columns + index [AC: AC-4]

In `apps/api/prisma/schema/transactions.prisma`, add the four columns after the `providerTransactionId` line and the index after `transactions_user_provider_txid_idx`. The model becomes:

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
  // Story 6-2 (FR-32) — pending LLM suggestion. Null until the categoriser
  // runs; `category` stays 'autre' until the user confirms in 6-4 (FR-33).
  suggestedCategory     String?         @map("suggested_category")
  suggestedConfidence   Float?          @map("suggested_confidence")
  suggestedRoute        String?         @map("suggested_route")
  suggestedAt           DateTime?       @map("suggested_at") @db.Timestamptz
  createdAt             DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@index([userId, accountId, occurredOn(sort: Desc)], map: "transactions_user_account_date_idx")
  @@index([userId, transferPairId], map: "transactions_user_pair_idx")
  @@index([userId, provider, providerTransactionId], map: "transactions_user_provider_txid_idx")
  // Story 6-2 — 6-4 lists pending suggestions (userId + suggestedCategory != null).
  @@index([userId, suggestedCategory], map: "transactions_user_suggestion_idx")
  @@map("transactions")
}
```

Run: `bun --filter='@pekulo/api' run prisma:check && bun --filter='@pekulo/api' run prisma:generate`
Expected: `prisma format --check` clean, `prisma validate` → `The schema … is valid 🚀`, then `✔ Generated Prisma Client`, exit 0. (If `prisma format --check` reports drift, run `bun --filter='@pekulo/api' run prisma:format` and re-stage.)
Commit: `git add apps/api/prisma/schema/transactions.prisma && git commit -m "feat(#33): transaction suggestion columns + index (FR-32)"`

#### T7 — Hand-written migration [AC: AC-4, AC-7]

Create `apps/api/prisma/migrations/20260530140000_add_transaction_suggestion_columns/migration.sql`:

```sql
-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
-- against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-2: pending LLM suggestion columns on transactions (FR-32). `category`
-- stays 'autre' until the user confirms in 6-4 (FR-33).
-- No RLS change — the transactions table already carries its policy quartet
-- (story 5-1). Adding columns adds no table, so db:rls-audit counts are
-- unchanged (AC-7).

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_category" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_confidence" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_route" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "transactions_user_suggestion_idx"
  ON "transactions"("user_id", "suggested_category");
```

Run: `bun --filter='@pekulo/api' run prisma:migrate:deploy`
Expected: prisma logs `Applying migration 20260530140000_add_transaction_suggestion_columns`, then `1 migration applied`, exit 0.
Verify: `bun --filter='@pekulo/api' run db:rls-audit`
Expected: exit 0; every table's policy count UNCHANGED from before this story (no new table; `transactions` keeps its existing quartet). Also `bun --filter='@pekulo/api' run db:rls-migration-audit` → exit 0 (no new table needs RLS DDL).
Commit: `git add apps/api/prisma/migrations/20260530140000_add_transaction_suggestion_columns && git commit -m "feat(#33): migration — transaction suggestion columns + index"`

#### T8 — Suggestion fields on `transactionSchema` DTO [AC: AC-4]

In `packages/validators/src/transactions/transactions.schemas.ts`, replace the `transactionSchema` definition (the `z.object({...})` block ending at `createdAt: z.string(),`) with:

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
  // Story 6-2 (FR-32) — pending LLM suggestion. System-set; null until the
  // categoriser runs. `.optional()` keeps pre-6-2 fixtures valid; reads always
  // populate them (null or value). suggestedRoute mirrors the server route_actual
  // ('ollama' | 'third_party' | 'foundation_models'); kept as a plain string to
  // avoid coupling the transactions DTO to the LLM enum.
  suggestedCategory: transactionCategorySchema.nullable().optional(),
  suggestedConfidence: z.number().min(0).max(1).nullable().optional(),
  suggestedRoute: z.string().nullable().optional(),
  suggestedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;
```

Run: `bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/types' run typecheck`
Expected: `tsc` exits 0 for both.
Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(#33): suggestion fields on transaction DTO (FR-32)"`

#### T9 — `transactions.repository.saveSuggestion` + `TransactionRow`/`toDto` [AC: AC-4]

**(a)** In `apps/api/src/modules/transactions/transactions.repository.ts`, replace the `TransactionRow` type (lines 32-46) with the version below (adds 4 fields):

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
  suggestedCategory: string | null;
  suggestedConfidence: number | null;
  suggestedRoute: string | null;
  suggestedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
```

**(b)** Replace `toDto` (lines 114-128) with:

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

**(c)** Add `saveSuggestion` to the `TransactionsRepository` interface (after `unpairAfterDelete`, before the closing `}` on line 112):

```ts
  /**
   * Story 6-2 (FR-32) — persist the pending LLM suggestion. The ONLY writer of
   * the suggested_* columns. `category` is left untouched (stays 'autre' until
   * the user confirms in 6-4). The `category: "autre"` guard in the where makes
   * a late suggestion idempotent against a category the user set meanwhile.
   * Returns `{ saved }` — false when the row was deleted or already recategorised.
   */
  saveSuggestion(
    userId: string,
    txId: string,
    suggestion: { category: string; confidence: number; route: string },
  ): Promise<{ saved: boolean }>;
```

**(d)** Add the `saveSuggestion` implementation to the returned object (after `unpairAfterDelete`, before the final `};` that closes the returned literal):

```ts
    async saveSuggestion(userId, txId, suggestion) {
      const { count } = await deps.client.transaction.updateMany({
        where: { id: txId, userId, category: "autre" },
        data: {
          suggestedCategory: suggestion.category,
          suggestedConfidence: suggestion.confidence,
          suggestedRoute: suggestion.route,
          suggestedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { saved: count > 0 };
    },
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0. (`toDto` now satisfies the widened `Transaction` type; `saveSuggestion`'s Prisma `data` typechecks against the generated client from T6.)
Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts && git commit -m "feat(#33): repository saveSuggestion + suggestion mapping (FR-32)"`

#### T10 — `transactions.service` categoriser port + `suggestCategory` + wiring + test [AC: AC-4, AC-6]

**(a)** In `apps/api/src/modules/transactions/transactions.service.ts`, add `TRANSACTION_CATEGORIES` to the existing `@pekulo/validators` type-import block and import nothing else new. Replace the import block (lines 26-38) with:

```ts
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
import { TRANSACTION_CATEGORIES } from "@pekulo/validators";
```

**(b)** Add the `TransactionCategoriser` port + the suggestable-category constant immediately after the `ProviderTransactionImportRow` interface (after line 70):

```ts
/**
 * Story 6-2 (FR-32) — narrow categoriser port. The runtime wires this around
 * llmModule.service.categorise (bootstrap/runtime-dependencies.ts) so the
 * transactions module never imports LlmService directly (L1 — no cross-module
 * type leak, mirrors AccountOwnershipProbe). `category` is null when the model
 * abstained or the call failed; `route` is the server route_actual.
 */
export interface TransactionCategoriser {
  categorise(input: {
    userId: string;
    label: string;
    amountSigned: number;
    occurredOn: string;
    categories: readonly string[];
  }): Promise<{ category: string | null; confidence: number; route: string }>;
}

// Categories the LLM may suggest — the closed transaction enum minus the two
// system values: 'transfer' (rule-owned, story 5-3) and 'autre' (the fallback
// the suggestion would replace).
const SUGGESTABLE_CATEGORIES: readonly string[] = TRANSACTION_CATEGORIES.filter(
  (c) => c !== "transfer" && c !== "autre",
);
```

**(c)** Add `suggestCategory` to the `TransactionsService` interface (after the `categoriseAfterCreate` declaration, before `importFromProvider`):

```ts
  /**
   * Story 6-2 (FR-32) — produce + persist a pending LLM category suggestion for
   * a non-transfer, still-'autre' transaction. Awaitable (tests + callers);
   * createTransaction invokes it fire-and-forget off the hot path (NFR-1). No-op
   * when no categoriser is wired or the transaction is already categorised.
   */
  suggestCategory(userId: string, transaction: Transaction): Promise<void>;
```

**(d)** Add the free helper immediately after `categoriseAfterCreateImpl` (after line 134):

```ts
// Story 6-2 (FR-32) — best-effort LLM suggestion. Awaitable so tests drive it
// deterministically; createTransaction calls it fire-and-forget off the hot
// path (NFR-1). Persists only when the model returned a category with non-zero
// confidence; saveSuggestion is additionally guarded to stamp only 'autre' rows.
async function suggestCategoryImpl(args: {
  userId: string;
  transaction: Transaction;
  repository: TransactionsRepository;
  categoriser: TransactionCategoriser;
}): Promise<void> {
  const { userId, transaction, repository, categoriser } = args;
  if (transaction.category !== "autre") return;
  const amountSigned = transaction.type === "outflow" ? -transaction.amount : transaction.amount;
  const result = await categoriser.categorise({
    userId,
    label: transaction.label,
    amountSigned,
    occurredOn: transaction.occurredOn,
    categories: SUGGESTABLE_CATEGORIES,
  });
  if (!result.category || result.confidence <= 0) return;
  await repository.saveSuggestion(userId, transaction.id, {
    category: result.category,
    confidence: result.confidence,
    route: result.route,
  });
}
```

**(e)** Add the optional `categoriser` dep to the factory signature — replace the `createTransactionsService` signature (lines 136-140) with:

```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
}): TransactionsService {
```

**(f)** Replace the `createTransaction` method (lines 142-154) with the fire-and-forget version:

```ts
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound();
      const created = await deps.repository.create(userId, input);
      const categorised = await categoriseAfterCreateImpl({
        userId,
        candidate: created,
        repository: deps.repository,
      });
      // 6-2 (FR-32) — fire-and-forget LLM suggestion OFF the hot path (NFR-1):
      // the create response is never blocked by the ≤5 s Ollama call. Only when
      // the row is still 'autre' (not a detected transfer, no explicit category)
      // and a categoriser is wired. categoriseImpl records its own audit outcome
      // row, so the swallowed rejection here loses no durable signal.
      if (deps.categoriser && categorised.category === "autre") {
        const categoriser = deps.categoriser;
        void suggestCategoryImpl({
          userId,
          transaction: categorised,
          repository: deps.repository,
          categoriser,
        }).catch(() => {
          /* best-effort; the llm_call_log outcome row is the durable record */
        });
      }
      return categorised;
    },
```

**(g)** Add the `suggestCategory` public method to the returned object literal (alongside `categoriseAfterCreate`):

```ts
    async suggestCategory(userId, transaction) {
      if (!deps.categoriser) return;
      await suggestCategoryImpl({
        userId,
        transaction,
        repository: deps.repository,
        categoriser: deps.categoriser,
      });
    },
```

**(h)** Create `apps/api/src/modules/transactions/transactions-suggest.test.ts`:

```ts
// bun:test — LLM suggestion path (story 6-2, AC-4).
import { expect, mock, test } from "bun:test";
import type { Transaction } from "@pekulo/validators";
import type { TransactionsRepository } from "./transactions.repository";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type TransactionCategoriser,
} from "./transactions.service";

const autreTx: Transaction = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Carrefour",
  amount: 42.5,
  type: "outflow",
  category: "autre",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

const makeRepo = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => autreTx),
    findByIdForUser: mock(async () => autreTx),
    update: mock(async () => ({ outcome: "ok", transaction: autreTx })),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [autreTx], nextCursor: null })),
    bulkCreate: mock(async () => ({ persisted: 0, rows: [] })),
    bulkCreateFromProvider: mock(async () => ({ persisted: 0, raceSkipped: 0, rows: [] })),
    findExistingProviderTxIds: mock(async () => new Set<string>()),
    findTransferPairCandidates: mock(async () => []),
    pairAsTransfer: mock(async () => ({ paired: 2 })),
    unpairAfterDelete: mock(async () => undefined),
    saveSuggestion: mock(async () => ({ saved: true })),
    ...over,
  }) as unknown as TransactionsRepository;

const probe: AccountOwnershipProbe = {
  exists: mock(async () => true),
  existsMany: mock(async (_u: string, ids: string[]) => new Set(ids)),
};
const resolver: AccountResolver = { resolve: mock(async () => ({ id: null, matchCount: 0 })) };

test("AC-4: a confident suggestion is persisted; category stays 'autre'", async () => {
  const saveSuggestion = mock(async () => ({ saved: true }));
  const categoriser: TransactionCategoriser = {
    categorise: mock(async () => ({ category: "courses", confidence: 0.9, route: "ollama" })),
  };
  const service = createTransactionsService({
    repository: makeRepo({ saveSuggestion }),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser,
  });
  await service.suggestCategory("u1", autreTx);
  expect(saveSuggestion).toHaveBeenCalledTimes(1);
  expect(saveSuggestion.mock.calls[0]![2]).toMatchObject({ category: "courses", confidence: 0.9 });
});

test("AC-4: an abstention (null category) persists nothing", async () => {
  const saveSuggestion = mock(async () => ({ saved: true }));
  const categoriser: TransactionCategoriser = {
    categorise: mock(async () => ({ category: null, confidence: 0, route: "ollama" })),
  };
  const service = createTransactionsService({
    repository: makeRepo({ saveSuggestion }),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser,
  });
  await service.suggestCategory("u1", autreTx);
  expect(saveSuggestion).toHaveBeenCalledTimes(0);
});

test("AC-4: an explicit-category transaction is never suggested", async () => {
  const categorise = mock(async () => ({ category: "courses", confidence: 0.9, route: "ollama" }));
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser: { categorise },
  });
  await service.suggestCategory("u1", { ...autreTx, category: "loyer" });
  expect(categorise).toHaveBeenCalledTimes(0);
});

test("no categoriser wired → suggestCategory is a no-op (must not throw)", async () => {
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
  });
  await service.suggestCategory("u1", autreTx);
});
```

Run: `bun --filter='@pekulo/api' run test apps/api/src/modules/transactions/transactions-suggest.test.ts apps/api/src/modules/transactions/transactions.service.test.ts`
Expected: all pass (4 new suggestion tests + the pre-existing 5-x service tests — unchanged because `categoriser` is optional), `0 fail`, exit 0.
Commit: `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions-suggest.test.ts && git commit -m "feat(#33): TransactionCategoriser port + suggestCategory fire-and-forget (AC-4/AC-6)"`

#### T11 — `transactions.module` accepts the `categoriser` dep [AC: AC-4]

Replace the whole `apps/api/src/modules/transactions/transactions.module.ts` with:

```ts
// apps/api/src/modules/transactions/transactions.module.ts
// Composition root for the transactions module (story 5-1; story 6-2 adds the
// optional LLM categoriser). Mirrors realestate.module.ts shape —
// `createXxxModule(deps) → { service, router }`. The AccountOwnershipProbe +
// TransactionCategoriser deps are narrow cross-aggregate ports the runtime
// composition root wraps around accountsModule.service / llmModule.service —
// keeps L1 conformance (no repository / LlmService type leak across modules).

import type { PrismaService } from "../../database";
import { createTransactionsRepository } from "./transactions.repository";
import { createTransactionsRouter } from "./transactions.routes";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type TransactionCategoriser,
  type TransactionsService,
} from "./transactions.service";

export interface TransactionsModule {
  service: TransactionsService;
  router: ReturnType<typeof createTransactionsRouter>;
}

export function createTransactionsModule(deps: {
  prismaService: PrismaService;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
}): TransactionsModule {
  const repository = createTransactionsRepository({ client: deps.prismaService.client });
  const service = createTransactionsService({
    repository,
    accountOwnershipProbe: deps.accountOwnershipProbe,
    accountResolver: deps.accountResolver,
    categoriser: deps.categoriser,
  });
  const router = createTransactionsRouter({ service });
  return { service, router };
}
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/transactions/transactions.module.ts && git commit -m "feat(#33): transactions module accepts the categoriser dep"`

#### T12 — `runtime-dependencies` reorder + categoriser adapter [AC: AC-4, AC-6]

**(a)** Add the `TransactionCategoriser` type import. After the existing line `import { createTransactionsModule } from "../modules/transactions/transactions.module";` (line 16), add:

```ts
import type { TransactionCategoriser } from "../modules/transactions/transactions.service";
```

**(b)** **Delete** the existing `llmModule` block (lines 159-167 verbatim — the one beginning with `// Story 6-1 — LLM routing + audit module.`):

```ts
  // Story 6-1 — LLM routing + audit module. No oRPC router (no client-facing
  // procedure in 6-1); the only HTTP surface is the /internal/llm/attest
  // Elysia listener mounted in app.ts. The service is consumed server-side by
  // story 6-2's categorise pipeline (wired then).
  const llmModule = createLlmModule({
    prismaService,
    env: input.env,
    jwtVerifier,
  });
```

**(c)** Replace the existing `transactionsModule` block (lines 139-148 verbatim) with the version below — it first builds `llmModule`, then the narrow categoriser adapter, then `transactionsModule` with the `categoriser` dep:

```ts
  // Story 6-1 — LLM routing + audit module. No oRPC router (the only HTTP
  // surface is the /internal/llm/attest listener mounted in app.ts). Built
  // BEFORE transactionsModule (story 6-2) so the categorise pipeline can be
  // wired as a narrow port into transactions.
  const llmModule = createLlmModule({
    prismaService,
    env: input.env,
    jwtVerifier,
  });

  // Story 6-2 (FR-32) — narrow categoriser adapter wrapping llmModule.service.
  // The web tier never reports FoundationModels capability (iOS-only, V1.5), so
  // clientCapabilities is pinned to { iosFoundationModels: false } → Ollama. V1
  // transactions are EUR, so currency is pinned to "EUR".
  const transactionCategoriser: TransactionCategoriser = {
    categorise: async ({ userId, label, amountSigned, occurredOn, categories }) => {
      const result = await llmModule.service.categorise({
        userId,
        clientCapabilities: { iosFoundationModels: false },
        prompt: { label, amount: amountSigned, currency: "EUR", occurredOn },
        categories,
      });
      return { category: result.category, confidence: result.confidence, route: result.route };
    },
  };

  // Story 5-1 — transactions domain. The cross-aggregate accountId guard is
  // injected as a narrow AccountOwnershipProbe adapter wrapping
  // accountsModule.service.accountExists — keeps L1 conformance (no
  // AccountsRepository type leak across modules) and avoids a wiring cycle.
  // Story 5-2 extends with an AccountResolver adapter; story 6-2 with the
  // TransactionCategoriser adapter above.
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: {
      exists: (userId, accountId) => accountsModule.service.accountExists(userId, accountId),
      existsMany: (userId, accountIds) => accountsModule.service.accountsExist(userId, accountIds),
    },
    accountResolver: {
      resolve: (userId, label) => accountsModule.service.findAccountIdByLabel(userId, label),
    },
    categoriser: transactionCategoriser,
  });
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0 (`llmModule` is now declared before `transactionsModule` and before `bankAggregatorModule`; the `RuntimeDeps.llmModule` return field is unchanged).
Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#33): wire categorise pipeline into transactions create path"`

#### T13 — Full Iron-Law gate + push [AC: AC-7]

Run the full gate set from the repo root, in order:

```bash
bun --filter='@pekulo/api' run lint
bun --filter='@pekulo/types' run typecheck
bun --filter='@pekulo/validators' run typecheck
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/api' run prisma:check
bun --filter='@pekulo/api' run db:rls-audit
```

Expected:
- `lint` → 0 errors, exit 0.
- all three `typecheck` → `tsc` exits 0.
- `test` → all suites pass (the new `llm-categorisation-prompt`, `llm-categoriser`, `llm-categorise`, `transactions-suggest` suites + every pre-existing suite green), `0 fail`, exit 0.
- `prisma:check` → `The schema … is valid 🚀`, exit 0.
- `db:rls-audit` → exit 0 with **every table's policy count unchanged** from before this story (no new table; `transactions` keeps its quartet).

Then push:

```bash
git push -u origin feature/33-6-2-llm-categorise
```

Expected: branch pushed; no `Fixes #33` yet (that lands in the PR body opened by `aped-review`).
Commit: (no new commit — this task is the gate + push. If lint/format rewrote anything, `git add -A && git commit -m "chore(#33): lint/format sweep"` then re-push.)

## File List

**Created**

- `apps/api/src/modules/llm/llm-categoriser.ts` (+ `llm-categoriser.test.ts`)
- `apps/api/src/modules/llm/llm-categorisation-prompt.test.ts`
- `apps/api/src/modules/llm/llm-categorise.test.ts`
- `apps/api/prisma/migrations/20260530140000_add_transaction_suggestion_columns/migration.sql`
- `apps/api/src/modules/transactions/transactions-suggest.test.ts`

**Modified**

- `packages/types/src/llm/llm.types.ts`
- `apps/api/src/modules/llm/llm-prompt-builder.ts`
- `apps/api/src/modules/llm/llm-provider.ts`
- `apps/api/src/modules/llm/services/ollama-client.ts` (+ `ollama-client.test.ts`)
- `apps/api/src/modules/llm/services/third-party-client.ts` (+ `third-party-client.test.ts`)
- `apps/api/src/modules/llm/llm.service.ts`
- `apps/api/src/modules/llm/llm.attest-router.test.ts` (6-1 mock widened for the `labelHash` + `categorise` additions — see Deviations T5)
- `apps/api/prisma/schema/transactions.prisma`
- `packages/validators/src/transactions/transactions.schemas.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts` (+ `transactions.repository.test.ts` — `saveSuggestion` guard, added at aped-review)
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.module.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`

## Dev Agent Record

- **Model:** claude-opus-4-8 (1M context)
- **Started:** 2026-05-30
- **Completed:** 2026-05-30

### Summary

Shipped FR-32 end-to-end on the V1 (a) web tier: `llm.service.categorise()` routes to Ollama, parses the model's raw text into `{category, confidence}` against the closed category set, writes the paired intent+outcome audit rows (no prompt body, only a label digest), and `createTransaction` fires a best-effort suggestion off the hot path that persists `suggested_*` columns while the transaction's own `category` stays `"autre"`. Scope held exactly as locked at step 04 — no confirmation UI (6-4), no opt-in toggle (6-3), no third_party escalation (deferred). The `third_party` branch stays wired-but-dormant; the web client always selects Ollama.

### Files changed

- `packages/types/src/llm/llm.types.ts`
- `apps/api/src/modules/llm/llm-prompt-builder.ts`
- `apps/api/src/modules/llm/llm-categoriser.ts` (+ `llm-categoriser.test.ts`)
- `apps/api/src/modules/llm/llm-categorisation-prompt.test.ts`
- `apps/api/src/modules/llm/llm-provider.ts`
- `apps/api/src/modules/llm/services/ollama-client.ts` (+ `ollama-client.test.ts`)
- `apps/api/src/modules/llm/services/third-party-client.ts` (+ `third-party-client.test.ts`)
- `apps/api/src/modules/llm/llm.service.ts` (+ `llm-categorise.test.ts`)
- `apps/api/src/modules/llm/llm.attest-router.test.ts`
- `apps/api/prisma/schema/transactions.prisma`
- `apps/api/prisma/migrations/20260530140000_add_transaction_suggestion_columns/migration.sql`
- `packages/validators/src/transactions/transactions.schemas.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/transactions.service.ts` (+ `transactions-suggest.test.ts`)
- `apps/api/src/modules/transactions/transactions.module.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `docs/state.yaml`

### Deviations

- **T5 (in-scope compat fix).** Widening `LlmService` with the required `labelHash` (T1) and the new `categorise` method forced the pre-existing 6-1 `llm.attest-router.test.ts` `route`/service mock to add both — not in the original File List, but required for the "no regressions" typecheck gate.
- **T4/T10 (story test-code bugs).** The story's verbatim test snippets used `as typeof fetch` (clients) and `saveSuggestion.mock.calls[0]![2]` (suggest); both pass under `bun test` but fail `tsc` (`preconnect` missing on the fetch cast; empty-tuple index). Corrected to the working 6-1 pattern (`as unknown as typeof fetch`) and a `as unknown[]` index cast. Behaviour unchanged.
- **Run-command path.** Story per-task commands carry an `apps/api/` path prefix; bun's `--filter` runs from the package cwd, so tests were invoked with the package-relative path (`src/modules/...`). Same target files.
- Everything else held to plan.

### Test output

```
bun --filter='@pekulo/api' run test        → 693 pass, 0 fail, 82 files, exit 0
6-2 suites (prompt/parser/categorise/suggest) → 17 pass, 0 fail, exit 0
bun --filter='@pekulo/api' run lint        → 0 errors (11 pre-existing bank-aggregator warnings), exit 0
@pekulo/types | @pekulo/validators | @pekulo/api typecheck → exit 0
bun --filter='@pekulo/api' run prisma:check → schemas valid 🚀, exit 0
bun --filter='@pekulo/api' run db:rls-audit → exit 0; transactions (4 policies) unchanged, 19 tables, no new table
```
