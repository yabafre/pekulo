# Product Requirements Document — Pekulo

**Author:** Alex
**Date:** 2026-05-03
**Inputs:** `docs/grill-summary.md` (2026-05-03, brief surrogate per user override) + `docs/project-context.md` (brownfield snapshot, 2026-05-03)
**Mode:** interactive
**Domain:** fintech (high complexity) — tracker + planner positioning, not broker
**Project type:** web_app (PWA) + mobile_app (Expo RN, V1.5)

## Executive Summary

Pekulo is a goal-based personal-finance application that consolidates a user's full personal wealth (cash, investments, crypto, real-estate) under a single compass — a target capital and target horizon — and aligns every screen, computation, and recommendation with progress toward that compass. Pekulo's central verb is _"set a compass, everything aligns"_: it differentiates Pekulo from Trade Republic ("buy/sell") and Finary ("see everything in one place") by making the long-horizon goal the structuring axis of the entire product, not a sidebar widget.

The V1 product is a mobile-first installable PWA built on the existing `apps/web` Next.js 16 + Supabase stack, extended with (i) the compass + intermediate milestones, (ii) automatic LLM-driven categorisation of imported transactions, (iii) crypto holdings, and (iv) a tracker-grade real-estate module with optional mortgage and simple rental cash-flow. A native React Native (Expo) application reusing a shared Tamagui-based Pekulo Design System (under `packages/ui`) ships at V1.5, ~2 months after V1 stabilises.

The product follows a deliberate three-stage ramp: (a) personal use by Persona #1 (the author) until the compass loop is proven on real life; (b) free / open-source public release if traction signal exists; (c) freemium if usage volume justifies paid tiers. (a) is starting now; the PRD anchors V1 around (a), but every architectural and security decision is taken with (b) explicitly in mind.

LLM features use a hybrid hosting topology (Apple `FoundationModels` on capable iOS hardware, self-hosted Ollama on the existing Dokploy VPS for everyone else, third-party API gated behind explicit user opt-in for ambiguous cases) — narrowly scoped to automatic transaction categorisation, never to investment recommendation or speculation.

### Product Vision

Pekulo exists because today's retail-finance tools force users to choose between breadth (Finary aggregates everything but the goal is decorative) and execution polish (Trade Republic is delightful but only covers brokerage). Pekulo's wager is that beginner and intermediate retail users — the same audience Trade Republic optimises for — deserve a single product where a clearly-stated long-horizon goal organises every screen and every number. The vision is that a user opens Pekulo and within five seconds knows: _am I on track for my compass?_ — and the rest of the app earns its right to exist by answering follow-up questions to that one.

### Purpose Statement

Pekulo's purpose is to give a single retail user clarity and alignment over their personal-wealth trajectory: a target capital + horizon (the compass), milestones that decompose the journey, and a daily/monthly view in which every transaction, holding, and account contributes to (or detracts from) compass progress. The purpose is not to enable trading, give regulated investment advice, replace a broker, or model tax — explicit non-goals reinforced in the Out of Scope section.

## Success Criteria

### User Outcomes

- U1. Persona #1 (Alex) can answer _"am I on track for my compass?"_ within 5 seconds of opening Pekulo, on every device, every session.
- U2. Alex can record a real-life month (income, spending, transfers, broker top-up, holding price drift, crypto move, mortgage payment) end-to-end without leaving the app or relying on a spreadsheet.
- U3. Alex spends under 30 seconds per imported transaction confirming or correcting the LLM-suggested category — substantially less than manual categorisation in his current workflow.
- U4. Alex sees at least one milestone between today and the compass at all times; "compass-only" without intermediate milestones is treated as an unfinished setup state.

### Business Outcomes

- B1. A working V1 instance runs in production for Persona #1 for at least 60 days before any (b) public-ramp decision is taken.
- B2. Pekulo is positioned at launch as "goal-based personal-finance" (not "another portfolio tracker"), with the compass visible on every entry point.
- B3. When the (b) public ramp triggers, opening signup adds zero new datastore commitments beyond Supabase + the existing Dokploy VPS — total infra cost under €25/month for the first 100 users.

### Technical Outcomes

- T1. The code base is a single Bun + Turborepo monorepo with `apps/web`, `apps/mobile` (V1.5), `apps/prices`, and `packages/ui` (the Pekulo Design System on top of Tamagui Core).
- T2. Pekulo's design system is the only styling primitive layer used by both `apps/web` and `apps/mobile` from V1.5 onward — no per-app Tailwind / NativeWind divergence.
- T3. All persisted user data lives in Supabase Postgres with per-row RLS via `auth.uid() = user_id` on every table (existing pattern extended, never relaxed).
- T4. The LLM categorisation pipeline routes between Apple FoundationModels (capable iOS) → self-hosted Ollama (default) → third-party API (opt-in only) with the routing decision logged per request.

