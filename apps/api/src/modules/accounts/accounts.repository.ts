// Prisma layer for the accounts module. Seven responsibilities:
//   - create(userId, input): insert one row (id auto-injected by prefixedIds
//     extension post-migration; UUID column was flipped to TEXT in story 2-1 T1).
//   - update(userId, id, patch): updateMany scoped by { id, userId } → null on
//     count=0. Empty patches short-circuit to a no-op findFirst.
//   - delete(userId, id): deleteMany scoped by { id, userId } → false on count=0.
//   - deleteWithFkProbe(userId, id): atomic FK-probe + delete wrapped in a
//     single $transaction (TOCTOU avoidance, mirrors milestones#addEnforcingCap).
//     Returns a discriminated outcome so the service can translate to typed errors
//     without taking a transaction-runner dep.
//   - listByUser(userId): rows ordered by createdAt asc (matches brownfield
//     apps/web/src/lib/actions/portfolio.ts#getAccounts).
//   - findByIdForUser(userId, id): single-row probe for service preconditions.
//   - countHoldingsReferencing(userId, accountId): FK-guard probe (kept for
//     fine-grained callers; the service-side delete uses deleteWithFkProbe).
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). Single-row finds use `where: { id, userId }`. The lint rule
// pekulo/no-prisma-query-without-user-id (story 0-12) gates this on every
// method below — its `prismaIdentifier` accepts `["prisma","tx","client"]` so
// a transaction callback's `tx` and the `deps.client.X.Y` callshape are both
// covered.
//
// L24 (2026-05-04, story 2-1 explicit) — cashBalance is Prisma.Decimal at the
// row layer; coerce via decimalToNumber() at the row → DTO boundary. The
// helper lives at apps/api/src/common/derive/decimal-to-number.ts (story 1-1
// extract). Inlining `Number(decimal)` or duplicating the helper = review fail.

import type { Account, CreateAccountInput } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";

interface UpdateAccountRepoInput {
  label?: string;
  type?: Account["type"];
  currency?: Account["currency"];
  cashBalance?: number;
  notes?: string | null;
}

type DeleteWithFkProbeOutcome =
  | { outcome: "deleted" }
  | { outcome: "fk-blocked"; holdingCount: number }
  | { outcome: "not-found" };

// Pre-flight findFirst lives OUTSIDE the $transaction so a cross-user / unknown
// id short-circuits without opening a tx; the update + log create live inside
// the tx for atomicity (DR-5 — failure of either rolls both back).
type RecordBalanceChangeOutcome =
  | { outcome: "updated"; account: Account }
  | { outcome: "not-found" };

interface RecordBalanceChangeRepoInput {
  id: string;
  valuedOn: Date;
  cashBalance: number;
}

export interface AccountRepository {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteWithFkProbe(userId: string, id: string): Promise<DeleteWithFkProbeOutcome>;
  listByUser(userId: string): Promise<Account[]>;
  findByIdForUser(userId: string, id: string): Promise<Account | null>;
  countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
  accountExistsForUser(userId: string, accountId: string): Promise<boolean>;
  accountsExistForUser(userId: string, accountIds: string[]): Promise<Set<string>>;
  findAccountIdByLabelForUser(
    userId: string,
    label: string,
  ): Promise<{ id: string | null; matchCount: number }>;
  recordBalanceChange(
    userId: string,
    input: RecordBalanceChangeRepoInput,
  ): Promise<RecordBalanceChangeOutcome>;
  /**
   * Story 5-6 T22 — find an existing provider-key-stamped account row.
   * Idempotency primitive for findOrCreateAutoFromProvider.
   */
  findByProviderKey(
    userId: string,
    provider: string,
    providerAccountKey: string,
  ): Promise<Account | null>;
  /**
   * Story 5-6 T22 — insert a provider-stamped account row in one shot.
   * Distinct from create() so the service stays explicit about the auto-
   * created vs user-created path.
   */
  createAuto(args: {
    userId: string;
    label: string;
    type: Account["type"];
    currency: string;
    cashBalance: number;
    provider: string;
    providerAccountKey: string;
    providerId?: string | null;
  }): Promise<Account>;
  /**
   * Story 6-10 (FR-65) — the user's distinct Bridge provider_ids (bank-logo
   * tier-2 source). Feeds the logo backfill + refresh warm-up so IBAN accounts
   * (whose providerAccountKey carries no provider_id) still resolve a bank logo.
   */
  listProviderIds(userId: string): Promise<string[]>;
}

