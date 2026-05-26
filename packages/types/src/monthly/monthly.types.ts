// packages/types/src/monthly/monthly.types.ts
// Monthly types. The new aggregate DTO (`MonthlyRecord`) lives in
// `@pekulo/validators` (story 5-4) — re-exported below so consumers can
// `import type { MonthlyRecord } from "@pekulo/types"` and get the
// validator-derived shape. The legacy UI-display row was renamed
// `MonthlyDisplayRow` to free the `MonthlyRecord` name for the DTO.

// New validator-derived DTOs + procedure I/O (story 5-4).
export type {
  MonthlyRecord,
  MonthlyRecordDerived,
  GetMonthlyInput,
  GetMonthlyOutput,
  UpsertMonthlyInput,
  SignOffMonthlyInput,
  ReopenMonthlyInput,
} from "@pekulo/validators";

// Legacy UI-display row. Pre-5-4 this was named `MonthlyRecord`; renamed
// to `MonthlyDisplayRow` so the `MonthlyRecord` symbol can carry the new
// validator-derived shape. Consumed today by `PekuloMonthlyRow`.
export interface MonthlyDisplayRow {
  monthLabel: string;
  incomeEur: number;
  spendingEur: number;
  netEur: number;
  closed?: boolean;
}

// Brownfield data-row shape for the `monthly_tracking` table. Epic 5 lands
// the oRPC port; the extra fields (monthLabel, epargneMois) are computed
// at the reader boundary.
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
