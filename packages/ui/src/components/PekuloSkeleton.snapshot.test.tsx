import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSkeleton } from "./PekuloSkeleton";

describe("PekuloSkeleton snapshot", () => {
  it("renders single line", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders 3 lines", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton lines={3} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders block", () => {
    const { container } = renderWithTamagui(<PekuloSkeleton block height={120} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
