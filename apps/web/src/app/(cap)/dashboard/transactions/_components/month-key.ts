// apps/web/src/app/(cap)/dashboard/transactions/_components/month-key.ts
// Pure calendar-month-key helpers (story 6-9, FR-64). "YYYY-MM" string maths +
// FR labels. No React / nuqs / clock — kept separate so the navigator logic is
// testable without the nuqs adapter.

// Year 0000 is rejected (the `(?!0000)` guard): it is unreachable from real
// `occurredOn` dates, and its absence keeps `shiftMonth` from ever yielding a
// negative ordinal in practice (iso with `monthKeySchema` in @pekulo/validators).
export const MONTH_KEY_REGEX = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_KEY_REGEX.test(value);
}

/** Step `month` by `delta` whole months, rolling over year boundaries. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const ordinal = y * 12 + (m - 1) + delta;
  const year = Math.floor(ordinal / 12);
  // Sign-safe modulo — JS `%` keeps the dividend's sign, so a negative ordinal
  // (delta stepping below January) would otherwise yield a 0 or negative month
  // number ("YYYY-00"). `((n % 12) + 12) % 12` pins it to 0–11 → 01–12.
  const monthNum = (((ordinal % 12) + 12) % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
}

const longFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { month: "long" });

// Day 1 at UTC noon — avoids any tz rollback to the previous month on format.
function monthDate(month: string): Date {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1, 12));
}

/** "février 2026" — the navigator label. */
export function formatMonthLong(month: string): string {
  return longFmt.format(monthDate(month));
}

/** "avril" / "février" — full FR month name (no year) for the stat-card caption. */
export function formatMonthName(month: string): string {
  return shortFmt.format(monthDate(month));
}
