// AC-5 (story 5-4): every transactions mutation invalidates the monthly
// cache via the tag-registry edge transactionsTags.list() → [MONTHLY_KEY].

import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateTags } from "@zapaction/query";
import { MONTHLY_KEY, monthlyKeys, transactionsTags } from "../keys";

describe("monthly tag registry — AC-5", () => {
  it("invalidateTags(transactionsTags.list()) reaches every monthly cache entry", async () => {
    const qc = new QueryClient();
    const may = monthlyKeys.get(2026, 5);
    const june = monthlyKeys.get(2026, 6);
    qc.setQueryData(may, { source: "derived", record: {} });
    qc.setQueryData(june, { source: "derived", record: {} });

    // Both entries start fresh, not invalidated.
    expect(qc.getQueryState(may)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(june)?.isInvalidated).toBe(false);

    // Fire the actual contract — a transactions mutation's invalidation.
    await invalidateTags(qc, [transactionsTags.list()]);

    // Both monthly slots flip because the transactions edge in the registry
    // resolves to [..., [MONTHLY_KEY]] and TanStack's invalidateQueries is
    // inclusive prefix-match on the queryKey.
    expect(qc.getQueryState(may)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(june)?.isInvalidated).toBe(true);
  });

  it("monthlyKeys.get scopes by (year, monthNum) — distinct months produce distinct cache slots", () => {
    expect(monthlyKeys.get(2026, 5)).not.toEqual(monthlyKeys.get(2026, 6));
    expect(monthlyKeys.get(2026, 5)).not.toEqual(monthlyKeys.get(2027, 5));
  });

  it("MONTHLY_KEY is the bare-prefix string used in registry edges", () => {
    expect(MONTHLY_KEY).toBe("monthly");
    expect(monthlyKeys.get(2026, 5)[0]).toBe(MONTHLY_KEY);
  });
});
