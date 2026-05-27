import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// Review F2 / AC-7 (5-5). Axe scan with the dialog open — the form lives
// inside PekuloDialog.Portal which escapes to document.body, so we pass
// `document.body` to axe instead of the renderWithTamagui container.
//
// What this proves: <form aria-label>, htmlFor↔id on every numeric input,
// PekuloDialog-provided role="dialog" + aria-modal="true", focus trap, ESC
// close (the latter two are PekuloDialog primitives' contract, exercised
// by axe's structural checks).

vi.mock("../_actions/monthly-actions", () => ({
  signOffMonthly: vi.fn(),
  reopenMonthly: vi.fn(),
  getMonthly: vi.fn(),
  listMonthly: vi.fn(),
}));

import { ClotureModal } from "./cloture-modal";

describe("ClotureModal a11y (5-5 AC-7)", () => {
  test("zero axe violations when open", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ClotureModal
          open
          onOpenChange={() => {}}
          year={2026}
          monthNum={5}
          derivedIncomeEur={3943}
          derivedSpendingEur={2500}
          derivedTransfersEur={500}
          derivedNetChangeEur={1443}
        />
      </QueryClientProvider>,
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
