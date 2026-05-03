import "server-only";
import { fetchYahooQuote, resolveYahooSymbol, YahooError } from "./yahoo-finance";
import { fetchBoursoramaQuote, BoursoramaError } from "./boursorama";
import { fetchTwelveDataQuote, TwelveDataError } from "./twelve-data";
import {
  fetchPricesServiceQuote,
  isPricesServiceConfigured,
  PricesServiceError,
} from "./prices-service";
import type { Currency, HoldingKind } from "@/lib/types";

export interface PriceQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string;
  provider: "prices-service" | "yahoo" | "boursorama" | "twelve-data";
}

export class PriceError extends Error {
  attempts: Array<{ provider: string; reason: string }>;

  constructor(attempts: Array<{ provider: string; reason: string }>) {
    super(
      attempts.map((a) => `${a.provider}: ${a.reason}`).join(" · ") || "Aucun provider disponible.",
    );
    this.name = "PriceError";
    this.attempts = attempts;
  }
}

export interface PriceQuoteInput {
  ticker: string | null | undefined;
  currency: Currency;
  kind: HoldingKind;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; quote: PriceQuote }>();

function cacheKey(input: PriceQuoteInput): string {
  return `${input.ticker ?? ""}|${input.kind}|${input.currency}`;
}

export { resolveYahooSymbol };

export function resolvePriceSymbol(ticker: string | null | undefined, currency: Currency): string {
  return resolveYahooSymbol(ticker, currency);
}

export async function fetchPriceQuote(input: PriceQuoteInput): Promise<PriceQuote> {
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.quote;
  }

  const yahooSymbol = resolveYahooSymbol(input.ticker, input.currency);
  const attempts: PriceError["attempts"] = [];

  // 1) Python yfinance service on Alex's VPS (different IP, most reliable)
  if (isPricesServiceConfigured()) {
    try {
      const q = await fetchPricesServiceQuote(yahooSymbol);
      const quote: PriceQuote = { ...q, provider: "prices-service" };
      cache.set(key, { at: Date.now(), quote });
      return quote;
    } catch (err) {
      if (err instanceof PricesServiceError) {
        attempts.push({ provider: "prices-service", reason: shortPs(err.code) });
      } else {
        attempts.push({ provider: "prices-service", reason: "exception" });
      }
    }
  }

  // 2) Yahoo via yahoo-finance2 (handles consent/crumb internally)
  try {
    const q = await fetchYahooQuote(yahooSymbol);
    const quote: PriceQuote = { ...q, provider: "yahoo" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof YahooError) {
      attempts.push({ provider: "yahoo", reason: shortYahoo(err.code) });
    } else {
      attempts.push({ provider: "yahoo", reason: "exception" });
    }
  }

  // 3) Boursorama scraping (Euronext FR free fallback)
  try {
    const q = await fetchBoursoramaQuote(input.ticker);
    const quote: PriceQuote = { ...q, provider: "boursorama" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof BoursoramaError) {
      if (err.code === "missing-ticker") throw err;
      attempts.push({ provider: "boursorama", reason: shortBourso(err.code) });
    } else {
      attempts.push({ provider: "boursorama", reason: "exception" });
    }
  }

  // 4) Twelve Data (free tier covers US only — useful for AAPL etc.)
  try {
    const q = await fetchTwelveDataQuote(yahooSymbol);
    const quote: PriceQuote = { ...q, provider: "twelve-data" };
    cache.set(key, { at: Date.now(), quote });
    return quote;
  } catch (err) {
    if (err instanceof TwelveDataError) {
      attempts.push({ provider: "twelve-data", reason: shortTd(err.code) });
    } else {
      attempts.push({ provider: "twelve-data", reason: "exception" });
    }
  }

  throw new PriceError(attempts);
}

function shortPs(code: PricesServiceError["code"]): string {
  switch (code) {
    case "not-configured":
      return "non configuré";
    case "network":
      return "réseau";
    case "format":
      return "format";
    case "auth":
      return "auth";
    case "invalid-symbol":
      return "ticker invalide";
    case "no-price":
      return "aucun prix";
  }
}

function shortYahoo(code: YahooError["code"]): string {
  switch (code) {
    case "rate-limited":
      return "rate-limited";
    case "network":
      return "réseau";
    case "format":
      return "format inattendu";
    case "no-price":
      return "aucun prix";
    case "invalid-ticker":
      return "ticker invalide";
    case "missing-ticker":
      return "ticker manquant";
  }
}

function shortBourso(code: BoursoramaError["code"]): string {
  switch (code) {
    case "missing-ticker":
      return "ticker manquant";
    case "invalid-symbol":
      return "ticker non listé";
    case "network":
      return "réseau";
    case "format":
      return "format inattendu";
    case "no-price":
      return "aucun prix";
  }
}

function shortTd(code: TwelveDataError["code"]): string {
  switch (code) {
    case "missing-key":
      return "clé manquante";
    case "rate-limited":
      return "rate-limited";
    case "invalid-symbol":
      return "free tier sans EU";
    case "network":
      return "réseau";
    case "format":
      return "format";
    case "no-price":
      return "aucun prix";
  }
}
