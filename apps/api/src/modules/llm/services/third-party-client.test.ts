// bun:test — third-party transport client (story 6-1; updated 6-2 → prompt string).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import { createThirdPartyClient } from "./third-party-client";
import { isPekuloError } from "../../../common/errors";

const prompt = "categorise: Carrefour -42.5 EUR 2026-05-15";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("throws LLM_PROVIDER_UNAVAILABLE when no API key is configured", async () => {
  const client = createThirdPartyClient({ env: {} as unknown as Env });
  try {
    await client.complete(prompt);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});

test("returns raw text on an OpenAI-compatible 200 response + sends Bearer auth", async () => {
  // Object capture (not a `let x = null`) so TS keeps the type `string | null`
  // rather than control-flow-narrowing it to `null` at the assert site.
  const seen: { authorization: string | null } = { authorization: null };
  globalThis.fetch = mock(async (_url: string | URL, init?: RequestInit) => {
    seen.authorization = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ choices: [{ message: { content: "transport" } }] }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
  const client = createThirdPartyClient({
    env: { THIRD_PARTY_LLM_API_KEY: "sk-test" } as unknown as Env,
  });
  const out = await client.complete(prompt);
  expect(out.raw).toBe("transport");
  expect(seen.authorization).toBe("Bearer sk-test");
});

// AC-6 (story 6-2) — the hard timeout (THIRD_PARTY_TIMEOUT_MS) bounds a slow
// model: the AbortController fires → fetch rejects with an AbortError → the
// client maps it to LLM_PROVIDER_UNAVAILABLE rather than hanging the caller.
test("AC-6: an aborted fetch (hard timeout) maps to LLM_PROVIDER_UNAVAILABLE", async () => {
  globalThis.fetch = mock(async () => {
    throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  }) as unknown as typeof fetch;
  const client = createThirdPartyClient({
    env: { THIRD_PARTY_LLM_API_KEY: "sk-test" } as unknown as Env,
  });
  try {
    await client.complete(prompt);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});
