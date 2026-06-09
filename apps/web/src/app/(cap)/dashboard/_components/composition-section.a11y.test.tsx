// apps/web/src/app/(cap)/dashboard/_components/composition-section.a11y.test.tsx
// Story 7-2 (AC-7) — zero critical/serious axe violations on the Composition
// widget (populated state).
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../test/setup";
import { CompositionSection } from "./composition-section";

vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

describe("CompositionSection a11y", () => {
  it("has no axe violations with data", async () => {
    vi.mocked(useDashboardOverview).mockReturnValue({
      data: {
        totalWealthEur: 1000,
        composition: { liquideEur: 500, placementsEur: 300, immobilierEur: 200 },
        compass: null,
        fx: { source: "live", asOf: "2026-06-04" },
        recentActivity: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useDashboardOverview>);
    const { container } = renderWithTamagui(<CompositionSection variant="flat" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
