// apps/api/src/modules/bank-aggregator/services/refresh-scheduler.ts
// Bun setInterval-backed cron — invokes service.refreshAll() every N hours.
// AC-6 surface. idempotent start/stop so lifecycle wire-up doesn't race.

import type { Env } from "../../../config/env";
import type { BankAggregatorService } from "../bank-aggregator.service";

export interface RefreshScheduler {
  start(): void;
  stop(): void;
}

export function createRefreshScheduler(deps: {
  env: Env;
  service: BankAggregatorService;
}): RefreshScheduler {
  const intervalMs = deps.env.BRIDGE_REFRESH_CRON_HOURS * 60 * 60 * 1000;
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        deps.service.refreshAll().catch((err) => {
          console.warn(
            `[refresh-scheduler] tick failed: ${err instanceof Error ? err.message : "unknown"}`,
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
