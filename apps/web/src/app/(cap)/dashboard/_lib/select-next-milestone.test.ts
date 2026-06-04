// apps/web/src/app/(cap)/dashboard/_lib/select-next-milestone.test.ts
// Story 7-2 (FR-41, AC-1) — the "next upcoming milestone with delta" selector.
// delta > 0 means BEHIND (€ still to reach); the next milestone is the nearest
// not-yet-reached one (smallest positive delta). All-reached / empty → null.
import { describe, expect, it } from "vitest";
import type { MilestoneStatusEntry } from "@pekulo/validators";
import { selectNextMilestone } from "./select-next-milestone";

function entry(over: Partial<MilestoneStatusEntry>): MilestoneStatusEntry {
  return {
    id: "ms_aaaaaaaaaaaaaaaaaaaaa",
    status: "behind",
    expectedAt: 2030,
    delta: 1000,
    ...over,
  } as MilestoneStatusEntry;
}

describe("selectNextMilestone", () => {
  it("picks the milestone with the smallest positive delta", () => {
    const out = selectNextMilestone([
      entry({ id: "ms_far0000000000000000000", delta: 5000 }),
      entry({ id: "ms_near000000000000000000", delta: 1500 }),
      entry({ id: "ms_mid0000000000000000000", delta: 3000 }),
    ]);
    expect(out).toEqual({ id: "ms_near000000000000000000", deltaEur: 1500 });
  });

  it("returns null when every milestone is reached (delta <= 0)", () => {
    expect(
      selectNextMilestone([
        entry({ delta: 0, status: "on-track" }),
        entry({ delta: -200, status: "ahead" }),
      ]),
    ).toBeNull();
  });

  it("returns null on an empty or undefined list", () => {
    expect(selectNextMilestone([])).toBeNull();
    expect(selectNextMilestone(undefined)).toBeNull();
  });
});
