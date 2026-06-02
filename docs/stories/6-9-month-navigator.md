# Story: 6-9-month-navigator — Month navigator for transactions + stat cards

**Epic:** Epic 6 — LLM auto-categorisation (transaction-enrichment bucket)
**Status:** done
**Ticket:** none — assigned at scheduling / `aped-ship` time (per `epics.md`)
**Branch:** feature/none-6-9-month-navigator
**Covered FRs:** FR-64
**Complexity:** M

## User Story

**As a** Pekulo user, **I want** to browse my transactions and monthly stat cards month by month, **so that** the Net/Entrées/Sorties reflect a chosen month instead of only the current (often empty) one.

## Acceptance Criteria

- **AC-1 — default = most recent month with activity.** **Given** the user has transactions only in February while today is June, **When** the transactions page loads with no `?month` in the URL, **Then** the navigator shows « février 2026 », the stat cards show February's real Net/Entrées/Sorties (server-aggregated), and the Récentes list shows only February's transactions.
- **AC-2 — prev/next re-scopes both surfaces.** **Given** the navigator on a given month, **When** I press ‹ (précédent) or › (suivant), **Then** `?month` updates and BOTH the stat cards AND the Récentes list re-scope to the newly selected month.
- **AC-3 — empty-DB fallback.** **Given** a user with zero transactions, **When** the page loads, **Then** the navigator defaults to the current calendar month (UTC), the stat cards show Net/Entrées/Sorties = 0 €, and Récentes shows its empty-state message.
- **AC-4 — no truncation on older months.** **Given** many more recent transactions than the selected month holds, **When** I navigate to that older month, **Then** the stat cards AND the Récentes list show that month's data in full, regardless of how many newer transactions exist.
- **AC-5 — deep-link + back-button.** **Given** the URL `/dashboard/transactions?month=2026-02`, **When** I open it directly, **Then** the page loads scoped to February (navigator + stats + Récentes); **And** after pressing › to March, the browser Back button returns the view to February.
- **AC-6 — transfers excluded from the totals.** **Given** a month containing internal transfer transactions, **When** the stat cards render, **Then** Entrées/Sorties exclude those transfers (consistent with the Mensuel page), so Net = Entrées − Sorties with transfers omitted.

## Tasks

