# Quick Spec: Placements — Auto price refresh (qs-04b)

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

Add auto price fetch via the unofficial Yahoo Finance endpoint. Each holding row gets a "Refresh prix" button (lucide `RefreshCw`) and the page header gets a "Refresh tous" button. On click → server action calls Yahoo, parses the price, upserts `last_price` + `last_price_at` for the holding(s) — no manual typing needed.

## Why

qs-04a ships manual price entry. That's fine for one-shot weekly updates but tedious — and prices drift between updates so the dashboard understates/overstates capital. Yahoo gives free, no-key, sub-second prices for 99% of European/US tickers. Closes the loop: enter the ticker once, click refresh, your portfolio is current.

## Acceptance Criteria

- [ ] New module `src/lib/services/yahoo-finance.ts` exposes `fetchYahooQuote(symbol: string)` returning `{ price, currency, marketTime }` or throwing a typed `YahooError`.
- [ ] New action `refreshHoldingPrice(id)` — looks up the holding, picks the best Yahoo symbol, fetches, upserts `last_price` + `last_price_at`, returns the updated `Holding`. Uses existing `updateHoldingPrice` upsert path internally.
- [ ] New action `refreshAllPrices()` — runs sequentially with a 200 ms delay between calls (anti rate-limit), returns `{ updated: number, failed: Array<{ id, label, reason }> }`.
- [ ] `holdings-section.tsx` row gets a `RefreshCw` button next to the existing "Maj cours" → identical visual, but calls `refreshHoldingPrice` instead of opening the manual dialog.
- [ ] `holdings-section.tsx` header gets a "Refresh tous" button, disabled if no holdings have a ticker. On click runs `refreshAllPrices` and shows `<X mis à jour, Y échecs>` for ~3s in the section header.
- [ ] Error handling: if a holding has no `ticker`, the row's auto-refresh button is disabled with a tooltip "Ajouter un ticker pour activer". Network/parse errors show inline text in the section header (truncated).
- [ ] Yahoo currency in the response (e.g. `EUR`, `USD`) is **stored as-is** but not converted yet — qs-04c handles FX.
- [ ] No new npm dep — use native `fetch`.
- [ ] Anti rate-limit: cache Yahoo responses for 60 s in-process (Map keyed by symbol) so two clicks within a minute don't double-call. In Next.js dev that resets on hot reload, fine for v1.
- [ ] User-Agent header set to a desktop browser string — Yahoo refuses the default Node UA in some regions.

## Stack reuse

- ZapAction `defineAction` pattern, tags `[portfolioTags.holdings()]`, belt-and-suspenders invalidation.
- TanStack Query refresh on success (manual `queryClient.invalidateQueries + refetchQueries`).
- No new dep, no new pattern.

## Symbol resolution rule

Yahoo uses a single `symbol` field. We resolve in this order:

1. If `holding.ticker` already includes a `.` (e.g. `CW8.PA`, `IWDA.AS`), use it as-is.
2. If `holding.ticker` is set without a suffix and `holding.currency === "EUR"`, append `.PA` (Paris) by default. (Most user-held EUR ETFs are Paris-listed Amundi products. Crude but right 80% of the time. User can always edit the ticker to e.g. `IWDA.AS` for Amsterdam.)
3. If `holding.ticker` is unset → action throws `YahooError("missing-ticker")`.
4. ISIN-only fallback: **out of scope qs-04b** (Yahoo doesn't accept ISIN; would need a resolver service). Documented as known limitation.

## Files to Change

**New (2)**

- `src/lib/services/yahoo-finance.ts` — `fetchYahooQuote`, in-memory 60 s cache, `YahooError` class, symbol resolver helper `resolveYahooSymbol(ticker, currency)`.
- _(no new UI files — buttons added inline to existing components)_

**Edited (3)**

- `src/lib/actions/portfolio.ts` — add `refreshHoldingPrice` and `refreshAllPrices` actions.
- `src/app/dashboard/portefeuille/_components/holdings-section.tsx` — per-row Auto-refresh button + global "Refresh tous" + status feedback area.
- `src/lib/types.ts` — add `RefreshSummary = { updated: number; failed: Array<{ id: string; label: string; reason: string }> }`.

→ **5 files** (2 new, 3 edited). Fits the original quick-spec cap of 5 files for the first time in qs-04. 🎉

## Test Plan

- **Type-check** + **lint** clean.
- **Manual #1**: existing holding without ticker → "Refresh" button disabled, tooltip explains.
- **Manual #2**: edit a holding → set ticker `CW8` (no suffix) and currency EUR → click row Refresh button → spinner → row updates with current Amundi MSCI World price (~25-30 € range) + today's date. Network tab should show one request to `query1.finance.yahoo.com/v8/finance/chart/CW8.PA`.
- **Manual #3**: ticker `AAPL` (no suffix) currency USD → manual symbol entry needed, or document as known limitation. Edge case to flag in spec result.
- **Manual #4**: "Refresh tous" with 3 holdings (2 valid tickers, 1 missing) → 2 succeed, 1 reports failure → status banner shows "2 mis à jour, 1 échec".
- **Manual #5**: spam-click "Refresh tous" → second click hits the in-memory cache, no second network call (verify in Network tab — only first click triggers fetches).

## Open Questions (resolve before in-progress)

1. **Default suffix `.PA` for EUR tickers without dot** — pragmatic but not always correct. → Keep as default + let user override by typing the full ticker. OK?
2. **Rate-limit strategy**: 200 ms sequential delay vs parallel-with-throttle. → Sequential is simpler; if user has 20 holdings it's 4 s but who refreshes 20 holdings simultaneously? OK?
3. **Server-side cache**: 60 s in-process Map. Resets on hot reload / serverless cold start. → Acceptable for v1. OK?
4. **USD ticker without suffix** (e.g. `AAPL` currency USD) — Yahoo accepts bare US tickers, so no suffix needed. Logic: if `currency === "USD"` and no dot, use as-is. OK?
5. **Toast/banner for refresh feedback** — banner inline in section header (3 s timeout) is enough for v1 — no toast lib. OK?
6. **Failure reasons surfaced** — generic ("ticker invalide", "réseau", "format inattendu"). No detailed Yahoo error parsing. OK?

## Result

<!-- Filled after implementation -->
