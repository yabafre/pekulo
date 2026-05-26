// AC-1 / AC-2 / AC-7 (story 5-4):
//   getMonthly returns `{source:"derived"}` when no row is persisted
//   (deriving from transactions in the month), `{source:"persisted"}` when
//   the user already saved an override; upsertMonthly delegates to the
//   repository and the service never touches signedOffAt directly (5-5
//   owns that column).

import { describe, expect, it } from "bun:test";
import type { MonthlyRecord, Transaction } from "@pekulo/validators";
import { createMonthlyService, type MonthlyService } from "./monthly.service";
import type { MonthlyRepository } from "./monthly.repository";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "tx_aaaaaaaaaaaaaaaaaaaaa",
    accountId: partial.accountId ?? "acc_aaaaaaaaaaaaaaaaaaaaa",
    occurredOn: partial.occurredOn ?? "2026-05-15",
    label: partial.label ?? "x",
    amount: partial.amount ?? 0,
    type: partial.type ?? "inflow",
    category: partial.category ?? "autre",
    isImprevu: partial.isImprevu ?? false,
    notes: partial.notes ?? null,
    transferPairId: partial.transferPairId ?? null,
    createdAt: partial.createdAt ?? "2026-05-15T00:00:00.000Z",
  };
}

function makeRepo(seed: {
  persisted?: MonthlyRecord | null;
  transactions?: Transaction[];
}): MonthlyRepository & { upsertCalls: number; lastUpsert: unknown } {
  const state = { upsertCalls: 0, lastUpsert: null as unknown };
  return {
    get upsertCalls() {
      return state.upsertCalls;
    },
    get lastUpsert() {
      return state.lastUpsert;
    },
    async findByMonth() {
      return seed.persisted ?? null;
    },
    async listTransactionsForMonth() {
      return seed.transactions ?? [];
    },
    async upsertByMonth(_userId, input) {
      state.upsertCalls++;
      state.lastUpsert = input;
      return {
        id: "mr_upsert000000000000000",
        year: input.year,
        monthNum: input.monthNum,
        incomeEur: input.incomeEur,
        spendingEur: input.spendingEur,
        transfersEur: input.transfersEur,
        netChangeEur: input.netChangeEur,
        signedOffAt: seed.persisted?.signedOffAt ?? null,
        createdAt: "2026-05-25T10:00:00.000Z",
      };
    },
    async listPersistedInWindow() {
      return seed.persisted ? [seed.persisted] : [];
    },
    async listTransactionsSince() {
      return seed.transactions ?? [];
    },
  } as MonthlyRepository & { upsertCalls: number; lastUpsert: unknown };
}

