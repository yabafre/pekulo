import "server-only"

export interface TwelveDataQuote {
  symbol: string
  price: number
  currency: string
  marketTime: string // YYYY-MM-DD
}

export class TwelveDataError extends Error {
  code:
    | "missing-key"
    | "invalid-symbol"
    | "rate-limited"
    | "network"
    | "format"
    | "no-price"

  constructor(code: TwelveDataError["code"], message: string) {
    super(message)
    this.name = "TwelveDataError"
    this.code = code
  }
}

export async function fetchTwelveDataQuote(
  symbol: string
): Promise<TwelveDataQuote> {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) {
    throw new TwelveDataError(
      "missing-key",
      "TWELVE_DATA_API_KEY non défini dans .env.local"
    )
  }

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, { cache: "no-store" })
  } catch (err) {
    throw new TwelveDataError(
      "network",
      `Échec réseau: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (res.status === 429) {
    throw new TwelveDataError("rate-limited", "Twelve Data: rate-limited (429).")
  }
  if (!res.ok) {
    throw new TwelveDataError("network", `Twelve Data HTTP ${res.status}`)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new TwelveDataError("format", "Réponse Twelve Data non-JSON.")
  }

  // Twelve Data returns 200 with { code: 400/404/429, message: '...' } on errors.
  if (json && typeof json === "object" && "code" in json && "message" in json) {
    const code = Number((json as { code?: number }).code)
    const msg = String((json as { message?: string }).message ?? "")
    if (code === 429) {
      throw new TwelveDataError("rate-limited", `Twelve Data: ${msg}`)
    }
    if (code === 401 || /api key/i.test(msg)) {
      throw new TwelveDataError("missing-key", `Twelve Data: ${msg}`)
    }
    if (code === 404 || /not found/i.test(msg)) {
      throw new TwelveDataError("invalid-symbol", `Twelve Data: ${msg}`)
    }
    throw new TwelveDataError("format", `Twelve Data: ${msg}`)
  }

  const obj = json as Record<string, unknown>
  const closeRaw = obj.close ?? obj.price
  const price = Number(closeRaw)
  if (!Number.isFinite(price) || price <= 0) {
    throw new TwelveDataError("no-price", `Pas de prix pour ${symbol}.`)
  }

  const currency =
    typeof obj.currency === "string" ? obj.currency : ""
  const datetime = typeof obj.datetime === "string" ? obj.datetime : ""
  const marketTime = datetime
    ? datetime.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return { symbol, price, currency, marketTime }
}
