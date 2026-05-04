// apps/api/src/modules/hypothesis/hypothesis.module.ts
// Module factory wiring service + router for the hypothesis domain. Mirrors
// ADR-0009's module-factory pattern (createXxxModule(deps) → { router, service? }).

import type { PrismaService } from "../../database";
import { createHypothesisService, type HypothesisService } from "./hypothesis.service";
import { createHypothesisRouter } from "./hypothesis.routes";

export interface HypothesisModule {
  service: HypothesisService;
  router: ReturnType<typeof createHypothesisRouter>;
}

export function createHypothesisModule(deps: { prismaService: PrismaService }): HypothesisModule {
  const service = createHypothesisService({ client: deps.prismaService.client });
  const router = createHypothesisRouter({ service });
  return { service, router };
}
