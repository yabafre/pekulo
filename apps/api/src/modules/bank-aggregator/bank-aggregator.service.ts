// apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts
// Bank-aggregator domain service (story 5-6 + ADR-0015).
//
// Composition root: createBankAggregatorService injects repository + provider
// + transactionsService + accountsService + an optional clock seam (lesson
// 2026-05-27 — factory-level clock, no PEKULO_DEV_NOW_ISO env var).
//
// AC-1: completeConnection persists via Vault-encrypted token storage.
// AC-2: refreshConnection runs the dedup pre-flight inside importFromProvider.
// AC-5: SCA expiry (status_code=1010) flips status without retrying refresh.
// AC-6: refreshAll iterates per-user sequentially, swallows per-conn failure.
// AC-7: completeConnection auto-creates one Account per remote Bridge account.
// NFR-31: every method returns the DTO from the repository — token columns
//         are dropped at the boundary.

import type {
  BankConnection,
  BankProviderName,
  CompleteConnectionInput,
  InitiateConnectionInput,
  InitiateConnectionOutput,
  RefreshConnectionInput,
  RefreshConnectionOutput,
} from "@pekulo/validators";
import type { AccountService } from "../accounts/accounts.service";
import type {
  ProviderTransactionImportRow,
  TransactionsService,
} from "../transactions/transactions.service";
import {
  bankConnectionAlreadyExists,
  bankConnectionNotFound,
  bankScaRequired,
} from "./bank-aggregator.errors";
import type { BankProvider, ProviderBankAccount, ProviderTransaction } from "./bank-provider";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";

export interface BankAggregatorService {
  initiateConnection(
    userId: string,
    userEmail: string,
    input: InitiateConnectionInput,
  ): Promise<InitiateConnectionOutput>;
  completeConnection(
    userId: string,
    userEmail: string,
    input: CompleteConnectionInput,
  ): Promise<BankConnection>;
  listConnections(userId: string): Promise<BankConnection[]>;
  refreshConnection(
    userId: string,
    input: RefreshConnectionInput,
  ): Promise<RefreshConnectionOutput>;
  refreshAll(): Promise<void>;
  handleWebhookEvent(event: unknown): Promise<void>;
  getReconnectUrl(userId: string, userEmail: string, connectionId: string): Promise<string>;
}

function mapBridgeAccountKind(kind: ProviderBankAccount["kind"]): "livret" | "autre" {
  // V1 brownfield enum: livret | pea | cto | av | autre. checking maps to
  // "autre" (no courant value in V1); savings maps to "livret"; other → "autre".
  return kind === "savings" ? "livret" : "autre";
}

