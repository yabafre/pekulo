import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloErrorBoundary } from "./PekuloErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

describe("PekuloErrorBoundary snapshot", () => {
  it("renders children when no error", () => {
    const { container } = renderWithTamagui(
      <PekuloErrorBoundary>
        <span>ok</span>
      </PekuloErrorBoundary>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders default fallback when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderWithTamagui(
      <PekuloErrorBoundary>
        <Boom />
      </PekuloErrorBoundary>,
    );
    expect(container.innerHTML).toMatchSnapshot();
    spy.mockRestore();
  });
});
