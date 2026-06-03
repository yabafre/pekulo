# LLM routing — server-side audit authority with async client attestation

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

FR-31 prescribes three LLM transports — Apple FoundationModels (client, iOS ≥ 15 Pro), Ollama self-hosted on Dokploy VPS (server-side default for web + Android + older iOS), and a 3rd-party API (Claude Haiku 4.5 or Mistral Small) reserved for opt-in cases. NFR-12/13 forbid PII in prompts (≤ 2 kb) and 3rd-party calls without opt-in. NFR-26 + FR-36 require a single per-call audit log surfaced to the user. The Council split 2-2 between option A (server-side router only with synchronous client attestation) and option C (hybrid policy with split routing surfaces) ; B (client-aware router with three audit emitters) was unanimously rejected.

## Decision

Adopt **A\*** — server is the audit authority ; iOS clients render FoundationModels suggestions immediately and attest asynchronously.

- **`llm_call_log` is server-written only.** Every cloud-eligible request (Ollama or 3rd-party) is server-initiated and produces an `intent` row (`requested_at`, `route_requested`) before the call and an `outcome` row (`completed_at`, `route_actual`, `latency_ms`, `outcome`) after.
- **Client iOS calls FoundationModels locally** and renders the suggestion immediately in the UI ; attestation POST to `/api/llm/attest` is async fire-and-forget, backed by a durably-persisted retry queue in IndexedDB flushed on reconnect.
- **Opt-in for 3rd-party API is checked server-side before every cloud-eligible call** ; never trusted from the client. DR-7 enforced architecturally.
- **Server returns the actual route in the response payload** ; the client's "iOS / Ollama / Cloud" badge mirrors the server's truth, not the client's intention.
- **Intent ↔ outcome route mismatches** flagged for forensic review (server can detect if iOS attests "FoundationModels" while the prompt content suggests it should have routed differently).
- **Rule-based transfer bypass (FR-30)** runs entirely client-side and emits no LLM log entry.

## Why

- **NFR-26 + FR-36 (single audit log)** — server-as-authority survives schema drift across transports and gives the user one trustworthy "AI activity" surface (Raj's binding constraint).
- **NFR-5 (FoundationModels p95 < 600 ms)** — async attestation preserves the on-device latency edge ; UI does not block on a network round-trip (Winston's binding constraint).
- **DR-7 (3rd-party opt-in)** — server-side enforcement closes the client-bypass surface that option B left open.
- **GDPR Art. 5(1)(f) (integrity)** — server-written audit log is forensically defensible against a buggy or malicious client.
- **NFR-15 (100 concurrent users at (b))** — audit ingestion is one endpoint to scale and rate-limit, not three.

## Considered options

- **(A) Pure server-side router with synchronous attest** — rejected: 50–100 ms attestation round-trip eats 10–15 % of the FoundationModels latency budget (NFR-5).
- **(B) Client-aware router with three audit emitters** — unanimously rejected by Council: schema drift, opt-in unverifiable, NFR-26 broken.
- **(C) Hybrid policy** — equivalent in substance to A\* (same compute path, same audit ingestion) ; preferred labelling A\* because it makes the audit-authority crisp.

## Consequences

- **Async retry queue must be durable.** IndexedDB partition under the same per-user key as the offline cache (ADR-0003) ; flushed on reconnect ; surfaces in dev tools for debugging. If queue drop rate ever exceeds 1 %, pivot to pure A (synchronous attest) and accept the latency hit.
- **Forensic mismatch alerts.** Server alerts on intent ↔ outcome route divergence beyond a tolerance band (e.g. > 5 % of attestation rows over a rolling window). Wired into the OTel observability stack (ADR-0005).
- **No prompt content ever stored.** The audit log carries routing target, latency, outcome, and a short label hash for de-dup ; never the prompt body. NFR-26, DR-6.
- **Transparency notice (DR-12)** triggers on the _first_ user-visible LLM suggestion regardless of route ; routing badge transparency relies on the server-returned `route_actual` value, not the client guess.
- **Opt-in flag** stored per-user row in Supabase under RLS ; cached client-side with a hard-invalidation on every settings page render (Phase 3 process rule).
- **Third-party failure-fallback (realized 2026-05-31, story 6-4 Extension, commit `0876f77`).** The original design treated the 3rd-party route as opt-in-gated but never auto-selected (`decideRoute` returns FM for iOS, else Ollama). That left the "Modèles d'IA tiers" toggle functionally inert. The decision is now extended: `categorise()` escalates to the 3rd-party route when **both** (a) the primary Ollama route fails with a transport error/timeout, and (b) the per-user opt-in is set (re-checked server-side per call — DR-7 unchanged). A clean Ollama _abstention_ does NOT escalate. `decideRoute` is unchanged; the fallback is implemented in `categorise()` (`runDecision` + `routeDecision(intent, "third_party")`), and each route attempt writes its own intent+outcome pair, so the single-writer + route-mismatch-forensics guarantees above hold across the fallback. This is the **failure-fallback** slice only; the **low-confidence** escalation (escalate when Ollama answers with low confidence) remains deferred. The `LlmCategorisation` result type gained `failed: boolean` to let the categorise pipeline and the import backfill (architecture.md, Background schedulers) distinguish a transport failure (escalate / retry) from a clean abstention (stamp, don't retry).
- **Auto-apply on bulk import (realized 2026-06-02, story 6-7, FR-33 amended).** Bulk-import (source ∈ {csv, bridge}) transactions auto-apply the suggested category as the final category (category = suggestedCategory, suggested\_\* kept as provenance); interactive (source='manual') rows keep the suggestion→confirm flow. The categorise call is still audited identically (no new outcome row — the apply is a category write, not an LLM call).
