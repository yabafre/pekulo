import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloErrorBoundary } from "./PekuloErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

describe("PekuloErrorBoundary a11y", () => {
  it("fallback has role=alert and no serious violations", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, getByRole } = renderWithTamagui(
      <PekuloErrorBoundary>
        <Boom />
      </PekuloErrorBoundary>,
    );
    expect(getByRole("alert")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
    spy.mockRestore();
  });
});
