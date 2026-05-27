import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// Review F2 / AC-7 (5-5). Sibling axe scan to cloture-modal.a11y.test.tsx
// — same portal-escape pattern, scan document.body.

vi.mock("../_actions/monthly-actions", () => ({
  signOffMonthly: vi.fn(),
  reopenMonthly: vi.fn(),
  getMonthly: vi.fn(),
  listMonthly: vi.fn(),
}));

import { ReopenConfirm } from "./reopen-confirm";

describe("ReopenConfirm a11y (5-5 AC-7)", () => {
  test("zero axe violations when open", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ReopenConfirm open onOpenChange={() => {}} year={2026} monthNum={5} />
      </QueryClientProvider>,
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
