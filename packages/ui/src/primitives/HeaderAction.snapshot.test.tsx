import { describe, it, expect } from "vitest";
import { Plus, ChevronDown } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import { HeaderAction } from "./HeaderAction";

describe("HeaderAction snapshot", () => {
  it("renders label only", () => {
    const { container } = renderWithTamagui(<HeaderAction label="Voir tout" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders with left icon", () => {
    const { container } = renderWithTamagui(<HeaderAction icon={Plus} label="Ajouter" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders with right icon", () => {
    const { container } = renderWithTamagui(
      <HeaderAction iconRight={ChevronDown} label="12 mois" />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders disabled state", () => {
    const { container } = renderWithTamagui(<HeaderAction label="Ajouter" disabled />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
