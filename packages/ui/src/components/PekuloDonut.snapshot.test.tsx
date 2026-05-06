import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDonut } from "./PekuloDonut";

describe("PekuloDonut snapshot", () => {
  it("renders default (50% no label)", () => {
    const { container } = renderWithTamagui(<PekuloDonut pct={0.5} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders centered label variant", () => {
    const { container } = renderWithTamagui(<PekuloDonut pct={0.72} centered />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
