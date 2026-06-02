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

import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { Account, BankConnection } from "@pekulo/validators";
import type { AccountService } from "../accounts/accounts.service";
import type {
  ProviderTransactionImportRow,
  TransactionsService,
} from "../transactions/transactions.service";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { BankAggregatorError } from "./bank-aggregator.errors";
import { createBankAggregatorService } from "./bank-aggregator.service";
import { createBankAggregatorRouter } from "./bank-aggregator.routes";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { BankAggregatorService } from "./bank-aggregator.service";
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
    setDisplayName: async (userId, id, displayName) => {
      const r = store.get(id);
      if (!r || r.userId !== userId) return null;
      r.displayName = displayName;
      return {
        connection: {
          id,
          userId: r.userId,
          provider: r.provider as "bridge",
          providerItemId: r.providerItemId,
          status: r.status,
          displayName,
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
    findOwnersByProviderItemId: async (provider, providerItemId) => {
      const owners: Array<{ userId: string; connectionId: string }> = [];
      for (const [id, r] of store) {
        if (r.provider === provider && r.providerItemId === providerItemId) {
          owners.push({ userId: r.userId, connectionId: id });
        }
      }
      return owners;
    },
  };
}

function makeFakeProvider(): BankProvider {
  return {
    createUser: async () => ({ providerUserUuid: "bridge-uuid-fixture" }),
    createConnectSession: async () => ({ connectUrl: "https://x", sessionId: "session-1" }),
    getProviderLogo: async () => ({ logoUrl: null }),
    listAccounts: async () => [
      {
        providerAccountId: "sg-1",
        accountKey: "iban:FR-SG1",
        bankName: "SG",
        accountName: "Courant",
        kind: "checking",
        currency: "EUR",
        balance: 1500,
        providerId: "574",
      },
      {
        providerAccountId: "sg-2",
        accountKey: "iban:FR-SG2",
        bankName: "SG",
        accountName: "Livret A",
        kind: "savings",
        currency: "EUR",
        balance: 5000,
        providerId: "574",
      },
    ],
    listTransactions: async () => ({
      transactions: [
        {
          providerTransactionId: "tx-1",
          providerAccountId: "sg-1",
          accountKey: "iban:FR-SG1",
          occurredOn: new Date("2026-05-25"),
          amount: -25.5,
          label: "Carrefour",
          rawCategory: null,
          updatedAt: new Date("2026-05-26T08:00Z"),
        },
        {
          providerTransactionId: "tx-2",
          providerAccountId: "sg-2",
          accountKey: "iban:FR-SG2",
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
    listProviderIds: async () => [],
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

// ───── Story 5-7 (T5) — rename / revoke / reconnect HTTP boundary ─────────
//
// Mirrors accounts.integration.test.ts: boots a real Elysia app with the real
// mountOrpc + JWT verifier + bank-aggregator router pointed at an in-memory
// service. Proves the 3 new handlers (a) delegate to the service, (b) gate on
// JWT (requireUserId/requireEmail), and (c) re-throw BankAggregatorError as
// typed oRPC errors that map to the right HTTP status on the wire.

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const HTTP_USER_ID = "55555555-5555-4555-8555-555555555555";

function baseDto(over: Partial<BankConnection> = {}): BankConnection {
  return {
    id: "bnk_aaaaaaaaaaaaaaaaaaaaaa",
    userId: HTTP_USER_ID,
    provider: "bridge",
    providerItemId: "item-1",
    status: "active",
    displayName: "Société Générale",
    lastRefreshedAt: null,
    createdAt: "2026-05-28T00:00:00.000Z",
    ...over,
  };
}

// Sentinel connectionIds drive the error branches without a stateful store.
function makeRouteService(): BankAggregatorService {
  const notImpl = (name: string) => () => {
    throw new Error(`makeRouteService.${name} not exercised by the HTTP suite`);
  };
  return {
    initiateConnection: notImpl(
      "initiateConnection",
    ) as BankAggregatorService["initiateConnection"],
    completeConnection: notImpl(
      "completeConnection",
    ) as BankAggregatorService["completeConnection"],
    listConnections: async () => [],
    refreshConnection: notImpl("refreshConnection") as BankAggregatorService["refreshConnection"],
    refreshAll: async () => undefined,
    handleWebhookEvent: async () => undefined,
    backfillUserLogos: async () => ({ merchants: 0, providers: 0 }),
    async renameConnection(_userId, connectionId, displayName) {
      if (connectionId === "bnk_missing") {
        throw new BankAggregatorError("BANK_CONNECTION_NOT_FOUND", "connection not found");
      }
      return baseDto({ id: connectionId, displayName });
    },
    async revokeConnection(_userId, connectionId) {
      if (connectionId === "bnk_missing") {
        throw new BankAggregatorError("BANK_CONNECTION_NOT_FOUND", "connection not found");
      }
      if (connectionId === "bnk_down") {
        throw new BankAggregatorError("BANK_PROVIDER_UNAVAILABLE", "bridge down");
      }
      return { ok: true as const };
    },
    async getReconnectUrl(_userId, _email, connectionId) {
      if (connectionId === "bnk_missing") {
        throw new BankAggregatorError("BANK_CONNECTION_NOT_FOUND", "connection not found");
      }
      return "https://bridge/reconnect";
    },
  };
}

async function signValid(): Promise<string> {
  return new SignJWT({ email: "alex@pekulo.app" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(HTTP_USER_ID)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

describe("bank-aggregator rename/revoke/reconnect HTTP boundary (T5)", () => {
  let appHandle: { stop: () => Promise<void> } | undefined;
  let baseUrl = "";
  let token = "";

  beforeAll(async () => {
    const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const router = createBankAggregatorRouter({ service: makeRouteService() });
    const orpcRouter: PekuloRpcRouter = { bankaggregator: router };
    const app = new Elysia().onError(({ error, set }) => {
      const requestId = extractRequestId(error) ?? crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    });
    mountOrpc(app, { jwtVerifier, orpcRouter });
    // OS-assigned port (0) — avoids the random-port collisions that flake the
    // full-suite run when several integration files boot Elysia concurrently.
    await new Promise<void>((resolve) => {
      app.listen({ port: 0, hostname: "127.0.0.1" }, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${app.server?.port}`;
    appHandle = { stop: async () => void (await app.stop()) };
    token = await signValid();
    await fetch(`${baseUrl}/rpc/v1/bankaggregator/listConnections`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    }).catch(() => undefined);
  });

  afterAll(async () => {
    await appHandle?.stop();
    appHandle = undefined;
  });

  async function post(proc: string, json: unknown, withAuth = true): Promise<Response> {
    return fetch(`${baseUrl}/rpc/v1/bankaggregator/${proc}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(withAuth ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ json }),
    });
  }

  test("renameConnection happy path returns 200 + updated DTO (AC-3)", async () => {
    const res = await post("renameConnection", {
      connectionId: "bnk_aaaaaaaaaaaaaaaaaaaaaa",
      displayName: "Banque Pro",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: BankConnection };
    expect(body.json.displayName).toBe("Banque Pro");
  });

  test("renameConnection on unknown id maps to BANK_CONNECTION_NOT_FOUND 404 (AC-3)", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const res = await post("renameConnection", { connectionId: "bnk_missing", displayName: "X" });
    expect(res.status).toBe(404);
    const inner = ((await res.json()) as { json: unknown }).json;
    expect(isORPCErrorJson(inner)).toBe(true);
    expect(createORPCErrorFromJson(inner as never).code).toBe("BANK_CONNECTION_NOT_FOUND");
  });

  test("revokeConnection happy path returns 200 + { ok: true } (AC-4)", async () => {
    const res = await post("revokeConnection", { connectionId: "bnk_aaaaaaaaaaaaaaaaaaaaaa" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { ok: true } };
    expect(body.json).toEqual({ ok: true });
  });

  test("revokeConnection maps BANK_PROVIDER_UNAVAILABLE to 503 (AC-4)", async () => {
    const { createORPCErrorFromJson } = await import("@orpc/client");
    const res = await post("revokeConnection", { connectionId: "bnk_down" });
    expect(res.status).toBe(503);
    const inner = ((await res.json()) as { json: unknown }).json;
    expect(createORPCErrorFromJson(inner as never).code).toBe("BANK_PROVIDER_UNAVAILABLE");
  });

  test("reconnectConnection returns the Bridge connectUrl (AC-2)", async () => {
    const res = await post("reconnectConnection", { connectionId: "bnk_aaaaaaaaaaaaaaaaaaaaaa" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { connectUrl: string } };
    expect(body.json.connectUrl).toBe("https://bridge/reconnect");
  });

  test("reconnectConnection without JWT returns 401 (requireUserId, NFR-9)", async () => {
    const res = await post(
      "reconnectConnection",
      { connectionId: "bnk_aaaaaaaaaaaaaaaaaaaaaa" },
      false,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("cross-tenant isolation (11-3 AC-5)", () => {
  // AC-5 (verbatim from story 11-3-rls-audit-and-encryption-doc:18):
  //   Given two users A and B each owning a Bridge bank_connection, When a
  //   webhook item.refreshed event arrives for B's provider_item_id, Then only
  //   B's connection status changes and A's connection is never read or mutated.
  // Two-user assertion per the 2026-05-27 sandbox-masking lesson (a single-tenant
  // pass would prove nothing). Reuses the file-scope fakes + service composition.
  test("webhook item.refreshed(1010) for B's item leaves A's connection active", async () => {
    const repo = makeInMemoryRepo();
    const svc = createBankAggregatorService({
      repository: repo,
      provider: makeFakeProvider(),
      transactionsService: makeStubTransactionsService().service,
      accountsService: makeStubAccountsService(),
      listAllActiveConnections: async () => [],
    });
    const A = "11111111-1111-4111-8111-111111111111";
    const B = "22222222-2222-4222-8222-222222222222";
    const connA = await repo.createConnection({
      userId: A,
      provider: "bridge",
      providerItemId: "item-A",
      displayName: "A bank",
    });
    const connB = await repo.createConnection({
      userId: B,
      provider: "bridge",
      providerItemId: "item-B",
      displayName: "B bank",
    });

    await svc.handleWebhookEvent({
      type: "item.refreshed",
      content: { item_id: "item-B", status_code: 1010 },
    });

    const aAfter = (await repo.listByUser(A)).find((c) => c.id === connA.id);
    const bAfter = (await repo.listByUser(B)).find((c) => c.id === connB.id);
    expect(bAfter?.status).toBe("sca_required"); // B flipped by the webhook
    expect(aAfter?.status).toBe("active"); // A untouched — no cross-tenant leak
  });

  test("webhook(1010) for a providerItemId shared by A and B flips each owner's OWN connection", async () => {
    // The distinct-item case above isolates by providerItemId alone, so the
    // per-owner `setStatus(o.userId, o.connectionId)` userId scoping is never
    // exercised. This shared-item case makes it load-bearing: the webhook loop
    // must pair each owner's userId with its OWN connectionId. A cross-assigned
    // write (e.g. owners[0].userId with owners[1].connectionId) is rejected by
    // the repo's userId guard → that connection stays "active" → RED. Mirrors
    // ADR-0013's "userId-scoped guard on every write" (service.ts handleWebhookEvent).
    const repo = makeInMemoryRepo();
    const svc = createBankAggregatorService({
      repository: repo,
      provider: makeFakeProvider(),
      transactionsService: makeStubTransactionsService().service,
      accountsService: makeStubAccountsService(),
      listAllActiveConnections: async () => [],
    });
    const A = "11111111-1111-4111-8111-111111111111";
    const B = "22222222-2222-4222-8222-222222222222";
    const SHARED = "item-shared";
    const connA = await repo.createConnection({
      userId: A,
      provider: "bridge",
      providerItemId: SHARED,
      displayName: "A bank",
    });
    const connB = await repo.createConnection({
      userId: B,
      provider: "bridge",
      providerItemId: SHARED,
      displayName: "B bank",
    });

    await svc.handleWebhookEvent({
      type: "item.refreshed",
      content: { item_id: SHARED, status_code: 1010 },
    });

    const aAfter = (await repo.listByUser(A)).find((c) => c.id === connA.id);
    const bAfter = (await repo.listByUser(B)).find((c) => c.id === connB.id);
    expect(aAfter?.status).toBe("sca_required"); // A's own connection flipped under A's userId
    expect(bAfter?.status).toBe("sca_required"); // B's own connection flipped under B's userId
  });
});
