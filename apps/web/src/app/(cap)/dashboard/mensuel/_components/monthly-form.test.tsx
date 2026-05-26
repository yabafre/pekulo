// AC-2 / AC-6 (story 5-4):
//   AC-2 — overriding a numeric field then submitting fires upsert with the
//   exact values the user typed (no silent transformation).
//   AC-6 — the form carries aria-label="Mois en cours" so axe-core finds it,
//   and every input is paired with its own label via PekuloFieldLabel htmlFor.
//
// Lessons re-applied:
//   - vi.hoisted for the mock (factory is hoisted before const initializers)
//   - fireEvent.submit(form) keyed by getByRole("form", { name }) — happy-dom
//     doesn't bubble Enter or button-click to the form onSubmit reliably.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderWithTamagui } from "../../../../../../test/setup";

const { upsertMutateAsync } = vi.hoisted(() => ({
  upsertMutateAsync: vi.fn().mockResolvedValue({
    id: "mr_xxx00000000000000000000",
    year: 2026,
    monthNum: 5,
    incomeEur: 3943,
    spendingEur: 2500,
    transfersEur: 500,
    netChangeEur: 1443,
    signedOffAt: null,
    createdAt: "2026-05-25T10:00:00.000Z",
  }),
}));

vi.mock("../_hooks/use-upsert-monthly", () => ({
  useUpsertMonthly: () => ({ mutateAsync: upsertMutateAsync, isPending: false }),
}));

import { MonthlyForm } from "./monthly-form";

const DEFAULTS = {
  year: 2026,
  monthNum: 5,
  incomeEur: 3943,
  spendingEur: 2100,
  transfersEur: 500,
  netChangeEur: 1843,
  signedOffAt: null as null,
};

function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient();
  return renderWithTamagui(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MonthlyForm", () => {
  it("renders with default values + aria-label='Mois en cours'", () => {
    renderWithClient(<MonthlyForm year={2026} monthNum={5} defaults={DEFAULTS} />);
    expect(screen.getByRole("form", { name: /Mois en cours/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/Entrées/) as HTMLInputElement).value).toBe("3943");
    expect((screen.getByLabelText(/Sorties/) as HTMLInputElement).value).toBe("2100");
  });

  it("overriding Sorties recomputes Net (incomeEur - spendingEur)", () => {
    renderWithClient(<MonthlyForm year={2026} monthNum={5} defaults={DEFAULTS} />);
    const spending = screen.getByLabelText(/Sorties/) as HTMLInputElement;
    fireEvent.change(spending, { target: { value: "2500" } });
    expect(spending.value).toBe("2500");
    expect((screen.getByLabelText(/^Net/) as HTMLInputElement).value).toBe("1443");
  });

  it("submit fires upsert with the (possibly overridden) values", async () => {
    upsertMutateAsync.mockClear();
    renderWithClient(<MonthlyForm year={2026} monthNum={5} defaults={DEFAULTS} />);
    fireEvent.change(screen.getByLabelText(/Sorties/), { target: { value: "2500" } });
    const form = screen.getByRole("form", { name: /Mois en cours/i });
    fireEvent.submit(form);
    expect(upsertMutateAsync).toHaveBeenCalledWith({
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1443,
    });
  });

  it("onSubmitSuccess fires after upsert resolves", async () => {
    upsertMutateAsync.mockClear();
    const onSubmitSuccess = vi.fn();
    renderWithClient(
      <MonthlyForm
        year={2026}
        monthNum={5}
        defaults={DEFAULTS}
        onSubmitSuccess={onSubmitSuccess}
      />,
    );
    fireEvent.submit(screen.getByRole("form", { name: /Mois en cours/i }));
    // mutateAsync resolves synchronously on the mock — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(onSubmitSuccess).toHaveBeenCalledTimes(1);
  });
});
