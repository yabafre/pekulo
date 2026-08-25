import { describe, it, expect } from "vitest";
import { Inbox } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import {
  PekuloEmpty,
  PekuloEmptyHeader,
  PekuloEmptyMedia,
  PekuloEmptyTitle,
  PekuloEmptyDescription,
} from "./PekuloEmpty";

describe("PekuloEmpty snapshot", () => {
  it("renders the full composition", () => {
    const { container } = renderWithTamagui(
      <PekuloEmpty>
        <PekuloEmptyHeader>
          <PekuloEmptyMedia variant="icon">
            <Inbox size={20} aria-hidden={true} />
          </PekuloEmptyMedia>
          <PekuloEmptyTitle>Aucune transaction</PekuloEmptyTitle>
          <PekuloEmptyDescription>
            Importez un relevé ou connectez une banque pour commencer.
          </PekuloEmptyDescription>
        </PekuloEmptyHeader>
      </PekuloEmpty>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div data-slot="empty" class="is_View _fd-column _items-center _justify-center _gap-c-space-4 _pt-c-space-6 _pr-c-space-6 _pb-c-space-6 _pl-c-space-6 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _width-10037" style="text-align: center;"><div data-slot="empty-header" class="is_View _fd-column _items-center _gap-c-space-2 _maxW-400px"><div data-slot="empty-icon" data-variant="icon" class="is_View _width-32px _height-32px _items-center _justify-center _bg-backgroundM3600254 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _mb-c-space-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-inbox" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg></div><h3 data-slot="empty-title" style="margin: 0px; color: var(--color); font-size: 14px; font-weight: 500; letter-spacing: -0.1px; line-height: 1.3; text-align: center;">Aucune transaction</h3><p data-slot="empty-description" style="display: block; width: 100%; margin: 0px; color: var(--colorTertiary); font-size: 14px; line-height: 1.5; text-align: center;">Importez un relevé ou connectez une banque pour commencer.</p></div></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders outlined", () => {
    const { container } = renderWithTamagui(
      <PekuloEmpty outlined>
        <PekuloEmptyHeader>
          <PekuloEmptyTitle>Aucune transaction</PekuloEmptyTitle>
        </PekuloEmptyHeader>
      </PekuloEmpty>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div data-slot="empty" class="is_View _fd-column _items-center _justify-center _gap-c-space-4 _pt-c-space-6 _pr-c-space-6 _pb-c-space-6 _pl-c-space-6 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _width-10037" style="border: 1px dashed; text-align: center; border-width: var(--borderDefault); border-style: var(--borderDefault); border-color: var(--borderDefault);"><div data-slot="empty-header" class="is_View _fd-column _items-center _gap-c-space-2 _maxW-400px"><h3 data-slot="empty-title" style="margin: 0px; color: var(--color); font-size: 14px; font-weight: 500; letter-spacing: -0.1px; line-height: 1.3; text-align: center;">Aucune transaction</h3></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
