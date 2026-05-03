import type { Currency } from "./types";

export interface FxRates {
  base: Currency;
  date: string; // YYYY-MM-DD
  // rates are quoted as 1 unit of `base` = X units of foreign.
  // Always includes base itself with value 1.
  rates: Partial<Record<Currency, number>>;
}

/**
 * Convert `amount` from `from` currency into the base of `rates`.
 * If from === rates.base → identity.
 * Otherwise: amount in foreign / (1 base = X foreign) = amount in base.
 * Pure function — safe to import from both server and client.
 */
export function convertToBase(amount: number, from: Currency, rates: FxRates): number {
  if (from === rates.base) return amount;
  const r = rates.rates[from];
  if (!r || r <= 0) return amount; // unknown rate → identity (best-effort)
  return amount / r;
}
