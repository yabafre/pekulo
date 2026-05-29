// packages/validators/src/llm/llm.schemas.ts
// Zod schemas for the LLM module (Epic 6, story 6-1). @pekulo/zod is the SOLE
// zod entry point (R1). llmPromptEnvelopeSchema is the runtime guard behind
// NFR-12 (allowlist via .strict()); attestLlmCallSchema validates the client
// attestation POST to /internal/llm/attest.

import { z } from "@pekulo/zod";
import { LLM_OUTCOMES, LLM_ROUTES } from "@pekulo/types";

export const llmRouteSchema = z.enum(LLM_ROUTES);
export const llmOutcomeSchema = z.enum(LLM_OUTCOMES);

export const clientCapabilitiesSchema = z.object({
  iosFoundationModels: z.boolean(),
});

// NFR-12 — strict allowlist. `.strict()` rejects any extra key (a smuggled
// userId / accountNumber) at parse time. The byte cap is enforced separately
// in the prompt builder (Zod sizes fields, not the serialized blob).
export const llmPromptEnvelopeSchema = z
  .object({
    label: z.string().min(1).max(512),
    amount: z.number().finite(),
    currency: z.string().length(3),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "occurredOn must be ISO date YYYY-MM-DD"),
    merchant: z.string().max(256).optional(),
  })
  .strict();

export const routeIntentSchema = z.object({
  clientCapabilities: clientCapabilitiesSchema,
  envelope: llmPromptEnvelopeSchema,
});

// Client attestation body (/internal/llm/attest). The client reports the
// on-device FoundationModels outcome; the server is the audit authority and
// writes the intent + outcome pair (ADR-0008).
export const attestLlmCallSchema = z.object({
  callId: z.string().min(1).max(64),
  route: llmRouteSchema,
  latencyMs: z.number().int().nonnegative().max(120_000),
  outcome: llmOutcomeSchema,
  labelHash: z.string().min(1).max(128),
});

export type RouteIntentInput = z.infer<typeof routeIntentSchema>;
export type AttestLlmCallInput = z.infer<typeof attestLlmCallSchema>;
