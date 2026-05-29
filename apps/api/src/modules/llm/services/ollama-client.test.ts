// bun:test — Ollama transport client (story 6-1).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { createOllamaClient } from "./ollama-client";
import { isPekuloError } from "../../../common/errors";

const fakeEnv = {
  OLLAMA_BASE_URL: "http://ollama.test",
  OLLAMA_MODEL: "test-model",
} as unknown as Env;
const envelope: LlmPromptEnvelope = {
  label: "Carrefour",
  amount: -42.5,
  currency: "EUR",
  occurredOn: "2026-05-15",
};
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("returns raw text + latency on a 200 response", async () => {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify({ response: "alimentation" }), { status: 200 }),
  ) as unknown as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  const out = await client.complete(envelope);
  expect(out.raw).toBe("alimentation");
  expect(out.latencyMs).toBeGreaterThanOrEqual(0);
});

test("throws LLM_PROVIDER_UNAVAILABLE on a non-2xx response", async () => {
  globalThis.fetch = mock(
    async () => new Response(null, { status: 502 }),
  ) as unknown as typeof fetch;
  const client = createOllamaClient({ env: fakeEnv });
  try {
    await client.complete(envelope);
    throw new Error("expected throw");
  } catch (err) {
    expect(isPekuloError(err) && err.code === "LLM_PROVIDER_UNAVAILABLE").toBe(true);
  }
});
