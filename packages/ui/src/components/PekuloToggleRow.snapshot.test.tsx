import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloToggleRow } from "./PekuloToggleRow";

describe("PekuloToggleRow snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow
        label="LLM tiers"
        sub="Activer le routage cloud"
        checked={false}
        onChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow label="LLM tiers" checked onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
