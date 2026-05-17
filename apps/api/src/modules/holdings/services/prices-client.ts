// Tier-1 client — HTTP to apps/prices (FastAPI on Dokploy, internal Docker
// network only, Bearer-authed). Port of apps/web/src/lib/services/prices-service.ts.
//
// Diffs vs brownfield:
//   - Factory pattern (createPricesClient(deps)) instead of module-level
//     process.env access. Lets the module factory wire env-derived deps and
//     tests inject fakes.
//   - AbortSignal.timeout(timeoutMs) — brownfield had no timeout, which
//     silently violates NFR-18 (provider fallback ≤ 500 ms). Default 500.
//   - The returned quote omits the `provider` field; the orchestrator
//     stamps it after the tier wins.

export interface PricesServiceQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export type PricesServiceErrorCode =
  | "not-configured"
  | "network"
  | "format"
  | "auth"
  | "invalid-symbol"
  | "no-price";

export class PricesServiceError extends Error {
  override readonly name = "PricesServiceError";
  readonly code: PricesServiceErrorCode;
  constructor(code: PricesServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface PricesClient {
  fetchQuote(symbol: string): Promise<PricesServiceQuote>;
}

export interface CreatePricesClientDeps {
  baseUrl: string | undefined;
  token: string | undefined;
  timeoutMs?: number;
}

export function createPricesClient(deps: CreatePricesClientDeps): PricesClient {
  const timeoutMs = deps.timeoutMs ?? 500;
  return {
    async fetchQuote(symbol) {
      const base = deps.baseUrl;
      if (!base) {
        throw new PricesServiceError("not-configured", "PRICES_SERVICE_URL non défini.");
      }
      const headers: Record<string, string> = { Accept: "application/json" };
      if (deps.token) headers.Authorization = `Bearer ${deps.token}`;

      const url = `${base.replace(/\/$/, "")}/quote?symbol=${encodeURIComponent(symbol)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new PricesServiceError(
          "network",
          `Échec réseau: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (res.status === 401 || res.status === 403) {
        throw new PricesServiceError("auth", `Service prix: HTTP ${res.status}`);
      }
      if (res.status === 404) {
        throw new PricesServiceError("invalid-symbol", `Ticker introuvable: ${symbol}`);
      }
      if (!res.ok) {
        throw new PricesServiceError("network", `Service prix: HTTP ${res.status}`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new PricesServiceError("format", "Réponse non-JSON.");
      }

      const obj = json as Record<string, unknown>;
      const price = Number(obj.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new PricesServiceError("no-price", `Pas de prix pour ${symbol}.`);
      }

      return {
        symbol: typeof obj.symbol === "string" ? obj.symbol : symbol,
        price,
        currency: typeof obj.currency === "string" ? obj.currency : "",
        marketTime:
          typeof obj.marketTime === "string"
            ? obj.marketTime.slice(0, 10)
            : new Date().toISOString().slice(0, 10),
      };
    },
  };
}
