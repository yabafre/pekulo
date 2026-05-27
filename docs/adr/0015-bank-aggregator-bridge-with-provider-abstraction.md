# Bank-account connectivity — Bridge as AISP agent-of, with provider abstraction

**Date:** 2026-05-25
**Status:** accepted
**Decided by:** Alex (with Fred clarification on persona stack: TR = broker only ; SG + Revolut = daily transactions)
**Resolves:** DR-9 (PSD2 / open-banking connectivity regulatory route requirement)
**Amends:** PRD V1 scope (was "Out of Scope V1 / V1.5" line 101 ; was Vision Phase 3 V2+ line 86)

## Context

The original PRD placed bank-account connectivity in Vision Phase 3 (V2+) with DR-9 requiring an ADR documenting the regulatory route before any introduction. After a focused research pass (Powens vs Bridge vs GoCardless vs Salt Edge vs Tink) and Fred's clarification of the Persona #1 stack — Trade Republic = broker / PEA / CTO only, Société Générale + Revolut = daily transactions — the cost / benefit shifted decisively:

- Bridge offers a self-serve developer sandbox (Powens does not).
- Bridge for Startups documents early-stage commercial terms compatible with a 10-user V1.
- Bridge is itself an AISP + PISP approved by ACPR ; consuming its API is exactly the agent-of relationship the PSD2 framework allows.
- Bridge covers SG and Revolut with first-class connectors (99 % of French major banks ; among the 24 aggregators integrating Revolut).
- Promoting bank connectivity to V1 closes the credibility gap on the compass promise ("set a cap, everything aligns") when daily bank flow was previously missing from the auto-ingestion path.

## Decision

1. **Provider** — Bridge (`bridgeapi.io`) for bank-account connectivity at V1. AISP + PISP ACPR-approved (BPCE-owned since 2022).
2. **Regulatory route** — agent-of relationship with Bridge. Pekulo does NOT seek its own AISP licence. The B2B contract with Bridge must explicitly document the tied-agent / business-customer relationship that resolves DR-9.
3. **Provider abstraction** — domain layer exposes a `BankProvider` interface in `apps/api/src/modules/bank-aggregator/bank-provider.ts` with `BridgeProvider` as the V1 implementation. Iso-pattern with the price provider chain in `apps/api/src/modules/holdings/services/{yahoo,boursorama,twelve-data,frankfurter}-client.ts`. Future Powens or other migration writes a sibling implementation without touching the domain.
4. **Sources outside Bridge** — Trade Republic and any unsupported source keep using story 5-2 CSV import (manual ingestion path). Epic 3 manual holdings continues to cover PEA / CTO positions.
5. **Token storage** — Bridge OAuth tokens encrypted at rest in Supabase via `pgcrypto` column-level encryption ; never logged ; never returned by oRPC handlers (DTO mapping strips the secret columns).
   - **Amendment (2026-05-27, story 5-6):** the literal storage mechanism switches from `pgcrypto` column-level encryption to **Supabase Vault** (`supabase_vault` extension). `bank_connections` carries `access_token_secret_id uuid REFERENCES vault.secrets(id) ON DELETE SET NULL` + `refresh_token_secret_id uuid REFERENCES vault.secrets(id) ON DELETE SET NULL` instead of `*_cipher bytea` columns. Vault handles libsodium encryption + master key derivation upstream — Pekulo never holds the master key, never rotates it manually, never embeds crypto code in the repository layer. The invariants from §5 remain unchanged: tokens encrypted at rest, never logged, never returned by oRPC handlers, DTO stripping enforced via type-level guard + sentinel test. See `docs/stories/5-6-bridge-connector.md` for the full implementation surface.
6. **SCA refresh** — Bridge SCA expires every 90 days per PSD2. The settings / connections page surfaces a "reconnect" CTA when an item's status returns `SCA_REQUIRED`. No silent failure ; no auto-retry on expired SCA.

## Why Bridge over Powens

- Bridge offers a self-serve sandbox ; Powens forces commercial onboarding. Friction for a personal-use / 10-user V1 is decisive.
- Bridge's transaction categorisation algorithm (inherited from 10+ years of Bankin' consumer use) is best-in-class for French banks ; aligns with Epic 6 LLM categorisation budget by lowering ambiguous-case volume.
- Bridge for Startups documents commercial terms compatible with early-stage volume.
- Powens is parked for V2 / public ramp, when its Wealth product becomes valuable for the Finary-scope vision (PEA / AV / crypto / immo aggregation) and the P&L absorbs the setup fee (1–5 k€).
- TR weakness on Bridge (SCA daily, comptes courants non récupérés, PEA mal synchronisés) is irrelevant in this stack — TR is not a daily account ; TR transactions enter via CSV (story 5-2) and TR holdings via Epic 3 manual.

## Why agent-of rather than own AISP

- Own AISP licence = 6–12 months ACPR process + 50–150 k€ capital / governance / audit / RegTech investment. Out of scope for V1 personal use by orders of magnitude.
- Bridge IS an ACPR-approved AISP. Pekulo consuming Bridge's API to read user bank data is exactly the agent-of relationship the PSD2 framework allows.
- Pre-existing precedent: every French fintech consuming Bridge (Lydia, Qonto, Pennylane, Spendesk, BPCE-affiliated stack) operates under this same model.

## Considered options

