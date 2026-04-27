import "server-only"

export interface BoursoramaQuote {
  symbol: string
  price: number
  currency: string
  marketTime: string // YYYY-MM-DD
}

export class BoursoramaError extends Error {
  code: "missing-ticker" | "invalid-symbol" | "network" | "format" | "no-price"

  constructor(code: BoursoramaError["code"], message: string) {
    super(message)
    this.name = "BoursoramaError"
    this.code = code
  }
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"

const HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
}

function bareTicker(ticker: string): string {
  const trimmed = ticker.trim().toUpperCase()
  const dot = trimmed.indexOf(".")
  return dot > 0 ? trimmed.slice(0, dot) : trimmed
}

/**
 * Boursorama's `/recherche/?query=<TICKER>` redirects directly to the canonical
 * quote page (`/bourse/trackers/cours/1rTPE500/`, `/cours/1rPBNP/`, etc.) when the
 * ticker is recognized. If unrecognized, it stays on the search page.
 *
 * We exploit the redirect: we don't need to guess `1rT` vs `1rP` vs `1rA` prefixes.
 * Bonus: it strips ETF-listing-suffix mismatches (PE500 works even if user typed PE500.PA — we strip the suffix first).
 */
export async function fetchBoursoramaQuote(
  ticker: string | null | undefined
): Promise<BoursoramaQuote> {
  if (!ticker || ticker.trim().length === 0) {
    throw new BoursoramaError("missing-ticker", "Ticker manquant.")
  }
  const symbol = bareTicker(ticker)
  const searchUrl = `https://www.boursorama.com/recherche/?query=${encodeURIComponent(symbol)}`

  let res: Response
  try {
    res = await fetch(searchUrl, {
      headers: HEADERS,
      redirect: "follow",
      cache: "no-store",
    })
  } catch (err) {
    throw new BoursoramaError(
      "network",
      `Échec réseau Boursorama: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    throw new BoursoramaError("network", `Boursorama HTTP ${res.status}`)
  }

  // If the search redirected to a quote page, the URL no longer contains "/recherche/".
  if (res.url.includes("/recherche/")) {
    throw new BoursoramaError(
      "invalid-symbol",
      `Ticker ${symbol} non trouvé sur Boursorama.`
    )
  }

  const html = await res.text()

  // First c-instrument--last is the holding's price (next ones are CAC40 widget etc.).
  const match = html.match(
    /class="c-instrument c-instrument--last"[^>]*>([^<]+)</
  )
  if (!match || !match[1]) {
    throw new BoursoramaError(
      "format",
      "Format Boursorama inattendu (prix introuvable)."
    )
  }

  const price = parseFrenchDecimal(match[1])
  if (!Number.isFinite(price) || price <= 0) {
    throw new BoursoramaError(
      "no-price",
      `Pas de prix exploitable pour ${symbol}.`
    )
  }

  // Currency: Boursorama displays EUR for ~all Euronext instruments.
  // qs-04c (FX) will normalize anyway when needed.
  const currency = "EUR"
  const marketTime = new Date().toISOString().slice(0, 10)

  return { symbol, price, currency, marketTime }
}

function parseFrenchDecimal(raw: string): number {
  // "50,20" → 50.20 ; "8 166,47" → 8166.47 ; non-breaking spaces & narrow nbsp stripped.
  const cleaned = raw
    .replace(/ /g, "") // non-breaking space
    .replace(/ /g, "") // narrow no-break space (Boursorama thousand sep)
    .replace(/\s+/g, "")
    .replace(",", ".")
  return Number(cleaned)
}
