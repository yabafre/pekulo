// AC-5 (story 7-1): every wealth-affecting mutation invalidates the dashboard
// overview via the tag-registry edge <feature>Tags.list() -> dashboardKeys.overview().
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateTags } from "@zapaction/query";
import {
  accountsTags,
  bankConnectionsTags,
  compassTags,
  dashboardKeys,
  holdingsTags,
  realestateTags,
  transactionsTags,
} from "../keys";

const WEALTH_TAGS = [
  ["transactions", transactionsTags.list()],
  ["accounts", accountsTags.list()],
  ["holdings", holdingsTags.list()],
  ["realestate", realestateTags.list()],
  ["compass", compassTags.current()],
  ["bankConnections", bankConnectionsTags.list()],
] as const;

describe("dashboard tag registry — AC-5", () => {
  for (const [name, tag] of WEALTH_TAGS) {
    it(`invalidateTags(${name}) reaches dashboardKeys.overview()`, async () => {
      const qc = new QueryClient();
      qc.setQueryData(dashboardKeys.overview(), { totalWealthEur: 0 });
      expect(qc.getQueryState(dashboardKeys.overview())?.isInvalidated).toBe(false);

      await invalidateTags(qc, [tag]);

      expect(qc.getQueryState(dashboardKeys.overview())?.isInvalidated).toBe(true);
    });
  }

  it("dashboardKeys.overview() is the stable read key", () => {
    expect(dashboardKeys.overview()[0]).toBe("dashboard");
  });
});
