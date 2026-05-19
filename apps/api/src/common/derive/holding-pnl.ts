// Pure per-holding unrealised PnL — native currency + the FxRates base.
//
// Returns `{ native: { pnl, pnlPct }, eur: { pnl, pnlPct } }`. The `eur` key
// reflects the FxRates.base (today the only caller passes EUR-based rates);
// the schema is locked to `eur` in @pekulo/validators#holdingPnlSchema. `pnlPct`
// is currency-invariant — it is the ratio (lastPrice − avgCost) / avgCost, with
// a zero-cost guard returning 0 (manual zero-cost lots, e.g. equity grants).
//
// No brownfield equivalent — apps/web computed snapshot-level PnL only.
// Story 3-4 + 7-1 will compose this helper into per-row UI affordances.
//
// Pure rules (AC-8):
//   - No `fetch`, no Prisma, no `Date.now()`, no `@opentelemetry/*` imports.
//   - All inputs by argument; rates: FxRates | null.

import type { FxRates, HoldingCurrency, HoldingPnl } from "@pekulo/validators";

export interface HoldingPnlInput {
  quantity: number;
  avgCost: number;
  lastPrice: number;
  currency: HoldingCurrency;
}

// INVARIANT: mirror of common/derive/portfolio-fx.ts#convertToBase — keep in sync.
function convertToBase(amount: number, from: HoldingCurrency, rates: FxRates): number {
  if (from === rates.base) return amount;
  const r = rates.rates[from];
  if (!r || r <= 0) return amount; // unknown rate → identity (best-effort, mirrors brownfield)
  return amount / r;
}

export function computeHoldingPnl(input: HoldingPnlInput, rates: FxRates | null): HoldingPnl {
  const nativePnl = input.quantity * (input.lastPrice - input.avgCost);
  const nativePnlPct = input.avgCost === 0 ? 0 : (input.lastPrice - input.avgCost) / input.avgCost;
  const basePnl = rates ? convertToBase(nativePnl, input.currency, rates) : nativePnl;
  // pnlPct is currency-invariant — it is a ratio, not an amount.
  return {
    native: { pnl: nativePnl, pnlPct: nativePnlPct },
    eur: { pnl: basePnl, pnlPct: nativePnlPct },
  };
}
