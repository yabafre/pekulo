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
    setDisplayName: async () => null,
    findByProviderItemId: async () => null,
    setStatus: async () => undefined,
    setLastRefreshedAt: async () => undefined,
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

// Story 5-7 FIX 2026-05-28 — already-synced guard. A re-connect creates a NEW
// Bridge item (findByProviderItemId null) but its accounts already exist
// locally by stable key → reject instead of duplicating accounts.
test("completeConnection rejects when the bank is already synced (account-key overlap)", async () => {
  const { repo, provider, transactionsService, accountsService } = makeStubs();
  repo.findByProviderItemId = async () => null; // brand-new item_id
  accountsService.findByProviderKey = async () => ({
    id: "acc_existing",
    userId: "u",
    label: "Bridge — SG — Courant",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
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
        accountKey: "iban:FRTEST0001",
        occurredOn: new Date("2026-05-26"),
        amount: -10,
        label: "Carrefour",
        rawCategory: null,
        updatedAt: new Date("2026-05-26T10:00Z"),
      },
    ],
    latestUpdatedAt: new Date("2026-05-26T10:00Z"),
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
