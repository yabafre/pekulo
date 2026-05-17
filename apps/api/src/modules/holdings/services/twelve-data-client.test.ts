import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTwelveDataClient, TwelveDataError } from "./twelve-data-client";

type FetchFn = typeof globalThis.fetch;
let originalFetch: FetchFn;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("TwelveDataClient", () => {
  test("missing apiKey throws TwelveDataError('missing-key')", async () => {
    const client = createTwelveDataClient({ apiKey: undefined });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({
      name: "TwelveDataError",
      code: "missing-key",
    });
  });

  test("HTTP 429 → rate-limited", async () => {
    globalThis.fetch = (async () => new Response("Too many", { status: 429 })) as FetchFn;
    const client = createTwelveDataClient({ apiKey: "k" });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "rate-limited" });
  });

  test("envelope-error code 404 → invalid-symbol", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: 404, message: "symbol not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as FetchFn;
    const client = createTwelveDataClient({ apiKey: "k" });
    await expect(client.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
  });

  test("envelope-error 'api key' → missing-key", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: 401, message: "Invalid api key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as FetchFn;
    const client = createTwelveDataClient({ apiKey: "k" });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "missing-key" });
  });

  test("happy path — close field → price", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ close: "192.55", currency: "USD", datetime: "2026-05-17 16:00:00" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as FetchFn;
    const q = await createTwelveDataClient({ apiKey: "k" }).fetchQuote("AAPL");
    expect(q).toEqual({
      symbol: "AAPL",
      price: 192.55,
      currency: "USD",
      marketTime: "2026-05-17",
    });
  });

  test("price <= 0 → no-price", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ close: "0", currency: "USD" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as FetchFn;
    await expect(createTwelveDataClient({ apiKey: "k" }).fetchQuote("X")).rejects.toMatchObject({
      code: "no-price",
    });
  });
});

void TwelveDataError;
