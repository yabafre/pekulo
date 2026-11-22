// apps/mobile/lib/forms.ts
// Pure form helpers shared by the mobile sheets. Amount parsing and the close
// window mirror the web (`cloture-modal.tsx` / `lib/derive/close-window.ts`) so
// both platforms accept and gate exactly the same values.

import type { z } from "@pekulo/zod";

import { currentLang, tNow } from "./i18n";

export class FormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormValidationError";
  }
}

/**
 * Shared-schema messages that are developer English (`"targetCapital must be > 0"`,
 * zod's `"Invalid input: expected number, received NaN"`) — never shown as-is.
 */
const ENGLISH_DEV_MESSAGE =
  /\b(must|cannot|can't|should|expected|invalid|received|required|greater|at least|at most)\b/i;

/**
 * Parse with a shared validator schema, surfacing a localised message.
 *
 * Some shared messages are deliberate French copy (`"Libellé requis"`); in
 * French those are kept. Developer-English messages and every message in
 * another language fall back to a localised message chosen from the kind of
 * issue (an empty amount field is `NaN` → "Saisissez un montant valide.").
 */
export function validateInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new FormValidationError(issueMessage(result.error.issues[0]));
  }
  return result.data;
}

function issueMessage(issue: z.ZodIssue | undefined): string {
  if (!issue) return tNow("common.errors.invalidInput");
  if (
    currentLang() === "fr" &&
    issue.code !== "invalid_type" &&
    issue.message &&
    !ENGLISH_DEV_MESSAGE.test(issue.message)
  ) {
    return issue.message;
  }
  switch (issue.code) {
    case "invalid_type":
      return "expected" in issue && issue.expected === "number"
        ? tNow("common.errors.invalidNumber")
        : tNow("common.errors.invalidInputHint");
    case "too_small":
      return issue.origin === "string"
        ? tNow("common.errors.requiredField")
        : tNow("common.errors.outOfRange");
    case "too_big":
      return tNow("common.errors.outOfRange");
    default:
      return tNow("common.errors.invalidInputHint");
  }
}

/**
 * `"1 234,50 €"` → `1234.5`; empty or non-numeric input → `NaN`.
 * With both separators present the last one is the decimal mark and the other
 * groups thousands, so `"1.234,50"` and `"1,234.50"` both read as `1234.5`.
 */
export function parseAmountInput(raw: string): number {
  let cleaned = raw.replace(/[\s\u00a0\u202f€]/g, "").replace(/\u2212/g, "-");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    cleaned = cleaned.split(group).join("").replace(decimal, ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return Number.NaN;
  const value = Number(cleaned);
  return Object.is(value, -0) ? 0 : value;
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

/**
 * UTC-midnight date from the API → local Date on the same calendar day, so the
 * pickers show (and re-save) the day the server stored in any timezone.
 */
export function fromUtcDay(value: Date | string): Date {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Percent typed by the user → ratio, without float noise (`1.1` → `0.011`). */
export function percentToRatio(percent: number): number {
  return Math.round(percent * 1e4) / 1e6;
}

/** Calendar day as a UTC-midnight Date for `z.coerce.date()` contract fields. */
export function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Current time — a seam so tests can pin the close window. */
export function nowDate(): Date {
  return new Date();
}

/** Current calendar month in UTC (the month the web lets you sign off). */
export function currentUtcMonth(): { year: number; monthNum: number } {
  const now = nowDate();
  return { year: now.getUTCFullYear(), monthNum: now.getUTCMonth() + 1 };
}

/** `YYYY-MM` of the current UTC month — the month the server and the web call "current". */
export function currentMonthKey(now: Date = nowDate()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const index = (y ?? 1970) * 12 + ((m ?? 1) - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatMonthKey(key: string, locale = "fr-FR"): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(y ?? 1970, (m ?? 1) - 1, 1),
  );
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

export function closeWindowLabel(year: number, monthNum: number, locale = "fr-FR"): string {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const start = new Date(Date.UTC(year, monthNum - 1, lastDay - 4));
  const end = new Date(Date.UTC(year, monthNum - 1, lastDay + 5));
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
