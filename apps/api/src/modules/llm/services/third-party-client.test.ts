// bun:test — third-party transport client (story 6-1).
import { test, expect, mock, afterEach } from "bun:test";
import type { Env } from "../../../config/env";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { createThirdPartyClient } from "./third-party-client";
import { isPekuloError } from "../../../common/errors";

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

test("throws LLM_PROVIDER_UNAVAILABLE when no API key is configured", async () => {
  const client = createThirdPartyClient({ env: {} as unknown as Env });
  try {
    await client.complete(envelope);
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
  const out = await client.complete(envelope);
  expect(out.raw).toBe("transport");
});
