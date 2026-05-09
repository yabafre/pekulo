// Module factory wiring repository + service + router for the milestones
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
// Exposes `presenceProbe` so runtime-dependencies.ts can wire it back into the
// compass module — closes story 1-2 AC-11.
//
// L8 (story 1-1 explicit, story 1-2 inherits): the router type is inferred via
// ReturnType<typeof createMilestonesRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { CompassReader, MilestonePresenceProbe } from "@pekulo/types";
import type { PrismaService } from "../../database";
import { createMilestoneRepository } from "./milestones.repository";
import { createMilestoneService, type MilestoneService } from "./milestones.service";
import { createMilestonesRouter } from "./milestones.routes";

export interface MilestonesModule {
  service: MilestoneService;
  router: ReturnType<typeof createMilestonesRouter>;
  presenceProbe: MilestonePresenceProbe;
}

export function createMilestonesModule(deps: {
  prismaService: PrismaService;
  compassReader: CompassReader;
}): MilestonesModule {
  const repository = createMilestoneRepository({ client: deps.prismaService.client });
  const service = createMilestoneService({ repository, compassReader: deps.compassReader });
  const router = createMilestonesRouter({ service });
  return { service, router, presenceProbe: service.presenceProbe() };
}
