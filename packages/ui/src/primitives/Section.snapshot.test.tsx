import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { Section } from "./Section";

describe("Section snapshot", () => {
  it("renders default (no header)", () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel="default">
        <span>child</span>
      </Section>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("renders with title only", () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel="titled" title="Trajectoire">
        <span>child</span>
      </Section>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("renders with title + action", () => {
    const { container } = renderWithTamagui(
      <Section
        ariaLabel="titled-with-action"
        title="Paliers"
        action={<button type="button">Voir tout</button>}
      >
        <span>child</span>
      </Section>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
