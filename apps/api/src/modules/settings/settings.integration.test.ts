// oRPC HTTP-boundary proof for the settings module (story 8-2). Mirrors
// milestones/dashboard.integration.test.ts: boots a real Elysia app with the
// real mountOrpc + RPCHandler + jose HS256 verifier + the real settings routes,
// pointed at an in-memory service keyed by userId.
//
// Why a stub service (no real DB): the repo's integration-test convention is a
// boundary test (every sibling *.integration.test.ts stubs the data layer).
// The repository's `where: { userId }` guard is enforced by the
// pekulo/no-prisma-query-without-user-id lint rule; AC-7 (RLS, exactly 3
// policies) is asserted by the live `db:rls-audit` probe (T4), not here.
//
// What this catches that the service unit test doesn't:
//   - JWT verification gates every procedure (AC-6 first-render auth gate / NFR-9)
//   - The userId flows from the verified JWT subject → handler → service (AC-8)
//   - The oRPC RPC envelope round-trips ({ json: ... } on ingress and egress)
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type { UserPref } from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { PekuloError } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { createSettingsRouter } from "./settings.routes";
import { DEFAULT_USER_PREF, type SettingsService } from "./settings.service";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
// RFC 4122 v4 — version nibble `4`, variant nibble `8`.
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// PORT_BASE picked clear of sibling suites (hypothesis 13900, accounts 14160,
// holdings 14500, compass 14700, milestones 14900).
const PORT_BASE = 15100;

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

// In-memory mirror of the Prisma-backed service: per-userId store with the
// getOrCreate-default read the real service performs (settings.service.ts).
const erased: string[] = [];
// Flipped by the AC-6 boundary test: the in-memory service then behaves like
// a service whose provider erasure failed, before any local row is touched.
let providerDown = false;
// Flipped by the ACCOUNT_PARTIALLY_ERASED boundary test: the data is gone,
// the identity is not — the one state that is neither done nor untouched.
let identityDown = false;

function inMemorySettingsService(): SettingsService {
  const rows = new Map<string, UserPref>();
  return {
    async get(userId) {
      return rows.get(userId) ?? { ...DEFAULT_USER_PREF };
    },
    async updateTheme(userId, theme) {
      const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), theme };
      rows.set(userId, next);
      return next;
    },
    async updateLang(userId, lang) {
      const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), lang };
      rows.set(userId, next);
      return next;
    },
    // Story 11-2. Mirrors the real service's confirmation rule so the boundary
    // test proves the rule survives the RPC envelope, and records which users
    // were erased so tenant isolation is assertable.
    async deleteAccount(userId, sessionEmail, input) {
      if (
        !sessionEmail ||
        sessionEmail.trim().toLowerCase() !== input.confirmationEmail.trim().toLowerCase()
      ) {
        throw new PekuloError("FORBIDDEN", "confirmation email does not match");
      }
      if (providerDown) {
        throw new PekuloError(
          "BANK_PROVIDER_UNAVAILABLE",
          "bank provider unavailable: bridge DELETE → 503",
        );
      }
      rows.delete(userId);
      erased.push(userId);
      if (identityDown) {
        throw new PekuloError(
          "ACCOUNT_PARTIALLY_ERASED",
          "account data was erased but the identity could not be removed",
        );
      }
      return { ok: true as const, rowsDeleted: { accounts: 1 }, vaultSecretsPurged: 0 };
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

async function call(method: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/rpc/v1/settings/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: body }),
  });
}

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const router = createSettingsRouter({ service: inMemorySettingsService() });
  const orpcRouter: PekuloRpcRouter = { settings: router };
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

describe("settings /rpc/v1/settings HTTP boundary", () => {
  // AC-6 (verbatim from story 8-2-theme-language-prefs:24):
  //   Given I changed theme + language on device A and the choice was persisted
  //   server-side, When I authenticate on device B with empty local storage and
  //   cookies, Then my last theme + language are applied on the first
  //   authenticated render.
  test("AC-6 — get returns the {system, fr} defaults before any write", async () => {
    const res = await call("get", {}, await signFor(USER_A));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: UserPref };
    expect(body.json).toEqual({ theme: "system", lang: "fr" });
  });

  test("AC-6 — updateTheme then get round-trips the persisted theme", async () => {
    const token = await signFor(USER_A);
    const put = await call("updateTheme", { theme: "dark" }, token);
    expect(put.status).toBe(200);
    expect(((await put.json()) as { json: UserPref }).json).toEqual({ theme: "dark", lang: "fr" });
    // Device-B-style fresh read returns the persisted choice.
    const got = await call("get", {}, token);
    expect(((await got.json()) as { json: UserPref }).json).toEqual({ theme: "dark", lang: "fr" });
  });

  test("AC-6 — updateLang persists the language alongside the theme", async () => {
    const token = await signFor(USER_A);
    const put = await call("updateLang", { lang: "en" }, token);
    expect(((await put.json()) as { json: UserPref }).json).toEqual({ theme: "dark", lang: "en" });
  });

  // AC-8 (verbatim from story 8-2-theme-language-prefs:26):
  //   Given two distinct users A and B, When user A reads their preferences,
  //   Then A receives only A's preferences and never B's.
  test("AC-8 — user B's get never returns user A's persisted row", async () => {
    // A has written {dark, en} above; B has never written → B reads defaults.
    const res = await call("get", {}, await signFor(USER_B));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { json: UserPref }).json).toEqual({
      theme: "system",
      lang: "fr",
    });
  });

  test("AC-6 — get without a JWT returns 401 (NFR-9 auth gate)", async () => {
    const res = await call("get", {});
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("UNAUTHORIZED");
  });
});

