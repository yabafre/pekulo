# Web-first Stripe billing and Epic 15 mobile IAP via RevenueCat over a unified multi-grant entitlement model

**Date:** 2026-11-27
**Status:** accepted
**Decided by:** Alex (Council C4 — Winston, Raj, Nina, Maya, 4–0 unanimous)
**Relates:** ADR-0008 (server-as-authority), ADR-0013 (Prisma + RLS), ADR-0015 (Bridge AISP variable costs), ADR-0016 (private advisory excluded from paid product), ADR-0022 (durable Postgres webhook inbox)

## Context

Pekulo currently has zero monetization code (`apps/mobile/.app-review-readiness.json` marks IAP as `n/a`). The go-to-market plan (`docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`) targets 50 paying web clients by January 31, 2027 via a **Founder offer (€49/year, 100 spots, rate guaranteed while active — no lifetime offer due to recurring Bridge fees)**, transitioning to **€69/year or €7.99/month** for the Plus tier (Bridge bank sync, unlimited milestones, real estate, monthly digest/sign-off) above a Free tier (1 cap, 2 milestones, manual entry + CSV). Mobile store launches are frozen until after the first 50 web clients (Epic 15), but once Stripe billing goes live on web, publishing the Expo mobile app encounters Apple Guideline 3.1.1 / 3.1.3 and Google Play Payments Policy, alongside French B2C legal requirements (Loi n° 2022-1158 3-click online cancellation, 14-day withdrawal waiver, Code de commerce Art. L.123-22 10-year invoice retention, and AMF/MiFID II DR-3 boundaries).

## Decision

Adopt **Option A\*** — **Web-first Stripe Checkout + Billing Portal in Epic 14, followed by native iOS/Android IAP via RevenueCat in Epic 15**, unified behind a server-authoritative, multi-grant `subscription_grants` table in `apps/api`:

1. **Unified multi-grant entitlement model (`apps/api`, Epic 14):**
   - Persist entitlements in a Postgres `subscription_grants` table keyed per `(provider, external_subscription_id)` (where `provider ∈ {'stripe', 'apple', 'google', 'manual'}`, carrying `user_id`, `plan`, `status`, `is_founder`, `current_period_end`, `grace_until`, `provider_event_at`) — **never** a single mutable `UNIQUE(user_id)` row, preventing out-of-order cross-provider webhooks from clobbering an active subscription.
   - Derive effective entitlement (`hasPlus = EXISTS active | grace grant`) server-side inside `apps/api` (under 2 ms, zero runtime calls to Stripe or RevenueCat). Clients never dictate entitlements.
   - **Founder 100-spot cap & 3DS grace window:** Enforce the 100-spot cap via a short-TTL reservation table protected by `pg_advisory_xact_lock` (closing concurrent checkout races and 30-minute abandoned-session leaks). Grant a **7–14 day `past_due` grace window** during Stripe Smart Retries so EU PSD2/3DS renewal friction never strips a Founder's grandfathered €49/year rate prematurely.
