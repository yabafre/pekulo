import { describe, expect, test } from "bun:test";
import type { Holding, PriceQuote } from "@pekulo/validators";
import { PRICE_CONCURRENCY, priceHoldings } from "./price-holdings";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-10-27T00:00:00Z");

function hold(over: Partial<Holding> = {}): Holding {
  return {
    id: "hld_000000000000000000001",
    userId: USER,
    accountId: "acc_000000000000000000000",
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Holding",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 90,
    lastPriceAt: NOW,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    closedAt: null,
    ...over,
  };
}

function quote(symbol: string, price: number): PriceQuote {
  return {
    symbol,
    price,
    currency: "EUR",
    marketTime: "2026-10-27",
    provider: "yahoo",
  };
}

describe("priceHoldings", () => {
  test("dedupes identical {ticker, kind, currency} keys", async () => {
    let calls = 0;
    const out = await priceHoldings(
      [
        hold({ id: "hld_000000000000000000001" }),
        hold({ id: "hld_000000000000000000002" }),
        hold({ id: "hld_000000000000000000003" }),
      ],
      {
        resolveQuote: async ({ ticker }) => {
          calls += 1;
          return quote(ticker ?? "T", 100);
        },
      },
    );

    expect(calls).toBe(1);
    expect(out.map((holding) => holding.lastPrice)).toEqual([100, 100, 100]);
  });

  test("a null ticker is never resolved and keeps the stored lastPrice", async () => {
    let calls = 0;
    const out = await priceHoldings([hold({ ticker: null, lastPrice: 42 })], {
      resolveQuote: async () => {
        calls += 1;
        return quote("T", 100);
      },
    });

    expect(calls).toBe(0);
    expect(out[0]?.lastPrice).toBe(42);
  });

  test("a rejected quote keeps the stored lastPrice", async () => {
    const out = await priceHoldings([hold({ lastPrice: 90 })], {
      resolveQuote: async () => {
        throw new Error("all tiers down");
      },
    });

    expect(out[0]?.lastPrice).toBe(90);
  });

  test("the same ticker with a different currency resolves a distinct quote", async () => {
    let calls = 0;
    const out = await priceHoldings(
      [
        hold({ id: "hld_000000000000000000001", ticker: "CW8", currency: "EUR" }),
        hold({ id: "hld_000000000000000000002", ticker: "CW8", currency: "USD" }),
      ],
      {
        resolveQuote: async () => {
          calls += 1;
          return quote("CW8", 100);
        },
      },
    );

    expect(calls).toBe(2);
    expect(out).toHaveLength(2);
  });

  test("bounds the cold fan-out to PRICE_CONCURRENCY", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const holdings = Array.from({ length: PRICE_CONCURRENCY * 3 }, (_, index) =>
      hold({
        id: `hld_${index.toString().padStart(21, "0")}`,
        ticker: `T${index}`,
      }),
    );

    const out = await priceHoldings(holdings, {
      resolveQuote: async ({ ticker }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return quote(ticker ?? "T", 100);
      },
    });

    expect(maxInFlight).toBe(PRICE_CONCURRENCY);
    expect(out.every((holding) => holding.lastPrice === 100)).toBe(true);
  });
});
