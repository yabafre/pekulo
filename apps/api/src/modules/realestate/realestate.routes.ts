// apps/api/src/modules/realestate/realestate.routes.ts
// oRPC handlers for the realestate module (story 4-1). Mirrors holdings.routes.ts
// shape — each handler reads { userId } from the oRPC context (injected by
// mountOrpc after JWT verification) and delegates to the service. Throws
// PekuloError("UNAUTHORIZED") on missing context — the Elysia error mapper
// translates it to a 401 within the NFR-9 budget (≤ 100 ms).
//
// L8 invariant (story 4-1 explicit): the returned router type is inferred
// via ReturnType<typeof createRealestateRouter>; never annotate as `Elysia`
// or any concrete oRPC implementation type.
//
// Typed contract errors (REALESTATE_NOT_FOUND, MORTGAGE_ALREADY_ATTACHED,
// MORTGAGE_NOT_FOUND, RENTAL_ALREADY_ATTACHED, RENTAL_NOT_FOUND) declared on
// the contract are rethrown via the handler's typed `errors.*` constructors
// so oRPC's RPCHandler propagates them as canonical defined-error JSON.
// Without this remap, RPCHandler would mask RealestateError as
// INTERNAL_SERVER_ERROR before our Elysia .onError mapper sees it.

import { implement } from "@orpc/server";
import { realestateContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import { RealestateError } from "./realestate.errors";
import type { RealestateService } from "./realestate.service";

const impl = implement(realestateContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createRealestateRouter(deps: { service: RealestateService }) {
  return impl.router({
    createProperty: impl.createProperty.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.createProperty(context.userId, input);
    }),

    getProperty: impl.getProperty.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.getProperty(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    listProperties: impl.listProperties.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.listProperties(context.userId);
    }),

    attachMortgage: impl.attachMortgage.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.attachMortgage(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError) {
          if (err.code === "REALESTATE_NOT_FOUND") {
            throw errors.REALESTATE_NOT_FOUND({ message: err.message });
          }
          if (err.code === "MORTGAGE_ALREADY_ATTACHED") {
            throw errors.MORTGAGE_ALREADY_ATTACHED({ message: err.message });
          }
        }
        throw err;
      }
    }),

    updateMortgage: impl.updateMortgage.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.updateMortgage(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError) {
          if (err.code === "REALESTATE_NOT_FOUND") {
            throw errors.REALESTATE_NOT_FOUND({ message: err.message });
          }
          if (err.code === "MORTGAGE_NOT_FOUND") {
            throw errors.MORTGAGE_NOT_FOUND({ message: err.message });
          }
        }
        throw err;
      }
    }),

    detachMortgage: impl.detachMortgage.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.detachMortgage(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    attachRental: impl.attachRental.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.attachRental(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError) {
          if (err.code === "REALESTATE_NOT_FOUND") {
            throw errors.REALESTATE_NOT_FOUND({ message: err.message });
          }
          if (err.code === "RENTAL_ALREADY_ATTACHED") {
            throw errors.RENTAL_ALREADY_ATTACHED({ message: err.message });
          }
        }
        throw err;
      }
    }),

    updateRental: impl.updateRental.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.updateRental(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError) {
          if (err.code === "REALESTATE_NOT_FOUND") {
            throw errors.REALESTATE_NOT_FOUND({ message: err.message });
          }
          if (err.code === "RENTAL_NOT_FOUND") {
            throw errors.RENTAL_NOT_FOUND({ message: err.message });
          }
        }
        throw err;
      }
    }),

    detachRental: impl.detachRental.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.detachRental(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    recordValuation: impl.recordValuation.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.recordValuation(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    listValuations: impl.listValuations.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.listValuations(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),

    deleteProperty: impl.deleteProperty.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.deleteProperty(context.userId, input);
      } catch (err) {
        if (err instanceof RealestateError && err.code === "REALESTATE_NOT_FOUND") {
          throw errors.REALESTATE_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
  });
}
