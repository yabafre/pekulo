# Real-euros Fisher projection engine with 3 deterministic scenarios in shared @pekulo/finance package

**Date:** 2026-11-27
**Status:** accepted
**Decided by:** Alex (Council C6 — Winston, Raj, Nina, Maya, 4–0 unanimous)
**Relates:** ADR-0011 (`@pekulo/*` workspace layout), FR-57 / FR-58 / FR-59 (hypotheses & projections), NFR-1 (< 300 ms p95), NFR-15 (100 concurrent users), DR-1..DR-3 (AMF / MiFID II neutral tool posture)

## Context

`apps/api/src/common/derive/projection-curve.ts` currently computes a single nominal compounding curve (`FV(m) = P·(1+i)^m + C·((1+i)^m − 1)/i`, `i = annualRate / 12`), rejecting any `annualRate < 0` across `projection-curve.ts:44`, `hypothesis-gap.ts:87`, and `packages/validators/src/hypothesis/hypothesis.schemas.ts:9,105`. For Pekulo's core French FIRE ICP over 20–30 year horizons, ignoring 2 % inflation and fee drag overstates terminal purchasing power by 45–100 %, undermining product credibility ahead of Epic 14 pre-sales and the unauthenticated public calculator (story `14-7`). Meanwhile, the 2026-11-26 spike measured 10,000-path Monte Carlo simulation at 70–95 ms of synchronous Bun event-loop CPU per call.

## Decision

Adopt **Option A\*** — **exact Fisher real-rate deflation, net-of-fees rate, effective monthly compounding, and a deterministic 3-scenario spread extracted into a zero-dependency shared workspace package (`@pekulo/finance`)**:

1. **Shared pure workspace package (`@pekulo/finance`):**
   - Extract `projection-curve.ts`, `hypothesis-gap.ts`, and `compass-curve.ts` out of `apps/api/src/common/derive/` into a zero-dependency pure TypeScript workspace package `@pekulo/finance` (returning plain typed results/error codes rather than API-coupled `HypothesisError` subclasses).
   - Consumed identically by `apps/api` (authoritative logged-in dashboard & hypothesis endpoints), `apps/web` (running the unauthenticated public calculator in story `14-7` **100 % client-side** at €0 API CPU and zero PII collection), and `apps/mobile` — guaranteeing exact numeric parity across every surface.
