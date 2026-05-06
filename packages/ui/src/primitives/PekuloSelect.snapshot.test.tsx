import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSelect } from "./PekuloSelect";

describe("PekuloSelect snapshot", () => {
  it("renders trigger with value", () => {
    const { container } = renderWithTamagui(
      <PekuloSelect value="eur" onValueChange={vi.fn()}>
        <PekuloSelect.Trigger aria-label="Devise">
          <PekuloSelect.Value placeholder="Choisir" />
        </PekuloSelect.Trigger>
      </PekuloSelect>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
