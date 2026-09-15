// oRPC handlers for the settings module (story 8-2). Each handler reads
// { userId } from the oRPC context (injected by mountOrpc after JWT
// verification) and delegates to the service. Throws PekuloError on missing
// context — the Elysia error mapper translates it to a 401.
import { implement } from "@orpc/server";
import { settingsContract } from "@pekulo/contracts";
import { isPekuloError, PekuloError } from "../../common/errors";
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
    // Story 11-2 (FR-50). `context.email` is the email claim from the verified
    // JWT — passed through so the service can check the typed confirmation
    // against the real account. The handler does no checking of its own: the
    // confirmation is an authorization rule and belongs in the service, where
    // the unit tests can reach it.
    deleteAccount: impl.deleteAccount.handler(async ({ context, input, errors }) => {
      requireUserId(context.userId);
      try {
        return await deps.service.deleteAccount(context.userId, context.email, input);
      } catch (err) {
        // Re-thrown as the contract's typed errors: oRPC collapses any other
        // throw to 500 inside handler.handle(), before the mount's mapper runs.
        if (isPekuloError(err)) {
          if (err.code === "FORBIDDEN") throw errors.FORBIDDEN({ message: err.message });
          if (err.code === "BANK_PROVIDER_UNAVAILABLE") {
            throw errors.BANK_PROVIDER_UNAVAILABLE({ message: err.message });
          }
          if (err.code === "ACCOUNT_PARTIALLY_ERASED") {
            throw errors.ACCOUNT_PARTIALLY_ERASED({ message: err.message });
          }
        }
        throw err;
      }
    }),
  });
}
