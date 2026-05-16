// oRPC handlers for the accounts module. Mirrors milestones.routes.ts:
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401 within
// the NFR-9 budget (≤ 100 ms).
//
// L8 invariant (story 2-1 explicit): the returned router type is inferred
// via ReturnType<typeof createAccountsRouter>; never annotate as `Elysia`
// or any concrete oRPC implementation type.

import { implement } from "@orpc/server";
import { accountsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
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
    update: impl.update.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.update(context.userId, input);
    }),
    delete: impl.delete.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.delete(context.userId, input);
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
  });
}
