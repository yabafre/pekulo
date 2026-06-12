// apps/web/src/app/(cap)/dashboard/_components/recent-activity-section.test.tsx
// Story 7-2 (AC-2, AC-7) — the shared Recent-activity widget. Renders one row
// per overview.recentActivity item; each row navigates to /dashboard/transactions
// on press; a skeleton while loading; an empty state when there is no activity.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import type { DashboardActivity } from "@pekulo/validators";
import { renderWithTamagui } from "../../../../../test/setup";
import { RecentActivitySection } from "./recent-activity-section";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../_hooks/use-dashboard-overview", () => ({ useDashboardOverview: vi.fn() }));
import { useDashboardOverview } from "../_hooks/use-dashboard-overview";

const mocked = vi.mocked(useDashboardOverview);

function withActivity(rows: DashboardActivity[]) {
  return {
    data: {
      totalWealthEur: 1000,
      composition: { liquideEur: 1000, placementsEur: 0, immobilierEur: 0 },
      compass: null,
      fx: { source: "live", asOf: "2026-06-04" },
      recentActivity: rows,
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useDashboardOverview>;
}

const FIVE: DashboardActivity[] = Array.from({ length: 5 }, (_, i) => ({
  label: `Tx ${i + 1}`,
  account: "Compte courant",
  category: "courses",
  direction: i % 2 === 0 ? "out" : "in",
  amountEur: 10 + i,
  logoUrl: null,
}));

describe("RecentActivitySection", () => {
  beforeEach(() => {
    mocked.mockReset();
    push.mockReset();
  });

  it("renders one row per recent-activity item", () => {
    mocked.mockReturnValue(withActivity(FIVE));
    const { getAllByRole } = renderWithTamagui(<RecentActivitySection />);
    expect(getAllByRole("listitem")).toHaveLength(5);
  });

  it("navigates to /dashboard/transactions when a row is pressed (AC-2)", () => {
    mocked.mockReturnValue(withActivity(FIVE));
    const { getAllByRole } = renderWithTamagui(<RecentActivitySection />);
    fireEvent.click(getAllByRole("button")[0]!);
    expect(push).toHaveBeenCalledWith("/dashboard/transactions");
  });

  it("shows an empty state when there is no activity", () => {
    mocked.mockReturnValue(withActivity([]));
    const { getByText } = renderWithTamagui(<RecentActivitySection />);
    getByText(/Aucune activité récente/);
  });
});
