// apps/api/src/modules/monthly/monthly.service.ts
// Business logic for the monthly aggregate (story 5-4). Two entry points:
//   - getMonthly(userId, {year, monthNum}) → discriminated `source` envelope
//     (derived defaults OR persisted row).
//   - upsertMonthly(userId, input) → idempotent override persistence.
//
// The pure derive lives in apps/api/src/common/derive/monthly-aggregates.ts
// (T5). The service composes: repository.listTransactionsForMonth →
// derive → envelope. NO LLM call (épic 6 territory).
//
// signedOffAt is read-only here — 5-5 will own the freeze/reopen path on
// the same column without re-touching this file.

import type {
  GetMonthlyInput,
  GetMonthlyOutput,
  ListMonthlyInput,
  ListMonthlyOutput,
  MonthlyRecord,
  Transaction,
  UpsertMonthlyInput,
} from "@pekulo/validators";
import { deriveMonthlyAggregates } from "../../common/derive/monthly-aggregates";
import type { MonthlyRepository } from "./monthly.repository";

export interface MonthlyServiceClock {
  now: { year: number; monthNum: number };
}

export interface MonthlyService {
  getMonthly(userId: string, input: GetMonthlyInput): Promise<GetMonthlyOutput>;
  upsertMonthly(userId: string, input: UpsertMonthlyInput): Promise<MonthlyRecord>;
  /** Optional clock seam — defaults to `new Date()` UTC. Test path pins it. */
  listMonthly(
    userId: string,
    input: ListMonthlyInput,
    clock?: MonthlyServiceClock,
  ): Promise<ListMonthlyOutput>;
}

export function createMonthlyService(deps: { repository: MonthlyRepository }): MonthlyService {
  return {
    async getMonthly(userId, input) {
      const persisted = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      // 5-5 contract (AC-4): the source is signedOffAt-driven, not row-existence-
      // driven. A row with signedOffAt: null is treated as derived (and stays
      // refreshable from transactions on every read). The persisted override
      // values are only authoritative once frozen.
      if (persisted && persisted.signedOffAt !== null) {
        return { source: "persisted", record: persisted };
      }
      const transactions = await deps.repository.listTransactionsForMonth(
        userId,
        input.year,
        input.monthNum,
      );
      const aggregates = deriveMonthlyAggregates({ transactions });
      return {
        source: "derived",
        record: {
          year: input.year,
          monthNum: input.monthNum,
          ...aggregates,
          signedOffAt: null,
        },
      };
    },

    async upsertMonthly(userId, input) {
      return deps.repository.upsertByMonth(userId, input);
    },

    async listMonthly(userId, input, clock) {
      const now = clock?.now ?? currentMonthUTC();
      // Window: [now - (limit-1) months, now] inclusive — same shape ux-preview
      // ships in MonthlyScreen (current month at index 0, past months after).
      const fromOrdinal = monthOrdinal(now.year, now.monthNum) - (input.limit - 1);
      const fromYear = Math.floor(fromOrdinal / 12);
      const fromMonthNum = (fromOrdinal % 12) + 1;

      const [persistedRows, transactions] = await Promise.all([
        deps.repository.listPersistedInWindow(userId, fromYear, fromMonthNum),
        deps.repository.listTransactionsSince(userId, fromYear, fromMonthNum),
      ]);

      const persistedByMonth = new Map<number, MonthlyRecord>();
      for (const row of persistedRows) {
        persistedByMonth.set(monthOrdinal(row.year, row.monthNum), row);
      }
      const txsByMonth = bucketTransactionsByMonth(transactions);

      const items: ListMonthlyOutput["items"] = [];
      for (let i = 0; i < input.limit; i++) {
        const ordinal = monthOrdinal(now.year, now.monthNum) - i;
        const year = Math.floor(ordinal / 12);
        const monthNum = (ordinal % 12) + 1;
        const persisted = persistedByMonth.get(ordinal);
        // 5-5 (AC-4): persisted ONLY when signedOffAt is set. A row with
        // signedOffAt: null falls back to the derive path same as no row.
        if (persisted && persisted.signedOffAt !== null) {
          items.push({ source: "persisted", record: persisted });
          continue;
        }
        const monthTxs = txsByMonth.get(ordinal) ?? [];
        const aggregates = deriveMonthlyAggregates({ transactions: monthTxs });
        items.push({
          source: "derived",
          record: { year, monthNum, ...aggregates, signedOffAt: null },
        });
      }
      return { items };
    },
  };
}

function monthOrdinal(year: number, monthNum: number): number {
  return year * 12 + (monthNum - 1);
}

function currentMonthUTC(): { year: number; monthNum: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), monthNum: now.getUTCMonth() + 1 };
}

function bucketTransactionsByMonth(transactions: Transaction[]): Map<number, Transaction[]> {
  const out = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    // tx.occurredOn is ISO yyyy-mm-dd; parse without timezone drift.
    const parts = tx.occurredOn.split("-");
    const year = Number(parts[0] ?? 0);
    const monthNum = Number(parts[1] ?? 1);
    const ordinal = monthOrdinal(year, monthNum);
    const bucket = out.get(ordinal);
    if (bucket) bucket.push(tx);
    else out.set(ordinal, [tx]);
  }
  return out;
}
