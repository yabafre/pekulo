import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import {
  PekuloBreadcrumb,
  PekuloBreadcrumbList,
  PekuloBreadcrumbItem,
  PekuloBreadcrumbLink,
  PekuloBreadcrumbPage,
  PekuloBreadcrumbSeparator,
} from "./PekuloBreadcrumb";

describe("PekuloBreadcrumb snapshot", () => {
  it("renders a two-level trail ending on the current page", () => {
    const { container } = renderWithTamagui(
      <PekuloBreadcrumb>
        <PekuloBreadcrumbList>
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbLink href="/dashboard">Cap</PekuloBreadcrumbLink>
          </PekuloBreadcrumbItem>
          <PekuloBreadcrumbSeparator />
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbPage>Portefeuille</PekuloBreadcrumbPage>
          </PekuloBreadcrumbItem>
        </PekuloBreadcrumbList>
      </PekuloBreadcrumb>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><nav aria-label="breadcrumb" data-slot="breadcrumb"><ol data-slot="breadcrumb-list" class="is_View _fd-row _fwr-wrap _items-center _gap-c-space-2 _mt-0px _mr-0px _mb-0px _ml-0px _pt-0px _pr-0px _pb-0px _pl-0px"><li data-slot="breadcrumb-item" class="is_View _fd-row _items-center _gap-c-space-2"><a data-slot="breadcrumb-link" style="color: var(--colorTertiary); text-decoration: none; font-size: 14px; transition: color 150ms ease-out;" href="/dashboard">Cap</a></li><li role="presentation" aria-hidden="true" data-slot="breadcrumb-separator" class="is_View _fd-row _items-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></li><li data-slot="breadcrumb-item" class="is_View _fd-row _items-center _gap-c-space-2"><span aria-current="page" data-slot="breadcrumb-page" class="is_Text _col-color _fs-f-size-body2682 _fw-400">Portefeuille</span></li></ol></nav><div style="display: contents;"></div></span>"`,
    );
  });
});
