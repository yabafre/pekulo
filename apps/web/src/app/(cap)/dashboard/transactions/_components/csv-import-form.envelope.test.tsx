import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// L25 (2026-05-20) — vi.hoisted shares the mock fn between vi.mock's hoisted
// phase and per-test reassignment.
const { previewImportCsvMock, importCsvMock } = vi.hoisted(() => ({
  previewImportCsvMock: vi.fn(),
  importCsvMock: vi.fn(),
}));

vi.mock("../_hooks/use-preview-import-csv", () => ({
  usePreviewImportCsv: () => ({ mutate: previewImportCsvMock, isPending: false, data: null }),
}));
vi.mock("../_hooks/use-import-transactions-csv-form", () => ({
  useImportTransactionsCsvForm: () => ({ mutate: importCsvMock, isPending: false }),
}));
vi.mock("../../_accounts/_actions/accounts-actions", () => ({
  listAccounts: vi.fn(async () => []),
}));

import { CsvImportForm } from "./csv-import-form";

// AC-3 (verbatim, story 5-2-csv-import.md:19):
//   Given csvText = "2026-05-01,"unbalanced quote,xxx", When A calls
//   previewImportCsv, Then the service rejects with INVALID_CSV → HTTP 400
//   carrying the parser's error message.
// AC-2 (verbatim, story 5-2-csv-import.md:18):
//   Given csvText with 1001 rows, When A calls previewImportCsv, Then the
//   service rejects with PAYLOAD_TOO_LARGE → HTTP 413.
describe("CsvImportForm envelope (AC-2/AC-3 — previewImportCsv error paths)", () => {
  beforeEach(() => {
    previewImportCsvMock.mockReset();
    importCsvMock.mockReset();
  });

  test("renders the INVALID_CSV message inline when preview returns { ok: false }", async () => {
    previewImportCsvMock.mockImplementation(
      (_input: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
        opts?.onSuccess?.({
          ok: false,
          code: "INVALID_CSV",
          message: "csv parse failed: unbalanced quote",
        });
      },
    );
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CsvImportForm open={true} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.change(getByLabelText("Contenu CSV"), {
      target: { value: 'broken,"csv' },
    });
    // 2026-05-20 lesson — submit via getByRole("form", { name }).
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    await waitFor(() => expect(previewImportCsvMock).toHaveBeenCalledTimes(1));
    expect(await findByText("csv parse failed: unbalanced quote")).toBeTruthy();
  });

  test("renders the PAYLOAD_TOO_LARGE message inline", async () => {
    previewImportCsvMock.mockImplementation(
      (_input: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
        opts?.onSuccess?.({
          ok: false,
          code: "PAYLOAD_TOO_LARGE",
          message: "csv has 1001 rows (max 1000)",
        });
      },
    );
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CsvImportForm open={true} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.change(getByLabelText("Contenu CSV"), { target: { value: "x" } });
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    await waitFor(() => expect(previewImportCsvMock).toHaveBeenCalledTimes(1));
    expect(await findByText(/csv has 1001 rows/)).toBeTruthy();
  });
});

// aped-review M1 — stale-preview guard: editing the textarea AFTER a clean
// preview re-disables the Confirm CTA and surfaces a French "relance Aperçu"
// warning. The component must not import rows that diverge from what the user
// currently sees.
describe("CsvImportForm — stale-preview guard (aped-review M1)", () => {
  beforeEach(() => {
    previewImportCsvMock.mockReset();
    importCsvMock.mockReset();
  });

  test("editing the textarea after a clean preview disables Confirm + shows alert", async () => {
    previewImportCsvMock.mockImplementation(
      (_input: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
        opts?.onSuccess?.({
          ok: true,
          rows: [
            {
              index: 0,
              raw: {
                occurredOn: "2026-05-01",
                amountRaw: "42.50",
                label: "Test",
                accountLabel: "Compte courant",
              },
              parsed: {
                occurredOn: "2026-05-01",
                amount: 42.5,
                type: "inflow",
                category: "autre",
                label: "Test",
                accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
                isImprevu: false,
                notes: null,
              },
            },
          ],
          summary: { total: 1, valid: 1, invalid: 0 },
        });
      },
    );
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CsvImportForm open={true} onOpenChange={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.change(getByLabelText("Contenu CSV"), {
      target: { value: "2026-05-01,42.50,Test,Compte courant" },
    });
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    const confirmBtn = await findByText("Confirmer (1)");
    expect((confirmBtn.closest("button") as HTMLButtonElement).disabled).toBe(false);

    // User edits the textarea after preview — preview state is now stale.
    fireEvent.change(getByLabelText("Contenu CSV"), {
      target: { value: "2026-05-01,99,Edited,Compte courant" },
    });
    expect(await findByText(/relance « Aperçu » avant de confirmer/)).toBeTruthy();
    expect((confirmBtn.closest("button") as HTMLButtonElement).disabled).toBe(true);

    // Clicking Confirmer while stale must NOT trigger importCsvMock.
    fireEvent.click(confirmBtn);
    expect(importCsvMock).not.toHaveBeenCalled();
  });
});

// AC-13 — happy import path: clean preview → confirm → success toast.
describe("CsvImportForm envelope (AC-13 — importCsv happy path)", () => {
  beforeEach(() => {
    previewImportCsvMock.mockReset();
    importCsvMock.mockReset();
  });

  test("clean preview enables 'Confirmer (N)' CTA + import success closes dialog", async () => {
    previewImportCsvMock.mockImplementation(
      (_input: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
        opts?.onSuccess?.({
          ok: true,
          rows: [
            {
              index: 0,
              raw: {
                occurredOn: "2026-05-01",
                amountRaw: "42.50",
                label: "Test",
                accountLabel: "Compte courant",
              },
              parsed: {
                occurredOn: "2026-05-01",
                amount: 42.5,
                type: "inflow",
                category: "autre",
                label: "Test",
                accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
                isImprevu: false,
                notes: null,
              },
            },
          ],
          summary: { total: 1, valid: 1, invalid: 0 },
        });
      },
    );
    importCsvMock.mockImplementation(
      (_input: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
        opts?.onSuccess?.({ ok: true, persisted: 1 });
      },
    );
    const onOpenChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { getByLabelText, getByRole, findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CsvImportForm open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );
    fireEvent.change(getByLabelText("Contenu CSV"), {
      target: { value: "2026-05-01,42.50,Test,Compte courant" },
    });
    fireEvent.submit(getByRole("form", { name: "Importer un CSV" }));
    const confirmBtn = await findByText("Confirmer (1)");
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(importCsvMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
