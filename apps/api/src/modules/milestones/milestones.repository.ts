// Prisma layer for the milestones module. Seven responsibilities:
//   - add(userId, input): insert one row (id auto-injected by prefixedIds extension).
//   - addEnforcingCap(userId, input, cap): atomic count+insert wrapped in
//     $transaction — the service-side cap check is NOT race-safe on its own
//     (TOCTOU between count and add). Returns `{ capExceeded: true }` instead
//     of inserting when count >= cap. Mirrors compass.repository's $transaction
//     pattern (audit + upsert).
//   - update(userId, id, input): patch row, scoped by userId AND id.
//   - delete(userId, id): delete row, scoped by userId AND id.
//   - listByUser(userId): read rows ordered by [targetYear asc, position asc, createdAt asc].
//   - findByIdForUser(userId, id): single-row probe for update/delete preconditions.
//   - countByUser(userId): for read-only callers (e.g. dashboard cards).
//   - hasAny(userId): for the MilestonePresenceProbe (FR-8).
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). Single-row finds use `where: { id, userId }`. The lint rule
// pekulo/no-prisma-query-without-user-id (story 0-12) gates this on every
// method below — its `prismaIdentifier` accepts `["prisma","tx"]` so the
// $transaction callback's `tx` is also covered.

import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import type { Milestone } from "@pekulo/types";
import type { AddMilestoneInput, UpdateMilestoneInput } from "@pekulo/validators";

export interface MilestoneRepository {
  add(userId: string, input: AddMilestoneInput): Promise<Milestone>;
  addEnforcingCap(
    userId: string,
    input: AddMilestoneInput,
    cap: number,
  ): Promise<Milestone | { capExceeded: true }>;
  update(
    userId: string,
    id: string,
    input: Omit<UpdateMilestoneInput, "id">,
  ): Promise<Milestone | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listByUser(userId: string): Promise<Milestone[]>;
  findByIdForUser(userId: string, id: string): Promise<Milestone | null>;
  countByUser(userId: string): Promise<number>;
  hasAny(userId: string): Promise<boolean>;
}

type MilestoneRow = {
  id: string;
  userId: string;
  targetCapital: unknown;
  targetYear: number;
  label: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

function rowToMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    userId: row.userId,
    targetCapital: decimalToNumber(row.targetCapital, 0),
    targetYear: row.targetYear,
    label: row.label,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createMilestoneRepository(deps: {
  client: ExtendedPrismaClient;
}): MilestoneRepository {
  return {
    async add(userId, input) {
      // position written explicitly (default 0) so the data shape stays
      // type-checkable end-to-end. The `as unknown as ...` cast is narrowed
      // to bridge the prefixedIds extension's runtime id injection (the
      // generated type still requires `id`); same pattern as compass.upsert.
      const created = await deps.client.milestone.create({
        data: {
          userId,
          targetCapital: input.targetCapital,
          targetYear: input.targetYear,
          label: input.label ?? null,
          position: 0,
        } as unknown as Parameters<typeof deps.client.milestone.create>[0]["data"],
      });
      return rowToMilestone(created as unknown as MilestoneRow);
    },

    async addEnforcingCap(userId, input, cap) {
      // Atomic cap enforcement: count + create within a single $transaction
      // so two concurrent adds at count = cap-1 cannot both insert past the
      // limit. Returns a `{ capExceeded: true }` sentinel so the service can
      // raise the typed MilestoneError without leaking transaction concerns.
      return deps.client.$transaction(async (tx) => {
        const count = await tx.milestone.count({ where: { userId } });
        if (count >= cap) return { capExceeded: true } as const;
        const created = await tx.milestone.create({
          data: {
            userId,
            targetCapital: input.targetCapital,
            targetYear: input.targetYear,
            label: input.label ?? null,
            position: 0,
          } as unknown as Parameters<typeof tx.milestone.create>[0]["data"],
        });
        return rowToMilestone(created as unknown as MilestoneRow);
      });
    },

    async update(userId, id, input) {
      // updateMany scoped by { id, userId } so a cross-user attempt yields
      // count=0 (defense in depth on top of RLS). Returning null lets the
      // service raise MILESTONE_NOT_FOUND uniformly.
      const result = await deps.client.milestone.updateMany({
        where: { id, userId },
        data: {
          ...(input.targetCapital !== undefined ? { targetCapital: input.targetCapital } : {}),
          ...(input.targetYear !== undefined ? { targetYear: input.targetYear } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return null;
      const row = await deps.client.milestone.findFirst({ where: { id, userId } });
      return row ? rowToMilestone(row as unknown as MilestoneRow) : null;
    },

    async delete(userId, id) {
      const result = await deps.client.milestone.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async listByUser(userId) {
      const rows = await deps.client.milestone.findMany({
        where: { userId },
        orderBy: [{ targetYear: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      });
      return rows.map((r) => rowToMilestone(r as unknown as MilestoneRow));
    },

    async findByIdForUser(userId, id) {
      const row = await deps.client.milestone.findFirst({ where: { id, userId } });
      return row ? rowToMilestone(row as unknown as MilestoneRow) : null;
    },

    async countByUser(userId) {
      return deps.client.milestone.count({ where: { userId } });
    },

    async hasAny(userId) {
      const found = await deps.client.milestone.findFirst({
        where: { userId },
        select: { id: true },
      });
      return found !== null;
    },
  };
}
