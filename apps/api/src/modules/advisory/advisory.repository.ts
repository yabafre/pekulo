// Prisma layer for the advisory access allowlist (story 12-1, ADR-0016 §4).
//   - getAccessStatus(userId) → "active" | "banned" | null (the gate's read)
//   - getEntry(userId)        → row shaped for the wire, dates as ISO strings
//   - list()                  → owner-only, cross-user by design
//   - grant(userId, by)       → upsert active, clears banned_at
//   - ban(userId)             → upsert banned, stamps banned_at
// Every user-scoped query carries an explicit where: { userId } (ADR-0013,
// defence in depth). list() is the one cross-user read in this module and
// carries the documented lint exception.
import type { ExtendedPrismaClient } from "../../database";
import type { AdvisoryAccessEntry, AdvisoryAccessStatus } from "@pekulo/validators";

export interface AdvisoryAccessRepository {
  getAccessStatus(userId: string): Promise<AdvisoryAccessStatus | null>;
  getEntry(userId: string): Promise<AdvisoryAccessEntry | null>;
  list(): Promise<AdvisoryAccessEntry[]>;
  grant(userId: string, grantedBy: string): Promise<AdvisoryAccessEntry>;
  ban(userId: string): Promise<AdvisoryAccessEntry>;
}

interface EntryRow {
  userId: string;
  status: AdvisoryAccessStatus;
  grantedBy: string | null;
  grantedAt: Date | null;
  bannedAt: Date | null;
  updatedAt: Date;
}

const ENTRY_SELECT = {
  userId: true,
  status: true,
  grantedBy: true,
  grantedAt: true,
  bannedAt: true,
  updatedAt: true,
} as const;

function rowToEntry(row: EntryRow): AdvisoryAccessEntry {
  return {
    userId: row.userId,
    status: row.status,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt ? row.grantedAt.toISOString() : null,
    bannedAt: row.bannedAt ? row.bannedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createAdvisoryRepository(deps: {
  client: ExtendedPrismaClient;
}): AdvisoryAccessRepository {
  return {
    async getAccessStatus(userId) {
      const row = await deps.client.advisoryAccess.findUnique({
        where: { userId },
        select: { status: true },
      });
      return row ? (row.status as AdvisoryAccessStatus) : null;
    },

    async getEntry(userId) {
      const row = await deps.client.advisoryAccess.findUnique({
        where: { userId },
        select: ENTRY_SELECT,
      });
      return row ? rowToEntry(row) : null;
    },

    async list() {
      // Owner-only, cross-user by design: the allowlist IS the whole table.
      // The service asserts owner membership before calling this method.
      // oxlint-disable-next-line pekulo/no-prisma-query-without-user-id -- owner-only allowlist listing
      const rows = await deps.client.advisoryAccess.findMany({
        orderBy: { updatedAt: "desc" },
        select: ENTRY_SELECT,
      });
      return rows.map(rowToEntry);
    },

    async grant(userId, grantedBy) {
      const now = new Date();
      const row = await deps.client.advisoryAccess.upsert({
        where: { userId },
        update: {
          status: "active",
          grantedBy,
          grantedAt: now,
          bannedAt: null,
        },
        create: {
          userId,
          status: "active",
          grantedBy,
          grantedAt: now,
        },
        select: ENTRY_SELECT,
      });
      return rowToEntry(row);
    },

    async ban(userId) {
      const now = new Date();
      const row = await deps.client.advisoryAccess.upsert({
        where: { userId },
        update: {
          status: "banned",
          bannedAt: now,
        },
        create: {
          userId,
          status: "banned",
          bannedAt: now,
        },
        select: ENTRY_SELECT,
      });
      return rowToEntry(row);
    },
  };
}
