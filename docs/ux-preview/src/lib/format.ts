/**
 * Pekulo formatters — locale fr-FR, EUR, tabular figures.
 * Used everywhere monetary or percentage values are rendered.
 */

const fmtEUR0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const fmtEUR2 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPct1 = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const fmtCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatEUR = (n: number, opts?: { precise?: boolean }) =>
  opts?.precise ? fmtEUR2.format(n) : fmtEUR0.format(n);

export const formatPct = (ratio: number) => fmtPct1.format(ratio);

export const formatCompactEUR = (n: number) => `${fmtCompact.format(n)} €`;

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));

export const formatMonthYear = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(iso));

export const signed = (n: number, formatter: (x: number) => string = formatEUR) =>
  (n > 0 ? "+" : "") + formatter(n);
