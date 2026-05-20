import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloErrorBoundary } from "./PekuloErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

describe("PekuloErrorBoundary snapshot", () => {
  it("renders children when no error", () => {
    const { container } = renderWithTamagui(
      <PekuloErrorBoundary>
        <span>ok</span>
      </PekuloErrorBoundary>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span>ok</span><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders default fallback when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderWithTamagui(
      <PekuloErrorBoundary>
        <Boom />
      </PekuloErrorBoundary>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="alert" aria-live="polite" class="is_View _bg-backgroundC96851 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><span class="is_Text _col-danger _fs-f-size-body2682 _fw-600">Une erreur s'est produite.</span><span class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _mt-c-space-1">kaboom</span></div><div style="display: contents;"></div></span>"`,
    );
    spy.mockRestore();
  });
});