type AccountRow = {
  id: string;
  userId: string;
  label: string;
  type: Account["type"];
  currency: string;
  cashBalance: unknown;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function rowToAccount(row: AccountRow): Account {
  // The Prisma model declares createdAt/updatedAt as nullable but with
  // @default(now()), so a Prisma-written row always carries both. A NULL here
  // signals direct SQL manipulation that bypassed the default — fail fast
  // rather than masking with new Date(0) (which would silently pass Zod's
  // accountSchema and surface as 1970-01-01 to the UI).
  if (!row.createdAt || !row.updatedAt) {
    throw new PekuloError("INTERNAL", "account row missing timestamp");
  }
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    type: row.type,
    currency: row.currency as Account["currency"],
    cashBalance: decimalToNumber(row.cashBalance, 0),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createAccountRepository(deps: { client: ExtendedPrismaClient }): AccountRepository {
  return {
    async create(userId, input) {
      // The `as unknown as ...` cast bridges the prefixedIds extension's
      // runtime id injection — the generated type still demands `id` because
      // accounts.prisma declares `id String @id` with no `@default` (post
      // story 2-1 T1 migration the gen_random_uuid() default was dropped).
      const created = await deps.client.account.create({
        data: {
          userId,
          label: input.label,
          type: input.type,
          currency: input.currency,
          cashBalance: input.cashBalance,
          notes: input.notes ?? null,
        } as unknown as Parameters<typeof deps.client.account.create>[0]["data"],
      });
      return rowToAccount(created as unknown as AccountRow);
    },

    async update(userId, id, patch) {
      // Short-circuit on empty patch: validator's .refine() rejects no-field
      // patches at the API boundary, but service callers (cron, worker, test)
      // can bypass that. Avoid a no-op write that would still bump updatedAt.
      const isEmptyPatch =
        patch.label === undefined &&
        patch.type === undefined &&
        patch.currency === undefined &&
        patch.cashBalance === undefined &&
        patch.notes === undefined;
      if (isEmptyPatch) {
        const row = await deps.client.account.findFirst({ where: { id, userId } });
        return row ? rowToAccount(row as unknown as AccountRow) : null;
      }
      // updateMany scoped by { id, userId } so a cross-user attempt yields
      // count=0 (defense in depth on top of RLS). Returning null lets the
      // service raise ACCOUNT_NOT_FOUND uniformly.
      const result = await deps.client.account.updateMany({
        where: { id, userId },
        data: {
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          ...(patch.cashBalance !== undefined ? { cashBalance: patch.cashBalance } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) return null;
      const row = await deps.client.account.findFirst({ where: { id, userId } });
      return row ? rowToAccount(row as unknown as AccountRow) : null;
    },

    async delete(userId, id) {
      const result = await deps.client.account.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async deleteWithFkProbe(userId, id) {
      // Atomic FK probe + delete inside a single $transaction so a concurrent
      // holdings insert between the count and the delete cannot slip past the
      // guard. Mirrors milestones.repository.ts#addEnforcingCap (count + create
      // wrapped in $transaction). The tx-scoped client carries both calls so
      // no rebuild / type cast is needed at the module-factory layer.
      return deps.client.$transaction(async (tx) => {
        const holdingCount = await tx.holding.count({
          where: { accountId: id, userId },
        });
        if (holdingCount > 0) {
          return { outcome: "fk-blocked", holdingCount } as const;
        }
        const result = await tx.account.deleteMany({ where: { id, userId } });
        if (result.count === 0) {
          return { outcome: "not-found" } as const;
        }
        return { outcome: "deleted" } as const;
      });
    },

    async listByUser(userId) {
      const rows = await deps.client.account.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => rowToAccount(r as unknown as AccountRow));
    },

    async findByIdForUser(userId, id) {
      const row = await deps.client.account.findFirst({ where: { id, userId } });
      return row ? rowToAccount(row as unknown as AccountRow) : null;
    },

    async countHoldingsReferencing(userId, accountId) {
      // Defense in depth — count only holdings that BOTH reference this
      // account AND belong to the user. RLS would block cross-user rows
      // anyway; the explicit userId guard satisfies story 0-12's lint rule
      // and protects against accidental service-role bypass.
      return deps.client.holding.count({
        where: { accountId, userId },
      });
    },

    async accountExistsForUser(userId, accountId) {
      const row = await deps.client.account.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });
      return row !== null;
    },

    async accountsExistForUser(userId, accountIds) {
      if (accountIds.length === 0) return new Set();
      const rows = await deps.client.account.findMany({
        where: { userId, id: { in: accountIds } },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    },

    async findAccountIdByLabelForUser(userId, label) {
      // Label resolution for CSV import (story 5-2, AC-4/AC-5). Returns the
      // single matching id when exactly one row matches; null + matchCount
      // otherwise so the caller can distinguish "no match" (404-equivalent at
      // the row level) from "ambiguous" (the brownfield `accounts` table has
      // no UNIQUE on (user_id, label), so duplicates are valid state).
      const rows = await deps.client.account.findMany({
        where: { userId, label },
        select: { id: true },
      });
      if (rows.length === 0) return { id: null, matchCount: 0 };
      if (rows.length > 1) return { id: null, matchCount: rows.length };
      return { id: rows[0]!.id, matchCount: 1 };
    },

    async recordBalanceChange(userId, input) {
      // Pre-flight check OUTSIDE the transaction — cross-user / unknown id
      // returns not-found without opening a tx. Mirrors deleteWithFkProbe's
      // discriminated outcome shape but with a single pre-flight (existence)
      // rather than two (existence + FK probe). Inside the tx we update the
      // parent AND insert the audit row atomically; failure of either rolls
      // both back (DR-5).
      const exists = await deps.client.account.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!exists) {
        return { outcome: "not-found" } as const;
      }
      const updated = await deps.client.$transaction(async (tx) => {
        // updateMany scoped by { id, userId } so a stale id between the
        // pre-flight and the tx body still surfaces null safely (count=0).
        // Defense in depth: RLS would block it too, but the explicit guard
        // is mandated by ADR-0013 + lint rule 0-12.
        const result = await tx.account.updateMany({
          where: { id: input.id, userId },
          data: {
            cashBalance: input.cashBalance,
            updatedAt: new Date(),
          },
        });
        if (result.count === 0) return null;
        // Audit insert — id is injected by the prefixedIds extension when
        // data.id is undefined (ADR-0012). The `as unknown as …` bridge
        // matches the create() branch above; the generated type still demands
        // `id` because account_balance_log.id has no @default in the schema.
        await tx.accountBalanceLog.create({
          data: {
            userId,
            accountId: input.id,
            cashBalance: input.cashBalance,
            valuedOn: input.valuedOn,
          } as unknown as Parameters<typeof tx.accountBalanceLog.create>[0]["data"],
        });
        const row = await tx.account.findFirst({ where: { id: input.id, userId } });
        return row;
      });
      if (!updated) return { outcome: "not-found" } as const;
      return {
        outcome: "updated",
        account: rowToAccount(updated as unknown as AccountRow),
      } as const;
    },

    async findByProviderKey(userId, provider, providerAccountKey) {
      const row = await deps.client.account.findFirst({
        where: {
          userId,
          ...({ provider, providerAccountKey } as unknown as Record<string, string>),
        },
      });
      return row ? rowToAccount(row as unknown as AccountRow) : null;
    },

    async createAuto({
      userId,
      label,
      type,
      currency,
      cashBalance,
      provider,
      providerAccountKey,
      providerId,
    }) {
      const created = await deps.client.account.create({
        data: {
          userId,
          label,
          type,
          currency,
          cashBalance,
          notes: null,
          provider,
          providerAccountKey,
          providerId: providerId ?? null,
        } as unknown as Parameters<typeof deps.client.account.create>[0]["data"],
      });
      return rowToAccount(created as unknown as AccountRow);
    },

    async listProviderIds(userId) {
      // `where: { userId }` keeps the no-prisma-query-without-user-id lint rule
      // satisfied even though provider_id is reference data, not PII.
      const rows = await deps.client.account.findMany({
        where: { userId, providerId: { not: null } },
        select: { providerId: true },
        distinct: ["providerId"],
      });
      return rows
        .map((r) => (r as { providerId: string | null }).providerId)
        .filter((id): id is string => id != null);
    },
  };
}
