import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("@/lib/actions/accounts-actions", () => ({
  createAccount: vi.fn(),
}));

import { AccountCreateForm } from "./account-create-form";

// AC-10 (verbatim from docs/stories/2-3-accounts-ui.md:29):
//   Given I run `bun --filter=web run test`, When the a11y test suite
//   executes, Then axe-core reports zero violations on accounts-section.tsx,
//   account-create-form.tsx, account-delete-confirm.tsx.
describe("AccountCreateForm a11y (AC-10)", () => {
  test("zero axe violations", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <AccountCreateForm />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
