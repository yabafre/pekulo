import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloContextualAddButton } from "./PekuloContextualAddButton";

describe("PekuloContextualAddButton snapshot", () => {
  it("renders for transactions", () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton
        activeNav="transactions"
        label="Ajouter une transaction"
        onPress={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders nothing for cap", () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton activeNav="cap" label="..." onPress={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
