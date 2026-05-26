// AC-1 (verbatim from docs/stories/5-4-monthly-tracking.md):
//   Derive contract — incomeEur = Σ(type='inflow' ∧ category != 'transfer'),
//   spendingEur = Σ(type='outflow' ∧ category != 'transfer'),
//   transfersEur = Σ(type='outflow' ∧ category='transfer') (outflow leg only,
//   no double-count), netChangeEur = incomeEur - spendingEur.
//
// AC-8: zero IO (no DB, no clock, no network, no env, no logger). Verified
// here by the absence of any such import; the grep guard in T16 enforces.

import { describe, expect, it } from "bun:test";
import type { Transaction } from "@pekulo/validators";
import { deriveMonthlyAggregates } from "./monthly-aggregates";

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

describe("deriveMonthlyAggregates", () => {
  it("empty list → all zeros", () => {
    expect(deriveMonthlyAggregates({ transactions: [] })).toEqual({
      incomeEur: 0,
      spendingEur: 0,
      transfersEur: 0,
      netChangeEur: 0,
    });
  });

  it("only inflows (non-transfer) → incomeEur sums them, spending stays 0", () => {
    const transactions = [
      tx({ type: "inflow", category: "salaire", amount: 3700 }),
      tx({ type: "inflow", category: "bonus", amount: 243 }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 3943,
      spendingEur: 0,
      transfersEur: 0,
      netChangeEur: 3943,
    });
  });

  it("only outflows (non-transfer) → spendingEur sums them, income stays 0", () => {
    const transactions = [
      tx({ type: "outflow", category: "loyer", amount: 1200 }),
      tx({ type: "outflow", category: "courses", amount: 400 }),
      tx({ type: "outflow", category: "transport", amount: 90 }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 0,
      spendingEur: 1690,
      transfersEur: 0,
      netChangeEur: -1690,
    });
  });

  it("transfer pair (outflow leg counted once) → transfersEur only, no income / no spending", () => {
    const pairId = "tp_aaaaaaaaaaaaaaaaaaaaa";
    const transactions = [
      tx({
        type: "outflow",
        category: "transfer",
        amount: 500,
        transferPairId: pairId,
        accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
      }),
      tx({
        type: "inflow",
        category: "transfer",
        amount: 500,
        transferPairId: pairId,
        accountId: "acc_bbbbbbbbbbbbbbbbbbbbb",
      }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 0,
      spendingEur: 0,
      transfersEur: 500,
      netChangeEur: 0,
    });
  });

  it("AC-1 fixture — mixed inflows, outflows across categories, one transfer pair", () => {
    const pairId = "tp_aaaaaaaaaaaaaaaaaaaaa";
    const transactions = [
      tx({ type: "inflow", category: "salaire", amount: 3700 }),
      tx({ type: "inflow", category: "bonus", amount: 243 }),
      tx({ type: "outflow", category: "loyer", amount: 1200 }),
      tx({ type: "outflow", category: "courses", amount: 400 }),
      tx({ type: "outflow", category: "transport", amount: 90 }),
      tx({ type: "outflow", category: "sorties", amount: 150 }),
      tx({ type: "outflow", category: "voyage", amount: 100 }),
      tx({ type: "outflow", category: "sante", amount: 60 }),
      tx({ type: "outflow", category: "imprevu", amount: 50 }),
      tx({ type: "outflow", category: "autre", amount: 50 }),
      tx({ type: "outflow", category: "transfer", amount: 500, transferPairId: pairId }),
      tx({ type: "inflow", category: "transfer", amount: 500, transferPairId: pairId }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 3943,
      spendingEur: 2100,
      transfersEur: 500,
      netChangeEur: 1843,
    });
  });

  it("spending > income → netChange is negative", () => {
    const transactions = [
      tx({ type: "inflow", category: "salaire", amount: 1000 }),
      tx({ type: "outflow", category: "loyer", amount: 1500 }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 1000,
      spendingEur: 1500,
      transfersEur: 0,
      netChangeEur: -500,
    });
  });

  it("transferPairId on a non-transfer category is ignored (defensive)", () => {
    const transactions = [
      tx({
        type: "inflow",
        category: "salaire",
        amount: 100,
        transferPairId: "tp_legacydataaaaaaaaaa",
      }),
    ];
    expect(deriveMonthlyAggregates({ transactions })).toEqual({
      incomeEur: 100,
      spendingEur: 0,
      transfersEur: 0,
      netChangeEur: 100,
    });
  });
});
