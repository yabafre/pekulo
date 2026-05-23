import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/realestate-actions", () => ({
  createProperty: vi.fn(),
}));

import { PropertyCreateForm } from "./property-create-form";

describe("PropertyCreateForm a11y (AC-6)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PropertyCreateForm />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
