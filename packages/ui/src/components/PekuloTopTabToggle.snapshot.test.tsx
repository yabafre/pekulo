import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTopTabToggle } from "./PekuloTopTabToggle";

describe("PekuloTopTabToggle snapshot", () => {
  it("renders cap active", () => {
    const { container } = renderWithTamagui(
      <PekuloTopTabToggle topTab="cap" onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders patrimoine active", () => {
    const { container } = renderWithTamagui(
      <PekuloTopTabToggle topTab="patrimoine" onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
