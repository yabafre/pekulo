import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/holdings-actions", () => ({
  createHolding: vi.fn(),
}));

import { HoldingCreateForm } from "./holding-create-form";

describe("HoldingCreateForm a11y (AC-11)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <HoldingCreateForm accounts={[]} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
