import { describe, expect, test } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../test/setup";
import { MilestonesSection } from "./milestones-section";

describe("MilestonesSection a11y", () => {
  test("zero critical/serious axe violations on empty state", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <MilestonesSection currentWealth={0} horizonAbsoluteYearMax={2050} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
