import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSubmitButton } from "./PekuloSubmitButton";

describe("PekuloSubmitButton snapshot", () => {
  it("renders primary idle", () => {
    const { container } = renderWithTamagui(<PekuloSubmitButton>Valider</PekuloSubmitButton>);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="submit" data-slot="button" data-variant="default" data-size="lg" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; width: 100%; padding: 0px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent; align-self: stretch;">Valider</button><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders danger loading full-width", () => {
    const { container } = renderWithTamagui(
      <PekuloSubmitButton variant="danger" loading loadingLabel="Suppression…" fullWidth>
        Supprimer
      </PekuloSubmitButton>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="submit" data-slot="button" data-variant="destructive" data-size="lg" aria-busy="true" disabled="" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; width: 100%; padding: 0px 12px; border-radius: 9999px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: not-allowed; opacity: 0.5; white-space: nowrap; user-select: none; background-color: var(--danger); color: var(--colorOnAccent); border: 1px solid transparent; align-self: stretch;"><div aria-hidden="true" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div>Suppression…</button><div style="display: contents;"></div></span>"`,
    );
  });
});
