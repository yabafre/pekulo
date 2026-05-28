// apps/api/src/modules/bank-aggregator/bank-aggregator.repository.ts
// Vault-aware repository for bank_connections (story 5-6 + ADR-0015 amendment).
//
// Token storage: every secret write goes through Vault's vault.create_secret;
// the returned UUID lands on bank_connections.{access,refresh}_token_secret_id.
// Reads use vault.decrypted_secrets — apps/api connects with the Supabase
// service role which can SELECT from that view.
//
// NEVER log or return plaintext tokens. The DTO mapper at the end of every
// method drops the secret-id columns from the response shape (NFR-31, AC-4).

import type { BankConnection, BankConnectionStatus, BankProviderName } from "@pekulo/validators";
import type { PrismaService } from "../../database";

interface PersistedConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  provider_item_id: string;
  access_token_secret_id: string | null;
  refresh_token_secret_id: string | null;
  status: string;
  display_name: string | null;
  last_refreshed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BankAggregatorRepository {
  /**
   * Story 5-6 FIX (2026-05-27) — Bridge v3 user mapping.
   * Look up the persisted bridge_user_uuid for this Pekulo userId, or null
   * if none yet. Service does the create-on-miss path because the create
   * must call the BankProvider, not the repo.
   */
  findProviderUserUuid(userId: string, provider: BankProviderName): Promise<string | null>;

  /**
   * Story 5-6 FIX — persist the bridge_user_uuid mapping (one-shot insert).
   * Idempotent at the DB level via the PRIMARY KEY (user_id) — a concurrent
   * race surfaces as a unique-violation P2002 which the service swallows
   * (re-reads via findProviderUserUuid).
   */
  persistProviderUserUuid(
    userId: string,
    provider: BankProviderName,
    providerUserUuid: string,
  ): Promise<void>;

  /**
   * Story 5-6 FIX (Bridge v3, 2026-05-27) — tokens dropped from the create
   * surface. Bridge keeps OAuth tokens server-side under the stateful-widget
   * model ; Pekulo persists only the connection metadata + provider_item_id.
   * Vault columns (access_token_secret_id, refresh_token_secret_id) stay
   * NULL — slated for a clean DROP COLUMN migration in V1.5.
   */
  createConnection(args: {
    userId: string;
    provider: BankProviderName;
    providerItemId: string;
    displayName: string | null;
  }): Promise<BankConnection>;

  listByUser(userId: string): Promise<BankConnection[]>;

  findByIdForUser(
    userId: string,
    connectionId: string,
  ): Promise<{ connection: BankConnection } | null>;

  /**
   * Story 5-7 (FR-62) — rename a connection's user-facing display name.
   * Scoped by userId (ADR-0013). Returns the refreshed DTO, or null if no
   * row matched (deleted / cross-user) — the service maps null → NOT_FOUND.
   */
  setDisplayName(
    userId: string,
    connectionId: string,
    displayName: string,
  ): Promise<{ connection: BankConnection } | null>;

  findByProviderItemId(
    userId: string,
    provider: BankProviderName,
    providerItemId: string,
  ): Promise<{ connection: BankConnection } | null>;

  setStatus(userId: string, connectionId: string, status: BankConnectionStatus): Promise<void>;

  setLastRefreshedAt(userId: string, connectionId: string, at: Date): Promise<void>;

  /**
   * Cross-user lookup keyed by (provider, providerItemId). Used by the webhook
   * handler to resolve the owning userId(s) before applying any userId-scoped
   * mutation — ADR-0013 defense-in-depth requires the userId on every write.
   *
   * Returns an array because the unique constraint on bank_connections is
   * (user_id, provider, provider_item_id) — Bridge mints distinct item_ids per
   * user, so in practice the array carries 0 or 1 entry, but the schema does
   * not forbid a collision and the webhook MUST handle the multi-owner case
   * gracefully (apply per row).
   */
  findOwnersByProviderItemId(
    provider: BankProviderName,
    providerItemId: string,
  ): Promise<Array<{ userId: string; connectionId: string }>>;
}

