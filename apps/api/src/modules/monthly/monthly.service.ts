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

/** Date clock seam — distinct from `MonthlyServiceClock` which carries
 *  a year/monthNum pair for listMonthly's window walk. signOff needs a
 *  full Date for the inclusive ms-precision close-window check (review
 *  F3 — restored after the PEKULO_DEV_NOW_ISO revert so integration
 *  tests pin "now" deterministically instead of bailing wall-clock). */
export interface MonthlyServiceDateClock {
  now: Date;
}

export interface MonthlyService {
  getMonthly(userId: string, input: GetMonthlyInput): Promise<GetMonthlyOutput>;
  upsertMonthly(userId: string, input: UpsertMonthlyInput): Promise<MonthlyRecord>;
  /** Atomic upsert + freeze (single Prisma round-trip per review F1).
   *  Throws MONTHLY_SIGNED_OFF (409) if the row is already signed (checked
   *  first per review F5); throws MONTHLY_OUT_OF_WINDOW (409) if `clock.now`
   *  (or `new Date()` when omitted) falls outside [(last_day - 4) UTC,
   *  (last_day + 5) UTC]. */
  signOff(
    userId: string,
    input: SignOffMonthlyInput,
    clock?: MonthlyServiceDateClock,
  ): Promise<MonthlyRecord>;
  /** Clears signedOffAt. Throws MONTHLY_NOT_FOUND (404) if no row exists. */
  reopen(userId: string, input: ReopenMonthlyInput): Promise<MonthlyRecord>;
  /** Optional clock seam — defaults to `new Date()` UTC. Test path pins it. */
  listMonthly(
    userId: string,
    input: ListMonthlyInput,
    clock?: MonthlyServiceClock,
  ): Promise<ListMonthlyOutput>;
}

export function createMonthlyService(deps: {
  repository: MonthlyRepository;
  /** Optional factory-level clock — used by integration tests to pin "now"
   *  for the whole HTTP boot so wall-clock-dependent scenarios don't bail
   *  silently (review F3). Production omits this and falls back to
   *  `new Date()`. The per-call `clock?` on signOff/listMonthly still wins
   *  over this dep when both are provided. */
  clock?: () => Date;
}): MonthlyService {
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

    async signOff(userId, input, clock) {
      // Review F5: check already-signed BEFORE close-window. A user
      // re-clicking sign-off on an already-frozen month should see the
      // more actionable "already signed" error rather than the temporal
      // "out of window" — both surface as 409 but the message differs.
      const existing = await deps.repository.findByMonth(userId, input.year, input.monthNum);
      if (existing && existing.signedOffAt !== null) {
        throw new PekuloError(
          "MONTHLY_SIGNED_OFF",
          `Month ${input.year}-${String(input.monthNum).padStart(2, "0")} already signed off`,
        );
      }
      // Review F3: clock seam restored — per-call clock wins over factory
      // dep wins over wall clock. Integration tests pin "now" to a
      // deterministic mid-window value so they don't silently no-op outside
      // the wall-clock window.
      const nowDate = clock?.now ?? deps.clock?.() ?? new Date();
      if (!isWithinCloseWindow(input.year, input.monthNum, nowDate)) {
        throw new PekuloError(
          "MONTHLY_OUT_OF_WINDOW",
          `Sign-off rejected: outside close window for ${input.year}-${String(input.monthNum).padStart(2, "0")}`,
        );
      }
      // Review F1: atomic upsert+freeze in ONE Prisma call. The previous
      // sequential pair (upsertByMonth then setSignedOffAt) had a race
      // window of the full second round-trip during which a failed
      // setSignedOffAt left a row with the user's overrides but
      // signedOffAt: null — invisible per the AC-4 discriminator.
      return deps.repository.upsertByMonth(
        userId,
        {
          year: input.year,
          monthNum: input.monthNum,
          incomeEur: input.incomeEur,
          spendingEur: input.spendingEur,
          transfersEur: input.transfersEur,
          netChangeEur: input.netChangeEur,
        },
        { signedOffAt: nowDate },
      );
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
      // Review F4: catch P2025 (row vanished between findByMonth and
      // setSignedOffAt — e.g. concurrent delete) and re-throw as the
      // typed MONTHLY_NOT_FOUND the repository docstring promises.
      try {
        return await deps.repository.setSignedOffAt(userId, input.year, input.monthNum, null);
      } catch (err) {
        if ((err as { code?: string } | null)?.code === "P2025") {
          throw new PekuloError(
            "MONTHLY_NOT_FOUND",
            `Cannot reopen ${input.year}-${String(input.monthNum).padStart(2, "0")}: row vanished`,
          );
        }
        throw err;
      }
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
