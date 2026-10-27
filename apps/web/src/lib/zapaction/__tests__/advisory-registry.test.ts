import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateTags } from "@zapaction/query";
// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.
import { advisoryKeys, advisoryTags } from "../keys";

describe("advisory zapaction registry keys and tags", () => {
  it("generates correct query keys scoped under advisory", () => {
    expect(advisoryKeys.status()[0]).toBe("advisory");
    expect(advisoryKeys.latestSession()[0]).toBe("advisory");
    expect(advisoryKeys.snapshot()[0]).toBe("advisory");
  });

  it("invalidateTags(advisoryTags.session()) invalidates latestSession and snapshot caches", async () => {
    const qc = new QueryClient();
    qc.setQueryData(advisoryKeys.latestSession(), { id: "advs_1" });
    qc.setQueryData(advisoryKeys.snapshot(), { asOf: "2026-10-27" });

    expect(qc.getQueryState(advisoryKeys.latestSession())?.isInvalidated).toBe(false);
    expect(qc.getQueryState(advisoryKeys.snapshot())?.isInvalidated).toBe(false);

    await invalidateTags(qc, [advisoryTags.session()]);

    expect(qc.getQueryState(advisoryKeys.latestSession())?.isInvalidated).toBe(true);
    expect(qc.getQueryState(advisoryKeys.snapshot())?.isInvalidated).toBe(true);
  });
});
