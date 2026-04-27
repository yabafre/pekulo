import "server-only"
import type { Currency } from "@/lib/types"
import type { FxRates } from "@/lib/fx-types"

export type { FxRates } from "@/lib/fx-types"
export { convertToBase } from "@/lib/fx-types"

export class FxError extends Error {
  code: "network" | "format" | "unsupported"

  constructor(code: FxError["code"], message: string) {
    super(message)
    this.name = "FxError"
    this.code = code
  }
}

const CACHE_TTL_MS = 24 * 60 * 60_000 // 24h
const cache = new Map<Currency, { at: number; rates: FxRates }>()

const SYMBOLS: Currency[] = ["EUR", "USD", "GBP", "CHF"]

export async function getRates(base: Currency = "EUR"): Promise<FxRates> {
  const cached = cache.get(base)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rates
  }

  const others = SYMBOLS.filter((c) => c !== base)
  const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(base)}&symbols=${others.join(",")}`

  let res: Response
  try {
    res = await fetch(url, { cache: "no-store" })
  } catch (err) {
    throw new FxError(
      "network",
      `Frankfurter unreachable: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  if (!res.ok) {
    throw new FxError("network", `Frankfurter HTTP ${res.status}`)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new FxError("format", "Frankfurter: réponse non-JSON.")
  }

  const obj = json as { date?: string; rates?: Record<string, number> }
  if (!obj.rates || typeof obj.rates !== "object") {
    throw new FxError("format", "Frankfurter: champ rates absent.")
  }

  const rates: Partial<Record<Currency, number>> = { [base]: 1 }
  for (const c of others) {
    const v = Number(obj.rates[c])
    if (Number.isFinite(v) && v > 0) rates[c] = v
  }

  const fx: FxRates = {
    base,
    date: typeof obj.date === "string" ? obj.date : new Date().toISOString().slice(0, 10),
    rates,
  }
  cache.set(base, { at: Date.now(), rates: fx })
  return fx
}
