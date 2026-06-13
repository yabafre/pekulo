// apps/api/src/modules/dashboard/dashboard.integration.test.ts
// AC-6 — oRPC HTTP boundary for getOverview. Boots a real Elysia app with the
// real mountOrpc + RPCHandler + jose HS256 verifier, pointed at the dashboard
// router built from STUB ports (the dashboard owns no Prisma). port:0 → OS
// assigns a free port (avoids cross-suite collisions).
//
// Wire format: the oRPC RPCHandler envelopes every request/response as
// `{ json: <payload> }` (proven across all sibling integration suites —
// realestate/accounts/holdings/...). Inputs go in `{ json: ... }`, success
// bodies read back via `body.json.*`. Error responses are flat `{ code }`.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { computeProgress } from "../../common/derive/compass-progress";
import type { PrismaService } from "../../database";
import type { DashboardOverview } from "@pekulo/validators";
import { createDashboardModule } from "./dashboard.module";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function signFor(userId: string): Promise<string> {
  return new SignJWT({ email: `${userId}@pekulo.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));
}

let app: ReturnType<typeof buildApp>;
let baseUrl: string;

function buildApp() {
  const dashboardModule = createDashboardModule({
    listAccounts: async () => [],
    listHoldings: async () => [],
    resolveQuote: async () => {
      throw new Error("no holdings");
    },
    getRates: async () => ({
      base: "EUR",
      date: "2026-06-04",
      rates: { EUR: 1, USD: 1, GBP: 1, CHF: 1 },
    }),
    getTotalEquity: async () => ({ totalEquityEur: 250_000 }),
    getCompass: async () => ({ objectif: 800_000 }),
    listRecentActivity: async () => [],
    getHypothesisProjection: async () => ({
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 30,
      points: [{ year: 0, eur: 60_000 }],
      finalEur: 700_000,
    }),
    computeProgress,
    // getOverview never touches the layout repo — a bare client stub is enough.
    prismaService: { client: {} } as unknown as PrismaService,
  });
  const orpcRouter = { dashboard: dashboardModule.router } as unknown as PekuloRpcRouter;
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const instance = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(instance, { jwtVerifier, orpcRouter });
  return instance;
}

beforeAll(() => {
  app = buildApp();
  app.listen({ port: 0 });
  const port = app.server?.port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.stop();
});

describe("dashboard /rpc/v1/dashboard/getOverview", () => {
  test("AC-6 — 200 + valid overview for an authenticated user", async () => {
    const token = await signFor(USER);
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getOverview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: DashboardOverview };
    expect(body.json.totalWealthEur).toBe(250_000);
    // Investable wealth (cash + market value) is 0 here — only real-estate
    // equity (250 000, EXCLUDED from the cap) exists → 0 % progress.
    expect(body.json.compass).toEqual({
      percent: 0,
      objectif: 800_000,
      gap: 800_000,
      currentWealth: 0,
    });
    expect(body.json.fx.source).toBe("live");
  });

  test("AC-6 — 401 without a JWT", async () => {
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getOverview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    expect(res.status).toBe(401);
  });

  test("getHypothesisGap round-trips the gap over the oRPC HTTP boundary", async () => {
    const token = await signFor(USER);
    const res = await fetch(`${baseUrl}/rpc/v1/dashboard/getHypothesisGap`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ json: { currentWealthEur: 60_000 } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      json: { requiredFinalEur: number; projectedFinalEur: number; reachesCap: boolean };
    };
    expect(body.json.requiredFinalEur).toBe(800_000);
    expect(body.json.projectedFinalEur).toBe(700_000);
    expect(body.json.reachesCap).toBe(false);
  });
});
