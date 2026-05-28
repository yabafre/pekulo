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
// Story 2-3 review extension: ACCOUNT_NOT_FOUND (AC-4) and
// ACCOUNT_REFERENCED_FK (AC-2) wire roundtrips are now covered here. The
// routes re-throw service-side AccountError as typed contract errors via
// the handler's `errors.*` constructors, so the wire JSON parses back into
// a `defined` ORPCError on the client. Verified inline using
// `isORPCErrorJson` + `createORPCErrorFromJson` from @orpc/client.

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

function inMemoryService(opts?: { fkLockedIds?: ReadonlySet<string> }): AccountService {
  const store = new Map<string, Account>();
  const fkLockedIds = opts?.fkLockedIds ?? new Set<string>();
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
      // FK gate fires first (matches production DB semantics: the FK probe
      // catches conflicts independent of row visibility).
      if (fkLockedIds.has(input.id)) {
        throw new AccountError("ACCOUNT_REFERENCED_FK", "account is referenced by 1 holding");
      }
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
    async recordBalanceChange(userId, input) {
      const existing = store.get(input.id);
      if (!existing || existing.userId !== userId) {
        throw new AccountError("ACCOUNT_NOT_FOUND", "account not found");
      }
      const updated: Account = {
        ...existing,
        cashBalance: input.cashBalance,
        updatedAt: new Date(),
      };
      store.set(updated.id, updated);
      return updated;
    },
    async accountExists(userId, accountId) {
      const a = store.get(accountId);
      return a !== undefined && a.userId === userId;
    },
    async accountsExist(userId, accountIds) {
      return new Set(
        accountIds.filter((id) => {
          const a = store.get(id);
          return a !== undefined && a.userId === userId;
        }),
      );
    },
    async findAccountIdByLabel(userId, label) {
      const matches = [...store.values()].filter((a) => a.userId === userId && a.label === label);
      if (matches.length === 0) return { id: null, matchCount: 0 };
      if (matches.length > 1) return { id: null, matchCount: matches.length };
      return { id: matches[0]!.id, matchCount: 1 };
    },
    async findOrCreateAutoFromProvider() {
      // Not exercised by the accounts integration test suite — story 5-6
      // covers this entry point through bank-aggregator.integration.test.ts.
      throw new Error("inMemoryService.findOrCreateAutoFromProvider not implemented");
    },
    async findByProviderKey() {
      throw new Error("inMemoryService.findByProviderKey not implemented");
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
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
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

  // AC-1 (verbatim from story 2-2-account-balance-history:17):
  //   the response Account.cashBalance equals 1500.
  test("POST /rpc/v1/accounts/recordBalanceChange happy returns 200 + updated body (AC-1)", async () => {
    const token = await signValid();
    const addRes = await fetch(`${baseUrl}/rpc/v1/accounts/create`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          label: "Livret balanceLog",
          type: "livret",
          currency: "EUR",
          cashBalance: 1000,
          notes: null,
        },
      }),
    });
    const addBody = (await addRes.json()) as { json: Account };
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/recordBalanceChange`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          id: addBody.json.id,
          valuedOn: "2026-05-01T00:00:00.000Z",
          cashBalance: 1500,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Account };
    expect(body.json.id).toBe(addBody.json.id);
    expect(body.json.cashBalance).toBe(1500);
  });

  // AC-4 (verbatim from story 2-2-account-balance-history:20):
  //   Given the Zod recordBalanceChangeInputSchema is invoked with
  //   cashBalance: -1, When parsing runs, Then parsing rejects with
  //   ZodError. The contract Zod runs at the request boundary; oRPC
  //   surfaces validation failures as a non-2xx wire status.
  test("POST /rpc/v1/accounts/recordBalanceChange with cashBalance:-1 is rejected (AC-4)", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/recordBalanceChange`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          id: "acc_anyvalueofcorrectshape00",
          valuedOn: "2026-05-01T00:00:00.000Z",
          cashBalance: -1,
        },
      }),
    });
    expect(res.status).not.toBe(200);
  });

  // AC-6 (verbatim from story 2-2-account-balance-history:22):
  //   the Elysia error mapper translates it to HTTP 401 within 100 ms (NFR-9).
  test("POST /rpc/v1/accounts/recordBalanceChange unauthenticated returns 401 < 100 ms (AC-6, NFR-9)", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/accounts/recordBalanceChange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        json: {
          id: "acc_anyvalueofcorrectshape00",
          valuedOn: "2026-05-01T00:00:00.000Z",
          cashBalance: 1500,
        },
      }),
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

