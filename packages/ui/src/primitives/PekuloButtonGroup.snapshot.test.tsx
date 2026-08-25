import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloButtonGroup } from "./PekuloButtonGroup";
import { PekuloButton } from "./PekuloButton";

describe("PekuloButtonGroup snapshot", () => {
  it("renders horizontal with two buttons", () => {
    const { container } = renderWithTamagui(
      <PekuloButtonGroup>
        <PekuloButton>Annuler</PekuloButton>
        <PekuloButton>Confirmer</PekuloButton>
      </PekuloButtonGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      [data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
      [data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: -1px; }
      [data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-top-right-radius: 0; }
      [data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:last-child) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: -1px; }
      </style><div role="group" data-slot="button-group" data-orientation="horizontal" class="is_View _fd-row _items-stretch" style="width: fit-content;"><style>
      .pekulo-btn {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: opacity 150ms ease-out, transform 100ms ease-out, background-color 150ms ease-out;
      }
      .pekulo-btn:not(:disabled):hover { opacity: 0.92; }
      .pekulo-btn:not(:disabled):active { transform: translateY(1px); }
      .pekulo-btn:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-btn[data-variant="link"]:not(:disabled):hover {
        text-decoration: underline;
        text-underline-offset: 4px;
        opacity: 1;
      }
      </style><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Annuler</button><style>
      .pekulo-btn {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: opacity 150ms ease-out, transform 100ms ease-out, background-color 150ms ease-out;
      }
      .pekulo-btn:not(:disabled):hover { opacity: 0.92; }
      .pekulo-btn:not(:disabled):active { transform: translateY(1px); }
      .pekulo-btn:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-btn[data-variant="link"]:not(:disabled):hover {
        text-decoration: underline;
        text-underline-offset: 4px;
        opacity: 1;
      }
      </style><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Confirmer</button></div><div style="display: contents;"></div></span>"
    `);
  });

  it("renders vertical", () => {
    const { container } = renderWithTamagui(
      <PekuloButtonGroup orientation="vertical">
        <PekuloButton>Annuler</PekuloButton>
        <PekuloButton>Confirmer</PekuloButton>
      </PekuloButtonGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      [data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
      [data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: -1px; }
      [data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-top-right-radius: 0; }
      [data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:last-child) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: -1px; }
      </style><div role="group" data-slot="button-group" data-orientation="vertical" class="is_View _fd-column _items-stretch" style="width: fit-content;"><style>
      .pekulo-btn {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: opacity 150ms ease-out, transform 100ms ease-out, background-color 150ms ease-out;
      }
      .pekulo-btn:not(:disabled):hover { opacity: 0.92; }
      .pekulo-btn:not(:disabled):active { transform: translateY(1px); }
      .pekulo-btn:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-btn[data-variant="link"]:not(:disabled):hover {
        text-decoration: underline;
        text-underline-offset: 4px;
        opacity: 1;
      }
      </style><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Annuler</button><style>
      .pekulo-btn {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: opacity 150ms ease-out, transform 100ms ease-out, background-color 150ms ease-out;
      }
      .pekulo-btn:not(:disabled):hover { opacity: 0.92; }
      .pekulo-btn:not(:disabled):active { transform: translateY(1px); }
      .pekulo-btn:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-btn[data-variant="link"]:not(:disabled):hover {
        text-decoration: underline;
        text-underline-offset: 4px;
        opacity: 1;
      }
      </style><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Confirmer</button></div><div style="display: contents;"></div></span>"
    `);
  });
});
