// apps/api/src/modules/llm/services/third-party-client.ts
// Third-party LLM transport (FR-31 opt-in route — Claude Haiku 4.5 / Mistral
// Small per architecture L70). Opt-in is enforced UPSTREAM in the service
// (requireThirdPartyOptIn) before this client is ever called — the client
// itself only owns the transport. THIRD_PARTY_LLM_API_KEY lives ONLY in
// Dokploy env. Hard 10 s timeout (NFR-5: third-party p95 ≤ 3 s).
import type { Env } from "../../../config/env";
import type { LlmProviderCompletion } from "@pekulo/types";
import type { LlmProvider } from "../llm-provider";
import { LlmError, llmProviderUnavailable } from "../llm.errors";

const THIRD_PARTY_TIMEOUT_MS = 10_000;

export function createThirdPartyClient(deps: { env: Env }): LlmProvider {
  const apiKey = deps.env.THIRD_PARTY_LLM_API_KEY;
  const baseUrl = deps.env.THIRD_PARTY_LLM_BASE_URL ?? "https://api.anthropic.com/v1/messages";
  const model = deps.env.THIRD_PARTY_LLM_MODEL ?? "claude-haiku-4-5";
  return {
    route: "third_party",
    async complete(prompt: string): Promise<LlmProviderCompletion> {
      if (!apiKey) {
        throw llmProviderUnavailable("third_party", "THIRD_PARTY_LLM_API_KEY not configured");
      }
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), THIRD_PARTY_TIMEOUT_MS);
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 64,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw llmProviderUnavailable("third_party", `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { content?: Array<{ text?: string }> };
        return {
          raw: data.content?.[0]?.text ?? "",
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (err) {
        if (err instanceof LlmError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw llmProviderUnavailable("third_party", `timeout after ${THIRD_PARTY_TIMEOUT_MS}ms`);
        }
        throw llmProviderUnavailable(
          "third_party",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
