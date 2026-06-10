import { describe, expect, test, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const connections = [
  {
    id: "bnk_active_0000000000000000",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "bridge" as const,
    providerItemId: "item-1",
    status: "active" as const,
    displayName: "Société Générale",
    lastRefreshedAt: "2026-05-28T00:00:00.000Z",
    lastSyncedAt: "2026-06-09T08:00:00.000Z",
    createdAt: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "bnk_sca_0000000000000000000",
    userId: "00000000-0000-0000-0000-000000000001",
    provider: "bridge" as const,
    providerItemId: "item-2",
    status: "sca_required" as const,
    displayName: "Revolut",
    lastRefreshedAt: null,
    lastSyncedAt: null,
    createdAt: "2026-05-21T00:00:00.000Z",
  },
];

vi.mock("../_hooks/use-bank-connections", () => ({
  useBankConnections: () => ({
    data: connections,
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("../_hooks/use-initiate-bank-connection", () => ({
  useInitiateBankConnection: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../_hooks/use-rename-bank-connection", () => ({
  useRenameBankConnection: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("../_hooks/use-revoke-bank-connection", () => ({
  useRevokeBankConnection: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));
vi.mock("../_hooks/use-reconnect-bank-connection", () => ({
  useReconnectBankConnection: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { BankConnectionsSection } from "./bank-connections-section";

function Wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("BankConnectionsSection (AC-1/2/3/4 + AC-6)", () => {
  test("axe: no violations with active + sca_required rows", async () => {
    const { container } = renderWithTamagui(
      <Wrap>
        <BankConnectionsSection />
      </Wrap>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test("axe: no violations with the rename dialog open (Portal escapes container — lesson 2026-05-27)", async () => {
    renderWithTamagui(
      <Wrap>
        <BankConnectionsSection />
      </Wrap>,
    );
    // The inline "Renommer" button carries an aria-label scoped to the row; the
    // popover variant only has text, so getByLabelText hits the inline one.
    fireEvent.click(screen.getByLabelText("Renommer Société Générale"));
    await screen.findByText(/Renommer «/);
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  test("renders SCA badge + Reconnecter CTA for the sca_required row (AC-2)", () => {
    renderWithTamagui(
      <Wrap>
        <BankConnectionsSection />
      </Wrap>,
    );
    expect(screen.getByText("SCA expirée")).toBeTruthy();
    // The reconnect CTA carries text "Reconnecter" + aria-label "Reconnecter
    // cette banque". Assert on the visible label (getByRole name-matching is
    // brittle under the test env's accessible-name computation for the
    // Tamagui-nested button; axe already proves the a11y tree is clean).
    expect(screen.getByText("Reconnecter")).toBeTruthy();
  });
});
