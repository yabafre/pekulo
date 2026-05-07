import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHoldingRow } from "./PekuloHoldingRow";

describe("PekuloHoldingRow snapshot", () => {
  it("renders gain", () => {
    const { container } = renderWithTamagui(
      <PekuloHoldingRow
        holding={{
          ticker: "CW8.PA",
          label: "MSCI World",
          account: "PEA",
          kind: "etf",
          quantity: 142,
          pricePerUnit: 532.5,
          marketValueEur: 75615,
          pnlEur: 8420,
          pnlPct: 12.5,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-flex-start _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3 _gap-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><div class="is_View _fd-row _items-baseline _gap-6px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-600">CW8.PA</span><span class="is_Text _col-colorTertia3655 _fs-f-size-11 _fw-500">ETF</span></div><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">MSCI World · PEA</span><span class="is_Text _dsp-_lg_flex _col-colorTertia3655 _fs-f-size-11 _dsp-none">142 × 532,50&nbsp;€</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">75 615&nbsp;€</span><span class="is_Text _col-success _fs-f-size-xs">+8 420&nbsp;€ (+12.5%)</span></div></div><div style="display: contents;"></div></span>"`);
  });
  it("renders loss", () => {
    const { container } = renderWithTamagui(
      <PekuloHoldingRow
        holding={{
          ticker: "BTC",
          label: "Bitcoin",
          account: "Crypto.com",
          kind: "crypto",
          quantity: 0.45,
          pricePerUnit: 56000,
          marketValueEur: 25200,
          pnlEur: -3800,
          pnlPct: -13.1,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-flex-start _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3 _gap-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><div class="is_View _fd-row _items-baseline _gap-6px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-600">BTC</span><span class="is_Text _col-colorTertia3655 _fs-f-size-11 _fw-500">CRYPTO</span></div><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Bitcoin · Crypto.com</span><span class="is_Text _dsp-_lg_flex _col-colorTertia3655 _fs-f-size-11 _dsp-none">0.45 × 56 000,00&nbsp;€</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">25 200&nbsp;€</span><span class="is_Text _col-danger _fs-f-size-xs">−3 800&nbsp;€ (−13.1%)</span></div></div><div style="display: contents;"></div></span>"`);
  });
});
