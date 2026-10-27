// Module factory wiring repository + access service + analysis service + router
// for the private advisory surface (stories 12-1 and 12-2, ADR-0016 §3/§4).
// Mirrors ADR-0009 (createXxxModule(deps) → { service, analysis, router }).
import type { PrismaService } from "../../database";
import {
  createAdvisoryAnalysisService,
  type AdvisoryAnalysisPorts,
  type AdvisoryAnalysisService,
} from "./advisory-analysis.service";
import { createAdvisoryRepository } from "./advisory.repository";
import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
import { createAdvisoryRouter } from "./advisory.routes";

export interface AdvisoryModule {
  service: AdvisoryAccessService;
  analysis: AdvisoryAnalysisService;
  router: ReturnType<typeof createAdvisoryRouter>;
}

export function createAdvisoryModule(
  deps: {
    prismaService: PrismaService;
    ownerUserIds: ReadonlySet<string>;
  } & AdvisoryAnalysisPorts,
): AdvisoryModule {
  const repository = createAdvisoryRepository({ client: deps.prismaService.client });
  const service = createAdvisoryService({
    repository,
    ownerUserIds: deps.ownerUserIds,
  });
  const analysis = createAdvisoryAnalysisService(deps);
  const router = createAdvisoryRouter({ service, analysis });
  return { service, analysis, router };
}
