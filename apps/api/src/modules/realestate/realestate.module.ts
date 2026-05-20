// apps/api/src/modules/realestate/realestate.module.ts
// Module factory wiring repository + service + router for the realestate
// domain (story 4-1). Mirrors ADR-0009's pattern — createXxxModule(deps) →
// { service, router } — and stays trivial because the realestate aggregate
// has no external client dependencies (no price chain, no FX, no LLM).
//
// L8 invariant (story 4-1 explicit): the router type is inferred via
// ReturnType<typeof createRealestateRouter>; never annotate as `Elysia` or
// any concrete oRPC implementation type.

import type { PrismaService } from "../../database";
import { createRealestateRepository } from "./realestate.repository";
import { createRealestateRouter } from "./realestate.routes";
import { createRealestateService, type RealestateService } from "./realestate.service";

export interface RealestateModule {
  service: RealestateService;
  router: ReturnType<typeof createRealestateRouter>;
}

export function createRealestateModule(deps: { prismaService: PrismaService }): RealestateModule {
  const repository = createRealestateRepository({ client: deps.prismaService.client });
  const service = createRealestateService({ repository });
  const router = createRealestateRouter({ service });
  return { service, router };
}
