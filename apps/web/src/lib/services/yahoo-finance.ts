import "server-only";
import yahooFinance from "yahoo-finance2";
import type { Currency } from "@/lib/types";

export interface YahooQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export class YahooError extends Error {
  code: "missing-ticker" | "invalid-ticker" | "network" | "format" | "no-price" | "rate-limited";

  constructor(code: YahooError["code"], message: string) {
    super(message);
    this.name = "YahooError";
    this.code = code;
  }
}

// yahoo-finance2 prints a survey notice on first use to stdout; harmless, ignore.

export function resolveYahooSymbol(ticker: string | null | undefined, currency: Currency): string {
  if (!ticker || ticker.trim().length === 0) {
    throw new YahooError("missing-ticker", "Aucun ticker pour cette ligne.");
  }
  const trimmed = ticker.trim().toUpperCase();
  if (trimmed.includes(".")) return trimmed;
  if (currency === "USD") return trimmed;
  return `${trimmed}.PA`;
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  let result: Awaited<ReturnType<typeof yahooFinance.quote>>;
  try {
    result = await yahooFinance.quote(symbol, {}, { validateResult: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|invalid|empty result/i.test(msg)) {
      throw new YahooError("invalid-ticker", `Ticker introuvable: ${symbol}`);
    }
    if (/429|rate.?limit|too many/i.test(msg)) {
      throw new YahooError("rate-limited", "Yahoo: rate-limited.");
    }
    throw new YahooError("network", `Yahoo: ${msg}`);
  }

  // `quote()` with a single string returns one object.
  const q = Array.isArray(result) ? result[0] : result;
  if (!q) {
    throw new YahooError("invalid-ticker", `Aucune réponse pour ${symbol}.`);
  }

  const price = Number((q as { regularMarketPrice?: number }).regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new YahooError("no-price", `Pas de prix pour ${symbol}.`);
  }

  const currency =
    typeof (q as { currency?: string }).currency === "string"
      ? (q as { currency: string }).currency
      : "";

  const ts = (q as { regularMarketTime?: number | Date }).regularMarketTime;
  const marketTime =
    ts instanceof Date
      ? ts.toISOString().slice(0, 10)
      : typeof ts === "number"
        ? new Date(ts * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

  return { symbol, price, currency, marketTime };
}

// Backwards-compat exports kept so prices.ts orchestrator doesn't change shape.
export const fetchYahooQuoteBasic = fetchYahooQuote;

// Crumb path is handled internally by yahoo-finance2 — no separate function needed.
// Kept as alias for prices.ts to avoid an extra refactor.
export const fetchYahooQuoteWithCrumb = fetchYahooQuote;
