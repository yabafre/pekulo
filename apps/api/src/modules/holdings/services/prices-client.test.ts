import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createPricesClient, PricesServiceError } from "./prices-client";

type FetchFn = typeof globalThis.fetch;
let originalFetch: FetchFn;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  impl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
): void {
  globalThis.fetch = impl as unknown as FetchFn;
}

describe("PricesClient", () => {
  test("isConfigured reflects baseUrl presence (false when undefined, true otherwise)", () => {
    expect(createPricesClient({ baseUrl: undefined, token: undefined }).isConfigured).toBe(false);
    expect(createPricesClient({ baseUrl: "", token: undefined }).isConfigured).toBe(false);
    expect(createPricesClient({ baseUrl: "https://x", token: undefined }).isConfigured).toBe(true);
  });

  test("throws not-configured when baseUrl is undefined", async () => {
    const client = createPricesClient({ baseUrl: undefined, token: undefined });
    await expect(client.fetchQuote("CW8.PA")).rejects.toMatchObject({
      name: "PricesServiceError",
      code: "not-configured",
    });
  });

  test("sends Bearer header when token is set", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    mockFetch(async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(
        JSON.stringify({
          symbol: "CW8.PA",
          price: 482.13,
          currency: "EUR",
          marketTime: "2026-05-17",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const client = createPricesClient({
      baseUrl: "https://prices.internal:8000",
      token: "tok-abc",
    });
    await client.fetchQuote("CW8.PA");
    expect(capturedHeaders?.Authorization).toBe("Bearer tok-abc");
  });

  test("passes AbortSignal.timeout(timeoutMs) to fetch (tier-1 NFR-18)", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetch(async (_url, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Response(
        JSON.stringify({ symbol: "X", price: 1, currency: "EUR", marketTime: "2026-05-17" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const client = createPricesClient({ baseUrl: "https://x", token: undefined, timeoutMs: 500 });
    await client.fetchQuote("X");
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  test("aborted fetch maps to PricesServiceError('network')", async () => {
    mockFetch(async (_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const client = createPricesClient({ baseUrl: "https://x", token: undefined, timeoutMs: 10 });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({
      name: "PricesServiceError",
      code: "network",
    });
  });

  test("401 maps to auth", async () => {
    mockFetch(async () => new Response("Unauthorized", { status: 401 }));
    const client = createPricesClient({ baseUrl: "https://x", token: "bad" });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "auth" });
  });

  test("404 maps to invalid-symbol", async () => {
    mockFetch(async () => new Response("Not Found", { status: 404 }));
    const client = createPricesClient({ baseUrl: "https://x", token: undefined });
    await expect(client.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
  });

  test("price <= 0 maps to no-price", async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({ symbol: "X", price: 0, currency: "EUR", marketTime: "2026-05-17" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = createPricesClient({ baseUrl: "https://x", token: undefined });
    await expect(client.fetchQuote("X")).rejects.toMatchObject({ code: "no-price" });
  });

  test("happy path returns parsed quote (no provider field — orchestrator stamps it)", async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            symbol: "CW8.PA",
            price: 482.13,
            currency: "EUR",
            marketTime: "2026-05-17T10:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = createPricesClient({ baseUrl: "https://x", token: undefined });
    const q = await client.fetchQuote("CW8.PA");
    expect(q.symbol).toBe("CW8.PA");
    expect(q.price).toBe(482.13);
    expect(q.currency).toBe("EUR");
    expect(q.marketTime).toBe("2026-05-17");
    expect("provider" in q).toBe(false);
  });
});

// Silences unused-import lint when client construction is the only assertion.
void PricesServiceError;
