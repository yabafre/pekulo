// bun:test — /internal/llm/attest listener (story 6-1, AC-1/AC-4).
import { test, expect } from "bun:test";
import type { JwtVerifier } from "../../platform/security";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmService } from "./llm.service";
import { createLlmAttestRouter } from "./llm.attest-router";

const okVerifier: JwtVerifier = {
  verify: async () => ({ sub: "u1", email: "f@bonjour.email" }),
} as unknown as JwtVerifier;
const failVerifier: JwtVerifier = {
  verify: async () => {
    throw new Error("bad token");
  },
} as unknown as JwtVerifier;

function makeService() {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const service: LlmService = {
    route: async () => ({ callId: "x", route: "ollama", providerCall: null }),
    recordLlmCall: async (userId, event) => {
      events.push({ userId, event });
    },
  };
  return { service, events };
}

const validBody = {
  callId: "call_1",
  route: "foundation_models",
  latencyMs: 480,
  outcome: "success",
  labelHash: "abcd1234",
};

test("401 when the JWT is missing/invalid", async () => {
  const { service } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: failVerifier, service });
  const res = await app.handle(
    new Request("http://localhost/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer bad" },
      body: JSON.stringify(validBody),
    }),
  );
  expect(res.status).toBe(401);
});

test("204 + writes the intent→outcome pair on a valid attestation (AC-4)", async () => {
  const { service, events } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: okVerifier, service });
  const res = await app.handle(
    new Request("http://localhost/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good" },
      body: JSON.stringify(validBody),
    }),
  );
  expect(res.status).toBe(204);
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(events[0]!.event.route).toBe("foundation_models");
});

test("400 on a malformed attestation body", async () => {
  const { service } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: okVerifier, service });
  const res = await app.handle(
    new Request("http://localhost/internal/llm/attest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good" },
      body: JSON.stringify({ callId: "c1" }),
    }),
  );
  expect(res.status).toBe(400);
});
