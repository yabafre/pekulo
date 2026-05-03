# Quick Spec: Placements — Yahoo crumb + Twelve Data fallbacks (qs-04b-bis)

**Date:** 2026-04-27
**Author:** Alex
**Type:** fix
**Status:** done-with-boursorama-fallback

## What

Real-world fix for qs-04b: Yahoo's basic endpoint rate-limits aggressively from any AWS/Vercel/home IP doing automated calls. Add two fallbacks behind a single `fetchPriceQuote` orchestrator:

1. **Primary**: Yahoo basic (existing — unchanged)
2. **Fallback A**: Yahoo with crumb + cookie (bypasses many rate-limits)
3. **Fallback B**: Twelve Data (free API key, 800 req/day, rock solid)

The action layer no longer talks to Yahoo directly — it calls `fetchPriceQuote(symbol)` which tries each provider in order and returns the first success.

## Why

qs-04b shipped Yahoo-only refresh and immediately failed on a real ticker (`PE500.PA` returned 429 on both query1 + query2 from this network). The retries I added help with transient blips but don't help when Yahoo blocks the IP for an extended window. Need real provider redundancy.

## Acceptance Criteria

- [ ] `lib/services/yahoo-finance.ts` keeps the existing basic flow as `fetchYahooQuoteBasic`. Adds `fetchYahooQuoteWithCrumb` doing the consent + crumb dance (cookies from `finance.yahoo.com`, crumb from `query1.finance.yahoo.com/v1/test/getcrumb`, attach both to the chart request).
- [ ] New `lib/services/twelve-data.ts` exposes `fetchTwelveDataQuote(symbol)`. Reads `TWELVE_DATA_API_KEY` from env. Throws a `TwelveDataError("missing-key")` if absent — this is non-fatal in the orchestrator; just skip this provider.
- [ ] New `lib/services/prices.ts` orchestrator exposes `fetchPriceQuote(symbol)` which tries: Yahoo basic → Yahoo crumb → Twelve Data. Returns the first success. If all three fail, throws a composite `PriceError` summarising what each provider said.
- [ ] `lib/actions/portfolio.ts` swaps `fetchYahooQuote` → `fetchPriceQuote` for both `refreshHoldingPrice` and `refreshAllPrices`.
- [ ] `.env.example` documents `TWELVE_DATA_API_KEY=` (left empty — user fills in their key locally).
- [ ] Crumb session cached in-process (re-use cookie + crumb for ~30 min). On crumb expiry / 401 → fetch fresh.
- [ ] Twelve Data response cached the same 60 s as Yahoo (in `prices.ts` orchestrator level rather than per-provider).
- [ ] Symbol resolution rule unchanged from qs-04b (`.PA` default for EUR, USD bare).
- [ ] Composite error bubbles a clear French message: `"Yahoo basic: rate-limited · Yahoo crumb: …  · Twelve Data: clé manquante"`.

## Stack reuse

- No new npm dep (continue with native `fetch`).
- ZapAction action signature unchanged (`refreshHoldingPrice` / `refreshAllPrices` keep their input/output shapes).
- Banner UI in `holdings-section.tsx` already handles longer error strings — composite error fits.

## Files to Change

**New (2)**

- `src/lib/services/twelve-data.ts` — Twelve Data fetcher with key gating.
- `src/lib/services/prices.ts` — `fetchPriceQuote` orchestrator + `PriceError`.

**Edited (3)**

- `src/lib/services/yahoo-finance.ts` — split current `fetchYahooQuote` into `fetchYahooQuoteBasic` + new `fetchYahooQuoteWithCrumb`. Cache cookies/crumb. Keep `resolveYahooSymbol` exported (orchestrator and Twelve Data both use it).
- `src/lib/actions/portfolio.ts` — call `fetchPriceQuote` instead of `fetchYahooQuote`.
- `.env.example` — add `TWELVE_DATA_API_KEY=`.

→ **5 files** (2 new, 3 edited). Same shape as qs-04b.

## Test Plan

- **Type-check** + **lint** clean.
- **Manual #1** (no env key set): single holding `CW8.PA` → click row refresh → if Yahoo basic blocks, the crumb flow should kick in and succeed; if both Yahoo paths fail, banner shows "clé Twelve Data manquante" — at least one path should work.
- **Manual #2** (with env key): set `TWELVE_DATA_API_KEY` in `.env.local`, restart dev → if both Yahoo paths fail, Twelve Data delivers the price → banner success.
- **Manual #3**: mismatch ticker (`ZZZZZZ`) → all three fail → composite error string in banner with each provider's reason.
- **Manual #4**: crumb cache — first fetch retrieves crumb, second fetch within 30 min reuses it (verify via timing; second fetch should be faster).
- **Manual #5**: refresh all 3 holdings sequentially → providers don't compound 429 across holdings (each holding tries Yahoo first; on 429 Yahoo is skipped for the rest of the batch in the same minute via the existing 60 s response cache).

## Open Questions

1. **Crumb fetch on cold start** — adds ~500 ms latency on first refresh. → Acceptable, document. OK?
2. **Twelve Data symbol mapping** — they accept Yahoo-style `.PA` suffixes for most exchanges, so resolver is shared. → OK?
3. **`TWELVE_DATA_API_KEY` missing in prod** — orchestrator just skips that provider gracefully (no thrown). → OK?
4. **EU consent page** — Yahoo redirects EU users to `consent.yahoo.com` before issuing cookies. Crumb flow needs to handle that or accept the redirect via `Cookie: GUC=…` from a previous browser session. → For v1, attempt without consent handshake; if it fails, log "consent required" and fall through to Twelve Data. **OK to ship without consent handling and revisit if needed?**

## Result

<!-- Filled after implementation -->
