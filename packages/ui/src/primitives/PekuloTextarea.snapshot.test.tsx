import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTextarea } from "./PekuloTextarea";

describe("PekuloTextarea snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloTextarea aria-label="Notes" placeholder="Note interne" rows={3} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><textarea data-slot="textarea" class="pekulo-field" style="width: 100%; min-height: 80px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 8px 12px; font-size: 14px; border: none none; font-family: inherit; resize: vertical;" aria-label="Notes" placeholder="Note interne" rows="3"></textarea><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders invalid", () => {
    const { container } = renderWithTamagui(
      <PekuloTextarea aria-label="Notes" placeholder="Note interne" rows={3} invalid />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><textarea data-slot="textarea" class="pekulo-field" style="width: 100%; min-height: 80px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 8px 12px; font-size: 14px; border: 1px solid; font-family: inherit; resize: vertical; border-width: var(--danger); border-style: var(--danger); border-color: var(--danger);" aria-label="Notes" placeholder="Note interne" rows="3"></textarea><div style="display: contents;"></div></span>"`,
    );
  });
});
