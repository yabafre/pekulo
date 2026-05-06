import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloAccountRow } from "./PekuloAccountRow";

describe("PekuloAccountRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloAccountRow label="PEA Bourso" type="pea" institution="Boursorama" balanceEur={45200} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
