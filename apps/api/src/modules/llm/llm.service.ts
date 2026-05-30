// apps/api/src/modules/llm/llm.service.ts
// LLM routing policy (FR-31) + per-call audit authority (FR-35 / ADR-0008).
// route(intent) decides the endpoint and writes the INTENT audit row, then
// returns a providerCall thunk the categorise pipeline (story 6-2) invokes.
// recordLlmCall is the SOLE writer of llm_call_log (direct llmCallLog.create
// outside the repository is forbidden — architecture L691). callId is injected
// for deterministic tests (no PEKULO_DEV_NOW_ISO env seam — factory dep only).
import type {
  ClientCapabilities,
  LlmCallEvent,
  LlmPromptEnvelope,
  LlmRoute,
  LlmRouteDecision,
} from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import {
  requireThirdPartyOptIn,
  type ThirdPartyOptInReader,
} from "../../platform/security/opt-in-guard";
import { buildPromptEnvelope, hashLabel, type PromptBuilderInput } from "./llm-prompt-builder";
import { llmRoutingError } from "./llm.errors";

export interface RouteIntent {
  userId: string;
  clientCapabilities: ClientCapabilities;
  prompt: PromptBuilderInput;
}

export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  recordLlmCall(userId: string, event: LlmCallEvent): Promise<void>;
  /** Write an intent+outcome pair atomically (ADR-0008 attest path). Both
   * events are validated and persisted in one transaction so a crash can never
   * leave an orphan intent row. */
  recordLlmCallPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void>;
}

const VALID_ROUTES: ReadonlySet<LlmRoute> = new Set<LlmRoute>([
  "foundation_models",
  "ollama",
  "third_party",
]);

export function createLlmService(deps: {
  repository: LlmRepository;
  ollamaClient: LlmProvider;
  thirdPartyClient: LlmProvider;
  optInReader: ThirdPartyOptInReader;
  generateCallId: () => string;
}): LlmService {
  // Free helper avoids `this`-binding fragility (lesson 5-3).
  async function record(userId: string, event: LlmCallEvent): Promise<void> {
    if (!VALID_ROUTES.has(event.route)) {
      throw llmRoutingError(`unknown route ${String(event.route)}`);
    }
    await deps.repository.recordCallEvent(userId, event);
  }

  async function recordPair(userId: string, events: [LlmCallEvent, LlmCallEvent]): Promise<void> {
    for (const event of events) {
      if (!VALID_ROUTES.has(event.route)) {
        throw llmRoutingError(`unknown route ${String(event.route)}`);
      }
    }
    await deps.repository.recordCallEvents(userId, events);
  }

  // FR-31 routing policy. iOS-capable → on-device FoundationModels. Otherwise
  // Ollama is the default server route. third_party is NEVER auto-selected at
  // V1 (a) — an ambiguity-escalation policy (story 6-2+) is the only thing that
  // would return it, and even then the providerCall is opt-in-gated below.
  function decideRoute(caps: ClientCapabilities): LlmRoute {
    if (caps.iosFoundationModels) return "foundation_models";
    return "ollama";
  }

  return {
    async route(intent) {
      const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
      const labelHash = hashLabel(envelope.label);
      const route = decideRoute(intent.clientCapabilities);
      const callId = deps.generateCallId();
      // Intent row written BEFORE the call (ADR-0008).
      await record(intent.userId, { phase: "intent", callId, route, labelHash });

      let providerCall: LlmRouteDecision["providerCall"] = null;
      if (route === "ollama") {
        providerCall = () => deps.ollamaClient.complete(envelope);
      } else if (route === "third_party") {
        providerCall = async () => {
          // DR-7 — server-side opt-in gate before any third-party egress.
          await requireThirdPartyOptIn(deps.optInReader, intent.userId);
          return deps.thirdPartyClient.complete(envelope);
        };
      }
      // foundation_models → providerCall stays null (client-owned, attested).
      return { callId, route, providerCall };
    },

    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
}
