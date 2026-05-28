// T19 — bank-aggregator.module composition smoke test (story 5-6 + post-review).
//
// Verifies the composition root returns the expected shape end-to-end so a
// future refactor that drops a wiring branch is caught at test time, not at
// boot. The module factory consumes a PrismaService — we feed a duck-typed
// fake (the smoke is the wiring, not the SQL).

import { test, expect } from "bun:test";
import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import type { AccountService } from "../accounts/accounts.service";
import type { TransactionsService } from "../transactions/transactions.service";
import { createBankAggregatorModule } from "./bank-aggregator.module";

function makeFakePrisma(): PrismaService {
  // Only the fields the module factory actually reads at composition time.
  return {
    client: {
      bankConnection: {
        findMany: async () => [],
      },
    },
  } as unknown as PrismaService;
}

const env = {
  BRIDGE_API_BASE: "https://api.bridgeapi.io",
  BRIDGE_API_VERSION: "2025-01-15",
  BRIDGE_CLIENT_ID: "test-client",
  BRIDGE_CLIENT_SECRET: "test-secret",
  BRIDGE_WEBHOOK_SIGNING_SECRET: "test-webhook",
  BRIDGE_REFRESH_CRON_HOURS: 6,
} as unknown as Env;

const fakeAccounts = {
  findOrCreateAutoFromProvider: async () => null,
} as unknown as AccountService;
const fakeTx = {
  importFromProvider: async () => ({ persisted: 0, skipped: 0 }),
} as unknown as TransactionsService;

test("createBankAggregatorModule returns { service, repository, router, webhookRouter, scheduledTask }", () => {
  const mod = createBankAggregatorModule({
    prismaService: makeFakePrisma(),
    env,
    transactionsService: fakeTx,
    accountsService: fakeAccounts,
  });
  expect(mod.service).toBeDefined();
  expect(mod.repository).toBeDefined();
  expect(mod.router).toBeDefined();
  expect(mod.webhookRouter).toBeDefined();
  expect(mod.scheduledTask).toBeDefined();
  // The scheduler MUST expose start/stop so lifecycle.ts can wire it.
  expect(typeof mod.scheduledTask.start).toBe("function");
  expect(typeof mod.scheduledTask.stop).toBe("function");
});

test("service exposes the documented surface (initiate/complete/list/refresh/refreshAll/handleWebhookEvent/getReconnectUrl)", () => {
  const mod = createBankAggregatorModule({
    prismaService: makeFakePrisma(),
    env,
    transactionsService: fakeTx,
    accountsService: fakeAccounts,
  });
  for (const method of [
    "initiateConnection",
    "completeConnection",
    "listConnections",
    "refreshConnection",
    "refreshAll",
    "handleWebhookEvent",
    "getReconnectUrl",
  ] as const) {
    expect(typeof mod.service[method]).toBe("function");
  }
});
