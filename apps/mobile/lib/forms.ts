// apps/mobile/lib/forms.ts
// Pure form helpers shared by the mobile sheets. Amount parsing and the close
// window mirror the web (`cloture-modal.tsx` / `lib/derive/close-window.ts`) so
// both platforms accept and gate exactly the same values.

import type { z } from "@pekulo/zod";

export class FormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormValidationError";
  }
}

/** Parse with a shared validator schema, surfacing the first human message. */
export function validateInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new FormValidationError(result.error.issues[0]?.message ?? "Saisie invalide");
  }
  return result.data;
}

/** `"1 234,50 €"` → `1234.5`; empty or non-numeric input → `NaN`. */
export function parseAmountInput(raw: string): number {
  const cleaned = raw
    .replace(/[\s  €]/g, "")
    .replace(",", ".")
    .trim();
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Display a number back in an editable French field (`1234.5` → `"1234,5"`). */
export function formatAmountInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

/** Local calendar day as ISO `YYYY-MM-DD` (what the date pickers show). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO `YYYY-MM-DD` → local Date at midnight (inverse of `toIsoDate`). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Calendar day as a UTC-midnight Date for `z.coerce.date()` contract fields. */
export function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const index = (y ?? 1970) * 12 + ((m ?? 1) - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = MONTH_LABEL.format(new Date(y ?? 1970, (m ?? 1) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function lastDayOfMonthUTC(year: number, monthNum: number): number {
  return new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
}

/** Same window as the web: last 5 days of the month through 5 days after (UTC). */
export function isWithinCloseWindow(year: number, monthNum: number, now: Date): boolean {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  const startMs = Date.UTC(year, monthNum - 1, lastDay - 4, 0, 0, 0, 0);
  const endMs = Date.UTC(year, monthNum - 1, lastDay + 5, 23, 59, 59, 999);
  const nowMs = now.getTime();
  return nowMs >= startMs && nowMs <= endMs;
}

export function closeWindowLabel(year: number, monthNum: number): string {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const start = new Date(Date.UTC(year, monthNum - 1, lastDay - 4));
  const end = new Date(Date.UTC(year, monthNum - 1, lastDay + 5));
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
