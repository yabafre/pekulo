// AC-7 (story 7-3): the record-projection mutation hook invalidates via
//   useActionMutation(recordHypothesisProjection, {
//     invalidateWithTags: [hypothesesTags.current()] })
// and that edge must refetch BOTH hypothesesKeys.current() AND every
// hypothesesKeys.projection(*) entry (the bare ["hypotheses","projection"]
// prefix in keys.ts, TanStack prefix-match). This asserts the wiring so a
// future edit that drops the projection prefix is caught (R4/R12).
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateTags } from "@zapaction/query";
import { hypothesesKeys, hypothesesTags } from "../keys";

describe("hypotheses tag registry — AC-7", () => {
  it("projection() key carries the ['hypotheses','projection'] prefix the edge matches on", () => {
    // The registry edge invalidates the bare ["hypotheses","projection"] prefix;
    // every projection(w) entry must start with it (and carry the wealth).
    expect(hypothesesKeys.projection(60_000).slice(0, 2)).toEqual(["hypotheses", "projection"]);
    expect(hypothesesKeys.projection(60_000)).toContain(60_000);
  });

  for (const [name, tag] of [
    ["current", hypothesesTags.current()],
    ["all", hypothesesTags.all()],
  ] as const) {
    it(`invalidateTags(${name}) reaches current() AND every projection(*)`, async () => {
      const qc = new QueryClient();
      qc.setQueryData(hypothesesKeys.current(), { objectif: 0 });
      qc.setQueryData(hypothesesKeys.projection(60_000), { finalEur: 0 });
      qc.setQueryData(hypothesesKeys.projection(120_000), { finalEur: 0 });

      await invalidateTags(qc, [tag]);

      expect(qc.getQueryState(hypothesesKeys.current())?.isInvalidated).toBe(true);
      // Both distinct-wealth projection entries are caught by the bare prefix.
      expect(qc.getQueryState(hypothesesKeys.projection(60_000))?.isInvalidated).toBe(true);
      expect(qc.getQueryState(hypothesesKeys.projection(120_000))?.isInvalidated).toBe(true);
    });
  }
});
