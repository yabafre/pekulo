import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import {
  PekuloCard,
  PekuloCardHeader,
  PekuloCardTitle,
  PekuloCardDescription,
  PekuloCardContent,
  PekuloCardFooter,
} from "./PekuloCard";

describe("PekuloCard snapshot", () => {
  it("renders the full composition at default size", () => {
    const { container } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardHeader>
          <PekuloCardTitle>Compte courant</PekuloCardTitle>
          <PekuloCardDescription>Société Générale</PekuloCardDescription>
        </PekuloCardHeader>
        <PekuloCardContent>2 480,00 €</PekuloCardContent>
        <PekuloCardFooter>Mis à jour aujourd'hui</PekuloCardFooter>
      </PekuloCard>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div data-slot="card" data-size="default" class="is_View _fd-column _gap-c-space-4 _pt-c-space-4 _pb-0px _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _ox-hidden _oy-hidden"><div data-slot="card-header" class="is_View " style="display: grid; grid-template-columns: 1fr auto; grid-auto-rows: min-content; row-gap: 4px; column-gap: 12px; padding-left: 16px; padding-right: 16px; align-items: start;"><span data-slot="card-title" class="is_Text _col-color _fs-f-size-body _fw-500 _lh-236">Compte courant</span><span data-slot="card-description" class="is_Text _col-colorTertia3655 _fs-f-size-capt104456">Société Générale</span></div><div data-slot="card-content" class="is_View _pr-c-space-4 _pl-c-space-4">2 480,00 €</div><div data-slot="card-footer" class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-4 _pr-c-space-4 _pb-c-space-4 _pl-c-space-4 _btw-1px _btc-borderDefau3464 _bg-backgroundM3600254 _bts-solid">Mis à jour aujourd'hui</div></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders at size sm", () => {
    const { container } = renderWithTamagui(
      <PekuloCard size="sm">
        <PekuloCardHeader>
          <PekuloCardTitle>Compte courant</PekuloCardTitle>
        </PekuloCardHeader>
      </PekuloCard>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div data-slot="card" data-size="sm" class="is_View _fd-column _gap-c-space-3 _pt-c-space-3 _pb-c-space-3 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _ox-hidden _oy-hidden"><div data-slot="card-header" class="is_View " style="display: grid; grid-template-columns: 1fr auto; grid-auto-rows: min-content; row-gap: 4px; column-gap: 12px; padding-left: 12px; padding-right: 12px; align-items: start;"><span data-slot="card-title" class="is_Text _col-color _fs-f-size-body2682 _fw-500 _lh-236">Compte courant</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
