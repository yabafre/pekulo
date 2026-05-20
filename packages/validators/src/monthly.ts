// Zod source of truth for the monthly-tracking aggregate. Will land server-side
// when Epic 5 migrates monthly tracking to oRPC ; the schemas live here today
// so the form code in apps/web can validate input against the same shape the
// future api will accept (no re-write at migration time).
//
// Relocated from apps/web/src/lib/schemas/monthly.ts during the archi-audit
// pass (PR #86) — every Zod schema in the monorepo lives under @pekulo/validators
// per ADR-0011 and routes its `z` through @pekulo/zod (R1).

import { z } from "@pekulo/zod";

const positive = z.number().min(0);

export const monthlyEntrySchema = z.object({
  year: z.number().int().min(2026).max(2031),
  monthNum: z.number().int().min(1).max(12),
  net: positive,
  avantages: positive,
  depenses: positive,
  credit: positive,
  remote: positive,
  freelance: positive,
});

export type MonthlyEntryInput = z.infer<typeof monthlyEntrySchema>;

export const monthlyKeySchema = z.object({
  year: z.number().int().min(2026).max(2031),
  monthNum: z.number().int().min(1).max(12),
});

export type MonthlyKey = z.infer<typeof monthlyKeySchema>;

export const MONTH_LABELS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

export function formatMonthLabel(year: number, monthNum: number): string {
  return `${MONTH_LABELS[monthNum - 1]} ${year}`;
}

export function monthRange(): Array<{ year: number; monthNum: number; label: string }> {
  const out: Array<{ year: number; monthNum: number; label: string }> = [];
  let year = 2026;
  let m = 5;
  for (let i = 0; i < 60; i++) {
    out.push({ year, monthNum: m, label: formatMonthLabel(year, m) });
    m += 1;
    if (m > 12) {
      m = 1;
      year += 1;
    }
  }
  return out;
}
