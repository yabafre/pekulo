// apps/api/src/common/market-data/price-holdings.ts
// Shared live-price enrichment for holdings (story 12-2 extraction).
//
// Two guards keep this linear at the NFR-16 cap (≤500 holdings):
//   1. dedupe identical {ticker, kind, currency} so N lots of the same
//      security resolve ONE quote;
//   2. bound concurrency so a cold cache cannot fan out 500 provider chains
//      in a single tick (thundering-herd against upstream providers).
//
// A null ticker (manual entry) or a rejected quote keeps the stored lastPrice.
// This helper never throws on a price miss.

import type { Holding, PriceQuote, PriceQuoteInput } from "@pekulo/validators";

export const PRICE_CONCURRENCY = 8;

export interface PriceHoldingsDeps {
  resolveQuote: (input: PriceQuoteInput) => Promise<PriceQuote>;
}

export async function priceHoldings(
  holdings: Holding[],
  deps: PriceHoldingsDeps,
): Promise<Holding[]> {
  const quoteKey = (holding: Holding) => `${holding.ticker}|${holding.kind}|${holding.currency}`;
  const distinct = new Map<string, PriceQuoteInput>();
  for (const holding of holdings) {
    const ticker = holding.ticker;
    if (!ticker) continue;
    const key = quoteKey(holding);
    if (!distinct.has(key)) {
      distinct.set(key, { ticker, kind: holding.kind, currency: holding.currency });
    }
  }

  const prices = new Map<string, number>();
  const inputs = [...distinct.entries()];
  for (let index = 0; index < inputs.length; index += PRICE_CONCURRENCY) {
    const batch = inputs.slice(index, index + PRICE_CONCURRENCY);
    // Sequential by design: each batch runs in parallel, but batches are awaited
    // one at a time to bound the fan-out (parallelising ALL batches is exactly
    // the unbounded thundering-herd this guard prevents — NFR-16).
    // oxlint-disable-next-line no-await-in-loop -- bounded price fan-out, see above
    await Promise.all(
      batch.map(async ([key, input]) => {
        try {
          const quote = await deps.resolveQuote(input);
          prices.set(key, quote.price);
        } catch {
          // graceful fallback — leave unset, the holding keeps its stored lastPrice
        }
      }),
    );
  }

  return holdings.map((holding) => {
    if (!holding.ticker) return holding;
    const price = prices.get(quoteKey(holding));
    return price === undefined ? holding : { ...holding, lastPrice: price };
  });
}
