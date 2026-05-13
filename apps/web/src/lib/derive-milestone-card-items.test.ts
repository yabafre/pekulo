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
      compassObjectif: 800_000,
      compassHorizonYears: 25,
      currentYear: 2026,
    });
    expect(out.map((x) => x.targetYear)).toEqual([2028, 2032, 2040]);
    expect(out.map((x) => x.status)).toEqual(["ahead", "on-track", "behind"]);
    expect(out[0]?.label).toBe("A");
    // 2028: linearPlan = 110_000 + (2028-2026)*32_000 = 174_000 → 174k/100k clamped to 1
    expect(out[0]?.progressPct).toBeCloseTo(1, 5);
    // 2032: linearPlan = 110_000 + (2032-2026)*32_000 = 302_000 → 302k/200k clamped to 1
    expect(out[1]?.progressPct).toBeCloseTo(1, 5);
    // 2040: linearPlan = 110_000 + (2040-2026)*32_000 = 558_000 → 558k/500k clamped to 1
    expect(out[2]?.progressPct).toBeCloseTo(1, 5);
    // AC-5 plumb: domain id rides the derive helper so the row can route
    // delete (and future edit) affordances back to the mutation hooks.
    expect(out.map((x) => x.id)).toEqual([
      "mst_bbbbbbbbbbbbbbbbbbbbb",
      "mst_aaaaaaaaaaaaaaaaaaaaa",
      "mst_ccccccccccccccccccccc",
    ]);
  });

  test("linear plan visual — far-future palier with small wealth lights up under plan rate", () => {
    // Reproduces ux-preview MilestoneRow math (App.tsx:1005-1007): a 500k
    // milestone in 2055 with 110k current wealth and a 32k/year plan rate
    // projects to 110k + 29*32k = 1.038M > 500k → donut full. The
    // pre-1-4 ratio currentWealth/target = 22% would render a near-empty
    // donut instead.
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_far", 2055, 500_000)],
      statuses: [],
      currentWealth: 110_000,
      compassObjectif: 800_000,
      compassHorizonYears: 25,
      currentYear: 2026,
    });
    expect(out[0]?.progressPct).toBeCloseTo(1, 5);
  });

  test("near palier with no plan headroom yet — donut reflects shortfall", () => {
    // 2028 palier at 250k, with 50k wealth and 20k/year plan: linearPlan
    // = 50k + 2*20k = 90k → ratio 90/250 = 0.36
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_near", 2028, 250_000)],
      statuses: [],
      currentWealth: 50_000,
      compassObjectif: 500_000,
      compassHorizonYears: 25,
      currentYear: 2026,
    });
    expect(out[0]?.progressPct).toBeCloseTo(0.36, 5);
  });

  test("no compass info → falls back to snapshot ratio (degraded first paint)", () => {
    // While the compass query hasn't resolved, render donut from
    // currentWealth/target so the row isn't blank. Matches the comment in
    // the derive helper.
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_a", 2030, 100_000)],
      statuses: [],
      currentWealth: 25_000,
    });
    expect(out[0]?.progressPct).toBeCloseTo(0.25, 5);
  });

  test("missing status → defaults to on-track + delta 0", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 0,
      compassObjectif: 100_000,
      compassHorizonYears: 10,
      currentYear: 2026,
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

  test("currentWealth=0 + no plan → progressPct=0", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 0,
    });
    expect(out[0]?.progressPct).toBe(0);
  });

  test("currentWealth + plan above target → progressPct clamped to 1", () => {
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_aaaaaaaaaaaaaaaaaaaaa", 2030, 100_000)],
      statuses: [],
      currentWealth: 250_000,
      compassObjectif: 100_000,
      compassHorizonYears: 10,
      currentYear: 2026,
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

  test("past targetYear (yearsFromNow < 0) clamps to current snapshot", () => {
    // If a palier is somehow already in the past, the plan delta is 0
    // (yearsFromNow clamped) so the donut shows the current snapshot ratio
    // against that target — the palier is overdue but not artificially
    // inflated by projecting the plan backwards.
    const out = deriveMilestoneCardItems({
      milestones: [m("mst_overdue", 2024, 100_000)],
      statuses: [],
      currentWealth: 60_000,
      compassObjectif: 800_000,
      compassHorizonYears: 25,
      currentYear: 2026,
    });
    // yearsFromNow clamps to 0 → linearPlan = 60k → 60/100 = 0.6
    expect(out[0]?.progressPct).toBeCloseTo(0.6, 5);
  });
});
