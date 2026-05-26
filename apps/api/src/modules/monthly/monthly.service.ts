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
  ReopenMonthlyInput,
  SignOffMonthlyInput,
  Transaction,
  UpsertMonthlyInput,
} from "@pekulo/validators";
import { isWithinCloseWindow } from "../../common/derive/close-window";
import { deriveMonthlyAggregates } from "../../common/derive/monthly-aggregates";
import { PekuloError } from "../../common/errors";
import type { MonthlyRepository } from "./monthly.repository";

export interface MonthlyServiceClock {
  now: { year: number; monthNum: number };
}

export interface MonthlyService {
  getMonthly(userId: string, input: GetMonthlyInput): Promise<GetMonthlyOutput>;
  upsertMonthly(userId: string, input: UpsertMonthlyInput): Promise<MonthlyRecord>;
  /** Atomic upsert + freeze. Throws MONTHLY_OUT_OF_WINDOW (409) if today
   *  is outside [(last_day - 4) UTC, (last_day + 5) UTC]; throws
   *  MONTHLY_SIGNED_OFF (409) if the row is already signed. */
  signOff(userId: string, input: SignOffMonthlyInput): Promise<MonthlyRecord>;
  /** Clears signedOffAt. Throws MONTHLY_NOT_FOUND (404) if no row exists. */
  reopen(userId: string, input: ReopenMonthlyInput): Promise<MonthlyRecord>;
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
      // 5-5 AC-2: defense-in-depth guard. The web tier descopes the bare
      // upsert path (no UI surface in 5-4); a future override-on-current-
      // month surface might re-introduce it, and the API contract must
      // refuse writes to a signed-off row from any caller.
      const existing = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      if (existing && existing.signedOffAt !== null) {
        throw new PekuloError(
          "MONTHLY_SIGNED_OFF",
          `Cannot upsert ${input.year}-${String(input.monthNum).padStart(2, "0")}: month is signed off`,
        );
      }
      return deps.repository.upsertByMonth(userId, input);
    },

    async signOff(userId, input) {
      const nowDate = getNow();
      if (!isWithinCloseWindow(input.year, input.monthNum, nowDate)) {
        throw new PekuloError(
          "MONTHLY_OUT_OF_WINDOW",
          `Sign-off rejected: outside close window for ${input.year}-${String(input.monthNum).padStart(2, "0")}`,
        );
      }
      const existing = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      if (existing && existing.signedOffAt !== null) {
        throw new PekuloError(
          "MONTHLY_SIGNED_OFF",
          `Month ${input.year}-${String(input.monthNum).padStart(2, "0")} already signed off`,
        );
      }
      // Atomic upsert + freeze. The repository's upsertByMonth preserves
      // signedOffAt on the update branch (no field in the update payload),
      // so we explicitly call setSignedOffAt right after to stamp the freeze
      // timestamp. Both calls fan-out within the same logical operation —
      // the race window is ≤ 1 ms in V1 (a) (single-writer per user); codify
      // a $transaction wrapper if shared accounts ship in V2+.
      await deps.repository.upsertByMonth(userId, {
        year: input.year,
        monthNum: input.monthNum,
        incomeEur: input.incomeEur,
        spendingEur: input.spendingEur,
        transfersEur: input.transfersEur,
        netChangeEur: input.netChangeEur,
      });
      return deps.repository.setSignedOffAt(userId, input.year, input.monthNum, nowDate);
    },

    async reopen(userId, input) {
      const existing = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      if (!existing) {
        throw new PekuloError(
          "MONTHLY_NOT_FOUND",
          `Cannot reopen ${input.year}-${String(input.monthNum).padStart(2, "0")}: no record`,
        );
      }
      // Idempotent: already-null is a no-op return rather than an error —
      // the UI only surfaces reopen on signed-off rows in Historique, so a
      // null-on-reopen call would mean a stale tab. Returning the existing
      // row prevents a confusing client-side failure mode; the registry-SSOT
      // invalidation refreshes the stale tab on the next paint.
      if (existing.signedOffAt === null) {
        return existing;
      }
      return deps.repository.setSignedOffAt(userId, input.year, input.monthNum, null);
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

// Dev-only clock seam. When `PEKULO_DEV_NOW_ISO` is set AND NODE_ENV is not
// production, the close-window check + the signedOffAt freeze stamp both
// derive their "now" from the ISO override. Lets a developer exercise the
// happy-path branches of sign-off / reopen flows without waiting for the
// real calendar window to open. Production path is unaffected. Codify a
// proper clock-injection seam (`signOff(userId, input, clock?)`) on the
// service interface in a follow-up if integration tests want deterministic
// CI runs.
function getNow(): Date {
  if (process.env.NODE_ENV !== "production") {
    const override = process.env.PEKULO_DEV_NOW_ISO;
    if (override) return new Date(override);
  }
  return new Date();
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
