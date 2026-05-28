// apps/api/src/modules/bank-aggregator/services/bridge-webhook-router.ts
// Elysia router for /internal/bridge/webhook. Raw body capture via onParse so
// HMAC verification operates on unparsed bytes (Bridge docs are explicit:
// "It is mandatory to use the raw request body").
//
// AC-3 invariant: 401 within 100 ms on invalid signature, zero DB writes,
// zero payload bytes in logs. We log only the request id + signature result.
// AC-9 invariant: body > 256 KB → 413 fast-path before HMAC.

import { Elysia } from "elysia";
import type { Env } from "../../../config/env";
import type { BankAggregatorService } from "../bank-aggregator.service";
import { verifyBridgeSignature } from "./webhook-verifier";

const MAX_WEBHOOK_BYTES = 256_000;

export function createBridgeWebhookRouter(args: { env: Env; service: BankAggregatorService }) {
  const { env, service } = args;
  const secrets: string[] = [];
  if (env.BRIDGE_WEBHOOK_SIGNING_SECRET) secrets.push(env.BRIDGE_WEBHOOK_SIGNING_SECRET);
  if (env.BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS) {
    secrets.push(env.BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS);
  }

  return new Elysia({ name: "bridge-webhook" })
    .onParse(async ({ request, contentType }) => {
      // Capture raw body for HMAC. Return the buffer so handlers receive `body`
      // as a Uint8Array. We do NOT parse JSON here — verification first.
      if (contentType?.startsWith("application/json")) {
        const buf = new Uint8Array(await request.arrayBuffer());
        return buf;
      }
    })
    .post("/internal/bridge/webhook", async ({ body, headers, set }) => {
      const startedAt = performance.now();
      const rawBody = body instanceof Uint8Array ? body : new Uint8Array();

      if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
        set.status = 413;
        return new Response(null, { status: 413 });
      }

      const result = verifyBridgeSignature({
        rawBody,
        header: headers["bridgeapi-signature"] ?? null,
        secrets,
      });

      if (!result.valid) {
        set.status = 401;
        const elapsed = performance.now() - startedAt;
        console.warn(`[bridge-webhook] reject ${result.reason} in ${elapsed.toFixed(2)} ms`);
        return new Response(null, { status: 401 });
      }

      // Parse JSON AFTER verify. A valid HMAC over malformed JSON is a Bridge
      // bug — return 400 so they retry rather than silently failing the dispatch.
      let event: unknown;
      try {
        event = JSON.parse(new TextDecoder().decode(rawBody));
      } catch {
        set.status = 400;
        return new Response(null, { status: 400 });
      }

      await service.handleWebhookEvent(event);
      return new Response(null, { status: 204 });
    });
}
