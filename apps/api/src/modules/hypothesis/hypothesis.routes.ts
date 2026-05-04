// apps/api/src/modules/hypothesis/hypothesis.routes.ts
// oRPC handlers for the hypothesis module. The router is built from the
// shared @pekulo/contracts contract via implement(contract).$context<T>().router(...).
// Each handler reads { userId } from the oRPC `context` (injected by
// mountOrpc after JWT verification) and delegates to the service.

import { implement } from "@orpc/server";
import { hypothesisContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { HypothesisService } from "./hypothesis.service";

// Typed oRPC context for routes that require an authenticated user. The
// mountOrpc layer is responsible for populating this context — handlers
// should never reach into Headers themselves.
const impl = implement(hypothesisContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createHypothesisRouter(deps: { service: HypothesisService }) {
  return impl.router({
    get: impl.get.handler(async ({ context }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.get(context.userId);
    }),
    save: impl.save.handler(async ({ context, input }) => {
      if (!context.userId) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.save(context.userId, input);
    }),
  });
}
