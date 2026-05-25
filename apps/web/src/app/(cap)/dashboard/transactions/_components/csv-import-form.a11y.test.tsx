import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_hooks/use-preview-import-csv", () => ({
  usePreviewImportCsv: () => ({ mutate: vi.fn(), isPending: false, data: null }),
}));
vi.mock("../_hooks/use-import-transactions-csv-form", () => ({
  useImportTransactionsCsvForm: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../parametres/_actions/accounts-actions", () => ({
  listAccounts: vi.fn(async () => []),
}));

import { CsvImportForm } from "./csv-import-form";

// AC-11/AC-12 — the dialog renders accessibly with the paste textarea +
// preview affordance. zero serious/critical axe violations.
describe("CsvImportForm a11y (AC-11/AC-12)", () => {
  test("zero axe violations when open", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CsvImportForm open={true} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
