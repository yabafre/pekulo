import { describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const { reopenMonthlyMock } = vi.hoisted(() => ({
  reopenMonthlyMock: vi.fn(),
}));
vi.mock("../_actions/monthly-actions", () => ({
  reopenMonthly: reopenMonthlyMock,
  signOffMonthly: vi.fn(),
  getMonthly: vi.fn(),
  listMonthly: vi.fn(),
}));

import { ReopenConfirm } from "./reopen-confirm";

describe("ReopenConfirm envelope (5-5 AC-3)", () => {
  test("ok:true — closes modal, calls onSuccess", async () => {
    reopenMonthlyMock.mockResolvedValueOnce({
      ok: true,
      record: {
        id: "mr_reopened00000000000",
        year: 2026,
        monthNum: 5,
        incomeEur: 3943,
        spendingEur: 2500,
        transfersEur: 500,
        netChangeEur: 1443,
        signedOffAt: null,
        createdAt: "2026-05-25T10:00:00.000Z",
      },
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ReopenConfirm
          open
          onOpenChange={onOpenChange}
          year={2026}
          monthNum={5}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );
    fireEvent.submit(getByRole("form", { name: "Réouvrir le mois" }));
    await waitFor(() => expect(reopenMonthlyMock).toHaveBeenCalledTimes(1));
    expect(reopenMonthlyMock.mock.calls[0]?.[0]).toEqual({ year: 2026, monthNum: 5 });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("ok:false MONTHLY_NOT_FOUND — inline error renders, modal stays open", async () => {
    reopenMonthlyMock.mockResolvedValueOnce({
      ok: false,
      code: "MONTHLY_NOT_FOUND",
      message: "Mois introuvable",
    });
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByRole, findAllByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <ReopenConfirm open onOpenChange={onOpenChange} year={2026} monthNum={5} />
      </QueryClientProvider>,
    );
    fireEvent.submit(getByRole("form", { name: "Réouvrir le mois" }));
    await waitFor(() => expect(reopenMonthlyMock).toHaveBeenCalledTimes(1));
    await findAllByText(/Mois introuvable/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
