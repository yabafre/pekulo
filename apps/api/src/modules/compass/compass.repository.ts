// Prisma layer for the compass module. Three responsibilities:
//   - findCompass(userId): read objectif + horizonYears from `hypotheses`
//   - upsertCompassWithHistory(userId, input): atomic write (Hypothesis upsert
//     + CompassHistory insert) within prisma.$transaction (FR-2 audit trail)
//   - listHistory(userId, opts): read history rows ordered by valuedOn desc
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). The lint rule pekulo/no-prisma-query-without-user-id (story 0-12)
// enforces this on every method below — its `prismaIdentifier` accepts
// `["prisma","tx"]` so the $transaction callback's `tx` is also covered.

import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { Compass } from "@pekulo/validators";
import type { CompassHistoryEntry } from "./compass.types";

export interface CompassRepository {
  findCompass(userId: string): Promise<Compass | null>;
  upsertCompassWithHistory(
    userId: string,
    input: { objectif: number; horizonYears: number },
  ): Promise<Compass>;
  listHistory(userId: string, opts?: { limit?: number }): Promise<CompassHistoryEntry[]>;
}

type HypothesisRow = {
  objectif: unknown;
  horizonYears: unknown;
};

type CompassHistoryRow = {
  id: string;
  userId: string;
  objectif: unknown;
  horizonYears: unknown;
  valuedOn: Date;
  createdAt: Date;
};

function rowToCompass(row: HypothesisRow): Compass {
  return {
    objectif: decimalToNumber(row.objectif, 0),
    horizonYears: decimalToNumber(row.horizonYears, 0),
  };
}

function rowToHistoryEntry(row: CompassHistoryRow): CompassHistoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    objectif: decimalToNumber(row.objectif, 0),
    horizonYears: decimalToNumber(row.horizonYears, 0),
    valuedOn: row.valuedOn,
    createdAt: row.createdAt,
  };
}

export function createCompassRepository(deps: { client: ExtendedPrismaClient }): CompassRepository {
  return {
    async findCompass(userId) {
      const row = await deps.client.hypothesis.findUnique({
        where: { userId },
        select: { objectif: true, horizonYears: true },
      });
      if (!row) return null;
      return rowToCompass(row as unknown as HypothesisRow);
    },

    async upsertCompassWithHistory(userId, input) {
      const result = await deps.client.$transaction(async (tx) => {
        // The prefixedIds Prisma extension injects `id` for create branches
        // when `data.id` is undefined (ADR-0012). The `unknown` cast keeps
        // domain code free of `Prisma.*UncheckedCreateInput` plumbing — same
        // pattern as hypothesis.service.ts:160.
        const upserted = await tx.hypothesis.upsert({
          where: { userId },
          update: {
            objectif: input.objectif,
            horizonYears: input.horizonYears,
            updatedAt: new Date(),
          },
          create: {
            userId,
            objectif: input.objectif,
            horizonYears: input.horizonYears,
          } as unknown as Parameters<typeof tx.hypothesis.upsert>[0]["create"],
          select: { objectif: true, horizonYears: true },
        });

        await tx.compassHistory.create({
          data: {
            userId,
            objectif: input.objectif,
            horizonYears: input.horizonYears,
            valuedOn: new Date(),
          } as unknown as Parameters<typeof tx.compassHistory.create>[0]["data"],
        });

        return upserted;
      });

      return rowToCompass(result as unknown as HypothesisRow);
    },

    async listHistory(userId, opts) {
      const rows = await deps.client.compassHistory.findMany({
        where: { userId },
        orderBy: { valuedOn: "desc" },
        take: opts?.limit ?? 50,
      });
      return rows.map((r) => rowToHistoryEntry(r as unknown as CompassHistoryRow));
    },
  };
}
