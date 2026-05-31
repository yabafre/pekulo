// apps/api/src/modules/llm/services/third-party-client.ts
// Third-party LLM transport (FR-31 opt-in route). OpenAI-COMPATIBLE transport
// (POST /v1/chat/completions) so ONE client speaks to any provider behind that
// de-facto-standard shape, selected purely via env (no code change to swap):
//   - Mistral La Plateforme — EU-hosted, RGPD-friendly → the DEFAULT (prod).
//   - OpenRouter — dev/test model comparison (point _BASE_URL at it, swap _MODEL).
//   - OpenAI / Groq / Together / … — same shape.
// NOTE: Anthropic's NATIVE API (/v1/messages) is NOT this shape — reach Claude
// via OpenRouter (model `anthropic/claude-haiku-4.5`), not the native endpoint.
// Opt-in is enforced UPSTREAM in the service (requireThirdPartyOptIn) before
// this client is ever called — the client only owns the transport.
// THIRD_PARTY_LLM_API_KEY lives ONLY in Dokploy env. Hard 10 s timeout
// (NFR-5: third-party p95 ≤ 3 s).
import type { Env } from "../../../config/env";
import type { LlmProviderCompletion } from "@pekulo/types";
import type { LlmProvider } from "../llm-provider";
import { LlmError, llmProviderUnavailable } from "../llm.errors";

const THIRD_PARTY_TIMEOUT_MS = 10_000;
// EU-hosted default (docs/rgpd-readiness.md: prefer no extra-EU transfer). For
// dev/test, override THIRD_PARTY_LLM_BASE_URL with
// https://openrouter.ai/api/v1/chat/completions + a catalog THIRD_PARTY_LLM_MODEL.
const DEFAULT_BASE_URL = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MODEL = "mistral-small-latest";

export function createThirdPartyClient(deps: { env: Env }): LlmProvider {
  const apiKey = deps.env.THIRD_PARTY_LLM_API_KEY;
  const baseUrl = deps.env.THIRD_PARTY_LLM_BASE_URL ?? DEFAULT_BASE_URL;
  const model = deps.env.THIRD_PARTY_LLM_MODEL ?? DEFAULT_MODEL;
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
            // OpenAI-compatible bearer auth (Mistral / OpenRouter / OpenAI / …).
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 64,
            // Closed-list categorisation → deterministic, no creativity needed.
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw llmProviderUnavailable("third_party", `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return {
          raw: data.choices?.[0]?.message?.content ?? "",
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
