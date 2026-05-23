import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/realestate-actions", () => ({
  recordValuation: vi.fn(),
}));

import { ValuationUpdateForm } from "./valuation-update-form";

const FAKE_PROPERTY: RealEstate = {
  id: "res_test",
  userId: "00000000-0000-0000-0000-000000000000",
  label: "Appartement",
  propertyType: "residence-principale",
  currentValuation: 250_000,
  lastValuedOn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ValuationUpdateForm a11y (AC-6)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ValuationUpdateForm property={FAKE_PROPERTY} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
