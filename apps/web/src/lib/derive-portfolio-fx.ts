import type {
  Account,
  Currency,
  Holding,
  PortfolioSnapshot,
} from "./types"
import { convertToBase, type FxRates } from "./fx-types"

export interface PortfolioSnapshotFx extends PortfolioSnapshot {
  fxBase: Currency
  fxAsOf: string | null // YYYY-MM-DD or null if rates unavailable
  fxAvailable: boolean
}

/**
 * Compute portfolio aggregates with FX normalization.
 * - Per-row values (account.cashBalance, holding.lastPrice) keep their native currency
 *   in the returned `accounts` and `holdings` arrays — they are unmodified.
 * - KPIs (capitalTotal, cash, invested, marketValue, pnl) and `byAccount[].total`
 *   are aggregated **after** conversion to `base`.
 * - When `rates` is null, every conversion is identity (1:1) — used as graceful fallback.
 */
export function computeSnapshotFx(
  accounts: Account[],
  holdings: Holding[],
  rates: FxRates | null,
  base: Currency = "EUR"
): PortfolioSnapshotFx {
  const conv = (amount: number, from: Currency): number =>
    rates ? convertToBase(amount, from, rates) : amount

  const cash = accounts.reduce(
    (acc, a) => acc + conv(a.cashBalance, a.currency),
    0
  )
  const invested = holdings.reduce(
    (acc, h) => acc + conv(h.quantity * h.avgCost, h.currency),
    0
  )
  const marketValue = holdings.reduce(
    (acc, h) => acc + conv(h.quantity * h.lastPrice, h.currency),
    0
  )
  const capitalTotal = cash + marketValue
  const pnl = marketValue - invested

  const byAccount = accounts.map((a) => {
    const cashBase = conv(a.cashBalance, a.currency)
    const holdingValueBase = holdings
      .filter((h) => h.accountId === a.id)
      .reduce((sum, h) => sum + conv(h.quantity * h.lastPrice, h.currency), 0)
    return {
      accountId: a.id,
      label: a.label,
      total: cashBase + holdingValueBase,
    }
  })

  return {
    accounts,
    holdings,
    kpi: { capitalTotal, cash, invested, marketValue, pnl },
    byAccount,
    fxBase: base,
    fxAsOf: rates?.date ?? null,
    fxAvailable: rates !== null,
  }
}
