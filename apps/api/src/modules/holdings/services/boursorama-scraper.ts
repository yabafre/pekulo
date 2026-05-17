// Tier-3 client — Boursorama scraper. Port of apps/web/src/lib/services/boursorama.ts.
//
// Diffs vs brownfield:
//   - Factory pattern.
//   - AbortSignal.timeout(timeoutMs) — default 1500 (scrape is slower than tier-1).
//   - The returned quote omits the `provider` field; the orchestrator stamps.

export interface BoursoramaQuote {
  symbol: string;
  price: number;
  currency: string;
  marketTime: string; // YYYY-MM-DD
}

export type BoursoramaErrorCode =
  | "missing-ticker"
  | "invalid-symbol"
  | "network"
  | "format"
  | "no-price";

export class BoursoramaError extends Error {
  override readonly name = "BoursoramaError";
  readonly code: BoursoramaErrorCode;
  constructor(code: BoursoramaErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

function bareTicker(ticker: string): string {
  const trimmed = ticker.trim().toUpperCase();
  const dot = trimmed.indexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

function parseFrenchDecimal(raw: string): number {
  // Strip non-breaking space (U+00A0), narrow no-break space (U+202F), and
  // regular whitespace, then swap French decimal comma for dot.
  const cleaned = raw.replace(/ /g, "").replace(/ /g, "").replace(/\s+/g, "").replace(",", ".");
  return Number(cleaned);
}

export interface BoursoramaScraper {
  fetchQuote(ticker: string | null | undefined): Promise<BoursoramaQuote>;
}

export interface CreateBoursoramaScraperDeps {
  timeoutMs?: number;
}

export function createBoursoramaScraper(deps: CreateBoursoramaScraperDeps = {}): BoursoramaScraper {
  const timeoutMs = deps.timeoutMs ?? 1500;

  return {
    async fetchQuote(ticker) {
      if (!ticker || ticker.trim().length === 0) {
        throw new BoursoramaError("missing-ticker", "Ticker manquant.");
      }
      const symbol = bareTicker(ticker);
      const searchUrl = `https://www.boursorama.com/recherche/?query=${encodeURIComponent(symbol)}`;

      let res: Response;
      try {
        res = await fetch(searchUrl, {
          headers: HEADERS,
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new BoursoramaError(
          "network",
          `Échec réseau Boursorama: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!res.ok) {
        throw new BoursoramaError("network", `Boursorama HTTP ${res.status}`);
      }

      if (res.url.includes("/recherche/")) {
        throw new BoursoramaError("invalid-symbol", `Ticker ${symbol} non trouvé sur Boursorama.`);
      }

      const html = await res.text();
      const match = html.match(/class="c-instrument c-instrument--last"[^>]*>([^<]+)</);
      if (!match || !match[1]) {
        throw new BoursoramaError("format", "Format Boursorama inattendu (prix introuvable).");
      }

      const price = parseFrenchDecimal(match[1]);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BoursoramaError("no-price", `Pas de prix exploitable pour ${symbol}.`);
      }

      const currency = "EUR";
      const marketTime = new Date().toISOString().slice(0, 10);

      return { symbol, price, currency, marketTime };
    },
  };
}
