// apps/api/src/modules/llm/llm.routes.ts
// oRPC handlers for the LLM module's client-facing surface (story 6-3, FR-34).
// Two procedures bound to llmContract: getOptIn (read) + setOptIn (write) the
// per-user third-party opt-in flag. Mirrors accounts.routes.ts: each handler
// reads { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on missing
// context — the Elysia error mapper translates it to a 401 within NFR-9 (≤100ms).
//
// L8 invariant: the router type is inferred via ReturnType<typeof
// createLlmRouter>; never annotate as `Elysia` or a concrete oRPC type. The
// /internal/llm/attest listener (story 6-1) is a separate Elysia-native router
// and is NOT part of this oRPC tree.
import { implement } from "@orpc/server";
import { llmContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { LlmService } from "./llm.service";

const impl = implement(llmContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createLlmRouter(deps: { service: LlmService }) {
  return impl.router({
    getOptIn: impl.getOptIn.handler(async ({ context }) => {
      requireUserId(context.userId);
      const thirdParty = await deps.service.getThirdPartyOptIn(context.userId);
      return { thirdParty };
    }),
    setOptIn: impl.setOptIn.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      const thirdParty = await deps.service.setThirdPartyOptIn(context.userId, input.thirdParty);
      return { thirdParty };
    }),
  });
}
