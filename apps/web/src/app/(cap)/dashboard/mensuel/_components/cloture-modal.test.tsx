import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// L25 (2026-05-20): vi.hoisted so the mock is available during the
// hoisted vi.mock factory. fireEvent.submit on the aria-labeled form
// (lesson 2026-05-20 — click on type="submit" is fragile in happy-dom).

const { signOffMonthlyMock } = vi.hoisted(() => ({
  signOffMonthlyMock: vi.fn(),
}));
vi.mock("../_actions/monthly-actions", () => ({
  signOffMonthly: signOffMonthlyMock,
  reopenMonthly: vi.fn(),
  getMonthly: vi.fn(),
  listMonthly: vi.fn(),
}));

import { ClotureModal } from "./cloture-modal";

describe("ClotureModal envelope (5-5 AC-1)", () => {
  test("ok:true — submits derived defaults when user leaves fields untouched", async () => {
    signOffMonthlyMock.mockResolvedValueOnce({
      ok: true,
      record: {
        id: "mr_signoff0000000000000",
        year: 2026,
        monthNum: 5,
        incomeEur: 3943,
        spendingEur: 2500,
        transfersEur: 500,
        netChangeEur: 1443,
        signedOffAt: "2026-05-27T10:00:00.000Z",
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ClotureModal
          open
          onOpenChange={onOpenChange}
          year={2026}
          monthNum={5}
          derivedIncomeEur={3943}
          derivedSpendingEur={2500}
          derivedTransfersEur={500}
          derivedNetChangeEur={1443}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );
    fireEvent.submit(getByRole("form", { name: "Clôturer le mois" }));
    await waitFor(() => expect(signOffMonthlyMock).toHaveBeenCalledTimes(1));
    expect(signOffMonthlyMock.mock.calls[0]?.[0]).toEqual({
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1443,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("ok:false MONTHLY_OUT_OF_WINDOW — inline error renders, modal stays open", async () => {
    signOffMonthlyMock.mockResolvedValueOnce({
      ok: false,
      code: "MONTHLY_OUT_OF_WINDOW",
      message: "Hors fenêtre de clôture",
    });
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ClotureModal
          open
          onOpenChange={onOpenChange}
          year={2026}
          monthNum={5}
          derivedIncomeEur={3943}
          derivedSpendingEur={2500}
          derivedTransfersEur={500}
          derivedNetChangeEur={1443}
        />
      </QueryClientProvider>,
    );
    fireEvent.submit(getByRole("form", { name: "Clôturer le mois" }));
    await waitFor(() => expect(signOffMonthlyMock).toHaveBeenCalledTimes(1));
    await findAllByText(/Hors fenêtre de clôture/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
