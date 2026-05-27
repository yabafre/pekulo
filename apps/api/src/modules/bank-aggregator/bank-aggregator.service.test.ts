// AC-1 + AC-2 + AC-3 + AC-5 + AC-6 + AC-7 (verbatim from story 5-6-bridge-connector):
//   AC-1 — completeConnection persists a BankConnection row (DTO without
//          secret IDs).
//   AC-2 — refreshConnection runs dedup pre-flight and stamps lastRefreshedAt.
//   AC-5 — status_code=1010 webhook flips status to sca_required (no retry).
//   AC-6 — refreshAll iterates per connection sequentially, swallows failures.
//   AC-7 — completeConnection auto-creates one Account per remote Bridge account.
//
// All tests use in-memory stubs — no DB, no network. The service is a pure
// composition over the four collaborators (repository / provider / transactions
// service / accounts service). T29 (integration) covers the full DB cycle.

import { test, expect } from "bun:test";
import type { AccountService } from "../accounts/accounts.service";
import type {
  ProviderTransactionImportRow,
  TransactionsService,
} from "../transactions/transactions.service";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { BankProvider } from "./bank-provider";
import { createBankAggregatorService } from "./bank-aggregator.service";

function makeStubs() {
  const repo: BankAggregatorRepository = {
    // Stubs default to "user already mapped" so completeConnection's identity
    // guard (input.userUuid === expectedUserUuid) passes for tests that don't
    // override findProviderUserUuid.
    findProviderUserUuid: async () => "bridge-uuid-1",
    persistProviderUserUuid: async () => undefined,
    createConnection: async () => ({
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: "SG",
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    }),
    listByUser: async () => [],
    findByIdForUser: async () => null,
    findByProviderItemId: async () => null,
    setStatus: async () => undefined,
    setLastRefreshedAt: async () => undefined,
    setStatusByProviderItemId: async () => undefined,
  };
  const provider: BankProvider = {
    createUser: async () => ({ providerUserUuid: "bridge-uuid-1" }),
    createConnectSession: async () => ({ connectUrl: "u", sessionId: "s" }),
    listAccounts: async () => [
      {
        providerAccountId: "1",
        bankName: "SG",
        accountName: "Courant",
        kind: "checking",
        currency: "EUR",
        balance: 1234.56,
      },
    ],
    listTransactions: async () => ({ transactions: [], latestUpdatedAt: null }),
    revokeItem: async () => undefined,
    getItem: async () => ({
      providerItemId: "i",
      statusCode: 0,
      statusMessage: "ok",
      authenticationExpiresAt: null,
    }),
  };
  const transactionsService = {
    importFromProvider: async (_u: string, _p: string, rows: ProviderTransactionImportRow[]) => ({
      persisted: rows.length,
      skipped: 0,
    }),
  } as unknown as TransactionsService;
  const accountsService = {
    findOrCreateAutoFromProvider: async () => ({
      id: "acc_x",
      userId: "u",
      label: "Bridge — SG — Courant",
      type: "banque",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    // FEAT13 — resolveAccountIds is lookup-only at refresh time.
    findByProviderKey: async () => ({
      id: "acc_x",
      userId: "u",
      label: "Bridge — SG — Courant",
      type: "banque" as const,
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  } as unknown as AccountService;
  return { repo, provider, transactionsService, accountsService };
}

// ───── T15 — initiate + complete + list ─────────────────────────────────

test("initiateConnection returns connect URL + sessionId", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const result = await svc.initiateConnection("u", "fred@x", {});
  expect(result.connectUrl).toBe("u");
  expect(result.sessionId).toBe("s");
});

test("completeConnection auto-creates accounts then persists (AC-7)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let createCalls = 0;
  accountsService.findOrCreateAutoFromProvider = (async () => {
    createCalls++;
    return {
      id: "acc_1",
      userId: "u",
      label: "x",
      type: "autre" as const,
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as AccountService["findOrCreateAutoFromProvider"];
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const result = await svc.completeConnection("u", "fred@x", {
    itemId: "i",
    userUuid: "bridge-uuid-1",
  });
  expect(result.provider).toBe("bridge");
  expect(createCalls).toBe(1);
});

test("completeConnection rejects when the Bridge item is already connected", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByProviderItemId = async () => ({
    connection: {
      id: "bnk_dup",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await expect(
    svc.completeConnection("u", "fred@x", { itemId: "i", userUuid: "bridge-uuid-1" }),
  ).rejects.toThrow(/already exists/);
});

test("listConnections delegates without leaking secret-id columns (AC-4)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.listByUser = async () => [
    {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    },
  ];
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const list = await svc.listConnections("u");
  expect(list[0]).not.toHaveProperty("accessTokenSecretId");
  expect(list[0]).not.toHaveProperty("refreshTokenSecretId");
});

// ───── T16 — refresh + refreshAll ───────────────────────────────────────

test("refreshConnection rejects sca_required with BANK_SCA_REQUIRED (AC-5)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "sca_required",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await expect(svc.refreshConnection("u", { connectionId: "bnk_x" })).rejects.toThrow(
    /SCA refresh required/,
  );
});

test("refreshConnection persists fetched + skipped + lastRefreshedAt (AC-2)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listTransactions = async () => ({
    transactions: [
      {
        providerTransactionId: "tx-1",
        providerAccountId: "1",
        occurredOn: new Date("2026-05-26"),
        amount: -10,
        label: "Carrefour",
        rawCategory: null,
        updatedAt: new Date("2026-05-26T10:00Z"),
      },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"),
  });
  transactionsService.importFromProvider = async () => ({ persisted: 1, skipped: 0 });
  const stamped: { at: Date | null } = { at: null };
  repo.setLastRefreshedAt = async (_u, _c, at) => {
    stamped.at = at;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.refreshConnection("u", { connectionId: "bnk_x" });
  expect(out.fetched).toBe(1);
  expect(out.persisted).toBe(1);
  expect(stamped.at?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

test("refreshAll swallows per-connection failure non-fatally (AC-6)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let count = 0;
  repo.findByIdForUser = async (_u, c) => {
    count++;
    if (c === "bnk_a") throw new Error("boom");
    return {
      connection: {
        id: c,
        userId: "u",
        provider: "bridge",
        providerItemId: "i",
        status: "active",
        displayName: null,
        lastRefreshedAt: null,
        createdAt: new Date().toISOString(),
      },
      tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
    };
  };
  provider.listTransactions = async () => ({ transactions: [], latestUpdatedAt: null });
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [
      { userId: "u", connectionId: "bnk_a" },
      { userId: "u", connectionId: "bnk_b" },
    ],
  });
  await svc.refreshAll();
  expect(count).toBeGreaterThanOrEqual(2);
});

// ───── T17 — webhook handler ────────────────────────────────────────────

test("handleWebhookEvent ignores non-item.refreshed events", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let setStatusCalled = false;
  repo.setStatusByProviderItemId = async () => {
    setStatusCalled = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await svc.handleWebhookEvent({ type: "item.created", content: { item_id: 1 } });
  expect(setStatusCalled).toBe(false);
});

test("handleWebhookEvent on status_code=1010 flips sca_required (AC-5)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const calledWith: { value: { provider: string; itemId: string; status: string } | null } = {
    value: null,
  };
  repo.setStatusByProviderItemId = async (p, i, s) => {
    calledWith.value = { provider: p, itemId: i, status: s };
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 1010 },
  });
  expect(calledWith.value).toEqual({ provider: "bridge", itemId: "42", status: "sca_required" });
});

test("handleWebhookEvent on status_code=0 triggers transaction fetch for owners", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "42",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listTransactions = async () => ({ transactions: [], latestUpdatedAt: null });
  let imported = false;
  transactionsService.importFromProvider = async () => {
    imported = true;
    return { persisted: 0, skipped: 0 };
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_x" }],
  });
  await svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 0 },
  });
  expect(imported).toBe(true);
});

test("handleWebhookEvent rejects malformed event silently (no throw)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await svc.handleWebhookEvent(null);
  await svc.handleWebhookEvent("nope");
  await svc.handleWebhookEvent({ type: "item.refreshed" });
  // No throw — assertion-free.
});
