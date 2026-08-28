import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDatePicker } from "./PekuloDatePicker";

// AC-4: fixed value → the trigger label is deterministic. The popover is
// closed by default, so the calendar's own month never enters this snapshot.
const JANUARY_15_2026 = new Date(2026, 0, 15);
const JANUARY_31_2026 = new Date(2026, 0, 31);

describe("PekuloDatePicker snapshot", () => {
  it("renders closed with a selected single date", () => {
    const { container } = renderWithTamagui(
      <PekuloDatePicker value={JANUARY_15_2026} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" style="display: inline-flex; flex-direction: row; align-items: center; gap: 8px; width: 280px; justify-content: flex-start; padding: 0px 12px; height: 32px; background-color: var(--backgroundMuted); color: var(--color); border: none none; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; opacity: 1;" aria-label="Sélectionner une date" aria-expanded="false" data-state="closed" data-disable-theme="true" aria-haspopup="dialog" class="is_View "><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg><span style="text-align: left; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;">15 janvier 2026</span></button><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders closed with an empty value", () => {
    const { container } = renderWithTamagui(
      <PekuloDatePicker value={undefined} onChange={vi.fn()} placeholder="Choisir une date" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" style="display: inline-flex; flex-direction: row; align-items: center; gap: 8px; width: 280px; justify-content: flex-start; padding: 0px 12px; height: 32px; background-color: var(--backgroundMuted); color: var(--color); border: none none; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; opacity: 1;" aria-label="Sélectionner une date" aria-expanded="false" data-state="closed" data-disable-theme="true" aria-haspopup="dialog" class="is_View "><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg><span style="text-align: left; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;">Choisir une date</span></button><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders closed in range mode", () => {
    const { container } = renderWithTamagui(
      <PekuloDatePicker
        mode="range"
        value={{ from: JANUARY_15_2026, to: JANUARY_31_2026 }}
        onChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" style="display: inline-flex; flex-direction: row; align-items: center; gap: 8px; width: 280px; justify-content: flex-start; padding: 0px 12px; height: 32px; background-color: var(--backgroundMuted); color: var(--color); border: none none; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; opacity: 1;" aria-label="Sélectionner une date" aria-expanded="false" data-state="closed" data-disable-theme="true" aria-haspopup="dialog" class="is_View "><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg><span style="text-align: left; flex-grow: 1; flex-shrink: 1; flex-basis: 0%;">15 janvier 2026 → 31 janvier 2026</span></button><div style="display: contents;"></div></span>"`,
    );
  });
});
