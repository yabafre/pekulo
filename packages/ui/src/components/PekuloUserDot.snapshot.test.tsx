import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloUserDot } from "./PekuloUserDot";

describe("PekuloUserDot snapshot", () => {
  it("renders initial", () => {
    const { container } = renderWithTamagui(<PekuloUserDot initial="a" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
