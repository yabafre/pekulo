// apps/web/src/app/(cap)/dashboard/_components/hero-anchor.test.tsx
// Story 7-2 (AC-1, AC-8) — the FR-41 hero anchor. The headline figure is the
// 7-1 TOTAL-WEALTH aggregate (AC-8), NOT the compass current-wealth; a compact
// "Prochain palier" line shows the next milestone delta when one is ahead.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTamagui } from "../../../../../test/setup";
import { HeroAnchor } from "./hero-anchor";

vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
vi.mock("../_compass/_components/compass-section", () => ({ useCapDashboardState: vi.fn() }));
vi.mock("../_hooks/use-milestone-statuses", () => ({ useMilestoneStatuses: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";
import { useCapDashboardState } from "../_compass/_components/compass-section";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";

const overview = vi.mocked(useDashboardOverview);
const capState = vi.mocked(useCapDashboardState);
const statuses = vi.mocked(useMilestoneStatuses);

const strip = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "");

beforeEach(() => {
  // PekuloCountUpEUR reads matchMedia in an effect; jsdom has none. Reduced
  // motion → it resolves to the target immediately, with no rAF.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  overview.mockReset();
  capState.mockReset();
  statuses.mockReset();
});

function setOverview(totalWealthEur: number) {
  overview.mockReturnValue({
    data: {
      totalWealthEur,
      composition: { liquideEur: totalWealthEur, placementsEur: 0, immobilierEur: 0 },
      compass: null,
      fx: { source: "live", asOf: "2026-06-04" },
      recentActivity: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboardOverview>);
}

function setCap(currentWealth: number) {
  capState.mockReturnValue({
    currentWealth,
    horizonAbsoluteYearMax: 2050,
    compassObjectif: 800_000,
    compassHorizonYears: 10,
  } as ReturnType<typeof useCapDashboardState>);
}

function setStatuses(rows: unknown[]) {
  statuses.mockReturnValue({ data: rows, isLoading: false } as ReturnType<
    typeof useMilestoneStatuses
  >);
}

describe("HeroAnchor", () => {
  it("AC-8 — the headline is the total-wealth aggregate, not compass current wealth", () => {
    setOverview(276_000);
    setCap(100_000); // deliberately different from totalWealthEur
    setStatuses([]);
    const { container } = renderWithTamagui(<HeroAnchor />);
    expect(strip(container.textContent)).toContain("276000€");
    expect(strip(container.textContent)).not.toContain("100000€");
  });

  it("shows the next-milestone line when a milestone is still ahead", () => {
    setOverview(276_000);
    setCap(100_000);
    setStatuses([
      { id: "ms_x0000000000000000000000", status: "behind", expectedAt: 2030, delta: 1500 },
    ]);
    const { getByText } = renderWithTamagui(<HeroAnchor />);
    getByText(/Prochain palier/);
  });

  it("hides the next-milestone line when every milestone is reached", () => {
    setOverview(276_000);
    setCap(100_000);
    setStatuses([
      { id: "ms_x0000000000000000000000", status: "ahead", expectedAt: 2030, delta: -10 },
    ]);
    const { queryByText } = renderWithTamagui(<HeroAnchor />);
    expect(queryByText(/Prochain palier/)).toBeNull();
  });
});
