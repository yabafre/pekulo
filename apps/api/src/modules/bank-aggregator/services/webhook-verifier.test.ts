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

// Fixture timestamp pinned to a known epoch ; tests inject `nowMs` to keep the
// pair within the MAX_REPLAY_AGE_SECONDS window without coupling to wall-clock.
const TS = 1700000000;
const NOW_MS = TS * 1000;

function makeHeader(body: Uint8Array, secret: string, ts = String(TS)): string {
  const hex = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
  return `t=${ts},v1=${hex}`;
}

test("valid v1 signature passes", () => {
  const body = new TextEncoder().encode(JSON.stringify({ type: "item.refreshed" }));
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET),
    secrets: [SECRET],
    nowMs: NOW_MS,
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
    header: `t=${TS},v1=deadbeef`,
    secrets: [SECRET],
    nowMs: NOW_MS,
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
    nowMs: NOW_MS,
  });
  expect(result.valid).toBe(true);
});

test("multiple v1 signatures — one valid is enough", () => {
  const body = new TextEncoder().encode("multi");
  const validHex = createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: `t=${TS},v1=deadbeef,v1=${validHex}`,
    secrets: [SECRET],
    nowMs: NOW_MS,
  });
  expect(result.valid).toBe(true);
});

// Story 5-6 post-review aped-review — replay defense
test("timestamp older than MAX_REPLAY_AGE_SECONDS is rejected (replay defense)", () => {
  const body = new TextEncoder().encode("replay");
  const result = verifyBridgeSignature({
    rawBody: body,
    header: makeHeader(body, SECRET),
    secrets: [SECRET],
    // 10 minutes after the signed timestamp ⇒ 600 s > 300 s budget.
    nowMs: NOW_MS + 600_000,
  });
  expect(result.valid).toBe(false);
  expect(result.reason).toBe("timestamp-too-old");
});
