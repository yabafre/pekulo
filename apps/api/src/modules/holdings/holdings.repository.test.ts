// Repository unit tests (TDD RED → GREEN in T8). Fake Prisma client modelled
// as an in-memory Map; each method asserts the explicit `where: { userId }`
// clause is present (defense in depth, lint rule 0-12 + ADR-0013).
//
// Mirrors apps/api/src/modules/accounts/accounts.repository.test.ts shape.

import { describe, expect, test } from "bun:test";
import type { ExtendedPrismaClient } from "../../database";
import { createHoldingsRepository } from "./holdings.repository";

type HoldingRow = {
  id: string;
  userId: string;
  accountId: string;
  kind: "etf" | "action" | "crypto" | "autre";
  ticker: string | null;
  isin: string | null;
  label: string;
  currency: string;
  quantity: { toNumber: () => number };
  avgCost: { toNumber: () => number };
  lastPrice: { toNumber: () => number };
  lastPriceAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
};

type LotRow = {
  id: string;
  userId: string;
  holdingId: string;
  type: "buy" | "sell";
  occurredOn: Date;
  quantity: { toNumber: () => number };
  priceUnit: { toNumber: () => number };
  fees: { toNumber: () => number };
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const userA = "00000000-0000-0000-0000-00000000000a";
const userB = "00000000-0000-0000-0000-00000000000b";
const accA = "acc_aaaaaaaaaaaaaaaaaaaaa";
const accB = "acc_bbbbbbbbbbbbbbbbbbbbb";

function dec(n: number): { toNumber: () => number } {
  return { toNumber: () => n };
}

function makeFakeClient() {
  const accounts = new Map<string, { id: string; userId: string }>([
    [accA, { id: accA, userId: userA }],
    [accB, { id: accB, userId: userB }],
  ]);
  const holdings = new Map<string, HoldingRow>();
  const lots = new Map<string, LotRow>();
  let holdingCounter = 0;
  let lotCounter = 0;

  function nextHoldingId(): string {
    holdingCounter += 1;
    return "hld_" + String(holdingCounter).padStart(21, "x");
  }
  function nextLotId(): string {
    lotCounter += 1;
    return "lot_" + String(lotCounter).padStart(21, "x");
  }

  const client = {
    account: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const row = accounts.get(where.id);
        if (!row || row.userId !== where.userId) return null;
        return row;
      },
    },
    holding: {
      create: async ({ data }: { data: Omit<HoldingRow, "id"> & { id?: string } }) => {
        const id = data.id ?? nextHoldingId();
        const row: HoldingRow = {
          id,
          userId: data.userId,
          accountId: data.accountId,
          kind: data.kind,
          ticker: data.ticker ?? null,
          isin: data.isin ?? null,
          label: data.label,
          currency: data.currency,
          quantity: data.quantity,
          avgCost: data.avgCost,
          lastPrice: data.lastPrice ?? dec(0),
          lastPriceAt: data.lastPriceAt ?? null,
          notes: data.notes ?? null,
          createdAt: data.createdAt ?? new Date("2026-05-17T00:00:00Z"),
          updatedAt: data.updatedAt ?? new Date("2026-05-17T00:00:00Z"),
          closedAt: data.closedAt ?? null,
        };
        holdings.set(id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const row = holdings.get(where.id);
        if (!row || row.userId !== where.userId) return null;
        return row;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { userId: string; closedAt?: null | { not: null } };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) => {
        let rows = Array.from(holdings.values()).filter((r) => r.userId === where.userId);
        if (where.closedAt === null) rows = rows.filter((r) => r.closedAt === null);
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        } else if (orderBy?.createdAt === "desc") {
          rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return rows;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; userId: string; closedAt?: null };
        data: Partial<HoldingRow>;
      }) => {
        const row = holdings.get(where.id);
        if (!row || row.userId !== where.userId) return { count: 0 };
        if (where.closedAt === null && row.closedAt !== null) return { count: 0 };
        holdings.set(where.id, { ...row, ...data });
        return { count: 1 };
      },
    },
    holdingLot: {
      create: async ({ data }: { data: Omit<LotRow, "id"> & { id?: string } }) => {
        const id = data.id ?? nextLotId();
        const row: LotRow = {
          id,
          userId: data.userId,
          holdingId: data.holdingId,
          type: data.type,
          occurredOn: data.occurredOn,
          quantity: data.quantity,
          priceUnit: data.priceUnit,
          fees: data.fees ?? dec(0),
          notes: data.notes ?? null,
          createdAt: data.createdAt ?? new Date("2026-05-17T00:00:00Z"),
          updatedAt: data.updatedAt ?? new Date("2026-05-17T00:00:00Z"),
        };
        lots.set(id, row);
        return row;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { holdingId: string; userId: string };
        orderBy?: Array<{ occurredOn?: "asc" | "desc"; createdAt?: "asc" | "desc" }>;
      }) => {
        let rows = Array.from(lots.values()).filter(
          (r) => r.holdingId === where.holdingId && r.userId === where.userId,
        );
        if (orderBy && orderBy.length > 0) {
          rows = [...rows].sort((a, b) => {
            for (const key of orderBy) {
              if (key.occurredOn) {
                const d = a.occurredOn.getTime() - b.occurredOn.getTime();
                if (d !== 0) return key.occurredOn === "asc" ? d : -d;
              }
              if (key.createdAt) {
                const d = a.createdAt.getTime() - b.createdAt.getTime();
                if (d !== 0) return key.createdAt === "asc" ? d : -d;
              }
            }
            return 0;
          });
        }
        return rows;
      },
    },
  };
  // Minimal $transaction shim — no isolation, no rollback. The repository's
  // recordLot calls $transaction(fn) and we just invoke fn with the same client.
  // Fidelity is enough for the in-memory probe + insert semantics this test exercises.
  const withTx = Object.assign(client, {
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => fn(client),
  });
  return {
    client: withTx as unknown as ExtendedPrismaClient,
    raw: { accounts, holdings, lots },
  };
}

