// apps/api/src/modules/monthly/monthly.errors.ts
// Domain error constructors for the monthly aggregate. 5-4 surfaces NO
// 4xx business error — getMonthly always succeeds (derived defaults for
// empty months) and upsertMonthly is idempotent. The file exists so 5-5
// (sign-off) can add MONTHLY_RECORD_FROZEN here without a new module.

export {};
