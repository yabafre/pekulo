// Story 6-9 (FR-64) — provider-level test for the nuqs `?month` URL state, the
// one acceptance path (AC-5: deep-link + back-button) the component/unit suites
// could not reach because they mock nuqs + useMonthScope wholesale. Here we run
// the REAL provider against nuqs' NuqsTestingAdapter and assert: a deep link
// seeds the active month, the server summary seeds it when the URL is empty
// (AC-1), and ‹ / › write the new month with history:"push" so Back restores
// the prior month (AC-5).

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { MonthScopeProvider, useMonthScope } from "./month-scope-context";

// The provider reads the summary to seed the default month; mock the hook so the
// test exercises the URL/state logic, not the server action. month "2026-04" is
// the server-resolved default used by the empty-URL (AC-1) case.
vi.mock("../_hooks/use-month-summary", () => ({
  useMonthSummary: () => ({
    data: { month: "2026-04", incomeEur: 0, spendingEur: 0, netChangeEur: 0 },
    isLoading: false,
  }),
}));

function Probe() {
  const { month, goPrev, goNext } = useMonthScope();
  return (
    <div>
      <span data-testid="month">{month ?? "null"}</span>
      <button type="button" onClick={goPrev}>
        prev
      </button>
      <button type="button" onClick={goNext}>
        next
      </button>
    </div>
  );
}

function renderProvider(searchParams: string, onUrlUpdate?: OnUrlUpdateFunction) {
  return render(
    <MonthScopeProvider>
      <Probe />
    </MonthScopeProvider>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
          {children}
        </NuqsTestingAdapter>
      ),
    },
  );
}

describe("MonthScopeProvider — nuqs ?month URL state (6-9)", () => {
  test("AC-5 — a deep link `?month=2026-02` scopes the active month", () => {
    renderProvider("?month=2026-02");
    expect(screen.getByTestId("month").textContent).toBe("2026-02");
  });

  test("AC-1 — empty URL falls back to the server-resolved summary month", () => {
    renderProvider("");
    expect(screen.getByTestId("month").textContent).toBe("2026-04");
  });

  test("an invalid `?month` is ignored (falls back to the summary month)", () => {
    renderProvider("?month=2026-13");
    expect(screen.getByTestId("month").textContent).toBe("2026-04");
  });

  test("AC-5 — › writes the next month with history:'push' (so Back returns)", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderProvider("?month=2026-02", onUrlUpdate);
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.calls.at(-1)![0];
    expect(event.searchParams.get("month")).toBe("2026-03");
    expect(event.options.history).toBe("push");
  });

  test("AC-5 — ‹ writes the previous month with history:'push'", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    renderProvider("?month=2026-02", onUrlUpdate);
    fireEvent.click(screen.getByText("prev"));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const event = onUrlUpdate.mock.calls.at(-1)![0];
    expect(event.searchParams.get("month")).toBe("2026-01");
    expect(event.options.history).toBe("push");
  });
});
