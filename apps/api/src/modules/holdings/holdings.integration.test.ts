// End-to-end wiring proof for the holdings oRPC bridge — boots a real Elysia
// app with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real holdings routes pointed at a
// stubbed in-memory service. Mirrors accounts.integration.test.ts.
//
// What this catches that unit tests don't:
//   - JWT verification + audience/issuer enforcement (AC-10 success branch)
//   - Wire body shape on UNAUTHORIZED (AC-10 failure branch < 100 ms — NFR-9)
//   - Round-trip type-safety: contract Zod runs on both ingress and egress
//   - oRPC RPC envelope: mutation inputs / outputs both wrap in { json: ... }
//   - Typed contract errors (HOLDING_NOT_FOUND, HOLDING_CLOSED, ACCOUNT_NOT_FOUND)
//     surface as canonical defined-error JSON on the wire.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type {
  CreateHoldingInput,
  DerivedHolding,
  Holding,
  HoldingLot,
  RecordLotInput,
} from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { accountNotFound } from "../accounts/accounts.errors";
import { holdingClosed, holdingNotFound } from "./holdings.errors";
import { createHoldingsRouter } from "./holdings.routes";
import type { HoldingService } from "./holdings.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "55555555-5555-4555-8555-555555555555";
const PORT_BASE = 14500;

