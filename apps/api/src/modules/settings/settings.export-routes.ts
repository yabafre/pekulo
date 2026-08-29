// apps/api/src/modules/settings/settings.export-routes.ts
// Story 11-1 (FR-49 / NFR-6 / NFR-30). GET /v1/export — authenticated,
// streaming GDPR export. Elysia-native, NOT oRPC: the body is a stream, not
// an RPC envelope (same rationale as logos.routes.ts). Returns an inferred
// chain — never annotate it as `Elysia` (lesson 2026-05-04).
//
// Auth: requireUserContext() is the single chokepoint (Headers → {userId}).
// It throws PekuloError("UNAUTHORIZED") before any Prisma call, which the
// app-level .onError maps to 401 (AC-6).
import { Elysia } from "elysia";
import { requireUserContext, type JwtVerifier } from "../../platform/security";
import type { ExtendedPrismaClient } from "../../database";
import { streamUserDataExport } from "./settings.export";

export function registerSettingsExportRoutes(deps: {
  client: ExtendedPrismaClient;
  jwtVerifier: JwtVerifier;
}) {
  return new Elysia({ name: "settings-export" }).get("/v1/export", async ({ request }) => {
    // Throws UNAUTHORIZED before a single row is read.
    const { userId, email } = await requireUserContext(request.headers, deps.jwtVerifier);

    const encoder = new TextEncoder();
    const generator = streamUserDataExport(deps.client, { userId, email });
    // Correlates the stdout line below with the transfer, since the app-level
    // .onError can no longer see anything once the 200 is on the wire.
    const requestId = crypto.randomUUID();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await generator.next();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(value));
        } catch (err) {
          // Status 200 + headers flushed with the FIRST chunk, so this can
          // never become a 5xx. Without this catch the rejection surfaced as
          // an unhandled error on stderr, bypassed the app-level .onError
          // (no requestId, no errorCode), and left the OTel span already
          // closed OK/200 — a failed GDPR export that looked like a success.
          // Found in aped-review of story 11-1.
          //
          // The client-side signal stays weak by construction: on this runtime
          // controller.error() does not raise a read error in the consumer, so
          // the only guarantee is that a truncated document is not valid JSON.
          // The log line is what makes the failure visible to ops.
          console.error(
            JSON.stringify({
              event: "export.stream_failed",
              requestId,
              route: "GET /v1/export",
              reasonClass: err instanceof Error ? err.constructor.name : typeof err,
            }),
          );
          // Finalise the generator so its `finally` blocks run — `cancel()` is
          // NOT invoked on the error path.
          await generator.return(undefined).catch(() => {});
          controller.error(err);
        }
      },
      async cancel() {
        await generator.return(undefined);
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // No filename here — apps/web's proxy owns the user-facing filename.
        "cache-control": "no-store",
      },
    });
  });
}
