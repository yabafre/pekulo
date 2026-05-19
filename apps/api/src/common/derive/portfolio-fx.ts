// Pure FX-aware portfolio aggregator. Port of apps/web/src/lib/derive-portfolio-fx.ts.
//
// Diffs vs brownfield:
//   - `fxSource: 'live' | 'fallback'` field added (NFR-19 transparency —
//     brownfield silently used 1:1 when rates were null, callers had to
//     read `fxAvailable` instead). Kept `fxAvailable` for back-compat.
//   - HOLDING_CURRENCIES whitelist (validator-side) — the FxRates shape
//     restricts foreign keys to currencies we model.
//   - convertToBase inlined as a private helper (brownfield re-exported it
//     from a fx-types module; here the helper is local and pure).
//
// Pure rules (AC-8):
//   - No `fetch`, no Prisma, no `Date.now()`, no `@opentelemetry/*` imports.
//   - All inputs by argument (accounts, holdings, rates, base).

import type {
  Account,
  FxRates,
  Holding,
  HoldingCurrency,
  PortfolioSnapshotFx,
} from "@pekulo/validators";

function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
  if (from === rates.base) return amount;
  const r = rates.rates[from];
  if (!r || r <= 0) return amount; // unknown rate → identity (best-effort, mirrors brownfield)
  return amount / r;
}

/**
 * Compute portfolio aggregates with FX normalisation.
 * - Per-row values (account.cashBalance, holding.lastPrice) keep their native
 *   currency in the returned `accounts` and `holdings` arrays — they are
 *   passed through by reference (no copy, no reshape).
 * - KPIs (capitalTotal, cash, invested, marketValue, pnl) and `byAccount[].total`
 *   are aggregated AFTER conversion to `base`.
 * - When `rates` is null, every conversion is identity (1:1) AND the result
 *   stamps `fxSource: 'fallback'`. When `rates` is provided, `fxSource: 'live'`
 *   regardless of partial-rate fallbacks per row (those are still considered
 *   "live, best-effort" — fxSource is a snapshot-level claim, not per-row).
 */
export function computeSnapshotFx(
  accounts: Account[],
  holdings: Holding[],
  rates: FxRates | null,
  base: HoldingCurrency = "EUR",
): PortfolioSnapshotFx {
  const conv = (amount: number, from: HoldingCurrency): number =>
    rates ? convertToBase(amount, from, rates) : amount;

  const cash = accounts.reduce(
    (acc, a) => acc + conv(a.cashBalance, a.currency as HoldingCurrency),
    0,
  );
  const invested = holdings.reduce((acc, h) => acc + conv(h.quantity * h.avgCost, h.currency), 0);
  const marketValue = holdings.reduce(
    (acc, h) => acc + conv(h.quantity * h.lastPrice, h.currency),
    0,
  );
  const capitalTotal = cash + marketValue;
  const pnl = marketValue - invested;

  const byAccount = accounts.map((a) => {
    const cashBase = conv(a.cashBalance, a.currency as HoldingCurrency);
    const holdingValueBase = holdings
      .filter((h) => h.accountId === a.id)
      .reduce((sum, h) => sum + conv(h.quantity * h.lastPrice, h.currency), 0);
    return {
      accountId: a.id,
      label: a.label,
      total: cashBase + holdingValueBase,
    };
  });

  return {
    accounts,
    holdings,
    kpi: { capitalTotal, cash, invested, marketValue, pnl },
    byAccount,
    fxBase: base,
    fxAsOf: rates?.date ?? null,
    fxAvailable: rates !== null,
    fxSource: rates ? "live" : "fallback",
  };
}
