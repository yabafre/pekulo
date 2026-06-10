import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/bank-aggregator-actions", () => ({
  renameBankConnection: (input: unknown) => input,
}));

import { BankConnectionRenameForm } from "./bank-connection-rename-form";

const connection = {
  id: "bnk_aaaaaaaaaaaaaaaaaaaaaa",
  userId: "00000000-0000-0000-0000-000000000001",
  provider: "bridge" as const,
  providerItemId: "bridge-item-1",
  status: "active" as const,
  displayName: "Société Générale",
  lastRefreshedAt: null,
  lastSyncedAt: null,
  createdAt: "2026-05-28T00:00:00.000Z",
};

function Wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("BankConnectionRenameForm (AC-3 + AC-6)", () => {
  test("axe: no violations", async () => {
    const { container } = renderWithTamagui(
      <Wrap>
        <BankConnectionRenameForm connection={connection} />
      </Wrap>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
