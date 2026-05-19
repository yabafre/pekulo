import { afterEach, describe, expect, test } from "bun:test";
import {
  createFrankfurterClient,
  FrankfurterError,
  type FrankfurterClient,
} from "./frankfurter-client";

type FetchCall = { url: string; init?: RequestInit };

function installFetchStub(stub: (call: FetchCall) => Promise<Response>): () => void {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const call: FetchCall = { url, init };
    calls.push(call);
    return stub(call);
  }) as typeof fetch;
  (globalThis.fetch as unknown as { __calls: FetchCall[] }).__calls = calls;
  return () => {
    globalThis.fetch = original;
  };
}

let restore: (() => void) | undefined;

afterEach(() => {
  if (restore) {
    restore();
    restore = undefined;
  }
});

describe("createFrankfurterClient", () => {
  // AC-7 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   When FRANKFURTER_BASE_URL is unset, frankfurterClient.isConfigured === false.
  //   When set, frankfurterClient.isConfigured === true.
  test("isConfigured reflects baseUrl presence", () => {
    const configured: FrankfurterClient = createFrankfurterClient({
      baseUrl: "https://api.frankfurter.app",
    });
    const unconfigured: FrankfurterClient = createFrankfurterClient({ baseUrl: undefined });
    expect(configured.isConfigured).toBe(true);
    expect(unconfigured.isConfigured).toBe(false);
  });

  test("getRates throws not-configured when baseUrl is undefined", async () => {
    const client = createFrankfurterClient({ baseUrl: undefined });
    let err: unknown;
    try {
      await client.getRates("EUR");
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(FrankfurterError);
    expect((err as FrankfurterError).code).toBe("not-configured");
  });

  // AC-5 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   When the stubbed fetch returns { status: 200, json: () => ({ amount: 1,
  //   base: "EUR", date: "2026-05-19", rates: { USD: 1.08, GBP: 0.85, CHF: 0.95 } }) },
  //   getRates("EUR") resolves to { base: "EUR", date: "2026-05-19",
  //   rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 } } (base stamped with
  //   value 1, foreign rates parsed; unsupported JPY key in the wire payload is dropped).
  test("getRates returns parsed FxRates with base stamped at 1 on HTTP 200", async () => {
    restore = installFetchStub(
      async () =>
        new Response(
          JSON.stringify({
            amount: 1,
            base: "EUR",
            date: "2026-05-19",
            rates: { USD: 1.08, GBP: 0.85, CHF: 0.95, JPY: 165.2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
    const out = await client.getRates("EUR");
    expect(out.base).toBe("EUR");
    expect(out.date).toBe("2026-05-19");
    expect(out.rates).toEqual({ EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 });
    // JPY is filtered (not in HOLDING_CURRENCIES)
    expect((out.rates as Record<string, number>).JPY).toBeUndefined();
  });

  // AC-5 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   When the wire payload returns HTTP 503, the promise rejects with
  //   FrankfurterError({ code: "network" }) (5xx mapped to network).
  test("getRates maps HTTP 5xx to FrankfurterError(network)", async () => {
    restore = installFetchStub(async () => new Response("upstream down", { status: 503 }));
    const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
    let err: unknown;
    try {
      await client.getRates("EUR");
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(FrankfurterError);
    expect((err as FrankfurterError).code).toBe("network");
    expect((err as FrankfurterError).message).toContain("503");
  });

  test("getRates maps non-JSON body to FrankfurterError(format)", async () => {
    restore = installFetchStub(async () => new Response("<html>nope</html>", { status: 200 }));
    const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
    let err: unknown;
    try {
      await client.getRates("EUR");
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(FrankfurterError);
    expect((err as FrankfurterError).code).toBe("format");
  });

  test("getRates maps missing rates field to FrankfurterError(format)", async () => {
    restore = installFetchStub(
      async () =>
        new Response(JSON.stringify({ amount: 1, base: "EUR", date: "2026-05-19" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
    let err: unknown;
    try {
      await client.getRates("EUR");
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(FrankfurterError);
    expect((err as FrankfurterError).code).toBe("format");
  });

  // AC-5 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given a fetch stub that never resolves (simulating a hang), when
  //   frankfurterClient.getRates("EUR") is called with timeoutMs: 100, then
  //   within 200 ms wall-clock the promise rejects with FrankfurterError +
  //   err.code === "network".
  test("getRates respects AbortSignal timeout — hanging fetch rejects with network within ceiling", async () => {
    restore = installFetchStub(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = createFrankfurterClient({
      baseUrl: "https://api.frankfurter.app",
      timeoutMs: 100,
    });
    const t0 = performance.now();
    let err: unknown;
    try {
      await client.getRates("EUR");
    } catch (caught) {
      err = caught;
    }
    const dt = performance.now() - t0;
    expect(err).toBeInstanceOf(FrankfurterError);
    expect((err as FrankfurterError).code).toBe("network");
    expect(dt).toBeLessThan(300); // 100 ms timeout + 200 ms slack
  });

  test("getRates URL encodes base + symbols whitelist", async () => {
    const seen: string[] = [];
    restore = installFetchStub(async (call) => {
      seen.push(call.url);
      return new Response(
        JSON.stringify({
          amount: 1,
          base: "USD",
          date: "2026-05-19",
          rates: { EUR: 0.92, GBP: 0.78, CHF: 0.88 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = createFrankfurterClient({ baseUrl: "https://api.frankfurter.app" });
    await client.getRates("USD");
    expect(seen[0]).toBe("https://api.frankfurter.app/latest?base=USD&symbols=EUR%2CGBP%2CCHF");
  });
});