describe("settings.deleteAccount HTTP boundary (story 11-2)", () => {
  // The signer in this file puts `${userId}@pekulo.local` in the email claim,
  // so that string is what a correct confirmation must carry.
  const emailOf = (userId: string) => `${userId}@pekulo.local`;

  // AC-7 (verbatim from story 11-2-account-deletion:20):
  //   Given a call to settings.deleteAccount with no Authorization header or
  //   an invalid Bearer token, Then apps/api answers 401 and no Prisma query
  //   runs.
  test("AC-7 — deleteAccount without a JWT returns 401 and erases nobody", async () => {
    const before = erased.length;
    const res = await call("deleteAccount", { confirmationEmail: emailOf(USER_A) });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("UNAUTHORIZED");
    expect(erased.length).toBe(before);
  });

  test("AC-7 — a mismatched confirmation email returns 403 and erases nobody", async () => {
    const before = erased.length;
    const res = await call(
      "deleteAccount",
      { confirmationEmail: "someone@else.test" },
      await signFor(USER_A),
    );
    expect(res.status).toBe(403);
    expect(erased.length).toBe(before);
  });

  // AC-3 (verbatim from story 11-2-account-deletion:16):
  //   Given two users A and B […] When A deletes their account, Then not one
  //   row belonging to B is removed […]
  test("AC-3 — A's deletion erases A and only A, keyed by the verified JWT subject", async () => {
    const res = await call(
      "deleteAccount",
      { confirmationEmail: emailOf(USER_A) },
      await signFor(USER_A),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { ok: true; rowsDeleted: Record<string, number> } };
    expect(body.json.ok).toBe(true);
    expect(body.json.rowsDeleted).toEqual({ accounts: 1 });
    expect(erased).toEqual([USER_A]);
    expect(erased).not.toContain(USER_B);
  });

  // AC-6 (verbatim from story 11-2-account-deletion:19):
  //   […] And given that provider call fails, Then no local row is deleted,
  //   the Supabase Auth user is untouched, and the caller receives a
  //   `BANK_PROVIDER_UNAVAILABLE` error.
  test("AC-6 — a provider failure surfaces as 503 BANK_PROVIDER_UNAVAILABLE, not 500", async () => {
    const { isORPCErrorJson } = await import("@orpc/client");
    const before = [...erased];
    providerDown = true;
    try {
      const res = await call(
        "deleteAccount",
        { confirmationEmail: emailOf(USER_B) },
        await signFor(USER_B),
      );
      expect(res.status).toBe(503);
      const inner = ((await res.json()) as { json: unknown }).json;
      expect(isORPCErrorJson(inner)).toBe(true);
      expect((inner as { code: string }).code).toBe("BANK_PROVIDER_UNAVAILABLE");
      expect(erased).toEqual(before);
    } finally {
      providerDown = false;
    }
  });

  test("an identity-erase failure surfaces as 500 ACCOUNT_PARTIALLY_ERASED with its code intact", async () => {
    // aped-review 11-2. Without the contract declaring this code, oRPC
    // collapsed it to an anonymous 500 and the web tier could only say
    // "nothing was deleted" — false: every row is gone at this point.
    const { isORPCErrorJson } = await import("@orpc/client");
    identityDown = true;
    try {
      const res = await call(
        "deleteAccount",
        { confirmationEmail: emailOf(USER_B) },
        await signFor(USER_B),
      );
      expect(res.status).toBe(500);
      const inner = ((await res.json()) as { json: unknown }).json;
      expect(isORPCErrorJson(inner)).toBe(true);
      expect((inner as { code: string }).code).toBe("ACCOUNT_PARTIALLY_ERASED");
      expect(erased).toContain(USER_B);
    } finally {
      identityDown = false;
    }
  });

  test("AC-7 — A cannot delete B by naming B's email: the subject wins", async () => {
    // The confirmation names the account; the JWT subject decides which
    // account is destroyed. A token for A carrying B's email must fail the
    // confirmation rather than reach B.
    const before = [...erased];
    const res = await call(
      "deleteAccount",
      { confirmationEmail: emailOf(USER_B) },
      await signFor(USER_A),
    );
    expect(res.status).toBe(403);
    expect(erased).toEqual(before);
  });
});
