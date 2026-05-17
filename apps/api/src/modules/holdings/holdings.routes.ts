// oRPC handlers for the holdings module. Mirrors accounts.routes.ts shape —
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401 within
// the NFR-9 budget (≤ 100 ms).
//
// L8 invariant (story 3-1 explicit): the returned router type is inferred
// via ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia`
// or any concrete oRPC implementation type.
//
// Typed contract errors (HOLDING_NOT_FOUND, HOLDING_CLOSED, ACCOUNT_NOT_FOUND)
// declared on the contract are rethrown via the handler's typed `errors.*`
// constructors so oRPC's RPCHandler propagates them as canonical defined-error
// JSON. Without this remap, RPCHandler would mask HoldingError as
// INTERNAL_SERVER_ERROR before our Elysia .onError mapper sees it.

import { implement } from "@orpc/server";
import { holdingsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import { AccountError } from "../accounts/accounts.errors";
import { HoldingError } from "./holdings.errors";
import type { HoldingService } from "./holdings.service";

const impl = implement(holdingsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createHoldingsRouter(deps: { service: HoldingService }) {
  return impl.router({
    create: impl.create.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.create(context.userId, input);
      } catch (err) {
        if (err instanceof AccountError && err.code === "ACCOUNT_NOT_FOUND") {
          throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
    recordLot: impl.recordLot.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.recordLot(context.userId, input);
      } catch (err) {
        if (err instanceof HoldingError) {
          if (err.code === "HOLDING_NOT_FOUND") {
            throw errors.HOLDING_NOT_FOUND({ message: err.message });
          }
          if (err.code === "HOLDING_CLOSED") {
            throw errors.HOLDING_CLOSED({ message: err.message });
          }
        }
        throw err;
      }
    }),
    close: impl.close.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.close(context.userId, input);
      } catch (err) {
        if (err instanceof HoldingError && err.code === "HOLDING_NOT_FOUND") {
          throw errors.HOLDING_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
    list: impl.list.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId, input);
    }),
    getDerived: impl.getDerived.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.getDerived(context.userId, input);
      } catch (err) {
        if (err instanceof HoldingError && err.code === "HOLDING_NOT_FOUND") {
          throw errors.HOLDING_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
  });
}
