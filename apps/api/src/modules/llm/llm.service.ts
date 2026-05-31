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
  /** Read the per-user third-party opt-in flag (story 6-3, FR-34). Default
   * false when no row exists. */
  getThirdPartyOptIn(userId: string): Promise<boolean>;
  /** Set the per-user third-party opt-in flag (story 6-3, FR-34). Returns the
   * persisted value. */
  setThirdPartyOptIn(userId: string, value: boolean): Promise<boolean>;
  getAiNoticeSeen(userId: string): Promise<boolean>;
  markAiNoticeSeen(userId: string): Promise<void>;
  /** Categorise a transaction (FR-32, story 6-2): routes (writes the intent
   * audit row), invokes the server provider, parses {category, confidence},
   * writes the outcome audit row, and returns the suggestion. Server-route only
   * — foundation_models abstains here (the iOS client owns + attests it).
   * THIRD-PARTY FALLBACK (2026-05-31): when the primary Ollama route FAILS
   * (transport error/timeout) AND the user opted in (FR-34/DR-7), the call
   * escalates to the third-party route with its own intent+outcome rows. A clean
   * Ollama abstention does NOT escalate.
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
  async function getOptIn(userId: string): Promise<boolean> {
    return deps.repository.isThirdPartyOptedIn(userId);
  }

  async function setOptIn(userId: string, value: boolean): Promise<boolean> {
    return deps.repository.setThirdPartyOptIn(userId, value);
  }

  async function getAiNotice(userId: string): Promise<boolean> {
    return deps.repository.getAiNoticeSeen(userId);
  }
  async function markAiNotice(userId: string): Promise<void> {
    return deps.repository.markAiNoticeSeen(userId);
  }

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

  async function routeDecision(
    intent: RouteIntent,
    forceRoute?: LlmRoute,
  ): Promise<LlmRouteDecision> {
    const envelope: LlmPromptEnvelope = buildPromptEnvelope(intent.prompt);
    const labelHash = hashLabel(envelope.label);
    // forceRoute lets categorise() escalate to third_party on Ollama failure
    // (opt-in only). decideRoute itself still NEVER auto-selects third_party.
    const route = forceRoute ?? decideRoute(intent.clientCapabilities);
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

  // Run an already-routed decision end-to-end: invoke the provider, parse the
  // completion, write the OUTCOME row. NEVER throws. `threw` distinguishes a
  // transport failure (provider unavailable/timeout/opt-in refused — fallback-
  // eligible) from a clean abstention (parsed category null, provider answered).
  // The outcome write is best-effort; if the audit DB is down the intent row
  // already attests the attempt.
  async function runDecision(
    userId: string,
    decision: LlmRouteDecision,
    categories: readonly string[],
  ): Promise<{ result: LlmCategorisation; threw: boolean }> {
    const providerCall = decision.providerCall;
    if (!providerCall) {
      // foundation_models — server can't run it; client owns + attests. No
      // outcome row (no server call happened). Not a transport failure.
      return {
        result: {
          callId: decision.callId,
          route: decision.route,
          category: null,
          confidence: 0,
          failed: false,
        },
        threw: false,
      };
    }
    try {
      const completion = await providerCall();
      const parsed = parseCategorisation(completion.raw, categories);
      await record(userId, {
        phase: "outcome",
        callId: decision.callId,
        route: decision.route,
        labelHash: decision.labelHash,
        latencyMs: completion.latencyMs,
        outcome: parsed.category ? "success" : "failure",
      });
      return {
        result: {
          callId: decision.callId,
          route: decision.route,
          category: parsed.category,
          confidence: parsed.confidence,
          failed: false,
        },
        threw: false,
      };
    } catch {
      try {
        await record(userId, {
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
      return {
        result: {
          callId: decision.callId,
          route: decision.route,
          category: null,
          confidence: 0,
          failed: true,
        },
        threw: true,
      };
    }
  }

  async function categoriseImpl(intent: RouteIntent): Promise<LlmCategorisation> {
    const categories = intent.categories ?? [];
    // decideRoute is pure — resolve the fallback route up front so a routing /
    // intent-row-write failure can still return a typed abstention instead of
    // throwing (the `categorise` contract is best-effort, never-throws).
    const fallbackRoute = decideRoute(intent.clientCapabilities);
    let primaryDecision: LlmRouteDecision;
    try {
      primaryDecision = await routeDecision(intent);
    } catch {
      // The intent row write (or envelope build) failed BEFORE any provider
      // call — nothing was persisted, so there is no orphan intent row. Treat as
      // a clean abstention (failed:false): a malformed row must not be retried
      // forever by the backfill sweep.
      return { callId: "", route: fallbackRoute, category: null, confidence: 0, failed: false };
    }

    const primary = await runDecision(intent.userId, primaryDecision, categories);
    if (primary.result.category || !primary.threw) {
      // Success, OR a clean abstention / foundation_models: nothing to escalate.
      return primary.result;
    }

    // FALLBACK (user decision 2026-05-31): Ollama is local-first; when it FAILS
    // (unavailable/timeout) AND the user opted in to third-party (FR-34/DR-7),
    // escalate to the third-party route. Only a transport failure escalates — a
    // clean abstention does not. This is the failure-fallback slice of the
    // FR-31 escalation (the low-confidence variant stays deferred). Web traffic
    // routes to ollama by default, so this is the path the opt-in toggle drives.
    if (primaryDecision.route !== "ollama") return primary.result;
    let optedIn = false;
    try {
      optedIn = await deps.optInReader.isThirdPartyOptedIn(intent.userId);
    } catch {
      optedIn = false;
    }
    if (!optedIn) return primary.result;

    let fbDecision: LlmRouteDecision;
    try {
      fbDecision = await routeDecision(intent, "third_party");
    } catch {
      // third-party intent-row write failed before any call — abstain on the
      // primary (ollama) result; no orphan third-party row.
      return primary.result;
    }
    const fb = await runDecision(intent.userId, fbDecision, categories);
    return fb.result;
  }

  return {
    route: routeDecision,
    categorise: categoriseImpl,
    getThirdPartyOptIn: getOptIn,
    setThirdPartyOptIn: setOptIn,
    getAiNoticeSeen: getAiNotice,
    markAiNoticeSeen: markAiNotice,
    recordLlmCall: record,
    recordLlmCallPair: recordPair,
  };
}
