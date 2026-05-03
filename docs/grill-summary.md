---
generated_by: aped-grill
generated_at: 2026-05-03T10:00:00+02:00
question_count: 14
decided_count: 12
deferred_count: 8
out_of_scope_count: 0
stop_reason: no-new-question
---

# Grill summary — refining Pekulo as a goal-based personal-finance product (Trade Republic-grade UX, Finary-grade scope)

## Decided

- **All three improvement axes are in scope, to be sequenced rather than parallelised** (Q1) — (A) close open threads, (B) harden what ships, (C) extend capabilities.
- **Primary target audience: beginner / intermediate retail users**, with Trade Republic as the UX reference; pros may benefit but never dictate UX trade-offs (Q5).
- **Functional scope: full personal-wealth coverage (Finary-class)** — investments + spending + goals; "not a finance grab-bag" is enforced through UX clarity, not through a narrow scope (Q6).
- **Product status ramp: (a) personal first → (b) public free / open-source if traction → (c) freemium if volume**. Currently entering (a) (Q7).
- **Goal structure: a single "compass" objective + supporting milestones** (mono primary + jalons, FIRE-style with intermediate steps) (Q8).
- **Compass format: target capital + target horizon** (e.g. "800 k€ by 2055"). Already encoded by the existing `hypotheses.objectif` + `hypotheses.horizon` columns; zero migration cost (Q9).
- **V1 functional perimeter** = existing modules + compass + milestones + LLM auto-categorisation + **crypto** + **real-estate** (Q10). AV-détail and PER deferred to V2.
- **Real-estate V1 depth: tracker (manual valuation + optional mortgage) + simple rental (rent + charges + cash-flow)**, no tax engine (Q11).
- **Primary product form: mobile-first PWA (Next.js + installable)** for V1; **React Native Expo + expo-router app** for V1.5 (~2 months, App Store publication when Apple licence is purchased) (Q12).
- **Design-system strategy: Tamagui Core (free, MIT) + in-house Pekulo Design System** rebuilt shadcn-style on top of Tamagui primitives (Q13). Accepted cost: 2-4 weeks of DS work before feature work resumes. Tamagui Pro explicitly rejected.
- **LLM hosting: hybrid with context-aware routing** (Q14):
  - On-device via Apple `FoundationModels` framework when iOS hardware supports it (iPhone 15 Pro and later)
  - Self-hosted Ollama on existing Dokploy VPS for web PWA, Android, older iOS
  - Third-party API (Claude Haiku 4.5 or Mistral Small) reserved for ambiguous cases or complex suggestions, with explicit user opt-in
- **LLM purpose narrowed and confirmed**: automatic categorisation/sorting of imported transactions — *not* trading speculation. Mature, low-risk use case.

## Deferred (still need a real-world answer)

- **Lots migration thread (placements-lots qs-04d)** (Q2-Q4) — was the original grill subject before the product-vision reframe. FIFO method and synthetic-lot bootstrap were tentatively chosen but should be re-confirmed when this thread is resumed. Recommended next: pick this back up via a scoped `aped-grill` after the product vision lands in PRD form.
- **Bank / wallet connectivity** (Powens, Bridge, exchange APIs) — explicitly tagged "later" by user; depends on the (a)→(b) ramp triggering. Recommended next: revisit at the moment of public-launch decision.
- **Crypto module depth** — manual entry vs. exchange API vs. cold-wallet xpub tracking. Not grilled. Recommended next: scoped `aped-grill crypto-depth` once the V1 core is stable.
- **What "spéculer" concretely means** — user mentioned it but only LLM auto-categorisation was nailed down. What-if scenarios on hypothèses, multi-scenario projections (optimistic / realistic / pessimistic), and LLM-backed optimisation suggestions all remain unspecified. Recommended next: this belongs in `aped-prd` problem-statement section.
- **Supabase RLS posture and at-rest encryption** — current state unverified by this grill. Becomes load-bearing the moment the (b) public ramp triggers. Recommended next: `aped-arch` security review before opening signup.
- **Pricing model for the eventual (c) freemium ramp** — no decision needed today. Recommended next: defer until usage signal exists.
- **AV-détail and PER modules** — explicitly tagged V2. Recommended next: revisit after V1 ships.
- **Hygiene cleanup of `docs/quick-specs/2026-04-27-placements-holdings.md`** (status: draft while qs-04a foundation is `done`) — likely superseded; either delete or mark `superseded`.

## Out of scope (pinned for later)

- (No items explicitly tagged out-of-scope during the grill — every drift was reframed and absorbed into Decided / Deferred. Trading-execution features are implicitly excluded by the "Pekulo is a tracker + planner, not a broker" framing but were never raised as a candidate.)

## Assumptions in play

- **Pekulo's central verb is "set a compass, everything aligns"** — uttered by the user mid-grill and treated as the structuring positioning principle. Differentiates Pekulo from TR ("buy/sell") and Finary ("see everything in one place"). All future scope and UX trade-offs should pass the "does it serve the compass?" filter.
- **The user is Persona #1** ("moi-même je suis concerné") — V1 design must serve the user's own real usage; if it doesn't work for the user, it doesn't ship.
- **Trade Republic = UX/style reference (dark mode flawless, light mode also offered); Finary = scope reference (full personal-wealth aggregation); Pekulo = goal-based approach as the differentiator.**
- **The Bun + Turborepo monorepo (qs-monorepo) is the assumed delivery substrate** for splitting `apps/web` (Next.js PWA), `apps/mobile` (Expo RN), and `packages/ui` (Tamagui DS).
- **The existing Dokploy VPS already running `prices-service` is reused for the Ollama LLM endpoint** — no new infra commitment.
- **The user-mentioned UI/UX skills (`ui-ux-pro-max`, `frontend-design`, `frontend-design-system`, `web-design-guidelines`) were not verified to exist in the local skill registry during this grill.** When the design-system phase starts, either install them or substitute with `aped-ux` + an explicit DS spec.
- **The current `hypotheses` table schema with single `objectif` and `horizon` columns is preserved**; the milestones structure is added alongside, not in replacement.
- **Apple `FoundationModels` framework is assumed available and fit for transaction categorisation** at implementation time. Should be fact-checked against current iOS API limits (prompt size, allowed task types) when the iOS app work starts.

## Suggested next skill

- **`aped-prd`** — the grill shaped a clear problem statement, target audience, scope boundary, central verb, V1 perimeter, and ramp strategy. PRD is the right next artefact to anchor everything decided here.
- After PRD: `aped-arch` to commit the design-system and Tamagui setup, the LLM routing topology, and the security posture; `aped-ux` for the dark/light DS work; then standard `aped-epics`/`aped-story` flow.
