// apps/api/src/common/derive/close-window.ts
// Pure derive: the "close window" inside which a month can be signed off.
// Window definition (contrat 5-4):
//   start = (last_day_of_month − 4) at 00:00:00.000 UTC
//   end   = (last_day_of_month + 5) at 23:59:59.999 UTC  (auto-overflows)
//
// Both ends inclusive. Zero IO — fully unit-testable.
//
// MIRROR (story 5-5): apps/web/src/lib/derive/close-window.ts (client gate)
// and apps/api/src/common/derive/close-window.ts (server gate) stay
// byte-for-byte identical aside from this file's own path on the first line.
// The close-window.iso.test.ts guard breaks CI on any other divergence.
// Extract to a shared @pekulo/derive package when a third consumer surfaces.

export function lastDayOfMonthUTC(year: number, monthNum: number): number {
  // JS quirk: Date.UTC(y, m, 0) yields the LAST day of month m. We pass the
  // 1-indexed monthNum unchanged because Date.UTC's month arg is 0-indexed
  // — so for May (monthNum=5) we ask "day 0 of month index 5" = May 31.
  return new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
}

export function isWithinCloseWindow(year: number, monthNum: number, now: Date): boolean {
  const lastDay = lastDayOfMonthUTC(year, monthNum);
  // Date.UTC normalises overflow: lastDay + 5 past month-end rolls into the
  // next month automatically (e.g. May 31 + 5 → June 5).
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
  // Same overflow normalisation as isWithinCloseWindow — Date.UTC rolls
  // lastDay + 5 into the next month automatically.
  return {
    startIso: new Date(Date.UTC(year, monthNum - 1, lastDay - 4, 0, 0, 0, 0)).toISOString(),
    endIso: new Date(Date.UTC(year, monthNum - 1, lastDay + 5, 23, 59, 59, 999)).toISOString(),
  };
}
