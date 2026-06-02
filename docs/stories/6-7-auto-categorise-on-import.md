# Story: 6-7-auto-categorise-on-import — Auto-apply LLM category on bulk import

**Epic:** Epic 6 — LLM auto-categorisation (transaction-enrichment bucket)
**Status:** ready-for-dev
**Ticket:** none — assigned at scheduling / `aped-ship` time (per `epics.md`)
**Branch:** feature/none-6-7-auto-categorise-on-import
**Covered FRs:** FR-33 (amended bulk path; the interactive confirm/override path stays owned by 6-4)
**Complexity:** M

## User Story

**As a** Pekulo user importing many transactions, **I want** the LLM-suggested category applied automatically on CSV import / Bridge sync (correctable anytime) instead of confirming each row by hand, **so that** I'm not stuck validating hundreds of rows one by one.

## Acceptance Criteria

- **AC-1 — bulk import auto-applies.** **Given** a CSV import or a Bridge sync that produces LLM category suggestions, **When** ingestion completes, **Then** each imported transaction appears in Récentes already categorised with its suggested category — with no manual confirmation step — and stays editable.
- **AC-2 — transparency notice for the applied batch.** **Given** the user is first shown AI-applied categories and has not yet seen the AI notice, **When** the transactions screen renders, **Then** a transparency notice states that categories are applied automatically by an AI model and remain correctable; **And** it appears at most once (never again on later visits) and never as a duplicate alongside the pending-suggestions notice.
- **AC-3 — interactive path unchanged.** **Given** the user creates a single transaction by hand, **When** it is categorised, **Then** it keeps the existing suggestion→confirm flow (it appears under « Suggestions IA » awaiting the user's confirm/override, not pre-categorised); **And** a hand-created transaction whose suggestion could not be produced at creation time is later offered as a pending suggestion, never auto-applied.
- **AC-4 — abstention / transport-failure safety.** **Given** the model declines to suggest a category, **When** the categorisation pass runs, **Then** the transaction is left uncategorised and is not re-processed; **And given** the model is unreachable, **Then** the transaction is left uncategorised and is retried on a later pass (the current pass stops early instead of hammering a down model).
- **AC-5 — manual override always wins.** **Given** a transaction whose category the user has set, **When** any later categorisation pass runs, **Then** the user's category is never overwritten; **And** editing an auto-applied transaction's category persists the user's choice as the final category.
- **AC-6 — provenance is visible.** **Given** an auto-applied transaction the user has not yet edited, **When** Récentes renders it, **Then** a discreet grayscale « IA » hint appears next to its category; **When** the user later changes that category, **Then** the hint disappears.

## Tasks

- [x] **T1 — Add the `transaction source` enum to the validators SSOT** [AC: AC-1, AC-3]
  In `packages/validators/src/transactions/transactions.schemas.ts`, add the block below immediately AFTER the `suggestableTransactionCategorySchema` / `SuggestableTransactionCategory` block (after line ~255, before `confirmCategorisationInputSchema`):
  ```ts
  // ─── Transaction source (story 6-7, FR-33 amended) ───────────────────────
  // Where a transaction was created — drives the épic-6 categorisation policy:
  // 'manual' rows keep the suggestion→confirm flow (6-4); 'csv'/'bridge' (bulk
  // import) rows get the LLM suggestion APPLIED directly as the final category
  // (no pending state). SERVER-INTERNAL — deliberately NOT part of the public
  // Transaction DTO (the web "· IA" provenance hint derives from
  // category === suggestedCategory instead). Plain string column, NO DB CHECK
  // (lesson 2026-05-27 — the value universe is enumerated here + validated in
  // the app layer, mirroring the free-String `category`).
  export const TRANSACTION_SOURCES = ["manual", "csv", "bridge"] as const;
  export const transactionSourceSchema = z.enum(TRANSACTION_SOURCES);
  export type TransactionSource = z.infer<typeof transactionSourceSchema>;
  ```
  Then export it from the package barrel — in `packages/validators/src/transactions/index.ts`, confirm the file re-exports `* from "./transactions.schemas"` (it does; no edit needed if the wildcard re-export is present — verify with `grep -n "transactions.schemas" packages/validators/src/transactions/index.ts`).
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0, no TS errors.
  Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(6-7): transaction source enum (manual|csv|bridge) for auto-apply policy"`

- [x] **T2 — Add the `source` column to the Transaction model + migration** [AC: AC-1, AC-3]
  (a) In `apps/api/prisma/schema/transactions.prisma`, add the `source` field to the `Transaction` model immediately after the `providerTransactionId` line:
  ```prisma
  // Story 6-7 (FR-33 amended) — where the row was created. 'manual' keeps the
  // suggestion→confirm flow (6-4); 'csv'/'bridge' (bulk import) auto-apply the
  // LLM suggestion as the final category. Plain TEXT, NO CHECK (lesson
  // 2026-05-27 — universe enumerated in @pekulo/validators#TRANSACTION_SOURCES
  // + app-layer validated, mirrors `category`). Default 'manual' so the
  // interactive create path needs no change; the migration backfills existing
  // provider rows → 'bridge'.
  source                String          @default("manual")
  ```
  (b) Create the migration `apps/api/prisma/migrations/20260602160000_add_transaction_source/migration.sql` (hand-authored, forward-only per ADR-0014 — mirrors the hand-written `20260602150000_*` RLS migration; NO `prisma migrate dev` needed for the dev loop since api tests use a fake Prisma):
  ```sql
  -- Story 6-7 (FR-33 amended) — transaction origin column. Drives the épic-6
  -- categorisation policy (manual = suggest/confirm; csv/bridge = auto-apply).
  -- Plain TEXT, NO CHECK (lesson 2026-05-27 — universe is enumerated in
  -- @pekulo/validators#TRANSACTION_SOURCES + app-layer validated, mirrors
  -- `category`). No RLS change: `transactions` is an already-RLS'd user-data
  -- table (4 policies); adding a column does not touch row-security
  -- (lesson 2026-06-02 — the Supabase advisor flags RLS-disabled tables, which
  -- this is not).
  ALTER TABLE "transactions" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

  -- Backfill: already-synced Bridge rows are bulk-origin → the hourly sweep
  -- must treat them as auto-apply, not suggest. CSV-imported historical rows
  -- predate the column and stay 'manual' (acceptable — they are mostly already
  -- categorised or attempted).
  UPDATE "transactions" SET "source" = 'bridge' WHERE "provider" IS NOT NULL;
  ```
  (c) Regenerate the client THEN typecheck — one inseparable step (lesson 2026-06-01: `prisma:generate && typecheck` after any schema change, never trust the pre-commit hook):
  Run: `bun --filter='@pekulo/api' run prisma:generate && bun --filter='@pekulo/api' run prisma:validate && bun --filter='@pekulo/api' run typecheck`
  Expected: `prisma generate` reports the client written with `Transaction.source: string`; `prisma:validate` exits 0; `typecheck` exits 0.
  Commit: `git add apps/api/prisma/schema/transactions.prisma apps/api/prisma/migrations/20260602160000_add_transaction_source/migration.sql && git commit -m "feat(6-7): add transactions.source column + migration (FR-33 amended)"`

- [x] **T3 — Repository: stamp `source`, add `applySuggestedCategory`, surface `source` on the backlog read** [AC: AC-1, AC-4, AC-5]
  In `apps/api/src/modules/transactions/transactions.repository.ts`:
  (a) Add `TransactionSource` to the `@pekulo/validators` type import block (alongside the other type imports, after line ~27):
  ```ts
    TransactionSource,
  ```
  (b) Add `source` to the `TransactionRow` type, immediately after `suggestedAttemptedAt: Date | null;` (line ~48):
  ```ts
    source: string;
  ```
  (c) In `bulkCreate` (the `tx.transaction.create` `data` object, after line ~419 `notes: row.notes,`), add the CSV origin:
  ```ts
              source: "csv",
  ```
  (d) In `bulkCreateFromProvider` (the `deps.client.transaction.create` `data` object, after line ~472 `providerTransactionId: row.providerTransactionId,`), add the Bridge origin:
  ```ts
                source: "bridge",
  ```
  (e) Add the `applySuggestedCategory` method to the `TransactionsRepository` interface, immediately AFTER the `saveSuggestion(...)` declaration (after line ~136):
  ```ts
    /**
     * Story 6-7 (FR-33 amended) — APPLY the LLM suggestion as the FINAL category
     * on a bulk-import row. Sets `category` = suggested AND keeps the suggested_*
     * columns populated (provenance for the "· IA" hint) + stamps
     * suggested_attempted_at. The bulk-path twin of saveSuggestion (which leaves
     * category='autre' pending). Guarded `where { category: 'autre' }` so a user
     * category set meanwhile ALWAYS wins (idempotent, AC-5). Returns { applied }.
     */
    applySuggestedCategory(
      userId: string,
      txId: string,
      suggestion: { category: string; confidence: number; route: string },
    ): Promise<{ applied: boolean }>;
  ```
  (f) Change the `listAutreWithoutAttempt` interface signature (line ~160) to carry `source` (the sweep needs it to decide apply-vs-suggest). REPLACE:
  ```ts
    listAutreWithoutAttempt(userId: string, limit: number): Promise<Transaction[]>;
  ```
  with:
  ```ts
    listAutreWithoutAttempt(
      userId: string,
      limit: number,
    ): Promise<Array<Transaction & { source: TransactionSource }>>;
  ```
  (g) Add the `applySuggestedCategory` implementation inside the returned object literal, immediately AFTER the `saveSuggestion` impl (after line ~574):
  ```ts
      async applySuggestedCategory(userId, txId, suggestion) {
        const { count } = await deps.client.transaction.updateMany({
          where: { id: txId, userId, category: "autre" },
          data: {
            category: suggestion.category,
            suggestedCategory: suggestion.category,
            suggestedConfidence: suggestion.confidence,
            suggestedRoute: suggestion.route,
            suggestedAt: new Date(),
            // An applied suggestion is also an attempt → never re-swept.
            suggestedAttemptedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        return { applied: count > 0 };
      },
  ```
  (h) REPLACE the `listAutreWithoutAttempt` impl (lines ~623-635) so it maps `source` onto each row (defensive `?? "manual"` for fake rows in tests that omit the column):
  ```ts
      async listAutreWithoutAttempt(userId, limit) {
        const rows = (await deps.client.transaction.findMany({
          where: {
            userId,
            category: "autre",
            suggestedCategory: null,
            suggestedAttemptedAt: null,
          },
          orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
          take: limit,
        })) as TransactionRow[];
        return rows.map((r) => ({
          ...toDto(r),
          source: (r.source ?? "manual") as TransactionSource,
        }));
      },
  ```
  Then create `apps/api/src/modules/transactions/transactions-autoapply.test.ts`:
  ```ts
  // apps/api/src/modules/transactions/transactions-autoapply.test.ts
  // bun:test — story 6-7 (FR-33 amended). Repository-level: applySuggestedCategory
  // query shape (category set + suggested_* kept + the 'autre' guard) and the
  // source field surfaced on listAutreWithoutAttempt. Fake Prisma (no Postgres
  // harness — 6-1 precedent; RLS coverage stays in db:rls-audit).

  import { describe, expect, mock, test } from "bun:test";
  import { createTransactionsRepository } from "./transactions.repository";
  import type { ExtendedPrismaClient } from "../../database";

  describe("applySuggestedCategory (6-7)", () => {
    test("sets category = suggestion, keeps suggested_*, guards category='autre'", async () => {
      const updateMany = mock(async () => ({ count: 1 }));
      const repo = createTransactionsRepository({
        client: { transaction: { updateMany } } as unknown as ExtendedPrismaClient,
      });
      const out = await repo.applySuggestedCategory("u_a", "tx_aaaaaaaaaaaaaaaaaaaaa", {
        category: "courses",
        confidence: 0.82,
        route: "ollama",
      });
      expect(out).toEqual({ applied: true });
      const call = updateMany.mock.calls[0]![0] as {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      };
      expect(call.where).toMatchObject({ id: "tx_aaaaaaaaaaaaaaaaaaaaa", userId: "u_a", category: "autre" });
      expect(call.data.category).toBe("courses");
      expect(call.data.suggestedCategory).toBe("courses");
      expect(call.data.suggestedConfidence).toBe(0.82);
      expect(call.data.suggestedRoute).toBe("ollama");
      expect(call.data.suggestedAttemptedAt).toBeInstanceOf(Date);
    });

    test("returns { applied: false } when the guard matched no row (user set a category meanwhile)", async () => {
      const updateMany = mock(async () => ({ count: 0 }));
      const repo = createTransactionsRepository({
        client: { transaction: { updateMany } } as unknown as ExtendedPrismaClient,
      });
      const out = await repo.applySuggestedCategory("u_a", "tx_bbbbbbbbbbbbbbbbbbbbb", {
        category: "loyer",
        confidence: 0.9,
        route: "ollama",
      });
      expect(out).toEqual({ applied: false });
    });
  });

  describe("listAutreWithoutAttempt surfaces source (6-7)", () => {
    test("maps the row's source onto the candidate (defaults to 'manual' when absent)", async () => {
      const findMany = mock(async () => [
        {
          id: "tx_ccccccccccccccccccccc",
          userId: "u_a",
          accountId: "acc_a",
          occurredOn: new Date("2026-05-15T00:00:00Z"),
          label: "Carrefour",
          amount: { toNumber: () => 12 },
          type: "outflow",
          category: "autre",
          isImprevu: false,
          notes: null,
          transferPairId: null,
          suggestedCategory: null,
          suggestedConfidence: null,
          suggestedRoute: null,
          suggestedAt: null,
          suggestedAttemptedAt: null,
          source: "csv",
          createdAt: new Date("2026-05-15T00:00:00Z"),
        },
      ]);
      const repo = createTransactionsRepository({
        client: { transaction: { findMany } } as unknown as ExtendedPrismaClient,
      });
      const rows = await repo.listAutreWithoutAttempt("u_a", 10);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.source).toBe("csv");
      expect(rows[0]!.category).toBe("autre");
    });
  });
  ```
  Run: `bun --filter='@pekulo/api' run test src/modules/transactions/transactions-autoapply.test.ts`
  Expected: `✓ sets category = suggestion, keeps suggested_*, guards category='autre'`, `✓ returns { applied: false } when the guard matched no row (user set a category meanwhile)`, `✓ maps the row's source onto the candidate (defaults to 'manual' when absent)` — all pass.
  Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions-autoapply.test.ts && git commit -m "feat(6-7): repository source stamping + applySuggestedCategory + backlog source (FR-33 amended)"`

- [x] **T4 — Service: source-aware categorisation engine + wire `importCsv`** [AC: AC-1, AC-3, AC-4]
  In `apps/api/src/modules/transactions/transactions.service.ts`:
  (a) REPLACE the `backfillSuggestions` interface declaration's return type (line ~184-187) to add the `applied` count:
  ```ts
    backfillSuggestions(
      userId: string,
      limit: number,
    ): Promise<{ scanned: number; suggested: number; applied: number; abstained: number; failed: number }>;
  ```
  (b) REPLACE the `backfillAllUsers` interface declaration's return type (line ~193-196):
  ```ts
    backfillAllUsers(
      maxUsers: number,
      limitPerUser: number,
    ): Promise<{ users: number; suggested: number; applied: number }>;
  ```
  (c) REPLACE the whole `backfillSuggestionsImpl` free function (lines ~288-339) with the source-aware version — `manual` rows write a PENDING suggestion (6-4 flow), `csv`/`bridge` rows AUTO-APPLY (6-7):
  ```ts
  // Backfill (épic 6) — categorise up to `limit` still-'autre', never-attempted
  // rows for one user. Free function (no `this`; mirrors suggestCategoryImpl).
  // Sequential + early-stop on transport failure so a down LLM isn't hammered.
  // Story 6-7 (FR-33 amended) — SOURCE-AWARE: a 'manual' row gets a PENDING
  // suggestion (saveSuggestion, the 6-4 confirm flow); a bulk-origin row
  // ('csv'/'bridge') gets the suggestion APPLIED as the final category
  // (applySuggestedCategory). The candidate's `source` comes from
  // listAutreWithoutAttempt (6-7).
  async function backfillSuggestionsImpl(args: {
    userId: string;
    limit: number;
    repository: TransactionsRepository;
    categoriser?: TransactionCategoriser;
  }): Promise<{ scanned: number; suggested: number; applied: number; abstained: number; failed: number }> {
    const { userId, limit, repository, categoriser } = args;
    const counts = { scanned: 0, suggested: 0, applied: 0, abstained: 0, failed: 0 };
    if (!categoriser) return counts;
    const candidates = await repository.listAutreWithoutAttempt(userId, limit);
    for (const tx of candidates) {
      counts.scanned += 1;
      const amountSigned = tx.type === "outflow" ? -tx.amount : tx.amount;
      let result: Awaited<ReturnType<TransactionCategoriser["categorise"]>>;
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential on purpose: bound LLM concurrency + stop early on transport failure
        result = await categoriser.categorise({
          userId,
          label: tx.label,
          amountSigned,
          occurredOn: tx.occurredOn,
          categories: SUGGESTABLE_CATEGORIES,
        });
      } catch {
        // categorise() is contractually never-throws, but treat a thrown error as
        // a transport failure too: leave unstamped + stop the batch.
        counts.failed += 1;
        break;
      }
      if (result.failed) {
        // Provider down/timeout — DON'T stamp (retry next sweep) and stop: the
        // rest of the batch would fail the same way.
        counts.failed += 1;
        break;
      }
      if (result.category && result.confidence > 0) {
        const suggestion = {
          category: result.category,
          confidence: result.confidence,
          route: result.route,
        };
        if (tx.source === "manual") {
          // Interactive-origin row whose inline suggestion missed → keep the
          // suggestion→confirm flow (6-4, AC-3): write a PENDING suggestion.
          // eslint-disable-next-line no-await-in-loop -- see above
          await repository.saveSuggestion(userId, tx.id, suggestion);
          counts.suggested += 1;
        } else {
          // Bulk-origin row (csv/bridge) → AUTO-APPLY the category (6-7, AC-1):
          // no pending state, lands in Récentes already categorised.
          // eslint-disable-next-line no-await-in-loop -- see above
          await repository.applySuggestedCategory(userId, tx.id, suggestion);
          counts.applied += 1;
        }
      } else {
        // Clean abstention — stamp attempted so it is never re-swept.
        // eslint-disable-next-line no-await-in-loop -- see above
        await repository.stampSuggestionAttempt(userId, tx.id);
        counts.abstained += 1;
      }
    }
    return counts;
  }
  ```
  (d) REPLACE the `backfillAllUsers` method impl (lines ~588-608) to accumulate `applied`:
  ```ts
      async backfillAllUsers(maxUsers, limitPerUser) {
        // Free-function delegation (NOT this.backfillSuggestions — `this` is
        // unreliable on this object literal, lesson 5-3).
        const summary = { users: 0, suggested: 0, applied: 0 };
        const userIds = await deps.repository.listUserIdsWithBacklog(maxUsers);
        for (const userId of userIds) {
          // eslint-disable-next-line no-await-in-loop -- sequential: bound total LLM concurrency across users
          const r = await backfillSuggestionsImpl({
            userId,
            limit: limitPerUser,
            repository: deps.repository,
            categoriser: deps.categoriser,
          });
          summary.users += 1;
          summary.suggested += r.suggested;
          summary.applied += r.applied;
          // A transport failure means the LLM is down — stop the whole sweep; the
          // next hourly tick retries every user.
          if (r.failed > 0) break;
        }
        return summary;
      },
  ```
  (e) Wire `importCsv` to fire the (now source-aware) categorise pass after the bulk commit — it had NONE. Add this block inside `importCsv`'s `try`, immediately AFTER the per-row `categoriseAfterCreateImpl` loop closes and BEFORE `return { ok: true as const, persisted };` (after line ~491). This mirrors `importFromProvider`'s existing post-sync block verbatim:
  ```ts
        // Story 6-7 (FR-33 amended) — the bulk import above runs transfer-rules
        // only (never the LLM). Fire-and-forget the source-aware categorise pass:
        // 'csv'-origin rows are AUTO-APPLIED, any 'manual' backlog is suggested.
        // Bounded; OFF the import's response path (NFR-1). The hourly sweep
        // drains anything beyond POST_SYNC_BACKFILL_LIMIT.
        if (deps.categoriser) {
          const categoriser = deps.categoriser;
          void backfillSuggestionsImpl({
            userId,
            limit: POST_SYNC_BACKFILL_LIMIT,
            repository: deps.repository,
            categoriser,
          }).catch(() => {
            /* best-effort; the hourly sweep retries any miss */
          });
        }
  ```
  (`importFromProvider`'s existing post-sync `backfillSuggestionsImpl` call needs NO edit — it inherits the source-aware behaviour and now auto-applies `bridge` rows.)
  Then update `apps/api/src/modules/transactions/transactions-backfill.test.ts` for the source dimension. REPLACE the `tx(...)` helper (lines ~11-29) and the `makeService(...)` helper (lines ~31-55) with the versions below (add the `source` param + track `applySuggestedCategory`), then ADD the two new tests after the existing `transport failure STOPS` test:
  ```ts
  import { test, expect } from "bun:test";
  import type { Transaction, TransactionSource } from "@pekulo/validators";
  import type { TransactionsRepository } from "./transactions.repository";
  import type { TransactionCategoriser } from "./transactions.service";
  import { createTransactionsService } from "./transactions.service";

  function tx(id: string, source: TransactionSource = "manual"): Transaction & { source: TransactionSource } {
    return {
      id,
      accountId: "acc_1",
      occurredOn: "2026-05-15",
      label: `label ${id}`,
      amount: 12,
      type: "outflow",
      category: "autre",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      suggestedCategory: null,
      suggestedConfidence: null,
      suggestedRoute: null,
      suggestedAt: null,
      createdAt: "2026-05-15T10:00:00.000Z",
      source,
    };
  }

  function makeService(opts: {
    backlog: (Transaction & { source: TransactionSource })[];
    categorise: TransactionCategoriser["categorise"];
  }) {
    const saved: string[] = [];
    const applied: string[] = [];
    const stamped: string[] = [];
    const repo = {
      listAutreWithoutAttempt: async (_userId: string, limit: number) => opts.backlog.slice(0, limit),
      saveSuggestion: async (_u: string, txId: string) => {
        saved.push(txId);
        return { saved: true };
      },
      applySuggestedCategory: async (_u: string, txId: string) => {
        applied.push(txId);
        return { applied: true };
      },
      stampSuggestionAttempt: async (_u: string, txId: string) => {
        stamped.push(txId);
      },
      listUserIdsWithBacklog: async () => ["u1", "u2"],
    } as unknown as TransactionsRepository;
    const service = createTransactionsService({
      repository: repo,
      accountOwnershipProbe: { exists: async () => true, existsMany: async () => new Set() },
      accountResolver: { resolve: async () => ({ id: null, matchCount: 0 }) },
      categoriser: { categorise: opts.categorise },
    });
    return { service, saved, applied, stamped };
  }
  ```
  New tests (append after the `transport failure STOPS` test, before `no categoriser wired → no-op`):
  ```ts
  test("AUTO-APPLIES (not suggests) for bulk-origin rows — source csv/bridge (6-7)", async () => {
    const { service, saved, applied, stamped } = makeService({
      backlog: [tx("tx_csv", "csv"), tx("tx_bridge", "bridge")],
      categorise: async () => ({
        category: "courses",
        confidence: 0.8,
        route: "ollama",
        failed: false,
      }),
    });
    const counts = await service.backfillSuggestions("u1", 10);
    expect(counts).toMatchObject({ scanned: 2, suggested: 0, applied: 2, abstained: 0, failed: 0 });
    expect(applied).toEqual(["tx_csv", "tx_bridge"]);
    expect(saved).toEqual([]);
    expect(stamped).toEqual([]);
  });

  test("importCsv fires a source-aware auto-apply pass after the bulk commit (6-7)", async () => {
    const csvRow = tx("tx_csv1", "csv");
    const applied: string[] = [];
    const repo = {
      bulkCreate: async () => ({ persisted: 1, rows: [csvRow as Transaction] }),
      findTransferPairCandidates: async () => [],
      listAutreWithoutAttempt: async () => [csvRow],
      applySuggestedCategory: async (_u: string, txId: string) => {
        applied.push(txId);
        return { applied: true };
      },
      saveSuggestion: async () => ({ saved: true }),
      stampSuggestionAttempt: async () => {},
    } as unknown as TransactionsRepository;
    const service = createTransactionsService({
      repository: repo,
      accountOwnershipProbe: { exists: async () => true, existsMany: async (_u: string, ids: string[]) => new Set(ids) },
      accountResolver: { resolve: async () => ({ id: null, matchCount: 0 }) },
      categoriser: {
        categorise: async () => ({ category: "courses", confidence: 0.8, route: "ollama", failed: false }),
      },
    });
    const out = await service.importCsv("u1", {
      rows: [
        {
          occurredOn: "2026-05-15",
          amount: 12,
          type: "outflow",
          category: "autre",
          label: "label tx_csv1",
          accountId: "acc_aaa111111111111111111",
          isImprevu: false,
          notes: null,
        },
      ],
    });
    expect(out).toEqual({ ok: true, persisted: 1 });
    // Fire-and-forget: the auto-apply pass lands after importCsv resolves.
    await new Promise((r) => setTimeout(r, 0));
    expect(applied).toEqual(["tx_csv1"]);
  });
  ```
  Run: `bun --filter='@pekulo/api' run test src/modules/transactions/transactions-backfill.test.ts`
  Expected: the four original tests still pass (`✓ suggests for each row the model categorises`, `✓ clean abstention stamps attempted (no retry), does not save`, `✓ transport failure STOPS the batch and stamps nothing (retried next sweep)`, `✓ backfillAllUsers sweeps each user with backlog`, `✓ no categoriser wired → no-op`) PLUS `✓ AUTO-APPLIES (not suggests) for bulk-origin rows — source csv/bridge (6-7)` and `✓ importCsv fires a source-aware auto-apply pass after the bulk commit (6-7)`.
  Then run the whole api suite to confirm no regression: `bun --filter='@pekulo/api' run test`
  Expected: 0 fail (existing `transactions-suggest`, `transactions-month`, `transactions.repository`, `transactions.service`, `transactions.integration`, `transactions.module` suites green — the interactive `suggestCategory` path is untouched).
  Commit: `git add apps/api/src/modules/transactions/transactions.service.ts apps/api/src/modules/transactions/transactions-backfill.test.ts && git commit -m "feat(6-7): source-aware backfill (auto-apply bulk, suggest manual) + importCsv pass (FR-33 amended)"`

- [x] **T5 — `PekuloActivityRow`: grayscale `· IA` provenance hint** [AC: AC-6]
  In `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx`:
  (a) Add `Sparkles` to the lucide import (line ~5):
  ```ts
  import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
  ```
  (b) Add the `aiApplied` prop to `PekuloActivityRowProps` (after the `logo?` field, line ~23):
  ```ts
    // Story 6-7 (FR-33 amended) — the category was APPLIED by the LLM on a bulk
    // import (not user-set). Renders a grayscale "· IA" provenance hint after the
    // category. GRAYSCALE only — AI/control chrome never uses $accent/$success
    // (lesson 2026-05-07). The Sparkles glyph is decorative (aria-hidden); the
    // visible "IA" text carries the meaning for screen readers.
    aiApplied?: boolean;
  ```
  (c) Destructure it in the function signature (line ~26):
  ```ts
  export function PekuloActivityRow({ tx, categoryPrefix, logo, aiApplied }: PekuloActivityRowProps) {
  ```
  (d) Render the hint as a flex sibling AFTER the category `Text` (inside the caption `View`, after the `{tx.category}` Text, line ~60) — sibling, never nested in the running text (6-8 review pattern):
  ```tsx
          <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} numberOfLines={1}>
            {tx.category}
          </Text>
          {aiApplied ? (
            <>
              <Sparkles
                size={11}
                color="var(--colorTertiary)"
                aria-hidden
                style={{ marginLeft: 4, flexShrink: 0 }}
              />
              <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} marginLeft="$1">
                IA
              </Text>
            </>
          ) : null}
  ```
  (No new design token — `$colorTertiary` + `$xs` already exist, so `packages/ui/public/tamagui.generated.css` does NOT need regen, lesson 2026-05-24. If a later `bun --filter='@pekulo/ui' run test` flags a missing atomic class, run the project's tamagui CSS gen script and re-commit — flagged, not assumed.)
  Then add a case to `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.a11y.test.tsx` (append inside the existing `describe`, after the existing `it`):
  ```tsx
    it("renders the grayscale IA provenance hint when aiApplied, with no serious/critical violations", async () => {
      const { container } = renderWithTamagui(
        <PekuloActivityRow
          tx={{ label: "Carrefour", account: "CC", category: "Courses", direction: "out", amountEur: 42 }}
          aiApplied
        />,
      );
      expect(container.textContent).toContain("IA");
      const r = await axe(container);
      expect(
        (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
      ).toEqual([]);
    });
  ```
  Run: `bun --filter='@pekulo/ui' run test src/components/PekuloActivityRow/PekuloActivityRow.a11y.test.tsx`
  Expected: `✓ has no serious/critical violations`, `✓ renders the grayscale IA provenance hint when aiApplied, with no serious/critical violations` — pass.
  Then confirm no snapshot regression (the prop defaults off → existing snapshots unchanged): `bun --filter='@pekulo/ui' run test src/components/PekuloActivityRow/PekuloActivityRow.snapshot.test.tsx`
  Expected: existing snapshot test passes unchanged (0 obsolete, 0 failed).
  Commit: `git add packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.a11y.test.tsx && git commit -m "feat(6-7): PekuloActivityRow aiApplied provenance hint (FR-33 amended)"`

- [x] **T6 — Amend the AI transparency notice copy (suggested + applied + editable)** [AC: AC-2]
  In `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`, REPLACE the copy `Text` block (the `<Text color="$colorSecondary" fontSize="$xs">…</Text>` at lines ~42-46) and update the component doc-comment (lines ~8-12). The notice now covers BOTH contexts (it is mounted by the pending-suggestions section AND, for auto-applied imports, by Récentes — see T7). New body:
  ```tsx
        <Text color="$colorSecondary" fontSize="$xs">
          Vos catégories peuvent être suggérées — ou, pour vos imports (CSV / banque),
          appliquées automatiquement — par un modèle d'IA. Vous gardez le dernier mot :
          chaque catégorie reste modifiable à tout moment. Aucune donnée n'est envoyée à un
          modèle tiers sans votre accord (Paramètres → Intelligence artificielle).
        </Text>
  ```
  And REPLACE the doc-comment header (lines ~8-12) so it reflects the dual trigger:
  ```tsx
  // Story 6-4 (DR-12 / AC-3) + 6-7 (FR-33 amended / AC-2) — minimal AI
  // transparency notice. Shown ONCE (server flag ai_notice_seen_at) when the
  // user first encounters AI categorisation: either a pending suggestion
  // (suggestions section) OR an auto-applied import row (Récentes section, 6-7).
  // Marking it seen persists server-side so it never re-appears (survives reloads
  // + devices). The full EU-AI-Act notice + the opt-out→opt-in re-trigger are
  // owned by story 11-5. The parent decides WHEN to mount it (T7 guards against a
  // double-render when both pending + applied rows exist).
  ```
  Then update the assertion in `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx` that checks the copy — open the file, find the text-content assertion that matches the OLD copy fragment ("suggérées par un modèle d'IA" / "confirmez ou corrigez") and REPLACE the matched fragment with a stable substring of the new copy, e.g. `appliquées automatiquement`. (Inline the exact replacement once you read the file — the only change is the copy substring; the role/aria-label assertions stay.)
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`
  Expected: `Test Files 1 passed` — the notice still renders `role="note"` + the AI label, now matching the amended copy substring.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx" "apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx" && git commit -m "feat(6-7): AI notice copy covers auto-applied imports (DR-12 / AC-2)"`

- [x] **T7 — Récentes: provenance hint wiring + the auto-apply notice trigger** [AC: AC-2, AC-6]
  In `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`:
  (a) Add the imports — the notice + the pending hook (the pending total gates the single-render guarantee):
  ```ts
  import { AiTransparencyNotice } from "../../_llm/_components/ai-transparency-notice";
  import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";
  ```
  (b) Add a module-level pure predicate (after the `PAGE_SIZE` const, line ~88) — an auto-applied, not-yet-edited row:
  ```ts
  // Story 6-7 (FR-33 amended) — an AUTO-APPLIED (not yet user-edited) row: the
  // final category still equals the machine suggestion. A manual edit changes
  // `category` (suggested_* untouched on edit) → the predicate goes false and the
  // "· IA" hint disappears (AC-6). 'autre' rows and pending suggestions
  // (category === 'autre') are excluded.
  function isAiApplied(tx: Transaction): boolean {
    return (
      tx.category !== "autre" &&
      tx.suggestedCategory != null &&
      tx.category === tx.suggestedCategory
    );
  }
  ```
  (c) Inside `TransactionsRecentSection`, after `const { data, isLoading, error } = useTransactions(...)` (line ~96), read the pending total (cached — same `pending(1, month)` queryKey the suggestions section uses) + derive the notice gate:
  ```ts
    // Story 6-7 — the AI notice shows for an auto-applied batch ONLY when there
    // are no pending suggestions (the suggestions section owns the notice in the
    // pending case). This guarantees exactly one notice renders (no double-banner
    // on a first visit that has both pending + applied rows).
    const { data: pendingData } = usePendingSuggestions(1, undefined, month ?? undefined);
    const pendingTotal = pendingData?.totalCount ?? 0;
  ```
  (d) Inside the `{!showLoading && items.length > 0 && (...)}` block, derive `hasAiApplied` and mount the notice at the TOP of that block, before the `<View ... role="list">` (line ~192-193):
  ```tsx
        {!showLoading && items.length > 0 && (
          <>
            {items.some(isAiApplied) && pendingTotal === 0 ? <AiTransparencyNotice /> : null}
            <View flexDirection="column" role="list" aria-label="Liste des transactions">
  ```
  Then close the fragment opened in (d): the existing list block ends with `</View>\n      )}` (the `<View role="list">` closes, then the `)}` of the `{!showLoading && items.length > 0 && (` guard). REPLACE that closing `</View>\n      )}` with:
  ```tsx
            </View>
          </>
        )}
  ```
  (e) Pass `aiApplied` to `PekuloActivityRow` (line ~217-221) — REPLACE the existing call:
  ```tsx
                  <PekuloActivityRow
                    tx={activity}
                    categoryPrefix={categoryPrefix}
                    logo={<TransactionLogo src={tx.logoUrl} category={tx.category} />}
                    aiApplied={isAiApplied(tx)}
                  />
  ```
  Then update the two recent-section test files. The component now calls `usePendingSuggestions` (must resolve) and statically imports `AiTransparencyNotice` (whose `useAiNotice` would hit the unmocked llm-actions if it ever renders) — so stub both.
  In `transactions-recent-section.envelope.test.tsx`, ADD these two mocks alongside the existing `vi.mock("./month-scope-context", …)` (the notice is unit-tested in T6; here it's a sentinel so we can assert it mounts without pulling llm-actions):
  ```ts
  vi.mock("../_hooks/use-pending-suggestions", () => ({
    usePendingSuggestions: () => ({ data: { items: [], totalCount: 0, page: 1, pageSize: 10 } }),
  }));
  vi.mock("../../_llm/_components/ai-transparency-notice", () => ({
    AiTransparencyNotice: () => <span>__ai_notice__</span>,
  }));
  ```
  Then ADD this test INSIDE the existing `describe("TransactionsRecentSection envelope (AC-13)", …)` block (it reuses the file's `fixtureTx` + `listTransactionsMock` + `QueryClientProvider` + `renderWithTamagui` harness verbatim):
  ```tsx
    test("6-7 — auto-applied row shows the IA hint + mounts the notice when no pending", async () => {
      const autoApplied: Transaction = {
        ...fixtureTx,
        id: "tx_ccccccccccccccccccccc",
        label: "Spotify",
        category: "abonnements",
        suggestedCategory: "abonnements",
        suggestedConfidence: 0.81,
        suggestedRoute: "ollama",
      };
      listTransactionsMock.mockResolvedValueOnce({ items: [autoApplied], nextCursor: null });
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { findByText } = renderWithTamagui(
        <QueryClientProvider client={qc}>
          <TransactionsRecentSection />
        </QueryClientProvider>,
      );
      await findByText(/Spotify/);
      // T5 renders the literal "IA" provenance hint for an auto-applied row.
      await findByText("IA");
      // The notice mounts (sentinel) — auto-applied row present AND no pending.
      await findByText("__ai_notice__");
    });
  ```
  In `transactions-recent-section.a11y.test.tsx`, ADD ONLY the `use-pending-suggestions` mock (its fixtures are not auto-applied, so the notice never mounts there — no sentinel needed):
  ```ts
  vi.mock("../_hooks/use-pending-suggestions", () => ({
    usePendingSuggestions: () => ({ data: { items: [], totalCount: 0, page: 1, pageSize: 10 } }),
  }));
  ```
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`
  Expected: both files pass — the existing row/empty/error cases plus `✓ 6-7 — auto-applied row shows the IA hint + mounts the notice when no pending`; the a11y axe pass stays clean.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx" && git commit -m "feat(6-7): Récentes IA provenance hint + auto-apply notice trigger (AC-2/AC-6)"`

- [x] **T8 — Doc-sync (supersede the now-false épic-6 scope notes)** [AC: AC-1, AC-3]
  The mid-flight-scope doc-sync lesson (2026-05-31, reaffirmed 2026-06-02) makes these edits PART of the change, not an afterthought. 6-7 amends FR-33's bulk path + supersedes 6-2/6-4's "bulk keeps transfer-rule only / suggestions stay pending" claims.
  (a) `docs/stories/6-2-llm-categorise.md` — find the scope note stating bulk import keeps transfer-rule categorisation only / categorisation is create-path-only, and append (do NOT delete): `**Superseded by 6-7 (2026-06-02):** bulk import (csv/bridge) now AUTO-APPLIES the LLM category via the source-aware backfill; the create-path-only / suggest-only statement holds for source='manual' rows only.`
  (b) `docs/stories/6-4-llm-suggestion-ui.md` — in the Extension section that documents the import backfill, append: `**Amended by 6-7 (2026-06-02):** the import backfill now APPLIES the suggested category for csv/bridge rows (no pending state) via TransactionsRepository.applySuggestedCategory + the new transactions.source column; manual-origin rows keep the pending suggestion.`
  (c) `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md` — in the Consequences section, add a bullet: `Story 6-7 (FR-33 amended): bulk-import (source ∈ {csv, bridge}) transactions auto-apply the suggested category as the final category (category = suggestedCategory, suggested_* kept as provenance); interactive (source='manual') rows keep the suggestion→confirm flow. The categorise call is still audited identically (no new outcome row — the apply is a category write, not an LLM call).`
  (d) `docs/epics-context/epic-6-context.md` — under "Scope from PRD", on the FR-33 line, append `(amended bulk path owned by 6-7 — auto-apply on csv/bridge)`. Under "Previous stories — outcomes" leave 6-7 to `aped-review` (it appends on done). The "Lessons applicable" 6-7 fold is already present (compiled at story start).
  (e) `docs/lessons.md` — add a new top entry dated 2026-06-02 capturing the rule: bulk-import auto-categorisation needs an explicit origin signal (a `source` column), because CSV rows are indistinguishable from manual rows by `provider` alone (both null); a global backlog sweep must read origin to decide apply-vs-suggest, or it silently auto-applies interactive rows. (Scope: aped-arch, aped-dev, aped-review.) Write the full Mistake/Correction/Rule entry in the house format.
  Run: `bash .aped/scripts/validate-epic-context.sh docs/epics-context/epic-6-context.md`
  Expected: exit 0 (cache still conformant).
  Commit: `git add docs/stories/6-2-llm-categorise.md docs/stories/6-4-llm-suggestion-ui.md docs/adr/0008-llm-routing-server-audit-authority-async-attest.md docs/epics-context/epic-6-context.md docs/lessons.md && git commit -m "docs(6-7): supersede 6-2/6-4 bulk-suggest notes; ADR-0008 + lessons + cache sync (FR-33 amended)"`

- [x] **T9 — Cross-workspace typecheck + test sweep + visual verification** [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]
  Run, in order (each must be green before the next):
  ```bash
  bun --filter='@pekulo/validators' run typecheck
  bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run prisma:check && bun --filter='@pekulo/api' run test
  bun --filter='@pekulo/ui' run typecheck && bun --filter='@pekulo/ui' run test
  bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run test
  ```
  Expected: every workspace exits 0; `prisma:check` (format --check + validate) passes with the new `source` column; no test regresses across the suites.
  **Visual verification (frontend AC-2/AC-6):** per CLAUDE.md "frontend = visual verification", attempt `mcp__react-grab-mcp__get_element_context` on `/dashboard/transactions` to confirm (1) the `· IA` hint renders grayscale on an auto-applied row and (2) the amended notice renders once. If `react-grab-mcp` is unavailable (it has been offline for 6-3/6-4/6-8/6-9/6-10), record the WAIVER explicitly in the Dev Agent Record (static design-law pass: grayscale-only chrome, `role="note"`, Sparkles `aria-hidden`) — do NOT silently skip.
  Commit: no new code — if all green and nothing else changed, this task is verification only. If the sweep surfaced a fix, commit it as `fix(6-7): <what> (cross-workspace sweep)`.

## Dev Notes

### Context — how épic-6 categorisation works TODAY (read before designing)

The whole épic-6 flow produces **pending suggestions**, never an applied category:

- `TransactionsRepository.saveSuggestion` writes `suggested{Category,Confidence,Route,At}` + stamps `suggestedAttemptedAt`; **`category` stays `"autre"`** until the user confirms in 6-4 (`confirmCategorisation`).
- The interactive single-create path (`createTransaction`) fires `suggestCategoryImpl` (→ `saveSuggestion`) fire-and-forget off the hot path (NFR-1).
- **`importCsv` runs NO LLM pass** (transfer-rules only). **`importFromProvider` (Bridge)** fires `backfillSuggestionsImpl(limit=50)` post-sync → `saveSuggestion` (pending) over the **global** `listAutreWithoutAttempt` backlog.
- The **hourly sweep** (`backfillAllUsers` → `backfillSuggestionsImpl`) drains the global backlog as pending suggestions. It also catches interactive-create rows whose inline LLM call **failed** (still `autre`, never stamped).
- The pending list `listPendingByUser` filters `category = 'autre' AND suggestedCategory != null`. The DTO already carries `suggested*`.

**6-7's change:** on the bulk paths (`csv` / `bridge` origin), **APPLY** the suggested category directly (`category = suggestedCategory`), so the row lands in Récentes already categorised — no pending state. The interactive path keeps the suggestion→confirm flow (6-4).

### Locked design decisions (aped-story step 04)

1. **Origin column (user call — Option 2 over the no-migration variant).** A new `transactions.source` column (`'manual' | 'csv' | 'bridge'`) drives the policy: the categorisation engine **auto-applies for `csv`/`bridge`, suggests (pending) for `manual`**. This makes auto-apply *guaranteed* even when the LLM was down at import time (the hourly sweep auto-applies the bulk row later, because it reads `source`). `manual`-origin rows whose inline suggestion missed stay pending → the interactive confirm flow (AC-3) is strictly preserved.
2. **Apply-all confidence (no threshold).** Any suggestion with `confidence > 0` is applied (the model abstains → row stays `autre`, stamped). Matches the epic AC ("persisted with its suggested category") + the "correctable anytime" notice.
3. **Provenance hint (minimal).** Auto-applied rows show a grayscale `· IA` hint in Récentes (derived from `category === suggestedCategory`, NOT from `source` — `source` stays server-internal, out of the DTO).
4. **`source` is server-internal** — NOT added to the public `Transaction` DTO. No new oRPC procedure. The only contract-ish change is the notice copy string.

**Data-model invariant the design relies on (no extra query needed):** auto-apply sets `category = suggestedCategory` while **keeping** `suggested*` populated + stamping `suggestedAttemptedAt`. Because `category !== 'autre'`, the row is automatically: **excluded** from `listPendingByUser` (never appears in « Suggestions IA » / the « À confirmer » count); **present** in `listByUser` (Récentes) already categorised; **excluded** from `listAutreWithoutAttempt` (never re-swept). An auto-applied (not-yet-edited) row is identifiable by `category !== 'autre' && suggestedCategory !== null && category === suggestedCategory` — the provenance-hint predicate.

### Architecture / patterns to respect

- **Layer boundary (ADR-0010):** the categorisation engine lives in `TransactionsService`; `TransactionCategoriser` is the narrow port wired in `bootstrap/runtime-dependencies.ts` (the transactions module never imports `LlmService`). 6-7 adds NO cross-module import — it only adds a repository method + a branch in the existing engine.
- **Single suggestion writers:** `saveSuggestion` (pending) and now `applySuggestedCategory` (applied) are the only writers of the `suggested_*` columns + `category` (for the apply). Both guarded `where { category: 'autre' }` (idempotent; user category always wins — AC-5).
- **`source` is server-internal** — not in the `Transaction` DTO, not in any oRPC contract. The web provenance hint derives from `category === suggestedCategory` (already in the DTO).
- **No CHECK on `source`** (lesson 2026-05-27 — the universe {manual,csv,bridge} is enumerated in `@pekulo/validators#TRANSACTION_SOURCES` + app-layer validated; CHECK is law once shipped + expensive to relax). Mirrors the free-String `category`.
- **No RLS change** — `transactions` is an already-RLS'd user-data table (4 policies); a column add does not touch row-security. The Supabase `rls_disabled_in_public` advisor (lesson 2026-06-02) is N/A (the table is RLS-enabled).
- **`bun --filter='@pekulo/api'`** (lesson 2026-05-19), api tests import from `"bun:test"`, web/ui from `vitest` (lesson 2026-05-07). `prisma:generate` THEN typecheck after a schema edit (lesson 2026-06-01). Never `bun --cwd` (lesson 2026-05-05).
- **Grayscale chrome** (lesson 2026-05-07): the `· IA` hint uses `$colorTertiary` only — never `$accent`/`$success`/`$warning`.
- **Notice double-render guard** (lesson 2026-05-26 family): one mount in the suggestions section (pending), one in Récentes (auto-applied) gated on `pendingTotal === 0`. No `<Suspense>` added — both consume `useActionQuery` (loading via `isLoading`).

### Step-0 — existing code at write time (verbatim)

`apps/api/prisma/schema/transactions.prisma` — `Transaction` model (current; T2 adds `source` after `providerTransactionId`):
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
  suggestedCategory     String?         @map("suggested_category")
  suggestedConfidence   Float?          @map("suggested_confidence")
  suggestedRoute        String?         @map("suggested_route")
  suggestedAt           DateTime?       @map("suggested_at") @db.Timestamptz
  suggestedAttemptedAt  DateTime?       @map("suggested_attempted_at") @db.Timestamptz
  createdAt             DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime?       @default(now()) @map("updated_at") @db.Timestamptz
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  // …@@index lines + @@map("transactions")
}
```

`transactions.repository.ts` — `saveSuggestion` (the pending writer; `applySuggestedCategory` is its applied twin) + `listAutreWithoutAttempt` (the backlog read T3 augments with `source`):
```ts
async saveSuggestion(userId, txId, suggestion) {
  const { count } = await deps.client.transaction.updateMany({
    where: { id: txId, userId, category: "autre" },
    data: {
      suggestedCategory: suggestion.category,
      suggestedConfidence: suggestion.confidence,
      suggestedRoute: suggestion.route,
      suggestedAt: new Date(),
      suggestedAttemptedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return { saved: count > 0 };
},
// …
async listAutreWithoutAttempt(userId, limit) {
  const rows = (await deps.client.transaction.findMany({
    where: { userId, category: "autre", suggestedCategory: null, suggestedAttemptedAt: null },
    orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
    take: limit,
  })) as TransactionRow[];
  return rows.map(toDto);
},
```

`transactions.service.ts` — `importCsv` end (T4 adds the post-import categorise pass before the `return`):
```ts
    for (const row of rows) {
      try {
        await categoriseAfterCreateImpl({ userId, candidate: row, repository: deps.repository });
      } catch (err) {
        console.warn(`[5-3] categoriseAfterCreate failed for tx ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { ok: true as const, persisted };
```
`importFromProvider` already fires `backfillSuggestionsImpl(POST_SYNC_BACKFILL_LIMIT)` post-sync (no edit — inherits the source-aware behaviour). `createTransaction` fires `suggestCategoryImpl` (→ `saveSuggestion`, pending) — UNCHANGED.

`ai-transparency-notice.tsx` — current copy (T6 replaces it):
```tsx
<Text color="$colorSecondary" fontSize="$xs">
  Les catégories ci-dessous sont suggérées par un modèle d'IA. Vous gardez le dernier mot :
  confirmez ou corrigez chaque suggestion. Aucune donnée n'est envoyée à un modèle tiers sans
  votre accord (Paramètres → Intelligence artificielle).
</Text>
```

`PekuloActivityRow.tsx` — current caption row (T5 appends the `aiApplied` hint after `{tx.category}`):
```tsx
<View flexDirection="row" alignItems="center" minWidth={0}>
  <Text color="$colorTertiary" fontSize="$xs" flexShrink={1} minWidth={0} numberOfLines={1}>
    {tx.account} ·{" "}
  </Text>
  {categoryPrefix}
  <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} numberOfLines={1}>
    {tx.category}
  </Text>
</View>
```

`transactions-backfill.test.ts` — current `tx()` fixture has NO `source` field and the candidates default to the suggest path; T4 adds the `source` param + the `applySuggestedCategory` tracker (the existing four tests keep passing because default `source='manual'` and `toMatchObject` tolerates the new `applied:0` count).

### File decisions (one responsibility each)

- `packages/validators/src/transactions/transactions.schemas.ts` — **+** the `TRANSACTION_SOURCES` enum/schema/type (validators SSOT). In: zod. Out: const + schema + `TransactionSource`.
- `apps/api/prisma/schema/transactions.prisma` + `migrations/20260602160000_*` — **+** the `source` column + forward-only migration (ADD COLUMN + provider→bridge backfill).
- `apps/api/src/modules/transactions/transactions.repository.ts` — stamp `source` on bulk inserts; `applySuggestedCategory` (applied twin of `saveSuggestion`); `listAutreWithoutAttempt` surfaces `source`. In: Prisma client. Out: repo methods.
- `apps/api/src/modules/transactions/transactions.service.ts` — source-aware `backfillSuggestionsImpl` (apply bulk / suggest manual); `importCsv` post-import pass; `applied` counts. In: repository, categoriser port. Out: service methods.
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx` — **+** `aiApplied` prop → grayscale `· IA` hint. In: `Activity`, ReactNode slots. Out: the row.
- `apps/web/.../_llm/_components/ai-transparency-notice.tsx` — amended copy (suggested + applied). In: `useAiNotice`. Out: the once-gated note.
- `apps/web/.../transactions/_components/transactions-recent-section.tsx` — `isAiApplied` predicate, `aiApplied` wiring, the gated notice mount. In: `useTransactions`, `usePendingSuggestions`, `useMonthScope`. Out: the Récentes section.

### Testing

- **api** (`bun:test`, fake Prisma — no Postgres harness, 6-1 precedent): `transactions-autoapply.test.ts` (new — `applySuggestedCategory` query shape + `listAutreWithoutAttempt` source); `transactions-backfill.test.ts` (extended — source-aware apply/suggest + `importCsv` fire-and-forget flush via `await new Promise(r => setTimeout(r, 0))`).
- **ui** (`vitest`): `PekuloActivityRow.a11y.test.tsx` (new case — `· IA` hint text + axe clean); snapshot unchanged (prop defaults off).
- **web** (`vitest`): `ai-transparency-notice.test.tsx` (copy substring update); `transactions-recent-section.{envelope,a11y}.test.tsx` (mock `use-pending-suggestions`; new auto-applied-row render case).
- HTTP-boundary tests: 6-7 adds NO new endpoint (it changes existing import behaviour), so no new 401/integration test is required. The `importCsv`/Bridge routes already carry their 5-2 / 5-6 boundary coverage.

### Dependencies

- 6-2 (`categorise` port, `saveSuggestion`, `suggestCategory`) — done. 6-4 (`backfillSuggestions`/`backfillAllUsers`, `listAutreWithoutAttempt`, the import backfill + hourly scheduler, `ai_notice_seen_at` + `AiTransparencyNotice`, `usePendingSuggestions`) — done. No external libs. Ollama default per 6-4 (`qwen2.5:3b` local / Mistral Small prod).

### Commit prefix

`feat(6-7): …` (ticketless story; matches the 6-9 convention). Final PR is opened at `aped-ship` (ticket assigned then), per `epics.md`.

## File List

Expected create (C) / modify (M):

- **M** `packages/validators/src/transactions/transactions.schemas.ts` — `TRANSACTION_SOURCES` enum/schema/type (T1)
- **M** `apps/api/prisma/schema/transactions.prisma` — `source` column (T2)
- **C** `apps/api/prisma/migrations/20260602160000_add_transaction_source/migration.sql` — ADD COLUMN + provider→bridge backfill (T2)
- **M** `apps/api/src/modules/transactions/transactions.repository.ts` — `source` stamping, `applySuggestedCategory`, `listAutreWithoutAttempt` source (T3)
- **C** `apps/api/src/modules/transactions/transactions-autoapply.test.ts` — repo-level tests (T3)
- **M** `apps/api/src/modules/transactions/transactions.service.ts` — source-aware `backfillSuggestionsImpl`, `importCsv` pass, `applied` counts (T4)
- **M** `apps/api/src/modules/transactions/transactions-backfill.test.ts` — source-aware + `importCsv` fire-and-forget tests (T4)
- **M** `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx` — `aiApplied` provenance hint (T5)
- **M** `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.a11y.test.tsx` — `aiApplied` test (T5)
- **M** `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx` — amended copy (T6)
- **M** `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx` — copy substring (T6)
- **M** `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx` — `isAiApplied`, `aiApplied` wiring, gated notice mount (T7)
- **M** `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx` — pending mock + auto-applied case (T7)
- **M** `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx` — pending mock (T7)
- **M** doc-sync (T8): `docs/stories/6-2-llm-categorise.md`, `docs/stories/6-4-llm-suggestion-ui.md`, `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md`, `docs/epics-context/epic-6-context.md`, `docs/lessons.md`

## Dev Agent Record

- **Model:** claude-opus-4-8[1m] (Opus 4.8, 1M context)
- **Started:** 2026-06-02
- **Completed:** 2026-06-02

### Summary

Shipped FR-33's amended bulk path. A server-internal `transactions.source` column (`manual|csv|bridge`) drives a source-aware backfill: bulk-import (csv/bridge) rows AUTO-APPLY the LLM category as the final category (no pending state, idempotent `where category='autre'` so a user category always wins — AC-5), while `manual` rows keep the 6-4 suggestion→confirm flow (AC-3). `importCsv` now fires the categorise pass it previously lacked (off the response path, NFR-1); `importFromProvider` + the hourly sweep inherit the new behaviour. The web Récentes shows a grayscale `· IA` provenance hint derived from `category === suggestedCategory` (source stays out of the public DTO) and a once-gated transparency notice that now covers auto-applied imports (mounted only when `pendingTotal === 0`, so no double-banner). Scope held — no new oRPC procedure, no DTO field. The migration was applied to the live Supabase DB at the user's request.

### Files changed

- `packages/validators/src/transactions/transactions.schemas.ts`
- `apps/api/prisma/schema/transactions.prisma`
- `apps/api/prisma/migrations/20260602160000_add_transaction_source/migration.sql`
- `apps/api/src/modules/transactions/transactions.repository.ts`
- `apps/api/src/modules/transactions/transactions-autoapply.test.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
- `apps/api/src/modules/transactions/transactions-backfill.test.ts`
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.tsx`
- `packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.a11y.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.tsx`
- `apps/web/src/app/(cap)/dashboard/_llm/_components/ai-transparency-notice.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx`
- `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`
- `docs/stories/6-2-llm-categorise.md`
- `docs/stories/6-4-llm-suggestion-ui.md`
- `docs/adr/0008-llm-routing-server-audit-authority-async-attest.md`
- `docs/epics-context/epic-6-context.md`
- `docs/lessons.md`

### Deviations

- **T3 test (tsc-only fix):** the story's verbatim `updateMany.mock.calls[0]![0] as {…}` failed typecheck (TS2352 + TS2493 — the no-arg mock infers an empty-tuple args type). Corrected to `(updateMany.mock.calls[0]! as unknown[])[0] as {…}` — same class as the documented 6-2 "empty-tuple index → as unknown" deviation.
- **T4 test:** the story assumed the existing `no categoriser wired → no-op` test would keep passing, but it asserts the counts with `toEqual` (exact). Added `applied: 0` to its expected object — the counts contract gained `applied`.
- **T6 test:** the story instructed replacing a copy-substring assertion in `ai-transparency-notice.test.tsx`, but no copy assertion existed (the 3 tests only check `role="note"` + the once-logic). Added a new AC-2 copy test asserting `appliquées automatiquement` + `modifiable` instead of replacing.
- **Migration applied to the live DB** (`prisma migrate deploy`, via DIRECT_URL session pooler) at the user's explicit request — the story had scoped it as dev-loop-optional (api tests use a fake Prisma).
- **Visual verification WAIVED** (T5/T6/T7 GREEN gates + T9): `react-grab-mcp` offline (as in 6-3/6-4/6-8/6-9/6-10). Static design-law pass clean: grayscale chrome only (`$colorTertiary`/`var(--colorTertiary)`, zero `$accent`/`$success`/`$warning`), Sparkles `aria-hidden`, `role="note"` + `aria-label` on the notice, axe clean across the a11y suites.

### Test output

Cross-workspace sweep (T9), all green:

```
validators typecheck: exit 0
api typecheck: exit 0 · prisma:check: valid 🚀 · test: 799 pass, 0 fail (95 files)
ui typecheck: exit 0 · test: 213 pass, 1 skipped (125 files)
web typecheck: exit 0 · test: 167 pass (74 files)
```

New/changed coverage: `transactions-autoapply.test.ts` (3) · `transactions-backfill.test.ts` (+2: csv/bridge auto-apply, importCsv pass) · `PekuloActivityRow.a11y.test.tsx` (+1 IA hint) · `ai-transparency-notice.test.tsx` (+1 AC-2 copy) · `transactions-recent-section.envelope.test.tsx` (+1 auto-applied row + notice).