2. **Web billing & French legal compliance (Epic 14, stories `14-3` / `14-4` / `14-5`):**
   - Use **Stripe Checkout** (PCI SAQ A, zero card data touched by Pekulo) + **Stripe Billing Portal**, plus a **dedicated ≤ 3-click cancellation flow** directly in Settings (`"Résilier mon abonnement"`) calling the Stripe API with immediate email confirmation to guarantee strict compliance with Loi n° 2022-1158 / Décret 2023-417.
   - Record explicit user consent + waiver of the 14-day digital withdrawal right prior to immediate Plus activation (Code de la consommation Art. L.221-28), and publish statutory _médiateur de la consommation_ and CGV disclosures.
   - Ingest Stripe webhooks through the durable Postgres `webhook_inbox` defined in **ADR-0022** with signature + timestamp verification and monotonic `provider_event_at` / event-ID idempotency.
   - **Downgrade safety:** When a user downgrades to Free, **pause** automated Bridge cron/webhook sync (`bank-aggregator.service.ts`) so Pekulo stops incurring variable Bridge/Brandfetch/LLM costs without revoking the user's bank consent; enforce Free caps (milestones/real-estate) **only on creation**, keeping existing user data readable, editable, and exportable.
   - **GDPR erasure (FR-50 / NFR-7) & statutory invoicing:** Cancel any active Stripe subscription in **Step 1** of `settings.service.ts#deleteAccount` (before deleting local rows, bounded inside `settings.deletion-budget.test.ts`'s 60 s ceiling). Local `subscription_grants` rows cascade-delete with `auth.users` (satisfying `rls-migration-audit`), while 10-year French accounting invoices remain archived in Stripe under GDPR Art. 6(1)(c) / Code de commerce Art. L.123-22.
   - **AMF hard boundary (ADR-0016 §2):** The private internal AI advisory surface (Epic 12) MUST remain strictly excluded from all paid tiers, pricing pages, and marketing claims.
3. **Mobile store posture (Epic 14 interim → Epic 15 IAP via RevenueCat):**
   - During Epic 14 (pre-store / TestFlight / internal preview), keep `apps/mobile` strictly free of pricing copy, paywall prompts, or external checkout links (Apple 3.1.3(b) compliance).
   - In **Epic 15**, integrate **RevenueCat for Apple/Google IAP only** — **Web Stripe traffic bypasses RevenueCat completely** so web revenue never counts against RevenueCat's Monthly Tracked Revenue (MTR) meter (keeping RevenueCat on its €0 free tier up to ~$2,500/mo mobile-only MTR, ~435 mobile annual subscribers).
   - Enroll in the **Apple App Store Small Business Program (15 %)** and Google Play's **15 % subscription tier** before release. Block mobile IAP purchase flows whenever `apps/api` reports an active Stripe grant (preventing accidental double-billing), update Apple Privacy Manifests (`NSPrivacyCollectedDataTypePurchaseHistory`, preserving `NSPrivacyTracking: false`), Google Data Safety, GDPR Art. 28 DPAs, and display Apple Guideline 5.1.1(v) store-cancellation instructions during in-app account deletion.

## Why

- Satisfies **PRD B3** (€0/month fixed billing infra on Stripe + €0 RevenueCat free tier for mobile-only MTR), **NFR-1** (< 2 ms local entitlement checks), **NFR-7 / FR-50** (fail-closed Stripe cancellation inside the 60 s erasure budget), **DR-1..DR-3 / ADR-0016** (zero regulated advice monetized), and French B2C statutory law.
- Decouples `apps/api` entitlements from both Stripe and RevenueCat via `subscription_grants`, eliminating vendor lock-in while avoiding solo-founder maintenance of raw StoreKit 2 + Play Billing v7 + Apple Server Notifications v2 + Google RTDN.

## Considered options

- **Option B — Web-only Stripe + permanent "Reader / Companion App" on iOS/Android (no IAP ever):** Unanimously rejected (4–0) — Apple Guideline 3.1.3(a) Reader applies to digital media (books/audio/video), not interactive personal-finance SaaS; relying on 3.1.3(b) with locked paywalled features and mobile signup invites unpredictable App Review rejections on every release while forfeiting incremental App Store subscribers (~75 % net margin after 15 % store cut + Bridge).
- **Option C — Web Stripe + EU DMA External Purchase Link (Apple EEA) & Google EEA Alternative Billing:** Unanimously rejected (4–0) — under Apple/Google 2026 EEA terms (10 % store service/link-out fee + ~2–4.6 % Stripe fee = ~12–15 % total), unit economics save €0–€65/mo at 500 mobile subs while imposing mandatory per-transaction Apple/Google reporting APIs, EU OSS VAT compliance across 27 states, non-EEA geofencing breakage (CH/UK), scare-sheet conversion drops (15–30 %), and continuous regulatory churn.

## Consequences

- `subscription_grants` and `founder_reservations` require RLS DDL + `ON DELETE CASCADE` (audited by `rls-migration-audit`), `ID_PREFIXES` registration, and `EXPORT_NODES` / `DELETION_NODES` inclusion.
- Adding Stripe (Epic 14) and US-based RevenueCat (Epic 15) requires updating the public sub-processor list, GDPR Art. 28 DPAs, privacy policy, Apple Privacy Manifest, Google Data Safety, and EU DSA trader status verification (Google Play hard deadline `2027-02-01`).
- Mobile `apps/mobile/docs/REVIEW-NOTES.md` and `.app-review-readiness.json` (`iap_reachable_by_reviewer`) must be updated in Epic 15 before store submission.

## Pivot conditions

- **Bridge unit-cost shock:** If Bridge production pricing exceeds ~€2.50/user/month and compresses net contribution below 50 % after the 15 % store cut, apply a mobile IAP price uplift or pivot mobile to an un-paywalled companion app strictly under 3.1.3(b)/(f).
- **RevenueCat pricing or privacy drift:** If RevenueCat alters its free MTR threshold materially or injects tracking incompatible with `NSPrivacyTracking: false`, swap RevenueCat in Epic 15 for direct StoreKit 2 + Google Play Developer API server webhooks feeding the exact same `subscription_grants` table (zero Epic 14 rework).
- **Advisory monetization attempt:** Any request to bundle Epic 12 advisory into Plus triggers an immediate **HALT** and MiFID II / CIF legal review per ADR-0016.

## References

- `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`
- `docs/triage-decision.md` (Lot B B3; Lot C C1)
- `docs/architecture.md` § Phase 2b — Council Dispatch C4
