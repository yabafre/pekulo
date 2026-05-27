// apps/api/src/modules/monthly/monthly.repository.ts
// Prisma layer for the monthly aggregate (story 5-4).
//
// Discipline:
//   - Every query carries explicit `where: { userId }` (ADR-0013).
//   - `findByMonth` → findFirst, null on miss.
//   - `upsertByMonth` → Prisma upsert; the @@unique([userId, year, monthNum])
//     resolves create-or-update in one round-trip. `signedOffAt` is absent
//     from the update payload — Prisma preserves untouched columns.
//   - `listTransactionsForMonth` → findMany over a 1-month UTC window.
//   - Decimal → number via decimalToNumber (L24 — never Number(decimal)).
//   - id has no @default; the prefixed-ids extension injects `mr_<base62>`
//     on the `upsert.create` branch (ADR-0012).

import type { Prisma } from "@generated/prisma/client";
import type { MonthlyRecord, Transaction, UpsertMonthlyInput } from "@pekulo/validators";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { ExtendedPrismaClient } from "../../database";

type MonthlyRecordRow = {
  id: string;
  userId: string;
  year: number;
  monthNum: number;
  incomeEur: Prisma.Decimal;
  spendingEur: Prisma.Decimal;
  transfersEur: Prisma.Decimal;
  netChangeEur: Prisma.Decimal;
  signedOffAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type TransactionRow = {
  id: string;
  userId: string;
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: Prisma.Decimal;
  type: "inflow" | "outflow";
  category: string;
  isImprevu: boolean;
  notes: string | null;
  transferPairId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export interface MonthlyRepository {
  findByMonth(userId: string, year: number, monthNum: number): Promise<MonthlyRecord | null>;
  /** Single-round-trip upsert. `opts.signedOffAt` is folded into BOTH the
   *  create and update payloads when provided — that makes service.signOff
   *  atomic by construction (no inter-call race against a concurrent reopen
   *  or override). Omitting the opt preserves the existing column value
   *  (Prisma omits unset fields on update). */
  upsertByMonth(
    userId: string,
    input: UpsertMonthlyInput,
    opts?: { signedOffAt?: Date },
  ): Promise<MonthlyRecord>;
  listTransactionsForMonth(userId: string, year: number, monthNum: number): Promise<Transaction[]>;
  /** All persisted MonthlyRecord rows for the user in the [from, to] window
   *  (inclusive on both ends, year/monthNum compound). */
  listPersistedInWindow(
    userId: string,
    fromYear: number,
    fromMonthNum: number,
  ): Promise<MonthlyRecord[]>;
  /** All transactions for the user with occurredOn ≥ first day of from-month. */
  listTransactionsSince(
    userId: string,
    fromYear: number,
    fromMonthNum: number,
  ): Promise<Transaction[]>;
  /** Stamp signedOffAt on an existing row (the upsert is the caller's job).
   *  Throws Prisma P2025 → caller maps to MONTHLY_NOT_FOUND. */
  setSignedOffAt(
    userId: string,
    year: number,
    monthNum: number,
    value: Date | null,
  ): Promise<MonthlyRecord>;
}

function toMonthlyDto(row: MonthlyRecordRow): MonthlyRecord {
  return {
    id: row.id,
    year: row.year,
    monthNum: row.monthNum,
    incomeEur: decimalToNumber(row.incomeEur, 0),
    spendingEur: decimalToNumber(row.spendingEur, 0),
    transfersEur: decimalToNumber(row.transfersEur, 0),
    netChangeEur: decimalToNumber(row.netChangeEur, 0),
    signedOffAt: row.signedOffAt ? row.signedOffAt.toISOString() : null,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function toTransactionDto(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    label: row.label,
    amount: decimalToNumber(row.amount, 0),
    type: row.type,
    category: row.category as Transaction["category"],
    isImprevu: row.isImprevu,
    notes: row.notes,
    transferPairId: row.transferPairId,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function firstDayOfMonthUTC(year: number, monthNum: number): Date {
  return new Date(Date.UTC(year, monthNum - 1, 1));
}

function firstDayOfNextMonthUTC(year: number, monthNum: number): Date {
  if (monthNum === 12) return new Date(Date.UTC(year + 1, 0, 1));
  return new Date(Date.UTC(year, monthNum, 1));
}

export function createMonthlyRepository(deps: { client: ExtendedPrismaClient }): MonthlyRepository {
  return {
    async findByMonth(userId, year, monthNum) {
      const row = (await deps.client.monthlyRecord.findFirst({
        where: { userId, year, monthNum },
      })) as MonthlyRecordRow | null;
      return row ? toMonthlyDto(row) : null;
    },

    async upsertByMonth(userId, input, opts) {
      const freezeField = opts?.signedOffAt !== undefined ? { signedOffAt: opts.signedOffAt } : {};
      const row = (await deps.client.monthlyRecord.upsert({
        where: {
          // Compound unique key resolves the create/update branch in one
          // round-trip; the top-level `userId` is redundant for the lookup
          // but satisfies the pekulo/no-prisma-query-without-user-id lint
          // rule (ADR-0013) which can't see through the compound key.
          userId,
          userId_year_monthNum: {
            userId,
            year: input.year,
            monthNum: input.monthNum,
          },
        },
        create: {
          userId,
          year: input.year,
          monthNum: input.monthNum,
          incomeEur: input.incomeEur,
          spendingEur: input.spendingEur,
          transfersEur: input.transfersEur,
          netChangeEur: input.netChangeEur,
          ...freezeField,
        } as unknown as Parameters<typeof deps.client.monthlyRecord.upsert>[0]["create"],
        update: {
          incomeEur: input.incomeEur,
          spendingEur: input.spendingEur,
          transfersEur: input.transfersEur,
          netChangeEur: input.netChangeEur,
          updatedAt: new Date(),
          ...freezeField,
        },
      })) as MonthlyRecordRow;
      return toMonthlyDto(row);
    },

    async listTransactionsForMonth(userId, year, monthNum) {
      const rows = (await deps.client.transaction.findMany({
        where: {
          userId,
          occurredOn: {
            gte: firstDayOfMonthUTC(year, monthNum),
            lt: firstDayOfNextMonthUTC(year, monthNum),
          },
        },
        orderBy: [{ occurredOn: "asc" }, { id: "asc" }],
      })) as TransactionRow[];
      return rows.map(toTransactionDto);
    },

    async listPersistedInWindow(userId, fromYear, fromMonthNum) {
      // Review F7: tighten the SQL filter via compound OR so the query hits
      // the @@unique([userId, year, monthNum]) index without an in-memory
      // post-filter. The previous `year: { gte: fromYear }` over-fetched
      // (Jan..fromMonth of fromYear) which is negligible at V1 scale but
      // grows linearly with user history.
      const rows = (await deps.client.monthlyRecord.findMany({
        where: {
          userId,
          OR: [{ year: { gt: fromYear } }, { year: fromYear, monthNum: { gte: fromMonthNum } }],
        },
        orderBy: [{ year: "desc" }, { monthNum: "desc" }],
      })) as MonthlyRecordRow[];
      return rows.map(toMonthlyDto);
    },

    async listTransactionsSince(userId, fromYear, fromMonthNum) {
      const rows = (await deps.client.transaction.findMany({
        where: {
          userId,
          occurredOn: { gte: firstDayOfMonthUTC(fromYear, fromMonthNum) },
        },
        orderBy: [{ occurredOn: "asc" }, { id: "asc" }],
      })) as TransactionRow[];
      return rows.map(toTransactionDto);
    },

    async setSignedOffAt(userId, year, monthNum, value) {
      const row = (await deps.client.monthlyRecord.update({
        where: {
          // Compound unique key — same shape as upsertByMonth (ADR-0013
          // defense-in-depth + lint-rule satisfaction). P2025 surfaces here
          // when the row doesn't exist; the caller (service) translates
          // to PekuloError("MONTHLY_NOT_FOUND", …).
          userId,
          userId_year_monthNum: { userId, year, monthNum },
        },
        data: { signedOffAt: value, updatedAt: new Date() },
      })) as MonthlyRecordRow;
      return toMonthlyDto(row);
    },
  };
}
