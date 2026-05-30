// apps/api/src/modules/llm/llm-prompt-builder.ts
// NFR-12 — the SOLE construction site for any LLM prompt envelope. Strips to
// the {label, amount, currency, occurredOn, merchant?} allowlist and enforces
// the ≤ 2 kb serialized cap. Prompt construction anywhere else is forbidden
// (architecture L690 + review). Pure: no I/O, no logger, no clock, no env.

import { llmPromptEnvelopeSchema } from "@pekulo/validators";
import type { LlmPromptEnvelope } from "@pekulo/types";
import { llmRoutingError } from "./llm.errors";

const MAX_ENVELOPE_BYTES = 2_048;

export interface PromptBuilderInput {
  label: string;
  amount: number;
  currency: string;
  occurredOn: string;
  merchant?: string;
  // Any extra field a caller might smuggle (userId, accountNumber, …) is
  // dropped by the explicit allowlist pick below.
  [extra: string]: unknown;
}

export function buildPromptEnvelope(input: PromptBuilderInput): LlmPromptEnvelope {
  // 1. Explicit allowlist pick — extra keys never reach the parser.
  const picked = {
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.occurredOn,
    ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
  };
  // 2. Strict parse — .strict() rejects any leftover non-allowlisted key.
  const envelope = llmPromptEnvelopeSchema.parse(picked) as LlmPromptEnvelope;
  // 3. Hard byte cap on the serialized blob (NFR-12). This UTF-8 byte cap — NOT
  // the schema's per-field character caps (.max(512)/.max(256)) — is the
  // authoritative NFR-12 guard: a multibyte label/merchant (e.g. CJK, 3 bytes
  // per char) can pass the character caps yet exceed 2 kB once serialised, and
  // is correctly rejected here. The two limits are deliberately not reconciled.
  const bytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
  if (bytes > MAX_ENVELOPE_BYTES) {
    throw llmRoutingError(`prompt envelope ${bytes}B exceeds ${MAX_ENVELOPE_BYTES}B cap`);
  }
  return envelope;
}

/** Short, stable, non-reversible digest of the label for audit de-dup. NEVER
 * the prompt body — only a digest (NFR-26). djb2 is enough for de-dup. */
export function hashLabel(label: string): string {
  let h = 5381;
  for (let i = 0; i < label.length; i++) {
    h = ((h << 5) + h + label.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
