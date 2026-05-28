// AC-3 + AC-9 (verbatim from story 5-6-bridge-connector):
//   AC-3 — invalid BridgeApi-Signature → HTTP 401 within < 100 ms, no DB write,
//          no payload bytes in logs (NFR-33).
//   AC-9 — body > 256 KB → HTTP 413, no DB write, < 100 ms.
//
// Synthetic test-only HMAC keys — never used in production.

import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import type { Env } from "../../../config/env";
import type { BankAggregatorService } from "../bank-aggregator.service";
import { createBridgeWebhookRouter } from "./bridge-webhook-router";

const SECRET = "fake-aaaaaaaaaaaaaaaaaaaaaaaa";

function makeEnv(): Env {
  return {
    BRIDGE_WEBHOOK_SIGNING_SECRET: SECRET,
    BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: undefined,
  } as unknown as Env;
}

function makeFakeService(): BankAggregatorService {
  return {
    initiateConnection: async () => ({ connectUrl: "x", sessionId: "x" }),
    completeConnection: async () => ({
      id: "bnk_x",
      userId: "11111111-1111-4111-8111-111111111111",
      provider: "bridge",
      providerItemId: "x",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: new Date().toISOString(),
    }),
    listConnections: async () => [],
    refreshConnection: async () => ({
      fetched: 0,
      persisted: 0,
      skipped: 0,
      lastRefreshedAt: new Date().toISOString(),
    }),
    refreshAll: async () => undefined,
    handleWebhookEvent: async () => undefined,
    getReconnectUrl: async () => "https://x",
  };
}

test("invalid signature → 401 within 100 ms (NFR-33 fast-path)", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const startedAt = performance.now();
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "bridgeapi-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "item.refreshed" }),
    }),
  );
  const elapsed = performance.now() - startedAt;
  expect(res.status).toBe(401);
  expect(elapsed).toBeLessThan(100);
});

test("valid signature → 204 + service dispatch", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const bodyStr = JSON.stringify({
    type: "item.refreshed",
    content: { item_id: 1, status_code: 0 },
  });
  const hex = createHmac("sha256", SECRET).update(bodyStr).digest("hex");
  // Story 5-6 post-review aped-review: webhook verifier rejects timestamps
  // older than MAX_REPLAY_AGE_SECONDS (300s). Test uses the wall-clock now so
  // the signed timestamp stays in the live window.
  const nowSec = Math.floor(Date.now() / 1000);
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "bridgeapi-signature": `t=${nowSec},v1=${hex}`,
      },
      body: bodyStr,
    }),
  );
  expect(res.status).toBe(204);
});

test("body > 256 KB → 413 fast-path (AC-9)", async () => {
  const router = createBridgeWebhookRouter({ env: makeEnv(), service: makeFakeService() });
  const huge = "x".repeat(300_000);
  const res = await router.handle(
    new Request("http://localhost/internal/bridge/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "bridgeapi-signature": "t=1,v1=deadbeef" },
      body: huge,
    }),
  );
  expect(res.status).toBe(413);
});
