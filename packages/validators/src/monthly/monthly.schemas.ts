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

// ─── 5-4-monthly-tracking — FR-37/38 ─────────────────────────────────────
// New aggregate-snapshot DTO surfaced via /rpc/v1/monthly. The legacy
// monthlyEntrySchema / monthlyKeySchema above STAY — still consumed by the
// hypothesis-projection path (apps/web/src/lib/derive-monthly.ts).

const MONTHLY_RECORD_ID_REGEX = /^mr_[0-9A-Za-z]{21}$/;

const eurAmount = (msg = "Montant ≥ 0") => z.number().finite("Montant invalide").min(0, msg);

// Net change can be negative (spending > income). No min(0) constraint.
const netChangeAmount = () => z.number().finite("Net change invalide");

export const monthlyRecordSchema = z.object({
  id: z.string().regex(MONTHLY_RECORD_ID_REGEX),
  year: z.number().int().min(2020).max(2099),
  monthNum: z.number().int().min(1).max(12),
  incomeEur: eurAmount(),
  spendingEur: eurAmount(),
  transfersEur: eurAmount(),
  netChangeEur: netChangeAmount(),
  signedOffAt: z.string().nullable(),
  createdAt: z.string(),
});
export type MonthlyRecord = z.infer<typeof monthlyRecordSchema>;

// Defaults branch — pre-persistence shape. id/createdAt are absent; the
// service composes this when the user has not yet saved an override.
export const monthlyRecordDerivedSchema = monthlyRecordSchema
  .omit({ id: true, createdAt: true, signedOffAt: true })
  .extend({ signedOffAt: z.null() });
export type MonthlyRecordDerived = z.infer<typeof monthlyRecordDerivedSchema>;

export const getMonthlyInputSchema = z.object({
  year: z.number().int().min(2020).max(2099),
  monthNum: z.number().int().min(1).max(12),
});
export type GetMonthlyInput = z.infer<typeof getMonthlyInputSchema>;

export const getMonthlyOutputSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("derived"), record: monthlyRecordDerivedSchema }),
  z.object({ source: z.literal("persisted"), record: monthlyRecordSchema }),
]);
export type GetMonthlyOutput = z.infer<typeof getMonthlyOutputSchema>;

export const upsertMonthlyInputSchema = z.object({
  year: z.number().int().min(2020).max(2099),
  monthNum: z.number().int().min(1).max(12),
  incomeEur: eurAmount(),
  spendingEur: eurAmount(),
  transfersEur: eurAmount(),
  netChangeEur: netChangeAmount(),
});
export type UpsertMonthlyInput = z.infer<typeof upsertMonthlyInputSchema>;

// listMonthly — N most-recent months (current + past). Each entry carries the
// same discriminated `source` envelope as getMonthly: persisted row wins,
// otherwise we derive from the transactions of that month.
export const listMonthlyInputSchema = z.object({
  limit: z.number().int().min(1).max(60).default(12),
});
export type ListMonthlyInput = z.infer<typeof listMonthlyInputSchema>;

export const listMonthlyOutputSchema = z.object({
  items: z.array(getMonthlyOutputSchema),
});
export type ListMonthlyOutput = z.infer<typeof listMonthlyOutputSchema>;