2. **Exact mathematical specification (binding invariants):**
   - **Inputs & safe backward-compatible defaults** (additive columns on `hypotheses` / optional contract fields so existing rows and mobile clients never break):
     - `annualRate`: user-assumed gross nominal annual return (default user hypothesis)
     - `annualFeeDrag`: user-configurable annual fee drag (default `0`, range `[0, 0.10]`)
     - `inflationRate`: user-configurable annual inflation rate (default `0.02`, range `[0, 0.15]`)
     - `scenarioSpread`: symmetric deterministic band spread (default `0.02` / ±200 bps, range `[0, 0.10]`)
     - `displayMode`: `'real' | 'nominal'` (default `'real'` — constant today's euros)
   - **Net & Fisher real annual rate:**
     - `r_net = annualRate - annualFeeDrag`
     - `r_real = (1 + r_net) / (1 + inflationRate) - 1`
     - Three scenarios computed deterministically around `r_net`: **pessimistic** (`r_net - scenarioSpread`), **realistic** (`r_net`), **optimistic** (`r_net + scenarioSpread`), each deflated through the same Fisher formula (supporting negative real rates cleanly — widen rate validation bounds from `[0, 1]` to `(-0.5, 1.0]`, strictly `> -1` so `1 + i > 0`).
   - **Effective monthly compounding & numerical stability:**
     - Use exact effective monthly rate `i_m = (1 + r)^(1 / 12) - 1` (eliminating ~3.2 % 30-year drift vs naive `r / 12` under annual Fisher deflation).
     - Compute `(factor - 1)` via `Math.expm1(m * Math.log1p(i_m))` with a linear fallback `P + C * m` whenever `Math.abs(i_m) < 1e-12` (preventing IEEE-754 catastrophic cancellation when `r_net ≈ inflationRate`).
   - **`real ↔ nominal` exact parity & contribution indexation:**
     - Model monthly contributions as constant in today's purchasing power (inflation-indexed in nominal terms, explicitly disclosed in the UI explainer), guaranteeing the exact test invariant `FV_real(k) === FV_nom(k) / (1 + inflationRate)^k` for every year `k`.
     - Compute `reachesCap` and `gapEurPerMonth` (`hypothesis-gap.ts`) in **real euros** against `objectif` (which represents today's purchasing power; in `'nominal'` display mode either keep the verdict anchored in real euros or inflate the displayed reference target by `(1 + inflationRate)^horizonYears`), so toggling `real ↔ nominal` never falsely flips `reachesCap` via money illusion.
   - **Negative net wealth (`P < 0`) band-inversion guard:**
     - Underwater real-estate debt does not compound at investment return rates. When `currentWealthEur < 0`, compound only `Math.max(0, currentWealthEur)` + monthly contributions and add the negative starting offset uncompounded (`debtOffset = Math.min(0, currentWealthEur)`), guaranteeing monotonic bands (`pessimistic[k] <= realistic[k] <= optimistic[k]`) with zero mid-horizon ribbon crossing.
3. **Transparency & AMF / DGCCRF compliance (DR-1..DR-3):**
   - Return full resolved metadata on the projection DTO (`displayMode`, `inflationRate`, `annualFeeDrag`, `scenarioSpread`, resolved annual nominal & real rates per scenario), mirroring NFR-19's FX transparency discipline.
   - Every projection surface (dashboard, mobile, public calculator `14-7`) must pair outputs with a clear non-advice disclaimer ("user-defined hypotheses — not investment advice, no guaranteed return, excludes taxes and market volatility") and a "Comment c'est calculé" breakdown. Default rates must never be tied to specific instruments or framed as expected market returns.

## Why

- Executes 3 scenarios × 50 years in **< 0.05 ms** (`O(horizonYears)`), preserving **NFR-1** (< 300 ms p95), **NFR-15** (100 concurrent users), and **PRD B3** (€0 extra compute, completely immune to viral launch traffic on the public calculator `14-7`).
- Gives French FIRE investors honest purchasing-power trajectories and downside visibility while remaining 100 % reproducible, explainable ("why did my verdict change?"), and squarely inside the AMF/MiFID II neutral calculation-tool safe harbor (DR-3).
- Reserves probabilistic Monte Carlo / decumulation modeling as a clean future V2 Pro differentiator.

## Considered options

- **Option B — Server-side Monte Carlo (10,000 log-normal paths in Bun):** Unanimously rejected (4–0) — measured at 70–95 ms of synchronous single-threaded JS CPU per call, meaning 12–15 concurrent public calculator hits/sec saturate the single Dokploy VPS and starve `/ready`, webhooks (NFR-33), and paying users (NFR-1); requires hardcoded volatility/correlation assumptions that edge toward regulated risk modeling and lacks a closed-form inverse for `computeMonthlyGap`.
- **Option C — Nominal-only curve + static inflation footnote:** Unanimously rejected (4–0) — fails credibility with the target French FIRE ICP, keeps `gapEurPerMonth` distorted by money illusion, and presents a single upward nominal curve with no downside framing.

## Consequences

- `apps/api/src/common/derive/{projection-curve,hypothesis-gap,compass-curve}.ts` migrate to `packages/finance` (re-exported or imported directly by `apps/api`, `apps/web`, `apps/mobile`), and `packages/validators` / `packages/types` extend `Hypothesis` and `HypothesisProjection` additively.
- `hypotheses` receives additive defaulted columns (`inflation_rate`, `fee_drag`, `scenario_spread`, `display_mode`) via a forward-only Prisma migration.
- Switching from `annualRate / 12` to effective monthly `(1 + r)^(1/12) - 1` slightly adjusts legacy unit test fixtures in `projection-curve.test.ts` and `hypothesis-gap.test.ts` (intentional precision fix, documented in the migration story).

## Pivot conditions

- **Validated demand for sequence-of-returns / retirement drawdown (post-50 clients / V2 Pro):** Add Monte Carlo strictly as an opt-in **client-side Web Worker** (never blocking the `apps/api` Bun event loop) with audited, non-prescriptive methodology disclosures.
- **Multi-currency base portfolios (V2+):** Extend `@pekulo/finance` with currency-scoped inflation curves beyond EUR/FR.
- **Regulatory feedback on optimistic bands:** Widen or relabel the pessimistic scenario to include explicit negative nominal return illustrations.

## References

- `docs/spikes/2026-11-26-securite-chiffrement-rust.md` (§5 Monte Carlo benchmark)
- `docs/triage-decision.md` (Lot B B2)
- `docs/architecture.md` § Phase 2b — Council Dispatch C6
