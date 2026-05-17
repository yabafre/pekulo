import { describe, expect, test } from "bun:test";
import type { PriceQuote, PriceQuoteInput } from "@pekulo/types";
import { createPricesCache } from "./holdings.cache";

function quote(over: Partial<PriceQuote> = {}): PriceQuote {
  return {
    symbol: "CW8.PA",
    price: 482.13,
    currency: "EUR",
    marketTime: "2026-05-17",
    provider: "yahoo",
    ...over,
  };
}

const KEY: PriceQuoteInput = { ticker: "CW8", kind: "etf", currency: "EUR" };

describe("PricesCache", () => {
  test("get on empty cache returns undefined", () => {
    const cache = createPricesCache({ ttlMs: 60_000 });
    expect(cache.get(KEY)).toBeUndefined();
  });

  test("set + get round-trip returns the stored quote", () => {
    const cache = createPricesCache({ ttlMs: 60_000 });
    const q = quote();
    cache.set(KEY, q);
    expect(cache.get(KEY)).toBe(q); // reference equality — AC-2
  });

  test("expired entry returns undefined", () => {
    let now = 1_000_000;
    const cache = createPricesCache({ ttlMs: 60_000, now: () => now });
    cache.set(KEY, quote());
    now += 59_999;
    expect(cache.get(KEY)).toBeDefined();
    now += 2; // crosses 60s boundary
    expect(cache.get(KEY)).toBeUndefined();
  });

  test("at exactly ttlMs (delta === 60_000) entry is still usable (pin > vs >= contract)", () => {
    let now = 1_000_000;
    const cache = createPricesCache({ ttlMs: 60_000, now: () => now });
    cache.set(KEY, quote());
    now += 60_000; // exactly at boundary; cache uses strict > so this is a HIT
    expect(cache.get(KEY)).toBeDefined();
    now += 1; // 60_001 ms after set → now a MISS
    expect(cache.get(KEY)).toBeUndefined();
  });

  test("key shape is ticker|kind|currency — kind change isolates", () => {
    const cache = createPricesCache({ ttlMs: 60_000 });
    cache.set({ ticker: "AAPL", kind: "action", currency: "USD" }, quote({ provider: "yahoo" }));
    expect(cache.get({ ticker: "AAPL", kind: "action", currency: "USD" })).toBeDefined();
    expect(cache.get({ ticker: "AAPL", kind: "etf", currency: "USD" })).toBeUndefined();
    expect(cache.get({ ticker: "AAPL", kind: "action", currency: "EUR" })).toBeUndefined();
  });

  test("null ticker is part of the key (empty-string slot)", () => {
    const cache = createPricesCache({ ttlMs: 60_000 });
    cache.set({ ticker: null, kind: "autre", currency: "EUR" }, quote());
    expect(cache.get({ ticker: null, kind: "autre", currency: "EUR" })).toBeDefined();
    expect(cache.get({ ticker: "", kind: "autre", currency: "EUR" })).toBeDefined();
  });

  test("instances are isolated — no shared module-level Map", () => {
    const a = createPricesCache({ ttlMs: 60_000 });
    const b = createPricesCache({ ttlMs: 60_000 });
    a.set(KEY, quote());
    expect(b.get(KEY)).toBeUndefined();
  });
});
