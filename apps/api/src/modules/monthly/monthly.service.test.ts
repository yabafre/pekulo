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
});
