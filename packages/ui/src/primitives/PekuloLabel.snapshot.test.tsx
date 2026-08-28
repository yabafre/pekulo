import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloLabel } from "./PekuloLabel";

describe("PekuloLabel snapshot", () => {
  it("renders bound to a control", () => {
    const { container } = renderWithTamagui(<PekuloLabel htmlFor="montant">Montant</PekuloLabel>);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><label data-slot="label" style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; line-height: 1; color: var(--color); user-select: none; cursor: default;" for="montant">Montant</label><div style="display: contents;"></div></span>"`,
    );
  });
});
