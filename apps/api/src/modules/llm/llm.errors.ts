// apps/api/src/modules/llm/llm.errors.ts
// Typed error class + factories for the LLM domain (story 6-1). Extends
// PekuloError so the Elysia error-mapper translates instances to oRPC
// responses with stable { code, message } per ORPC_HTTP_STATUS_BY_CODE:
//   LLM_OPT_IN_REQUIRED      → 403 (DR-7 — third-party egress without consent)
//   LLM_PROVIDER_UNAVAILABLE → 503 (Ollama / third-party down or timeout)
//   LLM_ROUTING_ERROR        → 502 (malformed route / prompt-cap breach)

import { PekuloError } from "../../common/errors";

export type LlmErrorCode = "LLM_OPT_IN_REQUIRED" | "LLM_PROVIDER_UNAVAILABLE" | "LLM_ROUTING_ERROR";

export class LlmError extends PekuloError {
  override readonly name = "LlmError";
  // Forwarding constructor narrows `code` from PekuloErrorCode to LlmErrorCode —
  // mirrors BankAggregatorError / RealestateError.
  // oxlint-disable-next-line no-useless-constructor -- narrows code union
  constructor(code: LlmErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

// NOTE: there is intentionally no `llmOptInRequired()` factory here. The DR-7
// opt-in gate lives in platform/security/opt-in-guard.ts, which (one-way
// layering) cannot import this module — so it throws the LLM_OPT_IN_REQUIRED
// PekuloError directly. A factory here would be a dead, duplicate source for
// the same message.

export function llmProviderUnavailable(route: string, reason: string): LlmError {
  return new LlmError("LLM_PROVIDER_UNAVAILABLE", `LLM provider ${route} unavailable: ${reason}`);
}

export function llmRoutingError(reason: string): LlmError {
  return new LlmError("LLM_ROUTING_ERROR", `LLM routing failed: ${reason}`);
}
