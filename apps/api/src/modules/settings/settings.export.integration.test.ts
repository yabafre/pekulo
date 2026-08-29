// Story 11-1, AC-3 + AC-6. HTTP-boundary proof for GET /v1/export.
//
// AC-3 (verbatim from story 11-1-data-export:17):
//   Given two users A and B who each own rows in every user-scoped table,
//   When A exports, Then no row belonging to B appears anywhere in A's
//   payload, for every one of the 21 nodes.
// AC-6 (verbatim from story 11-1-data-export:20):
//   Given a request to `GET /v1/export` on apps/api with no `Authorization`
//   header, or with an invalid Bearer token, Then apps/api answers `401` and
//   no Prisma query runs. […]
//
// Follows the sibling convention (settings.integration.test.ts): a real Elysia
// app, a real jose HS256 verifier, a stubbed data layer. Two users, always — a
// single-tenant fixture cannot prove isolation (lesson 2026-05-27).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { createJwtVerifier } from "../../platform/security";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { extractRequestId } from "../../common/errors";
import { registerSettingsExportRoutes } from "./settings.export-routes";
import { EXPORT_NODES } from "./settings.export";
import type { ExtendedPrismaClient } from "../../database";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// PORT_BASE picked clear of the sibling suites (hypothesis 13900, accounts
// 14160, holdings 14500, compass 14700, milestones 14900, settings 15100).
const PORT_BASE = 15300;

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

// Every user-scoped delegate answers findMany({ where: { userId } }) from a
// two-tenant fixture, so a missing/ignored userId filter shows up as B's row
// inside A's document.
let queriesRan = 0;
function twoTenantClient(): ExtendedPrismaClient {
  const delegate = (owner: string) => ({
    findMany: async ({ where }: { where: { userId: string } }) => {
      queriesRan += 1;
      return [
        { id: `${owner}-a`, userId: USER_A, marker: "row-of-A" },
        { id: `${owner}-b`, userId: USER_B, marker: "row-of-B" },
      ].filter((row) => row.userId === where.userId);
    },
  });
  return new Proxy(
    {},
    { get: (_target, prop: string) => delegate(prop) },
  ) as unknown as ExtendedPrismaClient;
}

let stop: (() => Promise<void>) | undefined;
let baseUrl = "";

beforeAll(async () => {
  const app = new Elysia()
    .onError(({ error, set }) => {
      const requestId = extractRequestId(error) ?? crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    })
    .use(
      registerSettingsExportRoutes({
        client: twoTenantClient(),
        jwtVerifier: createJwtVerifier({
          secret: SECRET,
          issuer: ISSUER,
          audience: AUDIENCE,
        }),
      }),
    );
  const port = PORT_BASE + Math.floor(Math.random() * 200);
  await new Promise<void>((resolve) => {
    app.listen({ port, hostname: "127.0.0.1" }, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${port}`;
  stop = async () => void (await app.stop());
});

afterAll(async () => {
  await stop?.();
  stop = undefined;
});

describe("GET /v1/export (story 11-1)", () => {
  test("no Authorization header → 401, no query runs", async () => {
    const before = queriesRan;
    const res = await fetch(`${baseUrl}/v1/export`);
    expect(res.status).toBe(401);
    expect(queriesRan).toBe(before);
  });

  test("invalid Bearer token → 401, no query runs", async () => {
    const before = queriesRan;
    const res = await fetch(`${baseUrl}/v1/export`, {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(401);
    expect(queriesRan).toBe(before);
  });

  test("user A's export contains A's rows and none of B's, on every node", async () => {
    const res = await fetch(`${baseUrl}/v1/export`, {
      headers: { authorization: `Bearer ${await signFor(USER_A)}` },
    });
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain("row-of-B");
    expect(raw).not.toContain(USER_B);

    const document = JSON.parse(raw) as Record<string, unknown>;
    expect((document.identity as { user_id: string }).user_id).toBe(USER_A);
    for (const node of EXPORT_NODES) {
      const payload = document[node.key] as { rows: { userId: string }[] } | undefined;
      expect(payload, `node ${node.key} missing from the document`).toBeDefined();
      for (const row of payload!.rows) {
        expect(row.userId, `node ${node.key} leaked a row of another tenant`).toBe(USER_A);
      }
    }
  });

  test("user B gets B's rows, symmetrically", async () => {
    const res = await fetch(`${baseUrl}/v1/export`, {
      headers: { authorization: `Bearer ${await signFor(USER_B)}` },
    });
    const raw = await res.text();
    expect(raw).not.toContain("row-of-A");
    expect(raw).toContain("row-of-B");
  });
});

// A mid-stream Prisma failure cannot become a 5xx: status 200 and the headers
// are already on the wire when the first chunk flushes. Added in aped-review of
// 11-1 — before the try/catch in settings.export-routes.ts, the rejection went
// out as an unhandled error on stderr, never reached the app .onError, and left
// the caller holding a truncated file that looked like a completed download.
describe("GET /v1/export — failure mid-stream (story 11-1)", () => {
  test("aborts the body, logs the failure, and never yields a parseable document", async () => {
    const FAILING_NODE = EXPORT_NODES[12]!;
    const explodingClient = new Proxy(
      {},
      {
        get: (_target, model: string) => ({
          findMany: async () => {
            // Delegate names are camelCase; the node key is snake_case.
            if (model.toLowerCase() === FAILING_NODE.model.toLowerCase()) {
              throw new Error("db exploded");
            }
            return [{ id: `${model}-1`, userId: USER_A }];
          },
        }),
      },
    ) as unknown as ExtendedPrismaClient;

    const routes = registerSettingsExportRoutes({
      client: explodingClient,
      jwtVerifier: createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    });

    const lines: string[] = [];
    const realError = console.error;
    console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));

    let body = "";
    let status = 0;
    try {
      const res = await routes.handle(
        new Request("http://localhost/v1/export", {
          headers: { authorization: `Bearer ${await signFor(USER_A)}` },
        }),
      );
      status = res.status;
      try {
        body = await res.text();
      } catch {
        // A read error is an acceptable outcome too — either way the caller
        // must not end up with a document that parses.
        body = "";
      }
    } finally {
      console.error = realError;
    }

    // The status is necessarily 200 — that is the point of the finding.
    expect(status).toBe(200);
    // What matters: the payload stops before the closing brace, so no consumer
    // can mistake it for a complete export.
    expect(() => JSON.parse(body)).toThrow();
    expect(body).not.toEndWith("}}");

    // And the failure is visible to ops rather than silent.
    const logged = lines.find((line) => line.includes("export.stream_failed"));
    expect(
      logged,
      `no export.stream_failed line emitted. Captured: ${lines.join(" | ")}`,
    ).toBeDefined();
    expect(logged).toContain('"route":"GET /v1/export"');
    expect(logged).toContain('"reasonClass":"Error"');
  });
});
