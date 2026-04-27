import "server-only"

export interface PricesServiceQuote {
  symbol: string
  price: number
  currency: string
  marketTime: string // YYYY-MM-DD
}

export class PricesServiceError extends Error {
  code: "not-configured" | "network" | "format" | "auth" | "invalid-symbol" | "no-price"

  constructor(code: PricesServiceError["code"], message: string) {
    super(message)
    this.name = "PricesServiceError"
    this.code = code
  }
}

export function isPricesServiceConfigured(): boolean {
  return Boolean(process.env.PRICES_SERVICE_URL)
}

export async function fetchPricesServiceQuote(
  symbol: string
): Promise<PricesServiceQuote> {
  const base = process.env.PRICES_SERVICE_URL
  if (!base) {
    throw new PricesServiceError(
      "not-configured",
      "PRICES_SERVICE_URL non défini."
    )
  }

  const token = process.env.PRICES_SERVICE_TOKEN
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const url = `${base.replace(/\/$/, "")}/quote?symbol=${encodeURIComponent(symbol)}`

  let res: Response
  try {
    res = await fetch(url, { headers, cache: "no-store" })
  } catch (err) {
    throw new PricesServiceError(
      "network",
      `Échec réseau: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (res.status === 401 || res.status === 403) {
    throw new PricesServiceError("auth", `Service prix: HTTP ${res.status}`)
  }
  if (res.status === 404) {
    throw new PricesServiceError("invalid-symbol", `Ticker introuvable: ${symbol}`)
  }
  if (!res.ok) {
    throw new PricesServiceError("network", `Service prix: HTTP ${res.status}`)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new PricesServiceError("format", "Réponse non-JSON.")
  }

  const obj = json as Record<string, unknown>
  const price = Number(obj.price)
  if (!Number.isFinite(price) || price <= 0) {
    throw new PricesServiceError("no-price", `Pas de prix pour ${symbol}.`)
  }

  return {
    symbol: typeof obj.symbol === "string" ? obj.symbol : symbol,
    price,
    currency: typeof obj.currency === "string" ? obj.currency : "",
    marketTime:
      typeof obj.marketTime === "string"
        ? obj.marketTime.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
  }
}
