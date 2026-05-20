import { describe, it, expect, vi } from "vitest";
import { Sun, Moon, Monitor } from "lucide-react";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloSegmentedControl } from "./PekuloSegmentedControl";

describe("PekuloSegmentedControl snapshot", () => {
  it("renders 3 options, dark active", () => {
    const { container } = renderWithTamagui(
      <PekuloSegmentedControl<"system" | "dark" | "light">
        value="dark"
        onChange={vi.fn()}
        ariaLabel="Thème"
        options={[
          { value: "system", label: "Système", icon: Monitor },
          { value: "dark", label: "Sombre", icon: Moon },
          { value: "light", label: "Clair", icon: Sun },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="radiogroup" aria-label="Thème" class="is_View _fd-row _gap-c-space-1 _pt-c-space-1 _pr-c-space-1 _pb-c-space-1 _pl-c-space-1 _bg-backgroundM3600254 _btlr-10px _btrr-10px _bbrr-10px _bblr-10px"><button role="radio" aria-checked="false" class="is_PekuloSegmented is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _fd-row _items-center _justify-center _gap-6px _grow-1 _shrink-1 _fb-0px _height-36px _btlr-c-radius-md _btrr-c-radius-md _bbrr-c-radius-md _bblr-c-radius-md _cur-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _fw-500">Système</span></button><button role="radio" aria-checked="true" class="is_PekuloSegmented is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _fd-row _items-center _justify-center _gap-6px _grow-1 _shrink-1 _fb-0px _height-36px _btlr-c-radius-md _btrr-c-radius-md _bbrr-c-radius-md _bblr-c-radius-md _cur-pointer _bg-backgroundE69673903"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg><span class="is_Text _col-color _fs-f-size-capt104456 _fw-500">Sombre</span></button><button role="radio" aria-checked="false" class="is_PekuloSegmented is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _fd-row _items-center _justify-center _gap-6px _grow-1 _shrink-1 _fb-0px _height-36px _btlr-c-radius-md _btrr-c-radius-md _bbrr-c-radius-md _bblr-c-radius-md _cur-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _fw-500">Clair</span></button></div><div style="display: contents;"></div></span>"`,
    );
  });
});
