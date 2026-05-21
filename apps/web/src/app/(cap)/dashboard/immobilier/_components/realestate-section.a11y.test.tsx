import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/realestate-actions", () => ({
  listProperties: vi.fn().mockResolvedValue([]),
  listPropertyDerives: vi.fn().mockResolvedValue([]),
  listValuations: vi.fn().mockResolvedValue([]),
  getProperty: vi.fn(),
  createProperty: vi.fn(),
  attachMortgage: vi.fn(),
  updateMortgage: vi.fn(),
  detachMortgage: vi.fn(),
  attachRental: vi.fn(),
  updateRental: vi.fn(),
  detachRental: vi.fn(),
  recordValuation: vi.fn(),
  deleteProperty: vi.fn(),
}));

import { RealestateSection } from "./realestate-section";

describe("RealestateSection a11y (AC-6)", () => {
  test("zero axe violations with empty list", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <RealestateSection />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
