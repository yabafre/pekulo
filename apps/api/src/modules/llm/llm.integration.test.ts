// End-to-end wiring proof for the llm opt-in oRPC surface (story 6-3, AC-5).
// Boots a real Elysia app with the real mountOrpc, RPCHandler, requireUserContext,
// jwt-verifier (jose HS256), the real error-mapper, and the REAL llm module
// (createLlmModule → router → service → repository) pointed at a fake Prisma.
// Mirrors accounts.integration.test.ts.
//
// What this catches that the service-level unit tests in llm-opt-in.test.ts don't:
//   - AC-5 401 branch: a request without a valid session is rejected with
//     UNAUTHORIZED < 100 ms (NFR-9) — the requireUserId guard in llm.routes.ts.
//   - AC-5 per-user isolation: context.userId is derived from the verified JWT
//     (never the client) and threaded into the service, so user B never reads
//     user A's opt-in.
//   - The full getOptIn/setOptIn round-trip through the real router + the oRPC
//     { json: ... } envelope on both ingress and egress.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { createLlmModule } from "./llm.module";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// RFC 4122 v4 subjects — two distinct users for the per-user isolation check.
const USER_A = "55555555-5555-4555-8555-555555555555";
const USER_B = "66666666-6666-4666-8666-666666666666";
const PORT_BASE = 14360;

async function signFor(sub: string): Promise<string> {
  return new SignJWT({ email: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

// Map-keyed fake Prisma so two users keep independent opt-in rows — the single
// real isolation lever on the api service-role path (ADR-0013: where:{userId}).
function makeFakeDb(): PrismaService {
  const optIns = new Map<string, boolean>();
  const client = {
    llmCallLog: {
      create: async () => undefined,
      findMany: async () => [],
    },
    llmOptIn: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        optIns.has(where.userId) ? { thirdParty: optIns.get(where.userId)! } : null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string };
        create: { userId: string; thirdParty: boolean };
        update: { thirdParty: boolean };
      }) => {
        const next = optIns.has(where.userId) ? update.thirdParty : create.thirdParty;
        optIns.set(where.userId, next);
        return { thirdParty: next };
      },
      update: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: { thirdParty: boolean };
      }) => {
        optIns.set(where.userId, data.thirdParty);
        return { thirdParty: data.thirdParty };
      },
    },
  };
  return { client } as unknown as PrismaService;
}

const fakeEnv = {} as unknown as Env;

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const mod = createLlmModule({ prismaService: makeFakeDb(), env: fakeEnv, jwtVerifier });
  const orpcRouter: PekuloRpcRouter = { llm: mod.router };
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
  appHandle = { stop: async () => void (await app.stop()) };
  // Warm-up — primes the JIT/DNS path so the 401-latency assertion doesn't flake.
  const warm = await signFor(USER_A);
  await fetch(`${baseUrl}/rpc/v1/llm/getOptIn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${warm}` },
    body: JSON.stringify({ json: {} }),
  }).catch(() => undefined);
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

describe("llm opt-in HTTP boundary (AC-5)", () => {
  test("POST /rpc/v1/llm/getOptIn with a valid JWT returns 200 + { thirdParty:false } by default", async () => {
    const token = await signFor(USER_A);
    const res = await fetch(`${baseUrl}/rpc/v1/llm/getOptIn`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { thirdParty: boolean } };
    expect(body.json.thirdParty).toBe(false);
  });

  test("POST /rpc/v1/llm/setOptIn persists and getOptIn reads it back (write path round-trip)", async () => {
    const token = await signFor(USER_A);
    const setRes = await fetch(`${baseUrl}/rpc/v1/llm/setOptIn`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { thirdParty: true } }),
    });
    expect(setRes.status).toBe(200);
    const setBody = (await setRes.json()) as { json: { thirdParty: boolean } };
    expect(setBody.json.thirdParty).toBe(true);

    const getRes = await fetch(`${baseUrl}/rpc/v1/llm/getOptIn`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    const getBody = (await getRes.json()) as { json: { thirdParty: boolean } };
    expect(getBody.json.thirdParty).toBe(true);
  });

  test("per-user isolation: user B never reads user A's opt-in (ADR-0013)", async () => {
    // user A turned opt-in on in the previous test; user B must still read false.
    const tokenB = await signFor(USER_B);
    const res = await fetch(`${baseUrl}/rpc/v1/llm/getOptIn`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { thirdParty: boolean } };
    expect(body.json.thirdParty).toBe(false);
  });

  test("POST /rpc/v1/llm/getOptIn without JWT returns 401 < 100 ms (NFR-9)", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/llm/getOptIn`, {
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

  test("POST /rpc/v1/llm/setOptIn without JWT returns 401 (no write reaches the service)", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/llm/setOptIn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { thirdParty: true } }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
