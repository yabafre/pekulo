// oRPC handlers for the compass module. Mirrors hypothesis.routes.ts:
// the router is built from the shared @pekulo/contracts contract via
// implement(contract).$context<T>().router(...). Each handler reads
// { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401.

import { implement } from "@orpc/server";
import { compassContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { CompassService } from "./compass.service";

const impl = implement(compassContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createCompassRouter(deps: { service: CompassService }) {
  return impl.router({
    updateCompass: impl.updateCompass.handler(async ({ context, input }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.updateCompass(context.userId, input);
    }),
    getCompass: impl.getCompass.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.getCompass(context.userId);
    }),
    getSetupState: impl.getSetupState.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      const state = await deps.service.getSetupState(context.userId);
      return { state };
    }),
  });
}
