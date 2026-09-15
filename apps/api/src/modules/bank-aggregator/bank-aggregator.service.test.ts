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
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    }),
    listByUser: async () => [],
    findByIdForUser: async () => null,
    setDisplayName: async () => null,
    findByProviderItemId: async () => null,
    findActiveByProviderId: async () => false,
    setStatus: async () => undefined,
    setLastRefreshedAt: async () => undefined,
    setLastSyncedAt: async () => undefined,
    findOwnersByProviderItemId: async () => [],
  };
  const provider: BankProvider = {
    createUser: async () => ({ providerUserUuid: "bridge-uuid-1" }),
    createConnectSession: async () => ({ connectUrl: "u", sessionId: "s" }),
    getProviderLogo: async () => ({ logoUrl: null }),
    listAccounts: async () => [
      {
        providerAccountId: "1",
        accountKey: "iban:FRTEST0001",
        bankName: "SG",
        accountName: "Courant",
        kind: "checking",
        currency: "EUR",
        balance: 1234.56,
        providerId: "574",
      },
    ],
    listTransactions: async () => ({
      transactions: [],
      latestUpdatedAt: null,
      oldestUpdatedAt: null,
      truncated: false,
    }),
    revokeItem: async () => undefined,
    deleteUser: async () => undefined,
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
    // Default: no pre-existing local account → completeConnection's
    // already-synced guard passes. Refresh tests that need the lookup to
    // resolve override this to return an account (story 5-7 FIX 2026-05-28).
    findByProviderKey: async () => null,
    // Story 6-10 — distinct bank provider_ids for the logo warm-up/backfill.
    listProviderIds: async () => ["574"],
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
      lastSyncedAt: null,
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

// Story 5-7 FIX 2026-05-28, revised 2026-06-10 — the reconnect guard keys on the
// Bridge institution provider_id, NOT on account-key overlap. A re-connect makes
// a NEW item (findByProviderItemId null); reject ONLY when a non-revoked
// connection already serves the same institution (a genuine active duplicate).
test("completeConnection rejects when an ACTIVE connection for the same institution exists", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByProviderItemId = async () => null; // brand-new item_id
  // listAccounts stub reports providerId "574"; an active connection serves it.
  repo.findActiveByProviderId = async () => true;
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await expect(
    svc.completeConnection("u", "fred@x", { itemId: "new-item-99", userUuid: "bridge-uuid-1" }),
  ).rejects.toThrow(/already exists/i);
});

