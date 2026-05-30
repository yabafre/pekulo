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

test("returns raw text on a 200 response when keyed", async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ content: [{ text: "transport" }] }), { status: 200 }),
  ) as unknown as typeof fetch;
  const client = createThirdPartyClient({
    env: { THIRD_PARTY_LLM_API_KEY: "sk-test" } as unknown as Env,
  });
  const out = await client.complete(prompt);
  expect(out.raw).toBe("transport");
});
