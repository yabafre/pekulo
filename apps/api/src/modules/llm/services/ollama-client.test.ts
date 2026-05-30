// bun:test — Ollama transport client (story 6-1; updated 6-2 → prompt string).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import { createOllamaClient } from "./ollama-client";
import { isPekuloError } from "../../../common/errors";

const fakeEnv = {
  OLLAMA_BASE_URL: "http://ollama.test",
  OLLAMA_MODEL: "test-model",
} as unknown as Env;
const prompt = "categorise: Carrefour -42.5 EUR 2026-05-15";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("returns raw text + latency on a 200 response", async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ response: "alimentation" }), { status: 200 }),
  ) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  const out = await client.complete(prompt);
  expect(out.raw).toBe("alimentation");
  expect(out.latencyMs).toBeGreaterThanOrEqual(0);
});

test("throws LLM_PROVIDER_UNAVAILABLE on a non-2xx response", async () => {
  globalThis.fetch = mock(async () => new Response(null, { status: 502 })) as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  try {
    await client.complete(prompt);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});