// Regression 2026-06-10 — revoke→reconnect. After a revoke the connection is
// soft-deleted but its accounts persist; the bank's only connection is revoked
// (findActiveByProviderId false). Reconnecting MUST succeed and re-use the
// orphaned accounts (idempotent find-or-create), not error "already linked".
test("completeConnection ALLOWS reconnect when no active connection serves the institution (revoke→reconnect)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByProviderItemId = async () => null; // brand-new item_id
  repo.findActiveByProviderId = async () => false; // only the revoked connection remains
  // The orphaned account from the revoked connection still matches by stable key,
  // but that no longer blocks the reconnect — it is re-used, not duplicated.
  accountsService.findByProviderKey = async () => ({
    id: "acc_orphan",
    userId: "u",
    label: "Bridge — SG — Courant",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  let relinked = 0;
  accountsService.findOrCreateAutoFromProvider = (async () => {
    relinked++;
    return {
      id: "acc_orphan",
      userId: "u",
      label: "Bridge — SG — Courant",
      type: "banque" as const,
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
    itemId: "new-item-99",
    userUuid: "bridge-uuid-1",
  });
  expect(result.provider).toBe("bridge"); // succeeded — no "already exists"
  expect(relinked).toBe(1); // orphaned account re-used, not duplicated
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
      lastSyncedAt: null,
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
      lastSyncedAt: null,
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
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listTransactions = async () => ({
    transactions: [
      {
        providerTransactionId: "tx-1",
        providerAccountId: "1",
        accountKey: "iban:FRTEST0001",
        occurredOn: new Date("2026-05-26"),
        amount: -10,
        label: "Carrefour",
        rawCategory: null,
        updatedAt: new Date("2026-05-26T10:00Z"),
      },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"),
    oldestUpdatedAt: new Date("2026-05-26T10:00Z"),
    truncated: false,
  });
  // resolveAccountIds maps the tx accountKey → a local account.
  accountsService.findByProviderKey = async () => ({
    id: "acc_x",
    userId: "u",
    label: "Bridge — SG — Courant",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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

// ───── quick-spec 2026-06-10 — last_synced_at decoupled from the cursor ────

test("refreshConnection stamps lastSyncedAt=now() on an EMPTY non-first poll, leaving the lastRefreshedAt cursor untouched (AC-2, AC-3)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const since = "2026-05-28T00:00:00.000Z";
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      // Cursor already set → this is a NON-first poll; an empty response must
      // NOT advance it (silent-data-loss defense).
      lastRefreshedAt: since,
      lastSyncedAt: since,
      createdAt: new Date().toISOString(),
    },
  });
  // Bridge returns nothing new since the cursor.
  provider.listTransactions = async () => ({
    transactions: [],
    latestUpdatedAt: null,
    oldestUpdatedAt: null,
    truncated: false,
  });
  let cursorStamp: Date | null = null;
  let syncStamp: Date | null = null;
  repo.setLastRefreshedAt = async (_u, _c, at) => {
    cursorStamp = at;
  };
  repo.setLastSyncedAt = async (_u, _c, at) => {
    syncStamp = at;
  };
  const fixedNow = new Date("2026-06-10T09:00:00.000Z");
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
    clock: () => fixedNow,
  });
  await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // The user-facing "last synced" advances to now() even with zero new rows…
  expect((syncStamp as Date | null)?.toISOString()).toBe("2026-06-10T09:00:00.000Z");
  // …while the incremental `since` cursor stays put (no data to anchor on).
  expect(cursorStamp).toBeNull();
});

test("refreshConnection does NOT stamp lastSyncedAt when the provider poll throws (AC-4)", async () => {
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
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listTransactions = async () => {
    throw new Error("bridge 503");
  };
  let syncCalled = false;
  repo.setLastSyncedAt = async () => {
    syncCalled = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await expect(svc.refreshConnection("u", { connectionId: "bnk_x" })).rejects.toThrow("bridge 503");
  expect(syncCalled).toBe(false);
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
        lastSyncedAt: null,
        createdAt: new Date().toISOString(),
      },
    };
  };
  provider.listTransactions = async () => ({
    transactions: [],
    latestUpdatedAt: null,
    oldestUpdatedAt: null,
    truncated: false,
  });
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
  repo.setStatus = async () => {
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

test("handleWebhookEvent on status_code=1010 flips sca_required via userId-scoped setStatus (AC-5 + ADR-0013)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  // Post-review aped-review: the webhook handler MUST resolve the owning
  // userId via findOwnersByProviderItemId, then call the userId-scoped
  // setStatus(userId, connectionId, ...) — never the cross-user mass-update
  // pattern that prior versions used.
  repo.findOwnersByProviderItemId = async (providerName, providerItemId) => {
    if (providerName === "bridge" && providerItemId === "42") {
      return [{ userId: "u", connectionId: "bnk_42" }];
    }
    return [];
  };
  const calledWith: {
    value: { userId: string; connectionId: string; status: string } | null;
  } = { value: null };
  repo.setStatus = async (userId, connectionId, status) => {
    calledWith.value = { userId, connectionId, status };
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
  expect(calledWith.value).toEqual({
    userId: "u",
    connectionId: "bnk_42",
    status: "sca_required",
  });
});

test("handleWebhookEvent on status_code=0 triggers transaction fetch for owners", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findOwnersByProviderItemId = async (providerName, providerItemId) => {
    if (providerName === "bridge" && providerItemId === "42") {
      return [{ userId: "u", connectionId: "bnk_x" }];
    }
    return [];
  };
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "42",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listTransactions = async () => ({
    transactions: [],
    latestUpdatedAt: null,
    oldestUpdatedAt: null,
    truncated: false,
  });
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

test("handleWebhookEvent coalesces concurrent deliveries for the same item (audit 2026-06-12 anti-concurrency)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findOwnersByProviderItemId = async (providerName, providerItemId) => {
    if (providerName === "bridge" && providerItemId === "42") {
      return [{ userId: "u", connectionId: "bnk_x" }];
    }
    return [];
  };
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "42",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  // Gate the refresh on a deferred promise so the first handler is still
  // in-flight when the second delivery arrives — exactly the Bridge re-delivery
  // race the async dispatch is meant to coalesce.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let importCalls = 0;
  provider.listTransactions = async () => {
    importCalls++;
    await gate;
    return {
      transactions: [],
      latestUpdatedAt: null,
      oldestUpdatedAt: null,
      truncated: false,
    };
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_x" }],
  });
  const first = svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 0 },
  });
  const second = svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 0 },
  });
  // Let both calls reach their await points before releasing the gate.
  await Promise.resolve();
  release();
  await Promise.all([first, second]);
  // The second delivery piggy-backed on the first's in-flight promise — the
  // expensive refresh fan-out ran exactly once, not twice.
  expect(importCalls).toBe(1);
});

