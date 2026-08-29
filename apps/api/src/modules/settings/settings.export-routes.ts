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
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await generator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
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
