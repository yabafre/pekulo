import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealEstate } from "@pekulo/types";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/realestate-actions", () => ({
  listValuations: vi.fn().mockResolvedValue([]),
}));

import { ValuationHistoryDialog } from "./valuation-history-dialog";

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

describe("ValuationHistoryDialog a11y (AC-6)", () => {
  test("zero axe violations with empty history", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ValuationHistoryDialog property={FAKE_PROPERTY} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
