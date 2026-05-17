// Module factory wiring repository + service + router for the holdings
// domain. Mirrors ADR-0009's pattern (createXxxModule(deps) → { service, router }).
//
// L8 (story 3-1 explicit): the router type is inferred via
// ReturnType<typeof createHoldingsRouter>; never annotate as `Elysia` or any
// concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createHoldingRepository } from "./holdings.repository";
import { createHoldingsRouter } from "./holdings.routes";
import { createHoldingService, type HoldingService } from "./holdings.service";

export interface HoldingsModule {
  service: HoldingService;
  router: ReturnType<typeof createHoldingsRouter>;
}

export function createHoldingsModule(deps: { prismaService: PrismaService }): HoldingsModule {
  const repository = createHoldingRepository({ client: deps.prismaService.client });
  const service = createHoldingService({ repository });
  const router = createHoldingsRouter({ service });
  return { service, router };
}
