// apps/api/src/modules/bank-aggregator/services/webhook-verifier.ts
// Pure HMAC-SHA256 verifier for Bridge webhook signatures (story 5-6, NFR-33).
//
// Bridge sends `BridgeApi-Signature: t=<ts>,v1=<hex>[,v1=<hex_during_rotation>]`.
// Multiple v1 entries during the 24h rotation window (max 2 active secrets).
// Non-v1 schemes (v0, v2, …) are silently dropped — downgrade-attack defense.
// Timing-safe equality via node:crypto.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export function verifyBridgeSignature(args: {
  rawBody: Uint8Array;
  header: string | null;
  secrets: string[]; // current + previous (during 24h rotation)
}): VerifyResult {
  const { rawBody, header, secrets } = args;

  if (!header) return { valid: false, reason: "missing-header" };
  if (secrets.length === 0) return { valid: false, reason: "no-secrets-configured" };

  const parts = header.split(",").map((p) => p.trim());
  const v1Hexes: string[] = [];
  for (const part of parts) {
    const [scheme, hex] = part.split("=");
    if (scheme === "v1" && hex) v1Hexes.push(hex);
  }
  if (v1Hexes.length === 0) return { valid: false, reason: "no-v1-signatures" };

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
