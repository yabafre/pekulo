import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSlider } from "./PekuloSlider";

describe("PekuloSlider snapshot", () => {
  it("renders default value", () => {
    const { container } = renderWithTamagui(
      <PekuloSlider value={[40]} max={100} step={1} onValueChange={vi.fn()} aria-label="Versement">
        <PekuloSlider.Track>
          <PekuloSlider.TrackActive />
        </PekuloSlider.Track>
        <PekuloSlider.Thumb index={0} />
      </PekuloSlider>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div dir="ltr" aria-disabled="false" aria-label="Versement" data-orientation="horizontal" class="is_View _fd-column _pos-relative _height-3px _btlr-3px _btrr-3px _bbrr-3px _bblr-3px _justify-center"><div class="css-view-175oi2r" style="left: 0px; right: 0px; top: 0px; bottom: 0px; position: absolute;"><div data-orientation="horizontal" class="is_Slider is_View _fd-column _pos-relative _height-c-size-1 _width-10037 _bg-backgroundM3600254 _btlr-100000px _btrr-100000px _bbrr-100000px _bblr-100000px _ox-hidden _oy-hidden"><div data-orientation="horizontal" class="is_SliderActive is_View _fd-column _pos-absolute _pe-boxnone _bg-color _btlr-100000px _btrr-100000px _bbrr-100000px _bblr-100000px _height-10037" style="left: 0%; right: 60%;"></div></div><div role="slider" aria-valuemin="0" aria-valuenow="40" aria-valuemax="100" aria-orientation="horizontal" data-orientation="horizontal" tabindex="0" data-disable-theme="true" class="is_SliderThumb is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _tr-0focus-visible-translateY0281703016 _fd-column _pos-absolute _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-color _bbs-solid _bts-solid _bls-solid _brs-solid _width-c-size-4 _height-c-size-4 _minW-c-size-4 _minH-c-size-4 _btlr-100000px _btrr-100000px _bbrr-100000px _bblr-100000px _pt-0px _pr-0px _pb-0px _pl-0px _maxW-c-size-4 _maxH-c-size-4" style="top: auto; left: 40%; transform: translateY(0px) translateX(0px); bottom: auto;"></div></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
