// apps/mobile/lib/format.ts
// Hermes ignores `Intl.NumberFormat({ notation: "compact" })` and falls back to
// the full grouped number ("800 000"), which wraps KPI tiles on 375pt iPhones.
// This formatter produces the French compact form deterministically.

const decimal1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** `800000` → `800 k€`, `1250000` → `1,3 M€`, `950` → `950 €`. */
export function formatCompactEur(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${decimal1.format(value / 1_000_000)} M€`;
  if (abs >= 1_000) return `${decimal1.format(value / 1_000)} k€`;
  return `${integer.format(value)} €`;
}

/** Full euro amount without decimals, e.g. `20 653 €`. */
export function formatEur(value: number): string {
  return `${integer.format(value)} €`;
}