test("handleWebhookEvent clears the in-flight guard after a run so the next delivery refreshes again", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findOwnersByProviderItemId = async () => [{ userId: "u", connectionId: "bnk_x" }];
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "42",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  let importCalls = 0;
  provider.listTransactions = async () => {
    importCalls++;
    return {
      transactions: [],
      latestUpdatedAt: null,
      oldestUpdatedAt: null,
      truncated: false,
    };
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_x" }],
  });
  // Two SEQUENTIAL deliveries (the first fully settled before the second) must
  // each run — the guard is cleared in a finally, never wedged.
  await svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 0 },
  });
  await svc.handleWebhookEvent({
    type: "item.refreshed",
    content: { item_id: 42, status_code: 0 },
  });
  expect(importCalls).toBe(2);
});

test("handleWebhookEvent on unknown status_code logs warning + no DB write (post-review)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let setStatusCalled = false;
  let findOwnersCalled = false;
  repo.setStatus = async () => {
    setStatusCalled = true;
  };
  repo.findOwnersByProviderItemId = async () => {
    findOwnersCalled = true;
    return [];
  };
  const warns: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warns.push(args.map(String).join(" "));
  try {
    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [],
    });
    await svc.handleWebhookEvent({
      type: "item.refreshed",
      content: { item_id: 99, status_code: 1003 }, // WRONG_CREDENTIALS — not 0/1010
    });
    expect(setStatusCalled).toBe(false);
    expect(findOwnersCalled).toBe(false);
    expect(warns.some((w) => w.includes("status_code=1003"))).toBe(true);
  } finally {
    console.warn = originalWarn;
  }
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

// ───── Story 5-7 (T4) — renameConnection + revokeConnection ───────────────

const baseConn = {
  id: "bnk_x",
  userId: "u",
  provider: "bridge" as const,
  providerItemId: "i",
  status: "active" as const,
  displayName: "SG",
  lastRefreshedAt: null,
  lastSyncedAt: null,
  createdAt: new Date().toISOString(),
};

test("renameConnection returns the updated DTO (AC-3)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.setDisplayName = async (_u, _id, displayName) => ({
    connection: { ...baseConn, displayName },
  });
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.renameConnection("u", "bnk_x", "Banque Pro");
  expect(out.displayName).toBe("Banque Pro");
});

test("renameConnection throws NOT_FOUND when setDisplayName returns null (AC-3)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.setDisplayName = async () => null;
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await expect(svc.renameConnection("u", "bnk_missing", "X")).rejects.toThrow(/not found/i);
});

test("revokeConnection calls provider.revokeItem then flips status to revoked (AC-4)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const calls: string[] = [];
  repo.findByIdForUser = async () => ({ connection: { ...baseConn, status: "active" } });
  repo.findProviderUserUuid = async () => "bridge-uuid";
  repo.setStatus = async (_u, _id, status) => {
    calls.push(`status:${status}`);
  };
  provider.revokeItem = async () => {
    calls.push("revokeItem");
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.revokeConnection("u", "bnk_x");
  expect(out).toEqual({ ok: true });
  // Order matters — Bridge revoke MUST succeed before the local soft-delete.
  expect(calls).toEqual(["revokeItem", "status:revoked"]);
});

