// apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts
// Pure HMAC-SHA256 verifier for Bridge webhook signatures (story 5-6, NFR-33).
//
// Bridge sends `BridgeApi-Signature: t=<ts>,v1=<hex>[,v1=<hex_during_rotation>]`.
// Multiple v1 entries during the 24h rotation window (max 2 active secrets).
// Non-v1 schemes (v0, v2, …) are silently dropped — downgrade-attack defense.
// Timing-safe equality via node:crypto.
//
// Replay defense (audit 2026-06-12): `t=<unix_ts>` is the timestamp Bridge
// attached to the signed payload. It is MANDATORY — a request with no `t=` (or
// an unparseable one) is rejected, and a request whose `t` differs from the
// receiver clock by more than MAX_REPLAY_AGE_SECONDS is rejected. Mirrors
// Stripe's pattern; closes the replay-by-stripping-`t=` hole.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export const MAX_REPLAY_AGE_SECONDS = 300; // 5 minutes

export function verifyBridgeSignature(args: {
  rawBody: Uint8Array;
  header: string | null;
  secrets: string[]; // current + previous (during 24h rotation)
  nowMs?: number; // injectable for tests
}): VerifyResult {
  const { rawBody, header, secrets } = args;

  if (!header) return { valid: false, reason: "missing-header" };
  if (secrets.length === 0) return { valid: false, reason: "no-secrets-configured" };

  const parts = header.split(",").map((p) => p.trim());
  const v1Hexes: string[] = [];
  let tsSeconds: number | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const scheme = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (scheme === "v1" && value) v1Hexes.push(value);
    if (scheme === "t" && value) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) tsSeconds = parsed;
    }
  }
  if (v1Hexes.length === 0) return { valid: false, reason: "no-v1-signatures" };

  // Replay defense (audit 2026-06-12) — the `t=` timestamp is now MANDATORY.
  // Bridge fixes the signed payload schema (we cannot make it sign `t`), so the
  // only lever against a captured-and-replayed webhook is: require `t=` and
  // reject anything outside the freshness window. The previous impl tolerated a
  // missing `t=` for back-compat, which let an attacker strip `t=` and replay a
  // captured request forever (the HMAC over the body alone stays valid). We now
  // reject a missing/unparseable `t=` outright, then reject a stale timestamp.
  if (tsSeconds === null) return { valid: false, reason: "missing-timestamp" };
  const now = args.nowMs ?? Date.now();
  const ageSec = Math.abs(now / 1000 - tsSeconds);
  if (ageSec > MAX_REPLAY_AGE_SECONDS) {
    return { valid: false, reason: "timestamp-too-old" };
  }

  for (const secret of secrets) {
    const expectedHex = createHmac("sha256", secret).update(Buffer.from(rawBody)).digest("hex");
    const expected = Buffer.from(expectedHex, "hex");
    for (const received of v1Hexes) {
      let receivedBuf: Buffer;
      try {
        receivedBuf = Buffer.from(received, "hex");
      } catch {
        continue;
      }
      if (receivedBuf.length !== expected.length) continue;
      if (timingSafeEqual(expected, receivedBuf)) return { valid: true };
    }
  }

  return { valid: false, reason: "signature-mismatch" };
}
