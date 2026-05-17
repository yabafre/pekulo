// Tier-4 client — Twelve Data REST. Port of apps/web/src/lib/services/twelve-data.ts.
//
// Diffs vs brownfield:
//   - Factory pattern (apiKey injected via deps, not module-level process.env).
//   - AbortSignal.timeout(timeoutMs) — default 2 s (free tier is slow).
//   - `provider` field stripped from output.

export interface TwelveDataQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export type TwelveDataErrorCode =
  | "missing-key"
  | "invalid-symbol"
  | "rate-limited"
  | "network"
  | "format"
  | "no-price";

export class TwelveDataError extends Error {
  override readonly name = "TwelveDataError";
  readonly code: TwelveDataErrorCode;
  constructor(code: TwelveDataErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface TwelveDataClient {
  fetchQuote(symbol: string): Promise<TwelveDataQuote>;
}

export interface CreateTwelveDataClientDeps {
  apiKey: string | undefined;
  timeoutMs?: number;
}

export function createTwelveDataClient(deps: CreateTwelveDataClientDeps): TwelveDataClient {
  const timeoutMs = deps.timeoutMs ?? 2_000;
  return {
    async fetchQuote(symbol) {
      const apiKey = deps.apiKey;
      if (!apiKey) {
        throw new TwelveDataError("missing-key", "TWELVE_DATA_API_KEY non défini.");
      }

      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new TwelveDataError(
          "network",
          `Échec réseau: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (res.status === 429) {
        throw new TwelveDataError("rate-limited", "Twelve Data: rate-limited (429).");
      }
      if (!res.ok) {
        throw new TwelveDataError("network", `Twelve Data HTTP ${res.status}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new TwelveDataError("format", "Réponse Twelve Data non-JSON.");
      }

      if (json && typeof json === "object" && "code" in json && "message" in json) {
        const code = Number((json as { code?: number }).code);
        const msg = String((json as { message?: string }).message ?? "");
        if (code === 429) {
          throw new TwelveDataError("rate-limited", `Twelve Data: ${msg}`);
        }
        if (code === 401 || /api key/i.test(msg)) {
          throw new TwelveDataError("missing-key", `Twelve Data: ${msg}`);
        }
        if (code === 404 || /not found/i.test(msg)) {
          throw new TwelveDataError("invalid-symbol", `Twelve Data: ${msg}`);
        }
        throw new TwelveDataError("format", `Twelve Data: ${msg}`);
      }

      const obj = json as Record<string, unknown>;
      const closeRaw = obj.close ?? obj.price;
      const price = Number(closeRaw);
      if (!Number.isFinite(price) || price <= 0) {
        throw new TwelveDataError("no-price", `Pas de prix pour ${symbol}.`);
      }

      const currency = typeof obj.currency === "string" ? obj.currency : "";
      const datetime = typeof obj.datetime === "string" ? obj.datetime : "";
      const marketTime = datetime ? datetime.slice(0, 10) : new Date().toISOString().slice(0, 10);

      return { symbol, price, currency, marketTime };
    },
  };
}
