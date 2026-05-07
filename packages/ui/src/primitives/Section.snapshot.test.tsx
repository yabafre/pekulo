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
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="default" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><span>child</span></section><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders with title only", () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel="titled" title="Trajectoire">
        <span>child</span>
      </Section>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="titled" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Trajectoire</span></div><span>child</span></section><div style="display: contents;"></div></span>"`,
    );
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
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="titled-with-action" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Paliers</span><button type="button">Voir tout</button></div><span>child</span></section><div style="display: contents;"></div></span>"`,
    );
  });
});
