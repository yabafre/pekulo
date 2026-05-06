import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloActivityRow } from "./PekuloActivityRow";

describe("PekuloActivityRow snapshot", () => {
  it("renders inflow", () => {
    const { container } = renderWithTamagui(
      <PekuloActivityRow
        tx={{
          label: "Salaire",
          account: "Compte courant",
          category: "Revenus",
          direction: "in",
          amountEur: 3200,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders outflow", () => {
    const { container } = renderWithTamagui(
      <PekuloActivityRow
        tx={{
          label: "Carrefour",
          account: "CB",
          category: "Courses",
          direction: "out",
          amountEur: 87,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