export function createBankAggregatorService(deps: {
  repository: BankAggregatorRepository;
  provider: BankProvider;
  transactionsService: TransactionsService;
  accountsService: AccountService;
  listAllActiveConnections: () => Promise<Array<{ userId: string; connectionId: string }>>;
  clock?: () => Date;
}): BankAggregatorService {
  const now = () => (deps.clock ? deps.clock() : new Date());

  async function resolveAccountIds(
    userId: string,
    transactions: ProviderTransaction[],
  ): Promise<Map<string, string>> {
    // For each unique providerAccountId, resolve the local accountId via the
    // idempotent findOrCreateAutoFromProvider. The map is keyed by remote
    // providerAccountId for O(1) lookup in the row-mapping loop.
    const uniqueRemote = Array.from(new Set(transactions.map((t) => t.providerAccountId)));
    const map = new Map<string, string>();
    for (const remote of uniqueRemote) {
      const account = await deps.accountsService.findOrCreateAutoFromProvider(
        userId,
        "bridge",
        remote,
        {
          label: `Bridge — account ${remote}`,
          type: "autre",
          currency: "EUR",
        },
      );
      map.set(remote, account.id);
    }
    return map;
  }

  // Story 5-6 FIX (post-smoke-test): Bridge v3 connect-sessions take
  // user_uuid (provider-side), not user_email. We persist the Pekulo userId ↔
  // bridge_user_uuid mapping in bridge_users so the create-user POST only
  // runs once per Pekulo user. The `_userEmail` argument is retained on the
  // signature for the future case where another provider may still rely on
  // email (Powens — TBD).
  async function resolveProviderUserUuid(userId: string): Promise<string> {
    const existing = await deps.repository.findProviderUserUuid(userId, "bridge");
    if (existing) return existing;
    const created = await deps.provider.createUser({ externalUserId: userId });
    try {
      await deps.repository.persistProviderUserUuid(userId, "bridge", created.providerUserUuid);
    } catch (err) {
      // Concurrent-init race: another request just inserted the row. Re-read
      // and trust the second-write fallback. If even the re-read returns
      // null, surface the original error.
      const retry = await deps.repository.findProviderUserUuid(userId, "bridge");
      if (!retry) throw err;
      return retry;
    }
    return created.providerUserUuid;
  }

  return {
    async initiateConnection(userId, userEmail, input) {
      const userUuid = await resolveProviderUserUuid(userId);
      const session = await deps.provider.createConnectSession({
        userUuid,
        userEmail,
        redirectUri: input.redirectUri,
      });
      return { connectUrl: session.connectUrl, sessionId: session.sessionId };
    },

    async completeConnection(userId, _userEmail, input) {
      // Bridge v3 stateful-widget model: the widget handed us a ready-to-use
      // item_id + user_uuid via the callback. We:
      //   1. Verify the user_uuid in the callback matches the bridge_users
      //      mapping for this Pekulo userId (defense — prevents a
      //      cross-user-attacker-supplies-someone-else's-item_id race).
      //   2. List the accounts for the item (user-Bearer minted internally).
      //   3. Auto-create local Account rows (AC-7).
      //   4. Persist BankConnection (tokens null — Bridge keeps them).
      const expectedUserUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
      if (!expectedUserUuid || expectedUserUuid !== input.userUuid) {
        throw bankConnectionNotFound(input.itemId);
      }

      const existing = await deps.repository.findByProviderItemId(userId, "bridge", input.itemId);
      if (existing) throw bankConnectionAlreadyExists(input.itemId);

      const remoteAccounts = await deps.provider.listAccounts({
        userUuid: input.userUuid,
        providerItemId: input.itemId,
      });
      for (const a of remoteAccounts) {
        await deps.accountsService.findOrCreateAutoFromProvider(
          userId,
          "bridge",
          a.providerAccountId,
          {
            label: `Bridge — ${a.bankName} — ${a.accountName}`,
            type: mapBridgeAccountKind(a.kind),
            currency: a.currency,
            cashBalance: a.balance,
          },
        );
      }

      const created = await deps.repository.createConnection({
        userId,
        provider: "bridge" as BankProviderName,
        providerItemId: input.itemId,
        displayName: remoteAccounts[0]?.bankName ?? null,
      });
      return created;
    },

    async listConnections(userId) {
      return deps.repository.listByUser(userId);
    },

    async refreshConnection(userId, input) {
      const found = await deps.repository.findByIdForUser(userId, input.connectionId);
      if (!found) throw bankConnectionNotFound(input.connectionId);
      if (found.connection.status === "sca_required") throw bankScaRequired(input.connectionId);
      if (found.connection.status === "revoked") throw bankConnectionNotFound(input.connectionId);

      const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
      if (!userUuid) throw bankConnectionNotFound(input.connectionId);

      const since = found.connection.lastRefreshedAt
        ? new Date(found.connection.lastRefreshedAt)
        : null;
      const { transactions, latestUpdatedAt } = await deps.provider.listTransactions({
        userUuid,
        providerItemId: found.connection.providerItemId,
        since,
      });

      const accountIdMap = await resolveAccountIds(userId, transactions);
      const rows: ProviderTransactionImportRow[] = transactions
        .map((t) => {
          const accountId = accountIdMap.get(t.providerAccountId);
          if (!accountId) return null;
          const type = t.amount >= 0 ? ("inflow" as const) : ("outflow" as const);
          return {
            accountId,
            occurredOn: t.occurredOn,
            label: t.label,
            amount: Math.abs(t.amount),
            type,
            category: "autre",
            providerTransactionId: t.providerTransactionId,
          };
        })
        .filter((r): r is ProviderTransactionImportRow => r !== null);

      const { persisted, skipped } = await deps.transactionsService.importFromProvider(
        userId,
        "bridge",
        rows,
      );
      const stamp = latestUpdatedAt ?? now();
      await deps.repository.setLastRefreshedAt(userId, input.connectionId, stamp);

      return {
        fetched: transactions.length,
        persisted,
        skipped,
        lastRefreshedAt: stamp.toISOString(),
      };
    },

    async refreshAll() {
      const all = await deps.listAllActiveConnections();
      for (const c of all) {
        try {
          await this.refreshConnection(c.userId, { connectionId: c.connectionId });
        } catch (err) {
          // Non-fatal — one user's Bridge outage MUST NOT poison another
          // user's refresh. AC-6.
          console.warn(
            `[bank-aggregator] refreshAll skip ${c.connectionId}: ${
              err instanceof Error ? err.message : "unknown"
            }`,
          );
        }
      }
    },

    async handleWebhookEvent(event) {
      if (!event || typeof event !== "object") return;
      const evt = event as {
        type?: string;
        content?: { item_id?: number | string; status_code?: number };
      };
      if (evt.type !== "item.refreshed") return;
      const providerItemId =
        evt.content?.item_id !== undefined ? String(evt.content.item_id) : null;
      const statusCode = evt.content?.status_code;
      if (!providerItemId) return;
      if (statusCode === 1010) {
        // AC-5 — SCA expired; flip status, no transaction-fetch side-effect.
        await deps.repository.setStatusByProviderItemId("bridge", providerItemId, "sca_required");
        return;
      }
      if (statusCode === 0) {
        // Bridge scheduler refreshed the item — pull new transactions if we
        // own this provider_item_id locally. Iterate active connections and
        // probe the providerItemId match.
        const all = await deps.listAllActiveConnections();
        for (const c of all) {
          const found = await deps.repository.findByIdForUser(c.userId, c.connectionId);
          if (found && found.connection.providerItemId === providerItemId) {
            try {
              await this.refreshConnection(c.userId, { connectionId: c.connectionId });
            } catch (err) {
              console.warn(
                `[bank-aggregator] webhook refresh skip ${c.connectionId}: ${
                  err instanceof Error ? err.message : "unknown"
                }`,
              );
            }
          }
        }
      }
    },

    async getReconnectUrl(userId, userEmail, connectionId) {
      const found = await deps.repository.findByIdForUser(userId, connectionId);
      if (!found) throw bankConnectionNotFound(connectionId);
      const userUuid = await resolveProviderUserUuid(userId);
      const session = await deps.provider.createConnectSession({
        userUuid,
        userEmail,
        itemId: found.connection.providerItemId,
        forceReauthentication: false,
      });
      return session.connectUrl;
    },
  };
}
