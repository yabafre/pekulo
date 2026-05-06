import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloRadioGroup } from "./PekuloRadioGroup";

describe("PekuloRadioGroup snapshot", () => {
  it("renders 3 options, second selected", () => {
    const { container } = renderWithTamagui(
      <PekuloRadioGroup value="b" onValueChange={vi.fn()} aria-label="Choix">
        <PekuloRadioGroup.Item value="a" id="a" aria-label="A" />
        <PekuloRadioGroup.Item value="b" id="b" aria-label="B" />
        <PekuloRadioGroup.Item value="c" id="c" aria-label="C" />
      </PekuloRadioGroup>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
