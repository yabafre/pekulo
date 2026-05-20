import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloRecentActivityCard } from "./PekuloRecentActivityCard";

describe("PekuloRecentActivityCard snapshot", () => {
  it("renders 2 activities", () => {
    const { container } = renderWithTamagui(
      <PekuloRecentActivityCard
        activities={[
          {
            label: "Salaire",
            account: "CB Bourso",
            category: "Revenus",
            direction: "in",
            amountEur: 3200,
          },
          {
            label: "Carrefour",
            account: "CB Bourso",
            category: "Courses",
            direction: "out",
            amountEur: 87,
          },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="Activité récente" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Activité récente</span></div><div class="is_View _fd-column"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-right" aria-hidden="true"><path d="m7 7 10 10"></path><path d="M17 7v10H7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Salaire</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB Bourso · Revenus</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">+3 200&nbsp;€</span></div><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Carrefour</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB Bourso · Courses</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">−87&nbsp;€</span></div></div></section><div style="display: contents;"></div></span>"`,
    );
  });
});
