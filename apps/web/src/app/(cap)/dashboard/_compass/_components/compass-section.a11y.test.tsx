import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// `useRouter()` calls assertContext on App Router under the hood; happy-dom
// has no router mounted, so we stub the navigation surface for the a11y pass.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

import { AddMilestoneDialogProvider } from "../../_components/add-milestone-dialog";
import { CompassSection } from "./compass-section";

describe("CompassSection a11y", () => {
  test("zero critical/serious axe violations during loading", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <AddMilestoneDialogProvider horizonAbsoluteYearMax={2050}>
          <CompassSection />
        </AddMilestoneDialogProvider>
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
