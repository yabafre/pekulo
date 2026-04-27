# Quick Spec: Placements — FX multi-currency normalization (qs-04c)

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

Convert all KPIs and aggregates on the portefeuille page (and dashboard "Capital actuel") to a single base currency (EUR) when accounts/holdings are in mixed currencies. Uses [frankfurter.app](https://frankfurter.app) — free, no key, ECB-sourced rates — with a 24h server-side cache. Per-row values keep their native currency for transparency; only **aggregations** convert.

## Why

qs-04a stored a `currency` field on each `account` and `holding` but everything is summed at face value (`Σ qty * lastPrice`) regardless of currency. If you hold a USD account and a EUR account, the "Capital total" KPI is meaningless without conversion. Now that price refresh fills `currency` from the provider response (Yahoo gives `EUR`, `USD`, etc.), we have everything we need to normalize.

## Acceptance Criteria

- [ ] New `apps/web/src/lib/services/fx.ts` exposes `getRates(base: Currency)` returning `{ rates: Record<Currency, number>, asOf: string }` (cached 24h in-process). Endpoint: `https://api.frankfurter.app/latest?base=EUR&symbols=USD,GBP,CHF`.
- [ ] New `apps/web/src/lib/derive-portfolio-fx.ts` extends `computeSnapshot` → `computeSnapshotFx(accounts, holdings, rates, base="EUR")` returning a `PortfolioSnapshot` whose KPIs and `byAccount[].total` are in `base`.
- [ ] `apps/web/src/lib/data/portfolio.ts` `readPortfolioSnapshot` now fetches FX rates and uses `computeSnapshotFx`.
- [ ] `apps/web/src/app/dashboard/portefeuille/_components/portfolio-view.tsx` keeps row-level values in their native currency (e.g., a USD holding shows `$520`) but the **KPI strip + AllocationChart + dashboard "Capital actuel"** are normalized to EUR.
- [ ] Each KPI card shows a tiny suffix `(EUR)` in `text-muted-foreground` so the user knows it's converted.
- [ ] The `lastPriceAt` of FX rates surfaces as `Taux FX au YYYY-MM-DD` somewhere — small line under the AllocationChart card.
- [ ] If frankfurter is unreachable: fall back to `1:1` ratios (do not crash) and show a discreet warning banner "FX indisponible — taux 1:1 utilisés temporairement".
- [ ] `.env.example` unchanged (no key for frankfurter).

## Stack reuse

- Same `import "server-only"` + native `fetch` pattern as Boursorama / yahoo-finance.
- 24h in-process Map cache, same approach as qs-04b.
- No new npm dep.
- Pure derivation function `computeSnapshotFx` — testable, composable with `computeSnapshot` (when rates not loaded yet).

## Files to Change

**New (2)**
- `apps/web/src/lib/services/fx.ts` — `getRates`, `convert(amount, from, to, rates)`, `FxError`.
- `apps/web/src/lib/derive-portfolio-fx.ts` — `computeSnapshotFx` building on existing `computeSnapshot`.

**Edited (3)**
- `apps/web/src/lib/data/portfolio.ts` — `readPortfolioSnapshot` calls `getRates` then `computeSnapshotFx`. Fallback to `computeSnapshot` (1:1) on FX error.
- `apps/web/src/lib/derive-portfolio.ts` — extract account/holding currency normalization into a shared helper used by both `computeSnapshot` and `computeSnapshotFx`.
- `apps/web/src/app/dashboard/portefeuille/_components/portfolio-view.tsx` — pass FX info, render `(EUR)` suffix + "Taux au YYYY-MM-DD" line + fallback warning if applicable.

→ **5 files** (2 new, 3 edited). Tight quick.

## Test Plan

- **Type-check + lint** clean.
- **Manual #1**: existing EUR-only setup → KPIs unchanged (no conversion needed when all currencies are EUR).
- **Manual #2**: edit a holding → set currency=USD, lastPrice=520 (e.g., `AAPL`) → after refresh, the row shows `$520` natively, but Capital total / Valeur titres KPIs are in EUR (≈ 480 € given 1 USD ≈ 0.92 EUR).
- **Manual #3**: disconnect network → refresh → fallback warning appears, KPIs computed at 1:1 (still functional, not crashed).
- **Manual #4**: dashboard `/dashboard` "Capital actuel" KPI matches the portefeuille's Capital total.

## Open Questions

1. **Base currency = EUR** hardcoded for v1. Future multi-base via `hypotheses` setting → out of scope. OK?
2. **Currencies supported** : `EUR, USD, GBP, CHF` (matches existing `CURRENCIES` enum). Frankfurter supports way more — easy to extend later. OK?
3. **Cache TTL = 24h** (FX rates barely move intraday for personal portfolio tracking). OK?
4. **Row-level display in native currency** vs converted: keep native (transparent). OK?

## Result

<!-- Filled after implementation -->
