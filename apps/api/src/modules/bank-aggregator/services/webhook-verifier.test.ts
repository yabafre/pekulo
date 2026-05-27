// AC-3 (verbatim from story 5-6-bridge-connector):
//   Given a POST /internal/bridge/webhook with an invalid BridgeApi-Signature
//   (missing header, no v1=, mismatched HMAC, downgrade attempt with v0=-only),
//   the response is HTTP 401 within < 100 ms, no BankConnection mutates,
//   no payload bytes reach any log line or OTel span. NFR-33.
//
// These tests pin the PURE verifier — the Elysia router perf budget is asserted
// in bridge-webhook-router.test.ts (T12). Six cases: 1 happy + 5 rejection
// (missing header, downgrade, mismatch, rotation overlap, multi-v1).

import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyBridgeSignature } from "./webhook-verifier";

// Synthetic test-only HMAC keys — never used in production. Low entropy +
// "fake" prefix so gitleaks doesn't misread them as a generic-api-key.
const SECRET = "fake-aaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_PREVIOUS = "fake-bbbbbbbbbbbbbbbbbbbbbbbbb";

function makeHeader(body: Uint8Array, secret: string, ts = "1700000000"): string {
  const hex = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
  return `t=${ts},v1=${hex}`;
}

test("valid v1 signature passes", () => {
  const body = new TextEncoder().encode(JSON.stringify({ type: "item.refreshed" }));
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET),
    secrets: [SECRET],
  });
  expect(result.valid).toBe(true);
});

test("missing header is rejected", () => {
  const body = new TextEncoder().encode("x");
  const result = verifyBridgeSignature({ rawBody: body, header: null, secrets: [SECRET] });
  expect(result).toEqual({ valid: false, reason: "missing-header" });
});

test("no-v1 scheme (downgrade attempt) is rejected", () => {
  const body = new TextEncoder().encode("x");
  const hex = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: `t=1700000000,v0=${hex}`,
    secrets: [SECRET],
  });
  expect(result.valid).toBe(false);
  expect(result.reason).toBe("no-v1-signatures");
});

test("signature mismatch is rejected", () => {
  const body = new TextEncoder().encode("x");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: "t=1700000000,v1=deadbeef",
    secrets: [SECRET],
  });
  expect(result.valid).toBe(false);
  expect(result.reason).toBe("signature-mismatch");
});

test("rotation overlap — previous secret still validates", () => {
  const body = new TextEncoder().encode("rotation");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET_PREVIOUS),
    secrets: [SECRET, SECRET_PREVIOUS],
  });
  expect(result.valid).toBe(true);
});

test("multiple v1 signatures — one valid is enough", () => {
  const body = new TextEncoder().encode("multi");
  const validHex = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: `t=1700000000,v1=deadbeef,v1=${validHex}`,
    secrets: [SECRET],
  });
  expect(result.valid).toBe(true);
});
