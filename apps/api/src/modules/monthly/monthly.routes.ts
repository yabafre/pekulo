// apps/api/src/modules/monthly/monthly.routes.ts
// oRPC handler wiring for the monthly procedures.
//   5-4: getMonthly, upsertMonthly, listMonthly
//   5-5: signOffMonthly, reopenMonthly
// Mirrors transactions.routes.ts — requireUserId guard at the head of every
// handler. L8 invariant: the router type is inferred via
// ReturnType<typeof createMonthlyRouter>; never annotated as `Elysia`.

import { implement } from "@orpc/server";
import { monthlyContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { MonthlyService } from "./monthly.service";

const impl = implement(monthlyContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createMonthlyRouter(deps: { service: MonthlyService }) {
  return impl.router({
    getMonthly: impl.getMonthly.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.getMonthly(context.userId, input);
    }),

    upsertMonthly: impl.upsertMonthly.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.upsertMonthly(context.userId, input);
    }),

    listMonthly: impl.listMonthly.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.listMonthly(context.userId, input);
    }),

    signOffMonthly: impl.signOffMonthly.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.signOff(context.userId, input);
    }),

    reopenMonthly: impl.reopenMonthly.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.reopen(context.userId, input);
    }),
  });
}
