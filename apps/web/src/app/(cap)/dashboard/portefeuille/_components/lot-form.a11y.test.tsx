import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/holdings-actions", () => ({
  recordLot: vi.fn(),
}));

import { LotForm } from "./lot-form";

const FAKE_HOLDING = {
  id: "hld_test",
  userId: "00000000-0000-0000-0000-000000000000",
  accountId: "acc_test",
  kind: "etf" as const,
  ticker: "CW8",
  isin: null,
  label: "Amundi CW8",
  currency: "EUR" as const,
  quantity: 10,
  avgCost: 24.5,
  lastPrice: 26.1,
  lastPriceAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
};

describe("LotForm a11y (AC-11)", () => {
  test("zero axe violations when open", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <LotForm holding={FAKE_HOLDING} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