// Story 2-3 review — typed error wire roundtrip. Standalone app + service
// because we need a deterministic FK-locked id. Boots on its own port so the
// FK lock doesn't poison the happy-path suite above.
describe("accounts typed-error wire (AC-2, AC-4)", () => {
  let fkAppHandle: { stop: () => Promise<void> } | undefined;
  let fkBaseUrl = "";
  let fkValidToken = "";
  const fkLockedId = "acc_FKLOCKED0000000000000";

  beforeAll(async () => {
    const jwtVerifier = createJwtVerifier({
      secret: SECRET,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    // Pre-seed the FK-locked id by minting a service whose store starts
    // empty, then in the test we'll create one and force-promote it to
    // locked. Simpler: lock by id literal — the service does not validate
    // id format on the FK gate, only on delete-exists.
    const lockedSet = new Set([fkLockedId]);
    const svc = inMemoryService({ fkLockedIds: lockedSet });
    const router = createAccountsRouter({ service: svc });
    const orpcRouter: PekuloRpcRouter = { accounts: router };
    const port = 14400 + Math.floor(Math.random() * 200);
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
    fkBaseUrl = `http://127.0.0.1:${port}`;
    fkAppHandle = {
      stop: async () => {
        await app.stop();
      },
    };
    fkValidToken = await signValid();
    // Seed the locked account so delete reaches the FK gate. The service
    // mints sequential ids; we cannot inject `acc_FKLOCKED0000000000000`
    // via create. Instead we add a synthetic row via a direct second-
    // service-call — but the existing service has no admin API, so we
    // simply test delete against the locked-id directly: the gate fires
    // before the existence check would have run. The route remap then
    // surfaces ACCOUNT_REFERENCED_FK on the wire.
    void fkLockedId; // referenced in tests below
  });

  afterAll(async () => {
    await fkAppHandle?.stop();
    fkAppHandle = undefined;
  });

  // The wire body for an oRPC error is wrapped in the standard RPC envelope
  // `{ json: { defined, code, status, message, data }, meta? }` — same shape
  // as success responses. The client's StandardRPCLink.decode unwraps `json`
  // before passing the inner object to `isORPCErrorJson`. We replicate the
  // unwrap here to assert the wire really matches what the client expects.
  type WireEnvelope = { json: unknown; meta?: unknown };
  const unwrap = (envelope: WireEnvelope): unknown =>
    envelope && typeof envelope === "object" && "json" in envelope ? envelope.json : envelope;

  test("delete of FK-locked id returns canonical oRPC error JSON parseable by @orpc/client", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson, isORPCErrorStatus } =
      await import("@orpc/client");
    const res = await fetch(`${fkBaseUrl}/rpc/v1/accounts/delete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fkValidToken}`,
      },
      body: JSON.stringify({ json: { id: fkLockedId } }),
    });
    expect(isORPCErrorStatus(res.status)).toBe(true);
    expect(res.status).toBe(409);
    const inner = unwrap((await res.json()) as WireEnvelope);
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("ACCOUNT_REFERENCED_FK");
    expect(reconstructed.status).toBe(409);
    expect(reconstructed.defined).toBe(true);
    expect(typeof reconstructed.message).toBe("string");
  });

  test("delete of unknown id returns canonical oRPC error JSON with ACCOUNT_NOT_FOUND", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const res = await fetch(`${fkBaseUrl}/rpc/v1/accounts/delete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fkValidToken}`,
      },
      body: JSON.stringify({ json: { id: "acc_UNKNOWNGHOST000000000" } }),
    });
    expect(res.status).toBe(404);
    const inner = unwrap((await res.json()) as WireEnvelope);
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("ACCOUNT_NOT_FOUND");
    expect(reconstructed.status).toBe(404);
    expect(reconstructed.defined).toBe(true);
  });

  test("update of unknown id returns canonical ACCOUNT_NOT_FOUND wire body", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const res = await fetch(`${fkBaseUrl}/rpc/v1/accounts/update`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fkValidToken}`,
      },
      body: JSON.stringify({
        json: { id: "acc_UNKNOWNGHOST000000000", label: "renamed" },
      }),
    });
    expect(res.status).toBe(404);
    const inner = unwrap((await res.json()) as WireEnvelope);
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("ACCOUNT_NOT_FOUND");
    expect(reconstructed.defined).toBe(true);
  });

  test("recordBalanceChange of unknown id returns canonical ACCOUNT_NOT_FOUND wire body", async () => {
    const { isORPCErrorJson, createORPCErrorFromJson } = await import("@orpc/client");
    const res = await fetch(`${fkBaseUrl}/rpc/v1/accounts/recordBalanceChange`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${fkValidToken}`,
      },
      body: JSON.stringify({
        json: {
          id: "acc_UNKNOWNGHOST000000000",
          valuedOn: "2026-05-01T00:00:00.000Z",
          cashBalance: 9999,
        },
      }),
    });
    expect(res.status).toBe(404);
    const inner = unwrap((await res.json()) as WireEnvelope);
    expect(isORPCErrorJson(inner)).toBe(true);
    const reconstructed = createORPCErrorFromJson(inner as never);
    expect(reconstructed.code).toBe("ACCOUNT_NOT_FOUND");
  });
});
