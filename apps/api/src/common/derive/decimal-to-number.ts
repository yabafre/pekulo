// Coerce a Prisma-returned numeric column value to a JS number.
// Postgres `Decimal` columns surface as `Prisma.Decimal` (decimal.js) instances
// at runtime — `.toNumber()` is preferred over `Number(decimal)` because it's
// explicit and lintable (lessons.md L24 — applies across 1-1, 1-2, 2-1, 3-1,
// 4-1, 5-1, … boundaries). Plain numbers pass through; unexpected types fall
// through to `Number(value)` so the caller's fallback isn't hit on coercible
// strings.

export function decimalToNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}
