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

const fetchMock = mock(async (url: string | URL | Request) => {
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
  if (path.endsWith("/transactions")) {
    return new Response(
      JSON.stringify({
        resources: [
          {
            id: 1,
            account_id: 2,
            amount: -25.5,
            description: "Carrefour",
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

test("exchangeCode returns providerItemId + tokens", async () => {
  const p = createBridgeProvider({ env });
  const { providerItemId, tokens } = await p.exchangeCode({ code: "c", state: "s" });
  expect(providerItemId).toBe("42");
  expect(tokens.accessToken).toBe("a");
  expect(tokens.refreshToken).toBe("r");
  expect(tokens.expiresAt?.toISOString()).toBe("2026-08-25T00:00:00.000Z");
});

test("listTransactions returns rows + latestUpdatedAt", async () => {
  const p = createBridgeProvider({ env });
  const { transactions, latestUpdatedAt } = await p.listTransactions({
    tokens: { accessToken: "a", refreshToken: "r", expiresAt: null },
    providerItemId: "42",
    since: null,
  });
  expect(transactions.length).toBe(1);
  expect(transactions[0]?.amount).toBe(-25.5);
  expect(latestUpdatedAt?.toISOString()).toBe("2026-05-26T10:00:00.000Z");
});

test("createBridgeProvider throws bank-provider-unavailable when CLIENT_ID missing", async () => {
  const noEnv = { ...env, BRIDGE_CLIENT_ID: undefined } as unknown as Env;
  const p = createBridgeProvider({ env: noEnv });
  await expect(p.createConnectSession({ userUuid: "x", userEmail: "y@z" })).rejects.toThrow(
    /not configured/i,
  );
});
