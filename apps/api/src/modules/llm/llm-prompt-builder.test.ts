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

test("the ASCII worst-case maximal envelope stays within the 2 kb cap (NFR-12)", () => {
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

test("a multibyte envelope at the character caps can exceed the 2 kb byte cap (NFR-12)", () => {
  // "中" is 1 UTF-16 code unit (passes .max(512)/.max(256)) but 3 UTF-8 bytes,
  // so the byte cap — the authoritative NFR-12 guard — must reject it. This is
  // the TRUE worst case the ASCII test above does not exercise.
  expect(() =>
    buildPromptEnvelope({
      label: "中".repeat(512),
      amount: -999999.99,
      currency: "EUR",
      occurredOn: "2026-05-15",
      merchant: "中".repeat(256),
    }),
  ).toThrow(/exceeds 2048B cap/);
});

test("rejects a regex-valid but non-real calendar date (occurredOn)", () => {
  for (const bad of ["2026-13-45", "2026-02-30", "0000-00-00"]) {
    expect(() =>
      buildPromptEnvelope({ label: "x", amount: 1, currency: "EUR", occurredOn: bad }),
    ).toThrow();
  }
  // sanity: a real date still passes
  expect(
    buildPromptEnvelope({ label: "x", amount: 1, currency: "EUR", occurredOn: "2026-02-28" })
      .occurredOn,
  ).toBe("2026-02-28");
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
