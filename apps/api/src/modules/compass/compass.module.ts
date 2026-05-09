// Module factory wiring repository + service + router for the compass domain.
// Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
// L8 (story 1-1 explicit): the router type is inferred via
// ReturnType<typeof createCompassRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createCompassRepository } from "./compass.repository";
import { createCompassService, type CompassService } from "./compass.service";
import { createCompassRouter } from "./compass.routes";
import type { MilestonePresenceProbe, WealthHistoryProvider } from "@pekulo/types";

export interface CompassModule {
  service: CompassService;
  router: ReturnType<typeof createCompassRouter>;
}

export function createCompassModule(deps: {
  prismaService: PrismaService;
  milestonePresenceProbe: MilestonePresenceProbe;
  wealthHistoryProvider: WealthHistoryProvider;
}): CompassModule {
  const repository = createCompassRepository({ client: deps.prismaService.client });
  const service = createCompassService({
    repository,
    milestonePresenceProbe: deps.milestonePresenceProbe,
    wealthHistoryProvider: deps.wealthHistoryProvider,
  });
  const router = createCompassRouter({ service });
  return { service, router };
}
