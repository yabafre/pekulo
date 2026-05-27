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
  ValidatedCsvRow,
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
  transferPairId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UpdateOutcome = { outcome: "ok"; transaction: Transaction } | { outcome: "not-found" };

/**
 * Pre-resolved bulk insert row for Bridge / provider imports (story 5-6 T20).
 * The bank-aggregator service translates ProviderTransaction → this shape
 * after resolving providerAccountId → local accountId via accounts.service.
 */
export interface ProviderTransactionInsertRow {
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: number;
  type: "inflow" | "outflow";
  category: string;
  provider: string;
  providerTransactionId: string;
}

export interface TransactionsRepository {
  create(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  findByIdForUser(userId: string, id: string): Promise<Transaction | null>;
  update(userId: string, input: UpdateTransactionInput): Promise<UpdateOutcome>;
  delete(userId: string, input: DeleteTransactionInput): Promise<{ deleted: boolean }>;
  listByUser(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  bulkCreate(
    userId: string,
    rows: ValidatedCsvRow[],
  ): Promise<{ persisted: number; rows: Transaction[] }>;
  /**
   * Story 5-6 T20 — bulk insert from a provider (Bridge) with pre-resolved
   * accountIds. Wraps tx.transaction.create in a $transaction so prefixed-ids
   * fires per row + atomic batch.
   */
  bulkCreateFromProvider(
    userId: string,
    rows: ProviderTransactionInsertRow[],
  ): Promise<{ persisted: number; rows: Transaction[] }>;
  /**
   * Story 5-6 T20 — single round-trip dedup pre-flight. Returns the subset of
   * providerTxIds that already exist for this user+provider.
   */
  findExistingProviderTxIds(
    userId: string,
    provider: string,
    providerTxIds: string[],
  ): Promise<Set<string>>;
  findTransferPairCandidates(
    userId: string,
    candidate: {
      accountId: string;
      occurredOn: string;
      amount: number;
      type: "inflow" | "outflow";
    },
  ): Promise<Transaction[]>;
  pairAsTransfer(
    userId: string,
    candidateId: string,
    siblingId: string,
    pairId: string,
  ): Promise<{ paired: number }>;
  unpairAfterDelete(userId: string, pairId: string, idToExclude: string): Promise<void>;
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
    transferPairId: row.transferPairId,
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

    async bulkCreate(userId, rows) {
      // Story 5-2 T6 + 5-3 T5. Interactive `$transaction` + per-row
      // `tx.transaction.create` (NOT `createMany`) so the prefixed-ids
      // extension fires on every row (ADR-0012). All-or-nothing — Prisma
      // rolls back the batch if any row throws. 5-3 extension: capture
      // every inserted row so the service can categorise post-batch.
      const inserted: TransactionRow[] = [];
      await deps.client.$transaction(async (tx) => {
        for (const row of rows) {
          const created = (await tx.transaction.create({
            data: {
              userId,
              accountId: row.accountId,
              occurredOn: new Date(row.occurredOn),
              label: row.label,
              amount: row.amount,
              type: row.type,
              category: row.category,
              isImprevu: row.isImprevu,
              notes: row.notes,
            } as unknown as Parameters<typeof tx.transaction.create>[0]["data"],
          })) as TransactionRow;
          inserted.push(created);
        }
      });
      return { persisted: inserted.length, rows: inserted.map(toDto) };
    },

    async bulkCreateFromProvider(userId, rows) {
      // Story 5-6 T20 — same `$transaction` + per-row create pattern as
      // bulkCreate so the prefixed-ids extension fires (ADR-0012). The two
      // extra columns (provider, providerTransactionId) feed the partial
      // UNIQUE index `transactions_user_provider_txid_uq` (T3 migration).
      //
      // Chunked at 50 rows / transaction to stay under Prisma's default 5s
      // interactive-transaction timeout on the Supabase pooler (smoke-test
      // 2026-05-27 — fresh Bridge sync returned ~80 transactions and hit the
      // timeout). Each chunk wraps an interactive tx so prefixedIds fires;
      // chunk boundaries are safe because the dedup pre-flight ensures no
      // duplicate rows arrive here and the partial UNIQUE index protects
      // against retries.
      const CHUNK_SIZE = 50;
      const inserted: TransactionRow[] = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await deps.client.$transaction(
          async (tx) => {
            for (const row of chunk) {
              const created = (await tx.transaction.create({
                data: {
                  userId,
                  accountId: row.accountId,
                  occurredOn: row.occurredOn,
                  label: row.label,
                  amount: row.amount,
                  type: row.type,
                  category: row.category,
                  isImprevu: false,
                  notes: null,
                  transferPairId: null,
                  provider: row.provider,
                  providerTransactionId: row.providerTransactionId,
                } as unknown as Parameters<typeof tx.transaction.create>[0]["data"],
              })) as TransactionRow;
              inserted.push(created);
            }
          },
          { timeout: 30_000 },
        );
      }
      return { persisted: inserted.length, rows: inserted.map(toDto) };
    },

    async findExistingProviderTxIds(userId, provider, providerTxIds) {
      if (providerTxIds.length === 0) return new Set<string>();
      const where: Prisma.TransactionWhereInput = {
        userId,
        provider,
        providerTransactionId: { in: providerTxIds },
      };
      const rows = (await deps.client.transaction.findMany({
        where,
        select: { providerTransactionId: true },
      })) as Array<{ providerTransactionId: string | null }>;
      const existing = new Set<string>();
      for (const r of rows) {
        if (r.providerTransactionId) existing.add(r.providerTransactionId);
      }
      return existing;
    },

    async findTransferPairCandidates(userId, candidate) {
      // Pair eligibility query — opposite type, same date, same amount,
      // different account, category=autre, transferPairId=null, same user.
      // FIFO ordering by (createdAt asc, id asc) breaks ambiguity (AC-5)
      // so the service's derive always picks the oldest unpaired sibling.
      const wanted = candidate.type === "inflow" ? "outflow" : "inflow";
      const rows = (await deps.client.transaction.findMany({
        where: {
          userId,
          type: wanted,
          occurredOn: new Date(candidate.occurredOn),
          amount: candidate.amount,
          accountId: { not: candidate.accountId },
          category: "autre",
          transferPairId: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })) as TransactionRow[];
      return rows.map(toDto);
    },

    async pairAsTransfer(userId, candidateId, siblingId, pairId) {
      // 2-row updateMany — both ids in one query. Explicit userId scopes
      // the where so a tampered candidateId/siblingId cannot reach across
      // users (AC-7). Returns the affected count so the caller (service)
      // can detect concurrent-delete races (F6 — aped-review): if the
      // sibling vanished between findTransferPairCandidates and this call,
      // count === 1 and the caller raises TRANSACTION_PAIR_RACE.
      const { count } = await deps.client.transaction.updateMany({
        where: { userId, id: { in: [candidateId, siblingId] } },
        data: { category: "transfer", transferPairId: pairId, updatedAt: new Date() },
      });
      return { paired: count };
    },

    async unpairAfterDelete(userId, pairId, idToExclude) {
      // AC-11 — when a paired row is deleted, the sibling reverts to
      // category=autre, transferPairId=null. The `id != idToExclude`
      // filter restricts the update to the sibling alone (the candidate
      // is about to be deleted by the caller anyway).
      await deps.client.transaction.updateMany({
        where: { userId, transferPairId: pairId, id: { not: idToExclude } },
        data: { category: "autre", transferPairId: null, updatedAt: new Date() },
      });
    },
  };
}
