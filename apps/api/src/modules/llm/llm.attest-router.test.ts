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
    route: async () => ({ callId: "x", route: "ollama", labelHash: "x", providerCall: null }),
    categorise: async () => ({ callId: "x", route: "ollama", category: null, confidence: 0 }),
    recordLlmCall: async (userId, event) => {
      events.push({ userId, event });
    },
    recordLlmCallPair: async (userId, pair) => {
      for (const event of pair) events.push({ userId, event });
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
  // No prompt body reaches the audit — only the allowlisted digest fields.
  for (const { event } of events) {
    expect(Object.keys(event)).not.toContain("label");
    expect(Object.keys(event)).not.toContain("merchant");
    expect(Object.keys(event)).not.toContain("envelope");
  }
});

test("400 when the client forges a non-FoundationModels route (ADR-0008 audit integrity)", async () => {
  // The attest endpoint is FM-only; a client must not be able to inject an
  // `ollama`/`third_party` row into the append-only audit (architecture L307).
  const { service, events } = makeService();
  const app = createLlmAttestRouter({ jwtVerifier: okVerifier, service });
  for (const forged of ["ollama", "third_party"]) {
    const res = await app.handle(
      new Request("http://localhost/internal/llm/attest", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer good" },
        body: JSON.stringify({ ...validBody, route: forged }),
      }),
    );
    expect(res.status).toBe(400);
  }
  // Nothing was written for the forged routes.
  expect(events).toHaveLength(0);
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
