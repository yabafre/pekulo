import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSeparator } from "./PekuloSeparator";

describe("PekuloSeparator snapshot", () => {
  it("renders horizontal", () => {
    const { container } = renderWithTamagui(<PekuloSeparator />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders vertical", () => {
    const { container } = renderWithTamagui(<PekuloSeparator vertical />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
