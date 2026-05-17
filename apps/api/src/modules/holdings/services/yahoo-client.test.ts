import { describe, expect, mock, test } from "bun:test";

const quoteMock = mock(async (_symbol: string) => ({
  regularMarketPrice: 482.13,
  currency: "EUR",
  regularMarketTime: new Date("2026-05-17T10:00:00Z"),
}));
await mock.module("yahoo-finance2", () => ({
  default: { quote: quoteMock },
}));

const { createYahooClient, resolveYahooSymbol, YahooError } = await import("./yahoo-client");

describe("resolveYahooSymbol", () => {
  test("appends .PA for EUR tickers without a dot", () => {
    expect(resolveYahooSymbol("CW8", "EUR")).toBe("CW8.PA");
  });

  test("returns as-is for USD tickers", () => {
    expect(resolveYahooSymbol("AAPL", "USD")).toBe("AAPL");
  });

  test("returns as-is for tickers with a dot", () => {
    expect(resolveYahooSymbol("PE500.PA", "EUR")).toBe("PE500.PA");
    expect(resolveYahooSymbol("BTC-USD", "USD")).toBe("BTC-USD");
  });

  test("throws YahooError('missing-ticker') on null/empty", () => {
    expect(() => resolveYahooSymbol(null, "EUR")).toThrow(YahooError);
    expect(() => resolveYahooSymbol("", "EUR")).toThrow(YahooError);
    expect(() => resolveYahooSymbol("   ", "EUR")).toThrow(YahooError);
  });
});

describe("YahooClient.fetchQuote", () => {
  test("happy path returns parsed quote without provider field", async () => {
    quoteMock.mockResolvedValueOnce({
      regularMarketPrice: 482.13,
      currency: "EUR",
      regularMarketTime: new Date("2026-05-17T10:00:00Z"),
    });
    const client = createYahooClient();
    const q = await client.fetchQuote("CW8.PA");
    expect(q).toEqual({
      symbol: "CW8.PA",
      price: 482.13,
      currency: "EUR",
      marketTime: "2026-05-17",
    });
  });

  test("invalid-ticker error message maps to YahooError('invalid-ticker')", async () => {
    quoteMock.mockRejectedValueOnce(new Error("Quote not found for ticker ZZZZ"));
    await expect(createYahooClient().fetchQuote("ZZZZ")).rejects.toMatchObject({
      name: "YahooError",
      code: "invalid-ticker",
    });
  });

  test("rate-limit error maps to YahooError('rate-limited')", async () => {
    quoteMock.mockRejectedValueOnce(new Error("Request failed with status 429 - rate-limited"));
    await expect(createYahooClient().fetchQuote("X")).rejects.toMatchObject({
      code: "rate-limited",
    });
  });

  test("price <= 0 maps to YahooError('no-price')", async () => {
    quoteMock.mockResolvedValueOnce({
      regularMarketPrice: 0,
      currency: "EUR",
      regularMarketTime: new Date(),
    });
    await expect(createYahooClient().fetchQuote("X")).rejects.toMatchObject({ code: "no-price" });
  });
});
