// Per-module-instance TTL cache for price quotes (FR-17, NFR-2).
// Key shape: `${ticker ?? ""}|${kind}|${currency}` — null and "" map to the
// same slot intentionally (manual-entry holdings have no ticker and never
// hit the chain anyway).
//
// The `now` factory dep is exposed so tests can deterministically advance
// time without `setSystemTime` (which leaks across tests in bun:test).

import type { PriceQuote, PriceQuoteInput } from "@pekulo/types";

export interface PricesCache {
  get(input: PriceQuoteInput): PriceQuote | undefined;
  set(input: PriceQuoteInput, quote: PriceQuote): void;
}

export interface CreatePricesCacheDeps {
  ttlMs: number;
  now?: () => number;
}

export function createPricesCache(deps: CreatePricesCacheDeps): PricesCache {
  const ttlMs = deps.ttlMs;
  const now = deps.now ?? (() => Date.now());
  const store = new Map<string, { at: number; quote: PriceQuote }>();

  function key(input: PriceQuoteInput): string {
    return `${input.ticker ?? ""}|${input.kind}|${input.currency}`;
  }

  return {
    get(input) {
      const entry = store.get(key(input));
      if (!entry) return undefined;
      if (now() - entry.at > ttlMs) return undefined;
      return entry.quote;
    },
    set(input, quote) {
      store.set(key(input), { at: now(), quote });
    },
  };
}
