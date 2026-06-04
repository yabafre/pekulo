// apps/api/src/modules/dashboard/dashboard.routes.ts
// oRPC handler for the dashboard module (story 7-1). Single read procedure
// getOverview. Mirrors compass.routes.ts: router built from the shared
// @pekulo/contracts contract via implement(contract).$context<T>().router(...).
// L669: router type inferred via ReturnType<typeof createDashboardRouter>;
// never annotated as `Elysia`.

import { implement } from "@orpc/server";
import { dashboardContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { DashboardService } from "./dashboard.service";

const impl = implement(dashboardContract).$context<{
  userId: string;
  email: string | null;
}>();

export function createDashboardRouter(deps: { service: DashboardService }) {
  return impl.router({
    getOverview: impl.getOverview.handler(async ({ context }) => {
      if (!context.userId?.trim()) {
        throw new PekuloError("UNAUTHORIZED", "user context missing");
      }
      return deps.service.getOverview(context.userId);
    }),
  });
}
