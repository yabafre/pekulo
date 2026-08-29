// Module factory wiring repository + service + router for the settings
// domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
// L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
// never annotate as `Elysia` or any concrete oRPC implementation type.
//
// Story 11-1 adds `exportRoutes`: an Elysia-native streaming route mounted
// alongside the oRPC router (app.ts), because a stream cannot travel through
// the oRPC envelope. It needs the JWT verifier directly — mountOrpc's context
// injection does not cover Elysia-native routes.
import type { PrismaService } from "../../database";
import type { JwtVerifier } from "../../platform/security";
import { createSettingsRepository } from "./settings.repository";
import { createSettingsService, type SettingsService } from "./settings.service";
import { createSettingsRouter } from "./settings.routes";
import { registerSettingsExportRoutes } from "./settings.export-routes";

export interface SettingsModule {
  service: SettingsService;
  router: ReturnType<typeof createSettingsRouter>;
  exportRoutes: ReturnType<typeof registerSettingsExportRoutes>;
}

export function createSettingsModule(deps: {
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
}): SettingsModule {
  const repository = createSettingsRepository({ client: deps.prismaService.client });
  const service = createSettingsService({ repository });
  const router = createSettingsRouter({ service });
  const exportRoutes = registerSettingsExportRoutes({
    client: deps.prismaService.client,
    jwtVerifier: deps.jwtVerifier,
  });
  return { service, router, exportRoutes };
}