function toDto(row: PersistedConnectionRow): BankConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as BankProviderName,
    providerItemId: row.provider_item_id,
    status: row.status as BankConnectionStatus,
    displayName: row.display_name,
    lastRefreshedAt: row.last_refreshed_at ? row.last_refreshed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

interface PrismaBankConnectionRow {
  id: string;
  userId: string;
  provider: string;
  providerItemId: string;
  accessTokenSecretId: string | null;
  refreshTokenSecretId: string | null;
  status: string;
  displayName: string | null;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToDto(r: PrismaBankConnectionRow): BankConnection {
  return toDto({
    id: r.id,
    user_id: r.userId,
    provider: r.provider,
    provider_item_id: r.providerItemId,
    access_token_secret_id: r.accessTokenSecretId,
    refresh_token_secret_id: r.refreshTokenSecretId,
    status: r.status,
    display_name: r.displayName,
    last_refreshed_at: r.lastRefreshedAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  });
}

export function createBankAggregatorRepository(deps: {
  prismaService: PrismaService;
}): BankAggregatorRepository {
  const db = deps.prismaService.client;

  return {
    async findProviderUserUuid(userId, _provider) {
      // V1 only supports Bridge — _provider is the placeholder for the
      // multi-provider future (Powens etc.) per ADR-0015. The bridge_users
      // table is dedicated to Bridge today; once Powens lands, this becomes
      // a `provider_users` table with a discriminator column.
      const row = (await db.bridgeUser.findUnique({ where: { userId } })) as {
        bridgeUserUuid: string;
      } | null;
      return row ? row.bridgeUserUuid : null;
    },

    async persistProviderUserUuid(userId, _provider, providerUserUuid) {
      await db.bridgeUser.create({
        data: { userId, bridgeUserUuid: providerUserUuid },
      });
    },

    async createConnection({ userId, provider, providerItemId, displayName }) {
      const row = (await db.bankConnection.create({
        data: {
          userId,
          provider,
          providerItemId,
          displayName,
          status: "active",
        } as unknown as Parameters<typeof db.bankConnection.create>[0]["data"],
      })) as PrismaBankConnectionRow;
      return rowToDto(row);
    },

    async listByUser(userId) {
      // Story 5-7 (AC-4): soft-deleted (revoked) connections disappear from
      // the management list. The row stays in the table for audit; revoke
      // flips status to 'revoked' (bank-aggregator.service.revokeConnection).
      const rows = (await db.bankConnection.findMany({
        where: { userId, status: { not: "revoked" } },
        orderBy: { createdAt: "desc" },
      })) as PrismaBankConnectionRow[];
      return rows.map(rowToDto);
    },

    async findByIdForUser(userId, connectionId) {
      const r = (await db.bankConnection.findFirst({
        where: { userId, id: connectionId },
      })) as PrismaBankConnectionRow | null;
      if (!r) return null;
      return { connection: rowToDto(r) };
    },

    async setDisplayName(userId, connectionId, displayName) {
      const res = await db.bankConnection.updateMany({
        where: { id: connectionId, userId },
        data: { displayName },
      });
      if (res.count === 0) return null;
      const r = (await db.bankConnection.findFirst({
        where: { userId, id: connectionId },
      })) as PrismaBankConnectionRow | null;
      return r ? { connection: rowToDto(r) } : null;
    },

    async findByProviderItemId(userId, provider, providerItemId) {
      const r = (await db.bankConnection.findFirst({
        where: { userId, provider, providerItemId },
      })) as PrismaBankConnectionRow | null;
      if (!r) return null;
      return { connection: rowToDto(r) };
    },

    async setStatus(userId, connectionId, status) {
      await db.bankConnection.updateMany({
        where: { id: connectionId, userId },
        data: { status },
      });
    },

    async setLastRefreshedAt(userId, connectionId, at) {
      await db.bankConnection.updateMany({
        where: { id: connectionId, userId },
        data: { lastRefreshedAt: at },
      });
    },

    async findOwnersByProviderItemId(provider, providerItemId) {
      const rows = (await db.bankConnection.findMany({
        where: { provider, providerItemId },
        select: { id: true, userId: true },
      })) as Array<{ id: string; userId: string }>;
      return rows.map((r) => ({ userId: r.userId, connectionId: r.id }));
    },
  };
}
