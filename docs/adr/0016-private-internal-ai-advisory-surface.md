# Private internal AI advisory surface — DR-3 carve-out, NFR-12 exception, allowlist-gated access

**Date:** 2026-06-02
**Status:** accepted
**Decided by:** Alex (with Fred — regulatory framing of the private-circle boundary)
**Amends:** DR-3 (scoped carve-out, this surface only), NFR-12 (scoped exception, this surface only)
**Relates:** ADR-0008 (LLM routing / server audit authority), ADR-0013 (Prisma RLS defense in depth), ADR-0015 (Bridge agent-of + encrypted token storage)

## Context

Pekulo's **public** product deliberately locks the LLM down:

- **DR-3** — "LLM task surface is locked to categorisation (+ batch suggestions). **No buy/sell recommendation, ever.**"
- **NFR-12** — **0 user identifiers, 0 account numbers, 0 compass amounts** in any LLM prompt; allowlist = `{transaction label, amount, currency, occurred-on date, optional merchant}`; prompt ≤ 2 kb; sole construction site = `llm-prompt-builder.ts`.

Fred (Persona #1 / Alex) wants a **PRIVATE, INTERNAL** tool — explicitly **not** part of the public product, **not** for sale — that:

1. analyses **his own** Pekulo account (wealth, allocation, gap-to-compass, cashflow);
2. produces **analysis + recommendations including instrument-level buy/sell**, and proposed adjustments;
3. is shareable with a **closed circle** — Fred + a few **name-authorized** Pekulo users (e.g. his best friend, his coding partner) — with the ability to **authorize and ban** specific users;
4. is reachable only through a **secure, access-controlled** route.

This collides head-on with DR-3 and NFR-12 — both authored for the public product. The collision must be resolved by an explicit decision before any epic or story exists (per the user's `Décision → epic → story` sequencing).

**Regulatory backdrop** (researched 2026-06-01, recorded in memory `project_pekulo_ai_strategy`): a personalized recommendation on a specific instrument = "conseil en investissement" (MiFID II / AMF Position DOC-2008-23) → would require **CIF or PSI** status + MiFID II suitability. **But** the regulated activity is the provision of that service **to a third party / client, as a habitual professional activity, typically for remuneration, held out as a service.** A strictly **private, free, non-commercial, non-habitual** tool that a person uses on **their own** money — extended to a **closed circle of named acquaintances** — sits **outside** the regulated activity (the same reason ChatGPT/Claude give portfolio opinions without a CIF: general tool, no holding-out, no remuneration). The line is crossed at **public exposure / roster growth beyond a closed personal circle / any remuneration / marketing (holding-out)**.

## Decision

### 1. Isolated, non-product surface

A dedicated **private advisory surface** is built — its own route/page, its own LLM prompt builder, its own access gate — and tagged **internal / non-product** everywhere it appears (code header, epic, this ADR). It is **outside** the public V1 ramp tiering. The public DR-3 + NFR-12 rules stay **fully in force everywhere else**; this ADR scopes two narrow exceptions to **this surface only**.

### 2. DR-3 carve-out (scoped to this surface)

On this private surface the LLM **MAY** produce analysis + recommendations **including instrument-level buy/sell**. The public DR-3 ("no buy/sell recommendation, ever") is **unchanged** for the public product. The carve-out is **annotated at every relevant doc** (PRD DR-3, architecture drivers) and at the surface's code header so no reader/auditor ever concludes the public product recommends instruments (lesson 2026-05-31 — a scoped exception that desyncs from docs is a traceability defect).

**Regulatory guardrail (binding invariant).** The carve-out is lawful **only while** the surface stays:
(a) **private** (no public access);
(b) **free / non-commercial** (no remuneration tied to it);
(c) limited to a **closed circle** of named-authorized acquaintances;
(d) **non-habitual / non-held-out** (not marketed, not presented as an advice service).
The **allowlist + ban (§4) is the technical control that enforces (a) + (c)** — it is a compliance mechanism, not a feature nicety.

### 3. NFR-12 exception (scoped to this surface)

On this private surface the LLM **MAY** receive the user's **real financial figures** (balances, allocation, gap-to-compass, fiscalité) — meaningful analysis requires it. Constraints:

- **Deterministic engine owns every number.** A deterministic analysis engine computes all figures (allocation, projections, gap-to-cap, fees, fiscalité); the LLM **explains and recommends over them but never produces a figure**. (Mirrors the project-wide principle "the deterministic engine owns the math; the LLM is the language layer" — keeps recommendations grounded and auditable even privately.)
- **Dedicated prompt builder.** This surface gets its **own** prompt builder, **distinct** from `llm-prompt-builder.ts` (which keeps the NFR-12-strict categorisation allowlist untouched). Two builders, two contracts.
- **Provider posture.** No-train-by-default + **EU region** + **ZDR** where available. Claude / Mistral (EU-hosted) are the defaults; the surface is model-agnostic via the `LlmProvider` abstraction. (Grok is permissible for strictly personal use but carries non-legal caveats — X/MAR sentiment noise, xAI/X GDPR-enforcement history; see §Considered options.)

The public NFR-12 (0 amounts to LLM) is **unchanged** for categorisation and every other surface.

### 4. Access / authorization model (the compliance control)

- An **allowlist** of authorized Pekulo users + a **ban** capability, as a **new authz layer above** the brownfield Supabase auth (epic 8 auth flows are still `pending`; this surface predates them and needs its own gate). Owner / grantor = Fred.
- **Storage:** a dedicated RLS table (working name `advisory_access`: `user_id` → `auth.users(id) ON DELETE CASCADE`, `status: active | banned`, `granted_by`, `granted_at`, `banned_at`), following ADR-0013 — service-role connection + explicit `where: { userId }` + the `no-prisma-query-without-user-id` lint + per-row RLS as defense-in-depth.
- **Enforcement:** the route/page checks allowlist membership **server-side on every request** (never trusted from the client); a non-member or banned user is rejected **403 < 100 ms** (iso NFR-9). Banning takes effect immediately (next request fails the gate).
- **Encrypted access / data at rest:** access rides the existing httpOnly-cookie + CSP-nonce auth (story 11-7 / #104). Any persisted advisory artefact (conversation, analysis snapshot, cached financial context) is per-user RLS + **field-level encrypted at rest** (pgcrypto / Vault, iso the Bridge token pattern in ADR-0015) — exact persistence scope is decided in the epic.

### 5. Reuse the epic-6 LLM foundation

Route through the existing `apps/api/src/modules/llm/` (`llm.module` / `llm.service` / `llm.repository`, `LlmProvider`, routing + audit per ADR-0008) rather than duplicating a parallel LLM stack. The advisory surface adds: its own prompt builder (§3), its own task type, and writes its own `llm_call_log` intent/outcome pairs through the **single** server-side writer (server-as-authority, ADR-0008, unchanged). It **does not** touch the categorisation path.

## Why

- **Private / closed-circle use is outside the regulated activity** (which is providing advice to a third party, as a business, habitually, for remuneration). DR-3 + NFR-12 are **public-product guards**; a deliberately-isolated internal surface can carry **narrow, scoped** exceptions without weakening the public posture.
- **Deterministic-engine-owns-numbers** keeps recommendations grounded (LLMs hallucinate figures) and auditable — the right shape even when only Fred sees it.
- **Allowlist/ban-as-compliance-control** turns the regulatory boundary into a **code invariant**, not a policy note — substance over form: the closed circle is technically enforced, and the flip point is a guard, not a hope.
- **Reusing epic-6** preserves the single audit authority (ADR-0008) and avoids a second LLM stack to secure and maintain.

## Considered options

- **(A) No carve-out — keep DR-3/NFR-12 absolute** (tool only describes, never recommends, never sees amounts). Rejected by Fred: he wants real instrument-level analysis on his real figures.
- **(B) Build it as a public Pekulo feature.** Rejected: would require CIF/PSI or a licensed partner + full MiFID II suitability per recommendation; out of scope, and not the intent (this is internal, not a product).
- **(C) A throwaway/local tool outside Pekulo** (e.g. paste data into ChatGPT/Grok). Rejected: Fred wants it wired to his Pekulo account/data, with a proper access-controlled circle and the deterministic engine — not a copy-paste flow.
- **(D) — chosen —** scoped DR-3 + NFR-12 exceptions on an **isolated, allowlist-gated internal surface** reusing the LLM foundation.
- **Provider sub-decision — Grok vs Claude/Mistral.** Grok 4.3 (xAI) is real and its live-X edge is irrelevant here; on neutral finance benchmarks it trails Claude/GPT/Gemini (~85% vs ~87-88%), and for a regulated-shaped surface its X-sentiment is a liability (MAR Art.20) — though for **strictly private** use the MAR objection drops (no dissemination to others). xAI's API posture is enterprise-credible (no-train default, EU-West, enterprise ZDR) but X/xAI carries a GDPR-enforcement history. Conclusion: **model-agnostic via `LlmProvider`; Claude/Mistral EU are the safer defaults; Grok is a permissible personal-use experiment with documented non-legal caveats.**

## Consequences

- **New epic (internal / non-product)** with stories: deterministic analysis engine; advisory LLM surface + dedicated prompt builder; allowlist/ban authz + RLS table; encrypted persistence; the private page/route + UI. **Not** in the public V1 ramp tiering. (Owned by the `aped-epics` step that follows this ADR.)
- **Doc-sync obligations (lesson 2026-05-31 — tracked, paid in the epic step, NOT silently):**
  - PRD **DR-3** gains an annotated note: _"Scoped carve-out for the private internal advisory surface — see ADR-0016. The public ban stays total."_
  - PRD **NFR-12** gains the analogous scoped-exception note.
  - `architecture.md` drivers gain the surface + its dedicated prompt builder + the `advisory_access` table.
  - `epics.md` gains the new epic.
    These annotations must keep the public ban/allowlist **visibly bounded** so the carve-out can never be read as a product-wide policy.
- **Security posture** — a new surface that sends real financials to an LLM provider. Pre-share / pre-(b) audit must confirm: provider no-train + EU + ZDR; a non-allowlisted/banned user cannot reach the surface; advisory artefacts are RLS + encrypted at rest. Updates `project_pekulo_security_posture`.
- **Regulatory posture** — lawful **only** under the §2 closed-circle conditions; the allowlist is the control; the flip point is documented in Pivot conditions. If ever opened, the CIF/PSI analysis (and a possible licensed-partner route, iso the ADR-0015 agent-of framing) must be redone **before** any public traffic.

## Pivot conditions

- **Surface opened to the public / roster grows beyond a closed personal circle / any remuneration attached / it gets marketed (held-out)** → **HALT.** It is now "conseil en investissement" → route through **CIF/PSI or a licensed partner** before any further traffic. Re-open this ADR.
- **A non-allowlisted or banned user can reach the surface (gate bug)** → **[BLOCKER]** — the gate is a compliance control, not a feature; fix before any further use.
- **Provider terms change** (training on inputs, EU residency dropped) → switch provider via the `LlmProvider` abstraction before the next call.

## References

- ADR-0008 — LLM routing / server audit authority; reused foundation, single audit writer.
- ADR-0013 — Prisma RLS defense in depth; the `advisory_access` table + every advisory query follow `where: { userId }` + the lint rule + per-row RLS.
- ADR-0015 — Bridge agent-of + pgcrypto/Vault field-level encryption; precedent for the regulatory agent-of framing and the at-rest encryption pattern.
- PRD — DR-3, NFR-12 (the rules scoped here); FR-31..FR-36 (the epic-6 LLM foundation reused).
- Regulatory research 2026-06-01 (memory `project_pekulo_ai_strategy`) — MiFID II / AMF DOC-2008-23 personal-recommendation definition; CIF/PSI thresholds; the private-use / closed-circle boundary; provider posture (Grok vs Claude/Mistral).
