import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloCheckbox } from "./PekuloCheckbox";

describe("PekuloCheckbox snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloCheckbox checked={false} onCheckedChange={vi.fn()} aria-label="Accept terms">
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloCheckbox checked onCheckedChange={vi.fn()} aria-label="Accept terms">
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
