// apps/web/src/app/(cap)/dashboard/_components/hero-anchor.a11y.test.tsx
// Story 7-2 (AC-7) — zero critical/serious axe violations on the hero anchor
// (card variant — the bento usage).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../test/setup";
import { HeroAnchor } from "./hero-anchor";

vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
vi.mock("../_compass/_components/compass-section", () => ({ useCapDashboardState: vi.fn() }));
vi.mock("../_hooks/use-milestone-statuses", () => ({ useMilestoneStatuses: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";
import { useCapDashboardState } from "../_compass/_components/compass-section";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  vi.mocked(useDashboardOverview).mockReturnValue({
    data: {
      totalWealthEur: 276_000,
      composition: { liquideEur: 276_000, placementsEur: 0, immobilierEur: 0 },
      compass: null,
      fx: { source: "live", asOf: "2026-06-04" },
      recentActivity: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboardOverview>);
  vi.mocked(useCapDashboardState).mockReturnValue({
    currentWealth: 100_000,
    horizonAbsoluteYearMax: 2050,
    compassObjectif: 800_000,
    compassHorizonYears: 10,
  } as ReturnType<typeof useCapDashboardState>);
  vi.mocked(useMilestoneStatuses).mockReturnValue({
    data: [{ id: "ms_x0000000000000000000000", status: "behind", expectedAt: 2030, delta: 1500 }],
    isLoading: false,
  } as ReturnType<typeof useMilestoneStatuses>);
});

describe("HeroAnchor a11y", () => {
  it("has no axe violations in the card variant", async () => {
    const { container } = renderWithTamagui(<HeroAnchor variant="card" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