test("revokeConnection is idempotent on an already-revoked connection (no Bridge call) (AC-4)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let revokeCalled = false;
  repo.findByIdForUser = async () => ({ connection: { ...baseConn, status: "revoked" } });
  provider.revokeItem = async () => {
    revokeCalled = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.revokeConnection("u", "bnk_x");
  expect(out).toEqual({ ok: true });
  expect(revokeCalled).toBe(false);
});

// ───── Story 6-10 (FR-65) — historical logo backfill ─────────────────────
test("backfillUserLogos warms the user's distinct provider labels (best-effort)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  transactionsService.listDistinctProviderLabels = async () => ["Cb Uber *eats", "Cb Naturalia"];
  const warmed: string[] = [];
  let warmedProviderIds: string[] = [];
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
    logos: {
      warmMany: async ({ labels = [], providerIds = [] }) => {
        warmed.push(...labels);
        warmedProviderIds = providerIds;
        return { merchants: labels.length, providers: providerIds.length };
      },
    },
  });
  const out = await svc.backfillUserLogos("u1");
  expect(warmed).toEqual(["Cb Uber *eats", "Cb Naturalia"]);
  // Bank tier is backfilled too — the original backfill warmed labels only
  // (aped-review 6-10); IBAN accounts depend on the stored provider_id.
  expect(warmedProviderIds).toEqual(["574"]);
  expect(out.merchants).toBe(2);
  expect(out.providers).toBe(1);
});

test("backfillUserLogos is a no-op when no logos port is wired", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  expect(await svc.backfillUserLogos("u1")).toEqual({ merchants: 0, providers: 0 });
});

