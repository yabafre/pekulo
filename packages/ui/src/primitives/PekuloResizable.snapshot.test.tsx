import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import {
  PekuloResizablePanelGroup,
  PekuloResizablePanel,
  PekuloResizableHandle,
} from "./PekuloResizable";

// `defaultSize` is deliberately NOT exercised here. happy-dom reports
// zero-size boxes, so react-resizable-panels v4 has no group width to derive
// percentages from and every panel falls back to `flex-grow: 50` whatever
// value is passed — a snapshot carrying the prop would imply a split ratio it
// cannot actually assert. What these two cases DO pin is the orientation
// contract: flex-direction, touch-action and aria-orientation on the handle.
// Covering real split ratios needs a layout-capable environment (jsdom with a
// stubbed ResizeObserver, or a browser runner) — out of scope for the DS
// snapshot suite.
describe("PekuloResizable snapshot", () => {
  it("renders a horizontal two-panel split", () => {
    const { container } = renderWithTamagui(
      <PekuloResizablePanelGroup orientation="horizontal">
        <PekuloResizablePanel>Gauche</PekuloResizablePanel>
        <PekuloResizableHandle />
        <PekuloResizablePanel>Droite</PekuloResizablePanel>
      </PekuloResizablePanelGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-resizable-handle {
        position: relative;
        display: flex;
        width: 1px;
        align-items: center;
        justify-content: center;
        background-color: var(--borderDefault);
        flex-shrink: 0;
      }
      .pekulo-resizable-handle::after {
        content: "";
        position: absolute;
        inset-block: 0;
        left: 50%;
        width: 4px;
        transform: translateX(-50%);
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"] {
        width: 100%;
        height: 1px;
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"]::after {
        left: 0;
        height: 4px;
        width: 100%;
        transform: translateY(-50%);
        inset-block: auto;
        top: 50%;
      }
      .pekulo-resizable-handle:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-resizable-handle-grip {
        z-index: 10;
        display: flex;
        height: 24px;
        width: 4px;
        flex-shrink: 0;
        border-radius: 8px;
        background-color: var(--borderDefault);
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"] .pekulo-resizable-handle-grip {
        transform: rotate(90deg);
      }
      </style><div data-slot="resizable-panel-group" data-group="true" data-testid="_r_1_" id="_r_1_" style="height: 100%; width: 100%; overflow: hidden; display: flex; flex-direction: row; flex-wrap: nowrap; touch-action: pan-y;"><div data-slot="resizable-panel" data-panel="true" data-testid="_r_2_" id="_r_2_" style="min-height: 0; max-height: 100%; height: auto; min-width: 0; max-width: 100%; width: auto; border: 0px none none; padding: 0px; margin: 0px; display: flex; flex-basis: 0px; flex-shrink: 1; overflow: visible; flex-grow: 50;"><div style="max-height: 100%; max-width: 100%; flex-grow: 1; overflow: auto; touch-action: pan-y;">Gauche</div></div><div data-slot="resizable-handle" aria-orientation="vertical" class="pekulo-resizable-handle" data-separator="inactive" data-testid="_r_3_" id="_r_3_" role="separator" style="flex-basis: auto; flex-grow: 0; flex-shrink: 0; touch-action: none;" tabindex="0"></div><div data-slot="resizable-panel" data-panel="true" data-testid="_r_4_" id="_r_4_" style="min-height: 0; max-height: 100%; height: auto; min-width: 0; max-width: 100%; width: auto; border: 0px none none; padding: 0px; margin: 0px; display: flex; flex-basis: 0px; flex-shrink: 1; overflow: visible; flex-grow: 50;"><div style="max-height: 100%; max-width: 100%; flex-grow: 1; overflow: auto; touch-action: pan-y;">Droite</div></div></div><div style="display: contents;"></div></span>"
    `);
  });

  it("renders a vertical split with a grip handle", () => {
    const { container } = renderWithTamagui(
      <PekuloResizablePanelGroup orientation="vertical">
        <PekuloResizablePanel>Haut</PekuloResizablePanel>
        <PekuloResizableHandle withHandle />
        <PekuloResizablePanel>Bas</PekuloResizablePanel>
      </PekuloResizablePanelGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-resizable-handle {
        position: relative;
        display: flex;
        width: 1px;
        align-items: center;
        justify-content: center;
        background-color: var(--borderDefault);
        flex-shrink: 0;
      }
      .pekulo-resizable-handle::after {
        content: "";
        position: absolute;
        inset-block: 0;
        left: 50%;
        width: 4px;
        transform: translateX(-50%);
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"] {
        width: 100%;
        height: 1px;
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"]::after {
        left: 0;
        height: 4px;
        width: 100%;
        transform: translateY(-50%);
        inset-block: auto;
        top: 50%;
      }
      .pekulo-resizable-handle:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-resizable-handle-grip {
        z-index: 10;
        display: flex;
        height: 24px;
        width: 4px;
        flex-shrink: 0;
        border-radius: 8px;
        background-color: var(--borderDefault);
      }
      .pekulo-resizable-handle[data-panel-group-direction="vertical"] .pekulo-resizable-handle-grip {
        transform: rotate(90deg);
      }
      </style><div data-slot="resizable-panel-group" data-group="true" data-testid="_r_6_" id="_r_6_" style="height: 100%; width: 100%; overflow: hidden; display: flex; flex-direction: column; flex-wrap: nowrap; touch-action: pan-x;"><div data-slot="resizable-panel" data-panel="true" data-testid="_r_7_" id="_r_7_" style="min-height: 0; max-height: 100%; height: auto; min-width: 0; max-width: 100%; width: auto; border: 0px none none; padding: 0px; margin: 0px; display: flex; flex-basis: 0px; flex-shrink: 1; overflow: visible; flex-grow: 50;"><div style="max-height: 100%; max-width: 100%; flex-grow: 1; overflow: auto; touch-action: pan-x;">Haut</div></div><div data-slot="resizable-handle" aria-orientation="horizontal" class="pekulo-resizable-handle" data-separator="inactive" data-testid="_r_8_" id="_r_8_" role="separator" style="flex-basis: auto; flex-grow: 0; flex-shrink: 0; touch-action: none;" tabindex="0"><div class="pekulo-resizable-handle-grip"></div></div><div data-slot="resizable-panel" data-panel="true" data-testid="_r_9_" id="_r_9_" style="min-height: 0; max-height: 100%; height: auto; min-width: 0; max-width: 100%; width: auto; border: 0px none none; padding: 0px; margin: 0px; display: flex; flex-basis: 0px; flex-shrink: 1; overflow: visible; flex-grow: 50;"><div style="max-height: 100%; max-width: 100%; flex-grow: 1; overflow: auto; touch-action: pan-x;">Bas</div></div></div><div style="display: contents;"></div></span>"
    `);
  });
});
