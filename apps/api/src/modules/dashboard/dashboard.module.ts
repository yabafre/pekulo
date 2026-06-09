// apps/api/src/modules/dashboard/dashboard.module.ts
// Module factory for the dashboard domain. The OVERVIEW half is pure
// composition (no Prisma) — DashboardPorts over the four wealth modules +
// compass + recent-activity (story 7-1 + 7-2 D3). The LAYOUT half (story 7-2
// D6) owns ONE table (dashboard_layout) via its own repository/service. Both
// halves mount on the single dashboard router. Router type inferred via
// ReturnType<typeof createDashboardRouter>; never annotated as Elysia.

import type { PrismaService } from "../../database";
import { createDashboardService, type DashboardPorts } from "./dashboard.service";
import { createDashboardRouter } from "./dashboard.routes";
import { createDashboardLayoutRepository } from "./dashboard-layout.repository";
import { createDashboardLayoutService } from "./dashboard-layout.service";

export interface DashboardModule {
  router: ReturnType<typeof createDashboardRouter>;
}

export function createDashboardModule(
  deps: DashboardPorts & { prismaService: PrismaService },
): DashboardModule {
  const { prismaService, ...ports } = deps;
  const service = createDashboardService(ports);
  const layoutRepository = createDashboardLayoutRepository({ client: prismaService.client });
  const layoutService = createDashboardLayoutService({ repository: layoutRepository });
  const router = createDashboardRouter({ service, layoutService });
  return { router };
}
