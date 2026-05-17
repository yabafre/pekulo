// Prisma layer for the holdings module. Eight responsibilities:
//   - create(userId, input): insert one row (id auto-injected by prefixedIds
//     extension post-migration; UUID column was flipped to TEXT in story 3-1 T1).
//   - findByIdForUser(userId, id): single-row probe scoped by { id, userId }.
//   - listByUser(userId, { includeClosed }): rows ordered by createdAt asc;
//     filters out closedAt-non-null when includeClosed: false.
//   - close(userId, id): updateMany scoped by { id, userId, closedAt: null }
//     → 'closed' on count > 0, 'already-closed' on count = 0 if the row
//     exists, 'not-found' on cross-user / unknown id.
//   - recordLot(userId, input): insert a lot row (id auto-injected by extension).
//   - findLotsByHoldingForUser(userId, holdingId): lots scoped by both userId
//     AND holdingId (defense in depth).
//   - findAccountForUser(userId, accountId): cross-aggregate probe for create
//     to confirm account ownership.
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). Single-row finds use `where: { id, userId }`. The lint rule
// pekulo/no-prisma-query-without-user-id (story 0-12) gates this on every
// method below.
//
// L24 (2026-05-04, story 3-1 explicit) — six Decimal columns:
//   - Holding.quantity, Holding.avgCost, Holding.lastPrice
//   - HoldingLot.quantity, HoldingLot.priceUnit, HoldingLot.fees
// Coerce via decimalToNumber() at the row → DTO boundary. Inlining
// `Number(decimal)` OR re-extracting the helper = review fail.

import type { CreateHoldingInput, Holding, HoldingLot, RecordLotInput } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { ExtendedPrismaClient } from "../../database";

export type CloseHoldingOutcome =
  | { outcome: "closed"; closedAt: Date }
  | { outcome: "already-closed" }
  | { outcome: "not-found" };

export type RecordLotOutcome =
  | { outcome: "ok"; lot: HoldingLot }
  | { outcome: "not-found" }
  | { outcome: "closed" };

export interface HoldingRepository {
  create(userId: string, input: CreateHoldingInput): Promise<Holding>;
  findByIdForUser(userId: string, id: string): Promise<Holding | null>;
  listByUser(userId: string, opts: { includeClosed: boolean }): Promise<Holding[]>;
  close(userId: string, id: string): Promise<CloseHoldingOutcome>;
  recordLot(userId: string, input: RecordLotInput): Promise<RecordLotOutcome>;
  findLotsByHoldingForUser(userId: string, holdingId: string): Promise<HoldingLot[]>;
  findAccountForUser(userId: string, accountId: string): Promise<{ id: string } | null>;
}

type HoldingRow = {
  id: string;
  userId: string;
  accountId: string;
  kind: Holding["kind"];
  ticker: string | null;
  isin: string | null;
  label: string;
  currency: string;
  quantity: unknown;
  avgCost: unknown;
  lastPrice: unknown;
  lastPriceAt: Date | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  closedAt: Date | null;
};

type LotRow = {
  id: string;
  userId: string;
  holdingId: string;
  type: HoldingLot["type"];
  occurredOn: Date;
  quantity: unknown;
  priceUnit: unknown;
  fees: unknown;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function rowToHolding(row: HoldingRow): Holding {
  if (!row.createdAt || !row.updatedAt) {
    throw new PekuloError("INTERNAL", "holding row missing timestamp");
  }
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    kind: row.kind,
    ticker: row.ticker,
    isin: row.isin,
    label: row.label,
    currency: row.currency as Holding["currency"],
    quantity: decimalToNumber(row.quantity, 0),
    avgCost: decimalToNumber(row.avgCost, 0),
    lastPrice: decimalToNumber(row.lastPrice, 0),
    lastPriceAt: row.lastPriceAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}

function rowToLot(row: LotRow): HoldingLot {
  if (!row.createdAt || !row.updatedAt) {
    throw new PekuloError("INTERNAL", "holding_lot row missing timestamp");
  }
  return {
    id: row.id,
    userId: row.userId,
    holdingId: row.holdingId,
    type: row.type,
    occurredOn: row.occurredOn,
    quantity: decimalToNumber(row.quantity, 0),
    priceUnit: decimalToNumber(row.priceUnit, 0),
    fees: decimalToNumber(row.fees, 0),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createHoldingsRepository(deps: {
  client: ExtendedPrismaClient;
}): HoldingRepository {
  return {
    async create(userId, input) {
      // Bridge — the prefixedIds extension injects the id at runtime; the
      // generated type still demands it because holdings.id has no @default
      // (post-migration the gen_random_uuid() default was dropped).
      const created = await deps.client.holding.create({
        data: {
          userId,
          accountId: input.accountId,
          kind: input.kind,
          ticker: input.ticker ?? null,
          isin: input.isin ?? null,
          label: input.label,
          currency: input.currency,
          quantity: input.quantity,
          avgCost: input.avgCost,
          notes: input.notes ?? null,
        } as unknown as Parameters<typeof deps.client.holding.create>[0]["data"],
      });
      return rowToHolding(created as unknown as HoldingRow);
    },

    async findByIdForUser(userId, id) {
      const row = await deps.client.holding.findFirst({ where: { id, userId } });
      return row ? rowToHolding(row as unknown as HoldingRow) : null;
    },

    async listByUser(userId, opts) {
      const rows = await deps.client.holding.findMany({
        where: opts.includeClosed ? { userId } : { userId, closedAt: null },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => rowToHolding(r as unknown as HoldingRow));
    },

    async close(userId, id) {
      const closedAt = new Date();
      const result = await deps.client.holding.updateMany({
        where: { id, userId, closedAt: null },
        data: { closedAt, updatedAt: closedAt },
      });
      if (result.count > 0) {
        return { outcome: "closed", closedAt } as const;
      }
      const existing = await deps.client.holding.findFirst({
        where: { id, userId },
        select: { id: true, closedAt: true },
      });
      if (!existing) return { outcome: "not-found" } as const;
      return { outcome: "already-closed" } as const;
    },

    async recordLot(userId, input) {
      // Probe + insert inside a single transaction so a concurrent close() can't
      // land a lot on a holding that was active at probe time but closed before insert.
      return deps.client.$transaction(async (tx) => {
        const parent = await tx.holding.findFirst({
          where: { id: input.holdingId, userId },
          select: { id: true, closedAt: true },
        });
        if (!parent) return { outcome: "not-found" } as const;
        if (parent.closedAt !== null) return { outcome: "closed" } as const;
        const created = await tx.holdingLot.create({
          data: {
            userId,
            holdingId: input.holdingId,
            type: input.type,
            occurredOn: input.occurredOn,
            quantity: input.quantity,
            priceUnit: input.priceUnit,
            fees: input.fees ?? 0,
            notes: input.notes ?? null,
          } as unknown as Parameters<typeof tx.holdingLot.create>[0]["data"],
        });
        return { outcome: "ok", lot: rowToLot(created as unknown as LotRow) } as const;
      });
    },

    async findLotsByHoldingForUser(userId, holdingId) {
      const rows = await deps.client.holdingLot.findMany({
        where: { holdingId, userId },
        orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      });
      return rows.map((r) => rowToLot(r as unknown as LotRow));
    },

    async findAccountForUser(userId, accountId) {
      // Cross-aggregate probe — confirms the target account belongs to the
      // same user before allowing a `holding.create`. RLS would block
      // anyway, but the explicit guard yields a clearer error path AND
      // satisfies lint rule 0-12 on the cross-aggregate touch.
      return deps.client.account.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });
    },
  };
}
