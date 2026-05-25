import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloActivityRow } from "./PekuloActivityRow";

describe("PekuloActivityRow snapshot", () => {
  it("renders inflow", () => {
    const { container } = renderWithTamagui(
      <PekuloActivityRow
        tx={{
          label: "Salaire",
          account: "Compte courant",
          category: "Revenus",
          direction: "in",
          amountEur: 3200,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-right" aria-hidden="true"><path d="m7 7 10 10"></path><path d="M17 7v10H7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Salaire</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Compte courant · Revenus</span></div><span class="is_Text _col-success _fs-f-size-body2682 _fw-500">+3 200&nbsp;€</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders outflow", () => {
    const { container } = renderWithTamagui(
      <PekuloActivityRow
        tx={{
          label: "Carrefour",
          account: "CB",
          category: "Courses",
          direction: "out",
          amountEur: 87,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Carrefour</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB · Courses</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">−87&nbsp;€</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
