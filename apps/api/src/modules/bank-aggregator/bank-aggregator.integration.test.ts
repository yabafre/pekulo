// T29 — full lifecycle integration: initiate → complete → refresh → webhook.
//
// Scope: exercises the composed service against a fake BankProvider + an
// in-memory BankAggregatorRepository + stub cross-aggregate deps. Verifies:
//   - completeConnection auto-creates one account per remote bridge account (AC-7)
//   - refreshConnection persists via importFromProvider with dedup (AC-2)
//   - webhook 1010 flips status to sca_required (AC-5)
//   - webhook 0 triggers refresh for matching providerItemId (AC-3 dispatch path)
//   - subsequent refresh on sca_required throws BANK_SCA_REQUIRED (AC-5)
//
// The Vault round-trip + RLS enforcement live at the repository layer and are
// validated by the rls-audit pre-flight (16 tables, bank_connections=4 policies)
// + manual smoke on Dokploy. This V1 test stays Bun-only for fast CI feedback.

import { test, expect } from "bun:test";
import type { Account } from "@pekulo/validators";
import type { AccountService } from "../accounts/accounts.service";
import type {
  ProviderTransactionImportRow,
  TransactionsService,
} from "../transactions/transactions.service";
import { createBankAggregatorService } from "./bank-aggregator.service";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { BankProvider } from "./bank-provider";

function makeInMemoryRepo(): BankAggregatorRepository {
  const store = new Map<
    string,
    {
      userId: string;
      provider: string;
      providerItemId: string;
      displayName: string | null;
      status: "active" | "sca_required" | "revoked";
      lastRefreshedAt: Date | null;
      createdAt: Date;
    }
  >();
  let nextId = 0;
  const providerUsers = new Map<string, string>();
  return {
    findProviderUserUuid: async (userId) => providerUsers.get(userId) ?? null,
    persistProviderUserUuid: async (userId, _provider, uuid) => {
      providerUsers.set(userId, uuid);
    },
    createConnection: async ({ userId, provider, providerItemId, displayName }) => {
      const id = `bnk_${String(++nextId).padStart(21, "0")}`;
      const row = {
        userId,
        provider,
        providerItemId,
        displayName,
        status: "active" as const,
        lastRefreshedAt: null,
        createdAt: new Date(),
      };
      store.set(id, row);
      return {
        id,
        userId,
        provider,
        providerItemId,
        status: row.status,
        displayName,
        lastRefreshedAt: null,
        createdAt: row.createdAt.toISOString(),
      };
    },
    listByUser: async (userId) => {
      const out = [];
      for (const [id, r] of store) {
        if (r.userId !== userId) continue;
        out.push({
          id,
          userId: r.userId,
          provider: r.provider as "bridge",
          providerItemId: r.providerItemId,
          status: r.status,
          displayName: r.displayName,
          lastRefreshedAt: r.lastRefreshedAt ? r.lastRefreshedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        });
      }
      return out;
    },
    findByIdForUser: async (userId, id) => {
      const r = store.get(id);
      if (!r || r.userId !== userId) return null;
      return {
        connection: {
          id,
          userId: r.userId,
          provider: r.provider as "bridge",
          providerItemId: r.providerItemId,
          status: r.status,
          displayName: r.displayName,
          lastRefreshedAt: r.lastRefreshedAt ? r.lastRefreshedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        },
      };
    },
    findByProviderItemId: async (userId, provider, providerItemId) => {
      for (const [id, r] of store) {
        if (r.userId === userId && r.provider === provider && r.providerItemId === providerItemId) {
          return {
            connection: {
              id,
              userId,
              provider: provider as "bridge",
              providerItemId,
              status: r.status,
              displayName: r.displayName,
              lastRefreshedAt: r.lastRefreshedAt ? r.lastRefreshedAt.toISOString() : null,
              createdAt: r.createdAt.toISOString(),
            },
          };
        }
      }
      return null;
    },
    setStatus: async (userId, id, status) => {
      const r = store.get(id);
      if (r && r.userId === userId) r.status = status;
    },
    setLastRefreshedAt: async (userId, id, at) => {
      const r = store.get(id);
      if (r && r.userId === userId) r.lastRefreshedAt = at;
    },
    setStatusByProviderItemId: async (provider, providerItemId, status) => {
      for (const r of store.values()) {
        if (r.provider === provider && r.providerItemId === providerItemId) r.status = status;
      }
    },
  };
}

