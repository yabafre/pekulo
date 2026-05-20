// packages/types/src/monthly/monthly.types.ts
// Monthly-tracking types — UI-display row (`MonthlyRecord`), brownfield
// data-row entity (`MonthlyEntry`), and the actual-vs-projected composite
// (`MonthlyMerged`).

export interface MonthlyRecord {
  monthLabel: string;
  incomeEur: number;
  spendingEur: number;
  netEur: number;
  closed?: boolean;
}

// Data-row shape for the brownfield `monthly_tracking` table. The reader that
// produces these rows is in flight ; Epic 5 lands the oRPC port.
// MonthlyEntry has more fields than the input schema
// (`monthlyEntrySchema` in @pekulo/validators) — those extra fields
// (`monthLabel`, `epargneMois`) are computed at the reader boundary.
export interface MonthlyEntry {
  monthNum: number;
  year: number;
  monthLabel: string;
  net: number;
  avantages: number;
  depenses: number;
  credit: number;
  remote: number;
  freelance: number;
  epargneMois: number;
}

// Composite shape produced by `apps/web/src/lib/derive-monthly.ts` when an
// actual row (from the DB) is merged with its projected row (from
// `deriveMonthly` in derive.ts) — the dashboard mixes both feeds with an
// `ecart` (gap) annotation.
export type MonthlyMerged = MonthlyEntry & {
  source: "actual" | "projected";
  projected: MonthlyEntry;
  ecart: number;
};