// ───── Bug-fix 2026-06-12 (audit #1) — balances refreshed on every refresh ──
//
// refreshConnectionImpl must re-pull provider.listAccounts and feed each remote
// account (fresh balance) through findOrCreateAutoFromProvider so an existing
// account's cashBalance is UPDATED, not frozen at the day-1 value.
test("refreshConnection re-syncs account balances via findOrCreateAutoFromProvider (audit #1)", async () => {
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
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listAccounts = async () => [
    {
      providerAccountId: "1",
      accountKey: "iban:FRTEST0001",
      bankName: "SG",
      accountName: "Courant",
      kind: "checking",
      currency: "EUR",
      balance: 4242.42, // fresh balance from the provider
      providerId: "574",
    },
  ];
  provider.listTransactions = async () => ({
    transactions: [],
    latestUpdatedAt: null,
    oldestUpdatedAt: null,
    truncated: false,
  });
  const synced: Array<{ key: string; cashBalance: number | undefined }> = [];
  accountsService.findOrCreateAutoFromProvider = (async (
    _u: string,
    _p: string,
    providerAccountKey: string,
    input: { cashBalance?: number },
  ) => {
    synced.push({ key: providerAccountKey, cashBalance: input.cashBalance });
    return {
      id: "acc_x",
      userId: "u",
      label: "Bridge — SG — Courant",
      type: "banque" as const,
      currency: "EUR",
      cashBalance: input.cashBalance ?? 0,
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
  await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // The refresh fed the provider's fresh balance through find-or-create-or-update.
  expect(synced).toEqual([{ key: "iban:FRTEST0001", cashBalance: 4242.42 }]);
});

// ───── Bug-fix 2026-06-12 (audit #2) — new account on an existing item ──────
//
// A bank account opened AFTER the initial connect surfaces in the item's
// transactions. The refresh now auto-creates it (via listAccounts) BEFORE
// resolving transactions, so its transactions are imported (not skipped while
// the watermark silently advances → permanent loss).
test("refreshConnection auto-creates a NEW account on an existing item so its transactions are not lost (audit #2)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: "2026-05-01T00:00:00.000Z",
      lastSyncedAt: "2026-05-01T00:00:00.000Z",
      createdAt: new Date().toISOString(),
    },
  });
  // Provider now reports a SECOND account that didn't exist at connect time.
  provider.listAccounts = async () => [
    {
      providerAccountId: "1",
      accountKey: "iban:FROLD0001",
      bankName: "SG",
      accountName: "Courant",
      kind: "checking",
      currency: "EUR",
      balance: 100,
      providerId: "574",
    },
    {
      providerAccountId: "2",
      accountKey: "iban:FRNEW0002", // brand-new account
      bankName: "SG",
      accountName: "Livret",
      kind: "savings",
      currency: "EUR",
      balance: 5000,
      providerId: "574",
    },
  ];
  provider.listTransactions = async () => ({
    transactions: [
      {
        providerTransactionId: "tx-new",
        providerAccountId: "2",
        accountKey: "iban:FRNEW0002",
        occurredOn: new Date("2026-05-26"),
        amount: -10,
        label: "Carrefour",
        rawCategory: null,
        updatedAt: new Date("2026-05-26T10:00Z"),
      },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"),
    oldestUpdatedAt: new Date("2026-05-26T10:00Z"),
    truncated: false,
  });
  // Simulate the real find-or-create: the new account becomes resolvable after
  // findOrCreateAutoFromProvider runs for it. Keyed cache mirrors the repo.
  const created = new Set<string>();
  accountsService.findOrCreateAutoFromProvider = (async (_u: string, _p: string, key: string) => {
    created.add(key);
    return {
      id: `acc_${key}`,
      userId: "u",
      label: "x",
      type: "banque" as const,
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as AccountService["findOrCreateAutoFromProvider"];
  accountsService.findByProviderKey = (async (_u: string, _p: string, key: string) => {
    if (!created.has(key)) return null;
    return {
      id: `acc_${key}`,
      userId: "u",
      label: "x",
      type: "banque" as const,
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as AccountService["findByProviderKey"];
  let importedRows = 0;
  transactionsService.importFromProvider = async (_u, _p, rows) => {
    importedRows = rows.length;
    return { persisted: rows.length, skipped: 0 };
  };
  let cursorStamp: Date | null = null;
  repo.setLastRefreshedAt = async (_u, _c, at) => {
    cursorStamp = at;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // The new account was auto-created BEFORE transaction resolution…
  expect(created.has("iban:FRNEW0002")).toBe(true);
  // …so the transaction resolved and was imported (not skipped).
  expect(importedRows).toBe(1);
  expect(out.persisted).toBe(1);
  expect(out.fetched).toBe(1);
  // Watermark advances only because the row was actually imported.
  expect((cursorStamp as Date | null)?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

// ───── Bug-fix 2026-06-12 (audit #2b) — watermark ignores skipped rows ──────
//
// Defense in depth: if a transaction's account STILL cannot be resolved (a true
// anomaly), it is skipped — but the watermark must advance only to the max
// updated_at over the IMPORTED rows, never past the skipped one. Otherwise the
// skipped row sits above the cursor forever and is permanently lost.
test("refreshConnection advances the watermark only over imported rows, never skipped ones (audit #2b)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: "2026-05-01T00:00:00.000Z",
      lastSyncedAt: "2026-05-01T00:00:00.000Z",
      createdAt: new Date().toISOString(),
    },
  });
  // listAccounts only knows the resolvable account; the orphan key is never
  // creatable (simulates a transient Bridge orphan id, the FIX12 anomaly).
  provider.listAccounts = async () => [
    {
      providerAccountId: "1",
      accountKey: "iban:FRGOOD",
      bankName: "SG",
      accountName: "Courant",
      kind: "checking",
      currency: "EUR",
      balance: 100,
      providerId: "574",
    },
  ];
  provider.listTransactions = async () => ({
    transactions: [
      {
        providerTransactionId: "tx-good",
        providerAccountId: "1",
        accountKey: "iban:FRGOOD",
        occurredOn: new Date("2026-05-20"),
        amount: -10,
        label: "Good",
        rawCategory: null,
        updatedAt: new Date("2026-05-20T10:00Z"), // OLDER → the imported row
      },
      {
        providerTransactionId: "tx-orphan",
        providerAccountId: "999",
        accountKey: "iban:FRORPHAN", // never resolvable → skipped
        occurredOn: new Date("2026-05-26"),
        amount: -20,
        label: "Orphan",
        rawCategory: null,
        updatedAt: new Date("2026-05-26T10:00Z"), // NEWER → must NOT set the cursor
      },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"), // provider's raw max (includes orphan)
    oldestUpdatedAt: new Date("2026-05-20T10:00Z"),
    truncated: false,
  });
  // Only FRGOOD resolves; FRORPHAN stays unknown (findByProviderKey → null).
  accountsService.findOrCreateAutoFromProvider = (async () => ({
    id: "acc_good",
    userId: "u",
    label: "x",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as AccountService["findOrCreateAutoFromProvider"];
  accountsService.findByProviderKey = (async (_u: string, _p: string, key: string) => {
    if (key === "iban:FRGOOD") {
      return {
        id: "acc_good",
        userId: "u",
        label: "x",
        type: "banque" as const,
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }) as AccountService["findByProviderKey"];
  transactionsService.importFromProvider = async (_u, _p, rows) => ({
    persisted: rows.length,
    skipped: 0,
  });
  let cursorStamp: Date | null = null;
  repo.setLastRefreshedAt = async (_u, _c, at) => {
    cursorStamp = at;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // The cursor stops at the IMPORTED row's updated_at (10:00 on the 20th), NOT
  // the skipped orphan's newer 10:00 on the 26th — the orphan is re-windowed
  // next tick rather than stranded above the watermark.
  expect((cursorStamp as Date | null)?.toISOString()).toBe("2026-05-20T10:00:00.000Z");
});

// ───── Bug-fix 2026-06-12 (audit #3) — truncation drained, no silent gap ────
//
// A history longer than the client's per-tick page cap returns truncated:true
// for the first slice. The service drains the remaining slice(s) within the
// tick via `until = oldestUpdatedAt`, imports EVERY row, and advances the
// watermark to the GLOBAL newest only once the window is fully drained.
test("refreshConnection drains a truncated history across slices, importing every row (audit #3)", async () => {
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
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  provider.listAccounts = async () => [
    {
      providerAccountId: "1",
      accountKey: "iban:FRTEST0001",
      bankName: "SG",
      accountName: "Courant",
      kind: "checking",
      currency: "EUR",
      balance: 100,
      providerId: "574",
    },
  ];
  accountsService.findByProviderKey = async () => ({
    id: "acc_x",
    userId: "u",
    label: "x",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Slice 1 = newest, truncated:true. Slice 2 (until = slice-1 floor) = older,
  // truncated:false. Assert the service passes the right `until` and merges.
  const calls: Array<{ until: Date | null | undefined }> = [];
  provider.listTransactions = async ({ until }) => {
    calls.push({ until });
    if (!until) {
      return {
        transactions: [
          {
            providerTransactionId: "tx-new",
            providerAccountId: "1",
            accountKey: "iban:FRTEST0001",
            occurredOn: new Date("2026-05-26"),
            amount: -10,
            label: "New",
            rawCategory: null,
            updatedAt: new Date("2026-05-26T10:00Z"),
          },
        ],
        latestUpdatedAt: new Date("2026-05-26T10:00Z"),
        oldestUpdatedAt: new Date("2026-05-26T08:00Z"),
        truncated: true,
      };
    }
    return {
      transactions: [
        {
          providerTransactionId: "tx-old",
          providerAccountId: "1",
          accountKey: "iban:FRTEST0001",
          occurredOn: new Date("2026-05-20"),
          amount: -5,
          label: "Old",
          rawCategory: null,
          updatedAt: new Date("2026-05-20T10:00Z"),
        },
      ],
      latestUpdatedAt: new Date("2026-05-20T10:00Z"),
      oldestUpdatedAt: new Date("2026-05-20T10:00Z"),
      truncated: false,
    };
  };
  let importedRows = 0;
  transactionsService.importFromProvider = async (_u, _p, rows) => {
    importedRows = rows.length;
    return { persisted: rows.length, skipped: 0 };
  };
  let cursorStamp: Date | null = null;
  repo.setLastRefreshedAt = async (_u, _c, at) => {
    cursorStamp = at;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // Two slices: first unbounded, second resumed at the first slice's floor.
  expect(calls.length).toBe(2);
  expect(calls[0]?.until ?? null).toBeNull();
  expect((calls[1]?.until as Date | undefined)?.toISOString()).toBe("2026-05-26T08:00:00.000Z");
  // Both rows imported — nothing dropped at the page cap.
  expect(importedRows).toBe(2);
  expect(out.fetched).toBe(2);
  // Window fully drained → cursor advances to the GLOBAL newest (slice-1 latest).
  expect((cursorStamp as Date | null)?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

// Audit #3 — when the per-tick slice budget is exhausted while the window is
// STILL truncated, the watermark must NOT advance (otherwise the un-drained
// older rows are abandoned). The next tick re-windows from the same `since`.
test("refreshConnection does NOT advance the watermark while the window is still truncated (audit #3)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const since = "2026-05-01T00:00:00.000Z";
  repo.findByIdForUser = async () => ({
    connection: {
      id: "bnk_x",
      userId: "u",
      provider: "bridge",
      providerItemId: "i",
      status: "active",
      displayName: null,
      lastRefreshedAt: since,
      lastSyncedAt: since,
      createdAt: new Date().toISOString(),
    },
  });
  accountsService.findByProviderKey = async () => ({
    id: "acc_x",
    userId: "u",
    label: "x",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Pathological: every slice reports truncated:true with a STRICTLY decreasing
  // floor. The service's MAX_SLICES guard stops it; because it never drained,
  // the watermark stays put so the next tick resumes from `since`.
  let tick = 0;
  provider.listTransactions = async () => {
    tick += 1;
    const floorMs = Date.parse("2026-05-26T10:00:00.000Z") - tick * 60_000;
    return {
      transactions: [
        {
          providerTransactionId: `tx-${tick}`,
          providerAccountId: "1",
          accountKey: "iban:FRTEST0001",
          occurredOn: new Date("2026-05-26"),
          amount: -1,
          label: "X",
          rawCategory: null,
          updatedAt: new Date(floorMs),
        },
      ],
      latestUpdatedAt: new Date("2026-05-26T10:00:00.000Z"),
      oldestUpdatedAt: new Date(floorMs),
      truncated: true, // never finishes
    };
  };
  transactionsService.importFromProvider = async (_u, _p, rows) => ({
    persisted: rows.length,
    skipped: 0,
  });
  let cursorStamped = false;
  repo.setLastRefreshedAt = async () => {
    cursorStamped = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });
  const out = await svc.refreshConnection("u", { connectionId: "bnk_x" });
  // Bounded — the MAX_SLICES guard stopped the drain (no infinite re-fetch).
  expect(tick).toBeLessThanOrEqual(50);
  expect(tick).toBeGreaterThan(1);
  // Watermark untouched → the next tick re-windows from the same `since`.
  expect(cursorStamped).toBe(false);
  // The DTO still reports the cursor unchanged (the original `since`).
  expect(out.lastRefreshedAt).toBe(since);
});

// ───── Story 11-2 (AC-6) — erase the user at the bank provider ──────────
// AC-6 (verbatim from story 11-2-account-deletion:19):
//   Given a user holding at least one Bridge bank connection, When they delete
//   their account, Then the Bridge user is deleted at the provider
//   (`DELETE /v3/aggregation/users/{uuid}`) before any local row is removed.
//   And given that provider call fails, Then no local row is deleted, the
//   Supabase Auth user is untouched, and the caller receives a
//   `BANK_PROVIDER_UNAVAILABLE` error.

const ERASE_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// listByUser returns full BankConnection DTOs (@pekulo/validators), so the
// fixtures below carry every field rather than a convenient subset.
function connectionFixture(id: string, providerItemId: string, status: "active" | "revoked") {
  return {
    id,
    userId: ERASE_USER,
    provider: "bridge" as const,
    providerItemId,
    status,
    displayName: "SG",
    lastRefreshedAt: null,
    lastSyncedAt: null,
    createdAt: new Date().toISOString(),
  };
}

test("eraseUserAtProvider: revokes each non-revoked item, then deletes the Bridge user", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const order: string[] = [];
  repo.findProviderUserUuid = async () => "bridge-uuid-1";
  repo.listByUser = async () => [
    connectionFixture("bnk_1", "item-1", "active"),
    connectionFixture("bnk_2", "item-2", "revoked"),
    connectionFixture("bnk_3", "item-3", "active"),
  ];
  provider.revokeItem = async ({ providerItemId }) => {
    order.push(`revoke:${providerItemId}`);
  };
  provider.deleteUser = async ({ userUuid }) => {
    order.push(`deleteUser:${userUuid}`);
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });

  const result = await svc.eraseUserAtProvider(ERASE_USER);

  // The already-revoked connection is skipped; deleteUser always comes last.
  expect(order).toEqual(["revoke:item-1", "revoke:item-3", "deleteUser:bridge-uuid-1"]);
  expect(result).toEqual({ itemsRevoked: 2, providerUserDeleted: true });
});

test("eraseUserAtProvider: no-op when the user was never mapped to Bridge", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let called = false;
  repo.findProviderUserUuid = async () => null;
  repo.listByUser = async () => [];
  provider.deleteUser = async () => {
    called = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });

  expect(await svc.eraseUserAtProvider(ERASE_USER)).toEqual({
    itemsRevoked: 0,
    providerUserDeleted: false,
  });
  expect(called).toBe(false);
});

test("eraseUserAtProvider: a failing per-item revoke does NOT block deleteUser", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  let deleted = false;
  repo.findProviderUserUuid = async () => "bridge-uuid-1";
  repo.listByUser = async () => [connectionFixture("bnk_1", "item-1", "active")];
  provider.revokeItem = async () => {
    // Bridge mints a fresh item_id on every connect, so a stale local row can
    // reference an item that no longer exists and answer 404.
    throw new Error("bank provider unavailable: bridge DELETE /v3/aggregation/items/item-1 → 404");
  };
  provider.deleteUser = async () => {
    deleted = true;
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });

  expect(await svc.eraseUserAtProvider(ERASE_USER)).toEqual({
    itemsRevoked: 0,
    providerUserDeleted: true,
  });
  expect(deleted).toBe(true);
});

test("eraseUserAtProvider: the revoke pass stops at the wall-clock budget, deleteUser still runs", async () => {
  // aped-review 11-2 (NFR-7). Each revokeItem can take up to two Bridge
  // round-trips on a degraded provider and the loop is one per connection —
  // unbounded by itself. Past the budget no NEW revoke starts; the erasure
  // moves on to deleteUser, which removes every item regardless.
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  const order: string[] = [];
  repo.findProviderUserUuid = async () => "bridge-uuid-1";
  repo.listByUser = async () => [
    connectionFixture("bnk_1", "item-1", "active"),
    connectionFixture("bnk_2", "item-2", "active"),
    connectionFixture("bnk_3", "item-3", "active"),
  ];
  provider.revokeItem = async ({ providerItemId }) => {
    await new Promise((r) => setTimeout(r, 40));
    order.push(`revoke:${providerItemId}`);
  };
  provider.deleteUser = async ({ userUuid }) => {
    order.push(`deleteUser:${userUuid}`);
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
    erasureRevokeBudgetMs: 60,
  });

  const result = await svc.eraseUserAtProvider(ERASE_USER);

  // 40 ms per item, 60 ms budget: the first completes, the second is in
  // flight when the budget expires, the third is never started.
  expect(result.providerUserDeleted).toBe(true);
  expect(result.itemsRevoked).toBeLessThan(3);
  expect(order[order.length - 1]).toBe("deleteUser:bridge-uuid-1");
  await new Promise((r) => setTimeout(r, 100));
  expect(order).not.toContain("revoke:item-3");
});

test("eraseUserAtProvider: a failing deleteUser propagates — the caller is fail-closed", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findProviderUserUuid = async () => "bridge-uuid-1";
  repo.listByUser = async () => [];
  provider.deleteUser = async () => {
    throw new Error("bank provider unavailable: bridge DELETE /v3/aggregation/users/x → 500");
  };
  const svc = createBankAggregatorService({
    repository: repo,
    provider,
    transactionsService,
    accountsService,
    listAllActiveConnections: async () => [],
  });

  expect(svc.eraseUserAtProvider(ERASE_USER)).rejects.toThrow("bank provider unavailable");
});
