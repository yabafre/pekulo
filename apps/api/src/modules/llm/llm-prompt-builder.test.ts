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

// AC-4 (verbatim from story 6-10-merchant-logos:41):
//   Given a transaction that has a resolved logo, When it is sent for LLM
//   categorisation, Then the prompt contains only the transaction's label,
//   amount, currency, occurred-on date and optional merchant name — the logo
//   is never included (NFR-12).
// Regression guard: the allowlist pick + .strict() already strip logoUrl; this
// locks it so a future field add can't leak the proxy URL into a prompt.
test("FR-65/NFR-12 — a logoUrl on the source is stripped, never reaches the envelope", () => {
  const envelope = buildPromptEnvelope({
    label: "CB Carrefour",
    amount: 12.5,
    currency: "EUR",
    occurredOn: "2026-06-01",
    // smuggled field — must be dropped by the allowlist + .strict()
    logoUrl: "/v1/logos?ref=bXNvbWV0aGluZw",
    merchant: "Carrefour",
  });
  expect(JSON.stringify(envelope)).not.toContain("logoUrl");
  expect(JSON.stringify(envelope)).not.toContain("/v1/logos");
  expect(envelope).toEqual({
    label: "CB Carrefour",
    amount: 12.5,
    currency: "EUR",
    occurredOn: "2026-06-01",
    merchant: "Carrefour",
  });
});
