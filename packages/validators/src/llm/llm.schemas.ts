// packages/validators/src/llm/llm.schemas.ts
// Zod schemas for the LLM module (Epic 6, story 6-1). @pekulo/zod is the SOLE
// zod entry point (R1). llmPromptEnvelopeSchema is the runtime guard behind
// NFR-12 (allowlist via .strict()); attestLlmCallSchema validates the client
// attestation POST to /internal/llm/attest.
//
// Closed-enum source of truth lives in @pekulo/types (#LLM_ROUTES / #LLM_OUTCOMES)
// but @pekulo/validators CANNOT import @pekulo/types (one-way layering, R1 — a
// runtime import creates a TDZ cycle). So the literals are mirrored inline here,
// exactly like ACCOUNT_TYPES_MIRROR in accounts.schemas.ts. INVARIANT: these two
// mirrors MUST stay equal to @pekulo/types#LLM_ROUTES / #LLM_OUTCOMES verbatim.

import { z } from "@pekulo/zod";

const LLM_ROUTES_MIRROR = ["foundation_models", "ollama", "third_party"] as const;
const LLM_OUTCOMES_MIRROR = ["success", "failure"] as const;

export const llmRouteSchema = z.enum(LLM_ROUTES_MIRROR);
export const llmOutcomeSchema = z.enum(LLM_OUTCOMES_MIRROR);

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
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "occurredOn must be ISO date YYYY-MM-DD")
      // The regex only proves the SHAPE — "2026-13-45" / "2026-02-30" match it
      // but are not real calendar dates. Round-trip through Date to reject
      // out-of-range month/day before the value reaches the prompt envelope.
      // The NaN guard MUST run before toISOString(): an Invalid Date would make
      // toISOString() throw a RangeError (→ 500) instead of returning false here
      // (→ a clean validation rejection).
      .refine(
        (d) => {
          const dt = new Date(`${d}T00:00:00.000Z`);
          return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
        },
        { message: "occurredOn must be a real calendar date" },
      ),
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
//
// SECURITY (ADR-0008 audit integrity / architecture L307 — "client cannot forge
// FoundationModels to hide a 3rd-party call"): this endpoint exists ONLY for
// client-owned FoundationModels calls. Ollama / third_party are server-initiated
// AND server-logged (both rows written in llm.service), so a client must never be
// able to inject an `ollama`/`third_party` row into the append-only audit. The
// route is pinned to the FM literal — any other value is rejected (400) before a
// row is written. Use `llmRouteSchema` only where the full enum is legitimate.
export const attestLlmCallSchema = z.object({
  callId: z.string().min(1).max(64),
  route: z.literal("foundation_models"),
  latencyMs: z.number().int().nonnegative().max(120_000),
  outcome: llmOutcomeSchema,
  labelHash: z.string().min(1).max(128),
});

export type RouteIntentInput = z.infer<typeof routeIntentSchema>;
export type AttestLlmCallInput = z.infer<typeof attestLlmCallSchema>;

// Third-party LLM opt-in (story 6-3, FR-34 / NFR-13 / DR-7). A single boolean
// per user, default false. `llmOptInSchema` is the read DTO returned by
// llm.getOptIn; `updateLlmOptInSchema` is the llm.setOptIn input. No PII — just
// the flag. The inferred type is `LlmOptInState` (NOT `LlmOptIn`) to avoid
// shadowing the Prisma `LlmOptIn` model name in api code that imports both.
export const llmOptInSchema = z.object({
  thirdParty: z.boolean(),
});

export const updateLlmOptInSchema = z.object({
  thirdParty: z.boolean(),
});

export type LlmOptInState = z.infer<typeof llmOptInSchema>;
export type UpdateLlmOptInInput = z.infer<typeof updateLlmOptInSchema>;
