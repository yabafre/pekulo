// AC-1 / AC-2 / AC-5 (verbatim from story 5-6-bridge-connector):
//   AC-1 — completeConnection persists a BankConnection row from a valid Bridge
//          OAuth callback (?code + ?state). The provider exchangeCode delivers
//          the token pair + providerItemId.
//   AC-2 — refreshConnection fetches transactions via since=<ISO> dedup.
//   AC-5 — getItem returns the current item state for SCA-skip logic.
//
// Tests use a globalThis.fetch mock — no real Bridge calls. Synthetic env keys.

import { test, expect, beforeAll, afterAll, mock } from "bun:test";
import type { Env } from "../../../config/env";
import { createBridgeProvider } from "./bridge-client";

const env = {
  BRIDGE_API_BASE: "https://api.bridgeapi.io",
  BRIDGE_API_VERSION: "2025-01-15",
  BRIDGE_CLIENT_ID: "fake-client",
  BRIDGE_CLIENT_SECRET: "fake-secret",
} as unknown as Env;

const originalFetch = globalThis.fetch;

const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
  const u =
    typeof url === "string"
      ? new URL(url)
      : url instanceof URL
        ? url
        : new URL((url as Request).url);
  const path = u.pathname;
  if (path === "/v3/aggregation/connect-sessions") {
    return new Response(
      JSON.stringify({ id: "session-1", url: "https://connect.bridgeapi.io/session/1" }),
      { status: 200 },
    );
  }
  if (path === "/v3/aggregation/authorization/token") {
    return new Response(
      JSON.stringify({
        access_token: "a",
        refresh_token: "r",
        item_id: 42,
        expires_at: "2026-08-25T00:00:00Z",
      }),
      { status: 200 },
    );
  }
  if (path === "/v3/aggregation/accounts") {
    return new Response(
      JSON.stringify({
        resources: [
          {
            id: 11,
            name: "Compte courant SG",
            balance: 1234.56,
            type: "checking",
            currency_code: "EUR",
          },
          {
            id: 12,
            name: "Livret A",
            balance: 5000,
            type: "savings",
            currency_code: "EUR",
          },
        ],
      }),
      { status: 200 },
    );
  }
  if (path === "/v3/aggregation/users") {
    if (init?.method === "POST") {
      return new Response(
        JSON.stringify({ uuid: "bridge-uuid-fresh", external_user_id: "u-pekulo" }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        resources: [{ uuid: "bridge-uuid-existing", external_user_id: "u-pekulo" }],
      }),
      { status: 200 },
    );
  }
  // Items endpoint covers both GET (state) and DELETE (revoke).
  if (path.startsWith("/v3/aggregation/items/")) {
    if (init?.method === "DELETE") {
      return new Response("{}", { status: 200 });
    }
    return new Response(
      JSON.stringify({
        id: 42,
        status_code: 0,
        status_code_info: "ok",
        authentication_expires_at: "2026-08-25T00:00:00Z",
      }),
      { status: 200 },
    );
  }
  if (path.endsWith("/transactions")) {
    return new Response(
      JSON.stringify({
        resources: [
          {
            id: 1,
            account_id: 2,
            amount: -25.5,
            clean_description: "CB Carrefour",
            provider_description: "PAIEMENT CB CARREFOUR 1234",
            category_id: 100,
            date: "2026-05-26",
            updated_at: "2026-05-26T10:00:00Z",
          },
        ],
      }),
      { status: 200 },
    );
  }
  return new Response("", { status: 404 });
});

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  fetchMock.mockClear();
});

test("createConnectSession returns connectUrl + sessionId", async () => {
  const p = createBridgeProvider({ env });
  const session = await p.createConnectSession({
    userUuid: "bridge-user-uuid-1",
    userEmail: "fred@x",
  });
  expect(session.connectUrl).toContain("connect.bridgeapi.io");
  expect(session.sessionId).toBe("session-1");
});

test("listTransactions mints user-Bearer + maps clean_description as label (incomplete-mock fix)", async () => {
  const p = createBridgeProvider({ env });
  const { transactions, latestUpdatedAt } = await p.listTransactions({
    userUuid: "bridge-user-uuid-1",
    providerItemId: "42",
    since: null,
  });
  expect(transactions.length).toBe(1);
  expect(transactions[0]?.amount).toBe(-25.5);
  // Post-review aped-review (anti-pattern 4 fix): asserts the v3 field name
  // is read, not the stale pre-v3 `description`.
  expect(transactions[0]?.label).toBe("CB Carrefour");
  expect(latestUpdatedAt?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

test("listAccounts maps Bridge v3 flat-REST response → ProviderBankAccount[]", async () => {
  const p = createBridgeProvider({ env });
  const accounts = await p.listAccounts({
    userUuid: "bridge-user-uuid-1",
    providerItemId: "42",
  });
  expect(accounts).toHaveLength(2);
  expect(accounts[0]).toMatchObject({
    providerAccountId: "11",
    accountName: "Compte courant SG",
    kind: "checking",
    currency: "EUR",
    balance: 1234.56,
  });
  expect(accounts[1]?.kind).toBe("savings");
});

test("revokeItem fires DELETE against /v3/aggregation/items/<id>", async () => {
  const p = createBridgeProvider({ env });
  await p.revokeItem({ userUuid: "bridge-user-uuid-1", providerItemId: "42" });
  const seenUrls = fetchMock.mock.calls.map((c) => String(c[0]));
  expect(seenUrls.some((u) => u.endsWith("/v3/aggregation/items/42"))).toBe(true);
});

test("getItem returns status_code + authentication_expires_at for SCA decisions (AC-5)", async () => {
  const p = createBridgeProvider({ env });
  const state = await p.getItem({ userUuid: "bridge-user-uuid-1", providerItemId: "42" });
  expect(state.statusCode).toBe(0);
  expect(state.statusMessage).toBe("ok");
  expect(state.authenticationExpiresAt?.toISOString()).toBe("2026-08-25T00:00:00.000Z");
});

test("createUser is idempotent on Bridge HTTP 409 (existing user)", async () => {
  // Override the fetchMock just for this test — 409 path with list filter
  // fallback recovers the existing uuid.
  const localFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const u =
      typeof url === "string"
        ? new URL(url)
        : url instanceof URL
          ? url
          : new URL((url as Request).url);
    if (u.pathname === "/v3/aggregation/users") {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ message: "user already exists" }), { status: 409 });
      }
      return new Response(
        JSON.stringify({
          resources: [{ uuid: "bridge-uuid-existing", external_user_id: "u-pekulo" }],
        }),
        { status: 200 },
      );
    }
    return new Response("", { status: 404 });
  });
  const prev = globalThis.fetch;
  globalThis.fetch = localFetch as unknown as typeof fetch;
  try {
    const p = createBridgeProvider({ env });
    const r = await p.createUser({ externalUserId: "u-pekulo" });
    expect(r.providerUserUuid).toBe("bridge-uuid-existing");
  } finally {
    globalThis.fetch = prev;
  }
});

test("createBridgeProvider throws bank-provider-unavailable when CLIENT_ID missing", async () => {
  const noEnv = { ...env, BRIDGE_CLIENT_ID: undefined } as unknown as Env;
  const p = createBridgeProvider({ env: noEnv });
  await expect(p.createConnectSession({ userUuid: "x", userEmail: "y@z" })).rejects.toThrow(
    /not configured/i,
  );
});
