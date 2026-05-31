# Story: 6-4-llm-suggestion-ui — Suggestion row + accept/override flow + AI transparency notice

**Epic:** Epic 6 — LLM auto-categorisation
**Status:** review
**Ticket:** [#35](https://github.com/yabafre/pekulo/issues/35)
**Branch:** feature/35-6-4-llm-suggestion-ui
**Covered FRs:** FR-33 (accept or override the suggested category before persistence; override persisted as final category)
**Binds:** DR-12 (AI transparency notice on first user-visible suggestion) · NFR-1 (dashboard p95 unaffected) · NFR-5 (suggestion latency — display only, no blocking) · NFR-22/23/24 (WCAG 2.2 AA, contrast, keyboard) · NFR-26 (audit, no prompt content, ≤ 90 days)
**Commit prefix:** `feat(#35): …` — the PR (after `aped-review`) carries `Fixes #35` in the body.

## User Story

**As a** Pekulo user, **I want** to confirm or correct the LLM-suggested category on each pending transaction in one gesture (with the confidence and route badge visible), and to be informed once that an AI produced the suggestion, **so that** I clear each imported transaction in under 30 seconds (PRD U3) while staying in control and transparently informed (DR-12).

> **Scope guard (locked at aped-story step 04):** this story ships FR-33 only — (1) a server **`confirmCategorisation`** write that sets the final category and clears the `suggested_*` columns, recording an **`outcome: "overridden"`** audit row when the final category differs from the suggestion; (2) a server **`listPendingSuggestions`** read backed by the `transactions_user_suggestion_idx` index 6-2 provisioned; (3) the **Suggestions IA** section on `/dashboard/transactions` wiring `PekuloSuggestionRow` (already built in 0-10) to the confirm/override flow; (4) a shared **`CategoryPicker`** DS component for the override; (5) a **minimal AI transparency notice** shown once, backed by a server `ai_notice_seen_at` flag. It does **NOT** ship: the full EU-AI-Act transparency-notice component or the opt-out→opt-in re-trigger (→ story **11-5**); the `ollama → third_party` escalation policy (deferred since 6-1); the LLM activity-log view (FR-36 → story **6-5**); any new `PekuloSuggestionRow` DS work (it already exists — this story consumes it).

## Acceptance Criteria

- **AC-1 (Accept persists the suggestion — FR-33)** — **Given** a transaction with a pending suggestion (`suggestedCategory != null` and `category === "autre"`), **When** I tap **✓ Confirmer**, **Then** the transaction's `category` is persisted as the suggested value, the four `suggested_*` columns are cleared, and the row leaves the "Suggestions IA" section (it now appears in "Récentes").
- **AC-2 (Override wins and is audited — FR-33 / NFR-26)** — **Given** a pending suggestion, **When** I tap **Modifier**, pick a different category, and save, **Then** the override is persisted as the final `category` (the suggestion is discarded), the `suggested_*` columns are cleared, **and** a single `llm_call_log` row is appended with `outcome: "overridden"` (route = the stored `suggestedRoute` / route_actual, **no prompt content**, `latencyMs: 0`). A plain accept (AC-1) records **no** new audit row.
- **AC-3 (AI transparency notice appears once — DR-12)** — **Given** my first-ever LLM-visible suggestion, **When** the Suggestions IA section renders at least one pending row, **Then** an AI transparency notice is shown exactly once; the "seen" state is persisted server-side (`llm_opt_in.ai_notice_seen_at`) so it never reappears on reload.
- **AC-4 (Route badge mirrors server truth — FR-31 / DR-12)** — **Given** a pending suggestion, **When** its row renders, **Then** the route badge (`iOS` / `Ollama` / `Cloud`) is derived from the server-stored `suggestedRoute` (route_actual), never from client intent; the badge is hidden below 640 px.
- **AC-5 (Empty state)** — **Given** no pending suggestions for the user, **When** the section renders, **Then** it shows the `Check`-icon `PekuloEmptyState` "Tout est catégorisé".
- **AC-6 (Authenticated, per-user, accessible)** — **Given** the new `confirmCategorisation` / `listPendingSuggestions` endpoints, **When** a request arrives without a valid session, **Then** it is rejected with 401 within the NFR-9 budget, and every query is scoped to the caller's own data (`where: { userId }`, ADR-0013). **And** the suggestion row's confirm/modify controls + the override `CategoryPicker` are keyboard-operable with visible focus and screen-reader exposed (`axe` clean, NFR-22/23/24).
- **AC-7 (Iron-Law gates)** — **Given** the branch, **When** the full gate set runs, **Then** all pass: lint → 0 ; typecheck (types + validators + contracts + api + web) → 0 ; `bun:test` (api) + `vitest` (web) → all pass ; `prisma:check` → valid ; `db:rls-audit` → exit 0 with **every table's policy count unchanged** (the one migration adds a *column* to `llm_opt_in`, not a table — the RLS quartet 6-1 shipped is untouched).

> **Architecture vs ticket reconciliation (recorded at step 03/04):** `architecture.md` (Group E FR map) and the epic-6 context cache framed the confirm as a pure transactions write that "emits NO new LLM log entry." **Ticket #35 AC-2 (source of truth) overrides this**: an override MUST record `outcome: "overridden"`. Implemented faithfully by extending the **TS** `LLM_OUTCOMES` enum (no Prisma migration — `llm_call_log.outcome` is already `String?`) and routing the write through the LLM module's single audit writer via a narrow injected port (single-writer invariant preserved, ADR-0008 / architecture L691).
>
> **Security note (lesson 2026-05-30 — narrow client-supplied enums on trusted writes):** `attestLlmCallSchema.outcome` stays narrowed to `["success","failure"]` so a client **cannot** forge an `"overridden"` row into the append-only audit — `"overridden"` is **server-written only**. Likewise `confirmCategorisationInputSchema.category` is narrowed to the **suggestable** subset (excludes `"transfer"` — rule-owned — and `"autre"` — the un-categorised state) rather than echoing the full `transactionCategorySchema`.

## Tasks

> Every task is self-contained — full code, the literal run command, expected output and the literal commit live under **Dev Notes → Task-by-task implementation code**. Run each on `feature/35-6-4-llm-suggestion-ui`. `apps/api` tests are `bun:test`; `apps/web` tests are `vitest`. Every workspace command uses the fully-qualified quoted name `bun --filter='@pekulo/<pkg>'` (NEVER `=api`, NEVER `--cwd`). `apps/web` runs a non-standard Next.js — read `node_modules/next/dist/docs/` before changing routing/RSC shapes (apps/web/AGENTS.md); the patterns below are copied from already-passing 6-3 code.

- [x] **T1** — Extend `LLM_OUTCOMES` (`@pekulo/types`) + validators mirror with `"overridden"`; narrow `attestLlmCallSchema.outcome` to the attestable subset; extend `llm-enum-iso.test.ts` [AC: AC-2]
- [x] **T2** — `confirmCategorisationInputSchema` + `listPendingSuggestionsOutputSchema` + exported `SUGGESTABLE_TRANSACTION_CATEGORIES` in `@pekulo/validators` [AC: AC-1, AC-2]
- [x] **T3** — `confirmCategorisation` + `listPendingSuggestions` procedures on `transactionsContract` [AC: AC-1, AC-2, AC-6]
- [x] **T4** — `transactions.repository.ts#confirmCategorisation` (+ `listPendingByUser`) [AC: AC-1, AC-2, AC-6]
- [x] **T5** — `transactions.service.ts#confirmCategorisation` (override→audit) + `listPendingSuggestions` + `LlmOverrideAuditPort` wired through `transactions.module.ts` [AC: AC-1, AC-2]
- [x] **T6** — `runtime-dependencies.ts` — build the `LlmOverrideAuditPort` adapter over `llmModule.service.recordLlmCall` + inject [AC: AC-2]
- [x] **T7** — `transactions.routes.ts` — mount `confirmCategorisation` + `listPendingSuggestions` handlers [AC: AC-1, AC-2, AC-6]
- [x] **T8** — Server tests: repository + service (override-audit) + integration (401 + typed error) [AC: AC-1, AC-2, AC-6]
- [x] **T9** — AI-notice server flag: `ai_notice_seen_at` migration + `llm.prisma` + `llm.repository`/`service`/`contract`/`routes` get/mark + validators `aiNoticeStateSchema` + test [AC: AC-3, AC-6]
- [x] **T10** — Web actions `confirmCategorisation` (OMIT `output:`) + `listPendingSuggestions` [AC: AC-1, AC-2]
- [x] **T11** — Web hooks `use-pending-suggestions.ts` + `use-confirm-categorisation.ts` (+ `transactionsKeys.pending()`) + hook test [AC: AC-1, AC-2]
- [x] **T12** — `@pekulo/ui` `CategoryPicker` (shared) + barrel export + a11y test [AC: AC-2, AC-6]
- [x] **T13** — `transactions-suggestions-section.tsx` — replace the stub (read → `PekuloSuggestionRow` → confirm/override dialog) [AC: AC-1, AC-2, AC-4, AC-5, AC-6]
- [x] **T14** — AI transparency notice: `_llm` actions/hook/component + `llmKeys.aiNotice()` + mount in the section [AC: AC-3]
- [x] **T15** — Web tests: section `.envelope` + `.a11y` + confirm-hook invalidation [AC: AC-1, AC-2, AC-3, AC-6]
- [x] **T16** — Visual verification (react-grab-mcp) + full Iron-Law gate + push [AC: AC-4, AC-7]

## Dev Notes

### Architecture & decisions

- **PRIMARY ADRs — 0008 (LLM audit authority), 0010 (Component → Hook → Server Action → oRPC → handler → service → repository), 0009 (oRPC + zapaction bridge), 0007 (Tamagui Core / `@pekulo/ui` only), 0013 (explicit `where:{userId}` is the sole apps/api isolation layer).**
- **Decisions locked at step 04 (this story):**
  - **Q1 — `confirmCategorisation` is one server procedure, the server decides accept-vs-override.** The client sends the final `category`; the service compares it to the row's stored `suggestedCategory` and appends the `"overridden"` audit row only when they differ. The client cannot lie about whether it overrode (the server owns the comparison). One procedure covers AC-1 + AC-2.
  - **Q2 — `outcome: "overridden"` extends the TS enum, NO Prisma migration.** `llm_call_log.outcome` is `String?` (see Step-0), so the DB already accepts any string. Only `@pekulo/types#LLM_OUTCOMES` + the validators mirror grow; the attest body schema is held narrow (security note above).
  - **Q3 — pending list is a dedicated server read** (`listPendingSuggestions`) backed by `transactions_user_suggestion_idx`, NOT a client filter over the full list. Explicit, index-backed, scales to (b).
  - **Q4 — DR-12 notice is minimal + server-flagged.** A `ai_notice_seen_at` column on the existing `llm_opt_in` row persists "seen once". The full EU-AI-Act notice + opt-out→opt-in re-trigger are story 11-5.
  - **Q5 — the override picker is a new shared `CategoryPicker` in `@pekulo/ui`** (presentation-only `{value,label}` options so the DS stays free of `@pekulo/validators`). The existing `transaction-edit-form.tsx` is NOT refactored in this story (future dedup).
- **Single-writer invariant (ADR-0008 / architecture L691):** the only `llmCallLog.create` site is `llm.repository.createCallEvent`. 6-4's override audit funnels through `llm.service.recordLlmCall` via a narrow `LlmOverrideAuditPort` injected into the transactions service — the transactions module never imports `LlmService`/`LlmRoute` (L1, mirrors the existing `TransactionCategoriser` port).
- **Best-effort audit ordering (AC-2):** the category change commits first (user-facing truth), then the override row is appended inside a `try/catch` that `console.warn`s on failure — a degraded audit DB never fails the user's confirm. The happy-path test asserts the port IS called with `outcome: "overridden"`.
- **Invalidation:** `useConfirmCategorisation` passes `invalidateWithTags: [transactionsTags.list()]` (lesson 2026-05-24 — the SA boundary strips `action.tags`). The existing registry edge maps `transactionsTags.list()` → the bare `[TRANSACTIONS_KEY]` prefix, which covers the new `transactionsKeys.pending()` query AND `transactionsKeys.list()` in one shot — so confirming refreshes both Suggestions IA and Récentes. No new registry edge for transactions.
- **Frontend discipline:** new Tamagui lives behind `"use client"` and is consumed only through `@pekulo/ui` (raw `Text`/`View` via `@pekulo/ui/client`). Loading branches gate on a hydration flag (R13). No `<Suspense>` around `useActionQuery` consumers. `$warning` amber (already shipped) is the only non-grayscale token on this surface; the Sparkles icon stays grayscale (`$colorSecondary`). `PekuloSelect.Trigger` already renders a `<button>` (a11y).

### Inherited from stories 6-1 / 6-2 / 6-3 (done) — do NOT re-create

- `@pekulo/types#{LlmRoute, LLM_ROUTES, LlmCallEvent, LlmCallOutcomeEvent}` ; `LlmService.recordLlmCall` (sole audit writer) + `getThirdPartyOptIn`/`setThirdPartyOptIn` ; `LlmRepository.setThirdPartyOptIn` (P2002-safe upsert — the template for the `ai_notice` upsert) ; `hashLabel(label)` + `generateBase62Id(n)` (`apps/api/src/database`).
- `@pekulo/ui#PekuloSuggestionRow` (`{ tx: Suggestion; onConfirm?; onEdit?; disabled? }`) + `PekuloSelect`/`PekuloDialog`/`PekuloEmptyState`/`Section`/`PekuloSkeleton`/`useToast`. `@pekulo/types#{Suggestion, LlmRouteBadge}`.
- Transaction DTO `suggested{Category,Confidence,Route,At}` (6-2) — already flows to the web tier via `listTransactions`. `transactions_user_suggestion_idx` (`@@index([userId, suggestedCategory])`) — provisioned by 6-2 for this read. `saveSuggestion` is the only `suggested_*` *writer*; 6-4 adds the inverse (`confirmCategorisation` clears them).
- Web `_llm/` feature folder (6-3): `_actions/llm-actions.ts`, `_hooks/use-llm-opt-in.ts`, `_components/llm-opt-in-toggle.tsx` + `llmClient` (`modules.ts`) + `llmKeys`/`llmTags` (`keys.ts`). 6-4 ADDS to these, does not replace.

### Lessons applied (filtered to this story)

- **2026-05-30 (narrow client enums on trusted writes)** — `attestLlmCallSchema.outcome` held to `["success","failure"]`; `confirmCategorisationInputSchema.category` held to the suggestable subset.
- **2026-05-24 (R12 invalidateWithTags / R13 hydration)** — `useConfirmCategorisation` passes `invalidateWithTags` explicitly; the section + the notice gate loading on a hydration flag.
- **2026-05-20 (envelope without `output:`)** — `confirmCategorisation` web action returns `{ ok:false; code }` on `TRANSACTION_NOT_FOUND` and therefore OMITS `output:`. The `listPendingSuggestions` read KEEPS `output:` (no typed error).
- **2026-05-20 (`vi.hoisted` + `fireEvent.submit`)** — web vitest mocks created via `vi.hoisted`; form submits via `fireEvent.submit` on the aria-labelled form.
- **2026-05-07 (`$accent` only on ± deltas)** — suggestion chrome/Sparkles/controls stay grayscale; only `$warning` (confidence < 75 %) is non-grayscale.
- **2026-05-27 (P2002 find-or-create)** — `markAiNoticeSeen` upsert catches `P2002` and re-reads (mirrors `setThirdPartyOptIn`).
- **2026-05-19 / 2026-05-07 (`bun --filter='@pekulo/api'`, `bun:test` ≠ vitest)** — every command below uses the quoted workspace name; api tests import from `"bun:test"`.

### File decision template (3-bullet per created/modified file)

- **`packages/types/src/llm/llm.types.ts`** *(MODIFY)* — add `"overridden"` to `LLM_OUTCOMES`. Single responsibility: LLM domain literal unions.
- **`packages/validators/src/llm/llm.schemas.ts`** *(MODIFY)* — grow `LLM_OUTCOMES_MIRROR`; add `attestableOutcomeSchema` and use it on `attestLlmCallSchema.outcome`; add `aiNoticeStateSchema`. Single responsibility: LLM wire schemas.
- **`packages/validators/src/transactions/transactions.schemas.ts`** *(MODIFY)* — add `SUGGESTABLE_TRANSACTION_CATEGORIES` + `suggestableTransactionCategorySchema` + `confirmCategorisationInputSchema` + `listPendingSuggestionsOutputSchema`. Single responsibility: transactions wire schemas.
- **`packages/contracts/src/transactions/transactions.contract.ts`** *(MODIFY)* — add the two procedures. Single responsibility: transactions oRPC surface.
- **`apps/api/src/modules/transactions/transactions.repository.ts`** *(MODIFY)* — add `confirmCategorisation` (set category + null `suggested_*`) + `listPendingByUser`. Single responsibility: transactions Prisma persistence.
- **`apps/api/src/modules/transactions/transactions.service.ts`** *(MODIFY)* — add `LlmOverrideAuditPort` dep + `confirmCategorisation` + `listPendingSuggestions`. Single responsibility: transactions business logic.
- **`apps/api/src/modules/transactions/transactions.module.ts`** *(MODIFY)* — thread the optional `llmAudit` dep. Single responsibility: transactions composition root.
- **`apps/api/src/modules/transactions/transactions.routes.ts`** *(MODIFY)* — bind the two new procedures. Single responsibility: transactions contract↔service binding.
- **`apps/api/src/bootstrap/runtime-dependencies.ts`** *(MODIFY)* — build + inject the `LlmOverrideAuditPort` adapter. Single responsibility: runtime wiring.
- **`apps/api/prisma/schema/llm.prisma`** + **`apps/api/prisma/migrations/20260531000000_add_llm_opt_in_ai_notice_seen/migration.sql`** *(MODIFY / NEW)* — add `ai_notice_seen_at`. Single responsibility: LLM persistence schema.
- **`apps/api/src/modules/llm/llm.repository.ts` / `llm.service.ts` / `llm.routes.ts`** *(MODIFY)* + **`packages/contracts/src/llm/llm.contract.ts`** *(MODIFY)* — `getAiNotice` / `markAiNotice`. Single responsibility per layer.
- **`apps/api/src/modules/llm/llm-enum-iso.test.ts`**, **`.../transactions.repository.test.ts`**, **`.../transactions.service.test.ts`**, **`.../transactions.integration.test.ts`**, **`.../llm-ai-notice.test.ts`** *(MODIFY / NEW)* — behaviour tests.
- **`apps/web/.../transactions/_actions/transactions-actions.ts`** *(MODIFY)* — `confirmCategorisation` + `listPendingSuggestions` actions.
- **`apps/web/.../transactions/_hooks/use-pending-suggestions.ts` + `use-confirm-categorisation.ts` (+ `.test.tsx`)** *(NEW)* — read + mutation hooks.
- **`apps/web/.../transactions/_components/transactions-suggestions-section.tsx`** *(MODIFY)* + **`.a11y.test.tsx` / `.envelope.test.tsx`** *(NEW)* — the Suggestions IA surface.
- **`packages/ui/src/components/CategoryPicker/{CategoryPicker.tsx,index.ts}` + `CategoryPicker.a11y.test.tsx`** *(NEW)* + **`packages/ui/src/components/index.ts`** *(MODIFY)* — shared category select.
- **`apps/web/.../dashboard/_llm/_actions/llm-actions.ts` / `_hooks/use-ai-notice.ts` / `_components/ai-transparency-notice.tsx`** *(MODIFY / NEW)* + **`apps/web/src/lib/zapaction/keys.ts`** *(MODIFY)* — `aiNotice` key/tag + notice surface.

### Existing code at write time (Step-0 verbatim — caught against the live repo, not memory)

**`packages/types/src/llm/llm.types.ts:12-13`** (T1 grows this tuple):

```ts
export const LLM_OUTCOMES = ["success", "failure"] as const;
export type LlmOutcome = (typeof LLM_OUTCOMES)[number];
```

**`packages/validators/src/llm/llm.schemas.ts:15-19` + `:69-75`** (T1 grows the mirror + narrows the attest outcome):

```ts
const LLM_ROUTES_MIRROR = ["foundation_models", "ollama", "third_party"] as const;
const LLM_OUTCOMES_MIRROR = ["success", "failure"] as const;

export const llmRouteSchema = z.enum(LLM_ROUTES_MIRROR);
export const llmOutcomeSchema = z.enum(LLM_OUTCOMES_MIRROR);
// …
export const attestLlmCallSchema = z.object({
  callId: z.string().min(1).max(64),
  route: z.literal("foundation_models"),
  latencyMs: z.number().int().nonnegative().max(120_000),
  outcome: llmOutcomeSchema,
  labelHash: z.string().min(1).max(128),
});
```

**`apps/api/prisma/schema/llm.prisma:19` + `:28-36`** — `outcome` is `String?` (no Prisma enum → no outcome migration); `LlmOptIn` is where T9's column lands:

```prisma
  outcome    String?
// …
model LlmOptIn {
  id         String   @id
  userId     String   @unique @map("user_id") @db.Uuid
  thirdParty Boolean  @default(false) @map("third_party")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("llm_opt_in")
}
```

**`packages/contracts/src/transactions/transactions.contract.ts:39-71`** — T3 inserts two procedures into this literal (the `transactionNotFoundError` constant already exists above it):

```ts
export const transactionsContractV1 = {
  createTransaction: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(createTransactionInputSchema)
    .output(transactionSchema),
  updateTransaction: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError, ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(updateTransactionInputSchema)
    .output(transactionSchema),
  // … deleteTransaction, getTransaction, listTransactions, previewImportCsv, importCsv …
} as const;
```

**`apps/api/src/modules/transactions/transactions.repository.ts:52` + `:435-447`** — `UpdateOutcome` is reused by T4; `saveSuggestion` is the only `suggested_*` writer (T4 adds the inverse):

```ts
export type UpdateOutcome = { outcome: "ok"; transaction: Transaction } | { outcome: "not-found" };
// …
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

**`apps/api/src/modules/transactions/transactions.service.ts:196-201` + `:231-239`** — factory deps (T5 adds `llmAudit?`); `updateTransaction` is the iso for the not-found throw:

```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
}): TransactionsService {
  return {
    // …
    async updateTransaction(userId, input) {
      if (input.accountId !== undefined) {
        const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
        if (!owns) throw accountNotFound();
      }
      const outcome = await deps.repository.update(userId, input);
      if (outcome.outcome === "not-found") throw transactionNotFound(input.id);
      return outcome.transaction;
    },
```

**`apps/api/src/bootstrap/runtime-dependencies.ts:144-176`** — the `transactionCategoriser` adapter is the exact template for T6's `llmOverrideAudit` adapter; `transactionsModule` is built here:

```ts
  const transactionCategoriser: TransactionCategoriser = {
    categorise: async ({ userId, label, amountSigned, occurredOn, categories }) => {
      const result = await llmModule.service.categorise({ /* … */ });
      return { category: result.category, confidence: result.confidence, route: result.route };
    },
  };
  const transactionsModule = createTransactionsModule({
    prismaService,
    accountOwnershipProbe: { /* … */ },
    accountResolver: { /* … */ },
    categoriser: transactionCategoriser,
  });
```

**`apps/web/.../transactions/_components/transactions-suggestions-section.tsx` (whole file — T13 replaces it):**

```tsx
"use client";
import { Text, View } from "@pekulo/ui/client";
import { PekuloEmptyState, Section } from "@pekulo/ui";
import { Bot, Check } from "lucide-react";

export function TransactionsSuggestionsSection() {
  const pendingCount = 0; // wired by 6-4
  return (
    <Section ariaLabel="Suggestions IA" title="Suggestions IA" action={/* Bot + "{n} à valider" */ null}>
      <PekuloEmptyState icon={Check} title="Tout est catégorisé" message="…" />
    </Section>
  );
}
```

**`apps/web/.../transactions/_actions/transactions-actions.ts:83-106`** — `updateTransaction` is the exact iso for T10's `confirmCategorisation` (OMIT `output:`, catch `ORPCError`):

```ts
export const updateTransaction = defineAction<UpdateTransactionInput, UpdateTransactionResult, ActionContext>({
  name: "updateTransaction",
  input: updateTransactionInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const updated = await transactionsClient.updateTransaction(input);
      return { ok: true as const, transaction: updated };
    } catch (err) {
      if (err instanceof ORPCError && (err.code === "TRANSACTION_NOT_FOUND" || err.code === "ACCOUNT_NOT_FOUND")) {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
```

**`packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.tsx:58-65`** (consumed read-only by T13) + **`apps/web/src/lib/zapaction/keys.ts:88-99,195-196`** (T11 adds `pending`):

```ts
export interface PekuloSuggestionRowProps { tx: Suggestion; onConfirm?: () => void; onEdit?: () => void; disabled?: boolean; }
// keys.ts:
export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
  list: (limit?: number) => ["list", limit ?? 50] as const,
  byId: (id: string) => ["byId", id] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, { list: () => ["list"] as const });
//  [transactionsTags.list()]: [[TRANSACTIONS_KEY], accountsKeys.list(), [MONTHLY_KEY]],  ← bare prefix covers pending
```

**`apps/web/.../dashboard/_llm/_actions/llm-actions.ts`** already exports `getLlmOptIn`/`setLlmOptIn` (6-3) — T14 appends `getAiNotice`/`markAiNotice` in the same file. **New files** (`use-pending-suggestions.ts`, `use-confirm-categorisation.ts`, `CategoryPicker.tsx`, `ai-transparency-notice.tsx`, `use-ai-notice.ts`, all `*.test.*` listed): **Existing code: none — new files.**

### Task-by-task implementation code

#### T1 — Extend `LLM_OUTCOMES` + narrow the attest outcome [AC: AC-2]

In `packages/types/src/llm/llm.types.ts`, replace the `LLM_OUTCOMES` line (keep `LlmOutcome` as-is):

```ts
// `overridden` is SERVER-WRITTEN only (story 6-4, FR-33 / AC-2): the user
// overrode an LLM suggestion. Never client-attestable — the attest body schema
// is held narrow (lesson 2026-05-30). success/failure are call outcomes (6-1/6-2).
export const LLM_OUTCOMES = ["success", "failure", "overridden"] as const;
```

In `packages/validators/src/llm/llm.schemas.ts`, grow the mirror (line 16) and add the attestable subset, then point the attest body at it:

```ts
const LLM_OUTCOMES_MIRROR = ["success", "failure", "overridden"] as const;
// Outcomes a CLIENT may attest over /internal/llm/attest. `overridden` is
// server-written only (story 6-4) — keeping the attest body narrow stops a
// client forging a phantom override into the append-only audit (lesson
// 2026-05-30; ADR-0008 audit integrity). Do NOT widen to llmOutcomeSchema.
const ATTESTABLE_OUTCOMES = ["success", "failure"] as const;
export const attestableOutcomeSchema = z.enum(ATTESTABLE_OUTCOMES);
```

Change `attestLlmCallSchema`'s `outcome` line from `outcome: llmOutcomeSchema,` to:

```ts
  outcome: attestableOutcomeSchema,
```

(`llmOutcomeSchema = z.enum(LLM_OUTCOMES_MIRROR)` stays as the full server-side mirror, kept iso with `@pekulo/types#LLM_OUTCOMES` by the test below.)

Replace the body of `apps/api/src/modules/llm/llm-enum-iso.test.ts` after the imports with (add `attestLlmCallSchema` to the validators import):

```ts
import { test, expect } from "bun:test";
import { LLM_ROUTES, LLM_OUTCOMES } from "@pekulo/types";
import { llmRouteSchema, llmOutcomeSchema, attestLlmCallSchema } from "@pekulo/validators";

test("llmRouteSchema is iso with @pekulo/types#LLM_ROUTES", () => {
  expect([...llmRouteSchema.options]).toEqual([...LLM_ROUTES]);
});

test("llmOutcomeSchema is iso with @pekulo/types#LLM_OUTCOMES", () => {
  expect([...llmOutcomeSchema.options]).toEqual([...LLM_OUTCOMES]);
});

test("attest body rejects the server-only `overridden` outcome (2026-05-30 narrowing)", () => {
  const base = { callId: "c1", route: "foundation_models" as const, latencyMs: 10, labelHash: "abcd1234" };
  expect(attestLlmCallSchema.safeParse({ ...base, outcome: "success" }).success).toBe(true);
  expect(attestLlmCallSchema.safeParse({ ...base, outcome: "failure" }).success).toBe(true);
  expect(attestLlmCallSchema.safeParse({ ...base, outcome: "overridden" }).success).toBe(false);
});
```

Run: `bun --filter='@pekulo/types' run typecheck && bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/api' run test src/modules/llm/llm-enum-iso.test.ts`
Expected: both `tsc` exit 0; `3 pass` (route iso, outcome iso, attest-narrowing).
Commit: `git add packages/types/src/llm/llm.types.ts packages/validators/src/llm/llm.schemas.ts apps/api/src/modules/llm/llm-enum-iso.test.ts && git commit -m "feat(#35): LLM_OUTCOMES += overridden (server-only); attest body narrowed"`

#### T2 — Transactions validators: suggestable subset + confirm/list schemas [AC: AC-1, AC-2]

Append to `packages/validators/src/transactions/transactions.schemas.ts` (after `listTransactionsOutputSchema`/`transactionsOkSchema`, before the CSV section):

```ts
// ─── Suggestion confirm / override (story 6-4, FR-33) ────────────────────────
// The user-facing categories a confirm/override may set: the closed enum minus
// the two system values 'transfer' (rule-owned, 5-3) and 'autre' (the
// un-categorised state being replaced). NARROWED per the 2026-05-30 lesson —
// confirmCategorisation is a trusted write, so its input accepts only the
// legitimate subset, never the full transactionCategorySchema.
export const SUGGESTABLE_TRANSACTION_CATEGORIES = [
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
] as const;
// Compile-time guard: every suggestable value is a real TransactionCategory.
const _suggestableSubsetCheck: readonly TransactionCategory[] = SUGGESTABLE_TRANSACTION_CATEGORIES;
void _suggestableSubsetCheck;

export const suggestableTransactionCategorySchema = z.enum(SUGGESTABLE_TRANSACTION_CATEGORIES);
export type SuggestableTransactionCategory = z.infer<typeof suggestableTransactionCategorySchema>;

export const confirmCategorisationInputSchema = z.object({
  id: z.string().regex(TRANSACTION_ID_REGEX, "id invalide"),
  category: suggestableTransactionCategorySchema,
});
export type ConfirmCategorisationInput = z.infer<typeof confirmCategorisationInputSchema>;

export const listPendingSuggestionsOutputSchema = z.object({
  items: z.array(transactionSchema),
});
export type ListPendingSuggestionsOutput = z.infer<typeof listPendingSuggestionsOutputSchema>;
```

Run: `bun --filter='@pekulo/validators' run typecheck`
Expected: `tsc` exits 0 (the subset guard compiles → every suggestable value is a `TransactionCategory`).
Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(#35): confirmCategorisation + listPendingSuggestions schemas + suggestable subset"`

#### T3 — Contract procedures [AC: AC-1, AC-2, AC-6]

In `packages/contracts/src/transactions/transactions.contract.ts`, add the two schemas to the existing `@pekulo/validators` import block:

```ts
  confirmCategorisationInputSchema,
  listPendingSuggestionsOutputSchema,
```

Then add both procedures inside `transactionsContractV1` (after `importCsv`, before the closing `} as const;`):

```ts
  // Story 6-4 (FR-33) — set the final category + clear the pending suggestion.
  confirmCategorisation: oc
    .errors({ TRANSACTION_NOT_FOUND: transactionNotFoundError })
    .input(confirmCategorisationInputSchema)
    .output(transactionSchema),
  // Story 6-4 — list the user's transactions awaiting suggestion confirmation
  // (category === 'autre' AND suggestedCategory != null). No input.
  listPendingSuggestions: oc.output(listPendingSuggestionsOutputSchema),
```

Run: `bun --filter='@pekulo/contracts' run typecheck`
Expected: `tsc` exits 0. (`packages/contracts/src/index.ts` re-exports `transactionsContract` already — no barrel edit.)
Commit: `git add packages/contracts/src/transactions/transactions.contract.ts && git commit -m "feat(#35): transactions contract — confirmCategorisation + listPendingSuggestions"`

#### T4 — Repository: `confirmCategorisation` + `listPendingByUser` [AC: AC-1, AC-2, AC-6]

In `apps/api/src/modules/transactions/transactions.repository.ts`, add to the `TransactionsRepository` interface (after `saveSuggestion`):

```ts
  /**
   * Story 6-4 (FR-33) — set the FINAL category and clear all four suggested_*
   * columns in one statement, scoped where { id, userId }. The inverse of
   * saveSuggestion. Returns UpdateOutcome ("not-found" when the row is gone /
   * not the caller's).
   */
  confirmCategorisation(userId: string, id: string, finalCategory: string): Promise<UpdateOutcome>;
  /**
   * Story 6-4 — the pending-suggestion list: rows still 'autre' that carry a
   * suggestion. Backed by transactions_user_suggestion_idx (userId,
   * suggestedCategory). Newest suggestion first.
   */
  listPendingByUser(userId: string): Promise<Transaction[]>;
```

Add the two implementations inside the returned object literal (right after `saveSuggestion`):

```ts
    async confirmCategorisation(userId, id, finalCategory) {
      const result = await deps.client.transaction.updateMany({
        where: { id, userId },
        data: {
          category: finalCategory,
          suggestedCategory: null,
          suggestedConfidence: null,
          suggestedRoute: null,
          suggestedAt: null,
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return { outcome: "not-found" };
      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow;
      return { outcome: "ok", transaction: toDto(row) };
    },

    async listPendingByUser(userId) {
      const rows = (await deps.client.transaction.findMany({
        where: { userId, category: "autre", suggestedCategory: { not: null } },
        orderBy: [{ suggestedAt: "desc" }, { id: "desc" }],
      })) as TransactionRow[];
      return rows.map(toDto);
    },
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts && git commit -m "feat(#35): repository confirmCategorisation + listPendingByUser"`

#### T5 — Service: `confirmCategorisation` (override→audit) + `listPendingSuggestions` + audit port [AC: AC-1, AC-2]

In `apps/api/src/modules/transactions/transactions.service.ts`, add the port interface (after the `TransactionCategoriser` interface, near line 88):

```ts
/**
 * Story 6-4 (FR-33 / AC-2) — narrow override-audit port. The runtime wraps this
 * around llmModule.service.recordLlmCall so the transactions module never
 * imports LlmService / LlmRoute (L1 — mirrors TransactionCategoriser). Appends
 * a single `outcome: "overridden"` row to the append-only llm_call_log. NEVER
 * prompt content — only the route_actual + a label hash.
 */
export interface LlmOverrideAuditPort {
  recordOverride(input: { userId: string; route: string; label: string }): Promise<void>;
}
```

Add both methods to the `TransactionsService` interface (after `suggestCategory`):

```ts
  /**
   * Story 6-4 (FR-33) — set the final category, clear the suggestion. When the
   * final category differs from the row's suggestedCategory it is an OVERRIDE:
   * a best-effort `outcome: "overridden"` audit row is appended (AC-2). Throws
   * TRANSACTION_NOT_FOUND when the row is gone / not the caller's.
   */
  confirmCategorisation(userId: string, input: ConfirmCategorisationInput): Promise<Transaction>;
  /** Story 6-4 — list the caller's pending-suggestion transactions. */
  listPendingSuggestions(userId: string): Promise<ListPendingSuggestionsOutput>;
```

Add `ConfirmCategorisationInput`, `ListPendingSuggestionsOutput` to the `@pekulo/validators` type import block at the top of the file. Add `llmAudit?` to the factory deps:

```ts
export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
  llmAudit?: LlmOverrideAuditPort;
}): TransactionsService {
```

Add the two methods to the returned object literal (after `suggestCategory`):

```ts
    async confirmCategorisation(userId, input) {
      // Read BEFORE the write: confirm clears suggested_*, so the route_actual +
      // suggestedCategory needed to detect an override and stamp the audit row
      // must be captured first.
      const before = await deps.repository.findByIdForUser(userId, input.id);
      if (!before) throw transactionNotFound(input.id);
      const outcome = await deps.repository.confirmCategorisation(userId, input.id, input.category);
      if (outcome.outcome === "not-found") throw transactionNotFound(input.id);
      // AC-2 — an OVERRIDE is a final category different from the machine's
      // suggestion. Append `outcome: "overridden"` (best-effort; the category
      // change already committed and is the user-facing truth). Skipped on a
      // plain accept (final === suggested) and when there was no suggestion.
      const isOverride =
        before.suggestedCategory !== null &&
        before.suggestedCategory !== undefined &&
        input.category !== before.suggestedCategory;
      if (isOverride && before.suggestedRoute && deps.llmAudit) {
        try {
          await deps.llmAudit.recordOverride({
            userId,
            route: before.suggestedRoute,
            label: before.label,
          });
        } catch (err) {
          console.warn(
            `[6-4] override audit write failed for tx ${input.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      return outcome.transaction;
    },

    async listPendingSuggestions(userId) {
      return { items: await deps.repository.listPendingByUser(userId) };
    },
```

Then in `apps/api/src/modules/transactions/transactions.module.ts`, thread the optional dep. Import the type and add it to the factory deps + the service construction:

```ts
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type LlmOverrideAuditPort,
  type TransactionCategoriser,
  type TransactionsService,
} from "./transactions.service";
```

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

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions.module.ts && git commit -m "feat(#35): service confirmCategorisation (override→audit) + listPendingSuggestions"`

#### T6 — Runtime: build + inject the override-audit adapter [AC: AC-2]

In `apps/api/src/bootstrap/runtime-dependencies.ts`, add the imports (next to the existing `TransactionCategoriser` import):

```ts
import type { LlmOverrideAuditPort } from "../modules/transactions/transactions.service";
import { hashLabel } from "../modules/llm/llm-prompt-builder";
import { generateBase62Id } from "../database";
import type { LlmRoute } from "@pekulo/types";
```

Add the adapter right after the `transactionCategoriser` const (before `createTransactionsModule`):

```ts
  // Story 6-4 (FR-33 / AC-2) — narrow override-audit adapter over the LLM
  // module's SOLE llm_call_log writer (recordLlmCall; ADR-0008 / architecture
  // L691). Keeps transactions free of LlmService/LlmRoute (L1, mirrors the
  // categoriser port). `route` is the route_actual stored on the suggestion;
  // hashLabel gives the NFR-26 de-dup digest (NEVER the prompt body). The
  // recordLlmCall route guard backs the `as LlmRoute` cast.
  const llmOverrideAudit: LlmOverrideAuditPort = {
    recordOverride: ({ userId, route, label }) =>
      llmModule.service.recordLlmCall(userId, {
        phase: "outcome",
        callId: generateBase62Id(21),
        route: route as LlmRoute,
        labelHash: hashLabel(label),
        latencyMs: 0,
        outcome: "overridden",
      }),
  };
```

Add `llmAudit: llmOverrideAudit,` to the `createTransactionsModule({ … })` call (after `categoriser: transactionCategoriser,`).

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#35): wire LLM override-audit port into transactions module"`

#### T7 — Routes: mount the two handlers [AC: AC-1, AC-2, AC-6]

In `apps/api/src/modules/transactions/transactions.routes.ts`, add both handlers inside `impl.router({ … })` (after `importCsv`):

```ts
    confirmCategorisation: impl.confirmCategorisation.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.confirmCategorisation(context.userId, input);
      } catch (err) {
        if (err instanceof PekuloError && err.code === "TRANSACTION_NOT_FOUND") {
          throw errors.TRANSACTION_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    listPendingSuggestions: impl.listPendingSuggestions.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.listPendingSuggestions(context.userId);
    }),
```

Run: `bun --filter='@pekulo/api' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add apps/api/src/modules/transactions/transactions.routes.ts && git commit -m "feat(#35): mount confirmCategorisation + listPendingSuggestions handlers"`

#### T8 — Server tests [AC: AC-1, AC-2, AC-6]

Append to `apps/api/src/modules/transactions/transactions.repository.test.ts` a suite that drives a fake Prisma client (mirror the existing `saveSuggestion` test fake shape, which asserts on `updateMany` args):

```ts
import { describe, expect, test, mock } from "bun:test";
import { createTransactionsRepository } from "./transactions.repository";

describe("confirmCategorisation (6-4)", () => {
  test("sets final category + nulls suggested_* under where {id,userId}", async () => {
    const updateMany = mock(async () => ({ count: 1 }));
    const findFirst = mock(async () => ({
      id: "tx_aaaaaaaaaaaaaaaaaaaaa", userId: "u1", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
      occurredOn: new Date("2026-05-01"), label: "Carrefour", amount: 0, type: "outflow",
      category: "courses", isImprevu: false, notes: null, transferPairId: null,
      suggestedCategory: null, suggestedConfidence: null, suggestedRoute: null, suggestedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }));
    const client = { transaction: { updateMany, findFirst } } as never;
    const repo = createTransactionsRepository({ client });
    const out = await repo.confirmCategorisation("u1", "tx_aaaaaaaaaaaaaaaaaaaaa", "courses");
    expect(out.outcome).toBe("ok");
    const [arg] = updateMany.mock.calls[0] as [{ where: unknown; data: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ id: "tx_aaaaaaaaaaaaaaaaaaaaa", userId: "u1" });
    expect(arg.data).toMatchObject({
      category: "courses", suggestedCategory: null, suggestedConfidence: null,
      suggestedRoute: null, suggestedAt: null,
    });
  });

  test("returns not-found when no row matches", async () => {
    const client = { transaction: { updateMany: mock(async () => ({ count: 0 })), findFirst: mock() } } as never;
    const repo = createTransactionsRepository({ client });
    const out = await repo.confirmCategorisation("u1", "tx_aaaaaaaaaaaaaaaaaaaaa", "courses");
    expect(out.outcome).toBe("not-found");
  });

  test("listPendingByUser filters category=autre AND suggestedCategory!=null", async () => {
    const findMany = mock(async () => []);
    const client = { transaction: { findMany } } as never;
    const repo = createTransactionsRepository({ client });
    await repo.listPendingByUser("u1");
    const [arg] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ userId: "u1", category: "autre", suggestedCategory: { not: null } });
  });
});
```

Append to `apps/api/src/modules/transactions/transactions.service.test.ts` (reuse the file's existing fake-repository + service factory helpers; the snippet below builds a minimal fake inline if none is shared):

```ts
import { describe, expect, test, mock } from "bun:test";
import { createTransactionsService, type LlmOverrideAuditPort } from "./transactions.service";

const txRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "tx_aaaaaaaaaaaaaaaaaaaaa", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", occurredOn: "2026-05-01",
  label: "Carrefour", amount: 42, type: "outflow", category: "autre", isImprevu: false, notes: null,
  transferPairId: null, suggestedCategory: "courses", suggestedConfidence: 0.9, suggestedRoute: "ollama",
  suggestedAt: "2026-05-01T00:00:00.000Z", createdAt: "2026-05-01T00:00:00.000Z", ...over,
});

function makeService(opts: { before: ReturnType<typeof txRow> | null; audit?: LlmOverrideAuditPort }) {
  const repository = {
    findByIdForUser: mock(async () => opts.before),
    confirmCategorisation: mock(async (_u: string, _id: string, finalCategory: string) => ({
      outcome: "ok" as const, transaction: txRow({ category: finalCategory, suggestedCategory: null, suggestedRoute: null }),
    })),
  } as never;
  return createTransactionsService({
    repository,
    accountOwnershipProbe: { exists: mock(), existsMany: mock() } as never,
    accountResolver: { resolve: mock() } as never,
    llmAudit: opts.audit,
  });
}

describe("confirmCategorisation (6-4)", () => {
  test("AC-1 accept (final === suggested) → NO override audit row", async () => {
    const recordOverride = mock(async () => {});
    const svc = makeService({ before: txRow({ suggestedCategory: "courses" }), audit: { recordOverride } });
    await svc.confirmCategorisation("u1", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "courses" });
    expect(recordOverride).not.toHaveBeenCalled();
  });

  test("AC-2 override (final !== suggested) → records outcome overridden with route_actual", async () => {
    const recordOverride = mock(async () => {});
    const svc = makeService({ before: txRow({ suggestedCategory: "courses", suggestedRoute: "ollama" }), audit: { recordOverride } });
    await svc.confirmCategorisation("u1", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "transport" });
    expect(recordOverride).toHaveBeenCalledTimes(1);
    expect(recordOverride.mock.calls[0][0]).toMatchObject({ userId: "u1", route: "ollama", label: "Carrefour" });
  });

  test("not-found → throws TRANSACTION_NOT_FOUND", async () => {
    const svc = makeService({ before: null });
    await expect(
      svc.confirmCategorisation("u1", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "transport" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });
});
```

Add a route-boundary case to `apps/api/src/modules/transactions/transactions.integration.test.ts` (mirror 6-3's `llm.integration.test.ts`: build the module router, mount via the test oRPC harness, assert 401 with no/invalid JWT and a per-user `confirmCategorisation` round-trip mapping `TRANSACTION_NOT_FOUND` → defined error). Follow the exact harness already used in that file for the existing transactions procedures.

Run: `bun --filter='@pekulo/api' run test src/modules/transactions/transactions.repository.test.ts src/modules/transactions/transactions.service.test.ts src/modules/transactions/transactions.integration.test.ts`
Expected: all three suites pass (incl. the 3 confirm AC cases + repository where-clause assertions + integration 401/typed-error). Exit 0.
Commit: `git add apps/api/src/modules/transactions/transactions.repository.test.ts apps/api/src/modules/transactions/transactions.service.test.ts apps/api/src/modules/transactions/transactions.integration.test.ts && git commit -m "test(#35): confirmCategorisation repo/service/integration (AC-1/2/6)"`

#### T9 — AI-notice server flag [AC: AC-3, AC-6]

**(a)** Create the migration `apps/api/prisma/migrations/20260531000000_add_llm_opt_in_ai_notice_seen/migration.sql`:

```sql
-- Story 6-4 (FR-33 / DR-12 / AC-3) — per-user "AI transparency notice seen"
-- timestamp on the existing llm_opt_in row (one row per user). NULL = never
-- shown. No RLS change: a column add on a table whose policy quartet already
-- shipped (story 6-1) — db:rls-audit policy counts stay unchanged.
ALTER TABLE "llm_opt_in" ADD COLUMN IF NOT EXISTS "ai_notice_seen_at" TIMESTAMPTZ;
```

**(b)** In `apps/api/prisma/schema/llm.prisma`, add the field to `LlmOptIn` (after `thirdParty`):

```prisma
  aiNoticeSeenAt DateTime? @map("ai_notice_seen_at") @db.Timestamptz
```

**(c)** In `packages/validators/src/llm/llm.schemas.ts`, append:

```ts
// Story 6-4 (DR-12 / AC-3) — AI transparency notice "seen" state.
export const aiNoticeStateSchema = z.object({ seen: z.boolean() });
export type AiNoticeState = z.infer<typeof aiNoticeStateSchema>;
```

**(d)** In `apps/api/src/modules/llm/llm.repository.ts`, add to the `LlmRepository` interface (after `setThirdPartyOptIn`):

```ts
  /** Story 6-4 (DR-12) — has the user seen the AI transparency notice? */
  getAiNoticeSeen(userId: string): Promise<boolean>;
  /** Story 6-4 (DR-12) — stamp ai_notice_seen_at = now (P2002-safe upsert). */
  markAiNoticeSeen(userId: string): Promise<void>;
```

And the implementations (after `setThirdPartyOptIn`, inside the returned object):

```ts
    async getAiNoticeSeen(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { aiNoticeSeenAt: true },
      });
      return row?.aiNoticeSeenAt != null;
    },
    async markAiNoticeSeen(userId) {
      const now = new Date();
      try {
        await db.llmOptIn.upsert({
          where: { userId },
          create: { userId, aiNoticeSeenAt: now } as unknown as Parameters<
            typeof db.llmOptIn.upsert
          >[0]["create"],
          update: { aiNoticeSeenAt: now },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          await db.llmOptIn.update({ where: { userId }, data: { aiNoticeSeenAt: now } });
          return;
        }
        throw err;
      }
    },
```

**(e)** In `apps/api/src/modules/llm/llm.service.ts`, add to the `LlmService` interface (after `setThirdPartyOptIn`):

```ts
  getAiNoticeSeen(userId: string): Promise<boolean>;
  markAiNoticeSeen(userId: string): Promise<void>;
```

Add the free functions before `return { … }`:

```ts
  async function getAiNotice(userId: string): Promise<boolean> {
    return deps.repository.getAiNoticeSeen(userId);
  }
  async function markAiNotice(userId: string): Promise<void> {
    return deps.repository.markAiNoticeSeen(userId);
  }
```

And expose them in the return literal:

```ts
    getAiNoticeSeen: getAiNotice,
    markAiNoticeSeen: markAiNotice,
```

**(f)** In `packages/contracts/src/llm/llm.contract.ts`, import `aiNoticeStateSchema` from `@pekulo/validators` and add to `llmContractV1`:

```ts
  getAiNotice: oc.output(aiNoticeStateSchema),
  markAiNotice: oc.output(aiNoticeStateSchema),
```

**(g)** In `apps/api/src/modules/llm/llm.routes.ts`, add both handlers inside `impl.router({ … })`:

```ts
    getAiNotice: impl.getAiNotice.handler(async ({ context }) => {
      requireUserId(context.userId);
      return { seen: await deps.service.getAiNoticeSeen(context.userId) };
    }),
    markAiNotice: impl.markAiNotice.handler(async ({ context }) => {
      requireUserId(context.userId);
      await deps.service.markAiNoticeSeen(context.userId);
      return { seen: true };
    }),
```

**(h)** Create `apps/api/src/modules/llm/llm-ai-notice.test.ts` (fake Prisma, mirror `llm-opt-in.test.ts`):

```ts
import { describe, expect, test, mock } from "bun:test";
import { createLlmRepository } from "./llm.repository";

describe("ai-notice flag (6-4)", () => {
  test("getAiNoticeSeen → false when no row / null timestamp", async () => {
    const findUnique = mock(async () => null);
    const repo = createLlmRepository({ prismaService: { client: { llmOptIn: { findUnique } } } } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);
  });

  test("getAiNoticeSeen → true when ai_notice_seen_at is set", async () => {
    const findUnique = mock(async () => ({ aiNoticeSeenAt: new Date() }));
    const repo = createLlmRepository({ prismaService: { client: { llmOptIn: { findUnique } } } } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  test("markAiNoticeSeen upserts with ai_notice_seen_at", async () => {
    const upsert = mock(async () => ({}));
    const repo = createLlmRepository({ prismaService: { client: { llmOptIn: { upsert } } } } as never);
    await repo.markAiNoticeSeen("u1");
    const [arg] = upsert.mock.calls[0] as [{ where: unknown; update: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ userId: "u1" });
    expect(arg.update.aiNoticeSeenAt).toBeInstanceOf(Date);
  });
});
```

Run: `bun --filter='@pekulo/validators' run typecheck && bun --filter='@pekulo/contracts' run typecheck && bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run prisma:check && bun --filter='@pekulo/api' run test src/modules/llm/llm-ai-notice.test.ts`
Expected: all `tsc` exit 0; `prisma format --check` clean + `prisma validate` → `valid 🚀`; `3 pass`.
Commit: `git add apps/api/prisma/schema/llm.prisma apps/api/prisma/migrations/20260531000000_add_llm_opt_in_ai_notice_seen apps/api/src/modules/llm/llm.repository.ts apps/api/src/modules/llm/llm.service.ts apps/api/src/modules/llm/llm.routes.ts packages/contracts/src/llm/llm.contract.ts packages/validators/src/llm/llm.schemas.ts apps/api/src/modules/llm/llm-ai-notice.test.ts && git commit -m "feat(#35): ai_notice_seen_at flag + get/mark (DR-12)"`

#### T10 — Web actions: `confirmCategorisation` + `listPendingSuggestions` [AC: AC-1, AC-2]

In `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts`, add to the `@pekulo/validators` import block: `confirmCategorisationInputSchema`, `listPendingSuggestionsOutputSchema`, `type ConfirmCategorisationInput`, `type ListPendingSuggestionsOutput`. Add the result type next to the others:

```ts
export type ConfirmCategorisationResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; code: "TRANSACTION_NOT_FOUND"; message: string };
```

Add both actions (after `updateTransaction`):

```ts
// Story 6-4 (FR-33) — OMIT `output:` (discriminated-union envelope, lesson
// 2026-05-20). tags drive Next revalidate; React Query invalidation comes via
// the hook's invalidateWithTags (R12).
export const confirmCategorisation = defineAction<
  ConfirmCategorisationInput,
  ConfirmCategorisationResult,
  ActionContext
>({
  name: "confirmCategorisation",
  input: confirmCategorisationInputSchema,
  tags: [transactionsTags.list()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      const transaction = await transactionsClient.confirmCategorisation(input);
      return { ok: true as const, transaction };
    } catch (err) {
      if (err instanceof ORPCError && err.code === "TRANSACTION_NOT_FOUND") {
        return { ok: false as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});

// Read — keeps `output:` (no typed error to surface).
export const listPendingSuggestions = defineAction<
  void,
  ListPendingSuggestionsOutput,
  ActionContext
>({
  name: "listPendingSuggestions",
  input: z.void(),
  output: listPendingSuggestionsOutputSchema,
  handler: async () => {
    await ensureRequestContext();
    return transactionsClient.listPendingSuggestions();
  },
});
```

Delete the trailing `void z;` line at the bottom — `z` is now genuinely used (`z.void()`).

Run: `bun --filter='@pekulo/web' run typecheck`
Expected: `tsc` exits 0 (`transactionsClient` exposes the two new procedures via `ContractRouterClient<typeof transactionsContract>` automatically).
Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts" && git commit -m "feat(#35): web confirmCategorisation + listPendingSuggestions actions"`

#### T11 — Web hooks + `transactionsKeys.pending()` [AC: AC-1, AC-2]

**(a)** In `apps/web/src/lib/zapaction/keys.ts`, add `pending` to `transactionsKeys` (after `byId`):

```ts
  pending: () => ["pending"] as const,
```

(No registry edge needed — `transactionsTags.list()` already invalidates the bare `[TRANSACTIONS_KEY]` prefix, which covers `pending`.)

**(b)** Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-pending-suggestions.ts`:

```ts
"use client";

import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listPendingSuggestions } from "../_actions/transactions-actions";

export function usePendingSuggestions() {
  return useActionQuery(listPendingSuggestions, {
    input: undefined,
    queryKey: transactionsKeys.pending(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
```

**(c)** Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.ts`:

```ts
"use client";

import { useActionMutation } from "@zapaction/query";
import { transactionsTags } from "@/lib/zapaction/keys";
import { confirmCategorisation } from "../_actions/transactions-actions";

// invalidateWithTags explicit — the SA boundary strips action.tags (lessons.md
// 2026-05-24). transactionsTags.list() → bare [TRANSACTIONS_KEY] prefix →
// refreshes BOTH the pending list AND Récentes in one shot.
export function useConfirmCategorisation() {
  return useActionMutation(confirmCategorisation, {
    invalidateWithTags: [transactionsTags.list()],
  });
}
```

**(d)** Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.test.tsx` (mirror 6-3's `use-llm-opt-in.test.tsx`):

```tsx
import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { transactionsKeys, transactionsTags } from "@/lib/zapaction/keys";

const confirmMock = vi.fn();
vi.mock("../_actions/transactions-actions", () => ({
  confirmCategorisation: Object.assign((input: unknown) => confirmMock(input), {
    tags: [transactionsTags.list()],
  }),
}));

import { useConfirmCategorisation } from "./use-confirm-categorisation";

describe("useConfirmCategorisation (AC-1/AC-2)", () => {
  test("success → invalidates the transactions read graph", async () => {
    confirmMock.mockReset().mockResolvedValueOnce({ ok: true, transaction: { id: "tx_x" } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConfirmCategorisation(), { wrapper });
    result.current.mutate({ id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "courses" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [transactionsKeys.pending()[0] ? "pending" : "list"] });
  });
});
```

> Note: the exact `invalidateQueries` argument depends on the tag-registry expansion; assert on the call happening + the registry edge as 6-3's test does. If the registry resolves to multiple keys, assert `invalidateSpy` was called (the registry SSOT is unit-tested separately).

Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_hooks/use-confirm-categorisation.test.tsx`
Expected: `tsc` exits 0; `1 passed`. (If the shell mangles the parens, run the full suite: `bun --filter='@pekulo/web' run test`.)
Commit: `git add "apps/web/src/lib/zapaction/keys.ts" "apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-pending-suggestions.ts" "apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.ts" "apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.test.tsx" && git commit -m "feat(#35): web pending + confirm hooks (+ transactionsKeys.pending)"`

#### T12 — Shared `CategoryPicker` (`@pekulo/ui`) [AC: AC-2, AC-6]

**(a)** Create `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`:

```tsx
"use client";

import { PekuloSelect } from "../../primitives";

export interface CategoryOption {
  value: string;
  label: string;
}

export interface CategoryPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<CategoryOption>;
  id?: string;
  placeholder?: string;
}

// Story 6-4 — shared category select. Presentation-only: takes {value,label}
// options so @pekulo/ui stays free of @pekulo/validators (the consumer builds
// the options from TRANSACTION_CATEGORY_LABELS). Composes PekuloSelect, whose
// Trigger already renders a <button> (a11y, lesson 2026-05-06). Reused by 6-4's
// override flow and future batch-categorisation surfaces.
export function CategoryPicker({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Catégorie",
}: CategoryPickerProps) {
  return (
    <PekuloSelect value={value} onValueChange={onValueChange}>
      <PekuloSelect.Trigger id={id}>
        <PekuloSelect.Value placeholder={placeholder} />
      </PekuloSelect.Trigger>
      <PekuloSelect.Content>
        <PekuloSelect.Group>
          {options.map((opt, i) => (
            <PekuloSelect.Item key={opt.value} value={opt.value} index={i}>
              {opt.label}
            </PekuloSelect.Item>
          ))}
        </PekuloSelect.Group>
      </PekuloSelect.Content>
    </PekuloSelect>
  );
}
```

**(b)** Create `packages/ui/src/components/CategoryPicker/index.ts`:

```ts
export * from "./CategoryPicker";
```

**(c)** In `packages/ui/src/components/index.ts`, add the export (keep the file's ordering — add near the top, before the `Pekulo*` block):

```ts
export * from "./CategoryPicker";
```

**(d)** Create `packages/ui/src/components/CategoryPicker/CategoryPicker.a11y.test.tsx` (mirror an existing `*.a11y.test.tsx` in `packages/ui`; runs axe and asserts no violations + the trigger is a button):

```tsx
import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CategoryPicker } from "./CategoryPicker";

describe("CategoryPicker a11y (AC-6)", () => {
  test("no axe violations; trigger is a button", async () => {
    const { container, getByRole } = render(
      <CategoryPicker
        value="courses"
        onValueChange={() => {}}
        id="cat"
        options={[
          { value: "courses", label: "Courses" },
          { value: "transport", label: "Transport" },
        ]}
      />,
    );
    expect(getByRole("button")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

> Match the exact axe import + matcher already used by sibling `packages/ui` a11y tests (`vitest-axe` vs `jest-axe`) — check one existing `*.a11y.test.tsx` and copy its harness verbatim.

Run: `bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test:axe`
Expected: `tsc` exits 0; axe suite passes (0 violations).
Commit: `git add packages/ui/src/components/CategoryPicker packages/ui/src/components/index.ts && git commit -m "feat(#35): shared CategoryPicker DS component"`

#### T13 — `transactions-suggestions-section.tsx` — replace the stub [AC: AC-1, AC-2, AC-4, AC-5, AC-6]

Replace the WHOLE file `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx` with:

```tsx
"use client";

// Suggestions IA — story 6-4 (FR-33). Mirrors ux-preview TransactionsScreen
// (App.tsx L1333-1357): a Section listing pending PekuloSuggestionRow rows with
// Confirmer / Modifier. Confirm sends the suggested category; Modifier opens a
// CategoryPicker dialog and sends the chosen one. The server decides accept vs
// override. Hydration-guarded (R13); no <Suspense> (loading via isLoading).

import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import {
  CategoryPicker,
  PekuloDialog,
  PekuloEmptyState,
  PekuloSkeleton,
  PekuloSubmitButton,
  Section,
  PekuloSuggestionRow,
  useToast,
} from "@pekulo/ui";
import { Bot, Check } from "lucide-react";
import {
  SUGGESTABLE_TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
  type ConfirmCategorisationInput,
  type Transaction,
} from "@pekulo/validators";
import type { LlmRouteBadge, Suggestion } from "@pekulo/types";
import { useAccounts } from "../../_accounts/_hooks/use-accounts";
import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";
import { useConfirmCategorisation } from "../_hooks/use-confirm-categorisation";
import { AiTransparencyNotice } from "../../_llm/_components/ai-transparency-notice";

const ROUTE_BADGE: Record<string, LlmRouteBadge> = {
  foundation_models: "ios",
  ollama: "ollama",
  third_party: "cloud",
};

const OVERRIDE_OPTIONS = SUGGESTABLE_TRANSACTION_CATEGORIES.map((c) => ({
  value: c,
  label: TRANSACTION_CATEGORY_LABELS[c],
}));

// YYYY-MM-DD → "01 mai", pinned to UTC so the day never shifts by timezone.
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function TransactionsSuggestionsSection() {
  const { data, isLoading, error } = usePendingSuggestions();
  const { data: accounts } = useAccounts();
  const confirm = useConfirmCategorisation();
  const toast = useToast();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const showLoading = !isHydrated || isLoading;

  const [overrideTx, setOverrideTx] = useState<Transaction | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string>("courses");

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts ?? []).forEach((a) => map.set(a.id, a.label));
    return map;
  }, [accounts]);

  const items = data?.items ?? [];

  const runConfirm = (id: string, category: string) => {
    confirm.mutate(
      { id, category } as ConfirmCategorisationInput,
      {
        onSuccess: (result) => {
          if (!result.ok) toast.error("Échec", result.message);
        },
      },
    );
  };

  const openOverride = (tx: Transaction) => {
    setOverrideCategory(tx.suggestedCategory ?? "courses");
    setOverrideTx(tx);
  };
  const closeOverride = () => setOverrideTx(null);

  return (
    <Section
      ariaLabel="Suggestions IA"
      title="Suggestions IA"
      action={
        <View flexDirection="row" alignItems="center" gap="$2">
          <Bot size={12} strokeWidth={2} aria-hidden />
          <Text color="$colorTertiary" fontSize="$caption">
            {items.length} à valider
          </Text>
        </View>
      }
    >
      {showLoading && (
        <View role="status" aria-live="polite">
          <Text position="absolute" width={1} height={1} overflow="hidden" color="$colorTertiary" fontSize="$caption">
            Chargement…
          </Text>
          <PekuloSkeleton lines={2} height={56} />
        </View>
      )}
      {error && !showLoading && (
        <Text color="$danger" fontSize="$caption" role="alert">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && items.length === 0 && (
        <PekuloEmptyState
          icon={Check}
          title="Tout est catégorisé"
          message="Vos nouvelles transactions apparaîtront ici dès qu'elles seront importées."
        />
      )}
      {!showLoading && items.length > 0 && (
        <>
          <AiTransparencyNotice />
          <View flexDirection="column" role="list" aria-label="Suggestions à confirmer">
            {items.map((tx) => {
              const suggestion: Suggestion = {
                label: tx.label,
                account: accountLabelById.get(tx.accountId) ?? "—",
                dateLabel: formatDay(tx.occurredOn),
                direction: tx.type === "inflow" ? "in" : "out",
                amountEur: tx.amount,
                suggestedCategory: tx.suggestedCategory
                  ? TRANSACTION_CATEGORY_LABELS[tx.suggestedCategory]
                  : "—",
                confidence: tx.suggestedConfidence ?? 0,
                route: ROUTE_BADGE[tx.suggestedRoute ?? "ollama"] ?? "ollama",
              };
              return (
                <View key={tx.id} role="listitem">
                  <PekuloSuggestionRow
                    tx={suggestion}
                    disabled={confirm.isPending}
                    onConfirm={() => tx.suggestedCategory && runConfirm(tx.id, tx.suggestedCategory)}
                    onEdit={() => openOverride(tx)}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}

      {overrideTx && (
        <PekuloDialog open={overrideTx !== null} onOpenChange={(o) => !o && closeOverride()}>
          <PekuloDialog.Portal>
            <PekuloDialog.Overlay />
            <PekuloDialog.Content>
              <View flexDirection="column" gap="$3">
                <PekuloDialog.Title>Corriger la catégorie de « {overrideTx.label} »</PekuloDialog.Title>
                <CategoryPicker
                  id="suggestion-override-category"
                  value={overrideCategory}
                  onValueChange={setOverrideCategory}
                  options={OVERRIDE_OPTIONS}
                />
                <form
                  aria-label="Corriger la catégorie"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runConfirm(overrideTx.id, overrideCategory);
                    closeOverride();
                  }}
                >
                  <PekuloSubmitButton loading={confirm.isPending} loadingLabel="Enregistrement…">
                    Enregistrer la catégorie
                  </PekuloSubmitButton>
                </form>
                <PekuloDialog.Close asChild>
                  <View render="button" paddingVertical="$2" cursor="pointer" backgroundColor="transparent" borderWidth={0} alignItems="center">
                    <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                      Annuler
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </View>
            </PekuloDialog.Content>
          </PekuloDialog.Portal>
        </PekuloDialog>
      )}
    </Section>
  );
}
```

Run: `bun --filter='@pekulo/web' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx" && git commit -m "feat(#35): wire Suggestions IA section — confirm/override (FR-33)"`

#### T14 — AI transparency notice [AC: AC-3]

**(a)** In `apps/web/src/lib/zapaction/keys.ts`, extend the 6-3 `llmKeys`/`llmTags` with `aiNotice` and add the registry edge. The `llm` block is near the `optIn` definitions:

```ts
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});
```

In `setTagRegistry({ … })`, alongside the existing `llm` edges:

```ts
  [llmTags.aiNotice()]: [llmKeys.aiNotice()],
```

**(b)** In `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`, add to the `@pekulo/validators` import (`aiNoticeStateSchema`, `type AiNoticeState`), import `llmTags` is already imported, and append:

```ts
export const getAiNotice = defineAction<void, AiNoticeState, ActionContext>({
  name: "getAiNotice",
  input: z.void(),
  output: aiNoticeStateSchema,
  handler: async () => {
    await ensureRequestContext();
    return llmClient.getAiNotice();
  },
});

export const markAiNotice = defineAction<void, AiNoticeState, ActionContext>({
  name: "markAiNotice",
  input: z.void(),
  output: aiNoticeStateSchema,
  tags: [llmTags.aiNotice()],
  handler: async () => {
    await ensureRequestContext();
    return llmClient.markAiNotice();
  },
});
```

**(c)** Create `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-ai-notice.ts`:

```ts
"use client";

import { useActionMutation, useActionQuery } from "@zapaction/query";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";
import { getAiNotice, markAiNotice } from "../_actions/llm-actions";

export function useAiNotice() {
  return useActionQuery(getAiNotice, {
    input: undefined,
    queryKey: llmKeys.aiNotice(),
    readPolicy: "read-only",
    staleTime: 60_000,
  });
}

export function useMarkAiNotice() {
  return useActionMutation(markAiNotice, { invalidateWithTags: [llmTags.aiNotice()] });
}
```

**(d)** Create `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Text, View } from "@pekulo/ui/client";
import { Sparkles } from "lucide-react";
import { useAiNotice, useMarkAiNotice } from "../_hooks/use-ai-notice";

// Story 6-4 (DR-12 / AC-3) — minimal AI transparency notice. Shown ONCE: when
// the user has a pending suggestion AND the server flag ai_notice_seen_at is
// null. Marking it seen persists server-side so it never re-appears (survives
// reloads + devices). The full EU-AI-Act notice + the opt-out→opt-in re-trigger
// are owned by story 11-5. The parent only mounts this when items.length > 0.
export function AiTransparencyNotice() {
  const { data, isLoading } = useAiNotice();
  const markSeen = useMarkAiNotice();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  // Default to seen until the read resolves → no flash for returning users.
  const seen = data?.seen ?? true;
  const shouldShow = isHydrated && !isLoading && !seen;

  useEffect(() => {
    if (shouldShow && !markSeen.isPending) markSeen.mutate(undefined);
    // Mark on first appearance so AC-3 "appears once" holds across reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;
  return (
    <View
      role="note"
      aria-label="Information sur l'intelligence artificielle"
      flexDirection="row"
      gap="$2"
      alignItems="flex-start"
      padding="$3"
      marginBottom="$2"
      borderRadius="$4"
      backgroundColor="$backgroundMuted"
    >
      <Sparkles size={14} color="var(--colorSecondary)" aria-hidden />
      <Text color="$colorSecondary" fontSize="$xs">
        Les catégories ci-dessous sont suggérées par un modèle d'IA. Vous gardez le
        dernier mot : confirmez ou corrigez chaque suggestion. Aucune donnée n'est
        envoyée à un modèle tiers sans votre accord (Paramètres → Intelligence artificielle).
      </Text>
    </View>
  );
}
```

Run: `bun --filter='@pekulo/web' run typecheck`
Expected: `tsc` exits 0.
Commit: `git add "apps/web/src/lib/zapaction/keys.ts" "apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts" "apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-ai-notice.ts" "apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx" && git commit -m "feat(#35): AI transparency notice — minimal, server-flagged (DR-12)"`

#### T15 — Web tests: section `.envelope` + `.a11y` [AC: AC-1, AC-2, AC-3, AC-6]

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.envelope.test.tsx` (mirror `transactions-recent-section.envelope.test.tsx`; mocks created via `vi.hoisted`, form submit via `fireEvent.submit`):

```tsx
import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { confirmMock, pendingMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  pendingMock: vi.fn(),
}));
vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => pendingMock(),
}));
vi.mock("../_hooks/use-confirm-categorisation", () => ({
  useConfirmCategorisation: () => ({ mutate: confirmMock, isPending: false }),
}));
vi.mock("../../_accounts/_hooks/use-accounts", () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock("../../_llm/_components/ai-transparency-notice", () => ({ AiTransparencyNotice: () => null }));

import { TransactionsSuggestionsSection } from "./transactions-suggestions-section";

const pendingTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", occurredOn: "2026-05-01",
  label: "Carrefour", amount: 42, type: "outflow", category: "autre", isImprevu: false, notes: null,
  transferPairId: null, suggestedCategory: "courses", suggestedConfidence: 0.9, suggestedRoute: "ollama",
  suggestedAt: "2026-05-01T00:00:00.000Z", createdAt: "2026-05-01T00:00:00.000Z",
};
const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

describe("TransactionsSuggestionsSection (6-4)", () => {
  test("AC-5 empty → 'Tout est catégorisé'", () => {
    pendingMock.mockReturnValue({ data: { items: [] }, isLoading: false, error: null });
    render(wrap(<TransactionsSuggestionsSection />));
    expect(screen.getByText("Tout est catégorisé")).toBeTruthy();
  });

  test("AC-1 confirm → mutate({ id, category: suggested })", () => {
    pendingMock.mockReturnValue({ data: { items: [pendingTx] }, isLoading: false, error: null });
    render(wrap(<TransactionsSuggestionsSection />));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la catégorie" }));
    expect(confirmMock).toHaveBeenCalledWith(
      { id: pendingTx.id, category: "courses" },
      expect.anything(),
    );
  });

  test("AC-2 override → open picker, submit → mutate with chosen category", async () => {
    pendingMock.mockReturnValue({ data: { items: [pendingTx] }, isLoading: false, error: null });
    render(wrap(<TransactionsSuggestionsSection />));
    fireEvent.click(screen.getByRole("button", { name: "Modifier la catégorie" }));
    await waitFor(() => expect(screen.getByRole("form", { name: "Corriger la catégorie" })).toBeTruthy());
    // CategoryPicker defaults to the suggested value; submit confirms it as the
    // final category (the override path is exercised server-side by T8).
    fireEvent.submit(screen.getByRole("form", { name: "Corriger la catégorie" }));
    expect(confirmMock).toHaveBeenCalled();
  });
});
```

Create `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.a11y.test.tsx` (same mocks + axe, mirroring the recent-section a11y test harness verbatim):

```tsx
import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ReactNode } from "react";

vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => ({
    data: { items: [{
      id: "tx_aaaaaaaaaaaaaaaaaaaaa", accountId: "acc_aaaaaaaaaaaaaaaaaaaaa", occurredOn: "2026-05-01",
      label: "Carrefour", amount: 42, type: "outflow", category: "autre", isImprevu: false, notes: null,
      transferPairId: null, suggestedCategory: "courses", suggestedConfidence: 0.9, suggestedRoute: "ollama",
      suggestedAt: "2026-05-01T00:00:00.000Z", createdAt: "2026-05-01T00:00:00.000Z",
    }] },
    isLoading: false, error: null,
  }),
}));
vi.mock("../_hooks/use-confirm-categorisation", () => ({ useConfirmCategorisation: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../../_accounts/_hooks/use-accounts", () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock("../../_llm/_components/ai-transparency-notice", () => ({ AiTransparencyNotice: () => null }));

import { TransactionsSuggestionsSection } from "./transactions-suggestions-section";

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

describe("TransactionsSuggestionsSection a11y (AC-6)", () => {
  test("no axe violations with a pending suggestion", async () => {
    const { container } = render(wrap(<TransactionsSuggestionsSection />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

> Copy the exact `axe` import + `toHaveNoViolations` setup from an existing `apps/web` `*.a11y.test.tsx` (the project's vitest a11y harness) so the matcher resolves.

Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/transactions-suggestions-section.envelope.test.tsx src/app/\(cap\)/dashboard/transactions/_components/transactions-suggestions-section.a11y.test.tsx`
Expected: both suites pass (AC-5 empty, AC-1 confirm args, AC-2 override submit, axe 0 violations). (Parens-mangling fallback: `bun --filter='@pekulo/web' run test`.)
Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.envelope.test.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.a11y.test.tsx" && git commit -m "test(#35): suggestions section envelope + a11y (AC-1/2/5/6)"`

#### T16 — Visual verification + full Iron-Law gate + push [AC: AC-4, AC-7]

**(a) Visual verification (frontend GREEN — CLAUDE.md).** With the web dev server running, open `/dashboard/transactions` with at least one pending suggestion (an `autre` transaction whose `suggested_*` columns are set):

- Use `mcp__react-grab-mcp__get_element_context` on the "Suggestions IA" `Section` and a `PekuloSuggestionRow`.
- Confirm: the row shows the Sparkles category chip, the confidence % (amber `$warning` when < 75 %), the route badge (`Ollama`) hidden below 640 px (AC-4), the ✓ Confirmer pill and Modifier button; the AI transparency notice (`role="note"`) appears once for a fresh user and not on reload; tapping Confirmer moves the row to "Récentes"; Modifier opens the CategoryPicker dialog.
- Paste the captured element context into the Dev Agent Record → Completion Notes.

**(b) Full Iron-Law gate** (run from repo root; every command must pass):

```bash
bun run lint
bun --filter='@pekulo/types' run typecheck
bun --filter='@pekulo/validators' run typecheck
bun --filter='@pekulo/contracts' run typecheck
bun --filter='@pekulo/api' run typecheck
bun --filter='@pekulo/web' run typecheck
bun --filter='@pekulo/api' run test
bun --filter='@pekulo/web' run test
bun --filter='@pekulo/ui' run test
bun --filter='@pekulo/api' run prisma:check
bun --filter='@pekulo/api' run prisma:migrate:deploy
bun --filter='@pekulo/api' run db:rls-audit
```

Expected:
- `bun run lint` → 0 errors.
- every `typecheck` → `tsc` exits 0.
- `@pekulo/api` test → all suites pass (incl. T1 enum-iso `3 pass`, T8 confirm repo/service/integration, T9 ai-notice `3 pass`).
- `@pekulo/web` test → all suites pass (incl. T11 hook, T15 envelope + a11y).
- `@pekulo/ui` test → all suites pass (incl. T12 CategoryPicker a11y).
- `prisma:check` → `prisma format --check` clean + `prisma validate` → `valid 🚀`.
- `prisma:migrate:deploy` → applies `20260531000000_add_llm_opt_in_ai_notice_seen` (column add; ADR-0014 forward-only, no `migrate dev`).
- `db:rls-audit` → exit 0, **`llm_opt_in: 4` (quartet unchanged), `llm_call_log: 2` unchanged, `transactions` policy count unchanged, every pre-existing table unchanged** (this story adds a column, not a table).

**(c) Push:**

```bash
git push -u origin feature/35-6-4-llm-suggestion-ui
```

Commit (if a visual-verification note is the only working-tree change): `git commit --allow-empty -m "feat(#35): visual verification + Iron-Law gate green"`

### Out of scope (explicitly deferred — do NOT implement here)

- **Full EU-AI-Act AI transparency notice + opt-out→opt-in re-trigger** → story **11-5** (`11-5-ai-transparency-notice`, depends on 6-4). 6-4 ships only the minimal "appears once" notice + the server `ai_notice_seen_at` flag.
- **LLM activity-log view** (FR-36, the 90-day journal) → story **6-5**.
- **`ollama → third_party` low-confidence escalation policy** (would make `decideRoute` return `third_party`) → deferred since 6-1/6-2; unrelated to confirm/override.
- **Override to `"transfer"` or `"autre"`** — the confirm input is narrowed to the suggestable subset (lesson 2026-05-30). A "dismiss / mark as uncategorised" affordance is not in scope.
- **Refactoring `transaction-edit-form.tsx`** to consume the new `CategoryPicker` (future dedup; 6-4 leaves it untouched).
- **Pagination of `listPendingSuggestions`** — returns the full pending set (small at V1(a) scale, NFR-15/16); cursor pagination lands if/when the pending list grows.
- **Client-side Zustand opt-in mirror** for synchronous badge gating → still deferred (the badge reads the persisted server `suggestedRoute`).

## File List

**Created**

- `apps/api/prisma/migrations/20260531000000_add_llm_opt_in_ai_notice_seen/migration.sql`
- `apps/api/src/modules/llm/llm-ai-notice.test.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-pending-suggestions.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-confirm-categorisation.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.envelope.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_hooks/use-ai-notice.ts`
- `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`
- `packages/ui/src/components/CategoryPicker/CategoryPicker.tsx`
- `packages/ui/src/components/CategoryPicker/index.ts`
- `packages/ui/src/components/CategoryPicker/CategoryPicker.a11y.test.tsx`

**Modified**

- `packages/types/src/llm/llm.types.ts`
- `packages/validators/src/llm/llm.schemas.ts`
- `packages/validators/src/transactions/transactions.schemas.ts`
- `packages/contracts/src/transactions/transactions.contract.ts`
- `packages/contracts/src/llm/llm.contract.ts`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions.module.ts`
- `apps/api/src/modules/transactions/transactions.routes.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/prisma/schema/llm.prisma`
- `apps/api/src/modules/llm/llm.repository.ts`
- `apps/api/src/modules/llm/llm.service.ts`
- `apps/api/src/modules/llm/llm.routes.ts`
- `apps/api/src/modules/llm/llm-enum-iso.test.ts`
- `apps/api/src/modules/transactions/transactions.repository.test.ts`
- `apps/api/src/modules/transactions/transactions.service.test.ts`
- `apps/api/src/modules/transactions/transactions.integration.test.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-suggestions-section.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_actions/llm-actions.ts`
- `apps/web/src/lib/zapaction/keys.ts`
- `packages/ui/src/components/index.ts`
- `docs/state.yaml`

## Dev Agent Record

- **Model:** claude-opus-4-8[1m] (Opus 4.8, 1M context)
- **Started:** 2026-05-31T10:38:31Z
- **Completed:** 2026-05-31T11:50:10Z

### Summary

FR-33 shipped end-to-end across 16 tasks (15 feature/test commits), TDD with witnessed RED on every behavioural task. Server: `confirmCategorisation` (accept-vs-override decided server-side; override appends one `outcome:"overridden"` row through the single LLM audit writer via the narrow `LlmOverrideAuditPort`) + index-backed `listPendingSuggestions`. `LLM_OUTCOMES` gained `"overridden"` (server-written only — the attest body stays narrowed to `success|failure`, lesson 2026-05-30). Web: Suggestions IA section wiring `PekuloSuggestionRow` to confirm/override, shared `CategoryPicker` DS component, and a minimal server-flagged AI transparency notice (`ai_notice_seen_at`). One forward-only column-add migration (no RLS change).

### Files changed

Per the **File List** above. Net additions beyond it: three inherited LLM test fakes widened with no-op `getAiNoticeSeen`/`markAiNoticeSeen` (`llm.attest-router.test.ts`, `llm.service.test.ts`, `llm-categorise.test.ts`) — interface-extension fallout, iso to the 6-2/6-3 fake-widening deviations.

### Deviations

- **T13↔T14 executed in reverse order** — T13's section imports `AiTransparencyNotice` (T14), so T14 landed first. Commits otherwise match the plan.
- **Test typing fixes (story verbatim → real tsc):** server-test mocks (`recordOverride`, `updateMany`, `findMany`, `upsert`) gained typed params; the verbatim `mock(async () => {})` + `calls[0][0]` tripped `TS2493` under `noUncheckedIndexedAccess` (the `bun run test` runtime gate never tsc'd them; the full `typecheck` gate did).
- **T12 a11y test uses the real `packages/ui` harness** (`renderWithTamagui`+`axe` from `test/setup.tsx`, `.violations.filter(impact)`), not the verbatim `vitest-axe`/`toHaveNoViolations`; assertion targets `role="combobox"` (PekuloSelect trigger's real role). **`CategoryPicker` gained `aria-label={placeholder}`** on the trigger to satisfy axe `button-name` (AC-6) — the verbatim component exposed no accessible name when closed.
- **T13:** `toast.error` → `toast.danger` (the DS `useToast` exposes `danger`, not `error`).
- **T15 uses `renderWithTamagui`** (Tamagui + Toast providers) not bare `render`; pill clicks target visible text via `.closest("button")` and the override form submits via `.closest("form")` — RTL `getByRole("button")` is flaky on Tamagui `styled.button` under happy-dom (the axe a11y suite confirms the buttons ARE accessible).
- **T11 invalidation assertion** targets the bare `[TRANSACTIONS_KEY]` prefix (registry resolves multiple keys) rather than the story's brittle inline expression.
- Commit subjects trimmed to ≤72 chars (architecture L607) where the verbatim message exceeded it.

**Flagged for review (not fixed — out of 6-4 scope, "consumes PekuloSuggestionRow as-is"):** (1) PekuloSuggestionRow's confirm/edit pill `aria-label`s reach the DOM but RTL name-matching is flaky on them under happy-dom; (2) AC-4 says the route badge hides "< 640 px" but the shipped row hides it via `$md` (~768 px) — inherited 0-10 behaviour.

**Visual verification (T16a) DEFERRED to aped-review (Aria):** `react-grab-mcp` is unavailable this session (same as 6-3). The Suggestions IA surface, route badge, `$warning` confidence colour, and the notice's once-only appearance need a live React-Grab/visual pass.

### Test output

Full Iron-Law gate (2026-05-31, repo root):

- `bun run lint` → **0 errors** (12 pre-existing repo-wide warnings).
- `typecheck` (types · validators · contracts · api · web · ui) → all **exit 0**.
- `@pekulo/api` `bun:test` → **724 pass / 0 fail** (85 files) — incl. enum-iso (3), confirm repo/service/integration (AC-1/2/6), ai-notice (3).
- `@pekulo/web` `vitest` → **140 pass / 0 fail** (68 files) — incl. confirm-hook invalidation, section envelope (AC-1/2/5), section a11y (AC-6). _(A first full run flaked on 1 file under happy-dom resource pressure; clean re-run all-green.)_
- `@pekulo/ui` `vitest` → **194 pass / 1 skipped** — incl. CategoryPicker a11y.
- `prisma:check` → format clean + **valid 🚀**.
- `prisma:migrate:deploy` → applied `20260531000000_add_llm_opt_in_ai_notice_seen` (column add).
- `db:rls-audit` → **exit 0**, 19 tables — `llm_opt_in: 4` (quartet unchanged), `llm_call_log: 2`, `transactions: 4` — every policy count unchanged (column add, not a table).

---

## Extension — LLM provider config + dev gateway (added 2026-05-31)

> **Out of the original FR-33 scope.** Added on the user's explicit call (the
> recommendation was a dedicated story; the user chose to extend 6-4). Recorded
> here for traceability. Touches the transport tier (lineage of 6-1), not the
> confirm/override UI of this story.

**Decisions (user, 2026-05-31):**

- **Gateway strategy:** OpenRouter for **dev/test** (one OpenAI-compatible key,
  swap any model to A/B on real FR transactions); the in-house `llm` module
  stays the **prod** gateway with a **direct EU provider**. Vercel AI Gateway
  rejected here — the LLM runs in `apps/api` on Dokploy (not Vercel) and the
  EU/RGPD constraint negates its in-stack benefit.
- **Cost is a non-factor** at this scale (default Ollama = 0 €/token; cloud
  third-party ≈ cents/month). The deciding axes are FR-categorisation quality,
  JSON reliability, and RGPD — model choice is settled empirically by the
  OpenRouter bench below. _(No formal decision-record ID allocated: `prd.md`
  already defines DR-1…DR-12 with no free slot (DR-11 = at-rest encryption) —
  kept story-local. Promote to a real DR only if it later needs a cross-cutting
  record.)_

**Changes:**

- `services/ollama-client.ts` — default model `llama3.2:3b` → **`qwen2.5:3b`**
  (better FR + instruction-following at the same speed class); request body now
  sends **`format: "json"`** so a small local model returns parseable JSON.
  Bump to `qwen2.5:7b` via `OLLAMA_MODEL` only on a GPU host (a 7B on CPU
  exceeds the NFR-5 5 s cap → every call would abstain).
- `services/third-party-client.ts` — rewritten from the **Anthropic-native**
  shape (`/v1/messages`, `x-api-key`) to **OpenAI-compatible**
  (`/v1/chat/completions`, `Authorization: Bearer`, `choices[].message.content`,
  `temperature: 0`). Default endpoint/model → **Mistral La Plateforme (EU)** /
  `mistral-small-latest`. **Trade-off:** Claude is no longer reached via its
  native API — reach it through OpenRouter (`anthropic/claude-haiku-4.5`).
- `config/env.ts` + `.env.example` — documented the new defaults + an OpenRouter
  dev/test recipe. **No env-schema change** (the `OLLAMA_*` / `THIRD_PARTY_LLM_*`
  vars 6-1 shipped already cover it — provider/model swap is config-only).
- Tests updated: `ollama-client.test.ts` asserts `format:"json"` + model in the
  request body; `third-party-client.test.ts` asserts the OpenAI-compatible
  response shape + Bearer auth.

**Not changed (intentionally):** routing policy (`decideRoute`: iOS → FM, else
Ollama; third-party stays opt-in), the single-writer audit (ADR-0008), the
zero-PII prompt builder (NFR-12). The `ollama → third_party` low-confidence
escalation stays deferred.

### Model-selection bench (2026-05-31)

Ran `apps/api/scripts/llm-bench.ts` (real third-party transport + zero-PII
prompt + parser, routing bypassed) over 10 messy FR bank labels, scored by
**human judgement on the 5 non-ambiguous cases** (EDF / Spotify / Uber Eats /
FNAC are taxonomy gaps — no category fits — so excluded from the error count).
"10/10 categorised" ≠ correct; it only means the model returned an in-list value.

| Model | Errors (clear /5) | Avg latency | $/M (in/out) | EU |
| --- | --- | --- | --- | --- |
| **mistral-small-3.2-24b** | **0** | ~730 ms | 0.10 / 0.30 | **✓** |
| gemini-2.5-flash | 0 | ~530 ms | 0.15 / 0.60 | ✗ |
| gemini-2.5-flash-lite | 0 | ~570 ms | 0.10 / 0.40 | ✗ |
| gpt-4o-mini | 0 | ~640 ms | 0.15 / 0.60 | ✗ |
| gpt-4.1-nano | 0 | ~780 ms | 0.10 / 0.40 | ✗ |
| qwen-2.5-7b (local proxy) | 0* | ~780 ms | cheap | ✗ |
| llama-3.3-70b | 0* | ~750 ms | mid | ✗ |
| deepseek-v3.1 | 0* | ~1730 ms | cheap | ✗ |
| claude-haiku-4.5 | **1** (misses Carrefour) | ~1160 ms | **1 / 5** | ✗ |
| ministral-8b | **1** (Uber→freelance) | ~540 ms | 0.10 / 0.10 | ✓ |
| ministral-3b | **1** (Carrefour→transport) | ~420 ms | 0.04 / 0.04 | ✓ |
| gpt-5-nano | **unusable** — empty output | ~3700 ms | — | ✗ |

\* 0 hard errors but extra soft misses on the ambiguous cases (e.g. qwen-7b:
DAB→transport, Uber→voyage).

**Findings:**
- **Mistral Small 24B wins** — the only model combining 0 hard errors + EU/RGPD
  + low cost + sane latency. **Prod default `mistral-small-latest` confirmed; no
  code change.**
- **Pricier ≠ better:** Claude Haiku (10× the cost) is the only "premium" model
  to miss the most trivial label (Carrefour Market → imprevu, reproducible).
- **Reasoning models are a trap here:** `gpt-5-nano` burns the `max_tokens: 64`
  budget on hidden reasoning and returns empty text → 0/10. Avoid for this task.
- **Small models (3–8B) are fragile even on trivial labels** (Ministral 3b/8b
  miss Carrefour). Since `qwen2.5:3b` is the *local* default, it will be the weak
  link — which reinforces that the deferred `ollama → third_party` low-confidence
  escalation is the real quality lever (Mistral EU rescues local misses for cents).

**Open follow-ups:** confirm VPS hardware (CPU-only → keep `qwen2.5:3b`; GPU →
`qwen2.5:7b`); re-run the bench on **real** user labels if the synthetic verdict
needs hardening; revisit the bench when the taxonomy grows (the 4 "gap" labels
above signal missing categories: factures/énergie, restauration, abonnements);
keep the backfill path (CSV / first Bridge import) rules-only or batched to
avoid per-tx LLM cost/latency on thousands of rows.
