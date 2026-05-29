// apps/api/src/modules/llm/llm.attest-router.ts
// Elysia-native private listener for iOS FoundationModels attestation
// (ADR-0008). JWT-verified (NOT oRPC). The server is the audit authority: it
// writes BOTH the intent and outcome rows for client-initiated FM calls. The
// durable client-side retry queue ships in story 6-6. Mounted in app.ts BEFORE
// mountOrpc (parity with the Bridge webhook). L8: inferred return type.
import { Elysia } from "elysia";
import { attestLlmCallSchema } from "@pekulo/validators";
import { requireUserContext, type JwtVerifier } from "../../platform/security";
import type { LlmService } from "./llm.service";

export function createLlmAttestRouter(deps: { jwtVerifier: JwtVerifier; service: LlmService }) {
  return new Elysia({ name: "llm-attest" }).post(
    "/internal/llm/attest",
    async ({ request, body, set }) => {
      let ctx;
      try {
        ctx = await requireUserContext(request.headers, deps.jwtVerifier);
      } catch {
        set.status = 401;
        return new Response(null, { status: 401 });
      }
      const parsed = attestLlmCallSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return new Response(null, { status: 400 });
      }
      const { callId, route, latencyMs, outcome, labelHash } = parsed.data;
      // FM is client-owned: emit the intent + outcome pair together (ADR-0008).
      await deps.service.recordLlmCall(ctx.userId, { phase: "intent", callId, route, labelHash });
      await deps.service.recordLlmCall(ctx.userId, {
        phase: "outcome",
        callId,
        route,
        labelHash,
        latencyMs,
        outcome,
      });
      set.status = 204;
      return new Response(null, { status: 204 });
    },
  );
}
