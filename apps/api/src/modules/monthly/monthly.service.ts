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
  MonthlyRecord,
  UpsertMonthlyInput,
} from "@pekulo/validators";
import { deriveMonthlyAggregates } from "../../common/derive/monthly-aggregates";
import type { MonthlyRepository } from "./monthly.repository";

export interface MonthlyService {
  getMonthly(userId: string, input: GetMonthlyInput): Promise<GetMonthlyOutput>;
  upsertMonthly(userId: string, input: UpsertMonthlyInput): Promise<MonthlyRecord>;
}

export function createMonthlyService(deps: { repository: MonthlyRepository }): MonthlyService {
  return {
    async getMonthly(userId, input) {
      const persisted = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      if (persisted) {
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
  };
}
