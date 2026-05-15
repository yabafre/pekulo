// Prisma layer for the accounts module. Six responsibilities:
//   - create(userId, input): insert one row (id auto-injected by prefixedIds
//     extension post-migration; UUID column was flipped to TEXT in story 2-1 T1).
//   - update(userId, id, patch): updateMany scoped by { id, userId } → null on count=0.
//   - delete(userId, id): deleteMany scoped by { id, userId } → false on count=0.
//   - listByUser(userId): rows ordered by createdAt asc (matches brownfield
//     apps/web/src/lib/actions/portfolio.ts#getAccounts).
//   - findByIdForUser(userId, id): single-row probe for service preconditions.
//   - countHoldingsReferencing(userId, accountId): FK-guard probe consumed by
//     the service-side $transaction-wrapped delete.
//
// Every query carries an explicit `where: { userId }` clause (ADR-0013, defense
// in depth). Single-row finds use `where: { id, userId }`. The lint rule
// pekulo/no-prisma-query-without-user-id (story 0-12) gates this on every
// method below — its `prismaIdentifier` accepts `["prisma","tx"]` so a
// transaction callback's `tx` is also covered.
//
// L24 (2026-05-04, story 2-1 explicit) — cashBalance is Prisma.Decimal at the
// row layer; coerce via decimalToNumber() at the row → DTO boundary. The
// helper lives at apps/api/src/common/derive/decimal-to-number.ts (story 1-1
// extract). Inlining `Number(decimal)` or duplicating the helper = review fail.

import type { Account, CreateAccountInput } from "@pekulo/validators";
import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";

export interface UpdateAccountRepoInput {
  label?: string;
  type?: Account["type"];
  currency?: Account["currency"];
  cashBalance?: number;
  notes?: string | null;
}

export interface AccountRepository {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, id: string, patch: UpdateAccountRepoInput): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listByUser(userId: string): Promise<Account[]>;
  findByIdForUser(userId: string, id: string): Promise<Account | null>;
  countHoldingsReferencing(userId: string, accountId: string): Promise<number>;
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
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    type: row.type,
    currency: row.currency as Account["currency"],
    cashBalance: decimalToNumber(row.cashBalance, 0),
    notes: row.notes,
    createdAt: row.createdAt ?? new Date(0),
    updatedAt: row.updatedAt ?? new Date(0),
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
  };
}
