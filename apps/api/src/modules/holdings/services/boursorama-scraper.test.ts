import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BoursoramaError, createBoursoramaScraper } from "./boursorama-scraper";

type FetchFn = typeof globalThis.fetch;
let originalFetch: FetchFn;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function htmlWithPrice(raw: string): string {
  return `<html><body><span class="c-instrument c-instrument--last" data-test="x">${raw}</span></body></html>`;
}

describe("BoursoramaScraper", () => {
  test("missing ticker throws BoursoramaError('missing-ticker')", async () => {
    const scraper = createBoursoramaScraper();
    await expect(scraper.fetchQuote(null)).rejects.toMatchObject({ code: "missing-ticker" });
    await expect(scraper.fetchQuote("")).rejects.toMatchObject({ code: "missing-ticker" });
  });

  test("URL still on /recherche/ → invalid-symbol", async () => {
    globalThis.fetch = (async () => {
      const res = new Response("<html></html>", { status: 200 });
      Object.defineProperty(res, "url", {
        value: "https://www.boursorama.com/recherche/?query=ZZZZ",
      });
      return res;
    }) as unknown as FetchFn;
    const scraper = createBoursoramaScraper();
    await expect(scraper.fetchQuote("ZZZZ")).rejects.toMatchObject({ code: "invalid-symbol" });
  });

  test("happy path — French decimal '50,20' → 50.20", async () => {
    globalThis.fetch = (async () => {
      const res = new Response(htmlWithPrice("50,20"), { status: 200 });
      Object.defineProperty(res, "url", {
        value: "https://www.boursorama.com/bourse/trackers/cours/1rTPE500/",
      });
      return res;
    }) as unknown as FetchFn;
    const q = await createBoursoramaScraper().fetchQuote("PE500");
    expect(q.price).toBe(50.2);
    expect(q.currency).toBe("EUR");
    expect(q.symbol).toBe("PE500");
  });

  test("French decimal with NBSP thousand-sep '8 166,47' → 8166.47", async () => {
    globalThis.fetch = (async () => {
      const res = new Response(htmlWithPrice("8 166,47"), { status: 200 });
      Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/1rPABCD/" });
      return res;
    }) as unknown as FetchFn;
    const q = await createBoursoramaScraper().fetchQuote("ABCD");
    expect(q.price).toBe(8166.47);
  });

  test("ticker with .PA suffix is stripped to bare symbol before scrape", async () => {
    let capturedUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = String(url);
      const res = new Response(htmlWithPrice("100,00"), { status: 200 });
      Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/x/" });
      return res;
    }) as unknown as FetchFn;
    await createBoursoramaScraper().fetchQuote("PE500.PA");
    expect(capturedUrl).toContain("query=PE500");
    expect(capturedUrl).not.toContain("PE500.PA");
  });

  test("no price match in HTML → format", async () => {
    globalThis.fetch = (async () => {
      const res = new Response("<html></html>", { status: 200 });
      Object.defineProperty(res, "url", { value: "https://www.boursorama.com/cours/x/" });
      return res;
    }) as unknown as FetchFn;
    await expect(createBoursoramaScraper().fetchQuote("X")).rejects.toMatchObject({
      code: "format",
    });
  });
});

void BoursoramaError;
