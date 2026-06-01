// apps/api/src/modules/transactions/services/suggestion-backfill-scheduler.ts
// Bun setInterval-backed sweep (épic 6) — drains the LLM-categorisation backlog
// every N hours. Iso-pattern with bank-aggregator's refresh-scheduler.
//
// Why a sweep AND a post-sync pass: the post-sync backfill (importFromProvider)
// is bounded + best-effort, and it never runs if the LLM was down at sync time.
// This sweep is the completeness net — it retries failed rows (left unstamped)
// and catches imports that predate the feature. idempotent start/stop.
import type { Env } from "../../../config/env";
import type { TransactionsService } from "../transactions.service";

export interface SuggestionBackfillScheduler {
  start(): void;
  stop(): void;
}

// Bounds per tick: at most MAX_USERS users, MAX_PER_USER rows each. Keeps a tick
// cheap and the LLM concurrency bounded; the next tick picks up the remainder.
const MAX_USERS = 50;
const MAX_PER_USER = 50;

export function createSuggestionBackfillScheduler(deps: {
  env: Env;
  service: TransactionsService;
}): SuggestionBackfillScheduler {
  const intervalMs = deps.env.SUGGESTION_BACKFILL_CRON_HOURS * 60 * 60 * 1000;
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        deps.service.backfillAllUsers(MAX_USERS, MAX_PER_USER).catch((err) => {
          console.warn(
            `[suggestion-backfill] tick failed: ${err instanceof Error ? err.message : "unknown"}`,
          );
        });
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
