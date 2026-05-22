import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloPopover } from "./PekuloPopover";

describe("PekuloPopover snapshot", () => {
  it("renders open content", () => {
    const { container } = renderWithTamagui(
      <PekuloPopover open>
        <PekuloPopover.Trigger>
          <Text color="$color">Open</Text>
        </PekuloPopover.Trigger>
        <PekuloPopover.Content>
          <Text color="$color">Popover body</Text>
        </PekuloPopover.Content>
      </PekuloPopover>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" style="display: inline-flex; flex-direction: row; align-items: center;" aria-expanded="false" data-state="closed" data-disable-theme="true" aria-haspopup="dialog" aria-controls="floating-0" class="is_View "><span class="is_Text _col-color">Open</span></button><div style="display: contents;"></div></span>"`,
    );
  });
});
