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
import type { Compass, CompassSetupState } from "@pekulo/validators";

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
});
