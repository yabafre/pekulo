import { describe, expect, test } from "vitest";
import { deriveMilestoneCardItems } from "./derive-milestone-card-items";

const m = (id: string, year: number, capital: number, label: string | null = null) => ({
  id,
  userId: "00000000-0000-0000-0000-000000000001",
  targetCapital: capital,
  targetYear: year,
  label,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("deriveMilestoneCardItems", () => {
  test("happy path — 3 milestones, all statuses present, sorted asc by year", () => {
    const out = deriveMilestoneCardItems({
      milestones: [
        m("mst_aaaaaaaaaaaaaaaaaaaaa", 2032, 200_000, "B"),
        m("mst_bbbbbbbbbbbbbbbbbbbbb", 2028, 100_000, "A"),
        m("mst_ccccccccccccccccccccc", 2040, 500_000, "C"),
      ],
      statuses: [
        {
          id: "mst_aaaaaaaaaaaaaaaaaaaaa",
          status: "on-track",
          expectedAt: 200_000,
          delta: 0,
        },
        {
          id: "mst_bbbbbbbbbbbbbbbbbbbbb",
          status: "ahead",
          expectedAt: 100_000,
          delta: -10_000,
        },
        {
          id: "mst_ccccccccccccccccccccc",
          status: "behind",
          expectedAt: 500_000,
          delta: 50_000,
        },
      ],
      currentWealth: 110_000,
    });
    expect(out.map((x) => x.targetYear)).toEqual([2028, 2032, 2040]);
    expect(out.map((x) => x.status)).toEqual(["ahead", "on-track", "behind"]);
    expect(out[0]?.label).toBe("A");
    expect(out[0]?.progressPct).toBeCloseTo(1, 5);
    // AC-5 plumb: domain id rides the derive helper so the row can route
    // delete (and future edit) affordances back to the mutation hooks.
    expect(out.map((x) => x.id)).toEqual([
      "mst_bbbbbbbbbbbbbbbbbbbbb",
      "mst_aaaaaaaaaaaaaaaaaaaaa",
      "mst_ccccccccccccccccccccc",
    ]);
  });

  test("missing status → defaults to on-track + delta 0", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 0,
    });
    expect(out[0]?.status).toBe("on-track");
    expect(out[0]?.deltaEur).toBe(0);
  });

  test("null label → 'Palier <year>' fallback", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000, null)],
      statuses: [],
      currentWealth: 0,
    });
    expect(out[0]?.label).toBe("Palier 2030");
  });

  test("currentWealth=0 → progressPct=0", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 0,
    });
    expect(out[0]?.progressPct).toBe(0);
  });

  test("currentWealth above target → progressPct clamped to 1", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 250_000,
    });
    expect(out[0]?.progressPct).toBe(1);
  });

  test("targetCapital=0 (degenerate) → progressPct=0 (no NaN)", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 0)],
      statuses: [],
      currentWealth: 100,
    });
    expect(out[0]?.progressPct).toBe(0);
  });
});
