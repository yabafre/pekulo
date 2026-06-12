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

      // Async dispatch (audit 2026-06-12): respond 204 IMMEDIATELY after HMAC +
      // parse/validation, then process the event in the background. A full
      // refresh can drain up to 100 pages × ~10 s; awaiting it here made Bridge
      // time out (their webhook receiver budget is seconds, not minutes) and
      // RE-DELIVER, which spawned concurrent refresh runs for the same item.
      // The 204 is the ACK Bridge needs to stop retrying. The service coalesces
      // concurrent deliveries per providerItemId internally, and we attach a
      // catch so a background failure is logged (not an unhandled rejection)
      // rather than surfaced to Bridge — they already got their 204.
      void service.handleWebhookEvent(event).catch((err) => {
        console.warn(
          `[bridge-webhook] background dispatch failed: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        );
      });
      return new Response(null, { status: 204 });
    });
}
