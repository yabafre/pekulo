import { describe, expect, test, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const revokeMock = vi.fn();
vi.mock("../_actions/bank-aggregator-actions", () => ({
  revokeBankConnection: (input: { connectionId: string }) => revokeMock(input),
}));

import { BankConnectionRevokeConfirm } from "./bank-connection-revoke-confirm";

const connection = {
  id: "bnk_aaaaaaaaaaaaaaaaaaaaaa",
  userId: "00000000-0000-0000-0000-000000000001",
  provider: "bridge" as const,
  providerItemId: "bridge-item-1",
  status: "active" as const,
  displayName: "Société Générale",
  lastRefreshedAt: null,
  createdAt: "2026-05-28T00:00:00.000Z",
};

function Wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Portal-mounted dialog — scan document.body, NOT container (lesson 2026-05-27 / 5-5 F2).
describe("BankConnectionRevokeConfirm (AC-4 + AC-6)", () => {
  test("axe: no violations when open", async () => {
    renderWithTamagui(
      <Wrap>
        <BankConnectionRevokeConfirm connection={connection} open onOpenChange={() => {}} />
      </Wrap>,
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  test("PROVIDER_UNAVAILABLE envelope → localised message in role=alert", async () => {
    revokeMock
      .mockReset()
      .mockResolvedValueOnce({ ok: false, code: "BANK_PROVIDER_UNAVAILABLE", message: "down" });
    renderWithTamagui(
      <Wrap>
        <BankConnectionRevokeConfirm connection={connection} open onOpenChange={() => {}} />
      </Wrap>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Révoquer" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Bridge est indisponible"),
    );
  });
});
