import { describe, expect, test, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// goPrev/goNext referenced inside the hoisted vi.mock factory → vi.hoisted so
// they are initialised before the mock runs (lesson 2026-05-20).
const { goPrev, goNext } = vi.hoisted(() => ({ goPrev: vi.fn(), goNext: vi.fn() }));
vi.mock("./month-scope-context", () => ({
  useMonthScope: () => ({
    month: "2026-02",
    summary: undefined,
    isLoading: false,
    setMonth: vi.fn(),
    goPrev,
    goNext,
  }),
}));

import { MonthNavigator } from "./month-navigator";

describe("MonthNavigator (6-9)", () => {
  test("renders the long French month label", () => {
    renderWithTamagui(<MonthNavigator />);
    expect(screen.getByText("février 2026")).toBeTruthy();
  });
  test("‹ / › buttons step the month", () => {
    renderWithTamagui(<MonthNavigator />);
    fireEvent.click(screen.getByLabelText("Mois précédent"));
    fireEvent.click(screen.getByLabelText("Mois suivant"));
    expect(goPrev).toHaveBeenCalledTimes(1);
    expect(goNext).toHaveBeenCalledTimes(1);
  });
});
