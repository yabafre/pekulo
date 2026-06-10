// apps/web/src/app/(cap)/dashboard/_components/milestones-section.test.tsx
// Story 7-2 — regression guard for the mobile "empty Paliers" bug. The
// milestones list flex-fills + scrolls inside the desktop bento cell
// (flex:1 + minHeight:0 + overflow-y:auto). That fill MUST be `$lg`-gated:
// on the mobile flat column (auto-height) an ungated flex:1/minHeight:0
// collapses the <ul> to 0 height and `overflow-y:auto` then clips every row,
// so the card renders with its header but no milestones. We assert the fill
// lives only in the `$lg` atomic classes (Tamagui `disableInjectCSS` →
// deterministic atomic classNames).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTamagui } from "../../../../../test/setup";

vi.mock("../_hooks/use-milestones", () => ({ useMilestones: vi.fn() }));
vi.mock("../_hooks/use-milestone-statuses", () => ({ useMilestoneStatuses: vi.fn() }));
vi.mock("../_hooks/use-delete-milestone", () => ({ useDeleteMilestone: vi.fn() }));
vi.mock("@/lib/derive-milestone-card-items", () => ({ deriveMilestoneCardItems: vi.fn() }));
vi.mock("./add-milestone-dialog", () => ({ useAddMilestoneDialog: vi.fn() }));

import { useMilestones } from "../_hooks/use-milestones";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { useDeleteMilestone } from "../_hooks/use-delete-milestone";
import { deriveMilestoneCardItems } from "@/lib/derive-milestone-card-items";
import { useAddMilestoneDialog } from "./add-milestone-dialog";
import { MilestonesSection } from "./milestones-section";

const milestones = vi.mocked(useMilestones);
const statuses = vi.mocked(useMilestoneStatuses);
const del = vi.mocked(useDeleteMilestone);
const derive = vi.mocked(deriveMilestoneCardItems);
const dialog = vi.mocked(useAddMilestoneDialog);

beforeEach(() => {
  milestones.mockReturnValue({
    data: [{ id: "ms_x0000000000000000000000" }],
    isLoading: false,
  } as unknown as ReturnType<typeof useMilestones>);
  statuses.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<
    typeof useMilestoneStatuses
  >);
  del.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useDeleteMilestone>);
  dialog.mockReturnValue({ open: vi.fn() } as unknown as ReturnType<typeof useAddMilestoneDialog>);
  derive.mockReturnValue([
    {
      id: "ms_x0000000000000000000000",
      label: "Pré-retraite",
      targetEur: 200_000,
      targetYear: 2030,
      progressPct: 0.4,
      deltaEur: 1500,
      status: "on-track",
    },
  ]);
});

describe("MilestonesSection", () => {
  it("renders the milestone rows", () => {
    const { getByText, container } = renderWithTamagui(
      <MilestonesSection currentWealth={100_000} />,
    );
    getByText("Pré-retraite");
    expect(container.querySelectorAll("li").length).toBe(1);
  });

  it("regression — list cell-fill is gated to $lg, not applied on mobile", () => {
    const { container } = renderWithTamagui(<MilestonesSection currentWealth={100_000} />);
    const ul = container.querySelector("ul") as HTMLElement | null;
    expect(ul).not.toBeNull();
    const cls = ul!.className;
    // Desktop fill present, but only in the $lg-prefixed form.
    expect(cls).toMatch(/_minH-_lg_0/);
    // No base (mobile) collapse: neither min-height:0 nor flex-basis:0 — those
    // would zero the <ul> on the auto-height mobile column and clip the rows.
    expect(cls).not.toMatch(/_minH-0px/);
    expect(cls.split(/\s+/)).not.toContain("_fb-0px");
  });

  it("flat mode (Patrimoine view) keeps the list natural-height, no fill at all", () => {
    const { container } = renderWithTamagui(
      <MilestonesSection currentWealth={100_000} flat={true} />,
    );
    const ul = container.querySelector("ul") as HTMLElement | null;
    expect(ul).not.toBeNull();
    const cls = ul!.className;
    expect(cls).not.toMatch(/_minH-_lg_0/);
    expect(cls).not.toMatch(/_minH-0px/);
    expect(cls.split(/\s+/)).not.toContain("_fb-0px");
  });
});
