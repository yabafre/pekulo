// End-to-end wiring proof for the oRPC bridge — boots a real Elysia app
// with the real mountOrpc, real RPCHandler, real requireUserContext, real
// jwt-verifier (jose HS256), and the real milestones routes pointed at a
// stubbed in-memory service. Mirrors compass.integration.test.ts.
//
// What this catches that unit tests don't:
//   - JWT verification + audience/issuer enforcement (AC-13 success branch)
//   - Wire body shape on UNAUTHORIZED (AC-13 failure branch)
//   - Round-trip type-safety: contract Zod runs on both ingress and egress
//   - oRPC RPC envelope: mutation inputs / outputs both wrap in { json: ... }

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { Milestone, MilestonePresenceProbe, MilestoneStatusEntry } from "@pekulo/types";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { extractRequestId } from "../../common/errors";
import { createMilestonesRouter } from "./milestones.routes";
import type { MilestoneService } from "./milestones.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// RFC 4122 v4 — Zod v4's z.string().uuid() (used in milestoneSchema's userId)
// requires correct version (3rd group starts with `[1-8]`) AND variant
// (4th group starts with `[89abAB]`) bits. The all-fives literal used by
// compass.integration.test.ts works there because compass outputs don't
// include userId; here the milestone schema validates it on every response.
const USER_ID = "55555555-5555-4555-8555-555555555555";
const PORT_BASE = 13960;

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

function inMemoryService(): MilestoneService {
  const store = new Map<string, Milestone>();
  let nextId = 0;
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;
  return {
    async add(userId, input) {
      const m: Milestone = {
        id: mintId(),
        userId,
        targetCapital: input.targetCapital,
        targetYear: input.targetYear,
        label: input.label ?? null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(m.id, m);
      return m;
    },
    async update(userId, input) {
      const existing = store.get(input.id);
      if (!existing || existing.userId !== userId) {
        throw new Error("not found");
      }
      const updated: Milestone = {
        ...existing,
        targetCapital: input.targetCapital ?? existing.targetCapital,
        targetYear: input.targetYear ?? existing.targetYear,
        label: input.label !== undefined ? input.label : existing.label,
        updatedAt: new Date(),
      };
      store.set(updated.id, updated);
      return updated;
    },
    async delete(userId, id) {
      const existing = store.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("not found");
      }
      store.delete(id);
      return { id };
    },
    async list(userId) {
      return [...store.values()]
        .filter((m) => m.userId === userId)
        .sort((a, b) => a.targetYear - b.targetYear);
    },
    async computeStatuses(): Promise<MilestoneStatusEntry[]> {
      return [];
    },
    presenceProbe(): MilestonePresenceProbe {
      return {
        async hasAny(userId) {
          return [...store.values()].some((m) => m.userId === userId);
        },
      };
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const router = createMilestonesRouter({ service: inMemoryService() });
  const orpcRouter: PekuloRpcRouter = { milestones: router };
  const app = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  const port = PORT_BASE + Math.floor(Math.random() * 30);
  app.listen(port);
  baseUrl = `http://localhost:${port}`;
  appHandle = app as unknown as { stop: () => Promise<void> };
  // tiny wait to let the server bind
  await new Promise((r) => setTimeout(r, 30));
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

describe("milestones HTTP boundary (AC-13)", () => {
  test("POST /rpc/v1/milestones/add with valid JWT returns 200 + milestone body", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/add`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: { targetCapital: 100_000, targetYear: 2030, label: "First flat" },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Milestone };
    expect(body.json.id).toMatch(/^mst_/);
    expect(body.json.userId).toBe(USER_ID);
    expect(body.json.targetCapital).toBe(100_000);
    expect(body.json.targetYear).toBe(2030);
    expect(body.json.label).toBe("First flat");
    expect(body.json.position).toBe(0);
  });

  test("POST /rpc/v1/milestones/add without JWT returns 401 < 100 ms", async () => {
    const t0 = performance.now();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { targetCapital: 100_000, targetYear: 2030 } }),
    });
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("POST /rpc/v1/milestones/list with valid JWT returns 200 + array", async () => {
    const token = await signValid();
    const res = await fetch(`${baseUrl}/rpc/v1/milestones/list`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: Milestone[] };
    expect(Array.isArray(body.json)).toBe(true);
    expect(body.json[0]?.userId).toBe(USER_ID);
  });
});
