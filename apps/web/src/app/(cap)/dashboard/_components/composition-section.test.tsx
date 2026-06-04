// apps/web/src/app/(cap)/dashboard/_components/composition-section.test.tsx
// Story 7-2 (AC-9, AC-7) — the shared Composition widget. Three rows (Liquide /
// Placements / Immobilier) with each amount's share-of-total %, a skeleton
// while loading, and an empty state when total wealth is 0.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTamagui } from "../../../../../test/setup";
import { CompositionSection } from "./composition-section";

vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

const mocked = vi.mocked(useDashboardOverview);

function overview(over: Record<string, unknown> = {}) {
  return {
    data: {
      totalWealthEur: 1000,
      composition: { liquideEur: 500, placementsEur: 300, immobilierEur: 200 },
      compass: null,
      fx: { source: "live", asOf: "2026-06-04" },
      recentActivity: [],
      ...over,
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboardOverview>;
}

describe("CompositionSection", () => {
  beforeEach(() => mocked.mockReset());

  it("renders the three rows with their share-of-total percentages", () => {
    mocked.mockReturnValue(overview());
    const { getByText, container } = renderWithTamagui(<CompositionSection />);
    getByText("Liquide");
    getByText("Placements");
    getByText("Immobilier");
    expect(container.textContent).toContain("50%");
    expect(container.textContent).toContain("30%");
    expect(container.textContent).toContain("20%");
  });

  it("shows a skeleton while loading (no rows yet)", () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useDashboardOverview>);
    const { queryByText } = renderWithTamagui(<CompositionSection />);
    expect(queryByText("Liquide")).toBeNull();
  });

  it("shows an empty state when total wealth is 0", () => {
    mocked.mockReturnValue(
      overview({
        totalWealthEur: 0,
        composition: { liquideEur: 0, placementsEur: 0, immobilierEur: 0 },
      }),
    );
    const { getByText } = renderWithTamagui(<CompositionSection />);
    getByText(/Aucune donnée/);
  });
});
