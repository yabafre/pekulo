// apps/web/src/lib/derive/close-window.ts
// Client-side mirror of apps/api/src/common/derive/close-window.ts. Used by
// sign-off-button.tsx to gate the "Clôturer {mois}" CTA. The byte-for-byte
// duplicate is intentional (5-5 codification): both layers stay independently
// verifiable. Extract to a shared @pekulo/derive package when a third
// consumer surfaces (cron job in epic 9 PWA, server action guard in V2+,
// etc.).

export function lastDayOfMonthUTC(year: number, monthNum: number): number {
  return new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
}

export function isWithinCloseWindow(year: number, monthNum: number, now: Date): boolean {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  const startMs = Date.UTC(year, monthNum - 1, lastDay - 4, 0, 0, 0, 0);
  const endMs = Date.UTC(year, monthNum - 1, lastDay + 5, 23, 59, 59, 999);
  const nowMs = now.getTime();
  return nowMs >= startMs && nowMs <= endMs;
}

export function closeWindowBounds(
  year: number,
  monthNum: number,
): { startIso: string; endIso: string } {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  return {
    startIso: new Date(Date.UTC(year, monthNum - 1, lastDay - 4, 0, 0, 0, 0)).toISOString(),
    endIso: new Date(Date.UTC(year, monthNum - 1, lastDay + 5, 23, 59, 59, 999)).toISOString(),
  };
}
