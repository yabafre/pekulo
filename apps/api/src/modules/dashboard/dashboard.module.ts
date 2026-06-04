// apps/api/src/modules/dashboard/dashboard.module.ts
// Module factory for the dashboard domain (story 7-1). Unlike every other
// module, the dashboard owns NO repository and NO Prisma — it is pure
// composition over narrow read ports supplied by runtime-dependencies.ts
// (accounts / holdings / realestate / compass). Mirrors ADR-0009's
// createXxxModule(deps) → { service, router } shape; router type inferred
// (L669, never annotated as `Elysia`).

import { createDashboardRouter } from "./dashboard.routes";
import {
  createDashboardService,
  type DashboardPorts,
  type DashboardService,
} from "./dashboard.service";

export interface DashboardModule {
  service: DashboardService;
  router: ReturnType<typeof createDashboardRouter>;
}

export function createDashboardModule(deps: DashboardPorts): DashboardModule {
  const service = createDashboardService(deps);
  const router = createDashboardRouter({ service });
  return { service, router };
}
