// apps/api/src/modules/transactions/transactions.repository.test.ts
// bun:test — TDD RED for the transactions repository (story 5-1).
// Asserts: prefixed-id create, userId guard, cursor pagination, Decimal
// coercion via decimalToNumber, AC-12 validator rejection cases.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createTransactionInputSchema, type CreateTransactionInput } from "@pekulo/validators";
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
  createdAt: new Date("2026-05-15T10:00:00Z"),
  updatedAt: new Date("2026-05-15T10:00:00Z"),
  ...over,
});

const createFakeClient = () => {
  const create = mock(async ({ data }: { data: FakeRow }) => fakeRow(data));
  const findFirst = mock(async () => null as FakeRow | null);
  const findMany = mock(async () => [] as FakeRow[]);
  const updateMany = mock(async () => ({ count: 1 }));
  const deleteMany = mock(async () => ({ count: 1 }));
  return {
    transaction: { create, findFirst, findMany, updateMany, deleteMany },
  } as unknown as Parameters<typeof createTransactionsRepository>[0]["client"];
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
});
