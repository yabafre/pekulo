// apps/api/src/modules/logos/logos.module.ts
// Story 6-10. Factory wiring the logos module. Returns an INFERRED shape (no
// `: Elysia` annotation — lesson 2026-05-04). Mirrors createBankAggregatorModule.

import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import { createBrandfetchClient } from "./services/brandfetch-client";
import { createLogosRepository } from "./logos.repository";
import { createLogosService } from "./logos.service";
import { registerLogoRoutes } from "./logos.routes";

export function createLogosModule(deps: {
  prismaService: PrismaService;
  env: Env;
  getBankLogo: (providerId: string) => Promise<string | null>;
}) {
  const repository = createLogosRepository({ client: deps.prismaService.client });
  const brandfetch = createBrandfetchClient({ env: deps.env });
  const service = createLogosService({ repository, brandfetch, getBankLogo: deps.getBankLogo });
  const routes = registerLogoRoutes({ service });
  return { service, routes };
}
