// Story 11-2, NFR-7 / DR-5 (aped-review): the deletion must return within
// 60 s. No single timeout enforces that — the budget is the SUM of every
// bounded phase, in the order settings.service.ts runs them:
//
//   1. provider erasure   revoke pass (a wall-clock budget: the race resolves
//                         at the budget even if one revoke is still in flight,
//                         so that call never extends the clock)
//                         + deleteUser (one Bridge fetch timeout)
//   2. local data         transaction maxWait + transaction timeout
//   3. identity           N attempts × Admin API timeout + the retry delay
//
// Not counted: the two repository reads before the provider call and the
// error-path bookkeeping, which are single-row lookups like every other DB
// read in the app. Raise any constant and this test tells you which other one
// to lower. It is the mechanical form of AC-1's "returns in under 60 s", which
// a unit test cannot time against a real provider.
import { describe, expect, test } from "bun:test";
import { ERASURE_REVOKE_BUDGET_MS } from "../bank-aggregator/bank-aggregator.service";
import { BRIDGE_FETCH_TIMEOUT_MS } from "../bank-aggregator/services/bridge-client";
import { AUTH_ADMIN_TIMEOUT_MS } from "../../platform/auth/supabase-admin";
import { DELETION_TX_MAX_WAIT_MS, DELETION_TX_TIMEOUT_MS } from "./settings.deletion";
import { IDENTITY_ERASE_ATTEMPTS, IDENTITY_RETRY_DELAY_MS } from "./settings.service";

const NFR7_BUDGET_MS = 60_000;

describe("account deletion time budget (NFR-7)", () => {
  test("the worst-case sum of every bounded phase stays under 60 s", () => {
    const providerMs = ERASURE_REVOKE_BUDGET_MS + BRIDGE_FETCH_TIMEOUT_MS;
    const localMs = DELETION_TX_MAX_WAIT_MS + DELETION_TX_TIMEOUT_MS;
    const identityMs = IDENTITY_ERASE_ATTEMPTS * AUTH_ADMIN_TIMEOUT_MS + IDENTITY_RETRY_DELAY_MS;
    const worstCaseMs = providerMs + localMs + identityMs;
    // The object in the assertion makes a red run print every phase.
    expect({
      providerMs,
      localMs,
      identityMs,
      worstCaseMs,
      underBudget: worstCaseMs < NFR7_BUDGET_MS,
    }).toHaveProperty("underBudget", true);
  });
});
