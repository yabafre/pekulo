// apps/mobile/lib/format.ts
// Hermes ignores `Intl.NumberFormat({ notation: "compact" })` and falls back to
// the full grouped number ("800 000"), which wraps KPI tiles on 375pt iPhones.
// This formatter produces the French compact form deterministically.

const decimal1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Round to whole euros, normalising `-0` so a tiny negative never prints `-0 €`. */
function wholeEuros(value: number): number {
  return Math.round(value) || 0;
}

/** `800000` → `800 k€`, `1250000` → `1,3 M€`, `950` → `950 €`. */
export function formatCompactEur(value: number): string {
  const abs = Math.abs(value);
  // Choose the unit from the ROUNDED figure: 999 999 must read "1 M€", not "1 000 k€".
  const roundsToMillion = abs >= 1_000_000 || Math.round(abs / 100) / 10 >= 1_000;
  if (roundsToMillion) return `${decimal1.format(value / 1_000_000)} M€`;
  if (abs >= 1_000) return `${decimal1.format(value / 1_000)} k€`;
  return `${integer.format(wholeEuros(value))} €`;
}

/** Full euro amount without decimals, e.g. `20 653 €`. */
export function formatEur(value: number): string {
  return `${integer.format(wholeEuros(value))} €`;
}
