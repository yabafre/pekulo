// End-to-end wiring proof for the oRPC bridge — boots a real Elysia app
// with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real compass routes pointed at a
// stubbed in-memory service. Mirrors hypothesis.integration.test.ts.
//
// What this catches that unit tests don't:
//   - JWT verification + audience/issuer enforcement (AC-7 success branch)
//   - Wire body shape on UNAUTHORIZED (AC-7 failure branch)
//   - Round-trip type-safety: contract Zod runs on both ingress and egress
//   - oRPC RPC envelope: mutation inputs / outputs both wrap in { json: ... }

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { extractRequestId } from "../../common/errors";
import { createCompassRouter } from "./compass.routes";
import type { CompassService } from "./compass.service";
import type { Compass, CompassCurve, CompassSetupState } from "@pekulo/validators";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "55555555-5555-5555-5555-555555555555";
const PORT_BASE = 13950;

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

async function signWith(opts: {
  issuer?: string;
  audience?: string;
  expSecondsFromNow?: number;
}): Promise<string> {
  return new SignJWT({ email: "alex@pekulo.app" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (opts.expSecondsFromNow ?? 3600))
    .sign(new TextEncoder().encode(SECRET));
}

// AC-7 stub curve (story 1-3 L22): the integration test pins the wire shape,
// not the helper math — the helper has its own deterministic unit tests at
// common/derive/compass-curve.test.ts.
const STUB_CURVE: CompassCurve = {
  startedAt: new Date("2024-01-15T00:00:00Z"),
  actual: [],
  plan: [
    { at: new Date("2024-01-15T00:00:00Z"), eur: 0 },
    { at: new Date("2026-05-09T12:00:00Z"), eur: 74438.36 },
    { at: new Date("2049-01-15T00:00:00Z"), eur: 800_000 },
  ],
};

function inMemoryService(): CompassService {
  const store = new Map<string, Compass>();
  return {
    async updateCompass(userId, input) {
      const c: Compass = { objectif: input.objectif, horizonYears: input.horizonYears };
      store.set(userId, c);
      return c;
    },
    async getCompass(userId) {
      return store.get(userId) ?? null;
    },
    async getSetupState(_userId): Promise<CompassSetupState> {
      return "incomplete";
    },
    computeProgress(input) {
      return { percent: 0, gap: input.capitalTarget - input.currentWealth };
    },
    async getCompassCurve(_userId): Promise<CompassCurve> {
      return STUB_CURVE;
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const router = createCompassRouter({ service: inMemoryService() });
  const orpcRouter: PekuloRpcRouter = { compass: router };
  const jwtVerifier = createJwtVerifier({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE,
  });

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
});

afterAll(async () => {
  await appHandle?.stop();
});

describe("compass bridge (integration)", () => {
  // AC-7 (verbatim from story 1-1 L22): missing JWT returns HTTP 401 with
  // body shape { code: "UNAUTHORIZED", ... }. Real wire wraps the code under
  // .error per error-mapper.
  test("AC-7 unauthorized: missing JWT returns 401 + UNAUTHORIZED wire body", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectif: 800_000, horizonYears: 25 }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // AC-7 (verbatim): valid Supabase HS256 JWT for user A, POST
  // /rpc/v1/compass/updateCompass with { objectif: 800_000, horizonYears: 25 }
  // -> HTTP 200 with body { objectif: 800_000, horizonYears: 25 }.
  test("AC-7 success: POST updateCompass returns 200 with typed body", async () => {
    const jwt = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      // oRPC RPC protocol wraps inputs / outputs in { json: ... }.
      body: JSON.stringify({ json: { objectif: 800_000, horizonYears: 25 } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Compass };
    expect(body.json).toEqual({ objectif: 800_000, horizonYears: 25 });
  });

  // AC-7 hardening: the verifier must reject expired tokens, foreign issuers,
  // and foreign audiences. Story-level AC-7 only asserts presence/absence of a
  // JWT; these branches are hardenings against config drift in the verifier
  // (createJwtVerifier owns the issuer/audience checks).
  test("AC-7 expired JWT returns 401 UNAUTHORIZED", async () => {
    const jwt = await signWith({ expSecondsFromNow: -10 });
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ json: { objectif: 800_000, horizonYears: 25 } }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("AC-7 wrong issuer returns 401 UNAUTHORIZED", async () => {
    const jwt = await signWith({ issuer: "https://attacker.example/auth/v1" });
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ json: { objectif: 800_000, horizonYears: 25 } }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("AC-7 wrong audience returns 401 UNAUTHORIZED", async () => {
    const jwt = await signWith({ audience: "service" });
    const res = await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ json: { objectif: 800_000, horizonYears: 25 } }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("AC-7 round-trip: getCompass after updateCompass returns the persisted row", async () => {
    const jwt = await signValid();
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    };

    await fetch(`${baseUrl}/rpc/v1/compass/updateCompass`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: { objectif: 1_000_000, horizonYears: 30 } }),
    });

    const res = await fetch(`${baseUrl}/rpc/v1/compass/getCompass`, {
      method: "POST",
      headers,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Compass };
    expect(body.json).toEqual({ objectif: 1_000_000, horizonYears: 30 });
  });

  // ─── Story 1-3: getCompassCurve (FR-7) ────────────────────────────────

  // AC-7 (verbatim from story 1-3 L22): valid Supabase HS256 JWT for user A
  // whose stub service returns { startedAt: ..., actual: [], plan: [3 points]
  // }, when the integration test calls POST /rpc/v1/compass/getCompassCurve
  // with empty body wrapped as { json: {} }, then the response is HTTP 200
  // with body { json: { startedAt: <ISO>, actual: [], plan: [3 points] } } —
  // Zod-validated against compassCurveSchema on the egress side.
  test("AC-7 success: POST getCompassCurve returns 200 with deterministic curve", async () => {
    const jwt = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/compass/getCompassCurve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      json: {
        startedAt: string;
        actual: { at: string; eur: number }[];
        plan: { at: string; eur: number }[];
      };
    };
    // Date fields surface as ISO strings on the wire; assert shape + content.
    expect(typeof body.json.startedAt).toBe("string");
    expect(new Date(body.json.startedAt).getTime()).toBe(
      new Date("2024-01-15T00:00:00Z").getTime(),
    );
    expect(body.json.actual).toEqual([]);
    expect(body.json.plan).toHaveLength(3);
    expect(body.json.plan[2]!.eur).toBe(800_000);
  });

  // AC-8 (verbatim from story 1-3 L23): no JWT (or mangled Bearer header) →
  // HTTP 401 within 100 ms with body { error: { code: "UNAUTHORIZED",
  // requestId: <uuid> } }. Reuses the existing JWT verifier mounting; same
  // wire shape as story 1-1's AC-7 unauth.
  test("AC-8 unauthorized: missing JWT returns 401 + UNAUTHORIZED wire body", async () => {
    const startedAt = Date.now();
    const res = await fetch(`${baseUrl}/rpc/v1/compass/getCompassCurve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    const elapsed = Date.now() - startedAt;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
