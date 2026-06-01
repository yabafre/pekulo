// apps/api/src/modules/llm/services/ollama-client.ts
// Ollama transport (FR-31 default server route). Localhost-bound on the
// Dokploy VPS, NOT publicly exposed; proxied through apps/api exclusively
// (architecture L232). Hard 5 s timeout as the failure boundary (NFR-5: Ollama
// p95 ≤ 1.5 s). Iso-pattern with holdings price clients.
import type { Env } from "../../../config/env";
import type { LlmProviderCompletion } from "@pekulo/types";
import type { LlmProvider } from "../llm-provider";
import { LlmError, llmProviderUnavailable } from "../llm.errors";

const OLLAMA_TIMEOUT_MS = 5_000;

export function createOllamaClient(deps: { env: Env }): LlmProvider {
  const baseUrl = deps.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  // Default qwen2.5:3b — instruction-tuned, strong FR + JSON-following for its
  // size, and CPU-fast enough to hold NFR-5 (Ollama p95 ≤ 1.5 s / 5 s hard cap).
  // Bump to qwen2.5:7b via OLLAMA_MODEL only on a GPU host — a 7B on CPU blows
  // the 5 s cap and every call would abstain.
  const model = deps.env.OLLAMA_MODEL ?? "qwen2.5:3b";
  return {
    route: "ollama",
    async complete(prompt: string): Promise<LlmProviderCompletion> {
      const startedAt = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          // format:"json" constrains Ollama's decoding to valid JSON — the
          // categoriser prompt asks for STRICT JSON, this makes it parseable
          // even on a small local model (fewer abstentions from malformed text).
          body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw llmProviderUnavailable("ollama", `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { response?: string };
        return { raw: data.response ?? "", latencyMs: Math.round(performance.now() - startedAt) };
      } catch (err) {
        if (err instanceof LlmError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw llmProviderUnavailable("ollama", `timeout after ${OLLAMA_TIMEOUT_MS}ms`);
        }
        throw llmProviderUnavailable("ollama", err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