### Measurable Outcomes

- M1. Compass-progress computation latency under 300 ms p95 on the dashboard route (`/dashboard`) for Persona #1's data volume.
- M2. Price-quote orchestration (4-tier fallback) returns a quote in under 1.5 s p95 for cached holdings, under 4 s p95 for cold lookups.
- M3. Auto-categorisation accuracy at or above 80 % on Persona #1's labelled history before LLM categorisation is enabled by default; below that, it ships behind a feature flag.
- M4. Time-to-first-meaningful-paint on `/dashboard` under 2.5 s on a mid-range Android device on 4G (Persona #1 baseline target).
- M5. Lighthouse PWA score at or above 90 on `apps/web` before V1 personal-use is declared "in production".

## Product Scope

### MVP (Phase 1 — V1, ramp stage (a) personal use)

In scope, all required to declare V1 shipped:

1. Compass — single primary objective: target capital (€) + target horizon (year). Persisted via existing `hypotheses.objectif` + `hypotheses.horizon_years` columns; no schema migration.
2. Milestones — ordered intermediate steps between today and the compass (e.g. "100 k€ by 2032", "300 k€ by 2042"). New `milestones` table, sibling of `hypotheses`. At least one milestone is required for compass setup to be considered complete.
3. Existing modules carried over — accounts, holdings (with lots), monthly tracking, transactions, KPIs, hypotheses dashboard. No regression.
4. Crypto holdings — manual entry only at V1 (kind extension on `holding_kind` enum: `crypto`); price provider chain reused (Yahoo + Twelve Data both cover BTC/ETH).
5. Real-estate (tracker tier) — manual valuation, optional mortgage (principal, rate, term, monthly payment), and simple rental block (rent + charges + monthly cash-flow). No tax engine. New `real_estate` and optional `real_estate_rental` tables.
6. LLM transaction categorisation — on-device (Apple FoundationModels) when available, Ollama on Dokploy VPS otherwise; third-party API only on explicit user opt-in. Categorises new imported transactions only; manual override always wins.
7. Mobile-first PWA — installable on iOS/Android home screen, offline-tolerant for read-only views, dark mode flawless + light mode also offered (Trade Republic UX reference).
8. Pekulo Design System (V1 baseline) — Tamagui Core + an in-house shadcn-style component layer in `packages/ui`, used by `apps/web`. The DS work is sequenced before mobile work (~2-4 weeks) and is a hard prerequisite for V1.5.

### Growth (Phase 2 — V1.5 + ramp stage (b) public free / open-source)

1. `apps/mobile` (Expo + expo-router, App Store + Play Store).
2. Public ramp readiness — Supabase RLS posture audit, at-rest encryption verification, signup/onboarding flow polished, public README + docs.
3. Open-source release of the repo (licence to be decided at the moment of decision — explicitly not chosen now).
4. Push notifications for compass-progress digests and milestone events (mobile-first; web push as a stretch).
5. Crypto module depth — pick from manual / exchange API / xpub-tracking after a scoped grill (deferred decision noted in `grill-summary.md`).
6. Lots-method confirmation — re-open the deferred `placements-lots` (FIFO vs other) thread in a scoped grill before the public ramp.

### Vision (Phase 3 — V2+, ramp stage (c) freemium if volume)

1. AV-détail (assurance-vie line-by-line breakdown beyond the current envelope-only `account_type: av`).
2. PER (plan d'épargne retraite — French retirement product, has its own tax behaviour).
3. Bank / wallet connectivity — Powens / Bridge for banks, exchange APIs for crypto, optional xpub for cold wallets.
4. What-if scenarios on hypotheses — multi-scenario projections (optimistic / realistic / pessimistic), LLM-backed optimisation suggestions (still narrow, still not advice).
5. Pricing model + paid tier — defined only when usage signal justifies.
6. Tax engine — explicitly out of scope until a French tax-domain expert is part of the team.

## Out of Scope

Capabilities considered and explicitly not in V1, V1.5, or V2 unless promoted later by an explicit `aped-course` correction:

- Trading execution / brokerage — Pekulo is a tracker + planner, never a broker. Trading-execution features are excluded structurally, not just sequenced.
- Regulated investment advice or buy/sell recommendations — even with LLM available, never. LLM scope is locked to categorisation.
- Tax computation (income tax, capital gains, property tax, IFI) — high regulatory risk, requires a domain expert; deferred indefinitely.
- Multi-user / multi-tenant features (shared accounts, advisor view, family plan) — RLS is single-user-per-row by design; multi-user is a V3+ concern.
- Day-trading dashboards, options chains, derivatives, leverage tracking — out of audience scope (beginner / intermediate retail).
- Non-EUR base currency at V1 — base currency is EUR for Persona #1; FX is best-effort via frankfurter.app for non-EUR holdings only. Multi-base-currency is a V2+ concern.
- Bank-account connectivity at V1 / V1.5 entry — explicitly tagged "later" by user; depends on (b)→(c) ramp triggering and a Powens/Bridge contract decision.
- A native desktop application (macOS/Windows/Linux) — the PWA covers desktop-class browsers; no separate desktop app is planned.
- An AI assistant / chatbot UI — the LLM is invisible infrastructure (categorisation), not a conversational surface.
- Tamagui Pro components — explicitly rejected during the grill; we build on Tamagui Core (MIT, free) + the in-house DS.
- Replacing the existing `hypotheses.objectif` / `horizon_years` schema — these columns are reused as-is for the compass; "rebuilding the compass schema" is excluded.
- Auto-categorisation for outflows that are clearly transfers between user-owned accounts — these are categorised by rule (account-pair match), not by LLM, to save tokens and improve accuracy.

## User Journeys

### J1 — First-run setup ("set the compass")

Alex installs the PWA and logs in via Supabase. The dashboard shows an empty state guiding him to: (1) declare his compass (target capital + horizon), (2) declare at least one intermediate milestone, (3) connect at least one account or holding (any of cash, brokerage, crypto, real-estate). Until all three are present, the dashboard's compass widget shows a "compass not yet set" state instead of a (misleading) progress number.

### J2 — Daily check ("am I on track?")

Alex opens Pekulo. The first viewport on the dashboard shows: (i) current total wealth (FX-adjusted in EUR), (ii) compass progress as percentage + curve vs. plan, (iii) the next upcoming milestone with delta. The detail screens (transactions, monthly, portfolio, real-estate) are reachable in one tap and inherit the compass framing in their header.

### J3 — Monthly closing ("did I beat my plan this month?")

End of month, Alex opens the _Mensuel_ page, reviews income vs. spending vs. saved, sees the LLM-suggested categories on imported transactions, accepts or overrides them in batch, and signs off on the month. The signed-off month becomes immutable in the monthly tracking record.

### J4 — Imported transaction → categorised ("LLM does the boring part")

Alex pastes (or imports via CSV) bank transactions. For each new uncategorised transaction, the LLM router picks an endpoint (FoundationModels / Ollama / third-party with opt-in), returns a category + confidence, and the UI shows it pre-filled but editable. Manual override always wins and is fed back as training signal for personal classification rules (V2 stretch).

### J5 — Adding a holding (existing module, extended)

Alex adds a new ETF / stock / crypto via the holdings flow. He records lots (buy date, quantity, unit price, fees). The price service resolves a quote via the 4-tier fallback. The portfolio snapshot updates and feeds the compass.

### J6 — Adding a real-estate property ("the apartment counts toward the compass")

Alex adds a property (label, type, current valuation, last-valued date), optionally a mortgage (outstanding principal, rate, monthly payment, term remaining), optionally a rental block (monthly rent, monthly charges; cash-flow auto-derived). The property's net equity contributes to total wealth and to compass progress.

### J7 — Milestone review ("are my checkpoints still realistic?")

Alex opens the milestones list, sees each milestone's status (on-track / behind / ahead) computed from the linear plan between today's wealth and the compass. He can edit, reorder, delete, or add a milestone — the dashboard re-computes immediately.

### J8 — Cross-device continuity ("the same Pekulo on iPhone and laptop")

Alex installs the PWA on his iPhone home screen and opens Pekulo on his laptop browser. Both views read the same Supabase data via the same per-user RLS policies; UI rendering goes through `packages/ui` Tamagui components on web and (V1.5+) on the React Native app, with visual parity.

### J9 — Compass evolution ("my goal moved")

Life changes; Alex updates his compass (new target capital, new horizon). The milestones recompute proportionally; the dashboard surfaces the change as an explicit "compass updated on YYYY-MM-DD" annotation rather than silently rewriting history.

## Domain Requirements

> Scope note. Pekulo matched fintech signals (_investment, transaction, wallet, crypto_) in `domain-complexity.csv`, which mandates this section. Pekulo is a tracker + planner, not a broker, payment processor, custodian, or regulated financial service. Most fintech-classic requirements (PCI DSS, KYC/AML, MiFID II investor classification) do not apply at V1 (a) personal use but become load-bearing on the (b) public ramp. This section makes the gating explicit so `aped-arch` and `aped-epics` can sequence work correctly.

### Regulatory positioning — what Pekulo is and is not

| Statement                                                                                    | Status                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pekulo holds custody of funds or crypto.                                                     | No — Pekulo is record-keeping only. All assets remain at their custodian (broker, bank, exchange, real estate).                                                                            |
| Pekulo executes transactions on regulated venues.                                            | No — no order routing, no broker integration that places orders.                                                                                                                           |
| Pekulo gives regulated investment advice (recommendation to buy/sell a specific instrument). | No — explicit non-goal. The LLM is locked to categorisation.                                                                                                                               |
| Pekulo processes payments or stores card data.                                               | No — no PCI DSS scope at any phase.                                                                                                                                                        |
| Pekulo connects to user banking via PSD2 / open banking.                                     | Not at V1 / V1.5. Powens / Bridge is a V2+ deferred decision. The moment it lands, Pekulo enters the AISP regulated perimeter (or an agent-of relationship with an AISP-licensed partner). |
| Pekulo handles personal data of EU residents.                                                | Yes — GDPR applies from the first user other than the author.                                                                                                                              |
| Pekulo tracks crypto holdings.                                                               | Yes (manual entry only at V1) — tracking-only is outside MiCA's CASP perimeter; offering exchange or custody would not be.                                                                 |

### Compliance matrix

| Regulation / framework                                                 | Geography                | Applies                                                                      | Phase trigger                                                                                           | Action required                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GDPR (EU 2016/679)                                                     | EU                       | Yes                                                                          | From first non-author user — i.e. start of (b) public ramp.                                             | Data-processing register, lawful basis (contract / consent), DPA with Supabase, data-subject rights (access, deletion, portability), breach notification within 72 h.                                                                                                  |
| CNIL guidance (France-specific GDPR enforcement)                       | FR                       | Yes                                                                          | Same as GDPR.                                                                                           | Map cookies / local-storage tracking; declare any LLM third-party processing.                                                                                                                                                                                          |
| EU AI Act (Regulation 2024/1689)                                       | EU                       | Yes — limited                                                                | When LLM is enabled by default (after the M3 80 % accuracy gate).                                       | Pekulo's LLM use (transaction categorisation) is not high-risk under Annex III. Transparency obligation: users must be told an AI system is processing their data, with opt-out for third-party API path.                                                              |
| MiCA (EU 2023/1114, crypto-asset regulation)                           | EU                       | Out of CASP scope at V1 — tracking-only, no custody, no exchange, no advice. | If V2+ adds exchange-API connectivity that allows trading, re-evaluate before shipping.                 | None for V1. Document the CASP-out positioning in the public README at (b).                                                                                                                                                                                            |
| PSD2 / DSP2 (open banking)                                             | EU                       | Not at V1 / V1.5                                                             | Triggered if bank connectivity (Powens / Bridge) lands.                                                 | At trigger time: choose between (i) becoming an AISP (licensed account-information service provider), or (ii) sub-contracting via an agent-of relationship with a licensed partner. AISP licence is a multi-month process — must be on the V2 roadmap, not a surprise. |
| PCI DSS                                                                | Global                   | No                                                                           | Never, by design — Pekulo never sees card data.                                                         | Maintain the no-card-data invariant in any future payment work (e.g. Stripe Checkout for freemium tier (c)).                                                                                                                                                           |
| KYC / AML (LCB-FT, AMF guidance)                                       | FR / EU                  | No at V1 / V1.5                                                              | Triggered if Pekulo ever holds funds, exchanges crypto, or executes orders — none of which are planned. | None unless scope changes.                                                                                                                                                                                                                                             |
| MiFID II (investor classification, suitability)                        | EU                       | No                                                                           | Triggered if Pekulo ever gives buy/sell advice — explicitly out of scope.                               | None unless scope changes.                                                                                                                                                                                                                                             |
| DORA (digital operational resilience for regulated financial entities) | EU                       | No                                                                           | Pekulo is not a regulated financial entity.                                                             | None unless (c) freemium becomes a regulated activity.                                                                                                                                                                                                                 |
| WCAG 2.2 AA (accessibility)                                            | EU (EAA from 2025-06-28) | Yes                                                                          | Mandatory for consumer-facing services in the EU from 2025-06-28.                                       | DS components (Pekulo DS on Tamagui Core) must hit WCAG 2.2 AA from V1; the DS phase is the right place to bake this in.                                                                                                                                               |

### Security architecture

| Concern                 | V1 (a) personal                                                                                                                                                                                       | V1.5 (b) public                                                                                                                   | Notes                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Authentication          | Supabase Auth (email + password). Single user.                                                                                                                                                        | Supabase Auth + email confirmation enforced; password policy 12 chars minimum; rate-limited login.                                | Optional MFA in the (b) ramp window — Supabase supports TOTP.                                                               |
| Authorisation           | Per-row RLS on every table via `auth.uid() = user_id`. Already in place; must extend to every new V1 table (`milestones`, `real_estate`, `real_estate_rental`).                                       | Same — RLS is the only authorisation surface. No service-role key on the web side.                                                | The rule is enforced architecturally: `import "server-only"` markers + no service-role key in any `NEXT_PUBLIC_*` variable. |
| Transport security      | HTTPS-only via Vercel.                                                                                                                                                                                | HSTS preload at (b).                                                                                                              | `apps/prices` exposes a Bearer-token endpoint; token rotated via env var.                                                   |
| Data at rest            | Supabase default-encrypted at rest.                                                                                                                                                                   | Audit before (b): confirm Supabase project tier provides AES-256 at rest; document the encryption boundary in `docs/security.md`. | Marked deferred in `grill-summary.md`; load-bearing at (b) ramp.                                                            |
| Secrets management      | Single root `.env` / `.env.local`, gitignored.                                                                                                                                                        | Vercel project secrets + Dokploy environment for `apps/prices`. Rotate `PRICES_SERVICE_TOKEN` at (b) ramp.                        | No secret committed to git, ever. Pre-commit hook to enforce.                                                               |
| LLM data flow           | Categorisation prompts contain transaction label + amount + (optionally) merchant; no user identifier, no account number, no compass figures. Third-party API path requires explicit per-user opt-in. | Same; opt-out remains user-controllable.                                                                                          | Apple FoundationModels and Ollama on Dokploy are in-tenant by definition.                                                   |
| Backup / recovery       | Supabase daily snapshots (default).                                                                                                                                                                   | Documented restore drill before (b).                                                                                              | Restore-from-snapshot tested once before opening signup.                                                                    |
| Logging / observability | Ad-hoc `console.error` + `print` to stderr.                                                                                                                                                           | Structured request logs (status, route, duration) without PII; basic Sentry-like error capture.                                   | Out of V1 scope; in V1.5 scope.                                                                                             |

### Audit, transparency, data-subject rights

| Concern             | V1 (a)                                                  | V1.5 (b) public                                                                                                                          | V2+                                                                                      |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Data export         | Manual SQL export sufficient.                           | In-product export of all user data as JSON (GDPR portability).                                                                           | Same.                                                                                    |
| Account deletion    | Direct Supabase delete sufficient.                      | In-product "delete my account" that cascades via existing `ON DELETE CASCADE` foreign keys + erases Supabase Auth user.                  | Same; soft-delete grace period optional.                                                 |
| LLM call audit log  | None.                                                   | Per-request log: routing decision (FoundationModels / Ollama / third-party), input length, latency, success/failure — no prompt content. | Surface a user-visible "AI activity" page.                                               |
| Schema-change audit | Single SQL file; commits in git act as the audit trail. | Same.                                                                                                                                    | If multi-user permissions ever land, switch to migration tool (Supabase CLI migrations). |
| Privacy notice      | Not required (single author user).                      | Required at (b) ramp: privacy notice, cookie banner if any third-party tracker, AI transparency notice.                                  | Same; revisit on each scope change.                                                      |

### Domain Requirements (binding)

These are the requirements `aped-arch` and `aped-epics` must satisfy or explicitly waive with a justified `[O]verride`.

- DR-1. The system shall not route, propose, or execute orders on any regulated trading venue at any phase (V1 / V1.5 / V2+).
- DR-2. The system shall not custody user funds, securities, or crypto at any phase.
- DR-3. The LLM subsystem shall not generate buy/sell recommendations for specific instruments. Its allowed task surface is limited to (i) transaction categorisation, (ii) optional batch suggestions for already-categorised transactions, and (iii) future narrowly-scoped categorisation-adjacent tasks explicitly added by an `aped-course` correction.
- DR-4. The system shall apply per-row RLS via `auth.uid() = user_id` on every persisted table that contains user data, with `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies — verified by a pre-(b) checklist before signup is opened.
- DR-5. The system shall provide a one-action data export (full JSON) and a one-action account deletion (cascading) before the (b) public ramp opens; both flows shall return within 60 seconds for Persona #1's data volume.
- DR-6. The system shall record every LLM call's routing decision, latency, and outcome (success / failure) without persisting prompt content; this log shall be retained at most 90 days.
- DR-7. The system shall require explicit per-user opt-in before any prompt is sent to a third-party LLM API, and shall surface the opt-in state in the user's settings at all times.
- DR-8. The system shall reach WCAG 2.2 AA on the dashboard, transactions, monthly, portfolio, real-estate, and settings pages before the (b) public ramp opens, validated by automated axe-core scans plus one manual screen-reader pass.
- DR-9. The system shall not introduce PSD2 / open-banking connectivity until a regulatory route (own AISP licence or agent-of relationship) is documented in an ADR and approved by the user.
- DR-10. The system shall not introduce crypto exchange or custody features (any feature that would place Pekulo inside the MiCA CASP perimeter) until an explicit `aped-course` correction promotes that scope.
- DR-11. The system shall encrypt user data at rest via the Supabase project tier's standard mechanism, and the encryption posture shall be documented in `docs/security.md` before (b).
- DR-12. The system shall surface an AI transparency notice the first time the LLM subsystem produces a user-visible suggestion, in compliance with EU AI Act transparency obligations; the notice shall be re-shown on opt-out → opt-in transitions.

## Functional Requirements

### Group A — Compass & Milestones (V1 core differentiator)

- FR-1: User can declare a compass composed of a target capital amount in EUR and a target horizon year between the current year + 1 and the current year + 60.
- FR-2: User can edit the compass at any time, with the prior compass values archived in an audit trail viewable from the settings page.
- FR-3: User can add up to 20 milestones per compass, each defined by a target capital amount and a target year strictly before the compass horizon.
- FR-4: User can reorder, edit, and delete milestones, with the milestone list re-sorted automatically by target year ascending.
- FR-5: System can compute compass progress as the ratio of current total wealth to compass target capital, expressed as a percentage with one decimal.
- FR-6: System can compute per-milestone status as one of {ahead, on-track, behind} based on a linear plan between today's wealth and the compass target.
- FR-7: User can view a compass-progress curve on the dashboard plotting projected vs. actual wealth from the compass start date to today.
- FR-8: System can flag the compass setup as incomplete when no milestone exists, displaying a setup CTA instead of a progress percentage.

### Group B — Accounts (existing module, extended)

- FR-9: User can create an account with a label, account type drawn from the set {livret, pea, cto, av, autre}, base currency, and an optional cash balance.
- FR-10: User can edit and delete an account, with deletion blocked when at least one holding or transaction still references it.
- FR-11: User can record a manual cash-balance change on an account at a given date.
- FR-12: System can list all accounts owned by the authenticated user and only those, enforced by per-row RLS.

### Group C — Holdings & Portfolio (existing module, extended for crypto)

- FR-13: User can create a holding with a ticker, holding kind drawn from the set {etf, action, crypto, autre}, currency, and parent account.
- FR-14: User can record buy and sell lots on a holding, each lot capturing date, quantity, unit price, and fees.
- FR-15: System can derive holding quantity and weighted average cost from its lots, falling back to the holding's manual entry when zero lots are recorded.
- FR-16: System can resolve a price quote for a holding via the four-tier provider chain {prices-service, yahoo-finance2, boursorama, twelve-data}, returning the winning provider name in the response.
- FR-17: System can cache resolved price quotes in memory for 60 seconds keyed by ticker, kind, and currency.
- FR-18: System can produce an FX-adjusted portfolio snapshot in EUR, falling back to a 1:1 rate when no rate is available for a non-EUR currency.
- FR-19: User can view per-holding unrealised gain/loss in both holding currency and EUR.
- FR-20: User can mark a holding as closed, hiding it from the active portfolio while preserving its lots for historical computation.

### Group D — Real-estate (new module)

- FR-21: User can create a real-estate property with a label, property type drawn from the set {residence-principale, locatif, autre}, current valuation in EUR, and last-valued date.
- FR-22: User can attach a single mortgage to a property capturing outstanding principal, annual rate, monthly payment, term in months remaining, and start date.
- FR-23: User can attach a single rental block to a property capturing monthly rent, monthly charges, and a flag for furnished vs. unfurnished.
- FR-24: System can derive monthly rental cash-flow as monthly rent minus monthly charges minus monthly mortgage payment.
- FR-25: System can derive net property equity as current valuation minus outstanding mortgage principal.
- FR-26: System can include net property equity in total wealth and compass progress computations.
- FR-27: User can update a property valuation manually with a new amount and a new last-valued date, preserving the prior valuation in an audit trail.

### Group E — Transactions & LLM categorisation

- FR-28: User can record a transaction with a date, amount, transaction type drawn from the set {inflow, outflow}, category, parent account, and free-form label.
- FR-29: User can import transactions in bulk by pasting a CSV with columns {date, amount, label, account-label}, with rows previewed before persistence.
- FR-30: System can classify a transaction between two user-owned accounts as a transfer by rule, bypassing LLM categorisation.
- FR-31: System can route a non-transfer transaction's categorisation request to an LLM endpoint chosen by the routing policy {Apple FoundationModels if iOS-capable, Ollama on Dokploy VPS otherwise, third-party API only when user opt-in is true and routing policy selects it}.
- FR-32: System can return an LLM-suggested category plus a confidence score in the range [0, 1] for each non-transfer transaction.
- FR-33: User can accept or override the suggested category before persistence, with the override persisted as the final category.
- FR-34: User can opt in or out of the third-party LLM API path from the settings page, with the opt-in defaulting to false.
- FR-35: System can record per-LLM-call routing decision, latency, and outcome without persisting prompt content.
- FR-36: User can view the LLM activity log for the last 90 days from the settings page.

### Group F — Monthly tracking (existing module)

- FR-37: User can record monthly aggregates {income, spending, transfers, net change} for a given month and year.
- FR-38: System can derive monthly aggregates from categorised transactions for that month, presented as a default the user can override before sign-off.
- FR-39: User can sign off on a month, freezing its aggregates against further automatic recomputation.
- FR-40: User can re-open a signed-off month with an explicit confirmation step, unfreezing it for editing.

### Group G — Dashboard & KPIs

- FR-41: User can view a dashboard whose first viewport contains, in order, total wealth in EUR, compass progress percentage, and the next upcoming milestone with delta.
- FR-42: User can navigate from the dashboard to each detail page {transactions, monthly, portefeuille, real-estate, parametres} in one tap.
- FR-43: System can compute total wealth as the sum of {cash balances, FX-adjusted holding market values, net real-estate equity}.
- FR-44: System can refresh the dashboard data after any mutation that affects wealth via the cache invalidation tag registry.

### Group H — Auth, settings, account lifecycle

- FR-45: User can sign up with an email address and a password of 12 characters minimum.
- FR-46: User can log in with email and password, with the session persisted via Supabase cookie-based SSR auth.
- FR-47: User can log out from any page via the user menu, invalidating the session immediately.
- FR-48: User can request a password reset via an email link.
- FR-49: User can export all of their data as a single JSON file from the settings page.
- FR-50: User can delete their account from the settings page, cascading deletion across every user-scoped table within 60 seconds.
- FR-51: User can switch the UI theme between {dark, light, system} from the settings page, with the choice persisted across sessions and devices.
- FR-52: User can switch the UI language between {french, english} from the settings page, with the choice persisted.

### Group I — PWA, mobile, design system

- FR-53: User can install the web application as a PWA on iOS and Android home screens via the platform's install affordance.
- FR-54: User can open read-only views {dashboard, portefeuille, real-estate} when offline, served from the last cached snapshot.
- FR-55: System can render every user-facing page through components imported from `packages/ui` from V1.5 onward, with no app-local Tailwind class divergence.
- FR-56: System can render visually equivalent components on the web PWA and the React Native application from V1.5 onward, validated by per-component visual snapshots.

### Group J — Hypotheses & projections (existing module)

- FR-57: User can record a hypothesis bundling target capital, horizon, monthly contribution, and assumed annual rate of return.
- FR-58: System can project future wealth from current wealth + monthly contribution + assumed rate, presented as a curve on the dashboard.
- FR-59: User can compare the projected curve to the compass-required curve, with the gap surfaced in EUR per month.

## Non-Functional Requirements

### Performance

- NFR-1: The system shall return a compass-progress computation for the dashboard route within 300 ms at p95 under Persona #1's data volume (at most 200 transactions/month, at most 30 holdings, at most 5 properties).
- NFR-2: The system shall return a price quote within 1.5 s at p95 for cache hits and within 4 s at p95 for cold lookups via the four-tier provider chain.
- NFR-3: The system shall reach a Lighthouse Performance score of at least 90 % on `/dashboard` under simulated mid-tier mobile + 4G conditions before V1 is declared in production.
- NFR-4: The system shall achieve a time-to-first-meaningful-paint under 2.5 s on `/dashboard` on a mid-range Android device on 4G, measured via Lighthouse.
- NFR-5: The system shall return a transaction categorisation suggestion within 600 ms at p95 when routed to Apple FoundationModels, within 1.5 s at p95 when routed to Ollama, and within 3 s at p95 when routed to the third-party API.
- NFR-6: The system shall complete the data export of FR49 within 60 s for Persona #1's data volume.
- NFR-7: The system shall complete the account deletion of FR50 within 60 s for Persona #1's data volume.

### Security

- NFR-8: The system shall enforce per-row RLS via `auth.uid() = user_id` policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on 100 % of tables containing user data, verified by a pre-(b) automated check that fails the build on any unprotected table.
- NFR-9: The system shall reject any request lacking a valid Supabase session cookie on every authenticated route, returning a 401 within 100 ms.
- NFR-10: The system shall transmit 100 % of browser ↔ server requests over TLS 1.2 or higher, with HSTS preload enabled before the (b) public ramp.
- NFR-11: The system shall require a password of at least 12 characters at signup and rate-limit failed login attempts to 10 per IP per hour.
- NFR-12: The system shall include 0 user identifiers, 0 account numbers, and 0 compass amounts in any LLM prompt; the prompt shall contain at most {transaction label, amount, currency, occurred-on date, optional merchant} and shall not exceed 2 kb in size.
- NFR-13: The system shall send 0 prompts to a third-party LLM API without prior explicit user opt-in, with the opt-in state stored under the user's row and surfaced in the settings page 100 % of the time.
- NFR-14: The system shall encrypt 100 % of user data at rest via the Supabase project tier's default mechanism, documented in `docs/security.md` before opening signup.

### Scalability

- NFR-15: The system shall support up to 100 concurrent users on `apps/web` without compass-progress p95 latency exceeding 500 ms during the (b) public ramp.
- NFR-16: The system shall support a single-user data volume of up to 50 000 transactions, 500 holdings, and 50 properties without compass-progress p95 latency exceeding 800 ms.
- NFR-17: The `apps/prices` service shall sustain 30 requests per second without 5xx errors, scaled vertically on the Dokploy VPS.

### Reliability

- NFR-18: The system shall fall back to the next available provider within 500 ms when any single price provider in the four-tier chain fails, returning a quote from the next available provider; only when all four fail shall the orchestrator throw a `PriceError`.
- NFR-19: The system shall fall back to a 1:1 FX rate within 50 ms when no rate is available, with the fallback recorded in the snapshot for transparency.
- NFR-20: The system shall return read-only views of cached data for at most 60 minutes when the Supabase backend is unreachable, served from the last cached snapshot.
- NFR-21: The system shall perform at least 1 successful restore-from-snapshot drill within 30 days before opening the (b) public ramp, with the result documented in `docs/security.md`.

### Accessibility

- NFR-22: The system shall meet WCAG 2.2 AA on 100 % of pages in {dashboard, transactions, monthly, portefeuille, real-estate, parametres, auth} before the (b) public ramp opens, validated by automated axe-core scans plus 1 manual screen-reader pass.
- NFR-23: The system shall maintain a contrast ratio of at least 4.5:1 for 100 % of body text and at least 3:1 for 100 % of large text in both dark and light themes.
- NFR-24: The system shall expose 100 % of interactive elements to keyboard navigation in a logical tab order, with a visible focus indicator at all times.

### Observability

- NFR-25: The system shall record per-request structured logs (route, status, duration in ms, user-id-hash) starting at the (b) public ramp, retained for at most 90 days, containing no PII other than the hashed user id.
- NFR-26: The system shall record per-LLM-call entries (routing target, latency, outcome) without prompt content, retained for at most 90 days.
- NFR-27: The system shall capture 100 % of unhandled errors with stack traces in a Sentry-equivalent destination starting at the (b) public ramp, with PII scrubbing enabled.

### Integration

- NFR-28: The system shall conform to the Supabase JS SDK v2 contract for auth and Postgres access, opening 0 requests directly to the database from the web tier within any 24-hour window.
- NFR-29: The system shall accept Bearer-token authorisation for `apps/prices`, rejecting any request lacking the configured token with a 401 response within 100 ms.
- NFR-30: The system shall produce a JSON export under FR-49 conforming to a published schema versioned in `docs/exports/schema-v1.json`, with a top-level `schema_version` field and a payload size of at most 100 mb per user.
