import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTrajectoryCard } from "./PekuloTrajectoryCard";

describe("PekuloTrajectoryCard snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloTrajectoryCard
        months={[0, 3, 6, 9, 12]}
        actual={[100, 105, 112, 118, 124]}
        plan={[100, 104, 108, 112, 116]}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><section aria-label="Trajectoire" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Trajectoire</span></div><div class="is_View _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><svg width="100%" height="180" viewBox="0 0 600 180" role="img" aria-label="Trajectoire patrimoine"><path d="M 8 172 L 154 144.66666666666669 L 300 117.33333333333334 L 446 90 L 592 62.66666666666667" stroke="var(--chartPlan)" stroke-width="2" stroke-dasharray="4 4" fill="none"></path><path d="M 8 172 L 154 137.83333333333331 L 300 90 L 446 49 L 592 8" stroke="var(--chartActual)" stroke-width="2" fill="none"></path></svg></div></section><div style="display: contents;"></div></span>"`);
  });
});
