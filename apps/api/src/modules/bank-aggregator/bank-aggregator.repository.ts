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

import { Prisma } from "@generated/prisma/client";
import type { BankConnection, BankConnectionStatus, BankProviderName } from "@pekulo/validators";
import type { PrismaService } from "../../database";
import type { ProviderTokenPair } from "./bank-provider";

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

  createConnection(args: {
    userId: string;
    provider: BankProviderName;
    providerItemId: string;
    displayName: string | null;
    tokens: ProviderTokenPair;
  }): Promise<BankConnection>;

  listByUser(userId: string): Promise<BankConnection[]>;

  findByIdForUser(
    userId: string,
    connectionId: string,
  ): Promise<{ connection: BankConnection; tokens: ProviderTokenPair } | null>;

  findByProviderItemId(
    userId: string,
    provider: BankProviderName,
    providerItemId: string,
  ): Promise<{ connection: BankConnection; tokens: ProviderTokenPair } | null>;

  setStatus(userId: string, connectionId: string, status: BankConnectionStatus): Promise<void>;

  setLastRefreshedAt(userId: string, connectionId: string, at: Date): Promise<void>;

  setStatusByProviderItemId(
    provider: BankProviderName,
    providerItemId: string,
    status: BankConnectionStatus,
  ): Promise<void>;
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

  async function createVaultSecret(name: string, secret: string): Promise<string> {
    const rows = await db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT vault.create_secret(${secret}, ${name})::text AS id`,
    );
    if (!rows[0]?.id) throw new Error("vault.create_secret did not return an id");
    return rows[0].id;
  }

  async function readVaultSecret(id: string): Promise<string> {
    const rows = await db.$queryRaw<Array<{ decrypted_secret: string }>>(
      Prisma.sql`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = ${id}::uuid`,
    );
    if (!rows[0]) throw new Error(`vault secret ${id} not found`);
    return rows[0].decrypted_secret;
  }

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

    async createConnection({ userId, provider, providerItemId, displayName, tokens }) {
      const accessId = await createVaultSecret(`bnk_${providerItemId}_access`, tokens.accessToken);
      const refreshId = await createVaultSecret(
        `bnk_${providerItemId}_refresh`,
        tokens.refreshToken,
      );
      const row = (await db.bankConnection.create({
        data: {
          userId,
          provider,
          providerItemId,
          accessTokenSecretId: accessId,
          refreshTokenSecretId: refreshId,
          displayName,
          status: "active",
        } as unknown as Parameters<typeof db.bankConnection.create>[0]["data"],
      })) as PrismaBankConnectionRow;
      return rowToDto(row);
    },

    async listByUser(userId) {
      const rows = (await db.bankConnection.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      })) as PrismaBankConnectionRow[];
      return rows.map(rowToDto);
    },

    async findByIdForUser(userId, connectionId) {
      const r = (await db.bankConnection.findFirst({
        where: { userId, id: connectionId },
      })) as PrismaBankConnectionRow | null;
      if (!r) return null;
      if (!r.accessTokenSecretId || !r.refreshTokenSecretId) return null;
      const [accessToken, refreshToken] = await Promise.all([
        readVaultSecret(r.accessTokenSecretId),
        readVaultSecret(r.refreshTokenSecretId),
      ]);
      return {
        connection: rowToDto(r),
        tokens: { accessToken, refreshToken, expiresAt: null },
      };
    },

    async findByProviderItemId(userId, provider, providerItemId) {
      const r = (await db.bankConnection.findFirst({
        where: { userId, provider, providerItemId },
      })) as PrismaBankConnectionRow | null;
      if (!r) return null;
      if (!r.accessTokenSecretId || !r.refreshTokenSecretId) return null;
      const [accessToken, refreshToken] = await Promise.all([
        readVaultSecret(r.accessTokenSecretId),
        readVaultSecret(r.refreshTokenSecretId),
      ]);
      return {
        connection: rowToDto(r),
        tokens: { accessToken, refreshToken, expiresAt: null },
      };
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

    async setStatusByProviderItemId(provider, providerItemId, status) {
      await db.bankConnection.updateMany({
        where: { provider, providerItemId },
        data: { status },
      });
    },
  };
}