async function signValid(): Promise<string> {
  return new SignJWT({ email: "alex@pekulo.app" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

function inMemoryService(opts?: {
  validAccountIds?: ReadonlySet<string>;
  seededHoldings?: ReadonlyArray<Holding>;
}): HoldingService {
  const holdings = new Map<string, Holding>();
  const lotsByHolding = new Map<string, HoldingLot[]>();
  const validAccountIds = opts?.validAccountIds ?? new Set(["acc_aaaaaaaaaaaaaaaaaaaaa"]);
  let nextH = 0;
  let nextL = 0;
  const mintHoldingId = () => `hld_${String(nextH++).padStart(21, "0")}`;
  const mintLotId = () => `lot_${String(nextL++).padStart(21, "0")}`;
  for (const seed of opts?.seededHoldings ?? []) {
    holdings.set(seed.id, seed);
  }
  return {
    async create(userId, input: CreateHoldingInput) {
      if (!validAccountIds.has(input.accountId)) throw accountNotFound();
      const row: Holding = {
        id: mintHoldingId(),
        userId,
        accountId: input.accountId,
        kind: input.kind,
        ticker: input.ticker ?? null,
        isin: input.isin ?? null,
        label: input.label,
        currency: input.currency,
        quantity: input.quantity,
        avgCost: input.avgCost,
        lastPrice: 0,
        lastPriceAt: null,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };
      holdings.set(row.id, row);
      return row;
    },
    async recordLot(userId, input: RecordLotInput) {
      const parent = holdings.get(input.holdingId);
      if (!parent || parent.userId !== userId) throw holdingNotFound();
      if (parent.closedAt !== null) throw holdingClosed();
      const lot: HoldingLot = {
        id: mintLotId(),
        userId,
        holdingId: input.holdingId,
        type: input.type,
        occurredOn: input.occurredOn,
        quantity: input.quantity,
        priceUnit: input.priceUnit,
        fees: input.fees ?? 0,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const arr = lotsByHolding.get(input.holdingId) ?? [];
      arr.push(lot);
      lotsByHolding.set(input.holdingId, arr);
      return lot;
    },
    async close(userId, input) {
      const row = holdings.get(input.id);
      if (!row || row.userId !== userId) throw holdingNotFound();
      if (row.closedAt === null) {
        holdings.set(input.id, { ...row, closedAt: new Date() });
      }
      return { ok: true as const };
    },
    async list(userId, input) {
      const all = [...holdings.values()].filter((r) => r.userId === userId);
      return input.includeClosed ? all : all.filter((r) => r.closedAt === null);
    },
    async getDerived(userId, input): Promise<DerivedHolding> {
      const parent = holdings.get(input.id);
      if (!parent || parent.userId !== userId) throw holdingNotFound();
      const lots = lotsByHolding.get(input.id) ?? [];
      if (lots.length === 0) {
        return {
          holdingId: parent.id,
          quantity: parent.quantity,
          avgCost: parent.avgCost,
          source: "manual",
        };
      }
      const totalQty = lots.reduce((s, l) => s + (l.type === "buy" ? l.quantity : -l.quantity), 0);
      const totalCost = lots.reduce(
        (s, l) => s + (l.type === "buy" ? l.quantity * l.priceUnit + l.fees : 0),
        0,
      );
      return {
        holdingId: parent.id,
        quantity: totalQty,
        avgCost: totalQty > 0 ? totalCost / totalQty : 0,
        source: "lots",
      };
    },
    // Story 3-2 — resolveQuote is not exercised by the integration suite
    // (no oRPC surface) but the type must satisfy HoldingService.
    async resolveQuote() {
      throw new Error("resolveQuote not stubbed in integration test");
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";
let validToken = "";

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const router = createHoldingsRouter({ service: inMemoryService() });
  const orpcRouter: PekuloRpcRouter = { holdings: router };
  const port = PORT_BASE + Math.floor(Math.random() * 200);
  const app = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  await new Promise<void>((resolve) => {
    app.listen({ port, hostname: "127.0.0.1" }, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${port}`;
  appHandle = {
    stop: async () => {
      await app.stop();
    },
  };
  validToken = await signValid();
  // Warm-up — primes JIT + DNS so the 401 latency assertion doesn't flake.
  await fetch(`${baseUrl}/rpc/v1/holdings/list`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({ json: { includeClosed: false } }),
  }).catch(() => undefined);
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

describe("holdings HTTP boundary (AC-3, AC-4, AC-7, AC-10)", () => {
  test("happy path: create → recordLot → getDerived → close → list", async () => {
    const token = await signValid();
    const createRes = await fetch(`${baseUrl}/rpc/v1/holdings/create`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
          ticker: "BTC-USD",
          kind: "crypto",
          currency: "USD",
          label: "Bitcoin",
          quantity: 0.5,
          avgCost: 60000,
        },
      }),
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as { json: Holding };
    expect(created.json.id).toMatch(/^hld_/);
    expect(created.json.kind).toBe("crypto");

    const lotRes = await fetch(`${baseUrl}/rpc/v1/holdings/recordLot`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          holdingId: created.json.id,
          type: "buy",
          occurredOn: "2026-04-01T00:00:00.000Z",
          quantity: 0.1,
          priceUnit: 55000,
          fees: 5,
        },
      }),
    });
    expect(lotRes.status).toBe(200);

    const derivedRes = await fetch(`${baseUrl}/rpc/v1/holdings/getDerived`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { id: created.json.id } }),
    });
    expect(derivedRes.status).toBe(200);
    const derived = (await derivedRes.json()) as { json: DerivedHolding };
    expect(derived.json.source).toBe("lots");

    const closeRes = await fetch(`${baseUrl}/rpc/v1/holdings/close`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { id: created.json.id } }),
    });
    expect(closeRes.status).toBe(200);
    const closeBody = (await closeRes.json()) as { json: { ok: true } };
    expect(closeBody.json).toEqual({ ok: true });

    const activeOnlyRes = await fetch(`${baseUrl}/rpc/v1/holdings/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { includeClosed: false } }),
    });
    const activeOnly = (await activeOnlyRes.json()) as { json: Holding[] };
    expect(activeOnly.json.find((r) => r.id === created.json.id)).toBeUndefined();

    const allRes = await fetch(`${baseUrl}/rpc/v1/holdings/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { includeClosed: true } }),
    });
    const all = (await allRes.json()) as { json: Holding[] };
    expect(all.json.find((r) => r.id === created.json.id)?.closedAt).not.toBeNull();
  });

  test("POST /rpc/v1/holdings/list without JWT returns 401 < 100 ms (NFR-9)", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/holdings/list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { includeClosed: false } }),
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  test("404 on create against unknown accountId surfaces ACCOUNT_NOT_FOUND on wire", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/holdings/create`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          accountId: "acc_zzzzzzzzzzzzzzzzzzzzz",
          kind: "etf",
          currency: "EUR",
          label: "Unknown",
          quantity: 1,
          avgCost: 1,
        },
      }),
    });
    expect(res.status).toBe(404);
    const envelope = (await res.json()) as { json: unknown };
    const inner = envelope.json ?? envelope;
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("ACCOUNT_NOT_FOUND");
    expect(reconstructed.status).toBe(404);
  });

  test("404 on cross-user getDerived surfaces HOLDING_NOT_FOUND on wire", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/holdings/getDerived`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { id: "hld_999999999999999999999" } }),
    });
    expect(res.status).toBe(404);
    const envelope = (await res.json()) as { json: unknown };
    const inner = envelope.json ?? envelope;
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("HOLDING_NOT_FOUND");
    expect(reconstructed.status).toBe(404);
  });
});

// Standalone app with a pre-seeded closed holding so recordLot can trigger
// HOLDING_CLOSED deterministically. Mirrors accounts FK-locked-id pattern.
describe("holdings typed-error wire — HOLDING_CLOSED (AC-6)", () => {
  let closedAppHandle: { stop: () => Promise<void> } | undefined;
  let closedBaseUrl = "";
  let closedToken = "";
  const closedHoldingId = "hld_closedseededxxxxxxxxx";

  beforeAll(async () => {
    const jwtVerifier = createJwtVerifier({
      secret: SECRET,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const seededClosed: Holding = {
      id: closedHoldingId,
      userId: USER_ID,
      accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
      kind: "etf",
      ticker: "CW8",
      isin: null,
      label: "Closed",
      currency: "EUR",
      quantity: 1,
      avgCost: 100,
      lastPrice: 0,
      lastPriceAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: new Date("2026-05-01"),
    };
    const svc = inMemoryService({ seededHoldings: [seededClosed] });
    const router = createHoldingsRouter({ service: svc });
    const orpcRouter: PekuloRpcRouter = { holdings: router };
    const port = 14700 + Math.floor(Math.random() * 200);
    const app = new Elysia().onError(({ error, set }) => {
      const requestId = extractRequestId(error) ?? crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    });
    mountOrpc(app, { jwtVerifier, orpcRouter });
    await new Promise<void>((resolve) => {
      app.listen({ port, hostname: "127.0.0.1" }, () => resolve());
    });
    closedBaseUrl = `http://127.0.0.1:${port}`;
    closedAppHandle = {
      stop: async () => {
        await app.stop();
      },
    };
    closedToken = await signValid();
  });

  afterAll(async () => {
    await closedAppHandle?.stop();
    closedAppHandle = undefined;
  });

  test("recordLot against closed holding returns 409 + HOLDING_CLOSED wire body", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const res = await fetch(`${closedBaseUrl}/rpc/v1/holdings/recordLot`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${closedToken}` },
      body: JSON.stringify({
        json: {
          holdingId: closedHoldingId,
          type: "buy",
          occurredOn: "2026-05-10T00:00:00.000Z",
          quantity: 1,
          priceUnit: 100,
          fees: 0,
        },
      }),
    });
    expect(res.status).toBe(409);
    const envelope = (await res.json()) as { json: unknown };
    const inner = envelope.json ?? envelope;
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("HOLDING_CLOSED");
    expect(reconstructed.status).toBe(409);
  });
});
