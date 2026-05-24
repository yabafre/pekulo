// apps/api/src/modules/transactions/transactions.repository.ts
// Prisma layer for the transactions domain (story 5-1).
//
// Discipline:
//   - Every query carries explicit where: { userId } (ADR-0013, defense in
//     depth). Single-row finds use where: { id, userId }; child finds use
//     where: { accountId, userId }. Lint rule pekulo/no-prisma-query-without-
//     user-id (story 0-12) gates this on every method below.
//   - The `as unknown as Parameters<typeof tx.transaction.create>[0]["data"]`
//     bridge on create is mandatory — the column has no @default so Prisma's
//     generated type demands `id`; the prefixed-ids extension injects it at
//     runtime (story 2-1 / 3-1 / 4-1 outcome).
//   - amount: Decimal coerced via decimalToNumber(value, fallback) — never
//     Number(decimal) (L24, lessons.md scope list explicitly names 5-1).
//   - Cursor pagination via base64url(`${occurredOnISO}|${id}`); last page
//     returns nextCursor: null (architecture L129 + NFR-16).

import type { Prisma } from "@generated/prisma/client";
import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { ExtendedPrismaClient } from "../../database";

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
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UpdateOutcome = { outcome: "ok"; transaction: Transaction } | { outcome: "not-found" };

export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
}

function toDto(row: TransactionRow): Transaction {
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
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function encodeCursor(occurredOnISO: string, id: string): string {
  return Buffer.from(`${occurredOnISO}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { occurredOn: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [occurredOn, id] = raw.split("|");
    if (!occurredOn || !id) return null;
    return { occurredOn, id };
  } catch {
    return null;
  }
}

export function createTransactionsRepository(deps: {
  client: ExtendedPrismaClient;
}): TransactionsRepository {
  return {
    async create(userId, input) {
      const row = (await deps.client.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          occurredOn: new Date(input.occurredOn),
          label: input.label,
          amount: input.amount,
          type: input.type,
          category: input.category,
          isImprevu: input.isImprevu,
          notes: input.notes,
        } as unknown as Parameters<typeof deps.client.transaction.create>[0]["data"],
      })) as TransactionRow;
      return toDto(row);
    },

    async findByIdForUser(userId, id) {
      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow | null;
      return row ? toDto(row) : null;
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      // Build the patch via the typed Prisma input shape — keeps the
      // generator's exhaustiveness check active so a renamed column shows
      // up at compile time. The create branch's `as unknown as …` bridge
      // is justified by ADR-0012 (prefixed-ids extension injects `id`
      // outside Prisma's generated types) ; update has no such bridge
      // requirement, so cast-free is the right shape here.
      const data: Prisma.TransactionUncheckedUpdateInput = { updatedAt: new Date() };
      if (patch.accountId !== undefined) data.accountId = patch.accountId;
      if (patch.occurredOn !== undefined) data.occurredOn = new Date(patch.occurredOn);
      if (patch.label !== undefined) data.label = patch.label;
      if (patch.amount !== undefined) data.amount = patch.amount;
      if (patch.type !== undefined) data.type = patch.type;
      if (patch.category !== undefined) data.category = patch.category;
      if (patch.isImprevu !== undefined) data.isImprevu = patch.isImprevu;
      if (patch.notes !== undefined) data.notes = patch.notes;

      const result = await deps.client.transaction.updateMany({
        where: { id, userId },
        data,
      });
      if (result.count === 0) return { outcome: "not-found" };

      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow;
      return { outcome: "ok", transaction: toDto(row) };
    },

    async delete(userId, input) {
      const result = await deps.client.transaction.deleteMany({
        where: { id: input.id, userId },
      });
      return { deleted: result.count > 0 };
    },

    async listByUser(userId, input) {
      const limit = input.limit ?? 50;
      // Cursor decode is fail-loud: a malformed/stale cursor surfaces as 400
      // so paginating clients can react. Falling back to "no cursor" served
      // page 1 silently and risked infinite loops.
      let decoded: { occurredOn: string; id: string } | null = null;
      if (input.cursor) {
        decoded = decodeCursor(input.cursor);
        if (!decoded) {
          throw new PekuloError("BAD_REQUEST", "invalid cursor");
        }
        if (Number.isNaN(new Date(decoded.occurredOn).getTime())) {
          throw new PekuloError("BAD_REQUEST", "invalid cursor");
        }
      }

      const where: Prisma.TransactionWhereInput = {
        userId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(decoded
          ? {
              OR: [
                { occurredOn: { lt: new Date(decoded.occurredOn) } },
                {
                  occurredOn: new Date(decoded.occurredOn),
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      };

      const rows = (await deps.client.transaction.findMany({
        where,
        orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
        take: limit + 1,
      })) as TransactionRow[];

      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map(toDto);
      const last = items.at(-1);
      const nextCursor = hasMore && last ? encodeCursor(last.occurredOn, last.id) : null;

      return { items, nextCursor };
    },
  };
}
