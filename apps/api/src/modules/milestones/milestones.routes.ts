// oRPC handlers for the milestones module. Mirrors compass.routes.ts:
// each handler reads { userId } from the oRPC context (injected by mountOrpc
// after JWT verification) and delegates to the service. Throws PekuloError on
// missing context — the Elysia error mapper translates it to a 401.

import { implement } from "@orpc/server";
import { milestonesContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { MilestoneService } from "./milestones.service";

const impl = implement(milestonesContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createMilestonesRouter(deps: { service: MilestoneService }) {
  return impl.router({
    add: impl.add.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.add(context.userId, input);
    }),
    update: impl.update.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.update(context.userId, input);
    }),
    delete: impl.delete.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.delete(context.userId, input.id);
    }),
    list: impl.list.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.list(context.userId);
    }),
    getStatuses: impl.getStatuses.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.computeStatuses(context.userId, input.currentWealth);
    }),
  });
}
