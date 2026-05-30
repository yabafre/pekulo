// apps/api/src/platform/security/opt-in-guard.ts
// DR-7 / NFR-13 — third-party LLM opt-in gate (cross-cutting infra; consumed by
// the LLM module's service). Takes an injected reader so platform/ does NOT
// import modules/ (one-way layering). The LLM repository satisfies
// ThirdPartyOptInReader structurally. The client opt-in state is NEVER trusted.
import { PekuloError } from "../../common/errors";

export interface ThirdPartyOptInReader {
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
}

export async function requireThirdPartyOptIn(
  reader: ThirdPartyOptInReader,
  userId: string,
): Promise<void> {
  const ok = await reader.isThirdPartyOptedIn(userId);
  if (!ok) {
    throw new PekuloError(
      "LLM_OPT_IN_REQUIRED",
      "third-party LLM requires explicit user opt-in (DR-7)",
    );
  }
}
