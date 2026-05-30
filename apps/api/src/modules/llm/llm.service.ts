// apps/api/src/modules/llm/llm.service.ts
// LLM routing policy (FR-31) + per-call audit authority (FR-35 / ADR-0008) +
// categorisation (FR-32, story 6-2). routeDecision(intent) decides the endpoint
// and writes the INTENT audit row, then returns a providerCall thunk bound to a
// composed prompt string. categorise(intent) invokes that thunk, parses the
// completion, writes the OUTCOME audit row, and returns {category, confidence}.
// recordLlmCall is the SOLE writer of llm_call_log (direct llmCallLog.create
// outside the repository is forbidden — architecture L691). callId is injected
// for deterministic tests (factory dep, no env seam).
import type {
  ClientCapabilities,
  LlmCallEvent,
  LlmCategorisation,
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
import {
  buildCategorisationPrompt,
  buildPromptEnvelope,
  hashLabel,
  type PromptBuilderInput,
} from "./llm-prompt-builder";
import { parseCategorisation } from "./llm-categoriser";
import { llmRoutingError } from "./llm.errors";

export interface RouteIntent {
  userId: string;
  clientCapabilities: ClientCapabilities;
  prompt: PromptBuilderInput;
  /** Closed category list (story 6-2, FR-32). When present, route() composes the
   * categorisation prompt via buildCategorisationPrompt; when absent, the raw
   * envelope JSON is sent (back-compat with non-categorise callers). */
  categories?: readonly string[];
}

export interface LlmService {
  route(intent: RouteIntent): Promise<LlmRouteDecision>;
  /** Categorise a transaction (FR-32, story 6-2): routes (writes the intent
   * audit row), invokes the server provider, parses {category, confidence},
   * writes the outcome audit row, and returns the suggestion. Server-route only
   * — foundation_models abstains here (the iOS client owns + attests it).
   * NEVER throws: a provider failure, timeout, opt-in refusal, OR a failed
   * audit-row write all abstain to {category: null, confidence: 0} (a failure
   * outcome row is recorded best-effort). The suggestion is fire-and-forget on
   * the create hot path, so this contract is what keeps a slow/unreachable
   * model or a degraded audit DB from surfacing to the caller. */
  categorise(intent: RouteIntent): Promise<LlmCategorisation>;
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
  // Free helpers avoid `this`-binding fragility (lesson 5-3) — the factory
  // returns a plain object literal where `this` is unreliable across closures.
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
  // V1 (a); the opt-in guard below is the second line of defence.
  function decideRoute(caps: ClientCapabilities): LlmRoute {
    if (caps.iosFoundationModels) return "foundation_models";
    return "ollama";
  }

  async function routeDecision(intent: RouteIntent): Promise<LlmRouteDecision> {
    const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
    const labelHash = hashLabel(envelope.label);
    const route = decideRoute(intent.clientCapabilities);
    const callId = deps.generateCallId();
    // Intent row written BEFORE the call (ADR-0008).
    await record(intent.userId, { phase: "intent", callId, route, labelHash });

    // Categorisation prompt when a closed list is supplied (story 6-2); else
    // the raw envelope JSON. Composed by the sole NFR-12 site.
    const promptString = intent.categories?.length
      ? buildCategorisationPrompt(envelope, intent.categories)
      : JSON.stringify(envelope);

    let providerCall: LlmRouteDecision["providerCall"] = null;
    if (route === "ollama") {
      providerCall = () => deps.ollamaClient.complete(promptString);
    } else if (route === "third_party") {
      providerCall = async () => {
        // DR-7 — server-side opt-in gate before any third-party egress.
        await requireThirdPartyOptIn(deps.optInReader, intent.userId);
        return deps.thirdPartyClient.complete(promptString);
      };
    }
    // foundation_models → providerCall stays null (client-owned, attested).
    return { callId, route, labelHash, providerCall };
  }

  async function categoriseImpl(intent: RouteIntent): Promise<LlmCategorisation> {
    const categories = intent.categories ?? [];
    // decideRoute is pure — resolve the fallback route up front so a routing /
    // intent-row-write failure can still return a typed abstention instead of
    // throwing (the `categorise` contract is best-effort, never-throws).
    const fallbackRoute = decideRoute(intent.clientCapabilities);
    let decision: LlmRouteDecision;
    try {
      decision = await routeDecision(intent);
    } catch {
      // The intent row write (or envelope build) failed BEFORE any provider
      // call — nothing was persisted, so there is no orphan intent row. Abstain
      // rather than surface the error to the (fire-and-forget) caller.
      return { callId: "", route: fallbackRoute, category: null, confidence: 0 };
    }
    // foundation_models (null providerCall) → the server cannot run the call;
    // the iOS client owns it and attests separately (ADR-0008). Abstain with
    // NO outcome row (no server call happened).
    if (!decision.providerCall) {
      return { callId: decision.callId, route: decision.route, category: null, confidence: 0 };
    }
    try {
      const completion = await decision.providerCall();
      const parsed = parseCategorisation(completion.raw, categories);
      await record(intent.userId, {
        phase: "outcome",
        callId: decision.callId,
        route: decision.route,
        labelHash: decision.labelHash,
        latencyMs: completion.latencyMs,
        outcome: parsed.category ? "success" : "failure",
      });
      return {
        callId: decision.callId,
        route: decision.route,
        category: parsed.category,
        confidence: parsed.confidence,
      };
    } catch {
      // Provider unavailable / timeout / opt-in refused → record a failure
      // outcome (latency unknown → 0) and abstain. NEVER rethrow: a suggestion
      // is best-effort and must not fail the caller's create path. The outcome
      // write is itself best-effort — if the audit DB is down it must still
      // abstain (the intent row already attests the attempt).
      try {
        await record(intent.userId, {
          phase: "outcome",
          callId: decision.callId,
          route: decision.route,
          labelHash: decision.labelHash,
          latencyMs: 0,
          outcome: "failure",
        });
      } catch {
        /* audit unavailable — the intent row already records the attempt */
      }
      return { callId: decision.callId, route: decision.route, category: null, confidence: 0 };
    }
  }

  return {
    route: routeDecision,
    categorise: categoriseImpl,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
}
