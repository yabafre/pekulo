// apps/api/src/modules/hypothesis/hypothesis.integration.test.ts
// End-to-end wiring proof for the oRPC bridge — boots a real Elysia app
// with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real hypothesis routes pointed at a
// stubbed in-memory service. The Prisma layer is unit-tested separately
// (hypothesis.service.test.ts); this file proves the HTTP boundary.
//
// What this catches that unit tests don't:
// - JWT verification + audience/issuer enforcement (AC-3 success branch)
// - Structured log shape for both success (200) and failure (401) paths (AC-1)
// - Wire body shape on UNAUTHORIZED (AC-3)
// - Round-trip type-safety: contract Zod runs on both ingress (input) and
//   egress (output), so a service returning a malformed payload is caught
// - requestId correlation: mount-side log + wire body share the same id

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { extractRequestId } from "../../common/errors";
import { createHypothesisRouter } from "./hypothesis.routes";
import type { HypothesisService } from "./hypothesis.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const PORT_BASE = 13900;

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

function inMemoryHypothesisService(): HypothesisService {
  const store = new Map<string, Hypotheses>();
  return {
    async get(userId: string) {
      return store.get(userId) ?? defaultHypotheses;
    },
    async save(userId: string, input: Hypotheses) {
      store.set(userId, input);
      return input;
    },
  };
}

function captureStdout() {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";
let stdoutCapture: ReturnType<typeof captureStdout>;

beforeAll(async () => {
  stdoutCapture = captureStdout();
  const service = inMemoryHypothesisService();
  const router = createHypothesisRouter({ service });
  const orpcRouter: PekuloRpcRouter = { hypothesis: router };
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
  stdoutCapture.restore();
});

describe("hypothesis bridge (integration)", () => {
  test("AC-3: missing Authorization → 401 + UNAUTHORIZED wire body + structured log", async () => {
    stdoutCapture.lines.length = 0;
    const res = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, { method: "POST" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    // Mount-side log captured the same requestId that hits the wire.
    const log = stdoutCapture.lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.event === "rpc.request");
    expect(log).toBeDefined();
    expect(log.requestId).toBe(body.error.requestId);
    expect(log.status).toBe(401);
    expect(log.errorCode).toBe("UNAUTHORIZED");
    expect(log.userId).toBe("anonymous");
    expect(log.route).toBe("hypothesis.get");
  });

  test("AC-3: malformed scheme → 401", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, {
      method: "POST",
      headers: { Authorization: "not-a-bearer xyz" },
    });
    expect(res.status).toBe(401);
  });

  test("AC-3: garbled JWT → 401", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, {
      method: "POST",
      headers: { Authorization: "Bearer eyInvalid.eyInvalid.eyInvalid" },
    });
    expect(res.status).toBe(401);
  });

  test("AC-3: wrong audience → 401 (defense-in-depth)", async () => {
    const wrongAudToken = await new SignJWT({ email: "alex@pekulo.app" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience("service_role")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));
    const res = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wrongAudToken}` },
    });
    expect(res.status).toBe(401);
  });

  test("AC-1 + AC-4: round-trip get → save → get persists, structured log carries 200", async () => {
    const token = await signValid();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // oRPC RPC protocol wraps payloads in { "json": <data> } on both ingress
    // and egress. Unwrap responses + wrap mutation inputs accordingly.
    const unwrap = async (r: Response): Promise<Hypotheses> => {
      const body = (await r.json()) as { json: Hypotheses };
      return body.json;
    };

    // Initial GET → defaults (no row yet for this user in the in-memory store).
    const r1 = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, { method: "POST", headers });
    expect(r1.status).toBe(200);
    const got = await unwrap(r1);
    expect(got.objectif).toBe(defaultHypotheses.objectif);

    // SAVE bumped objectif.
    stdoutCapture.lines.length = 0;
    const updated: Hypotheses = { ...defaultHypotheses, objectif: 100001 };
    const r2 = await fetch(`${baseUrl}/rpc/v1/hypothesis/save`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: updated }),
    });
    expect(r2.status).toBe(200);
    const saved = await unwrap(r2);
    expect(saved.objectif).toBe(100001);

    // Mount-side structured log for the save: 200, route key, real userId.
    const saveLog = stdoutCapture.lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.event === "rpc.request");
    expect(saveLog).toBeDefined();
    expect(saveLog.status).toBe(200);
    expect(saveLog.route).toBe("hypothesis.save");
    expect(saveLog.userId).toBe(USER_ID);
    expect(typeof saveLog.durationMs).toBe("number");
    expect(saveLog.durationMs).toBeGreaterThanOrEqual(0);
    // Success path emits no errorCode/reasonClass.
    expect(saveLog.errorCode).toBeUndefined();
    expect(saveLog.reasonClass).toBeUndefined();

    // Re-GET reflects the new objectif.
    const r3 = await fetch(`${baseUrl}/rpc/v1/hypothesis/get`, { method: "POST", headers });
    expect(r3.status).toBe(200);
    const reread = await unwrap(r3);
    expect(reread.objectif).toBe(100001);
  });

  test("isolated stores: two parallel users don't bleed userIds across requests", async () => {
    const otherUserId = "22222222-2222-2222-2222-222222222222";
    const tokenA = await signValid();
    const tokenB = await new SignJWT({ email: "other@pekulo.app" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(otherUserId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));

    stdoutCapture.lines.length = 0;
    const [respA, respB] = await Promise.all([
      fetch(`${baseUrl}/rpc/v1/hypothesis/get`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      fetch(`${baseUrl}/rpc/v1/hypothesis/get`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
    ]);
    expect(respA.status).toBe(200);
    expect(respB.status).toBe(200);

    const userIdsLogged = stdoutCapture.lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((p) => p && p.event === "rpc.request")
      .map((p) => p.userId)
      .sort();
    expect(userIdsLogged).toEqual([USER_ID, otherUserId].sort());
  });
});
