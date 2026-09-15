// Module factory wiring repository + service + router for the settings
// domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
// L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
// never annotate as `Elysia` or any concrete oRPC implementation type.
//
// Story 11-1 adds `exportRoutes`: an Elysia-native streaming route mounted
// alongside the oRPC router (app.ts), because a stream cannot travel through
// the oRPC envelope. It needs the JWT verifier directly — mountOrpc's context
// injection does not cover Elysia-native routes.
//
// Story 11-2 adds the three erasure ports. `providerErasure` and `authAdmin`
// are injected by the runtime composition layer (runtime-dependencies.ts):
// the bank-aggregator service is built later in that file, and the Supabase
// admin client needs a credential this module has no business reading.
// `localData` is wired here because deleteUserData only needs the client this
// module already holds.
import type { PrismaService } from "../../database";
import type { JwtVerifier } from "../../platform/security";
import { createSettingsRepository } from "./settings.repository";
import {
  createSettingsService,
  type IdentityErasurePort,
  type ProviderErasurePort,
  type SettingsService,
} from "./settings.service";
import { createSettingsRouter } from "./settings.routes";
import { registerSettingsExportRoutes } from "./settings.export-routes";
import { deleteUserData } from "./settings.deletion";

export interface SettingsModule {
  service: SettingsService;
  router: ReturnType<typeof createSettingsRouter>;
  exportRoutes: ReturnType<typeof registerSettingsExportRoutes>;
}

export function createSettingsModule(deps: {
  prismaService: PrismaService;
  jwtVerifier: JwtVerifier;
  providerErasure: ProviderErasurePort;
  authAdmin: IdentityErasurePort;
}): SettingsModule {
  const repository = createSettingsRepository({ client: deps.prismaService.client });
  const service = createSettingsService({
    repository,
    providerErasure: deps.providerErasure,
    localData: { erase: (userId) => deleteUserData(deps.prismaService.client, userId) },
    authAdmin: deps.authAdmin,
  });
  const router = createSettingsRouter({ service });
  const exportRoutes = registerSettingsExportRoutes({
    client: deps.prismaService.client,
    jwtVerifier: deps.jwtVerifier,
  });
  return { service, router, exportRoutes };
}
