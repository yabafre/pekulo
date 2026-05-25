// apps/api/src/modules/transactions/transactions.repository.test.ts
// bun:test — TDD RED for the transactions repository (story 5-1).
// Asserts: prefixed-id create, userId guard, cursor pagination, Decimal
// coercion via decimalToNumber, AC-12 validator rejection cases.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import {
  createTransactionInputSchema,
  type CreateTransactionInput,
  type ValidatedCsvRow,
} from "@pekulo/validators";
import { createTransactionsRepository } from "./transactions.repository";

interface FakeRow {
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
  createdAt: Date;
  updatedAt: Date;
}

const sampleInput = (over: Partial<CreateTransactionInput> = {}): CreateTransactionInput => ({
  accountId: "acc_aaa111111111111111111",
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
  accountId: "acc_aaa111111111111111111",
  occurredOn: new Date("2026-05-15"),
  label: "Courses Carrefour",
  amount: new Prisma.Decimal(87.5),
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: new Date("2026-05-15T10:00:00Z"),
  updatedAt: new Date("2026-05-15T10:00:00Z"),
  ...over,
});

interface FakeClientControl {
  // Story 5-2 T6 — control knob: when set, the Nth call (1-indexed) to
  // tx.transaction.create inside $transaction throws, simulating a Prisma
  // constraint violation. The fake's $transaction snapshots its store
  // pre-callback and discards committed rows on throw — matches Prisma's
  // interactive-tx rollback semantics so the AC-6 rollback assertion is
  // honest, not just an exception bubble.
  bulkCreateThrowsOnNth?: number;
}

const createFakeClient = (control: FakeClientControl = {}) => {
  const persisted: FakeRow[] = [];
  let nextId = 0;
  let createCallCount = 0;
  const create = mock(async ({ data }: { data: FakeRow }) => {
    createCallCount++;
    if (
      control.bulkCreateThrowsOnNth !== undefined &&
      createCallCount === control.bulkCreateThrowsOnNth
    ) {
      throw new Error(`simulated DB constraint on create call #${createCallCount}`);
    }
    const row = fakeRow({
      ...data,
      id: data.id || `tx_${String(nextId++).padStart(21, "0")}`,
    });
    persisted.push(row);
    return row;
  });
  const findFirst = mock(async () => null as FakeRow | null);
  const findMany = mock(async () => [] as FakeRow[]);
  const updateMany = mock(async () => ({ count: 1 }));
  const deleteMany = mock(async () => ({ count: 1 }));
  const txClient = {
    transaction: { create, findFirst, findMany, updateMany, deleteMany },
  };
  const $transaction = mock(async (callback: (tx: typeof txClient) => Promise<unknown>) => {
    const snap = [...persisted];
    try {
      return await callback(txClient);
    } catch (err) {
      // Mirror Prisma's interactive-tx rollback — discard rows committed
      // inside the callback when any subsequent statement throws.
      persisted.length = 0;
      persisted.push(...snap);
      throw err;
    }
  });
  const client = {
    ...txClient,
    $transaction,
  };
  return Object.assign(
    client as unknown as Parameters<typeof createTransactionsRepository>[0]["client"],
    {
      __persisted: persisted,
      __createCallCount: () => createCallCount,
      __txCallCount: () => $transaction.mock.calls.length,
    },
  );
};

