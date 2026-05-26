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
}): MonthlyRepository & {
  upsertCalls: number;
  lastUpsert: unknown;
  setSignedOffAtCalls: number;
} {
  const state = { upsertCalls: 0, lastUpsert: null as unknown, setSignedOffAtCalls: 0 };
  // 5-5 T7: mutable signedOffAt + per-month payload tracking so signOff
  // (upsert → setSignedOffAt) and reopen (setSignedOffAt → null) flows can be
  // exercised end-to-end against the fake repository. `lastUpsertedRow` lets
  // the post-freeze read return the values the caller just upserted, even
  // when seed.persisted was empty at construction.
  let currentSignedOffAt: string | null = seed.persisted?.signedOffAt ?? null;
  let lastUpsertedRow: MonthlyRecord | null = seed.persisted ?? null;
  return {
    get upsertCalls() {
      return state.upsertCalls;
    },
    get lastUpsert() {
      return state.lastUpsert;
    },
    get setSignedOffAtCalls() {
      return state.setSignedOffAtCalls;
    },
    async findByMonth() {
      if (!seed.persisted) return null;
      return { ...seed.persisted, signedOffAt: currentSignedOffAt };
    },
    async listTransactionsForMonth() {
      return seed.transactions ?? [];
    },
    async upsertByMonth(_userId, input) {
      state.upsertCalls++;
      state.lastUpsert = input;
      const row: MonthlyRecord = {
        id: lastUpsertedRow?.id ?? "mr_upsert000000000000000",
        year: input.year,
        monthNum: input.monthNum,
        incomeEur: input.incomeEur,
        spendingEur: input.spendingEur,
        transfersEur: input.transfersEur,
        netChangeEur: input.netChangeEur,
        signedOffAt: currentSignedOffAt,
        createdAt: lastUpsertedRow?.createdAt ?? "2026-05-25T10:00:00.000Z",
      };
      lastUpsertedRow = row;
      return row;
    },
    async setSignedOffAt(_userId, year, monthNum, value) {
      state.setSignedOffAtCalls++;
      currentSignedOffAt = value ? value.toISOString() : null;
      const base = lastUpsertedRow;
      return {
        id: base?.id ?? "mr_upsert000000000000000",
        year,
        monthNum,
        incomeEur: base?.incomeEur ?? 0,
        spendingEur: base?.spendingEur ?? 0,
        transfersEur: base?.transfersEur ?? 0,
        netChangeEur: base?.netChangeEur ?? 0,
        signedOffAt: currentSignedOffAt,
        createdAt: base?.createdAt ?? "2026-05-25T10:00:00.000Z",
      };
    },
    async listPersistedInWindow() {
      return seed.persisted ? [{ ...seed.persisted, signedOffAt: currentSignedOffAt }] : [];
    },
    async listTransactionsSince() {
      return seed.transactions ?? [];
    },
  } as MonthlyRepository & {
    upsertCalls: number;
    lastUpsert: unknown;
    setSignedOffAtCalls: number;
  };
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

  it("getMonthly — persisted row with signedOffAt set → returns persisted (5-5 AC-4)", async () => {
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
          signedOffAt: "2026-05-27T10:00:00.000Z",
          createdAt: "2026-05-25T10:00:00.000Z",
        },
        transactions: [tx({ type: "inflow", category: "salaire", amount: 9999 })],
      }),
    });
    const out = await service.getMonthly(USER_A, { year: 2026, monthNum: 5 });
    expect(out.source).toBe("persisted");
    if (out.source !== "persisted") throw new Error("unreachable");
    expect(out.record.spendingEur).toBe(2500);
  });

  it("getMonthly — persisted row with signedOffAt null → returns derived (5-5 AC-4)", async () => {
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
        transactions: [tx({ type: "inflow", category: "salaire", amount: 9999 })],
      }),
    });
    const out = await service.getMonthly(USER_A, { year: 2026, monthNum: 5 });
    expect(out.source).toBe("derived");
    // The 9999 inflow is what's surfaced — the persisted 3943 override is
    // intentionally ignored because the row isn't signed off yet.
    expect(out.record.incomeEur).toBe(9999);
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

  // ─── 5-5 signOff (T7) ───────────────────────────────────────────────────
  // The service consults global `new Date()` for the close-window check; tests
  // override globalThis.Date inside a try/finally so they pin a deterministic
  // "now" without leaking into adjacent tests.

  it("signOff — inside close window, no row → upserts + freezes (5-5 AC-1)", async () => {
    const repo = makeRepo({});
    service = createMonthlyService({ repository: repo });
    const fixedNow = new Date("2026-05-27T10:00:00.000Z"); // May 27 = window start
    const realDate = globalThis.Date;
    class FakeDate extends realDate {
      constructor(...args: ConstructorParameters<typeof realDate>) {
        super(...(args.length === 0 ? [fixedNow.toISOString()] : args));
      }
      static override now() {
        return fixedNow.getTime();
      }
    }
    globalThis.Date = FakeDate as unknown as DateConstructor;
    try {
      const out = await service.signOff(USER_A, {
        year: 2026,
        monthNum: 5,
        incomeEur: 3943,
        spendingEur: 2500,
        transfersEur: 500,
        netChangeEur: 1443,
      });
      expect(out.signedOffAt).toBe("2026-05-27T10:00:00.000Z");
      expect(out.spendingEur).toBe(2500);
    } finally {
      globalThis.Date = realDate;
    }
  });

  it("signOff — outside close window → MONTHLY_OUT_OF_WINDOW (5-5 AC-5)", async () => {
    const repo = makeRepo({});
    service = createMonthlyService({ repository: repo });
    const realDate = globalThis.Date;
    // May 26 = one day before May window start (May 27).
    const fixedNow = new Date("2026-05-26T10:00:00.000Z");
    class FakeDate extends realDate {
      constructor(...args: ConstructorParameters<typeof realDate>) {
        super(...(args.length === 0 ? [fixedNow.toISOString()] : args));
      }
      static override now() {
        return fixedNow.getTime();
      }
    }
    globalThis.Date = FakeDate as unknown as DateConstructor;
    try {
      await expect(
        service.signOff(USER_A, {
          year: 2026,
          monthNum: 5,
          incomeEur: 100,
          spendingEur: 50,
          transfersEur: 0,
          netChangeEur: 50,
        }),
      ).rejects.toThrow(/MONTHLY_OUT_OF_WINDOW|outside close window/);
    } finally {
      globalThis.Date = realDate;
    }
  });

  it("signOff — already signed → MONTHLY_SIGNED_OFF (5-5 AC-2)", async () => {
    const repo = makeRepo({
      persisted: {
        id: "mr_already0000000000000",
        year: 2026,
        monthNum: 5,
        incomeEur: 3943,
        spendingEur: 2500,
        transfersEur: 500,
        netChangeEur: 1443,
        signedOffAt: "2026-05-27T10:00:00.000Z",
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    });
    service = createMonthlyService({ repository: repo });
    const realDate = globalThis.Date;
    const fixedNow = new Date("2026-05-28T10:00:00.000Z");
    class FakeDate extends realDate {
      constructor(...args: ConstructorParameters<typeof realDate>) {
        super(...(args.length === 0 ? [fixedNow.toISOString()] : args));
      }
      static override now() {
        return fixedNow.getTime();
      }
    }
    globalThis.Date = FakeDate as unknown as DateConstructor;
    try {
      await expect(
        service.signOff(USER_A, {
          year: 2026,
          monthNum: 5,
          incomeEur: 3943,
          spendingEur: 2500,
          transfersEur: 500,
          netChangeEur: 1443,
        }),
      ).rejects.toThrow(/MONTHLY_SIGNED_OFF|already signed/);
    } finally {
      globalThis.Date = realDate;
    }
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
    async setSignedOffAt() {
      throw new Error("setSignedOffAt not exercised by listMonthly tests");
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
