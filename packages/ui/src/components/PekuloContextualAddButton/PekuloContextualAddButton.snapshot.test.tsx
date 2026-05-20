import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloContextualAddButton } from "./PekuloContextualAddButton";

describe("PekuloContextualAddButton snapshot", () => {
  it("renders styled FAB with aria-label + plus icon", () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton label="Ajouter une transaction" onPress={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
