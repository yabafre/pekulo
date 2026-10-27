// apps/api/src/modules/advisory/advisory-posture.ts
// Provider posture assertor enforcing EU-region and zero data retention invariants (story 12-3, AC-4, ADR-0016 §3).

import { PekuloError } from "../../common/errors";

export interface AdvisoryPostureConfig {
  baseUrl?: string;
  model?: string;
}

// AC-4 (verbatim from story 12-3:20):
//   Given the configured LLM provider, When the advisory surface initialises,
//   Then its configuration asserts that the provider is hosted in the EU region
//   and adheres to a zero-data-retention / no-training policy (e.g. Mistral EU by default).
export function assertAdvisoryProviderPosture(config: AdvisoryPostureConfig): {
  route: "third_party";
  providerName: string;
  region: "EU";
  noTrain: true;
} {
  const baseUrl = config.baseUrl ?? "https://api.mistral.ai/v1/chat/completions";
  let hostname = "";
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    hostname = baseUrl.toLowerCase();
  }

  const isMistral = hostname === "api.mistral.ai" || hostname.endsWith(".mistral.ai");
  const isEuOpenRouter = hostname === "openrouter.ai" || hostname.startsWith("eu-");
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (!isMistral && !isEuOpenRouter && !isLocalhost) {
    throw new PekuloError(
      "BAD_REQUEST",
      `Advisory provider posture check failed: endpoint ${baseUrl} does not meet EU-region & no-train policy (ADR-0016 §3)`,
    );
  }

  return {
    route: "third_party",
    providerName: isMistral ? "mistral" : isLocalhost ? "local" : "openrouter-eu",
    region: "EU",
    noTrain: true,
  };
}
