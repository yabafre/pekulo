// Module factory wiring repository + service + router for the settings
// domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
// L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
// never annotate as `Elysia` or any concrete oRPC implementation type.
import type { PrismaService } from "../../database";
import { createSettingsRepository } from "./settings.repository";
import { createSettingsService, type SettingsService } from "./settings.service";
import { createSettingsRouter } from "./settings.routes";

export interface SettingsModule {
  service: SettingsService;
  router: ReturnType<typeof createSettingsRouter>;
}

export function createSettingsModule(deps: { prismaService: PrismaService }): SettingsModule {
  const repository = createSettingsRepository({ client: deps.prismaService.client });
  const service = createSettingsService({ repository });
  const router = createSettingsRouter({ service });
  return { service, router };
}
