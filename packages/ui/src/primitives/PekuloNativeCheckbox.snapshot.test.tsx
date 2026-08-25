import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloNativeCheckbox } from "./PekuloNativeCheckbox";

// Uncontrolled on purpose: a `checked` prop without `onChange` makes React warn
// about a controlled input with no handler, which pollutes the test output.
describe("PekuloNativeCheckbox snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(<PekuloNativeCheckbox aria-label="Compte actif" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><input data-slot="checkbox" style="width: 20px; height: 20px; accent-color: var(--color); cursor: pointer;" aria-label="Compte actif" type="checkbox"><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloNativeCheckbox aria-label="Compte actif" defaultChecked />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><input data-slot="checkbox" style="width: 20px; height: 20px; accent-color: var(--color); cursor: pointer;" aria-label="Compte actif" type="checkbox" checked=""><div style="display: contents;"></div></span>"`,
    );
  });
});
