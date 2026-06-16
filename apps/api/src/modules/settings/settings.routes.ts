// oRPC handlers for the settings module (story 8-2). Each handler reads
// { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on missing
// context — the Elysia error mapper translates it to a 401.
import { implement } from "@orpc/server";
import { settingsContract } from "@pekulo/contracts";
import { PekuloError } from "../../common/errors";
import type { SettingsService } from "./settings.service";

const impl = implement(settingsContract).$context<{
  userId: string;
  email: string | null;
}>();

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId || !userId.trim()) {
    throw new PekuloError("UNAUTHORIZED", "user context missing");
  }
}

export function createSettingsRouter(deps: { service: SettingsService }) {
  return impl.router({
    get: impl.get.handler(async ({ context }) => {
      requireUserId(context.userId);
      return deps.service.get(context.userId);
    }),
    updateTheme: impl.updateTheme.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.updateTheme(context.userId, input.theme);
    }),
    updateLang: impl.updateLang.handler(async ({ context, input }) => {
      requireUserId(context.userId);
      return deps.service.updateLang(context.userId, input.lang);
    }),
  });
}
