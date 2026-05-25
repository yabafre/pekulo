import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// next/navigation hooks require the App Router context which happy-dom
// doesn't provide — stub them per the compass-section.a11y precedent.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/dashboard/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: vi.fn(async () => ({ items: [], nextCursor: null })),
  // Story 5-2 — transitively required by CsvImportForm.
  previewImportCsv: vi.fn(),
  importCsv: vi.fn(),
}));
vi.mock("../../parametres/_actions/accounts-actions", () => ({
  listAccounts: vi.fn(async () => []),
}));

// Story 5-3 T8 — direct hook mock so the badge test can seed a transfer row
// synchronously instead of waiting for the action-layer query to resolve.
// vi.hoisted per lesson 2026-05-20 — bare `vi.fn()` constants fail at suite
// load because vi.mock factories are hoisted to module top.
const { transactionsMock } = vi.hoisted(() => ({ transactionsMock: vi.fn() }));
vi.mock("../_hooks/use-transactions", () => ({
  useTransactions: transactionsMock,
}));

import { TransactionsRecentSection } from "./transactions-recent-section";

describe("TransactionsRecentSection a11y (AC-13)", () => {
  test("zero axe violations on empty state", async () => {
    transactionsMock.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // AC-8 (verbatim from story 5-3-transfer-rule.md:31, excerpt):
  //   the caption (tx.account · tx.category) renders as "{accountLabel} · ⇆
  //   Transfert" — the TRANSACTION_CATEGORY_LABELS["transfer"] translation
  //   ("Transfert") prefixed by a small ArrowLeftRight lucide icon (14 px,
  //   var(--colorTertiary), aria-hidden).
  // (Reconciled by aped-review F2 — ships the prescribed lucide icon via the
  //  new categoryPrefix prop on PekuloActivityRow ; the glyph is NOT baked
  //  into the label string so screen readers announce only "Transfert".)
  test("AC-8 — renders 'Transfert' caption with ArrowLeftRight icon when category === 'transfer'", async () => {
    transactionsMock.mockReturnValue({
      data: {
        items: [
          {
            id: "tx_pairaxxxxxxxxxxxxxxxx",
            accountId: "acc_aaa111111111111111111",
            occurredOn: "2026-05-20",
            label: "Virement épargne",
            amount: 120,
            type: "outflow" as const,
            category: "transfer" as const,
            isImprevu: false,
            notes: null,
            transferPairId: "tp_xxxxxxxxxxxxxxxxxxxxx",
            createdAt: "2026-05-20T10:00:00.000Z",
          },
        ],
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
    const qc = new QueryClient();
    const { findByText, container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );
    // findByText waits for the post-hydration paint (the section guards the
    // data render on isHydrated && !isLoading per lesson 2026-05-24 hydration
    // discipline). The plain "Transfert" label comes from the centralised
    // map ; the icon is injected separately by the recent-section consumer.
    await findByText(/Transfert/);
    // The lucide-react ArrowLeftRight icon renders as an inline <svg> with the
    // `lucide-arrow-left-right` class and aria-hidden="true". Asserting on
    // both pins (a) the icon is the prescribed lucide shape, NOT a Unicode
    // glyph, and (b) screen readers skip it.
    const icon = container.querySelector("svg.lucide-arrow-left-right");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
