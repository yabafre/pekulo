import { describe, expect, test } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../test/setup";
import { AddMilestoneDialogProvider } from "./add-milestone-dialog";
import { MilestonesSection } from "./milestones-section";

describe("MilestonesSection a11y", () => {
  test("zero critical/serious axe violations on empty state", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <AddMilestoneDialogProvider horizonAbsoluteYearMax={2050}>
          <MilestonesSection currentWealth={0} />
        </AddMilestoneDialogProvider>
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