- [x] **T1 — Add the month-key + month-summary schemas to the validators SSOT** [AC: AC-1, AC-4, AC-6]
  In `packages/validators/src/transactions/transactions.schemas.ts`, add the month-key schema right after the `ISO_DATE_REGEX` / `isoDateString` block (after the `amountSchema` helper, before the `// ─── DTO` section):
  ```ts
  // ─── Month key (story 6-9, FR-64) ────────────────────────────────────────
  // Calendar-month key "YYYY-MM" — shape-validates the year + a 01–12 month.
  // The day is intentionally absent: the server expands it to a half-open
  // [monthStart, nextMonthStart) UTC range (mirrors monthly.repository's
  // firstDayOfMonthUTC / firstDayOfNextMonthUTC). Used by the month navigator.
  const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
  export const monthKeySchema = z.string().regex(MONTH_KEY_REGEX, "Mois YYYY-MM requis");
  export type MonthKey = z.infer<typeof monthKeySchema>;
  ```
  Then REPLACE `listTransactionsInputSchema` (currently lines ~165-170) with the version below (adds the optional `month` field — everything else is byte-identical):
  ```ts
  export const listTransactionsInputSchema = z.object({
    limit: z.number().int().min(1).max(200).optional().default(50),
    cursor: z.string().optional(), // opaque base64url(`${occurredOnISO}|${id}`)
    accountId: z.string().regex(ACCOUNT_ID_REGEX).optional(),
    // Story 6-9 (FR-64) — calendar-month scope. When present, listByUser filters
    // occurredOn to [monthStart, nextMonthStart) UTC; cursor pagination still
    // applies WITHIN the month. Absent = the unscoped recent window (pre-6-9
    // behaviour — the pending-suggestions poll + any non-month caller keep it).
    month: monthKeySchema.optional(),
  });
  export type ListTransactionsInput = z.infer<typeof listTransactionsInputSchema>;
  ```
  Then add the month-summary schemas immediately AFTER `listTransactionsOutputSchema` / `ListTransactionsOutput` (after line ~176, before the `// ─── Envelope` section):
  ```ts
  // ─── Month summary (story 6-9, FR-64) ────────────────────────────────────
  // The navigator's stat cards (Net / Entrées / Sorties), server-aggregated over
  // the WHOLE month so >200-tx months are exact (AC-4), reusing the /mensuel pure
  // derive so transfers are EXCLUDED (AC-6). `month` omitted on input = the server
  // resolves the most recent month with activity (current calendar month when the
  // user has none). The resolved month is echoed back so the client seeds the
  // navigator without a second round-trip.
  export const monthSummaryInputSchema = z.object({
    month: monthKeySchema.optional(),
  });
  export type MonthSummaryInput = z.infer<typeof monthSummaryInputSchema>;

  export const monthSummaryOutputSchema = z.object({
    month: monthKeySchema,
    incomeEur: z.number(),
    spendingEur: z.number(),
    netChangeEur: z.number(),
  });
  export type MonthSummaryOutput = z.infer<typeof monthSummaryOutputSchema>;
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: exit 0, no TS errors.
  Commit: `git add packages/validators/src/transactions/transactions.schemas.ts && git commit -m "feat(6-9): month-key + monthSummary schemas, list month scope (FR-64)"`

- [x] **T2 — Add the `monthSummary` procedure to the transactions oRPC contract** [AC: AC-1]
  In `packages/contracts/src/transactions/transactions.contract.ts`, add `monthSummaryInputSchema` + `monthSummaryOutputSchema` to the `@pekulo/validators` import block (keep the existing alphabetical-ish grouping), then add the procedure to `transactionsContractV1` right after `listTransactions` (line ~62):
  ```ts
    monthSummary: oc.input(monthSummaryInputSchema).output(monthSummaryOutputSchema),
  ```
  The import block gains:
  ```ts
    monthSummaryInputSchema,
    monthSummaryOutputSchema,
  ```
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: exit 0, no TS errors.
  Commit: `git add packages/contracts/src/transactions/transactions.contract.ts && git commit -m "feat(6-9): monthSummary procedure on transactions contract (FR-64)"`

- [x] **T3 — Month-range filter + activity-month + whole-month read in the repository** [AC: AC-1, AC-4, AC-6]
  In `apps/api/src/modules/transactions/transactions.repository.ts`:
  (a) Add these two methods to the `TransactionsRepository` interface (after `listByUser(...)`, line ~76):
  ```ts
    /** Story 6-9 (FR-64) — the most recent month with activity as "YYYY-MM",
     *  null when the user has zero transactions. Drives the navigator default. */
    latestActivityMonth(userId: string): Promise<string | null>;
    /** Story 6-9 (FR-64) — ALL of a month's transactions (no pagination) for the
     *  server-side stat aggregate. A month is bounded in practice (Persona #1
     *  ≤200 tx/month); the whole-month read keeps the /mensuel pure-derive reuse
     *  exact (semantic SSOT). */
    listAllForMonth(userId: string, month: string): Promise<Transaction[]>;
  ```
  (b) Add this pure helper next to `decodeCursor` (after line ~229, before `createTransactionsRepository`):
  ```ts
  // Story 6-9 — "YYYY-MM" → half-open UTC range [start, nextMonth). Mirrors
  // monthly.repository.firstDayOfMonthUTC / firstDayOfNextMonthUTC.
  function monthKeyToRange(month: string): { start: Date; end: Date } {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
    return { start, end };
  }
  ```
  (c) REPLACE the `listByUser` `where` construction (currently lines ~312-326) with the version below — adds the month range ANDed with the existing cursor OR (Prisma ANDs the top-level `occurredOn` range with the `OR`, so cursor pagination still applies within the month):
  ```ts
      const monthRange = input.month ? monthKeyToRange(input.month) : null;
      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(monthRange ? { occurredOn: { gte: monthRange.start, lt: monthRange.end } } : {}),
        ...(decoded
          ? {
              OR: [
                { occurredOn: { lt: new Date(decoded.occurredOn) } },
                {
                  occurredOn: new Date(decoded.occurredOn),
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      };
  ```
  (d) Add the two new method implementations inside the returned object literal, right after `listByUser` (after line ~340):
  ```ts
      async latestActivityMonth(userId) {
        const row = (await deps.client.transaction.findFirst({
          where: { userId },
          orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
          select: { occurredOn: true },
        })) as { occurredOn: Date } | null;
        return row ? row.occurredOn.toISOString().slice(0, 7) : null;
      },

      async listAllForMonth(userId, month) {
        const { start, end } = monthKeyToRange(month);
        const rows = (await deps.client.transaction.findMany({
          where: { userId, occurredOn: { gte: start, lt: end } },
          orderBy: [{ occurredOn: "asc" }, { id: "asc" }],
        })) as TransactionRow[];
        return rows.map(toDto);
      },
  ```
  Then create the test file `apps/api/src/modules/transactions/transactions-month.test.ts`:
  ```ts
  // apps/api/src/modules/transactions/transactions-month.test.ts
  // bun:test — story 6-9 (FR-64). Repository month-range scoping + the
  // monthSummary service derive. Minimal fakes (no Postgres harness, per the
  // 6-1 fake-Prisma precedent — RLS coverage stays in db:rls-audit).

  import { describe, expect, mock, test } from "bun:test";
  import type { Transaction } from "@pekulo/validators";
  import { createTransactionsRepository } from "./transactions.repository";
  import {
    createTransactionsService,
    type AccountOwnershipProbe,
    type AccountResolver,
    type TransactionsRepository,
  } from "./transactions.service";
  import type { ExtendedPrismaClient } from "../../database";

  function fakeClient(rows: { occurredOn: Date }[] = []) {
    const findMany = mock(async (_args: { where?: unknown; take?: number }) => rows);
    const findFirst = mock(async (_args: unknown) => rows[0] ?? null);
    return {
      client: { transaction: { findMany, findFirst } } as unknown as ExtendedPrismaClient,
      findMany,
      findFirst,
    };
  }

  describe("repository — month scope (6-9)", () => {
    test("listByUser scopes occurredOn to the [monthStart, nextMonth) range", async () => {
      const { client, findMany } = fakeClient([]);
      const repo = createTransactionsRepository({ client });
      await repo.listByUser("u_a", { limit: 50, month: "2026-02" });
      const where = (findMany.mock.calls[0]![0] as { where: { occurredOn: { gte: Date; lt: Date } } })
        .where;
      expect(where.occurredOn.gte).toEqual(new Date(Date.UTC(2026, 1, 1)));
      expect(where.occurredOn.lt).toEqual(new Date(Date.UTC(2026, 2, 1)));
    });

    test("latestActivityMonth returns YYYY-MM of the newest row, null when empty", async () => {
      const withRow = createTransactionsRepository({
        client: fakeClient([{ occurredOn: new Date("2026-02-15T00:00:00Z") }]).client,
      });
      expect(await withRow.latestActivityMonth("u_a")).toBe("2026-02");
      const empty = createTransactionsRepository({ client: fakeClient([]).client });
      expect(await empty.latestActivityMonth("u_a")).toBeNull();
    });

    test("listAllForMonth queries the whole month (year rollover) with no take", async () => {
      const { client, findMany } = fakeClient([]);
      const repo = createTransactionsRepository({ client });
      await repo.listAllForMonth("u_a", "2026-12");
      const args = findMany.mock.calls[0]![0] as { where: { occurredOn: { gte: Date; lt: Date } }; take?: number };
      expect(args.where.occurredOn.gte).toEqual(new Date(Date.UTC(2026, 11, 1)));
      expect(args.where.occurredOn.lt).toEqual(new Date(Date.UTC(2027, 0, 1)));
      expect(args.take).toBeUndefined();
    });
  });

  // ─── monthSummary service (T4) ───────────────────────────────────────────
  const tx = (over: Partial<Transaction>): Transaction =>
    ({
      id: "tx_aaaaaaaaaaaaaaaaaaaaa",
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-02-10",
      label: "x",
      amount: 0,
      type: "inflow",
      category: "autre",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      createdAt: "2026-02-10T00:00:00Z",
      ...over,
    }) as Transaction;

  const fakeRepo = (over: Partial<TransactionsRepository>): TransactionsRepository =>
    ({
      latestActivityMonth: async () => null,
      listAllForMonth: async () => [],
      ...over,
    }) as unknown as TransactionsRepository;

  const stubProbe = {} as AccountOwnershipProbe;
  const stubResolver = {} as AccountResolver;
  const svcWith = (repo: TransactionsRepository) =>
    createTransactionsService({
      repository: repo,
      accountOwnershipProbe: stubProbe,
      accountResolver: stubResolver,
    });

  describe("service — monthSummary (6-9)", () => {
    test("derives aggregates over the given month, excluding transfers (AC-6)", async () => {
      const repo = fakeRepo({
        listAllForMonth: async () => [
          tx({ type: "inflow", category: "salaire", amount: 3000 }),
          tx({ type: "outflow", category: "courses", amount: 200 }),
          tx({ type: "outflow", category: "transfer", amount: 500 }),
          tx({ type: "inflow", category: "transfer", amount: 500 }),
        ],
      });
      const out = await svcWith(repo).monthSummary("u_a", { month: "2026-02" });
      expect(out).toEqual({ month: "2026-02", incomeEur: 3000, spendingEur: 200, netChangeEur: 2800 });
    });

    test("resolves the latest activity month when none provided (AC-1)", async () => {
      const repo = fakeRepo({
        latestActivityMonth: async () => "2026-02",
        listAllForMonth: async (_u, m) => {
          expect(m).toBe("2026-02");
          return [];
        },
      });
      expect((await svcWith(repo).monthSummary("u_a", {})).month).toBe("2026-02");
    });

    test("falls back to the current UTC month with zero totals when empty (AC-3)", async () => {
      const now = new Date();
      const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const out = await svcWith(fakeRepo({})).monthSummary("u_a", {});
      expect(out).toEqual({ month: expected, incomeEur: 0, spendingEur: 0, netChangeEur: 0 });
    });
  });
  ```
  (The `monthSummary` service method lands in T4 — the `service — monthSummary` describe block stays RED until then; this commit ships the repository describe green and the service describe as the next task's failing target.)
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the suite prints `✓ listByUser scopes occurredOn to the [monthStart, nextMonth) range`, `✓ latestActivityMonth returns YYYY-MM of the newest row, null when empty`, `✓ listAllForMonth queries the whole month (year rollover) with no take`; the three `service — monthSummary` cases fail (method not implemented yet — T4 makes them green). No other suite regresses.
  Commit: `git add apps/api/src/modules/transactions/transactions.repository.ts apps/api/src/modules/transactions/transactions-month.test.ts && git commit -m "feat(6-9): repository month-range + latestActivityMonth + listAllForMonth (FR-64)"`

- [x] **T4 — `monthSummary` service method (reuses the /mensuel pure derive)** [AC: AC-1, AC-3, AC-6]
  In `apps/api/src/modules/transactions/transactions.service.ts`:
  (a) Add `deriveMonthlyAggregates` to the imports (next to the other `../../common/derive/*` imports, after line ~46):
  ```ts
  import { deriveMonthlyAggregates } from "../../common/derive/monthly-aggregates";
  ```
  (b) Add the input/output types to the `@pekulo/validators` type import block (after line ~41):
  ```ts
    MonthSummaryInput,
    MonthSummaryOutput,
  ```
  (c) Add the method to the `TransactionsService` interface (after the `listTransactions(...)` line ~140):
  ```ts
    /** Story 6-9 (FR-64) — the navigator's stat-card aggregate for a month.
     *  `input.month` omitted → resolve the most recent month with activity
     *  (current UTC month when the user has none). Aggregates the WHOLE month
     *  server-side via the shared /mensuel pure derive (transfers excluded). */
    monthSummary(userId: string, input: MonthSummaryInput): Promise<MonthSummaryOutput>;
  ```
  (d) Add this module-level helper next to `generateTransferPairId` (after line ~203):
  ```ts
  // Story 6-9 — current calendar month as "YYYY-MM" in UTC (mirrors monthly's
  // currentMonthUTC). The empty-DB navigator default (AC-3).
  function currentMonthKeyUTC(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  ```
  (e) Add the method implementation inside the returned object literal, right after `listTransactions` (after line ~425):
  ```ts
      async monthSummary(userId, input) {
        const month =
          input.month ?? (await deps.repository.latestActivityMonth(userId)) ?? currentMonthKeyUTC();
        const transactions = await deps.repository.listAllForMonth(userId, month);
        const { incomeEur, spendingEur, netChangeEur } = deriveMonthlyAggregates({ transactions });
        return { month, incomeEur, spendingEur, netChangeEur };
      },
  ```
  Run: `bun --filter='@pekulo/api' run test`
  Expected: the three `service — monthSummary` cases now pass — `✓ derives aggregates over the given month, excluding transfers (AC-6)`, `✓ resolves the latest activity month when none provided (AC-1)`, `✓ falls back to the current UTC month with zero totals when empty (AC-3)`. Whole api suite green (0 fail).
  Commit: `git add apps/api/src/modules/transactions/transactions.service.ts && git commit -m "feat(6-9): monthSummary service via deriveMonthlyAggregates (FR-64)"`

- [x] **T5 — Wire the `monthSummary` route handler** [AC: AC-1]
  In `apps/api/src/modules/transactions/transactions.routes.ts`, add the handler inside `impl.router({ ... })` right after the `listTransactions` handler (after line ~86). It is a thin read pass-through (no typed contract error), same shape as `listTransactions` / `listPendingSuggestions`:
  ```ts
      monthSummary: impl.monthSummary.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.monthSummary(context.userId, input);
      }),
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: exit 0 — the router now satisfies the full `transactionsContract` (a missing handler would be a TS error since `implement(contract)` requires every procedure).
  Commit: `git add apps/api/src/modules/transactions/transactions.routes.ts && git commit -m "feat(6-9): monthSummary route handler (FR-64)"`
  > NOTE (for aped-qa / aped-review): add the HTTP-boundary test for `monthSummary` (401 <100 ms on missing JWT + per-user isolation) to `apps/api/src/modules/transactions/transactions.integration.test.ts`, mirroring the 401 coverage 6-3/6-4 review added for their new read endpoints. Not built here to avoid guessing the integration boot harness; flagged explicitly (no silent gap).

- [x] **T6 — Extend the transactions feature keys (month dimension + monthSummary)** [AC: AC-2, AC-4]
  In `apps/web/src/lib/zapaction/keys.ts`, REPLACE the `transactionsKeys` factory (lines ~91-104) with the version below. `list` gains a `month` segment so a month-scoped read caches separately from the unscoped recent window; `monthSummary` is the stat-card aggregate key. No registry edge change — the existing `[TRANSACTIONS_KEY]` bare-prefix edge (lines ~205-206) already invalidates every sub-key (same reasoning as `pending`):
  ```ts
  export const TRANSACTIONS_KEY = "transactions" as const;
  export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
    // `limit` AND `month` are part of the queryKey: the Récentes section (50,
    // month-scoped) and any unscoped caller must not collide. month ?? "all" =
    // the pre-6-9 unscoped window. Mirrors compassKeys.history(limit?).
    list: (limit?: number, month?: string) => ["list", limit ?? 50, month ?? "all"] as const,
    byId: (id: string) => ["byId", id] as const,
    pending: (page?: number) => ["pending", page ?? 1] as const,
    // Story 6-9 (FR-64) — month-scoped stat-card aggregate. month undefined =
    // the server-resolved default (latest activity month); keyed "default" so it
    // caches separately from explicit months and refreshes when activity changes.
    monthSummary: (month?: string) => ["monthSummary", month ?? "default"] as const,
  });
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0 (the existing `transactionsKeys.list(limit)` callers keep working — the second arg is optional).
  Commit: `git add apps/web/src/lib/zapaction/keys.ts && git commit -m "feat(6-9): transactions keys gain month + monthSummary (FR-64)"`

- [x] **T7 — Add the `monthSummary` server action** [AC: AC-1]
  In `apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts`, add `monthSummaryInputSchema`, `monthSummaryOutputSchema`, and the `MonthSummaryInput` / `MonthSummaryOutput` types to the `@pekulo/validators` import block, then add this action right after `listTransactions` (after line ~68). It is a read — it KEEPS `output:` (no `{ ok:false }` envelope, so the 2026-05-20 lesson does not apply):
  ```ts
  export const monthSummary = defineAction<MonthSummaryInput, MonthSummaryOutput, ActionContext>({
    name: "monthSummary",
    input: monthSummaryInputSchema,
    output: monthSummaryOutputSchema,
    handler: async ({ input }) => {
      await ensureRequestContext();
      return transactionsClient.monthSummary(input);
    },
  });
  ```
  Import block additions:
  ```ts
    monthSummaryInputSchema,
    monthSummaryOutputSchema,
    type MonthSummaryInput,
    type MonthSummaryOutput,
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_actions/transactions-actions.ts" && git commit -m "feat(6-9): monthSummary server action (FR-64)"`

- [x] **T8 — Thread `month` through `useTransactions`** [AC: AC-2, AC-4]
  REPLACE the whole body of `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-transactions.ts` with:
  ```ts
  "use client";

  import { useActionQuery } from "@zapaction/query";
  import { transactionsKeys } from "@/lib/zapaction/keys";
  import { listTransactions } from "../_actions/transactions-actions";

  // Story 6-9 (FR-64) — `month` ("YYYY-MM") scopes the list server-side. Absent
  // = the unscoped recent window (pre-6-9 callers unchanged). The queryKey
  // carries `month` so each month caches independently.
  export function useTransactions(limit = 50, month?: string) {
    return useActionQuery(listTransactions, {
      input: month ? { limit, month } : { limit },
      queryKey: transactionsKeys.list(limit, month),
      readPolicy: "read-only",
      staleTime: 30_000,
    });
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-transactions.ts" && git commit -m "feat(6-9): useTransactions accepts a month scope (FR-64)"`

- [x] **T9 — Add the `useMonthSummary` query hook** [AC: AC-1]
  Create `apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-month-summary.ts`:
  ```ts
  "use client";

  import { useActionQuery } from "@zapaction/query";
  import { transactionsKeys } from "@/lib/zapaction/keys";
  import { monthSummary } from "../_actions/transactions-actions";

  // Story 6-9 (FR-64) — stat-card aggregate for the active month. `month`
  // undefined → the server resolves the latest activity month (AC-1) and echoes
  // it back in `data.month`; the provider reads that to seed the navigator.
  export function useMonthSummary(month?: string) {
    return useActionQuery(monthSummary, {
      input: month ? { month } : {},
      queryKey: transactionsKeys.monthSummary(month),
      readPolicy: "read-only",
      staleTime: 30_000,
    });
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_hooks/use-month-summary.ts" && git commit -m "feat(6-9): useMonthSummary hook (FR-64)"`

- [x] **T10 — Pure month-key helpers + unit tests** [AC: AC-2, AC-5, AC-6]
  Create `apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.ts` (pure — no React, no nuqs, no clock, so it is unit-testable in isolation):
  ```ts
  // apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.ts
  // Pure calendar-month-key helpers (story 6-9, FR-64). "YYYY-MM" string maths +
  // FR labels. No React / nuqs / clock — kept separate so the navigator logic is
  // testable without the nuqs adapter.

  export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

  export function isMonthKey(value: string | null | undefined): value is string {
    return typeof value === "string" && MONTH_KEY_REGEX.test(value);
  }

  /** Step `month` by `delta` whole months, rolling over year boundaries. */
  export function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number);
    const ordinal = y * 12 + (m - 1) + delta;
    const year = Math.floor(ordinal / 12);
    const monthNum = (ordinal % 12) + 1;
    return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
  }

  const longFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
  const shortFmt = new Intl.DateTimeFormat("fr-FR", { month: "long" });

  // Day 1 at UTC noon — avoids any tz rollback to the previous month on format.
  function monthDate(month: string): Date {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1, 12));
  }

  /** "février 2026" — the navigator label. */
  export function formatMonthLong(month: string): string {
    return longFmt.format(monthDate(month));
  }

  /** "févr." — the stat-card caption suffix (matches the pre-6-9 3-char form). */
  export function formatMonthShort(month: string): string {
    return shortFmt.format(monthDate(month)).slice(0, 4).replace(/\.$/, "");
  }
  ```
  Create `apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.test.ts`:
  ```ts
  import { describe, expect, test } from "vitest";
  import { formatMonthLong, isMonthKey, shiftMonth } from "./month-key";

  describe("month-key (6-9)", () => {
    test("shiftMonth steps within a year", () => {
      expect(shiftMonth("2026-05", -1)).toBe("2026-04");
      expect(shiftMonth("2026-05", 1)).toBe("2026-06");
    });
    test("shiftMonth rolls over year boundaries", () => {
      expect(shiftMonth("2026-01", -1)).toBe("2025-12");
      expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    });
    test("isMonthKey accepts YYYY-MM, rejects junk", () => {
      expect(isMonthKey("2026-02")).toBe(true);
      expect(isMonthKey("2026-13")).toBe(false);
      expect(isMonthKey("2026-02-01")).toBe(false);
      expect(isMonthKey(null)).toBe(false);
    });
    test("formatMonthLong renders the French month + year", () => {
      expect(formatMonthLong("2026-02")).toBe("février 2026");
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/month-key.test.ts`
  Expected: `✓ shiftMonth steps within a year`, `✓ shiftMonth rolls over year boundaries`, `✓ isMonthKey accepts YYYY-MM, rejects junk`, `✓ formatMonthLong renders the French month + year` — `Test Files 1 passed`.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.ts" "apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.test.ts" && git commit -m "feat(6-9): pure month-key helpers + tests (FR-64)"`

- [x] **T11 — Month-scope provider (nuqs URL state, single source of the active month)** [AC: AC-1, AC-2, AC-5]
  Create `apps/web/src/app/(cap)/dashboard/transactions/_components/month-scope-context.tsx`:
  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/transactions/_components/month-scope-context.tsx
  // Story 6-9 (FR-64) — the SINGLE source of the active month, shared by the
  // navigator, the stat cards and the Récentes list. URL is the SSOT (`?month=`)
  // via nuqs so the view is shareable + back-button-correct (AC-5). The default
  // is DYNAMIC (server-resolved latest activity month), so we do NOT use a static
  // parser default: month = (valid ?month) ?? summary.month. The default is never
  // written to the URL on mount (no effect, no parasitic history entry) — the
  // first prev/next click writes the concrete month with history:"push".
  //
  // nuqs reads useSearchParams under the hood → this provider MUST render under a
  // <Suspense> ancestor (page.tsx, T15) or the whole route bails to CSR
  // (lesson 2026-05-26). Requires <NuqsAdapter> at the app root (layout.tsx, T16).

  import { createContext, useContext, useMemo, type ReactNode } from "react";
  import { parseAsString, useQueryState } from "nuqs";
  import type { MonthSummaryOutput } from "@pekulo/validators";
  import { useMonthSummary } from "../_hooks/use-month-summary";
  import { isMonthKey, shiftMonth } from "./month-key";

  export interface MonthScope {
    /** Active month "YYYY-MM". null only on the first paint before the summary
     *  resolves AND the URL is empty. */
    month: string | null;
    summary: MonthSummaryOutput | undefined;
    isLoading: boolean;
    setMonth: (month: string) => void;
    goPrev: () => void;
    goNext: () => void;
  }

  const MonthScopeContext = createContext<MonthScope | null>(null);

  export function MonthScopeProvider({ children }: { children: ReactNode }) {
    const [rawMonth, setRawMonth] = useQueryState("month", parseAsString);
    const urlMonth = isMonthKey(rawMonth) ? rawMonth : null;
    // month omitted → server resolves the latest activity month (or current
    // calendar month). A valid ?month is passed through so the summary + Récentes
    // share the same scope.
    const { data: summary, isLoading } = useMonthSummary(urlMonth ?? undefined);
    const month = urlMonth ?? summary?.month ?? null;

    const value = useMemo<MonthScope>(() => {
      // history:"push" so Back returns to the previously viewed month (AC-5).
      const setMonth = (next: string) => void setRawMonth(next, { history: "push" });
      return {
        month,
        summary,
        isLoading,
        setMonth,
        goPrev: () => {
          if (month) setMonth(shiftMonth(month, -1));
        },
        goNext: () => {
          if (month) setMonth(shiftMonth(month, 1));
        },
      };
    }, [month, summary, isLoading, setRawMonth]);

    return <MonthScopeContext.Provider value={value}>{children}</MonthScopeContext.Provider>;
  }

  export function useMonthScope(): MonthScope {
    const ctx = useContext(MonthScopeContext);
    if (!ctx) throw new Error("useMonthScope must be used within <MonthScopeProvider>");
    return ctx;
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0. (Behaviour is exercised via T10's pure helpers + T12's navigator interaction test; a full nuqs-adapter integration test is deferred to visual verification — noted, not silently dropped.)
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/month-scope-context.tsx" && git commit -m "feat(6-9): month-scope provider over nuqs URL state (FR-64)"`

- [x] **T12 — Month navigator control (‹ prev / next ›) + interaction test** [AC: AC-2]
  Create `apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.tsx`:
  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.tsx
  // Story 6-9 (FR-64) — presentational ‹ prev / next › control + the month label.
  // State lives in the provider (month-scope-context). GRAYSCALE only — nav arrows
  // + label are control chrome, NOT a ± delta (lesson 2026-05-07 $accent rule).
  // The label is a polite live region so screen readers announce month changes.

  import type { CSSProperties } from "react";
  import { ChevronLeft, ChevronRight } from "lucide-react";
  import { Text, View } from "@pekulo/ui/client";
  import { formatMonthLong } from "./month-key";
  import { useMonthScope } from "./month-scope-context";

  const navBtn: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--colorSecondary)",
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  };

  export function MonthNavigator() {
    const { month, goPrev, goNext } = useMonthScope();
    return (
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingVertical="$2"
      >
        <button type="button" aria-label="Mois précédent" style={navBtn} onClick={goPrev}>
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </button>
        <Text
          role="status"
          aria-live="polite"
          fontSize="$body"
          fontWeight="600"
          color="$color"
          textTransform="capitalize"
        >
          {month ? formatMonthLong(month) : "—"}
        </Text>
        <button type="button" aria-label="Mois suivant" style={navBtn} onClick={goNext}>
          <ChevronRight size={20} strokeWidth={2} aria-hidden />
        </button>
      </View>
    );
  }
  ```
  Create `apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.test.tsx`:
  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { fireEvent, screen } from "@testing-library/react";
  import { renderWithTamagui } from "../../../../../../test/setup";

  const goPrev = vi.fn();
  const goNext = vi.fn();
  vi.mock("./month-scope-context", () => ({
    useMonthScope: () => ({
      month: "2026-02",
      summary: undefined,
      isLoading: false,
      setMonth: vi.fn(),
      goPrev,
      goNext,
    }),
  }));

  import { MonthNavigator } from "./month-navigator";

  describe("MonthNavigator (6-9)", () => {
    test("renders the long French month label", () => {
      renderWithTamagui(<MonthNavigator />);
      expect(screen.getByText("février 2026")).toBeTruthy();
    });
    test("‹ / › buttons step the month", () => {
      renderWithTamagui(<MonthNavigator />);
      fireEvent.click(screen.getByLabelText("Mois précédent"));
      fireEvent.click(screen.getByLabelText("Mois suivant"));
      expect(goPrev).toHaveBeenCalledTimes(1);
      expect(goNext).toHaveBeenCalledTimes(1);
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/month-navigator.test.tsx`
  Expected: `✓ renders the long French month label`, `✓ ‹ / › buttons step the month` — `Test Files 1 passed`.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/month-navigator.test.tsx" && git commit -m "feat(6-9): month navigator control + test (FR-64)"`

- [x] **T13 — Stat cards consume the month summary (drop the hardcoded current-month filter)** [AC: AC-1, AC-4, AC-6]
  REPLACE the whole body of `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx` with the version below. The client `new Date()` month filter over `useTransactions(200)` is gone — the aggregate now comes from the provider's server-resolved summary. The `isHydrated` guard stays (the summary is cache-dependent → SSR has none, R13). "À confirmer" is unchanged (month-agnostic):
  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx
  // Mirrors ux-preview TransactionsScreen stat row (App.tsx L1297-1330):
  //   - 2 cards on mobile (Net + À confirmer)
  //   - 4 cards on desktop (+ Entrées + Sorties)
  // Story 6-9 (FR-64): Net/Entrées/Sorties come from the SERVER monthSummary for
  // the active month (MonthScopeProvider) — transfers excluded (/mensuel
  // semantics). The pre-6-9 client `new Date()` current-month filter over
  // useTransactions(200) is removed (no client clock dependency, no >200
  // truncation). "À confirmer" stays the live pending count (story 6-4).

  import { useEffect, useState, type CSSProperties } from "react";
  import { Text, View } from "@pekulo/ui/client";
  import { Section } from "@pekulo/ui";
  import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";
  import { formatMonthShort } from "./month-key";
  import { useMonthScope } from "./month-scope-context";

  const eur0 = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const signed = (n: number) => `${n >= 0 ? "+" : ""}${eur0.format(n)}`;

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  };

  const gridStyleLg: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
  };

  const PLACEHOLDER = "—";

  export function TransactionsStatsRow() {
    const { summary } = useMonthScope();
    // "À confirmer" — live pending-suggestion total (story 6-4), month-agnostic.
    const { data: pendingData } = usePendingSuggestions();

    // Hydration guard (R13) — the summary comes from the TanStack cache, so SSR
    // renders the PLACEHOLDER and the client renders real numbers on the first
    // cached paint → without the guard React 19 logs a hydration mismatch.
    const [isHydrated, setIsHydrated] = useState(false);
    useEffect(() => setIsHydrated(true), []);

    let monthLabel = PLACEHOLDER;
    let netLabel = PLACEHOLDER;
    let netColor: "$success" | "$danger" | "$color" = "$color";
    let inflowLabel = PLACEHOLDER;
    let outflowLabel = PLACEHOLDER;

    if (isHydrated && summary) {
      monthLabel = formatMonthShort(summary.month);
      netLabel = signed(summary.netChangeEur);
      netColor = summary.netChangeEur >= 0 ? "$success" : "$danger";
      inflowLabel = eur0.format(summary.incomeEur);
      outflowLabel = eur0.format(summary.spendingEur);
    }
    const pendingCount = isHydrated ? (pendingData?.totalCount ?? 0) : 0;

    return (
      <>
        <View display="block" $lg={{ display: "none" }}>
          <div style={gridStyle}>
            <Section ariaLabel="Net du mois">
              <Text color="$colorTertiary" fontSize="$caption">
                Net · {monthLabel}
              </Text>
              <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
                {netLabel}
              </Text>
            </Section>
            <Section ariaLabel="En attente IA">
              <Text color="$colorTertiary" fontSize="$caption">
                À confirmer
              </Text>
              <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
                <Text fontSize="$h2" fontWeight="600" color="$color">
                  {pendingCount}
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  suggestions
                </Text>
              </View>
            </Section>
          </div>
        </View>
        <View display="none" $lg={{ display: "block" }}>
          <div style={gridStyleLg}>
            <Section ariaLabel="Net du mois">
              <Text color="$colorTertiary" fontSize="$caption">
                Net · {monthLabel}
              </Text>
              <Text marginTop="$2" fontSize="$h2" fontWeight="600" color={netColor}>
                {netLabel}
              </Text>
            </Section>
            <Section ariaLabel="En attente IA">
              <Text color="$colorTertiary" fontSize="$caption">
                À confirmer
              </Text>
              <View flexDirection="row" alignItems="baseline" gap="$2" marginTop="$2">
                <Text fontSize="$h2" fontWeight="600" color="$color">
                  {pendingCount}
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  suggestions
                </Text>
              </View>
            </Section>
            <Section ariaLabel="Entrées du mois">
              <Text color="$colorTertiary" fontSize="$caption">
                Entrées · {monthLabel}
              </Text>
              <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
                {inflowLabel}
              </Text>
            </Section>
            <Section ariaLabel="Sorties du mois">
              <Text color="$colorTertiary" fontSize="$caption">
                Sorties · {monthLabel}
              </Text>
              <Text marginTop="$2" fontSize="$h2" fontWeight="600" color="$color">
                {outflowLabel}
              </Text>
            </Section>
          </div>
        </View>
      </>
    );
  }
  ```
  Then REPLACE the whole body of `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.test.tsx` with the version below — it mocks `useMonthScope` (the new dependency) instead of `useTransactions`, asserting both the live pending count (the 6-4 regression guard) AND the month-scoped Net (the 6-9 behaviour):
  ```tsx
  import { describe, expect, test, vi } from "vitest";
  import { screen } from "@testing-library/react";
  import { renderWithTamagui } from "../../../../../../test/setup";

  // 6-9: Net/Entrées/Sorties come from the provider's server monthSummary.
  vi.mock("./month-scope-context", () => ({
    useMonthScope: () => ({
      month: "2026-02",
      summary: { month: "2026-02", incomeEur: 3000, spendingEur: 200, netChangeEur: 2800 },
      isLoading: false,
      setMonth: vi.fn(),
      goPrev: vi.fn(),
      goNext: vi.fn(),
    }),
  }));
  // 6-4: "À confirmer" must reflect the live pending total, not a hardcoded 0.
  vi.mock("../_hooks/use-pending-suggestions", () => ({
    usePendingSuggestions: () => ({
      data: { items: [], totalCount: 7, page: 1, pageSize: 10 },
    }),
  }));

  import { TransactionsStatsRow } from "./transactions-stats-row";

  describe("TransactionsStatsRow (6-9)", () => {
    test("Net reflects the server month summary", async () => {
      renderWithTamagui(<TransactionsStatsRow />);
      const nets = await screen.findAllByText("+2 800 €");
      expect(nets.length).toBeGreaterThanOrEqual(1);
    });
    test("'À confirmer' shows the live pending total, not 0", async () => {
      renderWithTamagui(<TransactionsStatsRow />);
      const counts = await screen.findAllByText("7");
      expect(counts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("À confirmer").length).toBeGreaterThanOrEqual(1);
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/transactions-stats-row.test.tsx`
  Expected: `✓ Net reflects the server month summary`, `✓ 'À confirmer' shows the live pending total, not 0` — `Test Files 1 passed`.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-stats-row.test.tsx" && git commit -m "feat(6-9): stat cards consume server monthSummary (FR-64)"`

- [x] **T14 — Récentes list re-scopes to the active month** [AC: AC-2, AC-4]
  In `apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx`:
  (a) Add the import next to the other local imports (after the `use-transactions` import, line ~23):
  ```ts
  import { useMonthScope } from "./month-scope-context";
  ```
  (b) REPLACE the hook line (line ~92) — read the active month from the provider and pass it to `useTransactions`:
  ```tsx
    const { month } = useMonthScope();
    const { data, isLoading, isFetching, error } = useTransactions(limit, month ?? undefined);
  ```
  No other change — the rest of the component (pagination, dialogs, rows) is unchanged. The month is server-applied, so "Charger plus" pages WITHIN the selected month.
  Then update BOTH existing render tests so they don't throw on the missing provider — add this mock at the top of `transactions-recent-section.envelope.test.tsx` AND `transactions-recent-section.a11y.test.tsx` (right after their existing `vi.mock(...)` calls, before the component import):
  ```ts
  vi.mock("./month-scope-context", () => ({
    useMonthScope: () => ({
      month: "2026-02",
      summary: undefined,
      isLoading: false,
      setMonth: () => {},
      goPrev: () => {},
      goNext: () => {},
    }),
  }));
  ```
  (If a test file does not already import `vi`, add it to its `vitest` import.)
  Run: `bun --filter='@pekulo/web' run test src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx src/app/\(cap\)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx`
  Expected: both files pass (`Test Files 2 passed`) — the recent section renders under the mocked month scope.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.envelope.test.tsx" "apps/web/src/app/(cap)/dashboard/transactions/_components/transactions-recent-section.a11y.test.tsx" && git commit -m "feat(6-9): Récentes re-scopes to the active month (FR-64)"`

- [x] **T15 — Mount the navigator + provider under a Suspense boundary on the page** [AC: AC-1, AC-2, AC-5]
  REPLACE the whole body of `apps/web/src/app/(cap)/dashboard/transactions/page.tsx` with:
  ```tsx
  // apps/web/src/app/(cap)/dashboard/transactions/page.tsx
  // RSC shell — story 6-9 (FR-64) wraps the month-scoped subtree in the
  // MonthScopeProvider (URL ?month= via nuqs) under a single <Suspense> boundary.
  // The provider reads useSearchParams (through nuqs) → Next.js requires a
  // Suspense ancestor on the consuming subtree or the whole route bails to CSR
  // (lesson 2026-05-26; the cap-shell already consumes ?tab one layer up). The
  // pre-6-9 page wrapped only Récentes; now the navigator + stats + Récentes all
  // share the provider, so the boundary moves up to wrap all three. Stats + Récentes
  // already render placeholders/skeletons until hydration, so moving them under
  // Suspense is consistent with their existing SSR output. The Suggestions IA
  // section is month-agnostic but lives inside the provider for layout order.
  //
  // <NuqsAdapter> is installed once at the app root (layout.tsx).

  import { Suspense } from "react";
  import { MonthNavigator } from "./_components/month-navigator";
  import { MonthScopeProvider } from "./_components/month-scope-context";
  import { TransactionsRecentSection } from "./_components/transactions-recent-section";
  import { TransactionsStatsRow } from "./_components/transactions-stats-row";
  import { TransactionsSuggestionsSection } from "./_components/transactions-suggestions-section";

  export default function TransactionsPage() {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "8px 4px 0",
          width: "100%",
        }}
      >
        <Suspense fallback={null}>
          <MonthScopeProvider>
            <MonthNavigator />
            <TransactionsStatsRow />
            <TransactionsSuggestionsSection />
            <TransactionsRecentSection />
          </MonthScopeProvider>
        </Suspense>
      </div>
    );
  }
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: exit 0. (Full render is verified in T17 + the visual pass T18.)
  Commit: `git add "apps/web/src/app/(cap)/dashboard/transactions/page.tsx" && git commit -m "feat(6-9): mount month navigator + provider under Suspense (FR-64)"`

- [x] **T16 — Install nuqs + mount the NuqsAdapter at the app root** [AC: AC-5]
  Add the dependency (cd-then-run — `bun --cwd` is banned, lesson 2026-05-05):
  ```bash
  cd apps/web && bun add nuqs@2.8.9 && cd ../..
  ```
  Then in `apps/web/src/app/layout.tsx`, add the import and wrap the body content. Add the import after the `ReactGrabDev` import (line ~7):
  ```ts
  import { NuqsAdapter } from "nuqs/adapters/next/app";
  ```
  REPLACE the `<body>` block (lines ~59-63) with:
  ```tsx
        <body>
          <ReactGrabDev />
          <NuqsAdapter>
            <Providers>{children}</Providers>
          </NuqsAdapter>
        </body>
  ```
  Run: `bun --filter='@pekulo/web' run typecheck && bun --filter='@pekulo/web' run build`
  Expected: both exit 0 — `nuqs@2.8.9` resolves and the production build compiles with the adapter mounted.
  Commit: `git add apps/web/package.json bun.lock "apps/web/src/app/layout.tsx" && git commit -m "feat(6-9): install nuqs@2.8.9 + NuqsAdapter at app root (FR-64)"`

- [x] **T17 — Full green gate (lint + format + typecheck + both test suites)** [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]
  Run, in order, from the repo root:
  ```bash
  bun run lint
  bun run format:check
  bun run typecheck
  bun --filter='@pekulo/api' run test
  bun --filter='@pekulo/web' run test
  ```
  Expected: `bun run lint` → 0 oxlint errors; `bun run format:check` → no unformatted files; `bun run typecheck` → all packages exit 0; api suite → 0 fail (incl. the `transactions-month.test.ts` cases); web suite → 0 fail (incl. `month-key`, `month-navigator`, `transactions-stats-row`, recent-section tests).
  Commit: nothing to commit if green (this task only gates). If lint/format auto-fixes anything, run `bun run lint:fix && bun run format:check` and `git commit -m "chore(6-9): lint/format pass"`.

- [x] **T18 — Visual verification of the navigator + month-scoped stat cards** [AC: AC-1, AC-2]
  Start the web app and verify the `/dashboard/transactions` surface in the real app: the navigator label reads the resolved month, ‹/› step the month, and the Net/Entrées/Sorties cards + Récentes re-scope together. Capture the element context:
  ```
  mcp__react-grab-mcp__get_element_context  (target: the MonthNavigator + stat row on /dashboard/transactions)
  ```
  Expected: navigator label = the active month (e.g. « février 2026 »), arrows grayscale, stat cards reflect the month, Récentes lists only that month.
  > NOTE: `react-grab-mcp` has been OFFLINE for 6-3/6-4/6-8/6-10 (visual deferred each time). If still unavailable, WAIVE with the user's confirmation and rely on the static design-law pass (grayscale chrome, aria-labelled buttons, live-region label) + T17 — same disposition as the prior Epic-6 frontend stories. No commit.

## Dev Notes

### Architecture — decisions locked in step 04 (with the user)

1. **Aggregate source + semantics = SERVER, /mensuel semantics.** A new `transactions.monthSummary({ month? })` aggregates the whole month server-side and reuses the pure `deriveMonthlyAggregates` (`apps/api/src/common/derive/monthly-aggregates.ts`) — so **transfers are EXCLUDED** from Entrées/Sorties (AC-6), matching `/mensuel`. This fixes the pre-6-9 client math (which summed inflow/outflow INCLUDING transfers over a ≤200 window). Rejected: client-side derive over a month-scoped fetch (silent >200 truncation).
2. **Month state = URL `?month=YYYY-MM` via nuqs** (`2.8.9`, npm-verified latest; Context7-confirmed App Router setup). Shareable + back-button-correct (AC-5). The default is dynamic (server-resolved), so `month = (valid ?month) ?? summary.month` — no static parser default, no mount-time URL write. `setMonth` uses `history:"push"`. Requires `<NuqsAdapter>` at the app root (T16) and a `<Suspense>` ancestor (T15).
3. **Scope = one story** (server surface + web navigator), per the user's call.

**Layering (ADR-0010):** Component (`MonthNavigator`, stat row) → provider/hook (`MonthScopeProvider`, `useMonthSummary`, `useTransactions`) → server action → oRPC client → Elysia handler → service → repository → Prisma. No new module — `monthSummary` rides the existing `transactions` module deps (no `module.ts` change). **No Prisma migration** — the month is derived from the existing `occurredOn` column.

**Suspense / `useSearchParams` (lesson 2026-05-26 — load-bearing):** nuqs reads `useSearchParams` under the hood. The provider therefore moves the page's Suspense boundary up to wrap the whole month-scoped subtree (navigator + stats + Récentes). This is the documented exception to "no Suspense around `useActionQuery` consumers", not a template. The cap-shell already consumes `?tab`, so the route is already searchParams-coupled.

**R13 hydration guard (lesson 2026-05-24):** the stat row keeps its `isHydrated` guard because the summary is cache-dependent; but the client `new Date()` clock dependency is GONE (the month is server-resolved), which improves the month-boundary hydration story.

**`$accent`/grayscale (lesson 2026-05-07):** the ‹ › arrows + month label are control chrome → grayscale (`$color`/`$colorSecondary`). Only the Net value keeps its `$success`/`$danger` sign coloring (it is a ± delta).

**Test commands (lesson 2026-05-19):** always the full quoted workspace name — `bun --filter='@pekulo/api' run test`, `bun --filter='@pekulo/web' run test`. api = `bun:test`; web = `vitest`. Never `bun --filter=api`, never `bun --cwd <relative>` (lesson 2026-05-05 — use cd-then-run for the nuqs install).

### File decisions (one responsibility each)

- `packages/validators/src/transactions/transactions.schemas.ts` (M) — zod SSOT. +`monthKeySchema`, +`month` on `listTransactionsInputSchema`, +`monthSummary{Input,Output}Schema`. In: `@pekulo/zod`. Out: schemas + inferred types consumed by contract, api, web.
- `packages/contracts/src/transactions/transactions.contract.ts` (M) — oRPC contract. +`monthSummary` procedure. In: validators schemas. Out: `transactionsContract`.
- `apps/api/src/modules/transactions/transactions.repository.ts` (M) — Prisma layer. +`latestActivityMonth`, +`listAllForMonth`, month range on `listByUser`. In: ExtendedPrismaClient. Out: `TransactionsRepository`.
- `apps/api/src/modules/transactions/transactions.service.ts` (M) — business logic. +`monthSummary` composing repo + `deriveMonthlyAggregates`. In: repository, derive. Out: `TransactionsService`.
- `apps/api/src/modules/transactions/transactions.routes.ts` (M) — oRPC handlers. +`monthSummary` pass-through. In: contract, service. Out: router.
- `apps/api/src/modules/transactions/transactions-month.test.ts` (N) — bun:test for the repo month query + service monthSummary. Self-contained fakes.
- `apps/web/src/lib/zapaction/keys.ts` (M) — cache keys SSOT. `list(limit,month?)` + `monthSummary(month?)`. No registry edge change (bare `[TRANSACTIONS_KEY]` prefix covers them).
- `apps/web/.../transactions/_actions/transactions-actions.ts` (M) — server actions. +`monthSummary` (read, keeps `output:`).
- `apps/web/.../transactions/_hooks/use-transactions.ts` (M) — +`month` param threaded into input + queryKey.
- `apps/web/.../transactions/_hooks/use-month-summary.ts` (N) — the monthSummary query hook.
- `apps/web/.../transactions/_components/month-key.ts` (N) — pure "YYYY-MM" maths + FR labels (no React/nuqs/clock).
- `apps/web/.../transactions/_components/month-key.test.ts` (N) — vitest for the pure helpers.
- `apps/web/.../transactions/_components/month-scope-context.tsx` (N) — the single active-month source (nuqs URL state + server default + prev/next).
- `apps/web/.../transactions/_components/month-navigator.tsx` (N) — presentational ‹ › + label.
- `apps/web/.../transactions/_components/month-navigator.test.tsx` (N) — vitest interaction test.
- `apps/web/.../transactions/_components/transactions-stats-row.tsx` (M) — consume the summary; drop the client current-month filter. + its test rewritten to mock `useMonthScope`.
- `apps/web/.../transactions/_components/transactions-recent-section.tsx` (M) — consume the active month. + its 2 render tests gain a `useMonthScope` mock.
- `apps/web/.../transactions/page.tsx` (M) — provider + Suspense + navigator mount.
- `apps/web/src/app/layout.tsx` (M) + `apps/web/package.json` (M) — `nuqs@2.8.9` + `<NuqsAdapter>` at root.

### Step-0 — existing code at write time (verbatim anchors the dev MUST reconcile against)

`packages/validators/.../transactions.schemas.ts:165-176` (current — the two schemas T1 extends):
```ts
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
```

`apps/api/.../transactions.repository.ts:296-340` (current `listByUser` — T3 edits the `where` + adds two siblings):
```ts
    async listByUser(userId, input) {
      const limit = input.limit ?? 50;
      // ...cursor decode (unchanged)...
      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(decoded ? { OR: [ /* cursor keyset */ ] } : {}),
      };
      const rows = (await deps.client.transaction.findMany({
        where, orderBy: [{ occurredOn: "desc" }, { id: "desc" }], take: limit + 1,
      })) as TransactionRow[];
      // ...hasMore / nextCursor (unchanged)...
    },
```

`apps/api/.../transactions.service.ts:422-425` (current `listTransactions` — T4 adds `monthSummary` after it):
```ts
    async listTransactions(userId, input) {
      const page = await deps.repository.listByUser(userId, input);
      return { ...page, items: await attachLogos(userId, page.items) };
    },
```

`apps/api/.../monthly-aggregates.ts:27-48` (the pure derive T4 REUSES — transfers excluded, outflow leg only):
```ts
export function deriveMonthlyAggregates(input: DeriveMonthlyAggregatesInput): MonthlyAggregates {
  let incomeEur = 0; let spendingEur = 0; let transfersEur = 0;
  for (const tx of input.transactions) {
    if (tx.category === "transfer") { if (tx.type === "outflow") transfersEur += tx.amount; continue; }
    if (tx.type === "inflow") incomeEur += tx.amount; else spendingEur += tx.amount;
  }
  return { incomeEur, spendingEur, transfersEur, netChangeEur: incomeEur - spendingEur };
}
```

`apps/web/.../transactions-stats-row.tsx:39-86` (current — T13 REPLACES the `useTransactions(200)` + `new Date()` month filter with the provider summary):
```tsx
  const { data } = useTransactions(200);
  const { data: pendingData } = usePendingSuggestions();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const items = data?.items ?? [];
  // ...
  if (isHydrated) {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    const inMonth = items.filter((t) => { const d = new Date(t.occurredOn); return d.getFullYear() === y && d.getMonth() === m; });
    // inflow/outflow sums INCLUDING transfers; monthLabel from now.toLocaleDateString(...)
  }
```

`apps/web/.../transactions-recent-section.tsx:90-92` (current — T14 swaps the hook arg):
```tsx
  export function TransactionsRecentSection() {
    const [limit, setLimit] = useState(PAGE_STEP);
    const { data, isLoading, isFetching, error } = useTransactions(limit);
```

`apps/web/.../transactions/page.tsx:27-45` (current — T15 wraps the subtree; today only Récentes is under Suspense):
```tsx
  export default function TransactionsPage() {
    return (
      <div style={{ /* flex col, gap 24, padding "8px 4px 0" */ }}>
        <TransactionsStatsRow />
        <TransactionsSuggestionsSection />
        <Suspense fallback={null}><TransactionsRecentSection /></Suspense>
      </div>
    );
  }
```

`apps/web/src/app/layout.tsx:59-63` (current `<body>` — T16 wraps in `<NuqsAdapter>`):
```tsx
      <body>
        <ReactGrabDev />
        <Providers>{children}</Providers>
      </body>
```

`apps/web/.../transactions/_hooks/use-transactions.ts:1-14` (current — T8 REPLACES the whole body; today there is no `month` param):
```ts
"use client";
import { useActionQuery } from "@zapaction/query";
import { transactionsKeys } from "@/lib/zapaction/keys";
import { listTransactions } from "../_actions/transactions-actions";

export function useTransactions(limit = 50) {
  return useActionQuery(listTransactions, {
    input: { limit },
    queryKey: transactionsKeys.list(limit),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
```

`apps/web/.../zapaction/keys.ts:90-107` (current — T6 REPLACES the `transactionsKeys` factory; the registry bare-prefix edge at L205-206 `[transactionsTags.list()]: [[TRANSACTIONS_KEY], accountsKeys.list(), [MONTHLY_KEY]]` is UNCHANGED — the new `list`/`monthSummary` sub-keys are covered by the `[TRANSACTIONS_KEY]` prefix):
```ts
export const TRANSACTIONS_KEY = "transactions" as const;
export const transactionsKeys = createFeatureKeys(TRANSACTIONS_KEY, {
  list: (limit?: number) => ["list", limit ?? 50] as const,
  byId: (id: string) => ["byId", id] as const,
  pending: (page?: number) => ["pending", page ?? 1] as const,
});
export const transactionsTags = createFeatureTags(TRANSACTIONS_KEY, {
  list: () => ["list"] as const,
});
```

`packages/contracts/.../transactions.contract.ts:62` + `apps/api/.../transactions.routes.ts:83-86` + `apps/web/.../transactions-actions.ts:56-68` — ADDITIVE only (T2/T5/T7 insert a `monthSummary` sibling right after the existing `listTransactions` in each; no existing line changes). The current `listTransactions` shape in each file is the pattern to mirror: contract `listTransactions: oc.input(listTransactionsInputSchema).output(listTransactionsOutputSchema)`; route `impl.listTransactions.handler(async ({ context, input }) => { requireUserId(context.userId); return deps.service.listTransactions(context.userId, input); })`; action `defineAction({ name: "listTransactions", input: listTransactionsInputSchema, output: listTransactionsOutputSchema, handler: async ({ input }) => { await ensureRequestContext(); return transactionsClient.listTransactions(input); } })`.

### Dependencies

- **NEW: `nuqs@2.8.9`** (apps/web) — type-safe URL search-param state. npm-verified latest (Context7 dist-tags can lag — lesson). App Router adapter `nuqs/adapters/next/app` requires Next ≥ 14.2 (repo on 16.2.4 ✓). One root-layout `<NuqsAdapter>` wrap.
- Reused, unchanged: `@zapaction/core` + `@zapaction/query`, `@tanstack/react-query`, `@pekulo/ui`, `@pekulo/validators`, `@pekulo/contracts`, `@orpc/*`, lucide-react (`ChevronLeft`/`ChevronRight`).
- API: reuses `deriveMonthlyAggregates` (`apps/api/src/common/derive/monthly-aggregates.ts`, story 5-4). No new external dep, no Prisma migration.

### Out of scope (explicit — no silent caps)

- **Arrow-disabling at activity boundaries** (grey-out › when no newer month). Not an AC; navigating to an empty month correctly shows zeros + an empty Récentes (informative). Future enhancement.
- **`/mensuel` (5-4) is untouched** — 6-9 scopes `/dashboard/transactions` only. It reuses the shared pure derive but writes NO `MonthlyRecord` rows.
- **Account filter on the navigator** — `listTransactions` already supports `accountId`, but combining it with the month nav is not in FR-64.
- **HTTP-boundary 401 test for `monthSummary`** — flagged in T5 for aped-qa/aped-review (mirrors 6-3/6-4 review additions); not built here to avoid guessing the integration harness.

## File List

**Packages**

- `packages/validators/src/transactions/transactions.schemas.ts` (M) — `monthKeySchema`, `month` on `listTransactionsInputSchema` + `listPendingSuggestionsInputSchema`, `monthSummary{Input,Output}Schema`
- `packages/contracts/src/transactions/transactions.contract.ts` (M) — `monthSummary` procedure

**API (apps/api)**

- `apps/api/src/modules/transactions/transactions.repository.ts` (M) — `monthKeyToRange`, month range on `listByUser` + `listPendingByUser`, `latestActivityMonth`, `listAllForMonth`
- `apps/api/src/modules/transactions/transactions.service.ts` (M) — `monthSummary` (via `deriveMonthlyAggregates`), `currentMonthKeyUTC`, pending month thread-through
- `apps/api/src/modules/transactions/transactions.routes.ts` (M) — `monthSummary` handler
- `apps/api/src/modules/transactions/transactions-month.test.ts` (N) — repo month-scope + pending month-scope + `monthSummary` service

**Web (apps/web)**

- `_components/month-key.ts` + `month-key.test.ts` (N) — pure `shiftMonth` / `isMonthKey` / `formatMonthLong` / `formatMonthName`
- `_components/month-scope-context.tsx` (N) — nuqs `?month` provider (single active-month source)
- `_components/month-navigator.tsx` + `month-navigator.test.tsx` (N) — ‹/› control + live-region label
- `_components/transactions-stats-row.tsx` (M) + `.test.tsx` — server `monthSummary`; month-scoped « À confirmer »; full month caption
- `_components/transactions-recent-section.tsx` (M) + `.envelope`/`.a11y` tests — month-scoped Récentes
- `_components/transactions-suggestions-section.tsx` (M) + `.envelope`/`.a11y` tests — month-scoped Suggestions IA (extension)
- `_hooks/use-transactions.ts` (M), `_hooks/use-month-summary.ts` (N), `_hooks/use-pending-suggestions.ts` (M)
- `_actions/transactions-actions.ts` (M) — `monthSummary` action; pending input gains `month`
- `page.tsx` (M) — provider + navigator under `<Suspense>`
- `src/app/layout.tsx` (M) + `apps/web/package.json` (M) + `bun.lock` (M) — `nuqs@2.8.9` + `<NuqsAdapter>`
- `src/lib/zapaction/keys.ts` (M) — `list(limit, month)`, `pending(page, month)`, `monthSummary(month)`

## Dev Agent Record

- **Model:** claude-opus-4-8[1m]
- **Started:** 2026-06-02T12:57:55Z
- **Completed:** 2026-06-02T13:48:04Z

### Summary

Month navigator (FR-64) on `/dashboard/transactions`. A server `transactions.monthSummary({ month? })` aggregate — reusing the `/mensuel` pure `deriveMonthlyAggregates` so transfers are excluded (AC-6) — drives the Net/Entrées/Sorties stat cards over the WHOLE month (no >200 truncation, AC-4). The active month lives in the URL (`?month=YYYY-MM` via nuqs, Suspense-wrapped) as the single source consumed by the navigator, the stat cards and the Récentes list; default = most recent month with activity, current UTC month when the DB is empty (AC-1/AC-3). All 18 planned tasks shipped, plus a post-step-04 extension (below). 18 TDD task commits + 8 extension commits, full gate green.

### Files changed

See **File List** above — 28 files (validators + contract; api repository/service/routes + `transactions-month.test.ts`; web components/hooks/actions/keys/page/layout; `package.json` + `bun.lock`).

### Deviations

- **T3 test import:** `TransactionsRepository` imported from `./transactions.repository` (its real home); the story snippet imported it from `./transactions.service`, which does not re-export it (tsc-only fix).
- **`noUncheckedIndexedAccess`:** `monthKeyToRange` (repo) and `shiftMonth`/`monthDate` (`month-key.ts`) cast `split("-").map(Number) as [number, number]` — the story snippets omitted the cast; `month` is validated `YYYY-MM` upstream. The repo cast rode an amend of the T3 commit.
- **nuqs install order:** the `bun add nuqs@2.8.9` half of T16 was pulled before T11 so T11–T15 typecheck against the resolved module; the `<NuqsAdapter>` wiring + the `package.json`/`bun.lock` commit stayed at T16.
- **T12 navigator test:** `vi.hoisted` for `goPrev`/`goNext` (lesson 2026-05-20) — the story's plain `const` refs would hit the hoisting TDZ.
- **T18 visual verification WAIVED** (user-confirmed) — `react-grab` MCP offline (as 6-3/6-4/6-8/6-10). Static design-law pass clean (grayscale chrome, aria-labelled ‹/› buttons, `aria-live` month label); T17 green. AC-5 (deep-link + back-button) has no automated test — its nuqs-URL integration was deferred by the story (T11) to visual; flagged for aped-qa/aped-review.

### Extension — Suggestions month-scope + caption (post-step-04, 2026-06-02, user call)

Supersedes the locked "« À confirmer » / Suggestions IA are month-agnostic" decision. Both the **Suggestions IA list** AND the **« À confirmer » count** now re-scope to the active month: `month?` added to `listPendingSuggestionsInputSchema` → `listPendingByUser` (server `occurredOn` range, so >page-size months stay exact) → service → `usePendingSuggestions(page, pageSize, month)` → both surfaces. The shared `pending(page, month)` cache key keeps the list and the count consistent. Separately, the stat caption now shows the **full FR month name** (`formatMonthName`, e.g. « avril ») instead of the truncated « avri » (`formatMonthShort` removed). Next 16 best-practice pass (E10): `useSearchParams` (via nuqs) is correctly `<Suspense>`-wrapped — verified against the local App Router `use-search-params` doc; production build green with no CSR-bailout. Story scope note + epic-6 cache (L87) superseded in this change (lesson 2026-05-31).

### Extension — Récentes numbered pagination (post-step-04, 2026-06-02, user call)

Récentes moves from "Charger plus" (cursor load-more, 50→200) to **numbered pages, 10/page** (like Suggestions IA), with the page in the URL (`?page` via nuqs, under the same Suspense boundary). `listTransactions` gains an opt-in OFFSET mode: `page?` on the input → `listByUser` does `skip/take + count` and returns `totalCount` (null in the default cursor mode). This is a **documented deviation from D2/NFR-16** (offset forbidden for transactions) scoped to this bounded view — acceptable at Persona #1 scale (≤200 tx/month), to revisit if a user nears the 50k cap; the cursor path stays the default for every other caller. Architecture D2 amended. **Note:** auto-accept (story 6-7, still pending) is orthogonal — it applies suggestions server-side at import (all of them), so the 10/page limit is display-only and never caps auto-accept.

### Test output

- `bun --filter='@pekulo/api' run test` → **792 pass, 0 fail** (incl. `transactions-month.test.ts`: repo month-scope + pending month-scope + offset pagination + `monthSummary` service).
- `bun --filter='@pekulo/web' run test` → **159 pass, 0 fail** (incl. `month-key`, `month-navigator`, `transactions-stats-row`, recent-section ×2, suggestions-section ×2).
- `bun run lint` → 0 warnings / 0 errors · `bun run typecheck` → 8/8 · `bun --filter='@pekulo/web' run build` → exit 0 (`/dashboard/transactions` = ƒ dynamic, no CSR bailout).

## Review Record

**Date:** 2026-06-02
**Auditors:** Spec, Code, Edge & Hallucination, Aria
**Verdict:** done

> **Override:** AC gap accepted — reason: "Override directed by Alex ('fix tout') — all actionable findings fixed inline (epic-6 reviewer-fix pattern), not bounced to dev."

Adversarial review of the `review`-status branch (cross-layer). Implementation was sound: userId isolation intact on every new repo query (`listByUser`/`listAllForMonth`/`latestActivityMonth`/pending month branch all carry `where: { userId }`, ADR-0013), the D2/NFR-16 offset deviation is genuinely bounded + doc-synced (architecture D2 + lessons 2026-06-02 + epic cache), transfer-exclusion reuses the `/mensuel` derive (AC-6), every introduced identifier resolves (all 8 packages typecheck), and the grayscale-chrome / R13-hydration / Suspense-for-useSearchParams lessons are honoured. Findings were coverage + boundary-hardening gaps, all closed inline.

### Findings

#### Resolved

- [MAJOR] `monthSummary` shipped with no HTTP-boundary test — 401/reachability uncovered despite the 6-3/6-4 precedent [apps/api/src/modules/transactions/transactions.integration.test.ts]
  - Source: Spec, Code
  - Resolution: `06b3f05` — added `missing JWT → 401` + `authenticated → 200 (net = income − spending)` boundary tests; extended the integration fake's `findMany` to honour the `{gte,lt}` month range it never modelled (the gap that hid the absence of any month-scoped integration coverage).
- [MINOR] AC-5 (deep-link `?month=` + browser Back) had no automated test of any kind — visual T18 waived [apps/web/.../_components/month-scope-context.tsx:36-46]
  - Source: Spec (Edge concurred)
  - Resolution: `06b3f05` — new `month-scope-context.test.tsx` runs the REAL provider over nuqs `NuqsTestingAdapter`: deep-link read, server-default seed (AC-1), invalid `?month` ignored, and ‹/› writing the new month with `history:"push"` (the Back-button contract).
- [NIT] Récentes `?page` was not reset on month change — prev/next could land on a deep page of the new month [apps/web/.../_components/transactions-recent-section.tsx]
  - Source: Code
  - Resolution: `06b3f05` — reset `?page→1` on month change via a previous-month ref (deep-link `?month=&page=` is preserved; the reset uses replace-history so Back still restores the prior month+page).
- [NIT] `?page=0` silently degraded Récentes into cursor mode (falsy page dropped, no `totalCount`) [apps/web/.../_hooks/use-transactions.ts]
  - Source: Edge
  - Resolution: `06b3f05` — clamp `page≥1` at read.
- [MINOR] `shiftMonth` produced malformed `"YYYY-00"` keys for negative ordinals (JS sign-preserving `%`) [apps/web/.../_components/month-key.ts:13-19]
  - Source: Edge
  - Resolution: `06b3f05` — sign-safe modulo `(((n % 12) + 12) % 12) + 1`; `MONTH_KEY_REGEX` rejects year `0000` in BOTH the web helper and the `@pekulo/validators` SSOT (kept iso); added a multi-month/negative-delta test.
- [NIT] Story body still references the superseded `formatMonthShort`/"avri" truncation [apps/web/.../_components/month-key.ts:35-38]
  - Source: Aria
  - Resolution: code already ships `formatMonthName` (full FR name, no truncation), asserted in `month-key.test.ts`; supersession recorded here. The T10/T13 task snippets are left verbatim as historical TDD record (consistent with the story's prior supersession notes).

#### Dismissed

- [MINOR] AC-6 transfer-exclusion proven at the API service layer, not the stat-card component
  - Source: Spec
  - Rationale: correct architecture — the server owns the aggregate (`deriveMonthlyAggregates`); the component is a render contract over a pre-aggregated summary. AC-6 is genuinely covered by `transactions-month.test.ts:97-113`.
- [NIT] File List "(extension)" supersession for the Suggestions month-scope
  - Source: Spec
  - Rationale: already recorded in the story's Extension section — lesson 2026-05-31 traceability satisfied.
- [NIT] Live region wraps only the month label, not the ‹/› controls
  - Source: Aria
  - Rationale: the polite region IS the label text-swap — the correct + sufficient SR announcement on month change; no `aria-atomic` needed.

#### Scope (git-audit)

- [MEDIUM] Out-of-scope changes co-shipped on the 6-9 branch: commit `165f9a5` (RLS-on-no-policy for `merchant_logo_cache` / `provider_logo_cache` / `_prisma_migrations`, Supabase advisor 0013) touches `logos.prisma`, migration `20260602150000`, `rls-migration-audit.ts`, ADR-0007 — these belong to **6-10**, absent from 6-9's File List.
  - Disposition: ACCEPTED (not reverted) — a live RLS hardening already validated + doc-synced on the branch (architecture L131, ADR-0015, lessons 2026-06-02). Flagged for attribution to the 6-10 follow-up at `aped-ship` time (PR split or commit note).

### Verification

- Test command: `bun run lint` · `bun run typecheck` · `bun --filter='@pekulo/api' run test` · `bun --filter='@pekulo/web' run test`
- Test output (final pass, post-fix): lint **0 warnings / 0 errors**; typecheck **8/8**; api **794 pass / 0 fail** (+2 `monthSummary` boundary); web **165 passed / 74 files** (+6: `month-scope-context` ×5, `month-key` ×1). `format:check` clean for all 6-9 files.
- Auditor re-dispatch: skipped in favour of the captured green gate above — all fixes are test-backed and the Iron-Law fresh evidence is the test output (bounded-run preference).
- Visual verification: deferred (live) — `react-grab-mcp` offline, T18 waived by user (as 6-3/6-4/6-8/6-10). Aria static design-law pass clean (grayscale chrome, aria-labelled ‹/› buttons, `aria-live` month label, `$lg` media key, single Suspense boundary).

### Ticket sync

- Ticket: none (assigned at `aped-ship` per epics.md) — no comment posted.
- PR: deferred to `aped-ship` (`umbrella_branch == main`; no dedicated umbrella — same disposition as 6-10).
