import { afterEach, describe, expect, test } from "bun:test";
import { createBrandfetchClient } from "./brandfetch-client";
import type { Env } from "../../../config/env";

const baseEnv = {
  BRANDFETCH_API_KEY: "test-key",
  BRANDFETCH_SEARCH_BASE: "https://api.brandfetch.io/v2/search",
  BRANDFETCH_LOGO_BASE: "https://cdn.brandfetch.io",
  BRANDFETCH_LOGO_CLIENT_ID: "cid",
} as unknown as Env;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// AC-1 (verbatim from story 6-10-merchant-logos:38):
//   Given a Bridge-sourced transaction whose merchant is recognised, When the
//   row renders, Then the merchant logo is shown (tier 1).
// AC-5 (verbatim from story 6-10-merchant-logos:42):
//   … A merchant that fails to resolve is remembered as "no logo" and not
//   looked up again before its refresh window elapses. (Here: a miss/timeout
//   resolves to null so the caller can negative-cache it.)
describe("brandfetch-client (story 6-10 / FR-65)", () => {
  test("returns the top hit's icon on a 200", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([{ name: "Carrefour", domain: "carrefour.fr", icon: "https://x/c.png" }]),
        { status: 200 },
      )) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("carrefour")).toBe("https://x/c.png");
  });

  test("returns null on non-2xx (negative-cacheable)", async () => {
    globalThis.fetch = (async () =>
      new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("unknownmerchant")).toBeNull();
  });

  test("returns null (never throws) on a thrown fetch / timeout", async () => {
    globalThis.fetch = (async () => {
      throw new Error("TimeoutError");
    }) as unknown as typeof fetch;
    const c = createBrandfetchClient({ env: baseEnv });
    expect(await c.resolveLogoUrl("slow")).toBeNull();
  });

  test("no-op (null) when the API key is unconfigured", async () => {
    const c = createBrandfetchClient({
      env: { ...baseEnv, BRANDFETCH_API_KEY: undefined } as unknown as Env,
    });
    expect(await c.resolveLogoUrl("carrefour")).toBeNull();
  });
});
