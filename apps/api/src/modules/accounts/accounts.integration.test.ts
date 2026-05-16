// End-to-end wiring proof for the accounts oRPC bridge — boots a real Elysia
// app with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real accounts routes pointed at a
// stubbed in-memory service. Mirrors milestones.integration.test.ts.
//
// What this catches that unit tests don't:
//   - JWT verification + audience/issuer enforcement (AC-7 success branch)
//   - Wire body shape on UNAUTHORIZED (AC-7 failure branch < 100 ms — NFR-9)
//   - Round-trip type-safety: contract Zod runs on both ingress and egress
//   - oRPC RPC envelope: mutation inputs / outputs both wrap in { json: ... }
//
// What's covered at the service layer instead (not here): ACCOUNT_NOT_FOUND
// (AC-4) and ACCOUNT_REFERENCED_FK (AC-2) — RPCHandler wraps handler-thrown
// errors before our error-mapper sees them (precedent: milestones integration
// test's update/delete path notes the same constraint).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { Account, CreateAccountInput, UpdateAccountInput } from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { AccountError } from "./accounts.errors";
import { createAccountsRouter } from "./accounts.routes";
import type { AccountService } from "./accounts.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// RFC 4122 v4 — Zod v4's z.string().uuid() (used in accountSchema's userId)
// requires correct version + variant bits. Same shape as milestones.integration.test.ts.
const USER_ID = "55555555-5555-4555-8555-555555555555";
const PORT_BASE = 14160;

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

function inMemoryService(): AccountService {
  const store = new Map<string, Account>();
  let nextId = 0;
  const mintId = () => `acc_${String(nextId++).padStart(21, "0")}`;
  return {
    async create(userId, input: CreateAccountInput) {
      const account: Account = {
        id: mintId(),
        userId,
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(account.id, account);
      return account;
    },
    async update(userId, input: UpdateAccountInput) {
      const existing = store.get(input.id);
      if (!existing || existing.userId !== userId) {
        throw new AccountError("ACCOUNT_NOT_FOUND", "account not found");
      }
      const updated: Account = {
        ...existing,
        label: input.label ?? existing.label,
        type: input.type ?? existing.type,
        currency: input.currency ?? existing.currency,
        cashBalance: input.cashBalance ?? existing.cashBalance,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedAt: new Date(),
      };
      store.set(updated.id, updated);
      return updated;
    },
    async delete(userId, input) {
      const existing = store.get(input.id);
      if (!existing || existing.userId !== userId) {
        throw new AccountError("ACCOUNT_NOT_FOUND", "account not found");
      }
      store.delete(input.id);
      return { ok: true as const };
    },
    async list(userId) {
      return [...store.values()]
        .filter((a) => a.userId === userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
  const router = createAccountsRouter({ service: inMemoryService() });
  const orpcRouter: PekuloRpcRouter = { accounts: router };
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
  // Warm-up fetch — primes the JIT + DNS path so the 401-latency assertion
  // doesn't flake on the very first request (mirrors milestones precedent).
  validToken = await signValid();
  await fetch(`${baseUrl}/rpc/v1/accounts/list`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({ json: {} }),
  }).catch(() => undefined);
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

describe("accounts HTTP boundary (AC-7)", () => {
  test("POST /rpc/v1/accounts/create with valid JWT returns 200 + account body (AC-1)", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/create`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          label: "Livret A",
          type: "livret",
          currency: "EUR",
          cashBalance: 5000,
          notes: null,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Account };
    // Relaxed regex (same as milestones precedent) — the in-memory service
    // mints zero-padded ids that don't match the strict
    // /^acc_[0-9A-Za-z]{21}$/ accountSchema. The prefixedIds extension
    // enforces the strict pattern at the live-DB layer.
    expect(body.json.id).toMatch(/^acc_/);
    expect(body.json.userId).toBe(USER_ID);
    expect(body.json.label).toBe("Livret A");
    expect(body.json.cashBalance).toBe(5000);
    expect(body.json.type).toBe("livret");
  });

  test("POST /rpc/v1/accounts/list with valid JWT returns 200 + array", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Account[] };
    expect(Array.isArray(body.json)).toBe(true);
    expect(body.json[0]?.userId).toBe(USER_ID);
  });

  test("POST /rpc/v1/accounts/list without JWT returns 401 < 100 ms (NFR-9)", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /rpc/v1/accounts/update with valid JWT returns 200 + patched body", async () => {
    const token = await signValid();
    const listRes = await fetch(`${baseUrl}/rpc/v1/accounts/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    const listBody = (await listRes.json()) as { json: Account[] };
    const target = listBody.json[0];
    expect(target).toBeDefined();
    if (!target) return;
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/update`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { id: target.id, label: "Livret renamed" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Account };
    expect(body.json.id).toBe(target.id);
    expect(body.json.label).toBe("Livret renamed");
  });

  test("POST /rpc/v1/accounts/delete happy path returns 200 + { ok: true } (AC-3)", async () => {
    const token = await signValid();
    // Seed a fresh account then delete it — covers the wire envelope on both
    // ends (input { json: { id } }, output { json: { ok: true } }).
    const addRes = await fetch(`${baseUrl}/rpc/v1/accounts/create`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          label: "Throwaway",
          type: "autre",
          currency: "EUR",
          cashBalance: 0,
          notes: null,
        },
      }),
    });
    const addBody = (await addRes.json()) as { json: Account };
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/delete`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { id: addBody.json.id } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { ok: true } };
    expect(body.json).toEqual({ ok: true });
  });
});