- **(A) Defer to V2+** — original PRD position. Rejected after user-driven scope re-evaluation: Persona #1 uses SG + Revolut as daily accounts. Manual recording (5-1) + CSV import (5-2) covers the mechanics but degrades the "tout s'aligne" compass promise when daily bank flow is missing from the auto path.
- **(B) Powens at V1** — rejected: commercial onboarding friction inadequate for 10-user V1 ; contract 12–24 months ; setup fee 1–5 k€ ; module Wealth value not yet load-bearing.
- **(C) Own AISP licence** — rejected: 6–12 month / 50–150 k€ scale is incompatible with V1 personal-use ramp ; the regulatory entry cost is itself a V2+ business decision.
- **(D) GoCardless Bank Account Data (ex-Nordigen)** — rejected: closed new signups since July 2025.
- **(E) Salt Edge / Tink** — rejected: weaker French coverage (Salt Edge) or enterprise-only commercials (Tink) for 10-user V1.

## Consequences

- **PRD amendments** — Out of Scope line 101 transformed into a "promoted to V1" audit note ; Vision Phase 3 bank-connectivity line 86 narrowed to wallet / exchange connectivity only ; MVP Phase 1 gains item 9 about bank-account connectivity ; new FRs in Group E (FR-60 to FR-63) ; new NFRs (NFR-31 token storage, NFR-32 SCA refresh, NFR-33 webhook signature) ; DR-9 resolved by reference to this ADR ; Compliance matrix PSD2 row and Regulatory positioning row updated to reflect V1 agent-of route ; Security architecture gains a Bank credentials row ; User Journey J10 added ("Connect a bank — Bridge takes over").
- **Epic 5 grows** — two new stories (5-6 bridge-connector domain + Prisma `BankConnection` + Bridge provider client + cron refresh + webhook receiver ; 5-7 bridge-ui Connect widget redirect + settings connections page + SCA-expired badge). Epic 5 goes from 5 to 7 stories — within the ≤8 stories soft limit.
- **Architecture** — new domain folder `apps/api/src/modules/bank-aggregator/` ; new contract `bankAggregatorContract` mounted at `/rpc/v1/bankaggregator` (no separator per the 12-module convention) ; new Prisma model `BankConnection` with encrypted token columns. Phase 2 references this ADR ; Phase 4 Directory Tree and FR → File Mapping extended with FR-60 to FR-63 rows.
- **Security posture** — Pekulo now stores Bridge OAuth tokens. Pre-(b) audit must verify `pgcrypto` is enabled on the relevant columns. NFR-12 (zero PII to LLM) remains unaffected: bank transactions enter Pekulo via Bridge and then traverse the same categorisation flow as manual / CSV transactions ; the LLM prompt builder strips identifiers identically.
- **Regulatory posture (DR-9)** — resolved via this ADR + the agent-of relationship with Bridge. The B2B contract negotiation (in the validation debt) must include the tied-agent clause explicitly. Bridge legal sign-off is gating production traffic, not sandbox / dev work.
- **Contract dependency** — V1 production ship now depends on the Bridge production contract being signed. Sandbox is enough to develop both stories ; production traffic requires the production contract. Validation debt: open the Bridge dev account immediately and contact sales early to surface any volume-floor or vertical-restriction objections before integration is too far along.

## Validation debt

- Open Bridge dev account and confirm SG + Revolut connectors return `/transactions` correctly for the persona stack ; cover Revolut vaults / pockets edge cases (Revolut is a reputed edge case across aggregators).
- Contact Bridge sales mentioning "small volume, V1 personal use, validation product" ; surface any monthly minimum that would make 10-user V1 non-viable before integration starts.
- Confirm the B2B contract includes the tied-agent / agent-of clause required by DR-9.
- Decide on webhook receiver host (probably `apps/api` since it owns the Prisma surface ; Bridge needs a public URL — Vercel preview deployments may not be stable enough, evaluate ngrok / cloudflared tunnel for dev or a dedicated Dokploy route for staging).
- Stress-test SCA expiry UX: when an item returns `SCA_REQUIRED`, surface the reconnect CTA without breaking the dashboard render path ; do not block the compass progress query on bank refresh.

## Pivot conditions

- **Bridge sales refuses to sign** on volume floor incompatible with 10-user V1 → fall back to Powens evaluation with a hard look at the 1–5 k€ setup fee budget ; if neither works, revert promotion (re-add to Out of Scope, ship V1 with manual + CSV only).
- **Bridge production rejects Pekulo's use case** → DEFER bank connectivity to V1.5 (Growth phase) ; re-add to Out of Scope at V1.
- **ACPR or Bridge legal raises an objection to the agent-of route** → escalate to legal review before any production traffic ; do not ship production without a documented regulatory clearance.

## References

- ADR-0009 (Elysia + oRPC) — defines the module / contract pattern reused by the new `bank-aggregator` module.
- ADR-0012 + ADR-0013 (Prisma + RLS defense in depth) — defines the per-row RLS + explicit `where: { userId }` pattern that `BankConnection` rows must follow.
- ADR-0014 (Prisma migrations) — defines the migration toolchain that introduces the `BankConnection` table.
- `.aped/.out-of-scope/bank-aggregator-resolved-2026-05-25.md` — historical record of the Powens-first → Bridge pivot research.
- `docs/state-corrections.yaml` — entry on 2026-05-25 promoting bank connectivity to V1.
