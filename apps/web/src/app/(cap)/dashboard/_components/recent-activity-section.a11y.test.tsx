// apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.a11y.test.tsx
// Story 7-2 (AC-7, AC-5) — zero critical/serious axe violations on the
// Recent-activity widget (populated, navigable rows).
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { DashboardActivity } from "@pekulo/validators";
import { renderWithTamagui } from "../../../../../test/setup";
import { RecentActivitySection } from "./recent-activity-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

const ROWS: DashboardActivity[] = Array.from({ length: 3 }, (_, i) => ({
  label: `Tx ${i + 1}`,
  account: "Compte courant",
  category: "courses",
  direction: i % 2 === 0 ? "out" : "in",
  amountEur: 12 + i,
  logoUrl: null,
}));

describe("RecentActivitySection a11y", () => {
  it("has no axe violations with data", async () => {
    vi.mocked(useDashboardOverview).mockReturnValue({
      data: {
        totalWealthEur: 1000,
        composition: { liquideEur: 1000, placementsEur: 0, immobilierEur: 0 },
        compass: null,
        fx: { source: "live", asOf: "2026-06-04" },
        recentActivity: ROWS,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useDashboardOverview>);
    const { container } = renderWithTamagui(<RecentActivitySection variant="flat" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
