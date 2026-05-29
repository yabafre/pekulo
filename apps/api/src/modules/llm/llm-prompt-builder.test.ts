// bun:test — NFR-12 prompt-builder guard (story 6-1, AC-3).
import { test, expect } from "bun:test";
import { llmPromptEnvelopeSchema } from "@pekulo/validators";
import { buildPromptEnvelope, hashLabel } from "./llm-prompt-builder";

test("strips a smuggled user identifier + account number (AC-3)", () => {
  const env = buildPromptEnvelope({
    label: "Carrefour",
    amount: -42.5,
    currency: "EUR",
    occurredOn: "2026-05-15",
    userId: "u_secret",
    accountNumber: "FR761234",
  });
  expect(env).toEqual({
    label: "Carrefour",
    amount: -42.5,
    currency: "EUR",
    occurredOn: "2026-05-15",
  });
  expect(Object.keys(env)).not.toContain("userId");
  expect(Object.keys(env)).not.toContain("accountNumber");
});

test("keeps the optional merchant when present", () => {
  const env = buildPromptEnvelope({
    label: "Billet",
    amount: 19.9,
    currency: "EUR",
    occurredOn: "2026-05-15",
    merchant: "SNCF",
  });
  expect(env.merchant).toBe("SNCF");
});

test("the worst-case maximal envelope stays within the 2 kb cap (NFR-12)", () => {
  const env = buildPromptEnvelope({
    label: "a".repeat(512),
    amount: -999999.99,
    currency: "EUR",
    occurredOn: "2026-05-15",
    merchant: "m".repeat(256),
  });
  const bytes = new TextEncoder().encode(JSON.stringify(env)).byteLength;
  expect(bytes).toBeLessThanOrEqual(2048);
});

test("the schema strictly rejects a non-allowlisted key (NFR-12)", () => {
  expect(() =>
    llmPromptEnvelopeSchema.parse({
      label: "x",
      amount: 1,
      currency: "EUR",
      occurredOn: "2026-05-15",
      userId: "u",
    }),
  ).toThrow();
});

test("hashLabel is stable and reveals no body", () => {
  expect(hashLabel("Carrefour")).toBe(hashLabel("Carrefour"));
  expect(hashLabel("Carrefour")).not.toContain("Carrefour");
});
