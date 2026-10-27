// oRPC HTTP-boundary proof for the private advisory access gate (story 12-1,
// ADR-0016 §4). Boots a real Elysia app with the real mountOrpc + RPCHandler
// + jose HS256 verifier + the real advisory router and service, pointed at
// an in-memory repository.
//
// Why a fake repository (no real DB): the repo's integration-test convention
// is a boundary test; the repository's `where: { userId }` guard is enforced
// by pekulo/no-prisma-query-without-user-id and RLS is asserted by the live
// db:rls-audit probe. What this catches that the unit tests do not:
//   - the gate runs before every handler (AC-1, AC-3)
//   - the ban is effective on the NEXT request, with no cached pass (AC-3)
//   - the JWT subject reaches the service (AC-2, AC-4)
//   - each error crosses the RPC envelope as a typed 403/400
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { AdvisoryAccessEntry } from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import type { AdvisoryAccessRepository } from "./advisory.repository";
import { createAdvisoryRouter } from "./advisory.routes";
import { createAdvisoryService } from "./advisory.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// RFC 4122 v4 — version nibble `4`, variant nibble `8`.
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ACTIVE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_BANNED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_MEMBER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_UNKNOWN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
// PORT_BASE picked clear of sibling suites (hypothesis 13900, accounts 14160,
// llm 14360, holdings 14500, compass 14700, milestones 14900, settings 15100,
// settings export 15300).
const PORT_BASE = 15500;

function entry(userId: string, status: "active" | "banned"): AdvisoryAccessEntry {
  const stamp = "2026-10-27T10:00:00.000Z";
  return {
    userId,
    status,
    grantedBy: status === "active" ? OWNER : null,
    grantedAt: status === "active" ? stamp : null,
    bannedAt: status === "banned" ? stamp : null,
    updatedAt: stamp,
  };
}

class InMemoryAdvisoryRepository implements AdvisoryAccessRepository {
  readonly rows = new Map<string, AdvisoryAccessEntry>();
  statusReads = 0;

  async getAccessStatus(userId: string): Promise<"active" | "banned" | null> {
    this.statusReads += 1;
    return this.rows.get(userId)?.status ?? null;
  }

  async getEntry(userId: string): Promise<AdvisoryAccessEntry | null> {
    return this.rows.get(userId) ?? null;
  }

  async list(): Promise<AdvisoryAccessEntry[]> {
    return [...this.rows.values()];
  }

  async grant(userId: string, grantedBy: string): Promise<AdvisoryAccessEntry> {
    const base = entry(userId, "active");
    const row = { ...base, grantedBy, grantedAt: base.updatedAt };
    this.rows.set(userId, row);
    return row;
  }

  async ban(userId: string): Promise<AdvisoryAccessEntry> {
    const previous = this.rows.get(userId);
    const row = {
      ...entry(userId, "banned"),
      grantedBy: previous?.grantedBy ?? null,
      grantedAt: previous?.grantedAt ?? null,
    };
    this.rows.set(userId, row);
    return row;
  }
}

const repository = new InMemoryAdvisoryRepository();

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

async function call(method: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/rpc/v1/advisory/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: body }),
  });
}

beforeAll(async () => {
  repository.rows.set(USER_ACTIVE, entry(USER_ACTIVE, "active"));
  repository.rows.set(USER_MEMBER, entry(USER_MEMBER, "active"));
  repository.rows.set(USER_BANNED, entry(USER_BANNED, "banned"));

  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const service = createAdvisoryService({
    repository,
    ownerUserIds: new Set([OWNER]),
  });
  const router = createAdvisoryRouter({ service });
  const orpcRouter: PekuloRpcRouter = { advisory: router };
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
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

describe("advisory /rpc/v1/advisory HTTP boundary (story 12-1)", () => {
  test("AC-1 — non-allowlisted caller is 403 in < 100 ms and the handler never runs", async () => {
    const token = await signFor(USER_UNKNOWN);
    const before = repository.statusReads;
    const started = performance.now();
    const res = await call("status", {}, token);
    const elapsed = performance.now() - started;

    expect(res.status).toBe(403);
    const body = (await res.json()) as { json: { code: string } };
    expect(body.json.code).toBe("FORBIDDEN");
    expect(elapsed).toBeLessThan(100);
    // One read is the gate. A second read would mean getStatus ran and the
    // request computed access data after the gate had already said no.
    expect(repository.statusReads - before).toBe(1);
  });

  test("AC-2 — an active allowlisted caller passes the gate", async () => {
    const res = await call("status", {}, await signFor(USER_ACTIVE));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { access: string; owner: boolean } };
    expect(body.json).toEqual({ access: "active", owner: false });
  });

  test("AC-3 — a ban rejects the very next request with the same token", async () => {
    const token = await signFor(USER_ACTIVE);
    const allowed = await call("status", {}, token);
    expect(allowed.status).toBe(200);

    const banned = await call("ban", { userId: USER_ACTIVE }, await signFor(OWNER));
    expect(banned.status).toBe(200);

    const denied = await call("status", {}, token);
    expect(denied.status).toBe(403);
    const body = (await denied.json()) as { json: { code: string } };
    expect(body.json.code).toBe("FORBIDDEN");
  });

  test("AC-4 — re-granting restores access on the next request", async () => {
    const token = await signFor(USER_BANNED);
    const denied = await call("status", {}, token);
    expect(denied.status).toBe(403);

    const granted = await call("grant", { userId: USER_BANNED }, await signFor(OWNER));
    expect(granted.status).toBe(200);

    const restored = await call("status", {}, token);
    expect(restored.status).toBe(200);
    const body = (await restored.json()) as { json: { access: string; owner: boolean } };
    expect(body.json).toEqual({ access: "active", owner: false });
  });

  test("AC-8 — the owner is implicitly allowed and sees their own status", async () => {
    const res = await call("status", {}, await signFor(OWNER));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { access: string; owner: boolean } };
    expect(body.json).toEqual({ access: "active", owner: true });
  });

  test("AC-8 — the owner can list the allowlist", async () => {
    const res = await call("list", {}, await signFor(OWNER));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: AdvisoryAccessEntry[] };
    expect(body.json.map((row) => row.userId)).toContain(USER_MEMBER);
  });

  test("AC-8 — an active non-owner cannot list or grant", async () => {
    const token = await signFor(USER_MEMBER);
    const list = await call("list", {}, token);
    expect(list.status).toBe(403);
    expect(((await list.json()) as { json: { code: string } }).json.code).toBe("FORBIDDEN");

    const grant = await call("grant", { userId: USER_UNKNOWN }, token);
    expect(grant.status).toBe(403);
  });

  test("AC-8 — the owner cannot grant or ban another owner", async () => {
    const res = await call("ban", { userId: OWNER }, await signFor(OWNER));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { json: { code: string } }).json.code).toBe("BAD_REQUEST");
  });

  test("AC-8 — no JWT is 401 before the gate reads anything", async () => {
    const before = repository.statusReads;
    const res = await call("status", {});
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("UNAUTHORIZED");
    expect(repository.statusReads).toBe(before);
  });
});
