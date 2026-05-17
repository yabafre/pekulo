// Tier-2 client — yahoo-finance2 wrapper. Port of
// apps/web/src/lib/services/yahoo-finance.ts.
//
// Diffs vs brownfield:
//   - Factory pattern (createYahooClient() — currently no deps but the
//     shape stays consistent with the other 3 clients).
//   - Imports HoldingCurrency from @pekulo/validators (instead of legacy
//     @/lib/types#Currency from the web tier).
//   - The returned quote omits the `provider` field; the orchestrator stamps.

import yahooFinance from "yahoo-finance2";
import type { HoldingCurrency } from "@pekulo/validators";

export interface YahooQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export type YahooErrorCode =
  | "missing-ticker"
  | "invalid-ticker"
  | "network"
  | "format"
  | "no-price"
  | "rate-limited";

export class YahooError extends Error {
  override readonly name = "YahooError";
  readonly code: YahooErrorCode;
  constructor(code: YahooErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function resolveYahooSymbol(
  ticker: string | null | undefined,
  currency: HoldingCurrency,
): string {
  if (!ticker || ticker.trim().length === 0) {
    throw new YahooError("missing-ticker", "Aucun ticker pour cette ligne.");
  }
  const trimmed = ticker.trim().toUpperCase();
  if (trimmed.includes(".")) return trimmed;
  if (currency === "USD") return trimmed;
  return `${trimmed}.PA`;
}

export interface YahooClient {
  fetchQuote(symbol: string): Promise<YahooQuote>;
}

export function createYahooClient(): YahooClient {
  return {
    async fetchQuote(symbol) {
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
    },
  };
}
