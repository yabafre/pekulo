// Module factory wiring repository + service + router for the private
// advisory access gate (story 12-1, ADR-0016 §4). Mirrors ADR-0009
// (createXxxModule(deps) → { service, router }).
import type { PrismaService } from "../../database";
import { createAdvisoryRepository } from "./advisory.repository";
import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
import { createAdvisoryRouter } from "./advisory.routes";

export interface AdvisoryModule {
  service: AdvisoryAccessService;
  router: ReturnType<typeof createAdvisoryRouter>;
}

export function createAdvisoryModule(deps: {
  prismaService: PrismaService;
  ownerUserIds: ReadonlySet<string>;
}): AdvisoryModule {
  const repository = createAdvisoryRepository({ client: deps.prismaService.client });
  const service = createAdvisoryService({
    repository,
    ownerUserIds: deps.ownerUserIds,
  });
  const router = createAdvisoryRouter({ service });
  return { service, router };
}
