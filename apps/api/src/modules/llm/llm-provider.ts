// apps/api/src/modules/llm/llm-provider.ts
// Provider abstraction for the LLM transport tier (Epic 6). Iso-pattern with
// bank-aggregator/bank-provider.ts. OllamaClient + ThirdPartyClient implement
// it under services/. FoundationModels is NOT a server provider — it runs
// on-device (apps/mobile, V1.5) and is attested via /internal/llm/attest.
// Story 6-2: `complete` takes a fully-composed prompt STRING (built by
// llm-prompt-builder — the sole NFR-12 site) so the transport stays task-
// agnostic; the {category, confidence} parsing lives in llm-categoriser.
import type { LlmProviderCompletion } from "@pekulo/types";

export interface LlmProvider {
  /** The route this client serves — 'ollama' or 'third_party'. */
  readonly route: "ollama" | "third_party";
  /** Low-level completion from a composed prompt string. Returns raw text +
   * latency. Throws LlmError(LLM_PROVIDER_UNAVAILABLE) on transport failure /
   * timeout. */
  complete(prompt: string): Promise<LlmProviderCompletion>;
}
