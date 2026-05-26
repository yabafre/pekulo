// apps/api/src/common/derive/monthly-aggregates.ts
// Pure derive for FR-38 — monthly aggregates from categorised transactions.
//
// Contract (AC-1 from story 5-4):
//   - incomeEur     = Σ amount where type='inflow' AND category != 'transfer'
//   - spendingEur   = Σ amount where type='outflow' AND category != 'transfer'
//   - transfersEur  = Σ amount where category='transfer' AND type='outflow'
//                     (outflow leg only — avoids double-counting paired rows)
//   - netChangeEur  = incomeEur - spendingEur
//
// Zero IO — no Prisma, no clock, no env, no network, no logger. AC-8 grep
// guard runs against this file path in T16.

import type { Transaction } from "@pekulo/validators";

export interface MonthlyAggregates {
  incomeEur: number;
  spendingEur: number;
  transfersEur: number;
  netChangeEur: number;
}

export interface DeriveMonthlyAggregatesInput {
  transactions: Transaction[];
}

export function deriveMonthlyAggregates(input: DeriveMonthlyAggregatesInput): MonthlyAggregates {
  let incomeEur = 0;
  let spendingEur = 0;
  let transfersEur = 0;
  for (const tx of input.transactions) {
    if (tx.category === "transfer") {
      // Only the outflow leg counts — story 5-3 ships the pair as
      // {outflow, inflow} rows sharing transferPairId; counting both would
      // double the transfer total. The inflow leg is skipped.
      if (tx.type === "outflow") transfersEur += tx.amount;
      continue;
    }
    if (tx.type === "inflow") incomeEur += tx.amount;
    else spendingEur += tx.amount;
  }
  return {
    incomeEur,
    spendingEur,
    transfersEur,
    netChangeEur: incomeEur - spendingEur,
  };
}
