// apps/api/src/modules/dashboard/dashboard.routes.ts
// oRPC handlers for the dashboard module. getOverview (read, story 7-1 + 7-2
// recentActivity) + getLayout/saveLayout (story 7-2 / D6). Mirrors
// compass.routes.ts: router built from the shared @pekulo/contracts contract
// via implement(contract).$context<T>().router(...). Router type inferred via
// ReturnType<typeof createDashboardRouter>; never annotated as Elysia.

import { implement } from "@orpc/server";
import { dashboardContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { DashboardService } from "./dashboard.service";
import type { DashboardLayoutService } from "./dashboard-layout.service";

const impl = implement(dashboardContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): string {
  if (!userId?.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
  return userId;
}

export function createDashboardRouter(deps: {
  service: DashboardService;
  layoutService: DashboardLayoutService;
}) {
  return impl.router({
    getOverview: impl.getOverview.handler(async ({ context }) => {
      return deps.service.getOverview(requireUserId(context.userId));
    }),
    getLayout: impl.getLayout.handler(async ({ context }) => {
      return deps.layoutService.getLayout(requireUserId(context.userId));
    }),
    saveLayout: impl.saveLayout.handler(async ({ context, input }) => {
      return deps.layoutService.saveLayout(requireUserId(context.userId), input);
    }),
  });
}
