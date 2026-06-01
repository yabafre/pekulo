import { describe, expect, mock, test } from "bun:test";
import { startSchedulers, stopSchedulers } from "./schedulers";

const makeScheduler = () => ({ start: mock(() => {}), stop: mock(() => {}) });
const makeDeps = () => {
  const bank = makeScheduler();
  const backfill = makeScheduler();
  return {
    bank,
    backfill,
    deps: {
      bankAggregatorModule: { scheduledTask: bank },
      suggestionBackfillTask: backfill,
    },
  };
};

// Regression guard for the aped-review 6-4 BLOCKER: the suggestion-backfill
// sweep was built but never started, because the start/stop calls lived inline
// in startServer with no test exercising them. These assert BOTH crons boot.
describe("bootstrap schedulers — wiring guard (6-4 aped-review)", () => {
  test("startSchedulers boots BOTH the bank-refresh cron and the suggestion-backfill sweep", () => {
    const { bank, backfill, deps } = makeDeps();
    startSchedulers(deps);
    expect(bank.start).toHaveBeenCalledTimes(1);
    expect(backfill.start).toHaveBeenCalledTimes(1);
  });

  test("stopSchedulers stops BOTH", () => {
    const { bank, backfill, deps } = makeDeps();
    stopSchedulers(deps);
    expect(bank.stop).toHaveBeenCalledTimes(1);
    expect(backfill.stop).toHaveBeenCalledTimes(1);
  });
});
