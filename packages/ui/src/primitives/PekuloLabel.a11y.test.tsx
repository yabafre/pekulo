import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloLabel } from "./PekuloLabel";

describe("PekuloLabel a11y", () => {
  it("renders as label with htmlFor + content", () => {
    const { container, getByText } = renderWithTamagui(
      <>
        <PekuloLabel htmlFor="x">Email</PekuloLabel>
        <input id="x" type="email" />
      </>,
    );
    expect(getByText("Email")).toBeTruthy();
    const label = container.querySelector('label[data-slot="label"]');
    expect(label?.getAttribute("for")).toBe("x");
  });

  it("no critical violations when paired with an input", async () => {
    const { container } = renderWithTamagui(
      <>
        <PekuloLabel htmlFor="y">Nom</PekuloLabel>
        <input id="y" />
      </>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
