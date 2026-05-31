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
  suggestedCategory: string | null;
  suggestedConfidence: number | null;
  suggestedRoute: string | null;
  suggestedAt: Date | null;
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
   * accountIds. Per-row inserts so a single P2002 unique-violation (concurrent
   * webhook race) skips the colliding row instead of rolling the chunk back.
   * `raceSkipped` is the count of rows dropped because the partial UNIQUE
   * index already had a winner — the caller sums it into the dedup tally.
   */
  bulkCreateFromProvider(
    userId: string,
    rows: ProviderTransactionInsertRow[],
  ): Promise<{ persisted: number; raceSkipped: number; rows: Transaction[] }>;
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
  /**
   * Story 6-2 (FR-32) — persist the pending LLM suggestion. The ONLY writer of
   * the suggested_* columns. `category` is left untouched (stays 'autre' until
   * the user confirms in 6-4). The `category: "autre"` guard in the where makes
   * a late suggestion idempotent against a category the user set meanwhile.
   * Returns `{ saved }` — false when the row was deleted or already recategorised.
   */
  saveSuggestion(
    userId: string,
    txId: string,
    suggestion: { category: string; confidence: number; route: string },
  ): Promise<{ saved: boolean }>;
  /**
   * Story 6-4 (FR-33) — set the FINAL category and clear all four suggested_*
   * columns in one statement, scoped where { id, userId }. The inverse of
   * saveSuggestion. Returns UpdateOutcome ("not-found" when the row is gone /
   * not the caller's).
   */
  confirmCategorisation(userId: string, id: string, finalCategory: string): Promise<UpdateOutcome>;
  /**
   * Story 6-4 — the pending-suggestion list: rows still 'autre' that carry a
   * suggestion. Backed by transactions_user_suggestion_idx (userId,
   * suggestedCategory). Newest suggestion first.
   */
  listPendingByUser(userId: string): Promise<Transaction[]>;
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
    suggestedCategory: (row.suggestedCategory as Transaction["suggestedCategory"]) ?? null,
    suggestedConfidence: row.suggestedConfidence ?? null,
    suggestedRoute: row.suggestedRoute ?? null,
    suggestedAt: row.suggestedAt ? row.suggestedAt.toISOString() : null,
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
      // timeout).
      //
      // Race tolerance (post-review aped-review): the dedup pre-flight in
      // transactions.service.importFromProvider is non-atomic with the insert.
      // Concurrent webhook handlers can both see 0 existing IDs and both call
      // here — the second batch hits P2002 on the partial UNIQUE index. We
      // catch P2002 per-row and skip the colliding row instead of failing the
      // whole batch — the partial UNIQUE index IS the source of truth for
      // dedup ; the pre-flight is just a perf optimization.
      const CHUNK_SIZE = 50;
      const inserted: TransactionRow[] = [];
      let raceSkipped = 0;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        // Each row gets its own short transaction so P2002 on a single row
        // does not roll back successful peers in the same chunk. We trade the
        // chunk-level atomicity for the race-safety property: the partial
        // UNIQUE index makes per-row writes idempotent, so partial-batch
        // rollback would only erase work other concurrent writers can re-do.
        for (const row of chunk) {
          try {
            const created = (await deps.client.transaction.create({
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
              } as unknown as Parameters<typeof deps.client.transaction.create>[0]["data"],
            })) as TransactionRow;
            inserted.push(created);
          } catch (err) {
            // Duck-typed P2002 (mirrors realestate.repository.ts:202) — avoids
            // pulling Prisma as a runtime value import and stays compatible
            // with the fake-realestate test double that emits `{ code: "P2002" }`.
            if (
              err !== null &&
              typeof err === "object" &&
              "code" in err &&
              (err as { code?: string }).code === "P2002"
            ) {
              raceSkipped++;
              continue;
            }
            throw err;
          }
        }
      }
      return { persisted: inserted.length, raceSkipped, rows: inserted.map(toDto) };
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

    async saveSuggestion(userId, txId, suggestion) {
      const { count } = await deps.client.transaction.updateMany({
        where: { id: txId, userId, category: "autre" },
        data: {
          suggestedCategory: suggestion.category,
          suggestedConfidence: suggestion.confidence,
          suggestedRoute: suggestion.route,
          suggestedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { saved: count > 0 };
    },

    async confirmCategorisation(userId, id, finalCategory) {
      const result = await deps.client.transaction.updateMany({
        where: { id, userId },
        data: {
          category: finalCategory,
          suggestedCategory: null,
          suggestedConfidence: null,
          suggestedRoute: null,
          suggestedAt: null,
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return { outcome: "not-found" };
      const row = (await deps.client.transaction.findFirst({
        where: { id, userId },
      })) as TransactionRow;
      return { outcome: "ok", transaction: toDto(row) };
    },

    async listPendingByUser(userId) {
      const rows = (await deps.client.transaction.findMany({
        where: { userId, category: "autre", suggestedCategory: { not: null } },
        orderBy: [{ suggestedAt: "desc" }, { id: "desc" }],
      })) as TransactionRow[];
      return rows.map(toDto);
    },
  };
}