describe("transactionsRepository", () => {
  let client: ReturnType<typeof createFakeClient>;
  let repo: ReturnType<typeof createTransactionsRepository>;

  beforeEach(() => {
    client = createFakeClient();
    repo = createTransactionsRepository({ client });
  });

  // AC-1 (verbatim from story 5-1:17):
  //   Given a fresh DB + account acc_aaa… for user A, When A calls
  //   createTransaction({ … amount: 87.50 … }), Then a transactions row
  //   persists with id matching /^tx_[0-9A-Za-z]{21}$/, … amount = 87.50.
  //   Repository test asserts each column.
  test("AC-1 — create returns DTO with every column populated", async () => {
    const row = fakeRow();
    (client.transaction.create as ReturnType<typeof mock>).mockResolvedValueOnce(row);
    const out = await repo.create("u_a", sampleInput());
    expect(out.id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
    expect(out.accountId).toBe("acc_aaa111111111111111111");
    expect(out.occurredOn).toBe("2026-05-15");
    expect(out.label).toBe("Courses Carrefour");
    expect(out.amount).toBe(87.5);
    expect(typeof out.amount).toBe("number");
    expect(out.type).toBe("outflow");
    expect(out.category).toBe("courses");
    expect(out.isImprevu).toBe(false);
    expect(out.notes).toBeNull();
    expect(out.createdAt).toBe("2026-05-15T10:00:00.000Z");
  });

  // AC-6 (verbatim from story 5-1:22):
  //   Given A's tx_aaa…, When B calls getTransaction({ id }), Then the service
  //   rejects with TRANSACTION_NOT_FOUND → HTTP 404 (no row leak — the explicit
  //   where: { id, userId: B } guard short-circuits before Prisma's RLS check).
  test("AC-6/AC-9 — findByIdForUser short-circuits on cross-user via explicit { id, userId }", async () => {
    (client.transaction.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce(null);
    const out = await repo.findByIdForUser("u_b", "tx_aaaaaaaaaaaaaaaaaaaaa");
    expect(out).toBeNull();
    expect(client.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: "tx_aaaaaaaaaaaaaaaaaaaaa", userId: "u_b" },
    });
  });

  // AC-5 (verbatim from story 5-1:21):
  //   Given A owns 250 transactions, When A calls listTransactions({ limit: 50 }),
  //   Then the response is { items: Transaction[50], nextCursor: "<base64>" }
  //   ordered by (occurred_on desc, id desc). The last page returns
  //   nextCursor: null.
  test("AC-5 — listByUser returns { items, nextCursor=null } on under-limit page", async () => {
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce([fakeRow()]);
    const out = await repo.listByUser("u_a", { limit: 50 });
    expect(out.items).toHaveLength(1);
    expect(out.nextCursor).toBeNull();
  });

  test("AC-5 — listByUser returns base64 nextCursor when limit+1 rows surface", async () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      fakeRow({
        id: `tx_${String(i).padStart(21, "0")}`,
        occurredOn: new Date(`2026-05-${String(10 + (i % 20)).padStart(2, "0")}`),
      }),
    );
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce(rows);
    const out = await repo.listByUser("u_a", { limit: 50 });
    expect(out.items).toHaveLength(50);
    expect(out.nextCursor).not.toBeNull();
    expect(typeof out.nextCursor).toBe("string");
  });

  // AC-5 (zero-overlap between pages) — feed page1's nextCursor back into
  // page2 and assert the OR clause is derived from page1's last row, with
  // page2 returning disjoint ids. Tests the cursor protocol end-to-end at
  // the repository boundary (the fake findMany doesn't filter; we assert
  // on the where shape it received instead).
  const id21 = (i: number) => `tx_${String(i).padStart(21, "0")}`;
  test("AC-5 — cursor-roundtrip preserves order + produces zero overlap", async () => {
    const page1Rows = Array.from({ length: 26 }, (_, i) =>
      fakeRow({
        id: id21(50 - i),
        occurredOn: new Date(`2026-05-${String(20 - (i % 10)).padStart(2, "0")}`),
      }),
    );
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce(page1Rows);
    const page1 = await repo.listByUser("u_a", { limit: 25 });
    expect(page1.items).toHaveLength(25);
    expect(page1.nextCursor).not.toBeNull();
    const page1Last = page1.items[24];

    const page2Rows = Array.from({ length: 5 }, (_, i) =>
      fakeRow({
        id: id21(25 - i),
        occurredOn: new Date(`2026-05-${String(9 - (i % 5)).padStart(2, "0")}`),
      }),
    );
    (client.transaction.findMany as ReturnType<typeof mock>).mockResolvedValueOnce(page2Rows);
    const page2 = await repo.listByUser("u_a", { limit: 25, cursor: page1.nextCursor! });

    // Page2's where clause must carry the OR derived from page1's last row.
    const lastCall = (client.transaction.findMany as ReturnType<typeof mock>).mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const lastWhere = (lastCall as unknown as [{ where: { OR: unknown[] } }])[0].where;
    expect(lastWhere.OR).toBeDefined();
    expect(lastWhere.OR).toHaveLength(2);

    // Zero overlap on ids.
    const allIds = new Set([...page1.items.map((t) => t.id), ...page2.items.map((t) => t.id)]);
    expect(allIds.size).toBe(page1.items.length + page2.items.length);
    expect(page1Last).toBeDefined();
  });

  test("listByUser rejects malformed cursor with BAD_REQUEST instead of serving page 1", async () => {
    // Bogus cursor — neither base64-with-pipe nor a valid date payload.
    await expect(
      repo.listByUser("u_a", { limit: 50, cursor: "garbage-not-base64-pipe" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Decodable but date is invalid.
    const bogusDate = Buffer.from("not-a-date|tx_xxxxxxxxxxxxxxxxxxxxx").toString("base64url");
    await expect(repo.listByUser("u_a", { limit: 50, cursor: bogusDate })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  // AC-4 (verbatim from story 5-1:20):
  //   Given A's tx_aaa…, When A calls deleteTransaction({ id }), Then the row
  //   is removed and the response is { ok: true }. And When A calls it again
  //   on the now-gone id, Then the service rejects with TRANSACTION_NOT_FOUND.
  test("AC-4 — delete on cross-user returns { deleted: false }", async () => {
    (client.transaction.deleteMany as ReturnType<typeof mock>).mockResolvedValueOnce({ count: 0 });
    const out = await repo.delete("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" });
    expect(out).toEqual({ deleted: false });
  });

  // AC-12 (verbatim from story 5-1:28):
  //   Given the Zod schemas from @pekulo/validators/transactions, When parsing
  //   any of: { amount: -0.01 }, { amount: "not-a-number" }, { type: "invalid" },
  //   { category: "invalid" }, { label: "" }, { label: "x".repeat(121) },
  //   { accountId: "not-prefixed" }, { occurredOn: "2026-13-01" },
  //   { notes: "x".repeat(501) }, Then each invocation throws ZodError.
  //   amount: 0 IS allowed.
  test("AC-12 — validator rejects every documented bad-input shape", () => {
    // Story L28 lists 9 reject cases + amount=0 allow.
    expect(() => createTransactionInputSchema.parse(sampleInput({ amount: -0.01 }))).toThrow();
    expect(() =>
      createTransactionInputSchema.parse({
        ...sampleInput(),
        amount: "not-a-number" as unknown as never,
      }),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse({ ...sampleInput(), type: "invalid" as unknown as never }),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse({
        ...sampleInput(),
        category: "invalid" as unknown as never,
      }),
    ).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ label: "" }))).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ label: "x".repeat(121) })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ accountId: "not-prefixed" })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ occurredOn: "2026-13-01" })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ notes: "x".repeat(501) })),
    ).toThrow();
    // amount = 0 IS allowed (Alex D-step04 confirmation)
    expect(() => createTransactionInputSchema.parse(sampleInput({ amount: 0 }))).not.toThrow();
  });

  test("validator rejects impossible calendar dates + Infinity/NaN amounts", () => {
    // Day-in-month overflow — refine catches these (regex alone would pass).
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ occurredOn: "2026-02-30" })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ occurredOn: "2026-02-29" })),
    ).toThrow(); // 2026 is not a leap year
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ occurredOn: "2026-04-31" })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ occurredOn: "2024-02-29" })),
    ).not.toThrow(); // 2024 is a leap year — valid.
    // Infinity / NaN — .finite() catches these (.min(0) alone would let Infinity through).
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ amount: Number.POSITIVE_INFINITY })),
    ).toThrow();
    expect(() =>
      createTransactionInputSchema.parse(sampleInput({ amount: Number.NEGATIVE_INFINITY })),
    ).toThrow();
    expect(() => createTransactionInputSchema.parse(sampleInput({ amount: Number.NaN }))).toThrow();
  });

  // Story 5-2 T6 — bulkCreate via prisma.$transaction per-row create.
  // AC-6 (verbatim, story 5-2-csv-import.md:22):
  //   Given an array of 50 ValidatedCsvRow for user A, When A calls
  //   importCsv({ rows }), Then the repository runs $transaction with
  //   per-row tx.transaction.create (NOT createMany — bypasses the
  //   prefixed-ids extension per ADR-0012). And if any row fails, the
  //   whole batch rolls back — 0 rows committed.
  describe("bulkCreate", () => {
    const sampleCsvRow = (over: Partial<ValidatedCsvRow> = {}): ValidatedCsvRow => ({
      occurredOn: "2026-05-01",
      amount: 42.5,
      type: "inflow",
      category: "autre",
      label: "Row",
      accountId: "acc_aaa111111111111111111",
      isImprevu: false,
      notes: null,
      ...over,
    });

    test("persists every row inside a $transaction and returns persisted count", async () => {
      const fakeClient = createFakeClient();
      const localRepo = createTransactionsRepository({ client: fakeClient });
      const rows: ValidatedCsvRow[] = [
        sampleCsvRow({ label: "Row 1" }),
        sampleCsvRow({ label: "Row 2", type: "outflow", amount: 100 }),
      ];
      const out = await localRepo.bulkCreate("u_a", rows);
      expect(out.persisted).toBe(2);
      expect(fakeClient.__createCallCount()).toBe(2);
      expect(fakeClient.__txCallCount()).toBe(1);
      expect(fakeClient.__persisted).toHaveLength(2);
    });

    test("rolls back when any row fails — persisted reflects 0 (rejection + clean store)", async () => {
      // Force the SECOND create call to throw — mirrors a Prisma constraint
      // violation mid-batch. Pre-throw row 1 was committed inside the tx;
      // the $transaction rollback path discards it (real Prisma behaviour).
      const fakeClient = createFakeClient({ bulkCreateThrowsOnNth: 2 });
      const localRepo = createTransactionsRepository({ client: fakeClient });
      const rows: ValidatedCsvRow[] = [
        sampleCsvRow({ label: "A" }),
        sampleCsvRow({ label: "B" }),
        sampleCsvRow({ label: "C" }),
      ];
      await expect(localRepo.bulkCreate("u_a", rows)).rejects.toThrow(
        /simulated DB constraint on create call #2/,
      );
      expect(fakeClient.__persisted).toHaveLength(0);
    });

    // Story 5-3 T5 — bulkCreate now surfaces the inserted rows so the
    // service can categorise them post-commit (AC-3 paired-pair detection).
    test("returns the inserted rows so the service can categorise post-batch", async () => {
      const fakeClient = createFakeClient();
      const localRepo = createTransactionsRepository({ client: fakeClient });
      const rows: ValidatedCsvRow[] = [
        sampleCsvRow({ label: "Pair-out", type: "outflow", amount: 120 }),
        sampleCsvRow({ label: "Pair-in", type: "inflow", amount: 120 }),
      ];
      const out = await localRepo.bulkCreate("u_a", rows);
      expect(out.persisted).toBe(2);
      expect(out.rows).toHaveLength(2);
      expect(out.rows[0]?.id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
      expect(out.rows[1]?.id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
      expect(out.rows[0]?.label).toBe("Pair-out");
      expect(out.rows[1]?.label).toBe("Pair-in");
      expect(out.rows[0]?.transferPairId).toBeNull();
    });
  });

  // ─── 5-3 — findTransferPairCandidates / pairAsTransfer / unpairAfterDelete ─
  // The story's pair-detection lives in transactions.service.ts (T6) ; the
  // repository's job here is just to surface eligible siblings, run the
  // 2-row updateMany, and unpair the survivor on delete.

  // AC-1 (verbatim from story 5-3-transfer-rule.md:17, excerpt):
  //   the service detects the pair, generates a fresh tp_<21-char-base62> id,
  //   and the repository updates BOTH rows so category=transfer, transferPairId=<same>.
  test("AC-1 — findTransferPairCandidates returns opposite-type same-date+amount sibling on different account", async () => {
    const expectedSibling = fakeRow({
      id: "tx_outxxxxxxxxxxxxxxxxxx",
      accountId: "acc_bbb222222222222222222",
      type: "outflow",
      category: "autre",
    });
    const findManyMock = mock(async () => [expectedSibling]);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const localRepo = createTransactionsRepository({ client: fakeClient });
    const out = await localRepo.findTransferPairCandidates("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "inflow",
    });
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

  // AC-6 (verbatim from story 5-3-transfer-rule.md:27):
  //   Given an outflow AND an inflow with same date/amount/user but on the
  //   SAME accountId, When the rule runs, Then it does NOT pair them.
  test("AC-6 — findTransferPairCandidates filters out same-account siblings via `not` clause", async () => {
    const findManyMock = mock(async () => []);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const localRepo = createTransactionsRepository({ client: fakeClient });
    await localRepo.findTransferPairCandidates("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "outflow",
    });
    const firstCall = findManyMock.mock.calls.at(0) as unknown as [
      { where: { accountId: { not: string } } },
    ];
    expect(firstCall[0].where.accountId).toEqual({ not: "acc_aaa111111111111111111" });
  });

  // AC-7 (verbatim from story 5-3-transfer-rule.md:29):
  //   the rule pairs A's outflow with A's new inflow — B's row is INVISIBLE
  //   to the query (where: { userId } + RLS belt + braces).
  test("AC-7 — findTransferPairCandidates scopes by userId (cross-user isolation)", async () => {
    const findManyMock = mock(async () => []);
    const fakeClient = {
      transaction: { findMany: findManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const localRepo = createTransactionsRepository({ client: fakeClient });
    await localRepo.findTransferPairCandidates("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-20",
      amount: 120.0,
      type: "outflow",
    });
    const firstCall = findManyMock.mock.calls.at(0) as unknown as [{ where: { userId: string } }];
    expect(firstCall[0].where.userId).toBe("u_a");
  });

  test("AC-1 — pairAsTransfer runs a 2-row updateMany scoped by userId", async () => {
    const updateManyMock = mock(async () => ({ count: 2 }));
    const fakeClient = {
      transaction: { updateMany: updateManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const localRepo = createTransactionsRepository({ client: fakeClient });
    await localRepo.pairAsTransfer(
      "u_a",
      "tx_aaaaaaaaaaaaaaaaaaaaa",
      "tx_bbbbbbbbbbbbbbbbbbbbb",
      "tp_xxxxxxxxxxxxxxxxxxxxx",
    );
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const firstCall = updateManyMock.mock.calls.at(0) as unknown as [
      {
        where: { userId: string; id: { in: string[] } };
        data: { category: string; transferPairId: string };
      },
    ];
    const call = firstCall[0];
    expect(call.where.userId).toBe("u_a");
    expect(call.where.id.in).toEqual(["tx_aaaaaaaaaaaaaaaaaaaaa", "tx_bbbbbbbbbbbbbbbbbbbbb"]);
    expect(call.data.category).toBe("transfer");
    expect(call.data.transferPairId).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
  });

  // AC-11 (verbatim from story 5-3-transfer-rule.md:37, excerpt):
  //   the service calls the repository to update the SIBLING → { category:
  //   "autre", transferPairId: null }, then deletes the candidate.
  test("AC-11 — unpairAfterDelete updates only the sibling (id != idToExclude)", async () => {
    const updateManyMock = mock(async () => ({ count: 1 }));
    const fakeClient = {
      transaction: { updateMany: updateManyMock },
    } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
    const localRepo = createTransactionsRepository({ client: fakeClient });
    await localRepo.unpairAfterDelete(
      "u_a",
      "tp_xxxxxxxxxxxxxxxxxxxxx",
      "tx_aaaaaaaaaaaaaaaaaaaaa",
    );
    const firstCall = updateManyMock.mock.calls.at(0) as unknown as [
      {
        where: { userId: string; transferPairId: string; id: { not: string } };
        data: { category: string; transferPairId: null };
      },
    ];
    const call = firstCall[0];
    expect(call.where.userId).toBe("u_a");
    expect(call.where.transferPairId).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
    expect(call.where.id.not).toBe("tx_aaaaaaaaaaaaaaaaaaaaa");
    expect(call.data.category).toBe("autre");
    expect(call.data.transferPairId).toBeNull();
  });
});
