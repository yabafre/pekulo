// packages/types/src/llm/llm.types.ts
// LLM auto-categorisation domain types (Epic 6). Owned by story 6-1.
// LLM_ROUTES is the single source for the routing-target literal union; the
// Prisma enum `LlmRoute` (apps/api/prisma/schema/enums.prisma) and the Zod
// `llmRouteSchema` (@pekulo/validators) MUST stay iso with this list.

import type { Id } from "../shared";

export const LLM_ROUTES = ["foundation_models", "ollama", "third_party"] as const;
export type LlmRoute = (typeof LLM_ROUTES)[number];

export const LLM_OUTCOMES = ["success", "failure"] as const;
export type LlmOutcome = (typeof LLM_OUTCOMES)[number];

export type LlmCallLogId = Id<"LlmCallLogId">;
export type LlmOptInId = Id<"LlmOptInId">;

/** Client-capability signal driving the routing policy (FR-31). iOS ≥ 15 Pro
 * reports `iosFoundationModels: true`; web/Android always false at V1 (a). */
export interface ClientCapabilities {
  iosFoundationModels: boolean;
}

/** Zero-PII prompt envelope (NFR-12). The ONLY shape the prompt builder emits;
 * ≤ 2 kb once serialised. No userId, no account number, no compass amounts. */
export interface LlmPromptEnvelope {
  label: string;
  amount: number;
  currency: string;
  occurredOn: string; // ISO date YYYY-MM-DD
  merchant?: string;
}

/** Low-level provider completion. Story 6-1 ships the transport (raw text +
 * latency); the {category, confidence} parsing lands in story 6-2. */
export interface LlmProviderCompletion {
  raw: string;
  latencyMs: number;
}

/** Routing decision returned by llm.service.route (FR-31). `providerCall` is a
 * thunk the categorisation pipeline (story 6-2) invokes for server routes;
 * null for foundation_models (the call is client-owned, attested async). */
export interface LlmRouteDecision {
  callId: string;
  route: LlmRoute;
  /** djb2 digest of the prompt label (NFR-26 de-dup key). Exposed so the
   * categorise pipeline (story 6-2) can stamp the outcome row without
   * rebuilding the envelope. NEVER the prompt body — only the hash. */
  labelHash: string;
  providerCall: (() => Promise<LlmProviderCompletion>) | null;
}

/** Result of llm.service.categorise (FR-32, story 6-2). `category` is null when
 * the model abstained or returned an unparseable / out-of-enum value — the
 * caller then leaves the transaction uncategorised. `confidence ∈ [0, 1]`.
 * `route` is the actual server route that produced the answer (route_actual). */
export interface LlmCategorisation {
  callId: string;
  route: LlmRoute;
  category: string | null;
  confidence: number;
}

/** Audit events — the two phases of one logical LLM call (ADR-0008), both
 * written via llm.service.recordLlmCall (the sole writer), correlated by
 * callId. Append-only (NFR-26 / DR-6): never the prompt body, only a short
 * label hash for de-dup. */
export interface LlmCallIntent {
  phase: "intent";
  callId: string;
  route: LlmRoute;
  labelHash: string;
}

export interface LlmCallOutcomeEvent {
  phase: "outcome";
  callId: string;
  route: LlmRoute;
  labelHash: string;
  latencyMs: number;
  outcome: LlmOutcome;
}

export type LlmCallEvent = LlmCallIntent | LlmCallOutcomeEvent;

/** DTO surfaced by the 90-day activity log (story 6-5). No prompt content. */
export interface LlmCallLogEntry {
  id: LlmCallLogId;
  callId: string;
  phase: "intent" | "outcome";
  route: LlmRoute;
  latencyMs: number | null;
  outcome: LlmOutcome | null;
  occurredAt: string;
}
