// apps/api/src/bootstrap/schedulers.ts
// Boot/teardown for the app's background schedulers. Extracted from app.ts so
// the wiring is a unit-testable pure function — aped-review (story 6-4) caught
// the suggestion-backfill sweep being CONSTRUCTED but never `.start()`ed: it
// was buried inline in startServer (too heavyweight to unit-test), so the
// documented "completeness net" silently never ran. Both crons live here now
// and are guarded by schedulers.test.ts.

interface Scheduler {
  start(): void;
  stop(): void;
}

export interface SchedulerDeps {
  // Story 5-6 — bank-refresh cron.
  bankAggregatorModule: { scheduledTask: Scheduler };
  // Story 6-4 — hourly LLM-categorisation backfill sweep. The completeness net
  // that retries `failed`/pre-feature `autre` rows (see
  // suggestion-backfill-scheduler.ts); idempotent start/stop.
  suggestionBackfillTask: Scheduler;
}

export function startSchedulers(deps: SchedulerDeps): void {
  deps.bankAggregatorModule.scheduledTask.start();
  deps.suggestionBackfillTask.start();
}

export function stopSchedulers(deps: SchedulerDeps): void {
  deps.bankAggregatorModule.scheduledTask.stop();
  deps.suggestionBackfillTask.stop();
}
