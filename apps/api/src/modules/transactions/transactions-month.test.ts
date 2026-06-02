// apps/api/src/modules/transactions/transactions-month.test.ts
// bun:test — story 6-9 (FR-64). Repository month-range scoping + the
// monthSummary service derive. Minimal fakes (no Postgres harness, per the
// 6-1 fake-Prisma precedent — RLS coverage stays in db:rls-audit).

import { describe, expect, mock, test } from "bun:test";
import type { Transaction } from "@pekulo/validators";
import { createTransactionsRepository } from "./transactions.repository";
import type { TransactionsRepository } from "./transactions.repository";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
} from "./transactions.service";
import type { ExtendedPrismaClient } from "../../database";

function fakeClient(rows: { occurredOn: Date }[] = []) {
  const findMany = mock(async (_args: { where?: unknown; take?: number }) => rows);
  const findFirst = mock(async (_args: unknown) => rows[0] ?? null);
  const count = mock(async (_args: unknown) => rows.length);
  return {
    client: { transaction: { findMany, findFirst, count } } as unknown as ExtendedPrismaClient,
    findMany,
    findFirst,
    count,
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
    const args = findMany.mock.calls[0]![0] as {
      where: { occurredOn: { gte: Date; lt: Date } };
      take?: number;
    };
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
    expect(out).toEqual({
      month: "2026-02",
      incomeEur: 3000,
      spendingEur: 200,
      netChangeEur: 2800,
    });
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

// ─── pending-suggestions month scope (6-9 extension) ─────────────────────
// The Suggestions IA list + the "À confirmer" count re-scope to the active
// month, superseding the original month-agnostic decision (user call,
// 2026-06-02). Server-side filter so >page-size months stay exact.
describe("repository — pending month scope (6-9 ext)", () => {
  test("listPendingByUser scopes occurredOn to the month range when month is given", async () => {
    const { client, findMany } = fakeClient([]);
    const repo = createTransactionsRepository({ client });
    await repo.listPendingByUser("u_a", { page: 1, pageSize: 10, month: "2026-02" });
    const where = (
      findMany.mock.calls[0]![0] as { where: { occurredOn?: { gte: Date; lt: Date } } }
    ).where;
    expect(where.occurredOn?.gte).toEqual(new Date(Date.UTC(2026, 1, 1)));
    expect(where.occurredOn?.lt).toEqual(new Date(Date.UTC(2026, 2, 1)));
  });
  test("listPendingByUser omits the occurredOn range when month is absent", async () => {
    const { client, findMany } = fakeClient([]);
    const repo = createTransactionsRepository({ client });
    await repo.listPendingByUser("u_a", { page: 1, pageSize: 10 });
    const where = (findMany.mock.calls[0]![0] as { where: { occurredOn?: unknown } }).where;
    expect(where.occurredOn).toBeUndefined();
  });
});

// ─── list offset (numbered) pagination (6-9 extension) ───────────────────
// Récentes wants random-access numbered pages (10/page) like Suggestions IA.
// listTransactions stays cursor-based by default (D2); `page` opts into a
// documented offset path bounded to Persona #1 scale.
describe("repository — list offset pagination (6-9 ext)", () => {
  test("listByUser page mode uses skip/take + count, nulls the cursor", async () => {
    const { client, findMany } = fakeClient([]);
    const repo = createTransactionsRepository({ client });
    const out = await repo.listByUser("u_a", { limit: 10, page: 3, month: "2026-02" });
    const args = findMany.mock.calls[0]![0] as {
      skip?: number;
      take?: number;
      where: { occurredOn?: { gte: Date; lt: Date } };
    };
    expect(args.skip).toBe(20); // (page 3 - 1) * 10
    expect(args.take).toBe(10); // exact page, NOT limit + 1 (cursor mode)
    expect(args.where.occurredOn?.gte).toEqual(new Date(Date.UTC(2026, 1, 1)));
    expect(out.nextCursor).toBeNull();
    expect(out.totalCount).toBe(0);
  });

  test("listByUser without page stays cursor mode (take = limit + 1, no totalCount)", async () => {
    const { client, findMany } = fakeClient([]);
    const repo = createTransactionsRepository({ client });
    const out = await repo.listByUser("u_a", { limit: 10 });
    const args = findMany.mock.calls[0]![0] as { skip?: number; take?: number };
    expect(args.skip).toBeUndefined();
    expect(args.take).toBe(11);
    expect(out.totalCount ?? null).toBeNull();
  });
});
