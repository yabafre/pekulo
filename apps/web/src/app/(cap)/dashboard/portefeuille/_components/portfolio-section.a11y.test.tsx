import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/holdings-actions", () => ({
  listHoldings: vi.fn().mockResolvedValue([]),
  createHolding: vi.fn(),
  recordLot: vi.fn(),
  closeHolding: vi.fn(),
}));
vi.mock("../../_accounts/_actions/accounts-actions", () => ({
  listAccounts: vi.fn().mockResolvedValue([]),
}));

import { PortfolioSection } from "./portfolio-section";

describe("PortfolioSection a11y (AC-11)", () => {
  test("zero axe violations with empty list", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <PortfolioSection />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