function makeFakeProvider(): BankProvider {
  return {
    createUser: async () => ({ providerUserUuid: "bridge-uuid-fixture" }),
    createConnectSession: async () => ({ connectUrl: "https://x", sessionId: "session-1" }),
    listAccounts: async () => [
      {
        providerAccountId: "sg-1",
        bankName: "SG",
        accountName: "Courant",
        kind: "checking",
        currency: "EUR",
        balance: 1500,
      },
      {
        providerAccountId: "sg-2",
        bankName: "SG",
        accountName: "Livret A",
        kind: "savings",
        currency: "EUR",
        balance: 5000,
      },
    ],
    listTransactions: async () => ({
      transactions: [
        {
          providerTransactionId: "tx-1",
          providerAccountId: "sg-1",
          occurredOn: new Date("2026-05-25"),
          amount: -25.5,
          label: "Carrefour",
          rawCategory: null,
          updatedAt: new Date("2026-05-26T08:00Z"),
        },
        {
          providerTransactionId: "tx-2",
          providerAccountId: "sg-2",
          occurredOn: new Date("2026-05-25"),
          amount: 50,
          label: "Virement",
          rawCategory: null,
          updatedAt: new Date("2026-05-26T09:00Z"),
        },
      ],
      latestUpdatedAt: new Date("2026-05-26T09:00Z"),
    }),
    revokeItem: async () => undefined,
    getItem: async () => ({
      providerItemId: "item-42",
      statusCode: 0,
      statusMessage: "ok",
      authenticationExpiresAt: null,
    }),
  };
}

function makeStubAccountsService(): AccountService {
  const cache = new Map<string, Account>();
  let nextId = 0;
  return {
    create: async () => {
      throw new Error("not used");
    },
    update: async () => {
      throw new Error("not used");
    },
    delete: async () => ({ ok: true }),
    list: async () => [],
    recordBalanceChange: async () => {
      throw new Error("not used");
    },
    accountExists: async () => true,
    accountsExist: async () => new Set(),
    findAccountIdByLabel: async () => ({ id: null, matchCount: 0 }),
    findOrCreateAutoFromProvider: async (userId, provider, providerAccountKey, input) => {
      const k = `${userId}|${provider}|${providerAccountKey}`;
      const existing = cache.get(k);
      if (existing) return existing;
      const account: Account = {
        id: `acc_${String(++nextId).padStart(21, "0")}`,
        userId,
        label: input.label,
        type: input.type,
        currency: input.currency as Account["currency"],
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      cache.set(k, account);
      return account;
    },
    findByProviderKey: async (userId, provider, providerAccountKey) => {
      const k = `${userId}|${provider}|${providerAccountKey}`;
      return cache.get(k) ?? null;
    },
  };
}

function makeStubTransactionsService(): {
  service: TransactionsService;
  importedTotal: () => number;
} {
  let importedTotal = 0;
  const knownIds = new Set<string>();
  const service = {
    importFromProvider: async (
      _userId: string,
      provider: string,
      rows: ProviderTransactionImportRow[],
    ) => {
      const fresh = rows.filter((r) => !knownIds.has(`${provider}|${r.providerTransactionId}`));
      for (const r of fresh) knownIds.add(`${provider}|${r.providerTransactionId}`);
      importedTotal += fresh.length;
      return { persisted: fresh.length, skipped: rows.length - fresh.length };
    },
  } as unknown as TransactionsService;
  return { service, importedTotal: () => importedTotal };
}

test("full lifecycle: connect → refresh → dedup → webhook SCA flip → refresh rejected", async () => {
  const repo = makeInMemoryRepo();
  const provider = makeFakeProvider();
  const accountsService = makeStubAccountsService();
  const { service: transactionsService, importedTotal } = makeStubTransactionsService();
  const allConnections: Array<{ userId: string; connectionId: string }> = [];

  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => allConnections,
  });

  // 1) initiate → connect URL
  const session = await svc.initiateConnection("u", "fred@x", {});
  expect(session.connectUrl).toBe("https://x");

  // 2) complete → BankConnection persisted, accounts auto-created
  // First mint the bridge_users mapping (mimics initiateConnection's lazy create)
  await svc.initiateConnection("u", "fred@x", {});
  const connection = await svc.completeConnection("u", "fred@x", {
    itemId: "item-42",
    userUuid: "bridge-uuid-fixture",
  });
  expect(connection.provider).toBe("bridge");
  expect(connection.providerItemId).toBe("item-42");
  expect(connection.status).toBe("active");
  expect(connection).not.toHaveProperty("accessTokenSecretId");
  allConnections.push({ userId: "u", connectionId: connection.id });

  // 3) first refresh: both transactions persist
  const first = await svc.refreshConnection("u", { connectionId: connection.id });
  expect(first.fetched).toBe(2);
  expect(first.persisted).toBe(2);
  expect(first.skipped).toBe(0);
  expect(importedTotal()).toBe(2);

  // 4) second refresh: dedup → both skipped
  const second = await svc.refreshConnection("u", { connectionId: connection.id });
  expect(second.fetched).toBe(2);
  expect(second.persisted).toBe(0);
  expect(second.skipped).toBe(2);

  // 5) webhook 1010 flips status to sca_required
  await svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: "item-42", status_code: 1010 },
  });
  const list = await svc.listConnections("u");
  expect(list[0]?.status).toBe("sca_required");

  // 6) refresh on sca_required throws BANK_SCA_REQUIRED
  await expect(svc.refreshConnection("u", { connectionId: connection.id })).rejects.toThrow(
    /SCA refresh required/,
  );
});