describe("monthly.service", () => {
  let service: MonthlyService;

  it("getMonthly — empty user → derived zeros", async () => {
    service = createMonthlyService({ repository: makeRepo({}) });
    const out = await service.getMonthly(USER_A, { year: 2026, monthNum: 5 });
    expect(out.source).toBe("derived");
    expect(out.record).toEqual({
      year: 2026,
      monthNum: 5,
      incomeEur: 0,
      spendingEur: 0,
      transfersEur: 0,
      netChangeEur: 0,
      signedOffAt: null,
    });
  });

  it("getMonthly — transactions present → derived aggregates from listTransactionsForMonth", async () => {
    service = createMonthlyService({
      repository: makeRepo({
        transactions: [
          tx({ type: "inflow", category: "salaire", amount: 3700 }),
          tx({ type: "outflow", category: "loyer", amount: 1200 }),
          tx({ type: "outflow", category: "transfer", amount: 500, transferPairId: "tp_x" }),
          tx({ type: "inflow", category: "transfer", amount: 500, transferPairId: "tp_x" }),
        ],
      }),
    });
    const out = await service.getMonthly(USER_A, { year: 2026, monthNum: 5 });
    expect(out.source).toBe("derived");
    expect(out.record).toMatchObject({
      incomeEur: 3700,
      spendingEur: 1200,
      transfersEur: 500,
      netChangeEur: 2500,
    });
  });

  it("getMonthly — persisted row present → returns it (no derive)", async () => {
    service = createMonthlyService({
      repository: makeRepo({
        persisted: {
          id: "mr_persist00000000000000",
          year: 2026,
          monthNum: 5,
          incomeEur: 3943,
          spendingEur: 2500,
          transfersEur: 500,
          netChangeEur: 1443,
          signedOffAt: null,
          createdAt: "2026-05-25T10:00:00.000Z",
        },
        // Transactions are present but MUST NOT be consulted when a row
        // is persisted (AC-2 — persisted shape is the source of truth).
        transactions: [tx({ type: "inflow", category: "salaire", amount: 9999 })],
      }),
    });
    const out = await service.getMonthly(USER_A, { year: 2026, monthNum: 5 });
    expect(out.source).toBe("persisted");
    if (out.source !== "persisted") throw new Error("unreachable");
    expect(out.record.spendingEur).toBe(2500);
  });

  it("upsertMonthly — delegates to repository (signedOffAt preserved by repo, AC-7)", async () => {
    const repo = makeRepo({});
    service = createMonthlyService({ repository: repo });
    const out = await service.upsertMonthly(USER_A, {
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1443,
    });
    expect(out.id).toMatch(/^mr_/);
    expect(out.spendingEur).toBe(2500);
    expect(repo.upsertCalls).toBe(1);
  });

  // listMonthly — N most-recent months. Persisted rows win per month; missing
  // months derive from listTransactionsSince filtered to the month window.
  it("listMonthly — returns N descending months, derived when empty", async () => {
    const listRepo = makeListRepo({ now: { year: 2026, monthNum: 5 } });
    service = createMonthlyService({ repository: listRepo });
    const out = await service.listMonthly(
      USER_A,
      { limit: 3 },
      { now: { year: 2026, monthNum: 5 } },
    );
    expect(out.items).toHaveLength(3);
    expect(out.items.map((i) => `${i.record.year}-${i.record.monthNum}`)).toEqual([
      "2026-5",
      "2026-4",
      "2026-3",
    ]);
    expect(out.items.every((i) => i.source === "derived")).toBe(true);
  });

  it("listMonthly — persisted row wins over derive for that exact (year, monthNum)", async () => {
    const listRepo = makeListRepo({
      now: { year: 2026, monthNum: 5 },
      persisted: [
        {
          id: "mr_persistedapr00000000",
          year: 2026,
          monthNum: 4,
          incomeEur: 9999,
          spendingEur: 1,
          transfersEur: 0,
          netChangeEur: 9998,
          signedOffAt: "2026-05-01T00:00:00.000Z",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      transactions: [
        // These would derive incomeEur: 100 / spendingEur: 50 if used.
        tx({
          type: "inflow",
          category: "salaire",
          amount: 100,
          occurredOn: "2026-04-10",
        }),
        tx({
          type: "outflow",
          category: "loyer",
          amount: 50,
          occurredOn: "2026-04-15",
        }),
      ],
    });
    service = createMonthlyService({ repository: listRepo });
    const out = await service.listMonthly(
      USER_A,
      { limit: 2 },
      { now: { year: 2026, monthNum: 5 } },
    );
    const apr = out.items.find((i) => i.record.monthNum === 4);
    expect(apr?.source).toBe("persisted");
    expect(apr?.record.incomeEur).toBe(9999);
    expect(apr?.record.signedOffAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("listMonthly — wraps year on January boundary (descending past dec previous year)", async () => {
    const listRepo = makeListRepo({ now: { year: 2027, monthNum: 1 } });
    service = createMonthlyService({ repository: listRepo });
    const out = await service.listMonthly(
      USER_A,
      { limit: 3 },
      { now: { year: 2027, monthNum: 1 } },
    );
    expect(out.items.map((i) => `${i.record.year}-${i.record.monthNum}`)).toEqual([
      "2027-1",
      "2026-12",
      "2026-11",
    ]);
  });
});

// listMonthly fake — supplies persisted + transactions across multiple months.
function makeListRepo(seed: {
  now: { year: number; monthNum: number };
  persisted?: MonthlyRecord[];
  transactions?: Transaction[];
}): MonthlyRepository {
  return {
    async findByMonth() {
      return null;
    },
    async upsertByMonth(_userId, input) {
      return {
        id: "mr_unused0000000000000000",
        year: input.year,
        monthNum: input.monthNum,
        incomeEur: input.incomeEur,
        spendingEur: input.spendingEur,
        transfersEur: input.transfersEur,
        netChangeEur: input.netChangeEur,
        signedOffAt: null,
        createdAt: "2026-05-25T10:00:00.000Z",
      };
    },
    async listTransactionsForMonth() {
      return [];
    },
    async listPersistedInWindow() {
      return seed.persisted ?? [];
    },
    async listTransactionsSince() {
      return seed.transactions ?? [];
    },
  };
}
