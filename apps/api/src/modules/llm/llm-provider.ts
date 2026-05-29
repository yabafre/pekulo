// apps/api/src/modules/llm/llm-provider.ts
// Provider abstraction for the LLM transport tier (Epic 6, story 6-1).
// Iso-pattern with bank-aggregator/bank-provider.ts. OllamaClient +
// ThirdPartyClient implement it under services/. FoundationModels is NOT a
// server provider — it runs on-device (apps/mobile, V1.5) and is attested via
// /internal/llm/attest; story 6-1 ships only the two server-callable clients.
import type { LlmPromptEnvelope, LlmProviderCompletion } from "@pekulo/types";

export interface LlmProvider {
  /** The route this client serves — 'ollama' or 'third_party'. */
  readonly route: "ollama" | "third_party";
  /** Low-level completion. Story 6-1 ships the transport (raw text + latency);
   * the {category, confidence} parsing lands in story 6-2. Throws
   * LlmError(LLM_PROVIDER_UNAVAILABLE) on transport failure / timeout. */
  complete(envelope: LlmPromptEnvelope): Promise<LlmProviderCompletion>;
}