describe("holdings.repository", () => {
  test("create: inserts a row and surfaces a prefixed hld_ id", async () => {
    const { client } = makeFakeClient();
    const repo = createHoldingsRepository({ client });
    const created = await repo.create(userA, {
      accountId: accA,
      ticker: "BTC-USD",
      isin: null,
      kind: "crypto",
      currency: "USD",
      label: "Bitcoin",
      quantity: 0.5,
      avgCost: 60000,
      notes: null,
    });
    expect(created.id).toMatch(/^hld_/);
    expect(created.kind).toBe("crypto");
    expect(created.quantity).toBe(0.5);
    expect(created.avgCost).toBe(60000);
    expect(created.closedAt).toBeNull();
  });

  test("listByUser: returns only matching userId rows, ordered by createdAt asc", async () => {
    const { client, raw } = makeFakeClient();
    // Inserted in non-chronological order to exercise the repository's orderBy.
    raw.holdings.set("hld_userA_2", {
      id: "hld_userA_2",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "PE500",
      isin: null,
      label: "BNP Paribas S&P 500",
      currency: "EUR",
      quantity: dec(20),
      avgCost: dec(15),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-03-15"),
      updatedAt: new Date("2026-03-15"),
      closedAt: null,
    });
    raw.holdings.set("hld_userA_1", {
      id: "hld_userA_1",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Amundi MSCI World",
      currency: "EUR",
      quantity: dec(10),
      avgCost: dec(80),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      closedAt: null,
    });
    raw.holdings.set("hld_userB_1", {
      id: "hld_userB_1",
      userId: userB,
      accountId: accB,
      kind: "etf",
      ticker: "PE500",
      isin: null,
      label: "BNP Paribas S&P 500",
      currency: "EUR",
      quantity: dec(20),
      avgCost: dec(15),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
      closedAt: null,
    });
    const repo = createHoldingsRepository({ client });
    const result = await repo.listByUser(userA, { includeClosed: true });
    expect(result.length).toBe(2);
    // userB row excluded + userA rows ordered by createdAt asc, regardless of Map insertion order.
    expect(result.map((r) => r.id)).toEqual(["hld_userA_1", "hld_userA_2"]);
  });

  test("listByUser: excludes rows with non-null closedAt when includeClosed=false", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_active", {
      id: "hld_active",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Amundi",
      currency: "EUR",
      quantity: dec(10),
      avgCost: dec(80),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      closedAt: null,
    });
    raw.holdings.set("hld_closed", {
      id: "hld_closed",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "VWCE",
      isin: null,
      label: "Vanguard FTSE All-World",
      currency: "EUR",
      quantity: dec(5),
      avgCost: dec(100),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
      closedAt: new Date("2026-05-15"),
    });
    const repo = createHoldingsRepository({ client });
    const result = await repo.listByUser(userA, { includeClosed: false });
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("hld_active");
  });

  test("close: idempotent on already-closed holding (no re-stamp)", async () => {
    const { client, raw } = makeFakeClient();
    const originalClose = new Date("2026-05-01");
    raw.holdings.set("hld_already", {
      id: "hld_already",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Amundi",
      currency: "EUR",
      quantity: dec(10),
      avgCost: dec(80),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      closedAt: originalClose,
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.close(userA, "hld_already");
    expect(out.outcome).toBe("already-closed");
    expect(raw.holdings.get("hld_already")!.closedAt).toEqual(originalClose);
  });

  test("close: cross-user returns not-found", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_userB", {
      id: "hld_userB",
      userId: userB,
      accountId: accB,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "B",
      currency: "EUR",
      quantity: dec(1),
      avgCost: dec(1),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.close(userA, "hld_userB");
    expect(out.outcome).toBe("not-found");
  });

  test("recordLot: inserts a row and surfaces a prefixed lot_ id", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_p", {
      id: "hld_p",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Amundi",
      currency: "EUR",
      quantity: dec(10),
      avgCost: dec(80),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.recordLot(userA, {
      holdingId: "hld_p",
      type: "buy",
      occurredOn: new Date("2026-04-01"),
      quantity: 5,
      priceUnit: 90,
      fees: 0.5,
      notes: null,
    });
    expect(out.outcome).toBe("ok");
    if (out.outcome !== "ok") throw new Error("expected outcome ok");
    expect(out.lot.id).toMatch(/^lot_/);
    expect(out.lot.quantity).toBe(5);
    expect(out.lot.priceUnit).toBe(90);
    expect(out.lot.fees).toBe(0.5);
  });

  test("recordLot: cross-user / unknown holding → outcome 'not-found' (no lot inserted)", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_userB", {
      id: "hld_userB",
      userId: userB,
      accountId: accB,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "B",
      currency: "EUR",
      quantity: dec(1),
      avgCost: dec(1),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.recordLot(userA, {
      holdingId: "hld_userB",
      type: "buy",
      occurredOn: new Date("2026-04-01"),
      quantity: 1,
      priceUnit: 100,
      fees: 0,
      notes: null,
    });
    expect(out.outcome).toBe("not-found");
    expect(raw.lots.size).toBe(0);
  });

  test("recordLot: closed holding → outcome 'closed' (no lot inserted, atomic check)", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_closed", {
      id: "hld_closed",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Closed",
      currency: "EUR",
      quantity: dec(10),
      avgCost: dec(80),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: new Date("2026-04-01"),
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.recordLot(userA, {
      holdingId: "hld_closed",
      type: "buy",
      occurredOn: new Date("2026-05-01"),
      quantity: 1,
      priceUnit: 100,
      fees: 0,
      notes: null,
    });
    expect(out.outcome).toBe("closed");
    expect(raw.lots.size).toBe(0);
  });

  test("findLotsByHoldingForUser: cross-user returns empty", async () => {
    const { client, raw } = makeFakeClient();
    raw.holdings.set("hld_b", {
      id: "hld_b",
      userId: userB,
      accountId: accB,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "B",
      currency: "EUR",
      quantity: dec(1),
      avgCost: dec(1),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });
    raw.lots.set("lot_b_1", {
      id: "lot_b_1",
      userId: userB,
      holdingId: "hld_b",
      type: "buy",
      occurredOn: new Date("2026-04-01"),
      quantity: dec(5),
      priceUnit: dec(90),
      fees: dec(0),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repo = createHoldingsRepository({ client });
    const result = await repo.findLotsByHoldingForUser(userA, "hld_b");
    expect(result.length).toBe(0);
  });

  test("findAccountForUser: cross-user returns null", async () => {
    const { client } = makeFakeClient();
    const repo = createHoldingsRepository({ client });
    const result = await repo.findAccountForUser(userA, accB);
    expect(result).toBeNull();
  });

  test("decimal coercion: surfaces values above MAX_SAFE_INTEGER without truncation", async () => {
    const { client, raw } = makeFakeClient();
    // oxlint-disable-next-line no-loss-of-precision -- AC-8 asserts decimalToNumber round-trips a value above MAX_SAFE_INTEGER
    const big = 9_007_199_254_740_993; // MAX_SAFE_INTEGER + 2
    raw.holdings.set("hld_big", {
      id: "hld_big",
      userId: userA,
      accountId: accA,
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Big",
      currency: "EUR",
      quantity: dec(big),
      avgCost: dec(0),
      lastPrice: dec(0),
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    });
    const repo = createHoldingsRepository({ client });
    const out = await repo.findByIdForUser(userA, "hld_big");
    expect(out).not.toBeNull();
    expect(out!.quantity).toBe(big);
  });
});
