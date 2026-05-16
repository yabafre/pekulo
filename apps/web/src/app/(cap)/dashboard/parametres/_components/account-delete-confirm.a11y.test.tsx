import { describe, expect, test, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";

const deleteMock = vi.fn();
vi.mock("@/lib/actions/accounts-actions", () => ({
  deleteAccount: (input: { id: string }) => deleteMock(input),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountDeleteConfirm } from "./account-delete-confirm";

const acc = {
  id: "acc_aaaaaaaaaaaaaaaaaaaaa",
  userId: "00000000-0000-0000-0000-000000000001",
  label: "Livret A",
  type: "livret" as const,
  currency: "EUR" as const,
  cashBalance: 5_000,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function Wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// AC-2 (verbatim from docs/stories/2-3-accounts-ui.md:18):
//   ... the dialog renders the localised message "Ce compte est référencé
//   par des positions — supprimez-les d'abord." inside a role="alert" Text
//   node. The account row stays in the list (no optimistic remove on
//   ok: false).
// AC-10 — zero axe violations on account-delete-confirm.tsx.
describe("AccountDeleteConfirm (AC-2 + AC-10)", () => {
  test("axe: no violations when open", async () => {
    const { container } = renderWithTamagui(
      <Wrap>
        <AccountDeleteConfirm account={acc} open={true} onOpenChange={() => {}} />
      </Wrap>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test("FK envelope → surfaces localised FK message in role=alert", async () => {
    deleteMock
      .mockReset()
      .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_REFERENCED_FK", message: "fk" });
    renderWithTamagui(
      <Wrap>
        <AccountDeleteConfirm account={acc} open={true} onOpenChange={() => {}} />
      </Wrap>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("référencé par des positions"),
    );
  });
});
