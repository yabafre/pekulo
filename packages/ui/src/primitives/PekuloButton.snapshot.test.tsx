import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloButton } from "./PekuloButton";

describe("PekuloButton snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(<PekuloButton>Enregistrer</PekuloButton>);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Enregistrer</button><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders loading", () => {
    const { container } = renderWithTamagui(
      <PekuloButton loading loadingLabel="Enregistrement…">
        Enregistrer
      </PekuloButton>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" data-slot="button" data-variant="default" data-size="default" aria-busy="true" disabled="" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: not-allowed; opacity: 0.5; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;"><div aria-hidden="true" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div>Enregistrement…</button><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders disabled", () => {
    const { container } = renderWithTamagui(<PekuloButton disabled>Enregistrer</PekuloButton>);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" data-slot="button" data-variant="default" data-size="default" disabled="" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: not-allowed; opacity: 0.5; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Enregistrer</button><div style="display: contents;"></div></span>"`,
    );
  });
});
