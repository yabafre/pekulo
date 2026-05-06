import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloNavRail } from "./PekuloNavRail";

describe("PekuloNavRail snapshot", () => {
  it("renders cap active", () => {
    const { container } = renderWithTamagui(
      <PekuloNavRail activeKey="cap" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
