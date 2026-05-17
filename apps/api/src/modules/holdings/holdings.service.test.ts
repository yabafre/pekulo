// Service unit tests (TDD RED → GREEN in T12). Fake repository, in-memory.

import { describe, expect, test } from "bun:test";
import type { Holding, HoldingLot } from "@pekulo/validators";
import { AccountError } from "../accounts/accounts.errors";
import { HoldingError } from "./holdings.errors";
import type { CloseHoldingOutcome, HoldingRepository } from "./holdings.repository";
import type { RecordLotOutcome } from "./holdings.repository";
import { createHoldingsService } from "./holdings.service";

const userA = "00000000-0000-0000-0000-00000000000a";
const accA = "acc_aaaaaaaaaaaaaaaaaaaaa";

function holding(over: Partial<Holding> = {}): Holding {
  return {
    id: "hld_aaaaaaaaaaaaaaaaaaaaa",
    userId: userA,
    accountId: accA,
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Amundi",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 0,
    lastPriceAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...over,
  };
}

function makeFakeRepo(): HoldingRepository & {
  state: { holdings: Map<string, Holding>; lots: Map<string, HoldingLot[]> };
} {
  const holdings = new Map<string, Holding>();
  const lots = new Map<string, HoldingLot[]>();
  return {
    state: { holdings, lots },
    async create(_userId, input) {
      const id = "hld_" + Math.random().toString(36).slice(2).padStart(21, "x");
      const row: Holding = holding({
        id,
        accountId: input.accountId,
        kind: input.kind,
        ticker: input.ticker ?? null,
        isin: input.isin ?? null,
        label: input.label,
        currency: input.currency,
        quantity: input.quantity,
        avgCost: input.avgCost,
        notes: input.notes ?? null,
      });
      holdings.set(id, row);
      return row;
    },
    async findByIdForUser(_userId, id) {
      const row = holdings.get(id);
      return row && row.userId === _userId ? row : null;
    },
    async listByUser(userId, opts) {
      const all = Array.from(holdings.values()).filter((r) => r.userId === userId);
      return opts.includeClosed ? all : all.filter((r) => r.closedAt === null);
    },
    async close(userId, id): Promise<CloseHoldingOutcome> {
      const row = holdings.get(id);
      if (!row || row.userId !== userId) return { outcome: "not-found" } as const;
      if (row.closedAt !== null) return { outcome: "already-closed" } as const;
      const closedAt = new Date();
      holdings.set(id, { ...row, closedAt });
      return { outcome: "closed", closedAt } as const;
    },
    async recordLot(userId, input): Promise<RecordLotOutcome> {
      const parent = holdings.get(input.holdingId);
      if (!parent || parent.userId !== userId) return { outcome: "not-found" } as const;
      if (parent.closedAt !== null) return { outcome: "closed" } as const;
      const id = "lot_" + Math.random().toString(36).slice(2).padStart(21, "x");
      const row: HoldingLot = {
        id,
        userId,
        holdingId: input.holdingId,
        type: input.type,
        occurredOn: input.occurredOn,
        quantity: input.quantity,
        priceUnit: input.priceUnit,
        fees: input.fees ?? 0,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const arr = lots.get(input.holdingId) ?? [];
      arr.push(row);
      lots.set(input.holdingId, arr);
      return { outcome: "ok", lot: row } as const;
    },
    async findLotsByHoldingForUser(userId, holdingId) {
      const arr = lots.get(holdingId) ?? [];
      return arr.filter((l) => l.userId === userId);
    },
    async findAccountForUser(_userId, accountId) {
      return accountId === accA ? { id: accA } : null;
    },
  };
}

describe("holdings.service", () => {
  test("create: rejects with ACCOUNT_NOT_FOUND when account does not belong to user", async () => {
    const repo = makeFakeRepo();
    const svc = createHoldingsService({ repository: repo });
    await expect(
      svc.create(userA, {
        accountId: "acc_unknown",
        kind: "etf",
        currency: "EUR",
        label: "Test",
        quantity: 1,
        avgCost: 1,
      }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  test("close: idempotent on already-closed (returns { ok: true })", async () => {
    const repo = makeFakeRepo();
    const closedAt = new Date("2026-05-01");
    repo.state.holdings.set("hld_already", holding({ id: "hld_already", closedAt }));
    const svc = createHoldingsService({ repository: repo });
    const out = await svc.close(userA, { id: "hld_already" });
    expect(out).toEqual({ ok: true });
    expect(repo.state.holdings.get("hld_already")!.closedAt).toEqual(closedAt);
  });

  test("close: cross-user → HoldingError(HOLDING_NOT_FOUND)", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set(
      "hld_userB",
      holding({ id: "hld_userB", userId: "00000000-0000-0000-0000-00000000000b" }),
    );
    const svc = createHoldingsService({ repository: repo });
    await expect(svc.close(userA, { id: "hld_userB" })).rejects.toMatchObject({
      name: "HoldingError",
      code: "HOLDING_NOT_FOUND",
    });
  });

  test("recordLot on closed holding → HoldingError(HOLDING_CLOSED)", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_closed", holding({ id: "hld_closed", closedAt: new Date() }));
    const svc = createHoldingsService({ repository: repo });
    await expect(
      svc.recordLot(userA, {
        holdingId: "hld_closed",
        type: "buy",
        occurredOn: new Date("2026-04-01"),
        quantity: 1,
        priceUnit: 100,
        fees: 0,
      }),
    ).rejects.toBeInstanceOf(HoldingError);
  });

  test("getDerived: zero-lot back-compat returns row's quantity + avgCost", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_manual", holding({ id: "hld_manual", quantity: 7, avgCost: 42 }));
    const svc = createHoldingsService({ repository: repo });
    const out = await svc.getDerived(userA, { id: "hld_manual" });
    expect(out).toMatchObject({
      holdingId: "hld_manual",
      quantity: 7,
      avgCost: 42,
      source: "manual",
    });
  });

  test("getDerived: with lots → deriveFromLots result, source 'lots'", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_lots", holding({ id: "hld_lots" }));
    repo.state.lots.set("hld_lots", [
      {
        id: "lot_1",
        userId: userA,
        holdingId: "hld_lots",
        type: "buy",
        occurredOn: new Date("2026-01-01"),
        quantity: 10,
        priceUnit: 100,
        fees: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const svc = createHoldingsService({ repository: repo });
    const out = await svc.getDerived(userA, { id: "hld_lots" });
    expect(out).toMatchObject({
      holdingId: "hld_lots",
      quantity: 10,
      avgCost: 100,
      source: "lots",
    });
  });

  test("list({ includeClosed: false }) excludes closed; includeClosed: true includes them", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_active", holding({ id: "hld_active" }));
    repo.state.holdings.set("hld_closed", holding({ id: "hld_closed", closedAt: new Date() }));
    const svc = createHoldingsService({ repository: repo });
    const activeOnly = await svc.list(userA, { includeClosed: false });
    expect(activeOnly.map((r) => r.id).sort()).toEqual(["hld_active"]);
    const all = await svc.list(userA, { includeClosed: true });
    expect(all.map((r) => r.id).sort()).toEqual(["hld_active", "hld_closed"]);
  });
});
