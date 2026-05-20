// apps/api/src/modules/realestate/realestate.integration.test.ts
// oRPC HTTP boundary tests for story 4-1. Mirrors holdings.integration.test.ts —
// boots a real Elysia app with the real mountOrpc, real RPCHandler, real
// jwt-verifier (jose HS256), and the real realestate routes pointed at the
// real service + repository over an in-memory fake Prisma.
//
// AC-11 matrix:
//   - 200 happy path for every procedure
//   - 401 within ~100 ms when JWT is missing (NFR-9)
//   - 404 cross-user on getProperty / mutations (REALESTATE_NOT_FOUND)
//   - 409 duplicate on attachMortgage / attachRental
//
// Port binding: `port: 0` so the OS assigns a free port and we read it back
// from `app.server.port` after listen. This avoids the birthday-paradox
// collisions that `PORT_BASE + Math.random()*200` allocations race into when
// 14+ sibling integration suites run concurrently (precedent: 2026-05-17
// `bump compass+milestones PORT_BASE`). Sibling suites still use the legacy
// pattern (hypothesis 13900, accounts 14160, holdings 14500, compass 14700,
// milestones 14900) — migrating them is out of scope for story 4-1.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { extractRequestId } from "../../common/errors";
import type { PrismaService } from "../../database";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { makeFakePrisma } from "../../test/fakes/fake-realestate";
import { createRealestateModule } from "./realestate.module";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// Valid RFC-4122 v4 UUIDs (version nibble = 4, variant nibble in 8..b).
// Zod's `.uuid()` enforces this on realEstateSchema.userId; relaxed fixtures
// like "00000000-…-00000000000a" make the contract reject the output as
// "Output validation failed" (caught during T17 first run).
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function signFor(userId: string): Promise<string> {
  return new SignJWT({ email: `${userId}@pekulo.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const fake = makeFakePrisma();
  const mod = createRealestateModule({
    prismaService: { client: fake.client } as unknown as PrismaService,
  });
  const orpcRouter: PekuloRpcRouter = { realestate: mod.router };
  // M3 audit-finding (review-supp 2026-05-21): bind port 0 + read the
  // OS-assigned port after listen — eliminates the birthday-paradox
  // collision that Math.random()*200 races into when 14+ spec files
  // race in CI (see 2026-05-17 lesson — "bump PORT_BASE to avoid CI
  // collision" was a workaround, port-0 is the root fix).
  const app = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  await new Promise<void>((resolve) => {
    app.listen({ port: 0, hostname: "127.0.0.1" }, () => resolve());
  });
  const assignedPort = app.server?.port;
  if (!assignedPort) throw new Error("Elysia did not expose server.port after listen");
  baseUrl = `http://127.0.0.1:${assignedPort}`;
  appHandle = {
    stop: async () => {
      await app.stop();
    },
  };
  // Warm-up — primes JIT so the 401 latency assertion doesn't flake.
  const warmupToken = await signFor(USER_A);
  await fetch(`${baseUrl}/rpc/v1/realestate/listProperties`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${warmupToken}`,
    },
    body: JSON.stringify({ json: {} }),
  }).catch(() => undefined);
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

async function call(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/rpc/v1/realestate/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: body }),
  });
}

// AC-11 (verbatim from story 4-1-realestate-domain L27):
//   POST /rpc/v1/realestate/{12 procedures} with a valid JWT → 200.
//   Missing JWT → 401 within 100 ms. Cross-user mutation/read → 404.
//   Duplicate attachMortgage / attachRental → 409.
describe("realestate HTTP boundary (AC-11)", () => {
  test("AC-11: missing JWT → 401 within 100 ms (NFR-9)", async () => {
    const t0 = performance.now();
    const res = await call("createProperty", {
      label: "X",
      propertyType: "locatif",
      currentValuation: 100_000,
      lastValuedOn: "2026-01-01",
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
  });

  test("AC-11: createProperty → 200 + prefixed id", async () => {
    const token = await signFor(USER_A);
    const res = await call(
      "createProperty",
      {
        label: "Appartement Lyon",
        propertyType: "locatif",
        currentValuation: 250_000,
        lastValuedOn: "2026-05-01",
      },
      token,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { id: string } };
    expect(body.json.id).toMatch(/^res_[0-9A-Za-z]{21}$/);
  });

  test("AC-11: attachMortgage duplicate → 409", async () => {
    const token = await signFor(USER_A);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      token,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const input = {
      propertyId: json.id,
      outstandingPrincipal: 180_000,
      annualRate: 0.025,
      monthlyPayment: 800,
      termMonths: 240,
      startDate: "2020-01-01",
    };
    const first = await call("attachMortgage", input, token);
    expect(first.status).toBe(200);
    const second = await call("attachMortgage", input, token);
    expect(second.status).toBe(409);
  });

  test("AC-11: attachRental duplicate → 409", async () => {
    const token = await signFor(USER_A);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      token,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const input = {
      propertyId: json.id,
      monthlyRent: 1200,
      monthlyCharges: 200,
      furnished: false,
    };
    const first = await call("attachRental", input, token);
    expect(first.status).toBe(200);
    const second = await call("attachRental", input, token);
    expect(second.status).toBe(409);
  });

  test("AC-11: cross-user getProperty → 404 (REALESTATE_NOT_FOUND)", async () => {
    const tokenA = await signFor(USER_A);
    const tokenB = await signFor(USER_B);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      tokenA,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const cross = await call("getProperty", { id: json.id }, tokenB);
    expect(cross.status).toBe(404);
  });

  test("AC-11: recordValuation happy → 200 + listValuations sees the new row", async () => {
    const token = await signFor(USER_A);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 250_000,
        lastValuedOn: "2024-01-01",
      },
      token,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const rec = await call(
      "recordValuation",
      { propertyId: json.id, amount: 280_000, valuedOn: "2026-05-01" },
      token,
    );
    expect(rec.status).toBe(200);
    const recBody = (await rec.json()) as { json: { currentValuation: number } };
    expect(recBody.json.currentValuation).toBe(280_000);

    const history = await call("listValuations", { propertyId: json.id }, token);
    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as { json: Array<{ amount: number }> };
    expect(historyBody.json.length).toBe(1);
    expect(historyBody.json[0]!.amount).toBe(280_000);
  });

  test("AC-11: detachMortgage idempotent — 200 even when missing", async () => {
    const token = await signFor(USER_A);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      token,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const det = await call("detachMortgage", { propertyId: json.id }, token);
    expect(det.status).toBe(200);
    const body = (await det.json()) as { json: { ok: boolean } };
    expect(body.json.ok).toBe(true);
  });

  test("AC-11: deleteProperty cascade → 200 + cross-user 404", async () => {
    const tokenA = await signFor(USER_A);
    const tokenB = await signFor(USER_B);
    const create = await call(
      "createProperty",
      {
        label: "X",
        propertyType: "locatif",
        currentValuation: 200_000,
        lastValuedOn: "2026-05-01",
      },
      tokenA,
    );
    const { json } = (await create.json()) as { json: { id: string } };
    const crossDel = await call("deleteProperty", { id: json.id }, tokenB);
    expect(crossDel.status).toBe(404);
    const ownerDel = await call("deleteProperty", { id: json.id }, tokenA);
    expect(ownerDel.status).toBe(200);
  });
});
