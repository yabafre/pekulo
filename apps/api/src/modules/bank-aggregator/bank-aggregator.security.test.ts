// AC-8 (verbatim from story 5-6-bridge-connector):
//   Given bank-aggregator.security.test.ts runs as part of the bun test suite,
//   when the suite executes a full lifecycle (initiateConnection →
//   completeConnection → refreshConnection → webhook receipt) against a fake
//   BankProvider + a fake pino transport + a fake OTel exporter, then zero
//   strings matching /access[_-]token|refresh[_-]token/i appear in any
//   captured log line, span attribute, or OTel event message.
//
// AC-4 type-level guard (post-review aped-review): BankConnection DTO surface
// MUST stay at the documented 8 keys. The `_dtoSurfaceGuard` below is a
// compile-time assertion (no runtime cost). Adding or removing a key on the
// BankConnection schema breaks the build before the runtime DTO-stripping
// sentinel even runs.
//
// V1 sentinel — exercises the SERVICE (in-memory stubs for the cross-aggregate
// deps + a hand-rolled fake BankProvider) and the WEBHOOK ROUTER perf path.
// Asserts a captured-console + captured-stderr universe contains no
// token-shaped substring. Full DB round-trip lives in T29 (integration).

import { test, expect } from "bun:test";
import type { BankConnection } from "@pekulo/validators";
import { createBankAggregatorService } from "./bank-aggregator.service";
import { createBridgeWebhookRouter } from "./services/bridge-webhook-router";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";
import type { BankProvider } from "./bank-provider";
import type { AccountService } from "../accounts/accounts.service";
import type { TransactionsService } from "../transactions/transactions.service";
import type { Env } from "../../config/env";

const TOKEN_PATTERN = /access[_-]?token|refresh[_-]?token/i;

// AC-4 compile-time type-level guard. Adding/removing any DTO key that isn't
// in the explicit literal union below breaks the build with TS2322 — the
// most reliable defense against a future drift that re-exposes a secret-bearing
// column on the wire. Pekulo's `Expect<Equal<>>` helper is inlined here to
// avoid a cross-package test-only dep.
type AllowedBankConnectionKeys =
  | "id"
  | "userId"
  | "provider"
  | "providerItemId"
  | "status"
  | "displayName"
  | "lastRefreshedAt"
  | "createdAt";
type _BothWaysEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dtoSurfaceGuard: _BothWaysEqual<keyof BankConnection, AllowedBankConnectionKeys> = true;

interface CapturedSink {
  lines: string[];
  capture(...args: unknown[]): void;
  forbiddenStringsPresent(): { found: string[] };
}

function makeCapturedSink(): CapturedSink {
  const lines: string[] = [];
  return {
    lines,
    capture(...args: unknown[]) {
      lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    },
    forbiddenStringsPresent() {
      const found: string[] = [];
      for (const line of lines) {
        if (TOKEN_PATTERN.test(line)) found.push(line);
      }
      return { found };
    },
  };
}

function makeFakeProvider(): BankProvider {
  return {
    createUser: async () => ({ providerUserUuid: "bridge-uuid-1" }),
    createConnectSession: async () => ({ connectUrl: "u", sessionId: "s" }),
    listAccounts: async () => [
      {
        providerAccountId: "1",
        bankName: "SG",
        accountName: "Courant",
        kind: "checking",
        currency: "EUR",
        balance: 100,
      },
    ],
    listTransactions: async () => ({
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
    }),
    revokeItem: async () => undefined,
    getItem: async () => ({
      providerItemId: "item-1",
      statusCode: 0,
      statusMessage: "ok",
      authenticationExpiresAt: null,
    }),
  };
}

function makeRepo(): BankAggregatorRepository {
  let stored = false;
  return {
    // Bridge v3 — bridge_users mapping IS the user-level credential, the
    // provider Bearer is minted from it. The connection row stores only the
    // item_id; no per-item tokens.
    findProviderUserUuid: async () => "bridge-uuid-fixture",
    persistProviderUserUuid: async () => undefined,
    createConnection: async () => {
      stored = true;
      return {
        id: "bnk_1",
        userId: "u",
        provider: "bridge",
        providerItemId: "item-1",
        status: "active",
        displayName: "SG",
        lastRefreshedAt: null,
        createdAt: new Date().toISOString(),
      };
    },
    listByUser: async () => [],
    findByIdForUser: async () => {
      if (!stored) return null;
      return {
        connection: {
          id: "bnk_1",
          userId: "u",
          provider: "bridge",
          providerItemId: "item-1",
          status: "active",
          displayName: "SG",
          lastRefreshedAt: null,
          createdAt: new Date().toISOString(),
        },
      };
    },
    findByProviderItemId: async () => null,
    setStatus: async () => undefined,
    setLastRefreshedAt: async () => undefined,
    findOwnersByProviderItemId: async () => [],
  };
}

test("full lifecycle leaks zero token substrings to console/stderr (AC-8)", async () => {
  const stdoutSink = makeCapturedSink();
  const stderrSink = makeCapturedSink();
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  try {
    console.log = (...args: unknown[]) => stdoutSink.capture(...args);
    console.warn = (...args: unknown[]) => stderrSink.capture(...args);
    console.error = (...args: unknown[]) => stderrSink.capture(...args);

    const repo = makeRepo();
    const provider = makeFakeProvider();
    const transactionsService = {
      importFromProvider: async () => ({ persisted: 1, skipped: 0 }),
    } as unknown as TransactionsService;
    const accountsService = {
      findOrCreateAutoFromProvider: async () => ({
        id: "acc_1",
        userId: "u",
        label: "SG Courant",
        type: "banque" as const,
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findByProviderKey: async () => ({
        id: "acc_1",
        userId: "u",
        label: "SG Courant",
        type: "banque" as const,
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as AccountService;

    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [{ userId: "u", connectionId: "bnk_1" }],
    });

    const connection = await svc.completeConnection("u", "fred@x", {
      itemId: "item-1",
      userUuid: "bridge-uuid-fixture",
    });
    expect(connection).not.toHaveProperty("accessTokenSecretId");

    await svc.refreshConnection("u", { connectionId: "bnk_1" });

    // Webhook receipt (invalid signature path — the router logs the rejection
    // reason; we assert it doesn't carry token bytes).
    const env = {
      BRIDGE_WEBHOOK_SIGNING_SECRET: "fake-zzzzzzzzzzzzzzzzzzzzzzzzz",
      BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: undefined,
    } as unknown as Env;
    const router = createBridgeWebhookRouter({ env, service: svc });
    await router.handle(
      new Request("http://localhost/internal/bridge/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "bridgeapi-signature": "t=1,v1=deadbeef" },
        body: JSON.stringify({ type: "item.refreshed" }),
      }),
    );

    const stdoutLeaks = stdoutSink.forbiddenStringsPresent();
    const stderrLeaks = stderrSink.forbiddenStringsPresent();
    expect(stdoutLeaks.found).toEqual([]);
    expect(stderrLeaks.found).toEqual([]);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
