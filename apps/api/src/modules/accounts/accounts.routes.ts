// oRPC handlers for the accounts module. Mirrors milestones.routes.ts:
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401 within
// the NFR-9 budget (≤ 100 ms).
//
// L8 invariant (story 2-1 explicit): the returned router type is inferred
// via ReturnType<typeof createAccountsRouter>; never annotate as `Elysia`
// or any concrete oRPC implementation type.
//
// Story 2-3 review: typed contract errors (`ACCOUNT_NOT_FOUND`,
// `ACCOUNT_REFERENCED_FK`) declared on the contract are rethrown via the
// handler's typed `errors.*` constructors. oRPC's RPCHandler propagates
// those as canonical defined-error JSON, so the web client's
// `accountsClient.delete()` rejects with `ORPCError` carrying the right
// `code` — the `DeleteAccountResult` envelope in accounts-actions.ts can
// branch on it. Without this remap, RPCHandler would mask AccountError
// as INTERNAL_SERVER_ERROR before our Elysia .onError mapper sees it.

import { implement } from "@orpc/server";
import { accountsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import { AccountError } from "./accounts.errors";
import type { AccountService } from "./accounts.service";

const impl = implement(accountsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createAccountsRouter(deps: { service: AccountService }) {
  return impl.router({
    create: impl.create.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.create(context.userId, input);
    }),
    update: impl.update.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.update(context.userId, input);
      } catch (err) {
        if (err instanceof AccountError && err.code === "ACCOUNT_NOT_FOUND") {
          throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
    delete: impl.delete.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.delete(context.userId, input);
      } catch (err) {
        if (err instanceof AccountError) {
          if (err.code === "ACCOUNT_REFERENCED_FK") {
            throw errors.ACCOUNT_REFERENCED_FK({ message: err.message });
          }
          if (err.code === "ACCOUNT_NOT_FOUND") {
            throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
          }
        }
        throw err;
      }
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
    recordBalanceChange: impl.recordBalanceChange.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.recordBalanceChange(context.userId, input);
      } catch (err) {
        if (err instanceof AccountError && err.code === "ACCOUNT_NOT_FOUND") {
          throw errors.ACCOUNT_NOT_FOUND({ message: err.message });
        }
        throw err;
      }
    }),
  });
}
